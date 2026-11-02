import { describe, expect, it } from 'vitest';
import { labelBFromPv } from './labels';

describe('amended engine labels', () => {
  it('marks a four-ply PV that captures the mover queen as Label B', () => {
    const before = '4r1k1/8/8/8/8/8/4Q3/4K3 w - - 0 1';
    const after = '4r1k1/8/8/8/4Q3/8/8/4K3 b - - 0 1';
    const result = labelBFromPv(before, after, ['e8e4']);
    expect(result.labelB).toBe(true);
    expect(result.materialLoss).toBeGreaterThanOrEqual(900);
  });
});
