import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("selfTest returns {passed:true} over many seeds", () => {
  const res = S.selfTest();
  assert.equal(res.passed, true, JSON.stringify(res.failures));
});
