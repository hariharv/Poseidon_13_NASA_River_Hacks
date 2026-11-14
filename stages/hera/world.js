// Stage 4 world: the inside of an Orion-style capsule simulator.
// The capsule never moves; when you "turn the ship" the sky turns around you instead.
// Ship frame: -Z is forward (the instrument panel and front windows), +Y is up.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { suitColour } from '../hermes/arms.js';

export const SEAT_EYE = new THREE.Vector3(-0.3, 1.2, 0.25);
export const SHELTER_EYE = new THREE.Vector3(0.98, 0.12, 0.42);
export const SHELTER_LOOK = { yaw: -1.35, pitch: -0.05, limit: [-3.0, 1.9] };

// The cabin wall: a cone, made by spinning this outline (radius, height) around the Y axis.
const PROFILE = [
  [2.1, -0.5],
  [2.15, 0.0],
  [2.05, 0.5],
  [1.75, 1.2],
  [1.35, 1.9],
  [0.95, 2.45],
  [0.6, 2.7],
];
const SEGMENTS = 96;

// Windows, as an angle around the cabin (phi; PI = straight ahead) and a height range.
const WINDOWS = [
  { phi: Math.PI + 0.21, y0: 1.45, y1: 1.95, half: 0.15, main: true }, // front left (the pilot's)
  { phi: Math.PI - 0.21, y0: 1.45, y1: 1.95, half: 0.15 }, // front right
  { phi: Math.PI + 1.25, y0: 0.95, y1: 1.5, half: 0.13 }, // left side
  { phi: Math.PI - 1.25, y0: 0.95, y1: 1.5, half: 0.13 }, // right side
];

export const BAG_LABELS = ['WATER', 'FOOD', 'WATER', 'FOOD'];

