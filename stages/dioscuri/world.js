// The robot-arm trainer: a copy of the space station's Cupola window, the robot arm outside,
// a cargo ship with the science box, and the experiment platform. Earth turns below,
// with a sunlit side and a night side. One unit = one metre. You look out along -z.

import * as THREE from 'three';
import { labelTexture, dotTexture } from '../hermes/textures.js';
import { disposeTree } from '../hermes/world.js';
import { suitColour } from '../hermes/arms.js';
import { plateTexture, screenTexture } from '../odysseus/textures.js';
import { MACHINES, solveArm } from './sim.js';

export { disposeTree };

export const EYE = new THREE.Vector3(0, 0, 0.35);
export const ARM_BASE = new THREE.Vector3(0, -2.2, -11.2); // the shoulder joint, at the back of the deck
export const L1 = 4.0; // shoulder to elbow
export const L2 = 3.8; // elbow to wrist
export const TIP = 0.75; // wrist to the grabber's tip
export const DECK_Y = -3.0;
export const BOX_HOME = new THREE.Vector3(-6.3, DECK_Y + 0.42, -8.6); // box centre on the cargo pallet
export const SLOT = new THREE.Vector3(6.3, DECK_Y + 0.42, -8.6); // box centre on the experiment platform
export const BOX_HALF = new THREE.Vector3(0.55, 0.38, 0.4);
export const HAND_START = new THREE.Vector3(0, -1.0, -8.2); // where the grabber's tip starts

export function buildWorld({ hints = 'more', suit = 'orange' }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  const animators = [];

  // ---------- light ----------
  const sun = new THREE.DirectionalLight('#fff6e6', 2.6);
  sun.position.set(-40, 60, -30);
  scene.add(sun);
  const ambient = new THREE.HemisphereLight('#9fc4ff', '#0b1430', 0.55);
  scene.add(ambient);
  const cabin = new THREE.PointLight('#fff1d6', 6, 6, 1.4);
  cabin.position.set(0, 1.1, 0.6);
  scene.add(cabin);
  const flood = new THREE.SpotLight('#dfe9ff', 0, 30, 0.75, 0.5, 1.2);
  flood.position.set(0, 2, -3);
  flood.target.position.set(0, DECK_Y, -8.5);
  scene.add(flood, flood.target);

  // ---------- space: stars, the Sun, Earth ----------
  scene.add(buildStars());
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: '#fff3c4', transparent: true, depthWrite: false, fog: false }));
  sunSprite.scale.setScalar(120);
  scene.add(sunSprite);
  const earth = buildEarth(scene);
  animators.push((t, dt) => earth.update(t, dt));

  // ---------- outside the station ----------
  const outside = buildOutside(scene);
  const arm = buildArm(scene);
  const box = buildScienceBox(scene);
  const platform = buildPlatform(scene, hints);
  animators.push((t) => platform.update(t));
  const tipMarker = buildTipMarker(scene, hints);

  // ---------- inside the Cupola trainer ----------
  const inside = buildInside(scene, suit);
  const panel = buildPowerPanel(scene, hints);
  animators.push((t) => panel.update(t));

  // ---------- day and night ----------
  const sunDir = new THREE.Vector3();
  let light = 1; // 1 = full sunlight, 0 = Earth's shadow
  let lightsOn = true;
  function setOrbit({ side, k }) {
    // the Sun climbs and sets across the day side; at night it's behind Earth
    // high and behind you for most of the day (so the deck is lit), then it swings round
    // into the window and sets behind Earth's edge
    const elev = side === 'day' ? 62 - 80 * k * k : -40;
    const az = side === 'day' ? THREE.MathUtils.lerp(150, 25, k * k) : 25;
    const e = THREE.MathUtils.degToRad(elev);
    const a = THREE.MathUtils.degToRad(az);
    sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    sunSprite.position.copy(sunDir).multiplyScalar(820);
    sun.position.copy(sunDir).multiplyScalar(80);
    // sunlight fades as the Sun sinks behind Earth's edge (about 9 degrees down)
    light = side === 'day' ? THREE.MathUtils.clamp((elev + 12) / 10, 0, 1) : 0;
  }

  return {
    scene,
    arm,
    box,
    platform,
    panel,
    inside,
    tipMarker,
    setOrbit,
    setLights(on) {
      lightsOn = on;
    },
    setScience(on, grown) {
      box.setScience(on, grown);
    },
    update(t, dt, camera) {
      const warm = light < 1 && light > 0 ? 1 - Math.abs(light - 0.5) * 2 : 0; // sunset glow
      sun.intensity = 2.6 * light;
      sun.color.setRGB(1, 0.96 - warm * 0.35, 0.9 - warm * 0.55);
      sunSprite.material.color.setRGB(1, 0.95 - warm * 0.4, 0.75 - warm * 0.5);
      ambient.intensity = 0.22 + 0.7 * light;
      earth.setLight(light);
      flood.intensity = (1 - light) * 120;
      cabin.intensity += ((lightsOn ? 6 : 0.6) - cabin.intensity) * Math.min(1, dt * 4);
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
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2), dark);
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

