// Regression: the Menu couldn't take a new player (e.g. a fresh phone) back to the level chooser
// Reported 2026-11-15: "it doesnt let u go back to the level chooser on mobile when u press menu"
import { describe, it, expect } from 'vitest';
import { STAGES, stageChoices } from './stages.js';

const ids = (choices) => choices.map((c) => c.id);

describe('stageChoices: the level chooser', () => {
  it('a new player (nothing finished) gets Stage 1 and a way back to the title', () => {
    const c = stageChoices(STAGES, { completed: [] });
    expect(ids(c)).toEqual(['hermes', 'quit']);
    expect(c[0].label).toMatch(/^Start: Stage 1/);
  });
  it('after finishing a stage every stage is open, next one first', () => {
    const c = stageChoices(STAGES, { completed: ['hermes'], stars: { hermes: 2 } });
    expect(ids(c)).toEqual(['odysseus', 'hermes', 'dioscuri', 'hera', 'apollo', 'quit']);
    expect(c[0].label).toMatch(/^Continue: Stage 2/);
    expect(c[1].label).toMatch(/✓ ★★$/);
  });
  it('right after finishing a stage it suggests the one after it', () => {
    const c = stageChoices(STAGES, { completed: ['hermes', 'odysseus', 'dioscuri'] }, 'odysseus');
    expect(c[0]).toMatchObject({ id: 'dioscuri' });
    expect(c[0].label).toMatch(/^Next:/);
  });
});
