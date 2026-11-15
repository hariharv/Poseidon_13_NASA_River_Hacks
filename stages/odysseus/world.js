// The zero-G plane's padded cabin, built from simple shapes. One unit = one metre.
// Real reduced-gravity planes clear out the seats and cover the walls in soft padding,
// leaving a long open "box" to float in. Front of the plane is -z.

import * as THREE from 'three';
import { labelTexture, dotTexture, beamTexture } from '../hermes/textures.js';
import { disposeTree } from '../hermes/world.js';
import { paddingTexture, matTexture, skyTexture, screenTexture, plateTexture } from './textures.js';
import { MACHINES } from './sim.js';

export { disposeTree };

const HALF_W = 1.7; // half the cabin width at the floor
const WALL_H = 1.5; // straight wall, then it curves in to the ceiling
const CEIL_Y = 2.55;
const CEIL_HALF = 1.1;
const FRONT = -9;
const BACK = 9;

// Where you (and the tools) can be. Kept a little inside the padding.
export const BOUNDS = { minX: -HALF_W + 0.35, maxX: HALF_W - 0.35, minY: 0.25, maxY: CEIL_Y - 0.3, minZ: FRONT + 0.4, maxZ: BACK - 0.4 };
// Half the cabin's width at height y: straight walls, then the padding slants in toward the ceiling.
export function halfWidthAt(y) {
  if (y <= WALL_H) return HALF_W;
  return HALF_W - ((Math.min(y, CEIL_Y) - WALL_H) / (CEIL_Y - WALL_H)) * (HALF_W - CEIL_HALF);
}
// Keep a floating thing (radius `pad`) inside the padding: walls, the slanted ceiling panels, floor and ends.
export function keepInside(p, v, pad, bounce = 0.55, floor = pad) {
  const lo = { y: floor, z: FRONT + pad + 0.05 };
  const hi = { y: CEIL_Y - pad, z: BACK - pad - 0.05 };
  for (const axis of ['y', 'z']) {
    if (p[axis] < lo[axis]) {
      p[axis] = lo[axis];
      v[axis] = Math.abs(v[axis]) * bounce;
    } else if (p[axis] > hi[axis]) {
      p[axis] = hi[axis];
      v[axis] = -Math.abs(v[axis]) * bounce;
    }
  }
  const lim = halfWidthAt(p.y + pad * 0.7) - pad;
  if (Math.abs(p.x) > lim) {
    const s = Math.sign(p.x);
    p.x = s * lim;
    v.x = -s * Math.abs(v.x) * bounce;
    if (p.y > WALL_H) v.y = -Math.abs(v.y) * bounce; // the slanted panel also pushes you down a little
  }
}
export const SPAWN = { pos: new THREE.Vector3(0, 1.6, 6.2), yaw: 0 };
export const TOOLBOX = new THREE.Vector3(0, 0, 3.4);
// Yellow oxygen masks hanging from the ceiling, like on a real plane. Float into them for air.
export const MASKS = new THREE.Vector3(0, 1.3, -1.4);

const CREAM = new THREE.Color('#f4efe4');

