// The `game` object every stage receives. See CONTRACTS.md.

import { createBar } from './bar.js';
import { rulesFor } from './rules.js';
import { pickMoment } from './moments.js';
import { isChecklistId } from './checklist.js';
import { DEFAULT_PLAYER } from './save.js';

const STORM_COLOURS = ['green', 'yellow', 'red'];

export function createGame({
  stageId,
  mode = 'easy',
  ui,
  data = null,
  web = null,
  root = null,
  player = DEFAULT_PLAYER,
  onSimOver = () => {},
  onFinish = () => {},
}) {
  const rules = rulesFor(stageId, mode);
  let running = true;
  let ended = false;
  const cleanups = [];
  const ticked = new Set();

  const oxygen = guarded(createBar({ value: rules.startOxygen ?? 100 }));
  const progress = guarded(createBar({ value: 0 }));

  oxygen.on('change', ({ value }) => ui.hud.oxygen(value));
  progress.on('change', ({ value }) => ui.hud.progress(value));
  oxygen.on('empty', () => {
    if (!running) return;
    running = false;
    onSimOver({ moment: pickMoment(oxygen.log, { below: rules.lowOxygen ?? 30 }) });
  });

  // Bars stop moving once the stage is over, so a late frame can't change the result.
  function guarded(bar) {
    const change = bar.change;
    bar.change = (delta, reason) => (running ? change(delta, reason) : bar.value);
    return bar;
  }

  let plugCount = 0;
  let stormColour = 'green';

  // Sound: one-shots only play while the stage runs, and every loop stops when it ends.
  const QUIET_LOOP = { set() {}, stop() {} };
  const loops = new Set();
  const sound = {
    play(name) {
      if (running) ui.sound?.play(name);
    },
    loop(name, level) {
      if (!ui.sound || ended) return QUIET_LOOP;
      const handle = ui.sound.loop(name, level);
      loops.add(handle);
      return handle;
    },
  };

  const game = {
    stageId,
    mode,
    rules,
    root,
    player: Object.freeze(structuredClone(player)),
    get running() {
      return running;
    },

    oxygen,
    progress,

    plugs: {
      get value() {
        return plugCount;
      },
      set(n) {
        plugCount = Math.max(0, Math.floor(n));
        ui.hud.plugs(plugCount);
        return plugCount;
      },
    },

    storm: {
      get value() {
        return stormColour;
      },
      light(colour) {
        if (!STORM_COLOURS.includes(colour)) {
          throw new Error(`storm.light() takes green | yellow | red, got "${colour}"`);
        }
        stormColour = colour;
        ui.hud.storm(colour);
        if (running) ui.sound?.music?.(colour === 'red' ? 'tense' : 'calm');
        return colour;
      },
    },

    ui: {
      card: (options) => ui.card(options),
      buoy: (text, options) => (options ? ui.buoy(text, options) : ui.buoy(text)),
      prompt: (text) => ui.prompt?.(text),
      target: (on) => ui.hud.target?.(on),
      pause: (on, onResume) => ui.pause?.(on, onResume),
      task: (spec) => ui.task?.(spec),
      power: (spec) => ui.power?.(spec),
      cheer: (options) => ui.cheer?.(options),
      countdown: () => (ui.countdown ? ui.countdown() : Promise.resolve()),
      clock: (seconds, goal) => ui.hud.clock?.(seconds, goal),
      puzzle: (options) => (ui.puzzle ? ui.puzzle(options) : Promise.resolve(true)),
      get puzzleOpen() {
        return Boolean(ui.puzzleOpen);
      },
      get busy() {
        return Boolean(ui.cardOpen);
      },
    },

    data,
    web,
    sound,

    demo: {
      check(id) {
        if (!isChecklistId(id)) {
          throw new Error(`"${id}" is not a judge checklist id (see CONTRACTS.md)`);
        }
        if (ticked.has(id)) return false;
        ticked.add(id);
        ui.checklist?.tick(id);
        return true;
      },
    },

    finish(result) {
      if (!running) return;
      running = false;
      onFinish(result);
    },

    // Engine side: the session manager uses these to tear a stage down.
    addCleanup(fn) {
      if (typeof fn !== 'function') return;
      if (ended) fn();
      else cleanups.push(fn);
    },
    end() {
      running = false;
      ended = true;
      loops.forEach((h) => h.stop());
      loops.clear();
      while (cleanups.length) {
        try {
          cleanups.pop()();
        } catch (err) {
          console.error('Stage cleanup failed', err);
        }
      }
    },
  };

  return game;
}
