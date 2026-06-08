# Sycritters Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a single standalone `index.html` that procedurally generates 8×8 pixel "Sycritters" from a seed, with a playground (editor + gallery wall), canvas/SVG rendering, PNG/SVG export, and color/eye/body animation.

**Architecture:** `index.html` is the sole artifact and single source of truth. It contains a pure, DOM-free `Sycritters` engine in a marked `<script>` block, plus renderer and playground layers. Generation is `seed → spec → 8×8 grid`: a hand-authored module vocabulary (tops/bottoms/eyes) builds the **left 4 columns**, which are **mirrored** for symmetry. Node's built-in test runner extracts the engine block via `node:vm` and TDD-tests it directly — no build step, no dependencies. DOM layers are verified visually.

**Tech Stack:** Vanilla JS (ES2020), HTML5 Canvas, inline SVG, `node:test` + `node:vm` + `node:assert` for engine tests (Node 18+, zero npm deps).

---

## Conventions

- **Grid codes:** `0 = empty (transparent)`, `1 = body`, `2 = eye-white`, `3 = pupil`.
- **Coordinates:** `grid[y][x]`, `y=0` top, `x=0` left. 8×8. Left half = `x ∈ 0..3`; mirror maps `x → 7-x`.
- **Module bit rows:** each module row is a 4-bit left-half pattern `[x0,x1,x2,x3]` where `x3` is adjacent to the mirror line.
- **Run engine tests:** `node --test test/*.test.mjs` (glob excludes the `_engine.mjs` helper; bare `node --test test/` is treated as a module path in Node 23). Single file: `node --test test/<name>.test.mjs`.
- **Commits:** conventional prefixes (`feat:`, `test:`, `chore:`). Commit after every green task.
- **Engine purity rule:** code inside the `SYCRITTERS-ENGINE` block must NEVER touch `window`, `document`, or DOM. It exposes itself via `globalThis.Sycritters` so it works identically in the browser and in a `vm` context.

---

## Task 0: Scaffold the single-file skeleton + test harness

**Files:**
- Create: `index.html`
- Create: `test/_engine.mjs` (helper that extracts the engine from `index.html`)
- Create: `test/smoke.test.mjs`

**Step 1: Create `index.html` with the engine markers and an empty engine.**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sycritters</title>
<style>
  /* UI styles added in Task 9 */
</style>
</head>
<body>
<main id="app"><!-- UI added in Task 9 --></main>

<!-- SYCRITTERS-ENGINE:START -->
<script>
globalThis.Sycritters = (function () {
  "use strict";
  const VERSION = "0.0.1";
  // engine built up across Tasks 1–6
  return { VERSION };
})();
</script>
<!-- SYCRITTERS-ENGINE:END -->

<script>
  /* Renderers (Tasks 7–8) and Playground (Tasks 9+) added below */
</script>
</body>
</html>
```

**Step 2: Create the engine-extraction helper `test/_engine.mjs`.**

```js
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Reads index.html, pulls the marked engine <script>, runs it in an isolated
// VM context, and returns the resulting Sycritters object. This is the SAME
// source that ships in the browser — no duplication, no build step.
export function loadEngine() {
  const url = new URL("../index.html", import.meta.url);
  const html = readFileSync(url, "utf8");
  const re =
    /SYCRITTERS-ENGINE:START -->\s*<script>([\s\S]*?)<\/script>\s*<!-- SYCRITTERS-ENGINE:END/;
  const match = html.match(re);
  if (!match) throw new Error("Engine block not found in index.html");
  const ctx = vm.createContext({ console, Math });
  vm.runInContext(match[1], ctx);
  if (!ctx.Sycritters) throw new Error("Engine did not define globalThis.Sycritters");
  return ctx.Sycritters;
}
```

**Step 3: Create `test/smoke.test.mjs`.**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

test("engine loads and exposes a version", () => {
  const S = loadEngine();
  assert.equal(typeof S.VERSION, "string");
});
```

**Step 4: Run the test.**

Run: `node --test test/`
Expected: PASS — 1 test passing.

**Step 5: Commit.**

```bash
git add index.html test/
git commit -m "chore: scaffold single-file skeleton with vm-based engine test harness"
```

---

## Task 1: Seeded RNG (xmur3 + mulberry32)

