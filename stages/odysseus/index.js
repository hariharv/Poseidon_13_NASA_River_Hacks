// Stage 2: Odysseus · Astronaut
// Where: a plane that flies big hills in the sky so everyone inside floats for about 20 seconds
//        (NASA's reduced-gravity plane, nicknamed the "Vomit Comet").
// Job: catch the floating tools while weightless, then turn off extra machines to save energy.
// Big idea: when energy is low, keep the air machine on first.

import * as THREE from 'three';
import './odysseus.css';
import { buildWorld, disposeTree, SPAWN, MASKS, separate } from './world.js';
import { createPlayer } from './player.js';
import { createTools } from './tools.js';
import { createBlobs } from './blobs.js';
import { createArms } from '../hermes/arms.js';
import {
  MACHINES,
  powerState,
  canPlug,
  oxygenStep,
  uploadStep,
  toolProgress,
  flightPhase,
  planePitch,
  starsFor,
} from './sim.js';
import { rulesFor } from '../../core/rules.js';
import { plugPrompt } from '../../core/plugs.js';

const C9_FACTS = 'https://www.nasa.gov/news-release/phoenix-teachers-to-experiment-aboard-nasas-weightless-wonder/';
const G_FACTS = 'https://www.nasa.gov/centers-and-facilities/armstrong/relevant-environment-provides-testing-for-technology-payloads/';

const rules = rulesFor('odysseus', 'easy');
const REAL_NUMBERS = [
  { label: "Weightless time on each hill (NASA's C-9 \"Weightless Wonder\")", value: 'about 25 seconds', source: 'NASA news release', url: C9_FACTS },
  { label: 'How heavy you feel, then how light', value: '1.8 g, then 0 g for about 22 seconds', source: 'NASA Armstrong', url: G_FACTS },
  { label: 'In this sim: oxygen used per second while gliding', value: `${(rules.breathePerSec - rules.airMachinePerSec).toFixed(2)} (the air machine keeps up)`, source: 'Game rules' },
  { label: 'In this sim: oxygen used per second while pushing', value: `${(rules.breathePerSec + rules.workPerSec - rules.airMachinePerSec).toFixed(2)}`, source: 'Game rules' },
  { label: 'In this sim: oxygen used per second with no air machine', value: `${(rules.breathePerSec + rules.staleAirPerSec).toFixed(2)}`, source: 'Game rules' },
];

const SIGN_COLOURS = { float: '#ffc145', heavy: '#ff5b1f', level: '#5bd98a', power: '#ff4d5e' };

const CONTROLS = [
  { label: 'Push yourself (while floating)', value: 'W and S (or ↑ ↓), Space = up, Shift = down' },
  { label: 'Turn left and right', value: 'A and D (or ← →, or the mouse)' },
  { label: 'Grab a tool / plug or unplug', value: 'Press E (or click)' },
];

