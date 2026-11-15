import { describe, it, expect } from 'vitest';
import { forceDevice, isTouch, device } from './device.js';

describe('forceDevice (the presentation tour shows the phone version for a moment)', () => {
  it('switches to touch and back to desktop', () => {
    expect(forceDevice('touch')).toBe('touch');
    expect(isTouch()).toBe(true);
    expect(device()).toBe('touch');
    expect(forceDevice('desktop')).toBe('desktop');
    expect(isTouch()).toBe(false);
  });

  it('treats anything else as desktop', () => {
    expect(forceDevice('tablet')).toBe('desktop');
  });
});
