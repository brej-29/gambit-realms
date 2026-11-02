import { Chess, type PieceSymbol } from 'chess.js';

function materialScore(chess: Chess, color: 'w' | 'b'): number {
  const values: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
  return chess.board().flat().reduce((sum, piece) => sum + (piece ? (piece.color === color ? 1 : -1) * values[piece.type] : 0), 0);
}

function applyUci(chess: Chess, uci: string): void {
  const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] as PieceSymbol } : {}) });
  if (!move) throw new Error(`illegal PV move ${uci}`);
}

/** Amendment 1 Label B: after the candidate move, follow four reference PV plies. */
export function labelBFromPv(beforeFen: string, afterFen: string, pv: readonly string[], plies = 4): { labelB: boolean; materialLoss: number } {
  const before = new Chess(beforeFen);
  const mover = before.turn();
  const beforeMaterial = materialScore(before, mover);
  const after = new Chess(afterFen);
  for (const move of pv.slice(0, plies)) {
    try { applyUci(after, move); } catch { break; }
  }
  const materialLoss = beforeMaterial - materialScore(after, mover);
  return { labelB: materialLoss >= 100, materialLoss };
}
