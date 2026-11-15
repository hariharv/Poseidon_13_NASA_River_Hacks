// Regression: ISSUE-004 — touch words left a stray "*" after bold keys ("tap USE* to sit down")
// Found by /qa on 2026-11-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-15.md
import { describe, it, expect } from 'vitest';
import { touchWords } from './device.js';

describe('touchWords: bold keys keep clean words', () => {
  it.each([
    ['look at the desk and press *E* to sit down.', 'look at the desk and tap USE to sit down.'],
    ['Press *E* on the blinking switch', 'Tap USE on the blinking switch'],
    ['Now *hold Space* to fire the engine.', 'Now *hold UP* to fire the engine.'],
    ['Press *Q* to get up.', 'Tap GET UP to get up.'],
  ])('%s', (from, to) => {
    expect(touchWords(from)).toBe(to);
  });
});
