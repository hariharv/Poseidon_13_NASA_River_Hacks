// Stage 1: Hermes · Astronaut Trainee
// Where: a copy of NASA's Neutral Buoyancy Laboratory (a 40-foot-deep pool with a pretend space station).
// Job: float in my suit and fix 3 panels before my oxygen runs low.
// Big idea: working longer gets more done, but uses more oxygen.

import * as THREE from 'three';
import { buildWorld, disposeTree, AIR_STATION, SPAWN } from './world.js';
import { createPlayer } from './player.js';
import { createArms } from './arms.js';
import { createBubbles } from './bubbles.js';
import { oxygenStep, starsFor } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const NBL_FACTS = 'https://www.nasa.gov/wp-content/uploads/2017/06/167748main_fs_nbl508c.pdf';
const TRAINING_FACTS = 'https://www.nasa.gov/wp-content/uploads/2015/10/160410main_space_training_fact_sheet.pdf';

const hard = rulesFor('hermes', 'hard');
const REAL_NUMBERS = [
  { label: 'Size of the real pool', value: '202 × 102 × 40 ft (62 × 31 × 12 m)', source: 'NASA Neutral Buoyancy Lab fact sheet', url: NBL_FACTS },
  { label: 'Water in the pool', value: '6.2 million gallons', source: 'NASA Neutral Buoyancy Lab fact sheet', url: NBL_FACTS },
  { label: 'Pool practice for each hour of a real spacewalk', value: 'about 10 hours', source: 'NASA space training fact sheet', url: TRAINING_FACTS },
  { label: 'In this sim: oxygen used per second just floating', value: `${hard.breathePerSec}`, source: 'Game rules (Hard mode)' },
  {
    label: 'In this sim: oxygen used per second while working',
    value: `${(hard.breathePerSec + hard.workPerSec).toFixed(1)} (${((hard.breathePerSec + hard.workPerSec) / hard.breathePerSec).toFixed(1)}× more)`,
    source: 'Game rules (Hard mode)',
  },
];

// Each panel has a different repair puzzle, so every one feels new.
const PANEL_PUZZLES = [
  { kind: 'wires', title: 'connect the power wires', text: 'Match each wire to the plug with the *same colour and shape*.' },
  { kind: 'sequence', title: 'type the panel code', text: 'Watch the lights, then press them *in the same order*.' },
  { kind: 'timing', title: 'tighten the bolts', text: 'Stop the wrench in the *green zone*.' },
];

const CONTROLS = [
  { label: 'Swim', value: 'W A S D or the arrow keys' },
  { label: 'Look around', value: 'Move the mouse (or ← →)' },
  { label: 'Float up / sink down', value: 'Space / Shift' },
  { label: 'Fix a panel', value: 'Press E, then match the wires before time runs out' },
];

export default {
  id: 'hermes',
  name: 'Hermes',
  rank: 'Astronaut Trainee',
  realNumbers: REAL_NUMBERS,
  start(game) {
    return run(game, { demo: false });
  },
  demo(game) {
    return run(game, { demo: true });
  },
};

