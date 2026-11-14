// Dioscuri's numbers and robot-arm maths, without any 3D. Easy to test, easy to balance.
// The big idea: science is why we go to space, but it costs energy.

export const NO_AIR = 'The air machine had no plug, so nothing was making fresh air.';

// The power panel. Each machine takes 1 energy plug.
export const MACHINES = [
  { id: 'air', label: 'AIR MACHINE', sub: 'makes fresh air', kind: 'air' },
  { id: 'arm', label: 'ROBOT ARM', sub: 'moves the arm', kind: 'work' },
  { id: 'science', label: 'SCIENCE BOX', sub: 'grows the plants', kind: 'work' },
  { id: 'boost', label: 'SCIENCE BOOST', sub: 'grows them 2x faster', kind: 'work' },
  { id: 'lights', label: 'BIG LIGHTS', sub: 'extra', kind: 'extra' },
];

// Too many machines for the plugs = overload: nothing works until you unplug some.
export function powerState(plugged, plugs) {
  const used = plugged.size;
  const overloaded = used > plugs;
  const on = (id) => !overloaded && plugged.has(id);
  const science = on('science');
  return {
    used,
    free: Math.max(0, plugs - used),
    overloaded,
    airOn: on('air'),
    armOn: on('arm'),
    scienceOn: science,
    // the boost only helps while the science box itself has power
    scienceRate: science ? (on('boost') ? 2 : 1) : 0,
    lightsOn: on('lights'),
  };
}

export function canPlug(plugged, plugs) {
  return plugged.size < plugs;
}

// Breathing always costs a little; the air machine makes fresh air while it has a plug.
export function oxygenStep({ airOn }, dt, r) {
  const perSec = airOn ? r.airMachinePerSec - r.breathePerSec : -(r.breathePerSec + r.staleAirPerSec);
  const delta = perSec * dt;
  if (delta >= 0) return { delta, reason: 'refill' };
  return { delta, reason: NO_AIR };
}

export function scienceStep(power, dt, r) {
  return power.scienceRate * r.sciencePerSec * dt;
}

// Round and round the Earth: the sunlit side, then Earth's shadow, then sunlit again...
export function orbitPhase(t, r) {
  const loop = r.daySeconds + r.nightSeconds;
  const orbit = Math.floor(t / loop);
  const into = t - orbit * loop;
  if (into < r.daySeconds) return { side: 'day', orbit, left: r.daySeconds - into, k: into / r.daySeconds };
  const n = into - r.daySeconds;
  return { side: 'night', orbit, left: r.nightSeconds - n, k: n / r.nightSeconds };
}

// Solar panels make lots of energy in sunlight; in Earth's shadow only the batteries are left.
export function plugsFor(side, r) {
  return side === 'day' ? r.dayPlugs : r.nightPlugs;
}

// ---------- the robot arm ----------
// Two long booms (shoulder to elbow, elbow to wrist). The shoulder turns (yaw) and tips (pitch),
// the elbow bends. Given where the hand should go (relative to the shoulder), find the angles.
// Elbow-up, like the real arm reaching over the station.
export function solveArm({ x, y, z }, L1, L2) {
  const yaw = Math.atan2(x, -z); // 0 = straight out along -z
  const flat = Math.hypot(x, z);
  const reach = Math.hypot(flat, y);
  const d = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-4, reach));
  const cosElbow = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const elbow = Math.PI - Math.acos(clamp(cosElbow, -1, 1)); // 0 = straight
  const toTarget = Math.atan2(y, flat);
  const cosInner = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const shoulder = toTarget + Math.acos(clamp(cosInner, -1, 1)); // up from horizontal
  return { yaw, shoulder, elbow, reached: Math.abs(reach - d) < 1e-3 };
}

// Where the hand ends up for these angles (used to check solveArm, and to draw the arm).
export function armPoints({ yaw, shoulder, elbow }, L1, L2) {
  const dir = (pitch) => {
    const f = Math.cos(pitch);
    return { x: Math.sin(yaw) * f, y: Math.sin(pitch), z: -Math.cos(yaw) * f };
  };
  const a = dir(shoulder);
  const elbowPos = { x: a.x * L1, y: a.y * L1, z: a.z * L1 };
  const b = dir(shoulder - elbow);
  return { elbow: elbowPos, hand: { x: elbowPos.x + b.x * L2, y: elbowPos.y + b.y * L2, z: elbowPos.z + b.z * L2 } };
}

// Keep the hand target inside the arm's reach and above the station deck.
export function clampTarget(p, L1, L2, minY) {
  const out = { ...p, y: Math.max(minY, p.y) };
  const max = (L1 + L2) * 0.97;
  const min = Math.abs(L1 - L2) + 0.6;
  const len = Math.hypot(out.x, out.y, out.z);
  if (len > max) {
    const k = max / len;
    out.x *= k;
    out.y *= k;
    out.z *= k;
  } else if (len < min && len > 1e-6) {
    const k = min / len;
    out.x *= k;
    out.y *= k;
    out.z *= k;
  }
  out.y = Math.max(minY, out.y);
  return out;
}

export function starsFor({ minOxygen, seconds }, r) {
  let stars = 1;
  if (minOxygen > r.stars.safeAbove) stars++;
  if (seconds < r.stars.speedySeconds) stars++;
  return stars;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
