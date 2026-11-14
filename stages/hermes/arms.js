// My own sleeves and gloves in my suit colour, drawn on top of the world so
// they never poke through a wall. The right hand holds a pistol-grip tool,
// the power drill real spacewalkers use.

import * as THREE from 'three';

const SUIT_COLOURS = {
  white: '#eef1f4',
  orange: '#ff6a2b',
  blue: '#3d7bff',
  purple: '#8a5cff',
  green: '#3fcf74',
  pink: '#ff6fae',
};

export function suitColour(name) {
  if (SUIT_COLOURS[name]) return SUIT_COLOURS[name];
  return /^#[0-9a-f]{6}$/i.test(name ?? '') ? name : SUIT_COLOURS.orange;
}

export function createArms(suit) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#c6f6ff', '#10405a', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(0.5, 2, 1);
  scene.add(key);

  const rig = new THREE.Group();
  scene.add(rig);

  const sleeveMat = new THREE.MeshStandardMaterial({ color: suitColour(suit), roughness: 0.75 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: '#b9c2cb', roughness: 0.35, metalness: 0.7 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.8 });
  const tipMat = new THREE.MeshStandardMaterial({ color: '#6c7681', roughness: 0.6 });

  function arm(side) {
    const g = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, 0.62, 18), sleeveMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = 0.32;
    g.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 10, 24), cuffMat);
    cuff.position.z = 0.02;
    g.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), gloveMat);
    hand.scale.set(0.095, 0.07, 0.12);
    hand.position.z = -0.1;
    g.add(hand);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.07, 4, 8), i % 2 ? gloveMat : gloveMat);
      finger.rotation.x = Math.PI / 2 + 0.5;
      finger.position.set(-0.05 + i * 0.033, -0.02, -0.21);
      g.add(finger);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), tipMat);
      tip.position.set(-0.05 + i * 0.033, -0.05, -0.25);
      g.add(tip);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.06, 4, 8), gloveMat);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.9);
    thumb.position.set(side * -0.08, 0.01, -0.15);
    g.add(thumb);
    g.position.set(side * 0.4, -0.4, -0.62);
    g.rotation.set(0.12, side * -0.22, 0);
    rig.add(g);
    return g;
  }

  const left = arm(-1);
  const right = arm(1);

  // pistol-grip tool in the right hand
  const tool = new THREE.Group();
  const toolBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: '#3e4a59', roughness: 0.5, metalness: 0.4 }));
  tool.add(toolBody);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: '#1f252c', roughness: 0.8 }));
  grip.position.set(0, -0.09, 0.06);
  tool.add(grip);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.12, 6), cuffMat);
  bit.rotation.x = Math.PI / 2;
  bit.position.z = -0.17;
  tool.add(bit);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.02, 0.1), new THREE.MeshStandardMaterial({ color: '#ffc145' }));
  stripe.position.set(0, 0.042, -0.02); // top sits just above the body's, so the two faces don't fight
  tool.add(stripe);
  tool.position.set(0.0, 0.06, -0.12);
  right.add(tool);

  const leftHome = left.position.clone();
  const rightHome = right.position.clone();
  let push = 0;
  let swim = 0;

  return {
    scene,
    update(camera, dt, t, { swimming, working }) {
      rig.position.copy(camera.position);
      rig.quaternion.copy(camera.quaternion);
      // gentle breast-stroke when swimming
      swim += ((swimming ? 1 : 0) - swim) * Math.min(1, dt * 6); // ease in and out, never snap
      const stroke = Math.sin(t * 3.2) * swim;
      left.position.set(leftHome.x - stroke * 0.05, leftHome.y + Math.sin(t * 1.3) * 0.01, leftHome.z + stroke * 0.06);
      // right hand reaches forward and shakes a little while drilling
      push += ((working ? 1 : 0) - push) * Math.min(1, dt * 8);
      const jitter = working ? Math.sin(t * 60) * 0.004 : 0;
      right.position.set(
        rightHome.x + stroke * 0.05 - push * 0.08 + jitter,
        rightHome.y + push * 0.05 + Math.sin(t * 1.3 + 1) * 0.01,
        rightHome.z - push * 0.1 + stroke * 0.06,
      );
      bit.rotation.y += working ? dt * 12 : 0; // slow enough not to strobe backwards
    },
  };
}
