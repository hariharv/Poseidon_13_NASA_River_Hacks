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

// The browser said no to locking the mouse. Should the game give up on mouse-look and switch to
// click-and-drag? On a touch screen, yes. On a computer, a lock can be refused for ordinary reasons
// (asked for after the 3-2-1 countdown, the window wasn't focused, just after Esc), so the game
// pauses and the next click asks again. Only a browser that refuses twice in a row and has never
// given a lock (it blocks pointer lock, like an embedded preview) gets click-and-drag.
export function dragLookAfterRefusal({ touch, everLocked, refusals }) {
  return touch || (!everLocked && refusals >= 2);
}
export function dragLookNow(everLocked, refusals) {
  return dragLookAfterRefusal({ touch: isTouch(), everLocked, refusals });
}

// Keyboard words -> touch words, for everything the game says (Zeus Jr., prompts, cards, Help).
// `names` = what the on-screen buttons say in this stage (Stage 1's E button says FIX, Stage 5's
// jump button says HOP...), so the words always match the button you can see.
export const BUTTON_NAMES = Object.freeze({ use: 'USE', up: 'UP', down: 'DOWN', leave: 'GET UP' });
const swapsFor = ({ use, up, down, leave }) => [
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
  [/\*press E\*/g, `*tap ${use}*`], // a bold "*press E*" stays bold
  [/\*Press E\*/g, `*Tap ${use}*`],
  [/\*press Q\*/g, `*tap ${leave}*`],
  [/\*Press Q\*/g, `*Tap ${leave}*`],
  [/\bPress E \(or click\)/g, `Tap ${use}`],
  [/\bE \(or click\)/g, use],
  [/\bpress \*?E\b\*?/g, `tap ${use}`], // (also eats the closing * of a bold key)
  [/\bPress \*?E\b\*?/g, `Tap ${use}`],
  [/\[E\]/g, `[${use}]`],
  [/ \[[WASD]\]/g, ''], // steering hints: the direction word is enough when you use the stick
  [/\bpress \*?Q\b\*?/g, `tap ${leave}`],
  [/\bPress \*?Q\b\*?/g, `Tap ${leave}`],
  [/\[Q\] get up/g, `[${leave}]`], // not "[GET UP] get up"
  [/\[Q\] get out of the chair/g, `[${leave}] out of the chair`],
  [/\bQ gets you out of the chair\b/g, `${leave} gets you out of the chair`],
  [/\[Q\]/g, `[${leave}]`],
  [/\bQ gets up\b/g, `${leave} to stand up`],
  [/\bhold \*?Space\*?\b/g, `hold ${up}`],
  [/\bHold \*?Space\*?\b/g, `Hold ${up}`],
  [/\[Space\]/g, `[${up}]`],
  [/press \*Space\*/g, `tap ${up}`],
  [/\bSpace(?= = up| up,|, Shift| and Shift| \/ Shift)/g, up], // only the key, never "Space junk" or "NASA Space"
  [/\bShift\b/g, down],
  [/\(press H for help\)/g, '(tap Help)'],
  [/\bpress H\b/gi, 'tap Help'],
];
const DEFAULT_SWAPS = swapsFor(BUTTON_NAMES);
export function touchWords(text, names = null) {
  if (typeof text !== 'string') return text;
  const swaps = names ? swapsFor({ ...BUTTON_NAMES, ...names }) : DEFAULT_SWAPS;
  return swaps.reduce((t, [re, to]) => t.replace(re, to), text);
}
