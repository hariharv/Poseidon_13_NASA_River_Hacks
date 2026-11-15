// First person on the Moon. Walk inside the base; outside, hop around in one-sixth gravity.
// Easy controls: W / S walk forward and back, A / D turn left and right (the mouse also looks around).
// Uses pointer lock when it can, and falls back to click-and-drag to look.

import * as THREE from 'three';
import { ROOM, groundAt, inBaseFootprint } from './world.js';

const EYE = 1.6;
const WALK = { minX: -4.4, maxX: 5.5, minZ: -1.5, maxZ: 1.5 }; // inside: stay off the furniture
const OUTSIDE_RADIUS = 80;

export function createPlayer({ camera, dom, spawn, rules, onPointerChange, onPointerError }) {
  const pos = spawn.pos.clone();
  const vel = new THREE.Vector3();
  let yaw = spawn.yaw;
  let pitch = 0;
  let outside = false;
  let grounded = true;
  let fixedEye = null; // while sitting in the shelter: the camera stays put
  const keys = new Set();
  let mouseDown = false;
  let locked = false;
  let dragMode = false;
  let lastX = 0;
  let lastY = 0;
  let enabled = true;
  let actions = 0;
  let jumps = 0;
  let dragged = false;
  let bob = 0;
  let landed = 0; // little dip when you land from a hop

  const onKeyDown = (e) => {
    const onControl = e.target instanceof Element && e.target.closest('button, a, input, textarea, select');
    if (!onControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE' && !e.repeat && enabled) actions++;
    if (e.code === 'Space' && !e.repeat && enabled && !onControl) jumps++;
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
  let everLocked = false;
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
    yaw -= dx * 0.0023;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0023, -1.4, 1.4);
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
  const flat = new THREE.Vector3();
  const wish = new THREE.Vector3();

  function floorAt(x, z) {
    return outside ? groundAt(x, z) : ROOM.floor;
  }

  function update(dt, t) {
    if (enabled && (keys.has('ArrowLeft') || keys.has('KeyA'))) yaw += 2.0 * dt;
    if (enabled && (keys.has('ArrowRight') || keys.has('KeyD'))) yaw -= 2.0 * dt;
    const cp = Math.cos(pitch);
    forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    flat.set(-Math.sin(yaw), 0, -Math.cos(yaw));

    if (fixedEye) {
      jumps = 0;
      camera.position.copy(fixedEye);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      return;
    }

    wish.set(0, 0, 0);
    if (enabled) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(flat);
      if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(flat);
    }
    if (wish.lengthSq() > 1) wish.normalize();

    // Moon gravity is weak: you can only steer a little once your feet leave the ground
    const control = grounded ? 8 : 1.2;
    const speed = rules.walkSpeed * (outside ? 1 : 0.8);
    vel.x += (wish.x * speed - vel.x) * Math.min(1, dt * control);
    vel.z += (wish.z * speed - vel.z) * Math.min(1, dt * control);
    if (jumps > 0 && grounded && enabled) {
      vel.y = rules.jumpSpeed * (outside ? 1 : 0.55); // a gentle hop inside, a big bounce outside
      grounded = false;
    }
    jumps = 0;
    vel.y -= rules.gravity * dt;
    pos.addScaledVector(vel, dt);

    if (outside) {
      // keep out of the base walls, and don't wander off into the dark forever
      if (inBaseFootprint(pos.x, pos.z, 0.35)) {
        const push = [
          [pos.x - -6.75, 'x', -6.75],
          [8.85 - pos.x, 'x', 8.85],
          [pos.z - -3.15, 'z', -3.15],
          [3.15 - pos.z, 'z', 3.15],
        ].sort((a, b) => a[0] - b[0])[0];
        pos[push[1]] = push[2];
        vel[push[1]] = 0;
      }
      const d = Math.hypot(pos.x, pos.z);
      if (d > OUTSIDE_RADIUS) {
        pos.x *= OUTSIDE_RADIUS / d;
        pos.z *= OUTSIDE_RADIUS / d;
      }
    } else {
      pos.x = THREE.MathUtils.clamp(pos.x, WALK.minX, WALK.maxX);
      pos.z = THREE.MathUtils.clamp(pos.z, WALK.minZ, WALK.maxZ);
      const top = ROOM.ceiling - 0.2;
      if (pos.y > top) {
        pos.y = top;
        if (vel.y > 0) vel.y = 0;
      }
    }
    const floor = floorAt(pos.x, pos.z) + EYE;
    if (pos.y <= floor) {
      if (!grounded && vel.y < -1) landed = Math.min(0.12, -vel.y * 0.05);
      pos.y = floor;
      if (vel.y < 0) vel.y = 0;
      grounded = true;
    } else if (pos.y > floor + 0.05) grounded = false;

    // a soft bouncy lope when you walk
    const moving = grounded && Math.hypot(vel.x, vel.z) > 0.4;
    bob += (moving ? dt * (outside ? 6 : 8) : 0);
    landed *= Math.exp(-6 * dt);
    const bobY = moving ? Math.abs(Math.sin(bob)) * (outside ? 0.06 : 0.03) : 0;
    camera.position.set(pos.x, pos.y + bobY - landed, pos.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    void t;
  }

  return {
    update,
    position: pos,
    velocity: vel,
    get outside() {
      return outside;
    },
    get grounded() {
      return grounded;
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
    // jump to a spot (through the airlock), facing a way
    place(spot, { outside: out, yaw: y }) {
      outside = out;
      pos.copy(spot);
      pos.y = floorAt(pos.x, pos.z) + EYE;
      vel.set(0, 0, 0);
      grounded = true;
      if (y != null) yaw = y;
      pitch = 0;
      fixedEye = null;
    },
    // sit still somewhere (the storm shelter), still free to look around
    sit(eye, y) {
      fixedEye = eye ? eye.clone() : null;
      if (eye && y != null) {
        yaw = y;
        pitch = -0.05;
      }
      vel.set(0, 0, 0);
    },
    takeAction() {
      if (!actions) return false;
      actions = 0;
      return true;
    },
    clearActions() {
      actions = 0;
      jumps = 0;
    },
    forward() {
      return forward.clone();
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        keys.clear();
        actions = 0;
        jumps = 0;
      }
    },
    // dev testing: look a given way
    look(y, p) {
      yaw = y;
      pitch = p;
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
