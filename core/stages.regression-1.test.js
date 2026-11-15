// Regression: ISSUE-001 — loading screen "Start here" badge always sat on Stage 1
// Found by /qa on 2026-11-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-15.md
import { describe, it, expect } from 'vitest';
import { STAGES, nextStageIndex } from './stages.js';

describe('nextStageIndex: where "Start here" points on the loading screen', () => {
  it('a new player starts at Stage 1', () => {
    expect(nextStageIndex(STAGES, [])).toBe(0);
  });
  it('after finishing Stage 1 it points at Stage 2', () => {
    expect(nextStageIndex(STAGES, ['hermes'])).toBe(1);
  });
  it('skips every finished stage, in order', () => {
    expect(nextStageIndex(STAGES, ['hermes', 'odysseus', 'hera'])).toBe(2);
  });
  it('once everything is finished it goes back to Stage 1', () => {
    expect(nextStageIndex(STAGES, STAGES.map((s) => s.id))).toBe(0);
  });
});
