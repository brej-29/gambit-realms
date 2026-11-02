import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { Engine, EngineLine } from '../src/engine/types';
import { lineScore } from '../src/engine/types';
import { LEVELS, chooseMove, type LevelConfig } from '../src/core/ladder';
import { assessMove, type CoachOptions } from '../src/core/coach';
import { mulberry32 } from '../src/core/rng';
import { bootstrapLadderIntervals, fitLadder, score, wilsonInterval, type PairResult } from '../src/core/stats';
import { EnginePool } from './engine-pool';
import { GamePool } from './game-pool';
import type { GameRecord, GameTask, PlayerSpec, PlayedMove } from './game';

type Profile = 'quick' | 'full';
interface BlunderRow { player: string; games: number; moves: number; blunders: number; blunderRate: number; hangingBlunders: number; hangingShare: number }
interface CoachRow { name: string; label: 'A' | 'B'; pairs: number; positives: number; predicted: number; truePositives: number; precision: number; recall: number }
interface Report { meta: Record<string, unknown>; levels: Array<Record<string, unknown>>; pairs: Array<Record<string, unknown>>; anchors: Array<Record<string, unknown>>; blunders: BlunderRow[]; coach: CoachRow[]; latency: Record<string, unknown>; metrics: Record<string, Record<string, unknown>>; runs: Array<Record<string, unknown>>; errorAnalysis: { falsePositives: Array<Record<string, string | number | boolean>>; falseNegatives: Array<Record<string, string | number | boolean>> } }

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'eval', 'out');
const RESULTS_DIR = join(ROOT, 'docs', 'results');
const GAMES_PATH = join(OUT_DIR, 'games.jsonl');
const REPORTING_SEED_START = 10_000;
const P = { quick: { games: 12, referenceNodes: 20_000, coachPairs: 400, latencySamples: 8 }, full: { games: 200, referenceNodes: 300_000, coachPairs: 5_000, latencySamples: 20 } } as const;

