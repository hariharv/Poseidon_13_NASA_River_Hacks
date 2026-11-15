import { describe, it, expect } from 'vitest';
import { makeFlow, snake, stepToward, touching } from './flow.js';

// a repeatable "random" so failures can be reproduced
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

describe('power-line puzzle boards', () => {
  it('the snake visits every square once, one step at a time', () => {
    const path = snake(5, seeded(3));
    expect(path.length).toBe(25);
    expect(new Set(path.map(String)).size).toBe(25);
    for (let i = 1; i < path.length; i++) expect(touching(path[i - 1], path[i])).toBe(true);
  });

  it('every board can be solved, and its answer fills every square', () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const [size, count] of [
        [5, 4],
        [6, 5],
      ]) {
        const board = makeFlow(size, count, seeded(seed));
        expect(board.pairs.length).toBe(count);
        const cells = board.answer.flat();
        expect(new Set(cells.map(String)).size).toBe(size * size);
        board.answer.forEach((line, i) => {
          expect(line[0]).toEqual(board.pairs[i].a);
          expect(line[line.length - 1]).toEqual(board.pairs[i].b);
          for (let j = 1; j < line.length; j++) expect(touching(line[j - 1], line[j])).toBe(true);
        });
      }
    }
  });

  it('never puts a pair of dots right next to each other', () => {
    for (let seed = 1; seed < 60; seed++) {
      const board = makeFlow(5, 4, seeded(seed));
      for (const { a, b } of board.pairs) expect(touching(a, b)).toBe(false);
    }
  });

  it('a fast drag fills in the squares it skipped, one step at a time', () => {
    expect(stepToward([0, 0], [3, 1])).toEqual([1, 0]);
    expect(stepToward([2, 2], [2, 0])).toEqual([2, 1]);
    expect(stepToward([1, 1], [1, 1])).toBe(null);
  });
});
