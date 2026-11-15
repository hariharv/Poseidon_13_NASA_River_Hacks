// The loading screen. The thread stitching along the path to the Moon IS the
// loading bar: it follows the real loading steps the engine passes in.

import { allFacts } from '../core/lessons.js';
import './loading.css';
import { buoySvg } from '../ui/buoy-svg.js';

const ICONS = {
  hermes:
    '<path d="M-20 6 q5 -6 10 0 t10 0 t10 0 t10 0"/><path d="M-20 16 q5 -6 10 0 t10 0 t10 0 t10 0"/><circle cx="-4" cy="-10" r="5"/><circle cx="9" cy="-18" r="3"/>',
  odysseus: '<path d="M-22 16 Q0 -34 22 16"/><circle class="solid" cx="0" cy="-9" r="5"/>',
  dioscuri:
    '<path d="M-18 18 L-6 -2 L12 -12"/><circle class="solid" cx="-6" cy="-2" r="5"/><path d="M12 -12 l9 -3 M12 -12 l3 9"/><path d="M-24 18 h14"/>',
  hera: '<path d="M-12 12 L-6 -16 L6 -16 L12 12 Z"/><path d="M-16 18 h32"/><circle cx="0" cy="-2" r="4"/>',
  apollo:
    '<path d="M-6 18 V-18"/><path class="solid" d="M-6 -18 h20 l-5 6 l5 6 h-20 Z"/><path d="M-22 18 q16 -8 40 0"/>',
};

const FACTS = [
  {
    text: 'The training pool holds *6.2 million gallons* of water.',
    source: 'NASA Neutral Buoyancy Lab fact sheet',
  },
  {
    text: 'Astronauts practise about *7 hours* in the pool for every *1 hour* of a real spacewalk.',
    source: 'NASA "Diving Down Deep"',
  },
  {
    text: 'The pool is *40 feet* deep. That is about as tall as a four-storey building!',
    source: 'NASA Neutral Buoyancy Lab fact sheet',
  },
  {
    text: 'The water is kept warm, about *85°F*, so divers and astronauts stay comfy.',
    source: 'NASA Neutral Buoyancy Lab fact sheet',
  },
];

// ...plus a real astronaut fact from every stage (core/lessons.js), in a mixed-up order
const ALL_FACTS = [...FACTS, ...allFacts().sort(() => Math.random() - 0.5)];

const MIN_SHOW_MS = 2200; // long enough to see the stitching, short enough not to bore anyone

