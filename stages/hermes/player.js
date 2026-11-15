// First-person swimming: WASD / arrows to swim, mouse to look, Space / Shift for up and down.
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';
import { POOL } from './world.js';

const RADIUS = 0.55;
const DRAG = 2.4;

export function createPlayer({ camera, dom, colliders, spawn, swimSpeed, onPointerChange, onPointerError }) {
  const pos = spawn.pos.clone();
  const vel = new THREE.Vector3();
  let yaw = spawn.yaw;
  let pitch = 0;
  const keys = new Set();
  let mouseDown = false;
  let locked = false;
  let dragMode = false;
  let lastX = 0;
  let lastY = 0;
  let enabled = true;

  const onKeyDown = (e) => {
    // Space and arrows would scroll the page, but leave them alone on buttons so Space still presses "Dive in".
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, textarea, select');
    if (!onControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
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
    lastX = e.clientX;
    lastY = e.clientY;
    if (!locked && !dragMode) requestLock();
  };
  const onMouseUp = () => (mouseDown = false);
  const onMouseMove = (e) => {
    if (!enabled) return;
    if (locked) look(e.movementX, e.movementY);
    else if (dragMode && mouseDown) {
      look(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  let everLocked = false;
  const onLockChange = () => {
    locked = document.pointerLockElement === dom;
    if (locked) everLocked = true;
    onPointerChange?.(locked);
  };
  const onLockError = () => {
    // Some browsers (or an embedded preview) block pointer lock: click and drag instead.
    // (If it worked before, it's just the browser's short cooldown after Esc: try the next click.)
    if (!everLocked) dragMode = true;
    onPointerError?.(dragMode);
  };

  function look(dx, dy) {
    yaw -= dx * 0.0023;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0023, -1.35, 1.35);
  }

  function requestLock() {
    if (dragMode) return;
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
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function update(dt, t, { anchored = false } = {}) {
    // A / D and the left / right arrows turn you (the same keys, the same way, every time)
    if (enabled && (keys.has('ArrowLeft') || keys.has('KeyA'))) yaw += 1.9 * dt;
    if (enabled && (keys.has('ArrowRight') || keys.has('KeyD'))) yaw -= 1.9 * dt;

    const cp = Math.cos(pitch);
    forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    wish.set(0, 0, 0);
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(forward);
      if (keys.has('Space')) wish.y += 1;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) wish.y -= 1;
    }
    if (wish.lengthSq() > 1) wish.normalize();

    // floaty water physics: push towards where you want to go, water slows you down
    const drag = anchored ? 6 : DRAG;
    vel.addScaledVector(wish, swimSpeed * DRAG * dt);
    vel.multiplyScalar(Math.exp(-drag * dt));
    pos.addScaledVector(vel, dt);

    for (const c of colliders) pushOut(pos, c, tmp);
    pos.x = THREE.MathUtils.clamp(pos.x, -POOL.halfX + RADIUS, POOL.halfX - RADIUS);
    pos.z = THREE.MathUtils.clamp(pos.z, -POOL.halfZ + RADIUS, POOL.halfZ - RADIUS);
    pos.y = THREE.MathUtils.clamp(pos.y, 0.7, POOL.depth - 0.6);

    camera.position.set(pos.x, pos.y + Math.sin(t * 1.3) * 0.035, pos.z);
    camera.rotation.set(pitch, yaw, Math.sin(t * 0.9) * 0.012, 'YXZ');
  }

  return {
    update,
    position: pos,
    get swimming() {
      return wish.lengthSq() > 0.01;
    },
    get speed() {
      return vel.length();
    },
    get wantsFix() {
      return keys.has('KeyE') || (locked && mouseDown);
    },
    get locked() {
      return locked;
    },
    get dragMode() {
      return dragMode;
    },
    forward() {
      return forward.clone();
    },
    setEnabled(on) {
      enabled = on;
      if (!on) keys.clear();
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

// Push a sphere at `p` out of a collider (a rounded tube from a to b, or a box).
function pushOut(p, c, tmp) {
  if (c.kind === 'seg') {
    const ab = tmp.subVectors(c.b, c.a);
    const t = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(p, c.a).dot(ab) / ab.lengthSq(), 0, 1);
    const closest = c.a.clone().addScaledVector(ab, t);
    const away = new THREE.Vector3().subVectors(p, closest);
    const d = away.length();
    const min = c.r + RADIUS;
    if (d < min) {
      if (d < 1e-5) away.set(0, 1, 0);
      else away.divideScalar(d);
      p.copy(closest).addScaledVector(away, min);
    }
  } else if (c.kind === 'box') {
    const cx = THREE.MathUtils.clamp(p.x, c.min.x, c.max.x);
    const cy = THREE.MathUtils.clamp(p.y, c.min.y, c.max.y);
    const cz = THREE.MathUtils.clamp(p.z, c.min.z, c.max.z);
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    const d = Math.hypot(dx, dy, dz);
    if (d > 1e-5 && d < RADIUS) {
      const k = RADIUS / d;
      p.set(cx + dx * k, cy + dy * k, cz + dz * k);
    } else if (d <= 1e-5) {
      // inside the box: leave by the nearest face
      const exits = [
        [c.min.x - RADIUS - p.x, 'x'],
        [c.max.x + RADIUS - p.x, 'x'],
        [c.min.y - RADIUS - p.y, 'y'],
        [c.max.y + RADIUS - p.y, 'y'],
        [c.min.z - RADIUS - p.z, 'z'],
        [c.max.z + RADIUS - p.z, 'z'],
      ].sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]));
      p[exits[0][1]] += exits[0][0];
    }
  }
}
