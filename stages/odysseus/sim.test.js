import { describe, it, expect } from 'vitest';
import {
  oxygenStep,
  uploadStep,
  powerState,
  canPlug,
  toolProgress,
  flightPhase,
  planePitch,
  starsFor,
  NO_AIR,
  ZOOMING,
} from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('odysseus', 'easy');
const set = (...ids) => new Set(ids);

describe('Odysseus part 1: one push and glide uses less air', () => {
  it('floating calmly with the air machine on does not use up your oxygen', () => {
    expect(oxygenStep({ airOn: true, thrusting: false }, 1, r).delta).toBeGreaterThanOrEqual(0);
  });

  it('pushing yourself around uses oxygen, and says why', () => {
    const step = oxygenStep({ airOn: true, thrusting: true }, 1, r);
    expect(step.delta).toBeLessThan(0);
    expect(step.reason).toBe(ZOOMING);
  });

  it('pushing the whole time on every hill would run you out of air', () => {
    const perHill =
      oxygenStep({ airOn: true, thrusting: true }, r.floatSeconds, r).delta +
      oxygenStep({ airOn: true, thrusting: false }, r.heavySeconds, r).delta;
    expect(perHill * 4).toBeLessThan(-r.startOxygen);
  });

  it('tools fill the first part of the Progress bar', () => {
    expect(toolProgress(0, r)).toBe(0);
    expect(toolProgress(r.tools, r)).toBe(r.toolsShare);
    expect(toolProgress(r.tools + 3, r)).toBe(r.toolsShare);
  });
});

describe('Odysseus part 2: when energy is low, keep the air machine on first', () => {
  it('too many machines for the plugs means nothing works', () => {
    const p = powerState(set('air', 'lights', 'fridge', 'music'), 2);
    expect(p.overloaded).toBe(true);
    expect(p.airOn).toBe(false);
    expect(p.workRate).toBe(0);
    expect(p.free).toBe(0);
  });

  it('with no air machine running, oxygen drains faster than just breathing', () => {
    const noAir = oxygenStep({ airOn: false }, 1, r);
    expect(noAir.delta).toBeLessThan(-r.breathePerSec);
    expect(noAir.reason).toBe(NO_AIR);
  });

  it('air + camera: slower Progress, but oxygen stays safe', () => {
    const p = powerState(set('air', 'camera'), 2);
    expect(p.workRate).toBe(1);
    expect(oxygenStep({ airOn: p.airOn }, 1, r).delta).toBeGreaterThanOrEqual(0);
  });

  it('camera + boost: Progress twice as fast, but oxygen goes down', () => {
    const safe = powerState(set('air', 'camera'), 2);
    const fast = powerState(set('camera', 'boost'), 2);
    expect(uploadStep(fast, 1, r)).toBeCloseTo(2 * uploadStep(safe, 1, r));
    expect(oxygenStep({ airOn: fast.airOn }, 1, r).delta).toBeLessThan(0);
  });

  it('the boost does nothing without the camera', () => {
    expect(powerState(set('air', 'boost'), 2).workRate).toBe(0);
  });

  it('you can only plug in as many machines as you have plugs', () => {
    expect(canPlug(set('air'), 2)).toBe(true);
    expect(canPlug(set('air', 'camera'), 2)).toBe(false);
  });

  it('the camera alone can finish the upload, but not on one tank without the air machine', () => {
    const uploadLeft = 100 - r.toolsShare;
    const seconds = uploadLeft / (2 * r.uploadPerSec); // fastest possible: camera + boost
    const cost = -oxygenStep({ airOn: false }, seconds, r).delta;
    expect(cost).toBeGreaterThan(20); // a real cost you can feel
  });
});

describe('the flight: heavy, float, heavy, float...', () => {
  it('starts heavy (pulling up), then floats', () => {
    expect(flightPhase(0, r).phase).toBe('heavy');
    expect(flightPhase(r.heavySeconds + 1, r).phase).toBe('float');
  });

  it('counts the hills', () => {
    const cycle = r.heavySeconds + r.floatSeconds;
    expect(flightPhase(cycle * 2 + 0.5, r).hill).toBe(2);
  });

  it('noses up while heavy and over the top while floating', () => {
    expect(planePitch({ phase: 'heavy', k: 1 })).toBeCloseTo(45);
    expect(planePitch({ phase: 'float', k: 0.5 })).toBeCloseTo(0);
    expect(planePitch({ phase: 'float', k: 1 })).toBeCloseTo(-45);
  });
});

describe('modes', () => {
  it('Hard has more tools and faster oxygen use', () => {
    const hard = rulesFor('odysseus', 'hard');
    expect(hard.tools).toBeGreaterThan(r.tools);
    expect(hard.breathePerSec).toBeGreaterThan(r.breathePerSec);
  });

  it('the judge demo is short: fewer tools, shorter floats, no flicker', () => {
    const demo = rulesFor('odysseus', 'demo');
    expect(demo.tools).toBeLessThan(r.tools);
    expect(demo.floatSeconds).toBeLessThan(r.floatSeconds);
    expect(demo.flickerAt).toBeNull();
  });
});

describe('starsFor', () => {
  it('gives 1 to 3 stars for safe and quick', () => {
    expect(starsFor({ minOxygen: 1, seconds: 9999 }, r)).toBe(1);
    expect(starsFor({ minOxygen: 80, seconds: 10 }, r)).toBe(3);
  });
});
