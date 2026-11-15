// Quick repair puzzles with a timer, so fixing things is a little bit stressful.
// The stage keeps running underneath (your oxygen keeps going down!).
//
//   ui.puzzle({ kind, title, text, seconds, size }) -> Promise<boolean>  (true = solved in time)
//
// kinds:
//   'wires'    match each coloured wire to the plug with the same colour and shape
//   'sequence' watch the lights flash, then press them in the same order
//   'timing'   stop the moving needle inside the green zone, a few times in a row
//   'flow'     drag a power line between each pair of same-coloured dots; lines can't cross
//              (size = grid width, 4-7). A perfect board fills every square.
//   'memory'   flip cards two at a time and find the matching pairs (size = pairs, 3-5)
//   'pipes'    click pipe pieces to turn them until power flows to the bulb (size = grid, 3-5)
//   'balance'  hold Space to keep a needle inside a drifting green zone until the bar fills
//              (size = seconds in the green, 3-6)
//
// Every puzzle shows a short "How to play" box. Works with the mouse, and with keys:
// 1-4 pick, Space / E for the timing needle and the balance.

import { makeFlow, same, touching, stepToward } from './flow.js';
import { isTouch } from '../core/device.js';
import { makePipes, rotate, flowFrom, N as PN, E as PE, S as PS, W as PW } from './pipes.js';

// "How to play" for each kind: short steps a 7-year-old can follow.
export const HOW_TO = {
  wires: ['Click a wire on the left (or press its number).', 'Click the plug with the same colour and shape.', 'Connect them all before the timer runs out.'],
  sequence: ['Watch the coloured lights flash.', 'Press them in the same order (click them, or keys 1-4).', 'Got one wrong? They flash again. Watch closely!'],
  timing: ['A needle slides back and forth.', 'Press Space (or the Stop button) when it is in the green.', 'Hit the green enough times. A miss takes one away!'],
  flow: ['Press on a dot and drag.', 'Draw a line to the dot with the same colour and shape.', "Lines can't cross. Connect every pair!"],
  memory: ['Click a card to flip it over.', 'Flip a second card. Same colour and shape? It stays!', 'Not a match? They flip back. Find every pair.'],
  pipes: ['Click a pipe piece to turn it.', 'Make one path from the power ⚡ on the left to the bulb 💡 on the right.', 'Pieces light up gold when the power reaches them.'],
  balance: ['Hold Space (or press and hold the button) to push the needle up.', 'Let go and it falls back down.', 'Keep it inside the green zone until the bar is full.'],
};

const COLOURS = [
  { id: 'red', hex: '#ff4d5e', shape: '●', name: 'red circle' },
  { id: 'blue', hex: '#46b4ff', shape: '■', name: 'blue square' },
  { id: 'gold', hex: '#ffc145', shape: '▲', name: 'gold triangle' },
  { id: 'green', hex: '#5bd98a', shape: '★', name: 'green star' },
  { id: 'purple', hex: '#a98bff', shape: '◆', name: 'purple diamond' },
];

