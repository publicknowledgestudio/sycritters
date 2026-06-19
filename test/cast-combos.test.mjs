import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("video cast exposes greeting and idle-life combo cycles", () => {
  assert.match(html, /greeting:\s*32/);
  assert.match(html, /"idle-life":\s*56/);
  assert.match(html, /greeting:\s*\["look",\s*"nod",\s*"jump"\]/);
  assert.match(html, /"idle-life":\s*\["bob",\s*"bob",\s*"bob",\s*"bob",\s*"blink",\s*"look",\s*"blink",\s*"bob"\]/);
});

test("standalone cast page embeds combo definitions", () => {
  assert.match(html, /const CAST_COMBOS = \$\{JSON\.stringify\(CAST_COMBOS\)\};/);
});

test("video cast exposes a turnaround 3D-style cycle", () => {
  assert.match(html, /turnaround:\s*24/);
  assert.match(html, /cycle === "turnaround"/);
  assert.match(html, /edgePaint\(turn\)/);
});

test("main cast cards animate selected cycles", () => {
  assert.match(html, /let castPreviewTiles = \[\]/);
  assert.match(html, /function drawCastPreviewTile\(tile, frame\)/);
  assert.match(html, /sel\.addEventListener\("change", \(\) => drawCastPreviewTile\(previewTile, 0\)\)/);
  assert.match(html, /drawCastPreviews\(castFrameIndex\)/);
});

test("video cast exposes a side-step travel cycle", () => {
  assert.match(html, /"side-step":\s*16/);
  assert.match(html, /cycle === "side-step"/);
  assert.match(html, /fr\.legShift = \[-1,-1,0,1,1,0,-1,-1,1,1,0,-1,-1,0,1,1\]\[i\]/);
});

test("video cast exposes an orbit-glance face-turn cycle", () => {
  assert.match(html, /"orbit-glance":\s*16/);
  assert.match(html, /cycle === "orbit-glance"/);
  assert.match(html, /transform = \{ dx: -gazeX, dy: gazeY > 0 \? 1 : 0, squashY: 1 \}/);
});
