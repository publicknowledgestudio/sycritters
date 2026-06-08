import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("palette is a non-empty array of {name, hex}", () => {
  assert.ok(Array.isArray(S.PALETTE) && S.PALETTE.length >= 8);
  for (const c of S.PALETTE) {
    assert.equal(typeof c.name, "string");
    assert.match(c.hex, /^#[0-9a-fA-F]{6}$/);
  }
});