**Files:**
- Modify: `index.html` (engine block)
- Create: `test/rng.test.mjs`

**Step 1: Write the failing test `test/rng.test.mjs`.**

```js
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
```

**Step 2: Run to verify it fails.**

Run: `node --test test/rng.test.mjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'rng')`.

**Step 3: Implement inside the engine block** (add above the `return`, and expose a `_test` namespace for white-box tests):

```js
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a PRNG function seeded by an arbitrary string.
function rng(seed) {
  return mulberry32(xmur3(String(seed))());
}
```

Update the return: `return { VERSION, _test: { rng } };`

**Step 4: Run to verify it passes.**

Run: `node --test test/rng.test.mjs`
Expected: PASS — 3 tests.

**Step 5: Commit.**

```bash
git add index.html test/rng.test.mjs
git commit -m "feat: add seeded RNG (xmur3 + mulberry32) to engine"
```

---

## Task 2: Curated color palette

**Files:**
- Modify: `index.html` (engine block)
- Create: `test/palette.test.mjs`

**Step 1: Write the failing test.**

```js
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
```

**Step 2: Run to verify it fails.** Run: `node --test test/palette.test.mjs` — FAIL (`S.PALETTE` undefined).

**Step 3: Implement** — add to engine and to the return object. Colors drawn from both reference images:

```js
const PALETTE = [
  { name: "cyan",       hex: "#29abe2" },
  { name: "pink",       hex: "#d6336c" },
  { name: "lime",       hex: "#a0c814" },
  { name: "periwinkle", hex: "#8c7bf0" },
  { name: "orange",     hex: "#f7931e" },
  { name: "blue",       hex: "#2e8fe0" },
  { name: "spring",     hex: "#2be89c" },
  { name: "purple",     hex: "#8b1a89" },
];
```

Add `PALETTE` to the return object.

**Step 4: Run to verify it passes.** Expected: PASS.

**Step 5: Commit.** `git commit -am "feat: add curated expandable color palette"`

---

## Task 3: Top/bottom module vocabulary

Modules are the hand-authored feature set. Each is `{ name, rows }` where `rows`
is a 4×4 block of 4-bit left-half patterns. Tops fill rows 0–3, bottoms fill rows 4–7.

**Files:**
- Modify: `index.html` (engine block)
- Create: `test/modules.test.mjs`

**Step 1: Write the failing test.**

```js
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
  assert.deepEqual(S.TOPS.map(m => m.name).sort(),
    ["antennae", "dome", "ears", "flat", "notch"].sort());
  assert.deepEqual(S.BOTTOMS.map(m => m.name).sort(),
    ["flat", "legs", "round", "spikes", "splayed"].sort());
});
```

**Step 2: Run to verify it fails.** FAIL — `S.TOPS` undefined.

**Step 3: Implement** these starting patterns (visually tuned later in Task 18).
Columns are left→center `[x0,x1,x2,x3]`; `x3` abuts the mirror line.

```js
// rows 0..3 (top half)
const TOPS = [
  { name: "dome",     rows: [[0,0,1,1],[0,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { name: "flat",     rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { name: "notch",    rows: [[0,0,1,0],[0,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { name: "ears",     rows: [[0,1,1,0],[0,1,1,0],[1,1,1,1],[1,1,1,1]] },
  { name: "antennae", rows: [[1,0,0,1],[1,0,1,1],[1,1,1,1],[1,1,1,1]] },
];
// rows 4..7 (bottom half)
const BOTTOMS = [
  { name: "flat",    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
  { name: "round",   rows: [[1,1,1,1],[1,1,1,1],[0,1,1,1],[0,0,1,1]] },
  { name: "legs",    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[0,1,1,0]] },
  { name: "splayed", rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,0,0]] },
  { name: "spikes",  rows: [[1,1,1,1],[1,1,1,1],[1,0,1,1],[1,0,0,1]] },
];
```

Add `TOPS` and `BOTTOMS` to the return object.

**Step 4: Run to verify it passes.** Expected: PASS — 3 tests.

**Step 5: Commit.** `git commit -am "feat: add top/bottom module vocabulary"`

---

## Task 4: `generate(seed) → spec`

**Files:**
- Modify: `index.html` (engine block)
- Create: `test/generate.test.mjs`

**Step 1: Write the failing test.**

```js
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
```

