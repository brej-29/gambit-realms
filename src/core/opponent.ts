import type { Engine } from '../engine/types';
import { LEVELS } from './ladder';
import { chooseMove } from './ladder';

export async function pickOpponentMove(engine: Engine, fen: string, level: number, rng: () => number): Promise<string> {
  const config = LEVELS.find((item) => item.id === level);
  if (!config) throw new Error(`unknown ladder level: ${level}`);
  const lines = await engine.analyse(fen, { nodes: config.nodes, multipv: config.multipv });
  return chooseMove(lines, config, rng, fen);
}

