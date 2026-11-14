// Finds "the one moment that made the difference" for the Sim over screen.

export const MOMENT_TEXT = {
  working: 'You kept working when your oxygen was low.',
  breathing: 'You were far from the air station when your oxygen got low.',
  storm: 'You stayed outside while the storm light was red.',
};

const DEFAULT_MOMENT = {
  reason: null,
  text: 'Your oxygen ran out. Keep an eye on the blue bar!',
};

export function pickMoment(log, { below = 30 } = {}) {
  const drains = log.filter((e) => e.delta < 0 && e.reason);
  if (drains.length === 0) return DEFAULT_MOMENT;

  const low = drains.filter((e) => e.before < below);
  const reason = biggest(low.length ? low : drains);
  return { reason, text: MOMENT_TEXT[reason] ?? reason };
}

function biggest(entries) {
  const totals = new Map();
  for (const e of entries) totals.set(e.reason, (totals.get(e.reason) ?? 0) - e.delta);
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