function parseProfile(): Profile { return process.argv[process.argv.indexOf('--profile') + 1] === 'full' ? 'full' : 'quick'; }
function keyOf(game: Pick<GameRecord, 'white' | 'black' | 'seed' | 'paramsHash'> | Pick<GameTask, 'white' | 'black' | 'seed' | 'paramsHash'>): string { const white = typeof game.white === 'string' ? game.white : game.white.id; const black = typeof game.black === 'string' ? game.black : game.black.id; return `${white}|${black}|${game.seed}|${game.paramsHash}`; }
function paramsHash(profile: Profile): string { return createHash('sha256').update(JSON.stringify({ profile, levels: LEVELS, referenceNodes: P[profile].referenceNodes, version: 3 })).digest('hex').slice(0, 16); }
function readStoredGames(): Map<string, GameRecord> {
  const games = new Map<string, GameRecord>();
  if (!existsSync(GAMES_PATH)) return games;
  for (const line of readFileSync(GAMES_PATH, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { const game = JSON.parse(line) as GameRecord; if (typeof game.seed === 'number' && typeof game.paramsHash === 'string') games.set(keyOf(game), game); } catch { /* ignore a partial final line */ }
  }
  return games;
}
function levelSpec(level: LevelConfig): PlayerSpec { return { id: `L${level.id}`, kind: 'level', config: level }; }
function engineSpec(id: string, options: { nodes: number; skill?: number; uciElo?: number }): PlayerSpec { return { id, kind: 'engine', options }; }
function pairTasks(a: PlayerSpec, b: PlayerSpec, count: number, startSeed: number, match: string, hash: string, referenceNodes: number): GameTask[] {
  return Array.from({ length: count }, (_, index) => { const firstWhite = index % 2 === 0; return { white: firstWhite ? a : b, black: firstWhite ? b : a, seed: startSeed + index, paramsHash: hash, match, referenceNodes }; });
}
async function runGames(tasks: readonly GameTask[], stored: Map<string, GameRecord>, workers: number): Promise<GameRecord[]> {
  const missing = tasks.filter((task) => !stored.has(keyOf(task)));
  if (missing.length) {
    const pool = new GamePool(Math.min(workers, missing.length)); const started = Date.now();
    const existingCount = tasks.length - missing.length; let finished = existingCount;
    const timer = setInterval(() => { const elapsed = Math.max(1, Date.now() - started); const rate = Math.max(0.001, (finished - existingCount) / (elapsed / 1000)); console.log(`progress: games done/total ${finished}/${tasks.length}, ETA ${Math.max(0, Math.ceil((tasks.length - finished) / rate))}s`); }, 30_000);
    try { await pool.run(missing, (completed, total, game) => { if (game) { stored.set(keyOf(game), game); appendFileSync(GAMES_PATH, `${JSON.stringify(game)}\n`); } finished = existingCount + completed; if (completed === total) console.log(`progress: games done/total ${finished}/${tasks.length}, ETA 0s`); }); } finally { clearInterval(timer); pool.dispose(); }
  }
  return tasks.map((task) => stored.get(keyOf(task))).filter((game): game is GameRecord => Boolean(game));
}
function pairScore(games: readonly GameRecord[], stronger: string): { score: number; wins: number; draws: number; losses: number; interval: ReturnType<typeof wilsonInterval>; outcomes: number[] } {
  let wins = 0; let draws = 0; let losses = 0;
  for (const game of games) { const white = game.white === stronger; if (game.result === '1/2-1/2') draws++; else if ((white && game.result === '1-0') || (!white && game.result === '0-1')) wins++; else losses++; }
  const value = score(wins, draws, losses); return { score: value, wins, draws, losses, interval: wilsonInterval(value, games.length), outcomes: [...Array(wins).fill(1), ...Array(draws).fill(0.5), ...Array(losses).fill(0)] };
}
function cacheKey(fen: string, nodes: number, multipv = 1): string { return `${nodes}:${multipv}:${fen}`; }
async function referenceScore(engine: Engine, cache: Record<string, EngineLine[]>, fen: string, nodes: number, multipv = 1): Promise<EngineLine[]> { const key = cacheKey(fen, nodes, multipv); if (cache[key]) return cache[key]!; const lines = await engine.analyse(fen, { nodes, multipv }); cache[key] = lines; return lines; }
function playerEligible(id: string): boolean { return /^L[1-4]$/.test(id) || ['random', 'minimax', 'skill0', 'elo1320'].includes(id); }
function applyUci(chess: Chess, uci: string): Move { const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] as PieceSymbol } : {}) }); if (!move) throw new Error(`illegal stored move ${uci}`); return move; }

async function labelBlunders(games: readonly GameRecord[], reference: Engine, nodes: number, cache: Record<string, EngineLine[]>): Promise<BlunderRow[]> {
  const grouped = new Map<string, { games: Set<string>; moves: number; blunders: number; hangs: number }>();
  const work = games.flatMap((game) => game.moves.filter((move) => playerEligible(move.player)).map((played) => ({ game, played })));
  for (let start = 0; start < work.length; start += 128) {
    const batch = work.slice(start, start + 128);
    const results = await Promise.all(batch.map(async ({ game, played }) => {
      const before = await referenceScore(reference, cache, played.fen, nodes); const position = new Chess(played.fen); applyUci(position, played.uci); const after = await referenceScore(reference, cache, position.fen({ forceEnpassantSquare: true }), nodes);
      const cpl = Math.max(0, lineScore(before[0] ?? { cp: 0, uci: '', pv: [], depth: 0 }) + lineScore(after[0] ?? { cp: 0, uci: '', pv: [], depth: 0 })); return { game, played, blunder: cpl >= 200, hang: cpl >= 200 && assessMove(played.fen, played.uci).netLoss >= 100 };
    }));
    for (const { game, played, blunder, hang } of results) { const row = grouped.get(played.player) ?? { games: new Set<string>(), moves: 0, blunders: 0, hangs: 0 }; row.games.add(`${game.white}|${game.black}|${game.seed}`); row.moves++; if (blunder) row.blunders++; if (hang) row.hangs++; grouped.set(played.player, row); }
  }
  return [...grouped.entries()].map(([player, row]) => ({ player, games: row.games.size, moves: row.moves, blunders: row.blunders, blunderRate: row.blunders / Math.max(1, row.moves), hangingBlunders: row.hangs, hangingShare: row.hangs / Math.max(1, row.blunders) }));
}

