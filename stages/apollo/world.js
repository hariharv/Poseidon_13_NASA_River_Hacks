// Moon Base Apollo, at the Moon's south pole. One unit = one metre.
// Inside: a long habitat module (x from -6 to 6). The big round window at the -x end looks out at
// Earth, low on the horizon. Power panel and radio on the left wall (-z), greenhouse and storm
// shelter on the right wall (+z), water tank and air machine by the window, airlock at the +x end.
// Outside: grey cratered ground, solar panels that follow the Sun, and a dark crater full of ice.

import * as THREE from 'three';
import { labelTexture, dotTexture } from '../hermes/textures.js';
import { disposeTree } from '../hermes/world.js';
import { plateTexture, screenTexture } from '../odysseus/textures.js';
import { MACHINES } from './sim.js';

export { disposeTree };

export const ROOM = { minX: -5.55, maxX: 5.55, minZ: -1.95, maxZ: 1.95, floor: 0, ceiling: 2.75 };
export const INSIDE_START = { pos: new THREE.Vector3(2.5, 0, 0), yaw: Math.PI / 2 }; // facing the window (-x)
export const OUTSIDE_START = { pos: new THREE.Vector3(9.6, 0, 0), yaw: -Math.PI / 2 }; // just out of the airlock, facing out (+x)
export const AIRLOCK_IN = new THREE.Vector3(5.9, 1.1, 0); // the door, seen from inside
export const AIRLOCK_OUT = new THREE.Vector3(8.35, 1.1, 0); // the door, seen from outside
export const SHELTER_SPOT = new THREE.Vector3(3.4, 0, 1.75);
export const SHELTER_EYE = new THREE.Vector3(3.4, 1.15, 1.95);
export const RADIO_SPOT = new THREE.Vector3(0.2, 1.0, -2.2);
export const CRATER = { x: 22, z: -13, r: 8, depth: 2.4 };
const BASE_FOOT = { minX: -6.4, maxX: 8.5, minZ: -2.8, maxZ: 2.8 };

// Height of the Moon's ground (flat around the base, gentle bumps, little craters, the big ice crater).
export function groundAt(x, z) {
  let h = Math.sin(x * 0.11) * 0.35 + Math.cos(z * 0.09 + 1) * 0.3 + Math.sin((x + z) * 0.23) * 0.12;
  for (const [cx, cz, cr, d] of SMALL_CRATERS) {
    const dd = Math.hypot(x - cx, z - cz) / cr;
    if (dd < 1.25) h += dd < 1 ? -d * (1 - dd * dd) : d * 0.6 * Math.sin(((dd - 1) / 0.25) * Math.PI);
  }
  const dc = Math.hypot(x - CRATER.x, z - CRATER.z) / CRATER.r;
  if (dc < 1.3) h += dc < 1 ? -CRATER.depth * (1 - dc * dc) : CRATER.depth * 0.35 * Math.sin(((dc - 1) / 0.3) * Math.PI);
  // flatten around the base so the floor sits on level ground
  const near = Math.max(0, 1 - Math.max(0, distToBase(x, z) - 1) / 6);
  return h * (1 - near);
}
const SMALL_CRATERS = [
  [-18, 14, 4, 0.8],
  [16, 18, 3, 0.6],
  [-25, -16, 5, 1.0],
  [34, 8, 3.5, 0.7],
  [-8, -28, 3, 0.5],
];
function distToBase(x, z) {
  const dx = Math.max(BASE_FOOT.minX - x, 0, x - BASE_FOOT.maxX);
  const dz = Math.max(BASE_FOOT.minZ - z, 0, z - BASE_FOOT.maxZ);
  return Math.hypot(dx, dz);
}
export function inBaseFootprint(x, z, pad = 0.4) {
  return x > BASE_FOOT.minX - pad && x < BASE_FOOT.maxX + pad && z > BASE_FOOT.minZ - pad && z < BASE_FOOT.maxZ + pad;
}

const SUN_DIR = new THREE.Vector3(0.75, 0.16, 0.64).normalize(); // low over the horizon, like at the south pole
const EARTH_DIR = new THREE.Vector3(-1, 0.09, 0.12).normalize(); // low over the horizon, out of the big window

