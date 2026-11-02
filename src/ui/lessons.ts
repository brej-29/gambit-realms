import type { Square } from 'chess.js';

export interface Step {
  fen: string;
  say: string;
  ok: string;
  /** Moves (from+to) that complete the step, or 'mate' for any checkmating move. */
  expect?: string[] | 'mate';
  /** Also accepted, with a gentler note. */
  alt?: string[];
  altOk?: string;
  wrong?: string;
  /** Squares to click instead of moving. */
  click?: Square[];
  /** Pieces can be selected to show their moves but not moved. */
  look?: boolean;
}
export interface Lesson {
  id: string;
  title: string;
  blurb: string;
  steps: Step[];
}

const K = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

export const LESSONS: Lesson[] = [
  {
    id: 'board',
    title: 'The board and the army',
    blurb: 'Names of squares and the 16 pieces you command.',
    steps: [
      { fen: K, say: 'Columns are called files (a to h) and rows are ranks (1 to 8). Every square has a name, like e4. Click e4.', click: ['e4'], ok: 'That is e4, right in the middle.', wrong: 'Find file e, then go up to rank 4.' },
      { fen: K, say: 'White always starts at the bottom. Click the bottom-left corner, a1.', click: ['a1'], ok: 'a1 is where the white rook starts.', wrong: 'The bottom-left corner is a1.' },
      { fen: K, say: 'Now the far corner on the right, h8.', click: ['h8'], ok: 'Files run a to h, ranks run 1 to 8.', wrong: 'Top-right corner is h8.' },
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', say: 'Each side has 8 pawns, 2 rooks, 2 knights, 2 bishops, a queen and a king. Click any piece to see where it can go. Click Next when you are ready.', ok: 'Ready.', look: true },
    ],
  },
  {
    id: 'pawn',
    title: 'The pawn',
    blurb: 'Small, brave and the only piece that captures differently.',
    steps: [
      { fen: '7k/8/8/8/8/8/4P3/7K w - - 0 1', say: 'Pawns march forward. From the starting square they may go one or two squares. Move this pawn two squares.', expect: ['e2e4'], wrong: 'Tap the pawn, then tap the dot two squares ahead.', ok: 'Two steps forward. That is only allowed on a pawn\'s first move.' },
      { fen: '7k/8/8/3p4/4P3/8/8/7K w - - 0 1', say: 'Pawns capture one square diagonally forward. Capture the black pawn.', expect: ['e4d5'], wrong: 'The pawn captures diagonally. Look at the circled square.', ok: 'Captured! Pawns move straight but take sideways.' },
      { fen: '8/4P3/8/8/8/8/k7/7K w - - 0 1', say: 'A pawn that reaches the far side is promoted to any piece, usually a queen. Move to e8.', expect: ['e7e8'], wrong: 'Just one step forward to the last rank.', ok: 'A brand new queen. This is why pawns are worth protecting.' },
    ],
  },
  {
    id: 'rook-bishop',
    title: 'Rook and bishop',
    blurb: 'Long-range sliders: straight lines and diagonals.',
    steps: [
      { fen: '7k/8/8/8/3R2p1/8/8/7K w - - 0 1', say: 'The rook slides any distance in a straight line, never diagonally. Capture the pawn on g4.', expect: ['d4g4'], wrong: 'Slide along the rank to g4.', ok: 'Rooks love open lines.' },
      { fen: '7k/8/5n2/8/8/8/1B6/7K w - - 0 1', say: 'The bishop slides along diagonals and always stays on its own colour. Capture the knight.', expect: ['b2f6'], wrong: 'Follow the diagonal b2, c3, d4, e5, f6.', ok: 'Bishops cut across the board.' },
    ],
  },
  {
    id: 'knight',
    title: 'The knight',
    blurb: 'The only piece that jumps.',
    steps: [
      { fen: '7k/8/8/8/8/8/PPPPPPPP/1N5K w - - 0 1', say: 'The knight moves in an L: two squares one way, then one to the side. It also jumps over other pieces. Move it to c3 or a3.', expect: ['b1c3', 'b1a3'], wrong: 'Two forward and one sideways. The dots show the legal squares.', ok: 'Jumped right over the pawns.' },
      { fen: '7k/8/5p2/8/4N3/8/8/7K w - - 0 1', say: 'Capture the pawn on f6 with your knight.', expect: ['e4f6'], wrong: 'From e4 the knight can land on f6.', ok: 'Forks and surprises are the knight\'s speciality.' },
    ],
  },
  {
    id: 'queen-king',
    title: 'Queen and king',
    blurb: 'The strongest piece and the one you must never lose.',
    steps: [
      { fen: '7k/8/8/3p4/8/8/3Q4/7K w - - 0 1', say: 'The queen moves like a rook and a bishop together. Capture the pawn on d5.', expect: ['d2d5'], wrong: 'Straight up the d-file.', ok: 'Powerful, but do not lose her for a pawn.' },
      { fen: K, say: 'The king takes one step in any direction. Lose it and the game is lost. Move your king one square.', expect: ['e1d1', 'e1f1', 'e1d2', 'e1e2', 'e1f2'], wrong: 'Just one step, any direction.', ok: 'Slowly does it. The king is precious.' },
    ],
  },
  {
    id: 'mate',
    title: 'Check and checkmate',
    blurb: 'How a game is actually won.',
    steps: [
      { fen: '4k3/8/8/8/8/8/R7/4K3 w - - 0 1', say: 'When a king is attacked it is in check, and must get out of it. Give check with your rook.', expect: ['a2a8', 'a2e2'], wrong: 'Put the rook on a square that sees the black king: rank 8 or the e-file.', ok: 'Check! Black must now respond.' },
      { fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', say: 'If the king is in check and has no escape, that is checkmate and the game ends. The black pawns trap their own king. Find the mate.', expect: 'mate', wrong: 'Look for a check that the king cannot escape. The rook can reach rank 8.', ok: 'Checkmate! You win. This is called a back-rank mate.' },
      { fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1', say: 'Queen and king work together. Your king covers the squares next to the black king. Deliver checkmate.', expect: 'mate', wrong: 'Check along rank 8 so the king has no free square.', ok: 'Mate in one. Well spotted.' },
    ],
  },
  {
    id: 'special',
    title: 'Special moves',
    blurb: 'Castling, en passant and promotion.',
    steps: [
      { fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', say: 'Castling moves the king two squares toward a rook, and the rook hops to the other side. It tucks the king away. Castle on either side.', expect: ['e1g1', 'e1c1'], wrong: 'Move the king two squares sideways.', ok: 'Castled. The king is safer and the rook is in play.' },
      { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', say: 'En passant: when a pawn jumps two squares and lands beside your pawn, you may capture it as if it moved only one. Black just played d7 to d5. Capture it.', expect: ['e5d6'], wrong: 'Your pawn takes diagonally to d6, behind the black pawn.', ok: 'En passant. A rule most beginners never see coming.' },
    ],
  },
  {
    id: 'safety',
    title: 'Keep your pieces safe',
    blurb: 'The one skill that wins most beginner games.',
    steps: [
      { fen: '4k3/8/8/8/1b6/P1N5/8/6K1 w - - 0 1', say: 'Before every move, ask what can be captured. Black\'s bishop is attacking one of your pieces and nothing protects it. Click the piece in danger.', click: ['c3'], wrong: 'Follow the bishop\'s diagonal.', ok: 'The knight on c3 can be taken for free.' },
      { fen: '4k3/8/8/8/1b6/P1N5/8/6K1 w - - 0 1', say: 'Best fix: capture the attacker.', expect: ['a3b4'], alt: ['c3e2', 'c3d5', 'c3b5', 'c3a4', 'c3e4', 'c3b1', 'c3d1', 'c3a2'], altOk: 'Moving away is safe too, but capturing wins a piece.', wrong: 'Your pawn on a3 can take the bishop.', ok: 'You won a bishop for free. That is how games are decided.' },
    ],
  },
];
