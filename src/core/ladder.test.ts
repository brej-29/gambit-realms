import { describe, expect, it } from 'vitest';
import { chooseMove, LEVELS } from './ladder';
import type { EngineLine } from '../engine/types';

const lines: EngineLine[] = [
  { uci: 'a1a2', cp: 100, pv: ['a1a2'], depth: 10 },
  { uci: 'b1b2', cp: 0, pv: ['b1b2'], depth: 10 },
  { uci: 'c1c2', cp: -200, pv: ['c1c2'], depth: 10 },
];

describe('ladder sampler', () => {
  it('is deterministic for a seeded stream', () => {
    let a = 17;
    let b = 17;
    const rngA = () => ((a = (a * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const rngB = () => ((b = (b * 1103515245 + 12345) >>> 0) / 2 ** 32);
    expect(Array.from({ length: 30 }, () => chooseMove(lines, LEVELS[0]!, rngA))).toEqual(Array.from({ length: 30 }, () => chooseMove(lines, LEVELS[0]!, rngB)));
  });

  it('chooses the argmax at zero temperature', () => {
    expect(chooseMove(lines, LEVELS[7]!, () => 0.99)).toBe('a1a2');
  });

  it('favours better moves while retaining a warm distribution', () => {
    const counts = new Map<string, number>();
    let state = 42;
    for (let i = 0; i < 5000; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const move = chooseMove(lines, LEVELS[0]!, () => state / 2 ** 32);
      counts.set(move, (counts.get(move) ?? 0) + 1);
    }
    expect(counts.get('a1a2')).toBeGreaterThan(counts.get('b1b2') ?? 0);
    expect(counts.get('b1b2')).toBeGreaterThan(counts.get('c1c2') ?? 0);
    expect(counts.size).toBe(3);
  });
});

