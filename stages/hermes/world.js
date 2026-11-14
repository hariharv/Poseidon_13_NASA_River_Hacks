// The Neutral Buoyancy Lab, built from simple shapes.
// Real pool: 202 x 102 x 40 ft (about 62 x 31 x 12 m). One unit = one metre.

import * as THREE from 'three';
import { tilesTexture, causticsTexture, beamTexture, dotTexture, solarTexture, labelTexture } from './textures.js';

export const POOL = { halfX: 31, halfZ: 15.5, depth: 12 };

// Where the broken panels are. The judge demo only uses the first one.
export const PANEL_SPOTS = [
  { pos: [-6, 5.6, 0.27], normal: [0, 0, 1] }, // side of the lab module
  { pos: [18, 10.36, -2], normal: [0, 1, 0] }, // top of the truss (swim up!)
  { pos: [0, 5.5, -10.07], normal: [0, 0, -1] }, // back of the node (swim around!)
];

// The air station is in view on your right at the start, but off the path to Panel 1 (no free refill on the way).
export const AIR_STATION = new THREE.Vector3(9.5, 4.5, 8.8);
export const SPAWN = { pos: new THREE.Vector3(6, 4.7, 13.4), yaw: 0.05 };

const WATER = new THREE.Color('#0b5d7c');

