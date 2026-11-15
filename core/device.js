// Computer or touch screen (phone / iPad)? The game changes its buttons and words to match.
//   ?device=touch or ?device=desktop in the address forces one (handy for testing).
// A touch screen is: a finger is the main pointer, or there are touch points and no mouse.

export function detectDevice({ search = '', coarse = false, fine = false, touchPoints = 0, width = 1024 } = {}) {
  const forced = new URLSearchParams(search).get('device');
  if (forced === 'touch' || forced === 'desktop') return forced;
  if (coarse && !fine) return 'touch';
  if (touchPoints > 0 && !fine) return 'touch';
  if (touchPoints > 1 && width <= 1366 && coarse) return 'touch'; // an iPad with a pencil or trackpad still counts as touch
  return 'desktop';
}

let current = null;
export function device() {
  if (current) return current;
  if (typeof window === 'undefined') return 'desktop';
  const mq = (q) => window.matchMedia?.(q).matches ?? false;
  current = detectDevice({
    search: window.location?.search ?? '',
    coarse: mq('(pointer: coarse)'),
    fine: mq('(pointer: fine)'),
    touchPoints: navigator.maxTouchPoints ?? 0,
    width: window.innerWidth,
  });
  document.documentElement.dataset.device = current;
  return current;
}

export const isTouch = () => device() === 'touch';

// Keyboard words -> touch words, for everything the game says (Zeus Jr., prompts, cards, Help).
const SWAPS = [
  [/ ?\(or the arrow keys\)/g, ''],
  [/ ?\(or ↑ ↓\)/g, ''],
  [/ ?\(or ← →, or the mouse\)/g, ' (or drag the screen)'],
  [/ ?\(or the left and right arrows, or the mouse\)/g, ' (or drag the screen)'],
  [/ ?\(or the up and down arrows\)/g, ''],
  [/ ?\(or ← →\)/g, ''],
  [/\bW A S D\b/g, 'the stick'],
  [/\bW and S\b/g, 'the stick (up and down)'],
  [/\bA and D\b/g, 'the stick (left and right)'],
  [/\bMove the mouse\b/g, 'Drag the screen'],
  [/\bmove the mouse\b/g, 'drag the screen'],
  [/\bPress E \(or click\)/g, 'Tap USE'],
  [/\bE \(or click\)/g, 'USE'],
  [/\bpress \*?E\*?\b/g, 'tap USE'],
  [/\bPress \*?E\*?\b/g, 'Tap USE'],
  [/\[E\]/g, '[USE]'],
  [/\bpress \*?Q\*?\b/gi, 'tap GET UP'],
  [/\[Q\]/g, '[GET UP]'],
  [/\bhold \*?Space\*?\b/g, 'hold UP'],
  [/\bHold \*?Space\*?\b/g, 'Hold UP'],
  [/\[Space\]/g, '[UP]'],
  [/press \*Space\*/g, 'tap UP'],
  [/\bSpace(?= = up| up,|, Shift| and Shift| \/ Shift)/g, 'UP'], // only the key, never "Space junk" or "NASA Space"
  [/\bShift\b/g, 'DOWN'],
  [/\(press H for help\)/g, '(tap Help)'],
  [/\bpress H\b/gi, 'tap Help'],
];
export function touchWords(text) {
  if (typeof text !== 'string') return text;
  return SWAPS.reduce((t, [re, to]) => t.replace(re, to), text);
}