export function buildWorld({ hints = 'more' }) {
  const scene = new THREE.Scene();
  scene.background = CREAM;
  scene.fog = new THREE.Fog(CREAM, 9, 24);
  const animators = [];

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight('#fffaf0', '#7b8aa3', 1.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', 1.1);
  key.position.set(1, 6, 3);
  scene.add(key);
  const emergency = new THREE.PointLight('#ff7a3a', 0, 14, 1.6);
  emergency.position.set(0, 0.5, 2);
  scene.add(emergency);

  // ---------- the padded cabin ----------
  const length = BACK - FRONT;
  const padMat = (repeatX, repeatY) => {
    const map = paddingTexture();
    map.repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.95, side: THREE.DoubleSide });
  };
  const midZ = (FRONT + BACK) / 2;

  const floorMap = matTexture();
  floorMap.repeat.set(2, length / 1.7);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, length), new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = midZ;
  scene.add(floor);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, WALL_H), padMat(length / 1.2, WALL_H / 1.2));
    wall.rotation.y = side * -Math.PI / 2;
    wall.position.set(side * HALF_W, WALL_H / 2, midZ);
    scene.add(wall);
    // the curve up to the ceiling (a slanted panel)
    const dx = HALF_W - CEIL_HALF;
    const dy = CEIL_Y - WALL_H;
    const slantW = Math.hypot(dx, dy);
    const slant = new THREE.Mesh(new THREE.PlaneGeometry(length, slantW), padMat(length / 1.2, slantW / 1.2));
    slant.position.set(side * (CEIL_HALF + dx / 2), WALL_H + dy / 2, midZ);
    slant.rotation.set(0, side * -Math.PI / 2, 0, 'YXZ');
    slant.rotateX(Math.atan2(dx, dy)); // lean the top edge in towards the middle
    scene.add(slant);
  }
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(CEIL_HALF * 2, length), padMat(2, length / 1.2));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, CEIL_Y, midZ);
  scene.add(ceiling);

  for (const [z, rotY] of [[FRONT, 0], [BACK, Math.PI]]) {
    const bulkhead = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, CEIL_Y), padMat(3, 2));
    bulkhead.position.set(0, CEIL_Y / 2, z);
    bulkhead.rotation.y = rotY;
    scene.add(bulkhead);
  }

  // red stripes on the wall: a "this way is the floor" line, like on the real plane
  const stripeMat = new THREE.MeshBasicMaterial({ color: '#e0412b' });
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.08), stripeMat);
    stripe.rotation.y = side * -Math.PI / 2;
    stripe.position.set(side * (HALF_W - 0.01), 0.42, midZ);
    scene.add(stripe);
  }

  // yellow foot straps along the floor
  const strapMat = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6 });
  const straps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.04, 0.07), strapMat, 40);
  const m = new THREE.Matrix4();
  let si = 0;
  for (let z = FRONT + 1.2; z < BACK - 1; z += 1.5) {
    for (const x of [-0.9, 0.9]) straps.setMatrixAt(si++, m.makeTranslation(x, 0.02, z));
  }
  straps.count = si;
  scene.add(straps);

  // ---------- windows (the sky tips as the plane flies its hills) ----------
  const sky = skyTexture();
  const glass = new THREE.MeshBasicMaterial({ map: sky, fog: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.5 });
  for (const side of [-1, 1]) {
    for (let z = FRONT + 2.2; z < BACK - 1.5; z += 2.4) {
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), glass);
      win.position.set(side * (HALF_W - 0.02), 1.12, z);
      win.rotation.y = side * -Math.PI / 2;
      scene.add(win);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 28), frameMat);
      ring.position.copy(win.position);
      ring.rotation.y = win.rotation.y;
      scene.add(ring);
    }
  }

  // ---------- ceiling lights ----------
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  for (const x of [-0.55, 0.55]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, length - 2), lightMat);
    strip.position.set(x, CEIL_Y - 0.02, midZ);
    scene.add(strip);
  }
  // emergency strip along the floor (glows when the big lights are off)
  const exitMat = new THREE.MeshBasicMaterial({ color: '#5a2a12' });
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, length - 1), exitMat);
    strip.position.set(side * (HALF_W - 0.06), 0.03, midZ);
    scene.add(strip);
  }

  // ---------- flight sign on the front wall ----------
  const sign = screenTexture(512, 192);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: sign.texture, fog: false }));
  signMesh.position.set(0, 1.85, FRONT + 0.02);
  scene.add(signMesh);
  let signText = '';
  function setSign(text, sub, colour) {
    const key = text + sub + colour;
    if (key === signText) return;
    signText = key;
    const g = sign.ctx;
    g.fillStyle = '#14122e';
    g.fillRect(0, 0, sign.w, sign.h);
    g.strokeStyle = colour;
    g.lineWidth = 10;
    g.strokeRect(8, 8, sign.w - 16, sign.h - 16);
    g.fillStyle = colour;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 84px "Lilita One", system-ui, sans-serif';
    g.fillText(text, sign.w / 2, 78, sign.w - 40);
    g.fillStyle = '#fff3d6';
    g.font = '34px "Atkinson Hyperlegible", system-ui, sans-serif';
    g.fillText(sub, sign.w / 2, 148, sign.w - 40);
    sign.redraw();
  }
  setSign('READY', 'strap in for the first hill', '#ffc145');

  // ---------- toolbox ----------
  const toolbox = buildToolbox(scene);

  // ---------- machines ----------
  const machines = buildMachines(scene);
  animators.push((t, dt) => machines.update(t, dt));

  // ---------- oxygen masks ----------
  const masks = buildMasks(scene, hints);
  animators.push((t) => masks.update(t));

  // ---------- power panel on the back wall ----------
  const panel = buildPowerPanel(scene, hints);
  animators.push((t) => panel.update(t));

  // ---------- floating dust (so you can feel yourself drift) ----------
  const dust = buildDust(scene);
  animators.push((t, dt, camera) => dust.update(t, camera));

  let lightsOn = true;
  let pitch = 0;
  return {
    scene,
    toolbox,
    machines,
    masks,
    panel,
    setSign,
    setPitch(deg) {
      pitch = deg;
    },
    setLights(on) {
      lightsOn = on;
    },
    update(t, dt, camera) {
      // the horizon slides down the windows as the nose comes up
      sky.offset.y = 0.275 - (pitch / 90) * 0.32;
      // big lights fade, emergency strips glow
      const target = lightsOn ? 1 : 0.28;
      hemi.intensity += (1.6 * target - hemi.intensity) * Math.min(1, dt * 4);
      key.intensity += (1.1 * target - key.intensity) * Math.min(1, dt * 4);
      lightMat.color.setScalar(0.25 + 0.75 * (hemi.intensity / 1.6));
      emergency.intensity = lightsOn ? 0 : 3 + Math.sin(t * 3) * 0.6;
      exitMat.color.set(lightsOn ? '#5a2a12' : '#ff7a3a');
      for (const fn of animators) fn(t, dt, camera);
    },
    dispose() {
      disposeTree(scene);
    },
  };
}