export function buildWorld({ suit = 'orange', trays = 3, iceChunks = 6, hints = 'more' }) {
  void suit;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000004');
  const animators = [];

  // ---------- light ----------
  const sun = new THREE.DirectionalLight('#fff8ec', 3.2);
  sun.position.copy(SUN_DIR).multiplyScalar(60);
  scene.add(sun);
  const earthshine = new THREE.HemisphereLight('#8fb4ff', '#1a1a1e', 0.35);
  scene.add(earthshine);
  const cabin = new THREE.PointLight('#fff1d6', 9, 14, 1.2);
  cabin.position.set(0, 2.3, 0);
  scene.add(cabin);
  const cabin2 = new THREE.PointLight('#fff1d6', 5, 10, 1.3);
  cabin2.position.set(-4, 2.2, 0);
  scene.add(cabin2);
  const alarm = new THREE.PointLight('#ff3040', 0, 12, 1.2);
  alarm.position.set(0, 2.4, 0);
  scene.add(alarm);
  const flood = new THREE.SpotLight('#dfe9ff', 0, 40, 0.9, 0.5, 1.1);
  flood.position.set(8.5, 3.2, 0);
  flood.target.position.set(20, 0, -8);
  scene.add(flood, flood.target);

  // ---------- sky: stars, the Sun, Earth ----------
  scene.add(buildStars());
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#fff6d8', transparent: true, depthWrite: false, fog: false }));
  sunSprite.position.copy(SUN_DIR).multiplyScalar(700);
  sunSprite.scale.setScalar(90);
  scene.add(sunSprite);
  const earth = buildEarth(scene);
  animators.push((t) => earth.update(t));

  // ---------- the Moon's ground ----------
  const ground = buildGround(scene);
  const crater = buildIce(scene, iceChunks, hints);
  animators.push((t) => crater.update(t));

  // ---------- outside the base ----------
  const solar = buildSolar(scene);
  animators.push((t, dt) => solar.update(dt));
  buildExtras(scene);

  // ---------- the habitat ----------
  const hab = buildHabitat(scene);
  const panel = buildPowerPanel(scene, hints);
  animators.push((t) => panel.update(t));
  const radio = buildRadio(scene);
  animators.push((t, dt) => radio.update(t, dt));
  const greenhouse = buildGreenhouse(scene, trays);
  animators.push((t) => greenhouse.update(t));
  const tank = buildTank(scene);
  animators.push((t) => tank.update(t));
  const shelter = buildShelter(scene);
  animators.push((t) => shelter.update(t));

  // ---------- day, night, storm ----------
  let daylight = 1;
  let lightsOn = true;
  let alarmLevel = 0;
  let flashT = -1;
  return {
    scene,
    ground,
    crater,
    solar,
    hab,
    panel,
    radio,
    greenhouse,
    tank,
    shelter,
    setDaylight(v) {
      daylight = v;
    },
    setLights(on) {
      lightsOn = on;
    },
    setAlarm(level) {
      alarmLevel = level;
    },
    flash() {
      flashT = 0;
    },
    update(t, dt, camera) {
      sun.intensity = 3.2 * daylight;
      sunSprite.visible = daylight > 0.05;
      sunSprite.material.opacity = daylight;
      earthshine.intensity = 0.18 + 0.35 * daylight;
      flood.intensity = (1 - daylight) * 260;
      const target = lightsOn ? 1 : 0.35;
      cabin.intensity += (9 * target - cabin.intensity) * Math.min(1, dt * 4);
      cabin2.intensity += (5 * target - cabin2.intensity) * Math.min(1, dt * 4);
      hab.setLights(lightsOn);
      alarm.intensity = alarmLevel === 2 ? (Math.sin(t * 7) > 0 ? 14 : 3) : alarmLevel === 1 ? 2 + Math.sin(t * 3) * 1.5 : 0;
      alarm.color.set(alarmLevel === 1 ? '#ffb020' : '#ff3040');
      if (flashT >= 0) {
        flashT += dt;
        const k = Math.max(0, 1 - flashT / 0.9);
        sun.intensity += 30 * k;
        earthshine.intensity += 3 * k;
        if (flashT > 0.9) flashT = -1;
      }
      for (const fn of animators) fn(t, dt, camera);
    },
    dispose() {
      disposeTree(scene);
    },
  };
}

