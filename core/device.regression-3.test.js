// Regression: ISSUE-006 — touch arm hints still named keyboard letters ("Move the arm left A")
// Found by /qa on 2026-11-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-15.md
import { describe, it, expect } from 'vitest';
import { touchWords } from './device.js';

describe('touchWords: steering hints name directions, not letters', () => {
  it.each([
    ['Move the arm left [A] to a gold handle', 'Move the arm left to a gold handle'],
    ['Park the arm in the STOW ring: away [W]', 'Park the arm in the STOW ring: away'],
    ['Move the arm closer [S] to the green slot', 'Move the arm closer to the green slot'],
    ['Move the arm right [D] to a gold handle', 'Move the arm right to a gold handle'],
    ['Lower the box down [Shift]', 'Lower the box down [DOWN]'],
  ])('%s', (from, to) => {
    expect(touchWords(from)).toBe(to);
  });
});