export function showLoadingScreen({ root, stages, tasks, player, progress }) {
  const screen = document.createElement('section');
  screen.className = 'loading';
  screen.setAttribute('aria-label', 'Path to Olympus is loading');
  const returning = progress.completed.length > 0;

  screen.innerHTML = `
    ${starsSvg()}
    <header class="loading-head">
      <p class="loading-eyebrow">Olympus Academy · Astronaut training base</p>
      <h1 class="loading-title"><span>Path to</span><span>Olympus</span></h1>
    </header>
    <div class="loading-map">${mapSvg(stages)}</div>
    <footer class="loading-foot">
      <div class="loading-buoy">
        ${buoySvg({ size: 92 })}
        <p class="loading-bubble" aria-live="polite"></p>
      </div>
      <div class="loading-status">
        <p class="loading-step">Getting ready…</p>
        <p class="loading-pct">0%</p>
      </div>
      <div class="loading-modes" hidden>
        <div class="mode-row">
          <button class="btn mode-btn" type="button" data-mode="easy">Easy<small>Ages 7-9 · more help from Zeus Jr.</small></button>
          <button class="btn mode-btn is-hard" type="button" data-mode="hard">Hard<small>Ages 10-12 · real numbers</small></button>
        </div>
        <button class="demo-link" type="button" data-mode="demo">Judge Demo · the whole game in 2-3 minutes</button>
        ${matchMedia('(pointer: coarse)').matches ? '<p class="loading-touch-note">Best on a computer with a keyboard and mouse.</p>' : ''}
      </div>
    </footer>`;
  root.append(screen);

  const $ = (s) => screen.querySelector(s);
  const bubble = $('.loading-bubble');
  const stepText = $('.loading-step');
  const pctText = $('.loading-pct');
  const statusBox = $('.loading-status');
  const modesBox = $('.loading-modes');
  const svg = $('.loading-map svg');
  const path = svg.querySelector('.path-holes');
  const maskPath = svg.querySelector('.path-mask');
  const needle = svg.querySelector('.needle');
  const length = path.getTotalLength();
  maskPath.style.strokeDasharray = `${length}`;
  maskPath.style.strokeDashoffset = `${length}`;

  // Place each stage patch along the path.
  const patches = [...svg.querySelectorAll('.patch')];
  const stops = patches.map((_, i) => i / (patches.length - 1));
  patches.forEach((g, i) => {
    const p = path.getPointAtLength(stops[i] * length);
    g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  });

  // Buoy's fun facts while we load.
  let factIndex = 0;
  const say = (html) => (bubble.innerHTML = html);
  const showFact = () => {
    const f = ALL_FACTS[factIndex++ % ALL_FACTS.length];
    say(`${rich(f.text)}<span class="fact-source">Source: ${f.source}</span>`);
  };
  say(returning ? `Welcome back, ${escapeHtml(player.name)}! Let me get your suit ready.` : "Hi! I'm <strong>Zeus Jr.</strong>, your helper robot. Your training base is loading…");
  const factTimer = setInterval(showFact, 5200);
  const firstFact = setTimeout(showFact, 2400);

  // Run the real loading steps; the thread only moves as fast as they finish.
  let target = 0;
  let shown = 0;
  let failed = false;
  const started = performance.now();
  const total = tasks.reduce((sum, t) => sum + (t.weight ?? 1), 0);

  (async () => {
    let doneWeight = 0;
    for (const task of tasks) {
      stepText.textContent = task.label;
      try {
        await task.run();
      } catch (err) {
        console.error(err);
        failed = true;
        stepText.textContent = 'The training base did not load.';
        pctText.textContent = 'Check your internet connection, then reload the page.';
        return;
      }
      doneWeight += task.weight ?? 1;
      target = doneWeight / total;
    }
  })();

  let raf = 0;
  return new Promise((resolve) => {
    function frame(now) {
      if (failed) return;
      const timeCap = Math.min(1, (now - started) / MIN_SHOW_MS);
      const goal = Math.min(target, timeCap);
      shown += (goal - shown) * 0.12;
      if (goal - shown < 0.002) shown = goal;
      draw(shown);
      if (shown >= 1) {
        ready();
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function draw(f) {
      maskPath.style.strokeDashoffset = `${length * (1 - f)}`;
      const p = path.getPointAtLength(f * length);
      needle.setAttribute('cx', p.x.toFixed(1));
      needle.setAttribute('cy', p.y.toFixed(1));
      patches.forEach((g, i) => g.classList.toggle('is-stitched', f >= stops[i] - 0.001));
      pctText.textContent = `${Math.round(f * 100)}%`;
    }

    function ready() {
      clearInterval(factTimer);
      clearTimeout(firstFact);
      needle.style.display = 'none';
      statusBox.hidden = true;
      modesBox.hidden = false;
      patches.forEach((g) => {
        const id = g.dataset.stage;
        const available = stages.find((s) => s.id === id)?.available;
        // finish any stage and every stage opens up
        g.classList.toggle('is-locked', !available || (!returning && id !== 'hermes'));
      });
      patches[0].classList.add('is-next');
      say(
        returning
          ? `Ready, ${escapeHtml(player.name)}! Pick how you want to train.`
          : 'All set! Your first stop is the giant training pool. <strong>Pick how you want to train.</strong>',
      );
      modesBox.querySelector('[data-mode="easy"]').focus();

      modesBox.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mode]');
        if (!btn) return;
        const mode = btn.dataset.mode;
        document.documentElement.dataset.mode = mode;
        // Dive into the Hermes patch.
        const box = patches[0].getBoundingClientRect();
        screen.style.transformOrigin = `${box.left + box.width / 2}px ${box.top + box.height / 2}px`;
        screen.classList.add('is-leaving');
        setTimeout(() => {
          cancelAnimationFrame(raf);
          screen.remove();
        }, 720);
        resolve({ mode });
      });
    }
  });
}

function mapSvg(stages) {
  return `
<svg viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Five training stages on the path to the Moon">
  <defs>
    <radialGradient id="moon-glow">
      <stop offset="0.55" stop-color="#FFC145" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#FFC145" stop-opacity="0"/>
    </radialGradient>
    <mask id="stitch-mask" maskUnits="userSpaceOnUse" x="-50" y="-50" width="1300" height="660">
      <path class="path-mask" d="${PATH_D}" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round"/>
    </mask>
  </defs>
  <circle class="moon-glow" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r * 1.8}"/>
  <circle class="moon" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}"/>
  <circle class="moon-crater" cx="${MOON.x - 42}" cy="${MOON.y + 4}" r="20"/>
  <circle class="moon-crater" cx="${MOON.x + 36}" cy="${MOON.y + 40}" r="27"/>
  <circle class="moon-crater" cx="${MOON.x + 30}" cy="${MOON.y - 46}" r="11"/>
  <circle class="moon-crater" cx="${MOON.x - 18}" cy="${MOON.y + 62}" r="9"/>
  <path class="path-holes" d="${PATH_D}"/>
  <path class="path-thread" d="${PATH_D}" mask="url(#stitch-mask)"/>
  <circle class="needle" r="9" cx="0" cy="0"/>
  ${stages.map(patchSvg).join('')}
</svg>`;
}

