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
        flowGrid: 5, // the power-line puzzle: a 5 x 5 grid with 4 pairs of dots
        flowSeconds: 30,
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
        flowGrid: 6,
        flowSeconds: 35,
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
        flowSeconds: 35,
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
        blobs: 5, // water blobs from the burst juice pouch (catch them before the hill ends)
        blobPenalty: 3, // oxygen lost for each blob that splats on the walls
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
        blobs: 7,
        blobPenalty: 4,
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
        blobs: 3,
        flickerAt: null,
        stars: { speedySeconds: 60 },
      },
    },
    dioscuri: {
      base: {
        startOxygen: 85,
        // Part 1: float to the arm controls, move each science box to its own coloured slot
        boxes: 3,
        armSpeed: 2.6, // metres per second the arm's hand moves
        grabRadius: 0.9, // metres from a box's handle to grab it
        placeRadius: 0.9, // metres from its slot to set it down
        grabShare: 3, // Progress for grabbing a box
        placeShare: 7, // Progress for setting it in its slot (the rest comes from the experiments)
        floatSpeed: 2.2, // floating around inside the lab (m/s)
        // Space junk: park the arm in the yellow ring before the countdown ends
        debris: 1, // alerts per stage
        debrisSeconds: 12,
        debrisDamage: 12, // oxygen lost if it hits the arm
        stowRadius: 1.0,
        // Part 2: start each experiment at the science bench (a timed puzzle), then keep it powered
        puzzleSeconds: 16,
        puzzleSizes: { plants: 3, crystals: 4, blobs: 3 },
        experimentPerSec: 0.55, // Progress per second for each experiment that has a plug
        daySeconds: 45, // sunlit side of Earth: the solar panels make lots of energy
        nightSeconds: 30, // Earth's shadow: only the batteries
        dayPlugs: 4,
        nightPlugs: 2,
        startPlugged: ['air', 'arm', 'lights'],
        breathePerSec: 0.5,
        airMachinePerSec: 0.9,
        staleAirPerSec: 1.3, // costs more than in Odysseus: each stage bites a bit harder
        lowOxygen: 35,
        veryLowOxygen: 18,
        stars: { safeAbove: 35, speedySeconds: 300 },
      },
      easy: {},
      hard: {
        startOxygen: 80,
        armSpeed: 2.2,
        grabRadius: 0.7,
        placeRadius: 0.7,
        debris: 2,
        debrisSeconds: 9,
        debrisDamage: 16,
        stowRadius: 0.8,
        puzzleSeconds: 11,
        puzzleSizes: { plants: 4, crystals: 5, blobs: 4 },
        experimentPerSec: 0.45,
        daySeconds: 38,
        nightSeconds: 32,
        breathePerSec: 0.65,
        airMachinePerSec: 0.8,
        stars: { speedySeconds: 360 },
      },
      demo: {
        startOxygen: 75,
        boxes: 1,
        armSpeed: 3.6,
        grabRadius: 1.2,
        placeRadius: 1.3,
        grabShare: 10,
        placeShare: 20,
        floatSpeed: 3,
        debris: 0,
        puzzleSeconds: 18,
        puzzleSizes: { plants: 3, crystals: 3, blobs: 2 },
        experimentPerSec: 5,
        daySeconds: 12,
        nightSeconds: 12,
        stars: { speedySeconds: 75 },
      },
    },
    hera: {
      base: {
        startOxygen: 80, // each stage starts with a little less air than the one before
        // Flying: keep the target in the ring to line up the course-correction burns
        flyPerSec: 1.0, // Progress per second while the target is inside the ring (and the engine fires)
        burnBoost: 1.3, // the engine only fires while you hold Space, so each second of burn counts for more
        burnShake: 0.16, // firing the engine shakes the ship off target a little
        faultPuzzleSeconds: 14, // time to type the JET RESET code
        faultCode: 4, // lights in the code
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
        // Space junk: pieces fly at the ship; steer so they're out of your path when they arrive
        junk: {
          fromProgress: 6, // the junk field starts a little way into the flight...
          toProgress: 94, // ...and ends just before the burn is done
          every: 7, // seconds between pieces
          maxAtOnce: 1,
          approachSeconds: 6, // from first seen on the radar to arriving
          startDistance: 70, // metres away when first seen
          hitCone: 0.13, // radians: closer to your nose than this when it arrives = it hits you
          hitOxygen: 6, // oxygen lost when junk hits
          leakPerSec: 0.8, // oxygen lost per second through the hole until you seal it
          fixSeconds: 25, // time to reroute the cut air lines
          fixGrid: 4, // the repair puzzle is a 4 x 4 grid
        },
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
        burnShake: 0.22,
        faultPuzzleSeconds: 10,
        faultCode: 5,
        junk: { every: 4.5, maxAtOnce: 2, approachSeconds: 4.5, hitCone: 0.15, hitOxygen: 9, leakPerSec: 1.2, fixSeconds: 22, fixGrid: 5 },
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
        junk: { fromProgress: 4, every: 5, approachSeconds: 5.5, fixSeconds: 30 },
        stars: { speedySeconds: 75 },
      },
    },
    apollo: {
      base: {
        startOxygen: 80,
        // Time: 14 Moon-days. The Sun is up for the first 7, then the long, dark lunar night.
        days: 14,
        dayLength: 15, // seconds per Moon-day in the game
        nightFrom: 8, // days 8 to 14 are night
        dayPlugs: 4, // solar panels in sunlight
        nightPlugs: 2, // only the batteries in the dark
        startPlugged: ['air', 'grow', 'lights'],
        // Air: the air machine splits water into oxygen, but only with a plug AND water in the tank
        breathePerSec: 0.5,
        airMachinePerSec: 0.95,
        staleAirPerSec: 0.9, // extra loss when nothing is making fresh air
        coldPerSec: 0.9, // extra loss at night with no heater (you shiver and breathe harder)
        plantAirPerSec: 0.07, // each growing plant tray adds a little oxygen
        suitPerSec: 0.7, // outside on a moonwalk your suit air runs down faster
        waterStart: 4,
        waterMax: 8,
        waterPerDay: 1, // the air machine uses this much water each Moon-day
        icePerChunk: 2, // water from each chunk of ice you dig up
        iceChunks: 6,
        // Food: plants grow under the grow lights (and need the heater at night)
        trays: 3,
        growDays: 2.5, // Moon-days for a plant to be ready
        firstTray: 0.8, // one tray starts nearly ready, so you can harvest straight away
        // A real solar storm (NASA DONKI), sometime in the middle of the mission
        storm: { fromDay: 5, toDay: 10, warnSeconds: 9, stormSeconds: 16, insidePerSec: 0.7, outsidePerSec: 3.5, shelterPerSec: 0.05, maxRedOutside: 7 },
        // Progress: surviving the days, plus the mission jobs
        shares: { days: 50, harvest: 20, radio: 15, ice: 15 },
        goals: { harvest: 3, radio: 3, ice: 3 },
        radioDelay: 1.3, // seconds for a radio message to cross from the Moon to Earth (each way)
        puzzleSeconds: 14,
        walkSpeed: 3.2,
        jumpSpeed: 2.8, // a little hop goes a long way in Moon gravity
        gravity: 1.62, // m/s², one-sixth of Earth's
        lowOxygen: 35,
        veryLowOxygen: 18,
        stars: { safeAbove: 30, progressFor: 80 },
      },
      easy: {},
      hard: {
        startOxygen: 75,
        dayLength: 14,
        waterStart: 3,
        breathePerSec: 0.62,
        coldPerSec: 1.1,
        suitPerSec: 0.95,
        storm: { warnSeconds: 6, outsidePerSec: 4.5, insidePerSec: 0.9, maxRedOutside: 5 },
        goals: { harvest: 4, radio: 4, ice: 4 },
        puzzleSeconds: 10,
      },
      demo: {
        startOxygen: 75,
        days: 5,
        dayLength: 9,
        nightFrom: 4,
        waterStart: 2,
        growDays: 0.8,
        firstTray: 0.9,
        storm: { fromDay: 2, toDay: 2, warnSeconds: 5, stormSeconds: 8 },
        goals: { harvest: 1, radio: 1, ice: 1 },
        puzzleSeconds: 16,
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
