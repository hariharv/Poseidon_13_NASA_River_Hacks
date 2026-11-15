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
        panelWorkSeconds: 16, // about how long fixing a panel takes (sim tests)
        puzzleSeconds: 16, // time to connect the wires on a broken panel
        puzzleWires: 3,
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
        puzzleSeconds: 12,
        puzzleWires: 4,
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
        puzzleSeconds: 18,
        breathePerSec: 0.6,
        workPerSec: 3.5,
        refillPerSec: 18,
        stars: { speedySeconds: 40 },
      },
    },
    odysseus: {
      base: {
        startOxygen: 90, // each stage starts with a little less air than the one before
        // Part 1: catch the floating tools
        tools: 6,
        heavySeconds: 7, // pull-up / pull-out: you feel about twice as heavy
        floatSeconds: 22, // weightless time per hill (NASA: about 22-25 s)
        heavyG: 1.8,
        breathePerSec: 0.5, // oxygen used just by breathing
        workPerSec: 2.5, // extra oxygen used while pushing yourself around
        airMachinePerSec: 0.9, // fresh air made while the air machine has a plug
        staleAirPerSec: 1.1, // extra oxygen lost while nothing is making fresh air
        thrust: 3.4, // how hard a push speeds you up (m/s²)
        maskRefillPerSec: 9, // oxygen from the masks (they get their air from the air machine)
        maskRadius: 1.25, // metres from the masks to breathe from them
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
        maskRefillPerSec: 6,
        breathePerSec: 0.65,
        workPerSec: 2.8,
        airMachinePerSec: 0.8,
        startOxygen: 85,
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
        startOxygen: 85,
        // Part 1: move the science box with the robot arm
        armSpeed: 2.6, // metres per second the arm's hand moves
        grabRadius: 0.9, // metres from the box's handle to grab it
        placeRadius: 1.1, // metres from the platform slot to set it down
        grabShare: 15, // Progress for grabbing the box
        placeShare: 25, // Progress for setting it on the platform (the rest comes from the experiment)
        // Part 2: the experiment, through day and night
        daySeconds: 40, // sunlit side of Earth: the solar panels make lots of energy
        nightSeconds: 30, // Earth's shadow: only the batteries
        dayPlugs: 4,
        nightPlugs: 2,
        startPlugged: ['air', 'arm', 'lights'],
        sciencePerSec: 0.7, // Progress per second for each science plug
        breathePerSec: 0.5,
        airMachinePerSec: 0.9,
        staleAirPerSec: 1.3, // costs more than in Odysseus: each stage bites a bit harder
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
        startOxygen: 80,
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
    hera: {
      base: {
        startOxygen: 80, // each stage starts with a little less air than the one before
        // Flying: keep the target in the ring to line up the course-correction burns
        flyPerSec: 1.0, // Progress per second while the target is inside the ring
        aimRing: 0.07, // radians: how close counts as "in the ring"
        turnRate: 0.55, // radians per second the ship turns while you hold a key
        drift: 0.05, // how hard the ship wanders off course on its own
        // The real storm (a flare from NASA DONKI): flash first, particles later
        stormAtProgress: 30, // Progress when the flare goes off
        warnSeconds: 24, // time between the flash and the particles (sped up: the real gap was minutes to hours)
        stormSeconds: 28, // how long the particle storm lasts (sped up)
        stormDosePerSec: 1.4, // oxygen lost per second in the red storm, outside the shelter (x flare strength)
        bags: 3, // stowage bags that make the shelter
        noAirPerSec: 0.9, // extra oxygen lost in the shelter with no air hose
        breathePerSec: 0.16, // the cabin air slowly runs down
        // Sim supervisor faults (the trainers throw problems at you)
        faults: [60], // Progress when a thruster gets stuck
        faultSpin: 0.22, // radians per second a stuck thruster turns the ship
        lowOxygen: 35,
        veryLowOxygen: 18,
        stars: { safeAbove: 40, speedySeconds: 230 },
      },
      easy: {},
      hard: {
        startOxygen: 75,
        flyPerSec: 0.85,
        aimRing: 0.055,
        drift: 0.08,
        warnSeconds: 15,
        stormSeconds: 34,
        stormDosePerSec: 2.0,
        bags: 4,
        noAirPerSec: 1.3,
        breathePerSec: 0.26,
        faults: [20, 55, 80],
        faultSpin: 0.3,
        stars: { safeAbove: 45, speedySeconds: 260 },
      },
      demo: {
        startOxygen: 75,
        flyPerSec: 4,
        aimRing: 0.09,
        drift: 0.03,
        stormAtProgress: 35,
        warnSeconds: 10,
        stormSeconds: 10,
        stormDosePerSec: 2.2,
        bags: 2,
        faults: [],
        stars: { speedySeconds: 75 },
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