// ---------- the science box: a little space garden ----------
function buildScienceBox(scene) {
  const group = new THREE.Group();
  group.position.copy(BOX_HOME);
  scene.add(group);
  const shell = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(BOX_HALF.x * 2, BOX_HALF.y * 2, BOX_HALF.z * 2), [shell, shell, orange, shell, shell, shell]);
  group.add(body);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'SCIENCE', bg: '#1b1846', w: 256, h: 80 }) }));
  label.position.set(-0.18, 0.18, BOX_HALF.z + 0.005);
  group.add(label);
  // a window into the garden
  const windowMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.2, metalness: 0.3, emissive: '#8a5cff', emissiveIntensity: 0 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), windowMat);
  win.position.set(0.22, -0.08, BOX_HALF.z + 0.006);
  group.add(win);
  const sprouts = [];
  const leaf = new THREE.MeshStandardMaterial({ color: '#5bd98a', roughness: 0.6, emissive: '#1b5e34', emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group();
    s.position.set(0.07 + i * 0.1, -0.24, BOX_HALF.z + 0.02);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), leaf);
    stem.position.y = 0.08;
    s.add(stem);
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), leaf);
      l.scale.set(1.4, 0.5, 0.6);
      l.position.set(side * 0.035, 0.15, 0);
      s.add(l);
    }
    s.scale.setScalar(0.15);
    group.add(s);
    sprouts.push(s);
  }
  // the grapple fixture the arm grabs (a pin on a round plate)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.5 }));
  plate.position.y = BOX_HALF.y + 0.02;
  group.add(plate);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.4, metalness: 0.5 }));
  pin.position.y = BOX_HALF.y + 0.12;
  group.add(pin);
  // a glow ring around the handle, so you can see where to grab
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = BOX_HALF.y + 0.05;
  group.add(ring);

  return {
    group,
    get handle() {
      return group.position.clone().add(new THREE.Vector3(0, BOX_HALF.y + 0.22, 0));
    },
    // hang from the grabber's tip
    hangFrom(tip) {
      group.position.set(tip.x, tip.y - BOX_HALF.y - 0.22, tip.z);
    },
    setAt(p) {
      group.position.copy(p);
    },
    showRing(on, t = 0) {
      ring.visible = on;
      ringMat.opacity = 0.55 + 0.35 * Math.sin(t * 5);
    },
    setScience(on, grown) {
      windowMat.emissiveIntensity = on ? 1.4 : 0.15;
      sprouts.forEach((s, i) => s.scale.setScalar(0.15 + grown * (0.85 + (i % 2) * 0.25)));
    },
  };
}

