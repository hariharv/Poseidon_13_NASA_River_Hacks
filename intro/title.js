// The title screen: a fast, fun trailer made from the real game, before the character maker.
// Each stage's own 3D world plays for a few seconds with a quick camera move, a punch-in zoom and a
// big action word ("DIVE!", "FLOAT!"...), then a coloured wipe cuts to the next, round and round,
// until you press a key, click or tap Start.
//
//   await showTitle({ root })   resolves when the player starts
//
// The worlds are the ones the stages use (stages/<id>/world.js), so the cutscenes always match
// the game. If 3D isn't available, the title screen just shows the Start button.

import * as THREE from 'three';
import './title.css';
import spaceAppsLogo from '../assets/space-apps-logo.svg';
import { isTouch } from '../core/device.js';

const SCENE_SECONDS = 3.6; // each cutscene
const WIPE_LEAD = 0.3; // the wipe starts this long before the cut, so it covers the picture as it happens
const PUNCH_SECONDS = 0.55; // the zoom-in at the start of each cut
const BASE_FOV = 60;
const PUNCH_FOV = 16; // how much wider the camera starts each cut

const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

// One cutscene per stage: what to build, where the camera goes (k = 0 -> 1 over the scene), the action word and caption.
export const SCENES = [
  {
    id: 'hermes',
    word: 'Dive!',
    colour: '#46b4ff',
    eyebrow: 'Stage 1 · Hermes',
    line: "Train for spacewalks in NASA's giant pool",
    load: () => import('../stages/hermes/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more', panelCount: 3 });
      const { createBubbles } = await import('../stages/hermes/bubbles.js');
      const bubbles = createBubbles(world.scene, 120);
      return {
        world,
        shot(camera, k, t, dt) {
          // swoop down and round the station
          const e = easeOut(k);
          const a = -1.5 + e * 1.7;
          const r = 13 - e * 4.5;
          camera.position.set(4 + Math.sin(a) * r, 7.4 - e * 1.9, -2 + Math.cos(a) * r);
          camera.lookAt(2, 5.3, -2);
          camera.rotation.z += (1 - e) * 0.12;
          if (Math.random() < dt * 14) bubbles.emit(camera.position.clone().add(new THREE.Vector3(0.4, -0.5, -0.8)), 4, 0.4);
          bubbles.update(dt, t);
          world.update(t, camera);
        },
      };
    },
  },
  {
    id: 'odysseus',
    word: 'Float!',
    colour: '#ffc145',
    lines: true,
    eyebrow: 'Stage 2 · Odysseus',
    line: 'Float on the zero-G plane and catch everything that drifts away',
    load: () => import('../stages/odysseus/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more' });
      const { createTools } = await import('../stages/odysseus/tools.js');
      const tools = createTools(world.scene, { count: 8, origin: world.toolbox.mouth, speed: 0.8, hints: 'more' });
      tools.release();
      return {
        world,
        shot(camera, k, t, dt) {
          // rush down the cabin, tumbling a little
          const e = easeOut(k);
          camera.position.set(Math.sin(t * 1.3) * 0.35, 1.3 + Math.sin(t * 1.7) * 0.15, 6.8 - e * 2.4);
          camera.lookAt(0, 1.0, 1.5);
          camera.rotation.z += Math.sin(t * 1.1) * 0.14;
          world.setPitch(Math.sin(t * 0.9) * 22);
          world.toolbox.update(dt);
          tools.update(dt, t, { g: 0, camera });
          world.update(t, dt, camera);
        },
      };
    },
  },
  {
    id: 'dioscuri',
    word: 'Grab!',
    colour: '#5bd98a',
    eyebrow: 'Stage 3 · Dioscuri',
    line: "Run the space station's robot arm and its science lab",
    load: () => import('../stages/dioscuri/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more', suit: 'orange', boxes: 3 });
      world.setOrbit({ side: 'day', k: 0.25 }); // puts the Sun in the sky (it starts at the middle of the lab)
      world.inside.setSeated(false); // nobody at the desk: the camera is floating
      const tip = new THREE.Vector3();
      return {
        world,
        shot(camera, k, t, dt) {
          // push in on the window while the arm swings out and grabs
          const e = easeOut(k);
          camera.position.set(Math.sin(t * 0.6) * 0.5, 0.2 - e * 0.35, 3.0 - e * 2.2);
          camera.lookAt(0, -0.9, -6);
          camera.rotation.z += 0.06 - e * 0.06;
          const s = easeInOut(k);
          tip.set(-2.4 + s * 4.8, -1.2 + Math.sin(k * Math.PI) * 0.8, -8.4 + Math.sin(k * Math.PI) * 1.2);
          world.arm.reach(tip);
          world.update(t, dt, camera);
          world.inside.animate(t);
        },
      };
    },
  },
  {
    id: 'hera',
    word: 'Dodge!',
    colour: '#ff4d5e',
    lines: true,
    shake: 0.025,
    eyebrow: 'Stage 4 · Hera',
    line: 'Pilot the capsule through space junk and a real solar storm',
    load: () => import('../stages/hera/world.js'),
    async build(mod, renderer) {
      const world = mod.buildWorld({ suit: 'orange', bags: 3, renderer, hints: 'more' });
      const att = new THREE.Quaternion();
      const turn = new THREE.Euler();
      const look = new THREE.Vector3();
      world.setTargetDirection(world.boresight.clone());
      return {
        world,
        shot(camera, k, t, dt) {
          // bank hard left then right, so space whips past the window
          turn.set(Math.sin(t * 1.4) * 0.12, Math.sin(k * Math.PI * 1.5) * 0.55, Math.sin(k * Math.PI * 2) * 0.25);
          world.setAttitude(att.setFromEuler(turn));
          camera.position.copy(mod.SEAT_EYE);
          look.copy(mod.SEAT_EYE).addScaledVector(world.boresight, 3).add(new THREE.Vector3(Math.sin(t * 0.9) * 0.3, 0.1, 0));
          camera.lookAt(look);
          camera.rotation.z += Math.sin(k * Math.PI * 2) * 0.1;
          world.update(t, dt, camera);
        },
      };
    },
  },
  {
    id: 'apollo',
    word: 'Explore!',
    colour: '#ff5b1f',
    eyebrow: 'Stage 5 · Apollo',
    line: 'Command a base on the Moon for 14 Moon-days',
    load: () => import('../stages/apollo/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ suit: 'orange', trays: 3, iceChunks: 6, hints: 'more' });
      world.setDaylight(1);
      return {
        world,
        shot(camera, k, t, dt) {
          // sweep round the base, low over the ground, staying outside the ring of solar panel masts
          const e = easeOut(k);
          const a = 0.95 - e * 0.33;
          const r = 24 - e;
          const x = -3 + Math.cos(a) * r;
          const z = Math.sin(a) * r;
          camera.position.set(x, mod.groundAt(x, z) + 1.8 + e * 0.5, z);
          camera.lookAt(-3, 1.4, 0);
          camera.rotation.z += (1 - e) * 0.08;
          world.update(t, dt, camera);
        },
      };
    },
  },
];

