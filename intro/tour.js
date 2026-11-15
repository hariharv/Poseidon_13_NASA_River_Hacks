// The presentation tour: the whole game, every part, in about 3 minutes, playing by itself.
// Open the site with ?tour. It uses the real screens (title, character maker, stage map, cards,
// mini games, power board, Zeus Jr.) and the real 3D worlds, with a pointer that clicks for you.
// Nothing is saved: your astronaut and progress stay as they were.
//
//   runTour({ app, stageHost, ui, data, web })
//
// Esc stops the tour and goes back to the normal game.

import * as THREE from 'three';
import './tour.css';
import { STAGES, stageChoices } from '../core/stages.js';
import { lessonFor } from '../core/lessons.js';
import { CHECKLIST } from '../core/checklist.js';
import { DEFAULT_PLAYER } from '../core/save.js';
import { device, forceDevice } from '../core/device.js';

const STAGE_COLOURS = { hermes: '#46b4ff', odysseus: '#ffc145', dioscuri: '#5bd98a', hera: '#ff4d5e', apollo: '#ff5b1f' };

// The chapters, in order, with about how long each takes (for the timeline at the top).
const CHAPTERS = [
  { id: 'title', label: 'Opening cutscene', secs: 19 },
  { id: 'home', label: 'Make your astronaut', secs: 12 },
  { id: 'map', label: 'The road to the Moon', secs: 6 },
  { id: 'hermes', label: 'Stage 1 · Hermes', secs: 42 },
  { id: 'odysseus', label: 'Stage 2 · Odysseus', secs: 23 },
  { id: 'dioscuri', label: 'Stage 3 · Dioscuri', secs: 25 },
  { id: 'hera', label: 'Stage 4 · Hera', secs: 29 },
  { id: 'apollo', label: 'Stage 5 · Apollo', secs: 27 },
  { id: 'touch', label: 'Phones and iPads', secs: 7 },
  { id: 'judge', label: 'Judge Demo', secs: 6 },
  { id: 'end', label: 'Mission complete', secs: 4 },
];
const TOTAL = CHAPTERS.reduce((s, c) => s + c.secs, 0);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (x) => 1 - (1 - x) ** 3;
const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Run fn(k) with k going 0 -> 1 over ms (timers, so it keeps going even if the tab is in the background).
function tween(ms, fn) {
  return new Promise((resolve) => {
    const start = performance.now();
    const id = setInterval(() => {
      const k = clamp01((performance.now() - start) / ms);
      fn(k);
      if (k >= 1) {
        clearInterval(id);
        resolve();
      }
    }, 40);
  });
}