// ---------- the experiment platform on the right ----------
function buildPlatform(scene, hints) {
  const metal = new THREE.MeshStandardMaterial({ color: '#5c6d7b', roughness: 0.5, metalness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.24, 2.4), metal);
  base.position.set(SLOT.x, DECK_Y + 0.12, SLOT.z);
  scene.add(base);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6), new THREE.MeshStandardMaterial({ map: labelTexture({ text: 'EXPERIMENT', sub: 'put the science box here', bg: '#22955a', w: 360, h: 110 }) }));
  sign.position.set(SLOT.x, DECK_Y + 0.5, SLOT.z + 1.25);
  sign.rotation.x = -0.5;
  scene.add(sign);
  // where the box goes: a glowing outline on the platform
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#5bd98a', transparent: true, opacity: 0.8, depthWrite: false });
  const outline = new THREE.Group();
  const w = BOX_HALF.x * 2 + 0.2;
  const d = BOX_HALF.z * 2 + 0.2;
  for (const [sx, sz, lx, lz] of [[0, -d / 2, w, 0.06], [0, d / 2, w, 0.06], [-w / 2, 0, 0.06, d], [w / 2, 0, 0.06, d]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.02, lz), outlineMat);
    bar.position.set(sx, 0, sz);
    outline.add(bar);
  }
  outline.position.set(SLOT.x, DECK_Y + 0.26, SLOT.z);
  scene.add(outline);
  // a ghost box above it while you carry the box over (Easy only)
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_HALF.x * 2, BOX_HALF.y * 2, BOX_HALF.z * 2),
    new THREE.MeshBasicMaterial({ color: '#5bd98a', transparent: true, opacity: 0.18, depthWrite: false }),
  );
  ghost.position.copy(SLOT);
  ghost.visible = false;
  scene.add(ghost);
  let active = false;
  return {
    setActive(on) {
      active = on;
      ghost.visible = on && hints === 'more';
    },
    done() {
      active = false;
      ghost.visible = false;
      outline.visible = false;
    },
    update(t) {
      outlineMat.opacity = active ? 0.6 + 0.35 * Math.sin(t * 5) : 0.35;
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
  scene.add(line);
  return {
    update(tip, groundY) {
      ring.position.set(tip.x, groundY + 0.02, tip.z);
      lineGeo.setFromPoints([tip.clone(), new THREE.Vector3(tip.x, groundY + 0.02, tip.z)]);
      line.computeLineDistances();
    },
  };
}

// ---------- inside: the window frame, the desk, the hand controllers, my sleeves ----------
function buildInside(scene, suit) {
  const frame = new THREE.MeshStandardMaterial({ color: '#c9cfd6', roughness: 0.45, metalness: 0.4 });
  const pad = new THREE.MeshStandardMaterial({ color: '#e9e5da', roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });

  // front wall with a big eight-sided window (like the Cupola's)
  const wall = new THREE.Shape();
  wall.moveTo(-4, -3);
  wall.lineTo(4, -3);
  wall.lineTo(4, 3);
  wall.lineTo(-4, 3);
  wall.lineTo(-4, -3);
  const hole = new THREE.Path();
  const R = 1.75;
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
  // window frame bars (the panes)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const b = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
    const p1 = new THREE.Vector3(Math.cos(a) * R * 1.25, Math.sin(a) * R + 0.15, -1.24);
    const p2 = new THREE.Vector3(Math.cos(b) * R * 1.25, Math.sin(b) * R + 0.15, -1.24);
    const len = p1.distanceTo(p2);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.1), frame);
    bar.position.copy(p1).add(p2).multiplyScalar(0.5);
    bar.rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    scene.add(bar);
  }
  // side walls, ceiling and floor of the little module
  const box = (w, h, d, x, y, z, mat = pad) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  box(0.1, 3.4, 3.2, -2.3, 0, 0.35);
  box(0.1, 3.4, 3.2, 2.3, 0, 0.35);
  box(4.7, 0.1, 3.2, 0, 1.7, 0.35);
  box(4.7, 0.1, 3.2, 0, -1.7, 0.35, dark);
  // yellow handrails
  const rail = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 });
  for (const x of [-2.2, 2.2]) box(0.05, 0.05, 1.4, x, 0.9, 0.2, rail);

  // the robotics desk under the window
  box(2.6, 0.12, 0.8, 0, -0.95, -0.75, dark);
  box(2.6, 0.7, 0.1, 0, -1.3, -0.4, dark);
  // two screens on the desk: the arm camera numbers
  const screen = screenTexture(512, 256);
  // the arm camera screen sits off to the right, so it never blocks the window
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshBasicMaterial({ map: screen.texture }));
  screenMesh.position.set(1.02, -0.66, -0.86);
  screenMesh.rotation.set(-0.3, -0.55, 0, 'YXZ');
  scene.add(screenMesh);
  const bezel = box(0.68, 0.36, 0.03, 1.035, -0.665, -0.875, dark);
  bezel.rotation.copy(screenMesh.rotation);

  // hand controllers (joysticks) and my gloves on them
  const sleeveMat = new THREE.MeshStandardMaterial({ color: suitColour(suit), roughness: 0.75 });
  const sticks = [-0.5, 0.5].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, -0.89, -0.62);
    scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), dark);
    g.add(base);
    const pivot = new THREE.Group();
    g.add(pivot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 8), frame);
    stem.position.y = 0.1;
    pivot.add(stem);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.8 }));
    glove.scale.set(0.075, 0.068, 0.092);
    glove.position.y = 0.22;
    pivot.add(glove);
    // my sleeve, from my shoulder down to the glove
    const hand = new THREE.Vector3(x, -0.67, -0.6);
    const shoulder = new THREE.Vector3(Math.sign(x) * 0.34, -0.72, 0.55);
    const along = new THREE.Vector3().subVectors(hand, shoulder);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, along.length(), 16), sleeveMat);
    sleeve.position.copy(shoulder).addScaledVector(along, 0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), along.normalize());
    scene.add(sleeve);
    return pivot;
  });

  const lightStrip = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  box(3, 0.03, 0.12, 0, 1.64, 0.4, lightStrip);

  let screenKey = '';
  return {
    tilt(left, right) {
      sticks[0].rotation.set(left.x, 0, left.z);
      sticks[1].rotation.set(right.x, 0, right.z);
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

// The power panel on the left wall. Look at a socket and press E to plug or unplug it.
function buildPowerPanel(scene, hints) {
  const group = new THREE.Group();
  group.position.set(-2.22, -0.2, -0.15); // low enough to aim at with a quick glance left
  group.rotation.y = Math.PI / 2; // faces into the module (towards +x)
  scene.add(group);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.55, 0.06), new THREE.MeshStandardMaterial({ color: '#23305c', roughness: 0.6 })));
  const header = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'POWER PANEL', bg: '#1b1846', fg: '#ffc145', w: 512, h: 58 }) }));
  header.position.set(0, 0.66, 0.035);
  group.add(header);
  const overload = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.13),
    new THREE.MeshBasicMaterial({ map: labelTexture({ text: 'TOO MANY MACHINES!', bg: '#ff4d5e', fg: '#fff3d6', w: 512, h: 42 }), transparent: true }),
  );
  overload.position.set(0, -0.69, 0.035);
  overload.visible = false;
  group.add(overload);

  const plugMat = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.35, metalness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.6 });
  const holeMat = new THREE.MeshStandardMaterial({ color: '#0d0b26', roughness: 0.9 });
  const colours = { air: '#1a6fb0', work: '#22955a', extra: '#5c6d7b' };
  const spots = [
    [-0.55, 0.22],
    [0, 0.22],
    [0.55, 0.22],
    [-0.28, -0.4],
    [0.28, -0.4],
  ];
  const sockets = MACHINES.map((machine, i) => {
    const local = new THREE.Vector3(spots[i][0], spots[i][1], 0.04);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ map: plateTexture({ text: machine.label, sub: machine.sub, bg: colours[machine.kind] }), roughness: 0.6 }));
    plate.position.copy(local);
    group.add(plate);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(local.x + 0.06, local.y + 0.25, 0.05);
    group.add(hole);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), plugMat);
    plug.position.set(local.x + 0.06, local.y + 0.25, 0.09);
    group.add(plug);
    const ledMat = new THREE.MeshBasicMaterial({ color: '#2b2f38' });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), ledMat);
    led.position.set(local.x - 0.07, local.y + 0.25, 0.06);
    group.add(led);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.34, 4, 1), ringMat);
    ring.rotation.z = Math.PI / 4;
    ring.scale.set(1, 0.92, 1);
    ring.position.set(local.x, local.y + 0.04, 0.06);
    group.add(ring);
    group.updateMatrixWorld(true);
    return { machine, position: group.localToWorld(local.clone()), plug, ledMat, ringMat, plugged: false, running: false, overloaded: false, aimed: false };
  });

  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.75), glowMat);
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
