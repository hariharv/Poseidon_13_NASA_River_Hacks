// Every balancing number lives here, so tuning never means editing a stage.
// Each stage has `base` numbers plus optional `easy`, `hard` and `demo` overrides.
// Stages read them through `game.rules` (already merged for the current mode).

export const RULES = {
  modes: {
    easy: { label: 'Easy', ages: 'Ages 7-9', hints: 'more' },
    hard: { label: 'Hard', ages: 'Ages 10-12', hints: 'fewer', realNumbers: true },
    demo: { label: 'Judge Demo', ages: '2-3 minutes', hints: 'more' },
  },

  // Energy plugs (used from Stage 2 on).
  plugs: { day: 4, night: 2 },

  stages: {
    hermes: {
      base: {
        startOxygen: 100,
        panels: 3,
        panelWorkSeconds: 16, // seconds of holding "fix" per panel
        breathePerSec: 0.45, // oxygen used just by breathing
        workPerSec: 1.8, // extra oxygen used while working hard
        refillPerSec: 12, // oxygen gained at the air station
        refillRadius: 2.6, // metres from the air station to refill
        fixRadius: 3.6, // metres from a panel to work on it
        swimSpeed: 4.5, // metres per second
        lowOxygen: 35, // Buoy warns
        veryLowOxygen: 18, // Buoy warns louder
        stars: { safeAbove: 20, speedySeconds: 150 },
      },
      easy: {},
      hard: {
        panelWorkSeconds: 20,
        breathePerSec: 0.7,
        workPerSec: 2.2,
        refillPerSec: 9,
        swimSpeed: 4,
        stars: { speedySeconds: 180 },
      },
      demo: {
        startOxygen: 60,
        panels: 1,
        panelWorkSeconds: 7,
        breathePerSec: 0.6,
        workPerSec: 3.5,
        refillPerSec: 18,
        stars: { speedySeconds: 40 },
      },
    },
  },
};

export function rulesFor(stageId, mode = 'easy') {
  const stage = RULES.stages[stageId];
  if (!stage) return {};
  return deepMerge(structuredClone(stage.base), stage[mode] ?? {});
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      deepMerge(target[key], value);
    } else {
      target[key] = structuredClone(value);
    }
  }
  return target;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
