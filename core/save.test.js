import { describe, it, expect, beforeEach } from 'vitest';
import { createSave, cleanName, DEFAULT_PLAYER } from './save.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

describe('createSave', () => {
  let storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('gives a default astronaut when nothing is saved', () => {
    expect(createSave(storage).loadPlayer()).toEqual(DEFAULT_PLAYER);
  });

  it('saves and loads player.json', () => {
    const save = createSave(storage);
    save.savePlayer({ ...DEFAULT_PLAYER, name: 'Mira', suit: 'blue' });
    expect(save.loadPlayer().name).toBe('Mira');
    expect(save.loadPlayer().suit).toBe('blue');
  });

  it('fills in missing fields from the default', () => {
    storage.setItem('olympus.player', JSON.stringify({ name: 'Leo' }));
    const p = createSave(storage).loadPlayer();
    expect(p.name).toBe('Leo');
    expect(p.stickers).toEqual([]);
  });

  it('survives a broken save instead of crashing', () => {
    storage.setItem('olympus.player', '{not json');
    expect(createSave(storage).loadPlayer()).toEqual(DEFAULT_PLAYER);
  });

  it('still works when storage itself throws (private window)', () => {
    const broken = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    const save = createSave(broken);
    expect(() => save.savePlayer(DEFAULT_PLAYER)).not.toThrow();
    expect(save.loadPlayer()).toEqual(DEFAULT_PLAYER);
  });

  it('records a finished stage and keeps the best stars', () => {
    const save = createSave(storage);
    save.recordStage('hermes', 2);
    save.recordStage('hermes', 1);
    expect(save.loadProgress()).toEqual({ completed: ['hermes'], stars: { hermes: 2 } });
  });

  it('keeps stickers when a sticker is earned twice', () => {
    const save = createSave(storage);
    save.addSticker('wrench');
    save.addSticker('wrench');
    expect(save.loadPlayer().stickers).toEqual(['wrench']);
  });
});

describe('cleanName', () => {
  it('trims and squashes spaces', () => {
    expect(cleanName('   Ana   Sofia ')).toBe('Ana Sofia');
  });

  it('caps names at 16 characters', () => {
    expect(cleanName('Supercalifragilistic')).toHaveLength(16);
  });

  it('drops characters that are not letters, numbers, spaces, - or \'', () => {
    expect(cleanName('<b>Zoe</b>!!')).toBe('bZoeb');
  });

  it('falls back to Cadet for an empty name', () => {
    expect(cleanName('  ')).toBe('Cadet');
  });
});
