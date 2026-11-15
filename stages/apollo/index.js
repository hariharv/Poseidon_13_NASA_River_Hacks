// Stage 5: Apollo · Commander on the Moon
// Where: Moon Base Apollo, at the Moon's south pole.
// Job: keep the base alive for 14 Moon-days. Share out the energy plugs (solar panels by day,
//      only batteries in the long lunar night), make air from water, dig ice in a dark crater,
//      grow food, call Earth, and hide in the storm shelter when a real solar storm hits.
// Big idea: every choice adds up over time. Nothing is free.

import * as THREE from 'three';
import './apollo.css';
import { buildWorld, disposeTree, INSIDE_START, OUTSIDE_START, AIRLOCK_IN, AIRLOCK_OUT, SHELTER_EYE, CRATER, groundAt } from './world.js';
import { createPlayer } from './player.js';
import { createArms } from '../hermes/arms.js';
import { STORM_OUT, dayClock, plugsFor, powerState, canPlug, oxygenStep, waterStep, growStep, progressFor, stormLight, flareStrength, starsFor } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const SRC = {
  moon: 'https://science.nasa.gov/moon/facts/',
  night: 'https://www.nasa.gov/centers-and-facilities/glenn/nasas-fission-surface-power-project-energizes-lunar-exploration/',
  pole: 'https://www.nasa.gov/humans-in-space/moons-south-pole-is-full-of-mystery-science-intrigue/',
  oxygen: 'https://www.nasa.gov/centers-and-facilities/marshall/the-bare-necessities-surviving-the-rigors-of-space-travel/',
  mars: 'https://www.nasa.gov/centers-and-facilities/goddard/space-communications-7-things-you-need-to-know/',
};

const hard = rulesFor('apollo', 'hard');
const REAL_NUMBERS = [
  { label: 'How long one lunar night lasts', value: 'about 14 and a half Earth days', source: 'NASA Fission Surface Power', url: SRC.night },
  { label: 'Moon gravity compared with Earth', value: 'one-sixth', source: 'NASA Moon facts', url: SRC.moon },
  { label: 'How cold the Moon gets at night', value: 'about -173 °C (-280 °F)', source: 'NASA Moon facts', url: SRC.moon },
  { label: 'How cold the never-sunlit polar craters get', value: 'as low as -203 °C (-334 °F)', source: "NASA: the Moon's south pole", url: SRC.pole },
  { label: 'Distance to the Moon (radio takes about 1.3 s to cross it)', value: '384,400 km', source: 'NASA Moon facts', url: SRC.moon },
  { label: 'Radio delay from Mars, one way', value: '4 to 24 minutes', source: 'NASA Space Communications', url: SRC.mars },
  { label: 'In this sim: suit air lost per second on a moonwalk', value: `${hard.breathePerSec + hard.suitPerSec}`, source: 'Game rules (Hard mode)' },
];

const CONTROLS = [
  { label: 'Walk', value: 'W A S D (or the arrow keys)' },
  { label: 'Hop (outside, in Moon gravity)', value: 'Space' },
  { label: 'Look around', value: 'Move the mouse' },
  { label: 'Use things (plugs, plants, radio, airlock, ice)', value: 'Look at it, press E (or click)' },
];

