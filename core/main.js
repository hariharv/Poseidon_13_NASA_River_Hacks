// Boots the game.
//   /                         homepage (team + make your astronaut) -> loading screen -> pick a mode -> training
//   /?stage=hermes            one stage alone (for stage builders)
//   /?stage=hermes&mode=demo  that stage's judge version

import '../ui/tokens.css';
import { createUI } from '../ui/index.js';
import { createSave } from './save.js';
import { playStage, STAGES } from './session.js';
import { createData, createWeb } from '../data/index.js';
import { loadStage } from './stages.js';

const MODES = ['easy', 'hard', 'demo'];
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

if (stageParam) {
  runSingleStage(stageParam, modeParam);
} else {
  showTitle();
}

async function showTitle() {
  // Homepage first: Team Poseidon 13 and "Make your astronaut". Then the menu (loading screen).
  const { showHome } = await import('../intro/home.js');
  const player = await showHome({ root: app, player: save.loadPlayer(), progress: save.loadProgress() });
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

// Normal play: the stages in order, starting from the first one not finished yet.
// (The Olympus Academy intro and character maker slot in here once Person 5 lands them.)
async function runTraining(mode) {
  const done = save.loadProgress().completed;
  // Pick up at the first built stage not finished yet. Once every built stage is done,
  // start again from Stage 1 so the player can replay (or try Hard) instead of hitting "Coming soon".
  const next = STAGES.findIndex((s) => s.available && !done.includes(s.id));
  const start = next === -1 ? 0 : next;
  for (const stage of STAGES.slice(start)) {
    if (!stage.available) {
      await ui.card({
        eyebrow: 'Coming soon',
        title: `${stage.name} is still being built`,
        text: `Next up is the *${stage.place.toLowerCase()}*. Our team is building it right now.`,
        choices: [{ id: 'ok', label: 'Back to the title screen' }],
      });
      return;
    }
    const result = await playStage(stage.id, { ...ctx, mode });
    if (result?.quit || result?.crashed) return;
  }
}

// Judge Demo: every built stage's short version, back to back, with the checklist on screen.
async function runJudgeDemo() {
  ui.checklist.show();
  ui.checklist.tick('easy-hard-modes'); // both modes were on the title screen the judge just saw
  ui.checklist.tick('intro-character'); // and the character maker on the homepage before it
  for (const stage of STAGES) {
    if (!stage.available) continue;
    const result = await playStage(stage.id, { ...ctx, mode: 'demo', demo: true });
    if (result?.quit || result?.crashed) return;
  }
  const built = STAGES.filter((s) => s.available).length;
  await ui.card({
    eyebrow: 'Judge Demo complete',
    title: `${ui.checklist.count} of 15 proven live`,
    text: `${built} of ${STAGES.length} stages are in the demo so far. The rest join as each teammate merges.`,
    choices: [{ id: 'ok', label: 'Back to the title screen' }],
  });
}
