// Boots the game.
//   /                         title cutscenes -> homepage (team + make your astronaut) -> loading screen -> pick a mode -> training
//   /?stage=hermes            one stage alone (for stage builders)
//   /?stage=hermes&mode=demo  that stage's judge version

import '../ui/tokens.css';
import { createUI } from '../ui/index.js';
import { createSave } from './save.js';
import { playStage, STAGES } from './session.js';
import { createData, createWeb } from '../data/index.js';
import { loadStage, stageChoices } from './stages.js';
import { CHECKLIST } from './checklist.js';

const MODES = ['easy', 'demo'];
const params = new URLSearchParams(location.search);
const stageParam = params.get('stage');
const modeParam = MODES.includes(params.get('mode')) ? params.get('mode') : 'easy';

const app = document.getElementById('app');
const stageHost = document.createElement('main');
stageHost.className = 'stage-host';
app.append(stageHost);

const save = createSave();
const ui = createUI(app);
const data = createData();
const web = createWeb(ui);
const ctx = { ui, root: stageHost, save, data, web };
if (import.meta.env?.DEV) window.__ui = ui; // dev only: poke the UI (e.g. the music) from the console

if (stageParam) {
  runSingleStage(stageParam, modeParam);
} else {
  showTitle();
}

async function showTitle() {
  // Homepage first: Team Poseidon 13 and "Make your astronaut". Then the menu (loading screen).
  ui.sound.music('title'); // starts on the first click (browsers only allow sound after one)
  // Title screen first: cutscenes from the game until the player presses Start.
  const { showTitle: showCutscenes } = await import('../intro/title.js');
  await showCutscenes({ root: app });
  const { showHome } = await import('../intro/home.js');
  // the homepage saves player.json the moment you change your name (or anything else)
  const player = await showHome({ root: app, player: save.loadPlayer(), progress: save.loadProgress(), onChange: (p) => save.savePlayer(p) });
  save.savePlayer(player);

  const { showLoadingScreen } = await import('../intro/loading.js');
  const { mode } = await showLoadingScreen({
    root: app,
    stages: STAGES,
    player: save.loadPlayer(),
    progress: save.loadProgress(),
    tasks: [
      { label: 'Waking up Zeus Jr.…', weight: 1, run: () => document.fonts?.ready },
      { label: 'Filling the training pool…', weight: 3, run: () => loadStage('hermes') },
      { label: 'Checking your suit seals…', weight: 1, run: () => data.ready() },
    ],
  });
  document.documentElement.dataset.mode = mode;
  if (mode === 'demo') await runJudgeDemo();
  else await runTraining(mode);
  location.reload(); // back to the title screen with fresh state
}

async function runSingleStage(id, mode) {
  document.documentElement.dataset.mode = mode;
  if (mode === 'demo') ui.checklist.show();
  try {
    await playStage(id, { ...ctx, mode, demo: mode === 'demo' });
  } catch (err) {
    await ui.card({ tone: 'alert', title: 'Stage not found', text: String(err.message), choices: [{ id: 'ok', label: 'Go to the title screen' }] });
  }
  location.href = location.pathname;
}

// Normal play. A brand-new player starts at Stage 1. Once you've finished any stage, you can
// jump to any stage you like: after each stage (and from the Menu) a picker shows every stage,
// with the next one first.
async function runTraining(mode) {
  const built = STAGES.filter((s) => s.available);
  let last = null; // the stage just finished
  let chooser = false; // the Menu's "Back to the level chooser" was pressed
  for (;;) {
    const done = save.loadProgress().completed;
    const id = done.length || chooser ? await pickStage(built, last) : built[0]?.id;
    if (!id) return;
    const result = await playStage(id, { ...ctx, mode });
    if (result?.quit || result?.crashed) return;
    chooser = Boolean(result?.jumped);
    last = result?.passed ? id : null; // left from the Menu: no "next" to suggest
  }
}

// "Where to next?": the suggested stage first, then every built stage.
async function pickStage(built, last) {
  const progress = save.loadProgress();
  const allDone = built.every((s) => progress.completed.includes(s.id));
  const pick = await ui.card({
    eyebrow: last ? 'Where to next?' : 'Level chooser',
    title: allDone ? 'Every stage is open' : progress.completed.length ? 'Pick any stage' : 'Pick a stage',
    text: allDone
      ? "You've finished them all! Play any stage again to beat your stars."
      : progress.completed.length
        ? "You've finished a stage, so you can jump to *any* stage you like. The first button is the next one in order."
        : 'Start with *Stage 1*. Finish any stage and every stage opens up.',
    choices: stageChoices(built, progress, last),
  });
  return pick === 'quit' ? null : pick;
}

// Judge Demo: every built stage's short version, back to back, with the checklist on screen.
async function runJudgeDemo() {
  ui.checklist.show();
  ui.checklist.tick('intro-character'); // and the character maker on the homepage before it
  // Judges can start anywhere: play everything in order, or jump straight to one stage.
  // (During any stage, Menu -> "Skip to the next stage" moves on.)
  const built = STAGES.filter((s) => s.available);
  let finished = false;
  while (!finished) {
    const pick = await ui.card({
      eyebrow: 'Judge Demo',
      title: 'Where do you want to start?',
      text: 'Each stage takes about 30 seconds. You can skip ahead, or come back here, any time from the *Menu* button.',
      choices: [
        { id: 'all', label: 'Play them all, in order' },
        ...built.map((s) => ({ id: s.id, label: `Stage ${STAGES.indexOf(s) + 1} · ${s.name} (${s.place})` })),
      ],
    });
    const from = pick === 'all' ? 0 : Math.max(0, built.findIndex((s) => s.id === pick));
    finished = true;
    for (const stage of built.slice(from)) {
      const result = await playStage(stage.id, { ...ctx, mode: 'demo', demo: true });
      if (result?.quit || result?.crashed) return;
      if (result?.jumped) {
        finished = false; // back to "Where do you want to start?"
        break;
      }
    }
  }
  await ui.card({
    eyebrow: 'Judge Demo complete',
    title: `${ui.checklist.count} of ${CHECKLIST.length} proven live`,
    text: `${built.length} of ${STAGES.length} stages are in the demo so far. The rest join as each teammate merges.`,
    choices: [{ id: 'ok', label: 'Back to the title screen' }],
  });
}