export default {
  id: 'apollo',
  name: 'Apollo',
  rank: 'Commander on the Moon',
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
  const name = game.player.name;

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  renderer.domElement.setAttribute('aria-label', 'Inside Moon Base Apollo, at the Moon\'s south pole');
  game.root.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 2000);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const world = buildWorld({ suit: game.player.suit, trays: r.trays, iceChunks: r.iceChunks, hints: easy ? 'more' : 'fewer' });
  const arms = createArms(game.player.suit);

  // a soft blue beacon over the ice crater, so it's easy to find
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#5fd0ff', transparent: true, opacity: easy ? 0.22 : 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 30, 16, 1, true), beaconMat);
  beacon.position.set(CRATER.x, groundAt(CRATER.x, CRATER.z) + 15, CRATER.z);
  world.scene.add(beacon);

  // ---------- the sign at the top of the visor: day, Sun or night, water, storm ----------
  const banner = document.createElement('div');
  banner.className = 'apo-sign';
  banner.innerHTML = `
    <span class="apo-icon" aria-hidden="true"></span>
    <span class="apo-words"><span class="apo-phase"></span><span class="apo-sub"></span></span>
    <span class="apo-days"><span class="apo-days-fill"></span></span>`;
  banner.hidden = true;
  game.root.append(banner);
  const $phase = banner.querySelector('.apo-phase');
  const $sub = banner.querySelector('.apo-sub');
  const $icon = banner.querySelector('.apo-icon');
  const $fill = banner.querySelector('.apo-days-fill');
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
    $fill.style.width = `${Math.max(0, Math.min(1, fill)) * 100}%`;
    banner.hidden = false;
  }
  // a black fade for going through the airlock
  const fade = document.createElement('div');
  fade.className = 'apo-fade';
  game.root.append(fade);

  // ---------- the real storm (a saved NASA DONKI record) ----------
  const record = game.data?.storm?.() ?? null;
  const strength = flareStrength(record?.strength);
  const stormDate = record ? kidDate(record.date) : null;
  const stormDay = r.storm.fromDay + Math.floor(Math.random() * (r.storm.toDay - r.storm.fromDay + 1));

  // ---------- state ----------
  let stage = 'briefing'; // briefing -> live -> done
  let where = 'inside'; // inside | shelter | outside | moving
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let missionT = 0; // Moon-time: only runs while you play
  let day = 1;
  let night = false;
  let water = r.waterStart;
  let harvests = 0;
  let calls = 0;
  let ice = 0;
  let lastCallDay = 0;
  let radio = null; // { phase: 'up' | 'down', k }
  let stormAt = null;
  let lastLight = 'green';
  let redOutside = 0;
  let toggledPower = false;
  let usedShelter = false;
  let minOxygen = game.oxygen.value;
  let promptKey = null;
  let workUntil = 0;
  let disposed = false;
  let plugs = r.dayPlugs;
  const plugged = new Set(r.startPlugged);
  world.greenhouse.trays.forEach((tr, i) => (tr.growth = i === 0 ? r.firstTray : i * 0.15));
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
      if (game.running && !disposed) fn();
    }, ms);
    timers.add(id);
  };
  const power = () => powerState(plugged, plugs);

  // ---------- controls ----------
  const player = createPlayer({
    camera,
    dom: renderer.domElement,
    spawn: INSIDE_START,
    rules: r,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (stage === 'live' && game.running && !player.dragMode && !game.ui.puzzleOpen && !game.ui.busy) setPaused(true);
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
    player.setEnabled(!on && stage === 'live');
  }
  function resume() {
    if (player.dragMode) setPaused(false);
    else player.requestLock();
  }
  const onKey = (e) => {
    if (stage !== 'live' || !game.running) return;
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
    if (document.hidden && stage === 'live') {
      setPaused(true);
      player.exitLock();
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  const fans = game.sound.loop('air', 0.8);
  const hum = game.sound.loop('hum', 0.6);
  showPower();

  // ---------- briefing ----------
  (async () => {
    await game.ui.card({
      eyebrow: demo ? 'Judge Demo · Stage 5 · Apollo' : 'Stage 5 of 5 · Apollo',
      title: 'Moon Base Apollo',
      text: demo
        ? ['You run a base on the Moon. Share out the *energy plugs*, make air from *water*, dig *ice*, grow food, call Earth, and hide from a *real solar storm*.']
        : [
            `You made it to the Moon, ${name}! You're the *Commander* of Moon Base Apollo, at the Moon's south pole. Keep the base alive for *${r.days} Moon-days*.`,
            'For 7 days the Sun shines on your *solar panels*. Then comes the long, freezing *lunar night*, with only batteries. Every plug, every drop of water and every trip outside adds up.',
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: "Let's go, Commander" }],
    });
    if (!game.running) return;
    await game.ui.countdown();
    if (!game.running) return;
    stage = 'live';
    player.setEnabled(true);
    player.requestLock();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');
    game.ui.buoy(
      demo
        ? "Welcome to the Moon! The *days* tick by on the sign up top. Look at the *POWER PANEL* on your right: each machine takes one *energy plug*."
        : `Welcome to the Moon, *Commander ${name}*! The *POWER PANEL* is on your right. Each machine needs one *energy plug*, and you only have ${plugs} right now.`,
    );
    later(7500, () => once('air', 'The *AIR MACHINE* (by the window) makes oxygen by splitting *water*, like on the space station. No plug or no water = no fresh air!'));
    later(15000, () => once('plants', 'See the *greenhouse* on your left, near the window? The purple *grow lights* make plants grow. Plants also give you a little extra oxygen.'));
  })();

  // ---------- the power panel ----------
  function showPower() {
    const p = power();
    world.panel.show({ plugged, power: p });
    game.plugs.set(p.free);
    world.greenhouse.setLit(p.growOn);
    world.setLights(p.lightsOn || !night);
    world.radio.set({ powered: p.radioOn });
  }
  function toggle(socket) {
    const id = socket.machine.id;
    const label = socket.machine.label.toLowerCase();
    toggledPower = true;
    if (plugged.has(id)) {
      plugged.delete(id);
      game.sound.play('clunk');
      game.ui.buoy(power().overloaded ? `Unplugged the ${label}. Still *too many*: unplug one more!` : `Unplugged the ${label}.`);
    } else if (power().overloaded || !canPlug(plugged, plugs)) {
      game.sound.play('fail');
      game.ui.buoy(`No plugs left! *Unplug something* first. You have ${plugs} ${night ? 'battery plugs at night' : 'solar plugs right now'}.`, { interrupt: true });
      return;
    } else {
      plugged.add(id);
      game.sound.play('clunk');
      const extra = {
        air: 'Air machine on: water in, *oxygen* out!',
        heater: night ? 'Heater on. Toasty! The plants stop freezing too.' : 'Heater on. You only really need it in the *lunar night*.',
        grow: 'Grow lights on. The plants are growing!',
        radio: 'Radio on. Go to the desk and *call Earth*!',
        lights: 'Big lights on. Nice and bright... but they do nothing else!',
      }[id];
      game.ui.buoy(extra);
    }
    const p = power();
    if (!p.overloaded && said.has('overload') && !said.has('fixedOverload')) {
      said.add('fixedOverload');
      game.ui.cheer({ title: 'POWER OK!', sub: 'machines back on' });
    }
    showPower();
  }

  // ---------- jobs ----------
  function harvest(tray) {
    if (tray.growth < 1) {
      game.ui.buoy(tray.frozen ? 'These plants got *frozen* in the cold. Keep the heater on at night!' : `Not ready yet: ${Math.round(tray.growth * 100)}% grown. They need the *grow lights*.`);
      return;
    }
    tray.growth = 0;
    harvests++;
    workUntil = t + 0.6;
    game.sound.play('star');
    game.ui.cheer({ title: 'HARVEST!', sub: `fresh Moon food ${Math.min(harvests, r.goals.harvest)}/${r.goals.harvest}` });
    if (harvests === 1) game.ui.buoy('Yum! Real astronauts grow lettuce on the space station. Fresh food helps them stay healthy far from home.');
  }

  function callEarth() {
    const p = power();
    if (!p.radioOn) {
      game.ui.buoy(p.overloaded ? 'The radio has no power: too many machines are plugged in!' : 'The radio has *no plug*. Plug in the RADIO at the power panel first.', { interrupt: true });
      return;
    }
    if (radio) return;
    if (lastCallDay === day) {
      game.ui.buoy('You already called today. Mission Control is busy! Try again *tomorrow*.');
      return;
    }
    lastCallDay = day;
    radio = { phase: 'up', k: 0 };
    game.sound.play('beep');
    world.radio.set({ mode: 'up', k: 0, text: 'Sending to Earth...', ready: false });
    if (calls === 0) game.ui.buoy("Watch the screen: your message travels at the speed of light, but the Moon is *384,400 km* away. That's about *1.3 seconds* each way!");
  }
  function radioStep(dt) {
    if (!radio) return;
    radio.k += dt / r.radioDelay;
    if (radio.k >= 1 && radio.phase === 'up') {
      radio = { phase: 'down', k: 0 };
      game.sound.play('chirp');
      world.radio.set({ mode: 'down', k: 0, text: 'Earth is answering...' });
      return;
    }
    if (radio.k >= 1) {
      radio = null;
      calls++;
      game.sound.play('success');
      world.radio.set({ mode: 'idle', k: 0, text: 'Message received!', ready: false });
      game.ui.cheer({ title: 'EARTH ANSWERED!', sub: `science report ${Math.min(calls, r.goals.radio)}/${r.goals.radio}` });
      game.ui.buoy(missionControlSays(), { interrupt: true });
      if (calls === 1) later(9000, () => once('mars', 'On Mars it would be much slower: a message takes *4 to 24 minutes* each way! You could not chat at all.'));
      return;
    }
    world.radio.set({ mode: radio.phase, k: radio.k });
  }
  function missionControlSays() {
    if (stormAt == null) {
      return `*Mission Control:* "Hello Commander ${name}! Our space weather team sees the Sun getting busy. Be ready for a *solar storm* around *day ${stormDay}*. Know where your shelter is!"`;
    }
    if (lastLight !== 'green') return '*Mission Control:* "We see the storm too! Get in the shelter and stay there until the light goes green."';
    if (night) return `*Mission Control:* "Great work keeping the base warm in the lunar night, Commander. ${r.days - day + 1} days to go!"`;
    return '*Mission Control:* "The storm is over and your science report arrived. Brilliant work up there!"';
  }

  function digIce(chunk) {
    if (game.ui.puzzleOpen) return;
    player.setEnabled(false);
    workUntil = t + 99;
    game.sound.play('drill');
    game.ui
      .puzzle({ kind: 'timing', title: 'Dig out the ice', text: 'Stop the needle in the *green zone* to break the ice free. Your suit air keeps running!', seconds: r.puzzleSeconds, size: 3 })
      .then((ok) => {
        workUntil = 0;
        if (!game.running || disposed) return;
        player.setEnabled(true);
        player.requestLock();
        if (!ok) {
          game.ui.buoy('The ice is stuck hard. Look at it and press E to try again!', { interrupt: true });
          return;
        }
        world.crater.mine(chunk);
        ice++;
        const before = water;
        water = Math.min(r.waterMax, water + r.icePerChunk);
        game.sound.play('water');
        game.ui.cheer({ title: 'ICE!', sub: `+${Math.round(water - before)} water · ice ${Math.min(ice, r.goals.ice)}/${r.goals.ice}` });
        if (ice === 1) game.ui.buoy('This crater is *always in shadow*, so ice from long ago never melted. Melt it and you get water to drink and to make *oxygen*!');
        else if (water >= r.waterMax) game.ui.buoy('Your water tank is *full*. Head back in before your suit air runs low!');
      });
  }

  // ---------- going places ----------
  function goThroughAirlock(toOutside) {
    if (where === 'moving') return;
    if (toOutside && lastLight === 'red') {
      game.ui.buoy('*Not now!* The storm is here. Outside, there are no walls to stop the radiation.', { interrupt: true });
      return;
    }
    where = 'moving';
    player.setEnabled(false);
    fade.classList.add('is-on');
    game.sound.play('hiss');
    later(650, () => {
      player.place(toOutside ? OUTSIDE_START.pos : INSIDE_START.pos.clone().setX(5.2), { outside: toOutside, yaw: toOutside ? OUTSIDE_START.yaw : Math.PI / 2 });
      where = toOutside ? 'outside' : 'inside';
      fans.set(toOutside ? 0 : 0.8);
      hum.set(toOutside ? 0.15 : 0.6);
      fade.classList.remove('is-on');
      player.setEnabled(true);
      if (toOutside) {
        once(
          'outside',
          "You're on the *Moon*! Gravity here is only *one-sixth* of Earth's: press *Space* to hop. Your suit uses air faster out here, so watch your *oxygen*.",
        );
        later(6500, () => once('crater', 'See the *blue glow*? That dark crater never gets sunlight. There is *ice* in it! Walk down, look at an ice chunk and press E.'));
        if (lastLight === 'yellow') game.ui.buoy('The storm light is *yellow*! The particles are coming. Be quick!', { interrupt: true });
      } else if (lastLight !== 'green') {
        game.ui.buoy('Inside! The *STORM SHELTER* is right here, next to the airlock (red sign). Quick!', { interrupt: true });
      }
    });
  }
  function enterShelter() {
    where = 'shelter';
    usedShelter = true;
    player.sit(SHELTER_EYE, 0);
    game.sound.play('thud');
    if (lastLight === 'red' || lastLight === 'yellow') {
      if (record) game.demo.check('real-world-link');
      game.ui.buoy('Safe! The shelter walls are full of *water*. Water is great at blocking *radiation*. Stay until the light goes *green*.', { interrupt: true });
    } else {
      game.ui.buoy('This is the *storm shelter*. Its walls are packed with water, which blocks radiation. Press E to come out.');
    }
  }
  function leaveShelter() {
    where = 'inside';
    player.sit(null);
    player.place(new THREE.Vector3(3.4, 0, 1.2), { outside: false, yaw: 0 });
    if (lastLight === 'red') game.ui.buoy('You left the shelter in the storm! Every second out here costs oxygen.', { interrupt: true });
  }

  // ---------- what am I looking at? ----------
  const to = new THREE.Vector3();
  function aimedThing() {
    if (where === 'moving' || where === 'shelter') return where === 'shelter' ? { kind: 'leave' } : null;
    const fwd = player.forward();
    let best = null;
    let bestScore = 0;
    const consider = (kind, item, pos, minDot, maxDist) => {
      to.subVectors(pos, camera.position);
      const d = to.length();
      if (d > maxDist) return;
      const dot = fwd.dot(to.normalize());
      if (dot > minDot && dot - d * 0.002 > bestScore) {
        best = { kind, item };
        bestScore = dot - d * 0.002;
      }
    };
    if (where === 'inside') {
      world.panel.sockets.forEach((s) => consider('socket', s, s.position, 0.975, 2.6));
      world.greenhouse.trays.forEach((tr) => consider('tray', tr, tr.position, 0.93, 2.5));
      consider('radio', null, world.radio.position, 0.9, 2.4);
      consider('shelter', null, SHELTER_EYE, 0.86, 3);
      consider('airlockOut', null, AIRLOCK_IN, 0.78, 2.8);
    } else {
      world.crater.chunks.forEach((c) => !c.mined && consider('ice', c, c.position, 0.88, 3.2));
      consider('airlockIn', null, AIRLOCK_OUT, 0.78, 3.8);
    }
    return best;
  }
  function label(a) {
    if (!a) return null;
    if (a.kind === 'socket') return `${plugged.has(a.item.machine.id) ? 'Unplug' : 'Plug in'} the ${a.item.machine.label.toLowerCase()}`;
    if (a.kind === 'tray') return a.item.growth >= 1 ? 'Harvest the plants' : `Plants: ${Math.round(a.item.growth * 100)}% grown`;
    if (a.kind === 'radio') return lastCallDay === day ? 'Radio (already called today)' : 'Call Earth';
    if (a.kind === 'shelter') return 'Get in the storm shelter';
    if (a.kind === 'leave') return 'Leave the storm shelter';
    if (a.kind === 'airlockOut') return 'Go outside (airlock)';
    if (a.kind === 'airlockIn') return 'Go back inside (airlock)';
    if (a.kind === 'ice') return 'Dig out the ice';
    return null;
  }
  function use(a) {
    if (a.kind === 'socket') toggle(a.item);
    else if (a.kind === 'tray') harvest(a.item);
    else if (a.kind === 'radio') callEarth();
    else if (a.kind === 'shelter') enterShelter();
    else if (a.kind === 'leave') leaveShelter();
    else if (a.kind === 'airlockOut') goThroughAirlock(true);
    else if (a.kind === 'airlockIn') goThroughAirlock(false);
    else if (a.kind === 'ice') digIce(a.item);
  }

  // ---------- the day and night ----------
  function newDay(d) {
    game.sound.play('chirp');
    if (d === 2) {
      game.demo.check('play-over-time');
      once('day2', `*Day 2!* Each Moon-day here is short, but in real life the Sun stays up for about *two weeks* at a time on the Moon.`);
    }
    if (!night && d === r.nightFrom - 1) {
      game.ui.buoy(`*Sunset tomorrow!* In the lunar night you get only *${r.nightPlugs} battery plugs*. You'll need them for the *AIR MACHINE* and the *HEATER*.`, { interrupt: true });
    }
    if (d === r.nightFrom) nightfall();
    if (d > r.nightFrom && !power().heaterOn) game.ui.buoy('Brrr! Still no heater. Plug in the *HEATER* at the power panel!', { interrupt: true });
  }
  function nightfall() {
    night = true;
    plugs = r.nightPlugs;
    game.sound.play('warn');
    game.ui.cheer({ title: 'LUNAR NIGHT', sub: `only ${r.nightPlugs} plugs now`, big: true });
    showPower();
    if (power().overloaded) {
      said.add('overload');
      game.demo.check('every-choice-costs');
      game.ui.buoy(
        `*The Sun has set!* No sunlight on the solar panels, only *${r.nightPlugs}* battery plugs. Too many machines are plugged in, so *nothing works*! Unplug down to the *AIR MACHINE* and the *HEATER*.`,
        { interrupt: true },
      );
    } else {
      game.ui.buoy(`*The Sun has set!* The lunar night lasts about *two weeks* in real life and gets down to *-173 °C*. Keep the *HEATER* on!`, { interrupt: true });
    }
    later(12000, () => once('nightword', 'The *lunar night* is when your side of the Moon turns away from the Sun. Real Moon bases need batteries, or even small nuclear power plants, to get through it.'));
  }

  // ---------- the storm ----------
  function startStorm() {
    stormAt = missionT;
    world.flash();
    game.sound.play('flash');
    if (record) game.demo.check('real-dataset');
    game.ui.buoy(
      where === 'outside'
        ? '*Solar flare!* The particles are coming. Get back to the *airlock* and into the *storm shelter*, now!'
        : '*Solar flare!* That flash came from the Sun. The fast *particles* come next: get into the *STORM SHELTER* (red sign, next to the airlock)!',
      { interrupt: true },
    );
    if (record) later(5000, () => game.ui.buoy(`This storm *really happened*, on *${stormDate}*: an *${record.strength}* flare from NASA's space weather records.`));
    else later(5000, () => game.ui.buoy("This storm is a *practice drill*: the game couldn't load a saved NASA storm, so it has no real date."));
  }
  function onLight(light, prev) {
    if (light === 'red') {
      game.sound.play('alarm');
      game.demo.check('plain-language');
      game.ui.buoy(
        where === 'shelter'
          ? 'The particles are here! In the shelter you barely feel them. *Radiation* is invisible energy that can hurt your body.'
          : where === 'outside'
            ? '*Particles are here!* Out on the Moon nothing blocks them. Get inside, *fast*!'
            : "*Particles are here!* The base walls stop some, but not enough. Get in the *shelter*!",
        { interrupt: true },
      );
    } else if (light === 'green' && prev === 'red') {
      game.ui.cheer({ title: 'ALL CLEAR!', sub: where === 'shelter' ? 'you stayed safe' : 'the storm passed' });
      game.ui.buoy(where === 'shelter' ? '*All clear!* Press E to come out of the shelter. Back to work, Commander!' : '*All clear!* The storm has passed.', { interrupt: true });
    }
  }

  // ---------- Task chip and Help ----------
  let taskKey = '';
  function updateTask(p, ripe) {
    const goals = r.goals;
    let now;
    if (lastLight === 'red' || lastLight === 'yellow') {
      now = where === 'shelter' ? 'Stay in the storm shelter until the light is green' : where === 'outside' ? 'Storm! Back through the airlock, then into the shelter' : 'Storm! Get in the storm shelter (red sign, next to the airlock)';
    } else if (p.overloaded) now = 'Too many machines! Unplug some at the power panel';
    else if (night && !p.heaterOn) now = 'Lunar night! Plug in the HEATER at the power panel';
    else if (!p.airOn) now = 'Plug in the AIR MACHINE at the power panel';
    else if (water <= 0) now = 'Out of water! Go outside and dig ice in the dark crater';
    else if (where === 'outside' && game.oxygen.value < r.lowOxygen) now = 'Suit air low! Go back in through the airlock';
    else if (where === 'outside' && water < r.waterMax && world.crater.chunks.some((c) => !c.mined)) now = 'Dig ice in the dark crater (follow the blue glow)';
    else if (where === 'shelter') now = 'Press E to leave the shelter';
    else if (ripe) now = 'Plants are ripe! Harvest them in the greenhouse';
    else if (water < 2 && ice < goals.ice + 2) now = 'Water low: go out the airlock and dig ice';
    else if (calls < goals.radio && lastCallDay !== day && p.radioOn) now = 'Call Earth at the radio desk';
    else if (calls < goals.radio && lastCallDay !== day && !night) now = 'Plug in the RADIO, then call Earth';
    else if (ice < goals.ice) now = 'Go outside and dig ice in the dark crater';
    else now = `Keep the base running until day ${r.days}`;
    const key = now + harvests + calls + ice;
    if (key === taskKey) return;
    taskKey = key;
    game.ui.task({
      now,
      steps: [
        { text: `Keep the base alive for ${r.days} Moon-days`, done: false, now: false },
        { text: 'Share out the energy plugs: AIR MACHINE first', done: p.airOn && !p.overloaded, now: !p.airOn || p.overloaded },
        { text: 'At night: only air and the heater fit on the batteries', done: night && p.heaterOn && p.airOn, now: night && !p.heaterOn },
        { text: `Harvest the plants (${Math.min(harvests, goals.harvest)}/${goals.harvest})`, done: harvests >= goals.harvest, now: ripe },
        { text: `Call Earth, once a day (${Math.min(calls, goals.radio)}/${goals.radio})`, done: calls >= goals.radio, now: false },
        { text: `Dig ice in the dark crater (${Math.min(ice, goals.ice)}/${goals.ice})`, done: ice >= goals.ice, now: water < 2 },
        { text: 'When the storm light turns yellow: get in the storm shelter', done: stormAt != null && usedShelter, now: lastLight !== 'green' },
      ],
      tips: [
        'The *air machine* needs a plug *and* water. Water runs out, so dig *ice* outside.',
        'Outside, your *suit air* drops faster. Plan short trips!',
        'In the *lunar night* you only have batteries: unplug the extras and plug in the *heater*.',
        'Call Earth to hear the *storm forecast* early.',
      ],
    });
  }

  // ---------- each frame of play ----------
  function step(dt) {
    elapsed += dt;
    missionT += dt;
    game.ui.clock(elapsed);
    const clock = dayClock(missionT, r);
    if (clock.day !== day) {
      day = clock.day;
      newDay(day);
    }
    // a slow sunset during the last day before the night
    const sunsetK = !night && day === r.nightFrom - 1 ? clock.k : 0;
    world.setDaylight(night ? 0 : 1 - sunsetK * 0.7);

    const p = power();
    const making = p.airOn && water > 0;
    water = Math.max(0, water + waterStep(making, dt, r));
    if (p.airOn && water <= 0) once('nowater', '*Out of water!* The air machine has nothing to split into oxygen. Go *outside* and dig ice in the dark crater!', { interrupt: true });
    if (water > 0 && water < 1.5) once('lowwater', 'The water tank is getting *low*. Time for an ice trip!');

    // plants
    let growing = 0;
    let ripe = false;
    for (const tr of world.greenhouse.trays) {
      const g = growStep({ lit: p.growOn, night, heaterOn: p.heaterOn }, dt, r);
      tr.frozen = g < 0;
      tr.growth = Math.max(0, Math.min(1, tr.growth + g));
      if (p.growOn && tr.growth < 1) growing++;
      if (tr.growth >= 1) ripe = true;
    }
    if (ripe) once('ripe', 'Some plants are *ripe*! Look at the glowing tray in the greenhouse and press E.');
    if (night && !p.heaterOn) {
      once('cold', '*Brrr!* Without the heater the base gets freezing: you shiver and breathe harder, and the *plants freeze*. Plug in the *HEATER*!', { interrupt: true });
    }

    // the storm
    if (stormAt == null && day === stormDay && clock.k > 0.3) startStorm();
    const light = stormLight(stormAt == null ? null : missionT - stormAt, r);
    if (light !== lastLight) {
      const prev = lastLight;
      lastLight = light;
      game.storm.light(light);
      onLight(light, prev);
    }
    if (light === 'red' && where === 'outside') {
      redOutside += dt;
      if (redOutside > r.storm.maxRedOutside) {
        game.oxygen.change(-game.oxygen.value - 1, STORM_OUT);
        return;
      }
    }
    if (light === 'red' && where !== 'shelter' && Math.random() < 14 * strength * dt) game.sound.play('tick');

    // oxygen
    const o = oxygenStep(
      { where: where === 'moving' ? (player.outside ? 'outside' : 'inside') : where, making, heaterOn: p.heaterOn, night, growing, storm: light, strength },
      dt,
      r,
    );
    game.oxygen.change(o.delta, o.reason);
    if (disposed) return;
    minOxygen = Math.min(minOxygen, game.oxygen.value);
    if (game.oxygen.value < r.lowOxygen) once('low', where === 'outside' ? 'Your *suit air* is getting low. Head back to the *airlock*!' : 'Oxygen is getting low. Check the *AIR MACHINE* has a plug and water!');
    if (game.oxygen.value < r.veryLowOxygen) once('verylow', '*Oxygen very low!* Get inside and make sure the air machine is running!', { interrupt: true });

    // progress: surviving the days, plus the jobs
    const prog = progressFor({ fraction: clock.fraction, harvests, calls, ice }, r);
    game.progress.change(prog - game.progress.value);
    if (harvests && calls && usedShelter && toggledPower) game.demo.check('five-topics');

    radioStep(dt);

    // the world shows what's going on
    world.tank.setLevel(water / r.waterMax);
    world.tank.setMaking(making);
    world.panel.setHint(p.overloaded || (night && !p.heaterOn) || !p.airOn);
    world.shelter.setHint(light !== 'green' && where === 'inside');
    world.setAlarm(light === 'red' ? 2 : light === 'yellow' ? 1 : p.overloaded ? 1 : 0);
    world.radio.set({ ready: lastCallDay !== day && !radio, powered: p.radioOn });
    if (!radio && lastCallDay !== day) world.radio.set({ text: p.radioOn ? 'Press the button to call Earth' : 'No power: plug in the RADIO' });
    beaconMat.opacity = (easy ? 0.22 : 0.12) * (water < r.waterMax ? 1 : 0.3);

    // the sign at the top
    const waterText = `water ${Math.round(water * 10) / 10}/${r.waterMax}`;
    if (light === 'yellow') setBanner('warning', 'Solar flare!', 'get in the storm shelter', '!', clock.fraction);
    else if (light === 'red') setBanner('storm', 'Particle storm', where === 'shelter' ? 'you are in the shelter' : 'get to the shelter!', '☢', clock.fraction);
    else setBanner(night ? 'night' : 'day', `Day ${day} of ${r.days}`, `${night ? 'lunar night' : 'sunlight'} · ${waterText}`, night ? '☾' : '☀', clock.fraction);

    // what you're looking at
    const aimed = aimedThing();
    for (const s of world.panel.sockets) s.aimed = aimed?.item === s;
    for (const tr of world.greenhouse.trays) tr.aimed = aimed?.item === tr;
    world.radio.setAimed(aimed?.kind === 'radio');
    const text = label(aimed);
    const promptNow = text ? `[E] ${text}` : where === 'outside' && player.grounded ? '[Space] Hop in Moon gravity' : null;
    if (promptNow !== promptKey) {
      promptKey = promptNow;
      game.ui.prompt(promptNow);
      game.ui.target(Boolean(aimed));
    }
    updateTask(p, ripe);
    if (player.takeAction() && aimed && !game.ui.puzzleOpen) use(aimed);

    if (import.meta.env?.DEV) {
      window.__apollo = { day, night, water, harvests, calls, ice, where, light, stormDay, plugs: [...plugged], aimed: aimed?.kind ?? null, missionT };
    }

    if (clock.done) complete();
  }

  // ---------- done ----------
  function complete() {
    stage = 'done';
    game.progress.change(progressFor({ fraction: 1, harvests, calls, ice }, r) - game.progress.value);
    game.ui.cheer({ title: 'MISSION COMPLETE!', big: true });
    game.ui.prompt(null);
    game.ui.target(false);
    player.setEnabled(false);
    banner.hidden = true;
    game.demo.check('teaches-one-thing');
    game.ui.buoy(
      demo ? `${r.days} Moon-days survived! Power, air, water, food, radio and a *real solar storm*.` : `*${r.days} Moon-days!* You kept Moon Base Apollo alive, *Commander ${name}*!`,
      { interrupt: true },
    );
    later(4200, async () => {
      player.exitLock();
      if (!demo) {
        await game.ui.card({
          tone: 'win',
          eyebrow: 'Checkpoint 4 of 4',
          title: 'Commander Badge!',
          text: [
            `You shared out the power, made air from water, dug ice, grew food, called Earth and kept your crew safe from a solar storm. You're a real *Commander*, ${name}!`,
            `Harvests: *${harvests}* · Calls to Earth: *${calls}* · Ice dug: *${ice}*.`,
            'The golden *Commander Badge* goes on your suit. Olympus Academy is complete!',
          ],
          choices: [{ id: 'ok', label: 'Pin it on!' }],
        });
      }
      await whatReallyHappened();
      game.finish({ stars: starsFor({ progress: game.progress.value, minOxygen }, r), passed: true, badge: 'commander-badge' });
      game.web?.window('moon');
    });
  }

  function whatReallyHappened() {
    if (!record) {
      return game.ui.card({
        eyebrow: 'What really happened',
        title: 'That was a practice drill',
        text: ["The game couldn't load a saved NASA storm this time, so this storm wasn't a real one. Real storms always show their date."],
        choices: [{ id: 'ok', label: 'OK' }],
      });
    }
    game.demo.check('what-really-happened');
    game.demo.check('honest-data');
    return game.ui.card({
      eyebrow: 'What really happened',
      title: `A real storm from ${stormDate}`,
      text: [
        record.kidText,
        'Astronauts living on the Moon will need a shelter just like yours: thick walls of water or Moon dirt to hide behind when the Sun sends out a storm.',
        `Measured by: ${record.measuredBy}.`,
      ],
      links: [
        { title: `The ${record.strength} solar flare`, url: record.flareUrl, source: "NASA's space weather records (DONKI)", foundOn: record.savedOn },
        { title: 'The particle storm it caused', url: record.url, source: "NASA's space weather records (DONKI)", foundOn: record.savedOn },
      ],
      note: 'A saved record from NASA, not live data.',
      choices: [{ id: 'ok', label: 'Whoa!' }],
    });
  }

  // ---------- main loop ----------
  let last = performance.now();
  let raf = requestAnimationFrame(frame);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!paused) t += dt;
    const live = stage === 'live' && !paused && !game.ui.busy && game.running;
    if (live) step(dt);
    else player.clearActions();
    if (disposed) return; // Sim over can tear the stage down inside step()
    player.update(live || stage === 'done' ? dt : 0, t);
    world.update(t, paused ? 0 : dt, camera);
    arms.update(camera, dt, t, { swimming: live && player.moving, working: t < workUntil });
    renderer.clear();
    renderer.render(world.scene, camera);
    if (where !== 'shelter') {
      renderer.clearDepth();
      renderer.render(arms.scene, camera);
    }
  }

  // ---------- cleanup (the engine calls this on finish, Sim over and Try again) ----------
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHidden);
    player.dispose();
    fans.stop();
    hum.stop();
    game.ui.prompt(null);
    game.ui.target(false);
    game.ui.pause(false);
    banner.remove();
    fade.remove();
    world.dispose();
    disposeTree(arms.scene);
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}

function kidDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

