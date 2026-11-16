import { curatedVolume } from "./critter-curated.mjs";
// Eight-deep solid volumes, sampled in x/y/z rather than extruded sprite rows.
// The front is clipped at z=2 to give eyes and accessories a stable face plane.
export const VOLUME_FORMS = ['orb', 'bean', 'pear', 'capsule', 'pebble', 'block'];
export const VOLUME_LAYERS = 8;
export const VOLUME_ORIGIN = 6;
function hash(seed) {
  let value = 2166136261;
  for (const c of String(seed)) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function nativeVolume(spec, eyeGrid, requested = 'seed') {
  if (requested.startsWith('curated:')) return curatedVolume(requested.slice(8));
  const seed = hash(spec.seed);
  const form = VOLUME_FORMS.includes(requested) ? requested : VOLUME_FORMS[seed % VOLUME_FORMS.length];
  const masks = Array.from({ length: 8 }, () => Array(8).fill(0));
  const grid = masks.map(row => row.slice());
  const lean = ((seed >>> 8) % 7 - 3) * .09;
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    const x = column - 3.5, y = 7.5 - row;
    for (let layer = 0; layer < VOLUME_LAYERS; layer++) {
      const z = layer + .5 - VOLUME_ORIGIN;
      const v = (y - 4) / 4;
      let rx = 4, rz = 3.9, cx = 0, cz = -1.7, power = 2;
      if (form === 'pear') { rx = 3.55 - .8 * v; rz = 3.55 - .6 * v; }
      if (form === 'bean') { cx = .8 * Math.sin(v * 2.6); cz += .55 * v; rx = 3.55; }
      if (form === 'capsule') { rx = 3.2; rz = 3.25; power = 3; }
      if (form === 'pebble') { cx = lean * y; cz += .45 * Math.sin(v * 2); rx = 3.7; power = 2.5; }
      if (form === 'block') { rx = 3.95; rz = 3.8; power = 5; }
      if ((row === 3 || row === 4) && ['pinch', 'narrow'].includes(spec.waist)) {
        const pinch = spec.waist === 'narrow' ? .72 : .86;
        rx *= pinch; rz *= pinch;
      }
      let occupied = Math.abs((x - cx) / rx) ** power + Math.abs(v) ** power + Math.abs((z - cz) / rz) ** power <= 1;
      // Top features are solids with depth, not copies of a front silhouette.
      if (y > 5.5) {
        const ear = ['ears', 'antennae', 'trident', 'crown'].includes(spec.top);
        if (ear) {
          const radius = spec.top === 'antennae' ? .8 : 1.35;
          occupied ||= (Math.abs(x) - 2.4) ** 2 + (z + 1.7) ** 2 < radius ** 2;
        }
        if (spec.top === 'trident' && Math.abs(x) < 1 && Math.abs(z + 1.7) < 1) occupied = true;
        if (spec.top === 'crown' && y > 6.5 && Math.abs(x) < 1 && Math.abs(z + 1.7) < 1.5) occupied = true;
        if (spec.top === 'dots' && y > 6.5) occupied ||= (Math.abs(x) - 2.5) ** 2 + (z + 1.7) ** 2 < 1.7;
        if (spec.top === 'w' && y > 6 && Math.abs(x) < 1.2) occupied = false;
        if (spec.top === 'loaf' && y > 6.5) occupied = Math.abs(x) < 2.9 && Math.abs(z + 1.7) < 2.5;
        if (spec.top === 'handle') {
          const ring = (y - 5.7) ** 2 + (z + 1.7) ** 2;
          if (Math.abs(x) < 1 && ring < 6.5) occupied = ring > 1.5;
        }
        if (/^[23]t[lr]$/.test(spec.top)) {
          const side = spec.top.endsWith('l') ? -x : x;
          if (y - 5.5 > (side + 3.5) * (spec.top[0] === '3' ? .45 : .65)) occupied = false;
        }
        if (spec.top === 'notch' && y > 6.5 && Math.abs(x) < 1.1) occupied = false;
        if (spec.top === 'flat' && y > 6.8) occupied = false;
        if (spec.top === 'lego' && y > 6.5) occupied = Math.abs(x) < 2.8 && Math.abs(z + 1.7) < 2.8;
        if (spec.top === 'tail-l') occupied ||= (x + 2.5) ** 2 + (z + 3.2) ** 2 < 1.5;
        if (spec.top === 'tail-r') occupied ||= (x - 2.5) ** 2 + (z + 3.2) ** 2 < 1.5;
      }
      if ((row === 3 || row === 4) && spec.waist.startsWith('bite')) {
        const side = spec.waist === 'bite-l' ? -4 : 4;
        if ((x - side) ** 2 + (z + 1.7) ** 2 < 2.8) occupied = false;
      }
      if (y < 1.7 && ['legs', 'splayed', 'tripod', 'tripod2', 'toes', 'toes-a', 'toes-b'].includes(spec.bottom)) {
        const feet = spec.bottom.startsWith('tripod') ? [[-2, -2.8], [2, -2.8], [0, .5]]
          : [[-2, -3.2], [2, -3.2], [-2, .2], [2, .2]];
        const spread = spec.bottom === 'splayed' ? 1.2 : 1;
        const shift = spec.bottom === 'toes-a' ? -.5 : spec.bottom === 'toes-b' ? .5 : 0;
        const radius = spec.bottom.startsWith('toes') ? 1.2 : spec.bottom === 'tripod2' ? 1.35 : 1.55;
        occupied = feet.some(([fx, fz]) => (x - fx * spread) ** 2 + (z - fz - shift) ** 2 < radius ** 2);
      }
      if (y < 1.5 && spec.bottom === 'dots') occupied = (Math.abs(x) - 2) ** 2 + (Math.abs(z + 1.5) - 1.5) ** 2 < 1.6;
      if (y < 2.5 && /^[23]b[lr]$/.test(spec.bottom)) {
        const side = spec.bottom.endsWith('l') ? -x : x;
        if (2.5 - y > (side + 3.5) * (spec.bottom[0] === '3' ? .45 : .65)) occupied = false;
      }
      if (spec.bottom === 'flat' && y < .8) occupied = Math.abs(x) < 3.5 && Math.abs(z + 1.7) < 3;
      // A small integrated face pad keeps every eye style on the front surface.
      if (eyeGrid[row][column] >= 2 && layer >= 4) occupied = true;
      if (occupied) masks[row][column] |= 1 << layer;
    }
    grid[row][column] = eyeGrid[row][column] >= 2 ? eyeGrid[row][column] : Number(Boolean(masks[row][column]));
  }
  return { form, grid, masks };
}