**Step 2: Run to verify it fails.** FAIL — `S.generate` undefined.

**Step 3: Implement.**

```js
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// A short pronounceable-ish seed string from a rng (used by the 🎲 button).
function randomSeed(r) {
  return Math.floor(r() * 0xffffffff).toString(36);
}

function generate(seed) {
  const r = rng(seed);
  return {
    seed: String(seed),
    color: pick(r, PALETTE),
    top: pick(r, TOPS).name,
    bottom: pick(r, BOTTOMS).name,
    edges: r() < 0.35 ? "bumps" : "straight",
    eyes: {
      style: r() < 0.18 ? "visor" : "normal",
      row: 2 + (r() < 0.5 ? 0 : 1), // 2 or 3
      spacing: r() < 0.5 ? "close" : "wide",
      gaze: { dx: 0, dy: 0 }, // animated at runtime; static default centered
    },
  };
}
```

Add `generate` and `randomSeed` to the return object.

**Step 4: Run to verify it passes.** Expected: PASS — 4 tests.

**Step 5: Commit.** `git commit -am "feat: add generate(seed) -> spec"`

---

## Task 5: `rasterize(spec) → 8×8 grid` (symmetry + eyes)

**Files:**
- Modify: `index.html` (engine block)
- Create: `test/rasterize.test.mjs`

**Step 1: Write the failing test.**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();
const grid = (seed) => S.rasterize(S.generate(seed));

test("grid is 8x8", () => {
  const g = grid("abc");
  assert.equal(g.length, 8);
  for (const row of g) assert.equal(row.length, 8);
});

test("body cells are left-right symmetric", () => {
  const g = grid("abc");
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++) {
      const l = g[y][x] === 1, r = g[y][7 - x] === 1;
      assert.equal(l, r, `asymmetry at (${x},${y})`);
    }
});

test("eyes are always present (white + pupil)", () => {
  for (const seed of ["a","b","c","d","e","f"]) {
    const g = grid(seed);
    const flat = g.flat();
    assert.ok(flat.includes(2), `${seed}: no eye-white`);
    assert.ok(flat.includes(3), `${seed}: no pupil`);
  }
});

test("all cells use valid codes", () => {
  const g = grid("xyz");
  for (const row of g) for (const c of row) assert.ok([0,1,2,3].includes(c));
});

test("rasterize is deterministic", () => {
  assert.deepEqual(grid("abc"), grid("abc"));
});
```

**Step 2: Run to verify it fails.** FAIL — `S.rasterize` undefined.

**Step 3: Implement.** Build left half from modules, mirror, then stamp eyes.
Accepts an optional `frame` (used later by animation; defaults to static).

```js
function moduleByName(group, name) {
  return group.find(m => m.name === name) || group[0];
}

function emptyGrid() {
  return Array.from({ length: 8 }, () => new Array(8).fill(0));
}

// frame = { gaze:{dx,dy}, blink:false } — optional, defaults to spec's eyes.
function rasterize(spec, frame) {
  const g = emptyGrid();
  const top = moduleByName(TOPS, spec.top);
  const bottom = moduleByName(BOTTOMS, spec.bottom);
  const halfRows = [...top.rows, ...bottom.rows]; // 8 rows × 4 left cols

  // Fill left half + mirror.
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 4; x++)
      if (halfRows[y][x]) { g[y][x] = 1; g[y][7 - x] = 1; }

  // Edge "bumps": carve a single notch on the outer column mid-body.
  if (spec.edges === "bumps") {
    for (const y of [3, 4]) { g[y][0] = 0; g[y][7] = 0; }
  }

  stampEyes(g, spec, frame);
  return g;
}