interface LabeledPair { pair: PlayedMove; labelA: boolean; labelB: boolean; cpl: number; materialLoss: number; pv: string[] }
function materialScore(chess: Chess, color: 'w' | 'b'): number { const values: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 }; return chess.board().flat().reduce((sum, piece) => sum + (piece ? (piece.color === color ? 1 : -1) * values[piece.type] : 0), 0); }
function playPv(chess: Chess, pv: readonly string[], plies: number): void { for (const uci of pv.slice(0, plies)) { try { applyUci(chess, uci); } catch { break; } } }
async function labelPair(pair: PlayedMove, reference: Engine, nodes: number, cache: Record<string, EngineLine[]>): Promise<LabeledPair> {
  const beforeChess = new Chess(pair.fen); const mover = beforeChess.turn(); const beforeMaterial = materialScore(beforeChess, mover); const before = await referenceScore(reference, cache, pair.fen, nodes);
  const afterChess = new Chess(pair.fen); applyUci(afterChess, pair.uci); const after = await referenceScore(reference, cache, afterChess.fen({ forceEnpassantSquare: true }), nodes);
  const cpl = Math.max(0, lineScore(before[0] ?? { cp: 0, uci: '', pv: [], depth: 0 }) + lineScore(after[0] ?? { cp: 0, uci: '', pv: [], depth: 0 })); playPv(afterChess, after[0]?.pv ?? [], 4);
  const materialLoss = beforeMaterial - materialScore(afterChess, mover); return { pair, labelA: cpl >= 150, labelB: materialLoss >= 100, cpl, materialLoss, pv: after[0]?.pv ?? [] };
}
function shuffle<T>(items: T[], seed: number): T[] { const rng = mulberry32(seed); for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; } return items; }
function precisionRecall(labels: boolean[], predictions: boolean[]): { positives: number; predicted: number; truePositives: number; precision: number; recall: number } { const positives = labels.filter(Boolean).length; const predicted = predictions.filter(Boolean).length; const truePositives = predictions.reduce((sum, value, index) => sum + (value && labels[index] ? 1 : 0), 0); return { positives, predicted, truePositives, precision: truePositives / Math.max(1, predicted), recall: truePositives / Math.max(1, positives) }; }