// ---------- stars ----------
function buildStars() {
  let seed = 31;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 2400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * 900, Math.abs(u) * 900 + 5, Math.sin(th) * s * 900], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTexture(), color: '#fff3d6', size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false }));
}

// ---------- Earth, low on the horizon (it never climbs high at the south pole) ----------
function buildEarth(scene) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#e9f6ff');
  sea.addColorStop(0.12, '#1d5fa8');
  sea.addColorStop(0.88, '#1d5fa8');
  sea.addColorStop(1, '#eef8ff');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const y = H * 0.2 + rand() * H * 0.6;
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 3 ? '#3f8a3c' : '#a38a52';
      g.beginPath();
      g.arc(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 22, 6 + rand() * 18, 0, Math.PI * 2);
      g.fill();
    }
  }
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.4})`;
    g.beginPath();
    g.ellipse(rand() * W, rand() * H, 10 + rand() * 30, 3 + rand() * 8, rand(), 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(26, 48, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: '#1d4f8a', emissiveIntensity: 0.25 }));
  earth.position.copy(EARTH_DIR).multiplyScalar(620);
  scene.add(earth);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(28.5, 48, 32),
    new THREE.MeshBasicMaterial({ color: '#6fb6ff', transparent: true, opacity: 0.25, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.copy(earth.position);
  scene.add(halo);
  return {
    position: earth.position,
    update(t) {
      earth.rotation.y = t * 0.03;
    },
  };
}

// ---------- the ground ----------
function buildGround(scene) {
  const size = 260;
  const seg = 160;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let seed = 4;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundAt(x, z) - 0.02);
    // permanently shadowed crater floor: much darker
    const dc = Math.hypot(x - CRATER.x, z - CRATER.z) / CRATER.r;
    const shade = dc < 0.85 ? 0.32 : dc < 1 ? 0.32 + (dc - 0.85) * 3 : 0.78 + rand() * 0.12;
    colors.set([shade, shade, shade * 1.02], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.floor(rand() * 90);
    g.fillStyle = `rgb(${v},${v},${v + 2})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = 'rgba(60,60,64,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(rand() * 256, rand() * 256, 2 + rand() * 9, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(70, 70);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
  scene.add(mesh);
  // boulders
  const rock = new THREE.MeshStandardMaterial({ color: '#8b8b90', roughness: 1 });
  for (let i = 0; i < 40; i++) {
    const x = (rand() - 0.5) * 120;
    const z = (rand() - 0.5) * 120;
    if (distToBase(x, z) < 6 || Math.hypot(x - CRATER.x, z - CRATER.z) < CRATER.r * 0.9) continue;
    const s = 0.2 + rand() * 0.9;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
    b.position.set(x, groundAt(x, z) + s * 0.4, z);
    b.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    scene.add(b);
  }
  return mesh;
}

// ---------- the dark crater with ice in it ----------
function buildIce(scene, count, hints) {
  const mat = new THREE.MeshStandardMaterial({ color: '#bfefff', roughness: 0.2, metalness: 0.1, emissive: '#3fb8ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.95 });
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const rr = CRATER.r * (0.25 + (i % 3) * 0.18);
    const x = CRATER.x + Math.cos(a) * rr;
    const z = CRATER.z + Math.sin(a) * rr;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i % 2) * 0.15, 0), mat);
    m.position.set(x, groundAt(x, z) + 0.35, z);
    m.rotation.set(i, i * 2, i * 3);
    scene.add(m);
    const glow = new THREE.PointLight('#5fd0ff', hints === 'more' ? 3 : 2, 4, 1.6);
    glow.position.copy(m.position).add(new THREE.Vector3(0, 0.6, 0));
    scene.add(glow);
    chunks.push({ mesh: m, glow, position: m.position.clone(), mined: false });
  }
  // a sign on the rim so you can find it
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'ICE CRATER', sub: 'always in shadow', bg: '#12305a', w: 360, h: 110 }), side: THREE.DoubleSide }));
  const sx = CRATER.x - CRATER.r * 1.25;
  const sz = CRATER.z + CRATER.r * 0.55;
  sign.position.set(sx, groundAt(sx, sz) + 1.4, sz);
  sign.lookAt(4, 1.4, 0);
  scene.add(sign);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), new THREE.MeshStandardMaterial({ color: '#9aa3ad' }));
  post.position.set(sx, groundAt(sx, sz) + 0.7, sz);
  scene.add(post);
  return {
    chunks,
    mine(chunk) {
      chunk.mined = true;
      chunk.mesh.visible = false;
      chunk.glow.visible = false;
    },
    update(t) {
      chunks.forEach((c, i) => {
        if (!c.mined) c.glow.intensity = (hints === 'more' ? 3 : 2) + Math.sin(t * 2 + i) * 0.8;
      });
    },
  };
}

