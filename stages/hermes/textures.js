// Hand-made (procedural) textures for the pool, so the stage needs no image files.

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

// Pool tiles: 4x4 tiles per texture repeat.
export function tilesTexture(base = '#cdeef3', grout = '#8fc3cf') {
  const [c, g] = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = grout;
  g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 256);
    g.moveTo(0, i * 64);
    g.lineTo(256, i * 64);
    g.stroke();
  }
  // a little variation so it doesn't look like graph paper
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(255,255,255,${0.04 + ((i * 37) % 7) / 100})`;
    g.fillRect((i % 4) * 64 + 3, Math.floor(i / 4) * 64 + 3, 58, 58);
  }
  return tex(c);
}

// Caustics: the wobbly light web you see on the bottom of a pool.
// Made from Voronoi cell edges (distance to 2nd-nearest point minus nearest).
let causticCanvas = null;
export function causticsTexture(repeat = [1, 1]) {
  if (!causticCanvas) {
    const size = 256;
    const [c, g] = canvas(size);
    let seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts = Array.from({ length: 22 }, () => [rand(), rand()]);
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        let f1 = 9;
        let f2 = 9;
        for (const [px, py] of pts) {
          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const dx = u - (px + ox);
              const dy = v - (py + oy);
              const d = dx * dx + dy * dy;
              if (d < f1) {
                f2 = f1;
                f1 = d;
              } else if (d < f2) f2 = d;
            }
          }
        }
        const edge = Math.sqrt(f2) - Math.sqrt(f1);
        const k = Math.pow(Math.max(0, 1 - edge * 14), 3);
        const i = (y * size + x) * 4;
        img.data[i] = 200 * k + 20;
        img.data[i + 1] = 250 * k + 20;
        img.data[i + 2] = 255 * k + 25;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    causticCanvas = c;
  }
  return tex(causticCanvas, { repeat });
}

// Soft vertical beam (light shafts, panel beacons).
export function beamTexture() {
  const [c, g] = canvas(64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,255,255,0.9)');
  v.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  // fade the sides
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return tex(c, { srgb: false });
}

export function dotTexture() {
  const [c, g] = canvas(64);
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false });
}

export function bubbleTexture() {
  const [c, g] = canvas(64);
  g.strokeStyle = 'rgba(230,255,255,0.95)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(200,250,255,0.18)';
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(22, 21, 7, 4, -0.7, 0, Math.PI * 2);
  g.fill();
  return tex(c, { srgb: false });
}

// Solar array mock-up: dark cells with gold wiring.
export function solarTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#1d2a5c';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#c99a3a';
  g.lineWidth = 2;
  for (let x = 0; x <= 256; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  for (let y = 0; y <= 128; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  return tex(c, { repeat: [3, 1] });
}

// A painted sign or panel face.
export function labelTexture({ text, sub = '', bg = '#23305c', fg = '#fff3d6', w = 256, h = 160, stripes = false }) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (stripes) {
    g.save();
    g.beginPath();
    g.rect(0, h - 26, w, 26);
    g.clip();
    for (let x = -40; x < w + 40; x += 28) {
      g.fillStyle = '#ffc145';
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 14, h);
      g.lineTo(x + 40, h - 26);
      g.lineTo(x + 26, h - 26);
      g.fill();
    }
    g.restore();
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${Math.round(h * 0.34)}px "Lilita One", system-ui, sans-serif`;
  g.fillText(text, w / 2, sub ? h * 0.4 : h * 0.5);
  if (sub) {
    g.font = `${Math.round(h * 0.15)}px "Atkinson Hyperlegible", system-ui, sans-serif`;
    g.fillText(sub, w / 2, h * 0.68);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
