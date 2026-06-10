# Sycritters

A generator for **Sycritters** — 8×8 pixel creatures in one cohesive style.
Everything lives in a single [`index.html`](index.html): a tiny, dependency-free
engine plus a clean, flat playground (visually aligned with its sibling project,
`5x5`).

## Use it

Just open `index.html` in a browser. No build, no server, no dependencies.

- **Seed → critter.** The same seed always makes the same critter. Type a seed,
  hit 🎲 for a random one, or **Surprise me**.
- **Configure it.** Every critter is a **gradient** of 2–3 *analogous* palette
  colors (a consecutive run around the hue wheel, so it's always harmonious) with
  a direction (diagonal / horizontal / vertical / radial). Pick a top half (dome /
  notch / ears / antennae / flat / loaf / crown / w / trident / dots + diagonal
  slants **2tl/3tl/2tr/3tr**), a bottom half (flat / round / legs / splayed /
  spikes / tripod / tripod2 / toes / dots + slants **2bl/3bl/2br/3br**), the
  **middle** two rows (straight / pinch / narrow, or a one-sided **bite**), and
  eyes — style (normal / **short** / tall / visor / visor2), pupil (dot or a 1×2
  **bar**), gaze (parallel or **mirrored**, pupils pointing inward/outward
  together), a 1 or 2 px gap, and alignment. Touching one control changes only
  that axis (lock-an-axis).
- **Animate it.** Gradients have subtle motion modes — `static / drift / pulse /
  sheen`. Eyes blink + look around, and the body can bob / jump / walk. All
  motion runs at **12fps in whole-pixel steps** for a true pixel-art feel.
- **Share it.** The URL always encodes the exact critter on screen — including
  manual edits — so copying the address (or the **Link** button) is a permalink.
  The seed plate shows `· edited` when overrides mean the seed alone wouldn't
  reproduce it.
- **The Wall.** Generate a grid of random critters (their gradients animate);
  click any to load it.
- **Export.** Download the critter as a crisp **PNG** or scalable **SVG**
  (captured at the gradient's current frame), or a 12-frame **sprite sheet**
  of its motion cycle.
- **Surprise me** is spicier than 🎲: it sometimes picks the options random
  generation skips (visors, deep slants, off-center eyes — marked with an
  orange dot in the controls). Motion respects `prefers-reduced-motion`.

## How it works

`seed → spec → 8×8 grid`. A seeded RNG turns the seed into a *spec* (colors, top,
bottom, waist, eyes). The rasterizer builds each row from a hand-authored module
vocabulary — symmetric modules mirror a 4-wide half; asymmetric slants define all
8 columns — then carves the waist and stamps the eyes. Grid cell codes: `0` empty · `1` body · `2` eye-white · `3` pupil.
Renderers (canvas, SVG) consume that grid.

The engine is pure and DOM-free, inside a marked block in `index.html`:

```html
<!-- SYCRITTERS-ENGINE:START --> … <!-- SYCRITTERS-ENGINE:END -->
```

It exposes itself as `globalThis.Sycritters` (`generate`, `rasterize`, `PALETTE`,
`TOPS`, `BOTTOMS`, `selfTest`, …) so it can be lifted into its own `.js` file
unchanged.

## Tests

The engine is unit-tested without a build step: the tests extract that marked
block from `index.html`, run it in a `node:vm` context, and assert invariants
(8×8 size, left-right symmetry, eyes always present, valid codes, determinism).

```sh
node --test test/*.test.mjs
```

In the browser, open `index.html?test` and check the console for
`Sycritters selfTest: PASS`.

## Layout

- `index.html` — the whole app (engine + renderers + playground).
- `test/` — Node tests + the vm-extraction helper.
- `docs/plans/` — design doc and implementation plan.