function stampEyes(g, spec, frame) {
  const gaze = (frame && frame.gaze) || spec.eyes.gaze || { dx: 0, dy: 0 };
  const blink = !!(frame && frame.blink);
  const r0 = spec.eyes.row;                 // top row of 2-tall eye
  const leftX = spec.eyes.spacing === "wide" ? 1 : 2; // left eye starts here

  // helper to set a cell only if it is currently body (keeps eyes on the face)
  const put = (x, y, code) => { if (g[y] && g[y][x] === 1) g[y][x] = code; if (g[y] && g[y][x] === 2 && code === 3) g[y][x] = 3; };

  if (spec.eyes.style === "visor") {
    // black band across the eye row with two white holes
    for (let x = 0; x < 8; x++) if (g[r0][x] === 1) g[r0][x] = 3;
    for (const ex of [leftX, 7 - leftX]) if (g[r0][ex] === 3) g[r0][ex] = 2;
    return;
  }

  // normal: 2x2 white eye blocks, pupil placed by gaze, both eyes mirror.
  for (const baseX of [leftX, 7 - leftX - 1]) {
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) put(baseX + dx, r0 + dy, 2);
    if (!blink) {
      const px = baseX + (gaze.dx > 0 ? 1 : 0);
      const py = r0 + (gaze.dy > 0 ? 1 : 0);
      put(px, py, 3);
    }
  }
}
```

Add `rasterize` to the return object.

**Step 4: Run to verify it passes.** Expected: PASS — 5 tests.

**Step 5: Commit.** `git commit -am "feat: add rasterize() with symmetry and eyes"`

---

## Task 6: `selfTest()` + `?test` self-check entry point

**Files:**
- Modify: `index.html` (engine block + a tiny bootstrap script)
- Create: `test/selftest.test.mjs`

**Step 1: Write the failing test.**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadEngine } from "./_engine.mjs";

const S = loadEngine();

test("selfTest returns {passed:true} over many seeds", () => {
  const res = S.selfTest();
  assert.equal(res.passed, true, JSON.stringify(res.failures));
});
```

**Step 2: Run to verify it fails.** FAIL — `S.selfTest` undefined.

**Step 3: Implement** an invariant sweep over generated critters:

```js
function selfTest() {
  const failures = [];
  for (let i = 0; i < 300; i++) {
    const spec = generate("seed-" + i);
    const g = rasterize(spec);
    if (g.length !== 8 || g.some(r => r.length !== 8)) failures.push([i, "size"]);
    let symOk = true, hasWhite = false, hasPupil = false;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const c = g[y][x];
      if (![0,1,2,3].includes(c)) failures.push([i, "code", x, y]);
      if ((g[y][x] === 1) !== (g[y][7 - x] === 1)) symOk = false;
      if (c === 2) hasWhite = true;
      if (c === 3) hasPupil = true;
    }
    if (!symOk) failures.push([i, "symmetry"]);
    if (!hasWhite || !hasPupil) failures.push([i, "eyes"]);
    if (JSON.stringify(g) !== JSON.stringify(rasterize(generate("seed-" + i))))
      failures.push([i, "determinism"]);
  }
  return { passed: failures.length === 0, failures };
}
```

Add `selfTest` to the return object. Then add a bootstrap in the lower (non-engine) script so `index.html?test` logs results:

```js
if (location.search.includes("test")) {
  const r = Sycritters.selfTest();
  console.log(r.passed ? "Sycritters selfTest: PASS" : "Sycritters selfTest: FAIL", r.failures);
}
```

**Step 4: Run to verify it passes.** Run `node --test test/` — Expected: ALL tests PASS.

**Step 5: Commit.** `git commit -am "feat: add engine selfTest and ?test bootstrap"`

---

## Task 7: Canvas renderer (pixel-perfect, scalable) — visual verify

**Files:** Modify `index.html` (lower script).

**Step 1: Implement `drawCanvas`.**

```js
// codes -> fill style; null = leave transparent
function codeColor(code, bodyHex) {
  return code === 1 ? bodyHex : code === 2 ? "#ffffff" : code === 3 ? "#000000" : null;
}

// Draws an 8x8 grid into a canvas at the given integer pixel scale.
// transform (optional) = { dx, dy, squashY } in *cell* units for body animation.
function drawCanvas(canvas, grid, bodyHex, scale, transform) {
  const t = transform || { dx: 0, dy: 0, squashY: 1 };
  const ctx = canvas.getContext("2d");
  canvas.width = 8 * scale;
  canvas.height = 8 * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const fill = codeColor(grid[y][x], bodyHex);
      if (!fill) continue;
      ctx.fillStyle = fill;
      const px = Math.round((x + t.dx) * scale);
      const h = scale * t.squashY;
      const py = Math.round((y * t.squashY + t.dy + 8 * (1 - t.squashY)) * scale);
      ctx.fillRect(px, py, scale, Math.ceil(h));
    }
}
```

