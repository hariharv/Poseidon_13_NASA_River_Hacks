// Stage 4: Hera · Pilot
// Where: a spaceship simulator, like the Orion simulator the Artemis II crew trained in.
// Job: fly the capsule toward the Moon (keep the target in the ring) through a field of space junk:
//      steer each piece out of your path before it hits, and patch the hull if one does. A real
//      solar flare from NASA's DONKI records goes off: the flash comes first, the particles follow.
//      Build the storm shelter out of supply bags and hide, or keep flying?
// Big idea: dodging and hiding keep you safe but slow the mission. Every choice costs.

import * as THREE from 'three';
import './hera.css';
import { buildWorld, SEAT_EYE, SHELTER_EYE, SHELTER_LOOK } from './world.js';
import { createControls } from './controls.js';
import { flareStrength, stormClock, shelterProtection, oxygenStep, flightStep, starsFor, minutesLater, kidDuration, junkDistance, onCollisionCourse, junkDue, leakStep } from './sim.js';
import { rulesFor } from '../../core/rules.js';

const SRC = {
  flare: 'https://science.nasa.gov/blogs/solar-cycle-25/2022/06/10/solar-flares-faqs/',
  particles: 'https://srag.jsc.nasa.gov/SpaceRadiation/What/What.cfm',
  shelterPlan: 'https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/',
  hera: 'https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/',
  artemis1: 'https://www.osti.gov/pages/servlets/purl/2447574',
  limit: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
  debris: 'https://orbitaldebris.jsc.nasa.gov/faq/',
};

const hard = rulesFor('hera', 'hard');
const REAL_NUMBERS = [
  { label: 'Time for the light from a solar flare to reach Earth', value: 'about 8 minutes', source: 'NASA Solar Flares FAQ', url: SRC.flare },
  { label: 'Time for the fastest flare particles to arrive', value: 'about 15-30 minutes (slower ones: hours to days)', source: 'NASA Space Radiation Analysis Group', url: SRC.particles },
  { label: "Time Orion's crew has to build the storm shelter", value: 'about 1 hour; they might stay inside up to a day', source: 'NASA Orion radiation protection plan', url: SRC.shelterPlan },
  { label: 'How much the shelter cuts the radiation', value: 'about 4 times less (Artemis I measurements)', source: 'Artemis I radiation results (OSTI)', url: SRC.artemis1 },
  { label: 'NASA limit for radiation over a whole astronaut career', value: '600 mSv', source: 'NASA-STD-3001 radiation brief', url: SRC.limit },
  { label: 'Large pieces of space junk tracked around Earth', value: 'about 50,000', source: 'NASA Orbital Debris Program Office', url: SRC.debris },
  { label: 'How fast space junk flies near Earth', value: '7-8 km per second (about 15,700-17,900 mph)', source: 'NASA Orbital Debris Program Office', url: SRC.debris },
  { label: 'Times the space station has moved to dodge junk (since 1999)', value: '41', source: 'NASA Orbital Debris Program Office', url: SRC.debris },
  { label: 'In this sim: oxygen lost per second in the red storm, out of the shelter', value: `${hard.stormDosePerSec} × the flare's strength`, source: 'Game rules (Hard mode)' },
];

const CONTROLS = [
  { label: 'Turn the ship', value: 'W A S D (or the arrow keys)' },
  { label: 'Fire the engine', value: 'Hold Space while the diamond is in the ring' },
  { label: 'Dodge space junk', value: 'Steer until the red ring turns green' },
  { label: 'Look around', value: 'Move the mouse' },
  { label: 'Use things (shelter, bags, switches)', value: 'Look at it, press E (or click)' },
];

