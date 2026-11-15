// My 3D astronaut, built from simple shapes so it needs no model files.
// Used by the homepage now; checkpoint ceremonies and the mission report can reuse it.
// One unit = one metre; the astronaut stands on y = 0 and faces +z.

import * as THREE from 'three';

export const SUITS = [
  { id: 'orange', label: 'Rescue orange', hex: '#ff6a2b' },
  { id: 'white', label: 'Classic white', hex: '#eef1f4' },
  { id: 'blue', label: 'Ocean blue', hex: '#3d7bff' },
  { id: 'purple', label: 'Galaxy purple', hex: '#8a5cff' },
  { id: 'green', label: 'Rocket green', hex: '#3fcf74' },
  { id: 'pink', label: 'Comet pink', hex: '#ff6fae' },
];
export const VISORS = [
  { id: 'gold', label: 'Gold', hex: '#e9a826' },
  { id: 'silver', label: 'Silver', hex: '#c9d2dc' },
  { id: 'blue', label: 'Blue', hex: '#2f6bff' },
];
export const BOOTS = [
  { id: 'classic', label: 'Classic', note: 'White moon boots' },
  { id: 'moonwalker', label: 'Moonwalker', note: 'Chunky with orange soles' },
  { id: 'rocket', label: 'Rocket', note: 'Gold with little fins' },
];
export const BACKPACKS = [
  { id: 'classic', label: 'Classic', note: 'Life-support pack' },
  { id: 'jetpack', label: 'Jet pack', note: 'Twin thrusters' },
  { id: 'spacecat', label: 'Space cat', note: 'Meow!' },
];

const find = (list, id) => list.find((x) => x.id === id) ?? list[0];

