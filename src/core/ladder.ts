import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { EngineLine } from '../engine/types';
import { lineScore } from '../engine/types';

export interface LevelConfig {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  nodes: number;
  multipv: number;
  temperature: number;
  /** Chance of playing a beginner move: grab the most valuable piece in reach and ignore the reply. */
  oversight?: number;
}

const GRAB_VALUE: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

/** A first-timer's move: take the biggest piece available, give checks and promotions a nudge, otherwise wander. Never looks at the reply. */
export function greedyMove(fen: string, rng: () => number): string {
  const moves = new Chess(fen).moves({ verbose: true }) as Move[];
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const move of moves) {
    const value = (move.captured ? GRAB_VALUE[move.captured] : 0) + (move.promotion ? 800 : 0) + (move.san.endsWith('+') ? 40 : 0) + rng() * 60;
    if (value > bestScore) {
      bestScore = value;
      best = move;
    }
  }
  return `${best.from}${best.to}${best.promotion ?? ''}`;
}

export const LEVELS: readonly LevelConfig[] = [
  { id: 1, name: 'Sleepy Pawn', nodes: 100, multipv: 4, temperature: 160, oversight: 0.45 },
  { id: 2, name: 'Eager Squire', nodes: 3000, multipv: 4, temperature: 160, oversight: 0.3 },
  { id: 3, name: 'Clever Knight', nodes: 1000, multipv: 4, temperature: 160, oversight: 0.1 },
  { id: 4, name: 'Wily Bishop', nodes: 1000, multipv: 4, temperature: 70, oversight: 0.05 },
  { id: 5, name: 'Stern Rook', nodes: 1000, multipv: 4, temperature: 70 },
  { id: 6, name: 'Sharp Queen', nodes: 2000, multipv: 4, temperature: 70 },
  { id: 7, name: 'Old Master', nodes: 6000, multipv: 4, temperature: 70 },
  { id: 8, name: 'Archmage', nodes: 256000, multipv: 1, temperature: 0 },
] as const;

export function chooseMove(lines: readonly EngineLine[], level: LevelConfig | number, rng: () => number, fen?: string): string {
  if (!lines.length) throw new Error('cannot choose from an empty engine result');
  const config = typeof level === 'number' ? LEVELS.find((item) => item.id === level) : level;
  if (!config) throw new Error(`unknown ladder level: ${level}`);
  if (config.oversight && fen && rng() < config.oversight) return greedyMove(fen, rng);
  const best = Math.max(...lines.map(lineScore));
  if (config.temperature <= 0) return lines.reduce((selected, line) => lineScore(line) > lineScore(selected) ? line : selected).uci;
  const weights = lines.map((line) => Math.exp(-(best - lineScore(line)) / config.temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let needle = Math.min(0.999999999, Math.max(0, rng())) * total;
  for (let index = 0; index < lines.length; index++) {
    needle -= weights[index] ?? 0;
    if (needle <= 0) return lines[index]?.uci ?? lines[0]!.uci;
  }
  return lines[lines.length - 1]!.uci;
}

