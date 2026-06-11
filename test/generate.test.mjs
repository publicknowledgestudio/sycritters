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
  assert.ok(["straight", "pinch", "narrow", "bite-l", "bite-r"].includes(spec.waist));
  assert.equal(spec.eyes.style, "normal");
  assert.ok(["dot", "bar"].includes(spec.eyes.pupil));
  assert.equal(typeof spec.eyes.mirror, "boolean");
  assert.ok([1, 2].includes(spec.eyes.gap));
  assert.ok(["left", "center", "right"].includes(spec.eyes.align));
  assert.ok(spec.eyes.row >= 2 && spec.eyes.row <= 3);
  // all generated critters use 1-3 palette colors
  assert.ok(Array.isArray(spec.colors) && spec.colors.length >= 1 && spec.colors.length <= 3);
  for (const c of spec.colors) assert.ok(S.PALETTE.some(p => p.hex === c.hex), "color from palette");
  assert.ok(["none", "diagonal-left", "diagonal-right", "radial"].includes(spec.gradientDir));
  assert.equal(spec.gradientMotion, "static");
});

test("gradient colors are an analogous run (consecutive on the palette ring)", () => {
  const N = S.PALETTE.length;
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]) {
    const idx = S.generate(seed).colors.map((c) => S.PALETTE.findIndex((p) => p.name === c.name));
    for (let i = 1; i < idx.length; i++) {
      const step = (((idx[i] - idx[i - 1]) % N) + N) % N;
      assert.equal(step, 1, `${seed}: colors not consecutive on the ring (${idx})`);
    }
  }
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
