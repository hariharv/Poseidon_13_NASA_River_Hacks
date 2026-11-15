// The floating tools. When the plane floats they drift, spin and bounce off the padding;
// when it's heavy they drop to the floor. Catch them all before the air runs low.

import * as THREE from 'three';
import { dotTexture } from '../hermes/textures.js';
import { keepInside, pushOutOfBox, SOLIDS } from './world.js';

const KINDS = ['wrench', 'screwdriver', 'tape', 'flashlight', 'clipboard', 'duck', 'pliers', 'socket'];
export const TOOL_NAMES = {
  wrench: 'wrench',
  screwdriver: 'screwdriver',
  tape: 'roll of tape',
  flashlight: 'flashlight',
  clipboard: 'checklist',
  duck: 'rubber duck',
  pliers: 'pliers',
  socket: 'socket set',
};
const FLOOR_REST = 0.1; // how high a tool sits when it lies on the floor

export function createTools(scene, { count, origin, speed, hints }) {
  const sparkleMat = new THREE.SpriteMaterial({ map: dotTexture(), color: '#ffc145', transparent: true, opacity: 0.5, depthWrite: false });
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const tools = Array.from({ length: count }, (_, i) => {
    const kind = KINDS[i % KINDS.length];
    const mesh = buildTool(kind);
    mesh.visible = false;
    scene.add(mesh);
    const sparkle = new THREE.Sprite(sparkleMat);
    sparkle.scale.setScalar(hints === 'more' ? 0.55 : 0.35);
    mesh.add(sparkle);
    return {
      kind,
      name: TOOL_NAMES[kind],
      mesh,
      pos: origin.clone(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      state: 'boxed', // boxed -> loose -> caught
      fly: 0,
      r: TOOL_RADIUS * 0.75, // for bumping into other floating things
    };
  });

  // Out of the box! Each tool pops out in its own direction.
  function release() {
    for (const tool of tools) {
      if (tool.state !== 'boxed') continue;
      tool.state = 'loose';
      tool.mesh.visible = true;
      tool.pos.copy(origin).add(new THREE.Vector3((rand() - 0.5) * 0.3, 0.1, (rand() - 0.5) * 0.2));
      const dir = new THREE.Vector3(rand() - 0.5, 0.5 + rand() * 0.8, (rand() - 0.5) * 2.2).normalize();
      tool.vel.copy(dir).multiplyScalar(speed * (0.6 + rand() * 0.8));
      tool.spin.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(4);
    }
  }

  // A new float: tools resting on the floor lift off again.
  function lift() {
    for (const tool of tools) {
      if (tool.state !== 'loose') continue;
      if (tool.vel.lengthSq() < 0.05) {
        tool.vel.set((rand() - 0.5) * 0.4, (0.3 + rand() * 0.4) * speed, (rand() - 0.5) * 0.8);
        tool.spin.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(3);
      }
    }
  }

  const toHand = new THREE.Vector3();
  function update(dt, t, { g, camera }) {
    for (const tool of tools) {
      if (tool.state === 'caught') {
        // fly into your hand, shrink into the tool bag
        if (tool.fly < 1) {
          tool.fly = Math.min(1, tool.fly + dt * 4);
          toHand.set(0.3, -0.35, -0.5).applyQuaternion(camera.quaternion).add(camera.position);
          tool.pos.lerp(toHand, tool.fly);
          tool.mesh.scale.setScalar(1.35 * (1 - tool.fly * 0.9)); // shrink from its normal size, no pop
          tool.mesh.visible = tool.fly < 1;
        }
        tool.mesh.position.copy(tool.pos);
        continue;
      }
      if (tool.state !== 'loose') continue;
      tool.vel.y -= 9.8 * g * dt;
      tool.vel.multiplyScalar(Math.exp(-(g > 0 ? 0.6 : 0.05) * dt));
      tool.pos.addScaledVector(tool.vel, dt);
      bounce(tool, g);
      const resting = g > 0 && tool.pos.y <= FLOOR_REST + 0.001;
      if (!resting) {
        tool.mesh.rotation.x += tool.spin.x * dt;
        tool.mesh.rotation.y += tool.spin.y * dt;
        tool.mesh.rotation.z += tool.spin.z * dt;
      } else {
        tool.spin.multiplyScalar(Math.exp(-6 * dt));
      }
      tool.mesh.position.copy(tool.pos);
      tool.mesh.children.at(-1).material.opacity = 0.35 + 0.2 * Math.sin(t * 4 + tool.pos.x * 3);
    }
  }

  return {
    tools,
    release,
    lift,
    update,
    get caught() {
      return tools.filter((x) => x.state === 'caught').length;
    },
    get loose() {
      return tools.filter((x) => x.state === 'loose');
    },
    catch(tool) {
      tool.state = 'caught';
      tool.fly = 0;
    },
  };
}

const TOOL_RADIUS = 0.3; // tools are up to about 0.4 m long and spin, so keep them this far from the padding

function bounce(tool, g) {
  const p = tool.pos;
  const v = tool.vel;
  const floor = FLOOR_REST;
  const wasFalling = v.y < 0 && p.y < floor;
  keepInside(p, v, TOOL_RADIUS, 0.55, floor);
  for (const box of SOLIDS) pushOutOfBox(p, v, box, TOOL_RADIUS * 0.8, 0.45);
  if (wasFalling && g > 0) v.y *= 0.27; // the floor mat is soft: barely a bounce when the plane is heavy
  if (g > 0 && p.y <= floor + 0.001) {
    v.x *= 0.9;
    v.z *= 0.9;
  }
}

// ---------- the tools themselves, from simple shapes ----------
function buildTool(kind) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#c7ced6', roughness: 0.3, metalness: 0.8 });
  const mat = (color, rough = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  switch (kind) {
    case 'wrench':
      add(new THREE.BoxGeometry(0.05, 0.3, 0.02), steel);
      add(new THREE.TorusGeometry(0.05, 0.018, 8, 16, Math.PI * 1.5), steel, 0, 0.17, 0, 0, 0, -Math.PI * 0.25);
      add(new THREE.BoxGeometry(0.06, 0.14, 0.03), mat('#ff5b1f'), 0, -0.09, 0);
      break;
    case 'screwdriver':
      add(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 12), mat('#ffc145'), 0, -0.08, 0);
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), steel, 0, 0.09, 0);
      break;
    case 'tape':
      add(new THREE.TorusGeometry(0.075, 0.035, 10, 24), mat('#b9c2cb', 0.35));
      break;
    case 'flashlight':
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 14), mat('#3d7bff'), 0, 0, 0);
      add(new THREE.CylinderGeometry(0.05, 0.035, 0.05, 14), steel, 0, 0.13, 0);
      add(new THREE.CircleGeometry(0.045, 14), new THREE.MeshBasicMaterial({ color: '#fff7c2' }), 0, 0.156, 0, -Math.PI / 2);
      break;
    case 'clipboard':
      add(new THREE.BoxGeometry(0.2, 0.27, 0.012), mat('#a0703c', 0.8));
      add(new THREE.BoxGeometry(0.17, 0.22, 0.004), mat('#fff3d6', 0.9), 0, -0.01, 0.008);
      add(new THREE.BoxGeometry(0.08, 0.03, 0.02), steel, 0, 0.13, 0.01);
      break;
    case 'duck':
      add(new THREE.SphereGeometry(0.09, 16, 12), mat('#ffd23f', 0.4)).scale.set(1.2, 0.85, 1);
      add(new THREE.SphereGeometry(0.055, 14, 10), mat('#ffd23f', 0.4), 0.07, 0.08, 0);
      add(new THREE.ConeGeometry(0.025, 0.05, 8), mat('#ff7a1a'), 0.13, 0.075, 0, 0, 0, -Math.PI / 2);
      break;
    case 'pliers':
      add(new THREE.BoxGeometry(0.03, 0.2, 0.02), mat('#e0412b'), -0.025, -0.05, 0, 0, 0, 0.12);
      add(new THREE.BoxGeometry(0.03, 0.2, 0.02), mat('#e0412b'), 0.025, -0.05, 0, 0, 0, -0.12);
      add(new THREE.ConeGeometry(0.03, 0.12, 6), steel, 0, 0.11, 0);
      break;
    default: // socket set
      add(new THREE.BoxGeometry(0.22, 0.06, 0.12), mat('#1f252c'));
      for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10), steel, -0.075 + i * 0.05, 0.05, 0);
  }
  g.scale.setScalar(1.35); // a bit bigger than life, so they're easy to see
  return g;
}
