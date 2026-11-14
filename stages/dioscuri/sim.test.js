import { describe, it, expect } from 'vitest';
import { powerState, canPlug, oxygenStep, scienceStep, orbitPhase, plugsFor, solveArm, armPoints, clampTarget, starsFor, NO_AIR } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('dioscuri', 'easy');
const set = (...ids) => new Set(ids);

describe('Dioscuri: science is why we go to space, but it costs energy', () => {
  it('in sunlight there are enough plugs for air AND fast science', () => {
    const p = powerState(set('air', 'science', 'boost'), plugsFor('day', r));
    expect(p.overloaded).toBe(false);
    expect(p.airOn).toBe(true);
    expect(p.scienceRate).toBe(2);
  });

  it("in Earth's shadow, air + science is safe but slow", () => {
    const p = powerState(set('air', 'science'), plugsFor('night', r));
    expect(p.scienceRate).toBe(1);
    expect(oxygenStep({ airOn: p.airOn }, 1, r).delta).toBeGreaterThanOrEqual(0);
  });

  it("in Earth's shadow, fast science means no fresh air", () => {
    const p = powerState(set('science', 'boost'), plugsFor('night', r));
    expect(p.scienceRate).toBe(2);
    const o = oxygenStep({ airOn: p.airOn }, 1, r);
    expect(o.delta).toBeLessThan(0);
    expect(o.reason).toBe(NO_AIR);
  });

  it('when the Sun sets, the daytime plugs are too many: nothing works until you unplug', () => {
    const day = set(...r.startPlugged);
    expect(powerState(day, plugsFor('day', r)).overloaded).toBe(false);
    const night = powerState(day, plugsFor('night', r));
    expect(night.overloaded).toBe(true);
    expect(night.airOn).toBe(false);
    expect(night.armOn).toBe(false);
  });

  it('the boost does nothing without the science box', () => {
    expect(powerState(set('air', 'boost'), 4).scienceRate).toBe(0);
  });

  it('you can only plug in as many machines as you have plugs', () => {
    expect(canPlug(set('air'), 2)).toBe(true);
    expect(canPlug(set('air', 'arm'), 2)).toBe(false);
  });

  it('a whole night of fast science with no air machine costs a lot of oxygen', () => {
    expect(-oxygenStep({ airOn: false }, r.nightSeconds, r).delta).toBeGreaterThan(30);
  });

  it('the experiment takes longer than one sunny day, so you always live through a sunset', () => {
    const left = 100 - r.grabShare - r.placeShare;
    expect(scienceStep({ scienceRate: 2 }, r.daySeconds, r)).toBeLessThan(left);
    expect(scienceStep({ scienceRate: 2 }, r.nightSeconds, r)).toBeLessThan(left);
  });
});

describe('the orbit: day side, then night side', () => {
  it('starts in sunlight, then goes into shadow, then comes back', () => {
    expect(orbitPhase(0, r).side).toBe('day');
    expect(orbitPhase(r.daySeconds + 1, r).side).toBe('night');
    expect(orbitPhase(r.daySeconds + r.nightSeconds + 1, r)).toMatchObject({ side: 'day', orbit: 1 });
  });

  it('gives 4 plugs by day and 2 at night', () => {
    expect(plugsFor('day', r)).toBe(4);
    expect(plugsFor('night', r)).toBe(2);
  });
});

describe('the robot arm', () => {
  const L1 = 4.2;
  const L2 = 4;
  for (const target of [
    { x: -6, y: 0.3, z: -2 },
    { x: 6, y: 0.5, z: -2 },
    { x: 0, y: 2, z: -5 },
    { x: 2, y: -1, z: -3 },
  ]) {
    it(`puts the hand exactly on (${target.x}, ${target.y}, ${target.z})`, () => {
      const angles = solveArm(target, L1, L2);
      expect(angles.reached).toBe(true);
      const { hand } = armPoints(angles, L1, L2);
      expect(hand.x).toBeCloseTo(target.x, 3);
      expect(hand.y).toBeCloseTo(target.y, 3);
      expect(hand.z).toBeCloseTo(target.z, 3);
    });
  }

  it('bends the elbow up, over the station', () => {
    const { elbow } = armPoints(solveArm({ x: 0, y: 0, z: -5 }, L1, L2), L1, L2);
    expect(elbow.y).toBeGreaterThan(0);
  });

  it('keeps the hand target within reach and above the deck', () => {
    const far = clampTarget({ x: 0, y: 0, z: -50 }, L1, L2, -1);
    expect(Math.hypot(far.x, far.y, far.z)).toBeLessThanOrEqual(L1 + L2);
    expect(clampTarget({ x: 3, y: -9, z: -3 }, L1, L2, -1).y).toBeGreaterThanOrEqual(-1);
  });
});

describe('modes', () => {
  it('Hard has a smaller grab zone and uses oxygen faster', () => {
    const hard = rulesFor('dioscuri', 'hard');
    expect(hard.grabRadius).toBeLessThan(r.grabRadius);
    expect(hard.breathePerSec).toBeGreaterThan(r.breathePerSec);
  });

  it('the judge demo has a short day so the sunset comes quickly', () => {
    expect(rulesFor('dioscuri', 'demo').daySeconds).toBeLessThan(r.daySeconds);
  });

  it('gives 1 to 3 stars for safe and quick', () => {
    expect(starsFor({ minOxygen: 1, seconds: 9999 }, r)).toBe(1);
    expect(starsFor({ minOxygen: 90, seconds: 10 }, r)).toBe(3);
  });
});
