// The robot-arm lab: a copy of the space station's Cupola window with the robot arm outside,
// a cargo ship with three science boxes, and the experiment platform with three coloured slots.
// Inside you float around a little lab module: the arm controls at the window, the power panel
// on the left wall, the science bench on the right wall. Earth turns below, day and night.
// One unit = one metre. The window looks out along -z.

import * as THREE from 'three';
import { labelTexture, dotTexture } from '../hermes/textures.js';
import { disposeTree } from '../hermes/world.js';
import { suitColour } from '../hermes/arms.js';
import { plateTexture, screenTexture } from '../odysseus/textures.js';
import { MACHINES, EXPERIMENTS, solveArm } from './sim.js';

export { disposeTree };

export const EYE = new THREE.Vector3(0, 0, 0.35); // sitting at the arm controls
export const FLOAT_START = new THREE.Vector3(0, 0.15, 2.9); // floating in the middle of the lab
export const ROOM = { minX: -1.95, maxX: 1.95, minY: -1.3, maxY: 1.35, minZ: -0.55, maxZ: 4.75 };
// Solid things inside the lab you bump into instead of floating through: the arm desk under the
// window (top, front panel and the arm-camera screen on its right).
export const SOLIDS = [
  { min: { x: -1.3, y: -1.7, z: -1.2 }, max: { x: 1.3, y: -0.88, z: -0.34 } }, // desk
  { min: { x: 0.65, y: -0.9, z: -1.1 }, max: { x: 1.4, y: -0.42, z: -0.62 } }, // arm camera screen
];
export const DESK_SPOT = new THREE.Vector3(0, -0.75, -0.65); // look here and press E to sit
export const ARM_BASE = new THREE.Vector3(0, -2.2, -11.2); // the shoulder joint, at the back of the deck
export const L1 = 4.0; // shoulder to elbow
export const L2 = 3.8; // elbow to wrist
export const TIP = 0.75; // wrist to the grabber's tip
export const DECK_Y = -3.0;
export const BOX_HALF = new THREE.Vector3(0.5, 0.36, 0.38);
const ROWS = [-7.4, -8.7, -10.0]; // one row per experiment, front to back
const PALLET_TOP = DECK_Y + 0.12;
const PLATFORM_TOP = DECK_Y + 0.24;
export const BOX_HOMES = ROWS.map((z) => new THREE.Vector3(-5.6, PALLET_TOP + BOX_HALF.y, z));
export const SLOTS = ROWS.map((z) => new THREE.Vector3(5.6, PLATFORM_TOP + BOX_HALF.y, z));
export const STOW = new THREE.Vector3(0, -1.35, -8.7); // park the arm here when space junk is coming
export const HAND_START = new THREE.Vector3(0, -1.0, -8.2); // where the grabber's tip starts
const BOX_HOME = BOX_HOMES[1]; // (used by the cargo pallet)

