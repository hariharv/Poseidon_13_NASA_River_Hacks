// Stage 4 (Hera) rules as plain functions, so they can be tested without 3D.
// All the numbers come from core/rules.js (game.rules).

// Flare classes go A, B, C, M, X; each letter is about 10x stronger than the one before
// (NOAA). The game squeezes that into a playable 0.4-1.25 so an X flare hurts more than an M,
// without one storm being 100x deadlier than another.
const LETTER = { A: 0.4, B: 0.42, C: 0.45, M: 0.55, X: 0.85 };
export function flareStrength(flareClass) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)?/.exec(String(flareClass ?? '').toUpperCase());
  if (!m) return 0.85;
  const n = Math.min(10, Number(m[2] ?? 1));
  return clamp(LETTER[m[1]] + (n / 10) * (m[1] === 'X' ? 0.4 : 0.15), 0.4, 1.25);
}

// Seconds since the flash -> what the storm light shows.
// The flash (light) arrives first; the particles come later, then the storm passes.
export function stormClock(sinceFlash, { warnSeconds, stormSeconds }) {
  if (sinceFlash == null) return { phase: 'calm', light: 'green', secondsLeft: null, fill: 0 };
  if (sinceFlash < warnSeconds) {
    return { phase: 'warning', light: 'yellow', secondsLeft: warnSeconds - sinceFlash, fill: sinceFlash / warnSeconds };
  }
  const inStorm = sinceFlash - warnSeconds;
  if (inStorm < stormSeconds) {
    return { phase: 'storm', light: 'red', secondsLeft: stormSeconds - inStorm, fill: 1 - inStorm / stormSeconds };
  }
  return { phase: 'clear', light: 'green', secondsLeft: null, fill: 0 };
}

// How much of the storm still reaches you in the shelter (1 = all of it).
// Artemis I's measurements showed the shelter cuts the dose about four times, so a full shelter = 0.25.
export function shelterProtection(bagsPlaced, bagsNeeded) {
  const built = clamp(bagsPlaced / Math.max(1, bagsNeeded), 0, 1);
  return 1 - 0.75 * built;
}

// One step of oxygen. Reason feeds "the moment that made the difference" on Sim over.
export function oxygenStep({ light, where, bags, hose, strength = 1 }, dt, r) {
  const breathe = -r.breathePerSec * dt;
  if (light === 'red') {
    const reach = where === 'shelter' ? shelterProtection(bags, r.bags) : 1;
    const dose = -r.stormDosePerSec * strength * reach * dt;
    const stale = where === 'shelter' && !hose ? -r.noAirPerSec * dt : 0;
    // name the biggest cost
    if (stale < dose) return { delta: breathe + dose + stale, reason: 'no-air-hose' };
    return { delta: breathe + dose + stale, reason: 'storm' };
  }
  if (where === 'shelter' && !hose) return { delta: breathe - r.noAirPerSec * dt, reason: 'no-air-hose' };
  return { delta: breathe, reason: 'cabin-air' };
}

// Progress from flying: full speed in the ring, half speed close to it, nothing when way off.
export function flightStep(aimError, dt, r) {
  if (aimError <= r.aimRing) return r.flyPerSec * dt;
  if (aimError <= r.aimRing * 2) return (r.flyPerSec / 2) * dt;
  return 0;
}

// ---------- space junk ----------
// Old rocket parts and broken satellites race around Earth. A piece of junk flies at the ship
// from ahead; the ship goes where its nose points, so you dodge by steering the junk out of your path.

// How far away a piece of junk is, `age` seconds after it shows up on the radar (0 = it's here).
export function junkDistance(age, { startDistance, approachSeconds }) {
  return Math.max(0, startDistance * (1 - age / approachSeconds));
}

// Is the junk still on a collision course? (angle between it and the ship's nose, in radians)
export function onCollisionCourse(angle, { hitCone }) {
  return angle < hitCone;
}

// Time for the next piece of junk? Only in the junk field (part of the flight) and never more than a few at once.
export function junkDue({ sinceLast, progress, active }, junk) {
  return progress >= junk.fromProgress && progress <= junk.toProgress && active < junk.maxAtOnce && sinceLast >= junk.every;
}

// Oxygen lost through a hull leak until you seal it.
export function leakStep(leaking, dt, junk) {
  return leaking ? -junk.leakPerSec * dt : 0;
}

export function starsFor({ minOxygen, seconds }, r) {
  let stars = 1;
  if (minOxygen > r.stars.safeAbove) stars++;
  if (seconds < r.stars.speedySeconds) stars++;
  return stars;
}

// Real minutes between the flare and its particle storm (from the saved DONKI record).
export function minutesLater({ flareTime, particlesTime } = {}) {
  if (!flareTime || !particlesTime) return null;
  const ms = Date.parse(particlesTime) - Date.parse(flareTime);
  return Number.isFinite(ms) ? Math.round(ms / 60000) : null;
}

// "50 minutes", "about 4 hours", "almost 12 hours"
export function kidDuration(minutes) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 75) return '1 hour';
  const h = minutes / 60;
  const whole = Math.round(h);
  if (Math.abs(h - whole) <= 0.3) return `about ${whole} hours`;
  return h < whole ? `almost ${whole} hours` : `over ${Math.floor(h)} hours`;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