// ---------- solar panels that turn to follow the Sun ----------
function buildSolar(scene) {
  const cells = solarTex();
  const mat = new THREE.MeshStandardMaterial({ map: cells, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide });
  const metal = new THREE.MeshStandardMaterial({ color: '#b9c2cb', roughness: 0.4, metalness: 0.6 });
  const towers = [[12, 9], [16, 7], [-12, 9]].map(([x, z]) => {
    const g = new THREE.Group();
    g.position.set(x, groundAt(x, z), z);
    scene.add(g);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 10), metal);
    mast.position.y = 3;
    g.add(mast);
    const head = new THREE.Group();
    head.position.y = 6;
    g.add(head);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3, 6.5), mat);
    head.add(panel);
    return head;
  });
  const look = new THREE.Vector3();
  return {
    update(dt) {
      towers.forEach((h) => {
        // stand up tall and face the low Sun
        look.copy(SUN_DIR).multiplyScalar(100).add(h.getWorldPosition(new THREE.Vector3()));
        h.lookAt(look);
      });
      void dt;
    },
  };
}
function solarTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a5c';
  g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#c99a3a';
  g.lineWidth = 2;
  for (let x = 0; x <= 128; x += 16) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  for (let y = 0; y <= 256; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(128, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- a rover, a mission flag, footprints ----------
function buildExtras(scene) {
  const white = new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.7 });
  const rover = new THREE.Group();
  rover.position.set(-9, groundAt(-9, 7), 7);
  rover.rotation.y = 0.6;
  scene.add(rover);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.6), white);
  body.position.y = 0.75;
  rover.add(body);
  for (const [x, z] of [[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.42, z);
    rover.add(w);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.2), dark);
  seat.position.set(-0.3, 1.2, 0);
  rover.add(seat);
  // the Olympus Academy mission flag (a stiff wire keeps it straight: there is no wind on the Moon)
  const fx = 12;
  const fz = 3.5;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#d7dde3', metalness: 0.6, roughness: 0.3 }));
  pole.position.set(fx, groundAt(fx, fz) + 1.3, fz);
  scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'OLYMPUS', sub: 'Academy · Moon Base', bg: '#1b1846', fg: '#ffc145', w: 300, h: 190 }), side: THREE.DoubleSide }));
  flag.position.set(fx + 0.78, groundAt(fx, fz) + 2.1, fz);
  scene.add(flag);
}

