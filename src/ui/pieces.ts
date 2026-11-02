/**
 * One piece rig for every realm. Each piece is a stack of classed parts; the realm
 * stylesheet decides fills, strokes, glow and eye style. Classes:
 *   b = body, t = trim, s = shade overlay, e = eye white, p = pupil, k = shadow on the floor.
 * ViewBox is 100 x 120 and the feet touch y = 112, x = 50 is the centre line.
 */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

const eyes = (y: number, gap = 5.5, r = 3, dx = 0) =>
  `<g class="eyes"><circle class="e" cx="${50 - gap + dx}" cy="${y}" r="${r}"/><circle class="e" cx="${50 + gap + dx}" cy="${y}" r="${r}"/>` +
  `<circle class="p" cx="${50 - gap + 0.8 + dx}" cy="${y + 0.5}" r="${r * 0.5}"/><circle class="p" cx="${50 + gap + 0.8 + dx}" cy="${y + 0.5}" r="${r * 0.5}"/></g>`;

const base = `<path class="b" d="M24 112 Q24 103 34 101 L66 101 Q76 103 76 112 Z"/><path class="t" d="M30 105 L70 105 L71 108 L29 108Z"/>`;

const ART: Record<PieceType, string> = {
  p:
    base +
    `<path class="b" d="M50 56 C41 56 36 64 35 76 C34 88 31 95 30 102 L70 102 C69 95 66 88 65 76 C64 64 59 56 50 56Z"/>` +
    `<path class="s" d="M50 56 C59 56 64 64 65 76 C66 88 69 95 70 102 L58 102 C58 88 57 68 50 56Z"/>` +
    `<path class="t" d="M34 82 L66 82 L67 88 L33 88Z"/>` +
    `<circle class="b" cx="50" cy="43" r="13"/>` +
    `<path class="t" d="M36 43 C36 26 64 26 64 43 L58 43 C58 36 42 36 42 43Z"/><rect class="t" x="48" y="39" width="4" height="9" rx="1.5"/>` +
    eyes(47, 6.5, 2.8),
  r:
    base +
    `<path class="b" d="M33 102 L36 52 L64 52 L67 102Z"/><path class="s" d="M54 52 L64 52 L67 102 L57 102Z"/>` +
    `<path class="b" d="M29 53 L29 30 L39 30 L39 38 L45 38 L45 30 L55 30 L55 38 L61 38 L61 30 L71 30 L71 53Z"/>` +
    `<path class="s" d="M61 30 L71 30 L71 53 L61 53Z"/>` +
    `<rect class="t" x="29" y="50" width="42" height="5" rx="1"/><rect class="t" x="33" y="92" width="34" height="5" rx="1"/>` +
    eyes(68, 6.5, 3.2),
  n:
    base +
    `<path class="b" d="M30 102 C30 86 34 74 42 65 C33 62 27 54 28 44 C29 32 39 22 51 19 L53 8 L60 18 C73 21 80 31 77 43 L84 53 C86 58 82 63 76 62 L67 59 C65 67 67 75 71 83 C73 90 73 96 73 102Z"/>` +
    `<path class="s" d="M62 59 C60 68 63 76 68 84 C71 90 72 96 73 102 L58 102 C60 88 58 74 62 59Z"/>` +
    `<path class="t" d="M52 19 C43 25 38 36 38 46 C38 55 34 61 30 66 L35 69 C42 62 44 53 46 46 C48 37 52 28 57 21Z"/>` +
    `<g class="eyes"><circle class="e" cx="64" cy="36" r="3.4"/><circle class="p" cx="64.9" cy="36.5" r="1.8"/></g><ellipse class="p" cx="80" cy="54" rx="1.6" ry="2.2"/>`,
  b:
    base +
    `<path class="b" d="M50 52 C41 58 37 68 34 80 C32 90 30 96 28 102 L72 102 C70 96 68 90 66 80 C63 68 59 58 50 52Z"/>` +
    `<path class="s" d="M50 52 C59 58 63 68 66 80 C68 90 70 96 72 102 L60 102 C60 86 58 66 50 52Z"/>` +
    `<path class="t" d="M38 68 L45 66 L66 94 L58 97Z"/>` +
    `<circle class="b" cx="50" cy="48" r="10"/>` +
    `<path class="b" d="M50 12 C61 22 63 36 59 43 L41 43 C37 36 39 22 50 12Z"/>` +
    `<path class="t" d="M48.5 20 H51.5 V38 H48.5Z M44 27 H56 V30 H44Z"/><circle class="t" cx="50" cy="10" r="4"/>` +
    eyes(50, 4.5, 2.5),
  q:
    base +
    `<path class="b" d="M50 58 C40 58 35 68 33 80 C32 92 28 98 26 102 L74 102 C72 98 68 92 67 80 C65 68 60 58 50 58Z"/>` +
    `<path class="s" d="M50 58 C60 58 65 68 67 80 C68 92 72 98 74 102 L60 102 C60 88 58 68 50 58Z"/>` +
    `<path class="t" d="M37 63 Q50 72 63 63 L61 68 Q50 77 39 68Z"/>` +
    `<circle class="b" cx="50" cy="47" r="11"/>` +
    `<path class="t" d="M36 40 L34 20 L43 30 L50 13 L57 30 L66 20 L64 40Z"/>` +
    `<circle class="t" cx="34" cy="18" r="3"/><circle class="t" cx="50" cy="11" r="3.4"/><circle class="t" cx="66" cy="18" r="3"/>` +
    eyes(50, 4.8, 2.6),
  k:
    base +
    `<path class="b" d="M50 56 C38 56 32 68 30 80 C29 92 25 98 22 102 L78 102 C75 98 71 92 70 80 C68 68 62 56 50 56Z"/>` +
    `<path class="s" d="M50 56 C62 56 68 68 70 80 C71 92 75 98 78 102 L62 102 C62 86 60 66 50 56Z"/>` +
    `<path class="t" d="M36 62 Q50 72 64 62 L62 68 Q50 78 38 68Z"/>` +
    `<circle class="b" cx="50" cy="46" r="11"/>` +
    `<path class="t" d="M36 38 L36 25 L43 32 L50 23 L57 32 L64 25 L64 38Z"/>` +
    `<path class="t" d="M47 5 H53 V10 H58 V16 H53 V24 H47 V16 H42 V10 H47Z"/>` +
    eyes(49, 4.8, 2.6),
};

export function pieceSvg(type: PieceType): string {
  return (
    `<svg class="art" viewBox="0 0 100 120" aria-hidden="true" focusable="false">` +
    `<ellipse class="k" cx="50" cy="112" rx="27" ry="6"/>${ART[type]}</svg>`
  );
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};
