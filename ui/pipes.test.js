import { describe, it, expect } from 'vitest';
import { makePipes, rotate, flowFrom, N, E, S, W } from './pipes.js';

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

describe('pipe puzzle boards', () => {
  it('turning a piece four times brings it back', () => {
    expect(rotate(N | E)).toBe(E | S);
    expect(rotate(N | S, 1)).toBe(E | W);
    expect(rotate(W | N, 4)).toBe(W | N);
  });

  it('every board starts broken but its answer carries the power to the bulb', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const size of [3, 4, 5]) {
        const b = makePipes(size, seeded(seed));
        expect(flowFrom(b.grid, b.start, b.end).solved).toBe(false);
        expect(flowFrom(b.answer, b.start, b.end).solved).toBe(true);
      }
    }
  });

  it('every piece can be turned into its answer', () => {
    const b = makePipes(4, seeded(7));
    b.grid.forEach((row, r) =>
      row.forEach((m, c) => {
        const turns = [0, 1, 2, 3].map((k) => rotate(m, k));
        expect(turns).toContain(b.answer[r][c]);
      }),
    );
  });
});