**Step 2: Visual verify.** Temporarily add `<canvas id="probe"></canvas>` and call `drawCanvas(probe, Sycritters.rasterize(Sycritters.generate("abc")), "#29abe2", 24)`. Launch via the `run`/preview tooling and screenshot. Confirm: crisp pixels, no blur, recognizable critter.

**Step 3: Commit.** `git commit -am "feat: add pixel-perfect canvas renderer"`

---

## Task 8: SVG renderer — visual verify

**Files:** Modify `index.html` (lower script).

**Step 1: Implement `toSVG`.**

```js
function toSVG(grid, bodyHex, scale) {
  const s = scale || 1;
  let rects = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const fill = codeColor(grid[y][x], bodyHex);
      if (!fill) continue;
      rects += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="${fill}"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${8 * s}" height="${8 * s}" ` +
    `viewBox="0 0 ${8 * s} ${8 * s}" shape-rendering="crispEdges">${rects}</svg>`;
}
```

**Step 2: Visual verify.** Log `toSVG(...)` to console, paste into a file or `img`, confirm it matches the canvas output.

**Step 3: Commit.** `git commit -am "feat: add SVG renderer"`

---

## Task 9: Playground layout + CSS

**Files:** Modify `index.html` (`<style>` and `#app`).

**Step 1: Build the static layout** — editor panel (large canvas), control panel (right), gallery wall (below). Use a retro-but-clean look (dark canvas stage, light controls). Concrete structure:

```html
<main id="app">
  <header><h1>Sycritters</h1></header>
  <section class="stage">
    <div class="editor"><canvas id="editor"></canvas></div>
    <aside class="controls">
      <div class="row"><label>Seed</label><input id="seed" /><button id="rand">🎲</button></div>
      <button id="surprise">Surprise me</button>
      <div class="group" id="palette"></div>
      <label><input type="checkbox" id="animColor" /> Animate color</label>
      <div class="group" id="tops"></div>
      <div class="group" id="bottoms"></div>
      <div class="group" id="eyeStyle"></div>
      <div class="group" id="eyeSpacing"></div>
      <label><input type="checkbox" id="animEyes" checked /> Animate eyes</label>
      <div class="group" id="bodyAnim"></div>
      <div class="row"><button id="png">PNG</button><button id="svg">SVG</button></div>
    </aside>
  </section>
  <section class="wall"><button id="genWall">Generate wall</button><div id="grid"></div></section>
</main>
```

Style with CSS grid; canvas uses `image-rendering: pixelated`. Keep all styles in the `<style>` block.

**Step 2: Visual verify.** Launch + screenshot. Confirm layout reads well, is responsive enough.

**Step 3: Commit.** `git commit -am "feat: playground layout and styling"`

---

## Task 10: Editor state + seed + Random + Surprise me

**Files:** Modify `index.html` (lower script).

**Step 1: Implement editor state and the lock-an-axis model.** Single `current` spec; `setSeed` regenerates all axes; control overrides mutate one axis and re-render.

```js
const editor = document.getElementById("editor");
let current = Sycritters.generate("sycritter");
let dirty = true;

function setSeedAndRegen(seed) { current = Sycritters.generate(seed); document.getElementById("seed").value = current.seed; dirty = true; }
function override(patch) { current = structuredClone(current); Object.assign(current, patch); dirty = true; }

document.getElementById("seed").addEventListener("change", e => setSeedAndRegen(e.target.value || Sycritters.randomSeed(Sycritters._test.rng(String(performance.now())))));
document.getElementById("rand").addEventListener("click", () => setSeedAndRegen(Sycritters.randomSeed(Sycritters._test.rng(String(performance.now())))));
document.getElementById("surprise").addEventListener("click", () => setSeedAndRegen(Sycritters.randomSeed(Sycritters._test.rng(String(performance.now())))));
```

(The animation loop in Task 15 owns rendering; until then, render once after each change with `drawCanvas(editor, Sycritters.rasterize(current), current.color.hex, 32)`.)

**Step 2: Visual verify.** Clicking 🎲 / Surprise me yields new critters; typing a seed reproduces the same critter every time.

**Step 3: Commit.** `git commit -am "feat: editor state with seed, random, surprise-me"`

---

## Task 11: Color palette swatches (override + Random)

**Files:** Modify `index.html` (lower script).