export function buildWorld({ suit = 'orange', bags = 3, renderer, hints = 'more' }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  const disposables = [];
  const track = (x) => (disposables.push(x), x);

  // Soft reflections on every shiny surface (a small studio "room" baked into an environment map).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  track(envTex);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3f52', 0.55));
  const ceiling = new THREE.PointLight('#eaf2ff', 7, 6, 1.6);
  ceiling.position.set(0, 2.35, 0.1);
  scene.add(ceiling);
  const panelFill = new THREE.PointLight('#9fd4ff', 2.2, 3, 1.8);
  panelFill.position.set(0, 1.15, -0.6);
  scene.add(panelFill);
  const alarm = new THREE.PointLight('#ff3040', 0, 7, 1.4);
  alarm.position.set(0, 1.9, -0.2);
  scene.add(alarm);
  const bayLight = new THREE.PointLight('#ffd89a', 1.4, 2.6, 1.6);
  bayLight.position.set(1.0, 0.45, 0.1);
  scene.add(bayLight);

  // ---------- textures ----------
  const quilt = track(quiltTexture());
  quilt.wrapS = quilt.wrapT = THREE.RepeatWrapping;
  quilt.repeat.set(18, 5);
  const windowsAlpha = track(windowAlphaTexture());

  // ---------- cabin wall (cone) with window holes ----------
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  const shellGeo = track(new THREE.LatheGeometry(pts, SEGMENTS));
  const shellMat = track(
    new THREE.MeshStandardMaterial({
      color: '#d9dde4',
      map: quilt,
      bumpMap: quilt,
      bumpScale: 2.2,
      roughness: 0.92,
      metalness: 0,
      side: THREE.BackSide,
      alphaMap: windowsAlpha,
      alphaTest: 0.5,
    }),
  );
  scene.add(new THREE.Mesh(shellGeo, shellMat));
  // a darker band of lockers low on the wall
  const ringMat = track(new THREE.MeshStandardMaterial({ color: '#8a919e', roughness: 0.6, metalness: 0.3 }));
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(2.06, 0.025, 8, 96)), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  scene.add(ring);
  const ring2 = ring.clone();
  ring2.scale.setScalar(1.75 / 2.06);
  ring2.position.y = 1.2;
  scene.add(ring2);
  // ceiling cap + hatch
  const cap = new THREE.Mesh(track(new THREE.CircleGeometry(0.62, 48)), track(new THREE.MeshStandardMaterial({ color: '#b8bec8', roughness: 0.7 })));
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 2.69;
  scene.add(cap);
  const hatch = new THREE.Mesh(track(new THREE.TorusGeometry(0.42, 0.04, 10, 48)), ringMat);
  hatch.rotation.x = Math.PI / 2;
  hatch.position.y = 2.66;
  scene.add(hatch);

  // ---------- window frames + glass ----------
  const frameMat = track(new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.45, metalness: 0.6 }));
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({ color: '#9ec9ff', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, depthWrite: false }),
  );
  const windowInfo = [];
  for (const w of WINDOWS) {
    const info = windowPlacement(w);
    windowInfo.push(info);
    const frame = new THREE.Mesh(track(frameGeometry(info.width + 0.12, info.height + 0.12, 0.07, 0.09)), frameMat);
    frame.position.copy(info.center).addScaledVector(info.normal, 0.012);
    frame.lookAt(info.center.clone().add(info.normal));
    scene.add(frame);
    const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(info.width + 0.02, info.height + 0.02)), glassMat);
    glass.position.copy(info.center).addScaledVector(info.normal, -0.01);
    glass.lookAt(info.center.clone().add(info.normal));
    glass.renderOrder = 5;
    scene.add(glass);
  }
  const mainWindow = windowInfo[0];

  // The pilot's line of sight through the main window: the ship's "nose" for steering.
  const boresight = mainWindow.center.clone().sub(SEAT_EYE).normalize();

  // ---------- instrument panel with three screens ----------
  const panel = new THREE.Group();
  panel.position.set(0, 1.02, -1.18);
  panel.rotation.x = -0.5;
  scene.add(panel);
  const panelMat = track(new THREE.MeshStandardMaterial({ color: '#30353f', roughness: 0.55, metalness: 0.35 }));
  const panelBox = new THREE.Mesh(track(new RoundedBoxGeometry(1.95, 0.66, 0.1, 3, 0.03)), panelMat);
  panel.add(panelBox);
  const screens = {
    flight: makeScreen('FLIGHT', -0.62),
    hera: makeScreen('HERA', 0),
    shelter: makeScreen('SHELTER', 0.62),
  };
  function makeScreen(name, x) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 340;
    const tex = track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(0.56, 0.372)), mat);
    mesh.position.set(x, 0.03, 0.052);
    panel.add(mesh);
    const bezel = new THREE.Mesh(track(frameGeometry(0.6, 0.41, 0.022, 0.012)), frameMat);
    bezel.position.set(x, 0.03, 0.053);
    panel.add(bezel);
    return { name, canvas, ctx: canvas.getContext('2d'), tex };
  }
  // little switches + buttons under the screens (decoration)
  const capMats = ['#e8e3d4', '#ffc145', '#5b6472'].map((c) => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })));
  const btnGeo = track(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 12));
  for (let i = 0; i < 22; i++) {
    const b = new THREE.Mesh(btnGeo, capMats[i % 3]);
    b.rotation.x = Math.PI / 2;
    b.position.set(-0.86 + i * 0.082, -0.27, 0.055);
    panel.add(b);
  }

  // The JET RESET switch (for the "stuck thruster" fault the trainers throw at you)
  const jet = new THREE.Group();
  jet.position.set(-0.9, 0.98, -0.95);
  jet.rotation.set(-0.35, 0.55, 0);
  scene.add(jet);
  const jetBase = new THREE.Mesh(track(new RoundedBoxGeometry(0.2, 0.2, 0.05, 2, 0.015)), panelMat);
  jet.add(jetBase);
  const jetLedMat = track(new THREE.MeshStandardMaterial({ color: '#401015', emissive: '#ff2a3a', emissiveIntensity: 0 }));
  const jetLed = new THREE.Mesh(track(new THREE.SphereGeometry(0.018, 12, 8)), jetLedMat);
  jetLed.position.set(0, 0.07, 0.03);
  jet.add(jetLed);
  const lever = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.014, 0.09, 10)), track(new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 0.8, roughness: 0.25 })));
  lever.position.set(0, -0.01, 0.06);
  lever.rotation.x = 0.6;
  jet.add(lever);
  const guard = new THREE.Mesh(track(new THREE.TorusGeometry(0.05, 0.008, 6, 20, Math.PI)), capMats[1]);
  guard.position.set(0, -0.01, 0.035);
  jet.add(guard);
  const jetLabel = labelMesh(track, 'JET RESET', { w: 0.2, h: 0.05, bg: '#1b1846', fg: '#ffc145' });
  jetLabel.position.set(0, -0.085, 0.027);
  jet.add(jetLabel);
  const jetHit = hitBox(track, 0.3, 0.3, 0.2);
  jet.add(jetHit);

  // ---------- seats + you ----------
  const seatMat = track(new THREE.MeshStandardMaterial({ color: '#283a66', roughness: 0.85 }));
  const seatFrameMat = track(new THREE.MeshStandardMaterial({ color: '#9aa3b2', metalness: 0.7, roughness: 0.3 }));
  for (const x of [-0.3, 0.52]) {
    const seat = new THREE.Group();
    seat.position.set(x, 0, 0.55);
    const pan = new THREE.Mesh(track(new RoundedBoxGeometry(0.52, 0.12, 0.55, 3, 0.04)), seatMat);
    pan.position.set(0, 0.62, -0.05);
    const back = new THREE.Mesh(track(new RoundedBoxGeometry(0.52, 0.85, 0.12, 3, 0.04)), seatMat);
    back.position.set(0, 1.02, 0.24);
    back.rotation.x = -0.2;
    const legL = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8)), seatFrameMat);
    legL.position.set(-0.2, 0.3, 0);
    const legR = legL.clone();
    legR.position.x = 0.2;
    seat.add(pan, back, legL, legR);
    scene.add(seat);
  }
  // your legs and boots, in your suit colour (look down!)
  const suitMat = track(new THREE.MeshStandardMaterial({ color: suitColour(suit), roughness: 0.75 }));
  const bootMat = track(new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.6 }));
  for (const dx of [-0.11, 0.11]) {
    const thigh = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.085, 0.38, 6, 12)), suitMat);
    thigh.position.set(-0.3 + dx, 0.75, 0.22);
    thigh.rotation.x = Math.PI / 2 - 0.08;
    const shin = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.075, 0.36, 6, 12)), suitMat);
    shin.position.set(-0.3 + dx, 0.53, -0.12);
    shin.rotation.x = 0.35;
    const boot = new THREE.Mesh(track(new RoundedBoxGeometry(0.15, 0.12, 0.26, 3, 0.04)), bootMat);
    boot.position.set(-0.3 + dx, 0.32, -0.25);
    scene.add(thigh, shin, boot);
  }
  // the hand controller (joystick) by your right hand
  const rhc = new THREE.Group();
  rhc.position.set(0.02, 0.86, 0.12);
  scene.add(rhc);
  const rhcBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.07, 0.05, 16)), panelMat);
  rhc.add(rhcBase);
  const stick = new THREE.Group();
  stick.position.y = 0.025;
  rhc.add(stick);
  const grip = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.03, 0.09, 6, 12)), track(new THREE.MeshStandardMaterial({ color: '#1d2129', roughness: 0.6 })));
  grip.position.y = 0.075;
  stick.add(grip);
  const glove = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 16, 12)), bootMat);
  glove.scale.set(1, 0.8, 1.15);
  glove.position.set(0.015, 0.09, 0.01);
  stick.add(glove);

  // ---------- the storm shelter bay (floor, right side) ----------
  const BAY = { x0: 0.45, x1: 1.55, z0: -0.72, z1: 0.82, depth: 0.46 };
  const floorMat = track(new THREE.MeshStandardMaterial({ color: '#6c7380', roughness: 0.8, metalness: 0.2 }));
  const floorShape = new THREE.Shape();
  floorShape.absarc(0, 0, 2.14, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.moveTo(BAY.x0, -BAY.z0);
  hole.lineTo(BAY.x1, -BAY.z0);
  hole.lineTo(BAY.x1, -BAY.z1);
  hole.lineTo(BAY.x0, -BAY.z1);
  hole.lineTo(BAY.x0, -BAY.z0);
  floorShape.holes.push(hole);
  const floor = new THREE.Mesh(track(new THREE.ShapeGeometry(floorShape, 48)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(4.2, 28, '#7c8494', '#7c8494');
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  grid.position.y = 0.002;
  track(grid.geometry);
  track(grid.material);
  scene.add(grid);
  // bay walls + floor (an open box)
  const bayMat = track(new THREE.MeshStandardMaterial({ color: '#4b515d', roughness: 0.85, side: THREE.BackSide }));
  const bayW = BAY.x1 - BAY.x0;
  const bayD = BAY.z1 - BAY.z0;
  const bayBox = new THREE.Mesh(track(new THREE.BoxGeometry(bayW, BAY.depth, bayD)), bayMat);
  bayBox.position.set((BAY.x0 + BAY.x1) / 2, -BAY.depth / 2 + 0.001, (BAY.z0 + BAY.z1) / 2);
  // hide the box's top face so you can see in
  bayBox.geometry.groups = bayBox.geometry.groups.filter((g, i) => i !== 2);
  scene.add(bayBox);
  // yellow-black edge stripes around the bay
  const stripeTex = track(stripeTexture());
  stripeTex.wrapS = THREE.RepeatWrapping;
  const stripeMat = track(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
  for (const [w, x, z, rot] of [
    [bayW, (BAY.x0 + BAY.x1) / 2, BAY.z0 - 0.03, 0],
    [bayW, (BAY.x0 + BAY.x1) / 2, BAY.z1 + 0.03, 0],
    [bayD, BAY.x0 - 0.03, (BAY.z0 + BAY.z1) / 2, Math.PI / 2],
  ]) {
    const t = stripeTex.clone();
    t.repeat.set(w / 0.12, 1);
    track(t);
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w + 0.06, 0.06)), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    track(m.material);
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, 0.004, z);
    scene.add(m);
  }

  // Slots on the bay walls where the shelter's thinnest wall is: the bags go here.
  const slotSpots = [
    { pos: new THREE.Vector3(BAY.x1 - 0.13, -0.2, -0.3), rotY: Math.PI / 2 },
    { pos: new THREE.Vector3(BAY.x1 - 0.13, -0.2, 0.35), rotY: Math.PI / 2 },
    { pos: new THREE.Vector3(1.0, -0.2, BAY.z0 + 0.13), rotY: 0 },
    { pos: new THREE.Vector3(1.0, 0.12, BAY.z0 + 0.13), rotY: 0 },
  ].slice(0, bags);
  const slotMat = track(new THREE.LineDashedMaterial({ color: '#ffc145', dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0.9 }));
  const slotGlowMat = track(new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.12, depthWrite: false }));
  const slots = slotSpots.map((s) => {
    const g = new THREE.Group();
    g.position.copy(s.pos);
    g.rotation.y = s.rotY;
    const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.3, 0.24))), slotMat);
    edges.computeLineDistances();
    const glow = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.3, 0.24)), slotGlowMat);
    g.add(edges, glow);
    scene.add(g);
    return { group: g, edges, glow, filled: false };
  });
  const thinLabel = labelMesh(track, 'THIN WALL: STACK BAGS HERE', { w: 0.62, h: 0.07, bg: '#1b1846', fg: '#ffc145' });
  thinLabel.position.set(BAY.x1 - 0.005, -0.07, 0.03);
  thinLabel.rotation.y = -Math.PI / 2;
  scene.add(thinLabel);

  // Lockers on the right wall, above the bay, full of supply bags
  const locker = new THREE.Group();
  locker.position.set(1.66, 0.58, 0.05);
  locker.rotation.y = -Math.PI / 2;
  scene.add(locker);
  const lockerBack = new THREE.Mesh(track(new RoundedBoxGeometry(1.35, 0.68, 0.06, 2, 0.02)), track(new THREE.MeshStandardMaterial({ color: '#5a606c', roughness: 0.7 })));
  lockerBack.position.z = -0.12;
  locker.add(lockerBack);
  const lockerLabel = labelMesh(track, 'STOWAGE', { w: 0.32, h: 0.06, bg: '#30353f', fg: '#fff3d6' });
  lockerLabel.position.set(0, 0.37, -0.08);
  locker.add(lockerLabel);
  const bagGeo = track(new RoundedBoxGeometry(0.4, 0.28, 0.22, 4, 0.06));
  const strapMat = track(new THREE.MeshStandardMaterial({ color: '#2f6fd1', roughness: 0.7 }));
  const bagList = [];
  for (let i = 0; i < bags; i++) {
    const label = BAG_LABELS[i % BAG_LABELS.length];
    const mat = track(new THREE.MeshStandardMaterial({ color: label === 'WATER' ? '#e9eef5' : '#efe7d6', roughness: 0.95, emissive: '#ffc145', emissiveIntensity: 0 }));
    const bag = new THREE.Group();
    const body = new THREE.Mesh(bagGeo, mat);
    const strap = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.29, 0.225)), strapMat);
    const tag = labelMesh(track, label, { w: 0.2, h: 0.07, bg: label === 'WATER' ? '#2f6fd1' : '#c8582b', fg: '#ffffff' });
    tag.position.set(0, 0, 0.112);
    bag.add(body, strap, tag);
    const col = i % 2;
    const row = Math.floor(i / 2);
    const home = new THREE.Vector3(-0.32 + col * 0.64, 0.14 - row * 0.32, 0);
    bag.position.copy(home);
    locker.add(bag);
    bagList.push({ group: bag, mat, home, label, state: 'stowed', t: 0, from: null, slot: null });
  }

  // The air hose: plug it into the shelter so you can breathe in there
  const hoseHook = new THREE.Group();
  hoseHook.position.set(1.62, 0.36, 0.72);
  hoseHook.rotation.y = -Math.PI / 2;
  scene.add(hoseHook);
  const hoseMat = track(new THREE.MeshStandardMaterial({ color: '#46b4ff', roughness: 0.5, emissive: '#46b4ff', emissiveIntensity: 0 }));
  const coil = new THREE.Mesh(track(new THREE.TorusGeometry(0.11, 0.025, 10, 32)), hoseMat);
  hoseHook.add(coil);
  const airLabel = labelMesh(track, 'AIR', { w: 0.12, h: 0.06, bg: '#46b4ff', fg: '#0d0b26' });
  airLabel.position.set(0, 0.18, 0.0);
  hoseHook.add(airLabel);
  const hoseHit = hitBox(track, 0.3, 0.36, 0.2);
  hoseHook.add(hoseHit);
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.62, 0.36, 0.72),
    new THREE.Vector3(1.4, 0.2, 0.7),
    new THREE.Vector3(1.15, -0.05, 0.6),
    new THREE.Vector3(0.95, -0.2, 0.45),
  ]);
  const hoseTube = new THREE.Mesh(track(new THREE.TubeGeometry(hoseCurve, 32, 0.022, 8)), hoseMat);
  hoseTube.visible = false;
  scene.add(hoseTube);

  // The STORM SHELTER handle you look at from your seat (down and to your right)
  const shelterHandle = new THREE.Group();
  shelterHandle.position.set(0.28, 0.05, -0.05);
  scene.add(shelterHandle);
  const handleMat = track(new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.5, emissive: '#ffc145', emissiveIntensity: 0 }));
  const handleBar = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.03, 0.34, 6, 12)), handleMat);
  handleBar.rotation.z = Math.PI / 2;
  shelterHandle.add(handleBar);
  const shelterLabel = labelMesh(track, 'STORM SHELTER', { w: 0.5, h: 0.09, bg: '#1b1846', fg: '#ffc145' });
  shelterLabel.position.set(0, 0.12, 0);
  shelterLabel.rotation.x = -0.6;
  shelterHandle.add(shelterLabel);
  const shelterHit = hitBox(track, 0.6, 0.35, 0.35);
  shelterHandle.add(shelterHit);

  // ...and the BACK TO SEAT handle you see from inside the shelter
  const seatHandle = new THREE.Group();
  seatHandle.position.set(0.5, 0.25, 0.3);
  seatHandle.rotation.y = Math.PI / 2;
  scene.add(seatHandle);
  const seatBar = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.03, 0.28, 6, 12)), handleMat);
  seatBar.rotation.z = Math.PI / 2;
  seatHandle.add(seatBar);
  const seatLabel = labelMesh(track, 'BACK TO SEAT', { w: 0.42, h: 0.08, bg: '#1b1846', fg: '#fff3d6' });
  seatLabel.position.set(0, 0.11, 0);
  seatHandle.add(seatLabel);
  const seatHit = hitBox(track, 0.5, 0.32, 0.3);
  seatHandle.add(seatHit);

  // ---------- outside: stars, Earth, Moon, Sun, the steering target ----------
  // Everything outside lives in `sky`. Turning the ship = rotating the sky the other way.
  const sky = new THREE.Group();
  scene.add(sky);
  sky.add(starField(track));
  const sunDir = new THREE.Vector3(0.95, 0.15, -0.3).normalize();
  const planetShader = (tex, { atmosphere = 0 } = {}) =>
    track(
      new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, sunDir: { value: sunDir.clone() }, atmo: { value: atmosphere } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
          void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal);
          vec4 wp=modelMatrix*vec4(position,1.0); vView=normalize(cameraPosition-wp.xyz);
          gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float atmo; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
          void main(){ vec3 c=texture2D(map,vUv).rgb;
          vec3 n=normalize(vN); vec3 sdW=normalize(sunDir);
          float l=max(dot(n,sdW),0.0); vec3 col=c*(l*1.15+0.025);
          float rim=pow(1.0-max(dot(n,vView),0.0),3.0)*atmo; col+=vec3(0.35,0.6,1.0)*rim*(0.25+l);
          gl_FragColor=vec4(col,1.0); }`,
      }),
    );
  // The sky turns, so the planets' sun direction is kept in the sky's own space (see update()).
  const earthTex = track(earthTexture());
  const earth = new THREE.Mesh(track(new THREE.SphereGeometry(70, 64, 48)), planetShader(earthTex, { atmosphere: 1.3 }));
  earth.position.set(-330, -60, 130);
  earth.rotation.z = 0.4;
  sky.add(earth);
  const moonTex = track(moonTexture());
  const moon = new THREE.Mesh(track(new THREE.SphereGeometry(22, 48, 32)), planetShader(moonTex));
  sky.add(moon);
  const sunTex = track(glowTexture('#fff6df', '#ffb340'));
  const sun = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  sun.position.copy(sunDir).multiplyScalar(600);
  sun.scale.setScalar(140);
  sky.add(sun);
  const flashMat = track(new THREE.SpriteMaterial({ map: sunTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  const flare = new THREE.Sprite(flashMat);
  flare.position.copy(sun.position);
  flare.scale.setScalar(420);
  sky.add(flare);
  // the target: a green diamond where the burn should point
  const targetTex = track(diamondTexture());
  const target = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: targetTex, transparent: true, depthWrite: false })));
  target.scale.setScalar(16);
  sky.add(target);

  // ---------- reticle on the main window (where the ship points) ----------
  const reticle = new THREE.Group();
  reticle.position.copy(SEAT_EYE).addScaledVector(boresight, 1.55);
  reticle.lookAt(SEAT_EYE);
  scene.add(reticle);
  const reticleMat = track(new THREE.MeshBasicMaterial({ color: '#5bd98a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const ringRadius = Math.tan(0.07) * 1.55;
  const reticleRing = new THREE.Mesh(track(new THREE.RingGeometry(ringRadius * 0.92, ringRadius, 48)), reticleMat);
  reticle.add(reticleRing);
  for (let i = 0; i < 4; i++) {
    const tickM = new THREE.Mesh(track(new THREE.PlaneGeometry(0.004, 0.03)), reticleMat);
    const a = (i * Math.PI) / 2;
    tickM.position.set(Math.cos(a) * (ringRadius + 0.02), Math.sin(a) * (ringRadius + 0.02), 0);
    tickM.rotation.z = a + Math.PI / 2;
    reticle.add(tickM);
  }
  const arrowMat = track(new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.03);
  arrowShape.lineTo(0.045, -0.02);
  arrowShape.lineTo(0.015, -0.02);
  arrowShape.lineTo(0.015, -0.05);
  arrowShape.lineTo(-0.015, -0.05);
  arrowShape.lineTo(-0.015, -0.02);
  arrowShape.lineTo(-0.045, -0.02);
  arrowShape.closePath();
  const arrow = new THREE.Mesh(track(new THREE.ShapeGeometry(arrowShape)), arrowMat);
  arrow.visible = false;
  reticle.add(arrow);
  [reticleRing, arrow, ...reticle.children].forEach((m) => (m.renderOrder = 6));

  // ---------- light flashes (Apollo astronauts saw these when particles hit their eyes) ----------
  const specks = [];
  const speckMat = track(new THREE.SpriteMaterial({ map: track(glowTexture('#ffffff', '#9fc8ff')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(speckMat.clone());
    track(s.material);
    s.material.opacity = 0;
    s.scale.setScalar(0.015);
    s.renderOrder = 10;
    scene.add(s);
    specks.push({ sprite: s, life: 0 });
  }

  // ---------- things you can use (looked at + E) ----------
  const usable = {
    shelter: { hit: shelterHit, label: 'Float down to the *storm shelter*', glow: handleMat },
    seat: { hit: seatHit, label: 'Float back to your *seat*', glow: handleMat },
    hose: { hit: hoseHit, label: 'Plug in the *air hose*', glow: hoseMat },
    jet: { hit: jetHit, label: 'Flip the *JET RESET* switch', glow: jetLedMat },
  };
  bagList.forEach((b, i) => {
    const hit = hitBox(track, 0.44, 0.32, 0.26);
    b.group.add(hit);
    usable[`bag${i}`] = { hit, label: `Move the *${b.label.toLowerCase()} bag* to the thin wall`, glow: b.mat, bag: b };
  });

  // ---------- state the stage drives ----------
  const att = new THREE.Quaternion();
  const skyInv = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.4;
  let alarmLevel = 0; // 0 calm, 1 caution (yellow), 2 shelter now (red)
  let flashT = -1;
  let jetBlink = false;
  let speckRate = 0;
  let stickTilt = new THREE.Vector2();

  function setTargetDirection(dir) {
    target.position.copy(dir).multiplyScalar(300);
    moon.position.copy(dir).applyAxisAngle(new THREE.Vector3(0.3, 1, 0).normalize(), 0.12).multiplyScalar(420);
  }

  return {
    scene,
    boresight,
    windowInfo,
    screens,
    slots,
    bags: bagList,
    usable,
    hints,
    setTargetDirection,
    // the ship's attitude (where it points)
    setAttitude(q) {
      att.copy(q);
      skyInv.copy(q).invert();
      sky.quaternion.copy(skyInv);
    },
    // Where the target is, seen from the ship (unit vector in ship frame)
    targetInShip(out = new THREE.Vector3()) {
      return out.copy(target.position).normalize().applyQuaternion(skyInv);
    },
    // Point the guide arrow on the window toward the target when it's far off.
    setGuide(local, error) {
      // local: target direction in ship frame. Project into the window's plane.
      const right = tmp.set(1, 0, 0);
      const up = new THREE.Vector3().crossVectors(right, boresight).normalize();
      const x = local.dot(right);
      const y = local.dot(up);
      const show = error > 0.11;
      arrow.visible = show;
      if (show) {
        const a = Math.atan2(y, x);
        arrow.position.set(Math.cos(a) * (ringRadius + 0.07), Math.sin(a) * (ringRadius + 0.07), 0.001);
        arrow.rotation.z = a - Math.PI / 2;
      }
      reticleMat.color.set(error <= 0.07 ? '#5bd98a' : error <= 0.14 ? '#ffc145' : '#fff3d6');
    },
    setRingRadius(rad) {
      const r = Math.tan(rad) * 1.55;
      reticleRing.scale.setScalar(r / ringRadius);
    },
    setStick(x, y) {
      stickTilt.set(x, y);
    },
    flash() {
      flashT = 0;
    },
    setAlarm(level) {
      alarmLevel = level;
    },
    setJetBlink(on) {
      jetBlink = on;
    },
    setHose(on) {
      hoseTube.visible = on;
      coil.visible = !on;
    },
    setSpecks(rate) {
      speckRate = rate;
    },
    // Fill a slot with a bag (animated in update)
    sendBag(bag, slot) {
      bag.state = 'moving';
      bag.t = 0;
      bag.slot = slot;
      slot.filled = true;
      bag.from = new THREE.Vector3();
      bag.group.getWorldPosition(bag.from);
      locker.remove(bag.group);
      scene.add(bag.group);
      bag.group.position.copy(bag.from);
      bag.group.rotation.set(0, 0, 0);
    },
    // What's in the middle of the view (for E / click). Returns a key of `usable` or null.
    aimed(camera, enabledKeys) {
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const hits = [];
      for (const key of enabledKeys) {
        const u = usable[key];
        if (!u) continue;
        const h = raycaster.intersectObject(u.hit, false)[0];
        if (h) hits.push({ key, d: h.distance });
      }
      hits.sort((a, b) => a.d - b.d);
      return hits[0]?.key ?? null;
    },
    // Make the things you can use right now glow softly (several share a material, so decide per material).
    setGlow(keys, t) {
      const pulse = 0.35 + 0.35 * Math.sin(t * 5);
      const mats = new Map();
      for (const [key, u] of Object.entries(usable)) {
        if (key === 'jet' || !u.glow) continue;
        if (u.bag && u.bag.state !== 'stowed') continue;
        mats.set(u.glow, mats.get(u.glow) || keys.includes(key));
      }
      mats.forEach((on, m) => (m.emissiveIntensity = on ? pulse : 0));
    },
    update(t, dt, camera) {
      // planets are lit from the Sun's direction in sky space
      // (the shader reads the uniform in world space, so turn it with the sky)
      const sunWorld = sunDir.clone().applyQuaternion(sky.quaternion);
      earth.material.uniforms.sunDir.value.copy(sunWorld);
      moon.material.uniforms.sunDir.value.copy(sunWorld);
      earth.rotation.y += dt * 0.01;
      target.material.opacity = 0.75 + 0.25 * Math.sin(t * 4);

      // flare flash
      if (flashT >= 0) {
        flashT += dt;
        flashMat.opacity = Math.max(0, 1 - flashT / 2.2);
        ceiling.intensity = 7 + 16 * Math.max(0, 1 - flashT / 0.6);
        if (flashT > 2.2) flashT = -1;
      }
      // alarm light
      const target2 = alarmLevel === 2 ? (Math.sin(t * 7) > 0 ? 9 : 2) : alarmLevel === 1 ? 1.2 + Math.sin(t * 3) * 0.6 : 0;
      alarm.intensity += (target2 - alarm.intensity) * Math.min(1, dt * 12);
      alarm.color.set(alarmLevel === 1 ? '#ffb020' : '#ff3040');
      if (flashT < 0) ceiling.intensity += ((alarmLevel === 2 ? 3.5 : 7) - ceiling.intensity) * Math.min(1, dt * 3);
      // jet reset LED
      jetLedMat.emissiveIntensity = jetBlink ? (Math.sin(t * 9) > 0 ? 2.5 : 0.2) : 0;
      lever.rotation.x = jetBlink ? 0.6 : -0.6;
      // joystick follows your keys (eased, so it never snaps)
      stick.rotation.z += (-stickTilt.x * 0.35 - stick.rotation.z) * Math.min(1, dt * 10);
      stick.rotation.x += (-stickTilt.y * 0.35 - stick.rotation.x) * Math.min(1, dt * 10);

      // bags fly into the shelter
      for (const b of bagList) {
        if (b.state !== 'moving') continue;
        b.t = Math.min(1, b.t + dt / 0.9);
        const k = b.t * b.t * (3 - 2 * b.t);
        const to = b.slot.group.position;
        b.group.position.lerpVectors(b.from, to, k);
        b.group.position.y += Math.sin(k * Math.PI) * 0.18;
        b.group.rotation.y = THREE.MathUtils.lerp(0, b.slot.group.rotation.y, k);
        if (b.t >= 1) {
          b.state = 'placed';
          b.mat.emissiveIntensity = 0;
          b.slot.edges.visible = false;
          b.slot.glow.visible = false;
        }
      }
      for (const s of slots) if (!s.filled) s.glow.material.opacity = 0.08 + 0.08 * Math.sin(t * 4);

      // light flashes in your eyes during the particle storm
      for (const s of specks) {
        if (s.life > 0) {
          s.life -= dt;
          s.sprite.material.opacity = Math.max(0, s.life / 0.12);
        } else if (speckRate > 0 && Math.random() < speckRate * dt) {
          s.life = 0.12;
          camera.getWorldDirection(tmp);
          const right = new THREE.Vector3().crossVectors(tmp, camera.up).normalize();
          const upv = new THREE.Vector3().crossVectors(right, tmp).normalize();
          s.sprite.position
            .copy(camera.position)
            .addScaledVector(tmp, 0.3)
            .addScaledVector(right, (Math.random() - 0.5) * 0.36)
            .addScaledVector(upv, (Math.random() - 0.5) * 0.22);
          s.sprite.scale.setScalar(0.004 + Math.random() * 0.006);
        }
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
      });
    },
  };
}

// ---------- helpers ----------

// Where a window sits on the cone, and which way its glass faces (into the cabin).
function windowPlacement({ phi, y0, y1, half }) {
  const y = (y0 + y1) / 2;
  const r = radiusAt(y);
  const center = new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi));
  // slope of the wall at this height
  const [ra, rb, ya, yb] = segmentAt(y);
  const dr = rb - ra;
  const dy = yb - ya;
  const len = Math.hypot(dr, dy);
  const nr = -dy / len; // inward (towards the middle)
  const ny = dr / len; // (negative = facing down)
  const normal = new THREE.Vector3(nr * Math.sin(phi), ny, nr * Math.cos(phi)).normalize();
  const width = 2 * half * r;
  const height = ((y1 - y0) / dy) * len;
  return { center, normal, width, height, phi, y0, y1, half };
}
function segmentAt(y) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [ra, ya] = PROFILE[i];
    const [rb, yb] = PROFILE[i + 1];
    if (y >= ya && y <= yb) return [ra, rb, ya, yb];
  }
  return [PROFILE[0][0], PROFILE[1][0], PROFILE[0][1], PROFILE[1][1]];
}
function radiusAt(y) {
  const [ra, rb, ya, yb] = segmentAt(y);
  return ra + ((rb - ra) * (y - ya)) / (yb - ya);
}
// LatheGeometry's v runs evenly by outline point, so a height maps to v piece by piece.
function vAt(y) {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const ya = PROFILE[i][1];
    const yb = PROFILE[i + 1][1];
    if (y >= ya && y <= yb) return (i + (y - ya) / (yb - ya)) / (PROFILE.length - 1);
  }
  return 0;
}

function windowAlphaTexture() {
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#000';
  for (const w of WINDOWS) {
    const u = w.phi / (Math.PI * 2);
    const du = w.half / (Math.PI * 2);
    const x0 = (u - du) * W;
    const x1 = (u + du) * W;
    const yTop = (1 - vAt(w.y1)) * H;
    const yBot = (1 - vAt(w.y0)) * H;
    roundRect(g, x0, yTop, x1 - x0, yBot - yTop, 18);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

// A rounded-rectangle ring (window frames, screen bezels)
function frameGeometry(w, h, border, depth) {
  const s = new THREE.Shape();
  roundRectPath(s, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
  const hole = new THREE.Path();
  roundRectPath(hole, -w / 2 + border, -h / 2 + border, w - border * 2, h - border * 2, Math.min(w, h) * 0.12);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
}
function roundRectPath(p, x, y, w, h, r) {
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// An invisible box that catches the "what am I looking at" ray
function hitBox(track, w, h, d) {
  const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), track(new THREE.MeshBasicMaterial({ visible: false })));
  return m;
}

function labelMesh(track, text, { w, h, bg, fg }) {
  const c = document.createElement('canvas');
  const scale = 512 / w;
  c.width = 512;
  c.height = Math.max(32, Math.round(h * scale));
  const g = c.getContext('2d');
  g.fillStyle = bg;
  roundRect(g, 0, 0, c.width, c.height, c.height * 0.25);
  g.fill();
  g.fillStyle = fg;
  g.font = `${Math.round(c.height * 0.62)}px "Lilita One", "Atkinson Hyperlegible", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height * 0.54, c.width - 24);
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })));
}