function run(game, { demo }) {
  const r = game.rules;
  const easy = game.mode !== 'hard';
  const world = buildWorld({ hints: easy ? 'more' : 'fewer', panelCount: r.panels });

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.autoClear = false;
  renderer.domElement.setAttribute('aria-label', 'Underwater training pool');
  game.root.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 140);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const arms = createArms(game.player.suit);
  const bubbles = createBubbles(world.scene);

  // ---------- state ----------
  let phase = 'briefing'; // briefing -> play -> done
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let minOxygen = game.oxygen.value;
  let fixedCount = 0;
  let lastProgressAt = 0;
  let nextBreath = 1.5;
  let nextHubBubble = 0;
  let nextDiverBubble = 2;
  let promptText = null;
  let workingNow = false;
  let fixing = null; // the panel whose puzzle is open
  let introT = 0;
  let diveDone = null; // resolves when the dive-in has finished
  let leaking = false; // the surprise air-hose leak (after the first panel)
  let leakFixing = false;
  let nextLeakBubble = 0;
  let patchesFound = 0;
  let fixHeld = false;
  let wasLow = false;
  // sounds: the pool's water all around you, and the drill while you work
  const drill = game.sound.loop('drill', 0);
  game.sound.loop('water', 1);
  const timers = new Set();
  const said = new Set();
  const once = (key, text) => {
    if (said.has(key)) return false;
    said.add(key);
    game.ui.buoy(text);
    return true;
  };
  const later = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (game.running) fn();
    }, ms);
    timers.add(id);
  };

  const player = createPlayer({
    camera,
    dom: renderer.domElement,
    colliders: world.colliders,
    spawn: SPAWN,
    swimSpeed: r.swimSpeed,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (phase === 'play' && game.running && !player.dragMode && !game.ui.puzzleOpen) setPaused(true);
    },
    onPointerError(dragMode) {
      if (dragMode && paused) setPaused(false);
    },
  });
  player.setEnabled(false);

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    game.ui.pause(on, resume);
    player.setEnabled(!on && phase === 'play');
  }
  function resume() {
    if (player.dragMode) setPaused(false);
    else player.requestLock(); // unpauses when the lock comes back
  }
  const onKey = (e) => {
    if (phase !== 'play' || !game.running) return;
    if (e.code === 'KeyP' || (e.code === 'Escape' && player.dragMode)) {
      if (paused) resume();
      else {
        setPaused(true);
        player.exitLock();
      }
    }
  };
  window.addEventListener('keydown', onKey);
  const onHidden = () => {
    if (document.hidden && phase === 'play') {
      setPaused(true);
      player.exitLock();
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  // ---------- briefing ----------
  (async () => {
    await game.ui.card({
      eyebrow: demo ? 'Judge Demo · Stage 1 · Hermes' : 'Stage 1 of 6 · Hermes',
      title: 'The giant training pool',
      text: demo
        ? ['A copy of NASA\'s spacewalk training pool. *Fix 1 broken panel.* Your oxygen starts at 60.']
        : [
            "You're 40 feet underwater in NASA's training pool. There's a pretend space station down here!",
            'Your job: *fix 3 broken panels* before your oxygen runs low. Each one has a wire puzzle, and the clock is ticking!',
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: 'Dive in' }],
    });
    if (!game.running) return;
    // dive in: splash at the surface, sink down to the station, then 3-2-1-GO!
    phase = 'intro';
    player.position.y = 11.3;
    bubbles.emit(camera.position.clone(), 40, 1.6);
    game.sound.play('whoosh');
    await new Promise((resolve) => (diveDone = resolve));
    if (!game.running) return;
    await game.ui.countdown();
    if (!game.running) return;
    phase = 'play';
    player.setEnabled(true);
    player.requestLock();
    updateTask();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');

    if (demo) {
      game.ui.buoy('The blue bar is *oxygen*: the air your body needs. Swim to the red light and fix the panel!');
      game.demo.check('plain-language');
    } else {
      game.ui.buoy(
        "Your suit has weights, so you don't float up or sink down. That's called *neutral buoyancy*, and it feels a bit like space!",
      );
      game.ui.buoy('See the blue bar? That is your *oxygen*: the air your body needs. You use a little every time you breathe.');
      game.ui.buoy('Need more air? Swim into the bubble at the *blue air station* on your right.');
      game.demo.check('plain-language');
    }
  })();

  // ---------- helpers ----------
  const toPanel = new THREE.Vector3();
  const fromPanel = new THREE.Vector3();
  function findTarget() {
    const fwd = player.forward();
    let best = null;
    let bestD = Infinity;
    for (const p of world.panels) {
      if (p.fixed) continue;
      toPanel.subVectors(p.position, camera.position);
      const d = toPanel.length();
      if (d > r.fixRadius) continue;
      const facing = fwd.dot(toPanel.normalize()) > 0.45;
      const inFront = fromPanel.subVectors(camera.position, p.position).dot(p.normal) > 0;
      if (facing && inFront && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  function nearestUnfixed() {
    let best = Infinity;
    for (const p of world.panels) if (!p.fixed) best = Math.min(best, p.position.distanceTo(camera.position));
    return best;
  }

  // Why can't I fix it yet? Tell kids the one thing to change.
  function panelHint() {
    const d = nearestUnfixed();
    if (d < r.fixRadius) return 'Look right at the panel';
    if (d < r.fixRadius + 3) return 'Swim a little closer to the panel';
    return null;
  }

  function setPrompt(text) {
    if (text === promptText) return;
    promptText = text;
    game.ui.prompt(text);
  }

  function onPanelFixed() {
    fixedCount++;
    const left = world.panels.length - fixedCount;
    if (left > 0) {
      game.ui.cheer({ title: 'PANEL FIXED!', sub: left === 1 ? 'one more to go' : `${left} to go` });
      game.ui.buoy(left === 1 ? 'Panel fixed! *One more to go.*' : `Panel fixed! *${left} to go.*`);
      if (fixedCount === 1 && !demo) later(6000, startLeak);
      if (fixedCount === 1 && easy) {
        later(4200, () => game.ui.buoy('Did you see the blue bar drop while you worked? *More progress means less oxygen.*'));
      }
      return;
    }
    complete();
  }

  function complete() {
    phase = 'done';
    game.ui.cheer({ title: world.panels.length > 1 ? 'ALL PANELS FIXED!' : 'PANEL FIXED!', sub: patches.length > 1 ? `golden patches: ${patchesFound} of ${patches.length}` : '', big: true });
    setPrompt(null);
    game.ui.target(false);
    player.setEnabled(false);
    game.ui.buoy(
      demo
        ? 'Fixed! See how the blue bar dropped while you worked? *More progress means less oxygen.*'
        : 'All 3 panels fixed! Real astronauts practise like this for about *10 hours* for every 1 hour of a real spacewalk.',
      { interrupt: true },
    );
    later(4200, () => {
      player.exitLock();
      game.finish({ stars: starsFor({ minOxygen, seconds: elapsed }, r), passed: true });
      game.web?.window('nbl');
    });
  }

  // ---------- fixing a panel: a wire puzzle against the clock ----------
  function startFix(panel) {
    fixing = panel;
    player.setEnabled(false);
    if (once('first-work', 'Working hard makes you breathe faster. *Suits only carry so much air!*')) {
      game.demo.check('every-choice-costs');
    }
    game.ui
      .puzzle({
        kind: PANEL_PUZZLES[panel.index % PANEL_PUZZLES.length].kind,
        title: `Panel ${panel.index + 1}: ${PANEL_PUZZLES[panel.index % PANEL_PUZZLES.length].title}`,
        text: `${PANEL_PUZZLES[panel.index % PANEL_PUZZLES.length].text} Your oxygen drops faster while you work!`,
        seconds: r.puzzleSeconds,
        size: PANEL_PUZZLES[panel.index % PANEL_PUZZLES.length].kind === 'wires' ? r.puzzleWires : PANEL_PUZZLES[panel.index % PANEL_PUZZLES.length].kind === 'sequence' ? r.puzzleWires + 1 : easy ? 3 : 4,
      })
      .then((ok) => {
        fixing = null;
        if (!game.running) return;
        player.setEnabled(true);
        player.requestLock();
        if (ok) {
          panel.setWork(1);
          panel.markFixed(t);
          game.progress.change(((fixedCount + 1) / world.panels.length) * 100 - game.progress.value);
          onPanelFixed();
          updateTask();
        } else {
          game.ui.buoy('Sparks! The clock ran out. *Press E* to try that panel again.', { interrupt: true });
        }
      });
  }

  // ---------- the Task chip and Help ----------
  const PANEL_WHERE = ['on the side of the big white module', 'on top of the long metal beam (swim up!)', 'round the back of the station'];
  function updateTask() {
    const next = world.panels.find((p) => !p.fixed);
    const low = game.oxygen.value < r.lowOxygen;
    game.ui.task({
      now: !next
        ? 'All panels fixed!'
        : leaking
          ? 'Clamp the leaking air hose (follow the bubbles at the air station)'
          : low
            ? 'Refill your air at the blue air station'
            : `Fix panel ${next.index + 1}: ${PANEL_WHERE[next.index]}`,
      steps: [
        ...world.panels.map((p) => ({ text: `Fix panel ${p.index + 1} (${PANEL_WHERE[p.index]})`, done: p.fixed, now: p === next && !low && !leaking })),
        { text: 'Low on air? Swim into the bubble at the blue air station', now: low && !leaking },
        ...(leaking ? [{ text: 'Clamp the leaking air hose (bubbles under the air station)', now: true }] : []),
        { text: `Bonus: find the golden patches (${patchesFound} of ${patches.length})`, done: patchesFound >= patches.length },
      ],
      tips: [
        'Follow the *red light beams* to find the broken panels.',
        'Get close, look right at the panel and *press E*. Then match the wires before the timer runs out.',
        'The *blue beam* shows the way back to the air station.',
        'Golden patches are hidden around the station: one up high, one down low, one round the back. Swim through them!',
      ],
    });
  }

  // ---------- golden patches: hidden bonus collectibles ----------
  const PATCH_FACTS = [
    'The real pool holds *6.2 million gallons* of water. That fills about 9 Olympic pools!',
    'Astronauts practise about *10 hours* in the pool for every *1 hour* of a real spacewalk.',
    'The water is kept warm, about *85°F*, so divers and astronauts stay comfy.',
  ];
  const patchSpots = demo ? [[0, 5.3, 7]] : [[13, 10.6, 1.2], [-9, 1.6, 2.6], [6, 6.2, -10.6]];
  const patches = patchSpots.map((p) => buildPatch(world.scene, new THREE.Vector3(...p)));
  function collectPatches() {
    for (const pt of patches) {
      if (pt.found || pt.position.distanceTo(camera.position) > 1.4) continue;
      pt.collect();
      patchesFound++;
      game.ui.cheer({ title: 'GOLDEN PATCH!', sub: `${patchesFound} of ${patches.length} found` });
      game.ui.buoy(PATCH_FACTS[(patchesFound - 1) % PATCH_FACTS.length], { interrupt: true });
      updateTask();
    }
  }

  // ---------- the surprise: the air hose springs a leak ----------
  const LEAK = AIR_STATION.clone().add(new THREE.Vector3(0.9, -1.3, -1.1));
  function startLeak() {
    if (leaking || phase !== 'play') return;
    leaking = true;
    game.sound.play('hiss');
    game.ui.buoy("*Uh oh!* The air hose sprang a *leak*! The air station won't give you air until you clamp it. Follow the stream of bubbles!", { interrupt: true });
    updateTask();
  }
  function fixLeak() {
    leakFixing = true;
    player.setEnabled(false);
    game.ui.puzzle({ kind: 'timing', title: 'Clamp the leak', text: 'Stop the clamp in the *green zone*, three times!', seconds: r.puzzleSeconds, size: 3 }).then((ok) => {
      leakFixing = false;
      if (!game.running) return;
      player.setEnabled(true);
      player.requestLock();
      if (ok) {
        leaking = false;
        game.ui.cheer({ title: 'LEAK SEALED!', sub: 'the air station works again' });
        game.ui.buoy('Nice work! Real astronauts practise fixing broken gear in the pool, too.');
        updateTask();
      } else game.ui.buoy('Still leaking! Look at the bubbles and *press E* to try again.', { interrupt: true });
    });
  }

  // ---------- one step of play ----------
  const breathAt = new THREE.Vector3();
  function step(dt) {
    const atStation = camera.position.distanceTo(AIR_STATION) < r.refillRadius;
    const inZone = atStation && !leaking; // a leaking hose gives no air
    const target = fixing ?? (atStation ? null : findTarget());
    const pressed = player.wantsFix && !fixHeld;
    fixHeld = player.wantsFix;
    const atLeak = leaking && !leakFixing && camera.position.distanceTo(LEAK) < 2.6 && player.forward().dot(toPanel.subVectors(LEAK, camera.position).normalize()) > 0.55;
    if (atLeak && pressed && !game.ui.puzzleOpen) fixLeak();
    else if (target && pressed && !fixing && !game.ui.puzzleOpen) startFix(target);
    const working = Boolean(fixing); // the wire puzzle is open: hard work, fast breathing
    workingNow = working;
    drill.set(working ? 1 : 0);
    // in the bubble you don't use air; once it's full it just stays full (no flicker)
    const refilling = inZone && game.oxygen.value < 99.95;
    world.air.state.active = inZone;
    world.air.state.low = game.oxygen.value < r.lowOxygen;

    player.update(dt, t, { anchored: working });

    const o = inZone && !refilling ? { delta: 0, reason: 'refill' } : oxygenStep({ working, refilling }, dt, r);
    game.oxygen.change(o.delta, o.reason);
    if (!game.running) return; // Sim over: the engine takes it from here

    elapsed += dt;
    minOxygen = Math.min(minOxygen, game.oxygen.value);

    if (working) lastProgressAt = t;
    const lowNow = game.oxygen.value < r.lowOxygen;
    if (lowNow !== wasLow) {
      wasLow = lowNow;
      updateTask();
    }

    // your breath makes bubbles: more when you work, none while refilling
    if (!refilling && t >= nextBreath) {
      breathAt.copy(camera.position).addScaledVector(player.forward(), 0.9);
      breathAt.y -= 0.35;
      bubbles.emit(breathAt, working ? 8 : 4, 0.5);
      nextBreath = t + (working ? 0.9 : 2.6);
    }
    if (inZone && t >= nextHubBubble) {
      bubbles.emit(new THREE.Vector3(AIR_STATION.x, AIR_STATION.y + 0.35, AIR_STATION.z), 3, 0.6);
      nextHubBubble = t + 0.25;
    }

    // ---------- Buoy and the visor prompt ----------
    const o2 = game.oxygen.value;
    if (o2 > 80) {
      said.delete('low');
      said.delete('very-low');
    }
    if (!inZone && o2 < r.veryLowOxygen) {
      if (!said.has('very-low')) {
        said.add('very-low');
        game.ui.buoy(easy ? 'Oxygen *very low*! Swim to the blue air station *right now*!' : 'Oxygen very low!', { interrupt: true });
      }
    } else if (!inZone && o2 < r.lowOxygen) {
      once('low', easy ? 'Your air is getting low! Follow the *blue beam* back to the air station.' : 'Oxygen low. Plan your way back.');
    }
    if (refilling) once('refill', '*Refilling takes time.* Real astronauts plan their air before every job.');
    if (!demo && !said.has('near-panel') && nearestUnfixed() < 7) {
      once('near-panel', 'A broken panel! Look right at it and *press E*. Then match the wires, fast!');
    }
    if (easy && !demo && t - lastProgressAt > 30 && !inZone && fixedCount < world.panels.length) {
      if (once('idle-hint', 'Follow the *red light beams* to find the broken panels. One is up high, one is round the back!')) {
        lastProgressAt = t;
      }
    }

    collectPatches();
    if (leaking && t >= nextLeakBubble) {
      bubbles.emit(LEAK, 10, 0.25);
      nextLeakBubble = t + 0.12;
    }
    game.ui.clock(elapsed, r.stars.speedySeconds);
    game.ui.target((Boolean(target) && !fixing) || atLeak);
    if (fixing || leakFixing) setPrompt(null);
    else if (atLeak) setPrompt('Press [E] to clamp the leak');
    else if (atStation && leaking) setPrompt('The hose is leaking! Fix the leak first (bubbles below)');
    else if (inZone) setPrompt(refilling ? 'Refilling air… stay in the bubble' : 'Air full! Go fix a panel');
    else if (target) setPrompt(`Press [E] to open panel ${target.index + 1}`);
    else if (easy) setPrompt(panelHint());
    else setPrompt(null);
  }

  // ---------- main loop ----------
  let disposed = false; // Sim over can tear the stage down in the middle of a frame
  let last = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!paused) t += dt;
    // a card on screen (like Real numbers) pauses the dive
    const live = phase === 'play' && !paused && !game.ui.busy && game.running;

    if (live) step(dt);
    else player.update(paused || game.ui.busy ? 0 : dt, t);
    if (phase === 'intro' && !paused) {
      introT += dt;
      const k = Math.min(1, introT / 2.2);
      player.position.y = THREE.MathUtils.lerp(11.3, SPAWN.pos.y, 1 - (1 - k) ** 3);
      if (Math.random() < 0.5) bubbles.emit(camera.position.clone().add(new THREE.Vector3(0, -0.4, -0.6)), 3, 1.2);
      if (k >= 1 && diveDone) {
        diveDone();
        diveDone = null;
      }
    }
    patches.forEach((pt) => pt.update(t));

    if (!paused && t >= nextDiverBubble) {
      world.divers.forEach((d) => bubbles.emit(d.mouth, 5, 0.15));
      nextDiverBubble = t + 3.2;
    }

    world.update(t, camera);
    bubbles.update(paused ? 0 : dt, t);
    arms.update(camera, dt, t, { swimming: live && player.swimming, working: live && workingNow });

    if (disposed) return;
    renderer.clear();
    renderer.render(world.scene, camera);
    renderer.clearDepth();
    renderer.render(arms.scene, camera);
  });

  // ---------- cleanup (the engine calls this on finish, Sim over and Try again) ----------
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHidden);
    player.dispose();
    game.ui.prompt(null);
    game.ui.target(false);
    game.ui.pause(false);
    world.dispose();
    disposeTree(arms.scene);
    renderer.dispose();
    renderer.forceContextLoss(); // otherwise every Try again leaves a WebGL context behind
    renderer.domElement.remove();
  };
}

// A golden mission patch floating in the water: spins, bobs and glows until you swim through it.
function buildPatch(scene, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1846';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffc145';
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = '#ffc145';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 18 : 42;
    g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr);
  }
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffc145', emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.4 });
  const rim = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.3, metalness: 0.6, emissive: '#7a4f00' });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 32), [rim, face, face]);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd76a', transparent: true, opacity: 0.55, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.8);
  group.add(glow);
  let found = false;
  let foundAt = 0;
  let lastT = 0;
  return {
    position,
    get found() {
      return found;
    },
    collect() {
      found = true;
      foundAt = lastT;
    },
    update(t) {
      lastT = t;
      if (!found) {
        group.rotation.y = t * 1.6;
        group.position.y = position.y + Math.sin(t * 1.8) * 0.12;
        glowMat.opacity = 0.4 + 0.2 * Math.sin(t * 3);
      } else {
        const k = Math.min(1, (t - foundAt) / 0.5);
        group.scale.setScalar(1 + k * 0.8);
        group.rotation.y += 0.4;
        glowMat.opacity = 0.6 * (1 - k);
        face.opacity = 1 - k;
        group.visible = k < 1;
      }
    },
  };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
