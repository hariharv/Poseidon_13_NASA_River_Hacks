import { describe, it, expect } from 'vitest';
import {
  powerState,
  canPlug,
  oxygenStep,
  experimentStep,
  shares,
  orbitPhase,
  plugsFor,
  solveArm,
  armPoints,
  clampTarget,
  starsFor,
  NO_AIR,
  EXPERIMENTS,
  MACHINES,
} from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('dioscuri', 'easy');
const set = (...ids) => new Set(ids);

describe('Dioscuri: science is why we go to space, but it costs energy', () => {
  it('has a box, a slot, a puzzle and a power socket for every experiment', () => {
    expect(EXPERIMENTS).toHaveLength(3);
    for (const e of EXPERIMENTS) {
      expect(MACHINES.some((m) => m.id === e.id)).toBe(true);
      expect(['wires', 'sequence', 'timing']).toContain(e.puzzle);
    }
    expect(new Set(EXPERIMENTS.map((e) => e.puzzle)).size).toBe(3); // three different puzzles
  });

  it('by day there are enough plugs for air AND all three experiments (if you unplug the arm and lights)', () => {
    const p = powerState(set('air', 'plants', 'crystals', 'blobs'), plugsFor('day', r));
    expect(p.overloaded).toBe(false);
    expect(p.airOn).toBe(true);
    expect(['plants', 'crystals', 'blobs'].every((id) => p.has(id))).toBe(true);
  });

  it("in Earth's shadow there's only room for air plus ONE experiment", () => {
    const night = plugsFor('night', r);
    expect(powerState(set('air', 'plants'), night).overloaded).toBe(false);
    expect(powerState(set('air', 'plants', 'crystals'), night).overloaded).toBe(true);
  });

  it('two experiments at night means no fresh air', () => {
    const p = powerState(set('plants', 'crystals'), plugsFor('night', r));
    expect(p.has('plants') && p.has('crystals')).toBe(true);
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

  it('an experiment only grows when it is started AND has a plug', () => {
    expect(experimentStep({ started: true, powered: true, done: false }, 1, r)).toBeGreaterThan(0);
    expect(experimentStep({ started: false, powered: true, done: false }, 1, r)).toBe(0);
    expect(experimentStep({ started: true, powered: false, done: false }, 1, r)).toBe(0);
    expect(experimentStep({ started: true, powered: true, done: true }, 1, r)).toBe(0);
  });

  it('the boxes and the experiments add up to a full Progress bar', () => {
    const { boxes, perExperiment } = shares(r);
    expect(boxes + perExperiment * r.boxes).toBeCloseTo(100);
  });

  it("one experiment can't finish in a single night, so you have to plan around the sunsets", () => {
    const { perExperiment } = shares(r);
    expect(experimentStep({ started: true, powered: true }, r.nightSeconds, r)).toBeLessThan(perExperiment);
  });

  it('you can only plug in as many machines as you have plugs', () => {
    expect(canPlug(set('air'), 2)).toBe(true);
    expect(canPlug(set('air', 'arm'), 2)).toBe(false);
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
  const L1 = 4.0;
  const L2 = 3.8;
  for (const target of [
    { x: -5.6, y: 0.5, z: 3.8 },
    { x: 5.6, y: 0.5, z: 1.2 },
    { x: 0, y: 2, z: 3 },
    { x: 2, y: -1, z: 3 },
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

describe('modes: each one a bit harder', () => {

  it('Stage 3 has more to juggle than Stage 2 (more machines than plugs, plus junk)', () => {
    expect(MACHINES.length).toBeGreaterThan(rulesFor('odysseus', 'easy').plugsLevel + r.dayPlugs - 1);
    expect(r.debris).toBeGreaterThan(0);
  });

  it('the judge demo is short: one box, no junk, a quick day', () => {
    const demo = rulesFor('dioscuri', 'demo');
    expect(demo.boxes).toBe(1);
    expect(demo.debris).toBe(0);
    expect(demo.daySeconds).toBeLessThan(r.daySeconds);
  });

  it('gives 1 to 3 stars for safe and quick', () => {
    expect(starsFor({ minOxygen: 1, seconds: 9999 }, r)).toBe(1);
    expect(starsFor({ minOxygen: 90, seconds: 10 }, r)).toBe(3);
  });
});