// ---------- the habitat module (inside and out) ----------
function buildHabitat(scene) {
  const wallMat = new THREE.MeshStandardMaterial({ color: '#e9e5da', roughness: 0.85, side: THREE.DoubleSide });
  const shellMat = new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.5, metalness: 0.1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#4a5566', roughness: 0.8 });
  const frame = new THREE.MeshStandardMaterial({ color: '#c9cfd6', roughness: 0.45, metalness: 0.4 });
  const L = 12;
  const W = 4.8;
  const H = 2.85;
  const add = (m, x, y, z) => {
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  // floor and ceiling
  add(new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, W), floorMat), 0, -0.05, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, W), wallMat), 0, H, 0);
  // the curved roof outside
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 + 0.1, W / 2 + 0.1, L + 0.2, 32, 1, false, 0, Math.PI), shellMat);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  add(roof, 0, H - 0.05, 0);
  // side walls with portholes
  const sideWall = (sign) => {
    const shape = new THREE.Shape();
    shape.moveTo(-L / 2, 0);
    shape.lineTo(L / 2, 0);
    shape.lineTo(L / 2, H);
    shape.lineTo(-L / 2, H);
    shape.lineTo(-L / 2, 0);
    for (const px of [-1.4, 4.6]) {
      const hole = new THREE.Path();
      hole.absarc(px, 1.75, 0.32, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), wallMat);
    m.position.set(0, 0, sign * (W / 2));
    scene.add(m);
    for (const px of [-1.4, 4.6]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 8, 28), frame);
      ring.position.set(px, 1.75, sign * (W / 2));
      scene.add(ring);
    }
  };
  sideWall(-1);
  sideWall(1);
  // the window end (-x): a big round window looking at Earth
  const endWall = (x, holeR, holeY) => {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0);
    shape.lineTo(W / 2, 0);
    shape.lineTo(W / 2, H);
    shape.lineTo(-W / 2, H);
    shape.lineTo(-W / 2, 0);
    if (holeR) {
      const hole = new THREE.Path();
      hole.absarc(0, holeY, holeR, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), wallMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(x, 0, 0);
    scene.add(m);
    return m;
  };
  endWall(-L / 2, 1.05, 1.5);
  const bigRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.09, 10, 48), frame);
  bigRing.rotation.y = Math.PI / 2;
  bigRing.position.set(-L / 2, 1.5, 0);
  scene.add(bigRing);
  // the airlock end (+x) with its door, and the airlock room outside it
  endWall(L / 2, 0, 0);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 1.3), new THREE.MeshStandardMaterial({ color: '#8a96a6', roughness: 0.4, metalness: 0.5 }));
  door.position.set(L / 2 - 0.07, 1.05, 0);
  scene.add(door);
  const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.26), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'AIRLOCK', bg: '#c98a10', fg: '#1b1846', w: 300, h: 72 }) }));
  doorSign.rotation.y = -Math.PI / 2;
  doorSign.position.set(L / 2 - 0.14, 2.35, 0);
  scene.add(doorSign);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.6, 2.4), shellMat);
  lock.position.set(L / 2 + 1.25, 1.3, 0);
  scene.add(lock);
  const outDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 1.2), new THREE.MeshStandardMaterial({ color: '#8a96a6', roughness: 0.4, metalness: 0.5 }));
  outDoor.position.set(L / 2 + 2.42, 1.0, 0);
  scene.add(outDoor);
  const outSign = doorSign.clone();
  outSign.material = doorSign.material;
  outSign.rotation.y = Math.PI / 2;
  outSign.position.set(L / 2 + 2.49, 2.25, 0);
  scene.add(outSign);
  // an antenna dish on the roof, pointing at Earth (that's how the radio reaches home)
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshStandardMaterial({ color: '#f4f5f7', roughness: 0.4, side: THREE.DoubleSide }));
  dish.position.set(-3.5, H + 2.6, 0);
  dish.lookAt(dish.position.clone().add(EARTH_DIR.clone().negate()));
  scene.add(dish);
  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), frame);
  dishMast.position.set(-3.5, H + 1.3, 0);
  scene.add(dishMast);
  // a name on the outside
  const name = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.6), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'MOON BASE APOLLO', bg: '#1b1846', fg: '#ffc145', w: 520, h: 76 }), side: THREE.FrontSide }));
  name.position.set(1, 2.1, W / 2 + 0.02);
  scene.add(name);
  // ceiling light strips
  const strip = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  for (const z of [-0.8, 0.8]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(L - 1.5, 0.03, 0.14), strip);
    s.position.set(0, H - 0.04, z);
    scene.add(s);
  }
  // handrails and a little rug of floor stripes
  const rail = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 });
  for (const z of [-2.3, 2.3]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(L - 1, 0.05, 0.05), rail);
    r.position.set(0, 1.0, z);
    scene.add(r);
  }
  return {
    setLights(on) {
      strip.color.set(on ? '#fffbe8' : '#4a4634');
    },
  };
}