async function coachRows(games: readonly GameRecord[], reference: Engine, nodes: number, cache: Record<string, EngineLine[]>, target: number): Promise<{ rows: CoachRow[]; errorAnalysis: Report['errorAnalysis'] }> {
  const candidates = shuffle(games.flatMap((game) => game.seed >= REPORTING_SEED_START ? game.moves.filter((move) => playerEligible(move.player)) : []), 0xC0AC);
  const labeled: LabeledPair[] = []; const minEach = Math.ceil(target / 3);
  const limited = candidates.slice(0, Math.min(candidates.length, target * 3));
  for (let start = 0; start < limited.length; start += 128) {
    labeled.push(...await Promise.all(limited.slice(start, start + 128).map((candidate) => labelPair(candidate, reference, nodes, cache))));
    const positives = labeled.filter((item) => item.labelB).length; const negatives = labeled.length - positives; if (labeled.length >= target && positives >= minEach && negatives >= minEach) break;
  }
  const positivesForB = labeled.filter((item) => item.labelB);
  const negativesForB = labeled.filter((item) => !item.labelB);
  const balanced = labeled.length > target && positivesForB.length && negativesForB.length
    ? [...positivesForB.slice(0, Math.ceil(target / 2)), ...negativesForB.slice(0, Math.floor(target / 2))]
    : labeled.slice(0, target);
  const selectedSet = new Set(balanced);
  const selected = [...balanced, ...labeled.filter((item) => !selectedSet.has(item)).slice(0, Math.max(0, target - balanced.length))];
  const methods: Array<{ name: string; options?: CoachOptions; predict: (assessment: ReturnType<typeof assessMove>, chess: Chess, move: Move) => boolean }> = [
    { name: 'coach-see', predict: (assessment) => assessment.hangs }, { name: 'coach-see-without-defender-count', options: { countDefenders: false }, predict: (assessment) => assessment.hangs }, { name: 'coach-without-pinned-piece-rule', options: { pinnedPieceRule: false }, predict: (assessment) => assessment.hangs }, { name: 'warn-if-attacked', predict: (_assessment, chess, move) => chess.attackers(move.to, move.color === 'w' ? 'b' : 'w').length > 0 }, { name: 'never-warn', predict: () => false },
  ];
  const rows: CoachRow[] = []; const falsePositives: Array<Record<string, string | number | boolean>> = []; const falseNegatives: Array<Record<string, string | number | boolean>> = [];
  for (const label of ['B', 'A'] as const) {
    const labels = selected.map((item) => label === 'B' ? item.labelB : item.labelA);
    for (const method of methods) {
      const predictions = selected.map((item) => { const chess = new Chess(item.pair.fen); const move = applyUci(chess, item.pair.uci); const assessment = assessMove(item.pair.fen, item.pair.uci, method.options); return method.predict(assessment, chess, move); });
      rows.push({ name: method.name, label, pairs: labels.length, ...precisionRecall(labels, predictions) });
      if (label === 'B' && method.name === 'coach-see') selected.forEach((item, index) => { if (predictions[index] && !labels[index] && falsePositives.length < 10) falsePositives.push({ fen: item.pair.fen, move: item.pair.uci, referenceCpl: item.cpl, referenceMaterialLoss: item.materialLoss, referencePv: item.pv.join(' '), labelA: item.labelA, labelB: item.labelB }); if (!predictions[index] && labels[index] && falseNegatives.length < 10) falseNegatives.push({ fen: item.pair.fen, move: item.pair.uci, referenceCpl: item.cpl, referenceMaterialLoss: item.materialLoss, referencePv: item.pv.join(' '), labelA: item.labelA, labelB: item.labelB }); });
    }
  }
  return { rows, errorAnalysis: { falsePositives, falseNegatives } };
}