// Padded, quilted cabin wall
function quiltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 80);
  grad.addColorStop(0, '#f4f5f7');
  grad.addColorStop(1, '#b9bec7');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8d939e';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 125, 125);
  g.strokeStyle = 'rgba(120,126,138,0.6)';
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.strokeRect(8, 8, 112, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#ffc145';
  g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#1b1b1b';
  for (let x = -16; x < 64; x += 16) {
    g.beginPath();
    g.moveTo(x, 16);
    g.lineTo(x + 8, 0);
    g.lineTo(x + 16, 0);
    g.lineTo(x + 8, 16);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.12, inner);
  grad.addColorStop(0.3, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function diamondTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#5bd98a';
  g.lineWidth = 10;
  g.shadowColor = '#5bd98a';
  g.shadowBlur = 16;
  g.beginPath();
  g.moveTo(64, 14);
  g.lineTo(114, 64);
  g.lineTo(64, 114);
  g.lineTo(14, 64);
  g.closePath();
  g.stroke();
  g.fillStyle = '#5bd98a';
  g.beginPath();
  g.arc(64, 64, 8, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function starField(track) {
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 900, u * 900, Math.sin(a) * s * 900], i * 3);
    c.setHSL(0.55 + Math.random() * 0.12, 0.4, 0.55 + Math.random() * 0.45);
    if (Math.random() < 0.1) c.setHSL(0.08, 0.7, 0.75);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = track(new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  return new THREE.Points(geo, mat);
}
// Earth from space: oceans, land, ice caps and clouds (made up shapes, painted in the browser)
function earthTexture() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sea = g.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#1d4f8f');
  sea.addColorStop(0.5, '#1f6fb8');
  sea.addColorStop(1, '#1d4f8f');
  g.fillStyle = sea;
  g.fillRect(0, 0, W, H);
  const rand = mulberry(7);
  const blob = (x, y, r, color) => {
    g.fillStyle = color;
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.ellipse(x + (rand() - 0.5) * r * 1.6, y + (rand() - 0.5) * r, r * (0.3 + rand() * 0.5), r * (0.2 + rand() * 0.35), rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  };
  [
    [220, 170, 70],
    [260, 300, 60],
    [520, 160, 80],
    [560, 290, 70],
    [760, 180, 90],
    [820, 340, 50],
  ].forEach(([x, y, r]) => {
    blob(x, y, r, '#3c7a3a');
    blob(x + 10, y + 6, r * 0.6, '#8a7a4a');
  });
  g.fillStyle = '#eef4fa';
  g.fillRect(0, 0, W, 26);
  g.fillRect(0, H - 30, W, 30);
  g.globalAlpha = 0.55;
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 160; i++) {
    g.beginPath();
    g.ellipse(rand() * W, 40 + rand() * (H - 80), 20 + rand() * 60, 4 + rand() * 9, rand() * 0.4 - 0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function moonTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#9b9a96';
  g.fillRect(0, 0, W, H);
  const rand = mulberry(3);
  g.fillStyle = '#6f6e6b';
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    g.ellipse(rand() * W, 40 + rand() * (H - 80), 20 + rand() * 50, 14 + rand() * 30, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 1.5 + rand() * rand() * 12;
    g.fillStyle = 'rgba(60,60,58,0.45)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(210,210,205,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x - r * 0.15, y - r * 0.15, r, Math.PI * 0.9, Math.PI * 1.9);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