// ---------- power panel (left wall) ----------
function buildPowerPanel(scene, hints) {
  const group = new THREE.Group();
  group.position.set(-3.1, 1.25, -2.36);
  scene.add(group);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.55, 0.06), new THREE.MeshStandardMaterial({ color: '#23305c', roughness: 0.6 })));
  const header = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'POWER PANEL', bg: '#1b1846', fg: '#ffc145', w: 512, h: 58 }) }));
  header.position.set(0, 0.66, 0.035);
  group.add(header);
  const overload = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.13),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'TOO MANY MACHINES!', bg: '#ff4d5e', fg: '#fff3d6', w: 512, h: 42 }), transparent: true }),
  );
  overload.position.set(0, -0.69, 0.035);
  overload.visible = false;
  group.add(overload);
  const plugMat = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.35, metalness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.6 });
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.9 });
  const colours = { air: '#1a6fb0', work: '#22955a', extra: '#5c6d7b' };
  const spots = [[-0.6, 0.2], [0, 0.2], [0.6, 0.2], [-0.3, -0.38], [0.3, -0.38]];
  const sockets = MACHINES.map((machine, i) => {
    const local = new THREE.Vector3(spots[i][0], spots[i][1], 0.04);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.36), new THREE.MeshStandardMaterial({ map: plateTexture({ text: machine.label, sub: machine.sub, bg: machine.id === 'heater' ? '#c2502a' : colours[machine.kind] }), roughness: 0.6 }));
    plate.position.copy(local);
    group.add(plate);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(local.x + 0.06, local.y + 0.24, 0.05);
    group.add(hole);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), plugMat);
    plug.position.set(local.x + 0.06, local.y + 0.24, 0.09);
    group.add(plug);
    const ledMat = new THREE.MeshBasicMaterial({ color: '#2b2f38' });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), ledMat);
    led.position.set(local.x - 0.07, local.y + 0.24, 0.06);
    group.add(led);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.35, 4, 1), ringMat);
    ring.rotation.z = Math.PI / 4;
    ring.scale.set(1, 0.9, 1);
    ring.position.set(local.x, local.y + 0.03, 0.06);
    group.add(ring);
    group.updateMatrixWorld(true);
    return { machine, position: group.localToWorld(local.clone()), plug, ledMat, ringMat, plugged: false, running: false, overloaded: false, aimed: false };
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.75), glowMat);
  glow.position.z = -0.02;
  group.add(glow);
  let hint = false;
  let overloadedNow = false;
  return {
    sockets,
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
      glowMat.opacity = hint ? (hints === 'more' ? 0.35 : 0.2) + 0.15 * Math.sin(t * 4) : 0;
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

// ---------- the radio (left wall): call Earth and watch your message cross space ----------
function buildRadio(scene) {
  const group = new THREE.Group();
  group.position.set(0.2, 0, -2.0);
  scene.add(group);
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.7), dark);
  desk.position.set(0, 0.85, 0);
  group.add(desk);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.05), dark);
  legs.position.set(0, 0.42, -0.3);
  group.add(legs);
  const screen = screenTexture(512, 256);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshBasicMaterial({ map: screen.texture }));
  face.position.set(0, 1.55, -0.33);
  group.add(face);
  const btnMat = new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.4, emissive: '#5a1800', emissiveIntensity: 0.4 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.07, 24), btnMat);
  btn.position.set(0.45, 0.92, 0.05);
  group.add(btn);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'CALL EARTH', bg: '#1b1846', fg: '#ffc145', w: 300, h: 68 }) }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(-0.25, 0.895, 0.1);
  group.add(label);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.25, 12), dark);
  mic.position.set(-0.55, 1.0, -0.05);
  group.add(mic);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 24), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(btn.position).add(new THREE.Vector3(0, 0.05, 0));
  group.add(ring);
  group.updateMatrixWorld(true);
  let state = { mode: 'idle', k: 0, text: 'Mission Control is listening', ready: true, powered: true };
  let drawn = '';
  function draw() {
    const key = `${state.mode}${Math.round(state.k * 40)}${state.text}${state.ready}${state.powered}`;
    if (key === drawn) return;
    drawn = key;
    const g = screen.ctx;
    g.fillStyle = '#0d0b26';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = state.powered ? '#46b4ff' : '#6c7681';
    g.font = 'bold 34px "Lilita One", system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(state.powered ? 'RADIO · EARTH LINK' : 'RADIO · NO POWER', 22, 44);
    // Moon (left) and Earth (right), with the signal dot travelling between them
    g.fillStyle = '#c9c9cf';
    g.beginPath();
    g.arc(60, 140, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2f6fd0';
    g.beginPath();
    g.arc(452, 140, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5bd98a';
    g.beginPath();
    g.arc(446, 128, 12, 0, Math.PI * 2);
    g.fill();
    g.setLineDash([6, 8]);
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(92, 140);
    g.lineTo(414, 140);
    g.stroke();
    g.setLineDash([]);
    if (state.mode === 'up' || state.mode === 'down') {
      const x = state.mode === 'up' ? 92 + state.k * 322 : 414 - state.k * 322;
      g.fillStyle = '#ffc145';
      g.beginPath();
      g.arc(x, 140, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff3d6';
    g.font = '24px "Atkinson Hyperlegible", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(state.text, 256, 220);
    screen.redraw();
  }
  draw();
  return {
    position: group.localToWorld(btn.position.clone()),
    set(next) {
      state = { ...state, ...next };
    },
    setAimed(on) {
      ringMat.opacity = on ? 0.9 : 0;
    },
    update(t) {
      btnMat.emissiveIntensity = state.ready && state.powered ? 0.4 + 0.4 * Math.sin(t * 4) : 0.05;
      draw();
    },
  };
}

// ---------- the greenhouse (right wall): three trays of plants under grow lights ----------
function buildGreenhouse(scene, trays) {
  const group = new THREE.Group();
  group.position.set(-2.4, 0, 2.0);
  scene.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.6 });
  const soil = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 });
  const rack = new THREE.Mesh(new THREE.BoxGeometry(trays * 1.15 + 0.3, 0.06, 0.65), metal);
  rack.position.y = 0.9;
  group.add(rack);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'GREENHOUSE', bg: '#1d3a35', fg: '#5bd98a', w: 420, h: 58 }) }));
  sign.rotation.y = Math.PI;
  sign.position.set(0, 2.25, 0.33);
  group.add(sign);
  const lightBarMat = new THREE.MeshBasicMaterial({ color: '#2a1838' });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(trays * 1.15, 0.05, 0.25), lightBarMat);
  bar.position.y = 1.85;
  group.add(bar);
  const glowLight = new THREE.PointLight('#c070ff', 0, 3.5, 1.4);
  glowLight.position.set(0, 1.6, -0.1);
  group.add(glowLight);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#5bd98a', roughness: 0.6 });
  const frostMat = new THREE.MeshStandardMaterial({ color: '#cfefff', roughness: 0.3, emissive: '#5a8ab0', emissiveIntensity: 0.3 });
  const fruitMat = new THREE.MeshStandardMaterial({ color: '#ff5b4d', roughness: 0.4 });
  const list = [];
  for (let i = 0; i < trays; i++) {
    const x = (i - (trays - 1) / 2) * 1.15;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.5), metal);
    tray.position.set(x, 0.99, 0);
    group.add(tray);
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.42), soil);
    dirt.position.set(x, 1.07, 0);
    group.add(dirt);
    const plants = new THREE.Group();
    plants.position.set(x, 1.09, 0);
    group.add(plants);
    const leaves = [];
    const fruits = [];
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Group();
      p.position.set(-0.3 + k * 0.2, 0, (k % 2) * 0.12 - 0.06);
      plants.add(p);
      for (let j = 0; j < 4; j++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), leafMat);
        leaf.scale.set(1.5, 0.45, 0.8);
        leaf.position.set(Math.cos(j * 1.6) * 0.06, 0.08 + j * 0.06, Math.sin(j * 1.6) * 0.06);
        leaf.rotation.y = j * 1.6;
        p.add(leaf);
        leaves.push(leaf);
      }
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), fruitMat);
      fruit.position.set(0.05, 0.2, 0.05);
      p.add(fruit);
      fruits.push(fruit);
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.55, 4, 1), ringMat);
    ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    ring.scale.set(1.25, 0.6, 1);
    ring.position.set(x, 1.15, 0);
    group.add(ring);
    group.updateMatrixWorld(true);
    list.push({ index: i, position: group.localToWorld(new THREE.Vector3(x, 1.1, 0)), plants, leaves, fruits, ringMat, growth: 0, frozen: false, aimed: false });
  }
  let lit = false;
  return {
    trays: list,
    setLit(on) {
      lit = on;
    },
    update(t) {
      lightBarMat.color.set(lit ? '#d58bff' : '#2a1838');
      glowLight.intensity = lit ? 4 + Math.sin(t * 2) * 0.3 : 0;
      for (const tr of list) {
        const g = Math.max(0, Math.min(1, tr.growth));
        tr.plants.scale.setScalar(0.25 + g * 0.95);
        tr.leaves.forEach((l) => (l.material = tr.frozen ? frostMat : leafMat));
        tr.fruits.forEach((f) => (f.visible = g >= 1));
        tr.ringMat.opacity = tr.aimed ? 0.9 : g >= 1 ? 0.35 + 0.3 * Math.sin(t * 4) : 0;
      }
    },
  };
}

