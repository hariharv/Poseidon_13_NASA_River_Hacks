// Solid things: keep a ball (you, a tool, a water blob) from passing through a box.
// Plain numbers ({x, y, z}), so it works with three.js vectors and is easy to test.

// Push a ball (radius r) out of a solid box, and bounce its velocity off the face it hit.
export function pushOutOfBox(p, v, box, r, bounce = 0.4) {
  const cx = Math.max(box.min.x, Math.min(p.x, box.max.x));
  const cy = Math.max(box.min.y, Math.min(p.y, box.max.y));
  const cz = Math.max(box.min.z, Math.min(p.z, box.max.z));
  const dx = p.x - cx;
  const dy = p.y - cy;
  const dz = p.z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;
    p.x = cx + nx * r;
    p.y = cy + ny * r;
    p.z = cz + nz * r;
    const vn = v.x * nx + v.y * ny + v.z * nz;
    if (vn < 0) {
      v.x -= (1 + bounce) * vn * nx;
      v.y -= (1 + bounce) * vn * ny;
      v.z -= (1 + bounce) * vn * nz;
    }
  } else {
    // the centre got inside: leave through the nearest face, and stop moving into it
    const exits = [
      ['x', box.min.x - r, -1],
      ['x', box.max.x + r, 1],
      ['y', box.min.y - r, -1],
      ['y', box.max.y + r, 1],
      ['z', box.min.z - r, -1],
      ['z', box.max.z + r, 1],
    ].sort((a, b) => Math.abs(a[1] - p[a[0]]) - Math.abs(b[1] - p[b[0]]));
    const [axis, to, dir] = exits[0];
    p[axis] = to;
    if (v[axis] * dir < 0) v[axis] = 0;
  }
  return true;
}
