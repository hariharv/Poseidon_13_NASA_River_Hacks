// The homepage: the NASA Space Apps Challenge logo, Team Poseidon 13, and "Make your astronaut"
// with a 3D astronaut spinning on a stand. Zeus Jr., the helper robot, talks you through it.
// Resolves with the saved player.json.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './home.css';
import spaceAppsLogo from '../assets/space-apps-logo.svg';
import { buoySvg } from '../ui/buoy-svg.js';
import { cleanName, isKidSafeName } from '../core/save.js';
import { createAstronaut, SUITS, VISORS, BOOTS, BACKPACKS } from './astronaut.js';

const CHEERS = {
  suit: (o) => `Ooh, *${o.label.toLowerCase()}*! Very spacey.`,
  visor: (o) => `A *${o.label.toLowerCase()} visor* keeps the bright Sun out of your eyes.`,
  boots: (o) => `*${o.label}* boots and gloves: ${o.note.toLowerCase()}.`,
  backpack: (o) =>
    ({
      classic: 'The *classic pack*, just like real spacewalkers wear. It holds your air and cool water.',
      jetpack: 'A *jet pack*! Real astronauts have little jets to fly back if they float away.',
      spacecat: 'A *space-cat backpack*! It holds your air and water. This one also purrs.',
    })[o.id],
};

// What each backpack does (real ones first), shown under the backpack choices.
const PACK_INFO = {
  classic: {
    title: 'Classic life-support pack',
    text: "This is the backpack real spacewalkers wear. NASA calls it the *Primary Life Support Subsystem*. It holds the *oxygen* you breathe, cleans out the air you breathe out, powers the suit, and pumps cool water around your body.",
  },
  jetpack: {
    title: 'Jet pack',
    text: "Real astronauts carry a small jet pack called *SAFER* on their life-support pack. If they ever float away from the space station, its little *thruster jets* fly them back. Yours still holds your air, plus twin thrusters.",
  },
  spacecat: {
    title: 'Space cat',
    text: "Just for fun! It works like the classic pack (air, power and cool water), but with *ears, whiskers and a tail*. No real astronaut has one... yet.",
  },
};
const PACK_ROWS = [
  { label: 'Air to breathe', has: ['classic', 'jetpack', 'spacecat'] },
  { label: 'Cool water for your suit', has: ['classic', 'jetpack', 'spacecat'] },
  { label: 'Little jets to fly back', has: ['jetpack'] },
  { label: 'Cat ears and tail', has: ['spacecat'] },
];

// "What do real astronauts wear?" Facts from NASA's spacesuit pages.
const SUIT_SRC = 'https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-a-spacesuit-grades-5-8/';
const EMU_SRC = 'https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf';
const REAL_SUIT = [
  { part: 'Helmet and visor', text: 'The visor protects astronauts’ eyes from the very bright sunlight in space, like a pair of sunglasses.', src: SUIT_SRC },
  { part: 'Cooling underwear', text: 'Under the suit they wear a stretchy suit full of tiny tubes. Water flows through the tubes to keep them cool.', src: SUIT_SRC },
  { part: 'Life-support backpack', text: 'Holds the oxygen they breathe, removes the carbon dioxide they breathe out, and makes electricity for the suit.', src: SUIT_SRC },
  { part: 'SAFER jet pack', text: 'Small thruster jets on the backpack. If an astronaut floated away from the station, they could fly back.', src: SUIT_SRC },
  { part: 'Gloves and boots', text: 'The arms connect to the gloves, and the whole suit is sealed so the air stays inside.', src: SUIT_SRC },
  { part: 'How heavy is it?', text: 'The spacewalk suit with its backpack weighs about 145 kg (319 lb) on Earth. In space, it floats!', src: EMU_SRC },
];

