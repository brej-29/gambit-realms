/** Tuning-seed check of the chosen ladder: adjacent pairs and anchors. Never uses seeds >= 10000. */
import { cpus } from 'node:os';
import { LEVELS } from '../src/core/ladder';
import { GamePool } from './game-pool';
import type { GameTask, PlayerSpec } from './game';
import { assertTuningSeed } from './tune';

const N = Number(process.argv[process.argv.indexOf('--games') + 1] || 24);
const lv = (i: number): PlayerSpec => ({ id: `L${LEVELS[i]!.id}`, kind: 'level', config: LEVELS[i]! });
const anchor = (elo: number): PlayerSpec => ({ id: `elo${elo}`, kind: 'engine', options: { nodes: 5000, uciElo: elo } });
const tasks: GameTask[] = [];
const add = (a: PlayerSpec, b: PlayerSpec, match: string, base: number) => {
  for (let g = 0; g < N; g++) {
    const seed = 1 + ((base + g * 11) % 999);
    assertTuningSeed(seed);
    tasks.push({ white: g % 2 ? b : a, black: g % 2 ? a : b, seed, paramsHash: 'verify', match, referenceNodes: 20_000 });
  }
};
for (let i = 0; i < 7; i++) add(lv(i + 1), lv(i), `L${i + 2} over L${i + 1}`, 300 + i * 41);
add(lv(0), anchor(1320), 'L1 vs 1320', 500);
add(lv(7), anchor(1900), 'L8 vs 1900', 600);
const pool = new GamePool(Math.max(1, cpus().length - 2));
const games = await pool.run(tasks);
pool.dispose();
for (const m of [...new Set(tasks.map((t) => t.match))]) {
  const gs = games.filter((g) => g.match === m);
  const first = m.startsWith('L') && m.includes(' over ') ? m.split(' ')[0]! : m.split(' ')[0]!;
  let pts = 0;
  for (const g of gs) pts += g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.white === first) ? 1 : 0;
  console.log(m.padEnd(16), (pts / gs.length).toFixed(2), `(${gs.length} games)`);
}
