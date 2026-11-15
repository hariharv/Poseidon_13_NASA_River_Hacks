// In the capsule: the mouse looks around, W A S D / arrows turn the ship, E or a click uses things.
// The eye can glide between your seat and the storm shelter (moveTo).
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';

export function createControls({ camera, dom, eye, onPointerChange, onPointerError }) {
  let yaw = 0;
  let pitch = 0.12; // looking up a little, out of the windows
  const at = eye.clone();
  let glide = null; // { from, to, t, seconds, done }
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

  let yawLimit = [-1.45, 1.45];
  function look(dx, dy) {
    yaw = THREE.MathUtils.clamp(yaw - dx * 0.0022, yawLimit[0], yawLimit[1]);
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0022, -1.25, 1.15);
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
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / glide.seconds);
        const k = glide.t * glide.t * (3 - 2 * glide.t);
        at.lerpVectors(glide.from, glide.to, k);
        yaw = THREE.MathUtils.lerp(glide.yaw0, glide.yaw1, k);
        pitch = THREE.MathUtils.lerp(glide.pitch0, glide.pitch1, k);
        if (glide.t >= 1) {
          const done = glide.done;
          glide = null;
          done?.();
        }
      }
      // weightless: the head floats a tiny bit
      camera.position.set(at.x + Math.sin(t * 0.7) * 0.006, at.y + Math.sin(t * 1.1) * 0.01, at.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      const cp = Math.cos(pitch);
      forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    },
    // holding Space fires the main engine
    burnHeld() {
      return enabled && !glide && keys.has('Space');
    },
    // which way to turn the ship: x = yaw (+ = turn right), y = pitch (+ = nose up)
    turnInput() {
      move.set(0, 0, 0);
      if (!enabled || glide) return move;
      if (keys.has('KeyD') || keys.has('ArrowRight')) move.x += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) move.x -= 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) move.y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) move.y -= 1;
      return move;
    },
    // Glide the eye somewhere else (seat <-> shelter), turning to face a new way.
    moveTo(to, { yaw: yaw1 = yaw, pitch: pitch1 = pitch, seconds = 1.2, limit = [-1.45, 1.45] } = {}, done) {
      glide = { from: at.clone(), to: to.clone(), t: 0, seconds, yaw0: yaw, yaw1, pitch0: pitch, pitch1, done };
      yawLimit = limit;
    },
    get gliding() {
      return Boolean(glide);
    },
    forward() {
      return forward.clone();
    },
    get pitch() {
      return pitch;
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
