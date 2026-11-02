import { describe, expect, it } from 'vitest';
import { bootstrapLadderIntervals, eloConfidence, eloFromScore, fitLadder, score, wilsonInterval } from './stats';

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

  it('recovers the ordering of synthetic ratings with the anchored likelihood fit', () => {
    const outcomes = (wins: number, losses: number) => [...Array(wins).fill(1), ...Array(losses).fill(0)];
    const ratings = fitLadder([
      { a: 'L1', b: 'A', scoreA: 0.25, games: 200, outcomes: outcomes(50, 150) },
      { a: 'L2', b: 'L1', scoreA: 0.75, games: 200, outcomes: outcomes(150, 50) },
    ], [{ id: 'A', rating: 1600 }]);
    expect(ratings.L1).toBeLessThan(1600);
    expect(ratings.L2).toBeGreaterThan(ratings.L1!);
    expect(ratings.L1).toBeGreaterThan(1200);
  });

  it('uses percentile resampling for rating intervals and enforces the minimum', () => {
    const pairing = { a: 'L1', b: 'A', scoreA: 0.5, games: 20, outcomes: [...Array(10).fill(1), ...Array(10).fill(0)] };
    const interval = bootstrapLadderIntervals([pairing], [{ id: 'A', rating: 1600 }], 400, 42).L1!;
    expect(interval.low).toBeLessThan(interval.high);
    expect(() => bootstrapLadderIntervals([pairing], [{ id: 'A', rating: 1600 }], 399)).toThrow(/400/);
  });
});

