# Sycritters Generator — Design

**Date:** 2026-06-08
**Status:** Approved

## Summary

A generator for "Sycritters" — 8×8 pixel creatures in a single cohesive style.
Delivered as one `index.html` file containing a clean, DOM-free engine plus a
playground UI. Generation is seeded and reproducible. The only concern is
appearance — no rarity, traits, or collectible metadata.

## Goals

- Reusable engine: `generate(seed) → spec`, plus canvas and SVG renderers.
- Seeded reproducibility: same seed always yields the same critter.
- Procedural **in-style** generation (hybrid): one "Sycritter style" defined by a
  hand-authored feature vocabulary drawn from the existing examples, so new
  critters feel like family rather than random noise.
- A playground: editor + gallery wall, with live controls and animation.

## Non-goals (YAGNI)

- No traits / rarity / unique IDs / collectible metadata.
- No build step, framework, or dependencies — vanilla JS, single file.
- No heavy test framework — lightweight invariant checks + visual verification.

## Architecture

One `index.html`, three clearly separated layers so the engine stays liftable:

```
index.html
├─ <style>     UI + pixel-rendering CSS
├─ Sycritters  engine (pure, no DOM): RNG · generate(spec) · rasterize · palette · modules
├─ Renderers   drawCanvas(grid, …) · toSVG(grid, …)
└─ Playground  UI wiring: controls, gallery, animation loop, export
```

`Sycritters` touches no DOM and could be copy-pasted into its own `.js`.

## Generation engine

Deterministic pipeline: **seed → spec → grid**.

- **RNG:** `xmur3` hashes the seed string to a 32-bit int; `mulberry32` produces
  the PRNG stream. Empty seed ⇒ pick a random seed.
- **Spec** (seed-derived descriptor; this is the object the UI edits):
  ```
  {
    seed,
    color,                                  // entry from the palette
    top,                                    // dome | notch | ears | antennae | flat
    bottom,                                 // flat | legs | splayed | spikes | round
    edges,                                  // straight | bumps
    eyes: { style, row, spacing, gaze }     // style: normal | visor
  }                                         // spacing: close | wide; gaze: {dx, dy}
  ```
- **Module vocabulary** (hand-authored — keeps critters on-style):
  - `top ∈ {dome, notch, ears, antennae, flat}`
  - `bottom ∈ {flat, legs, splayed, spikes, round}`
  - `edges ∈ {straight, bumps}`
  - `eyes.style ∈ {normal, visor}` — visor is the black horizontal band with eye
    holes (the orange reference critter). `spacing ∈ {close, wide}`.
- **Rasterize** (`spec → 8×8 grid`):
  1. Build the **left 4 columns only**: a solid body core, the top module on
     rows 0–3, the bottom module on rows 4–7, optional edge bumps.
  2. **Mirror** the left half to the right half (left-right symmetry).
  3. Stamp eyes (white) at `eyes.row`/`spacing`; stamp pupils (black) offset by
     `gaze`. Visor style draws a black band across the eye row with white holes.
  - Grid cell codes: `0 = empty, 1 = body, 2 = white, 3 = pupil`.

Because a solid core glues the halves, **any top + any bottom + any color**
combine into a coherent critter.

## Animation system

Time-driven, layered on the static spec; never mutates the seed identity. A
single `requestAnimationFrame` loop computes the current frame from
`(spec, time)` and redraws the editor canvas.

- **Color animation:** smoothly rotates body hue / cycles the palette. Toggle + speed.
- **Eye animation:** gentle random **blink** (eyes close to body color) +
  **look-around** (pupil `gaze` shifts). Toggle.
- **Body animation (stretch):** `none | bob | jump | walk`, applied as a per-frame
  pixel transform (translate + squash; walk alternates the leg rows).

## Playground UI — editor + gallery wall

- **Editor (left):** one large animated critter on canvas.
- **Controls (right):**
  - **Seed** field + 🎲 Random
  - **Surprise me** — re-randomize every axis at once
  - **Color palette:** clickable swatches (curated, expandable array seeded with
    cyan/pink/green + periwinkle/orange/blue/spring-green/purple) + Random
  - **Animate color** toggle (+ speed)
  - **Top half** & **Bottom half** selectors (segmented buttons, incl. random)
  - **Eyes:** style (normal/visor), spacing, **animate eyes** toggle
  - **Body animation:** none / bob / jump / walk
  - **Export:** Download PNG (scale picker) · Copy/Download SVG
- **Gallery wall (below):** "Generate wall" fills a grid with ~24 random
  critters; click any to load its spec into the editor; "Shuffle" regenerates.

**Interaction model (lock-an-axis):** a seed sets *all* axes; touching one
control *overrides that single axis*, leaving the rest intact. So you can lock a
shape and reroll color, etc.

## Error handling

Minimal (it's a toy): any string is a valid seed; unknown module names from the
UI fall back to a default/random; export paths guarded against a missing canvas.

## Testing & verification

- `Sycritters.selfTest()` (run via `?test` URL flag) asserts core invariants:
  grid is always 8×8, left-right symmetry holds, eyes are always present, every
  module produces a valid grid, and `generate(seed)` is deterministic.
- **Visual verification in-browser:** launch the page and screenshot real output
  before calling it done.

## Open extension points (future, not now)

- More modules (new tops/bottoms/eye styles) — additive, no engine change.
- Export a spritesheet / batch download.
- Procedural color band as an alternative to the curated palette.