export function buildWorld({ hints = 'more', panelCount = 3 }) {
  const scene = new THREE.Scene();
  scene.background = WATER;
  scene.fog = new THREE.FogExp2(WATER, 0.042);

  const colliders = [];
  const animators = [];

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight('#b6f3ff', '#073047', 1.7));
  const sun = new THREE.DirectionalLight('#e8fcff', 1.5);
  sun.position.set(8, 30, 10);
  scene.add(sun);

  // ---------- pool ----------
  const floorTiles = tilesTexture();
  floorTiles.repeat.set(31, 15.5);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(POOL.halfX * 2, POOL.halfZ * 2),
    new THREE.MeshStandardMaterial({ map: floorTiles, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // lane stripes on the floor help you feel how fast you're moving
  const stripeMat = new THREE.MeshBasicMaterial({ color: '#174a63' });
  for (const z of [-9, 0, 9]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(POOL.halfX * 2 - 4, 0.45), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.01, z);
    scene.add(stripe);
  }

  // two layers of caustics sliding past each other
  const causticLayers = [
    { repeat: [9, 4.5], speed: [0.012, 0.006], opacity: 0.42 },
    { repeat: [6.3, 3.1], speed: [-0.008, 0.01], opacity: 0.3 },
  ].map(({ repeat, speed, opacity }, i) => {
    const map = causticsTexture(repeat);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(POOL.halfX * 2, POOL.halfZ * 2),
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02 + i * 0.01;
    scene.add(mesh);
    animators.push((t) => map.offset.set(t * speed[0], t * speed[1]));
    return mesh;
  });
  void causticLayers;

  // walls
  const wallMat = (w) => {
    const map = tilesTexture('#bfe6ee', '#86b9c6');
    map.repeat.set(w / 2, POOL.depth / 2);
    return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
  };
  const walls = [
    { w: POOL.halfX * 2, pos: [0, 6, -POOL.halfZ], rotY: 0 },
    { w: POOL.halfX * 2, pos: [0, 6, POOL.halfZ], rotY: Math.PI },
    { w: POOL.halfZ * 2, pos: [-POOL.halfX, 6, 0], rotY: Math.PI / 2 },
    { w: POOL.halfZ * 2, pos: [POOL.halfX, 6, 0], rotY: -Math.PI / 2 },
  ];
  for (const { w, pos, rotY } of walls) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, POOL.depth), wallMat(w));
    wall.position.set(...pos);
    wall.rotation.y = rotY;
    scene.add(wall);
  }

  // the bright, wobbly water surface above you
  const surfaceMap = causticsTexture([5, 2.5]);
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(POOL.halfX * 2, POOL.halfZ * 2),
    new THREE.MeshBasicMaterial({ color: '#7fdcf2', map: surfaceMap, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  surface.rotation.x = Math.PI / 2;
  surface.position.y = POOL.depth;
  scene.add(surface);
  animators.push((t) => surfaceMap.offset.set(t * 0.01, -t * 0.007));

  // light shafts from the surface
  const shaftTex = beamTexture();
  const shafts = [];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: shaftTex,
      color: '#cff8ff',
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.4 + (i % 3), POOL.depth), mat);
    shaft.position.set(-24 + i * 6 + ((i * 7) % 5), POOL.depth / 2, -10 + ((i * 11) % 20));
    shafts.push(shaft);
    scene.add(shaft);
  }
  animators.push((t, camera) => {
    shafts.forEach((s, i) => {
      s.rotation.y = Math.atan2(camera.position.x - s.position.x, camera.position.z - s.position.z);
      s.material.opacity = 0.07 + 0.04 * Math.sin(t * 0.6 + i * 1.7);
    });
  });

  // ---------- the pretend space station ----------
  const white = new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.55, metalness: 0.08 });
  const beige = new THREE.MeshStandardMaterial({ color: '#d8ceb4', roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: '#aab3bd', roughness: 0.45, metalness: 0.5 });
  const rail = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5, metalness: 0.2 });
  const standMat = new THREE.MeshStandardMaterial({ color: '#5c6d7b', roughness: 0.6, metalness: 0.4 });

  function moduleX(x0, x1, y, z, r, mat) {
    const len = x1 - x0;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), mat);
    body.rotation.z = Math.PI / 2;
    body.position.set((x0 + x1) / 2, y, z);
    scene.add(body);
    for (let x = x0 + 1.3; x < x1; x += 2.6) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.06, 8, 48), metal);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(x, y, z);
      scene.add(rib);
    }
    colliders.push({ kind: 'seg', a: new THREE.Vector3(x0, y, z), b: new THREE.Vector3(x1, y, z), r });
  }

  function moduleZ(z0, z1, x, y, r, mat) {
    const len = z1 - z0;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), mat);
    body.rotation.x = Math.PI / 2;
    body.position.set(x, y, (z0 + z1) / 2);
    scene.add(body);
    for (let z = z0 + 1.2; z < z1 - 0.5; z += 2.4) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.06, 8, 48), metal);
      rib.position.set(x, y, z);
      scene.add(rib);
    }
    colliders.push({ kind: 'seg', a: new THREE.Vector3(x, y, z0), b: new THREE.Vector3(x, y, z1), r });
  }

  moduleX(-13, 13, 5.5, -2, 2.2, white); // lab module
  moduleX(13, 21, 5.5, -2, 1.6, beige); // smaller module
  moduleZ(-10, -2, 0, 5.5, 1.9, white); // node, sticking out the back

  // end domes
  for (const [x, r, mat] of [[-13, 2.2, white], [21, 1.6, beige]]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), mat);
    dome.scale.set(0.35, 1, 1);
    dome.position.set(x, 5.5, -2);
    scene.add(dome);
  }

  // stands holding the mock-up off the floor
  for (const x of [-10, -3, 4, 11, 18]) {
    for (const z of [-3.1, -0.9]) {
      const h = 3.6;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, h, 12), standMat);
      leg.position.set(x, h / 2, z);
      scene.add(leg);
      colliders.push({ kind: 'seg', a: new THREE.Vector3(x, 0, z), b: new THREE.Vector3(x, h, z), r: 0.2 });
    }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 3.4), standMat);
    foot.position.set(x, 0.06, -2);
    scene.add(foot);
  }

  // truss across the top
  const trussY = 9.6;
  const trussZ = -2;
  const half = 0.7;
  for (const dy of [-half, half]) {
    for (const dz of [-half, half]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(44, 0.12, 0.12), metal);
      beam.position.set(0, trussY + dy, trussZ + dz);
      scene.add(beam);
    }
  }
  const crossGeo = new THREE.BoxGeometry(0.09, 1.4, 0.09);
  const crossCount = 23 * 4;
  const cross = new THREE.InstancedMesh(crossGeo, metal, crossCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let ci = 0;
  for (let i = 0; i < 23; i++) {
    const x = -22 + i * 2;
    for (const dz of [-half, half]) {
      m.compose(new THREE.Vector3(x, trussY, trussZ + dz), q.identity(), new THREE.Vector3(1, 1, 1));
      cross.setMatrixAt(ci++, m);
    }
    for (const dy of [-half, half]) {
      m.compose(
        new THREE.Vector3(x, trussY + dy, trussZ),
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
        new THREE.Vector3(1, 1, 1),
      );
      cross.setMatrixAt(ci++, m);
    }
  }
  scene.add(cross);
  colliders.push({ kind: 'box', min: new THREE.Vector3(-22, trussY - half, trussZ - half), max: new THREE.Vector3(22, trussY + half, trussZ + half) });

  // struts from the module up to the truss
  for (const x of [-7, 7]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 10), metal);
    strut.position.set(x, 8.2, trussZ);
    scene.add(strut);
  }

  // solar array mock-ups at the truss ends
  const solarMat = new THREE.MeshStandardMaterial({ map: solarTexture(), roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  for (const x of [-23, 23]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), solarMat);
    wing.rotation.y = Math.PI / 2;
    wing.position.set(x, 9.6, -2);
    scene.add(wing);
    colliders.push({ kind: 'box', min: new THREE.Vector3(x - 0.15, 8.1, -10), max: new THREE.Vector3(x + 0.15, 11.1, 6) });
  }

  // yellow handrails, like the real station
  const railGeo = new THREE.BoxGeometry(0.9, 0.05, 0.05);
  const rails = new THREE.InstancedMesh(railGeo, rail, 40);
  let ri = 0;
  for (let x = -11.5; x <= 11.5; x += 2.3) {
    for (const angle of [Math.PI / 2, Math.PI / 4]) {
      const r = 2.36;
      m.compose(new THREE.Vector3(x, 5.5 + Math.sin(angle) * r, -2 + Math.cos(angle) * r), q.identity(), new THREE.Vector3(1, 1, 1));
      rails.setMatrixAt(ri++, m);
    }
  }
  rails.count = ri;
  scene.add(rails);

  // ---------- air station ----------
  const air = buildAirStation(scene, hints);
  colliders.push({ kind: 'seg', a: new THREE.Vector3(AIR_STATION.x, 0, AIR_STATION.z), b: new THREE.Vector3(AIR_STATION.x, 4.2, AIR_STATION.z), r: 0.32 });
  animators.push(air.update);

  // ---------- broken panels ----------
  const panels = PANEL_SPOTS.slice(0, panelCount).map((spot, i) => buildPanel(scene, spot, i, hints));
  animators.push((t) => panels.forEach((p) => p.update(t)));

  // ---------- safety divers ----------
  const divers = [
    buildDiver(scene, new THREE.Vector3(-7.5, 3.2, 3.6), 0.4),
    buildDiver(scene, new THREE.Vector3(13, 8.4, 2.6), 2.2),
  ];
  animators.push((t) => divers.forEach((d) => d.update(t)));

  // ---------- floating specks (so you can feel yourself move) ----------
  const specks = buildSpecks(scene);
  animators.push((t, camera) => specks.update(camera));

  return {
    scene,
    colliders,
    panels,
    air,
    divers,
    update(t, camera) {
      for (const fn of animators) fn(t, camera);
    },
    dispose() {
      disposeTree(scene);
    },
  };
}

