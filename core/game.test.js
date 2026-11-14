import { describe, it, expect, vi } from 'vitest';
import { createGame } from './game.js';

function fakeUi() {
  return {
    card: vi.fn(async () => null),
    buoy: vi.fn(),
    prompt: vi.fn(),
    hud: { oxygen: vi.fn(), progress: vi.fn(), plugs: vi.fn(), storm: vi.fn() },
    checklist: { tick: vi.fn() },
  };
}

function make(overrides = {}) {
  const ui = fakeUi();
  const onSimOver = vi.fn();
  const onFinish = vi.fn();
  const game = createGame({
    stageId: 'hermes',
    mode: 'easy',
    ui,
    onSimOver,
    onFinish,
    ...overrides,
  });
  return { game, ui, onSimOver, onFinish };
}

describe('createGame', () => {
  it('starts with full oxygen and no progress', () => {
    const { game } = make();
    expect(game.oxygen.value).toBe(100);
    expect(game.progress.value).toBe(0);
  });

  it('shows bar changes on the visor', () => {
    const { game, ui } = make();
    game.oxygen.change(-10);
    game.progress.change(+25);
    expect(ui.hud.oxygen).toHaveBeenLastCalledWith(90);
    expect(ui.hud.progress).toHaveBeenLastCalledWith(25);
  });

  it('calls Sim over once when oxygen runs out, with the moment that mattered', () => {
    const { game, onSimOver } = make();
    game.oxygen.change(-80, 'breathing');
    game.oxygen.change(-30, 'working');
    game.oxygen.change(-5, 'working');
    expect(onSimOver).toHaveBeenCalledTimes(1);
    expect(onSimOver.mock.calls[0][0].moment.reason).toBe('working');
    expect(game.running).toBe(false);
  });

  it('reports finish only once', () => {
    const { game, onFinish } = make();
    game.finish({ stars: 3, passed: true });
    game.finish({ stars: 1, passed: true });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ stars: 3, passed: true });
    expect(game.running).toBe(false);
  });

  it('ignores bar changes after the stage has ended', () => {
    const { game } = make();
    game.finish({ stars: 1, passed: true });
    game.oxygen.change(-50);
    expect(game.oxygen.value).toBe(100);
  });

  it('does not finish after Sim over', () => {
    const { game, onFinish } = make();
    game.oxygen.change(-100);
    game.finish({ stars: 3, passed: true });
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('sets energy plugs and shows them', () => {
    const { game, ui } = make();
    game.plugs.set(4);
    expect(game.plugs.value).toBe(4);
    expect(ui.hud.plugs).toHaveBeenLastCalledWith(4);
  });

  it('only accepts green, yellow or red for the storm light', () => {
    const { game, ui } = make();
    game.storm.light('red');
    expect(game.storm.value).toBe('red');
    expect(ui.hud.storm).toHaveBeenLastCalledWith('red');
    expect(() => game.storm.light('purple')).toThrow(/green \| yellow \| red/);
  });

  it('ticks a judge checklist item once', () => {
    const { game, ui } = make({ mode: 'demo' });
    expect(game.demo.check('every-choice-costs')).toBe(true);
    expect(game.demo.check('every-choice-costs')).toBe(false);
    expect(ui.checklist.tick).toHaveBeenCalledTimes(1);
  });

  it('rejects checklist ids that are not in CONTRACTS.md', () => {
    const { game } = make();
    expect(() => game.demo.check('made-up-item')).toThrow(/checklist/);
  });

  it('passes Buoy lines and cards through to the UI', () => {
    const { game, ui } = make();
    game.ui.buoy('Suits only carry so much air!');
    game.ui.card({ title: 'Hi', text: 'There', choices: [] });
    expect(ui.buoy).toHaveBeenCalledWith('Suits only carry so much air!');
    expect(ui.card).toHaveBeenCalledWith({ title: 'Hi', text: 'There', choices: [] });
  });

  it('tells the stage when a card is on screen, so it can pause', () => {
    const { game, ui } = make();
    ui.cardOpen = false;
    expect(game.ui.busy).toBe(false);
    ui.cardOpen = true;
    expect(game.ui.busy).toBe(true);
  });

  it('lets an urgent Buoy line jump the queue', () => {
    const { game, ui } = make();
    game.ui.buoy('Oxygen very low!', { interrupt: true });
    expect(ui.buoy).toHaveBeenCalledWith('Oxygen very low!', { interrupt: true });
  });

  it('passes the visor prompt, target ring and pause screen through to the UI', () => {
    const { game, ui } = make();
    ui.pause = vi.fn();
    ui.hud.target = vi.fn();
    const resume = () => {};
    game.ui.prompt('Hold [E] to fix');
    game.ui.target(true);
    game.ui.pause(true, resume);
    expect(ui.prompt).toHaveBeenCalledWith('Hold [E] to fix');
    expect(ui.hud.target).toHaveBeenCalledWith(true);
    expect(ui.pause).toHaveBeenCalledWith(true, resume);
  });

  it('gives the stage its mode-adjusted numbers', () => {
    const easy = make({ mode: 'easy' }).game;
    const hard = make({ mode: 'hard' }).game;
    expect(hard.rules.breathePerSec).toBeGreaterThan(easy.rules.breathePerSec);
  });

  it('can start with less oxygen when the rules say so', () => {
    const { game } = make({ mode: 'demo' });
    expect(game.oxygen.value).toBe(game.rules.startOxygen);
  });

  it('runs cleanup functions when the stage ends', () => {
    const { game } = make();
    const cleanup = vi.fn();
    game.addCleanup(cleanup);
    game.end();
    game.end();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs a cleanup straight away if the stage already ended (async start)', () => {
    const { game } = make();
    game.end();
    const cleanup = vi.fn();
    game.addCleanup(cleanup);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('plays sounds while the stage runs, and goes quiet once it ends', () => {
    const play = vi.fn();
    const handle = { set: vi.fn(), stop: vi.fn() };
    const ui = { ...fakeUi(), sound: { play, loop: vi.fn(() => handle) } };
    const game = createGame({ stageId: 'hermes', ui });
    game.sound.play('beep');
    const hum = game.sound.loop('hum');
    expect(play).toHaveBeenCalledWith('beep');
    expect(hum).toBe(handle);
    game.end();
    game.sound.play('beep');
    expect(play).toHaveBeenCalledTimes(1);
    expect(handle.stop).toHaveBeenCalled(); // loops never outlive the stage
  });

  it('still works when the UI has no sound', () => {
    const { game } = make();
    expect(() => game.sound.play('beep')).not.toThrow();
    expect(() => game.sound.loop('hum').set(0.5)).not.toThrow();
  });
});
