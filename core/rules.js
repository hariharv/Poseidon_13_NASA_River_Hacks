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
    odysseus: {
      base: {
        startOxygen: 100,
        // Part 1: catch the floating tools
        tools: 6,
        heavySeconds: 7, // pull-up / pull-out: you feel about twice as heavy
        floatSeconds: 22, // weightless time per hill (NASA: about 22-25 s)
        heavyG: 1.8,
        breathePerSec: 0.5, // oxygen used just by breathing
        workPerSec: 2.2, // extra oxygen used while pushing yourself around
        airMachinePerSec: 0.9, // fresh air made while the air machine has a plug
        staleAirPerSec: 0.9, // extra oxygen lost while nothing is making fresh air
        thrust: 3.4, // how hard a push speeds you up (m/s²)
        maxSpeed: 3.6, // m/s
        walkSpeed: 2.6, // m/s in level flight
        grabRadius: 2.4, // metres from a tool to catch it
        toolSpeed: 0.85, // how fast tools drift away from the toolbox
        toolsShare: 60, // Progress from tools; the rest comes from the camera
        // Part 2: power trouble
        plugsLevel: 2, // plugs after the generator switches off
        startPlugged: ['air', 'lights', 'fridge', 'music'], // what's plugged in when it switches off
        plugsFlicker: 1, // plugs while the generator flickers
        flickerAt: 80, // Progress when the flicker starts (null = no flicker)
        flickerSeconds: 12,
        uploadPerSec: 0.9, // Progress per second for each camera plug
        lowOxygen: 35,
        veryLowOxygen: 18,
        stars: { safeAbove: 30, speedySeconds: 210 },
      },
      easy: {},
      hard: {
        tools: 8,
        breathePerSec: 0.65,
        workPerSec: 2.8,
        airMachinePerSec: 0.8,
        staleAirPerSec: 1.3,
        toolSpeed: 1.2,
        uploadPerSec: 0.75,
        stars: { speedySeconds: 260 },
      },
      demo: {
        startOxygen: 75,
        tools: 3,
        heavySeconds: 3.5,
        floatSeconds: 14,
        toolsShare: 60,
        uploadPerSec: 6,
        startPlugged: ['air', 'fridge', 'music'],
        flickerAt: null,
        stars: { speedySeconds: 60 },
      },
    },
    dioscuri: {
      base: {
        startOxygen: 100,
        // Part 1: move the science box with the robot arm
        armSpeed: 2.6, // metres per second the arm's hand moves
        grabRadius: 0.9, // metres from the box's handle to grab it
        placeRadius: 1.1, // metres from the platform slot to set it down
        grabShare: 15, // Progress for grabbing the box
        placeShare: 25, // Progress for setting it on the platform (the rest comes from the experiment)
        // Part 2: the experiment, through day and night
        daySeconds: 40, // sunlit side of Earth: the solar panels make lots of energy
        nightSeconds: 26, // Earth's shadow: only the batteries
        dayPlugs: 4,
        nightPlugs: 2,
        startPlugged: ['air', 'arm', 'lights'],
        sciencePerSec: 0.7, // Progress per second for each science plug
        breathePerSec: 0.5,
        airMachinePerSec: 0.9,
        staleAirPerSec: 0.9,
        lowOxygen: 35,
        veryLowOxygen: 18,
        stars: { safeAbove: 35, speedySeconds: 200 },
      },
      easy: {},
      hard: {
        armSpeed: 2.2,
        grabRadius: 0.7,
        placeRadius: 0.85,
        daySeconds: 32,
        nightSeconds: 30,
        sciencePerSec: 0.6,
        breathePerSec: 0.65,
        airMachinePerSec: 0.8,
        staleAirPerSec: 1.3,
        stars: { speedySeconds: 240 },
      },
      demo: {
        startOxygen: 75,
        armSpeed: 3.6,
        grabRadius: 1.2,
        placeRadius: 1.5,
        daySeconds: 9,
        nightSeconds: 12,
        sciencePerSec: 3.5,
        stars: { speedySeconds: 60 },
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
