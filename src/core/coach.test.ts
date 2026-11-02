import { describe, expect, it } from 'vitest';
import { assessMove } from './coach';

// The bishop on b2 is the only defender of the knight on c3; black's rook on c8 attacks it.
const FEN = '2r4k/8/8/8/8/2N5/1B6/6K1 w - - 0 1';

describe('coach', () => {
  it('warns when a move leaves another piece en prise', () => {
    const a = assessMove(FEN, 'b2a3');
    expect(a.hangs).toBe(true);
    expect(a.message).toContain('knight on c3');
  });
  it('the original moved-piece-only rule misses it', () => {
    expect(assessMove(FEN, 'b2a3', { movedPieceOnly: true }).hangs).toBe(false);
  });
  it('stays quiet when the defender keeps guarding', () => {
    expect(assessMove(FEN, 'g1h1').hangs).toBe(false);
  });
  it('still flags a piece moved onto an attacked square', () => {
    expect(assessMove('4k3/8/8/2p5/8/8/8/3QK3 w - - 0 1', 'd1d4').hangs).toBe(true);
  });
});
