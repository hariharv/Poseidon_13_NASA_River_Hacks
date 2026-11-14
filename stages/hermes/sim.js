// Hermes's numbers, without any 3D. Easy to test, easy to balance.
// The big idea: working longer gets more done, but uses more oxygen.

export function oxygenStep({ working, refilling }, dt, r) {
  if (refilling) return { delta: r.refillPerSec * dt, reason: 'refill' };
  if (working) return { delta: -(r.breathePerSec + r.workPerSec) * dt, reason: 'working' };
  return { delta: -r.breathePerSec * dt, reason: 'breathing' };
}

// How much of one panel (0-1) this much working finishes.
export function workStep(working, dt, r) {
  return working ? dt / r.panelWorkSeconds : 0;
}

export function starsFor({ minOxygen, seconds }, r) {
  let stars = 1;
  if (minOxygen > r.stars.safeAbove) stars++;
  if (seconds < r.stars.speedySeconds) stars++;
  return stars;
}