**Step 1:** Render a swatch button per `Sycritters.PALETTE` entry into `#palette`, plus a "random color" swatch. Clicking a swatch calls `override({ color })` (lock-an-axis: shape/eyes unchanged). Highlight the active swatch.

**Step 2: Visual verify.** Selecting a color changes only the body color.

**Step 3: Commit.** `git commit -am "feat: color palette swatches"`

---

## Task 12: Top / bottom / eye selectors (lock-an-axis)

**Files:** Modify `index.html` (lower script).

**Step 1:** Render segmented buttons for `TOPS`, `BOTTOMS`, eye style (`normal`/`visor`), eye spacing (`close`/`wide`) into their groups, each with a trailing "🎲 random" choice. Handlers use `override(...)`:
- top → `override({ top: name })`
- bottom → `override({ bottom: name })`
- eye style → `override({ eyes: { ...current.eyes, style } })`
- eye spacing → `override({ eyes: { ...current.eyes, spacing } })`

Reflect the active option for each group from `current`.

**Step 2: Visual verify.** Each control changes only its axis; combinations stay coherent. Note any module that reads poorly for tuning in Task 18.

**Step 3: Commit.** `git commit -am "feat: top/bottom/eye selectors with lock-an-axis overrides"`

---

## Task 13: Gallery wall (generate + click-to-load)

**Files:** Modify `index.html` (lower script).

**Step 1:** "Generate wall" renders ~24 small canvases into `#grid`, each from a fresh random seed; store each seed on the element. Clicking a tile calls `setSeedAndRegen(tile.dataset.seed)` to load it into the editor. Add a "Shuffle" affordance (re-run generate wall).

```js
function generateWall(n = 24) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const seed = Sycritters.randomSeed(Sycritters._test.rng(String(performance.now()) + i));
    const spec = Sycritters.generate(seed);
    const c = document.createElement("canvas");
    drawCanvas(c, Sycritters.rasterize(spec), spec.color.hex, 8);
    c.dataset.seed = seed;
    c.className = "tile";
    c.addEventListener("click", () => setSeedAndRegen(seed));
    grid.appendChild(c);
  }
}
document.getElementById("genWall").addEventListener("click", () => generateWall());
```

**Step 2: Visual verify.** Wall fills with varied critters; clicking loads into editor.

**Step 3: Commit.** `git commit -am "feat: gallery wall with click-to-load"`

---

## Task 14: Export PNG + SVG

**Files:** Modify `index.html` (lower script).

**Step 1:** PNG = render `current` to an offscreen canvas at export scale (e.g. 32) and trigger download via `toDataURL`. SVG = `toSVG(...)` → Blob → download. Filenames include the seed.

```js
function downloadPNG(scale = 32) {
  const c = document.createElement("canvas");
  drawCanvas(c, Sycritters.rasterize(current), current.color.hex, scale);
  const a = document.createElement("a");
  a.download = `sycritter-${current.seed}.png`;
  a.href = c.toDataURL("image/png");
  a.click();
}
function downloadSVG(scale = 32) {
  const svg = toSVG(Sycritters.rasterize(current), current.color.hex, scale);
  const a = document.createElement("a");
  a.download = `sycritter-${current.seed}.svg`;
  a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  a.click();
}
document.getElementById("png").addEventListener("click", () => downloadPNG());
document.getElementById("svg").addEventListener("click", () => downloadSVG());
```

**Step 2: Visual verify.** Downloaded PNG is crisp at scale; SVG opens and matches.

**Step 3: Commit.** `git commit -am "feat: PNG and SVG export"`

---

## Task 15: Animation loop + color animation

**Files:** Modify `index.html` (lower script).

**Step 1:** Replace one-shot rendering with a single `requestAnimationFrame` loop computing the frame from `(current, time)`. Color animation rotates hue when `#animColor` is checked.

