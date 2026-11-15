// Regression: ISSUE-003 — touch screens still said "Q gets up" (there is no Q key on a phone)
// Found by /qa on 2026-11-15
// Report: .gstack/qa-reports/qa-report-localhost-2026-11-15.md
import { describe, it, expect } from 'vitest';
import { touchWords } from './device.js';

describe('touchWords: the Get up key in Stage 3', () => {
  it('the controls card names the GET UP button, not the Q key', () => {
    const card = touchWords('W A S D, Space, Shift steer the arm · Q gets up');
    expect(card).not.toMatch(/\bQ\b/);
    expect(card).toMatch(/GET UP/);
  });
  it('the desk prompt says GET UP once, not "[GET UP] get up"', () => {
    const prompt = touchWords('Steer: W A S D, Space, Shift · [Q] get up');
    expect(prompt).not.toMatch(/\bQ\b/);
    expect(prompt).not.toMatch(/GET UP\] get up/i);
    expect(prompt).toMatch(/\[GET UP\]/);
  });
});
