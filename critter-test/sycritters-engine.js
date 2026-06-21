globalThis.Sycritters = (function () {
  "use strict";
  const VERSION = "0.0.1";

  // --- Seeded RNG ---------------------------------------------------------
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

  // --- Curated palette ----------------------------------------------------
  // Ordered around the hue wheel so consecutive entries are analogous
  // (gradients are built from consecutive runs -> always harmonious).
  const PALETTE = [
    { name: "amber",      hex: "#ffb000" },
    { name: "chartreuse", hex: "#b8d94a" },
    { name: "mint",       hex: "#5ee0a0" },
    { name: "teal",       hex: "#28c7c7" },
    { name: "azure",      hex: "#3b82f6" },
    { name: "violet",     hex: "#6d5dfc" },
    { name: "orchid",     hex: "#c056d9" },
    { name: "coral",      hex: "#ff6b5a" },
  ];

  // --- Shared option lists (used by generate + the spec codec) -------------
  const DIRS = ["none", "diagonal-left", "diagonal-right", "radial"];
  // Legacy paint-motion codec axis. The UI now exposes agent states instead.
  const MOTIONS = ["static", "drift", "pulse", "sheen"];
  const WAISTS = ["straight", "pinch", "narrow", "bite-l", "bite-r"];
  const EYE_STYLES = ["normal", "tall", "visor", "visor2", "short"]; // appended: codec indices stay stable
  const ALIGNS = ["left", "center", "right"];
  const PUPILS = ["dot", "bar"];

  // --- Module vocabulary --------------------------------------------------
  // Each module is a 4x4 left-half block. Columns are left->center
  // [x0,x1,x2,x3]; x3 abuts the mirror line. Tops fill rows 0-3, bottoms 4-7.
  const TOPS = [
    { name: "dome",     rows: [[0,0,1,1],[0,1,1,1],[1,1,1,1],[1,1,1,1]] },
    { name: "flat",     rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
    { name: "notch",    rows: [[0,0,1,0],[0,1,1,1],[1,1,1,1],[1,1,1,1]] },
    { name: "ears",     rows: [[0,1,1,0],[0,1,1,0],[1,1,1,1],[1,1,1,1]] },
    { name: "antennae", rows: [[0,1,0,0],[0,1,1,1],[1,1,1,1],[1,1,1,1]] },
    { name: "loaf",     rows: [[0,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] }, // corners-cut flat
    { name: "crown",    rows: [[1,0,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] }, // flat with 1px slits
    { name: "w",        rows: [[0,1,1,0],[0,1,1,1],[1,1,1,1],[1,1,1,1]] }, // horns, center fills a row lower
    { name: "trident",  rows: [[0,1,0,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] }, // three nubs
    { name: "dots",     rows: [[1,0,1,1],[0,1,1,1],[1,1,1,1],[1,1,1,1]] }, // detached corner pixels
    { name: "handle",   rows: [[1,1,1,1],[0,1,1,1],[1,1,1,1],[1,1,1,1]] }, // full cap, open side pixels
    { name: "lego",     rows: [[0,0,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] }, // centered 4-wide nub
    { name: "tail-l", full: true, rows: [[1,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]] },
    { name: "tail-r", full: true, rows: [[1,1,1,1,1,0,0,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]] },
    // asymmetric diagonal slants (full 8-wide, not mirrored); 2 = shallow, 3 = deep:
    { name: "2tl", full: true, rows: [[0,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]] },
    { name: "2tr", full: true, rows: [[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]] },
    { name: "3tl", full: true, rows: [[0,0,0,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]] },
    { name: "3tr", full: true, rows: [[1,1,1,1,1,0,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1]] },
  ];
  const BOTTOMS = [
    { name: "flat",    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] },
    { name: "round",   rows: [[1,1,1,1],[1,1,1,1],[0,1,1,1],[0,0,1,1]] },
    { name: "legs",    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[0,1,1,0]] },
    { name: "splayed", rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,0,0]] },
    { name: "tripod",  rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,0,1]] }, // 2-1-2-1-2 legs
    { name: "tripod2", rows: [[1,1,1,1],[1,1,1,1],[1,1,0,1],[1,1,0,1]] }, // tripod on 2-row stilts
    { name: "toes",    rows: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[0,1,0,1]] }, // three inset feet (1-2-1)
    { name: "toes-a",  full: true, rows: [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,0,1,0]] },
    { name: "toes-b",  full: true, rows: [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,0,1,0,1,0,1]] },
    { name: "dots",    rows: [[1,1,1,1],[1,1,1,1],[0,1,1,1],[1,0,1,1]] }, // detached corner pixels
    // asymmetric diagonal slants (full 8-wide, not mirrored); 2 = shallow, 3 = deep:
    { name: "2bl", full: true, rows: [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]] },
    { name: "2br", full: true, rows: [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,0,0]] },
    { name: "3bl", full: true, rows: [[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1]] },
    { name: "3br", full: true, rows: [[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,0,0,0]] },
  ];

  // --- Generation: seed -> spec ------------------------------------------
  function pick(r, arr) {
    return arr[Math.floor(r() * arr.length)];
  }

  // A short seed string derived from a rng (used by the 🎲 button).
  function randomSeed(r) {
    return Math.floor(r() * 0xffffffff).toString(36);
  }

  function generate(seed) {
    const r = rng(seed);
    const n = r() < 0.85 ? 2 : 3;                       // mostly 2 colors (subtle)
    const start = Math.floor(r() * PALETTE.length);
    const colors = [];                                  // analogous run -> harmonious
    for (let j = 0; j < n; j++) colors.push(PALETTE[(start + j) % PALETTE.length]);
    const gradientDir = DIRS[Math.floor(r() * DIRS.length)];
    const gradientMotion = "static";
    const slant = (nm) => /^[23][tb][lr]$/.test(nm);
    const deep = (nm) => /^3[tb][lr]$/.test(nm);          // deep slants read lopsided -> manual-only
    const top = pick(r, TOPS.filter((m) => !deep(m.name))).name;
    let bpool = BOTTOMS.filter((m) => !deep(m.name));
    if (slant(top)) bpool = bpool.filter((m) => !slant(m.name)); // at most one slant
    const bottom = pick(r, bpool).name;
    let waist = ["straight", "straight", "straight", "pinch", "pinch", "narrow"][Math.floor(r() * 6)];
    if ((slant(top) || slant(bottom)) && waist === "narrow") waist = "straight"; // slant already trims
    // mild one-sided bite, decided after the eye gap below so spec and render
    // always agree (both rolls kept here so downstream seeds don't shift)
    const biteRoll = r(); r();
    r(); // keep seeded RNG sequence stable while eyes are temporarily fixed.
    const style = "normal";
    const row = 2 + (r() < 0.5 ? 0 : 1);               // 2 or 3
    const gap = r() < 0.5 ? 1 : 2;                      // px between the eyes (no 0)
    // the eye frame refills empty cells next to eyes: gap-1 centered eyes sit
    // at cols 1-2 / 4-5, leaving only col 7 clear -> random bites are right-
    // side and gap-1 only; bite-l stays a manual pick
    if (biteRoll < 0.15 && waist === "straight" && gap === 1 && !slant(top) && !slant(bottom))
      waist = "bite-r";
    const align = (r(), "center"); // random eyes stay centered; left/right is a manual control
    const gaze = { dx: r() < 0.5 ? 0 : 1, dy: r() < 0.6 ? 0 : 1 };
    // random eyes are always parallel bar pupils (rolls kept so seeds don't shift);
    // dot pupils and mirrored gaze stay manual picks
    r(); r();
    const pupil = "bar";
    const mirror = false;
    return { seed: String(seed), colors, gradientDir, gradientMotion, top, bottom, waist,
      eyes: { style, row, gap, align, gaze, pupil, mirror } };
  }

  // --- Rasterize: spec -> 8x8 grid of codes (0 empty,1 body,2 white,3 pupil)
  function moduleByName(group, name) {
    return group.find((m) => m.name === name) || group[0];
  }

  function emptyGrid() {
    return Array.from({ length: 8 }, () => new Array(8).fill(0));
  }

  // frame = { gaze:{dx,dy}, blink:bool } — optional; defaults to spec's eyes.
  // Expand a module to full 8-wide rows: symmetric modules mirror their 4-wide
  // left half; `full` modules already define all 8 columns (asymmetric slants).
  function expandRows(m) {
    if (m.full) return m.rows;
    return m.rows.map((r) => [r[0], r[1], r[2], r[3], r[3], r[2], r[1], r[0]]);
  }

  function rasterize(spec, frame) {
    const g = emptyGrid();
    const rows8 = [
      ...expandRows(moduleByName(TOPS, spec.top)),       // rows 0-3
      ...expandRows(moduleByName(BOTTOMS, spec.bottom)), // rows 4-7
    ];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if (rows8[y][x]) g[y][x] = 1;

    // Waist: pinch the two middle rows (3,4) inward.
    if (spec.waist === "pinch" || spec.waist === "narrow") {
      for (const y of [3, 4]) { g[y][0] = 0; g[y][7] = 0; }
    }
    if (spec.waist === "narrow") {
      for (const y of [3, 4]) { g[y][1] = 0; g[y][6] = 0; }
    }
    // one-sided bites (asymmetric on purpose)
    if (spec.waist === "bite-l") for (const y of [3, 4]) g[y][0] = 0;
    if (spec.waist === "bite-r") for (const y of [3, 4]) g[y][7] = 0;

    // frame.legShift ∈ {-1,0,1}: nudge the feet sideways (celebrate cycle).
    // Row 6 shifts along with row 7 when it has gaps (2-row stilts like
    // tripod2 must move as one piece instead of shearing).
    if (frame && frame.legShift) {
      const s = frame.legShift;
      const shiftRow = (row) => {
        const out = new Array(8).fill(0);
        for (let x = 0; x < 8; x++) {
          const nx = x + s;
          if (nx >= 0 && nx < 8) out[nx] = row[x];
        }
        return out;
      };
      g[7] = shiftRow(g[7]);
      if (g[6].includes(0)) g[6] = shiftRow(g[6]);
    }

    stampEyes(g, spec, frame);
    return g;
  }

  // Left column for an eye group of total width `totalW`. Alignment is a gentle
  // 1px nudge off-center, clamped to stay off the edges (so eyes never jam into
  // a corner and read as lopsided).
  function eyeStart(totalW, align) {
    const center = Math.floor((8 - totalW) / 2);
    const s = align === "left" ? center - 1 : align === "right" ? center + 1 : center;
    return Math.min(7 - totalW, Math.max(1, s));
  }

  function eyeCellsFor(style, row, gap, align) {
    if (style === "visor" || style === "visor2") {
      const rows = style === "visor2" ? [row, row + 1] : [row];
      const cells = [];
      for (const y of rows) for (let x = 0; x < 8; x++) cells.push([x, y]);
      return cells;
    }
    const w = style === "tall" ? 1 : 2;
    const h = style === "short" ? 1 : 2;
    const leftStart = eyeStart(2 * w + gap, align);
    const bases = [leftStart, leftStart + w + gap];
    const cells = [];
    for (const bx of bases)
      for (let ey = 0; ey < h; ey++)
        for (let ex = 0; ex < w; ex++) cells.push([bx + ex, row + ey]);
    return cells;
  }

  function topFrameConflict(g, spec, row, gap, align, style) {
    const symBody = spec.waist.indexOf("bite") !== 0 &&
      !moduleByName(TOPS, spec.top).full && !moduleByName(BOTTOMS, spec.bottom).full;
    for (const [x, y] of eyeCellsFor(style, row, gap, align))
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny > 2) continue;
          for (const cx of symBody ? [nx, 7 - nx] : [nx])
            if (cx >= 0 && cx < 8 && g[ny][cx] === 0) return true;
        }
    return false;
  }

  function effectiveEyeRow(g, spec, gap, align, style) {
    let row = spec.eyes.row;
    const h = style === "short" || style === "visor" ? 1 : 2;
    while (row + h - 1 < 7 && topFrameConflict(g, spec, row, gap, align, style)) row++;
    return row;
  }

  function stampEyes(g, spec, frame) {
    const gaze = (frame && frame.gaze) || spec.eyes.gaze || { dx: 0, dy: 0 };
    // blink phases: 0 open · 1 squint (slit + pupil) · 2 closed (dark lid line);
    // legacy boolean true = fully closed
    const blink = frame && frame.blink === true ? 2 : (frame && frame.blink) || 0;
    const gap = spec.eyes.gap || 1;      // px between the eyes
    const align = spec.eyes.align || "center";
    const style = spec.eyes.style;
    const r0 = effectiveEyeRow(g, spec, gap, align, style); // top row of the eye

    // Guarantee a 1px solid body frame: any empty cell touching an eye cell
    // (incl. the cell itself) becomes body, so eyes never touch an edge/empty.
    // On symmetric bodies the fill is mirrored so gap-1 (off-center) eyes can't
    // skew the silhouette; asymmetric bodies (slants, bites) fill plainly so
    // the deliberate asymmetry isn't repaired.
    const symBody = spec.waist.indexOf("bite") !== 0 &&
      !moduleByName(TOPS, spec.top).full && !moduleByName(BOTTOMS, spec.bottom).full;
    const frameBody = (cells) => {
      for (const [x, y] of cells)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny > 7) continue;
            for (const cx of symBody ? [nx, 7 - nx] : [nx])
              if (cx >= 0 && cx < 8 && g[ny][cx] === 0) g[ny][cx] = 1;
          }
    };

    // visor (1px band) / visor2 (2px band): black band(s) + two white holes.
    if (style === "visor" || style === "visor2") {
      const rows = style === "visor2" ? [r0, r0 + 1] : [r0];
      const band = [];
      for (const ry of rows) for (let x = 0; x < 8; x++) if (g[ry][x] !== 0) band.push([x, ry]);
      frameBody(band);
      const ls = eyeStart(2 + gap, align);
      for (const ry of rows) {
        for (let x = 0; x < 8; x++) if (g[ry][x] === 1) g[ry][x] = 3;
        for (const ex of [ls, ls + 1 + gap]) if (g[ry][ex] === 3) g[ry][ex] = 2;
      }
      return;
    }

    // normal = 2x2 · short = 2x1 (pupil slides sideways) · tall = 1x2 (rests low)
    const w = style === "tall" ? 1 : 2;
    const h = style === "short" ? 1 : 2;
    const mirror = !!spec.eyes.mirror;                         // right eye flips its pupil
    const bar = spec.eyes.pupil === "bar" && style === "normal"; // 1x2 column pupil
    const leftStart = eyeStart(2 * w + gap, align);
    const bases = [leftStart, leftStart + w + gap];
    const cells = [];
    for (const bx of bases)
      for (let ey = 0; ey < h; ey++)
        for (let ex = 0; ex < w; ex++) cells.push([bx + ex, r0 + ey]);
    frameBody(cells);                          // solid body around + behind the eyes
    const lidRow = r0 + h - 1;                 // the row the eyelid closes onto
    if (blink === 2) {
      // closed: the eye region is body except a dark lid line
      for (const [x, y] of cells) g[y][x] = y === lidRow ? 3 : 1;
      return;
    }
    // open (all white) or squint (only the lid row stays open)
    for (const [x, y] of cells) g[y][x] = blink === 1 && y !== lidRow ? 1 : 2;
    bases.forEach((bx, i) => {
      let pdx = w === 1 ? 0 : gaze.dx > 0 ? 1 : 0;
      if (mirror && i === 1 && w === 2) pdx = 1 - pdx;
      if (blink === 1) { g[lidRow][bx + pdx] = 3; return; } // 1px pupil in the slit
      const py = h === 1 ? r0
        : w === 1 ? r0 + (gaze.dy < 0 ? 0 : 1)   // tall eyes rest low
        : r0 + (gaze.dy > 0 ? 1 : 0);
      if (bar) { g[r0][bx + pdx] = 3; g[r0 + 1][bx + pdx] = 3; }
      else g[py][bx + pdx] = 3;                  // pupil
    });
  }

  // --- Self test: sweep invariants over many generated critters ----------
  function selfTest() {
    const failures = [];
    for (let i = 0; i < 300; i++) {
      const spec = generate("seed-" + i);
      const g = rasterize(spec);
      if (g.length !== 8 || g.some((r) => r.length !== 8)) failures.push([i, "size"]);
      let symOk = true, hasWhite = false, hasPupil = false;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const c = g[y][x];
          if (![0, 1, 2, 3].includes(c)) failures.push([i, "code", x, y]);
          if ((g[y][x] !== 0) !== (g[y][7 - x] !== 0)) symOk = false; // silhouette
          if (c === 2) hasWhite = true;
          if (c === 3) hasPupil = true;
        }
      const symmetric = !moduleByName(TOPS, spec.top).full && !moduleByName(BOTTOMS, spec.bottom).full &&
        spec.waist.indexOf("bite") !== 0;
      if (!symOk && symmetric) failures.push([i, "symmetry"]);
      if (!hasWhite || !hasPupil) failures.push([i, "eyes"]);
      // every eye cell keeps a 1px solid frame (no empty neighbor)
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          if (g[y][x] !== 2 && g[y][x] !== 3) continue;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy, nx = x + dx;
              if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && g[ny][nx] === 0)
                failures.push([i, "eye-frame", x, y]);
            }
        }
      if (JSON.stringify(g) !== JSON.stringify(rasterize(generate("seed-" + i))))
        failures.push([i, "determinism"]);
    }
    return { passed: failures.length === 0, failures };
  }

  // --- Pure render helpers (DOM-free; canvas painting lives in the page) ---
  // hex "#rrggbb" -> [r,g,b]
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lerpHex(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const f = (v) => ("0" + Math.round(v).toString(16)).slice(-2);
    return "#" + f(ca[0] + (cb[0] - ca[0]) * t) + f(ca[1] + (cb[1] - ca[1]) * t) + f(ca[2] + (cb[2] - ca[2]) * t);
  }
  // Linear multi-stop blend: t=0 -> colors[0], t=1 -> colors[last] (a clean ramp).
  function multiLerp(colors, t) {
    if (colors.length === 1) return colors[0];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const seg = t * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(seg));
    return lerpHex(colors[i], colors[i + 1], seg - i);
  }
  // Gradient body paint over 1-3 selected colors. `dir` lays out the blend; `motion`
  // animates it subtly over `frame`:
  //   static = fixed · drift = slow scroll · pulse = gentle breathing
  //   · sheen = a soft highlight band sweeps across · scan-y = smooth vertical scan.
  function gradientPaint(colors, dir, motion, frame) {
    const BANDS = 5;
    const pos = (x, y) =>
      dir === "none"           ? 0 :
      dir === "diagonal-left"  ? (7 - x + y) / 14 :
      dir === "radial"         ? Math.min(1, Math.hypot(x - 3.5, y - 3.5) / 4.95) :
                                 (x + y) / 14;
    return (x, y) => {
      let u = pos(x, y);
      if (motion === "drift") u += Math.sin(frame / 30) * 0.18;      // gentle slide
      else if (motion === "pulse") u += Math.sin(frame / 22) * 0.12; // gentle breathe
      const band = Math.round((u < 0 ? 0 : u > 1 ? 1 : u) * BANDS) / BANDS;
      let col = multiLerp(colors, band);
      if (motion === "sheen") {
        const phase = (frame / 28) % 2;
        const center = phase <= 1 ? phase : 2 - phase; // forward then backward
        const amt = Math.max(0, 1 - Math.abs(pos(x, y) - center) * 6) * 0.22;
        if (amt > 0) col = lerpHex(col, "#ffffff", amt);
      } else if (motion === "scan-y") {
        const phase = (frame / 18) % 2;
        const scanY = (phase <= 1 ? phase : 2 - phase) * 7;
        const dist = Math.abs(y - scanY);
        const amt = Math.max(0, 1 - dist / 1.35) * 0.28;
        if (amt > 0) col = lerpHex(col, "#ffffff", amt);
      }
      return col;
    };
  }
  // Body paint may be a flat hex string OR a per-cell function (x,y)->hex.
  // Eyes are always white/black.
  function cellFill(code, paint, x, y) {
    if (code === 1) return typeof paint === "function" ? paint(x, y) : paint;
    if (code === 2) return "#ffffff";
    if (code === 3) return "#000000";
    return null;
  }
  // Serialize an 8x8 grid to an SVG string (one <rect> per filled cell).
  function toSVG(grid, paint, scale) {
    const s = scale || 1;
    let rects = "";
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const fill = cellFill(grid[y][x], paint, x, y);
        if (!fill) continue;
        rects += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="${fill}"/>`;
      }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${8 * s}" height="${8 * s}" ` +
      `viewBox="0 0 ${8 * s} ${8 * s}" shape-rendering="crispEdges">${rects}</svg>`
    );
  }

  // --- Spec <-> string codec (shareable URLs) ------------------------------
  // "~"-delimited, versioned. The seed is URI-encoded with "~" forced to %7E
  // so it can never collide with the delimiter.
  const encSeed = (s) => encodeURIComponent(s).replace(/~/g, "%7E");
  function specToString(spec) {
    return [
      "2",
      encSeed(spec.seed),
      spec.colors.map((c) => PALETTE.findIndex((p) => p.name === c.name)).join(""),
      DIRS.indexOf(spec.gradientDir),
      MOTIONS.indexOf(spec.gradientMotion),
      TOPS.findIndex((m) => m.name === spec.top),
      BOTTOMS.findIndex((m) => m.name === spec.bottom),
      WAISTS.indexOf(spec.waist),
      EYE_STYLES.indexOf(spec.eyes.style),
      spec.eyes.row,
      spec.eyes.gap,
      ALIGNS.indexOf(spec.eyes.align || "center"),
      (spec.eyes.gaze.dx + 1) * 3 + (spec.eyes.gaze.dy + 1),
      PUPILS.indexOf(spec.eyes.pupil || "dot"),
      spec.eyes.mirror ? 1 : 0,
    ].join("~");
  }
  function specFromString(str) {
    const p = String(str).split("~");
    // v2 adds pupil + mirror; v1 links keep working with safe defaults
    const v2 = p[0] === "2" && p.length === 15;
    if (!v2 && !(p[0] === "1" && p.length === 13)) return null;
    // strict: every field after the seed is plain digits — rejects "", " 4",
    // "4.5", "0x1" so one permalink string means exactly one spec
    if (!p.slice(2).every((v) => /^\d+$/.test(v))) return null;
    const idx = (v, arr) => { const i = +v; return Number.isInteger(i) && i >= 0 && i < arr.length ? i : -1; };
    const colors = [...p[2]].map((d) => PALETTE[+d]).filter(Boolean);
    const di = idx(p[3], DIRS), mi = idx(p[4], MOTIONS), ti = idx(p[5], TOPS),
          bi = idx(p[6], BOTTOMS), wi = idx(p[7], WAISTS), si = idx(p[8], EYE_STYLES),
          ai = idx(p[11], ALIGNS);
    const row = +p[9], gap = +p[10], gz = +p[12];
    if (colors.length < 1 || colors.length !== p[2].length) return null;
    if ([di, mi, ti, bi, wi, si, ai].includes(-1)) return null;
    if (![2, 3].includes(row) || ![1, 2].includes(gap) || !(gz >= 0 && gz <= 8)) return null;
    const pi = v2 ? idx(p[13], PUPILS) : 0;
    if (pi === -1 || (v2 && !["0", "1"].includes(p[14]))) return null;
    let seed;
    try { seed = decodeURIComponent(p[1]); } catch { return null; }
    return {
      seed,
      colors,
      gradientDir: DIRS[di],
      gradientMotion: "static",
      top: TOPS[ti].name,
      bottom: BOTTOMS[bi].name,
      waist: WAISTS[wi],
      eyes: {
        style: EYE_STYLES[si], row, gap, align: ALIGNS[ai],
        gaze: { dx: Math.floor(gz / 3) - 1, dy: (gz % 3) - 1 },
        pupil: PUPILS[pi], mirror: v2 && p[14] === "1",
      },
    };
  }

  return {
    VERSION, PALETTE, TOPS, BOTTOMS, generate, randomSeed, rasterize, selfTest,
    cellFill, gradientPaint, toSVG, specToString, specFromString,
    _test: { rng, multiLerp },
  };
})();
