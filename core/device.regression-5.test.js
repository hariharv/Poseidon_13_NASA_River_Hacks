// Regression: on a computer the mouse sometimes wasn't locked and the cursor just moved around.
// A lock asked for after the 3-2-1 countdown was refused once, and the game gave up on
// mouse-look for good. Reported 2026-11-15.
import { describe, it, expect } from 'vitest';
import { dragLookAfterRefusal } from './device.js';

describe('dragLookAfterRefusal: when a refused mouse lock means click-and-drag', () => {
  it('the first refusal on a computer keeps mouse-look (the game pauses; the next click locks)', () => {
    expect(dragLookAfterRefusal({ touch: false, everLocked: false, refusals: 1 })).toBe(false);
  });
  it('refusals after a lock worked (like just after Esc) never switch to click-and-drag', () => {
    expect(dragLookAfterRefusal({ touch: false, everLocked: true, refusals: 5 })).toBe(false);
  });
  it('a browser that refuses twice and never locks (it blocks pointer lock) uses click-and-drag', () => {
    expect(dragLookAfterRefusal({ touch: false, everLocked: false, refusals: 2 })).toBe(true);
  });
  it('touch screens always use drag-to-look', () => {
    expect(dragLookAfterRefusal({ touch: true, everLocked: false, refusals: 0 })).toBe(true);
  });
});
