import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("generate is deterministic for the same seed", () => {
  assert.deepEqual(S.generate("abc"), S.generate("abc"));
});

test("generate produces a spec with valid axes", () => {
  const spec = S.generate("abc");
  assert.equal(spec.seed, "abc");
  assert.ok(S.TOPS.some(m => m.name === spec.top));
  assert.ok(S.BOTTOMS.some(m => m.name === spec.bottom));
  assert.ok(["straight", "pinch", "narrow"].includes(spec.waist));
  assert.ok(["normal", "tall", "visor", "visor2"].includes(spec.eyes.style));
  assert.ok([1, 2].includes(spec.eyes.gap));
  assert.ok(["left", "center", "right"].includes(spec.eyes.align));
  assert.ok(spec.eyes.row >= 2 && spec.eyes.row <= 3);
  // all critters are gradients of 2-4 palette colors
  assert.ok(Array.isArray(spec.colors) && spec.colors.length >= 2 && spec.colors.length <= 4);
  for (const c of spec.colors) assert.ok(S.PALETTE.some(p => p.hex === c.hex), "color from palette");
  assert.ok(["diagonal", "horizontal", "vertical", "radial"].includes(spec.gradientDir));
  assert.ok(["static", "drift", "pulse", "sheen"].includes(spec.gradientMotion));
});

test("different seeds usually differ", () => {
  const seeds = ["a","b","c","d","e","f","g","h"];
  const specs = new Set(seeds.map(s => JSON.stringify(S.generate(s))));
  assert.ok(specs.size >= 5, "seeds should yield varied specs");
});

test("generate bakes a seeded resting gaze that varies across seeds", () => {
  const g = S.generate("abc").eyes.gaze;
  assert.ok(Number.isInteger(g.dx) && g.dx >= -1 && g.dx <= 1, `dx out of range: ${g.dx}`);
  assert.ok(Number.isInteger(g.dy) && g.dy >= 0 && g.dy <= 1, `dy out of range: ${g.dy}`);
  const gazes = new Set(
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => JSON.stringify(S.generate(s).eyes.gaze))
  );
  assert.ok(gazes.size >= 2, "resting gaze should vary across seeds");
});

test("randomSeed returns a usable string", () => {
  const seed = S.randomSeed(S._test.rng("x"));
  assert.equal(typeof seed, "string");
  assert.ok(seed.length > 0);
});
