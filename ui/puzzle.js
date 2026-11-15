// Quick repair puzzles with a timer, so fixing things is a little bit stressful.
// The stage keeps running underneath (your oxygen keeps going down!).
//
//   ui.puzzle({ kind, title, text, seconds, size }) -> Promise<boolean>  (true = solved in time)
//
// kinds:
//   'wires'    match each coloured wire to the plug with the same colour and shape
//   'sequence' watch the lights flash, then press them in the same order
//   'timing'   stop the moving needle inside the green zone, a few times in a row
//
// Works with the mouse, and with keys: 1-4 pick, Space / E for the timing needle.

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
    cancelAnimationFrame(raf);
    sound?.play(result ? 'success' : 'fail');
    const f = finish;
    finish = null;
    f?.(result);
  }

  let raf = 0;
  let onKey = () => {};

  function frame({ title, text, seconds, body }) {
    layer.innerHTML = `
      <div class="puzzle" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="puzzle-timer" aria-hidden="true"><div class="puzzle-timer-fill"></div></div>
        <p class="puzzle-eyebrow">Quick! <span class="puzzle-secs">${Math.ceil(seconds)}</span> s</p>
        <h2 class="puzzle-title">${escapeHtml(title)}</h2>
        ${text ? `<p class="puzzle-text">${rich(text)}</p>` : ''}
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
    const ui = frame({ title, text: text ?? 'Click a wire, then the plug with the same colour and shape.', seconds, body });
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
    const ui = frame({ title, text: text ?? 'Watch the lights, then press them in the same order.', seconds, body });
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
    const ui = frame({ title, text: text ?? 'Stop the needle inside the green zone.', seconds, body });
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
function rich(t) {
  return escapeHtml(t).replace(/\*(.+?)\*/g, '<strong>$1</strong>');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