function buildToolbox(scene) {
  const group = new THREE.Group();
  group.position.copy(TOOLBOX);
  scene.add(group);
  const orange = new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6, metalness: 0.4 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.42), orange);
  box.position.y = 0.17;
  group.add(box);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.16),
    new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'TOOLS', bg: '#2b2f38', w: 256, h: 80 }) }),
  );
  label.position.set(0, 0.18, 0.212);
  group.add(label);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.34, -0.21);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.44), orange);
  lid.position.z = 0.22;
  lidPivot.add(lid);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16, Math.PI), dark);
  handle.position.set(0, 0.03, 0.22);
  lidPivot.add(handle);
  group.add(lidPivot);
  // straps holding it to the floor
  for (const x of [-0.25, 0.25]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.46), new THREE.MeshStandardMaterial({ color: '#f2c230' }));
    strap.position.set(x, 0.17, 0);
    group.add(strap);
  }
  let open = 0;
  let target = 0;
  return {
    position: TOOLBOX,
    mouth: TOOLBOX.clone().add(new THREE.Vector3(0, 0.45, 0)),
    open() {
      target = 1;
    },
    update(dt) {
      open += (target - open) * Math.min(1, dt * 5);
      lidPivot.rotation.x = -open * 1.9;
    },
  };
}

