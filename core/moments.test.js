import { describe, it, expect } from 'vitest';
import { pickMoment } from './moments.js';

describe('pickMoment', () => {
  it('blames the reason that used the most oxygen while it was low', () => {
    const log = [
      { before: 90, delta: -40, reason: 'working' }, // not low yet, ignored
      { before: 28, delta: -6, reason: 'breathing' },
      { before: 22, delta: -18, reason: 'working' },
      { before: 4, delta: -4, reason: 'breathing' },
    ];
    expect(pickMoment(log).reason).toBe('working');
  });

  it('turns the reason into a sentence Buoy can say', () => {
    const log = [{ before: 20, delta: -20, reason: 'working' }];
    expect(pickMoment(log).text).toBe('You kept working when your oxygen was low.');
  });

  it('ignores refills', () => {
    const log = [
      { before: 10, delta: +50, reason: 'refill' },
      { before: 20, delta: -20, reason: 'breathing' },
    ];
    expect(pickMoment(log).reason).toBe('breathing');
  });

  it('falls back to the biggest drain overall if oxygen was never low', () => {
    const log = [
      { before: 100, delta: -30, reason: 'storm' },
      { before: 70, delta: -10, reason: 'working' },
    ];
    expect(pickMoment(log).reason).toBe('storm');
  });

  it('uses an unknown reason as the sentence itself', () => {
    const log = [{ before: 10, delta: -10, reason: 'You forgot to plug in the air machine.' }];
    expect(pickMoment(log).text).toBe('You forgot to plug in the air machine.');
  });

  it('returns a gentle default when nothing was logged', () => {
    expect(pickMoment([]).text).toMatch(/oxygen/i);
  });
});
