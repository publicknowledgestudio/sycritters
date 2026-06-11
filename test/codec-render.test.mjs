import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("spec codec roundtrips a generated spec", () => {
  const spec = S.generate("round-trip");
  assert.deepEqual(S.specFromString(S.specToString(spec)), spec);
});

test("spec codec roundtrips an edited spec with awkward seed characters", () => {
  // Built via test-realm spreads, so compare JSON (vm-realm prototypes differ).
  const spec = { ...S.generate("a~b c?&=#"), top: "3tr", waist: "narrow" };
  spec.eyes = { ...spec.eyes, style: "visor2", align: "right" };
  const back = S.specFromString(S.specToString(spec));
  assert.equal(JSON.stringify(back), JSON.stringify(spec));
});

test("specFromString rejects garbage", () => {
  assert.equal(S.specFromString("garbage"), null);
  assert.equal(S.specFromString(""), null);
  assert.equal(S.specFromString("1~x~99~0~0~0~0~0~0~3~1~1~4"), null); // bad colors
});

test("gradientPaint static endpoints hit the run's end colors", () => {
  const p = S.gradientPaint(["#29abe2", "#2be89c"], "diagonal-right", "static", 0);
  assert.equal(p(0, 0), "#29abe2");
  assert.equal(p(7, 7), "#2be89c");
});

test("gradientPaint supports a single flat color", () => {
  const p = S.gradientPaint(["#29abe2"], "radial", "static", 0);
  assert.equal(p(0, 0), "#29abe2");
  assert.equal(p(7, 7), "#29abe2");
});

test("spec codec roundtrips a one-color edited spec", () => {
  const spec = { ...S.generate("one-color"), colors: [S.PALETTE[0]] };
  assert.equal(JSON.stringify(S.specFromString(S.specToString(spec))), JSON.stringify(spec));
});

test("legacy horizontal and vertical directions decode to supported behaviors", () => {
  const legacyHorizontal = "2~x~01~1~2~0~0~0~0~3~1~1~4~0~0";
  const legacyVertical = "2~x~01~2~3~0~0~0~0~3~1~1~4~0~0";
  assert.equal(S.specFromString(legacyHorizontal).gradientDir, "diagonal-left");
  assert.equal(S.specFromString(legacyVertical).gradientDir, "diagonal-right");
  assert.equal(S.specFromString(legacyHorizontal).gradientMotion, "static");
});

test("codec rejects non-integer or padded numeric fields", () => {
  assert.equal(S.specFromString("2~s~01~0~0~0~0~0~0~2~1~0~4.5~0~0"), null, "fractional gaze");
  assert.equal(S.specFromString("2~s~01~~~~~~~2~1~~4~0~0"), null, "empty fields");
  assert.equal(S.specFromString("2~s~01~0~0~0~0~0~0~ 2~1~0~4~0~0"), null, "padded row");
  assert.equal(S.specFromString("2~s~01~0x1~0~0~0~0~0~2~1~0~4~0~0"), null, "hex field");
});

test("legShift moves 2-row stilts (tripod2) coherently", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "tripod2", waist: "straight",
    eyes: { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec, { legShift: 1 });
  assert.equal(g[6].join(""), "01101101", "upper stilt row shifts with the feet");
  assert.equal(g[7].join(""), "01101101", "feet row shifts");
});

test("toSVG emits eye-white and pupil rects", () => {
  const svg = S.toSVG(S.rasterize(S.generate("svg-test")), "#29abe2", 8);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('fill="#ffffff"'));
  assert.ok(svg.includes('fill="#000000"'));
});

test("frame.legShift nudges the feet row sideways", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "legs", waist: "straight",
    eyes: { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const a = S.rasterize(spec)[7];
  const b = S.rasterize(spec, { legShift: 1 })[7];
  assert.deepEqual(b.slice(1), a.slice(0, 7)); // shifted right by 1
  assert.equal(b[0], 0);
});
