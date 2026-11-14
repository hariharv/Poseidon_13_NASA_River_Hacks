// In-game UI (Person 5 owns the look). The engine talks to it only through
// the object createUI() returns, so the art can change without touching /core.

import './ui.css';
import { buoySvg } from './buoy-svg.js';
import { CHECKLIST } from '../core/checklist.js';

const ICONS = {
  oxygen:
    '<svg class="hud-icon" viewBox="0 0 26 26" aria-hidden="true"><circle cx="9" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="18" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="19.5" cy="18.5" r="2.4" fill="currentColor"/></svg>',
  progress:
    '<svg class="hud-icon" viewBox="0 0 26 26" aria-hidden="true"><path d="M6 23V3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M7 4h13l-3.5 4.5L20 13H7z" fill="currentColor"/></svg>',
  star: (on) =>
    `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l6 13 14 1.6-10.5 9.6L36.4 42 24 34.8 11.6 42l2.9-13.8L4 18.6 18 17z" fill="${
      on ? '#FFC145' : 'rgba(255,243,214,0.15)'
    }" stroke="${on ? '#C98A10' : 'rgba(255,243,214,0.3)'}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
};

export function createUI(container) {
  const layer = el('div', 'ui-layer');
  layer.innerHTML = `
    <div class="visor" hidden>
      <div class="hud" role="status" aria-live="off">
        ${barMarkup('oxygen', 'Oxygen')}
        ${barMarkup('progress', 'Progress')}
      </div>
      <div class="hud-extras">
        <div class="hud-plugs" hidden aria-label="Energy plugs"></div>
        <div class="hud-storm" hidden data-colour="green"><span class="storm-dot"></span><span class="storm-text">Calm</span></div>
        <button class="real-numbers-btn" type="button" hidden>Real numbers</button>
      </div>
      <div class="crosshair"></div>
      <div class="hud-prompt" hidden></div>
    </div>
    <div class="pause-layer" hidden><p>Paused · click to keep training</p></div>
    <div class="buoy-say is-hidden" aria-live="polite">
      ${buoySvg({ size: 76 })}
      <p class="buoy-bubble"><span class="buoy-name">Buoy</span><span class="buoy-text"></span></p>
    </div>
    <aside class="checklist" hidden aria-label="Judge checklist"></aside>
    <div class="card-layer" hidden></div>
  `;
  container.append(layer);

  const $ = (sel) => layer.querySelector(sel);
  const visor = $('.visor');
  const oxygenBar = $('.hud-oxygen');
  const progressBar = $('.hud-progress');
  const plugs = $('.hud-plugs');
  const storm = $('.hud-storm');
  const prompt = $('.hud-prompt');
  const crosshair = $('.crosshair');
  const realBtn = $('.real-numbers-btn');
  const pauseLayer = $('.pause-layer');
  const buoyBox = $('.buoy-say');
  const buoyText = $('.buoy-text');
  const checklistBox = $('.checklist');
  const cardLayer = $('.card-layer');

  let lowAt = 30;

  // ---------- HUD ----------
  const hud = {
    show() {
      visor.hidden = false;
    },
    hide() {
      visor.hidden = true;
      prompt.hidden = true;
    },
    reset({ low = 30 } = {}) {
      lowAt = low;
      plugs.hidden = true;
      storm.hidden = true;
      prompt.hidden = true;
      crosshair.classList.remove('is-target');
    },
    oxygen(v) {
      setBar(oxygenBar, v);
      oxygenBar.classList.toggle('is-low', v < lowAt);
    },
    progress(v) {
      setBar(progressBar, v);
    },
    plugs(n) {
      plugs.hidden = false;
      plugs.innerHTML = Array.from({ length: n }, () => '<span class="plug"></span>').join('') + ` <span>${n}</span>`;
    },
    storm(colour) {
      storm.hidden = false;
      storm.dataset.colour = colour;
      storm.querySelector('.storm-text').textContent = { green: 'Calm', yellow: 'Storm coming', red: 'Storm here!' }[colour];
    },
    target(on) {
      crosshair.classList.toggle('is-target', Boolean(on));
    },
  };

  function setBar(bar, v) {
    const n = Math.round(v);
    bar.querySelector('.hud-fill').style.width = `${v}%`;
    bar.querySelector('.hud-num').textContent = n;
    bar.querySelector('.hud-track').setAttribute('aria-valuenow', String(n));
  }

  // ---------- Prompt ("Hold [E] to fix") ----------
  function showPrompt(text) {
    if (!text) {
      prompt.hidden = true;
      return;
    }
    prompt.innerHTML = escapeHtml(text).replace(/\[(\w+)\]/g, '<kbd>$1</kbd>');
    prompt.hidden = false;
  }

  // ---------- Buoy ----------
  const lines = [];
  let buoyTimer = null;
  let showing = null;

  function buoy(text, { interrupt = false } = {}) {
    if (!text || text === showing || lines.includes(text)) return;
    if (interrupt) {
      // urgent (safety) or big-moment lines: drop what's waiting and say it now
      lines.length = 0;
      lines.push(text);
      clearTimeout(buoyTimer);
      nextLine();
      return;
    }
    lines.push(text);
    if (lines.length > 3) lines.splice(0, lines.length - 3); // never fall far behind the action
    if (!buoyTimer) nextLine();
    else hurry();
  }

  // When a line is waiting, cut the current one short so Buoy keeps up with
  // the action (but always leave a few seconds to read it).
  let shownAt = 0;
  function hurry() {
    const left = Math.max(0, 3600 - (performance.now() - shownAt));
    clearTimeout(buoyTimer);
    buoyTimer = setTimeout(nextLine, left);
  }

  function nextLine() {
    const text = lines.shift();
    if (!text) {
      showing = null;
      buoyTimer = null;
      buoyBox.classList.add('is-hidden');
      return;
    }
    showing = text;
    buoyText.innerHTML = escapeHtml(text).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
    buoyBox.classList.remove('is-hidden');
    shownAt = performance.now();
    const words = text.split(/\s+/).length;
    const readTime = Math.max(3400, words * 380);
    buoyTimer = setTimeout(nextLine, lines.length ? Math.min(readTime, 5200) : readTime);
  }

  function clearBuoy() {
    lines.length = 0;
    clearTimeout(buoyTimer);
    buoyTimer = null;
    showing = null;
    buoyBox.classList.add('is-hidden');
  }

  // ---------- Cards (queued, one at a time) ----------
  let queue = Promise.resolve();
  let openCards = 0;

  function card(options) {
    openCards++;
    const result = queue.then(() => showCard(options));
    queue = result.catch(() => {}).finally(() => openCards--);
    return result;
  }

  function showCard({ eyebrow, title, text, choices, stars, facts, links, note, tone } = {}) {
    return new Promise((resolve) => {
      const list = choices?.length ? choices : [{ id: 'ok', label: 'OK' }];
      const box = el('div', 'card');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      if (tone) box.dataset.tone = tone;
      box.innerHTML = `
        ${eyebrow ? `<p class="card-eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
        ${title ? `<h2 class="card-title">${escapeHtml(title)}</h2>` : ''}
        ${stars != null ? `<div class="card-stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map((i) => ICONS.star(i <= stars)).join('')}</div>` : ''}
        ${(Array.isArray(text) ? text : text ? [text] : []).map((t) => `<p class="card-text">${rich(t)}</p>`).join('')}
        ${facts?.length ? `<ul class="card-facts">${facts.map(factMarkup).join('')}</ul>` : ''}
        ${links?.length ? `<ul class="card-facts">${links.map(linkMarkup).join('')}</ul>` : ''}
        ${note ? `<p class="card-note">${escapeHtml(note)}</p>` : ''}
        <div class="card-choices"></div>`;
      const row = box.querySelector('.card-choices');
      list.forEach((choice, i) => {
        const b = el('button', i === 0 ? 'btn' : 'btn btn-quiet');
        b.type = 'button';
        b.textContent = choice.label;
        b.addEventListener('click', () => {
          cardLayer.hidden = true;
          cardLayer.replaceChildren();
          resolve(choice.id);
        });
        row.append(b);
      });
      if (title) {
        const id = `card-title-${Math.random().toString(36).slice(2)}`;
        box.querySelector('.card-title').id = id;
        box.setAttribute('aria-labelledby', id);
      }
      cardLayer.replaceChildren(box);
      cardLayer.hidden = false;
      row.querySelector('button').focus();
    });
  }

  // ---------- Judge checklist ----------
  const done = new Set();
  function renderChecklist() {
    const groups = [...new Set(CHECKLIST.map((c) => c.group))];
    checklistBox.innerHTML = `
      <h2>Judge checklist</h2>
      <p class="checklist-count">${done.size} / ${CHECKLIST.length} proven live</p>
      ${groups
        .map(
          (g) => `<h3>${escapeHtml(g)}</h3><ol>${CHECKLIST.filter((c) => c.group === g)
            .map((c) => `<li class="${done.has(c.id) ? 'is-done' : ''}">${CHECKLIST.indexOf(c) + 1}. ${escapeHtml(c.label)}</li>`)
            .join('')}</ol>`,
        )
        .join('')}`;
  }
  const checklist = {
    show() {
      renderChecklist();
      checklistBox.hidden = false;
    },
    hide() {
      checklistBox.hidden = true;
    },
    tick(id) {
      done.add(id);
      renderChecklist();
    },
    get count() {
      return done.size;
    },
  };

  // ---------- Pause ----------
  function pause(on, onResume) {
    pauseLayer.hidden = !on;
    pauseLayer.onclick = on ? () => onResume?.() : null;
  }

  function setRealNumbers(onClick) {
    realBtn.hidden = !onClick;
    realBtn.onclick = onClick || null;
  }

  return {
    hud,
    buoy,
    clearBuoy,
    prompt: showPrompt,
    card,
    get cardOpen() {
      return openCards > 0;
    },
    whenIdle: () => queue,
    checklist,
    pause,
    setRealNumbers,
  };
}

function barMarkup(kind, label) {
  return `
    <div class="hud-bar hud-${kind}">
      ${ICONS[kind]}
      <span class="hud-label">${label}</span>
      <div class="hud-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="hud-fill"></div></div>
      <span class="hud-num">0</span>
    </div>`;
}

function factMarkup(f) {
  const source = f.url
    ? `<a href="${escapeAttr(f.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.source ?? f.url)}</a>`
    : escapeHtml(f.source ?? '');
  return `<li>${escapeHtml(f.label)}<span class="fact-value">${escapeHtml(f.value)}</span>${source ? `<span class="fact-source">${source}</span>` : ''}</li>`;
}

function linkMarkup(l) {
  return `<li><a href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.title)}</a><span class="fact-source">${escapeHtml(l.source)} · found ${escapeHtml(l.foundOn)}</span></li>`;
}

function rich(t) {
  return escapeHtml(t).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function escapeAttr(s) {
  const url = String(s);
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}