export function buildWorld({ hints = 'more', suit = 'orange', boxes = 3 }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  const animators = [];

  // ---------- light ----------
  const sun = new THREE.DirectionalLight('#fff6e6', 2.6);
  sun.position.set(-40, 60, -30);
  scene.add(sun);
  const ambient = new THREE.HemisphereLight('#9fc4ff', '#0b1430', 0.55);
  scene.add(ambient);
  const cabin = new THREE.PointLight('#fff1d6', 7, 9, 1.3);
  cabin.position.set(0, 1.1, 1.8);
  scene.add(cabin);
  const flood = new THREE.SpotLight('#dfe9ff', 0, 30, 0.8, 0.5, 1.2);
  flood.position.set(0, 2, -3);
  flood.target.position.set(0, DECK_Y, -8.6);
  scene.add(flood, flood.target);

  // ---------- space: stars, the Sun, Earth ----------
  scene.add(buildStars());
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#fff3c4', transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.setScalar(120);
  scene.add(sunSprite);
  const earth = buildEarth(scene);
  animators.push((t, dt) => earth.update(t, dt));

  // ---------- outside the station ----------
  buildOutside(scene);
  const arm = buildArm(scene);
  const exps = EXPERIMENTS.slice(0, boxes);
  const scienceBoxes = exps.map((e, i) => buildScienceBox(scene, e, BOX_HOMES[i]));
  animators.push((t) => scienceBoxes.forEach((b) => b.update(t)));
  const platform = buildPlatform(scene, exps, hints);
  animators.push((t) => platform.update(t));
  const tipMarker = buildTipMarker(scene, hints);
  const stow = buildStow(scene);
  animators.push((t) => stow.update(t));
  const debris = buildDebris(scene);
  animators.push((t, dt) => debris.update(dt));

  // ---------- inside the lab ----------
  const inside = buildInside(scene, suit);
  const panel = buildPowerPanel(scene, hints);
  animators.push((t) => panel.update(t));
  const bench = buildBench(scene, exps, hints);
  animators.push((t) => bench.update(t));

  // ---------- day and night ----------
  const sunDir = new THREE.Vector3();
  let light = 1; // 1 = full sunlight, 0 = Earth's shadow
  let lightsOn = true;
  function setOrbit({ side, k }) {
    // high and behind you for most of the day (so the deck is lit), then it swings round
    // into the window and sets behind Earth's edge
    const elev = side === 'day' ? 62 - 80 * k * k : -40;
    const az = side === 'day' ? THREE.MathUtils.lerp(150, 25, k * k) : 25;
    const e = THREE.MathUtils.degToRad(elev);
    const a = THREE.MathUtils.degToRad(az);
    sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    sunSprite.position.copy(sunDir).multiplyScalar(820);
    sun.position.copy(sunDir).multiplyScalar(80);
    light = side === 'day' ? THREE.MathUtils.clamp((elev + 12) / 10, 0, 1) : 0;
  }

  return {
    scene,
    arm,
    boxes: scienceBoxes,
    platform,
    panel,
    bench,
    inside,
    tipMarker,
    stow,
    debris,
    setOrbit,
    setLights(on) {
      lightsOn = on;
    },
    update(t, dt, camera) {
      const warm = light < 1 && light > 0 ? 1 - Math.abs(light - 0.5) * 2 : 0; // sunset glow
      sun.intensity = 2.6 * light;
      sun.color.setRGB(1, 0.96 - warm * 0.35, 0.9 - warm * 0.55);
      sunSprite.material.color.setRGB(1, 0.95 - warm * 0.4, 0.75 - warm * 0.5);
      ambient.intensity = 0.22 + 0.7 * light;
      earth.setLight(light);
      flood.intensity = (1 - light) * 120;
      cabin.intensity += ((lightsOn ? 7 : 1.2) - cabin.intensity) * Math.min(1, dt * 4);
      inside.setLights(lightsOn);
      for (const fn of animators) fn(t, dt, camera);
    },
    dispose() {
      disposeTree(scene);
    },
  };
}

// ---------- stars ----------
function buildStars() {
  let seed = 21;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 1600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * 1500, Math.abs(u) * 1500 * (u > -0.3 ? 1 : -1), Math.sin(th) * s * 1500], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTexture(), color: '#fff3d6', size: 6, sizeAttenuation: true, transparent: true, depthWrite: false }));
}

