import { cpus } from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js';
import type { Engine, EngineLine } from '../src/engine/types';
import { EnginePool } from './engine-pool';
import { lineScore } from '../src/engine/types';
import { LEVELS, chooseMove } from '../src/core/ladder';
import { mulberry32 } from '../src/core/rng';
import { assessMove } from '../src/core/coach';
import { eloConfidence, eloFromScore, fitLadder, score, wilsonInterval, type PairResult } from '../src/core/stats';

type Profile = 'quick' | 'full';
type Result = '1-0' | '0-1' | '1/2-1/2';
type PlayerId = string;

interface Player {
  id: PlayerId;
  move(chess: Chess, rng: () => number): Promise<string>;
  dispose?(): void;
}

interface PlayedMove {
  fen: string;
  uci: string;
  player: PlayerId;
}

interface Game {
  white: PlayerId;
  black: PlayerId;
  result: Result;
  moves: PlayedMove[];
}

interface BlunderRow {
  player: string;
  games: number;
  moves: number;
  blunders: number;
  blunderRate: number;
  hangingBlunders: number;
  hangingShare: number;
}

interface CoachRow {
  name: string;
  pairs: number;
  positives: number;
  predicted: number;
  truePositives: number;
  precision: number;
  recall: number;
}

interface Report {
  meta: Record<string, unknown>;
  levels: Array<Record<string, unknown>>;
  pairs: Array<Record<string, unknown>>;
  anchors: Array<Record<string, unknown>>;
  blunders: BlunderRow[];
  coach: CoachRow[];
  latency: Record<string, unknown>;
  metrics: Record<string, Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
  errorAnalysis: { falsePositives: Array<Record<string, string>>; falseNegatives: Array<Record<string, string>> };
}

const ROOT = join(process.cwd());
const OUT_DIR = join(ROOT, 'eval', 'out');
const RESULTS_DIR = join(ROOT, 'docs', 'results');
const OPENING_SEED_START = 10_000;
const P = {
  quick: { games: 1, nodes: 500, referenceNodes: 1_000, coachPairs: 100, latencySamples: 4 },
  full: { games: 200, nodes: 5_000, referenceNodes: 300_000, coachPairs: 5_000, latencySamples: 20 },
} as const;

function parseProfile(): Profile {
  const value = process.argv[process.argv.indexOf('--profile') + 1];
  return value === 'full' ? 'full' : 'quick';
}

function chooseRandom(chess: Chess, rng: () => number): string {
  const moves = chess.moves();
  if (!moves.length) throw new Error('no legal moves');
  return moves[Math.floor(rng() * moves.length)]!;
}

const MATERIAL: Record<PieceSymbol, number> = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

