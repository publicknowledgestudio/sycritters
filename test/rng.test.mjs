import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("rng is deterministic for the same seed", () => {
  const a = S._test.rng("hello");
  const b = S._test.rng("hello");
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test("rng differs for different seeds", () => {
  const a = S._test.rng("hello");
  const b = S._test.rng("world");
  assert.notEqual(a(), b());
});

test("rng returns floats in [0,1)", () => {
  const r = S._test.rng("x");
  for (let i = 0; i < 100; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`);
  }
});
