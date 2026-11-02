import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { LESSONS } from './lessons';

describe('lessons', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: positions load and every accepted move is legal`, () => {
      expect(lesson.steps.length).toBeGreaterThan(0);
      for (const s of lesson.steps) {
        const c = new Chess(s.fen);
        const legal = new Set(c.moves({ verbose: true }).map((m) => m.from + m.to));
        if (Array.isArray(s.expect)) for (const m of s.expect) expect(legal.has(m), `${lesson.id}: ${m}`).toBe(true);
        for (const m of s.alt ?? []) expect(legal.has(m), `${lesson.id} alt: ${m}`).toBe(true);
        if (s.expect === 'mate') {
          const mates = c.moves({ verbose: true }).filter((m) => { const t = new Chess(s.fen); t.move(m); return t.isCheckmate(); });
          expect(mates.length, `${lesson.id} has a mating move`).toBeGreaterThan(0);
        }
        if (!s.expect && !s.click && !s.look) throw new Error(`${lesson.id}: step has no goal`);
      }
    });
  }
});
