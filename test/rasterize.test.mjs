import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();
const grid = (seed) => S.rasterize(S.generate(seed));

test("grid is 8x8", () => {
  const g = grid("abc");
  assert.equal(g.length, 8);
  for (const row of g) assert.equal(row.length, 8);
});

test("silhouette is left-right symmetric (eyes may sit off-center)", () => {
  // The creature outline is symmetric; facial features (eyes) need not be,
  // since eyes only recolor existing body cells (never add/remove silhouette).
  for (const seed of ["abc", "gap1-seed", "tall-seed", "xyz"]) {
    const g = grid(seed);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        const l = g[y][x] !== 0, r = g[y][7 - x] !== 0;
        assert.equal(l, r, `${seed}: asymmetry at (${x},${y})`);
      }
  }
});

test("eyes are always present (white + pupil)", () => {
  for (const seed of ["a","b","c","d","e","f"]) {
    const g = grid(seed);
    const flat = g.flat();
    assert.ok(flat.includes(2), `${seed}: no eye-white`);
    assert.ok(flat.includes(3), `${seed}: no pupil`);
  }
});

test("all cells use valid codes", () => {
  const g = grid("xyz");
  for (const row of g) for (const c of row) assert.ok([0,1,2,3].includes(c));
});

test("rasterize is deterministic", () => {
  assert.deepEqual(grid("abc"), grid("abc"));
});
