import { pieceSvg, type PieceType } from './pieces';

/** Small inline piece art; the parent decides the side with the `w` or `bk` class. */
export const mini = (type: PieceType) => pieceSvg(type);
