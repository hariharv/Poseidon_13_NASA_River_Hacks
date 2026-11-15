import { describe, it, expect } from 'vitest';
import { dayClock, plugsFor, powerState, oxygenStep, waterStep, growStep, progressFor, stormLight, flareStrength, starsFor, NO_AIR, COLD, STORM_OUT, MACHINES } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const r = rulesFor('apollo', 'easy');
const set = (...ids) => new Set(ids);

describe('Apollo: every choice adds up over time', () => {
  it('runs for 14 Moon-days: Sun first, then the long lunar night', () => {
    expect(dayClock(0, r)).toMatchObject({ day: 1, night: false });
    expect(dayClock((r.nightFrom - 1) * r.dayLength + 0.1, r)).toMatchObject({ day: r.nightFrom, night: true });
    expect(dayClock(r.days * r.dayLength, r).done).toBe(true);
  });

  it('has 4 plugs in sunlight but only 2 in the lunar night', () => {
    expect(plugsFor(false, r)).toBe(4);
    expect(plugsFor(true, r)).toBe(2);
  });

  it('at night there are exactly enough plugs for air and heat, and nothing else', () => {
    const night = plugsFor(true, r);
    expect(powerState(set('air', 'heater'), night).overloaded).toBe(false);
    expect(powerState(set('air', 'heater', 'grow'), night).overloaded).toBe(true);
  });

  it('the air machine makes oxygen only with a plug AND water', () => {
    const making = oxygenStep({ where: 'inside', making: true, heaterOn: true, night: false }, 1, r);
    const notMaking = oxygenStep({ where: 'inside', making: false, heaterOn: true, night: false }, 1, r);
    expect(making.delta).toBeGreaterThanOrEqual(0);
    expect(notMaking.delta).toBeLessThan(0);
    expect(notMaking.reason).toBe(NO_AIR);
  });

  it('making air uses up water, so you have to go and dig ice', () => {
    const perDay = -waterStep(true, r.dayLength, r);
    expect(perDay).toBeCloseTo(r.waterPerDay);
    expect(r.waterStart).toBeLessThan(r.days * r.waterPerDay); // the starting water can't last the mission
  });

  it('skipping the heater at night makes you breathe harder and freezes the plants', () => {
    const warm = oxygenStep({ where: 'inside', making: true, heaterOn: true, night: true }, 1, r);
    const cold = oxygenStep({ where: 'inside', making: true, heaterOn: false, night: true }, 1, r);
    expect(cold.delta).toBeLessThan(warm.delta);
    expect(cold.reason).toBe(COLD);
    expect(growStep({ lit: true, night: true, heaterOn: false }, 1, r)).toBeLessThan(0);
  });

  it('plants grow under the grow lights, and add a little oxygen', () => {
    expect(growStep({ lit: true, night: false }, r.growDays * r.dayLength, r)).toBeCloseTo(1);
    const plants = oxygenStep({ where: 'inside', making: true, heaterOn: true, night: false, growing: 3 }, 1, r);
    const none = oxygenStep({ where: 'inside', making: true, heaterOn: true, night: false, growing: 0 }, 1, r);
    expect(plants.delta).toBeGreaterThan(none.delta);
  });

  it('a moonwalk costs suit air', () => {
    expect(oxygenStep({ where: 'outside' }, 1, r).delta).toBeLessThan(-r.breathePerSec);
  });
});

describe('the real solar storm', () => {
  it('warns first (yellow), then the particles hit (red), then calm', () => {
    expect(stormLight(null, r)).toBe('green');
    expect(stormLight(1, r)).toBe('yellow');
    expect(stormLight(r.storm.warnSeconds + 1, r)).toBe('red');
    expect(stormLight(r.storm.warnSeconds + r.storm.stormSeconds + 1, r)).toBe('green');
  });

  it('the shelter keeps you far safer than the base, and outside is worst', () => {
    const at = (where) => oxygenStep({ where, making: true, heaterOn: true, night: false, storm: 'red' }, 1, r).delta;
    expect(at('shelter')).toBeGreaterThan(at('inside'));
    expect(at('inside')).toBeGreaterThan(at('outside'));
    expect(oxygenStep({ where: 'outside', storm: 'red' }, 1, r).reason).toBe(STORM_OUT);
  });

  it('bigger real flares hit harder', () => {
    expect(flareStrength('X9.3')).toBeGreaterThan(flareStrength('M5.5'));
    expect(flareStrength('nonsense')).toBe(1);
  });
});

describe('progress and stars', () => {
  it('surviving all 14 days and doing every job fills the bar', () => {
    expect(progressFor({ fraction: 1, harvests: r.goals.harvest, calls: r.goals.radio, ice: r.goals.ice }, r)).toBeCloseTo(100);
  });

  it('just surviving is half the job', () => {
    expect(progressFor({ fraction: 1, harvests: 0, calls: 0, ice: 0 }, r)).toBe(r.shares.days);
  });

  it('extra jobs past the goal do not count twice', () => {
    expect(progressFor({ fraction: 0, harvests: 99, calls: 0, ice: 0 }, r)).toBe(r.shares.harvest);
  });

  it('gives 1 to 3 stars', () => {
    expect(starsFor({ progress: 10, minOxygen: 5 }, r)).toBe(1);
    expect(starsFor({ progress: 100, minOxygen: 90 }, r)).toBe(3);
  });

  it('has one plug socket per machine, and air comes first on the panel', () => {
    expect(MACHINES[0].id).toBe('air');
    expect(new Set(MACHINES.map((m) => m.id)).size).toBe(MACHINES.length);
  });

  it('the judge demo is short', () => {
    const demo = rulesFor('apollo', 'demo');
    expect(demo.days * demo.dayLength).toBeLessThan(50);
  });
});
