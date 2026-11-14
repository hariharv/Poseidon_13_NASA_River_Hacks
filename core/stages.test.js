import { describe, it, expect } from 'vitest';
import { STAGES, loadStage } from './stages.js';

describe('stage loader', () => {
  it('lists the six stages in plan order', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['hermes', 'odysseus', 'dioscuri', 'hera', 'artemis', 'apollo']);
  });

  it('finds a stage just by its folder existing', () => {
    expect(STAGES.find((s) => s.id === 'hermes').available).toBe(true);
  });

  it('marks stages nobody has built yet as unavailable', () => {
    expect(STAGES.find((s) => s.id === 'apollo').available).toBe(false);
  });

  it('loads a stage that follows the contract', async () => {
    const stage = await loadStage('hermes');
    expect(stage.id).toBe('hermes');
    expect(typeof stage.start).toBe('function');
    expect(typeof stage.demo).toBe('function');
  });

  it('refuses a stage that does not exist', async () => {
    await expect(loadStage('zeus')).rejects.toThrow(/zeus/);
  });
});