function metric(pass: boolean, value: unknown, threshold: string): Record<string, unknown> { return { pass, value, threshold }; }
function directorySize(path: string): number { if (!existsSync(path)) return 0; const entry = statSync(path); return entry.isFile() ? entry.size : readdirSync(path).reduce((sum, name) => sum + directorySize(join(path, name)), 0); }
function markdown(report: Report): string {
  const lines = ['# Evaluation results', '', `Profile: ${String(report.meta.profile)}. Run status: ${String(report.meta.status)}.`, 'Rating intervals: 400-game percentile bootstrap; fixed anchors are UCI Elo 1320 and UCI Elo 1900.', '', '## Ladder ratings', '', '| Level | Rating | 95% CI |', '|---|---:|---:|'];
  for (const level of report.levels) lines.push(`| ${level.id} | ${Number(level.rating).toFixed(0)} | ${Number(level.ciLow).toFixed(0)}-${Number(level.ciHigh).toFixed(0)} |`);
  lines.push('', '## M1 adjacent pairs', '', '| Pair | Score | Wilson 95% | Games | Pass |', '|---|---:|---:|---:|---|'); for (const row of report.pairs) lines.push(`| ${row.a} over ${row.b} | ${(Number(row.score) * 100).toFixed(1)}% | ${(Number(row.low) * 100).toFixed(1)}-${(Number(row.high) * 100).toFixed(1)}% | ${row.games} | ${row.pass ? 'yes' : 'no'} |`);
  lines.push('', '## M2 anchors', '', '| Match | Score | Wilson 95% | Pass |', '|---|---:|---:|---|'); for (const row of report.anchors) lines.push(`| ${row.match} | ${(Number(row.score) * 100).toFixed(1)}% | ${(Number(row.low) * 100).toFixed(1)}-${(Number(row.high) * 100).toFixed(1)}% | ${row.pass ? 'yes' : 'no'} |`);
  lines.push('', '## M3 blunders', '', '| Player | Games | Moves | Blunders | Rate | Hung share |', '|---|---:|---:|---:|---:|---:|'); for (const row of report.blunders) lines.push(`| ${row.player} | ${row.games} | ${row.moves} | ${row.blunders} | ${(row.blunderRate * 100).toFixed(1)}% | ${(row.hangingShare * 100).toFixed(1)}% |`);
  lines.push('', '## M4 coach', '', '| Method | Label | Pairs | Precision | Recall |', '|---|---|---:|---:|---:|'); for (const row of report.coach) lines.push(`| ${row.name} | ${row.label} | ${row.pairs} | ${(row.precision * 100).toFixed(1)}% | ${(row.recall * 100).toFixed(1)}% |`);
  lines.push('', '## M5 cost', '', `- ${JSON.stringify(report.latency)}`, '', '## Pass/fail summary', '', '| Metric | Pass | Value | Threshold |', '|---|---|---|---|'); for (const [name, value] of Object.entries(report.metrics)) lines.push(`| ${name} | ${value.pass ? 'yes' : 'no'} | ${String(value.value)} | ${String(value.threshold)} |`);
  lines.push('', '## Error analysis', '', '### False positives', '', '| FEN | Move | Reference CPL | Material loss | PV |', '|---|---|---:|---:|---|'); for (const row of report.errorAnalysis.falsePositives) lines.push(`| ${row.fen} | ${row.move} | ${row.referenceCpl} | ${row.referenceMaterialLoss} | ${row.referencePv} |`);
  lines.push('', '### False negatives', '', '| FEN | Move | Reference CPL | Material loss | PV |', '|---|---|---:|---:|---|'); for (const row of report.errorAnalysis.falseNegatives) lines.push(`| ${row.fen} | ${row.move} | ${row.referenceCpl} | ${row.referenceMaterialLoss} | ${row.referencePv} |`); return lines.join('\n');
}