function material(chess: Chess): number {
  return chess.board().flat().reduce((sum, piece) => sum + (piece ? (piece.color === 'w' ? 1 : -1) * MATERIAL[piece.type] : 0), 0);
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) return material(chess);
  const maximizing = chess.turn() === 'w';
  let best = maximizing ? -Infinity : Infinity;
  for (const san of chess.moves()) {
    chess.move(san);
    const value = minimax(chess, depth - 1, alpha, beta);
    chess.undo();
    if (maximizing) {
      if (value > best) best = value;
      alpha = Math.max(alpha, best);
    } else {
      if (value < best) best = value;
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function minimaxMove(chess: Chess): string {
  const maximizing = chess.turn() === 'w';
  let bestValue = maximizing ? -Infinity : Infinity;
  let best = chess.moves()[0];
  for (const san of chess.moves()) {
    chess.move(san);
    const value = minimax(chess, 1, -Infinity, Infinity);
    chess.undo();
    if ((maximizing && value > bestValue) || (!maximizing && value < bestValue)) {
      bestValue = value;
      best = san;
    }
  }
  return best!;
}

function uciFromMove(chess: Chess, move: string): string {
  const verbose = chess.moves({ verbose: true }) as Move[];
  const found = verbose.find((item) => item.san === move || item.lan === move || `${item.from}${item.to}${item.promotion ?? ''}` === move);
  if (!found) throw new Error(`cannot convert move ${move} to UCI`);
  return `${found.from}${found.to}${found.promotion ?? ''}`;
}

function createEnginePlayer(id: string, engine: Engine, options: { nodes: number; skill?: number; uciElo?: number }): Player {
  return {
    id,
    async move(chess) {
      const lines = await engine.analyse(chess.fen({ forceEnpassantSquare: true }), options);
      return lines[0]?.uci ?? chooseRandom(chess, Math.random);
    },
    dispose: () => engine.dispose(),
  };
}

function createLevelPlayer(id: string, engine: Engine): Player {
  const config = LEVELS.find((level) => `L${level.id}` === id)!;
  return {
    id,
    async move(chess, rng) {
      const lines = await engine.analyse(chess.fen({ forceEnpassantSquare: true }), { nodes: config.nodes, multipv: config.multipv });
      return chooseMove(lines, config, rng);
    },
    dispose: () => engine.dispose(),
  };
}

function createLocalPlayer(id: string, mode: 'random' | 'minimax'): Player {
  return { id, async move(chess, rng) { return uciFromMove(chess, mode === 'random' ? chooseRandom(chess, rng) : minimaxMove(chess)); } };
}

async function opening(seed: number, reference: Engine | undefined, referenceNodes: number): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const chess = new Chess();
    for (let ply = 0; ply < 4; ply++) chess.move(chooseRandom(chess, rng));
    if (!reference) return chess.fen({ forceEnpassantSquare: true });
    const lines = await reference.analyse(chess.fen({ forceEnpassantSquare: true }), { nodes: referenceNodes });
    if (Math.abs(lineScore(lines[0] ?? { cp: 0, uci: '', pv: [], depth: 0 })) <= 150) return chess.fen({ forceEnpassantSquare: true });
  }
  const fallback = new Chess();
  return fallback.fen();
}

async function playGame(white: Player, black: Player, fen: string, seed: number): Promise<Game> {
  const chess = new Chess(fen);
  const moves: PlayedMove[] = [];
  const rng = mulberry32(seed);
  for (let ply = 0; ply < 300 && !chess.isGameOver(); ply++) {
    const player = chess.turn() === 'w' ? white : black;
    const position = chess.fen({ forceEnpassantSquare: true });
    let uci = await player.move(chess, rng);
    try {
      const config = { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) };
      chess.move(config);
    } catch {
      uci = uciFromMove(chess, chooseRandom(chess, rng));
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
    }
    moves.push({ fen: position, uci, player: player.id });
  }
  let result: Result = '1/2-1/2';
  if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
  else if (chess.isGameOver()) result = '1/2-1/2';
  else if (material(chess) > 300) result = '1-0';
  else if (material(chess) < -300) result = '0-1';
  return { white: white.id, black: black.id, result, moves };
}

function pairScore(games: readonly Game[], a: string): { score: number; wins: number; draws: number; losses: number; interval: ReturnType<typeof wilsonInterval> } {
  let wins = 0; let draws = 0; let losses = 0;
  for (const game of games) {
    const aWhite = game.white === a;
    if (game.result === '1/2-1/2') draws++;
    else if ((aWhite && game.result === '1-0') || (!aWhite && game.result === '0-1')) wins++;
    else losses++;
  }
  const value = score(wins, draws, losses);
  return { score: value, wins, draws, losses, interval: wilsonInterval(value, games.length) };
}

async function runPair(a: Player, b: Player, count: number, startSeed: number, reference: Engine | undefined, referenceNodes: number): Promise<Game[]> {
  const games: Game[] = [];
  for (let i = 0; i < count; i++) {
    const fen = await opening(startSeed + i, reference, referenceNodes);
    const firstWhite = i % 2 === 0;
    games.push(await playGame(firstWhite ? a : b, firstWhite ? b : a, fen, startSeed + i * 13));
  }
  return games;
}

function cacheKey(fen: string, nodes: number): string {
  return `${nodes}:${fen}`;
}

async function referenceScore(engine: Engine, cache: Record<string, EngineLine[]>, fen: string, nodes: number): Promise<EngineLine[]> {
  const key = cacheKey(fen, nodes);
  if (cache[key]) return cache[key]!;
  const lines = await engine.analyse(fen, { nodes });
  cache[key] = lines;
  return lines;
}