// ---------- water tank + air machine (by the window) ----------
function buildTank(scene) {
  const group = new THREE.Group();
  group.position.set(-5.0, 0, -1.4);
  scene.add(group);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
  glass.position.y = 1.05;
  group.add(glass);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3fa2ff', transparent: true, opacity: 0.8, roughness: 0.1, emissive: '#0f4f9a', emissiveIntensity: 0.4 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 1, 24), waterMat);
  group.add(water);
  const cap = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.6 });
  for (const y of [0.08, 2.02]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 24), cap);
    c.position.y = y;
    group.add(c);
  }
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'WATER', bg: '#1a6fb0', w: 256, h: 64 }) }));
  label.position.set(0, 2.25, 0.3);
  label.rotation.y = Math.PI / 2;
  group.add(label);
  // the air machine next to it, with ribbons that flutter while it makes oxygen
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.6), new THREE.MeshStandardMaterial({ color: '#1a6fb0', roughness: 0.5 }));
  box.position.set(0, 0.5, 1.0);
  group.add(box);
  const airLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'AIR MACHINE', bg: '#1a6fb0', w: 300, h: 70 }) }));
  airLabel.rotation.y = Math.PI / 2;
  airLabel.position.set(0.36, 0.85, 1.0);
  group.add(airLabel);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', side: THREE.DoubleSide });
  const ribbons = [-0.18, 0, 0.18].map((z) => {
    const p = new THREE.Group();
    p.position.set(0.36, 0.55, 1.0 + z);
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.28), ribbonMat);
    rb.rotation.y = Math.PI / 2;
    rb.position.y = -0.14;
    p.add(rb);
    group.add(p);
    return p;
  });
  let level = 0.5;
  let making = true;
  return {
    setLevel(fraction) {
      level = Math.max(0, Math.min(1, fraction));
    },
    setMaking(on) {
      making = on;
    },
    update(t) {
      const h = Math.max(0.02, level * 1.8);
      water.scale.y = h;
      water.position.y = 0.14 + h / 2;
      waterMat.emissiveIntensity = level < 0.2 ? 0.4 + 0.4 * Math.sin(t * 6) : 0.4;
      waterMat.color.set(level < 0.2 ? '#ff7a5a' : '#3fa2ff');
      ribbons.forEach((p, i) => (p.rotation.z = making ? -0.9 - 0.35 * Math.sin(t * 9 + i * 2) : -0.05));
    },
  };
}

