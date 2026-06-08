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

test("silhouette is left-right symmetric when no corner cut is applied", () => {
  // The creature outline is symmetric (eyes may recolor body cells off-center);
  // an asymmetric corner cut deliberately breaks this, so force corner:none.
  for (const seed of ["abc", "gap1-seed", "tall-seed", "xyz"]) {
    const g = S.rasterize({ ...S.generate(seed), corner: "none" });
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        const l = g[y][x] !== 0, r = g[y][7 - x] !== 0;
        assert.equal(l, r, `${seed}: asymmetry at (${x},${y})`);
      }
  }
});

test("corner cut carves an asymmetric diagonal staircase", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "flat", edges: "straight",
    corner: "tr", cornerSize: 3,
    eyes: { style: "normal", row: 5, gap: 0, gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  // top-right staircase removed (matches the reference shape)
  assert.equal(g[0][5], 0); assert.equal(g[0][6], 0); assert.equal(g[0][7], 0);
  assert.equal(g[1][6], 0); assert.equal(g[1][7], 0);
  assert.equal(g[2][7], 0);
  // the mirrored top-left stays solid -> asymmetric
  assert.equal(g[0][0], 1); assert.equal(g[1][0], 1); assert.equal(g[2][0], 1);
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
