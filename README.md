# Sycritters

A generator for **Sycritters** — 8×8 pixel creatures in one cohesive style.
Everything lives in a single [`index.html`](index.html): a tiny, dependency-free
engine plus an "arcade specimen lab" playground.

## Use it

Just open `index.html` in a browser. No build, no server, no dependencies.

- **Seed → critter.** The same seed always makes the same critter. Type a seed,
  hit 🎲 for a random one, or **Surprise me**.
- **Configure it.** Pick a body color, a top half (dome / notch / ears /
  antennae / flat), a bottom half (flat / round / legs / splayed / spikes), and
  eyes (normal / visor; close / wide). Touching one control changes only that
  axis (lock-an-axis), so you can lock a shape and reroll the color.
- **Animate it.** Toggle animated color (hue cycling) and animated eyes
  (blink + look-around), and give it body motion (bob / jump / walk).
- **The Wall.** Generate a grid of random critters; click any to load it.
- **Export.** Download the current critter as a crisp **PNG** or scalable **SVG**.

## How it works

`seed → spec → 8×8 grid`. A seeded RNG turns the seed into a *spec* (color, top,
bottom, edges, eyes). The rasterizer builds the **left four columns** from a
hand-authored module vocabulary and **mirrors** them for symmetry, then stamps
the eyes. Grid cell codes: `0` empty · `1` body · `2` eye-white · `3` pupil.
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
