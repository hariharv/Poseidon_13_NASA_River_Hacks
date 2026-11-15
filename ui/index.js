// In-game UI (Person 5 owns the look). The engine talks to it only through
// the object createUI() returns, so the art can change without touching /core.

import './ui.css';
import { buoySvg } from './buoy-svg.js';
import { createSound } from './sound.js';
import { createPuzzle } from './puzzle.js';
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
        <div class="hud-clock" hidden aria-label="Stage clock"><span class="hud-clock-time">0:00</span><span class="hud-clock-goal"></span></div>
        <div class="hud-plugs" hidden aria-label="Energy plugs"></div>
        <div class="hud-storm" hidden data-colour="green"><span class="storm-dot"></span><span class="storm-text">Calm</span></div>
        <button class="real-numbers-btn" type="button" hidden>Real numbers</button>
      </div>
      <div class="hud-task" hidden><span class="hud-task-label">Task</span><span class="hud-task-text"></span></div>
      <div class="crosshair"></div>
      <div class="hud-prompt" hidden></div>
      <div class="hud-corner">
        <button class="hud-btn hud-help" type="button" hidden title="What do I do now? (H)"><span aria-hidden="true">?</span><span class="hud-btn-text">Help</span></button>
        <button class="hud-btn hud-music" type="button" aria-pressed="true" title="Music on or off (N)"><span aria-hidden="true">♫</span><span class="hud-btn-text">Music on</span></button>
        <button class="hud-btn hud-sound" type="button" aria-pressed="true" title="Sound effects on or off (M)"><span aria-hidden="true">♪</span><span class="hud-btn-text">Sound on</span></button>
        <button class="hud-btn hud-menu" type="button" title="Menu"><span aria-hidden="true">☰</span><span class="hud-btn-text">Menu</span></button>
      </div>
    </div>
    <div class="pause-layer" hidden>
      <div class="pause-box" role="dialog" aria-label="Paused">
        <p class="pause-title">Paused</p>
        <div class="pause-actions">
          <button class="btn pause-resume" type="button">Keep training</button>
          <button class="btn btn-quiet pause-menu" type="button">Menu</button>
        </div>
        <p class="pause-hint">or press <kbd>P</kbd></p>
      </div>
    </div>
    <div class="buoy-say is-hidden" aria-live="polite">
      ${buoySvg({ size: 76 })}
      <p class="buoy-bubble"><span class="buoy-name">Zeus Jr.</span><span class="buoy-text"></span></p>
    </div>
    <aside class="checklist" hidden aria-label="Judge checklist"></aside>
    <button class="checklist-open" type="button" hidden>Judge checklist</button>
    <div class="puzzle-layer" hidden></div>
    <div class="cheer-layer" aria-live="polite"></div>
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
  const soundBtn = $('.hud-sound');
  const musicBtn = $('.hud-music');
  const menuBtn = $('.hud-menu');
  const helpBtn = $('.hud-help');
  const taskBox = $('.hud-task');
  const taskText = $('.hud-task-text');
  const checklistOpen = $('.checklist-open');
  const clockBox = $('.hud-clock');
  const clockTime = $('.hud-clock-time');
  const clockGoal = $('.hud-clock-goal');
  let clockText = '';
  let clockGoalText = '';
  const puzzleLayer = $('.puzzle-layer');

  const sound = createSound();
  let lowAt = 30;
  let lastOxygen = 100;
  let lastProgress = 0;
  let lastStorm = 'green';
  let menuHandler = null;

  // ---------- Sound + Menu buttons (bottom right of the visor) ----------
  function showSoundState(muted) {
    soundBtn.setAttribute('aria-pressed', String(!muted));
    soundBtn.querySelector('.hud-btn-text').textContent = muted ? 'Sound off' : 'Sound on';
    soundBtn.classList.toggle('is-off', muted);
    const m = sound.musicMuted;
    musicBtn.setAttribute('aria-pressed', String(!m));
    musicBtn.querySelector('.hud-btn-text').textContent = m ? 'Music off' : 'Music on';
    musicBtn.classList.toggle('is-off', m);
  }
  showSoundState(sound.muted);
  sound.onChange(showSoundState);
  soundBtn.addEventListener('click', () => {
    sound.toggle();
    sound.play('click');
  });
  musicBtn.addEventListener('click', () => {
    sound.toggleMusic();
    sound.play('click');
  });
  const openMenu = (e) => {
    e?.stopPropagation();
    sound.play('click');
    menuHandler?.();
  };
  menuBtn.addEventListener('click', openMenu);
  $('.pause-menu').addEventListener('click', openMenu);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.closest?.('input, textarea')) return;
    if (e.code === 'KeyM') sound.toggle();
    if (e.code === 'KeyN') sound.toggleMusic();
  });

  // ---------- HUD ----------
  const hud = {
    show() {
      visor.hidden = false;
    },
    hide() {
      visor.hidden = true;
      clearTimeout(promptTimer);
      promptNow = null;
      prompt.hidden = true;
      setTask(null);
      puzzle.close();
    },
    // the stage clock (top right): how long you've taken, and the time to beat for the speed star
    clock(seconds, goal) {
      clockBox.hidden = false;
      const t = fmtTime(seconds);
      if (t !== clockText) {
        clockText = t;
        clockTime.textContent = t;
      }
      const g = goal ? (seconds <= goal ? `★ under ${fmtTime(goal)}` : '★ missed, keep going!') : '';
      if (g !== clockGoalText) {
        clockGoalText = g;
        clockGoal.textContent = g;
        clockBox.classList.toggle('is-late', Boolean(goal) && seconds > goal);
      }
    },
    reset({ low = 30 } = {}) {
      clockBox.hidden = true;
      clockText = '';
      clockGoalText = '';
      lowAt = low;
      lastOxygen = 100;
      lastProgress = 0;
      lastStorm = 'green';
      plugs.hidden = true;
      storm.hidden = true;
      clearTimeout(promptTimer);
      promptNow = null;
      prompt.hidden = true;
      crosshair.classList.remove('is-target');
    },
    oxygen(v) {
      setBar(oxygenBar, v);
      oxygenBar.classList.toggle('is-low', v < lowAt);
      if (v < lowAt && lastOxygen >= lowAt) sound.play('warn');
      lastOxygen = v;
    },
    progress(v) {
      setBar(progressBar, v);
      if (v >= 100 && lastProgress < 100) sound.play('success');
      lastProgress = v;
    },
    plugs(n) {
      plugs.hidden = false;
      plugs.innerHTML = Array.from({ length: n }, () => '<span class="plug"></span>').join('') + ` <span>${n}</span>`;
    },
    storm(colour) {
      storm.hidden = false;
      storm.dataset.colour = colour;
      storm.querySelector('.storm-text').textContent = { green: 'Calm', yellow: 'Storm coming', red: 'Storm here!' }[colour];
      if (colour !== lastStorm) sound.play(colour === 'red' ? 'alarm' : colour === 'yellow' ? 'warn' : 'success');
      lastStorm = colour;
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
  // Each prompt stays up for at least a moment, so a prompt that flips back and forth
  // (standing right on the edge of a zone) can't strobe.
  let promptShownAt = 0;
  let promptTimer = null;
  let promptNow = null;
  function showPrompt(text) {
    const next = text || null;
    clearTimeout(promptTimer);
    if (next === promptNow) return;
    const wait = 350 - (performance.now() - promptShownAt);
    if (wait > 0) {
      promptTimer = setTimeout(() => applyPrompt(next), wait);
      return;
    }
    applyPrompt(next);
  }
  function applyPrompt(text) {
    promptNow = text;
    promptShownAt = performance.now();
    if (!text) {
      prompt.hidden = true;
      return;
    }
    prompt.innerHTML = escapeHtml(text).replace(/\[(\w+)\]/g, '<kbd>$1</kbd>');
    prompt.hidden = false;
  }

  // ---------- Zeus Jr. (the helper robot; "buoy" in the code) ----------
  // Lines queue up and each stays long enough to read. The bubble never vanishes mid-stage:
  // when Zeus Jr. has nothing new to say, the last line stays, then it switches to the current task.
  const lines = [];
  const recent = new Map(); // text -> when it was last shown (don't repeat the same line)
  let buoyTimer = null;
  let restTimer = null;
  let showing = null;
  let shownAt = 0;
  let task = null;

  const MIN_READ = 6000;
  const readTimeFor = (text) => Math.max(MIN_READ, text.split(/\s+/).length * 560);

  function buoy(text, { interrupt = false } = {}) {
    if (!text || text === showing || lines.includes(text)) return;
    const last = recent.get(text);
    if (!interrupt && last && performance.now() - last < 20000) return;
    if (interrupt) {
      // urgent (safety) or big-moment lines: drop what's waiting and say it now
      lines.length = 0;
      lines.push(text);
      clearTimeout(buoyTimer);
      nextLine();
      return;
    }
    lines.push(text);
    if (lines.length > 4) lines.splice(0, lines.length - 4); // never fall far behind the action
    if (!buoyTimer) nextLine();
    else hurry();
  }

  // A line is waiting: let the current one finish its minimum time, then move on.
  function hurry() {
    const left = Math.max(0, MIN_READ - (performance.now() - shownAt));
    clearTimeout(buoyTimer);
    buoyTimer = setTimeout(nextLine, left);
  }

  function say(text, { resting = false } = {}) {
    clearTimeout(restTimer);
    showing = resting ? null : text;
    buoyText.innerHTML = escapeHtml(text).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
    buoyBox.classList.remove('is-hidden');
    buoyBox.classList.toggle('is-resting', resting);
    // a soft fade on the new words only (the bubble itself stays put, so nothing blinks)
    buoyText.classList.remove('is-new');
    void buoyText.offsetWidth;
    buoyText.classList.add('is-new');
  }

  function nextLine() {
    const text = lines.shift();
    if (!text) {
      // nothing new to say: keep the last line up, then show the current task
      buoyTimer = null;
      showing = null;
      buoyBox.classList.add('is-resting');
      clearTimeout(restTimer);
      restTimer = setTimeout(showTaskInBubble, 4000);
      return;
    }
    sound.play('chirp');
    say(text);
    shownAt = performance.now();
    recent.set(text, shownAt);
    buoyTimer = setTimeout(nextLine, readTimeFor(text));
  }

  function showTaskInBubble() {
    if (buoyTimer || !task?.now) return;
    say(`Your job: *${task.now}*${helpBtn.hidden ? '' : ' (press H for help)'}`, { resting: true });
  }

  function clearBuoy() {
    lines.length = 0;
    clearTimeout(buoyTimer);
    clearTimeout(restTimer);
    buoyTimer = null;
    showing = null;
    recent.clear();
    buoyBox.classList.add('is-hidden');
    buoyBox.classList.remove('is-resting');
  }

  // ---------- Task chip + Help ----------
  // A stage calls ui.task({ now, steps, tips }) whenever the job changes (null clears it).
  //   now:   what to do right now, in a few words ("Fix panel 2: it's up high")
  //   steps: [{ text, done }] the whole job, in order (shown in Help)
  //   tips:  [string] how to do the current step (shown in Help)
  function setTask(spec) {
    task = spec && spec.now ? spec : null;
    taskBox.hidden = !task;
    helpBtn.hidden = !task;
    if (task) taskText.innerHTML = rich(task.now);
    if (task && !buoyTimer && buoyBox.classList.contains('is-resting')) showTaskInBubble();
  }
  function openHelp() {
    if (!task || cardOpenCount() > 0) return;
    if (document.pointerLockElement) document.exitPointerLock();
    card({
      eyebrow: 'Help',
      title: 'What do I do now?',
      text: [`*${task.now}*`, ...(task.tips ?? [])],
      steps: task.steps,
      choices: [{ id: 'ok', label: 'Back to training' }],
    });
  }
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sound.play('click');
    openHelp();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat || e.target.closest?.('input, textarea') || visor.hidden) return;
    openHelp();
  });

  // ---------- Cards (queued, one at a time) ----------
  let queue = Promise.resolve();
  let openCards = 0;

  const cardOpenCount = () => openCards;
  function card(options) {
    openCards++;
    const result = queue.then(() => showCard(options));
    queue = result.catch(() => {}).finally(() => openCards--);
    return result;
  }

  function showCard({ eyebrow, title, text, choices, stars, facts, links, steps, note, tone, equal = false } = {}) {
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
        ${steps?.length ? `<ol class="card-steps">${steps.map(stepMarkup).join('')}</ol>` : ''}
        ${note ? `<p class="card-note">${escapeHtml(note)}</p>` : ''}
        <div class="card-choices"></div>`;
      const row = box.querySelector('.card-choices');
      row.classList.toggle('is-stacked', equal);
      // A key held down from the game (Space to swim, E to fix) must not click
      // the first button the moment the card appears, so buttons wake up after a beat.
      const readyAt = performance.now() + 450;
      list.forEach((choice, i) => {
        const b = el('button', i === 0 && !equal ? 'btn' : 'btn btn-quiet');
        b.type = 'button';
        b.textContent = choice.label;
        b.addEventListener('click', () => {
          if (performance.now() < readyAt) return;
          sound.play('click');
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
      sound.play(tone === 'alert' ? 'fail' : tone === 'win' ? 'win' : 'tap');
      box.tabIndex = -1;
      box.focus({ preventScroll: true });
      setTimeout(() => {
        if (box.isConnected) row.querySelector('button')?.focus({ preventScroll: true });
      }, 460);
    });
  }

  // ---------- Judge checklist ----------
  const done = new Set();
  let checklistWanted = false;
  function renderChecklist() {
    const groups = [...new Set(CHECKLIST.map((c) => c.group))];
    checklistOpen.textContent = `Judge checklist · ${done.size}/${CHECKLIST.length}`;
    checklistBox.innerHTML = `
      <button class="checklist-close" type="button" aria-label="Close the judge checklist" title="Close">×</button>
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
  function setChecklistOpen(open) {
    checklistBox.hidden = !open;
    checklistOpen.hidden = open || !checklistWanted;
    document.documentElement.classList.toggle('checklist-closed', !open);
  }
  checklistBox.addEventListener('click', (e) => {
    if (!e.target.closest('.checklist-close')) return;
    sound.play('click');
    setChecklistOpen(false);
  });
  checklistOpen.addEventListener('click', () => {
    sound.play('click');
    setChecklistOpen(true);
  });
  const checklist = {
    show() {
      checklistWanted = true;
      renderChecklist();
      setChecklistOpen(true);
    },
    hide() {
      checklistWanted = false;
      checklistBox.hidden = true;
      checklistOpen.hidden = true;
    },
    tick(id) {
      if (!done.has(id)) sound.play('star');
      done.add(id);
      renderChecklist();
    },
    get count() {
      return done.size;
    },
  };

  // ---------- Pause ----------
  const pauseResume = $('.pause-resume');
  function pause(on, onResume) {
    pauseLayer.hidden = !on;
    pauseLayer.onclick = on ? () => onResume?.() : null;
    pauseResume.onclick = on
      ? (e) => {
          e.stopPropagation();
          onResume?.();
        }
      : null;
  }

  function setRealNumbers(onClick) {
    realBtn.hidden = !onClick;
    realBtn.onclick = onClick || null;
  }

  const puzzle = createPuzzle(puzzleLayer, sound);

  // ---------- Celebrations and the 3-2-1-GO countdown ----------
  // ui.cheer({ title, sub, big }) pops up big words with a burst of confetti (a win, a combo...).
  // ui.countdown() shows 3, 2, 1, GO! and resolves when it's done.
  const cheerLayer = $('.cheer-layer');
  const CONFETTI = ['#ffc145', '#ff5b1f', '#46b4ff', '#5bd98a', '#a98bff', '#ff6fae'];
  function cheer({ title, sub = '', big = false, quiet = false } = {}) {
    if (!title) return;
    const pop = el('div', `cheer${big ? ' is-big' : ''}`);
    pop.innerHTML = `<p class="cheer-title">${rich(title)}</p>${sub ? `<p class="cheer-sub">${rich(sub)}</p>` : ''}`;
    if (!quiet) {
      for (let i = 0; i < (big ? 28 : 16); i++) {
        const bit = el('span', 'confetti');
        const a = (i / (big ? 28 : 16)) * Math.PI * 2 + Math.random() * 0.4;
        const d = 90 + Math.random() * (big ? 160 : 90);
        bit.style.setProperty('--x', `${Math.cos(a) * d}px`);
        bit.style.setProperty('--y', `${Math.sin(a) * d - 30}px`);
        bit.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
        bit.style.background = CONFETTI[i % CONFETTI.length];
        pop.append(bit);
      }
    }
    cheerLayer.replaceChildren(pop);
    sound.play(big ? 'win' : 'star');
    setTimeout(() => pop.remove(), big ? 2400 : 1700);
  }
  function countdown() {
    return new Promise((resolve) => {
      const steps = ['3', '2', '1', 'GO!'];
      let i = 0;
      const show = () => {
        const n = el('div', `count${i === steps.length - 1 ? ' is-go' : ''}`);
        n.textContent = steps[i];
        cheerLayer.replaceChildren(n);
        sound.play(i === steps.length - 1 ? 'success' : 'beep');
        i++;
        if (i < steps.length) setTimeout(show, 650);
        else
          setTimeout(() => {
            n.remove();
            resolve();
          }, 550);
      };
      show();
    });
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
    // nothing on screen is talking or waiting: a good moment for a fun fact
    get quiet() {
      return openCards === 0 && pauseLayer.hidden && !showing && lines.length === 0;
    },
    whenIdle: () => queue,
    checklist,
    pause,
    setRealNumbers,
    sound,
    task: setTask,
    cheer,
    countdown,
    help: openHelp,
    puzzle: (options) => puzzle.open(options),
    get puzzleOpen() {
      return puzzle.isOpen;
    },
    // The engine sets what the Menu button does while a stage is running (null hides it).
    setMenu(fn) {
      menuHandler = fn;
      menuBtn.hidden = !fn;
      $('.pause-menu').hidden = !fn;
    },
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

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function stepMarkup(st) {
  const state = st.done ? 'is-done' : st.now ? 'is-now' : '';
  return `<li class="${state}">${rich(st.text)}</li>`;
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
