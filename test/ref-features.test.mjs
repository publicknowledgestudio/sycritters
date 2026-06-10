import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

const baseEyes = { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 }, pupil: "dot", mirror: false };
const block = (over = {}, eyes = {}) => ({
  ...S.generate("x"), top: "flat", bottom: "flat", waist: "straight",
  ...over, eyes: { ...baseEyes, ...eyes },
});

test("short (2x1) eyes occupy a single row", () => {
  const g = S.rasterize(block({}, { style: "short", row: 2, gap: 2 }));
  assert.ok(g[2].includes(2) && g[2].includes(3), "eye white + pupil on the eye row");
  assert.ok(!g[3].includes(2) && !g[3].includes(3), "nothing eye-ish on the row below");
});

test("bar pupil fills a 1x2 column of the 2x2 eye", () => {
  // gap 1, centered: eyes start at cols 1 and 4; dx<=0 puts the bar on the left column
  const g = S.rasterize(block({}, { pupil: "bar" }));
  assert.equal(g[3][1], 3); assert.equal(g[4][1], 3); // left eye bar
  assert.equal(g[3][2], 2); assert.equal(g[4][2], 2); // rest stays white
  assert.equal(g[3][4], 3); assert.equal(g[4][4], 3); // right eye bar (parallel)
});

test("mirrored gaze flips the right eye's pupil", () => {
  const g = S.rasterize(block({}, { mirror: true }));
  assert.equal(g[3][1], 3, "left eye pupil left");
  assert.equal(g[3][5], 3, "right eye pupil mirrored to the right");
  assert.equal(g[3][4], 2, "right eye inner cell stays white");
});

test("waist bite-r carves only the right side", () => {
  const g = S.rasterize(block({ waist: "bite-r" }));
  assert.equal(g[3][7], 0); assert.equal(g[4][7], 0);
  assert.equal(g[3][0], 1); assert.equal(g[4][0], 1);
});

test("tripod2 legs are two rows tall", () => {
  const g = S.rasterize(block({ bottom: "tripod2" }));
  assert.equal(g[6].join(""), "11011011");
  assert.equal(g[7].join(""), "11011011");
});

test("toes are three inset feet (1-2-1)", () => {
  const g = S.rasterize(block({ bottom: "toes" }));
  assert.equal(g[7].join(""), "01011010");
});

test("dots top has detached corner pixels", () => {
  const g = S.rasterize(block({ top: "dots" }));
  assert.equal(g[0][0], 1); assert.equal(g[0][7], 1); // corner dots
  assert.equal(g[0][1], 0); assert.equal(g[1][0], 0); // detached orthogonally
});

test("codec v2 roundtrips the new eye/waist fields", () => {
  const spec = { ...S.generate("v2-trip"), waist: "bite-r" };
  spec.eyes = { ...spec.eyes, style: "short", pupil: "dot", mirror: true };
  const back = S.specFromString(S.specToString(spec));
  assert.equal(JSON.stringify(back), JSON.stringify(spec));
});

test("codec still accepts v1 strings with safe defaults", () => {
  const s = S.specFromString("1~abc~01~0~0~0~0~0~0~3~1~1~4");
  assert.ok(s, "v1 parses");
  assert.equal(s.seed, "abc");
  assert.equal(s.eyes.pupil, "dot");
  assert.equal(s.eyes.mirror, false);
});