function buildAirStation(scene, hints) {
  const group = new THREE.Group();
  group.position.copy(AIR_STATION);
  scene.add(group);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, AIR_STATION.y, 14),
    new THREE.MeshStandardMaterial({ color: '#41607a', roughness: 0.5, metalness: 0.4 }),
  );
  pillar.position.y = -AIR_STATION.y / 2;
  group.add(pillar);

  const sign = labelTexture({ text: 'AIR', sub: 'refill here', bg: '#1a6fb0', w: 256, h: 160 });
  const plain = new THREE.MeshStandardMaterial({ color: '#1a6fb0', roughness: 0.5 });
  const face = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.5, emissive: '#0a3a66', emissiveIntensity: 0.6 });
  const hub = new THREE.Mesh(new THREE.BoxGeometry(1, 0.62, 0.62), [plain, plain, plain, plain, face, face]);
  group.add(hub);

  const ringMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff' });
  // an upright hoop around the hub, facing where you start: "swim through here"
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 12, 56), ringMat);
  group.add(ring);

  // the refill zone: a soft glowing bubble you can swim into
  const zoneMat = new THREE.MeshBasicMaterial({
    color: '#5fd0ff',
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const zone = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 16), zoneMat);
  group.add(zone);

  // a blue beam so you can always find your way back
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTexture(),
    color: '#5fd0ff',
    transparent: true,
    opacity: hints === 'more' ? 0.28 : 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beamH = 12 - AIR_STATION.y;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, beamH, 20, 1, true), beamMat);
  beam.position.y = beamH / 2;
  group.add(beam);

  // hose curling down to the floor
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.2, -0.2, -0.3),
        new THREE.Vector3(0.9, -1.3, -1.1),
        new THREE.Vector3(0.7, -3.2, -1.8),
        new THREE.Vector3(1.8, -4.4, -2.6),
      ]),
      32,
      0.07,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.6 }),
  );
  group.add(hose);

  const state = { active: false, low: false };
  return {
    position: AIR_STATION,
    state,
    update(t) {
      const glow = state.active ? 1 : 0.55 + 0.25 * Math.sin(t * 2);
      ringMat.color.setHSL(0.54, 0.9, 0.55 + glow * 0.2);
      zoneMat.opacity = state.active ? 0.14 : 0.05 + 0.02 * Math.sin(t * 2);
      const base = hints === 'more' ? 0.28 : 0.16;
      beamMat.opacity = state.low ? base + 0.25 + 0.2 * Math.sin(t * 6) : base;
      ring.scale.setScalar(state.active ? 1 + 0.05 * Math.sin(t * 8) : 1);
    },
  };
}