// ---------- Earth: oceans, land, clouds, and city lights on the night side ----------
function buildEarth(scene) {
  const W = 1024;
  const H = 512;
  let seed = 5;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blobs = Array.from({ length: 34 }, () => ({ x: rand() * W, y: H * 0.18 + rand() * H * 0.64, r: 20 + rand() * 70 }));

  const land = document.createElement('canvas');
  land.width = W;
  land.height = H;
  const g = land.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#dff3ff');
  sea.addColorStop(0.12, '#1d5fa8');
  sea.addColorStop(0.5, '#0f4f9a');
  sea.addColorStop(0.88, '#1d5fa8');
  sea.addColorStop(1, '#eef8ff');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  for (const b of blobs) {
    for (let i = 0; i < 7; i++) {
      g.fillStyle = i % 3 ? '#3f8a3c' : '#a38a52';
      g.beginPath();
      g.arc(b.x + (rand() - 0.5) * b.r * 1.4, b.y + (rand() - 0.5) * b.r, b.r * (0.35 + rand() * 0.5), 0, Math.PI * 2);
      g.fill();
    }
  }
  const city = document.createElement('canvas');
  city.width = W;
  city.height = H;
  const c = city.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  for (const b of blobs) {
    for (let i = 0; i < 28; i++) {
      c.fillStyle = `rgba(255, ${200 + rand() * 40}, 120, ${0.5 + rand() * 0.5})`;
      c.fillRect(b.x + (rand() - 0.5) * b.r * 1.4, b.y + (rand() - 0.5) * b.r, 2 + rand() * 2, 2 + rand() * 2);
    }
  }
  const clouds = document.createElement('canvas');
  clouds.width = W;
  clouds.height = H;
  const k = clouds.getContext('2d');
  for (let i = 0; i < 260; i++) {
    k.fillStyle = `rgba(255,255,255,${0.12 + rand() * 0.3})`;
    k.beginPath();
    k.ellipse(rand() * W, rand() * H, 18 + rand() * 60, 6 + rand() * 16, rand(), 0, Math.PI * 2);
    k.fill();
  }

  const tex = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  const landMap = tex(land);
  const cityMap = tex(city);
  const cloudMap = tex(clouds);

  const R = 620;
  const centre = new THREE.Vector3(0, -R - 46, -260);
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.MeshStandardMaterial({ map: landMap, emissiveMap: cityMap, emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.9 }),
  );
  ground.position.copy(centre);
  scene.add(ground);
  const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(R + 2.5, 96, 64), new THREE.MeshStandardMaterial({ map: cloudMap, transparent: true, depthWrite: false, roughness: 1 }));
  cloudShell.position.copy(centre);
  scene.add(cloudShell);
  const airMat = new THREE.MeshBasicMaterial({ color: '#5fb4ff', transparent: true, opacity: 0.28, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const air = new THREE.Mesh(new THREE.SphereGeometry(R + 16, 96, 64), airMat);
  air.position.copy(centre);
  scene.add(air);

  return {
    setLight(l) {
      ground.material.emissiveIntensity = (1 - l) * 1.4;
      airMat.opacity = 0.08 + 0.22 * l;
    },
    update(t, dt) {
      // the station races around Earth, so the ground slides past underneath
      ground.rotation.x += dt * 0.004;
      cloudShell.rotation.x += dt * 0.0046;
    },
  };
}

// ---------- the station outside: truss, deck, cargo ship ----------
function buildOutside(scene) {
  const white = new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.55, metalness: 0.1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.4, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });

  // the deck everything is mounted on (a wide truss segment)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 5), metal);
  deck.position.set(0, DECK_Y - 0.15, -8.6);
  scene.add(deck);
  const grid = new THREE.GridHelper(22, 22, '#5c6d7b', '#5c6d7b');
  grid.scale.set(1, 1, 5 / 22);
  grid.position.set(0, DECK_Y + 0.005, -8.6);
  scene.add(grid);
  const truss = new THREE.Mesh(new THREE.BoxGeometry(40, 1.2, 1.2), white);
  truss.position.set(0, DECK_Y - 1.2, -11.6);
  scene.add(truss);
  // solar wings far off to each side
  const solar = new THREE.MeshStandardMaterial({ map: solarTex(), roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  for (const x of [-26, 26]) {
    for (const z of [-15, -8]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), solar);
      wing.rotation.x = -Math.PI / 2 + 0.35;
      wing.position.set(x, DECK_Y - 1.2, z - 3);
      scene.add(wing);
    }
  }

  // the cargo ship on the left, gold foil like Japan's HTV
  const gold = new THREE.MeshStandardMaterial({ color: '#d99a2b', roughness: 0.5, metalness: 0.2 }); // no shiny metal: nothing out here to reflect
  const ship = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6, 32), gold);
  ship.rotation.z = Math.PI / 2;
  ship.position.set(-12.6, DECK_Y + 1.6, -9.4);
  scene.add(ship);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 1, 32), white);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(-9.1, DECK_Y + 1.6, -9.4);
  scene.add(nose);
  const shipLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'CARGO', sub: 'supply ship', bg: '#1b1846', w: 300, h: 120 }), roughness: 0.6 }));
  shipLabel.position.set(-12.6, DECK_Y + 1.8, -7.38);
  scene.add(shipLabel);
  // its open pallet, where the science box rides
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 4.4), dark);
  pallet.position.set(BOX_HOME.x, DECK_Y + 0.06, BOX_HOME.z);
  scene.add(pallet);
  void white;
  return { deck };
}

function solarTex() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the robot arm (shoulder turns and tips, elbow bends, wrist keeps the grabber pointing down) ----------
function buildArm(scene) {
  const white = new THREE.MeshStandardMaterial({ color: '#eef1f4', roughness: 0.5, metalness: 0.1 });
  const joint = new THREE.MeshStandardMaterial({ color: '#b9c2cb', roughness: 0.35, metalness: 0.7 });
  const band = new THREE.MeshStandardMaterial({ color: '#1a6fb0', roughness: 0.5 });

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, ARM_BASE.y - DECK_Y, 20), joint);
  pedestal.position.set(ARM_BASE.x, (ARM_BASE.y + DECK_Y) / 2, ARM_BASE.z);
  scene.add(pedestal);

  const yawG = new THREE.Group();
  yawG.position.copy(ARM_BASE);
  scene.add(yawG);
  yawG.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), joint));
  const shoulderG = new THREE.Group();
  yawG.add(shoulderG);
  const boom = (len) => {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, len, 18), white);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -len / 2;
    g.add(tube);
    for (const f of [0.2, 0.8]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.18, 18), band);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = -len * f;
      g.add(ring);
    }
    return g;
  };
  shoulderG.add(boom(L1));
  const elbowG = new THREE.Group();
  elbowG.position.z = -L1;
  shoulderG.add(elbowG);
  elbowG.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), joint));
  elbowG.add(boom(L2));
  const wristG = new THREE.Group();
  wristG.position.z = -L2;
  elbowG.add(wristG);
  wristG.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), joint));
  // the grabber (end effector), pointing along the wrist's -z
  const eff = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, TIP, 18), joint);
  eff.rotation.x = Math.PI / 2;
  eff.position.z = -TIP / 2;
  wristG.add(eff);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff7c2' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lampMat);
  lamp.position.set(0.2, 0.18, -TIP * 0.6);
  wristG.add(lamp);

  const wrist = new THREE.Vector3();
  return {
    // put the grabber's tip at `tip` (world)
    reach(tip) {
      wrist.set(tip.x - ARM_BASE.x, tip.y + TIP - ARM_BASE.y, tip.z - ARM_BASE.z);
      const a = solveArm(wrist, L1, L2);
      yawG.rotation.y = -a.yaw;
      shoulderG.rotation.x = a.shoulder;
      elbowG.rotation.x = -a.elbow;
      wristG.rotation.x = -Math.PI / 2 - (a.shoulder - a.elbow); // grabber straight down
    },
    setPower(on) {
      lampMat.color.set(on ? '#fff7c2' : '#3a3f48');
    },
  };
}

