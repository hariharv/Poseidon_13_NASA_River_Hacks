// The graduation ceremony: about 30 seconds that play by themselves once you've passed every stage.
// The camera glides through each stage's real 3D world while that stage's rank (and your stars)
// is awarded, then it rises over the Moon base for the finale: "Congratulations, Commander!"
//
//   await showCeremony({ root, ui, player, stages, progress })   resolves on Continue (or Skip)

import * as THREE from 'three';
import './ceremony.css';
import { SCENES } from './title.js';

const STAGE_SECONDS = 4.4; // one rank at a time: 5 x 4.4 = 22 s
const FADE_SECONDS = 0.6;
const FINALE_SECONDS = 8; // the Moon finale (about 30 s in all)
const COLOURS = { hermes: '#46b4ff', odysseus: '#ffc145', dioscuri: '#5bd98a', hera: '#ff4d5e', apollo: '#ff5b1f' };

export function showCeremony({ root, ui, player, stages, progress }) {
  const name = player?.name && player.name !== 'Cadet' ? player.name : 'Astronaut';
  const list = SCENES.map((sc) => ({ sc, stage: stages.find((s) => s.id === sc.id) })).filter((x) => x.stage);
  const starsFor = (id) => Math.max(1, Math.min(3, progress?.stars?.[id] ?? 1));

  const screen = document.createElement('section');
  screen.className = 'ceremony';
  screen.setAttribute('aria-label', 'Graduation ceremony');
  screen.innerHTML = `
    <div class="cer-bar is-top"><p class="cer-eyebrow">Olympus Academy · Graduation Day</p><button type="button" class="cer-sound" hidden>🔊 Sound on</button></div>
    <div class="cer-rank" aria-live="polite">
      <p class="cer-stage"></p>
      <h2 class="cer-title"></h2>
      <p class="cer-stars" aria-hidden="true"></p>
    </div>
    <div class="cer-finale" hidden>
      <p class="cer-eyebrow">Every stage passed</p>
      <h1 class="cer-big">Congratulations,<br />Commander ${escapeHtml(name)}!</h1>
      <p class="cer-line">You trained like a real astronaut, then proved it on the Moon.</p>
      <p class="cer-credits">Path to Olympus · Team Poseidon 13 · NASA Space Apps 2026</p>
      <button type="button" class="btn cer-done" hidden>Continue</button>
    </div>
    <div class="cer-bar is-bottom">
      <ol class="cer-medals">${list
        .map(({ stage }, i) => `<li style="--c:${COLOURS[stage.id] ?? '#ffc145'}" title="${escapeHtml(stage.rank)}"><span>${i + 1}</span></li>`)
        .join('')}</ol>
      <button type="button" class="btn btn-quiet cer-skip">Skip</button>
    </div>
    <div class="cer-fade is-on"></div>`;
  root.append(screen);
  const $ = (s) => screen.querySelector(s);
  const medals = [...screen.querySelectorAll('.cer-medals li')];
  const rankBox = $('.cer-rank');
  const fade = $('.cer-fade');
  const sfx = (name) => ui?.sound?.play?.(name);
  // Sound only plays after a click or key press (it already has, after playing the stages)
  const soundBtn = $('.cer-sound');
  ui?.sound?.unlock?.();
  const checkSound = () => (soundBtn.hidden = !ui?.sound || ui.sound.ready);
  setTimeout(checkSound, 200);
  const soundTimer = setInterval(checkSound, 1000);
  soundBtn.addEventListener('click', () => {
    ui.sound.unlock?.();
    setTimeout(() => ui.sound.ready && (soundBtn.hidden = true), 120);
  });

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.className = 'cer-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    screen.prepend(renderer.domElement);
  } catch {
    renderer = null; // no 3D: the ranks and the finale still show over a starry background
    screen.classList.add('is-flat');
  }
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 3000);
  const onResize = () => {
    renderer?.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  let current = null; // { world, shot }
  let shot = null; // (camera, into, t, dt)
  let shotStart = 0;
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let over = false;
  const built = [];

  const build = (i) => (built[i] ??= list[i].sc.load().then((mod) => list[i].sc.build(mod, renderer).then((b) => ({ ...b, mod }))));

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!renderer || !current || !shot) return;
    shot(camera, t - shotStart, t, dt);
    renderer.render(current.world.scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function award(i) {
    const { stage } = list[i];
    const stars = starsFor(stage.id);
    screen.style.setProperty('--c', COLOURS[stage.id] ?? '#ffc145');
    $('.cer-stage').textContent = `Stage ${stages.indexOf(stage) + 1} · ${stage.name} · ${stage.place}`;
    $('.cer-title').textContent = stage.rank;
    $('.cer-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    rankBox.classList.remove('is-on');
    void rankBox.offsetWidth;
    rankBox.classList.add('is-on');
    medals[i]?.classList.add('is-won');
    sfx('fanfare'); // a brass call for each rank
    setTimeout(() => !over && sfx('medal'), 420); // and the medal lighting up
  }

  async function run() {
    ui?.sound?.music('title');
    for (let i = 0; i < list.length && !over; i++) {
      const next = renderer ? await build(i).catch(() => null) : null;
      if (over) return;
      if (i + 1 < list.length && renderer) build(i + 1).catch(() => {}); // get the next stage ready meanwhile
      if (next) {
        const old = current;
        current = next;
        shot = (cam, into, tt, dt) => next.shot(cam, Math.min(1, into / STAGE_SECONDS), tt, dt);
        shotStart = t;
        if (old && old !== next) old.world.dispose?.();
      }
      fade.classList.remove('is-on');
      award(i);
      await wait((STAGE_SECONDS - FADE_SECONDS) * 1000);
      if (over) return;
      if (i < list.length - 1) {
        sfx('swish');
        fade.classList.add('is-on');
        await wait(FADE_SECONDS * 1000);
      }
    }
    if (over) return;
    // the finale: rise up over the Moon base
    const moon = current;
    if (moon?.mod?.groundAt) {
      shot = (cam, into, tt, dt) => {
        const k = 1 - (1 - Math.min(1, into / FINALE_SECONDS)) ** 2;
        const a = -0.75 + k * 0.35; // the ice crater side: the base, with Earth over the horizon
        const r = 22 + k * 12;
        const x = -3 + Math.cos(a) * r;
        const z = Math.sin(a) * r;
        cam.position.set(x, moon.mod.groundAt(x, z) + 2.4 + k * 9, z);
        cam.lookAt(-3, 1.2 + k * 1.5, 0);
        moon.world.update(tt, dt, cam);
      };
      shotStart = t;
    }
    rankBox.classList.remove('is-on');
    screen.classList.add('is-finale');
    $('.cer-finale').hidden = false;
    sfx('boom');
    sfx('fanfareBig');
    ui?.celebrate?.(); // confetti, clapping and a cheer
    await wait(3600);
    if (over) return;
    ui?.celebrate?.();
    await wait(FINALE_SECONDS * 1000 - 3600);
    if (over) return;
    $('.cer-skip').hidden = true;
    const done = $('.cer-done');
    sfx('chime');
    done.hidden = false;
    done.focus({ preventScroll: true });
  }

  return new Promise((resolve) => {
    const finish = () => {
      if (over) return;
      over = true;
      screen.classList.add('is-leaving');
      setTimeout(() => {
        cancelAnimationFrame(raf);
        clearInterval(soundTimer);
        window.removeEventListener('resize', onResize);
        current?.world.dispose?.();
        built.forEach((p) => p?.then((b) => b !== current && b.world.dispose?.()).catch(() => {}));
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss();
        }
        screen.remove();
        resolve();
      }, 600);
    };
    $('.cer-skip').addEventListener('click', finish);
    $('.cer-done').addEventListener('click', finish);
    run().catch((err) => {
      console.error('Ceremony stopped', err);
      $('.cer-finale').hidden = false;
      $('.cer-done').hidden = false;
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
