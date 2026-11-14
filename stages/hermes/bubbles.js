// Bubbles. Your own breath makes them, so working hard = more bubbles = more air used.

import * as THREE from 'three';
import { bubbleTexture } from './textures.js';

export function createBubbles(scene, max = 160) {
  const material = new THREE.SpriteMaterial({ map: bubbleTexture(), transparent: true, depthWrite: false, opacity: 0.9 });
  const pool = Array.from({ length: max }, () => {
    const s = new THREE.Sprite(material);
    s.visible = false;
    scene.add(s);
    return { sprite: s, life: 0, speed: 0, wobble: 0, size: 0 };
  });
  let next = 0;

  return {
    emit(origin, count = 4, spread = 0.2) {
      for (let i = 0; i < count; i++) {
        const b = pool[next];
        next = (next + 1) % max;
        b.sprite.position.set(
          origin.x + (Math.random() - 0.5) * spread,
          origin.y + (Math.random() - 0.5) * spread * 0.5,
          origin.z + (Math.random() - 0.5) * spread,
        );
        b.size = 0.03 + Math.random() * 0.07;
        b.sprite.scale.setScalar(b.size);
        b.speed = 0.9 + Math.random() * 1.1 + b.size * 6;
        b.wobble = Math.random() * Math.PI * 2;
        b.life = 3 + Math.random() * 2;
        b.sprite.visible = true;
      }
    },
    update(dt, t) {
      for (const b of pool) {
        if (!b.sprite.visible) continue;
        b.life -= dt;
        const p = b.sprite.position;
        p.y += b.speed * dt;
        p.x += Math.sin(t * 5 + b.wobble) * 0.15 * dt;
        p.z += Math.cos(t * 4 + b.wobble) * 0.15 * dt;
        b.sprite.scale.setScalar(b.size * (1 + (5 - b.life) * 0.06));
        if (b.life <= 0 || p.y > 11.9) b.sprite.visible = false;
      }
    },
  };
}