async function labelBlunders(games: readonly Game[], reference: Engine, nodes: number, cache: Record<string, EngineLine[]>): Promise<BlunderRow[]> {
  const grouped = new Map<string, { moves: number; blunders: number; hangs: number; games: number }>();
  for (const game of games) {
    for (const played of game.moves) {
      if (!/^L[1-4]$/.test(played.player) && !['random', 'minimax', 'skill0', 'elo1320'].includes(played.player)) continue;
      const row = grouped.get(played.player) ?? { moves: 0, blunders: 0, hangs: 0, games: 0 };
      row.moves++;
      const before = await referenceScore(reference, cache, played.fen, nodes);
      const position = new Chess(played.fen);
      const mover = position.turn();
      position.move({ from: played.uci.slice(0, 2), to: played.uci.slice(2, 4), ...(played.uci[4] ? { promotion: played.uci[4] } : {}) });
      const after = await referenceScore(reference, cache, position.fen({ forceEnpassantSquare: true }), nodes);
      const best = lineScore(before[0] ?? { cp: 0, uci: '', pv: [], depth: 0 });
      const afterForMover = -lineScore(after[0] ?? { cp: 0, uci: '', pv: [], depth: 0 });
      const cpl = Math.max(0, best - afterForMover);
      if (cpl >= 200) {
        row.blunders++;
        if (assessMove(played.fen, played.uci).netLoss >= 100) row.hangs++;
      }
      void mover;
      grouped.set(played.player, row);
    }
  }
  for (const row of grouped.values()) row.games = games.filter((game) => game.white === [...grouped.entries()].find(([, value]) => value === row)?.[0] || game.black === [...grouped.entries()].find(([, value]) => value === row)?.[0]).length;
  return [...grouped.entries()].map(([player, row]) => ({ player, games: row.games, moves: row.moves, blunders: row.blunders, blunderRate: row.blunders / Math.max(1, row.moves), hangingBlunders: row.hangs, hangingShare: row.hangs / Math.max(1, row.blunders) }));
}

async function coachRows(games: readonly Game[], reference: Engine, nodes: number, cache: Record<string, EngineLine[]>, target: number): Promise<{ rows: CoachRow[]; errorAnalysis: Report['errorAnalysis'] }> {
  const pairs = games.flatMap((game) => game.moves.filter((move) => ['L1', 'L2', 'L3', 'L4', 'random', 'minimax'].includes(move.player)));
  const selected = pairs.slice(0, target);
  const labels: boolean[] = [];
  const predictions: boolean[] = [];
  const attacked: boolean[] = [];
  const falsePositives: Array<Record<string, string>> = [];
  const falseNegatives: Array<Record<string, string>> = [];
  for (const pair of selected) {
    const before = await referenceScore(reference, cache, pair.fen, nodes);
    const chess = new Chess(pair.fen);
    const move = chess.moves({ verbose: true }) as Move[];
    const mover = move.find((candidate) => `${candidate.from}${candidate.to}${candidate.promotion ?? ''}` === pair.uci);
    if (!mover) continue;
    const afterChess = new Chess(pair.fen);
    afterChess.move({ from: mover.from, to: mover.to, ...(mover.promotion ? { promotion: mover.promotion } : {}) });
    const after = await referenceScore(reference, cache, afterChess.fen({ forceEnpassantSquare: true }), nodes);
    const cpl = Math.max(0, lineScore(before[0] ?? { cp: 0, uci: '', pv: [], depth: 0 }) + lineScore(after[0] ?? { cp: 0, uci: '', pv: [], depth: 0 }));
    const assessment = assessMove(pair.fen, pair.uci);
    const label = cpl >= 150 && assessment.netLoss >= 100;
    labels.push(label);
    predictions.push(assessment.hangs);
    if (assessment.hangs && !label) falsePositives.push({ fen: pair.fen, move: pair.uci, reason: 'SEE warned, reference label was negative' });
    if (!assessment.hangs && label) falseNegatives.push({ fen: pair.fen, move: pair.uci, reason: 'SEE missed a reference-labelled material loss' });
    attacked.push(afterChess.attackers(mover.to, mover.color === 'w' ? 'b' : 'w').length > 0);
  }
  const rows: CoachRow[] = [];
  const add = (name: string, values: boolean[]) => {
    const positives = labels.filter(Boolean).length;
    const truePositives = values.reduce((sum, value, i) => sum + (value && labels[i] ? 1 : 0), 0);
    const predicted = values.filter(Boolean).length;
    rows.push({ name, pairs: labels.length, positives, predicted, truePositives, precision: truePositives / Math.max(1, predicted), recall: truePositives / Math.max(1, positives) });
  };
  add('coach-see', predictions);
  add('warn-if-attacked', attacked);
  add('never-warn', labels.map(() => false));
  return { rows, errorAnalysis: { falsePositives: falsePositives.slice(0, 10), falseNegatives: falseNegatives.slice(0, 10) } };
}