export default {
  id: 'hera',
  name: 'Hera',
  rank: 'Pilot',
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

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-label', 'Inside a spaceship simulator, looking out at space');
  game.root.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 3000);
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const world = buildWorld({ suit: game.player.suit, bags: r.bags, renderer, hints: easy ? 'more' : 'fewer' });
  world.setRingRadius(r.aimRing);

  // ---------- the real storm (a saved NASA DONKI record) ----------
  const record = game.data?.storm?.() ?? null;
  const strength = flareStrength(record?.strength);
  const realGap = kidDuration(minutesLater(record ?? {}));
  const stormDate = record ? kidDate(record.date) : null;

  // ---------- the storm sign at the top of the visor ----------
  const banner = document.createElement('div');
  banner.className = 'hera-sign';
  banner.hidden = true;
  banner.innerHTML = `
    <span class="hera-icon" aria-hidden="true"></span>
    <span class="hera-words"><span class="hera-phase"></span><span class="hera-sub"></span></span>
    <span class="hera-timer"><span class="hera-timer-fill"></span></span>`;
  game.root.append(banner);
  const $phase = banner.querySelector('.hera-phase');
  const $sub = banner.querySelector('.hera-sub');
  const $icon = banner.querySelector('.hera-icon');
  const $fill = banner.querySelector('.hera-timer-fill');
  let bannerKey = '';
  function setBanner(kind, phase, sub, icon, fill) {
    const key = kind + phase + sub;
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

  // ---------- state ----------
  let stage = 'briefing'; // briefing -> fly -> done
  let where = 'seat'; // seat | moving | shelter
  let paused = false;
  let t = 0;
  let elapsed = 0;
  let flashAt = null; // `elapsed` when the flare went off
  let lastPhase = 'calm';
  let bagsPlaced = 0;
  let hose = false;
  let faultIndex = 0;
  let faultOn = false;
  let minOxygen = game.oxygen.value;
  let promptKey = null;
  let screenTick = 0;
  let lastInput = 0;
  let disposed = false;
  let redAtSeat = 0;
  let clearAt = null;
  // space junk
  const junk = []; // { piece, age }
  let sinceJunk = 0;
  let hits = 0;
  let dodged = 0;
  let leaking = false;
  let junkDanger = null; // the closest piece still on a collision course
  const attInv = new THREE.Quaternion();
  const jLocal = new THREE.Vector3();
  const jRight = new THREE.Vector3();
  const jUp = new THREE.Vector3();
  const progressNow = () => game.progress.value;
  const doseHistory = new Array(60).fill(0);
  const att = new THREE.Quaternion();
  const spin = new THREE.Vector2(); // x = yaw rate, y = pitch rate (rad/s)
  const qa = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(1, 0, 0);
  const local = new THREE.Vector3();
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

  // The target starts a little off the nose, so you have to steer onto it.
  const startTarget = world.boresight.clone().applyAxisAngle(axisY, 0.22).applyAxisAngle(axisX, -0.08).normalize();
  world.setTargetDirection(startTarget);
  world.setAttitude(att);
  const seatPitch = Math.asin(world.boresight.y);

  const controls = createControls({
    camera,
    dom: renderer.domElement,
    eye: SEAT_EYE,
    onPointerChange(locked) {
      if (locked) setPaused(false);
      else if (stage === 'fly' && game.running && !controls.dragMode && !game.ui.puzzleOpen) setPaused(true);
    },
    onPointerError(dragMode) {
      if (dragMode && paused) setPaused(false);
    },
  });
  controls.moveTo(SEAT_EYE, { yaw: 0, pitch: seatPitch, seconds: 0.01 });
  controls.setEnabled(false);

  function setPaused(on) {
    if (paused === on) return;
    paused = on;
    game.ui.pause(on, resume);
    controls.setEnabled(!on && stage === 'fly');
  }
  function resume() {
    if (controls.dragMode) setPaused(false);
    else controls.requestLock();
  }
  const onKey = (e) => {
    if (stage !== 'fly' || !game.running) return;
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
    if (document.hidden && stage === 'fly') {
      setPaused(true);
      controls.exitLock();
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  // cabin sounds
  const fans = game.sound.loop('air', 0.9);
  const hum = game.sound.loop('hum', 0.7);
  const rumble = game.sound.loop('engine', 0);

  // ---------- briefing ----------
  drawScreens(0);
  (async () => {
    await game.ui.card({
      eyebrow: demo ? 'Judge Demo · Stage 4 · Hera' : 'Stage 4 of 5 · Hera',
      title: 'The ship simulator',
      text: demo
        ? ['Fly the capsule toward the Moon through a field of *space junk*: dodge it! A *real solar storm* from NASA records will hit too: build the shelter and hide, or keep flying?']
        : [
            "Before every flight, real astronauts practise in a *spaceship simulator*. The Artemis II crew trained in one like this in Houston. Today you're the *pilot*, flying to the Moon.",
            'Steer the *green diamond* into the *ring* on your window, then *hold Space* to fire the engine. Your path goes through a field of *space junk*: steer each piece out of your way!',
            'And watch your *storm light*: the Sun can surprise you.',
          ],
      facts: CONTROLS,
      choices: [{ id: 'go', label: 'Strap in' }],
    });
    if (!game.running) return;
    await game.ui.countdown();
    if (!game.running) return;
    stage = 'fly';
    controls.setEnabled(true);
    controls.requestLock();
    game.demo.check('browser-playable');
    game.demo.check('two-bars');
    game.ui.buoy(
      demo
        ? 'Turn the ship with *W A S D* until the *green diamond* sits in the ring, then *hold Space* to fire the engine.'
        : "You're the *pilot* now! Turn the ship with *W A S D* until the *green diamond* sits inside the ring, then *hold Space* to fire the engine.",
    );
    if (easy) later(9000, () => progressNow() < 4 && game.ui.buoy('Small taps work best. The ship keeps turning after you let go, just like in real space!'));
  })();

  // ---------- the flare ----------
  function flare() {
    flashAt = elapsed;
    world.flash();
    game.sound.play('flash');
    game.storm.light('yellow');
    if (record) game.demo.check('real-dataset');
    game.ui.buoy("*Solar flare!* That flash of light took 8 minutes to get here from the Sun. The fast *particles* come next!", { interrupt: true });
    if (record) later(4200, () => game.ui.buoy(`This flare really happened on *${stormDate}*! It was an *${record.strength}* flare. NASA saved it in their space weather records.`));
    else later(4200, () => game.ui.buoy("This one is a *practice drill*: we couldn't load a saved NASA storm, so it has no real date."));
    later(8800, () => {
      game.ui.buoy('A *space storm* is a blast of energy from the Sun. Its *radiation* is invisible energy that can hurt your body.');
      game.demo.check('plain-language');
    });
    later(demo ? 3000 : 13500, () => {
      if (where === 'seat' && lastPhase === 'warning') {
        game.ui.buoy(
          easy || demo
            ? 'Build the *storm shelter*: look *down to your right* at the yellow handle and press E. Or keep flying... your choice!'
            : 'Shelter or keep flying? The handle is down to your right.',
        );
      }
    });
  }

  function onPhase(phase, prev) {
    if (phase === 'storm') {
      game.sound.play('alarm');
      game.demo.check('every-choice-costs');
      if (where === 'shelter') {
        game.ui.buoy(`The particles are here! In a finished shelter the radiation reaches you about *four times slower*.`, { interrupt: true });
      } else {
        game.ui.buoy("*Particles are here!* You're out of the shelter, so every second in the red costs oxygen.", { interrupt: true });
      }
      later(7000, () => game.ui.buoy('Radiation is invisible! Apollo astronauts saw tiny *flashes of light* in their eyes when particles zipped through.'));
    } else if (phase === 'clear' && prev === 'storm') {
      clearAt = elapsed;
      game.ui.cheer({ title: 'ALL CLEAR!', sub: where === 'shelter' ? 'you stayed safe' : 'the storm passed' });
      game.ui.buoy(
        where === 'shelter'
          ? '*All clear!* The storm passed. Float back to your *seat* and finish the burn.'
          : '*All clear!* The storm passed. Next time, real crews would hide in the shelter.',
        { interrupt: true },
      );
    }
  }

  // ---------- sim supervisor faults ----------
  function startFault() {
    faultOn = true;
    world.setJetBlink(true);
    game.sound.play('alarm');
    game.ui.buoy(
      faultIndex === 0
        ? "*Thruster stuck!* The trainers love surprises. That's how real astronauts practise. Find the blinking *JET RESET* switch on your left and press E."
        : '*Another stuck thruster!* JET RESET switch, on your left!',
      { interrupt: true },
    );
  }
  function fixFault() {
    game.ui.cheer({ title: 'THRUSTER FIXED!', sub: 'back on course' });
    faultOn = false;
    faultIndex++;
    world.setJetBlink(false);
    game.sound.play('clunk');
    once(`fixed${faultIndex}`, 'Fixed! The ship stopped spinning. Now steer back onto the diamond.');
  }

  // ---------- using things ----------
  function usableNow() {
    if (stage !== 'fly' || where === 'moving') return [];
    if (where === 'seat') {
      const keys = [];
      if (faultOn) keys.push('jet');
      if (leaking) keys.push('leak');
      if (flashAt != null) keys.push('shelter');
      return keys;
    }
    const keys = ['seat'];
    if (!hose) keys.push('hose');
    world.bags.forEach((b, i) => b.state === 'stowed' && bagsPlaced < r.bags && keys.push(`bag${i}`));
    return keys;
  }
  function use(key) {
    if (key === 'shelter') {
      if (easy) clearJunk(); // nobody is steering, so on Easy the junk field gives you a break
      where = 'moving';
      game.sound.play('whoosh');
      world.setSeated(false);
      controls.moveTo(SHELTER_EYE, { ...SHELTER_LOOK, seconds: 1.3 }, () => {
        where = 'shelter';
        if (record && lastPhase !== 'calm' && lastPhase !== 'clear') game.demo.check('real-world-link');
        if (bagsPlaced < r.bags) {
          once('bags', `Stack the heavy *food and water bags* on the glowing *thin wall*. Heavy stuff blocks radiation. You need ${r.bags}.`);
        }
        if (!hose) later(3500, () => !hose && once('hose', "Don't forget your *air hose* (the blue coil)! Without it, the air in the shelter runs out."));
      });
    } else if (key === 'seat') {
      where = 'moving';
      game.sound.play('whoosh');
      controls.moveTo(SEAT_EYE, { yaw: 0, pitch: seatPitch, seconds: 1.2, limit: [-1.45, 1.45] }, () => {
        where = 'seat';
        world.setSeated(true);
        if (lastPhase === 'storm') game.ui.buoy("You left the shelter in the middle of the storm! That's brave, but it costs oxygen.");
      });
    } else if (key === 'hose') {
      hose = true;
      world.setHose(true);
      game.sound.play('hiss');
      game.ui.buoy('Air hose plugged in. *Fresh air* in the shelter!');
    } else if (key === 'jet') {
      if (game.ui.puzzleOpen) return;
      controls.setEnabled(false);
      game.ui
        .puzzle({ kind: 'sequence', title: 'Reset the stuck thruster', text: 'Type the *JET RESET* code. The ship keeps spinning until you do!', seconds: r.faultPuzzleSeconds, size: r.faultCode })
        .then((ok) => {
          if (!game.running) return;
          controls.setEnabled(true);
          controls.requestLock();
          if (ok) fixFault();
          else game.ui.buoy('Out of time! Look at the blinking *JET RESET* switch and press E to try again.', { interrupt: true });
        });
    } else if (key === 'leak') {
      if (game.ui.puzzleOpen) return;
      controls.setEnabled(false);
      game.ui
        .puzzle({ kind: 'flow', title: 'Fix the hull leak', text: "The junk cut the air lines! Drag a line between each pair of *matching dots*. Lines can't cross.", seconds: r.junk.fixSeconds, size: r.junk.fixGrid })
        .then((ok) => {
          if (!game.running) return;
          controls.setEnabled(true);
          controls.requestLock();
          if (ok) {
            leaking = false;
            world.setLeak(false);
            game.sound.play('clunk');
            game.ui.cheer({ title: 'LEAK SEALED!', sub: 'no more air escaping' });
            game.ui.buoy('Sealed! Real space stations have patch kits too, and *shields* that stop junk smaller than a marble.', { interrupt: true });
          } else game.ui.buoy('Out of time! Air is still leaking. Look at the blinking *HULL PATCH* kit and press E.', { interrupt: true });
        });
    } else if (key.startsWith('bag')) {
      const bag = world.bags[Number(key.slice(3))];
      const slot = world.slots.find((s) => !s.filled);
      if (!bag || !slot) return;
      world.sendBag(bag, slot);
      bagsPlaced++;
      game.sound.play('whoosh');
      later(850, () => game.sound.play('thud'));
      if (bagsPlaced >= r.bags) {
        game.ui.cheer({ title: 'SHELTER BUILT!', sub: hose ? 'radiation is 4x slower in here' : 'now the air hose!' });
        game.ui.buoy(
          hose ? '*Shelter built!* Now the radiation reaches you about four times slower.' : '*Shelter built!* Now plug in the *air hose* so you can breathe in here.',
          { interrupt: true },
        );
      }
    }
  }

  // ---------- space junk ----------
  function spawnJunk() {
    // it comes from just about where you're pointing: right at you
    const b = world.boresight;
    jRight.crossVectors(b, new THREE.Vector3(0, 1, 0)).normalize();
    jUp.crossVectors(jRight, b).normalize();
    const off = 0.015 + Math.random() * 0.045;
    const spin = Math.random() * Math.PI * 2;
    const u = b.clone().multiplyScalar(Math.cos(off)).addScaledVector(jRight, Math.cos(spin) * Math.sin(off)).addScaledVector(jUp, Math.sin(spin) * Math.sin(off));
    const piece = world.spawnJunk(u.applyQuaternion(att));
    junk.push({ piece, age: 0 });
    sinceJunk = 0;
    game.sound.play('warn');
    if (!once('junk1', '*Space junk!* Old bits of rockets and satellites race around Earth. The red ring means it will hit you: *steer* until its ring turns *green*!', { interrupt: true })) {
      if (Math.random() < 0.35) game.ui.buoy(['Junk ahead! Steer away!', 'Another piece! Turn the ship!', 'Incoming junk! Red ring = it will hit!'][Math.floor(Math.random() * 3)]);
    }
  }
  function junkStep(dt) {
    const p = progressNow();
    sinceJunk += dt;
    const calm = !easy || (lastPhase !== 'storm' && !faultOn);
    if (where === 'seat' && calm && junkDue({ sinceLast: sinceJunk, progress: p, active: junk.length }, r.junk)) spawnJunk();
    attInv.copy(att).invert();
    junkDanger = null;
    for (let i = junk.length - 1; i >= 0; i--) {
      const j = junk[i];
      j.age += dt;
      const dist = junkDistance(j.age, r.junk);
      jLocal.copy(j.piece.dir).applyQuaternion(attInv);
      const danger = onCollisionCourse(jLocal.angleTo(world.boresight), r.junk);
      if (danger && (!junkDanger || dist < junkDanger.dist)) junkDanger = { dist, local: jLocal.clone() };
      world.setJunk(j.piece, Math.max(dist, 2.4), danger, dt);
      if (dist <= (danger ? 0 : 3)) {
        world.removeJunk(j.piece);
        junk.splice(i, 1);
        if (danger) junkHit();
        else junkDodged();
      }
    }
  }
  function junkHit() {
    hits++;
    world.impact();
    game.sound.play('thud');
    game.sound.play('alarm');
    game.oxygen.change(-r.junk.hitOxygen, 'junk-hit');
    if (!leaking) {
      leaking = true;
      world.setLeak(true);
      game.ui.buoy(
        hits === 1
          ? "*BANG!* Junk hit the ship and made a tiny hole: air is leaking out! Press E on the blinking *HULL PATCH* kit (on your right)."
          : '*Hit again!* Another leak. Fix it at the *HULL PATCH* kit!',
        { interrupt: true },
      );
    } else game.ui.buoy('*Another hit!* Seal that leak and keep dodging!', { interrupt: true });
  }
  function junkDodged() {
    dodged++;
    game.sound.play('whoosh');
    if (dodged === 1 || dodged % 3 === 0) game.ui.cheer({ title: 'DODGED!', sub: `${dodged} piece${dodged === 1 ? '' : 's'} of junk` });
    if (dodged === 1) game.ui.buoy('*Dodged it!* Junk like that flies about 8 kilometres every second! Now steer back onto the diamond.');
  }
  function clearJunk() {
    junk.forEach((j) => world.removeJunk(j.piece));
    junk.length = 0;
    junkDanger = null;
  }

  // ---------- the Task chip and Help ----------
  let taskKey = '';
  function updateTask() {
    const storming = lastPhase === 'warning' || lastPhase === 'storm';
    let now;
    if (junkDanger && where === 'seat') now = 'Space junk! Steer until its ring turns green';
    else if (leaking && where === 'seat') now = 'Air leak! Press E on the blinking HULL PATCH kit (on your right)';
    else if (faultOn) now = 'Thruster stuck! Press E on the blinking JET RESET switch (left)';
    else if (storming && where === 'seat') now = 'Solar flare! Go to the storm shelter: yellow handle, down to your right';
    else if (where === 'shelter' && bagsPlaced < r.bags) now = `Stack the food and water bags on the glowing wall (${bagsPlaced} of ${r.bags})`;
    else if (where === 'shelter' && !hose) now = 'Plug in the air hose (the blue coil)';
    else if (where === 'shelter' && storming) now = 'Stay in the shelter until the storm passes';
    else if (where === 'shelter') now = 'All clear! Back to your seat: press E on the seat handle';
    else now = 'Steer the diamond into the ring (W A S D), then hold Space to fire the engine';
    if (now === taskKey) return;
    taskKey = now;
    const flared = flashAt != null;
    game.ui.task({
      now,
      steps: [
        { text: 'Steer the green diamond into the ring and hold Space to fire the engine', done: progressNow() >= 100, now: where === 'seat' && !faultOn && !storming && !junkDanger },
        { text: 'Space junk: steer until its red ring turns green, so it misses you', done: false, now: Boolean(junkDanger) },
        { text: 'If junk hits you: press E on the HULL PATCH kit and fix the air lines', done: false, now: leaking },
        { text: 'If a thruster gets stuck: press E on the blinking JET RESET switch and type the code', done: false, now: faultOn },
        { text: 'When the solar flare flashes: go to the shelter (yellow handle, down right)', done: flared && where !== 'seat', now: storming && where === 'seat' },
        { text: `Stack ${r.bags} food and water bags on the glowing thin wall`, done: bagsPlaced >= r.bags, now: where === 'shelter' && bagsPlaced < r.bags },
        { text: 'Plug in the air hose (blue coil)', done: hose, now: where === 'shelter' && bagsPlaced >= r.bags && !hose },
        { text: 'Wait for "All clear", then go back to your seat and finish the flight', done: false, now: where === 'shelter' && !storming && flared },
      ],
      tips: [
        'The *ring* is on your window. The *yellow arrow* points to the diamond if you lose it.',
        'Small taps on *W A S D* work best: the ship keeps turning after you let go.',
        'A *red ring* round a piece of junk means it will hit you. Steer until the ring is *green*, then steer back to the diamond.',
        'In the storm, the *shelter* makes the radiation reach you about 4 times slower. Hiding pauses the flight, but keeps you safe.',
      ],
    });
  }

  // ---------- each frame of play ----------
  function step(dt) {
    elapsed += dt;
    game.ui.clock(elapsed, r.stars.speedySeconds);
    const clock = stormClock(flashAt == null ? null : elapsed - flashAt, r);
    if (clock.light !== game.storm.value) game.storm.light(clock.light);
    if (clock.phase !== lastPhase) {
      const prev = lastPhase;
      lastPhase = clock.phase;
      onPhase(clock.phase, prev);
    }

    // turning the ship: thrusters push, and the ship keeps turning (there's no air to slow it)
    const input = controls.turnInput();
    world.setStick(input.x, input.y);
    const pushing = input.lengthSq() > 0;
    if (pushing && !lastInput) game.sound.play('thruster');
    lastInput = pushing ? 1 : 0;
    const burning = where === 'seat' && controls.burnHeld();
    world.setThrottle(burning);
    rumble.set(burning ? 1 : pushing ? 0.5 : 0);
    if (burning) {
      // the main engine shakes the ship: keep correcting to stay in the ring
      spin.x += (Math.random() - 0.5) * r.burnShake * 6 * dt;
      spin.y += (Math.random() - 0.5) * r.burnShake * 6 * dt;
    }
    spin.x += input.x * r.turnRate * 2.6 * dt;
    spin.y += input.y * r.turnRate * 2.6 * dt;
    // little wobbles (the trainers add these), stronger in Hard
    spin.x += (Math.sin(t * 0.37) + Math.sin(t * 0.91 + 1)) * r.drift * 0.5 * dt;
    spin.y += (Math.sin(t * 0.53 + 2) + Math.sin(t * 1.13)) * r.drift * 0.35 * dt;
    if (faultOn) spin.x += r.faultSpin * 1.4 * dt;
    // the ship's computer gently damps the spin (stronger while you're holding the stick)
    const damp = Math.exp(-(pushing ? 0.6 : 1.4) * dt);
    spin.multiplyScalar(damp);
    spin.clampLength(0, r.turnRate);
    att.multiply(qa.setFromAxisAngle(axisY, -spin.x * dt));
    att.multiply(qa.setFromAxisAngle(axisX, spin.y * dt));
    att.normalize();
    world.setAttitude(att);
    junkStep(dt);
    if (disposed) return; // a junk hit can end the run

    world.targetInShip(local);
    const error = local.angleTo(world.boresight);
    world.setGuide(local, error);

    // Progress: only from the pilot's seat
    if (where === 'seat') {
      const gain = burning ? flightStep(error, dt, r) * r.burnBoost : 0;
      if (gain > 0) game.progress.change(gain);
      if (!burning && error <= r.aimRing) once('ontarget', "*On target!* Now *hold Space* to fire the engine. Keep the diamond in the ring while it shakes!");
      if (gain > 0 && error <= r.aimRing && once('burning', "That's it! The engine is firing and the *Progress bar* fills. Real pilots call this a *burn*.")) game.ui.cheer({ title: 'ENGINE BURN!', sub: 'keep it in the ring' });
      if (burning && error > r.aimRing * 2) once('offburn', 'Off target! The engine only helps when the *diamond is in the ring*.');
      if (error > 0.5) once('lost', 'Lost the diamond? Follow the *yellow arrow* on your window.');
    }

    // oxygen
    const o = oxygenStep({ light: clock.light, where: where === 'shelter' ? 'shelter' : 'seat', bags: bagsPlaced, hose, strength }, dt, r);
    game.oxygen.change(o.delta, o.reason);
    if (leaking) game.oxygen.change(leakStep(true, dt, r.junk), 'hull-leak');
    if (disposed) return;
    minOxygen = Math.min(minOxygen, game.oxygen.value);
    if (game.oxygen.value < r.lowOxygen) once('low', 'Your oxygen is getting low. Careful, Pilot!');
    if (game.oxygen.value < r.veryLowOxygen) once('verylow', '*Oxygen very low!* Get into a finished shelter with the air hose!', { interrupt: true });

    // the storm: geiger ticks + light flashes, only where the particles reach you
    if (clock.light === 'red') {
      const reach = where === 'shelter' ? shelterProtection(bagsPlaced, r.bags) : 1;
      if (Math.random() < 16 * strength * reach * dt) game.sound.play('tick');
      world.setSpecks(where === 'shelter' ? 2 * reach : 9 * strength);
      if (where !== 'shelter') {
        redAtSeat += dt;
        if (redAtSeat > 6) once('stillout', 'Still out of the shelter... Real crews hide when the alarm says *shelter now*.');
      }
    } else world.setSpecks(0);
    world.setAlarm(clock.light === 'red' ? 2 : clock.light === 'yellow' ? 1 : 0);

    // the sign at the top
    if (clock.phase === 'warning') setBanner('warning', 'Solar flare!', `particles in ${Math.ceil(clock.secondsLeft)} s`, '!', 1 - clock.fill);
    else if (clock.phase === 'storm') setBanner('storm', 'Particle storm', where === 'shelter' ? 'you are in the shelter' : 'get to the shelter!', '☢', clock.fill);
    else if (junkDanger && where === 'seat') setBanner('warning', 'Space junk!', 'steer it out of your ring', '⚠', 1 - junkDanger.dist / r.junk.startDistance);
    else if (leaking) setBanner('storm', 'Air leak', 'fix it at the HULL PATCH kit', '!', 1);
    else if (clock.phase === 'clear' && clearAt != null && elapsed - clearAt < 5) setBanner('clear', 'All clear', 'the storm passed', '✓', 0);
    else banner.hidden = true;

    // faults the trainers throw at you (in Easy, never during the storm)
    if (!faultOn && faultIndex < r.faults.length && progressNow() >= r.faults[faultIndex] && where === 'seat') {
      if (!easy || clock.light === 'green') startFault();
    }

    // the flare goes off partway through the flight
    if (flashAt == null && progressNow() >= r.stormAtProgress) flare();

    // what you're looking at
    const keys = usableNow();
    world.setGlow(keys, t);
    const aimed = world.aimed(camera, keys);
    const burnHint = !aimed && where === 'seat' && junkDanger ? 'Space junk ahead! Steer until its ring turns green' : !aimed && where === 'seat' && !faultOn ? (error <= r.aimRing ? (burning ? 'Engine firing! Keep the diamond in the ring' : 'Hold [Space] to fire the engine') : 'Steer the diamond into the ring: W A S D') : null;
    const promptNow = aimed ? `aim:${aimed}` : burnHint;
    if (promptNow !== promptKey) {
      promptKey = promptNow;
      game.ui.prompt(aimed ? `[E] ${world.usable[aimed].label.replace(/\*/g, '')}` : burnHint);
      game.ui.target(Boolean(aimed));
    }
    updateTask();
    if (controls.takeAction() && aimed) use(aimed);
    // dev-only readout + look hook, for testing in the browser console
    if (import.meta.env?.DEV) {
      window.__hera = { error, x: local.x, y: local.y, where, phase: lastPhase, bagsPlaced, hose, faultOn, usable: keys, aimed };
      window.__heraLook = (yaw, pitch) =>
        controls.moveTo(where === 'shelter' ? SHELTER_EYE : SEAT_EYE, { yaw, pitch, seconds: 0.01, limit: where === 'shelter' ? SHELTER_LOOK.limit : [-1.45, 1.45] });
    }

    // screens (a few times a second)
    screenTick += dt;
    if (screenTick > 0.12) {
      screenTick = 0;
      drawScreens(error, clock);
    }

    if (progressNow() >= 100) complete();
  }

  // ---------- the three cockpit screens ----------
  function drawScreens(error, clock = stormClock(null, r)) {
    const { flight, hera, shelter } = world.screens;
    // FLIGHT: where the target is compared with the ring
    {
      const g = flight.ctx;
      screenBase(g, 'FLIGHT', '#5bd98a');
      const cx = 256;
      const cy = 180;
      const ring = 46;
      g.strokeStyle = '#5bd98a';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, cy, ring, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(91,217,138,0.25)';
      g.beginPath();
      g.moveTo(cx - 140, cy);
      g.lineTo(cx + 140, cy);
      g.moveTo(cx, cy - 120);
      g.lineTo(cx, cy + 120);
      g.stroke();
      const right = new THREE.Vector3(1, 0, 0);
      const up = new THREE.Vector3().crossVectors(right, world.boresight).normalize();
      const scale = ring / r.aimRing;
      const dx = THREE.MathUtils.clamp(local.dot(right) * scale, -150, 150);
      const dy = THREE.MathUtils.clamp(local.dot(up) * scale, -110, 110);
      g.fillStyle = error <= r.aimRing ? '#5bd98a' : '#ffc145';
      g.save();
      g.translate(cx + dx, cy - dy);
      g.rotate(Math.PI / 4);
      g.fillRect(-11, -11, 22, 22);
      g.restore();
      // space junk on the radar: red X = coming at you, green = will miss
      for (const j of junk) {
        jLocal.copy(j.piece.dir).applyQuaternion(attInv);
        const jx = THREE.MathUtils.clamp(jLocal.dot(right) * scale, -150, 150);
        const jy = THREE.MathUtils.clamp(jLocal.dot(up) * scale, -110, 110);
        const bad = onCollisionCourse(jLocal.angleTo(world.boresight), r.junk);
        g.strokeStyle = bad ? '#ff4d5e' : '#5bd98a';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(cx + jx - 10, cy - jy - 10);
        g.lineTo(cx + jx + 10, cy - jy + 10);
        g.moveTo(cx + jx + 10, cy - jy - 10);
        g.lineTo(cx + jx - 10, cy - jy + 10);
        g.stroke();
      }
      g.fillStyle = '#fff3d6';
      g.font = '26px "Martian Mono", monospace';
      g.fillText(`BURN ${Math.round(progressNow())}%`, 24, 322);
      g.textAlign = 'right';
      g.fillStyle = junkDanger ? '#ff4d5e' : '#fff3d6';
      g.fillText(junkDanger ? 'JUNK!' : error <= r.aimRing ? 'ON TARGET' : faultOn ? 'JET STUCK' : 'STEER', 488, 322);
      g.textAlign = 'left';
      flight.tex.needsUpdate = true;
    }
    // HERA: the radiation alarm
    {
      const g = hera.ctx;
      const red = clock.light === 'red';
      const reach = where === 'shelter' ? shelterProtection(bagsPlaced, r.bags) : 1;
      const level = red ? strength * reach : clock.light === 'yellow' ? 0.08 : 0.02;
      doseHistory.push(level + Math.random() * 0.02);
      doseHistory.shift();
      screenBase(g, 'HERA · RADIATION', red ? '#ff4d5e' : clock.light === 'yellow' ? '#ffc145' : '#46b4ff');
      g.strokeStyle = red ? '#ff4d5e' : '#46b4ff';
      g.lineWidth = 4;
      g.beginPath();
      doseHistory.forEach((v, i) => {
        const x = 24 + i * 7.7;
        const y = 270 - Math.min(1.3, v) * 160;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
      g.font = '34px "Lilita One", sans-serif';
      g.fillStyle = red ? (where === 'shelter' && bagsPlaced >= r.bags ? '#ffc145' : '#ff4d5e') : clock.light === 'yellow' ? '#ffc145' : '#5bd98a';
      const word = red ? (where === 'shelter' ? (bagsPlaced >= r.bags ? 'SHELTERED' : 'SHELTER: NOT DONE') : 'SHELTER NOW!') : clock.light === 'yellow' ? 'CAUTION' : 'QUIET';
      g.fillText(word, 24, 322);
      hera.tex.needsUpdate = true;
    }
    // SHELTER: the checklist
    {
      const g = shelter.ctx;
      screenBase(g, 'SHELTER', '#ffc145');
      g.font = '28px "Atkinson Hyperlegible", sans-serif';
      const rows = [
        [`Bags on thin wall: ${bagsPlaced}/${r.bags}`, bagsPlaced >= r.bags],
        ['Air hose plugged in', hose],
        ['Crew inside', where === 'shelter'],
      ];
      rows.forEach(([text, ok], i) => {
        const y = 110 + i * 62;
        g.strokeStyle = ok ? '#5bd98a' : 'rgba(255,243,214,0.5)';
        g.lineWidth = 4;
        g.strokeRect(26, y - 26, 32, 32);
        if (ok) {
          g.strokeStyle = '#5bd98a';
          g.beginPath();
          g.moveTo(32, y - 10);
          g.lineTo(41, y);
          g.lineTo(54, y - 20);
          g.stroke();
        }
        g.fillStyle = ok ? '#fff3d6' : 'rgba(255,243,214,0.7)';
        g.fillText(text, 74, y);
      });
      g.font = '24px "Martian Mono", monospace';
      g.fillStyle = clock.light === 'red' ? '#ff4d5e' : '#ffc145';
      if (clock.phase === 'warning') g.fillText(`PARTICLES IN ${Math.ceil(clock.secondsLeft)} S`, 26, 318);
      else if (clock.phase === 'storm') g.fillText(`STORM: ${Math.ceil(clock.secondsLeft)} S LEFT`, 26, 318);
      shelter.tex.needsUpdate = true;
    }
  }

  // ---------- done ----------
  function complete() {
    stage = 'done';
    clearJunk();
    leaking = false;
    world.setLeak(false);
    game.ui.cheer({ title: 'COURSE SET FOR THE MOON!', big: true });
    game.ui.prompt(null);
    game.ui.target(false);
    controls.setEnabled(false);
    world.setSpecks(0);
    banner.hidden = true;
    game.ui.buoy(
      demo ? 'Burn complete! You flew the capsule and got through a *real space storm*.' : `Burn complete! You're on your way to the Moon, *Pilot ${game.player.name}*!`,
      { interrupt: true },
    );
    later(4200, async () => {
      controls.exitLock();
      if (!demo) {
        await game.ui.card({
          tone: 'win',
          eyebrow: 'Checkpoint 3 of 4',
          title: 'Pilot Wings!',
          text: [
            `You flew the capsule through a junk field and kept your crew safe from a solar storm, ${game.player.name}. You're a *Pilot*!`,
            `Junk dodged: *${dodged}* · Hits: *${hits}*`,
            'A pair of shiny *wings* goes on your suit.',
          ],
          choices: [{ id: 'ok', label: 'Pin them on!' }],
        });
      }
      await whatReallyHappened();
      game.finish({ stars: starsFor({ minOxygen, seconds: elapsed }, r), passed: true, badge: 'pilot-wings' });
      game.web?.window('ship');
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
        realGap ? `In real life the particles took *${realGap}* to arrive. The simulator sped time up so you didn't have to wait.` : 'The simulator sped time up so you didn\'t have to wait.',
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
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!paused) t += dt;
    const live = stage === 'fly' && !paused && !game.ui.busy && game.running;
    if (live) step(dt);
    else {
      controls.clearActions();
      rumble.set(0);
    }
    if (disposed) return; // Sim over can tear the stage down inside step()
    controls.update(paused || game.ui.busy ? 0 : dt, t);
    world.update(t, paused ? 0 : dt, camera);
    renderer.render(world.scene, camera);
  });

  // ---------- cleanup (the engine calls this on finish, Sim over and Try again) ----------
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHidden);
    controls.dispose();
    fans.stop();
    hum.stop();
    rumble.stop();
    game.ui.prompt(null);
    game.ui.target(false);
    game.ui.pause(false);
    banner.remove();
    world.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}

function screenBase(g, title, colour) {
  g.fillStyle = '#081019';
  g.fillRect(0, 0, 512, 340);
  g.fillStyle = 'rgba(70,180,255,0.06)';
  for (let y = 0; y < 340; y += 4) g.fillRect(0, y, 512, 1);
  g.fillStyle = colour;
  g.fillRect(0, 0, 512, 44);
  g.fillStyle = '#081019';
  g.font = '26px "Lilita One", sans-serif';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText(title, 18, 32);
}

function kidDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