// The Moon sits low on the right; the path ends on its top edge, where Apollo is planted like a flag.
const MOON = { x: 1085, y: 372, r: 108 };
const PATH_D = `M 100 420 C 230 500, 330 330, 450 360 S 640 420, 720 300 S 850 210, 940 262 S 1040 268, ${MOON.x} ${MOON.y - MOON.r}`;

function patchSvg(stage) {
  if (stage.id === 'apollo') return flagSvg(stage);
  return `
  <g class="patch" data-stage="${stage.id}">
    <g class="patch-body">
      <circle class="patch-ring" r="46"/>
      <circle class="patch-edge" r="44"/>
      <circle class="patch-stitch" r="35"/>
      <g class="patch-icon">${ICONS[stage.id] ?? ''}</g>
    </g>
    <g class="patch-lock" transform="translate(32 -32)">
      <circle r="17" fill="#1B1846"/>
      <rect x="-8" y="-3" width="16" height="12" rx="3" fill="#FFF3D6"/>
      <path d="M-4.5 -3 v-3 a4.5 4.5 0 0 1 9 0 v3" stroke="#FFF3D6" stroke-width="2.6" fill="none"/>
    </g>
    <g class="patch-here" transform="translate(0 -76)">
      <rect x="-58" y="-19" width="116" height="34" rx="17" fill="#FFC145"/>
      <text class="patch-here-text" y="5">Start here</text>
    </g>
    <text class="patch-name" y="76">${stage.name}</text>
    <text class="patch-rank" y="98">${stage.place}</text>
  </g>`;
}

// Apollo: the last patch flies as a flag on a pole planted on top of the Moon,
// so it never covers the Moon. The group's origin is the foot of the pole.
const POLE = 150;
function flagSvg(stage) {
  return `
  <g class="patch patch-flag" data-stage="${stage.id}">
    <ellipse class="flag-dust" cx="0" cy="2" rx="22" ry="6"/>
    <line class="flag-pole" x1="0" y1="2" x2="0" y2="${-POLE}"/>
    <circle class="flag-finial" cx="0" cy="${-POLE - 5}" r="6"/>
    <g class="flag-cloth">
      <path class="flag-rope" d="M0 ${-POLE + 6} L18 ${-POLE + 14} M0 ${-POLE + 78} L18 ${-POLE + 70}"/>
      <g transform="translate(58 ${-POLE + 42})">
        <g class="patch-body">
          <circle class="patch-ring" r="46"/>
          <circle class="patch-edge" r="44"/>
          <circle class="patch-stitch" r="35"/>
          <g class="patch-icon">${ICONS[stage.id] ?? ''}</g>
        </g>
        <g class="patch-lock" transform="translate(32 -32)">
          <circle r="17" fill="#1B1846"/>
          <rect x="-8" y="-3" width="16" height="12" rx="3" fill="#FFF3D6"/>
          <path d="M-4.5 -3 v-3 a4.5 4.5 0 0 1 9 0 v3" stroke="#FFF3D6" stroke-width="2.6" fill="none"/>
        </g>
      </g>
    </g>
    <text class="patch-name flag-label" x="-16" y="${-POLE + 36}">${stage.name}</text>
    <text class="patch-rank flag-label" x="-16" y="${-POLE + 58}">${stage.place}</text>
  </g>`;
}

function starsSvg() {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: 150 }, (_, i) => {
    const r = rand() < 0.12 ? 2.4 : 1.2 + rand();
    return `<circle cx="${(rand() * 1600).toFixed(0)}" cy="${(rand() * 1000).toFixed(0)}" r="${r.toFixed(1)}" fill="#FFF3D6" opacity="${(0.35 + rand() * 0.6).toFixed(2)}"${
      i % 9 === 0 ? ` class="twinkle" style="animation-delay:${(rand() * 3).toFixed(1)}s"` : ''
    }/>`;
  }).join('');
  return `<svg class="loading-stars" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${dots}</svg>`;
}

function rich(t) {
  return escapeHtml(t).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
