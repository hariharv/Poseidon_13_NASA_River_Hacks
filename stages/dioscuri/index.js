// Stage 3: Dioscuri · Science Expert
// Where: a robot-arm trainer that copies the space station's Cupola window and its robot arm.
// Job: use the robot arm to move the science box onto the experiment platform, then run the experiment
//      as the station passes from the sunny side of Earth into Earth's shadow and back.
// Big idea: science is why we go to space, but it costs energy.

import * as THREE from 'three';
import './dioscuri.css';
import { buildWorld, EYE, ARM_BASE, L1, L2, DECK_Y, BOX_HALF, SLOT, HAND_START } from './world.js';
import { createControls } from './controls.js';
import { powerState, canPlug, oxygenStep, scienceStep, orbitPhase, plugsFor, clampTarget, starsFor } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const ARM_FACTS = 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/data-sheet.asp';
const ORBIT_FACTS = 'https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/';

const hard = rulesFor('dioscuri', 'hard');
const REAL_NUMBERS = [
  { label: "Length of the station's robot arm, Canadarm2", value: 'about 17 m (as long as 4 cars)', source: 'Canadian Space Agency data sheet', url: ARM_FACTS },
  { label: 'Joints in Canadarm2', value: '7: three at the shoulder, one elbow, three at the wrist', source: 'Canadian Space Agency data sheet', url: ARM_FACTS },
  { label: 'Time for the station to go once around Earth', value: '90 minutes, so 16 sunrises and sunsets a day', source: 'NASA Spot the Station FAQ', url: ORBIT_FACTS },
  { label: 'In this sim: energy plugs on the sunny side / in the shadow', value: `${hard.dayPlugs} / ${hard.nightPlugs}`, source: 'Game rules (Hard mode)' },
  { label: 'In this sim: oxygen used per second with no air machine', value: `${(hard.breathePerSec + hard.staleAirPerSec).toFixed(2)}`, source: 'Game rules (Hard mode)' },
];