// ---------- the storm shelter (right wall): a cubby walled with water bags ----------
function buildShelter(scene) {
  const group = new THREE.Group();
  group.position.set(3.4, 0, 2.0);
  scene.add(group);
  const bagMat = new THREE.MeshStandardMaterial({ color: '#2f78c8', roughness: 0.6, emissive: '#0a2a55', emissiveIntensity: 0.3 });
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.7), bagMat);
      bag.position.set(side * 1.0, 0.22 + i * 0.4, 0);
      group.add(bag);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.75), bagMat);
  roof.position.set(0, 2.5, 0);
  group.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.3), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'STORM SHELTER', sub: 'water blocks radiation', bg: '#7a1a22', fg: '#fff3d6', w: 460, h: 90 }), side: THREE.DoubleSide }));
  sign.rotation.y = Math.PI;
  sign.position.set(0, 2.85 - 0.25, -0.4);
  group.add(sign);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ff4d5e', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), glowMat);
  glow.rotation.y = Math.PI;
  glow.position.set(0, 1.15, -0.36);
  group.add(glow);
  let hint = false;
  return {
    position: SHELTER_SPOT,
    setHint(on) {
      hint = on;
    },
    update(t) {
      glowMat.opacity = hint ? 0.18 + 0.14 * Math.sin(t * 6) : 0;
    },
  };
}
