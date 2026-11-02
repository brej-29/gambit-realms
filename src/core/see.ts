import { Chess, type Color, type PieceSymbol, type Square, type Move } from 'chess.js';

export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 10_000 };
const PIECE_NAMES: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function pieceName(piece: PieceSymbol | undefined): string {
  return piece ? PIECE_NAMES[piece] : 'piece';
}

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function moveConfig(move: Move): { from: Square; to: Square; promotion?: PieceSymbol } {
  return move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to };
}

function legalCapturesTo(chess: Chess, square: Square, color: Color): Move[] {
  if (chess.turn() !== color) {
    const fields = chess.fen({ forceEnpassantSquare: true }).split(' ');
    fields[1] = color;
    fields[3] = '-';
    const copy = new Chess(fields.join(' '));
    return legalCapturesTo(copy, square, color);
  }
  return (chess.moves({ verbose: true }) as Move[]).filter((move) => move.to === square && move.isCapture());
}

/** Best material gain available by a legal exchange on one square. */
export function staticExchange(chess: Chess, square: Square, side: Color = chess.turn()): number {
  if (chess.turn() !== side) {
    const fields = chess.fen({ forceEnpassantSquare: true }).split(' ');
    fields[1] = side;
    fields[3] = '-';
    return staticExchange(new Chess(fields.join(' ')), square, side);
  }
  const target = chess.get(square);
  if (!target || target.color === side) return 0;
  const captures = legalCapturesTo(chess, square, side);
  if (!captures.length) return 0;
  let best = 0;
  for (const capture of captures) {
    const capturedValue = PIECE_VALUES[target.type];
    const next = new Chess(chess.fen({ forceEnpassantSquare: true }));
    next.move(moveConfig(capture));
    const gain = capturedValue - staticExchange(next, square, opposite(side));
    if (gain > best) best = gain;
  }
  return best;
}

export function legalAttackers(chess: Chess, square: Square, color: Color): Move[] {
  return legalCapturesTo(chess, square, color);
}

