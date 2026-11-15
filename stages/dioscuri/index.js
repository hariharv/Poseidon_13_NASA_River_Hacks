// Stage 3: Dioscuri · Science Expert
// Where: a robot-arm lab that copies the space station's Cupola window and its giant robot arm.
// Job: float around the lab. At the arm controls, move three science boxes from the cargo ship
//      to their coloured slots (and park the arm when space junk flies past). At the science bench,
//      start each experiment with a quick puzzle. At the power panel, keep the air machine and the
//      experiments running as the station passes from the sunny side of Earth into its shadow.
// Big idea: science is why we go to space, but it costs energy.

import * as THREE from 'three';
import './dioscuri.css';
import { buildWorld, EYE, FLOAT_START, ROOM, DESK_SPOT, ARM_BASE, L1, L2, DECK_Y, BOX_HALF, SLOTS, STOW, HAND_START } from './world.js';
import { createControls } from './controls.js';
import { createArms } from '../hermes/arms.js';
import { disposeTree } from '../hermes/world.js';
import { powerState, canPlug, oxygenStep, experimentStep, shares, orbitPhase, plugsFor, clampTarget, starsFor, DEBRIS } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const ARM_FACTS = 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/data-sheet.asp';
const ORBIT_FACTS = 'https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/';

const hard = rulesFor('dioscuri', 'hard');
const REAL_NUMBERS = [
  { label: "Length of the station's robot arm, Canadarm2", value: 'about 17 m (as long as 4 cars)', source: 'Canadian Space Agency data sheet', url: ARM_FACTS },
  { label: 'Joints in Canadarm2', value: '7: three at the shoulder, one elbow, three at the wrist', source: 'Canadian Space Agency data sheet', url: ARM_FACTS },
  { label: 'Time for the station to go once around Earth', value: '90 minutes, so 16 sunrises and sunsets a day', source: 'NASA Spot the Station FAQ', url: ORBIT_FACTS },
  { label: 'In this sim: energy plugs on the sunny side / in the shadow', value: `${hard.dayPlugs} / ${hard.nightPlugs} (for 6 machines)`, source: 'Game rules (Hard mode)' },
  { label: 'In this sim: oxygen lost if space junk hits the arm', value: `${hard.debrisDamage}`, source: 'Game rules (Hard mode)' },
];

const CONTROLS = [
  { label: 'Float around the lab', value: 'W A S D, Space = up, Shift = down' },
  { label: 'Look around', value: 'Move the mouse' },
  { label: 'Use what you look at', value: 'Press E (or click)' },
  { label: 'At the arm controls', value: 'W A S D, Space, Shift steer the arm · Q gets up' },
];

