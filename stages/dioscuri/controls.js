// Sitting at the robot-arm desk: the mouse looks around (you stay in your seat),
// W A S D / arrows + Space / Shift steer the arm, E or a click grabs or plugs.
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';

export function createControls({ camera, dom, eye, onPointerChange, onPointerError }) {
  let yaw = 0;
  let pitch = -0.32; // looking out and down at the arm
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
    yaw = THREE.MathUtils.clamp(yaw - dx * 0.0022, -1.45, 1.45);
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0022, -1.0, 0.75);
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
  const move = new THREE.Vector3();
  return {
    update(dt, t) {
      if (enabled) {
        if (keys.has('KeyQ')) yaw = Math.min(1.45, yaw + 1.6 * dt);
        if (keys.has('KeyR')) yaw = Math.max(-1.45, yaw - 1.6 * dt);
      }
      camera.position.set(eye.x, eye.y + Math.sin(t * 1.1) * 0.01, eye.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      const cp = Math.cos(pitch);
      forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    },
    // which way to move the arm's hand: x = right, y = up, z = away from you (-z)
    armInput() {
      move.set(0, 0, 0);
      if (!enabled) return move;
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
    get yaw() {
      return yaw;
    },
    takeAction() {
      if (!actions) return false;
      actions = 0;
      return true;
    },
    clearActions() {
      actions = 0;
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
