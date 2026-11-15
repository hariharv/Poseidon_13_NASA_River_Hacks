// Regression: on phones the words said "USE" while Stage 1's button says "Fix" (and "UP" for the Hop button...)
// Reported 2026-11-15: "Change the message use to fix on level 1 and anywhere else in the game"
import { describe, it, expect } from 'vitest';
import { touchWords } from './device.js';

describe("touchWords: the words match this stage's buttons", () => {
  it('Stage 1 (Fix button)', () => {
    const fix = { use: 'FIX', up: 'UP', down: 'DOWN' };
    expect(touchWords('Get close and *press E* on the panel', fix)).toBe('Get close and *tap FIX* on the panel');
    expect(touchWords('[E] Fix panel 1', fix)).toBe('[FIX] Fix panel 1');
    expect(touchWords('Press E, then solve the repair puzzle', fix)).toBe('Tap FIX, then solve the repair puzzle');
  });
  it('Stage 2 (Grab button)', () => {
    expect(touchWords('Press [E] or click to grab the wrench', { use: 'GRAB' })).toBe('Press [GRAB] or click to grab the wrench');
  });
  it('Stage 5 (Hop button) and Stage 4 (Engine button)', () => {
    expect(touchWords("press *Space* to hop", { use: 'USE', up: 'HOP' })).toBe('tap HOP to hop');
    expect(touchWords('Now *hold Space* to fire the engine.', { use: 'USE', up: 'ENGINE' })).toBe('Now *hold ENGINE* to fire the engine.');
  });
  it('without stage names it falls back to USE / UP / DOWN', () => {
    expect(touchWords('press E')).toBe('tap USE');
  });
});