export function createPuzzle(layer, sound) {
  let open = false;
  let finish = null;

  function close(result) {
    if (!open) return;
    open = false;
    layer.hidden = true;
    layer.replaceChildren();
    window.removeEventListener('keydown', onKey, true);
    onClose?.();
    onClose = null;
    cancelAnimationFrame(raf);
    sound?.play(result ? 'success' : 'fail');
    const f = finish;
    finish = null;
    f?.(result);
  }

  let raf = 0;
  let onKey = () => {};
  let onClose = null; // extra clean-up for a puzzle (like a keyup listener)

  function frame({ title, text, seconds, body, how }) {
    layer.innerHTML = `
      <div class="puzzle" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="puzzle-timer" aria-hidden="true"><div class="puzzle-timer-fill"></div></div>
        <p class="puzzle-eyebrow">Quick! <span class="puzzle-secs">${Math.ceil(seconds)}</span> s</p>
        <h2 class="puzzle-title">${escapeHtml(title)}</h2>
        ${text ? `<p class="puzzle-text">${rich(text)}</p>` : ''}
        ${how ? `<div class="puzzle-how"><p class="puzzle-how-title">How to play</p><ol>${how.map((h) => `<li>${rich(h)}</li>`).join('')}</ol></div>` : ''}
        <div class="puzzle-body">${body}</div>
        <p class="puzzle-status" aria-live="polite"></p>
      </div>`;
    layer.hidden = false;
    const fill = layer.querySelector('.puzzle-timer-fill');
    const secs = layer.querySelector('.puzzle-secs');
    const started = performance.now();
    let lastBeep = Math.ceil(seconds);
    const tick = (now) => {
      if (!open) return;
      const left = seconds - (now - started) / 1000;
      fill.style.width = `${Math.max(0, left / seconds) * 100}%`;
      fill.classList.toggle('is-low', left < Math.min(4, seconds * 0.3));
      const whole = Math.max(0, Math.ceil(left));
      if (whole !== lastBeep) {
        lastBeep = whole;
        secs.textContent = String(whole);
        if (whole <= 3 && whole > 0) sound?.play('beep');
      }
      if (left <= 0) {
        status('Out of time!');
        close(false);
        return;
      }
      onTick?.(now);
      raf = requestAnimationFrame(tick);
    };
    let onTick = null;
    raf = requestAnimationFrame(tick);
    const status = (msg, good = false) => {
      const el = layer.querySelector('.puzzle-status');
      if (!el) return;
      el.textContent = msg;
      el.classList.toggle('is-good', good);
    };
    return { status, setTick: (fn) => (onTick = fn), root: layer.querySelector('.puzzle-body') };
  }

  // ---------- wires ----------
  function wires({ title, text, seconds, size }) {
    const n = Math.min(COLOURS.length, Math.max(3, size ?? 3));
    const left = shuffle(COLOURS.slice(0, n));
    const right = shuffle(left.slice());
    const body = `
      <div class="wires">
        <div class="wires-col">${left.map((c, i) => `<button type="button" class="wire-end" data-side="l" data-id="${c.id}" style="--c:${c.hex}" aria-label="${c.name} wire"><kbd>${i + 1}</kbd><span>${c.shape}</span></button>`).join('')}</div>
        <svg class="wires-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="wires-col">${right.map((c) => `<button type="button" class="wire-end is-plug" data-side="r" data-id="${c.id}" style="--c:${c.hex}" aria-label="${c.name} plug"><span>${c.shape}</span></button>`).join('')}</div>
      </div>`;
    const ui = frame({ title, text: text ?? 'Click a wire, then the plug with the same colour and shape.', seconds, body, how: HOW_TO.wires });
    const svg = layer.querySelector('.wires-lines');
    const done = new Set();
    let picked = null;
    const pick = (btn) => {
      if (!btn || btn.disabled) return;
      if (btn.dataset.side === 'l') {
        layer.querySelectorAll('.wire-end.is-picked').forEach((b) => b.classList.remove('is-picked'));
        picked = btn;
        btn.classList.add('is-picked');
        sound?.play('tap');
        return;
      }
      if (!picked) {
        ui.status('Pick a wire on the left first.');
        return;
      }
      if (btn.dataset.id === picked.dataset.id) {
        const a = picked.getBoundingClientRect();
        const b = btn.getBoundingClientRect();
        const box = svg.getBoundingClientRect();
        const y1 = ((a.top + a.height / 2 - box.top) / box.height) * 100;
        const y2 = ((b.top + b.height / 2 - box.top) / box.height) * 100;
        const colour = COLOURS.find((c) => c.id === btn.dataset.id).hex;
        svg.insertAdjacentHTML('beforeend', `<path d="M0 ${y1} C 50 ${y1}, 50 ${y2}, 100 ${y2}" stroke="${colour}" stroke-width="3" fill="none" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`);
        picked.disabled = true;
        btn.disabled = true;
        picked.classList.remove('is-picked');
        done.add(btn.dataset.id);
        picked = null;
        sound?.play('clunk');
        ui.status(`${done.size} of ${n} connected`, true);
        if (done.size === n) setTimeout(() => close(true), 250);
      } else {
        btn.classList.remove('is-wrong');
        void btn.offsetWidth;
        btn.classList.add('is-wrong');
        sound?.play('warn');
        ui.status("Sparks! That's not the matching plug.");
      }
    };
    layer.querySelector('.wires').addEventListener('click', (e) => pick(e.target.closest('.wire-end')));
    onKey = (e) => {
      const k = Number(e.key);
      if (k >= 1 && k <= n) {
        e.preventDefault();
        const lefts = layer.querySelectorAll('.wire-end[data-side="l"]');
        pick(lefts[k - 1]);
      }
    };
  }

  // ---------- sequence ----------
  function sequence({ title, text, seconds, size }) {
    const n = Math.max(3, size ?? 4);
    const pads = COLOURS.slice(0, 4);
    const order = Array.from({ length: n }, () => pads[Math.floor(Math.random() * pads.length)].id);
    const body = `<div class="pads">${pads.map((c, i) => `<button type="button" class="pad" data-id="${c.id}" style="--c:${c.hex}" aria-label="${c.name}"><span>${c.shape}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>`;
    const ui = frame({ title, text: text ?? 'Watch the lights, then press them in the same order.', seconds, body, how: HOW_TO.sequence });
    const padEls = [...layer.querySelectorAll('.pad')];
    let input = 0;
    let showingOrder = true;
    const flash = (id, ms = 380) => {
      const el = padEls.find((p) => p.dataset.id === id);
      el.classList.add('is-lit');
      setTimeout(() => el.classList.remove('is-lit'), ms);
    };
    const play = () => {
      showingOrder = true;
      ui.status('Watch…');
      order.forEach((id, i) => setTimeout(() => open && (flash(id), sound?.play('beep')), 500 + i * 620));
      setTimeout(() => {
        if (!open) return;
        showingOrder = false;
        input = 0;
        ui.status('Your turn!', true);
      }, 500 + order.length * 620);
    };
    const press = (btn) => {
      if (!btn || showingOrder) return;
      flash(btn.dataset.id, 200);
      if (btn.dataset.id === order[input]) {
        input++;
        sound?.play('tap');
        ui.status(`${input} of ${order.length}`, true);
        if (input === order.length) setTimeout(() => close(true), 250);
      } else {
        sound?.play('warn');
        ui.status('Oops, wrong one. Watch again!');
        play();
      }
    };
    layer.querySelector('.pads').addEventListener('click', (e) => press(e.target.closest('.pad')));
    onKey = (e) => {
      const k = Number(e.key);
      if (k >= 1 && k <= 4) {
        e.preventDefault();
        press(padEls[k - 1]);
      }
    };
    play();
  }

  // ---------- flow (power lines) ----------
  function flow({ title, text, seconds, size }) {
    const n = Math.max(4, Math.min(7, size ?? 5));
    const board = makeFlow(n, Math.min(COLOURS.length, n - 1));
    const k = board.pairs.length;
    const dotAt = Array.from({ length: n }, () => Array(n).fill(-1));
    board.pairs.forEach(({ a, b }, i) => {
      dotAt[a[0]][a[1]] = i;
      dotAt[b[0]][b[1]] = i;
    });
    const cellsHtml = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const d = dotAt[r][c];
        const dot = d >= 0 ? `<span class="flow-dot" data-i="${d}" style="--c:${COLOURS[d].hex}" aria-label="${COLOURS[d].name}">${COLOURS[d].shape}</span>` : '';
        cellsHtml.push(`<div class="flow-cell" data-r="${r}" data-c="${c}">${dot}</div>`);
      }
    }
    const body = `
      <div class="flow" style="--n:${n}">
        ${cellsHtml.join('')}
        <svg class="flow-lines" viewBox="0 0 ${n} ${n}" aria-hidden="true"></svg>
      </div>`;
    const ui = frame({ title, text: text ?? "Drag from each dot to the dot with the *same colour and shape*. Lines can't cross!", seconds, body, how: HOW_TO.flow });
    const grid = layer.querySelector('.flow');
    const svg = layer.querySelector('.flow-lines');
    const cellEls = [...layer.querySelectorAll('.flow-cell')];
    const paths = Array.from({ length: k }, () => []);
    let active = -1;
    let won = false;

    const otherEnd = (i, cell) => (same(board.pairs[i].a, cell) ? board.pairs[i].b : board.pairs[i].a);
    const connected = (i) => {
      const p = paths[i];
      return p.length > 1 && dotAt[p[0][0]][p[0][1]] === i && same(p[p.length - 1], otherEnd(i, p[0]));
    };
    const ownerOf = (cell) => paths.findIndex((p) => p.some((q) => same(q, cell)));
    const cellFrom = (e) => {
      const box = grid.getBoundingClientRect();
      const c = Math.floor(((e.clientX - box.left) / box.width) * n);
      const r = Math.floor(((e.clientY - box.top) / box.height) * n);
      return r >= 0 && c >= 0 && r < n && c < n ? [r, c] : null;
    };

    function draw() {
      svg.innerHTML = paths
        .map((p, i) =>
          p.length > 1
            ? `<polyline points="${p.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ')}" stroke="${COLOURS[i].hex}" stroke-width="0.34" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
            : '',
        )
        .join('');
      const filled = new Set();
      paths.forEach((p, i) =>
        p.forEach(([r, c]) => {
          filled.add(r * n + c);
          cellEls[r * n + c].style.setProperty('--c', COLOURS[i].hex);
        }),
      );
      cellEls.forEach((el, j) => el.classList.toggle('is-filled', filled.has(j)));
      grid.querySelectorAll('.flow-dot').forEach((dot) => dot.classList.toggle('is-done', connected(Number(dot.dataset.i))));
      const joined = paths.filter((_, i) => connected(i)).length;
      if (joined === k && !won) {
        won = true;
        const perfect = filled.size === n * n;
        ui.status(perfect ? 'Perfect! Every square is filled!' : 'All lines connected!', true);
        sound?.play('success');
        setTimeout(() => close(true), perfect ? 700 : 450);
      } else if (!won) ui.status(`${joined} of ${k} lines connected`, joined > 0);
    }

    function begin(cell) {
      if (!cell || won) return;
      const d = dotAt[cell[0]][cell[1]];
      if (d >= 0) {
        active = d;
        paths[d] = [cell]; // starting on a dot always starts that colour fresh
      } else {
        const o = ownerOf(cell);
        if (o < 0) return;
        active = o;
        paths[o] = paths[o].slice(0, paths[o].findIndex((q) => same(q, cell)) + 1); // carry on from here
      }
      sound?.play('tap');
      draw();
    }

    function extend(cell) {
      const p = paths[active];
      const last = p[p.length - 1];
      if (!touching(last, cell)) return false;
      const back = p.findIndex((q) => same(q, cell));
      if (back >= 0) {
        paths[active] = p.slice(0, back + 1); // dragging back undoes the line
        return true;
      }
      if (connected(active)) return false; // reached the partner dot: the line is finished
      const d = dotAt[cell[0]][cell[1]];
      if (d >= 0 && d !== active) return false; // another colour's dot blocks the way
      const o = ownerOf(cell);
      if (o >= 0 && o !== active) paths[o] = paths[o].slice(0, paths[o].findIndex((q) => same(q, cell))); // cut through the other line
      p.push(cell);
      if (d === active) sound?.play('clunk');
      return true;
    }

    function dragTo(cell) {
      if (active < 0 || !cell || won) return;
      let guard = 0;
      while (guard++ < 20) {
        const p = paths[active];
        const step = stepToward(p[p.length - 1], cell);
        if (!step || !extend(step)) break;
      }
      draw();
    }

    grid.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grid.setPointerCapture?.(e.pointerId);
      begin(cellFrom(e));
    });
    grid.addEventListener('pointermove', (e) => active >= 0 && dragTo(cellFrom(e)));
    const end = () => {
      if (active >= 0 && !won && paths[active].length === 1) paths[active] = [];
      active = -1;
      if (!won) draw();
    };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);
    onKey = () => {};
    draw();
  }

  // ---------- timing ----------
  function timing({ title, text, seconds, size }) {
    const hitsNeeded = Math.max(2, size ?? 3);
    const body = `
      <div class="gauge">
        <div class="gauge-zone"></div>
        <div class="gauge-needle"></div>
      </div>
      <div class="gauge-hits">${Array.from({ length: hitsNeeded }, () => '<span></span>').join('')}</div>
      <button type="button" class="btn gauge-btn">Stop! <kbd>Space</kbd></button>`;
    const ui = frame({ title, text: text ?? 'Stop the needle inside the green zone.', seconds, body, how: HOW_TO.timing });
    const zone = layer.querySelector('.gauge-zone');
    const needle = layer.querySelector('.gauge-needle');
    const dots = [...layer.querySelectorAll('.gauge-hits span')];
    let hits = 0;
    let width = 26; // % of the gauge
    let centre = 30 + Math.random() * 40;
    let pos = 0;
    let speed = 55; // % per second
    let dir = 1;
    let last = performance.now();
    let cooldown = 0;
    const place = () => {
      zone.style.left = `${centre - width / 2}%`;
      zone.style.width = `${width}%`;
    };
    place();
    ui.setTick((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos += dir * speed * dt;
      if (pos > 100) (pos = 100), (dir = -1);
      if (pos < 0) (pos = 0), (dir = 1);
      needle.style.left = `${pos}%`;
      cooldown -= dt;
    });
    const stop = () => {
      if (cooldown > 0) return;
      cooldown = 0.25;
      if (Math.abs(pos - centre) <= width / 2) {
        dots[hits]?.classList.add('is-on');
        hits++;
        sound?.play('clunk');
        ui.status(`${hits} of ${hitsNeeded}!`, true);
        if (hits >= hitsNeeded) {
          setTimeout(() => close(true), 250);
          return;
        }
        width = Math.max(10, width - 6);
        speed += 18;
        centre = 15 + Math.random() * 70;
        place();
      } else {
        sound?.play('warn');
        ui.status('Missed! Try again.');
        if (hits > 0) {
          hits--;
          dots[hits]?.classList.remove('is-on');
        }
      }
    };
    layer.querySelector('.gauge-btn').addEventListener('click', stop);
    onKey = (e) => {
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) stop();
      }
    };
  }

  // ---------- memory (match the pairs) ----------
  function memory({ title, text, seconds, size }) {
    const pairs = Math.max(3, Math.min(COLOURS.length, size ?? 4));
    const deck = shuffle([...COLOURS.slice(0, pairs), ...COLOURS.slice(0, pairs)]);
    const body = `<div class="memory" style="--cols:${pairs <= 3 ? 3 : 4}">${deck
      .map((c, i) => `<button type="button" class="mem-card" data-i="${i}" style="--c:${c.hex}" aria-label="Card ${i + 1}"><span class="mem-back">?</span><span class="mem-face">${c.shape}</span></button>`)
      .join('')}</div>`;
    const ui = frame({ title, text: text ?? 'Find the matching pairs!', seconds, body, how: HOW_TO.memory });
    let up = [];
    let found = 0;
    let busy = false;
    const flip = (btn) => {
      if (!btn || busy || btn.classList.contains('is-up')) return;
      btn.classList.add('is-up');
      sound?.play('tap');
      up.push(btn);
      if (up.length < 2) return;
      const [a, b] = up;
      up = [];
      if (deck[a.dataset.i].id === deck[b.dataset.i].id) {
        a.classList.add('is-matched');
        b.classList.add('is-matched');
        a.disabled = b.disabled = true;
        found++;
        sound?.play('clunk');
        ui.status(`${found} of ${pairs} pairs found`, true);
        if (found === pairs) setTimeout(() => close(true), 350);
      } else {
        busy = true;
        sound?.play('warn');
        ui.status('Not a match. Remember where they were!');
        setTimeout(() => {
          a.classList.remove('is-up');
          b.classList.remove('is-up');
          busy = false;
        }, 750);
      }
    };
    layer.querySelector('.memory').addEventListener('click', (e) => flip(e.target.closest('.mem-card')));
    onKey = () => {};
  }

  // ---------- pipes (turn the pieces) ----------
  function pipes({ title, text, seconds, size }) {
    const board = makePipes(size ?? 4);
    const n = board.size;
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push(`<button type="button" class="pipe-cell" data-r="${r}" data-c="${c}" aria-label="Pipe piece"></button>`);
    const body = `
      <div class="pipes-wrap" style="--n:${n}">
        <span class="pipes-end is-power" style="--row:${board.start}" aria-label="Power">⚡</span>
        <div class="pipes">${cells.join('')}</div>
        <span class="pipes-end is-bulb" style="--row:${board.end}" aria-label="Light bulb">💡</span>
      </div>`;
    const ui = frame({ title, text: text ?? 'Turn the pipes so the power reaches the bulb!', seconds, body, how: HOW_TO.pipes });
    const els = [...layer.querySelectorAll('.pipe-cell')];
    const bulb = layer.querySelector('.is-bulb');
    let won = false;
    const arm = (side) => ({ [PN]: 'M50 50 L50 0', [PE]: 'M50 50 L100 50', [PS]: 'M50 50 L50 100', [PW]: 'M50 50 L0 50' })[side];
    function draw() {
      const { lit, solved } = flowFrom(board.grid, board.start, board.end);
      els.forEach((el) => {
        const r = Number(el.dataset.r);
        const c = Number(el.dataset.c);
        const m = board.grid[r][c];
        const on = lit.has(`${r},${c}`);
        const d = [PN, PE, PS, PW].filter((side) => m & side).map(arm).join(' ');
        el.classList.toggle('is-lit', on);
        el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${d}" stroke-width="22" stroke-linecap="round" fill="none"/><circle cx="50" cy="50" r="13"/></svg>`;
      });
      bulb.classList.toggle('is-on', solved);
      const count = lit.size;
      if (solved && !won) {
        won = true;
        ui.status('Power is flowing! The bulb is on!', true);
        setTimeout(() => close(true), 600);
      } else if (!won) ui.status(count ? `Power reaches ${count} piece${count === 1 ? '' : 's'}` : 'Turn the first piece so it touches the power ⚡', count > 0);
    }
    layer.querySelector('.pipes').addEventListener('click', (e) => {
      const el = e.target.closest('.pipe-cell');
      if (!el || won) return;
      const r = Number(el.dataset.r);
      const c = Number(el.dataset.c);
      board.grid[r][c] = rotate(board.grid[r][c], 1);
      sound?.play('tap');
      draw();
    });
    onKey = () => {};
    draw();
  }

  // ---------- balance (hold it steady) ----------
  function balance({ title, text, seconds, size }) {
    const needSecs = Math.max(3, Math.min(6, size ?? 4));
    const body = `
      <div class="balance">
        <div class="balance-meter">
          <div class="balance-zone"></div>
          <div class="balance-needle"></div>
        </div>
        <div class="balance-fill"><span></span></div>
      </div>
      <button type="button" class="btn gauge-btn balance-btn">Hold me! <kbd>Space</kbd></button>`;
    const ui = frame({ title, text: text ?? 'Keep the needle in the green!', seconds, body, how: HOW_TO.balance });
    const zoneEl = layer.querySelector('.balance-zone');
    const needleEl = layer.querySelector('.balance-needle');
    const fillEl = layer.querySelector('.balance-fill span');
    const btn = layer.querySelector('.balance-btn');
    let holding = false;
    let pos = 20; // % from the bottom
    let vel = 0;
    let fill = 0;
    let t = 0;
    let last = performance.now();
    let won = false;
    const zoneSize = 26;
    ui.setTick((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      vel += (holding ? 140 : -110) * dt; // push up while you hold, fall when you let go
      vel *= Math.exp(-2.2 * dt);
      pos += vel * dt;
      if (pos < 0) (pos = 0), (vel = 0);
      if (pos > 100) (pos = 100), (vel = 0);
      // the green zone drifts slowly up and down
      const centre = 50 + Math.sin(t * 0.9) * 22 + Math.sin(t * 2.1) * 6;
      zoneEl.style.bottom = `${centre - zoneSize / 2}%`;
      zoneEl.style.height = `${zoneSize}%`;
      needleEl.style.bottom = `${pos}%`;
      const inside = Math.abs(pos - centre) <= zoneSize / 2;
      fill = Math.max(0, Math.min(1, fill + (inside ? dt / needSecs : -dt / (needSecs * 3))));
      fillEl.style.width = `${fill * 100}%`;
      zoneEl.classList.toggle('is-in', inside);
      if (!won) ui.status(inside ? 'In the green! Keep it there…' : pos > centre ? 'Too high! Let go a little.' : (isTouch() ? 'Too low! Hold the button.' : 'Too low! Hold Space.'), inside);
      if (fill >= 1 && !won) {
        won = true;
        ui.status('Steady! You did it!', true);
        setTimeout(() => close(true), 300);
      }
    });
    const down = (e) => {
      e?.preventDefault?.();
      holding = true;
    };
    const up = () => (holding = false);
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    onKey = (e) => {
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        holding = true;
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') holding = false;
    };
    window.addEventListener('keyup', onKeyUp, true);
    onClose = () => window.removeEventListener('keyup', onKeyUp, true);
  }

  return {
    get isOpen() {
      return open;
    },
    open({ kind = 'wires', title = 'Quick repair!', text, seconds = 15, size } = {}) {
      if (open) return Promise.resolve(false);
      open = true;
      if (document.pointerLockElement) document.exitPointerLock();
      return new Promise((resolve) => {
        finish = resolve;
        if (kind === 'sequence') sequence({ title, text, seconds, size });
        else if (kind === 'timing') timing({ title, text, seconds, size });
        else if (kind === 'flow') flow({ title, text, seconds, size });
        else if (kind === 'memory') memory({ title, text, seconds, size });
        else if (kind === 'pipes') pipes({ title, text, seconds, size });
        else if (kind === 'balance') balance({ title, text, seconds, size });
        else wires({ title, text, seconds, size });
        window.addEventListener('keydown', onKey, true);
        sound?.play('alarm');
      });
    },
    close: () => close(false),
  };
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
// On a touch screen the puzzle's own buttons are right there, so the words say "tap", not keys.
const TOUCH_PUZZLE = [
  [/Press Space \(or the Stop button\)/g, 'Tap the Stop button'],
  [/Hold Space \(or press and hold the button\)/g, 'Press and hold the button'],
  [/ \(click them, or keys 1-4\)/g, ' (tap them)'],
  [/ \(or press its number\)/g, ''],
  [/\bClick\b/g, 'Tap'],
  [/\bclick\b/g, 'tap'],
  [/\bHold Space\b/g, 'Hold the button'],
];
function rich(t) {
  if (isTouch()) t = TOUCH_PUZZLE.reduce((s, [re, to]) => s.replace(re, to), String(t));
  return escapeHtml(t).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
