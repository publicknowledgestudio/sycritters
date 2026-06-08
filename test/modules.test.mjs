import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

function check(group) {
  assert.ok(group.length >= 4, "need at least 4 modules");
  for (const m of group) {
    assert.equal(typeof m.name, "string");
    assert.equal(m.rows.length, 4, `${m.name} must define 4 rows`);
    for (const row of m.rows) {
      assert.equal(row.length, 4, `${m.name} rows must be 4 wide`);
      for (const bit of row) assert.ok(bit === 0 || bit === 1);
    }
  }
}

test("TOPS are valid 4x4 left-half blocks", () => check(S.TOPS));
test("BOTTOMS are valid 4x4 left-half blocks", () => check(S.BOTTOMS));

test("module name lists are exposed", () => {
  // Compare joined strings: values cross the vm realm boundary, so their
  // Array.prototype differs from a test-realm literal and deepStrictEqual
  // would reject them despite identical contents.
  assert.equal(S.TOPS.map(m => m.name).sort().join(","), "antennae,dome,ears,flat,notch");
  assert.equal(S.BOTTOMS.map(m => m.name).sort().join(","), "flat,legs,round,spikes,splayed,tripod");
});