export function showTitle({ root }) {
  const touch = isTouch();
  const screen = document.createElement('section');
  screen.className = 'title-screen';
  screen.setAttribute('aria-label', 'Path to Olympus title screen');
  screen.innerHTML = `
    <div class="title-vignette"></div>
    <div class="title-lines"></div>
    <div class="title-bar is-top">
      <img class="title-logo" src="${spaceAppsLogo}" alt="NASA Space Apps Challenge" />
      <p class="title-team">Team <strong>Poseidon 13</strong> presents</p>
    </div>
    <h1 class="title-name"><span>Path to</span><span>Olympus</span></h1>
    <p class="title-word" aria-hidden="true"></p>
    <div class="title-caption" aria-live="polite">
      <p class="title-eyebrow"></p>
      <p class="title-line"></p>
      <ol class="title-dots">${SCENES.map(() => '<li></li>').join('')}</ol>
    </div>
    <div class="title-bar is-bottom">
      <button type="button" class="btn title-start">${touch ? 'Tap to play!' : "Let's play!"}</button>
      <p class="title-hint">${touch ? 'Tap anywhere to begin' : 'Press any key or click to begin'}</p>
    </div>
    <div class="title-wipe"><span></span></div>
    <div class="title-flash"></div>
    <div class="title-fade is-on"></div>`;
  root.append(screen);
  const $ = (s) => screen.querySelector(s);
  const eyebrow = $('.title-eyebrow');
  const line = $('.title-line');
  const word = $('.title-word');
  const dots = [...screen.querySelectorAll('.title-dots li')];
  const fade = $('.title-fade');
  const wipe = $('.title-wipe');
  const flash = $('.title-flash');
  const captionBox = $('.title-caption');

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.className = 'title-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    screen.prepend(renderer.domElement);
  } catch {
    renderer = null; // no 3D here: the title and Start button still work
    screen.classList.add('is-flat');
    fade.classList.remove('is-on');
  }
  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 3000);
  const onResize = () => {
    renderer?.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  let current = null; // { index, world, shot, start }
  let next = null; // the next scene, built while this one plays
  let raf = 0;
  let done = false;
  let last = performance.now();
  let t = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // restart a CSS animation by toggling its class
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  async function build(index) {
    const sc = SCENES[index];
    const mod = await sc.load();
    const built = await sc.build(mod, renderer);
    return { index, ...built };
  }

  function caption(index) {
    const sc = SCENES[index];
    eyebrow.textContent = sc.eyebrow;
    line.textContent = sc.line;
    word.textContent = sc.word;
    screen.style.setProperty('--scene-colour', sc.colour);
    screen.classList.toggle('has-lines', !!sc.lines && !reduce);
    dots.forEach((d, i) => d.classList.toggle('is-on', i === index));
    replay(captionBox, 'is-new');
    replay(word, 'is-new');
  }

  async function play(index) {
    try {
      const scene = next?.index === index ? next : await build(index);
      if (done) return scene.world.dispose?.();
      const old = current;
      current = { ...scene, start: t, shake: SCENES[index].shake || 0 };
      next = null;
      caption(index);
      if (old) replay(flash, 'is-on');
      fade.classList.remove('is-on');
      old?.world.dispose?.();
      // get the next one ready in the background
      build((index + 1) % SCENES.length)
        .then((n) => (done ? n.world.dispose?.() : (next = n)))
        .catch(() => {});
    } catch (err) {
      console.error('Title cutscene failed', err);
      if (!current) {
        screen.classList.add('is-flat');
        fade.classList.remove('is-on');
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!current || !renderer) return;
    const into = t - current.start;
    const k = Math.min(1, into / SCENE_SECONDS) * (reduce ? 0.3 : 1);
    current.shot(camera, k, t, dt);
    // punch in at the start of each cut
    const punch = reduce ? 0 : 1 - easeOut(Math.min(1, into / PUNCH_SECONDS));
    const fov = BASE_FOV + PUNCH_FOV * punch;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (current.shake && !reduce) {
      camera.position.x += (Math.random() - 0.5) * current.shake;
      camera.position.y += (Math.random() - 0.5) * current.shake;
    }
    renderer.render(current.world.scene, camera);
    if (into > SCENE_SECONDS - WIPE_LEAD && !current.wiping) {
      current.wiping = true;
      wipe.style.setProperty('--wipe-colour', SCENES[(current.index + 1) % SCENES.length].colour);
      replay(wipe, 'is-on');
      word.classList.add('is-out');
    }
    if (into > SCENE_SECONDS && !current.switching) {
      current.switching = true;
      word.classList.remove('is-out');
      play((current.index + 1) % SCENES.length);
    }
  }

  if (renderer) {
    play(0);
    raf = requestAnimationFrame(frame);
  }

  return new Promise((resolve) => {
    const start = (e) => {
      if (done) return;
      if (e?.type === 'keydown' && (e.repeat || ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key))) return;
      done = true;
      window.removeEventListener('keydown', start);
      screen.removeEventListener('pointerup', start);
      screen.classList.add('is-leaving');
      setTimeout(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        current?.world.dispose?.();
        next?.world.dispose?.();
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss(); // free the 3D for the character maker
        }
        screen.remove();
        resolve();
      }, 450);
    };
    window.addEventListener('keydown', start);
    screen.addEventListener('pointerup', start);
    $('.title-start').focus({ preventScroll: true });
  });
}
