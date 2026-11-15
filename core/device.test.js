import { describe, it, expect } from 'vitest';
import { detectDevice, touchWords } from './device.js';

describe('detectDevice: computer or touch screen', () => {
  it('a phone or tablet (finger, no mouse) is touch', () => {
    expect(detectDevice({ coarse: true, fine: false, touchPoints: 5 })).toBe('touch');
  });
  it('a laptop with a mouse is desktop, even with a touch screen', () => {
    expect(detectDevice({ coarse: false, fine: true, touchPoints: 10 })).toBe('desktop');
    expect(detectDevice({ coarse: false, fine: true, touchPoints: 0 })).toBe('desktop');
  });
  it('the address can force either one', () => {
    expect(detectDevice({ search: '?device=touch', fine: true })).toBe('touch');
    expect(detectDevice({ search: '?stage=apollo&device=desktop', coarse: true, touchPoints: 5 })).toBe('desktop');
  });
});

describe('touchWords: keyboard words become touch words', () => {
  it('swaps keys for the on-screen buttons', () => {
    expect(touchWords('Press [E] to grab the wrench')).toBe('Press [USE] to grab the wrench');
    expect(touchWords('Look at it and press E.')).toBe('Look at it and tap USE.');
    expect(touchWords('Hold Space to fire the engine')).toBe('Hold UP to fire the engine');
    expect(touchWords('Steer with *W A S D*, Space and Shift.')).toBe('Steer with *the stick*, UP and DOWN.');
  });
  it('drops the arrow-key hints and keeps everything else', () => {
    expect(touchWords('W and S (or ↑ ↓)')).toBe('the stick (up and down)');
    expect(touchWords('Oxygen low! Go to the masks.')).toBe('Oxygen low! Go to the masks.');
    expect(touchWords('*Space junk!* NASA Space Communications')).toBe('*Space junk!* NASA Space Communications');
  });
});
