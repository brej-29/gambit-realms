import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { LEVELS, type LevelConfig } from '../src/core/ladder';
import { GamePool } from './game-pool';
import type { GameTask, PlayerSpec } from './game';

export const TUNING_MIN_SEED = 1;
export const TUNING_MAX_SEED = 999;

export function assertTuningSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < TUNING_MIN_SEED || seed > TUNING_MAX_SEED) throw new Error(`tuning seed outside 1..999: ${seed}`);
}

function levelSpec(config: LevelConfig): PlayerSpec { return { id: `L${config.id}`, kind: 'level', config }; }
function eloSpec(id: string, nodes: number, elo: number): PlayerSpec { return { id, kind: 'engine', options: { nodes, uciElo: elo } }; }
function tasks(levels: readonly LevelConfig[], iteration: number): GameTask[] {
  const result: GameTask[] = [];
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levelSpec(levels[i]!); const b = levelSpec(levels[i + 1]!);
    for (let game = 0; game < 4; game++) {
      const seed = 1 + ((iteration * 97 + i * 31 + game) % 999); assertTuningSeed(seed);
      result.push({ white: game % 2 === 0 ? a : b, black: game % 2 === 0 ? b : a, seed, paramsHash: `tune-${iteration}`, match: `L${i + 1}-L${i + 2}`, referenceNodes: 20_000 });
    }
  }
  const l1 = levelSpec(levels[0]!); const l8 = levelSpec(levels[7]!);
  for (const [index, a, b] of [[0, l1, eloSpec('elo1320', 20_000, 1320)], [1, l8, eloSpec('elo1900', 20_000, 1900)]] as const) {
    for (let game = 0; game < 4; game++) { const seed = 700 + index * 100 + game; assertTuningSeed(seed); result.push({ white: game % 2 === 0 ? a : b, black: game % 2 === 0 ? b : a, seed, paramsHash: `tune-${iteration}`, match: index === 0 ? 'L1-UCI1320' : 'L8-UCI1900', referenceNodes: 20_000 }); }
  }
  return result;
}

function scoreGames(games: Array<{ white: string; black: string; result: string }>, id: string): number {
  let total = 0;
  for (const game of games) total += game.result === '1/2-1/2' ? 0.5 : (game.white === id ? game.result === '1-0' : game.result === '0-1') ? 1 : 0;
  return total / Math.max(1, games.length);
}
function objective(games: Array<{ white: string; black: string; result: string; match: string }>): number {
  const ladder = Array.from({ length: 7 }, (_, i) => scoreGames(games.filter((game) => game.match === `L${i + 1}-L${i + 2}`), `L${i + 2}`));
  const low = scoreGames(games.filter((game) => game.match === 'L1-UCI1320'), 'L1');
  const high = scoreGames(games.filter((game) => game.match === 'L8-UCI1900'), 'L8');
  const ladderPenalty = ladder.reduce((sum, value) => sum + Math.max(0, 0.6 - value) ** 2, 0);
  return ladderPenalty + Math.max(0, low - 0.1) ** 2 + Math.max(0, 0.6 - high) ** 2;
}

async function evaluate(levels: readonly LevelConfig[], iteration: number): Promise<{ value: number; games: number }> {
  const planned = tasks(levels, iteration); for (const task of planned) assertTuningSeed(task.seed);
  const pool = new GamePool(Math.min(Math.max(1, cpus().length - 2), planned.length));
  try { const games = await pool.run(planned); return { value: objective(games), games: games.length }; } finally { pool.dispose(); }
}

function candidate(config: LevelConfig, field: 'nodes' | 'multipv' | 'temperature' | 'oversight', value: number): LevelConfig {
  return { ...config, [field]: value } as LevelConfig;
}
function values(field: 'nodes' | 'multipv' | 'temperature' | 'oversight'): number[] {
  if (field === 'nodes') return [500, 1_000, 2_000, 5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000];
  if (field === 'multipv') return Array.from({ length: 10 }, (_, i) => i + 1);
  if (field === 'temperature') return Array.from({ length: 31 }, (_, i) => i * 20);
  return Array.from({ length: 11 }, (_, i) => i * 0.03);
}
function writeLevels(levels: readonly LevelConfig[]): void {
  const path = join(process.cwd(), 'src', 'core', 'ladder.ts'); const source = readFileSync(path, 'utf8');
  const literal = levels.map((level) => `  { id: ${level.id}, name: '${level.name}', nodes: ${level.nodes}, multipv: ${level.multipv}, temperature: ${level.temperature}${level.oversight ? `, oversight: ${level.oversight}` : ''} },`).join('\n');
  const updated = source.replace(/export const LEVELS: readonly LevelConfig\[\] = \[[\s\S]*?\n\] as const;/, `export const LEVELS: readonly LevelConfig[] = [\n${literal}\n] as const;`);
  if (updated === source) throw new Error('could not locate LEVELS declaration'); writeFileSync(path, updated);
}

export async function runTuning(deadlineMs = 75 * 60_000): Promise<readonly LevelConfig[]> {
  const started = Date.now(); let current = LEVELS.map((level) => ({ ...level })); let best = await evaluate(current, 0); let iteration = 0;
  const logPath = join(process.cwd(), 'docs', 'results', 'tuning.json'); mkdirSync(join(process.cwd(), 'docs', 'results'), { recursive: true });
  const history: unknown[] = existsSync(logPath) ? ((JSON.parse(readFileSync(logPath, 'utf8')) as { iterations?: unknown[] }).iterations ?? []) : [];
  history.push({ iteration: 0, field: 'baseline', objective: best.value, games: best.games, seeds: '1..999' });
  writeFileSync(logPath, JSON.stringify({ iterations: history }, null, 2) + '\n');
  const fields: Array<'nodes' | 'multipv' | 'temperature' | 'oversight'> = ['nodes', 'multipv', 'temperature', 'oversight'];
  outer: while (Date.now() - started < deadlineMs) {
    let changed = false;
    for (const field of fields) for (let index = 0; index < current.length; index++) {
      for (const value of values(field)) {
        if (Date.now() - started >= deadlineMs) break outer;
        const trial = current.map((level, item) => item === index ? candidate(level, field, value) : level);
        const result = await evaluate(trial, ++iteration);
        const row = { iteration, field, level: index + 1, value, objective: result.value, games: result.games, seeds: '1..999' }; history.push(row); writeFileSync(logPath, JSON.stringify({ iterations: history }, null, 2) + '\n');
        if (result.value < best.value) { current = trial; best = result; changed = true; writeLevels(current); break; }
      }
    }
    if (!changed) break;
  }
  writeFileSync(logPath, JSON.stringify({ iterations: history }, null, 2) + '\n'); return current;
}

if (process.argv[1] && pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href) {
  const minutesIndex = process.argv.indexOf('--minutes');
  const minutes = minutesIndex >= 0 ? Number(process.argv[minutesIndex + 1]) : 75;
  runTuning(Math.max(1, minutes) * 60_000).then((levels) => console.log(JSON.stringify(levels, null, 2))).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