// A ring on the deck straight under the grabber, so you can judge how far away it is.
function buildTipMarker(scene, hints) {
  const mat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 32), mat);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  const lineMat = new THREE.LineDashedMaterial({ color: '#7fe0ff', dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: hints === 'more' ? 0.7 : 0.4 });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]);
  const line = new THREE.Line(lineGeo, lineMat);
  line.frustumCulled = false; // its bounds change every frame, so never cull it
  // always drawn on top, so the ring still shows when it's under the pallet or the platform
  ring.renderOrder = 8;
  mat.depthTest = false;
  ring.visible = line.visible = false; // until the arm's hand has a position
  scene.add(line);
  return {
    update(tip, groundY) {
      ring.visible = line.visible = true;
      ring.position.set(tip.x, groundY + 0.02, tip.z);
      lineGeo.setFromPoints([tip.clone(), new THREE.Vector3(tip.x, groundY + 0.02, tip.z)]);
      line.computeLineDistances();
    },
  };
}

// ---------- a science box (one per experiment) ----------
function buildScienceBox(scene, exp, home) {
  const group = new THREE.Group();
  group.position.copy(home);
  scene.add(group);
  const shell = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.5 });
  const band = new THREE.MeshStandardMaterial({ color: exp.colour, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(BOX_HALF.x * 2, BOX_HALF.y * 2, BOX_HALF.z * 2), [shell, shell, band, shell, shell, shell]);
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(BOX_HALF.x * 2 + 0.01, 0.1, BOX_HALF.z * 2 + 0.01), band);
  stripe.position.y = BOX_HALF.y - 0.12;
  group.add(stripe);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), new THREE.MeshStandardMaterial({ map: labelTexture({ text: exp.label, bg: '#1b1846', w: 320, h: 80 }) }));
  label.position.set(-0.12, 0.08, BOX_HALF.z + 0.005);
  group.add(label);
  // a window into the experiment
  const windowMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.2, metalness: 0.3, emissive: exp.colour, emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), windowMat);
  win.position.set(0.24, -0.16, BOX_HALF.z + 0.006);
  group.add(win);
  const growers = [];
  const growMat = new THREE.MeshStandardMaterial({ color: exp.colour, roughness: 0.4, emissive: exp.colour, emissiveIntensity: 0.35 });
  for (let i = 0; i < 4; i++) {
    let g;
    if (exp.id === 'crystals') g = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), growMat);
    else if (exp.id === 'blobs') g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), growMat);
    else {
      g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), growMat);
      stem.position.y = 0.06;
      g.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), growMat);
      leaf.scale.set(1.6, 0.5, 0.6);
      leaf.position.y = 0.12;
      g.add(leaf);
    }
    g.position.set(0.1 + i * 0.09, -0.24, BOX_HALF.z + 0.03);
    g.scale.setScalar(0.25);
    group.add(g);
    growers.push(g);
  }
  // the grapple fixture the arm grabs (a pin on a round plate)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.5 }));
  plate.position.y = BOX_HALF.y + 0.02;
  group.add(plate);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.4, metalness: 0.5 }));
  pin.position.y = BOX_HALF.y + 0.12;
  group.add(pin);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = BOX_HALF.y + 0.05;
  group.add(ring);

  let glow = false;
  let running = false;
  let grown = 0;
  return {
    exp,
    group,
    home,
    get handle() {
      return group.position.clone().add(new THREE.Vector3(0, BOX_HALF.y + 0.22, 0));
    },
    hangFrom(tip) {
      group.position.set(tip.x, tip.y - BOX_HALF.y - 0.22, tip.z);
    },
    setAt(p) {
      group.position.copy(p);
    },
    showRing(on) {
      glow = on;
    },
    setRunning(on, g) {
      running = on;
      grown = g;
    },
    update(t) {
      ringMat.opacity = glow ? 0.55 + 0.35 * Math.sin(t * 5) : 0;
      windowMat.emissiveIntensity = running ? 1.2 + 0.3 * Math.sin(t * 3) : 0.12;
      growers.forEach((g, i) => {
        const s = 0.25 + grown * (0.9 + (i % 2) * 0.25);
        g.scale.setScalar(s);
        if (exp.id === 'blobs' && running) g.position.y = -0.24 + Math.sin(t * 2 + i) * 0.02;
        if (exp.id === 'crystals' && running) g.rotation.y += 0.02;
      });
    },
  };
}

