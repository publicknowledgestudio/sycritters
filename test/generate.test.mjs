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
  assert.ok(S.PALETTE.some(c => c.hex === spec.color.hex));
  assert.ok(S.TOPS.some(m => m.name === spec.top));
  assert.ok(S.BOTTOMS.some(m => m.name === spec.bottom));
  assert.ok(["straight", "bumps"].includes(spec.edges));
  assert.ok(["normal", "visor"].includes(spec.eyes.style));
  assert.ok(["close", "wide"].includes(spec.eyes.spacing));
  assert.ok(spec.eyes.row >= 2 && spec.eyes.row <= 3);
});

test("different seeds usually differ", () => {
  const seeds = ["a","b","c","d","e","f","g","h"];
  const specs = new Set(seeds.map(s => JSON.stringify(S.generate(s))));
  assert.ok(specs.size >= 5, "seeds should yield varied specs");
});

test("randomSeed returns a usable string", () => {
  const seed = S.randomSeed(S._test.rng("x"));
  assert.equal(typeof seed, "string");
  assert.ok(seed.length > 0);
});