// The oxygen masks: a ceiling box with three yellow cups on tubes and a soft glowing bubble.
function buildMasks(scene, hints) {
  const group = new THREE.Group();
  group.position.copy(MASKS);
  scene.add(group);
  const top = CEIL_Y - 0.08 - MASKS.y;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.5 }));
  box.position.y = top;
  group.add(box);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.2),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'OXYGEN', bg: '#1a6fb0', w: 320, h: 70 }), side: THREE.DoubleSide }),
  );
  sign.rotation.x = Math.PI / 2;
  sign.position.y = top - 0.065;
  group.add(sign);
  const cupMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.45, emissive: '#5a4300', emissiveIntensity: 0.5 });
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.2, transparent: true, opacity: 0.6 });
  const cups = [-0.32, 0, 0.32].map((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, top - 0.06, 0);
    group.add(pivot);
    const len = top - 0.55; // the cups hang just above your head
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), tubeMat);
    tube.position.y = -len / 2;
    pivot.add(tube);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.12, 16, 1, true), cupMat);
    cup.position.y = -len - 0.04;
    pivot.add(cup);
    return { pivot, phase: i * 1.7 };
  });
  const zoneMat = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const zone = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 14), zoneMat);
  group.add(zone);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.6, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.1;
  group.add(ring);
  const state = { active: false, low: false, powered: true };
  return {
    position: MASKS,
    state,
    update(t) {
      cups.forEach((c) => {
        c.pivot.rotation.z = Math.sin(t * 1.1 + c.phase) * 0.12;
        c.pivot.rotation.x = Math.cos(t * 0.9 + c.phase) * 0.1;
      });
      const on = state.powered;
      cupMat.emissiveIntensity = on ? 0.5 + (state.low ? 0.4 * Math.sin(t * 6) : 0) : 0;
      zone.visible = on;
      zoneMat.opacity = state.active ? 0.16 : (hints === 'more' ? 0.07 : 0.04) + (state.low ? 0.05 * Math.sin(t * 6) : 0);
      ringMat.opacity = on ? (state.low ? 0.6 + 0.35 * Math.sin(t * 6) : 0.45) : 0.1;
      ring.scale.setScalar(state.active ? 1 + 0.06 * Math.sin(t * 8) : 1);
    },
  };
}

