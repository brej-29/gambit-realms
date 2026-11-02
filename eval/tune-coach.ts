/**
 * Coach threshold study on TUNING games only (seeds 1..999, taken from the calibration sweeps).
 * Labels follow Amendment 1 (Label B: material worse by >= 100 cp after 4 plies of the reference line).
 *   npx tsx eval/tune-coach.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Chess, type PieceSymbol } from 'chess.js';
import { assessMove, type CoachOptions } from '../src/core/coach';
import { lineScore } from '../src/engine/types';
import { EnginePool } from './engine-pool';
import type { GameRecord } from './game';

const REF_NODES = 20_000;
const SAMPLE = 3_000;
const VALUE: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
const material = (c: Chess, color: 'w' | 'b') => c.board().flat().reduce((s, p) => s + (p ? (p.color === color ? 1 : -1) * VALUE[p.type] : 0), 0);
const apply = (c: Chess, uci: string) => c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] as PieceSymbol } : {}) });

const dir = join(process.cwd(), 'eval', 'out');
const games = readdirSync(dir)
  .filter((f) => f.startsWith('cal-games-'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GameRecord[]);
const own = games.filter((g) => g.seed >= 1 && g.seed <= 999).flatMap((g) => g.moves.filter((m) => /^c\d+$/.test(m.player)));
// deterministic stride sample
const stride = Math.max(1, Math.floor(own.length / SAMPLE));
const sample = own.filter((_, i) => i % stride === 0).slice(0, SAMPLE);
console.log(`${games.length} tuning games, ${own.length} candidate moves, sampling ${sample.length}`);

const pool = new EnginePool(Math.max(1, cpus().length - 2));
const rows = await Promise.all(
  sample.map(async (m) => {
    const before = new Chess(m.fen);
    const mover = before.turn();
    const m0 = material(before, mover);
    const after = new Chess(m.fen);
    apply(after, m.uci);
    const lines = await pool.analyse(after.fen({ forceEnpassantSquare: true }), { nodes: REF_NODES });
    for (const uci of (lines[0]?.pv ?? []).slice(0, 4)) {
      try {
        apply(after, uci);
      } catch {
        break;
      }
    }
    return { m, labelB: m0 - material(after, mover) >= 100, score: lines[0] ? lineScore(lines[0]) : 0 };
  })
);
pool.dispose();

const variants: { name: string; options?: CoachOptions; min: number }[] = [];
for (const min of [100, 200, 300, 500]) {
  variants.push({ name: `any-piece, netLoss >= ${min}`, min });
  variants.push({ name: `moved-piece-only, netLoss >= ${min}`, options: { movedPieceOnly: true }, min });
}
const out = variants.map((v) => {
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) {
    const a = assessMove(r.m.fen, r.m.uci, v.options);
    const pred = a.hangs && a.netLoss >= v.min;
    if (pred && r.labelB) tp++;
    else if (pred) fp++;
    else if (r.labelB) fn++;
  }
  return { ...v, precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn), tp, fp, fn };
});
const positives = rows.filter((r) => r.labelB).length;
console.log(`positives ${positives}/${rows.length}`);
for (const o of out) console.log(o.name.padEnd(36), `precision ${(o.precision * 100).toFixed(1)}%  recall ${(o.recall * 100).toFixed(1)}%  (tp ${o.tp}, fp ${o.fp}, fn ${o.fn})`);
writeFileSync(join(process.cwd(), 'docs', 'results', 'coach-tuning.json'), JSON.stringify({ seeds: '1..999', referenceNodes: REF_NODES, pairs: rows.length, positives, variants: out }, null, 2) + '\n');