export async function runTour({ app, stageHost, ui, data, web }) {
  const startDevice = device();
  const chrome = buildChrome();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') location.href = location.pathname;
  });

  await chrome.waitForStart();
  ui.sound.music('title');
  // ?tour&from=hera starts at that chapter (handy for rehearsing one part)
  const fromIndex = Math.max(0, CHAPTERS.findIndex((c) => c.id === new URLSearchParams(location.search).get('from')));
  chrome.startClock(CHAPTERS.slice(0, fromIndex).reduce((sum, c) => sum + c.secs, 0));

  const cursor = createCursor();
  const director = createDirector(stageHost);
  const fresh = { completed: [], stars: {} };
  const player = structuredClone(DEFAULT_PLAYER);
  const q = (s) => document.querySelector(s);
  let apollo = null;

  // ---------- small helpers ----------
  let oxygen = 100;
  let progress = 0;
  const setOxygen = (v) => ui.hud.oxygen((oxygen = v));
  const setProgress = (v) => ui.hud.progress((progress = v));
  const oxygenTo = (v, ms) => {
    const from = oxygen;
    return tween(ms, (k) => setOxygen(from + (v - from) * k));
  };
  const progressTo = (v, ms = 700) => {
    const from = progress;
    return tween(ms, (k) => setProgress(from + (v - from) * ease(k)));
  };
  const zeus = (text) => {
    ui.clearBuoy();
    ui.buoy(text);
  };
  // a card that stays up for `hold` ms, then the pointer presses a button (the first, or the one `pick` finds)
  async function card(options, hold, pick) {
    const done = ui.card(options);
    await wait(hold);
    const buttons = [...document.querySelectorAll('.card-layer .card-choices button')];
    const button = (pick && buttons.find((b) => pick(b.textContent))) || buttons[0];
    if (button) await cursor.click(button);
    return done;
  }
  const play = (opts) => ui.puzzle({ seconds: 40, ...opts, autoplay: true });
  function hudOn(id, { plugs } = {}) {
    oxygen = 100;
    progress = 0;
    ui.hud.reset();
    setOxygen(100);
    setProgress(0);
    ui.hud.show();
    ui.setMenu(() => {});
    ui.setRealNumbers(() => {});
    if (plugs) ui.hud.plugs(plugs);
    ui.sound.music('calm');
    ui.touch?.show(id);
  }
  function hudOff() {
    ui.clearBuoy();
    ui.task(null);
    ui.power(null);
    ui.setMenu(null);
    ui.setRealNumbers(null);
    ui.touch?.hide();
    ui.hud.hide();
  }
  async function stageDone(id, { quick = true } = {}) {
    const stage = STAGES.find((s) => s.id === id);
    const index = STAGES.indexOf(stage);
    const lesson = lessonFor(id);
    hudOff();
    ui.celebrate();
    const fact = lesson?.facts?.[0];
    await card(
      {
        tone: 'win',
        eyebrow: `Stage ${index + 1} of ${STAGES.length} complete`,
        title: `${stage.name} done!`,
        stars: 3,
        text: [`Your rank: *${stage.rank}*`, ...(lesson ? [`Real astronaut skill you practised: *${lesson.skill}*`] : [])],
        facts: quick || !fact ? undefined : [{ label: 'Did you know?', value: fact.text, source: fact.source, url: fact.url }],
        choices: [{ id: 'next', label: 'Keep going' }],
      },
      quick ? 2200 : 3400,
    );
  }

  // ---------- 1. Title screen ----------
  if (fromIndex <= 0) {
    chrome.chapter(0);
    const { showTitle } = await import('./title.js');
    const titleDone = showTitle({ root: app });
    await wait(18600); // the whole opening cutscene: all five stages, then Start
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' }));
    await titleDone;
  }

  // ---------- 2. Make your astronaut ----------
  if (fromIndex <= 1) {
    chrome.chapter(1);
    const { showHome } = await import('./home.js');
    const homeDone = showHome({ root: app, player, progress: fresh, onChange: () => {} });
    await wait(1400);
    const name = q('.maker-name');
    if (name) {
      await cursor.click(name, { press: false });
      name.focus();
      for (const ch of 'Nova') {
        name.value += ch;
        name.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(170);
      }
      name.blur();
    }
    for (const sel of ['[data-pick="suit"]:nth-child(4)', '[data-pick="visor"]:nth-child(2)', '[data-pick="boots"]:nth-child(2)', '[data-pick="backpack"]:nth-child(2)']) {
      const el = q(sel);
      if (el) await cursor.click(el);
      await wait(650);
    }
    await wait(900);
    if (q('.home-go')) await cursor.click(q('.home-go'));
    await homeDone;
  }

  // ---------- 3. The stage map ----------
  if (fromIndex <= 2) {
    chrome.chapter(2);
    const { showLoadingScreen } = await import('./loading.js');
    const mapDone = showLoadingScreen({
      root: app,
      stages: STAGES,
      player: { ...player, name: 'Nova' },
      progress: fresh,
      tasks: [
        { label: 'Waking up Zeus Jr.…', weight: 1, run: () => document.fonts?.ready },
        { label: 'Filling the training pool…', weight: 3, run: () => director.preload('hermes') },
      ],
    });
    for (let i = 0; i < 100 && !q('.mode-btn')?.offsetParent; i++) await wait(100);
    await wait(700);
    if (q('.mode-btn')) await cursor.click(q('.mode-btn'));
    await mapDone;
  }

  // ---------- 4. Stage 1: Hermes, the training pool ----------
  if (fromIndex <= 3) {
    chrome.chapter(3);
    const hermes = await director.stage('hermes');
    director.shot(hermes.shots.start);
    await chrome.slate('Stage 1 · Hermes', "NASA's giant training pool", STAGE_COLOURS.hermes);
    await card(
      {
        eyebrow: 'Stage 1 of 5 · Hermes',
        title: 'The giant training pool',
        text: [
          "You're 40 feet underwater in NASA's training pool. There's a pretend space station down here!",
          'Your job: *fix 3 broken panels* before your oxygen runs low. Each one has a repair puzzle, and the clock is ticking!',
        ],
        choices: [{ id: 'go', label: 'Dive in' }],
      },
      2400,
    );
    hudOn('hermes');
    ui.task({ now: 'Swim to *Panel 1*' });
    await ui.countdown();
    director.shot(hermes.shots.swim);
    zeus('Swim to the *flashing panel*. *Space* swims up, *Shift* swims down. Your oxygen drops the whole time!');
    await oxygenTo(91, 3400);
    hermes.work(0.5);
    zeus('Every panel has a *repair puzzle*. Connect each pair of dots!');
    const air1 = oxygenTo(84, 6000);
    await play({ kind: 'flow', title: 'Panel 1: reconnect the power lines', text: "Drag a line from each dot to the dot with the *same colour and shape*. Lines can't cross!", size: 5 });
    hermes.fix(0);
    ui.cheer({ title: 'PANEL FIXED!', sub: '2 to go · golden patch found!' });
    await air1;
    await progressTo(34);
    ui.task({ now: 'Swim up to *Panel 2*: on top of the truss' });
    director.shot(hermes.shots.orbit);
    await wait(900);
    await play({ kind: 'sequence', title: 'Panel 2: type the panel code', text: 'Watch the lights, then press them *in the same order*.', size: 3 });
    hermes.fix(1);
    ui.cheer({ title: 'PANEL FIXED!', sub: 'one more to go' });
    await progressTo(67);
    zeus('*Low air!* Swim to the *air station* to refill, then finish the job.');
    await oxygenTo(24, 1100);
    await wait(500);
    await oxygenTo(100, 1000);
    hermes.fix(2);
    await progressTo(100, 600);
    ui.cheer({ title: 'ALL PANELS FIXED!', sub: 'golden patches: 2 of 2', big: true });
    await wait(1700);
    await stageDone('hermes', { quick: false });
    const lesson = lessonFor('hermes');
    if (lesson?.quiz) {
      const right = lesson.quiz.options.find((o) => o.correct).text;
      await card({ eyebrow: 'Mission debrief · Hermes', title: lesson.quiz.question, choices: lesson.quiz.options.map((o, i) => ({ id: String(i), label: o.text })), equal: true }, 2000, (t) => t === right);
      await card({ tone: 'win', eyebrow: 'Mission debrief', title: 'Correct!', text: [lesson.quiz.explain, 'You earned a *debrief sticker*!'], choices: [{ id: 'ok', label: 'Keep going' }] }, 1700);
    }
    await card(
      {
        eyebrow: 'Where to next?',
        title: 'Pick any stage',
        text: "You've finished a stage, so you can jump to *any* stage you like. The first button is the next one in order.",
        choices: stageChoices(STAGES, { completed: ['hermes'], stars: { hermes: 3 } }, 'hermes'),
      },
      2200,
    );
  }

  // ---------- 5. Stage 2: Odysseus, the zero-G plane ----------
  if (fromIndex <= 4) {
    chrome.chapter(4);
    const odysseus = await director.stage('odysseus');
    director.shot(odysseus.shots.cabin);
    await chrome.slate('Stage 2 · Odysseus', 'The zero-G plane', STAGE_COLOURS.odysseus);
    await card(
      {
        eyebrow: 'Stage 2 of 5 · Odysseus',
        title: 'The zero-G plane',
        text: ['This plane flies giant hills in the sky. Over the top of each hill, everything inside *floats*!', 'Your job: *catch the floating tools*, then help when the power gets low.'],
        choices: [{ id: 'go', label: 'Take off' }],
      },
      1800,
    );
    hudOn('odysseus', { plugs: 3 });
    ui.task({ now: 'Catch the *floating tools*' });
    ui.cheer({ title: 'ZERO-G!', sub: 'everything floats' });
    const air2 = oxygenTo(78, 7000);
    await wait(1300);
    ui.cheer({ title: 'DOUBLE CATCH!', sub: 'speedy hands!' });
    await progressTo(30);
    await wait(900);
    ui.cheer({ title: 'TRIPLE CATCH!', sub: 'speedy hands!' });
    await progressTo(55);
    await wait(900);
    ui.cheer({ title: 'SPLASH CATCH!', sub: 'a juice pouch burst into water blobs' });
    await progressTo(68);
    await air2;
    zeus('A generator broke: only *2 plugs* now! Turn *OFF* the extras so the *air machine* keeps running.');
    ui.hud.plugs(2);
    const machines = (on) => [
      { id: 'air', label: 'AIR MACHINE', kind: 'air', plugged: true },
      { id: 'camera', label: 'CAMERA', kind: 'work', plugged: true },
      { id: 'music', label: 'MUSIC', kind: 'extra', plugged: on },
    ];
    ui.power({ plugs: 2, overloaded: true, machines: machines(true), aimed: 'music' });
    await wait(2600);
    ui.power({ plugs: 2, overloaded: false, machines: machines(false), aimed: 'music' });
    ui.cheer({ title: 'POWER OK!', sub: 'air machine running' });
    await wait(1500);
    ui.power(null);
    zeus('Running low on air? Float into the *yellow oxygen masks*.');
    await oxygenTo(96, 1200);
    await progressTo(100);
    ui.cheer({ title: 'SCIENCE SENT HOME!', sub: 'water blobs caught: 6 of 6', big: true });
    await wait(1700);
    await stageDone('odysseus');
  }

  // ---------- 6. Stage 3: Dioscuri, the robot-arm lab ----------
  if (fromIndex <= 5) {
    chrome.chapter(5);
    const dioscuri = await director.stage('dioscuri');
    director.shot(dioscuri.shots.float);
    await chrome.slate('Stage 3 · Dioscuri', "The space station's robot arm and lab", STAGE_COLOURS.dioscuri);
    await card(
      {
        eyebrow: 'Stage 3 of 5 · Dioscuri',
        title: 'The robot-arm lab',
        text: ["This lab copies the space station's big window and its giant robot arm. You can *float* anywhere in here.", 'Your job: move the *science boxes* with the arm, start each experiment, and keep everything powered through *day and night*.'],
        choices: [{ id: 'go', label: 'Start floating' }],
      },
      1800,
    );
    hudOn('dioscuri', { plugs: 3 });
    director.shot(dioscuri.shots.desk);
    ui.task({ now: 'Move the *science box* to its slot with the arm' });
    zeus('Sit at the *arm controls*. Move the grabber over the box and press *E* to grab it. *Q* gets you out of the chair.');
    const air3 = oxygenTo(80, 9000);
    await wait(2600);
    ui.cheer({ title: 'BOX IN PLACE!', sub: 'now start the experiment' });
    await progressTo(33);
    director.shot(dioscuri.shots.float);
    await play({ kind: 'pipes', title: 'Connect the water pipes', text: 'Start the *space plants* experiment before the timer runs out!', size: 4 });
    ui.cheer({ title: 'EXPERIMENT STARTED!', sub: 'space plants' });
    await progressTo(55);
    zeus("*Night side of Earth!* The solar panels make no power, so you get fewer plugs. And here comes *space junk*: park the arm!");
    dioscuri.night();
    ui.hud.plugs(2);
    await wait(1800);
    ui.cheer({ title: 'DODGED!', sub: 'the junk zoomed past' });
    await wait(1000);
    await play({ kind: 'balance', title: 'Keep the mixer speed steady', text: 'Start the *water blobs* experiment before the timer runs out!', size: 3 });
    await air3;
    await progressTo(100);
    ui.cheer({ title: 'ALL EXPERIMENTS DONE!', big: true });
    await wait(1700);
    await stageDone('dioscuri');
  }

  // ---------- 7. Stage 4: Hera, the ship simulator ----------
  if (fromIndex <= 6) {
    chrome.chapter(6);
    const hera = await director.stage('hera');
    director.shot(hera.shots.seat);
    await chrome.slate('Stage 4 · Hera', 'The spaceship simulator', STAGE_COLOURS.hera);
    await card(
      {
        eyebrow: 'Stage 4 of 5 · Hera',
        title: 'The ship simulator',
        text: ["Before every flight, real astronauts practise in a *spaceship simulator*. Today you're the *pilot*, flying to the Moon.", 'Steer the *green diamond* into the *ring*, then *hold Space* to fire the engine. Steer around the *space junk*!'],
        choices: [{ id: 'go', label: 'Strap in' }],
      },
      1800,
    );
    hudOn('hera');
    ui.hud.storm('green');
    ui.task({ now: 'Steer into the *ring*, then hold *Space*' });
    hera.junk(true);
    zeus("That's it! The engine is firing and the *Progress bar* fills. Real pilots call this a *burn*.");
    progressTo(40, 4000);
    await wait(2000);
    ui.cheer({ title: 'DODGED!', sub: '1 piece of junk' });
    await wait(2000);
    ui.cheer({ title: 'DODGED!', sub: '3 pieces of junk' });
    await wait(900);
    hera.junk(false);
    ui.hud.storm('yellow');
    zeus('*Storm light is yellow!* A real solar flare just went off. Build the *storm shelter* from the supply bags!');
    await wait(2200);
    ui.hud.storm('red');
    ui.sound.music('tense');
    hera.alarm(2);
    ui.cheer({ title: 'SHELTER BUILT!', sub: 'radiation is 4x slower in here' });
    zeus("You stayed out too long... let's see what happens when the air runs out.");
    await oxygenTo(6, 1800);
    await card(
      {
        tone: 'alert',
        eyebrow: 'Sim over!',
        title: 'Zeus Jr. pulled you out',
        text: [
          "Nobody got hurt. It's only training, and failing is part of training.",
          'The moment that made the difference: *the storm hit while you were outside the shelter*.',
          'What real astronauts do: they hide in the shelter as soon as the storm light turns red.',
          'You keep all your badges.',
        ],
        choices: [
          { id: 'retry', label: 'Try again' },
          { id: 'quit', label: 'Back to the main menu' },
        ],
      },
      3000,
    );
    hudOn('hera');
    hera.alarm(0);
    ui.hud.storm('green');
    setProgress(70);
    ui.cheer({ title: 'ALL CLEAR!', sub: 'you stayed safe' });
    await wait(1300);
    const record = data.storm?.();
    if (record) {
      const date = new Date(record.date);
      await card(
        {
          eyebrow: 'What really happened',
          title: `A real storm from ${Number.isNaN(date.getTime()) ? record.date : date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          text: [record.kidText, `Measured by: ${record.measuredBy}.`],
          links: [{ title: `The ${record.strength} solar flare`, url: record.flareUrl, source: "NASA's space weather records (DONKI)", foundOn: record.savedOn }],
          note: 'A saved record from NASA, not live data.',
          choices: [{ id: 'ok', label: 'Whoa!' }],
        },
        3400,
      );
    }
    await progressTo(100);
    ui.cheer({ title: 'COURSE SET FOR THE MOON!', big: true });
    await wait(1700);
    await stageDone('hera');
  }

  // ---------- 8. Stage 5: Apollo, the Moon base ----------
  if (fromIndex <= 7) {
    chrome.chapter(7);
    apollo = await director.stage('apollo');
    director.shot(apollo.shots.outside);
    await chrome.slate('Stage 5 · Apollo', "A base at the Moon's south pole", STAGE_COLOURS.apollo);
    await card(
      {
        eyebrow: 'Stage 5 of 5 · Apollo',
        title: 'Moon Base Apollo',
        text: ["You made it to the Moon, Nova! You're the *Commander* of Moon Base Apollo. Keep the base alive for *14 Moon-days*.", 'For 7 days the Sun shines on your *solar panels*. Then comes the long, freezing *lunar night*, with only batteries.'],
        choices: [{ id: 'go', label: "Let's go, Commander" }],
      },
      1800,
    );
    hudOn('apollo', { plugs: 4 });
    ui.hud.clock(0);
    ui.task({ now: 'Moon-day 3 of 14: share the *plugs*, grow food, call Earth' });
    const days = tween(13000, (k) => ui.hud.clock(Math.round(k * 300)));
    ui.cheer({ title: 'POWER OK!', sub: 'machines back on' });
    await progressTo(20);
    await wait(900);
    ui.cheer({ title: 'HARVEST!', sub: 'fresh Moon food 1/2' });
    await progressTo(35);
    director.shot(apollo.shots.inside);
    await play({ kind: 'memory', title: 'Tune the radio to Earth', text: 'Match the *signal pairs* to find Mission Control.', size: 3 });
    ui.cheer({ title: 'EARTH ANSWERED!', sub: 'science report 1/2' });
    await progressTo(55);
    director.shot(apollo.shots.wide);
    await play({ kind: 'timing', title: 'Dig out the ice', text: 'Stop the needle in the *green zone* to break the ice free. Your suit air keeps running!', size: 3 });
    ui.cheer({ title: 'ICE!', sub: '+20 water · ice 1/2' });
    await progressTo(72);
    apollo.night();
    ui.hud.plugs(2);
    ui.cheer({ title: 'LUNAR NIGHT', sub: 'only 2 plugs now', big: true });
    zeus("The *lunar night* is here: 7 Earth-days of dark and cold. Turn off everything you don't need!");
    await days;
    await progressTo(100);
    ui.cheer({ title: 'MISSION COMPLETE!', big: true });
    await wait(1700);
    await stageDone('apollo');
    const windowDone = web.window('moon');
    await wait(2800);
    const cool = document.querySelector('.card-layer .card-choices button');
    if (cool) await cursor.click(cool);
    await windowDone;
  }

  // ---------- 9. Phones and iPads ----------
  if (fromIndex <= 8) {
    chrome.chapter(8);
    apollo ??= await director.stage('apollo');
    apollo.day();
    director.shot(apollo.shots.outside);
    forceDevice('touch');
    hudOn('apollo', { plugs: 4 });
    await chrome.slate('Phones and iPads', 'A move stick, drag to look, and big buttons', '#a98bff');
    zeus('Walk to the *greenhouse* and press E to harvest.');
    const knob = document.querySelector('.tc-knob');
    const use = document.querySelector('.tc-use');
    await tween(2000, (k) => knob && (knob.style.transform = `translate(${Math.sin(k * Math.PI * 2) * 22}px, ${-Math.abs(Math.sin(k * Math.PI)) * 30}px)`));
    if (knob) knob.style.transform = '';
    for (let i = 0; i < 2; i++) {
      use?.classList.add('is-down');
      await wait(260);
      use?.classList.remove('is-down');
      await wait(500);
    }
    await wait(1200);
    hudOff();
    forceDevice(startDevice);
  }

  // ---------- 10. Judge Demo ----------
  if (fromIndex <= 9) {
    chrome.chapter(9);
    await chrome.slate('Judge Demo', 'The whole game in 2-3 minutes, with a checklist that ticks itself', '#ffc145');
    ui.checklist.show();
    for (const item of CHECKLIST) {
      ui.checklist.tick(item.id);
      await wait(180);
    }
    await wait(1200);
    ui.checklist.hide();
  }

  // ---------- 11. The end ----------
  if (fromIndex <= 10) {
    chrome.chapter(10);
    apollo ??= await director.stage('apollo');
    ui.sound.music('title');
    director.shot(apollo.shots.finale);
    chrome.finish();
  }
}

// ---------- the tour's own overlay: start screen, timeline, chapter slates, the end ----------
function buildChrome() {
  const box = document.createElement('div');
  box.className = 'tour';
  box.innerHTML = `
    <div class="tour-start">
      <p class="tour-eyebrow">Presentation tour</p>
      <h1 class="tour-title">Path to Olympus</h1>
      <p class="tour-lead">Every part of the game, playing by itself, in about ${Math.round(TOTAL / 60)} minutes. Nothing you have saved is changed.</p>
      <ol class="tour-list">${CHAPTERS.map((c) => `<li>${c.label}</li>`).join('')}</ol>
      <div class="tour-actions">
        <button type="button" class="btn tour-go" data-full="1">Start full screen</button>
        <button type="button" class="btn btn-quiet tour-go">Start in this window</button>
      </div>
      <p class="tour-hint">Press <kbd>Esc</kbd> any time to stop.</p>
    </div>
    <div class="tour-top" hidden>
      <div class="tour-line"><span class="tour-fill"></span>${CHAPTERS.slice(0, -1)
        .map((c, i) => `<span class="tour-tick" style="left:${(CHAPTERS.slice(0, i + 1).reduce((s, x) => s + x.secs, 0) / TOTAL) * 100}%"></span>`)
        .join('')}</div>
      <p class="tour-now"><span class="tour-now-label"></span><span class="tour-now-time"></span></p>
    </div>
    <div class="tour-slate" hidden><p class="tour-slate-title"></p><p class="tour-slate-line"></p></div>
    <div class="tour-end" hidden>
      <p class="tour-eyebrow">Team Poseidon 13 · NASA Space Apps 2026</p>
      <h1 class="tour-title">Path to Olympus</h1>
      <p class="tour-lead">Train like a real astronaut, then prove it on the Moon.</p>
      <ol class="tour-ranks">${STAGES.map((s) => `<li style="--c:${STAGE_COLOURS[s.id]}"><strong>${s.rank}</strong><span>${s.name} · ${s.place}</span></li>`).join('')}</ol>
      <p class="tour-facts">Real NASA storm data · facts from NASA and the Canadian Space Agency · plays in any browser, on computers, phones and iPads</p>
      <div class="tour-actions">
        <a class="btn" href="?">Play the game</a>
        <a class="btn btn-quiet" href="?tour">Watch again</a>
      </div>
    </div>`;
  document.body.append(box);
  const $ = (s) => box.querySelector(s);
  let started = 0;
  let current = -1;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return {
    waitForStart() {
      return new Promise((resolve) => {
        box.querySelectorAll('.tour-go').forEach((b) =>
          b.addEventListener('click', () => {
            if (b.dataset.full) document.documentElement.requestFullscreen?.().catch(() => {});
            $('.tour-start').remove();
            resolve();
          }),
        );
      });
    },
    startClock(offset = 0) {
      started = performance.now() - offset * 1000;
      $('.tour-top').hidden = false;
      setInterval(() => {
        const s = (performance.now() - started) / 1000;
        $('.tour-fill').style.width = `${Math.min(100, (s / TOTAL) * 100)}%`;
        $('.tour-now-time').textContent = `${fmt(s)} / ${fmt(TOTAL)}`;
      }, 250);
    },
    chapter(i) {
      current = i;
      $('.tour-now-label').textContent = `${i + 1}. ${CHAPTERS[i].label}`;
    },
    // A big title card over the 3D for a moment at the start of a chapter.
    async slate(title, line, colour) {
      const slate = $('.tour-slate');
      slate.style.setProperty('--c', colour);
      $('.tour-slate-title').textContent = title;
      $('.tour-slate-line').textContent = line;
      slate.hidden = false;
      slate.classList.remove('is-on');
      void slate.offsetWidth;
      slate.classList.add('is-on');
      await wait(1900);
      slate.hidden = true;
      void current;
    },
    finish() {
      $('.tour-top').hidden = true;
      $('.tour-end').hidden = false;
    },
  };
}

// ---------- a pointer that moves to things and clicks them ----------
function createCursor() {
  const dot = document.createElement('div');
  dot.className = 'tour-cursor';
  dot.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l15 9.5-6.6 1.2 3.9 7.4-3 1.6-3.9-7.5L4 19z" fill="#fff" stroke="#0d0b26" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  dot.style.left = `${window.innerWidth * 0.6}px`;
  dot.style.top = `${window.innerHeight * 0.7}px`;
  document.body.append(dot);
  return {
    async click(el, { press = true } = {}) {
      const box = el.getBoundingClientRect();
      dot.hidden = false;
      dot.style.left = `${box.left + box.width / 2}px`;
      dot.style.top = `${box.top + box.height / 2}px`;
      await wait(620);
      dot.classList.remove('is-click');
      void dot.offsetWidth;
      dot.classList.add('is-click');
      await wait(140);
      if (press) el.click();
      await wait(220);
    },
  };
}

// ---------- the 3D: one renderer, the real stage worlds, camera moves ----------
function createDirector(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.className = 'tour-canvas';
  host.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 3000);
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  let set = null; // the stage on screen: { world, update, shots, ... }
  let shot = null;
  let shotStart = 0;
  let t = 0;
  let last = performance.now();
  const loaded = {};

  const preload = (id) => (loaded[id] ??= import(`../stages/${id}/world.js`));

  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (!set || !shot) return;
    shot(camera, t - shotStart, t, dt);
    set.update?.(t, dt);
    renderer.render(set.world.scene, camera);
  });

  return {
    preload,
    shot(fn) {
      shot = fn;
      shotStart = t;
    },
    async stage(id) {
      const mod = await preload(id);
      const next = await BUILD[id](mod, renderer, () => t);
      set?.world.dispose?.();
      set = next;
      shot = null;
      return next;
    },
  };
}

// Each stage's world, what it can do in the tour, and its camera moves. `into` = seconds into the shot.
const BUILD = {
  async hermes(mod, renderer, now) {
    const world = mod.buildWorld({ hints: 'more', panelCount: 3 });
    const { createBubbles } = await import('../stages/hermes/bubbles.js');
    const bubbles = createBubbles(world.scene, 100);
    const p1 = new THREE.Vector3(...mod.PANEL_SPOTS[0].pos);
    const from = mod.SPAWN.pos.clone().setY(5.2);
    const to = p1.clone().add(new THREE.Vector3(0.4, 0.1, 2.4));
    const look = new THREE.Vector3();
    return {
      world,
      update(t, dt) {
        bubbles.update(dt, t);
      },
      work(k) {
        world.panels[0]?.setWork(k);
      },
      fix(i) {
        world.panels[i]?.setWork(1);
        world.panels[i]?.markFixed(now());
      },
      shots: {
        start(camera, into, t) {
          camera.position.set(from.x, from.y + Math.sin(t * 0.5) * 0.15, from.z);
          camera.lookAt(2, 5.3, -2);
          world.update(t, camera);
        },
        swim(camera, into, t, dt) {
          const k = smooth(clamp01(into / 3.2));
          camera.position.lerpVectors(from, to, k);
          camera.position.y += Math.sin(t * 1.6) * 0.08;
          look.lerpVectors(new THREE.Vector3(2, 5.3, -2), p1, smooth(clamp01(into / 2.5)));
          camera.lookAt(look);
          if (Math.random() < dt * 8) bubbles.emit(camera.position.clone().add(new THREE.Vector3(0.3, -0.4, -0.6)), 3, 0.3);
          world.update(t, camera);
        },
        orbit(camera, into, t, dt) {
          const a = -0.9 + into * 0.09;
          camera.position.set(4 + Math.sin(a) * 11, 6.6 + Math.sin(t * 0.4) * 0.3, -2 + Math.cos(a) * 10);
          camera.lookAt(4, 6.5, -2);
          if (Math.random() < dt * 5) bubbles.emit(camera.position.clone().add(new THREE.Vector3(0.3, -0.4, -0.6)), 3, 0.3);
          world.update(t, camera);
        },
      },
    };
  },

  async odysseus(mod) {
    const world = mod.buildWorld({ hints: 'more' });
    const { createTools } = await import('../stages/odysseus/tools.js');
    const tools = createTools(world.scene, { count: 8, origin: world.toolbox.mouth, speed: 0.7, hints: 'more' });
    tools.release();
    return {
      world,
      shots: {
        cabin(camera, into, t, dt) {
          const k = (into % 12) / 12;
          camera.position.set(Math.sin(t * 0.6) * 0.3, 1.3 + Math.sin(t * 0.9) * 0.14, 6.6 - smooth(k) * 2.2);
          camera.lookAt(0, 1.0, 1.5);
          camera.rotation.z += Math.sin(t * 0.7) * 0.08;
          world.setPitch(Math.sin(t * 0.5) * 20);
          world.toolbox.update(dt);
          tools.update(dt, t, { g: 0, camera });
          world.update(t, dt, camera);
        },
      },
    };
  },

  async dioscuri(mod) {
    const world = mod.buildWorld({ hints: 'more', suit: 'orange', boxes: 3 });
    world.setOrbit({ side: 'day', k: 0.25 }); // puts the Sun in the sky
    world.inside.setSeated(false);
    const tip = new THREE.Vector3();
    const reach = (t) => {
      tip.set(Math.sin(t * 0.45) * 3.2, -1.2 + Math.sin(t * 0.9) * 0.5, -8.4 + Math.cos(t * 0.45) * 1.0);
      world.arm.reach(tip);
    };
    return {
      world,
      night() {
        world.setOrbit({ side: 'night', k: 0.5 });
      },
      shots: {
        float(camera, into, t, dt) {
          camera.position.set(Math.sin(t * 0.3) * 0.5, 0.2 + Math.sin(t * 0.5) * 0.08, 2.9 - smooth(clamp01(into / 8)) * 1.4);
          camera.lookAt(0, -0.9, -6);
          world.inside.setSeated(false);
          reach(t);
          world.update(t, dt, camera);
          world.inside.animate(t);
        },
        desk(camera, into, t, dt) {
          camera.position.copy(mod.EYE);
          camera.lookAt(Math.sin(t * 0.45) * 1.2, -1.0, -6);
          world.inside.setSeated(true);
          world.inside.tilt({ x: Math.cos(t * 0.9) * 0.3, z: 0 }, { x: 0, z: Math.sin(t * 0.45) * 0.4 });
          reach(t);
          world.update(t, dt, camera);
          world.inside.animate(t);
        },
      },
    };
  },

  async hera(mod, renderer) {
    const world = mod.buildWorld({ suit: 'orange', bags: 3, renderer, hints: 'more' });
    const att = new THREE.Quaternion();
    const turn = new THREE.Euler();
    const look = new THREE.Vector3();
    world.setTargetDirection(world.boresight.clone());
    const junk = [];
    let junkOn = false;
    let since = 0;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    return {
      world,
      junk(on) {
        junkOn = on;
      },
      alarm(level) {
        world.setAlarm(level);
      },
      update(t, dt) {
        since += dt;
        if (junkOn && since > 1.3) {
          since = 0;
          const b = world.boresight;
          right.crossVectors(b, new THREE.Vector3(0, 1, 0)).normalize();
          up.crossVectors(right, b).normalize();
          const spin = Math.random() * Math.PI * 2;
          const off = 0.03 + Math.random() * 0.05;
          const u = b.clone().multiplyScalar(Math.cos(off)).addScaledVector(right, Math.cos(spin) * Math.sin(off)).addScaledVector(up, Math.sin(spin) * Math.sin(off));
          junk.push({ piece: world.spawnJunk(u.applyQuaternion(att)), dist: 60 });
        }
        for (let i = junk.length - 1; i >= 0; i--) {
          const j = junk[i];
          j.dist -= 32 * dt;
          world.setJunk(j.piece, Math.max(j.dist, 2.4), j.dist < 25 ? 0.2 : 0.7, dt);
          if (j.dist <= 2.4) {
            world.removeJunk(j.piece);
            junk.splice(i, 1);
          }
        }
      },
      shots: {
        seat(camera, into, t, dt) {
          turn.set(Math.sin(t * 0.5) * 0.08, Math.sin(t * 0.32) * 0.25, Math.sin(t * 0.4) * 0.1);
          world.setAttitude(att.setFromEuler(turn));
          camera.position.copy(mod.SEAT_EYE);
          look.copy(mod.SEAT_EYE).addScaledVector(world.boresight, 3).add(new THREE.Vector3(Math.sin(t * 0.3) * 0.2, 0.1, 0));
          camera.lookAt(look);
          world.update(t, dt, camera);
        },
      },
    };
  },

  async apollo(mod) {
    const world = mod.buildWorld({ suit: 'orange', trays: 3, iceChunks: 6, hints: 'more' });
    world.setDaylight(1);
    return {
      world,
      night() {
        world.setDaylight(0);
        world.setLights(true);
      },
      day() {
        world.setDaylight(1);
      },
      shots: {
        outside(camera, into, t, dt) {
          // round the base, staying outside the ring of solar panel masts
          const e = ease(clamp01(into / 10));
          const a = 0.95 - e * 0.33;
          const r = 24 - e;
          const x = -3 + Math.cos(a) * r;
          const z = Math.sin(a) * r;
          camera.position.set(x, mod.groundAt(x, z) + 1.8 + e * 0.5, z);
          camera.lookAt(-3, 1.4, 0);
          world.update(t, dt, camera);
        },
        inside(camera, into, t, dt) {
          camera.position.set(2.6 - smooth(clamp01(into / 8)) * 1.2, 1.55 + Math.sin(t * 0.8) * 0.03, Math.sin(t * 0.3) * 0.3);
          camera.lookAt(-4, 1.3, -0.4);
          world.update(t, dt, camera);
        },
        wide(camera, into, t, dt) {
          // high over the base from the ice crater side, slowly drifting
          const a = -0.5 + clamp01(into / 20) * 0.15;
          const x = -3 + Math.cos(a) * 26;
          const z = Math.sin(a) * 26;
          camera.position.set(x, mod.groundAt(x, z) + 7, z);
          camera.lookAt(-3, 0.8, 0);
          world.update(t, dt, camera);
        },
        finale(camera, into, t, dt) {
          // the base with Earth behind it, backing away a little (never into the solar masts)
          const e = ease(clamp01(into / 14));
          const a = 0.42;
          const r = 17 + e * 2;
          const x = -3 + Math.cos(a) * r;
          const z = Math.sin(a) * r;
          camera.position.set(x, mod.groundAt(x, z) + 2.2 + e * 0.6, z);
          camera.lookAt(-3, 1.6, 0);
          world.update(t, dt, camera);
        },
      },
    };
  },
};
