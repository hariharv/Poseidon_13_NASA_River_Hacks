import { describe, it, expect } from 'vitest';
import { plugPrompt } from './plugs.js';

describe('plugPrompt: plain words for the power panel', () => {
  it('a machine that is ON can be turned OFF to free a plug', () => {
    expect(plugPrompt({ label: 'SNACK FRIDGE', plugged: true, free: 0, overloaded: true })).toBe('Press [E] to turn OFF the snack fridge (frees a plug)');
  });
  it('a machine that is OFF can be turned ON if there is a free plug', () => {
    expect(plugPrompt({ label: 'CAMERA', plugged: false, free: 1, overloaded: false })).toMatch(/turn ON the camera/);
  });
  it('with no free plug it says what to do instead', () => {
    expect(plugPrompt({ label: 'CAMERA', plugged: false, free: 0, overloaded: false })).toMatch(/turn another machine OFF first/);
    expect(plugPrompt({ label: 'CAMERA', plugged: false, free: 1, overloaded: true })).toMatch(/turn another machine OFF first/);
  });
});