// ---------- the experiment platform: one coloured slot per box ----------
function buildPlatform(scene, exps, hints) {
  const metal = new THREE.MeshStandardMaterial({ color: '#5c6d7b', roughness: 0.5, metalness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 4.4), metal);
  base.position.set(SLOTS[1].x, DECK_Y + 0.12, SLOTS[1].z);
  scene.add(base);
  const slots = exps.map((exp, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: exp.colour, transparent: true, opacity: 0.8, depthWrite: false });
    const outline = new THREE.Group();
    const w = BOX_HALF.x * 2 + 0.2;
    const d = BOX_HALF.z * 2 + 0.2;
    for (const [sx, sz, lx, lz] of [[0, -d / 2, w, 0.06], [0, d / 2, w, 0.06], [-w / 2, 0, 0.06, d], [w / 2, 0, 0.06, d]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.02, lz), mat);
      bar.position.set(sx, 0, sz);
      outline.add(bar);
    }
    outline.position.set(SLOTS[i].x, PLATFORM_TOP + 0.02, SLOTS[i].z);
    scene.add(outline);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.26), new THREE.MeshStandardMaterial({ map: labelTexture({ text: exp.label, bg: '#1b1846', fg: exp.colour, w: 320, h: 76 }) }));
    sign.position.set(SLOTS[i].x + 0.95, PLATFORM_TOP + 0.3, SLOTS[i].z);
    sign.rotation.y = -Math.PI / 2;
    sign.rotation.order = 'YXZ';
    sign.rotation.x = -0.4;
    scene.add(sign);
    const ghost = new THREE.Mesh(
      new THREE.BoxGeometry(BOX_HALF.x * 2, BOX_HALF.y * 2, BOX_HALF.z * 2),
      new THREE.MeshBasicMaterial({ color: exp.colour, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    ghost.position.copy(SLOTS[i]);
    ghost.visible = false;
    scene.add(ghost);
    return { exp, mat, ghost, outline, active: false, filled: false };
  });
  return {
    slots,
    setActive(id) {
      slots.forEach((s) => {
        s.active = s.exp.id === id && !s.filled;
        s.ghost.visible = s.active && hints === 'more';
      });
    },
    fill(id) {
      const s = slots.find((x) => x.exp.id === id);
      s.filled = true;
      s.active = false;
      s.ghost.visible = false;
      s.outline.visible = false;
    },
    update(t) {
      slots.forEach((s) => (s.mat.opacity = s.active ? 0.6 + 0.35 * Math.sin(t * 5) : 0.35));
    },
  };
}

// ---------- the stow ring: park the arm here when space junk is coming ----------
function buildStow(scene) {
  const group = new THREE.Group();
  group.position.copy(STOW);
  scene.add(group);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.25, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 10, 48), mat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.3),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'STOW', bg: '#c98a10', fg: '#1b1846', w: 256, h: 76 }), transparent: true, opacity: 0.35, depthWrite: false }),
  );
  sign.position.y = 0.55;
  group.add(sign);
  let alert = false;
  return {
    position: STOW,
    setAlert(on) {
      alert = on;
    },
    update(t) {
      mat.opacity = alert ? 0.7 + 0.3 * Math.sin(t * 9) : 0.22;
      sign.material.opacity = alert ? 1 : 0.35;
      ring.scale.setScalar(alert ? 1 + 0.08 * Math.sin(t * 9) : 1);
    },
  };
}

