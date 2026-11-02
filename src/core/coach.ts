import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { legalAttackers, pieceName, PIECE_VALUES, staticExchange } from './see';

export interface MoveAssessment {
  hangs: boolean;
  piece?: string;
  attackers: number;
  defenders: number;
  netLoss: number;
  message: string;
}

export interface Threat {
  square: string;
  piece: string;
  attackedBy: string[];
  defendedBy: string[];
  netLoss: number;
}

export interface CoachOptions {
  /** Ablation: do not account for recaptures by defenders in SEE. */
  countDefenders?: boolean;
  /** Ablation: treat geometrically attacking pinned pieces as attackers. */
  pinnedPieceRule?: boolean;
  /** Original behaviour: only judge the piece that moved. Default is to also catch any other piece the move leaves en prise. */
  movedPieceOnly?: boolean;
}

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function parseUci(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } {
  const normalized = uci.trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(normalized)) throw new Error(`invalid UCI move: ${uci}`);
  const result: { from: Square; to: Square; promotion?: PieceSymbol } = { from: normalized.slice(0, 2) as Square, to: normalized.slice(2, 4) as Square };
  if (normalized[4]) result.promotion = normalized[4] as PieceSymbol;
  return result;
}

function moveText(move: Move): string {
  return `${pieceName(move.piece)} on ${move.from}`;
}

export function assessMove(fen: string, uci: string, options: CoachOptions = {}): MoveAssessment {
  const chess = new Chess(fen);
  const config = parseUci(uci);
  const move = chess.move(config);
  const movedPiece = chess.get(config.to);
  if (!move || !movedPiece) throw new Error(`illegal UCI move: ${uci}`);
  const enemy = other(movedPiece.color);
  const after = new Chess(chess.fen({ forceEnpassantSquare: true }));
  const legalAttackersAfter = legalAttackers(after, config.to, enemy);
  const geometricAttackers = after.attackers(config.to, enemy);
  const attackers = options.pinnedPieceRule === false ? geometricAttackers.length : legalAttackersAfter.length;
  const defenders = options.countDefenders === false ? 0 : legalAttackers(after, config.to, movedPiece.color).length;
  const netLoss = staticExchange(after, config.to, enemy, { includeDefenders: options.countDefenders !== false });
  const hangs = netLoss >= 100 && movedPiece.type !== 'k';
  const piece = pieceName(movedPiece.type);
  let message = `${piece[0]?.toUpperCase() ?? ''}${piece.slice(1)} on ${config.to} is safe for now.`;
  if (hangs) {
    const attacker = legalAttackersAfter[0];
    message = `${piece[0]?.toUpperCase() ?? ''}${piece.slice(1)} on ${config.to} can be taken by ${attacker ? pieceName(attacker.piece) + ' from ' + attacker.from : 'the opponent'} and cannot be recovered without losing material.`;
  } else if (attackers) {
    message = `${piece[0]?.toUpperCase() ?? ''}${piece.slice(1)} on ${config.to} is attacked, but your pieces can defend or recapture it.`;
  }
  if (!hangs && options.movedPieceOnly !== true) {
    const worst = explainThreats(after.fen({ forceEnpassantSquare: true }), movedPiece.color).sort((a, b) => b.netLoss - a.netLoss)[0];
    if (worst) {
      return { hangs: true, piece: worst.piece, attackers: worst.attackedBy.length, defenders: worst.defendedBy.length, netLoss: worst.netLoss, message: `After this move your ${worst.piece} on ${worst.square} can be taken by ${worst.attackedBy[0] ?? 'a piece'} and nothing makes up for it.` };
    }
  }
  return { hangs, piece, attackers, defenders, netLoss, message };
}

export function explainThreats(fen: string, color: Color): Threat[] {
  const chess = new Chess(fen);
  const threats: Threat[] = [];
  for (const row of chess.board()) {
    for (const entry of row) {
      if (!entry || entry.color !== color) continue;
      const square = entry.square;
      const attackers = legalAttackers(chess, square, other(color));
      if (!attackers.length) continue;
      const netLoss = staticExchange(chess, square, other(color));
      if (netLoss < 100 || entry.type === 'k') continue;
      const defenders = legalAttackers(chess, square, color);
      threats.push({
        square,
        piece: pieceName(entry.type),
        attackedBy: attackers.map((move) => `${pieceName(move.piece)} from ${move.from}`),
        defendedBy: defenders.map((move) => `${pieceName(move.piece)} from ${move.from}`),
        netLoss,
      });
    }
  }
  return threats;
}

export function describeMove(fen: string, uci: string): string {
  const chess = new Chess(fen);
  const config = parseUci(uci);
  const move = chess.move(config);
  if (!move) throw new Error(`illegal UCI move: ${uci}`);
  if (move.isKingsideCastle() || move.isQueensideCastle()) return 'This castles your king to safety and brings a rook toward the centre.';
  if (move.isPromotion()) return `This promotes the pawn on ${move.from} to a ${pieceName(move.promotion)}.`;
  if (move.isCapture()) {
    const captured = move.captured ? pieceName(move.captured) : 'piece';
    if (chess.isCheck()) return `This captures a ${captured} on ${move.to} with check.`;
    return `This captures a ${captured} on ${move.to}.`;
  }
  if (chess.isCheck()) return `This puts the opponent's king in check from ${move.to}.`;
  if (move.piece !== 'p' && (move.from[1] === '1' || move.from[1] === '8')) return `This develops the ${pieceName(move.piece)} from ${move.from} toward the centre.`;
  const protectedPiece = SQUARES.find((square) => {
    const piece = chess.get(square);
    return piece?.color === move.color && square !== move.to && chess.attackers(square, move.color).length > 0;
  });
  if (protectedPiece) return `This improves your position and protects the ${pieceName(chess.get(protectedPiece)?.type)} on ${protectedPiece}.`;
  return `This moves the ${pieceName(move.piece)} from ${move.from} to ${move.to}.`;
}

export { PIECE_VALUES } from './see';

