// Saves player.json (and which stages are done) in the browser. No account needed.
// Storage is passed in so tests can use a fake, and every call is wrapped so a
// private window or blocked storage never crashes the game.

export const DEFAULT_PLAYER = Object.freeze({
  name: 'Cadet',
  suit: 'orange',
  visor: 'gold',
  stickers: [],
  backpack: 'classic',
  badges: [],
});

const PLAYER_KEY = 'olympus.player';
const PROGRESS_KEY = 'olympus.progress';

export function createSave(storage = safeLocalStorage()) {
  function read(key) {
    try {
      const raw = storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked: the game still works, it just won't remember.
    }
  }

  function loadPlayer() {
    const saved = read(PLAYER_KEY);
    return { ...structuredClone(DEFAULT_PLAYER), ...(isObject(saved) ? saved : {}) };
  }

  function savePlayer(player) {
    write(PLAYER_KEY, { ...player, name: cleanName(player.name) });
  }

  function loadProgress() {
    const saved = read(PROGRESS_KEY);
    return {
      completed: Array.isArray(saved?.completed) ? saved.completed : [],
      stars: isObject(saved?.stars) ? saved.stars : {},
    };
  }

  function recordStage(stageId, stars) {
    const progress = loadProgress();
    if (!progress.completed.includes(stageId)) progress.completed.push(stageId);
    progress.stars[stageId] = Math.max(progress.stars[stageId] ?? 0, stars);
    write(PROGRESS_KEY, progress);
    return progress;
  }

  function addSticker(id) {
    const player = loadPlayer();
    if (!player.stickers.includes(id)) player.stickers.push(id);
    savePlayer(player);
    return player;
  }

  return { loadPlayer, savePlayer, loadProgress, recordStage, addSticker };
}

export function cleanName(name) {
  const cleaned = String(name ?? '')
    .replace(/[^\p{L}\p{N} '-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
    .trim();
  return cleaned || 'Cadet';
}

// "Filtered for bad words": returns false for a name a 7-year-old shouldn't see on a name tag.
// Long words are caught inside other words (and with 1337 spelling); short ones only on their own,
// so names like Cassie, Dickens or Scunthorpe still work.
const BLOCK_INSIDE = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'whore', 'slut', 'penis', 'vagina', 'porn', 'nazi', 'hitler', 'pussy', 'boob'];
const BLOCK_WORD = ['cunt', 'ass', 'dick', 'cock', 'damn', 'crap', 'piss', 'sex', 'fag', 'tit', 'tits', 'kill', 'poop', 'butt'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };

export function isKidSafeName(name) {
  const lower = String(name ?? '').toLowerCase();
  const plain = [...lower].map((c) => LEET[c] ?? c).join('');
  const squashed = plain.replace(/[^a-z]/g, '');
  if (BLOCK_INSIDE.some((w) => squashed.includes(w))) return false;
  const words = plain.split(/[^a-z]+/).filter(Boolean);
  return !words.some((w) => BLOCK_WORD.includes(w));
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
