import { describeMove, explainThreats, assessMove } from '../core/coach';
import { pickOpponentMove } from '../core/opponent';
import { mulberry32 } from '../core/rng';
import { BrowserEngine } from '../engine/browser';

export interface Assessment {
  hangs: boolean;
  message: string;
}
export interface Threat {
  square: string;
  piece: string;
  message: string;
}
export interface Brain {
  opponentMove(fen: string, level: number): Promise<string>;
  assess(fen: string, uci: string): Assessment;
  threats(fen: string, color: 'w' | 'b'): Threat[];
  hint(fen: string): Promise<{ uci: string; text: string }>;
  /** Start loading the engine so the first move is not slowed by the download. */
  warm(): void;
}

let engine: BrowserEngine | null = null;
const rng = mulberry32((Date.now() ^ (Math.random() * 2 ** 32)) >>> 0);
const getEngine = () => (engine ??= new BrowserEngine());

/** Opponent and coach for the app: the engine runs in a worker, the coach is pure chess.js logic. */
export const brain: Brain = {
  warm: () => void getEngine(),
  opponentMove: (fen, level) => pickOpponentMove(getEngine(), fen, level, rng),
  assess: (fen, uci) => {
    const a = assessMove(fen, uci);
    return { hangs: a.hangs, message: a.hangs ? `${a.message}` : a.message };
  },
  threats: (fen, color) =>
    explainThreats(fen, color).map((t) => ({
      square: t.square,
      piece: t.piece,
      message: `your ${t.piece} on ${t.square} can be taken by ${t.attackedBy[0] ?? 'a piece'} ${t.defendedBy.length ? 'and the trade would cost you material' : 'and nothing protects it'}.`,
    })),
  async hint(fen) {
    const lines = await getEngine().analyse(fen, { nodes: 120_000, multipv: 1 });
    const uci = lines[0]?.uci;
    if (!uci) throw new Error('no hint available');
    return { uci, text: describeMove(fen, uci) };
  },
};