async function main(): Promise<void> {
  const profile = parseProfile(); const settings = P[profile]; mkdirSync(OUT_DIR, { recursive: true }); mkdirSync(RESULTS_DIR, { recursive: true }); const hash = paramsHash(profile); const stored = readStoredGames(); const levelSpecs = LEVELS.map(levelSpec); const allTasks: GameTask[] = [];
  for (let i = 0; i < levelSpecs.length - 1; i++) allTasks.push(...pairTasks(levelSpecs[i]!, levelSpecs[i + 1]!, settings.games, REPORTING_SEED_START + i * 10_000, `L${i + 1}-L${i + 2}`, hash, settings.referenceNodes));
  allTasks.push(...pairTasks(levelSpecs[0]!, engineSpec('elo1320', { nodes: settings.referenceNodes, uciElo: 1320 }), settings.games, REPORTING_SEED_START + 80_000, 'L1-UCI1320', hash, settings.referenceNodes)); allTasks.push(...pairTasks(levelSpecs[7]!, engineSpec('elo1900', { nodes: settings.referenceNodes, uciElo: 1900 }), settings.games, REPORTING_SEED_START + 90_000, 'L8-UCI1900', hash, settings.referenceNodes));
  const baselines: PlayerSpec[] = [{ id: 'random', kind: 'random' }, { id: 'minimax', kind: 'minimax' }, engineSpec('skill0', { nodes: settings.referenceNodes, skill: 0 }), engineSpec('elo1320', { nodes: settings.referenceNodes, uciElo: 1320 })]; baselines.forEach((baseline, index) => allTasks.push(...pairTasks(levelSpecs[0]!, baseline, settings.games, REPORTING_SEED_START + 100_000 + index * 10_000, `L1-${baseline.id}`, hash, settings.referenceNodes)));
  const gameRecords = await runGames(allTasks, stored, Math.max(1, cpus().length - 2)); const byMatch = (match: string) => gameRecords.filter((game) => game.match === match);
  const pairRows = levelSpecs.slice(0, -1).map((_, index) => { const result = pairScore(byMatch(`L${index + 1}-L${index + 2}`), `L${index + 2}`); return { a: `L${index + 2}`, b: `L${index + 1}`, score: result.score, low: result.interval.low, high: result.interval.high, games: result.outcomes.length, pass: result.score >= 0.6 && result.interval.low > 0.5 }; });
  const anchorRows = [(() => { const result = pairScore(byMatch('L1-UCI1320'), 'L1'); return { match: 'L1 vs UCI Elo 1320', score: result.score, low: result.interval.low, high: result.interval.high, pass: result.score <= 0.1 }; })(), (() => { const result = pairScore(byMatch('L8-UCI1900'), 'L8'); return { match: 'L8 vs UCI Elo 1900', score: result.score, low: result.interval.low, high: result.interval.high, pass: result.score >= 0.6 }; })()];
  const toPairing = (match: string, a: string, b: string): PairResult => { const result = pairScore(byMatch(match), a); return { a, b, scoreA: result.score, games: result.outcomes.length, outcomes: result.outcomes }; }; const pairings: PairResult[] = pairRows.map((row) => toPairing(`${row.b}-${row.a}`, row.a, row.b)); pairings.push(toPairing('L1-UCI1320', 'L1', 'UCI Elo 1320'), toPairing('L8-UCI1900', 'L8', 'UCI Elo 1900'));
  const anchors = [{ id: 'UCI Elo 1320', rating: 1320 }, { id: 'UCI Elo 1900', rating: 1900 }]; const ratings = fitLadder(pairings, anchors); const intervals = bootstrapLadderIntervals(pairings, anchors, 400, 0xEAA1);
  const cachePath = join(OUT_DIR, 'reference-cache.json'); const cache: Record<string, EngineLine[]> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, EngineLine[]> : {}; const analysis = new EnginePool(Math.min(8, Math.max(1, cpus().length - 2)));
  try {
    const selectedGames = gameRecords.filter((game) => game.moves.some((move) => playerEligible(move.player))); const blunders = await labelBlunders(selectedGames, analysis, settings.referenceNodes, cache); const coachResult = await coachRows(selectedGames, analysis, settings.referenceNodes, cache, settings.coachPairs);
    const latencyValues: number[] = []; for (let i = 0; i < settings.latencySamples; i++) { const chess = new Chess(); const started = performance.now(); const lines = await analysis.analyse(chess.fen(), { nodes: LEVELS[7]!.nodes, multipv: LEVELS[7]!.multipv }); chooseMove(lines, LEVELS[7]!, mulberry32(i + 99)); latencyValues.push(performance.now() - started); } latencyValues.sort((a, b) => a - b);
    const p95 = latencyValues[Math.min(latencyValues.length - 1, Math.ceil(latencyValues.length * 0.95) - 1)] ?? 0; const bundleBytes = existsSync(join(ROOT, 'dist')) ? directorySize(join(ROOT, 'dist')) : null; const m1 = pairRows.every((row) => row.pass); const m2 = anchorRows.every((row) => row.pass); const m3 = ['L1', 'L2', 'L3', 'L4'].every((id) => { const row = blunders.find((item) => item.player === id); return Boolean(row && row.blunderRate >= 0.03 && row.blunderRate <= 0.15 && row.hangingShare >= 0.6); }); const coachB = coachResult.rows.find((row) => row.name === 'coach-see' && row.label === 'B'); const m4 = Boolean(coachB && coachB.precision >= 0.85 && coachB.recall >= 0.6 && coachB.pairs >= settings.coachPairs); const m5 = p95 <= 1500 && (bundleBytes === null || bundleBytes <= 6_000_000);
    const previous = existsSync(join(RESULTS_DIR, 'results.json')) ? JSON.parse(readFileSync(join(RESULTS_DIR, 'results.json'), 'utf8')) as Partial<Report> : {};
    const tuningPath = join(RESULTS_DIR, 'tuning.json'); const tuning = existsSync(tuningPath) ? JSON.parse(readFileSync(tuningPath, 'utf8')) as { iterations?: Array<{ iteration?: number }> } : {}; const tuningIteration = tuning.iterations?.at(-1)?.iteration ?? null;
    const run = { profile, generatedAt: new Date().toISOString(), tuningIteration, params: LEVELS, metricPassFlags: { M1: m1, M2: m2, M3: m3, M4: m4, M5: m5 } };
    const report: Report = { meta: { version: 2, engine: 'Stockfish 19 lite single', profile, status: 'completed', reportingSeedStart: REPORTING_SEED_START, tuningSeeds: '1..999', nodeBudget: LEVELS.map((level) => level.nodes), referenceNodes: settings.referenceNodes, generatedAt: new Date().toISOString(), gameWorkers: Math.max(1, cpus().length - 2), ratingAnchors: anchors.map((anchor) => anchor.id) }, levels: LEVELS.map((level) => ({ id: `L${level.id}`, name: level.name, rating: ratings[`L${level.id}`] ?? 1500, ciLow: intervals[`L${level.id}`]?.low ?? ratings[`L${level.id}`] ?? 1500, ciHigh: intervals[`L${level.id}`]?.high ?? ratings[`L${level.id}`] ?? 1500 })), pairs: pairRows, anchors: anchorRows, blunders, coach: coachResult.rows, latency: { p95Ms: p95, samples: latencyValues, bundleBytes, bundleCheck: bundleBytes === null ? 'skipped: dist absent' : bundleBytes <= 6_000_000 ? 'pass' : 'fail' }, metrics: { M1: metric(m1, `${pairRows.filter((row) => row.pass).length}/${pairRows.length} adjacent pairs`, 'all >=60% and Wilson low >50%'), M2: metric(m2, anchorRows.map((row) => row.pass).join('/'), 'L1 <=10%; L8 >=60%'), M3: metric(m3, blunders, 'L1-L4 blunder rate 3%-15%; hung share >=60%'), M4: metric(m4, coachB ? { precision: coachB.precision, recall: coachB.recall, pairs: coachB.pairs } : null, 'Label B precision >=0.85; recall >=0.60'), M5: metric(m5, { p95Ms: p95, bundleBytes }, 'p95 <=1500ms; bundle <=6MB') }, runs: [...(Array.isArray(previous.runs) ? previous.runs : []), run], errorAnalysis: coachResult.errorAnalysis };
    const json = `${JSON.stringify(report, null, 2)}\n`; writeFileSync(join(RESULTS_DIR, 'results.json'), json); writeFileSync(join(ROOT, 'public', 'results.json'), json); writeFileSync(join(RESULTS_DIR, 'RESULTS.md'), markdown(report)); writeFileSync(cachePath, JSON.stringify(cache)); console.log(JSON.stringify(report.metrics, null, 2));
  } finally { analysis.dispose(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