```js
function hueShift(hex, deg) { /* hex->hsl, add deg, ->hex */ }

function frameAt(t) {
  const f = { gaze: { dx: 0, dy: 0 }, blink: false };
  let body = current.color.hex;
  if (document.getElementById("animColor").checked) body = hueShift(current.color.hex, (t * 0.05) % 360);
  return { grid: Sycritters.rasterize(current, f), body };
}

function loop(t) {
  const { grid, body } = frameAt(t);
  drawCanvas(editor, grid, body, 32, bodyTransform(t));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

(`bodyTransform` returns identity until Task 17. Implement `hueShift` with a small HSL helper.)

**Step 2: Visual verify.** Toggling "Animate color" smoothly cycles the body hue; static otherwise.

**Step 3: Commit.** `git commit -am "feat: rAF loop with color animation"`

---

## Task 16: Eye animation (blink + look-around)

**Files:** Modify `index.html` (lower script).

**Step 1:** When `#animEyes` is checked, drive `frame.gaze` and `frame.blink` from time — periodic look-around (gaze dx/dy steps through a small cycle) and an occasional short blink. Deterministic function of `t` (no `Math.random` in the loop, to keep it smooth and resumable).

```js
function eyeFrame(t) {
  const cycle = (t / 1400) % 4;          // 0..4 slow gaze cycle
  const dirs = [{dx:1,dy:0},{dx:0,dy:0},{dx:-1,dy:0},{dx:0,dy:1}];
  const gaze = dirs[Math.floor(cycle)];
  const blink = (t % 3800) < 120;        // brief blink ~every 3.8s
  return { gaze, blink };
}
```

Wire into `frameAt`: when animate-eyes is on use `eyeFrame(t)`, else `{gaze:current.eyes.gaze, blink:false}`.

**Step 2: Visual verify.** Eyes glance around and blink naturally; toggle disables it.

**Step 3: Commit.** `git commit -am "feat: eye blink + look-around animation"`

---

## Task 17 (Stretch): Body animations — bob / jump / walk

**Files:** Modify `index.html` (lower script).

**Step 1:** Render the `#bodyAnim` segmented control (`none/bob/jump/walk`). Implement `bodyTransform(t)` returning `{dx,dy,squashY}` per mode:
- **bob:** `dy = 0.15 * sin(t/500)`.
- **jump:** parabolic hop on a period with a small squash on landing.
- **walk:** small `dx` sway + alternate the two leg rows (toggle which bottom leg pixels show) + slight `dy` bounce.

Walk's leg alternation needs the rasterizer to optionally swap leg columns; add an optional `frame.step ∈ {0,1}` that mirrors the bottom-most row pattern when set, applied only for `bottom ∈ {legs, splayed, spikes}`.

**Step 2: Visual verify.** Each mode animates plausibly; "none" is static. Walk legs alternate.

**Step 3: Commit.** `git commit -am "feat: body animations (bob/jump/walk)"`

---

## Task 18: Visual tuning pass (module pixel patterns)

**Files:** Modify `index.html` (engine block — pattern data only).

**Step 1:** Generate a wall and screenshot. For each top/bottom/eye combo that reads poorly (e.g., ears not reading as ears, spikes too subtle), adjust the 4×4 bit patterns in `TOPS`/`BOTTOMS` and the eye coordinates. Re-run `node --test test/` after each change — invariants (symmetry, eyes present, determinism) must stay green.

**Step 2: Verify.** `node --test test/` PASS + a final wall screenshot that looks like a coherent family alongside the reference images.

**Step 3: Commit.** `git commit -am "polish: tune module pixel patterns for readability"`

---

## Task 19: Final verification + README note

**Files:** Modify `index.html`; create `README.md` (short).

**Step 1:** Run `node --test test/` (all green) and load `index.html?test` in-browser (console shows `selfTest: PASS`). Confirm: seed reproducibility, all controls, gallery, export, animations. Take a final screenshot.

**Step 2:** Write a short `README.md`: what it is, how to open (just open `index.html`), how to run engine tests (`node --test test/`), and that the engine lives in the marked block.

**Step 3: Commit.** `git commit -am "docs: add README; final verification"`

---

## Verification checklist (definition of done)

- [ ] `node --test test/` — all engine tests pass.
- [ ] `index.html` opens standalone (file://) with no console errors; `?test` prints PASS.
- [ ] Same seed always reproduces the same critter.
- [ ] Color palette, top, bottom, eye style/spacing all work as lock-an-axis overrides.
- [ ] Animate color, animate eyes, and at least bob/jump/walk body animation work.
- [ ] Gallery wall generates and click-to-load works.
- [ ] PNG and SVG export produce correct files.
- [ ] Critters read as a coherent family next to the reference images.
