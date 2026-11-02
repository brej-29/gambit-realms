/**
 * Calibration sweep on TUNING seeds only (1..999). For each candidate level configuration it measures
 * a rating against fixed Stockfish anchors and a blunder profile, then writes docs/results/calibration.json.
 * Levels are then picked from this table, so the reporting run (seeds >= 10000) never influences parameters.
 *
 *   npx tsx eval/calibrate.ts --region low|l1|mid|high [--games 12]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import type { LevelConfig } from '../src/core/ladder';
import { assessMove } from '../src/core/coach';
import { lineScore } from '../src/engine/types';
import { EnginePool } from './engine-pool';
import { GamePool } from './game-pool';
import type { GameRecord, GameTask, PlayerSpec } from './game';
import { assertTuningSeed } from './tune';

const ANCHORS = [1320, 1600, 1900, 2200, 2600, 3190];
const ANCHOR_NODES = 5_000;
const REF_NODES = 20_000;

type Candidate = Omit<LevelConfig, 'id' | 'name'>;
const arg = (name: string, d: string) => process.argv[process.argv.indexOf(`--${name}`) + 1] ?? d;

function grid(region: string): Candidate[] {
  const out: Candidate[] = [];
  if (region === 'low') {
    for (const nodes of [100, 300, 1000, 3000])
      for (const oversight of [0.1, 0.2, 0.3, 0.4, 0.5])
        for (const temperature of [60, 160]) out.push({ nodes, multipv: 4, temperature, oversight });
  } else if (region === 'l1') {
    for (const oversight of [0.35, 0.4, 0.45, 0.5])
      for (const nodes of [100, 300]) out.push({ nodes, multipv: 4, temperature: 160, oversight });
  } else if (region === 'mid') {
    for (const nodes of [1_000, 2_000, 4_000, 8_000])
      for (const temperature of [70, 110, 150])
        for (const oversight of [0, 0.05]) out.push({ nodes, multipv: 4, temperature, oversight });
  } else {
    for (const nodes of [2_000, 6_000, 15_000, 40_000, 100_000, 256_000])
      for (const temperature of [0, 40, 90]) out.push({ nodes, multipv: temperature ? 3 : 1, temperature });
  }
  return out;
}

/** Maximum-likelihood rating from scores against fixed anchors (one pseudo draw per anchor keeps it finite). */
export function ratingVsAnchors(results: { anchor: number; score: number; games: number }[]): number {
  // each anchor counts for its real number of games; one pseudo draw per anchor keeps ratings finite at 0% or 100%
  const rows = [...results.map((r) => ({ anchor: r.anchor, points: r.score * r.games, games: r.games })), ...results.map((r) => ({ anchor: r.anchor, points: 0.5, games: 1 }))];
  const observed = rows.reduce((s, r) => s + r.points, 0);
  const expected = (rating: number) => rows.reduce((s, r) => s + r.games / (1 + 10 ** ((r.anchor - rating) / 400)), 0);
  let lo = 0;
  let hi = 4000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (expected(mid) < observed) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function spec(id: string, c: Candidate): PlayerSpec {
  return { id, kind: 'level', config: { id: 1, name: id, ...c } };
}

async function main() {
  const region = arg('region', 'low');
  const gamesPer = Number(arg('games', '12'));
  const candidates = grid(region);
  const workers = Math.max(1, cpus().length - 2);
  const tasks: GameTask[] = [];
  candidates.forEach((c, ci) => {
    const me = spec(`c${ci}`, c);
    ANCHORS.forEach((elo, ai) => {
      const anchor: PlayerSpec = { id: `elo${elo}`, kind: 'engine', options: { nodes: ANCHOR_NODES, uciElo: elo } };
      for (let g = 0; g < gamesPer; g++) {
        const seed = 1 + ((ci * 131 + ai * 29 + g * 7) % 999);
        assertTuningSeed(seed);
        const meWhite = g % 2 === 0;
        tasks.push({ white: meWhite ? me : anchor, black: meWhite ? anchor : me, seed, paramsHash: `cal-${region}-${ci}`, match: `c${ci}|${elo}`, referenceNodes: REF_NODES });
      }
    });
  });
  console.log(`${candidates.length} candidates, ${tasks.length} games, ${workers} workers`);
  mkdirSync(join(process.cwd(), 'eval', 'out'), { recursive: true });
  const cache = join(process.cwd(), 'eval', 'out', `cal-games-${region}-${gamesPer}.json`);
  let games: GameRecord[];
  if (existsSync(cache)) games = JSON.parse(readFileSync(cache, 'utf8')) as GameRecord[];
  else {
    const pool = new GamePool(workers);
    const t0 = Date.now();
    games = await pool.run(tasks, (done, total) => {
      if (done % 100 === 0) console.log(`games ${done}/${total} ${((Date.now() - t0) / 60000).toFixed(1)} min`);
    });
    pool.dispose();
    writeFileSync(cache, JSON.stringify(games));
  }

  // rating per candidate
  const byCand = new Map<number, GameRecord[]>();
  for (const g of games) {
    const ci = Number(g.match.split('|')[0]!.slice(1));
    (byCand.get(ci) ?? byCand.set(ci, []).get(ci)!).push(g);
  }
  const ref = new EnginePool(workers);
  const rows: unknown[] = [];
  for (const [ci, gs] of [...byCand.entries()].sort((a, b) => a[0] - b[0])) {
    const perAnchor = ANCHORS.map((elo) => {
      const sub = gs.filter((g) => g.match.endsWith(`|${elo}`));
      let pts = 0;
      for (const g of sub) {
        const meWhite = g.white === `c${ci}`;
        pts += g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === meWhite ? 1 : 0;
      }
      return { anchor: elo, score: pts / Math.max(1, sub.length), games: sub.length };
    });
    // blunder profile on a sample of the candidate's own moves
    const own = gs.flatMap((g) => g.moves.filter((m) => m.player === `c${ci}`));
    const sample = own.filter((_, i) => i % 5 === 0).slice(0, 60);
    let blunders = 0;
    let hangs = 0;
    const labelled = await Promise.all(
      sample.map(async (m) => {
        const before = await ref.analyse(m.fen, { nodes: REF_NODES });
        const c = new Chess(m.fen);
        c.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), ...(m.uci[4] ? { promotion: m.uci[4] } : {}) });
        const after = await ref.analyse(c.fen({ forceEnpassantSquare: true }), { nodes: REF_NODES });
        // no reply lines means the move ended the game (mate or stalemate): not a blunder
        const cpl = after[0] && before[0] ? Math.max(0, lineScore(before[0]) + lineScore(after[0])) : 0;
        return { blunder: cpl >= 200, hang: cpl >= 200 && assessMove(m.fen, m.uci).netLoss >= 100 };
      })
    );
    for (const l of labelled) {
      if (l.blunder) blunders++;
      if (l.hang) hangs++;
    }
    rows.push({
      candidate: ci,
      ...candidates[ci],
      rating: Math.round(ratingVsAnchors(perAnchor)),
      perAnchor,
      sampledMoves: sample.length,
      blunderRate: blunders / Math.max(1, sample.length),
      hangShare: blunders ? hangs / blunders : null,
    });
    console.log(JSON.stringify(rows.at(-1)));
  }
  ref.dispose();
  mkdirSync(join(process.cwd(), 'docs', 'results'), { recursive: true });
  const path = join(process.cwd(), 'docs', 'results', 'calibration.json');
  const prev = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>) : {};
  prev[region] = { generatedAt: new Date().toISOString(), seeds: '1..999', anchorNodes: ANCHOR_NODES, referenceNodes: REF_NODES, gamesPerAnchor: gamesPer, rows };
  writeFileSync(path, JSON.stringify(prev, null, 2) + '\n');
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('calibrate.ts')) void main();