export default {
  id: 'dioscuri',
  name: 'Dioscuri',
  rank: 'Science Expert',
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
  const world = buildWorld({ hints: easy ? 'more' : 'fewer', suit: game.player.suit, boxes: r.boxes });
  const { boxes: boxShare, perExperiment } = shares(r);

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.domElement.setAttribute('aria-label', 'Robot-arm lab looking out at Earth');
  game.root.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 4000);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  const arms = createArms(game.player.suit); // my sleeves and gloves while I float around

  // ---------- the sign at the top of the visor ----------
  const banner = document.createElement('div');
  banner.className = 'dsc-orbit';
  banner.hidden = true;
  banner.innerHTML = `
    <span class="dsc-icon"></span>
    <span class="dsc-words"><span class="dsc-phase"></span><span class="dsc-sub"></span></span>
    <span class="dsc-timer"><span class="dsc-timer-fill"></span></span>`;
  game.root.append(banner);
  const $phase = banner.querySelector('.dsc-phase');
  const $sub = banner.querySelector('.dsc-sub');
  const $icon = banner.querySelector('.dsc-icon');
  const $timer = banner.querySelector('.dsc-timer-fill');
  let bannerKey = '';
  function setBanner(kind, phase, sub, icon, fill) {
    const key = kind + phase + sub + icon;
    if (key !== bannerKey) {
      bannerKey = key;
      banner.dataset.kind = kind;
      $phase.textContent = phase;
      $sub.textContent = sub;
      $icon.textContent = icon;
    }
    $timer.style.width = `${Math.max(0, Math.min(1, fill)) * 100}%`;
    banner.hidden = false;
  }

  // ---------- state ----------
  let stage = 'briefing'; // briefing -> play -> done
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let orbitT = 0;
  let side = 'day';
  let plugs = r.dayPlugs;
  let sunsets = 0;
  let minOxygen = game.oxygen.value;
  let carrying = null; // the box hanging from the arm
  let stunnedUntil = 0;
  let alert = null; // { until } while space junk is coming
  let alertsLeft = r.debris;
  let nextAlertAt = Infinity;
  let promptText = null;
  let screenTick = 0;
  let noPowerSaidAt = -99;
  let taskKey = '';
  const plugged = new Set(r.startPlugged);
  const tip = HAND_START.clone();
  // one entry per experiment: its box, its bench station, and how far it's grown
  const exps = world.boxes.map((box, i) => ({ box, slot: SLOTS[i], station: world.bench.stations[i], exp: box.exp, grabbed: false, placed: false, started: false, fill: 0, done: false }));
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

  const controls = createControls({
    camera,
    dom: renderer.domElement,
    seat: EYE,
    start: FLOAT_START,
    room: ROOM,
    floatSpeed: r.floatSpeed,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (stage === 'play' && game.running && !controls.dragMode && !game.ui.puzzleOpen) setPaused(true);
    },
    onPointerError(dragMode) {
      if (dragMode && paused) setPaused(false);
    },
  });
  controls.setEnabled(false);
  world.inside.setSeated(false);

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    game.ui.pause(on, resume);
    controls.setEnabled(!on && stage === 'play' && !game.ui.puzzleOpen);
  }
  function resume() {
    if (controls.dragMode) setPaused(false);
    else controls.requestLock();
  }
  const onKey = (e) => {
    if (stage !== 'play' || !game.running) return;
    if (e.code === 'KeyP' || (e.code === 'Escape' && controls.dragMode)) {
      if (paused) resume();
      else {
        setPaused(true);
        controls.exitLock();
      }
    }
  };
  window.addEventListener('keydown', onKey);
  const onHidden = () => {
    if (document.hidden && stage === 'play') {
      setPaused(true);
      controls.exitLock();
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  // ---------- briefing ----------
  world.setOrbit(orbitPhase(0, r));
  world.arm.reach(tip);
  showPower();
  (async () => {
    await game.ui.card({
      eyebrow: demo ? 'Judge Demo · Stage 3 · Dioscuri' : 'Stage 3 of 6 · Dioscuri',
      title: 'The robot-arm lab',
      text: demo
        ? ['Float to the *arm controls*, move the science box to its slot, then start the experiment at the *science bench* and keep it powered.']
        : [
            "This lab copies the space station's big window and its giant robot arm. You can *float* anywhere in here.",
            `Your job: use the arm to move *${r.boxes} science boxes* to their coloured slots, start each experiment at the *science bench*, and keep everything powered through *day and night*. Watch out for *space junk*!`,
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: 'Start floating' }],
    });
    if (!game.running) return;
    await game.ui.countdown();
    if (!game.running) return;
    stage = 'play';
    controls.setEnabled(true);
    controls.requestLock();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');
    game.ui.buoy('You can float anywhere! Float to the *ARM CONTROLS* at the big window, look at the desk and press *E* to sit down.');
    updateTask(power());
  })();

  // ---------- helpers ----------
  function setPrompt(text) {
    if (text === promptText) return;
    promptText = text;
    game.ui.prompt(text);
  }
  function power() {
    return powerState(plugged, plugs);
  }
  function showPower() {
    const p = power();
    world.panel.show({ plugged, power: p });
    world.arm.setPower(p.armOn);
    world.setLights(p.lightsOn);
    world.inside.setAir(p.airOn);
    game.plugs.set(p.free);
    return p;
  }
  function updateProgress() {
    let total = 0;
    for (const e of exps) {
      if (e.grabbed || e.placed) total += r.grabShare;
      if (e.placed) total += r.placeShare;
      total += e.fill * perExperiment;
    }
    game.progress.change(Math.min(100, total) - game.progress.value);
  }
  const nextBox = () => exps.find((e) => !e.placed);

  // what am I looking at? (while floating: the desk, a socket or a bench station)
  const to = new THREE.Vector3();
  function aimedThing() {
    if (controls.mode !== 'float' || controls.moving) return null;
    const fwd = controls.forward();
    let best = null;
    let bestDot = 0;
    const consider = (kind, item, pos, minDot, maxDist = 2.8) => {
      to.subVectors(pos, camera.position);
      const d = to.length();
      if (d > maxDist) return;
      const dot = fwd.dot(to.normalize());
      if (dot > minDot && dot > bestDot) {
        best = { kind, item };
        bestDot = dot;
      }
    };
    consider('desk', null, DESK_SPOT, 0.86, 3.2);
    world.panel.sockets.forEach((s) => consider('socket', s, s.position, 0.965));
    world.bench.stations.forEach((s) => consider('station', s, s.position, 0.95));
    return best;
  }

  // which way to steer, in plain words (Easy hint on the visor)
  function steerHint(delta) {
    const ax = Math.abs(delta.x);
    const ay = Math.abs(delta.y);
    const az = Math.abs(delta.z);
    if (ax >= ay && ax >= az) return delta.x > 0 ? 'right [D]' : 'left [A]';
    if (az >= ay) return delta.z < 0 ? 'away [W]' : 'closer [S]';
    return delta.y < 0 ? 'down [Shift]' : 'up [Space]';
  }

  // ---------- the power panel ----------
  function toggle(socket) {
    const id = socket.machine.id;
    if (plugged.has(id)) {
      plugged.delete(id);
      game.ui.buoy(`Unplugged the ${socket.machine.label.toLowerCase()}.`);
    } else if (power().overloaded || !canPlug(plugged, plugs)) {
      game.ui.buoy('No plugs left! *Unplug something* first.', { interrupt: true });
      return;
    } else {
      plugged.add(id);
    }
    game.sound.play('clunk');
    const p = showPower();
    if (p.overloaded) return;
    world.panel.setHint(false);
    const running = exps.filter((e) => e.started && !e.done && p.has(e.exp.id));
    if (side === 'night' && running.length) {
      if (!p.airOn) {
        if (once('night-no-air', 'Science in the dark… but *nothing is making fresh air*! Watch the blue bar.', { interrupt: true })) game.demo.check('every-choice-costs');
      } else if (once('night-safe', 'Smart! Air first, then a little science. *That\'s why astronauts can\'t use unlimited power.*', { interrupt: true })) {
        game.demo.check('teaches-one-thing');
      }
    }
    if (demo && p.airOn && running.length) game.demo.check('teaches-one-thing');
  }

  // ---------- the science bench: start an experiment with a quick puzzle ----------
  function startExperiment(e) {
    controls.setEnabled(false);
    game.ui
      .puzzle({
        kind: e.exp.puzzle,
        title: `${e.exp.puzzleTitle}`,
        text: `Start the *${e.exp.name}* experiment before the timer runs out!`,
        seconds: r.puzzleSeconds,
        size: r.puzzleSizes[e.exp.id],
      })
      .then((ok) => {
        if (!game.running) return;
        controls.setEnabled(true);
        controls.requestLock();
        if (ok) {
          e.started = true;
          game.ui.cheer({ title: 'EXPERIMENT STARTED!', sub: e.exp.name });
          const p = power();
          game.ui.buoy(
            p.has(e.exp.id)
              ? `The *${e.exp.name}* experiment is running! *Science is why we go to space.*`
              : `The *${e.exp.name}* experiment is started! Now give it a *plug* on the power panel (left wall).`,
            { interrupt: true },
          );
          game.demo.check('every-choice-costs');
        } else {
          game.ui.buoy('Out of time! Press *E* on the station to try again.', { interrupt: true });
        }
      });
  }

  // ---------- day and night ----------
  async function onSideChange(next, orbit) {
    side = next;
    plugs = plugsFor(side, r);
    const p = showPower();
    if (side === 'night') {
      sunsets++;
      if (sunsets === 1) {
        controls.exitLock();
        await game.ui.card({
          tone: p.overloaded ? 'alert' : undefined,
          eyebrow: 'Sunset!',
          title: `Only ${plugs} energy plugs at night`,
          text: [
            "The station just flew into *Earth's shadow*. The *solar panels* (flat plates that turn sunlight into energy) can't make any power in the dark.",
            `Until sunrise there are only *${plugs} plugs*, from the batteries.${p.overloaded ? ' Too many machines are plugged in, so *nothing works*. Float to the *power panel* on the left wall and unplug some.' : ''}`,
          ],
          choices: [{ id: 'ok', label: p.overloaded ? 'Fix the power' : 'Got it' }],
        });
        if (!game.running) return;
        game.demo.check('plain-language');
        controls.requestLock();
      } else {
        game.ui.buoy(`Sunset! Only *${plugs} plugs* until sunrise.${p.overloaded ? ' Unplug something!' : ''}`, { interrupt: true });
      }
      if (p.overloaded) world.panel.setHint(true);
    } else if (orbit > 0) {
      game.ui.buoy(`Sunrise! The solar panels are back: *${plugs} plugs* again. Plug your experiments back in!`, { interrupt: true });
    }
  }

  // ---------- space junk ----------
  function startAlert() {
    alertsLeft--;
    alert = { until: elapsed + r.debrisSeconds };
    world.stow.setAlert(true);
    game.sound.play('alarm');
    game.ui.buoy(
      controls.mode === 'desk'
        ? `*SPACE JUNK!* Park the arm in the yellow *STOW ring* in ${r.debrisSeconds} seconds!`
        : `*SPACE JUNK!* Get to the arm controls and park the arm in the yellow *STOW ring*. ${r.debrisSeconds} seconds!`,
      { interrupt: true },
    );
  }
  function endAlert() {
    const safe = tip.distanceTo(STOW) < r.stowRadius;
    alert = null;
    world.stow.setAlert(false);
    if (safe) {
      game.ui.cheer({ title: 'DODGED!', sub: 'the junk zoomed past' });
      world.debris.launch();
      game.sound.play('whoosh');
      game.ui.buoy('Phew! The junk zoomed past. *Real station crews move the arm out of the way too.*', { interrupt: true });
    } else {
      world.debris.launch(tip.clone());
      game.sound.play('thud');
      later(300, () => game.sound.play('alarm'));
      game.oxygen.change(-r.debrisDamage, DEBRIS);
      stunnedUntil = elapsed + 1.5;
      if (carrying) {
        carrying.grabbed = false;
        carrying.box.setAt(carrying.box.home);
        carrying = null;
        world.platform.setActive(null);
      }
      game.ui.buoy("*CLANG!* The junk hit the arm. That cost oxygen, and the box fell back onto the ship. Next time, stow the arm!", { interrupt: true });
      updateProgress();
    }
    if (alertsLeft > 0) nextAlertAt = elapsed + 40;
  }

  // ---------- the Task chip and Help ----------
  function updateTask(p) {
    const ready = exps.find((e) => e.placed && !e.started);
    const unpowered = exps.find((e) => e.started && !e.done && !p.has(e.exp.id));
    const box = nextBox();
    const seated = controls.mode === 'desk';
    let now;
    if (alert) now = seated ? 'SPACE JUNK! Park the arm in the yellow STOW ring' : 'SPACE JUNK! Get to the arm controls and park the arm in the STOW ring';
    else if (p.overloaded) now = 'Too many machines! Unplug some (power panel, left wall)';
    else if (!p.airOn) now = 'Plug in the AIR MACHINE (power panel, left wall)';
    else if (ready && !seated) now = `Start the ${ready.exp.label} experiment (science bench, right wall)`;
    else if (unpowered && !seated) now = p.free > 0 ? `Plug in ${unpowered.exp.label} (power panel, left wall)` : `Make room: unplug something, then plug in ${unpowered.exp.label}`;
    else if (box && seated && !p.armOn) now = 'The robot arm has no plug! (power panel, left wall)';
    else if (box && seated) now = carrying ? `Put the ${carrying.exp.label} box in the ${carrying.exp.colourName} slot (right)` : `Grab the ${box.exp.label} box by its gold handle (left)`;
    else if (box) now = 'Float to the ARM CONTROLS at the window and press E';
    else if (ready || unpowered) now = 'Press Q to get up, then go to the science bench';
    else now = 'Keep your experiments powered until they finish';
    if (now === taskKey) return;
    taskKey = now;
    game.ui.task({
      now,
      steps: [
        ...exps.map((e) => ({ text: `Move the ${e.exp.label} box to the ${e.exp.colourName} slot`, done: e.placed, now: !e.placed && e === box })),
        ...exps.map((e) => ({ text: `Start the ${e.exp.label} experiment at the science bench`, done: e.started, now: e.placed && !e.started })),
        { text: 'Keep the air machine and experiments plugged in (4 plugs by day, 2 at night)', done: false, now: Boolean(unpowered) || p.overloaded || !p.airOn },
      ],
      tips: [
        '*Float:* W A S D to push the way you look, Space up, Shift down.',
        '*Arm controls* (at the window): look at the desk and press E. Steer with W A S D, Space and Shift. Press E to grab or drop. Press Q to get up.',
        'The *power panel* is on the left wall and the *science bench* is on the right wall. Look at one and press E.',
        'Space junk alert? Park the arm’s hand inside the yellow *STOW ring* before the countdown ends.',
      ],
    });
  }

  // ---------- one step of play ----------
  const delta = new THREE.Vector3();
  function step(dt) {
    elapsed += dt;
    game.ui.clock(elapsed, r.stars.speedySeconds);
    orbitT += dt;
    const o = orbitPhase(orbitT, r);
    world.setOrbit(o);
    if (o.side !== side && !game.ui.puzzleOpen) {
      onSideChange(o.side, o.orbit);
      if (game.ui.busy) return;
    }
    const p = power();

    // oxygen: the air machine makes fresh air only while it has a plug
    const ox = oxygenStep({ airOn: p.airOn }, dt, r);
    game.oxygen.change(ox.delta, ox.reason);
    if (!game.running) return;
    minOxygen = Math.min(minOxygen, game.oxygen.value);

    // experiments grow while started and plugged in
    for (const e of exps) {
      const powered = p.has(e.exp.id);
      if (e.started && !e.done) {
        e.fill = Math.min(1, e.fill + experimentStep({ started: true, powered, done: false }, dt, r) / perExperiment);
        if (e.fill >= 1) {
          e.done = true;
          game.ui.cheer({ title: `${e.exp.label} DONE!`, sub: 'great science' });
          game.sound.play('success');
          game.ui.buoy(`The *${e.exp.name}* experiment is finished! You can unplug it to free a plug.`, { interrupt: true });
        }
      }
      e.station.state = !e.placed ? 'waiting' : !e.started ? 'ready' : e.done ? 'done' : powered ? 'running' : 'paused';
      e.station.fill = e.fill;
      e.box.setRunning(e.started && powered && !e.done, e.fill);
    }
    updateProgress();
    // (each experiment is a third of the rest, so the sum can land on 99.999…: finish on "all done")
    if (exps.every((e) => e.done)) {
      game.progress.change(100 - game.progress.value);
      complete();
      return;
    }

    // space junk
    if (!alert && alertsLeft > 0 && elapsed >= nextAlertAt && !game.ui.puzzleOpen) startAlert();
    if (alert && elapsed >= alert.until) endAlert();

    // ---------- using things ----------
    const acted = controls.takeAction();
    const leave = controls.takeLeave();
    const aimed = aimedThing();
    world.panel.sockets.forEach((s) => (s.aimed = aimed?.item === s));
    world.bench.stations.forEach((s) => (s.aimed = aimed?.item === s));
    if (controls.mode === 'float' && acted && aimed) {
      if (aimed.kind === 'desk') {
        controls.sit();
        world.inside.setSeated(true);
        game.sound.play('whoosh');
        once('first-sit', 'You\'re at the *arm controls*! Steer with *W A S D*, Space and Shift. Grab a box by its *gold handle* with E. Press *Q* to get up.');
      } else if (aimed.kind === 'socket') toggle(aimed.item);
      else if (aimed.kind === 'station') {
        const e = exps.find((x) => x.station === aimed.item);
        if (e.placed && !e.started) startExperiment(e);
        else if (!e.placed) game.ui.buoy(`The *${e.exp.label}* box isn't on the platform yet. Move it there with the robot arm first.`);
      }
    }
    if (controls.mode === 'desk' && leave && !controls.moving) {
      controls.stand();
      world.inside.setSeated(false);
      game.sound.play('whoosh');
    }

    // ---------- the robot arm ----------
    const input = controls.armInput();
    world.inside.tilt({ x: input.z * 0.35, z: -input.x * 0.35 }, { x: -input.y * 0.35, z: 0 });
    let armPrompt = null;
    if (controls.mode === 'desk' && !controls.moving) {
      if (input.lengthSq() > 0) {
        if (p.armOn && elapsed > stunnedUntil) {
          tip.addScaledVector(input, r.armSpeed * dt * (carrying ? 0.85 : 1));
          const minY = DECK_Y + (carrying ? BOX_HALF.y * 2 + 0.55 : 0.32);
          const local = clampTarget({ x: tip.x - ARM_BASE.x, y: tip.y - ARM_BASE.y, z: tip.z - ARM_BASE.z }, L1, L2 - 0.2, minY - ARM_BASE.y);
          tip.set(local.x + ARM_BASE.x, local.y + ARM_BASE.y, local.z + ARM_BASE.z);
        } else if (t - noPowerSaidAt > 6) {
          noPowerSaidAt = t;
          game.ui.buoy(
            elapsed <= stunnedUntil ? 'The arm is shaking after that hit… give it a second.' : p.overloaded ? "The arm won't move: *too many machines* are plugged in!" : 'The robot arm has *no plug*! Press Q to get up and plug it in (left wall).',
            { interrupt: true },
          );
        }
      }
      const box = nextBox();
      if (alert) {
        delta.subVectors(STOW, tip);
        armPrompt = delta.length() < r.stowRadius ? 'Arm stowed! Hold it there…' : `Park the arm in the STOW ring: ${steerHint(delta)}`;
      } else if (!carrying && box) {
        const target = exps.filter((e) => !e.placed).map((e) => ({ e, d: e.box.handle.distanceTo(tip) })).sort((a, b) => a.d - b.d)[0];
        delta.subVectors(target.e.box.handle, tip);
        exps.forEach((e) => e.box.showRing(!e.placed && !e.grabbed));
        if (target.d < r.grabRadius) {
          armPrompt = `Press [E] to grab the ${target.e.exp.label} box`;
          if (acted) {
            carrying = target.e;
            carrying.grabbed = true;
            carrying.box.showRing(false);
            world.platform.setActive(carrying.exp.id);
            game.sound.play('clunk');
            game.ui.buoy(`Got the *${carrying.exp.label}* box! Carry it to the *${carrying.exp.colourName} slot* on the platform (right).`, { interrupt: true });
            if (!said.has('first-grab')) {
              said.add('first-grab');
              if (alertsLeft > 0) nextAlertAt = elapsed + (demo ? 999 : easy ? 18 : 12);
            }
          }
        } else if (easy) armPrompt = `Move the arm ${steerHint(delta)} to a gold handle`;
        screen('ARM CAMERA', [`Gold handle: ${target.d.toFixed(1)} m`, p.armOn ? 'Arm: ready' : 'Arm: NO POWER'], p.armOn ? '#7fe0ff' : '#ff4d5e');
      } else if (carrying) {
        const c = carrying; // (placeBox lets go of it partway through)
        carrying.box.hangFrom(tip);
        const slot = carrying.slot;
        const boxPos = carrying.box.group.position;
        delta.set(slot.x - boxPos.x, slot.y + BOX_HALF.y + 0.35 - boxPos.y, slot.z - boxPos.z);
        const flat = Math.hypot(slot.x - boxPos.x, slot.z - boxPos.z);
        const lowEnough = boxPos.y - slot.y < 0.9;
        // a different slot? tell them which one
        const wrong = exps.find((e) => e !== carrying && Math.hypot(e.slot.x - boxPos.x, e.slot.z - boxPos.z) < r.placeRadius);
        if (flat < r.placeRadius && lowEnough) {
          armPrompt = 'Press [E] to set the box down';
          if (acted) placeBox(carrying);
        } else if (wrong) {
          armPrompt = `Wrong slot! The ${c.exp.label} box goes in the ${c.exp.colourName} slot`;
          if (acted) game.ui.buoy(`That's the ${wrong.exp.colourName} slot. Match the colours: *${c.exp.colourName}*!`);
        } else {
          if (acted) once('not-yet', `Not here! Carry it to the *${c.exp.colourName}* slot on the right, then lower it down.`);
          if (easy) armPrompt = flat < r.placeRadius ? 'Lower the box down [Shift]' : `Move the arm ${steerHint(delta)} to the ${c.exp.colourName} slot`;
        }
        screen('ARM CAMERA', [`${c.exp.label} slot: ${flat.toFixed(1)} m`, `Height: ${Math.max(0, boxPos.y - slot.y).toFixed(1)} m`], c.exp.colour);
      } else {
        screen('ARM CAMERA', ['All boxes moved!', 'Press Q to get up'], '#5bd98a');
      }
    }
    world.arm.reach(tip);
    if (carrying) carrying.box.hangFrom(tip);
    world.tipMarker.update(tip, DECK_Y);

    // ---------- Zeus Jr., the task, the visor ----------
    const o2 = game.oxygen.value;
    if (o2 > 70) said.delete('low');
    if (!p.airOn && o2 < r.lowOxygen) once('low', easy ? 'Oxygen low! Float to the power panel (left wall) and plug in the *air machine*!' : 'Oxygen low.', { interrupt: true });
    updateTask(p);

    const fill = o.left / (o.side === 'day' ? r.daySeconds : r.nightSeconds);
    if (alert) setBanner('alert', 'Space junk!', `stow the arm · ${Math.ceil(alert.until - elapsed)} s`, '!', (alert.until - elapsed) / r.debrisSeconds);
    else if (p.overloaded) setBanner('power', 'Too many machines!', `${plugged.size} machines, ${plugs} plugs`, '⚡', fill);
    else if (o.side === 'day') setBanner('day', 'Sunny side', `${plugs} plugs · sunset in ${Math.ceil(o.left)} s`, '☀', fill);
    else setBanner('night', "Earth's shadow", `${plugs} plugs · sunrise in ${Math.ceil(o.left)} s`, '☾', fill);

    let prompt = null;
    if (controls.mode === 'float' && aimed) {
      if (aimed.kind === 'desk') prompt = 'Press [E] to sit at the arm controls';
      else if (aimed.kind === 'socket') prompt = plugged.has(aimed.item.machine.id) ? `Press [E] to unplug the ${aimed.item.machine.label.toLowerCase()}` : `Press [E] to plug in the ${aimed.item.machine.label.toLowerCase()}`;
      else {
        const e = exps.find((x) => x.station === aimed.item);
        prompt = e.placed && !e.started ? `Press [E] to start the ${e.exp.label} experiment` : `${e.exp.label}: ${e.station.state === 'waiting' ? 'waiting for its box' : e.station.state}`;
      }
    } else if (controls.mode === 'desk') prompt = armPrompt ?? (easy ? 'Steer: W A S D, Space, Shift · [Q] get up' : null);
    game.ui.target(Boolean(aimed) || Boolean(armPrompt?.startsWith('Press')));
    setPrompt(prompt);
  }

  function screen(title, lines, colour) {
    if (t < screenTick) return;
    screenTick = t + 0.2;
    world.inside.screen({ title, lines, colour });
  }

  function placeBox(e) {
    carrying = null;
    e.placed = true;
    e.box.setAt(e.slot);
    world.platform.fill(e.exp.id);
    world.platform.setActive(null);
    game.sound.play('thud');
    updateProgress();
    const left = exps.filter((x) => !x.placed).length;
    game.ui.cheer({ title: 'BOX IN PLACE!', sub: left ? `${left} to go` : 'now start the experiments' });
    game.ui.buoy(
      left
        ? `*${e.exp.label}* box in place! ${left === 1 ? 'One more box' : `${left} more boxes`} to go. Its experiment is ready at the *science bench* too.`
        : `All boxes in place! Press *Q* to get up and start the experiments at the *science bench* (right wall).`,
      { interrupt: true },
    );
    if (plugged.has('arm') && !left) later(6000, () => game.ui.buoy("You don't need the robot arm any more. *Unplug it* to save a plug for science!"));
  }

  function complete() {
    stage = 'done';
    alert = null;
    world.stow.setAlert(false);
    setPrompt(null);
    game.ui.target(false);
    controls.setEnabled(false);
    world.panel.sockets.forEach((s) => (s.aimed = false));
    world.bench.stations.forEach((s) => (s.aimed = false));
    setBanner('done', 'Experiments done', 'great science!', '✿', 1);
    game.ui.cheer({ title: 'ALL EXPERIMENTS DONE!', big: true });
    game.ui.buoy(
      demo
        ? 'The experiment worked, and you kept breathing. *Science costs energy, so air comes first.*'
        : 'All the experiments worked! Real astronauts grow plants, crystals and more on the station, and they even eat the lettuce!',
      { interrupt: true },
    );
    later(4200, async () => {
      controls.exitLock();
      if (!demo) {
        await game.ui.card({
          tone: 'win',
          eyebrow: 'Checkpoint 2 of 4',
          title: 'Science Patch!',
          text: [`You moved the science boxes with the robot arm, dodged space junk and kept your experiments running through the night, ${game.player.name}. You're a *Science Expert*!`, 'A science patch goes on your suit.'],
          choices: [{ id: 'ok', label: 'Sew it on!' }],
        });
      }
      game.finish({ stars: starsFor({ minOxygen, seconds: elapsed }, r), passed: true, badge: 'science-patch' });
      game.web?.window('lab');
    });
  }

  // ---------- main loop ----------
  let last = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!paused) t += dt;
    const live = stage === 'play' && !paused && !game.ui.busy && game.running;
    if (live) step(dt);
    else controls.clearActions();
    controls.update(live || controls.moving ? dt : 0, t);
    world.update(t, paused ? 0 : dt, camera);
    world.inside.animate(t);
    const floating = controls.mode === 'float' && !controls.moving;
    arms.update(camera, dt, t, { swimming: live && floating && controls.pushing, working: false });
    renderer.clear();
    renderer.render(world.scene, camera);
    if (floating) {
      renderer.clearDepth();
      renderer.render(arms.scene, camera);
    }
  });

  // ---------- cleanup (the engine calls this on finish, Sim over and Try again) ----------
  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHidden);
    controls.dispose();
    game.ui.prompt(null);
    game.ui.target(false);
    game.ui.pause(false);
    banner.remove();
    world.dispose();
    disposeTree(arms.scene);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
