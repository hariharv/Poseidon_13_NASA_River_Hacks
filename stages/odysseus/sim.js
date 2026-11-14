// Odysseus's numbers, without any 3D. Easy to test, easy to balance.
// The big idea: when energy is low, keep the air machine on first.

// Sim over reasons. The engine uses an unknown reason as the sentence itself.
export const ZOOMING = 'You zoomed around a lot while your oxygen was low. One push and glide uses less air!';
export const NO_AIR = 'The air machine had no plug, so nothing was making fresh air.';

// The machines on the plane's power panel. Each one takes 1 energy plug.
export const MACHINES = [
  { id: 'air', label: 'AIR MACHINE', sub: 'makes fresh air', kind: 'air' },
  { id: 'camera', label: 'CAMERA', sub: 'sends science home', kind: 'work' },
  { id: 'boost', label: 'CAMERA BOOST', sub: 'sends it 2x faster', kind: 'work' },
  { id: 'lights', label: 'BIG LIGHTS', sub: 'extra', kind: 'extra' },
  { id: 'fridge', label: 'SNACK FRIDGE', sub: 'extra', kind: 'extra' },
  { id: 'music', label: 'MUSIC', sub: 'extra', kind: 'extra' },
];

// What happens with these machines plugged in and this many plugs.
// Too many machines for the plugs = overload: nothing works until you unplug some.
export function powerState(plugged, plugs) {
  const used = plugged.size;
  const overloaded = used > plugs;
  const on = (id) => !overloaded && plugged.has(id);
  const camera = on('camera');
  return {
    used,
    free: Math.max(0, plugs - used),
    overloaded,
    airOn: on('air'),
    cameraOn: camera,
    // the boost only helps if the camera itself is running
    workRate: camera ? (on('boost') ? 2 : 1) : 0,
    lightsOn: on('lights'),
  };
}

export function canPlug(plugged, plugs) {
  return plugged.size < plugs;
}

// Oxygen for one step. Breathing always costs a little; pushing yourself around costs more;
// the air machine makes fresh air, but only while it has a plug.
export function oxygenStep({ airOn, thrusting = false }, dt, r) {
  let perSec = -r.breathePerSec;
  if (thrusting) perSec -= r.workPerSec;
  if (airOn) perSec += r.airMachinePerSec;
  else perSec -= r.staleAirPerSec;
  const delta = perSec * dt;
  if (delta >= 0) return { delta, reason: 'refill' };
  if (!airOn) return { delta, reason: NO_AIR };
  return { delta, reason: thrusting ? ZOOMING : 'breathing' };
}

// Progress the camera sends home in one step.
export function uploadStep(power, dt, r) {
  return power.workRate * r.uploadPerSec * dt;
}

// Progress from tools caught (the first part of the bar).
export function toolProgress(caught, r) {
  return (Math.min(caught, r.tools) / r.tools) * r.toolsShare;
}

// The plane flies hills: heavy (pull up) -> float -> heavy (pull out + pull up) -> float ...
// Returns which part of the hill we're in at time t since the first climb.
export function flightPhase(t, r) {
  const cycle = r.heavySeconds + r.floatSeconds;
  const hill = Math.floor(t / cycle);
  const into = t - hill * cycle;
  if (into < r.heavySeconds) {
    return { phase: 'heavy', hill, left: r.heavySeconds - into, k: into / r.heavySeconds };
  }
  const f = into - r.heavySeconds;
  return { phase: 'float', hill, left: r.floatSeconds - f, k: f / r.floatSeconds };
}

// Nose angle (degrees) for the window view: up to 45° while heavy, over the top while floating.
export function planePitch({ phase, k }) {
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  return phase === 'heavy' ? -45 + 90 * ease(k) : 45 - 90 * ease(k);
}

export function starsFor({ minOxygen, seconds }, r) {
  let stars = 1;
  if (minOxygen > r.stars.safeAbove) stars++;
  if (seconds < r.stars.speedySeconds) stars++;
  return stars;
}
