// The power-line puzzle: a grid with pairs of coloured dots. Drag a line from each dot to its
// partner. Lines can't cross, and a perfect board fills every square.
//
// Every board is made from a real answer, so it can always be solved: one long snake visits
// every square, gets shuffled, then is cut into pieces. Each piece's two ends become a pair of dots.

// Cells are [row, col].
export const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const touching = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

function neighbours([r, c], size) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([y, x]) => y >= 0 && x >= 0 && y < size && x < size);
}

// One path through every square: start as a zig-zag, then "backbite" it many times to scramble it.
export function snake(size, random = Math.random) {
  let path = [];
  for (let r = 0; r < size; r++) for (let i = 0; i < size; i++) path.push([r, r % 2 ? size - 1 - i : i]);
  const moves = size * size * 30;
  for (let m = 0; m < moves; m++) {
    if (random() < 0.5) path.reverse();
    const end = path[path.length - 1];
    const options = neighbours(end, size).filter((n) => !same(n, path[path.length - 2]));
    const pick = options[Math.floor(random() * options.length)];
    const i = path.findIndex((p) => same(p, pick));
    path = path.slice(0, i + 1).concat(path.slice(i + 1).reverse());
  }
  return path;
}

// Split n squares into k pieces, each at least `min` long.
function lengths(n, k, min, random) {
  const out = Array(k).fill(min);
  for (let left = n - k * min; left > 0; left--) out[Math.floor(random() * k)]++;
  return out;
}

// A board: { size, pairs: [{ a, b }], answer: [[cells], ...] }
export function makeFlow(size, count, random = Math.random) {
  const k = Math.max(2, Math.min(count, Math.floor((size * size) / 3)));
  for (let tries = 0; tries < 400; tries++) {
    const path = snake(size, random);
    const parts = [];
    let at = 0;
    for (const len of lengths(path.length, k, 3, random)) {
      parts.push(path.slice(at, at + len));
      at += len;
    }
    // no pair of dots sitting right next to each other (too easy, and it leaves holes)
    if (parts.some((p) => touching(p[0], p[p.length - 1]))) continue;
    return { size, pairs: parts.map((p) => ({ a: p[0], b: p[p.length - 1] })), answer: parts };
  }
  throw new Error('Could not make a power-line board');
}

// One step from `from` toward `to` (along the longer direction first), or null if already there.
export function stepToward(from, to) {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (!dr && !dc) return null;
  if (Math.abs(dr) >= Math.abs(dc)) return [from[0] + Math.sign(dr), from[1]];
  return [from[0], from[1] + Math.sign(dc)];
}
