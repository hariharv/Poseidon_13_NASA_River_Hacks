// Apollo's numbers, without any 3D. Easy to test, easy to balance.
// The big idea: every choice adds up over time. Nothing is free.

export const NO_AIR = 'Nothing was making fresh air: the air machine needs a plug AND water.';
export const COLD = 'The lunar night got freezing because the heater had no plug.';
export const SUIT = 'You stayed outside on a moonwalk until your suit air ran low.';
export const STORM_OUT = 'You stayed outside in the solar storm: too much radiation.';
export const STORM_IN = 'You stayed out of the storm shelter while the storm light was red.';

// The power panel. Each machine takes 1 energy plug.
export const MACHINES = [
  { id: 'air', label: 'AIR MACHINE', sub: 'water → oxygen', kind: 'air' },
  { id: 'heater', label: 'HEATER', sub: 'needed at night', kind: 'air' },
  { id: 'grow', label: 'GROW LIGHTS', sub: 'grows food', kind: 'work' },
  { id: 'radio', label: 'RADIO', sub: 'call Earth', kind: 'work' },
  { id: 'lights', label: 'BIG LIGHTS', sub: 'extra', kind: 'extra' },
];

// Which Moon-day it is, and whether the Sun is up.
export function dayClock(t, r) {
  const total = r.days * r.dayLength;
  const clamped = Math.min(t, total);
  const day = Math.min(r.days, Math.floor(clamped / r.dayLength) + 1);
  const into = clamped - (day - 1) * r.dayLength;
  return { day, k: into / r.dayLength, left: r.dayLength - into, night: day >= r.nightFrom, done: t >= total, fraction: clamped / total };
}

// Solar panels in sunlight; batteries only in the long lunar night.
export function plugsFor(night, r) {
  return night ? r.nightPlugs : r.dayPlugs;
}

// Too many machines for the plugs = overload: nothing works until you unplug some.
export function powerState(plugged, plugs) {
  const used = plugged.size;
  const overloaded = used > plugs;
  const on = (id) => !overloaded && plugged.has(id);
  return { used, free: Math.max(0, plugs - used), overloaded, has: on, airOn: on('air'), heaterOn: on('heater'), growOn: on('grow'), radioOn: on('radio'), lightsOn: on('lights') };
}

export function canPlug(plugged, plugs) {
  return plugged.size < plugs;
}

// Oxygen for one step.
//   where: 'inside' | 'shelter' | 'outside'
//   making: is the air machine making oxygen (plug AND water)?
//   storm: 'green' | 'yellow' | 'red', strength: how big the real flare was (1 = average)
export function oxygenStep({ where, making, heaterOn, night, growing = 0, storm = 'green', strength = 1 }, dt, r) {
  let perSec = -r.breathePerSec;
  let reason = 'breathing';
  if (where === 'outside') {
    perSec -= r.suitPerSec;
    reason = SUIT;
  } else {
    perSec += making ? r.airMachinePerSec : -r.staleAirPerSec;
    perSec += growing * r.plantAirPerSec;
    if (!making) reason = NO_AIR;
    if (night && !heaterOn) {
      perSec -= r.coldPerSec;
      if (making) reason = COLD;
    }
  }
  if (storm === 'red') {
    const s = r.storm;
    const dose = (where === 'outside' ? s.outsidePerSec : where === 'shelter' ? s.shelterPerSec : s.insidePerSec) * strength;
    perSec -= dose;
    if (where !== 'shelter' && dose > 0.2) reason = where === 'outside' ? STORM_OUT : STORM_IN;
  }
  const delta = perSec * dt;
  return delta >= 0 ? { delta, reason: 'refill' } : { delta, reason };
}

// Water the air machine uses up while it's making oxygen.
export function waterStep(making, dt, r) {
  return making ? -(r.waterPerDay / r.dayLength) * dt : 0;
}

// One plant tray's growth: grows under the grow lights; at night it also needs the heater, or it freezes.
export function growStep({ lit, night, heaterOn }, dt, r) {
  if (night && !heaterOn) return -(dt / (r.growDays * r.dayLength)) * 0.5; // frost damage
  return lit ? dt / (r.growDays * r.dayLength) : 0;
}

// Progress: surviving the days, plus the mission jobs (each capped at its goal).
export function progressFor({ fraction, harvests, calls, ice }, r) {
  const s = r.shares;
  const g = r.goals;
  return Math.min(100, fraction * s.days + (Math.min(harvests, g.harvest) / g.harvest) * s.harvest + (Math.min(calls, g.radio) / g.radio) * s.radio + (Math.min(ice, g.ice) / g.ice) * s.ice);
}

// The storm clock after it starts: warning (yellow), the particle storm (red), then calm.
export function stormLight(sinceStart, r) {
  if (sinceStart == null || sinceStart < 0) return 'green';
  if (sinceStart < r.storm.warnSeconds) return 'yellow';
  if (sinceStart < r.storm.warnSeconds + r.storm.stormSeconds) return 'red';
  return 'green';
}

// How strong the real flare was, roughly (X-class is the biggest). 1 = a big M flare.
export function flareStrength(cls) {
  const m = /^([MX])(\d+(\.\d+)?)/i.exec(cls ?? '');
  if (!m) return 1;
  const n = Number(m[2]);
  return m[1].toUpperCase() === 'X' ? Math.min(1.6, 1 + n / 15) : Math.max(0.7, n / 8);
}

export function starsFor({ progress, minOxygen }, r) {
  let stars = 1;
  if (progress >= r.stars.progressFor) stars++;
  if (minOxygen > r.stars.safeAbove) stars++;
  return stars;
}
