import { describe, it, expect } from 'vitest';
import { oxygenStep, workStep, starsFor } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('hermes', 'easy');

describe('Hermes trade-off: working longer gets more done, but uses more oxygen', () => {
  it('floating still uses a little oxygen (you always breathe)', () => {
    const step = oxygenStep({ working: false, refilling: false }, 1, r);
    expect(step.delta).toBeLessThan(0);
    expect(step.reason).toBe('breathing');
  });

  it('working uses more oxygen than floating', () => {
    const floating = oxygenStep({ working: false, refilling: false }, 1, r);
    const working = oxygenStep({ working: true, refilling: false }, 1, r);
    expect(working.delta).toBeLessThan(floating.delta);
    expect(working.reason).toBe('working');
  });

  it('refilling raises oxygen', () => {
    const step = oxygenStep({ working: false, refilling: true }, 1, r);
    expect(step.delta).toBeGreaterThan(0);
    expect(step.reason).toBe('refill');
  });

  it('refilling wins if both happen (you can not fix a panel at the air station)', () => {
    const step = oxygenStep({ working: true, refilling: true }, 1, r);
    expect(step.reason).toBe('refill');
  });

  it('working moves the panel along; one panel takes panelWorkSeconds', () => {
    expect(workStep(true, r.panelWorkSeconds, r)).toBeCloseTo(1);
    expect(workStep(false, 5, r)).toBe(0);
  });

  it('one tank is not enough to fix every panel without a refill', () => {
    const perPanel = (r.breathePerSec + r.workPerSec) * r.panelWorkSeconds;
    expect(perPanel * r.panels).toBeGreaterThan(r.startOxygen);
  });
});

describe('starsFor', () => {
  it('gives 1 star just for finishing', () => {
    expect(starsFor({ minOxygen: 1, seconds: 9999 }, r)).toBe(1);
  });

  it('adds a star for staying safe', () => {
    expect(starsFor({ minOxygen: r.stars.safeAbove + 1, seconds: 9999 }, r)).toBe(2);
  });

  it('adds a star for being quick', () => {
    expect(starsFor({ minOxygen: 1, seconds: r.stars.speedySeconds - 1 }, r)).toBe(2);
  });

  it('gives 3 stars for safe and quick', () => {
    expect(starsFor({ minOxygen: 80, seconds: 10 }, r)).toBe(3);
  });
});
