// The pipe puzzle: a grid of pipe pieces. Click a piece to turn it. Make one path from the
// power on the left to the light bulb on the right.
//
// A piece is a 4-bit mask of which sides it opens to: N = 1, E = 2, S = 4, W = 8.
// Every board is made from a real path first, so it can always be solved.

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const STEPS = [
  [N, -1, 0, S],
  [E, 0, 1, W],
  [S, 1, 0, N],
  [W, 0, -1, E],
]; // [side, row step, col step, the side it enters on the neighbour]

// Turn a piece a quarter turn clockwise (N -> E -> S -> W -> N).
export function rotate(mask, times = 1) {
  let m = mask;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

// Which pieces the power reaches, starting from the left side of `start` row.
// Returns { lit: Set of "r,c", solved: true when it flows out of the right side of the `end` row }.
export function flowFrom(grid, start, end) {
  const n = grid.length;
  const lit = new Set();
  if (!(grid[start][0] & W)) return { lit, solved: false };
  const queue = [[start, 0]];
  lit.add(`${start},0`);
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [side, dr, dc, back] of STEPS) {
      if (!(grid[r][c] & side)) continue;
      const y = r + dr;
      const x = c + dc;
      if (y < 0 || x < 0 || y >= n || x >= n) continue;
      if (!(grid[y][x] & back) || lit.has(`${y},${x}`)) continue;
      lit.add(`${y},${x}`);
      queue.push([y, x]);
    }
  }
  return { lit, solved: lit.has(`${end},${n - 1}`) && Boolean(grid[end][n - 1] & E) };
}

// A board: { grid (scrambled), answer (solved masks), start row, end row }.
export function makePipes(size, random = Math.random) {
  const n = Math.max(3, Math.min(6, size));
  for (let tries = 0; tries < 200; tries++) {
    const start = Math.floor(random() * n);
    const path = walk(n, start, random);
    if (!path || path.length < n + 1) continue; // too straight: no fun
    const answer = Array.from({ length: n }, () => Array(n).fill(0));
    path.forEach(([r, c], i) => {
      const prev = i === 0 ? [r, c - 1] : path[i - 1];
      const next = i === path.length - 1 ? [r, c + 1] : path[i + 1];
      answer[r][c] = sideTo([r, c], prev) | sideTo([r, c], next);
    });
    // the other squares get random straight or corner pieces
    const shapes = [N | S, E | W, N | E, E | S, S | W, W | N];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!answer[r][c]) answer[r][c] = shapes[Math.floor(random() * shapes.length)];
    const grid = answer.map((row) => row.map((m) => rotate(m, Math.floor(random() * 4))));
    const end = path[path.length - 1][0];
    if (flowFrom(grid, start, end).solved) grid[start][0] = rotate(grid[start][0], 1); // never start solved
    if (flowFrom(grid, start, end).solved) continue;
    return { grid, answer, start, end, size: n };
  }
  throw new Error('Could not make a pipe board');
}

function sideTo([r, c], [y, x]) {
  if (y < r) return N;
  if (y > r) return S;
  if (x > c) return E;
  return W;
}

// A random path from the left edge (row `start`) to any square on the right edge, never crossing itself.
function walk(n, start, random) {
  const seen = new Set([`${start},0`]);
  const path = [[start, 0]];
  const go = () => {
    const [r, c] = path[path.length - 1];
    if (c === n - 1 && path.length >= n + 1) return true;
    const options = [
      [r - 1, c],
      [r + 1, c],
      [r, c + 1],
      [r, c - 1],
    ].filter(([y, x]) => y >= 0 && x >= 0 && y < n && x < n && !seen.has(`${y},${x}`));
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    for (const [y, x] of options) {
      seen.add(`${y},${x}`);
      path.push([y, x]);
      if (go()) return true;
      path.pop();
      seen.delete(`${y},${x}`);
    }
    return false;
  };
  return go() ? path : null;
}
