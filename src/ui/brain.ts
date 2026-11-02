import { Chess } from 'chess.js';

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
}

const toUci = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '');

/** Placeholder brain until the engine layer is wired in. */
export const brain: Brain = {
  async opponentMove(fen) {
    const c = new Chess(fen);
    const moves = c.moves({ verbose: true });
    const caps = moves.filter((m) => m.captured);
    const pool = caps.length ? caps : moves;
    return toUci(pool[(Math.random() * pool.length) | 0]!);
  },
  assess: () => ({ hangs: false, message: '' }),
  threats: () => [],
  async hint(fen) {
    const m = new Chess(fen).moves({ verbose: true })[0]!;
    return { uci: toUci(m), text: 'Try this move.' };
  },
};
