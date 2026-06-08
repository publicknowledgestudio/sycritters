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

test("body cells are left-right symmetric", () => {
  const g = grid("abc");
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      const l = g[y][x] === 1, r = g[y][7 - x] === 1;
      assert.equal(l, r, `asymmetry at (${x},${y})`);
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
