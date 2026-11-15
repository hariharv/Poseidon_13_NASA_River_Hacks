// First person on the zero-G plane. Three ways to move:
//   float  weightless: one push and you glide (keep pushing = breathing hard)
//   heavy  pull-up / pull-out: about twice your weight, so you lie flat on the floor
//   walk   level flight: normal weight, walk around
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';
import { isTouch, dragLookNow } from '../../core/device.js';
import { BOUNDS, halfWidthAt, SOLIDS } from './world.js';

const LYING_EYE = 0.45;
const STANDING_EYE = 1.6;

export function createPlayer({ camera, dom, spawn, rules, onPointerChange, onPointerError }) {
  const pos = spawn.pos.clone();
  const vel = new THREE.Vector3();
  let yaw = spawn.yaw;
  let pitch = 0;
  let roll = 0;
  const keys = new Set();
  let mouseDown = false;
  let locked = false;
  let dragMode = false;
  let lastX = 0;
  let lastY = 0;
  let enabled = true;
  let mode = 'walk';
  let actions = 0; // presses of E / clicks waiting to be used
  let dragged = false;

  const onKeyDown = (e) => {
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, textarea, select');
    if (!onControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat && enabled) actions++;
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    mouseDown = false;
  };
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    mouseDown = true;
    dragged = false;
    lastX = e.clientX;
    lastY = e.clientY;
    if (locked && enabled) actions++;
    if (!locked && !dragMode) requestLock();
  };
  const onMouseUp = () => {
    // in drag mode a click that didn't drag still counts as "grab"
    if (dragMode && mouseDown && !dragged && enabled) actions++;
    mouseDown = false;
  };
  const onMouseMove = (e) => {
    if (!enabled) return;
    if (locked) look(e.movementX, e.movementY);
    else if (dragMode && mouseDown) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
      look(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  let everLocked = false;
  let refusals = 0; // mouse-lock refusals in a row
  let lastRefusal = -1e9;
  const onLockChange = () => {
    locked = document.pointerLockElement === dom;
    if (locked) {
      everLocked = true;
      refusals = 0;
    }
    onPointerChange?.(locked);
  };
  const onLockError = () => {
    // Touch screens and browsers that block pointer lock use click-and-drag. Otherwise (asked
    // without a click, or just after Esc) pause, so the next click locks the mouse again.
    const now = performance.now();
    if (now - lastRefusal < 300) return; // one refusal sends both an event and a failed promise
    lastRefusal = now;
    refusals++;
    if (dragLookNow(everLocked, refusals)) dragMode = true;
    if (!dragMode) onPointerChange?.(false);
    onPointerError?.(dragMode);
  };

  function look(dx, dy) {
    yaw -= dx * 0.0023;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0023, -1.4, 1.4);
  }

  function requestLock() {
    if (dragMode) return;
    // phones and iPads have no mouse to lock: drag on the screen to look instead
    if (isTouch() || !dom.requestPointerLock) {
      onLockError();
      return;
    }
    try {
      const p = dom.requestPointerLock?.();
      p?.catch?.(onLockError);
    } catch {
      onLockError();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  dom.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockError);

  const forward = new THREE.Vector3();
  const flat = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  let thrusting = false;
  let shake = 0;

  function update(dt, t) {
    // A / D and the left / right arrows turn you (the same keys, the same way, every time)
    if (enabled && (keys.has('ArrowLeft') || keys.has('KeyA'))) yaw += 1.9 * dt;
    if (enabled && (keys.has('ArrowRight') || keys.has('KeyD'))) yaw -= 1.9 * dt;

    const cp = Math.cos(pitch);
    forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    flat.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    wish.set(0, 0, 0);
    if (enabled) {
      const along = mode === 'float' ? forward : flat;
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(along);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(along);
      if (mode === 'float') {
        if (keys.has('Space')) wish.y += 1;
        if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) wish.y -= 1;
      }
    }
    if (wish.lengthSq() > 1) wish.normalize();
    thrusting = false;

    if (mode === 'float') {
      // no weight: pushes add up, and you keep gliding when you stop
      if (wish.lengthSq() > 0.01) {
        thrusting = true;
        vel.addScaledVector(wish, rules.thrust * dt);
      }
      vel.multiplyScalar(Math.exp(-0.12 * dt));
      if (vel.length() > rules.maxSpeed) vel.setLength(rules.maxSpeed);
      roll += (Math.sin(t * 0.4) * 0.08 - roll) * Math.min(1, dt);
    } else if (mode === 'heavy') {
      // pinned to the floor: you can only look around
      vel.x *= Math.exp(-5 * dt);
      vel.z *= Math.exp(-5 * dt);
      vel.y -= 9.8 * rules.heavyG * dt;
      roll += (0 - roll) * Math.min(1, dt * 3);
    } else {
      // level flight: walk normally
      const target = wish.multiplyScalar(rules.walkSpeed);
      vel.x += (target.x - vel.x) * Math.min(1, dt * 8);
      vel.z += (target.z - vel.z) * Math.min(1, dt * 8);
      vel.y -= 9.8 * dt;
      roll += (0 - roll) * Math.min(1, dt * 3);
    }
    pos.addScaledVector(vel, dt);

    // the padded walls: soft bumps
    const floorEye = mode === 'float' ? BOUNDS.minY : mode === 'heavy' ? LYING_EYE : STANDING_EYE;
    const limits = [
      ['x', BOUNDS.minX, BOUNDS.maxX],
      ['y', mode === 'float' ? BOUNDS.minY : Math.min(floorEye, pos.y), BOUNDS.maxY],
      ['z', BOUNDS.minZ, BOUNDS.maxZ],
    ];
    for (const [axis, lo, hi] of limits) {
      if (pos[axis] < lo) {
        pos[axis] = lo;
        vel[axis] = mode === 'float' ? Math.abs(vel[axis]) * 0.4 : 0;
      } else if (pos[axis] > hi) {
        pos[axis] = hi;
        vel[axis] = mode === 'float' ? -Math.abs(vel[axis]) * 0.4 : 0;
      }
    }
    // near the ceiling the padding slants in: don't let your head go through it
    const side = halfWidthAt(pos.y + 0.15) - 0.35;
    if (Math.abs(pos.x) > side) {
      const sx = Math.sign(pos.x);
      pos.x = sx * side;
      vel.x = mode === 'float' ? -sx * Math.abs(vel.x) * 0.4 : 0;
    }
    // solid things (toolbox, fridge, speaker, air machine): your body bumps into them
    const feet = pos.y - (mode === 'float' ? 0.45 : mode === 'heavy' ? 0.35 : STANDING_EYE - 0.1);
    for (const b of SOLIDS) {
      if (feet > b.max.y || pos.y + 0.15 < b.min.y) continue;
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= 0.3) continue;
      if (d < 1e-6) {
        pos.z = b.max.z + 0.3; // right inside it: step out the back
        continue;
      }
      pos.x = cx + (dx / d) * 0.3;
      pos.z = cz + (dz / d) * 0.3;
      const vn = (vel.x * dx + vel.z * dz) / d;
      if (vn < 0) {
        vel.x -= (vn * dx) / d;
        vel.z -= (vn * dz) / d;
      }
    }
    // landed: settle at standing or lying eye height
    if (mode !== 'float' && pos.y <= floorEye + 0.001) {
      pos.y += (floorEye - pos.y) * Math.min(1, dt * 3);
      if (vel.y < 0) vel.y = 0;
    }

    shake = mode === 'heavy' ? 0.006 : 0;
    camera.position.set(pos.x + Math.sin(t * 31) * shake, pos.y + Math.sin(t * 27) * shake, pos.z);
    camera.rotation.set(pitch, yaw, roll, 'YXZ');
  }

  return {
    update,
    position: pos,
    velocity: vel,
    get mode() {
      return mode;
    },
    setMode(next) {
      if (next === mode) return;
      if (next === 'float') vel.y += 0.35; // the floor drops away under you
      mode = next;
    },
    get thrusting() {
      return thrusting;
    },
    get moving() {
      return wish.lengthSq() > 0.01;
    },
    get locked() {
      return locked;
    },
    get dragMode() {
      return dragMode;
    },
    // is an E press / click waiting? (doesn't use it up)
    takeActionPeek() {
      return actions > 0;
    },
    // one press of E (or one click) = one action
    takeAction() {
      if (!actions) return false;
      actions = 0;
      return true;
    },
    clearActions() {
      actions = 0;
    },
    forward() {
      return forward.clone();
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        keys.clear();
        actions = 0;
      }
    },
    requestLock,
    exitLock() {
      if (document.pointerLockElement === dom) document.exitPointerLock();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      if (document.pointerLockElement === dom) document.exitPointerLock();
    },
  };
}