const CONTROLS = [
  { label: 'Steer the robot arm', value: 'W A S D, Space = up, Shift = down' },
  { label: 'Look around', value: 'Move the mouse' },
  { label: 'Grab / let go, plug / unplug', value: 'Press E (or click)' },
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
  const world = buildWorld({ hints: easy ? 'more' : 'fewer', suit: game.player.suit });

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'Robot-arm trainer looking out at Earth');
  game.root.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 4000);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // ---------- the day/night sign at the top of the visor ----------
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
  let stage = 'briefing'; // briefing -> arm -> science -> done
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let orbitT = 0;
  let side = 'day';
  let plugs = r.dayPlugs;
  let sunsets = 0;
  let minOxygen = game.oxygen.value;
  let carrying = false;
  let placed = false;
  let science = 0; // Progress from the experiment
  let promptText = null;
  let screenTick = 0;
  let noPowerSaidAt = -99;
  const plugged = new Set(r.startPlugged);
  const tip = HAND_START.clone();
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
    eye: EYE,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (isPlaying() && game.running && !controls.dragMode) setPaused(true);
    },
    onPointerError(dragMode) {
      if (dragMode && paused) setPaused(false);
    },
  });
  controls.setEnabled(false);
  const isPlaying = () => stage === 'arm' || stage === 'science';

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    game.ui.pause(on, resume);
    controls.setEnabled(!on && isPlaying());
  }
  function resume() {
    if (controls.dragMode) setPaused(false);
    else controls.requestLock();
  }
  const onKey = (e) => {
    if (!isPlaying() || !game.running) return;
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
    if (document.hidden && isPlaying()) {
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
      title: 'The robot arm',
      text: demo
        ? ['Steer the station\'s robot arm, move the *science box*, then keep the experiment running *through the night*.']
        : [
            "This trainer copies the space station's big window and its giant robot arm.",
            'Your job: use the arm to move the *science box* from the cargo ship onto the *experiment platform*, then grow the space plants inside it.',
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: 'Grab the controls' }],
    });
    if (!game.running) return;
    stage = 'arm';
    controls.setEnabled(true);
    controls.requestLock();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');
    game.ui.buoy(
      demo
        ? 'Steer the arm to the *gold handle* on the science box (on the left), then press E to grab it.'
        : "The station's real robot arm is about *17 metres* long. Steer yours to the *gold handle* on the science box, on the cargo ship to your left.",
    );
    if (easy && !demo) later(6000, () => game.ui.buoy('See the blue ring on the floor? It is right under the arm\'s hand. Use it to judge how far away things are.'));
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
    world.setScience(placed && p.scienceOn, science / (100 - r.grabShare - r.placeShare));
    game.plugs.set(p.free);
    return p;
  }
  function updateProgress() {
    const total = (carrying || placed ? r.grabShare : 0) + (placed ? r.placeShare : 0) + science;
    game.progress.change(Math.min(100, total) - game.progress.value);
  }

  const to = new THREE.Vector3();
  function findSocket() {
    const fwd = controls.forward();
    let best = null;
    let bestDot = 0.965;
    for (const s of world.panel.sockets) {
      to.subVectors(s.position, camera.position);
      const dot = fwd.dot(to.normalize());
      if (dot > bestDot) {
        best = s;
        bestDot = dot;
      }
    }
    return best;
  }

  // which way to steer, in plain words (Easy hint on the desk screen and visor)
  function steerHint(delta) {
    const ax = Math.abs(delta.x);
    const ay = Math.abs(delta.y);
    const az = Math.abs(delta.z);
    if (ax >= ay && ax >= az) return delta.x > 0 ? 'right [D]' : 'left [A]';
    if (az >= ay) return delta.z < 0 ? 'away [W]' : 'closer [S]';
    return delta.y < 0 ? 'down [Shift]' : 'up [Space]';
  }

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
    const p = showPower();
    if (p.overloaded) return;
    world.panel.setHint(false);
    if (p.airOn) once(`air-${sunsets}`, side === 'night' ? 'Air machine running. *Air comes first* when energy is low.' : 'The *air machine* is making fresh air.');
    if (placed && p.scienceOn) once('science-on', 'The science box has power! The *grow lights* are on and the plants are growing.');
    if (side === 'night' && placed && p.scienceRate > 0) {
      if (!p.airOn) {
        if (once('night-no-air', 'Fast science in the dark… but *nothing is making fresh air*! Watch the blue bar.', { interrupt: true })) {
          game.demo.check('every-choice-costs');
        }
      } else {
        if (once('night-safe', 'Smart! Air first, then a little science. *That\'s why astronauts can\'t use unlimited power.*', { interrupt: true })) {
          game.demo.check('teaches-one-thing');
        }
      }
    }
    if (demo && placed && p.airOn && p.scienceOn) game.demo.check('teaches-one-thing');
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
            `Until sunrise there are only *${plugs} plugs*, from the batteries.${p.overloaded ? ' Too many machines are plugged in, so *nothing works*. Unplug some on the power panel to your *left*.' : ''}`,
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
      game.ui.buoy(`Sunrise! The solar panels are back: *${plugs} plugs* again.`, { interrupt: true });
      if (placed && !power().scienceOn) later(2500, () => game.ui.buoy('Give the *science box* a plug while the Sun is up!'));
    }
  }

  // ---------- one step of play ----------
  const delta = new THREE.Vector3();
  function step(dt) {
    elapsed += dt;
    orbitT += dt;
    const o = orbitPhase(orbitT, r);
    world.setOrbit(o);
    if (o.side !== side) {
      onSideChange(o.side, o.orbit);
      if (game.ui.busy) return;
    }
    const p = power();

    // oxygen: the air machine makes fresh air only while it has a plug
    const ox = oxygenStep({ airOn: p.airOn }, dt, r);
    game.oxygen.change(ox.delta, ox.reason);
    if (!game.running) return;
    minOxygen = Math.min(minOxygen, game.oxygen.value);

    // the power panel (look at it to plug things in)
    const socket = findSocket();
    world.panel.sockets.forEach((s) => (s.aimed = s === socket));
    const acted = controls.takeAction();
    if (acted && socket) toggle(socket);

    // ---------- Part 1: the robot arm ----------
    const input = controls.armInput();
    world.inside.tilt({ x: input.z * 0.35, z: -input.x * 0.35 }, { x: -input.y * 0.35, z: 0 });
    let armPrompt = null;
    if (stage === 'arm') {
      if (input.lengthSq() > 0) {
        if (p.armOn) {
          tip.addScaledVector(input, r.armSpeed * dt * (carrying ? 0.85 : 1));
          const minY = DECK_Y + (carrying ? BOX_HALF.y * 2 + 0.55 : 0.32);
          const local = clampTarget({ x: tip.x - ARM_BASE.x, y: tip.y - ARM_BASE.y, z: tip.z - ARM_BASE.z }, L1, L2 - 0.2, minY - ARM_BASE.y);
          tip.set(local.x + ARM_BASE.x, local.y + ARM_BASE.y, local.z + ARM_BASE.z);
        } else if (t - noPowerSaidAt > 6) {
          noPowerSaidAt = t;
          game.ui.buoy(p.overloaded ? 'The arm won\'t move: *too many machines* are plugged in!' : 'The robot arm has *no plug*! Give it one on the power panel.', { interrupt: true });
          if (p.overloaded) world.panel.setHint(true);
        }
      }
      world.arm.reach(tip);
      if (carrying) world.box.hangFrom(tip);

      if (!carrying) {
        const handle = world.box.handle;
        delta.subVectors(handle, tip);
        const near = delta.length() < r.grabRadius;
        world.box.showRing(true, t);
        if (near) {
          armPrompt = 'Press [E] to grab the science box';
          if (acted && !socket) {
            carrying = true;
            world.box.showRing(false);
            world.platform.setActive(true);
            updateProgress();
            game.ui.buoy("Got it! Now carry it to the *green outline* on the experiment platform, on the right.", { interrupt: true });
          }
        } else if (easy) armPrompt = `Move the arm ${steerHint(delta)} to the gold handle`;
        screen('ARM CAMERA', [`Gold handle: ${delta.length().toFixed(1)} m`, p.armOn ? 'Arm: ready' : 'Arm: NO POWER'], p.armOn ? '#7fe0ff' : '#ff4d5e');
      } else {
        const boxPos = world.box.group.position;
        delta.set(SLOT.x - boxPos.x, SLOT.y + BOX_HALF.y + 0.35 - boxPos.y, SLOT.z - boxPos.z);
        const flat = Math.hypot(SLOT.x - boxPos.x, SLOT.z - boxPos.z);
        const lowEnough = boxPos.y - SLOT.y < 0.9;
        if (flat < r.placeRadius && lowEnough) {
          armPrompt = 'Press [E] to set the box down';
          if (acted && !socket) placeBox();
        } else {
          if (acted && !socket) once('not-yet', 'Not here! Carry it to the *green outline* on the right, then lower it down.');
          if (easy) armPrompt = flat < r.placeRadius ? 'Lower the box down [Shift]' : `Move the arm ${steerHint(delta)} to the green outline`;
        }
        screen('ARM CAMERA', [`Green outline: ${flat.toFixed(1)} m`, `Height: ${Math.max(0, boxPos.y - SLOT.y).toFixed(1)} m`], '#5bd98a');
      }
      world.tipMarker.update(tip, DECK_Y);
    }

    // ---------- Part 2: the experiment ----------
    if (stage === 'science') {
      const left = 100 - r.grabShare - r.placeShare;
      science = Math.min(left, science + scienceStep(p, dt, r));
      world.setScience(p.scienceOn, science / left);
      updateProgress();
      if (game.progress.value >= 100) {
        complete();
        return;
      }
      screen('SPACE GARDEN', [`Grown: ${Math.round((science / left) * 100)}%`, p.scienceOn ? (p.scienceRate === 2 ? 'Grow lights: FAST' : 'Grow lights: ON') : 'Grow lights: OFF'], p.scienceOn ? '#5bd98a' : '#ff4d5e');
      world.tipMarker.update(tip, DECK_Y);
      if (easy && !p.scienceOn && !p.overloaded && side === 'day') once('plug-science', 'Look left at the power panel and give the *science box* a plug!');
    }

    // ---------- Zeus Jr. and the visor ----------
    const o2 = game.oxygen.value;
    if (o2 > 70) said.delete('low');
    if (!p.airOn && o2 < r.lowOxygen) once('low', easy ? 'Oxygen low! Give the *air machine* a plug!' : 'Oxygen low.', { interrupt: true });

    const fill = o.left / (o.side === 'day' ? r.daySeconds : r.nightSeconds);
    if (p.overloaded) setBanner('power', 'Too many machines!', `${plugged.size} machines, ${plugs} plugs`, '⚡', fill);
    else if (o.side === 'day') setBanner('day', 'Sunny side', `${plugs} plugs · sunset in ${Math.ceil(o.left)} s`, '☀', fill);
    else setBanner('night', "Earth's shadow", `${plugs} plugs · sunrise in ${Math.ceil(o.left)} s`, '☾', fill);

    game.ui.target(Boolean(socket) || (armPrompt != null && armPrompt.startsWith('Press')));
    if (socket) {
      const name = socket.machine.label.toLowerCase();
      setPrompt(plugged.has(socket.machine.id) ? `Press [E] to unplug the ${name}` : `Press [E] to plug in the ${name}`);
    } else if (p.overloaded && easy) setPrompt('Look left at the power panel and unplug something');
    else setPrompt(armPrompt);
  }

  function screen(title, lines, colour) {
    if (t < screenTick) return;
    screenTick = t + 0.2;
    world.inside.screen({ title, lines, colour });
  }

  function placeBox() {
    carrying = false;
    placed = true;
    stage = 'science';
    world.box.setAt(SLOT);
    world.platform.done();
    updateProgress();
    const p = showPower();
    game.ui.buoy(
      p.scienceOn
        ? 'Box placed! The plants are growing. *Science is why we go to space.*'
        : 'Box placed! Now look left and give the *science box* a plug. *Science is why we go to space*, but it needs energy.',
      { interrupt: true },
    );
    if (plugged.has('arm')) later(5000, () => game.ui.buoy("You don't need the robot arm any more. *Unplug it* to save a plug for science!"));
  }

  function complete() {
    stage = 'done';
    setPrompt(null);
    game.ui.target(false);
    controls.setEnabled(false);
    world.panel.sockets.forEach((s) => (s.aimed = false));
    setBanner('done', 'Experiment done', 'the plants grew!', '✿', 1);
    game.ui.buoy(
      demo
        ? 'The plants grew, and you kept breathing. *Science costs energy, so air comes first.*'
        : 'The space plants grew! Real astronauts grow lettuce on the station, and they eat it too!',
      { interrupt: true },
    );
    later(4200, async () => {
      controls.exitLock();
      if (!demo) {
        await game.ui.card({
          tone: 'win',
          eyebrow: 'Checkpoint 2 of 4',
          title: 'Science Patch!',
          text: [`You moved the science box with the robot arm and kept your experiment running through the night, ${game.player.name}. You're a *Science Expert*!`, 'A science patch goes on your suit.'],
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
    const live = isPlaying() && !paused && !game.ui.busy && game.running;
    if (live) step(dt);
    else controls.clearActions();
    controls.update(live ? dt : 0, t);
    world.update(t, paused ? 0 : dt, camera);
    renderer.render(world.scene, camera);
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
    renderer.dispose();
    renderer.domElement.remove();
  };
}