export function showHome({ root, player, progress, onChange = () => {} }) {
  const draft = { ...structuredClone(player), boots: player.boots ?? 'classic' };
  const returning = player.name !== 'Cadet'; // they've made an astronaut before
  void progress;

  const screen = document.createElement('section');
  screen.className = 'home';
  screen.setAttribute('aria-label', 'Team Poseidon 13: make your astronaut');
  screen.innerHTML = `
    ${starsSvg()}
    <header class="home-head">
      <img class="home-logo" src="${spaceAppsLogo}" alt="NASA Space Apps Challenge" width="561" height="221" />
      <div class="home-team">
        <p class="home-eyebrow">Team</p>
        <h1 class="home-title">Poseidon 13</h1>
        <p class="home-presents">presents <strong>Path to Olympus</strong>: train like a real astronaut, then prove it on the Moon.</p>
      </div>
    </header>

    <div class="home-main">
      <div class="home-stage">
        <div class="home-canvas" aria-label="Your astronaut, spinning on a stand"></div>
        <p class="home-spin-hint">Drag to spin</p>
      </div>

      <form class="maker" novalidate>
        <div class="maker-head">
          <h2>Make your astronaut</h2>
          <button class="maker-random" type="button">Surprise me</button>
        </div>

        <label class="maker-row">
          <span class="maker-label">Name <small>on your name tag</small></span>
          <input class="maker-name" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="${escapeHtml(returning ? draft.name : '')}" placeholder="Type your name" />
        </label>

        ${group('suit', 'Suit colour', SUITS.map((o) => swatch('suit', o)).join(''))}
        ${group('visor', 'Helmet visor', VISORS.map((o) => swatch('visor', o, 'visor')).join(''))}
        ${group('boots', 'Boots & gloves', BOOTS.map((o) => chip('boots', o)).join(''))}
        ${group('backpack', 'Backpack', BACKPACKS.map((o) => chip('backpack', o)).join(''))}
        <div class="pack-info" aria-live="polite"></div>
        <details class="pack-compare">
          <summary>Compare the backpacks</summary>
          <table>
            <thead><tr><th></th>${BACKPACKS.map((b) => `<th>${b.label}</th>`).join('')}</tr></thead>
            <tbody>
              ${PACK_ROWS.map((row) => `<tr><th>${row.label}</th>${BACKPACKS.map((b) => `<td>${row.has.includes(b.id) ? '<span class="yes" aria-label="yes">✓</span>' : '<span class="no" aria-label="no">–</span>'}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <p>In this game every backpack gives you the <strong>same air</strong>, so pick the one you like best!</p>
        </details>
        <button class="real-suits-btn" type="button">What do real astronauts wear?</button>
      </form>
    </div>

    <footer class="home-foot">
      <div class="home-buoy">
        ${buoySvg({ size: 84 })}
        <p class="home-bubble" aria-live="polite"></p>
      </div>
      <button class="btn home-go" type="button">To Olympus Academy <span aria-hidden="true">→</span></button>
    </footer>`;
  root.append(screen);

  const $ = (s) => screen.querySelector(s);
  const bubble = $('.home-bubble');
  const nameInput = $('.maker-name');
  const say = (text) => (bubble.innerHTML = rich(text));
  say(
    returning
      ? `Welcome back, *${draft.name}*! Want to change your look before training?`
      : "Hi, I'm *Zeus Jr.*, your helper robot! Welcome to Olympus Academy. First, let's make *your* astronaut.",
  );

  // ---------- what each backpack does ----------
  const packInfo = $('.pack-info');
  function showPackInfo() {
    const info = PACK_INFO[draft.backpack] ?? PACK_INFO.classic;
    packInfo.innerHTML = `<strong class="pack-info-title">${escapeHtml(info.title)}</strong><span>${rich(info.text)}</span>`;
  }
  showPackInfo();

  // ---------- what real astronauts wear ----------
  $('.real-suits-btn').addEventListener('click', () => openRealSuits());

  // ---------- 3D turntable ----------
  const stage = createStage($('.home-canvas'), draft);

  // ---------- choices ----------
  // Save straight away: every letter of the name, every suit choice. A name is only saved
  // once it's allowed on a name tag; until then the last good name stays saved.
  let savedName = player.name;
  function persist() {
    const typed = nameInput.value.trim();
    if (typed && isKidSafeName(typed)) savedName = cleanName(typed);
    onChange({ ...draft, name: savedName });
  }

  function refresh() {
    for (const btn of screen.querySelectorAll('[data-pick]')) {
      btn.setAttribute('aria-pressed', String(draft[btn.dataset.pick] === btn.dataset.value));
    }
    stage?.astronaut.update({ ...draft, name: cleanName(draft.name) });
  }
  refresh();

  screen.querySelector('.maker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    const { pick, value } = btn.dataset;
    draft[pick] = value;
    const list = { suit: SUITS, visor: VISORS, boots: BOOTS, backpack: BACKPACKS }[pick];
    say(CHEERS[pick](list.find((o) => o.id === value)));
    stage?.face(pick === 'backpack' ? 'back' : 'front');
    refresh();
    persist();
    if (pick === 'backpack') showPackInfo();
  });
  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    nameInput.classList.remove('is-bad');
    refresh();
    persist();
    stage?.face('front');
  });
  screen.querySelector('.maker').addEventListener('submit', (e) => e.preventDefault());

  $('.maker-random').addEventListener('click', () => {
    const pickOne = (list) => list[Math.floor(Math.random() * list.length)].id;
    draft.suit = pickOne(SUITS);
    draft.visor = pickOne(VISORS);
    draft.boots = pickOne(BOOTS);
    draft.backpack = pickOne(BACKPACKS);
    say('Ta-da! A brand new look. Keep it, or change anything you like.');
    stage?.face('spin');
    refresh();
    persist();
    showPackInfo();
  });

  return new Promise((resolve) => {
    $('.home-go').addEventListener('click', () => {
      const typed = nameInput.value.trim();
      if (!typed) {
        nameInput.classList.add('is-bad');
        nameInput.focus();
        say('What should your name tag say? *Type your name* first.');
        return;
      }
      if (!isKidSafeName(typed)) {
        nameInput.classList.add('is-bad');
        nameInput.select();
        say("Hmm, that name can't go on a name tag. *Try a different one!*");
        return;
      }
      screen.classList.add('is-leaving');
      setTimeout(() => {
        stage?.dispose();
        screen.remove();
      }, 650);
      resolve({ ...draft, name: cleanName(typed) });
    });
  });
}