export default {
  id: 'odysseus',
  name: 'Odysseus',
  rank: 'Astronaut',
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
  const easy = true; // one mode now: Zeus Jr. always gives the extra hints
  const world = buildWorld({ hints: easy ? 'more' : 'fewer' });

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  renderer.domElement.setAttribute('aria-label', 'Inside the zero-G training plane');
  game.root.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.03, 60);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const arms = createArms(game.player.suit);
  const tools = createTools(world.scene, { count: r.tools, origin: world.toolbox.mouth, speed: r.toolSpeed, hints: easy ? 'more' : 'fewer' });
  const blobs = createBlobs(world.scene, { count: r.blobs });
  let lastCatchAt = -99;
  let combo = 0;

  // ---------- the flight sign at the top of the visor ----------
  const banner = document.createElement('div');
  banner.className = 'odx-flight';
  banner.hidden = true;
  banner.innerHTML = `
    <span class="odx-g"></span>
    <span class="odx-words"><span class="odx-phase"></span><span class="odx-sub"></span></span>
    <span class="odx-timer"><span class="odx-timer-fill"></span></span>`;
  game.root.append(banner);
  const $phase = banner.querySelector('.odx-phase');
  const $sub = banner.querySelector('.odx-sub');
  const $g = banner.querySelector('.odx-g');
  const $timer = banner.querySelector('.odx-timer-fill');
  let bannerKey = '';
  function setBanner(kind, phase, sub, g) {
    const key = kind + phase + sub + g;
    if (key !== bannerKey) {
      bannerKey = key;
      banner.dataset.kind = kind;
      $phase.textContent = phase;
      $sub.textContent = sub;
      $g.textContent = g;
      world.setSign(phase.toUpperCase(), sub, SIGN_COLOURS[kind]);
    }
    banner.hidden = false;
  }

  // ---------- state ----------
  let stage = 'briefing'; // briefing -> flight -> level -> power -> done
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let flightT = Math.max(0, r.heavySeconds - (r.firstClimbSeconds ?? r.heavySeconds)); // skip most of the first climb
  let lastFlightPhase = null;
  let endFlightAt = null;
  let levelT = 0;
  // sounds: the plane's engines, a chime for each tool you catch, clunks for plugs
  game.sound.loop('engine', 0.5); // the plane's engines hum all flight (the game stops every loop when the stage ends)
  let minOxygen = game.oxygen.value;
  let promptText = null;
  let reachUntil = 0;
  let upload = 0; // Progress from the camera (0 .. 100 - toolsShare)
  let plugs = r.plugsLevel;
  let flicker = null; // { until } while the generator flickers
  let flickered = false;
  const plugged = new Set(['air', 'lights', 'fridge', 'music']);
  const timers = new Set();
  const said = new Set();
  const once = (key, text, opts) => {
    if (said.has(key)) return false;
    said.add(key);
    game.ui.buoy(text, opts);
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
    spawn: SPAWN,
    rules: r,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (isPlaying() && game.running && !player.dragMode) setPaused(true);
    },
    onPointerError(dragMode) {
      if (dragMode && paused) setPaused(false);
    },
  });
  player.setEnabled(false);
  player.setMode('walk');
  const isPlaying = () => stage === 'flight' || stage === 'level' || stage === 'power';

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    game.ui.pause(on, resume);
    player.setEnabled(!on && isPlaying());
  }
  function resume() {
    if (player.dragMode) setPaused(false);
    else player.requestLock();
  }
  const onKey = (e) => {
    if (!isPlaying() || !game.running) return;
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
    if (document.hidden && isPlaying()) {
      setPaused(true);
      player.exitLock();
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  // ---------- briefing ----------
  (async () => {
    await game.ui.card({
      eyebrow: demo ? 'Judge Demo · Stage 2 · Odysseus' : 'Stage 2 of 5 · Odysseus',
      title: 'The zero-G plane',
      text: demo
        ? ['A plane flies big hills so everyone floats. *Catch 3 floating tools*, then fix the power without losing your air.']
        : [
            'This plane flies giant hills in the sky. Over the top of each hill, everything inside *floats*!',
            'Your job: *catch the floating tools*, then help when the power gets low.',
            'Running low on air? Float into the *yellow oxygen masks* in the middle of the cabin.',
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: 'Take off' }],
    });
    if (!game.running) return;
    await game.ui.countdown();
    if (!game.running) return;
    stage = 'flight';
    updateTask();
    player.setEnabled(true);
    player.requestLock();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');
    game.ui.buoy(
      demo
        ? 'At the top of each hill you float. That\'s called *weightless*: you\'re falling with the plane!'
        : 'Over the top of each hill, you and the plane fall together, so you float. That\'s called *weightless*!',
    );
    game.demo.check('plain-language');
  })();

  // ---------- helpers ----------
  function setPrompt(text) {
    if (text === promptText) return;
    promptText = text;
    game.ui.prompt(text);
  }

  const to = new THREE.Vector3();
  function findTool() {
    const fwd = player.forward();
    let best = null;
    let bestScore = -Infinity;
    for (const tool of tools.loose) {
      to.subVectors(tool.pos, camera.position);
      const d = to.length();
      if (d > r.grabRadius) continue;
      const facing = fwd.dot(to.normalize());
      if (facing < 0.8) continue;
      const score = facing * 2 - d;
      if (score > bestScore) {
        best = tool;
        bestScore = score;
      }
    }
    return best;
  }

  function findSocket() {
    const fwd = player.forward();
    let best = null;
    let bestDot = 0.93;
    for (const s of world.panel.sockets) {
      to.subVectors(s.position, camera.position);
      const d = to.length();
      if (d > 2.8) continue;
      const dot = fwd.dot(to.normalize());
      if (dot > bestDot) {
        best = s;
        bestDot = dot;
      }
    }
    return best;
  }

  function power() {
    return powerState(plugged, plugs);
  }

  function showPower() {
    const p = power();
    world.panel.show({ plugged, power: p });
    world.machines.state.air = p.airOn;
    world.machines.state.camera = p.cameraOn;
    world.machines.state.fridge = !p.overloaded && plugged.has('fridge');
    world.machines.state.music = !p.overloaded && plugged.has('music');
    world.setLights(stage !== 'power' || p.lightsOn);
    game.plugs.set(p.free);
    return p;
  }

  function updateProgress() {
    const total = Math.min(100, toolProgress(tools.caught, r) + upload);
    game.progress.change(total - game.progress.value);
  }

  // ---------- the oxygen masks ----------
  // Returns oxygen per second from the masks (0 when you're not in them, or they have no air).
  let inMaskZone = false;
  function breatheFromMasks(powered) {
    inMaskZone = camera.position.distanceTo(MASKS) < r.maskRadius;
    world.masks.state.powered = powered;
    world.masks.state.low = game.oxygen.value < r.lowOxygen;
    const breathing = inMaskZone && powered && game.oxygen.value < 99.9;
    world.masks.state.active = inMaskZone && powered;
    if (breathing) once('mask-first', 'Ahh, fresh air! The *oxygen masks* fill you up fast, like on a real plane.');
    return breathing ? r.maskRefillPerSec : 0;
  }

  // ---------- the Task chip and Help ----------
  let taskKey = '';
  function updateTask(p = null) {
    const caught = tools.caught;
    const part2 = stage === 'power' || stage === 'power-card' || stage === 'done';
    let now;
    if (!part2 && blobs.loose.length) now = `Catch the floating water blobs before the hill ends! (${blobs.loose.length} left)`;
    else if (!part2) now = endFlightAt != null ? 'Hold on: the plane is levelling out' : `Catch the floating tools (${caught} of ${r.tools})`;
    else if (p?.overloaded) now = flicker ? 'Only 1 plug! Keep the AIR MACHINE ON' : 'Turn OFF the extra machines (power panel, back wall)';
    else if (p && !p.airOn) now = 'Plug in the AIR MACHINE (power panel, back wall)';
    else if (p && !p.cameraOn) now = 'Plug in the CAMERA to send your science home';
    else now = 'Send your science home (watch the green bar)';
    const key = now;
    if (key === taskKey) return;
    taskKey = key;
    game.ui.task({
      now,
      steps: [
        { text: `Catch all ${r.tools} floating tools`, done: part2 || endFlightAt != null, now: !part2 && endFlightAt == null },
        { text: 'Unplug the extra machines when the power fails', done: part2 && p && !p.overloaded, now: part2 && p?.overloaded },
        { text: 'Keep the AIR MACHINE plugged in', done: false, now: part2 && p && !p.airOn },
        { text: 'Plug in the CAMERA and send your science home', done: stage === 'done', now: part2 && p && !p.overloaded && p.airOn },
      ],
      tips: !part2
        ? [
            'In the *Float!* part, push with *W A S D* (Space up, Shift down), then *glide*: pushing uses more air.',
            'Look at a tool and press *E* (or click) to grab it.',
            'Low on air? Float into the *yellow oxygen masks* hanging in the middle of the cabin.',
            'When the sign says *Heavy*, lie still. The tools will float up again.',
          ]
        : [
            'The *power panel* is on the back wall. Look at a socket and press *E* to plug or unplug it.',
            'Lights, snack fridge and music are *extras*. The air machine and camera matter.',
            'The oxygen masks only work while the *air machine* has a plug.',
          ],
    });
  }

  // ---------- the burst juice pouch: catch the water blobs ----------
  function releaseBlobs() {
    if (blobs.released || stage !== 'flight' || player.mode !== 'float') return;
    const at = camera.position.clone().addScaledVector(player.forward(), 1.8);
    blobs.release(at);
    game.sound.play('water');
    game.ui.cheer({ title: 'SPLOOSH!', sub: 'a juice pouch burst', quiet: true });
    game.ui.buoy('*A juice pouch burst!* In zero-G, water floats in wobbly balls. *Catch the water blobs* before the hill ends, or they splat!', { interrupt: true });
    updateTask();
  }
  function catchBlobs(dt) {
    blobs.update(dt, t);
    if (!blobs.loose.length || player.mode !== 'float') return;
    const fwd = player.forward();
    const pressed = player.takeActionPeek?.();
    for (const b of blobs.loose) {
      const d = b.pos.distanceTo(camera.position);
      const facing = d < 1.8 && fwd.dot(b.pos.clone().sub(camera.position).normalize()) > 0.9;
      if (d < 0.75 || (facing && pressed)) {
        blobs.catch(b);
        reachUntil = t + 0.3;
        game.sound.play('water');
        const left = blobs.loose.length;
        game.ui.cheer({ title: left ? 'SPLASH CATCH!' : 'ALL BLOBS CAUGHT!', sub: left ? `${left} blob${left === 1 ? '' : 's'} left` : 'no mess!', quiet: Boolean(left) });
        if (blobs.caught === 1) game.ui.buoy('Gotcha! Real astronauts sometimes *drink* floating water blobs like this. Slurp!');
        updateTask();
      }
    }
  }

  // ---------- Part 1: the flight ----------
  function onFlightPhase(f) {
    if (f.phase === 'float') {
      player.setMode('float');
      if (f.hill === 0) {
        world.toolbox.open();
        tools.release();
        game.ui.cheer({ title: 'ZERO-G!', sub: 'everything floats' });
        later(demo ? 3000 : 9000, releaseBlobs);
        game.ui.buoy('We\'re floating! Oops, the toolbox popped open. *Catch the floating tools!*', { interrupt: true });
        if (!demo) later(7000, () => game.ui.buoy('Need air? Float into the *yellow oxygen masks* hanging in the middle of the cabin.'));
      } else {
        tools.lift();
        if (endFlightAt == null) once(`float-${Math.min(f.hill, 2)}`, f.hill === 1 ? 'Floating again! The tools are lifting off the floor.' : 'Another hill! Real zero-G flights fly lots of these in one trip.');
      }
    } else {
      if (blobs.loose.length) {
        const n = blobs.splat();
        game.oxygen.change(-n * r.blobPenalty, 'Water blobs splashed on the walls, and cleaning up cost air.');
        game.sound.play('thud');
        game.ui.buoy(`*Splat!* ${n === 1 ? 'A water blob' : `${n} water blobs`} hit the walls. Water and electronics don't mix, so the clean-up cost air!`, { interrupt: true });
        updateTask();
      }
      player.setMode('heavy');
      if (f.hill === 0) {
        game.ui.buoy('Feel heavy? The plane is pulling up hard, so you weigh almost *twice* as much. Lie still!');
      } else if (endFlightAt == null) {
        once('heavy-again', 'Heavy again! Loose tools drop to the floor. They\'ll float up on the next hill.');
      }
    }
  }

  function flightStep(dt) {
    flightT += dt;
    let f = flightPhase(flightT, r);
    // all tools caught: one last pull-out, then level flight
    const pullOutAt = endFlightAt == null ? Infinity : endFlightAt - r.heavySeconds;
    if (flightT >= pullOutAt) {
      const into = flightT - pullOutAt;
      f = { phase: 'heavy', hill: 9999, left: r.heavySeconds - into, k: into / r.heavySeconds, last: true };
    }
    const key = `${f.phase}-${f.hill}`;
    if (key !== lastFlightPhase) {
      lastFlightPhase = key;
      onFlightPhase(f);
    }
    world.setPitch(planePitch(f));
    const floating = f.phase === 'float';
    const g = floating ? 0 : r.heavyG;

    const atMask = breatheFromMasks(true);
    const o = atMask ? { delta: atMask, reason: 'refill' } : oxygenStep({ airOn: true, thrusting: floating && player.thrusting }, dt, r);
    game.oxygen.change(o.delta * (atMask ? dt : 1), o.reason);
    if (!game.running) return;
    if (floating && player.thrusting && once('first-push', 'Pushing yourself around makes you breathe hard. *One push and glide* saves air!')) {
      game.demo.check('every-choice-costs');
    }

    // catch tools
    const target = floating && endFlightAt == null ? findTool() : null;
    const wantGrab = player.takeAction();
    let grabbed = null;
    if (target && wantGrab) grabbed = target;
    // Easy: bump right into a tool and you catch it
    if (!grabbed && floating && easy) {
      for (const tool of tools.loose) if (tool.pos.distanceTo(camera.position) < 0.55) grabbed = tool;
    }
    if (grabbed) {
      tools.catch(grabbed);
      reachUntil = t + 0.35;
      combo = t - lastCatchAt < 3 ? combo + 1 : 1;
      lastCatchAt = t;
      if (combo >= 2) game.ui.cheer({ title: combo === 2 ? 'DOUBLE CATCH!' : combo === 3 ? 'TRIPLE CATCH!' : `${combo}x CATCH!`, sub: 'speedy hands!' });
      updateProgress();
      updateTask();
      const left = r.tools - tools.caught;
      if (left > 0) game.ui.buoy(left === 1 ? `Got the ${grabbed.name}! *One more tool.*` : `Got the ${grabbed.name}! *${left} to go.*`);
      else onAllCaught(f);
    } else if (wantGrab && !floating) {
      once('too-heavy', 'Too heavy to grab things right now. Wait for the *float*!');
    }

    tools.update(dt, t, { g, camera });
    separate([...tools.loose, ...blobs.loose]); // floating things bump off each other, never through

    // the end of the flight: finish this hill, pull out, then fly level
    if (endFlightAt != null && flightT >= endFlightAt) {
      startLevel();
      return;
    }

    const o2 = game.oxygen.value;
    if (o2 > 70) said.delete('low');
    if (o2 < r.lowOxygen) once('low', easy ? 'Your air is getting low! Float into the *yellow oxygen masks* in the middle of the cabin, and *glide* instead of pushing.' : 'Oxygen low. Masks are mid-cabin.', { interrupt: true });

    // banner + prompt
    if (floating) setBanner('float', 'Float!', `0 g · ${Math.ceil(f.left)} s left`, '0g');
    else setBanner('heavy', f.hill === 0 ? 'Climbing' : 'Pulling out', 'heavy · lie still', `${r.heavyG}g`);
    $timer.style.width = `${(1 - f.k) * 100}%`;
    game.ui.target(Boolean(target));
    if (endFlightAt != null) setPrompt('All tools caught! Hold on…');
    else if (target) setPrompt(`Press [E] or click to grab the ${target.name}`);
    else if (atMask) setPrompt('Breathing from the oxygen mask…');
    else if (inMaskZone && game.oxygen.value >= 99.9) setPrompt('Air full! Go catch a tool');
    else if (floating) setPrompt(`Tools caught: ${tools.caught} of ${r.tools}`);
    else setPrompt(f.hill === 0 ? 'Too heavy to move! Wait for the float…' : `Too heavy to move! Tools caught: ${tools.caught} of ${r.tools}`);
  }

  function onAllCaught(f) {
    game.ui.cheer({ title: 'ALL TOOLS CAUGHT!', big: true });
    const cycle = r.heavySeconds + r.floatSeconds;
    endFlightAt = Math.min(flightT + 4, (f.hill + 1) * cycle) + r.heavySeconds; // float a little more, then one last pull-out
    game.ui.buoy('All tools caught! Hold on, the plane is going to *level out*.', { interrupt: true });
    updateTask();
    if (easy && !demo) later(5000, () => game.ui.buoy('Did you see the blue bar? Pushing around used air. *Gliding saved it.*'));
  }

  // ---------- Part 2: level flight and power trouble ----------
  function startLevel() {
    stage = 'level';
    levelT = 0;
    player.setMode('walk');
    world.setPitch(0);
    tools.tools.forEach((tool) => (tool.mesh.visible = false));
    game.ui.target(false);
    setBanner('level', 'Level flight', 'normal weight · 1 g', '1g');
    $timer.style.width = '0%';
    setPrompt(null);
    game.ui.buoy('Phew, normal weight again. You can *walk* now.');
  }

  async function powerTrouble() {
    stage = 'power-card';
    plugged.clear();
    r.startPlugged.forEach((id) => plugged.add(id));
    plugs = r.plugsLevel;
    showPower(); // overloaded: lights go out
    world.setLights(false);
    setBanner('power', 'Power trouble', `only ${plugs} energy plugs`, '⚡');
    setPrompt(null);
    player.exitLock();
    await game.ui.card({
      tone: 'alert',
      eyebrow: 'Uh oh!',
      title: `Only ${plugs} energy plugs!`,
      text: [
        'One of the plane\'s generators switched off. Too many machines are plugged in, so *nothing works*, not even the air machine!',
        `Go to the *power panel* on the back wall and turn OFF the extras, so only ${plugs} machines are ON. The list on the left of your screen shows which ones are ON.`,
      ],
      facts: [
        { label: 'Air machine', value: 'makes fresh air (keeps Oxygen up)' },
        { label: 'Camera (+ boost)', value: 'sends your science home (Progress)' },
        { label: 'Lights, snack fridge, music', value: 'nice, but extra' },
      ],
      choices: [{ id: 'ok', label: 'Fix the power' }],
    });
    if (!game.running) return;
    stage = 'power';
    world.panel.setHint(true);
    player.requestLock();
    game.ui.buoy('Turn around! The power panel is on the *back wall*. Look at an *extra* machine and press E to turn it *OFF*.');
  }

  function toggle(socket) {
    const id = socket.machine.id;
    if (plugged.has(id)) {
      plugged.delete(id);
      game.sound.play('clunk');
      game.ui.buoy(`Turned OFF the ${socket.machine.label.toLowerCase()}. That frees a plug.`);
    } else if (power().overloaded || !canPlug(plugged, plugs)) {
      game.ui.buoy('No free plug! Turn another machine *OFF* first. The *power panel* list shows which ones are ON.', { interrupt: true });
      return;
    } else {
      plugged.add(id);
      game.sound.play('clunk');
    }
    reachUntil = t + 0.35;
    const p = showPower();
    if (!p.overloaded) {
      world.panel.setHint(false);
      if (p.airOn) once('air-back', 'The *air machine* is making fresh air again!');
      if (p.cameraOn) once('camera-on', 'The camera is sending your science home. Watch the *green bar*!');
      if (!p.airOn && p.workRate > 0) {
        if (once('no-air', p.workRate === 2 ? 'Camera boost is fast… but *nothing is making fresh air*!' : 'The camera is working, but *nothing is making fresh air*!', { interrupt: true })) {
          game.demo.check('every-choice-costs');
        }
      }
      if (p.airOn && p.cameraOn && demo) {
        game.demo.check('teaches-one-thing');
        once('air-first', 'Air first, then work. *That\'s why astronauts can\'t just use unlimited power!*');
      }
      if (flicker && plugged.size <= plugs) {
        if (p.airOn) {
          once('flicker-air', 'Smart! *When energy is low, keep the air machine on first.* Progress can wait, breathing can\'t.', { interrupt: true });
          game.demo.check('teaches-one-thing');
        }
      }
    }
  }

  function powerStep(dt) {
    const p = power();
    // the generator flickers once, near the end
    if (!flickered && r.flickerAt != null && game.progress.value >= r.flickerAt) {
      flickered = true;
      flicker = { until: t + r.flickerSeconds };
      plugs = r.plugsFlicker;
      const now = showPower();
      game.ui.buoy(`The generator is flickering! Only *${plugs} plug* for a little while. Which machine matters most?`, { interrupt: true });
      if (!now.overloaded && now.airOn) {
        once('flicker-air', 'You already kept the air machine on. *When energy is low, air comes first!*');
        game.demo.check('teaches-one-thing');
      }
      return;
    }
    if (flicker && t >= flicker.until) {
      flicker = null;
      plugs = r.plugsLevel;
      showPower();
      game.ui.buoy(`Power's back: *${plugs} plugs* again!`);
    }

    const atMask = breatheFromMasks(p.airOn);
    const o = atMask ? { delta: atMask * dt, reason: 'refill' } : oxygenStep({ airOn: p.airOn }, dt, r);
    game.oxygen.change(o.delta, o.reason);
    if (!game.running) return;
    if (inMaskZone && !p.airOn) once('mask-off', 'The masks get their air from the *air machine*. No plug, no air!');
    updateTask(p);

    upload = Math.min(100 - r.toolsShare, upload + uploadStep(p, dt, r));
    world.machines.state.upload = (upload / (100 - r.toolsShare)) * 100;
    updateProgress();
    if (game.progress.value >= 100) {
      complete();
      return;
    }

    // plug / unplug
    const socket = findSocket();
    world.panel.sockets.forEach((s) => (s.aimed = s === socket));
    if (player.takeAction() && socket) toggle(socket);

    const o2 = game.oxygen.value;
    if (o2 > 70) said.delete('low-power');
    if (!p.airOn && o2 < r.lowOxygen) once('low-power', easy ? 'Oxygen low! Give the *air machine* a plug!' : 'Oxygen low.', { interrupt: true });
    if (easy && !demo && p.overloaded && levelT > 25) once('overload-hint', 'Too many machines are ON! Look at an *extra* one on the panel (like the snack fridge) and press E to turn it *OFF*.');

    // banner + prompt
    if (flicker) setBanner('power', 'Generator flicker', `only ${plugs} plug · ${Math.ceil(flicker.until - t)} s`, '⚡');
    else if (p.overloaded) setBanner('power', 'Too many machines!', `${plugged.size} machines, ${plugs} plugs`, '⚡');
    else setBanner('level', 'Level flight', p.cameraOn ? `sending science home · ${Math.round(world.machines.state.upload)}%` : 'plug in the camera to send your science home', '1g');
    $timer.style.width = flicker ? `${((flicker.until - t) / r.flickerSeconds) * 100}%` : '0%';
    game.ui.target(Boolean(socket));
    game.ui.power({ plugs, overloaded: p.overloaded, aimed: socket?.machine.id ?? null, machines: MACHINES.map((m) => ({ id: m.id, label: m.label, kind: m.kind, plugged: plugged.has(m.id) })) });
    if (socket) setPrompt(plugPrompt({ label: socket.machine.label, plugged: plugged.has(socket.machine.id), free: p.free, overloaded: p.overloaded }));
    else if (easy && camera.position.z < 6.4) setPrompt('Walk to the power panel on the back wall');
    else setPrompt(null);
  }

  function complete() {
    stage = 'done';
    game.ui.power(null);
    game.ui.cheer({ title: 'SCIENCE SENT HOME!', sub: `water blobs caught: ${blobs.caught} of ${r.blobs}`, big: true });
    setPrompt(null);
    game.ui.target(false);
    player.setEnabled(false);
    world.panel.sockets.forEach((s) => (s.aimed = false));
    game.ui.buoy(
      demo
        ? 'Science sent home, and you kept breathing. *Air first, then work!*'
        : 'Science sent home! Real astronauts train on planes like this one, nicknamed the *Vomit Comet*. Lots of people feel a bit sick on it!',
      { interrupt: true },
    );
    later(4200, async () => {
      player.exitLock();
      if (!demo) {
        await game.ui.card({
          tone: 'win',
          eyebrow: 'Checkpoint 1 of 4',
          title: 'Astronaut Pin!',
          text: [
            `You floated, caught every tool, and kept the air machine running. You're now an *Astronaut*, ${game.player.name}!`,
            'A gold pin goes on your suit.',
          ],
          choices: [{ id: 'ok', label: 'Pin it on!' }],
        });
      }
      game.finish({ stars: starsFor({ minOxygen, seconds: elapsed }, r), passed: true, badge: 'astronaut-pin' });
      game.web?.window('zerog');
    });
  }

  // ---------- one step of play ----------
  function step(dt) {
    elapsed += dt;
    game.ui.clock(elapsed, r.stars.speedySeconds);
    catchBlobs(dt);
    if (stage === 'flight') flightStep(dt);
    else if (stage === 'level') {
      levelT += dt;
      tools.update(dt, t, { g: 1, camera });
      const o = oxygenStep({ airOn: true }, dt, r);
      game.oxygen.change(o.delta, o.reason);
      player.takeAction();
      if (levelT > 2.6) powerTrouble();
    } else if (stage === 'power') {
      levelT += dt;
      powerStep(dt);
    }
    minOxygen = Math.min(minOxygen, game.oxygen.value);
  }

  // ---------- main loop ----------
  let disposed = false; // Sim over can tear the stage down in the middle of a frame
  let last = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!paused) t += dt;
    const live = isPlaying() && !paused && !game.ui.busy && game.running;
    if (live) step(dt);
    else player.clearActions();
    player.update(live ? dt : 0, t);

    world.toolbox.update(paused ? 0 : dt);
    world.update(t, paused ? 0 : dt, camera);
    arms.update(camera, dt, t, { swimming: live && player.mode !== 'heavy' && player.moving, working: t < reachUntil });

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
    banner.remove();
    world.dispose();
    disposeTree(arms.scene);
    renderer.dispose();
    renderer.forceContextLoss(); // otherwise every Try again leaves a WebGL context behind
    renderer.domElement.remove();
  };
}
