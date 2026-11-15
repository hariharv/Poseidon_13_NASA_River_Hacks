// Touch controls for phones and iPads: a move stick (bottom left), drag anywhere to look,
// and big buttons (bottom right). They press the same keys the keyboard does, so every
// stage works on a touch screen without knowing about it:
//   stick up / down = W / S, stick left / right = A / D (turn), USE = E, UP = Space,
//   DOWN = Shift, GET UP = Q, and a drag = the mouse dragging the view.
// Pressing a real keyboard key (an iPad with a keyboard) hides the stick and buttons; touching shows them again.

import { isTouch } from '../core/device.js';

// What the buttons say in each stage (the keys stay the same).
const LABELS = {
  hermes: { use: 'Fix', up: 'Up', down: 'Down' },
  odysseus: { use: 'Grab', up: 'Up', down: 'Down' },
  dioscuri: { use: 'Use', up: 'Up', down: 'Down', leave: 'Get up' },
  hera: { use: 'Use', up: 'Engine' },
  apollo: { use: 'Use', up: 'Hop' },
};
// Keep getting a finger's moves even when it slides off the button (never let a failure stop the press).
const capture = (el, e) => {
  try {
    el.setPointerCapture?.(e.pointerId);
  } catch {
    /* not a real pointer (tests) or already gone */
  }
};
// The names on this stage's buttons, in capitals, for the words the game shows ("tap FIX").
let names = null;
export function buttonNames() {
  return names;
}

const DEAD = 0.35; // how far the stick must move before it counts
const LOOK_SPEED = 1.6; // a finger drag turns a bit more than a mouse drag

export function createTouch(host) {
  const layer = document.createElement('div');
  layer.className = 'touch-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="tc-look"></div>
    <div class="tc-stick-zone"><div class="tc-stick" role="img" aria-label="Move stick"><div class="tc-knob"></div></div></div>
    <div class="tc-buttons">
      <button type="button" class="tc-btn tc-leave" data-key="KeyQ" data-tap>Get up</button>
      <button type="button" class="tc-btn tc-down" data-key="ShiftLeft">Down</button>
      <button type="button" class="tc-btn tc-up" data-key="Space">Up</button>
      <button type="button" class="tc-btn tc-use" data-key="KeyE" data-tap>Use</button>
    </div>`;
  host.prepend(layer);

  const keyDown = new Set();
  const press = (code, down) => {
    if (down === keyDown.has(code)) return;
    if (down) keyDown.add(code);
    else keyDown.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  };
  const releaseAll = () => [...keyDown].forEach((code) => press(code, false));

  // ---------- the move stick ----------
  const zone = layer.querySelector('.tc-stick-zone');
  const stick = layer.querySelector('.tc-stick');
  const knob = layer.querySelector('.tc-knob');
  let stickId = null;
  const moveStick = (e) => {
    const box = stick.getBoundingClientRect();
    const r = box.width / 2;
    let x = (e.clientX - (box.left + r)) / r;
    let y = (e.clientY - (box.top + r)) / r;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    knob.style.transform = `translate(${x * r * 0.6}px, ${y * r * 0.6}px)`;
    press('KeyW', y < -DEAD);
    press('KeyS', y > DEAD);
    press('KeyA', x < -DEAD);
    press('KeyD', x > DEAD);
  };
  const endStick = () => {
    stickId = null;
    knob.style.transform = '';
    ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach((c) => press(c, false));
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    capture(zone, e);
    moveStick(e);
  });
  zone.addEventListener('pointermove', (e) => e.pointerId === stickId && moveStick(e));
  zone.addEventListener('pointerup', (e) => e.pointerId === stickId && endStick());
  zone.addEventListener('pointercancel', (e) => e.pointerId === stickId && endStick());
  zone.addEventListener('lostpointercapture', (e) => e.pointerId === stickId && endStick()); // e.g. a card popped up

  // ---------- the buttons ----------
  for (const btn of layer.querySelectorAll('.tc-btn')) {
    const code = btn.dataset.key;
    const tap = 'tap' in btn.dataset;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(btn, e);
      btn.classList.add('is-down');
      press(code, true);
      if (tap) setTimeout(() => press(code, false), 150); // a quick tap, like pressing a key once
    });
    const up = () => {
      btn.classList.remove('is-down');
      if (!tap) press(code, false);
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- drag anywhere else to look ----------
  // The stages already know "click and drag to look", so a finger drag sends them the same mouse events.
  const look = layer.querySelector('.tc-look');
  let lookId = null;
  let start = null;
  let lastX = 0;
  let lastY = 0;
  const canvas = () => document.querySelector('.stage-root canvas');
  const mouse = (type, target, x, y, extra = {}) => target?.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...extra }));
  look.addEventListener('pointerdown', (e) => {
    if (lookId != null) return;
    e.preventDefault();
    lookId = e.pointerId;
    capture(look, e);
    start = { x: e.clientX, y: e.clientY };
    lastX = e.clientX;
    lastY = e.clientY;
    mouse('mousedown', canvas(), e.clientX, e.clientY);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    const x = start.x + (e.clientX - start.x) * LOOK_SPEED;
    const y = start.y + (e.clientY - start.y) * LOOK_SPEED;
    mouse('mousemove', document, x, y, { movementX: x - lastX, movementY: y - lastY });
    lastX = x;
    lastY = y;
  });
  const endLook = (e) => {
    if (e.pointerId !== lookId) return;
    lookId = null;
    mouse('mouseup', window, lastX, lastY);
  };
  look.addEventListener('pointerup', endLook);
  look.addEventListener('pointercancel', endLook);
  look.addEventListener('lostpointercapture', endLook);

  // A real keyboard (an iPad with one, a laptop with a touch screen): hide the stick and buttons.
  window.addEventListener('keydown', (e) => {
    if (e.isTrusted && !layer.hidden) layer.classList.add('is-keyboard');
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') layer.classList.remove('is-keyboard');
  });

  return {
    show(stageId) {
      if (!isTouch()) return;
      const l = LABELS[stageId] ?? { use: 'Use', up: 'Up' };
      names = Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.toUpperCase()]));
      const set = (cls, text) => {
        const b = layer.querySelector(cls);
        b.hidden = !text;
        if (text) b.textContent = text;
      };
      set('.tc-use', l.use);
      set('.tc-up', l.up);
      set('.tc-down', l.down);
      set('.tc-leave', l.leave);
      if (l.leave) layer.querySelector('.tc-leave').hidden = true; // only while it can be used (setButton)
      layer.hidden = false;
    },
    // Show or hide one button while playing, e.g. 'leave' (Get up) only at the arm desk.
    setButton(name, on) {
      const b = layer.querySelector(`.tc-${name}`);
      if (!b || !b.textContent || b.hidden === !on) return;
      b.hidden = !on;
    },
    hide() {
      names = null;
      releaseAll();
      endStick();
      layer.hidden = true;
    },
  };
}
