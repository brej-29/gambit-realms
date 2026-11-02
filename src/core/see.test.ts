import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { assessMove, describeMove, explainThreats } from './coach';
import { staticExchange } from './see';

describe('static exchange and coach', () => {
  it('recognises a queen left to a rook', () => {
    const result = assessMove('4k3/8/8/8/8/8/3r4/4Q1K1 w - - 0 1', 'e1e2');
    expect(result.hangs).toBe(true);
    expect(result.attackers).toBeGreaterThan(0);
    expect(result.netLoss).toBeGreaterThanOrEqual(500);
    expect(result.message).toMatch(/queen|taken|lost/i);
  });

  it('does not count a pinned attacker as a legal capture', () => {
    const chess = new Chess('4r1k1/8/8/8/8/2B5/8/4R1K1 b - - 0 1');
    expect(staticExchange(chess, 'e1', 'b')).toBe(0);
  });

  it('explains checks, captures, castling, and threats', () => {
    expect(describeMove('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2e8')).toMatch(/captures|check/i);
    expect(describeMove('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1')).toMatch(/castles/i);
    const threats = explainThreats('4k3/8/8/8/8/8/3r4/3Q3K w - - 0 1', 'w');
    expect(threats.some((threat) => threat.square === 'd1')).toBe(true);
  });
});

