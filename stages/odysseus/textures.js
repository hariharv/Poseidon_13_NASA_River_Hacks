// Hand-made textures for the zero-G plane, so the stage needs no image files.

import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The soft white padding that covers the real plane's walls: puffy squares with stitched seams.
export function paddingTexture(base = '#f1efe9', seam = '#c9c4b8') {
  const [c, g] = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x = i * 128;
      const y = j * 128;
      const r = g.createRadialGradient(x + 64, y + 56, 6, x + 64, y + 64, 86);
      r.addColorStop(0, 'rgba(255,255,255,0.55)');
      r.addColorStop(0.7, 'rgba(255,255,255,0)');
      r.addColorStop(1, 'rgba(60,50,30,0.16)');
      g.fillStyle = r;
      g.fillRect(x, y, 128, 128);
    }
  }
  g.strokeStyle = seam;
  g.lineWidth = 3;
  g.setLineDash([7, 5]);
  for (let i = 0; i <= 2; i++) {
    g.beginPath();
    g.moveTo(i * 128, 0);
    g.lineTo(i * 128, 256);
    g.moveTo(0, i * 128);
    g.lineTo(256, i * 128);
    g.stroke();
  }
  return tex(c);
}

// Blue floor mats with a yellow safety edge.
export function matTexture() {
  const [c, g] = canvas(256);
  g.fillStyle = '#3d5a8a';
  g.fillRect(0, 0, 256, 256);
  const r = g.createRadialGradient(128, 120, 10, 128, 128, 180);
  r.addColorStop(0, 'rgba(255,255,255,0.12)');
  r.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#263d63';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 250);
  return tex(c);
}

// The view out of a window: sky above, clouds at the horizon, the ground far below.
// Slide offset.y to tip the horizon as the plane noses up and down.
export function skyTexture() {
  const [c, g] = canvas(128, 512);
  const v = g.createLinearGradient(0, 0, 0, 512);
  v.addColorStop(0, '#1f63c9');
  v.addColorStop(0.42, '#8cc8ff');
  v.addColorStop(0.5, '#f4fbff');
  v.addColorStop(0.53, '#d8e6f0');
  v.addColorStop(0.62, '#8fa9bf');
  v.addColorStop(1, '#4d6a52');
  g.fillStyle = v;
  g.fillRect(0, 0, 128, 512);
  // puffy clouds along the horizon
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.55 + rand() * 0.4})`;
    g.beginPath();
    g.arc(rand() * 128, 238 + rand() * 40, 8 + rand() * 16, 0, Math.PI * 2);
    g.fill();
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 0.45);
  return t;
}

// A screen or sign you can redraw (the flight sign, the camera screen).
export function screenTexture(w = 512, h = 160) {
  const [c, g] = canvas(w, h);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { texture: t, ctx: g, w, h, redraw: () => (t.needsUpdate = true) };
}

// A socket plate on the power panel. The words shrink to fit, so long names never spill off.
export function plateTexture({ text, sub, bg, w = 320, h = 220 }) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,243,214,0.35)';
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#fff3d6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const words = text.split(' ');
  const lines = words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1)] : [text];
  let size = 58;
  g.font = `bold ${size}px "Lilita One", system-ui, sans-serif`;
  while (size > 20 && Math.max(...lines.map((l) => g.measureText(l).width)) > w - 36) {
    size -= 2;
    g.font = `bold ${size}px "Lilita One", system-ui, sans-serif`;
  }
  const top = lines.length > 1 ? h * 0.38 : h * 0.48;
  lines.forEach((l, i) => g.fillText(l, w / 2, top + i * size * 1.02));
  g.font = '26px "Atkinson Hyperlegible", system-ui, sans-serif';
  g.fillStyle = 'rgba(255,243,214,0.85)';
  g.fillText(sub, w / 2, h * 0.87);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
