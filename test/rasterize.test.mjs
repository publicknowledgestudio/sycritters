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

test("silhouette is left-right symmetric for symmetric modules", () => {
  // The outline is symmetric when top & bottom are symmetric modules (eyes may
  // recolor body cells off-center); asymmetric slants (tl/tr/bl/br) break it.
  for (const seed of ["abc", "gap1-seed", "tall-seed", "xyz"]) {
    const g = S.rasterize({ ...S.generate(seed), top: "dome", bottom: "round", waist: "straight" });
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 4; x++) {
        const l = g[y][x] !== 0, r = g[y][7 - x] !== 0;
        assert.equal(l, r, `${seed}: asymmetry at (${x},${y})`);
      }
  }
});

test("'3tr' carves a 3-step top-right diagonal staircase", () => {
  const spec = {
    ...S.generate("x"), top: "3tr", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(g[0][5], 0); assert.equal(g[0][6], 0); assert.equal(g[0][7], 0);
  assert.equal(g[1][6], 0); assert.equal(g[1][7], 0);
  assert.equal(g[2][7], 0);
  assert.equal(g[0][0], 1); assert.equal(g[1][0], 1); // left side intact
});

test("'2tr' is a shallower 2-step cut than '3tr'", () => {
  const base = {
    ...S.generate("x"), bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize({ ...base, top: "2tr" });
  assert.equal(g[0][6], 0); assert.equal(g[0][7], 0); // 2 cut on row 0
  assert.equal(g[1][7], 0);                           // 1 cut on row 1
  assert.equal(g[0][5], 1);                           // doesn't reach col 5
  assert.equal(g[2][7], 1);                           // doesn't reach row 2
});

test("handle top has a full cap with open side pixels below", () => {
  const spec = {
    ...S.generate("x"), top: "handle", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[0]), JSON.stringify([1,1,1,1,1,1,1,1]));
  assert.equal(JSON.stringify(g[1]), JSON.stringify([0,1,1,1,1,1,1,0]));
});

test("lego top has a four-wide nub over a full row", () => {
  const spec = {
    ...S.generate("x"), top: "lego", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[0]), JSON.stringify([0,0,1,1,1,1,0,0]));
  assert.equal(JSON.stringify(g[1]), JSON.stringify([1,1,1,1,1,1,1,1]));
});

test("tail-l top has a left-side two-pixel cut over a full row", () => {
  const spec = {
    ...S.generate("x"), top: "tail-l", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[0]), JSON.stringify([1,0,0,1,1,1,1,1]));
  assert.equal(JSON.stringify(g[1]), JSON.stringify([1,1,1,1,1,1,1,1]));
});

test("tail-r top has a right-side two-pixel cut over a full row", () => {
  const spec = {
    ...S.generate("x"), top: "tail-r", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 5, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[0]), JSON.stringify([1,1,1,1,1,0,0,1]));
  assert.equal(JSON.stringify(g[1]), JSON.stringify([1,1,1,1,1,1,1,1]));
});

test("eyes move down before their frame changes the top silhouette", () => {
  const spec = {
    ...S.generate("x"), top: "dome", bottom: "flat", waist: "straight",
    eyes: { style: "normal", row: 2, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g.map((row) => row.map((c) => c ? 1 : 0)).slice(0, 4)), JSON.stringify([
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1],
  ]));
  assert.ok(g[3].includes(2), "eye whites start on row 3 after being pushed down");
  assert.ok(!g[2].includes(2), "eye whites no longer start on row 2");
});

test("eyes prefer removing middle cutouts over moving into the bottom", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "flat", waist: "pinch",
    eyes: { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.ok(g[3].includes(2), "eye whites stay on requested row 3");
  assert.ok(!g[5].includes(2), "eyes are not pushed into the bottom half");
  assert.equal(g[3][0], 1, "left middle cutout is filled back in for the eye frame");
  assert.equal(g[3][7], 1, "right middle cutout is filled back in for the eye frame");
});

test("3tl plus round bottom and pinch waist makes the asymmetric reference shape", () => {
  const spec = {
    ...S.generate("x"), top: "3tl", bottom: "round", waist: "pinch",
    eyes: { style: "tall", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g.map((row) => row.map((c) => c ? 1 : 0))), JSON.stringify([
    [0,0,0,1,1,1,1,1],
    [0,0,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
  ]));
});

test("eye alignment shifts eyes left vs right", () => {
  const base = {
    ...S.generate("x"), top: "flat", bottom: "flat", waist: "straight",
    eyes: { style: "tall", row: 3, gap: 1, align: "left", gaze: { dx: 0, dy: 0 } },
  };
  const whiteCols = (g) => {
    const cols = [];
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if (g[y][x] === 2) { cols.push(x); break; }
    return cols;
  };
  const L = whiteCols(S.rasterize(base));
  const R = whiteCols(S.rasterize({ ...base, eyes: { ...base.eyes, align: "right" } }));
  assert.ok(L[0] < R[0], `left-aligned eyes start further left (${L} vs ${R})`);
});

test("tall eyes rest with the pupil in the lower cell", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "flat", waist: "straight",
    eyes: { style: "tall", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.ok(g[4].includes(3), "pupil on the lower eye row");
  assert.ok(!g[3].includes(3), "no pupil on the upper eye row");
});

test("visor2 is a 2px-tall band with white holes", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "flat", waist: "straight",
    eyes: { style: "visor2", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.ok(g[3].includes(3) && g[4].includes(3), "band spans rows 3 and 4");
  assert.ok(g[3].includes(2) && g[4].includes(2), "white holes on both rows");
});

test("eyes are always present (white + pupil)", () => {
  for (const seed of ["a","b","c","d","e","f"]) {
    const g = grid(seed);
    const flat = g.flat();
    assert.ok(flat.includes(2), `${seed}: no eye-white`);
    assert.ok(flat.includes(3), `${seed}: no pupil`);
  }
});

test("toes-a leaves alternating foot gaps starting filled", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "toes-a", waist: "straight",
    eyes: { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[6]), JSON.stringify([1,1,1,1,1,1,1,1]));
  assert.equal(JSON.stringify(g[7]), JSON.stringify([1,0,1,0,1,0,1,0]));
});

test("toes-b leaves alternating foot gaps starting empty", () => {
  const spec = {
    ...S.generate("x"), top: "flat", bottom: "toes-b", waist: "straight",
    eyes: { style: "normal", row: 3, gap: 1, align: "center", gaze: { dx: 0, dy: 0 } },
  };
  const g = S.rasterize(spec);
  assert.equal(JSON.stringify(g[6]), JSON.stringify([1,1,1,1,1,1,1,1]));
  assert.equal(JSON.stringify(g[7]), JSON.stringify([0,1,0,1,0,1,0,1]));
});

test("every eye cell keeps a 1px solid body frame (no empty neighbor)", () => {
  for (const seed of ["a","b","c","d","e","f","g","h","i","j","k","l","m","n"]) {
    const g = grid(seed);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        if (g[y][x] !== 2 && g[y][x] !== 3) continue; // eye-white / pupil
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
            assert.notEqual(g[ny][nx], 0, `${seed}: empty (${nx},${ny}) touches eye (${x},${y})`);
          }
      }
  }
});

test("all cells use valid codes", () => {
  const g = grid("xyz");
  for (const row of g) for (const c of row) assert.ok([0,1,2,3].includes(c));
});

test("rasterize is deterministic", () => {
  assert.deepEqual(grid("abc"), grid("abc"));
});
