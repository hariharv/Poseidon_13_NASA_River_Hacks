import { describe, it, expect } from 'vitest';
import { EXTRA_SECONDS, puzzleTime } from './puzzle.js';

describe('mini game timers', () => {
  it('give every mini game 15 more seconds', () => {
    expect(EXTRA_SECONDS).toBe(15);
    expect(puzzleTime(16)).toBe(31);
    expect(puzzleTime(14)).toBe(29);
  });
  it('still work when a stage gives no time', () => {
    expect(puzzleTime(undefined)).toBe(16);
  });
});
