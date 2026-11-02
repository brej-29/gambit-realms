import { describe, expect, it } from 'vitest';
import { eloConfidence, eloFromScore, fitLadder, score, wilsonInterval } from './stats';

describe('evaluation statistics', () => {
  it('computes game score and a bounded Wilson interval', () => {
    expect(score(3, 2, 1)).toBeCloseTo(4 / 6);
    const interval = wilsonInterval(0.5, 100);
    expect(interval.low).toBeGreaterThan(0.4);
    expect(interval.high).toBeLessThan(0.6);
  });

  it('maps equal score to equal Elo and propagates confidence', () => {
    expect(eloFromScore(0.5)).toBeCloseTo(0);
    const ci = eloConfidence(0.75, 100);
    expect(ci.low).toBeLessThan(eloFromScore(0.75));
    expect(ci.high).toBeGreaterThan(eloFromScore(0.75));
  });

  it('fits unknown levels against fixed anchors', () => {
    const ratings = fitLadder([
      { a: 'L1', b: 'A', scoreA: 0.25, games: 100 },
      { a: 'L2', b: 'L1', scoreA: 0.75, games: 100 },
    ], [{ id: 'A', rating: 1600 }]);
    expect(ratings.A).toBe(1600);
    expect(ratings.L1).toBeLessThan(1600);
    expect(ratings.L2).toBeGreaterThan(ratings.L1!);
  });
});

