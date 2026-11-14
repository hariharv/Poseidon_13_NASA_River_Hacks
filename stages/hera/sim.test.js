import { describe, it, expect } from 'vitest';
import { flareStrength, stormClock, shelterProtection, oxygenStep, flightStep, starsFor, minutesLater, kidDuration } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('hera', 'easy');
const hard = rulesFor('hera', 'hard');

describe('flareStrength: the real flare class sets how strong the storm is', () => {
  it('X flares are about ten times stronger than M flares, so their storm hits harder', () => {
    expect(flareStrength('X8.2')).toBeGreaterThan(flareStrength('M5.5'));
  });
  it('bigger numbers inside the same letter are stronger', () => {
    expect(flareStrength('X9.3')).toBeGreaterThan(flareStrength('X5.8'));
  });
  it('stays in a playable range, even for odd input', () => {
    for (const c of ['X9.3', 'X1.0', 'M1.0', 'C3.0', '', null, 'banana']) {
      const s = flareStrength(c);
      expect(s).toBeGreaterThanOrEqual(0.4);
      expect(s).toBeLessThanOrEqual(1.25);
    }
  });
});

describe('stormClock: flash first, particles later', () => {
  const plan = { warnSeconds: 20, stormSeconds: 30 };
  it('starts calm, warns (yellow) after the flash, then the particles arrive (red), then all clear', () => {
    expect(stormClock(null, plan).light).toBe('green');
    expect(stormClock(5, plan).light).toBe('yellow');
    expect(stormClock(5, plan).secondsLeft).toBeCloseTo(15);
    expect(stormClock(25, plan).light).toBe('red');
    expect(stormClock(55, plan).light).toBe('green');
    expect(stormClock(55, plan).phase).toBe('clear');
  });
});

describe('shelterProtection: a finished shelter cuts the dose about four times', () => {
  it('no bags = no protection, all bags = dose about 4x lower', () => {
    expect(shelterProtection(0, r.bags)).toBe(1);
    expect(shelterProtection(r.bags, r.bags)).toBeCloseTo(0.25);
  });
  it('each bag helps a bit', () => {
    expect(shelterProtection(1, r.bags)).toBeLessThan(1);
    expect(shelterProtection(1, r.bags)).toBeGreaterThan(shelterProtection(2, r.bags));
  });
});

describe('oxygenStep: every choice costs something', () => {
  const calm = { light: 'green', where: 'seat', bags: 0, hose: false, strength: 1 };
  it('you always breathe a little', () => {
    const s = oxygenStep(calm, 1, r);
    expect(s.delta).toBeLessThan(0);
    expect(s.reason).toBe('cabin-air');
  });
  it('flying through the red storm costs much more than sheltering in a finished shelter', () => {
    const flying = oxygenStep({ ...calm, light: 'red' }, 1, r);
    const sheltered = oxygenStep({ ...calm, light: 'red', where: 'shelter', bags: r.bags, hose: true }, 1, r);
    expect(flying.delta).toBeLessThan(sheltered.delta * 2.5);
    expect(flying.reason).toBe('storm');
  });
  it('a stronger real flare hurts more', () => {
    const weak = oxygenStep({ ...calm, light: 'red', strength: 0.5 }, 1, r);
    const strong = oxygenStep({ ...calm, light: 'red', strength: 1.2 }, 1, r);
    expect(strong.delta).toBeLessThan(weak.delta);
  });
  it('hiding in the shelter without the air hose runs your air down', () => {
    const noHose = oxygenStep({ ...calm, where: 'shelter', bags: r.bags, hose: false }, 1, r);
    const hose = oxygenStep({ ...calm, where: 'shelter', bags: r.bags, hose: true }, 1, r);
    expect(noHose.delta).toBeLessThan(hose.delta);
    expect(noHose.reason).toBe('no-air-hose');
  });
  it('in Easy you can survive flying through a storm (just), in Hard you cannot', () => {
    const stormCost = (rules) => -oxygenStep({ ...calm, light: 'red', strength: 1 }, 1, rules).delta * rules.stormSeconds;
    expect(stormCost(r)).toBeLessThan(r.startOxygen);
    expect(stormCost(hard) + hard.breathePerSec * 120).toBeGreaterThan(hard.startOxygen);
  });
});

describe('flightStep: Progress only grows while the ship points the right way', () => {
  it('on target fills Progress, way off target does not', () => {
    expect(flightStep(0.01, 1, r)).toBeCloseTo(r.flyPerSec);
    expect(flightStep(0.6, 1, r)).toBe(0);
  });
  it('close (but not in the ring) gets half', () => {
    expect(flightStep(r.aimRing * 1.5, 1, r)).toBeCloseTo(r.flyPerSec / 2);
  });
});

describe('starsFor', () => {
  it('1 star for finishing, +1 for staying safe, +1 for being quick', () => {
    expect(starsFor({ minOxygen: 5, seconds: 9999 }, r)).toBe(1);
    expect(starsFor({ minOxygen: 80, seconds: 9999 }, r)).toBe(2);
    expect(starsFor({ minOxygen: 80, seconds: 10 }, r)).toBe(3);
  });
});

describe('minutesLater: how long the real particles took', () => {
  it('reads the gap between the real flare and the real particle storm', () => {
    expect(minutesLater({ flareTime: '2017-09-10T15:35Z', particlesTime: '2017-09-10T16:25Z' })).toBe(50);
    expect(minutesLater({})).toBe(null);
  });
});

describe('Hera is harder than the stages before it', () => {
  it('starts with less oxygen than Stage 3', () => {
    expect(r.startOxygen).toBeLessThan(rulesFor('dioscuri', 'easy').startOxygen);
  });
  it('Hard mode gives less warning and needs a bigger shelter', () => {
    expect(hard.warnSeconds).toBeLessThan(r.warnSeconds);
    expect(hard.bags).toBeGreaterThan(r.bags);
  });
});

describe('kidDuration: real gaps in kid words', () => {
  it('says minutes, one hour, or hours', () => {
    expect(kidDuration(50)).toBe('50 minutes');
    expect(kidDuration(60)).toBe('1 hour');
    expect(kidDuration(255)).toBe('about 4 hours');
    expect(kidDuration(697)).toBe('almost 12 hours');
  });
});