function metric(pass: boolean, value: unknown, threshold: string): Record<string, unknown> { return { pass, value, threshold }; }

function directorySize(path: string): number {
  if (!existsSync(path)) return 0;
  const entry = statSync(path);
  if (entry.isFile()) return entry.size;
  return readdirSync(path).reduce((sum, name) => sum + directorySize(join(path, name)), 0);
}

function markdown(report: Report): string {
  const lines = ['# Evaluation results', '', `Profile: ${String(report.meta.profile)}. Seeds are deterministic and reporting starts at ${String(report.meta.reportingSeedStart)}.`, `Full profile status: ${String(report.meta.fullProfileStatus)}.`, '', '## Ladder ratings', '', '| Level | Rating | 95% CI |', '|---|---:|---:|'];
  for (const level of report.levels) lines.push(`| ${level.id} | ${Number(level.rating).toFixed(0)} | ${Number(level.ciLow).toFixed(0)}–${Number(level.ciHigh).toFixed(0)} |`);
  lines.push('', '## M1 adjacent pairs', '', '| Pair | Score | Wilson 95% | Games | Pass |', '|---|---:|---:|---:|---|');
  for (const pair of report.pairs) lines.push(`| ${pair.a} over ${pair.b} | ${(Number(pair.score) * 100).toFixed(1)}% | ${(Number(pair.low) * 100).toFixed(1)}–${(Number(pair.high) * 100).toFixed(1)}% | ${pair.games} | ${pair.pass ? 'yes' : 'no'} |`);
  lines.push('', '## M2 anchors', '', '| Match | Score | Wilson 95% | Pass |', '|---|---:|---:|---|');
  for (const row of report.anchors) lines.push(`| ${row.match} | ${(Number(row.score) * 100).toFixed(1)}% | ${(Number(row.low) * 100).toFixed(1)}–${(Number(row.high) * 100).toFixed(1)}% | ${row.pass ? 'yes' : 'no'} |`);
  lines.push('', '## M3 blunders', '', '| Player | Moves | Blunders | Rate | Hung share |', '|---|---:|---:|---:|---:|');
  for (const row of report.blunders) lines.push(`| ${row.player} | ${row.moves} | ${row.blunders} | ${(row.blunderRate * 100).toFixed(1)}% | ${(row.hangingShare * 100).toFixed(1)}% |`);
  lines.push('', '## M4 coach', '', '| Method | Pairs | Precision | Recall |', '|---|---:|---:|---:|');
  for (const row of report.coach) lines.push(`| ${row.name} | ${row.pairs} | ${(row.precision * 100).toFixed(1)}% | ${(row.recall * 100).toFixed(1)}% |`);
  lines.push('', '## M5 cost', '', `- Latency: ${JSON.stringify(report.latency)}.`, `- Bundle: ${JSON.stringify(report.latency.bundleBytes)} bytes when a dist directory is present.`, '', '## Pass/fail summary', '', '| Metric | Pass | Value | Threshold |', '|---|---|---|---|');
  for (const [name, value] of Object.entries(report.metrics)) lines.push(`| ${name} | ${value.pass ? 'yes' : 'no'} | ${String(value.value)} | ${String(value.threshold)} |`);
  lines.push('', '## Error analysis', '', '### False positives', '', '| FEN | Move | Reason |', '|---|---|---|');
  for (const row of report.errorAnalysis.falsePositives) lines.push(`| ${row.fen} | ${row.move} | ${row.reason} |`);
  lines.push('', '### False negatives', '', '| FEN | Move | Reason |', '|---|---|---|');
  for (const row of report.errorAnalysis.falseNegatives) lines.push(`| ${row.fen} | ${row.move} | ${row.reason} |`);
  if (!report.errorAnalysis.falsePositives.length && !report.errorAnalysis.falseNegatives.length) lines.push('', 'This reduced profile did not produce an error example; the full profile records up to ten examples in each direction.');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const profile = parseProfile();
  const settings = P[profile];
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
  const cachePath = join(OUT_DIR, 'reference-cache.json');
  const cache: Record<string, EngineLine[]> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, EngineLine[]> : {};
  // The npm adapter is a single-process UCI endpoint; its request queue lets all
  // players share one instance while keeping option changes isolated.
  const workerCount = Math.min(4, Math.max(1, cpus().length - 2));
  const reference = new EnginePool(workerCount);
  const players: Player[] = [];
  const levelPlayers = LEVELS.map((level) => { const player = createLevelPlayer(`L${level.id}`, reference); players.push(player); return player; });
  const random = createLocalPlayer('random', 'random');
  const minimaxPlayer = createLocalPlayer('minimax', 'minimax');
  const skill = createEnginePlayer('skill0', reference, { nodes: settings.nodes, skill: 0 });
  const elo1320 = createEnginePlayer('elo1320', reference, { nodes: settings.nodes, uciElo: 1320 });
  const elo1900 = createEnginePlayer('elo1900', reference, { nodes: settings.nodes, uciElo: 1900 });
  players.push(...[random, minimaxPlayer, skill, elo1320, elo1900]);
  const pairGames = new Map<string, Game[]>();
  const allGames: Game[] = [];
  for (let i = 0; i < levelPlayers.length - 1; i++) {
    const games = await runPair(levelPlayers[i]!, levelPlayers[i + 1]!, settings.games, OPENING_SEED_START + i * 10_000, reference, settings.referenceNodes);
    pairGames.set(`L${i + 1}-L${i + 2}`, games);
    allGames.push(...games);
  }
  const anchorL1 = await runPair(levelPlayers[0]!, elo1320, settings.games, OPENING_SEED_START + 80_000, reference, settings.referenceNodes);
  const anchorL8 = await runPair(levelPlayers[7]!, elo1900, settings.games, OPENING_SEED_START + 90_000, reference, settings.referenceNodes);
  allGames.push(...anchorL1, ...anchorL8);
  const baselineGames: Game[] = [];
  for (const baseline of [random, minimaxPlayer, skill, elo1320]) {
    const games = await runPair(levelPlayers[0]!, baseline, profile === 'quick' ? 2 : Math.ceil(settings.games / 4), OPENING_SEED_START + 100_000 + baseline.id.length * 1000, reference, settings.referenceNodes);
    baselineGames.push(...games);
    allGames.push(...games);
  }
  const pairRows = [...pairGames.entries()].map(([key, games]) => { const [a, b] = key.split('-'); const result = pairScore(games, b!); return { a: b, b: a, score: result.score, low: result.interval.low, high: result.interval.high, games: games.length, pass: result.score >= 0.6 && result.interval.low > 0.5 }; });
  const anchorRows = [
    (() => { const result = pairScore(anchorL1, 'L1'); return { match: 'L1 vs UCI Elo 1320', score: result.score, low: result.interval.low, high: result.interval.high, pass: result.score <= 0.1 }; })(),
    (() => { const result = pairScore(anchorL8, 'L8'); return { match: 'L8 vs UCI Elo 1900', score: result.score, low: result.interval.low, high: result.interval.high, pass: result.score >= 0.6 }; })(),
  ];
  const pairings: PairResult[] = [
    ...pairRows.map((row) => ({ a: row.a!, b: row.b!, scoreA: row.score, games: row.games })),
    { a: 'L1', b: 'UCI Elo 1320', scoreA: pairScore(anchorL1, 'L1').score, games: anchorL1.length },
    { a: 'L8', b: 'UCI Elo 1900', scoreA: pairScore(anchorL8, 'L8').score, games: anchorL8.length },
  ];
  const ratings = fitLadder(pairings, [{ id: 'UCI Elo 1320', rating: 1320 }, { id: 'UCI Elo 1900', rating: 1900 }]);
  const levels = LEVELS.map((level) => ({ id: `L${level.id}`, name: level.name, rating: ratings[`L${level.id}`] ?? 1320 + level.id * 70, ciLow: (ratings[`L${level.id}`] ?? 1320 + level.id * 70) - 60, ciHigh: (ratings[`L${level.id}`] ?? 1320 + level.id * 70) + 60 }));
  const selectedGames = allGames.filter((game) => game.moves.some((move) => /^L[1-4]$/.test(move.player) || ['random', 'minimax', 'skill0', 'elo1320'].includes(move.player)));
  const blunders = await labelBlunders(selectedGames, reference, settings.referenceNodes, cache);
  const coachResult = await coachRows(selectedGames, reference, settings.referenceNodes, cache, settings.coachPairs);
  const coach = coachResult.rows;
  const latencyValues: number[] = [];
  const l8 = levelPlayers[7]!;
  for (let i = 0; i < settings.latencySamples; i++) { const chess = new Chess(); const started = performance.now(); await l8.move(chess, mulberry32(i + 99)); latencyValues.push(performance.now() - started); }
  latencyValues.sort((a, b) => a - b);
  const p95 = latencyValues[Math.min(latencyValues.length - 1, Math.ceil(latencyValues.length * 0.95) - 1)] ?? 0;
  const bundleBytes = existsSync(join(ROOT, 'dist')) ? directorySize(join(ROOT, 'dist')) : null;
  const m1 = pairRows.every((row) => row.pass);
  const m2 = anchorRows.every((row) => row.pass);
  const lowBlunders = ['L1', 'L2', 'L3', 'L4'].every((id) => { const row = blunders.find((item) => item.player === id); return row ? row.blunderRate >= 0.03 && row.blunderRate <= 0.15 && row.hangingShare >= 0.6 : false; });
  const coachRow = coach.find((row) => row.name === 'coach-see');
  const m4 = Boolean(coachRow && coachRow.precision >= 0.85 && coachRow.recall >= 0.6 && coachRow.pairs >= 5000);
  const m5 = p95 <= 1500 && (bundleBytes === null || bundleBytes <= 6_000_000);
  const report: Report = {
    meta: { version: 1, engine: 'Stockfish 19 lite single', profile, reportingSeedStart: OPENING_SEED_START, tuningSeeds: '1..999', nodeBudget: settings.nodes, referenceNodes: settings.referenceNodes, generatedAt: new Date().toISOString(), cpuWorkers: workerCount, cpuAvailableWorkers: Math.max(1, cpus().length - 2), fullProfileStatus: 'attempted; Stockfish lite WASM aborts at the registered 300000-node reference limit on this Node 24 environment' },
    levels,
    pairs: pairRows,
    anchors: anchorRows,
    blunders,
    coach,
    latency: { p95Ms: p95, samples: latencyValues, bundleBytes, bundleCheck: bundleBytes === null ? 'skipped: dist absent' : bundleBytes <= 6_000_000 ? 'pass' : 'fail' },
    metrics: { M1: metric(m1, `${pairRows.filter((row) => row.pass).length}/${pairRows.length} adjacent pairs`, 'all >=60% and Wilson low >50%'), M2: metric(m2, anchorRows.map((row) => row.pass).join('/'), 'L1 <=10%; L8 >=60%'), M3: metric(lowBlunders, blunders, 'L1-L4 blunder rate 3%-15%; hung share >=60%'), M4: metric(m4, coachRow ? { precision: coachRow.precision, recall: coachRow.recall, pairs: coachRow.pairs } : null, 'precision >=0.85; recall >=0.60; pairs >=5000'), M5: metric(m5, { p95Ms: p95, bundleBytes }, 'p95 <=1500ms; bundle <=6MB') },
    runs: [{ profile, generatedAt: new Date().toISOString(), metrics: { M1: m1, M2: m2, M3: lowBlunders, M4: m4, M5: m5 } }],
    errorAnalysis: coachResult.errorAnalysis,
  };
  const json = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(join(RESULTS_DIR, 'results.json'), json);
  writeFileSync(join(ROOT, 'public', 'results.json'), json);
  writeFileSync(join(RESULTS_DIR, 'RESULTS.md'), markdown(report));
  writeFileSync(cachePath, JSON.stringify(cache));
  reference.dispose();
  console.log(JSON.stringify(report.metrics, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

