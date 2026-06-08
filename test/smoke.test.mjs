import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

test("engine loads and exposes a version", () => {
  const S = loadEngine();
  assert.equal(typeof S.VERSION, "string");
});