export function createAstronaut(player) {
  const root = new THREE.Group();
  let body = null;
  let jets = [];
  let tail = null;
  const textures = new Set();

  function build(p) {
    if (body) {
      root.remove(body);
      disposeTree(body);
      textures.forEach((t) => t.dispose());
      textures.clear();
    }
    body = new THREE.Group();
    root.add(body);
    jets = [];
    tail = null;

    const suit = new THREE.MeshStandardMaterial({ color: find(SUITS, p.suit).hex, roughness: 0.72 });
    const trim = new THREE.MeshStandardMaterial({ color: '#c3cad2', roughness: 0.35, metalness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6 });
    const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // ---------- legs and boots ----------
    const boots = find(BOOTS, p.boots).id;
    for (const side of [-1, 1]) {
      add(new THREE.CapsuleGeometry(0.12, 0.42, 6, 14), suit, side * 0.14, 0.58, 0);
      add(new THREE.TorusGeometry(0.125, 0.025, 8, 20), trim, side * 0.14, 0.62, 0).rotation.x = Math.PI / 2;
      buildBoot(side, boots, add);
    }

    // ---------- body ----------
    const torso = add(new THREE.CapsuleGeometry(0.28, 0.42, 8, 18), suit, 0, 1.18, 0);
    torso.scale.set(1, 1, 0.78);
    add(new THREE.TorusGeometry(0.27, 0.03, 8, 28), trim, 0, 0.92, 0).rotation.x = Math.PI / 2;
    // chest control box
    const box = add(new THREE.BoxGeometry(0.26, 0.16, 0.08), white, 0, 1.12, 0.22);
    box.rotation.x = -0.08;
    ['#ff4d5e', '#ffc145', '#5bd98a'].forEach((c, i) => add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), new THREE.MeshBasicMaterial({ color: c }), -0.07 + i * 0.07, 1.14, 0.265).rotation.x = Math.PI / 2);

    // name tag over the heart
    const tagTex = nameTexture(p.name);
    textures.add(tagTex);
    const tag = add(new THREE.PlaneGeometry(0.24, 0.085), new THREE.MeshBasicMaterial({ map: tagTex }), -0.12, 1.34, 0.226);
    tag.rotation.y = -0.25;


    // ---------- arms and gloves ----------
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.36, 1.42, 0);
      shoulder.rotation.z = side * 0.32;
      body.add(shoulder);
      add(new THREE.SphereGeometry(0.12, 16, 12), suit, 0, 0, 0, shoulder);
      add(new THREE.CapsuleGeometry(0.095, 0.42, 6, 14), suit, 0, -0.28, 0, shoulder);
      add(new THREE.TorusGeometry(0.1, 0.022, 8, 20), trim, 0, -0.5, 0, shoulder).rotation.x = Math.PI / 2;
      buildGlove(boots, shoulder, add);
    }

    // ---------- helmet ----------
    const head = new THREE.Group();
    head.position.set(0, 1.82, 0);
    body.add(head);
    add(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 24), trim, 0, -0.24, 0, head);
    add(new THREE.SphereGeometry(0.29, 32, 24), white, 0, 0, 0, head);
    add(
      new THREE.SphereGeometry(0.295, 32, 24, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.26, Math.PI * 0.4),
      new THREE.MeshStandardMaterial({ color: find(VISORS, p.visor).hex, metalness: 1, roughness: 0.12 }),
      0,
      0,
      0,
      head,
    );
    add(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffc145' }), 0.2, 0.17, 0.12, head); // helmet light
    head.rotation.x = -0.05;

    // ---------- backpack ----------
    buildBackpack(find(BACKPACKS, p.backpack).id, suit, white, trim, dark, add);
  }

  function buildBoot(side, style, add) {
    const x = side * 0.14;
    if (style === 'moonwalker') {
      add(new THREE.BoxGeometry(0.22, 0.2, 0.34), new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.7 }), x, 0.16, 0.04);
      add(new THREE.BoxGeometry(0.24, 0.07, 0.37), new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.6 }), x, 0.035, 0.05);
    } else if (style === 'rocket') {
      const gold = new THREE.MeshStandardMaterial({ color: '#ffc145', roughness: 0.3, metalness: 0.7 });
      add(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 18), gold, x, 0.15, 0);
      add(new THREE.BoxGeometry(0.2, 0.06, 0.3), gold, x, 0.03, 0.05);
      const fin = add(new THREE.ConeGeometry(0.06, 0.16, 4), new THREE.MeshStandardMaterial({ color: '#ff4d5e' }), x + side * 0.12, 0.14, -0.06);
      fin.rotation.z = side * -0.5;
    } else {
      const w = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.7 });
      add(new THREE.CylinderGeometry(0.125, 0.135, 0.24, 18), w, x, 0.15, 0);
      add(new THREE.BoxGeometry(0.2, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: '#6c7681', roughness: 0.8 }), x, 0.03, 0.05);
    }
  }

  function buildGlove(style, shoulder, add) {
    const colour = style === 'rocket' ? '#ffc145' : style === 'moonwalker' ? '#9aa3ad' : '#f3f4f2';
    const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: style === 'rocket' ? 0.3 : 0.7, metalness: style === 'rocket' ? 0.6 : 0 });
    const hand = add(new THREE.SphereGeometry(1, 16, 12), mat, 0, -0.6, 0.01, shoulder);
    hand.scale.set(0.085, 0.1, 0.07);
    if (style === 'moonwalker') add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), new THREE.MeshStandardMaterial({ color: '#ff5b1f' }), 0, -0.52, 0, shoulder);
  }

  function buildBackpack(style, suit, white, trim, dark, add) {
    if (style === 'jetpack') {
      for (const side of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 18), trim, side * 0.12, 1.2, -0.32);
        add(new THREE.SphereGeometry(0.09, 16, 10), new THREE.MeshStandardMaterial({ color: '#ff5b1f', roughness: 0.4 }), side * 0.12, 1.45, -0.32);
        add(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 14), dark, side * 0.12, 0.92, -0.32);
        const flame = add(new THREE.ConeGeometry(0.06, 0.22, 14), new THREE.MeshBasicMaterial({ color: '#ffc145', transparent: true, opacity: 0.85 }), side * 0.12, 0.76, -0.32);
        flame.rotation.x = Math.PI;
        jets.push(flame);
      }
      add(new THREE.BoxGeometry(0.16, 0.36, 0.1), dark, 0, 1.2, -0.27);
    } else if (style === 'spacecat') {
      const fur = new THREE.MeshStandardMaterial({ color: '#7d6bb0', roughness: 0.85 });
      const pack = add(new THREE.SphereGeometry(0.24, 24, 18), fur, 0, 1.22, -0.34);
      pack.scale.set(1, 1.05, 0.62);
      for (const side of [-1, 1]) {
        const ear = add(new THREE.ConeGeometry(0.07, 0.14, 4), fur, side * 0.13, 1.47, -0.34);
        ear.rotation.z = side * -0.35;
        add(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#7CF0FF' }), side * 0.08, 1.27, -0.485);
        for (const k of [-1, 1]) {
          const whisker = add(new THREE.BoxGeometry(0.12, 0.006, 0.006), white, side * 0.15, 1.18 + k * 0.02, -0.48);
          whisker.rotation.z = side * k * 0.15;
        }
      }
      add(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff6fae' }), 0, 1.2, -0.49);
      tail = add(new THREE.TorusGeometry(0.12, 0.03, 8, 20, Math.PI * 1.3), fur, 0.18, 0.98, -0.36);
      tail.rotation.set(0, Math.PI / 2, 0.4);
    } else {
      add(new THREE.BoxGeometry(0.5, 0.6, 0.22), white, 0, 1.2, -0.32);
      add(new THREE.BoxGeometry(0.42, 0.08, 0.24), trim, 0, 1.44, -0.32);
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.3, 0.025, 0.01), dark, 0, 1.06 + i * 0.06, -0.435);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), suit, -0.2, 1.62, -0.3);
    }
  }

  build(player);

  return {
    group: root,
    update(p) {
      build(p);
    },
    tick(t) {
      jets.forEach((j, i) => {
        j.scale.set(1, 0.8 + 0.35 * Math.abs(Math.sin(t * 18 + i * 1.7)), 1);
      });
      if (tail) tail.rotation.z = 0.4 + Math.sin(t * 2.4) * 0.25;
      root.position.y = Math.sin(t * 1.6) * 0.02;
    },
    dispose() {
      disposeTree(root);
      textures.forEach((x) => x.dispose());
    },
  };
}

function nameTexture(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 90;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1846';
  g.fillRect(0, 0, 256, 90);
  g.strokeStyle = '#ffc145';
  g.lineWidth = 6;
  g.strokeRect(4, 4, 248, 82);
  g.fillStyle = '#fff3d6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 52;
  const text = String(name || 'Cadet').toUpperCase();
  do {
    g.font = `${size}px "Lilita One", system-ui, sans-serif`;
    size -= 2;
  } while (g.measureText(text).width > 220 && size > 18);
  g.fillText(text, 128, 48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


export function disposeTree(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    mats.forEach((m) => m.dispose());
  });
}