// ---------- "What do real astronauts wear?" ----------
function openRealSuits() {
  const back = document.createElement('div');
  back.className = 'suits-layer';
  back.innerHTML = `
    <div class="suits" role="dialog" aria-modal="true" aria-labelledby="suits-title">
      <p class="suits-eyebrow">Real spacesuits</p>
      <h2 id="suits-title">What do real astronauts wear?</h2>
      <p class="suits-intro">For a spacewalk, astronauts put on a suit that is like a tiny spaceship. It gives them air, keeps them the right temperature, and protects them.</p>
      <ul class="suits-list">
        ${REAL_SUIT.map((p) => `<li><strong>${escapeHtml(p.part)}</strong><span>${escapeHtml(p.text)}</span></li>`).join('')}
      </ul>
      <p class="suits-source">Where's this from? <a href="${SUIT_SRC}" target="_blank" rel="noopener noreferrer">NASA: What is a spacesuit?</a> · <a href="${EMU_SRC}" target="_blank" rel="noopener noreferrer">NASA spacesuit fact sheet</a></p>
      <button class="btn suits-close" type="button">Back to my astronaut</button>
    </div>`;
  document.body.append(back);
  const close = () => back.remove();
  back.querySelector('.suits-close').addEventListener('click', close);
  back.addEventListener('click', (e) => e.target === back && close());
  back.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  back.querySelector('.suits-close').focus();
}

// ---------- the 3D stand ----------
function createStage(host, player) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    host.innerHTML = '<p class="home-no3d">Your browser can\'t draw 3D, but your choices still count!</p>';
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps suit colours true
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#fff3d6', '#2b2770', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 1.3);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffc145', 1.4);
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  // the stand
  const stand = new THREE.Group();
  scene.add(stand);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#2b2770', roughness: 0.5, metalness: 0.3 }));
  top.position.y = -0.06;
  stand.add(top);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 10, 64), new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.4 }));
  edge.rotation.x = Math.PI / 2;
  stand.add(edge);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 64), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.11;
  stand.add(glow);

  const astronaut = createAstronaut(player);
  const turn = new THREE.Group();
  turn.add(astronaut.group);
  scene.add(turn);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.2, 4.2);
  camera.lookAt(0, 0.98, 0);

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole astronaut in view on tall, narrow screens
    camera.position.z = camera.aspect < 0.75 ? 4.2 / Math.max(0.55, camera.aspect / 0.75) : 4.2;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // spin: slowly by itself, by dragging, or to show the front/back after a choice
  let yaw = -0.35; // start facing you, turned a little
  let target = null;
  let holdUntil = 0;
  let dragging = false;
  let lastX = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    target = null;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
    holdUntil = performance.now() + 2500;
  });
  const stop = () => (dragging = false);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const t = now / 1000;
    if (target != null) {
      yaw += (target - yaw) * Math.min(1, dt * 5);
      if (Math.abs(target - yaw) < 0.01) target = null;
    } else if (!dragging && now > holdUntil) {
      yaw += dt * 0.45;
    }
    turn.rotation.y = yaw;
    glowMat.opacity = 0.28 + 0.1 * Math.sin(t * 2);
    astronaut.tick(t);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    astronaut,
    face(side) {
      if (side === 'spin') {
        target = yaw + Math.PI * 2;
      } else {
        const want = side === 'back' ? Math.PI : 0;
        target = yaw + ((((want - yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      }
      holdUntil = performance.now() + 3000;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      astronaut.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

// ---------- markup helpers ----------
function group(pick, label, inner, extra = '') {
  return `<div class="maker-row"><span class="maker-label" id="maker-${pick}">${label}</span><div class="maker-options ${extra}" role="group" aria-labelledby="maker-${pick}">${inner}</div></div>`;
}
function swatch(pick, o, kind = 'suit') {
  return `<button type="button" class="swatch swatch-${kind}" data-pick="${pick}" data-value="${o.id}" style="--c:${o.hex}" aria-label="${o.label}" title="${o.label}"></button>`;
}
function chip(pick, o) {
  return `<button type="button" class="chip" data-pick="${pick}" data-value="${o.id}"><span>${o.label}</span><small>${o.note}</small></button>`;
}


function starsSvg() {
  let seed = 13;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: 140 }, (_, i) => {
    const r = rand() < 0.12 ? 2.4 : 1.2 + rand();
    return `<circle cx="${(rand() * 1600).toFixed(0)}" cy="${(rand() * 1000).toFixed(0)}" r="${r.toFixed(1)}" fill="#FFF3D6" opacity="${(0.35 + rand() * 0.6).toFixed(2)}"${
      i % 9 === 0 ? ` class="twinkle" style="animation-delay:${(rand() * 3).toFixed(1)}s"` : ''
    }/>`;
  }).join('');
  return `<svg class="home-stars" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${dots}</svg>`;
}

function rich(t) {
  return escapeHtml(t).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
