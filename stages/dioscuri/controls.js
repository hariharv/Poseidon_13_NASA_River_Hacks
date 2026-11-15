// Two ways to move in the robot-arm lab:
//   float  drift around the lab: W A S D to push (the way you look), Space up, Shift down
//   desk   sitting at the arm controls: W A S D / arrows + Space / Shift steer the arm
// The mouse looks around. E (or a click) uses what you look at; Q gets up from the desk.
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';

export function createControls({ camera, dom, seat, start, room, floatSpeed, onPointerChange, onPointerError }) {
  let yaw = 0;
  let pitch = -0.1;
  const keys = new Set();
  let locked = false;
  let dragMode = false;
  let everLocked = false;
  let mouseDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let enabled = true;
  let actions = 0;
  let leaves = 0;
  let mode = 'float';
  const pos = start.clone();
  const vel = new THREE.Vector3();
  let glide = null; // { from, to, t } while moving to or from the seat

  const onKeyDown = (e) => {
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, textarea, select');
    if (!onControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat && enabled) actions++;
    if (e.code === 'KeyQ' && !e.repeat && enabled) leaves++;
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
  const onLockChange = () => {
    locked = document.pointerLockElement === dom;
    if (locked) everLocked = true;
    onPointerChange?.(locked);
  };
  const onLockError = () => {
    if (!everLocked) dragMode = true;
    onPointerError?.(dragMode);
  };

  function look(dx, dy) {
    yaw -= dx * 0.0022; // turn all the way round, even at the arm controls
    if (yaw > Math.PI) yaw -= Math.PI * 2;
    if (yaw < -Math.PI) yaw += Math.PI * 2;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0022, -1.35, 1.2);
  }
  function requestLock() {
    if (dragMode) return;
    try {
      dom.requestPointerLock?.()?.catch?.(onLockError);
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
  const move = new THREE.Vector3();
  let pushing = false;

  return {
    update(dt, t) {
      const cp = Math.cos(pitch);
      forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      pushing = false;
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / 0.6);
        const k = glide.t * glide.t * (3 - 2 * glide.t);
        pos.lerpVectors(glide.from, glide.to, k);
        if (glide.t >= 1) glide = null;
      } else if (mode === 'float') {
        // A / D and the left / right arrows turn you
        if (enabled && (keys.has('KeyA') || keys.has('ArrowLeft'))) yaw += 1.9 * dt;
        if (enabled && (keys.has('KeyD') || keys.has('ArrowRight'))) yaw -= 1.9 * dt;
        wish.set(0, 0, 0);
        if (enabled) {
          if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(forward);
          if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(forward);
          if (keys.has('Space')) wish.y += 1;
          if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) wish.y -= 1;
        }
        if (wish.lengthSq() > 1) wish.normalize();
        pushing = wish.lengthSq() > 0.01;
        // weightless: you push, then drift (handrails make it easy to stop)
        vel.addScaledVector(wish, floatSpeed * 3 * dt);
        vel.multiplyScalar(Math.exp(-2.2 * dt));
        if (vel.length() > floatSpeed) vel.setLength(floatSpeed);
        pos.addScaledVector(vel, dt);
        for (const [axis, lo, hi] of [['x', room.minX, room.maxX], ['y', room.minY, room.maxY], ['z', room.minZ, room.maxZ]]) {
          if (pos[axis] < lo) (pos[axis] = lo), (vel[axis] = Math.abs(vel[axis]) * 0.3);
          if (pos[axis] > hi) (pos[axis] = hi), (vel[axis] = -Math.abs(vel[axis]) * 0.3);
        }
      }
      const bob = mode === 'float' ? Math.sin(t * 0.9) * 0.02 : Math.sin(t * 1.1) * 0.008;
      camera.position.set(pos.x, pos.y + bob, pos.z);
      camera.rotation.set(pitch, yaw, mode === 'float' ? Math.sin(t * 0.5) * 0.02 : 0, 'YXZ');
    },
    get mode() {
      return mode;
    },
    get moving() {
      return Boolean(glide);
    },
    get pushing() {
      return pushing;
    },
    sit() {
      mode = 'desk';
      vel.set(0, 0, 0);
      glide = { from: pos.clone(), to: seat.clone(), t: 0 };
      yaw = 0;
      pitch = -0.32; // looking out and down at the arm
    },
    stand() {
      mode = 'float';
      glide = { from: pos.clone(), to: seat.clone().add(new THREE.Vector3(0, 0.15, 1.1)), t: 0 };
    },
    // which way to move the arm's hand: x = right, y = up, z = away from you (-z)
    armInput() {
      move.set(0, 0, 0);
      if (!enabled || mode !== 'desk' || glide) return move;
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) move.x -= 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) move.z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) move.z += 1;
      if (keys.has('Space')) move.y += 1;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC')) move.y -= 1;
      if (move.lengthSq() > 1) move.normalize();
      return move;
    },
    forward() {
      return forward.clone();
    },
    takeAction() {
      if (!actions) return false;
      actions = 0;
      return true;
    },
    takeLeave() {
      if (!leaves) return false;
      leaves = 0;
      return true;
    },
    clearActions() {
      actions = 0;
      leaves = 0;
    },
    get locked() {
      return locked;
    },
    get dragMode() {
      return dragMode;
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        keys.clear();
        actions = 0;
        leaves = 0;
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