function buildPanel(scene, spot, index, hints) {
  const group = new THREE.Group();
  const pos = new THREE.Vector3(...spot.pos);
  const normal = new THREE.Vector3(...spot.normal);
  group.position.copy(pos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  scene.add(group);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.05, 0.12),
    new THREE.MeshStandardMaterial({ color: '#c3cad2', roughness: 0.4, metalness: 0.5 }),
  );
  group.add(frame);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.85),
    new THREE.MeshStandardMaterial({
      map: labelTexture({ text: `PANEL ${index + 1}`, sub: 'needs fixing', stripes: true }),
      roughness: 0.6,
    }),
  );
  face.position.z = 0.065;
  group.add(face);

  const boltOut = new THREE.MeshStandardMaterial({ color: '#ff4d5e', roughness: 0.4, metalness: 0.3, emissive: '#5a0a12' });
  const boltIn = new THREE.MeshStandardMaterial({ color: '#d7dde3', roughness: 0.3, metalness: 0.8 });
  const bolts = [-0.42, 0, 0.42].map((x) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 6), boltOut);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(x, -0.26, 0.17);
    group.add(bolt);
    return bolt;
  });

  // a loose cover flap that snaps shut when the panel is fixed
  const flapPivot = new THREE.Group();
  flapPivot.position.set(-0.62, 0.36, 0.1);
  const flap = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.32, 0.03),
    new THREE.MeshStandardMaterial({ color: '#9aa4ae', roughness: 0.5, metalness: 0.5 }),
  );
  flap.position.set(0.28, -0.16, 0);
  flapPivot.add(flap);
  flapPivot.rotation.z = -0.7;
  group.add(flapPivot);

  const ledMat = new THREE.MeshBasicMaterial({ color: '#ff4d5e' });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), ledMat);
  led.position.set(0.56, 0.33, 0.1);
  group.add(led);

  // beacon: a light beam rising from the panel, visible through the haze
  const beaconBase = pos.clone().addScaledVector(normal, 0.9);
  const beamH = 12 - beaconBase.y;
  const beamMap = beamTexture();
  beamMap.repeat.y = -1; // brightest near the panel
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamMap,
    color: '#ff5b6a',
    transparent: true,
    opacity: hints === 'more' ? 0.42 : 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.18, beamH, 18, 1, true), beamMat);
  beacon.position.set(beaconBase.x, beaconBase.y + beamH / 2, beaconBase.z);
  scene.add(beacon);

  let fixedAt = null;
  const panel = {
    index,
    position: pos,
    normal,
    work: 0, // 0-1
    fixed: false,
    boltsDone: 0,
    setWork(work) {
      panel.work = Math.min(1, work);
      const done = Math.floor(panel.work * 3 + 1e-6);
      bolts.forEach((b, i) => {
        // each bolt screws in during its third of the job
        const k = THREE.MathUtils.clamp(panel.work * 3 - i, 0, 1);
        b.position.z = 0.17 - k * 0.09;
        b.rotation.y = k * Math.PI * 6;
        b.material = k >= 1 ? boltIn : boltOut;
      });
      panel.boltsDone = done;
      flapPivot.rotation.z = -0.7 * (1 - THREE.MathUtils.smoothstep(panel.work, 0.6, 1));
    },
    markFixed(t) {
      panel.fixed = true;
      fixedAt = t;
      ledMat.color.set('#5bd98a');
      beamMat.color.set('#5bd98a');
    },
    update(t) {
      if (!panel.fixed) {
        ledMat.color.set(Math.sin(t * 6) > 0 ? '#ff4d5e' : '#5a0a12');
        const base = hints === 'more' ? 0.42 : 0.2;
        beamMat.opacity = base + 0.08 * Math.sin(t * 3 + index);
      } else {
        // green beam fades away after the fix
        const since = t - fixedAt;
        beamMat.opacity = Math.max(0, 0.5 - since * 0.25);
        beacon.visible = beamMat.opacity > 0;
      }
    },
  };
  return panel;
}

