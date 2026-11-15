// Runs one stage: builds `game`, starts the stage, and handles Sim over,
// Try again, the in-game Menu and Stage complete. Resolves when the player moves on
// with the stage's result, or { quit: true } / { crashed: true }.

import { createGame } from './game.js';
import { STAGES, loadStage } from './stages.js';
import { lessonFor, shuffleQuiz, WEB_SEARCH } from './lessons.js';

export async function playStage(id, { mode, ui, root, save, data, web, demo = false }) {
  const meta = STAGES.find((s) => s.id === id);
  const index = STAGES.indexOf(meta);
  const stage = await loadStage(id);
  const lesson = lessonFor(id);
  let factIndex = Math.floor(Math.random() * 100);
  let factTimer = null;

  return new Promise((resolve) => {
    let menuOpen = false;

    // The Menu button (and the pause screen's Menu) during play.
    async function openMenu(game) {
      if (menuOpen || !game.running) return;
      menuOpen = true;
      if (document.pointerLockElement) document.exitPointerLock();
      const canJump = save.loadProgress().completed.length > 0; // finished a stage = every stage is open
      const choice = await ui.card({
        eyebrow: `Stage ${index + 1} · ${stage.name}`,
        title: 'Menu',
        text: 'Training is paused while this is open.',
        choices: [
          { id: 'resume', label: 'Keep training' },
          { id: 'restart', label: 'Start this stage again' },
          ...(demo ? [{ id: 'skip', label: 'Skip to the next stage' }] : []),
          ...(!demo && canJump ? [{ id: 'jump', label: 'Jump to another stage' }] : []),
          { id: 'quit', label: 'Back to the main menu' },
        ],
      });
      menuOpen = false;
      if (!game.running) return;
      if (choice === 'restart') {
        teardown(game);
        attempt();
      } else if (choice === 'jump') {
        teardown(game);
        resolve({ jumped: true });
      } else if (choice === 'skip') {
        teardown(game);
        resolve({ skipped: true });
      } else if (choice === 'quit') {
        teardown(game);
        resolve({ quit: true });
      }
    }

    function attempt() {
      const stageRoot = document.createElement('div');
      stageRoot.className = 'stage-root';
      root.replaceChildren(stageRoot);

      const game = createGame({
        stageId: id,
        mode,
        ui,
        data,
        web,
        root: stageRoot,
        player: save.loadPlayer(),
        onSimOver: async ({ moment }) => {
          teardown(game);
          game.demo.check('replayability');
          const choice = await ui.card({
            tone: 'alert',
            eyebrow: 'Sim over!',
            title: 'Zeus Jr. pulled you out',
            text: [
              "Nobody got hurt. It's only training, and failing is part of training.",
              `The moment that made the difference: *${moment.text}*`,
              ...(lesson ? [`What real astronauts do: ${lesson.tip}`] : []),
              'You keep all your badges.',
            ],
            choices: [
              { id: 'retry', label: 'Try again' },
              { id: 'quit', label: 'Back to the main menu' },
            ],
          });
          if (choice === 'quit') resolve({ quit: true });
          else attempt();
        },
        onFinish: async (result) => {
          teardown(game);
          if (result.passed && !demo) {
            save.recordStage(id, result.stars ?? 1);
            if (result.badge) save.addBadge(result.badge);
          }
          if (result.passed) ui.celebrate?.(); // confetti and clapping: you finished the level!
          const didYouKnow = lesson?.facts[factIndex++ % lesson.facts.length];
          await ui.card({
            tone: 'win',
            eyebrow: `Stage ${index + 1} of ${STAGES.length} complete`,
            title: `${stage.name} done!`,
            stars: result.stars ?? 1,
            text: [`Your rank: *${stage.rank}*`, ...(lesson ? [`Real astronaut skill you practised: *${lesson.skill}*`] : [])],
            facts: didYouKnow ? [{ label: 'Did you know?', value: didYouKnow.text, source: didYouKnow.source, url: didYouKnow.url }] : undefined,
            choices: [{ id: 'next', label: 'Keep going' }],
          });
          await ui.whenIdle(); // e.g. the Real World Window the stage opened
          if (!demo && lesson) await debrief(lesson);
          resolve(result);
        },
      });

      ui.hud.reset({ low: game.rules.lowOxygen ?? 30 });
      ui.hud.oxygen(game.oxygen.value);
      ui.hud.progress(game.progress.value);
      ui.hud.show();
      ui.setMenu?.(() => openMenu(game));
      ui.sound?.music?.('calm');
      startFacts(game);
      ui.setRealNumbers(
        !demo && stage.realNumbers?.length
          ? () => ui.card({ eyebrow: stage.name, title: 'Real numbers', facts: stage.realNumbers, choices: [{ id: 'ok', label: 'Back to training' }] })
          : null,
      );

      // .then() so a stage that throws while starting (no WebGL, say) still reaches the crash card.
      Promise.resolve()
        .then(() => (demo ? stage.demo : stage.start).call(stage, game))
        .then((cleanup) => game.addCleanup(cleanup))
        .catch(async (err) => {
          console.error(`Stage "${id}" crashed`, err);
          teardown(game);
          const noWebGL = /webgl/i.test(String(err?.message));
          await ui.card({
            tone: 'alert',
            title: noWebGL ? "This browser can't draw 3D" : `${stage.name} stopped working`,
            text: noWebGL
              ? 'Path to Olympus needs 3D graphics (WebGL). Turn on "hardware acceleration" in your browser settings, or open the game in Chrome, Edge or Safari.'
              : 'Reload the page to try this stage again.',
            choices: [{ id: 'ok', label: 'Back to the title screen' }],
          });
          resolve({ stars: 0, passed: false, crashed: true });
        });
    }

    // Zeus Jr. shares a real astronaut fact when nothing else is going on (not in the short Judge Demo).
    function startFacts(game) {
      clearInterval(factTimer);
      if (demo || !lesson) return;
      // real-world facts found with SerpApi (saved ahead of time), mixed in with the saved astronaut facts
      const webFacts = web?.facts?.(WEB_SEARCH[id]) ?? [];
      let webIndex = 0;
      let turn = 0;
      let quietFor = 0;
      factTimer = setInterval(() => {
        if (!game.running) return clearInterval(factTimer);
        quietFor = ui.quiet ? quietFor + 1 : 0;
        if (quietFor >= 35) {
          quietFor = -10;
          if (webFacts.length && turn++ % 2 === 1) {
            const w = webFacts[webIndex++ % webFacts.length];
            ui.buoy(`*Found with SerpApi (${w.source}):* ${w.text}`);
          } else {
            const f = lesson.facts[factIndex++ % lesson.facts.length];
            ui.buoy(`*Astronaut fact:* ${f.text}`);
          }
        }
      }, 1000);
    }

    function teardown(game) {
      clearInterval(factTimer);
      game.end();
      ui.prompt(null);
      ui.clearBuoy();
      ui.pause(false);
      ui.setRealNumbers(null);
      ui.hud.target(false);
      ui.setMenu?.(null);
      ui.task?.(null);
      ui.power?.(null);
      ui.hud.hide();
    }

    attempt();
  });

  // One question after the stage. A right answer earns a sticker; a wrong one just shows the answer.
  async function debrief(lesson) {
    const quiz = shuffleQuiz(lesson.quiz);
    const pick = await ui.card({
      eyebrow: `Mission debrief · ${stage.name}`,
      title: quiz.question,
      choices: quiz.options.map((o, i) => ({ id: String(i), label: o.text })),
      equal: true, // no answer looks like the "right" button
    });
    const right = quiz.options[Number(pick)]?.correct;
    const answer = quiz.options.find((o) => o.correct).text;
    if (right) save.addSticker?.(`debrief-${id}`);
    await ui.card({
      tone: right ? 'win' : undefined,
      eyebrow: 'Mission debrief',
      title: right ? 'Correct!' : 'Not quite',
      text: [...(right ? [] : [`The answer: *${answer}*.`]), quiz.explain, ...(right ? ['You earned a *debrief sticker*!'] : [])],
      choices: [{ id: 'ok', label: 'Keep going' }],
    });
  }
}

export { STAGES };