// ---------- space junk: a few rocks that streak past over the deck ----------
function buildDebris(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#8c8f99', roughness: 0.9 });
  const rocks = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.06), mat);
    m.visible = false;
    scene.add(m);
    return { m, v: new THREE.Vector3(), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()) };
  });
  let life = 0;
  return {
    // send the junk flying past; `hit` aims one rock right at the arm's hand
    launch(hitAt = null) {
      life = 2.2;
      rocks.forEach((r, i) => {
        r.m.visible = true;
        r.m.position.set(-34 - i * 3, -1.2 + (i % 3) * 0.8, -7.4 - (i % 4) * 1.1);
        const target = hitAt && i === 0 ? hitAt : new THREE.Vector3(30, -1 + (i % 3) * 0.7, -8 - (i % 4));
        r.v.subVectors(target, r.m.position).multiplyScalar(1 / 1.4);
      });
    },
    update(dt) {
      if (life <= 0) return;
      life -= dt;
      rocks.forEach((r) => {
        r.m.position.addScaledVector(r.v, dt);
        r.m.rotation.x += r.spin.x * dt * 6;
        r.m.rotation.y += r.spin.y * dt * 6;
        if (life <= 0) r.m.visible = false;
      });
    },
  };
}

// ---------- inside: a little lab module you can float around in ----------
function buildInside(scene, suit) {
  const frame = new THREE.MeshStandardMaterial({ color: '#c9cfd6', roughness: 0.45, metalness: 0.4 });
  const pad = new THREE.MeshStandardMaterial({ color: '#e9e5da', roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });
  const box = (w, h, d, x, y, z, mat = pad) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // front wall with a big eight-sided window (like the Cupola's)
  const wall = new THREE.Shape();
  wall.moveTo(-4, -3);
  wall.lineTo(4, -3);
  wall.lineTo(4, 3);
  wall.lineTo(-4, 3);
  wall.lineTo(-4, -3);
  const hole = new THREE.Path();
  const R = 1.6;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * R * 1.25;
    const y = Math.sin(a) * R + 0.15;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  wall.holes.push(hole);
  const front = new THREE.Mesh(new THREE.ShapeGeometry(wall), pad);
  front.position.z = -1.25;
  scene.add(front);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const b = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const p1 = new THREE.Vector3(Math.cos(a) * R * 1.25, Math.sin(a) * R + 0.15, -1.24);
    const p2 = new THREE.Vector3(Math.cos(b) * R * 1.25, Math.sin(b) * R + 0.15, -1.24);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(p1.distanceTo(p2), 0.12, 0.1), frame);
    bar.position.copy(p1).add(p2).multiplyScalar(0.5);
    bar.rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    scene.add(bar);
  }
  // the module: side walls, ceiling, floor, back wall with a hatch
  const len = 6.5;
  const midZ = -1.25 + len / 2;
  box(0.1, 3.4, len, -2.3, 0, midZ);
  box(0.1, 3.4, len, 2.3, 0, midZ);
  box(4.7, 0.1, len, 0, 1.7, midZ);
  box(4.7, 0.1, len, 0, -1.7, midZ, dark);
  box(4.7, 3.4, 0.1, 0, 0, midZ + len / 2);
  const hatch = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 10, 40), frame);
  hatch.position.set(0, 0, midZ + len / 2 - 0.06);
  scene.add(hatch);
  // yellow handrails along both walls (astronauts pull themselves along these)
  const rail = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 });
  for (const x of [-2.2, 2.2]) for (const y of [1.15, -1.15]) box(0.05, 0.05, len - 1, x, y, midZ, rail);
  // ceiling light strips
  const lightStrip = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  for (const x of [-0.8, 0.8]) box(0.12, 0.03, len - 1.2, x, 1.64, midZ, lightStrip);

  // the robotics desk under the window
  box(2.6, 0.12, 0.8, 0, -0.95, -0.75, dark);
  box(2.6, 0.7, 0.1, 0, -1.3, -0.4, dark);
  // on the front of the desk: easy to spot while floating, out of the way once you sit
  const deskSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'ARM CONTROLS', bg: '#1b1846', fg: '#ffc145', w: 420, h: 84 }) }));
  deskSign.position.set(0, -1.18, -0.34);
  scene.add(deskSign);
  // the arm camera screen, off to the right so it never blocks the window
  const screen = screenTexture(512, 256);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: screen.texture }));
  screenMesh.position.set(1.02, -0.66, -0.86);
  screenMesh.rotation.set(-0.3, -0.55, 0, 'YXZ');
  scene.add(screenMesh);
  const bezel = box(0.68, 0.36, 0.03, 1.035, -0.665, -0.875, dark);
  bezel.rotation.copy(screenMesh.rotation);

  // hand controllers, and my gloves and sleeves on them (only while I'm sitting here)
  const seated = new THREE.Group();
  scene.add(seated);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: suitColour(suit), roughness: 0.75 });
  const sticks = [-0.5, 0.5].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, -0.89, -0.62);
    scene.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), dark));
    const pivot = new THREE.Group();
    g.add(pivot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), frame);
    stem.position.y = 0.1;
    pivot.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), dark);
    knob.position.y = 0.21;
    pivot.add(knob);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.8 }));
    glove.scale.set(0.075, 0.068, 0.092);
    glove.position.y = 0.22;
    pivot.add(glove);
    const hand = new THREE.Vector3(x, -0.67, -0.6);
    const shoulder = new THREE.Vector3(Math.sign(x) * 0.34, -0.72, 0.55);
    const along = new THREE.Vector3().subVectors(hand, shoulder);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, along.length(), 16), sleeveMat);
    sleeve.position.copy(shoulder).addScaledVector(along, 0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), along.normalize());
    seated.add(sleeve);
    return { pivot, glove };
  });

  // the air machine: a vent on the left wall with ribbons that flutter while it blows
  const vent = new THREE.Group();
  vent.position.set(-2.2, 0.95, 3.1);
  vent.rotation.y = Math.PI / 2;
  scene.add(vent);
  vent.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.1), new THREE.MeshStandardMaterial({ color: '#1a6fb0', roughness: 0.5 })));
  const ventLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'AIR', bg: '#1a6fb0', w: 256, h: 52 }) }));
  ventLabel.position.set(0, 0.28, 0.06);
  vent.add(ventLabel);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff', side: THREE.DoubleSide });
  const ribbons = [-0.2, 0, 0.2].map((x) => {
    const p = new THREE.Group();
    p.position.set(x, -0.15, 0.06);
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.32), ribbonMat);
    rb.position.y = -0.16;
    p.add(rb);
    vent.add(p);
    return p;
  });

  let screenKey = '';
  let airOn = true;
  return {
    tilt(left, right) {
      sticks[0].pivot.rotation.set(left.x, 0, left.z);
      sticks[1].pivot.rotation.set(right.x, 0, right.z);
    },
    setSeated(on) {
      seated.visible = on;
      sticks.forEach((s) => (s.glove.visible = on));
    },
    setAir(on) {
      airOn = on;
    },
    animate(t) {
      ribbons.forEach((p, i) => (p.rotation.x = airOn ? 0.9 + 0.35 * Math.sin(t * 9 + i * 2) : 0.05));
    },
    screen({ title, lines, colour }) {
      const key = title + lines.join('|') + colour;
      if (key === screenKey) return;
      screenKey = key;
      const g = screen.ctx;
      g.fillStyle = '#0d0b26';
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = colour;
      g.lineWidth = 8;
      g.strokeRect(6, 6, 500, 244);
      g.fillStyle = colour;
      g.font = 'bold 44px "Lilita One", system-ui, sans-serif';
      g.fillText(title, 26, 62);
      g.fillStyle = '#fff3d6';
      g.font = '30px "Martian Mono", monospace';
      lines.forEach((l, i) => g.fillText(l, 26, 116 + i * 46));
      screen.redraw();
    },
    setLights(on) {
      lightStrip.color.set(on ? '#fffbe8' : '#3a3628');
    },
  };
}

