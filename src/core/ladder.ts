import type { EngineLine } from '../engine/types';
import { lineScore } from '../engine/types';

export interface LevelConfig {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  nodes: number;
  multipv: number;
  temperature: number;
  slipProb?: number;
}

export const LEVELS: readonly LevelConfig[] = [
  { id: 1, name: 'Sleepy Pawn', nodes: 500, multipv: 5, temperature: 260 },
  { id: 2, name: 'Eager Squire', nodes: 3500, multipv: 5, temperature: 190 },
  { id: 3, name: 'Clever Knight', nodes: 8000, multipv: 4, temperature: 130 },
  { id: 4, name: 'Wily Bishop', nodes: 16000, multipv: 4, temperature: 90 },
  { id: 5, name: 'Stern Rook', nodes: 32000, multipv: 3, temperature: 55 },
  { id: 6, name: 'Sharp Queen', nodes: 64000, multipv: 3, temperature: 28 },
  { id: 7, name: 'Old Master', nodes: 128000, multipv: 2, temperature: 10 },
  { id: 8, name: 'Archmage', nodes: 256000, multipv: 1, temperature: 0 },
] as const;

export function chooseMove(lines: readonly EngineLine[], level: LevelConfig | number, rng: () => number, legalMoves?: readonly string[]): string {
  if (!lines.length) throw new Error('cannot choose from an empty engine result');
  const config = typeof level === 'number' ? LEVELS.find((item) => item.id === level) : level;
  if (!config) throw new Error(`unknown ladder level: ${level}`);
  if (config.slipProb && config.slipProb > 0 && legalMoves?.length && rng() < config.slipProb) {
    return legalMoves[Math.min(legalMoves.length - 1, Math.floor(rng() * legalMoves.length))]!;
  }
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

