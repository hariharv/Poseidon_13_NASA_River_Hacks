// The title screen: cutscenes from the real game, before the character maker.
// Each stage's own 3D world plays for a few seconds with a slow camera move and a caption,
// then fades to the next, round and round, until you press a key, click or tap Start.
//
//   await showTitle({ root })   resolves when the player starts
//
// The worlds are the ones the stages use (stages/<id>/world.js), so the cutscenes always match
// the game. If 3D isn't available, the title screen just shows the Start button.

import * as THREE from 'three';
import './title.css';
import spaceAppsLogo from '../assets/space-apps-logo.svg';
import { isTouch } from '../core/device.js';

const SCENE_SECONDS = 6.5;
const FADE_SECONDS = 0.7;

// One cutscene per stage: what to build, where the camera goes (k = 0 -> 1 over the scene), and the caption.
const SCENES = [
  {
    id: 'hermes',
    eyebrow: 'Stage 1 · Hermes',
    line: "Train for spacewalks in NASA's giant pool",
    load: () => import('../stages/hermes/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more', panelCount: 3 });
      const { createBubbles } = await import('../stages/hermes/bubbles.js');
      const bubbles = createBubbles(world.scene, 80);
      return {
        world,
        shot(camera, k, t, dt) {
          const a = -0.9 + k * 1.1;
          camera.position.set(4 + Math.sin(a) * 10, 5.6 + Math.sin(t * 0.4) * 0.3, -2 + Math.cos(a) * 9);
          camera.lookAt(2, 5.5, -2);
          if (Math.random() < dt * 6) bubbles.emit(camera.position.clone().add(new THREE.Vector3(0.3, -0.4, -0.6)), 3, 0.3);
          bubbles.update(dt, t);
          world.update(t, camera);
        },
      };
    },
  },
  {
    id: 'odysseus',
    eyebrow: 'Stage 2 · Odysseus',
    line: 'Float on the zero-G plane and catch everything that drifts away',
    load: () => import('../stages/odysseus/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more' });
      const { createTools } = await import('../stages/odysseus/tools.js');
      const tools = createTools(world.scene, { count: 6, origin: world.toolbox.mouth, speed: 0.6, hints: 'more' });
      tools.release();
      return {
        world,
        shot(camera, k, t, dt) {
          camera.position.set(Math.sin(t * 0.3) * 0.3, 1.35 + Math.sin(t * 0.7) * 0.12, 6.6 - k * 2.6);
          camera.lookAt(0, 1.0, 1.5);
          camera.rotation.z += Math.sin(t * 0.5) * 0.05; // floating, a little tilted
          world.setPitch(Math.sin(t * 0.35) * 18);
          world.toolbox.update(dt);
          tools.update(dt, t, { g: 0, camera });
          world.update(t, dt, camera);
        },
      };
    },
  },
  {
    id: 'dioscuri',
    eyebrow: 'Stage 3 · Dioscuri',
    line: "Run the space station's robot arm and its science lab",
    load: () => import('../stages/dioscuri/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ hints: 'more', suit: 'orange', boxes: 3 });
      const tip = new THREE.Vector3();
      return {
        world,
        shot(camera, k, t, dt) {
          camera.position.set(Math.sin(t * 0.25) * 0.4, 0.15 - k * 0.3, 2.9 - k * 1.9);
          camera.lookAt(0, -0.9, -6);
          tip.set(Math.sin(t * 0.5) * 2.5, -1.1 + Math.sin(t * 0.8) * 0.4, -8.2 + Math.cos(t * 0.5) * 0.8);
          world.arm.reach(tip);
          world.update(t, dt, camera);
          world.inside.animate(t);
        },
      };
    },
  },
  {
    id: 'hera',
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
          turn.set(Math.sin(t * 0.2) * 0.06, -0.15 + k * 0.3, 0);
          world.setAttitude(att.setFromEuler(turn)); // the ship slowly turns, so space drifts past the window
          camera.position.copy(mod.SEAT_EYE);
          look.copy(mod.SEAT_EYE).addScaledVector(world.boresight, 3).add(new THREE.Vector3(Math.sin(t * 0.3) * 0.25, 0.1, 0));
          camera.lookAt(look);
          world.update(t, dt, camera);
        },
      };
    },
  },
  {
    id: 'apollo',
    eyebrow: 'Stage 5 · Apollo',
    line: 'Command a base on the Moon for 14 Moon-days',
    load: () => import('../stages/apollo/world.js'),
    async build(mod) {
      const world = mod.buildWorld({ suit: 'orange', trays: 3, iceChunks: 6, hints: 'more' });
      world.setDaylight(1);
      return {
        world,
        shot(camera, k, t, dt) {
          const x = 15 - k * 5;
          const z = 7 - k * 9;
          camera.position.set(x, mod.groundAt(x, z) + 2.2 + Math.sin(t * 0.5) * 0.1, z);
          camera.lookAt(-3, 1.6, 0); // the base, with Earth low on the horizon behind it
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
    <div class="title-bar is-top">
      <img class="title-logo" src="${spaceAppsLogo}" alt="NASA Space Apps Challenge" />
      <p class="title-team">Team <strong>Poseidon 13</strong> presents</p>
    </div>
    <h1 class="title-name"><span>Path to</span><span>Olympus</span></h1>
    <div class="title-caption" aria-live="polite">
      <p class="title-eyebrow"></p>
      <p class="title-line"></p>
      <ol class="title-dots">${SCENES.map(() => '<li></li>').join('')}</ol>
    </div>
    <div class="title-bar is-bottom">
      <button type="button" class="btn title-start">${touch ? 'Tap to start' : 'Start'}</button>
      <p class="title-hint">${touch ? 'Tap anywhere to begin' : 'Press any key or click to begin'}</p>
    </div>
    <div class="title-fade"></div>`;
  root.append(screen);
  const $ = (s) => screen.querySelector(s);
  const eyebrow = $('.title-eyebrow');
  const line = $('.title-line');
  const dots = [...screen.querySelectorAll('.title-dots li')];
  const fade = $('.title-fade');

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = 'title-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    screen.prepend(renderer.domElement);
  } catch {
    renderer = null; // no 3D here: the title and Start button still work
    screen.classList.add('is-flat');
  }
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 3000);
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

  async function build(index) {
    const sc = SCENES[index];
    const mod = await sc.load();
    const built = await sc.build(mod, renderer);
    return { index, ...built };
  }

  function caption(index) {
    eyebrow.textContent = SCENES[index].eyebrow;
    line.textContent = SCENES[index].line;
    dots.forEach((d, i) => d.classList.toggle('is-on', i === index));
    screen.querySelector('.title-caption').classList.remove('is-new');
    void screen.offsetWidth;
    screen.querySelector('.title-caption').classList.add('is-new');
  }

  async function play(index) {
    try {
      const scene = next?.index === index ? next : await build(index);
      if (done) return scene.world.dispose?.();
      const old = current;
      current = { ...scene, start: t };
      next = null;
      caption(index);
      fade.classList.remove('is-on');
      old?.world.dispose?.();
      // get the next one ready in the background
      build((index + 1) % SCENES.length)
        .then((n) => (done ? n.world.dispose?.() : (next = n)))
        .catch(() => {});
    } catch (err) {
      console.error('Title cutscene failed', err);
      if (!current) screen.classList.add('is-flat');
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
    renderer.render(current.world.scene, camera);
    if (into > SCENE_SECONDS - FADE_SECONDS && !fade.classList.contains('is-on')) fade.classList.add('is-on');
    if (into > SCENE_SECONDS && !current.switching) {
      current.switching = true;
      play((current.index + 1) % SCENES.length);
    }
  }

  if (renderer) {
    fade.classList.add('is-on');
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
      }, 600);
    };
    window.addEventListener('keydown', start);
    screen.addEventListener('pointerup', start);
    $('.title-start').focus({ preventScroll: true });
  });
}
