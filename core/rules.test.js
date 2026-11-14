import { describe, it, expect } from 'vitest';
import { rulesFor, RULES } from './rules.js';

describe('rulesFor', () => {
  it('uses the stage base numbers', () => {
    const r = rulesFor('hermes', 'easy');
    expect(r.panels).toBe(RULES.stages.hermes.base.panels);
  });

  it('applies the mode overrides on top of the base', () => {
    const easy = rulesFor('hermes', 'easy');
    const hard = rulesFor('hermes', 'hard');
    expect(hard.breathePerSec).toBeGreaterThan(easy.breathePerSec);
    expect(hard.workPerSec).toBeGreaterThan(easy.workPerSec);
  });

  it('gives the judge demo fewer panels and a shorter job', () => {
    const demo = rulesFor('hermes', 'demo');
    const easy = rulesFor('hermes', 'easy');
    expect(demo.panels).toBeLessThan(easy.panels);
    expect(demo.panelWorkSeconds).toBeLessThan(easy.panelWorkSeconds);
  });

  it('merges nested objects instead of replacing them', () => {
    const r = rulesFor('hermes', 'hard');
    expect(r.stars.safeAbove).toBeDefined();
    expect(r.stars.speedySeconds).toBeDefined();
  });

  it('does not let one call change the shared numbers', () => {
    const r = rulesFor('hermes', 'easy');
    r.stars.safeAbove = -1;
    expect(rulesFor('hermes', 'easy').stars.safeAbove).not.toBe(-1);
  });

  it('returns an empty object for a stage with no numbers yet', () => {
    expect(rulesFor('apollo', 'easy')).toEqual({});
  });
});