// The power panel on the left wall. Float over, look at a socket and press E to plug or unplug it.
function buildPowerPanel(scene, hints) {
  const group = new THREE.Group();
  group.position.set(-2.22, 0, 1.55);
  group.rotation.y = Math.PI / 2; // faces into the module (towards +x)
  scene.add(group);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.62, 0.06), new THREE.MeshStandardMaterial({ color: '#23305c', roughness: 0.6 })));
  const header = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'POWER PANEL', bg: '#1b1846', fg: '#ffc145', w: 512, h: 58 }) }));
  header.position.set(0, 0.7, 0.035);
  group.add(header);
  const overload = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.13),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'TOO MANY MACHINES!', bg: '#ff4d5e', fg: '#fff3d6', w: 512, h: 42 }), transparent: true }),
  );
  overload.position.set(0, -0.72, 0.035);
  overload.visible = false;
  group.add(overload);

  const plugMat = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.35, metalness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.6 });
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.9 });
  const colourFor = (m) => (m.kind === 'air' ? '#1a6fb0' : m.kind === 'extra' ? '#5c6d7b' : EXPERIMENTS.find((e) => e.id === m.id)?.colour ?? '#22955a');
  const sockets = MACHINES.map((machine, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const local = new THREE.Vector3(-0.62 + col * 0.62, 0.2 - row * 0.62, 0.04);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.4), new THREE.MeshStandardMaterial({ map: plateTexture({ text: machine.label, sub: machine.sub, bg: colourFor(machine) }), roughness: 0.6 }));
    plate.position.copy(local);
    group.add(plate);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(local.x + 0.06, local.y + 0.27, 0.05);
    group.add(hole);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), plugMat);
    plug.position.set(local.x + 0.06, local.y + 0.27, 0.09);
    group.add(plug);
    const ledMat = new THREE.MeshBasicMaterial({ color: '#2b2f38' });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), ledMat);
    led.position.set(local.x - 0.07, local.y + 0.27, 0.06);
    group.add(led);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.36, 4, 1), ringMat);
    ring.rotation.z = Math.PI / 4;
    ring.scale.set(1, 0.92, 1);
    ring.position.set(local.x, local.y + 0.04, 0.06);
    group.add(ring);
    group.updateMatrixWorld(true);
    return { machine, position: group.localToWorld(local.clone()), plug, ledMat, ringMat, plugged: false, running: false, overloaded: false, aimed: false };
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.85), glowMat);
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

