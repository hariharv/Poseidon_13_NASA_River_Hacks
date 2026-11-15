// A juice pouch bursts mid-float: wobbly water blobs drift around the cabin.
// Bump into them (or look at one and press E) to catch them before the hill ends.
// In weightlessness water doesn't pour: it floats in wobbly balls.

import * as THREE from 'three';
import { BOUNDS } from './world.js';

export function createBlobs(scene, { count }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#7fd0ff',
    roughness: 0.05,
    metalness: 0,
    transmission: 0.6,
    transparent: true,
    opacity: 0.85,
    emissive: '#1a6fb0',
    emissiveIntensity: 0.35,
  });
  const pouchMat = new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.5 });
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.05), pouchMat);
  pouch.visible = false;
  scene.add(pouch);
  const blobs = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 3) * 0.03, 20, 14), mat);
    m.visible = false;
    scene.add(m);
    return { m, pos: new THREE.Vector3(), vel: new THREE.Vector3(), phase: Math.random() * 6, state: 'hidden', pop: 0 };
  });

  return {
    blobs,
    get loose() {
      return blobs.filter((b) => b.state === 'loose');
    },
    get caught() {
      return blobs.filter((b) => b.state === 'caught').length;
    },
    get released() {
      return blobs.some((b) => b.state !== 'hidden');
    },
    // the pouch bursts here
    release(at) {
      pouch.position.copy(at);
      pouch.visible = true;
      blobs.forEach((b) => {
        b.state = 'loose';
        b.m.visible = true;
        b.pos.copy(at);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
        b.vel.copy(dir).multiplyScalar(0.5 + Math.random() * 0.6);
      });
    },
    catch(b) {
      b.state = 'caught';
      b.pop = 0;
    },
    // the hill ended: whatever is still floating splats on the walls
    splat() {
      let n = 0;
      blobs.forEach((b) => {
        if (b.state !== 'loose') return;
        b.state = 'splat';
        b.pop = 0;
        n++;
      });
      pouch.visible = false;
      return n;
    },
    update(dt, t) {
      for (const b of blobs) {
        if (b.state === 'loose') {
          b.pos.addScaledVector(b.vel, dt);
          for (const [axis, lo, hi] of [['x', BOUNDS.minX, BOUNDS.maxX], ['y', BOUNDS.minY + 0.2, BOUNDS.maxY], ['z', BOUNDS.minZ, BOUNDS.maxZ]]) {
            if (b.pos[axis] < lo) (b.pos[axis] = lo), (b.vel[axis] = Math.abs(b.vel[axis]));
            if (b.pos[axis] > hi) (b.pos[axis] = hi), (b.vel[axis] = -Math.abs(b.vel[axis]));
          }
          b.m.position.copy(b.pos);
          // wobble like real floating water
          const w = Math.sin(t * 6 + b.phase) * 0.12;
          b.m.scale.set(1 + w, 1 - w, 1 + w * 0.5);
        } else if (b.state === 'caught' || b.state === 'splat') {
          b.pop += dt * 4;
          const k = Math.min(1, b.pop);
          if (b.state === 'caught') b.m.scale.setScalar(1 - k);
          else b.m.scale.set(1 + k * 2, Math.max(0.05, 1 - k), 1 + k * 2);
          if (k >= 1) b.m.visible = false;
        }
      }
      if (pouch.visible) pouch.rotation.set(t * 1.3, t * 0.7, 0);
    },
  };
}
