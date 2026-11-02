import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { Engine, EngineLine, EngineOptions } from '../src/engine/types';
import { lineScore } from '../src/engine/types';
import { LEVELS, chooseMove, type LevelConfig } from '../src/core/ladder';
import { mulberry32 } from '../src/core/rng';

export type Result = '1-0' | '0-1' | '1/2-1/2';

export interface PlayedMove {
  fen: string;
  uci: string;
  player: string;
}

export interface GameRecord {
  white: string;
  black: string;
  seed: number;
  paramsHash: string;
  match: string;
  result: Result;
  moves: PlayedMove[];
}

export type PlayerSpec =
  | { id: string; kind: 'level'; config: LevelConfig }
  | { id: string; kind: 'random' }
  | { id: string; kind: 'minimax' }
  | { id: string; kind: 'engine'; options: EngineOptions };

export interface GameTask {
  white: PlayerSpec;
  black: PlayerSpec;
  seed: number;
  paramsHash: string;
  match: string;
  referenceNodes: number;
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
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
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

function chooseRandom(chess: Chess, rng: () => number): string {
  const moves = chess.moves();
  if (!moves.length) throw new Error('no legal moves');
  return moves[Math.min(moves.length - 1, Math.floor(rng() * moves.length))]!;
}

function uciFromMove(chess: Chess, move: string): string {
  const verbose = chess.moves({ verbose: true }) as Move[];
  const found = verbose.find((item) => item.san === move || item.lan === move || `${item.from}${item.to}${item.promotion ?? ''}` === move);
  if (!found) throw new Error(`cannot convert move ${move} to UCI`);
  return `${found.from}${found.to}${found.promotion ?? ''}`;
}

async function opening(seed: number, reference: Engine, referenceNodes: number): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const chess = new Chess();
    for (let ply = 0; ply < 4; ply++) chess.move(chooseRandom(chess, rng));
    const lines = await reference.analyse(chess.fen({ forceEnpassantSquare: true }), { nodes: referenceNodes });
    if (Math.abs(lineScore(lines[0] ?? { cp: 0, uci: '', pv: [], depth: 0 })) <= 150) return chess.fen({ forceEnpassantSquare: true });
  }
  return new Chess().fen();
}

async function choosePlayerMove(spec: PlayerSpec, chess: Chess, rng: () => number, engine: Engine): Promise<string> {
  if (spec.kind === 'random') return uciFromMove(chess, chooseRandom(chess, rng));
  if (spec.kind === 'minimax') return uciFromMove(chess, minimaxMove(chess));
  const options = spec.kind === 'level' ? { nodes: spec.config.nodes, multipv: spec.config.multipv } : spec.options;
  const lines = await engine.analyse(chess.fen({ forceEnpassantSquare: true }), options);
  if (spec.kind === 'level') {
    return chooseMove(lines, spec.config, rng, chess.fen({ forceEnpassantSquare: true }));
  }
  return lines[0]?.uci ?? uciFromMove(chess, chooseRandom(chess, rng));
}

export async function playGameTask(task: GameTask, engine: Engine): Promise<GameRecord> {
  const fen = await opening(task.seed, engine, task.referenceNodes);
  const chess = new Chess(fen);
  const moves: PlayedMove[] = [];
  const rng = mulberry32((task.seed * 13 + 17) >>> 0);
  for (let ply = 0; ply < 300 && !chess.isGameOver(); ply++) {
    const player = chess.turn() === 'w' ? task.white : task.black;
    const position = chess.fen({ forceEnpassantSquare: true });
    let uci = await choosePlayerMove(player, chess, rng, engine);
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
    } catch {
      uci = uciFromMove(chess, chooseRandom(chess, rng));
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
    }
    moves.push({ fen: position, uci, player: player.id });
  }
  let result: Result = '1/2-1/2';
  if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
  else if (!chess.isGameOver()) {
    const finalMaterial = material(chess);
    if (finalMaterial > 300) result = '1-0';
    else if (finalMaterial < -300) result = '0-1';
  }
  return { white: task.white.id, black: task.black.id, seed: task.seed, paramsHash: task.paramsHash, match: task.match, result, moves };
}