function buildDiver(scene, home, phase) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: '#1f262d', roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), suit);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.62, 12), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.4 }));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0.05, 0.25, 0);
  group.add(tank);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), suit);
  head.position.set(0.75, 0.05, 0);
  group.add(head);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.22), new THREE.MeshStandardMaterial({ color: '#7fe0ff', roughness: 0.1, metalness: 0.6 }));
  mask.position.set(0.9, 0.07, 0);
  group.add(mask);
  const fins = [-0.1, 0.1].map((z) => {
    const pivot = new THREE.Group();
    pivot.position.set(-0.75, 0, z);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.16), new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.6 }));
    fin.position.x = -0.22;
    pivot.add(fin);
    group.add(pivot);
    return pivot;
  });
  group.position.copy(home);
  scene.add(group);

  return {
    group,
    update(t) {
      const a = t * 0.25 + phase;
      group.position.set(home.x + Math.cos(a) * 1.2, home.y + Math.sin(t * 0.8 + phase) * 0.25, home.z + Math.sin(a) * 0.8);
      group.rotation.y = -a + Math.PI / 2;
      fins.forEach((f, i) => (f.rotation.z = Math.sin(t * 4 + i * Math.PI) * 0.35));
    },
    get mouth() {
      return group.localToWorld(new THREE.Vector3(0.95, 0.15, 0));
    },
  };
}

function buildSpecks(scene) {
  const count = 700;
  const size = new THREE.Vector3(34, 14, 34);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base[i * 3] = Math.random() * size.x;
    base[i * 3 + 1] = Math.random() * size.y;
    base[i * 3 + 2] = Math.random() * size.z;
  }
  const positions = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: dotTexture(),
    color: '#d9fbff',
    size: 0.07,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return {
    update(camera) {
      const c = camera.position;
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < 3; k++) {
          const s = size.getComponent(k);
          const cc = c.getComponent(k);
          let p = (base[i * 3 + k] - cc) % s;
          if (p < -s / 2) p += s;
          if (p > s / 2) p -= s;
          positions[i * 3 + k] = cc + p;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function disposeTree(root) {
  const textures = new Set();
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const mat of mats) {
      for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
      mat.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}
