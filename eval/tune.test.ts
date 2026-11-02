import { describe, expect, it } from 'vitest';
import { assertTuningSeed } from './tune';

describe('tuning seed guard', () => {
  it('rejects reporting seeds', () => {
    expect(() => assertTuningSeed(10_000)).toThrow(/1\.\.999/);
    expect(() => assertTuningSeed(0)).toThrow(/1\.\.999/);
    expect(() => assertTuningSeed(999)).not.toThrow();
  });
});