function buildMachines(scene) {
  const metal = new THREE.MeshStandardMaterial({ color: '#aab3bd', roughness: 0.45, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });

  // Air machine: a vent high on the back wall with ribbons that flutter while it blows.
  const air = new THREE.Group();
  air.position.set(1.18, 1.9, BACK - 2.5);
  air.rotation.y = Math.PI / 2; // on the side wall, blowing into the cabin
  scene.add(air);
  const airBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.4), new THREE.MeshStandardMaterial({ color: '#1a6fb0', roughness: 0.5 }));
  air.add(airBox);
  const fan = new THREE.Group();
  fan.position.z = -0.21;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.01), metal);
    blade.rotation.z = (i * Math.PI) / 4;
    fan.add(blade);
  }
  air.add(fan);
  const airLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'AIR', bg: '#1a6fb0', w: 256, h: 52 }) }));
  airLabel.position.set(0, 0.28, -0.05);
  air.add(airLabel);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', side: THREE.DoubleSide });
  const ribbons = [-0.2, 0, 0.2].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.14, -0.22);
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.36), ribbonMat);
    ribbon.position.y = -0.18;
    pivot.add(ribbon);
    air.add(pivot);
    return pivot;
  });

  // Camera: films your science so it can be sent home.
  const cam = new THREE.Group();
  cam.position.set(-1.2, 2.0, FRONT + 0.45);
  cam.rotation.y = Math.PI + 0.15;
  scene.add(cam);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.42), dark);
  cam.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 18), metal);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.28;
  cam.add(lens);
  const recMat = new THREE.MeshBasicMaterial({ color: '#3a0d12' });
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), recMat);
  rec.position.set(0.12, 0.14, 0.15);
  cam.add(rec);
  const screen = screenTexture(256, 128);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: screen.texture, fog: false }));
  screenMesh.position.set(-0.55, 1.3, FRONT + 0.03); // below the flight sign, not on top of it
  scene.add(screenMesh);
  let screenKey = '';
  function drawScreen(pct, on) {
    const key = `${Math.floor(pct)}-${on}`;
    if (key === screenKey) return;
    screenKey = key;
    const g = screen.ctx;
    g.fillStyle = '#14122e';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = on ? '#5bd98a' : '#6c7681';
    g.font = 'bold 30px "Lilita One", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(on ? 'SENDING HOME' : 'CAMERA OFF', 128, 42);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(24, 70, 208, 30);
    g.fillStyle = '#5bd98a';
    g.fillRect(24, 70, 208 * Math.min(1, pct / 100), 30);
    g.fillStyle = '#fff3d6';
    g.font = '22px "Martian Mono", monospace';
    g.fillText(`${Math.floor(pct)}%`, 128, 93);
    screen.redraw();
  }
  drawScreen(0, false);

  // Snack fridge and music speaker: nice to have, but extras.
  const fridgeMat = new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.4, metalness: 0.2 });
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.45), fridgeMat);
  fridge.position.set(1.28, 0.4, BACK - 1.2);
  scene.add(fridge);
  const fridgeGlowMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff' });
  const fridgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), fridgeGlowMat);
  fridgeGlow.position.set(1.02, 0.62, BACK - 1.2);
  fridgeGlow.rotation.y = -Math.PI / 2;
  scene.add(fridgeGlow);
  const fridgeSign = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'SNACKS', bg: '#ff6fae', w: 256, h: 100 }) }));
  fridgeSign.position.set(1.02, 0.38, BACK - 1.2);
  fridgeSign.rotation.y = -Math.PI / 2;
  scene.add(fridgeSign);

  const speaker = new THREE.Group();
  speaker.position.set(-1.3, 0.35, BACK - 1.2);
  scene.add(speaker);
  speaker.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.36), dark));
  const coneMat = new THREE.MeshStandardMaterial({ color: '#8a5cff', roughness: 0.5 });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.05, 20), coneMat);
  cone.rotation.z = -Math.PI / 2;
  cone.position.x = 0.21;
  speaker.add(cone);
  const notes = buildNotes(scene, speaker.position.clone().add(new THREE.Vector3(0.2, 0.4, 0)));

  const state = { air: true, camera: false, fridge: true, music: true, upload: 0 };
  return {
    state,
    update(t, dt) {
      fan.rotation.z += (state.air ? 14 : 0) * dt;
      ribbons.forEach((p, i) => {
        p.rotation.x = state.air ? -0.9 - 0.35 * Math.sin(t * 9 + i * 2) : -0.05;
      });
      recMat.color.set(state.camera ? (Math.sin(t * 5) > 0 ? '#ff4d5e' : '#7a1a22') : '#3a0d12');
      drawScreen(state.upload, state.camera);
      fridgeGlowMat.color.set(state.fridge ? '#7fe0ff' : '#2b2f38');
      cone.scale.setScalar(state.music ? 1 + 0.12 * Math.max(0, Math.sin(t * 12)) : 1);
      notes.update(t, dt, state.music);
    },
  };
}

// Little music notes that float out of the speaker (only while it has power).
function buildNotes(scene, origin) {
  const mat = new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthWrite: false });
  const notes = Array.from({ length: 6 }, (_, i) => {
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.14);
    scene.add(s);
    return { s, life: i / 6 };
  });
  return {
    update(t, dt, on) {
      for (const n of notes) {
        n.life = (n.life + dt * 0.35) % 1;
        n.s.visible = on;
        n.s.position.set(origin.x + n.life * 0.5, origin.y + n.life * 0.6, origin.z + Math.sin(n.life * 9 + t) * 0.15);
        n.s.material.opacity = 1 - n.life;
      }
    },
  };
}

function noteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#8a5cff';
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♪', 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The power panel: one socket per machine. A gold plug sits in each socket that has power.
function buildPowerPanel(scene, hints) {
  const group = new THREE.Group();
  group.position.set(-0.15, 1.25, BACK - 0.06);
  group.rotation.y = Math.PI; // faces into the cabin (towards -z)
  scene.add(group);

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.62, 0.08), new THREE.MeshStandardMaterial({ color: '#23305c', roughness: 0.6 }));
  group.add(board);
  const header = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.2),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'POWER PANEL', bg: '#1b1846', fg: '#ffc145', w: 512, h: 58 }) }),
  );
  header.position.set(0, 0.62, 0.045);
  group.add(header);

  const overloadMat = new THREE.MeshBasicMaterial({ color: '#3a0d12' });
  const overload = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.12),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'TOO MANY MACHINES!', bg: '#ff4d5e', fg: '#fff3d6', w: 512, h: 40 }), transparent: true }),
  );
  overload.position.set(0, -0.75, 0.055); // under the bottom row of sockets, not behind them
  overload.visible = false;
  group.add(overload);
  void overloadMat;

  const plugMat = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.35, metalness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.6 });
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.9 });

  const colours = { air: '#1a6fb0', work: '#22955a', extra: '#5c6d7b' };
  const sockets = MACHINES.map((machine, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const local = new THREE.Vector3(-0.62 + col * 0.62, 0.17 - row * 0.62, 0.05);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.42),
      new THREE.MeshStandardMaterial({ map: plateTexture({ text: machine.label, sub: machine.sub, bg: colours[machine.kind] }), roughness: 0.6 }),
    );
    plate.position.copy(local);
    group.add(plate);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(local.x + 0.06, local.y + 0.28, 0.065);
    group.add(hole);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.12), plugMat);
    plug.position.set(local.x + 0.06, local.y + 0.28, 0.12);
    group.add(plug);
    const ledMat = new THREE.MeshBasicMaterial({ color: '#2b2f38' });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), ledMat);
    led.position.set(local.x - 0.08, local.y + 0.28, 0.07);
    group.add(led);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.37, 4, 1), ringMat);
    ring.rotation.z = Math.PI / 4;
    ring.scale.set(1, 0.92, 1);
    ring.position.set(local.x, local.y + 0.04, 0.07);
    group.add(ring);
    group.updateMatrixWorld(true);
    return {
      machine,
      position: group.localToWorld(local.clone()),
      plug,
      ledMat,
      ringMat,
      plugged: false,
      running: false,
      overloaded: false,
      aimed: false,
    };
  });

  // a gold beam over the panel so kids can find it (Part 2 only)
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    color: '#ffc145',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 1.2, 20, 1, true), beamMat);
  beam.position.set(-0.15, 0.6, BACK - 0.6);
  scene.add(beam);

  let hint = false;
  let overloadedNow = false;
  return {
    sockets,
    normal: new THREE.Vector3(0, 0, -1),
    setHint(on) {
      hint = on;
    },
    show({ plugged, power }) {
      overloadedNow = power.overloaded;
      overload.visible = power.overloaded;
      for (const s of sockets) {
        s.plugged = plugged.has(s.machine.id);
        s.overloaded = power.overloaded && s.plugged;
        s.running = s.plugged && !power.overloaded;
        s.plug.visible = s.plugged;
      }
    },
    update(t) {
      beamMat.opacity = hint ? (hints === 'more' ? 0.3 : 0.16) + 0.08 * Math.sin(t * 3) : 0;
      for (const s of sockets) {
        if (s.running) s.ledMat.color.set('#5bd98a');
        else if (s.overloaded) s.ledMat.color.set(Math.sin(t * 10) > 0 ? '#ff4d5e' : '#3a0d12');
        else s.ledMat.color.set('#2b2f38');
        s.ringMat.opacity = s.aimed ? 0.9 : 0;
      }
      overload.material.opacity = overloadedNow ? 0.65 + 0.35 * Math.sin(t * 8) : 0;
    },
  };
}

function buildDust(scene) {
  const count = 260;
  const size = new THREE.Vector3(3.2, 2.4, 10);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = Math.random() * size.x;
    base[i * 3 + 1] = Math.random() * size.y;
    base[i * 3 + 2] = Math.random() * size.z;
  }
  const positions = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ map: dotTexture(), color: '#ffd98a', size: 0.025, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  points.frustumCulled = false;
  scene.add(points);
  return {
    update(t, camera) {
      const c = camera.position;
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < 3; k++) {
          const s = size.getComponent(k);
          const cc = c.getComponent(k);
          let p = (base[i * 3 + k] + Math.sin(t * 0.2 + i) * 0.1 - cc) % s;
          if (p < -s / 2) p += s;
          if (p > s / 2) p -= s;
          positions[i * 3 + k] = cc + p;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