// The science bench on the right wall: one station per experiment, each with a status screen
// and a big START button. Look at a station and press E to start its experiment (a timed puzzle).
function buildBench(scene, exps, hints) {
  const group = new THREE.Group();
  group.position.set(2.22, -0.05, 1.7);
  group.rotation.y = -Math.PI / 2; // faces into the module (towards -x)
  scene.add(group);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 0.06), new THREE.MeshStandardMaterial({ color: '#1d3a35', roughness: 0.6 })));
  const header = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'SCIENCE BENCH', bg: '#12302b', fg: '#5bd98a', w: 560, h: 50 }) }));
  header.position.set(0, 0.64, 0.035);
  group.add(header);
  const stations = exps.map((exp, i) => {
    const x = -0.72 + i * 0.72;
    const screen = screenTexture(256, 220);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.55), new THREE.MeshBasicMaterial({ map: screen.texture }));
    face.position.set(x, 0.18, 0.04);
    group.add(face);
    const btnMat = new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.4, emissive: '#000000' });
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.06, 24), btnMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(x, -0.33, 0.06);
    group.add(btn);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.36, 4, 1), ringMat);
    ring.rotation.z = Math.PI / 4;
    ring.scale.set(0.95, 1.25, 1);
    ring.position.set(x, -0.02, 0.05);
    group.add(ring);
    group.updateMatrixWorld(true);
    let key = '';
    const st = {
      exp,
      position: group.localToWorld(new THREE.Vector3(x, 0, 0.04)),
      state: 'waiting',
      fill: 0,
      aimed: false,
      ringMat,
      btnMat,
      draw() {
        const k = st.state + Math.floor(st.fill * 100);
        if (k === key) return;
        key = k;
        const g = screen.ctx;
        const W = screen.w;
        const H = screen.h;
        g.fillStyle = '#0d0b26';
        g.fillRect(0, 0, W, H);
        g.fillStyle = exp.colour;
        g.fillRect(0, 0, W, 44);
        g.fillStyle = '#0d0b26';
        g.font = 'bold 30px "Lilita One", system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(exp.label, W / 2, 33);
        const words = {
          waiting: ['Waiting for', 'its box', '#6c7681'],
          ready: ['READY!', 'press E to start', '#ffc145'],
          running: ['Growing', `${Math.round(st.fill * 100)}%`, '#5bd98a'],
          paused: ['NO POWER', `${Math.round(st.fill * 100)}% · plug it in`, '#ff9a4d'],
          done: ['DONE!', 'great science', '#5bd98a'],
        }[st.state];
        g.fillStyle = words[2];
        g.font = 'bold 40px "Lilita One", system-ui, sans-serif';
        g.fillText(words[0], W / 2, 110);
        g.fillStyle = '#fff3d6';
        g.font = '22px "Atkinson Hyperlegible", system-ui, sans-serif';
        g.fillText(words[1], W / 2, 148);
        if (st.state === 'running' || st.state === 'paused' || st.state === 'done') {
          g.fillStyle = 'rgba(255,255,255,0.15)';
          g.fillRect(24, 172, W - 48, 22);
          g.fillStyle = exp.colour;
          g.fillRect(24, 172, (W - 48) * Math.min(1, st.fill), 22);
        }
        screen.redraw();
      },
    };
    st.draw();
    return st;
  });
  return {
    stations,
    update(t) {
      for (const s of stations) {
        s.draw();
        s.ringMat.opacity = s.aimed ? 0.9 : 0;
        const ready = s.state === 'ready';
        s.btnMat.color.set(ready ? '#ffc145' : s.state === 'running' || s.state === 'done' ? '#5bd98a' : s.state === 'paused' ? '#ff9a4d' : '#3a3f48');
        s.btnMat.emissive.set(ready ? '#5a3a00' : '#000000');
        s.btnMat.emissiveIntensity = ready ? 0.6 + 0.4 * Math.sin(t * 6) : 0;
      }
      void hints;
    },
  };
}
