export interface EngineLine {
  /** Centipawns from the side-to-move's point of view. */
  uci: string;
  cp: number;
  mate?: number;
  pv: string[];
  depth: number;
}

export interface EngineOptions {
  nodes?: number;
  depth?: number;
  multipv?: number;
  uciElo?: number;
  skill?: number;
}

export interface Engine {
  analyse(fen: string, options: EngineOptions): Promise<EngineLine[]>;
  dispose(): void;
}

/** Keep mate scores comparable with centipawn scores used by the ladder. */
export function clippedScore(cp: number | undefined, mate: number | undefined): number {
  if (mate !== undefined) return mate >= 0 ? 1000 : -1000;
  return Math.max(-1000, Math.min(1000, cp ?? 0));
}

export function lineScore(line: EngineLine): number {
  return clippedScore(line.cp, line.mate);
}
