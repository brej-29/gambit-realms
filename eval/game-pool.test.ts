import { describe, expect, it } from 'vitest';
import { GamePool } from './game-pool';
import type { GameTask } from './game';

const tasks: GameTask[] = [101, 102].map((seed) => ({
  white: { id: 'random-a', kind: 'random' },
  black: { id: 'random-b', kind: 'random' },
  seed,
  paramsHash: 'determinism-test',
  match: 'random-random',
  referenceNodes: 1,
}));

async function run(size: number) {
  const pool = new GamePool(size);
  try { return (await pool.run(tasks)).sort((a, b) => a.seed - b.seed); } finally { pool.dispose(); }
}

describe('complete-game workers', () => {
  it('produces identical games with one or two workers', async () => {
    await expect(run(1)).resolves.toEqual(await run(2));
  }, 30_000);
});
