import { describe, it, expect } from 'vitest';
import { pushOutOfBox } from './collide.js';

const desk = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 0, z: 0 } };
const v3 = (x, y, z) => ({ x, y, z });

describe('pushOutOfBox: walls and furniture are solid', () => {
  it('leaves something that is clear of the box alone', () => {
    const p = v3(0, 1, 0.5);
    expect(pushOutOfBox(p, v3(0, 0, 0), desk, 0.3)).toBe(false);
    expect(p).toEqual(v3(0, 1, 0.5));
  });
  it('pushes a ball touching a face back out to exactly its radius, and bounces it', () => {
    const p = v3(0, 0.1, -0.5);
    const v = v3(0, -2, 0);
    expect(pushOutOfBox(p, v, desk, 0.3)).toBe(true);
    expect(p.y).toBeCloseTo(0.3);
    expect(v.y).toBeGreaterThan(0);
  });
  it('a ball whose middle got inside leaves through the nearest face, not through the far side', () => {
    const p = v3(0, -0.5, -0.05); // just inside the front face (z = 0)
    const v = v3(0, 0, -1); // still moving in
    pushOutOfBox(p, v, desk, 0.3);
    expect(p.z).toBeCloseTo(0.3);
    expect(v.z).toBe(0);
  });
  it('holding a key into the box every frame never gets through it', () => {
    const p = v3(0, -0.5, 1);
    const v = v3(0, 0, -3);
    for (let i = 0; i < 200; i++) {
      p.z += v.z * 0.05;
      pushOutOfBox(p, v, desk, 0.3);
      v.z = -3; // keep pushing
    }
    expect(p.z).toBeGreaterThan(0);
  });
});
