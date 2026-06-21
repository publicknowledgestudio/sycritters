/* =====================================================================
   critter-test page logic
   - reuses the Sycritters engine (generate / rasterize / paint) verbatim
   - adds: perch-on-composer placement, a proximity-driven motion state
     machine (idle / walk / jump-for-cursor / think / celebrate), a
     simplified click-to-customise popup, and a live cost readout.
   Efficiency notes are inline where they matter.
   ===================================================================== */
(function () {
  "use strict";
  const S = globalThis.Sycritters;
  const { generate, rasterize, cellFill, gradientPaint, PALETTE, TOPS, BOTTOMS, specToString, specFromString } = S;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const now = () => performance.now();
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /* ---- geometry: the critter is an 8x8 sprite drawn at CELL px/cell ---- */
  const CELL = 4;          // device px per critter pixel (smaller critter)
  const PAD_TOP = 6;       // headroom cells above the body (bob / squash overshoot)
  const PAD_SIDE = 3;
  const SPRITE_W = (8 + 2 * PAD_SIDE) * CELL;   // 56
  const SPRITE_H = (PAD_TOP + 8) * CELL;        // 56, feet flush with the canvas bottom
  const BODY = 8 * CELL;                        // 32, the visible critter box
  const snapCell = (v) => Math.round(v / CELL) * CELL;  // quantise motion to whole critter-pixels

  const composer = document.getElementById("composer");
  const canvas = document.getElementById("critter");
  canvas.width = SPRITE_W; canvas.height = SPRITE_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const baseY = -SPRITE_H;  // lift the canvas so the feet line sits on the composer's top edge

  /* ---- spec (the critter identity) ------------------------------------ */
  // normalise every critter: 2x2 eyes, and never a waist "notch"/bite (chip removed)
  const force2x2Eyes = (s) => ({
    ...s,
    waist: (s.waist === "bite-l" || s.waist === "bite-r") ? "straight" : s.waist,
    eyes: { ...s.eyes, style: "normal" },  // pupils are re-stamped as 2px directional bars (see stampPupils)
  });
  const randSeed = () => Math.floor(Math.random() * 0x100000000).toString(36);
  function specFromURL() {
    const m = location.search.match(/[?&]c=([^&]+)/);
    return (m && specFromString(m[1])) || null;
  }
  let spec = force2x2Eyes(specFromURL() || generate(randSeed()));

  const hexes = () => spec.colors.map((c) => c.hex);
  let staticPaint = gradientPaint(hexes(), spec.gradientDir, "static", 0);

  // Rasterized grids are memoized by pose key — kills the per-frame rasterize
  // cost so a redraw is just the (<=64 cell) fill loop.
  let gridCache = new Map();
  function gridFor(dir, blink, legShift) {
    const key = dir + "," + blink + "," + legShift;
    let g = gridCache.get(key);
    if (!g) {
      g = rasterize(spec, { gaze: { dx: 0, dy: 0 }, blink, legShift });
      if (blink === 0) stampPupils(g, dir);   // override engine pupils with a 2px directional bar
      gridCache.set(key, g);
    }
    return g;
  }
  // Find each eye (a connected block of code 2/3) so we can place pupils ourselves.
  function eyeBoxes(g) {
    const seen = Array.from({ length: 8 }, () => new Array(8).fill(false));
    const boxes = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (seen[y][x] || (g[y][x] !== 2 && g[y][x] !== 3)) continue;
      const stack = [[x, y]], cells = []; let x0 = 8, x1 = -1, y0 = 8, y1 = -1;
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop(); cells.push([cx, cy]);
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + ax, ny = cy + ay;
          if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && !seen[ny][nx] && (g[ny][nx] === 2 || g[ny][nx] === 3)) { seen[ny][nx] = true; stack.push([nx, ny]); }
        }
      }
      boxes.push({ x0, x1, y0, y1, cells });
    }
    return boxes;
  }
  // Each pupil is ALWAYS a 2px bar at one edge of the eye: left / right / top / bottom.
  function stampPupils(g, dir) {
    for (const e of eyeBoxes(g)) {
      for (const [cx, cy] of e.cells) g[cy][cx] = 2;          // reset eye to white
      if (dir === "L") { g[e.y0][e.x0] = 3; g[e.y1][e.x0] = 3; }
      else if (dir === "R") { g[e.y0][e.x1] = 3; g[e.y1][e.x1] = 3; }
      else if (dir === "U") { g[e.y0][e.x0] = 3; g[e.y0][e.x1] = 3; }
      else { g[e.y1][e.x0] = 3; g[e.y1][e.x1] = 3; }          // "D" (default)
    }
  }
  // Which edge the pupils sit on, from the pointer direction (accounting for body flip).
  function pupilDir(geo, flip) {
    if (!mouseIn) return "D";
    const mvx = mx - geo.cx, mvy = my - geo.cy;
    if (Math.abs(mvx) >= Math.abs(mvy)) {
      let left = mvx < 0;
      if (flip) left = !left;     // the body mirror swaps left/right in canonical space
      return left ? "L" : "R";
    }
    return mvy < 0 ? "U" : "D";
  }
  function applySpec(next) {
    spec = force2x2Eyes(next);
    gridCache = new Map();
    staticPaint = gradientPaint(hexes(), spec.gradientDir, "static", 0);
    lastDrawKey = null;
    try { history.replaceState(null, "", "?c=" + specToString(spec)); } catch (e) {}
    syncPopup();
    wake();
    if (reduced.matches) drawStatic();
  }

  /* ---- painting -------------------------------------------------------- */
  function paint(grid, p, t, flip) {
    const dx = t.dx || 0, dy = t.dy || 0;
    const sq = t.squashY == null ? 1 : t.squashY;
    const sqx = t.squashX == null ? 1 : t.squashX;   // horizontal squash (kept for general use)
    const w = Math.max(1, Math.ceil(CELL * sqx));
    ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const sx = flip ? 7 - x : x;                 // mirror the body to face the other way
        const fill = cellFill(grid[y][sx], p, x, y);
        if (!fill) continue;
        ctx.fillStyle = fill;
        const px = Math.round((3.5 + (x - 3.5) * sqx + PAD_SIDE + dx) * CELL);  // scale about the centre
        const py = Math.round((y * sq + 8 * (1 - sq) + PAD_TOP + dy) * CELL);
        ctx.fillRect(px, py, w, Math.ceil(CELL * sq));
      }
  }

  /* ---- world state ----------------------------------------------------- */
  const bounds = () => {
    const w = composer.clientWidth;
    return { min: 4, max: Math.max(4, w - SPRITE_W - 4) };
  };
  const homeX = () => { const b = bounds(); return Math.max(b.min, snapCell(b.max - 8)); }; // rests top-right
  let x = homeX();
  let targetX = x;
  let facing = -1;               // -1 faces left, +1 faces right (mirrors the sprite)
  let legPhase = 0;              // 0..3 walk-cycle frame, advances one per pixel-step
  let stepAcc = 0;               // ms accumulator for whole-pixel stepping
  let curLift = 0;               // current jump height (for hit-testing + distance)
  let jump = null;               // { t0, dur, reach } — a leap toward the mouse
  let lastJumpEnd = -1e9;
  let react = null;              // { kind, t0, dur } — a "caught you!" celebration
  let lastReactEnd = -1e9;
  let forced = null;             // { state, until } — a button-triggered demo animation
  let demoTarget = null;         // when set, walk/jump move here instead of toward the mouse
  let lastInteraction = now();   // last genuine user interaction (drives sleep)
  let lastT = now();

  // mouse (passive listener only stores coordinates; all math runs in the tick)
  let mx = -1e9, my = -1e9, mouseMoved = -1e9, mouseIn = false;
  addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; mouseMoved = now(); mouseIn = true; lastInteraction = now(); wake(); }, { passive: true });
  addEventListener("mouseleave", () => { mouseIn = false; });

  // typing / submit
  const ta = document.getElementById("ta");
  let lastType = -1e9, thinkUntil = 0, celebrateUntil = 0;
  ta.addEventListener("input", () => { lastType = now(); lastInteraction = now(); autosize(); wake(); });
  ta.addEventListener("focus", () => { lastInteraction = now(); wake(); });
  function autosize() { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; }
  function submit() {
    const v = ta.value.trim();
    if (!v) return;
    ta.value = ""; autosize();
    const t = now();
    lastInteraction = t;
    celebrateUntil = t + 950;     // a little hop of triumph
    thinkUntil = t + 2400;        // then "thinking" about the answer
    wake();
  }
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } });
  document.getElementById("send").addEventListener("click", submit);

  // eyes blink on a global timer (~every 4s while engaged); at rest a 30s timer wakes one.
  let nextBlink = now() + 2500, blinkStart = -1e9;
  // rest micro-animations: when the mouse is far the critter sits at home and breathes / blinks.
  let restAnim = null, restAnimStart = 0, restAnimUntil = 0, restTimer = null;

  /* ---- tuning ---------------------------------------------------------- */
  const ENGAGE_R = 100;       // mouse must be within 100px of the critter to engage
  const TOOL_R = 20;          // within 20px -> show the chat/settings toolbar (and stay calm)
  const CATCH_R = 34;         // "caught up" -> a special celebration
  const JUMP_LO = 45, JUMP_HI = 80;  // from this mid-range it can leap toward the mouse
  const JUMP_COOLDOWN = 1100; // ms between leaps
  const REACT_COOLDOWN = 2000;// ms between celebrations while the cursor lingers
  const REACT_DUR = { excited: 900, wiggle: 760, dance: 1000, nod: 720 };
  const MAX_WALK = 165;       // px/s — and it SPEEDS UP as it nears the mouse
  const RETURN_SPEED = 90;    // px/s strolling back home
  const REST_ANIM_MS = 10000; // a small idle animation roughly every 10s
  const SLEEP_AFTER = 16000;  // no interaction for this long -> doze off

  /* ---- the motion state machine --------------------------------------- */
  function decide(t, geo) {
    if (forced) { if (t < forced.until) return forced.state; forced = null; demoTarget = null; }
    if (t < celebrateUntil) return "celebrate";
    if (document.activeElement === ta && (t - lastType < 2500 || t < thinkUntil)) return "think";
    if (react) { if (t - react.t0 >= react.dur) { react = null; lastReactEnd = t; } else return "react"; }
    if (jump)  { if (t - jump.t0  >= jump.dur)  { jump  = null; lastJumpEnd  = t; } else return "jump"; }
    const moused = mouseIn && (t - mouseMoved) < 2000;
    const busy = toolsShown || chatOpen || popupOpen;       // a panel is up -> stay calm
    if (moused && !busy && geo.d < CATCH_R && geo.d > TOOL_R && (t - lastReactEnd) > REACT_COOLDOWN) {
      react = startReact(t, geo);                           // caught up -> celebrate
      return "react";
    }
    if (moused && !busy && geo.d >= JUMP_LO && geo.d <= JUMP_HI && (t - lastJumpEnd) > JUMP_COOLDOWN) {
      const reach = clamp(geo.cy - my, 10, 48);
      jump = { t0: t, dur: 420, reach };                    // leap toward the mouse to close the gap
      const f = Math.sign(mx - geo.cx); if (f) facing = f;
      return "jump";
    }
    if (moused && geo.d < ENGAGE_R) return "follow";        // mouse in the zone -> follow it
    if (Math.abs(x - homeX()) >= CELL) return "return";     // mouse gone -> head home
    if (t - lastInteraction > SLEEP_AFTER) return "sleep";  // left alone a while -> doze off
    return "rest";                                          // home + idle
  }

  // pick a random "caught you!" celebration (jump is a separate traversal move)
  function startReact(t, geo) {
    const kind = ["excited", "wiggle", "dance", "nod"][Math.floor(Math.random() * 4)];
    const f = Math.sign(mx - geo.cx); if (f) facing = f;     // celebrate toward the cursor
    const dur = REACT_DUR[kind];
    return { kind, t0: t, dur };
  }

  function geometry() {
    const r = composer.getBoundingClientRect();   // one read per tick
    const cx = r.left + x + SPRITE_W / 2;
    const cy = r.top - BODY / 2 + curLift;
    return { r, cx, cy, d: Math.hypot(mx - cx, my - cy), mouseAbove: my < r.top + 4 };
  }

  // Build the per-frame pose: { gaze, blink, legShift, T:{dx,dy,squashY}, p, lift }
  function pose(state, t, geo) {
    const f12 = Math.floor(t / (1000 / 12));    // 12fps stepped clock (pixel-art timing)
    let legShift = 0, flipOverride;             // gaze + blink are owned by the loop (eyes track the pointer)
    let T = { dx: 0, dy: 0, squashY: 1, squashX: 1 }, p = staticPaint, lift = 0;

    if (state === "celebrate") {
      const k = f12 % 8;
      T.dy = [0, -2, 0, -2, 0, -2, 0, -2][k];
      T.squashY = [0.9, 1, 0.9, 1, 0.9, 1, 0.9, 1][k];
      p = gradientPaint(hexes(), spec.gradientDir, "sheen", t / 12);
    } else if (state === "think") {
      p = gradientPaint(hexes(), spec.gradientDir, "pulse", t / 12);
    } else if (state === "jump") {
      const ph = clamp((t - jump.t0) / jump.dur, 0, 1);
      lift = -jump.reach * 4 * ph * (1 - ph);               // ballistic parabola — constant gravity
      T.squashY = ph < 0.14 ? 0.82 : ph > 0.9 ? 0.8 : 1;    // crouch to launch, squash on landing
    } else if (state === "react") {                         // a "caught you!" celebration
      const fr = Math.floor((t - react.t0) / (1000 / 12));
      if (react.kind === "excited") {
        const k = fr % 8;
        T.dy = [0, -2, 0, -2, 0, -2, 0, -2][k];
        T.squashY = [0.9, 1, 0.9, 1, 0.9, 1, 0.9, 1][k];
        p = gradientPaint(hexes(), spec.gradientDir, "sheen", t / 12);
      } else if (react.kind === "wiggle") {
        const k = fr % 8;
        T.dx = [0, 1, 0, -1, 0, 1, 0, -1][k];
        T.squashY = [1, 0.94, 1, 0.94, 1, 0.94, 1, 0.94][k];
      } else if (react.kind === "dance") {
        const k = fr % 8;
        T.dx = [0, 1, 1, 0, 0, -1, -1, 0][k];
        T.dy = [0, -1, 0, 0, 0, -1, 0, 0][k];
        T.squashY = [1, 0.88, 1, 1, 1, 0.88, 1, 1][k];
        legShift = [0, -1, -1, 0, 0, 1, 1, 0][k];
      } else if (react.kind === "nod") {
        T.dy = [0, 1, 1, 0, 0, 1, 1, 0][fr % 8];
      }
    } else if (state === "follow" || state === "return" || state === "demowalk") {
      legShift = [-1, 0, 1, 0][legPhase];                   // feet step; no vertical bob
    } else if (state === "sleep") {                         // asleep: slow breathing (eyes shut in render)
      T.squashY = (t < restAnimUntil && restAnim === "breath")
        ? 0.93 + 0.05 * Math.sin(Math.PI * (t - restAnimStart) / 1400) : 0.95;
    } else { // rest: dormant at home, with an occasional glance/bob
      if (t < restAnimUntil && restAnim === "bob") T.dy = [0, -1, -1, 0][Math.floor((t - restAnimStart) / 90) % 4];
    }
    return { legShift, T, p, lift, flipOverride, animated: state === "think" || state === "celebrate" || state === "react" };
  }

  /* ---- the loop -------------------------------------------------------- */
  let active = false, lastDrawKey = null;
  let perfSum = 0, perfN = 0, perfFrames = 0, perfT0 = now();

  function step() {
    const t = now();
    const dt = clamp(t - lastT, 0, 60) / 1000;
    lastT = t;
    const geo = geometry();
    const state = decide(t, geo);
    const b = bounds();

    // target x
    if (state === "follow" || state === "jump") targetX = (demoTarget != null) ? demoTarget : clamp(mx - geo.r.left - SPRITE_W / 2, b.min, b.max);
    else if (state === "return") targetX = homeX();
    else if (state === "demowalk") targetX = demoTarget;
    else targetX = x;
    if (popupOpen || chatOpen || toolsShown) targetX = x;   // hold still while interacting

    // Speed: following SPEEDS UP as it nears the mouse; a leap travels fast across;
    // returning is a steady stroll. All in WHOLE pixels, so no sub-pixel shimmer.
    let speed = 0;
    if (state === "follow") speed = clamp(1 - geo.d / ENGAGE_R, 0.35, 1) * MAX_WALK;
    else if (state === "jump") speed = 230;                  // leap toward the mouse
    else if (state === "return") speed = RETURN_SPEED;
    else if (state === "demowalk") speed = 120;
    if (speed > 0 && Math.abs(targetX - x) >= CELL) {
      const interval = 1000 / (speed / CELL);    // ms per whole-pixel step
      stepAcc += dt * 1000;
      let guard = 0;
      while (stepAcc >= interval && Math.abs(targetX - x) >= CELL && guard++ < 12) {
        const dir = Math.sign(targetX - x);
        x += dir * CELL; facing = dir;           // step one critter-pixel, face that way
        legPhase = (legPhase + 1) % 4;
        stepAcc -= interval;
      }
    } else {
      stepAcc = 0;
      if (state !== "jump") legPhase = 0;        // standing: feet together
      if (state === "follow") { const f = Math.sign(mx - geo.cx); if (f) facing = f; }
    }
    x = clamp(x, b.min, b.max);

    // render
    const ps = pose(state, t, geo);
    curLift = ps.lift;
    const flip = ps.flipOverride != null ? ps.flipOverride : (facing < 0);

    // Eyes: two 2px pupils always point at the pointer (left/right/top/bottom);
    // blink is layered on top on a global timer, wherever the eyes happen to be.
    const dir = pupilDir(geo, flip);
    if (state !== "rest" && state !== "sleep" && t > nextBlink) { blinkStart = t; nextBlink = t + 3200 + Math.random() * 3200; }
    const bp = t - blinkStart;
    let blink = (bp >= 0 && bp < 300) ? (bp < 70 ? 1 : bp < 230 ? 2 : 1) : 0;
    if (state === "sleep") blink = 2;                       // eyes shut while asleep

    const a = now();
    const grid = gridFor(dir, blink, ps.legShift);
    const drawKey = ps.animated ? "a" + Math.floor(t / (1000 / 12))
      : [dir, blink, ps.legShift, Math.round(ps.T.dy), Math.round(ps.T.squashY * 100), Math.round(ps.T.squashX * 100), flip ? 1 : 0].join(",");
    if (ps.animated || drawKey !== lastDrawKey) {     // only repaint when the sprite actually changes
      paint(grid, ps.p, ps.T, flip);
      lastDrawKey = drawKey;
      perfSum += now() - a; perfN++;
    }
    // position is compositor-only (transform), snapped to whole critter-pixels
    canvas.style.transform = "translate3d(" + snapCell(x) + "px," + (baseY + snapCell(ps.lift)) + "px,0)";
    updateTools(geo);

    // perf readout once a second
    perfFrames++;
    if (t - perfT0 >= 1000) {
      const avg = perfN ? perfSum / perfN : 0;
      perf.textContent = "critter cost: " + avg.toFixed(3) + " ms/repaint · " + perfN + " repaints/s · loop " + perfFrames + " fps";
      window.__critterPerf = { msPerRepaint: +avg.toFixed(4), repaintsPerSec: perfN, loopFps: perfFrames };
      perfSum = perfN = perfFrames = 0; perfT0 = t;
    }

    // Park the loop once the critter is home and dormant; a timer wakes it for the
    // occasional rest animation, and any mouse move / focus wakes it instantly.
    const blinking = (t - blinkStart) < 300;
    if ((state === "rest" || state === "sleep") && t >= restAnimUntil && !blinking && !popupOpen && !chatOpen && !toolsShown) { active = false; scheduleRestAnim(); return; }
    requestAnimationFrame(step);
  }

  function wake() {
    if (reduced.matches) { drawStatic(); return; }
    if (!active) { active = true; lastT = now(); requestAnimationFrame(step); }
  }

  // While dormant at home, wake briefly every ~10s for a blink/glance — or, once
  // asleep, for a slow breath. Timed so it dozes off right at SLEEP_AFTER.
  function scheduleRestAnim() {
    if (restTimer || reduced.matches) return;
    const since = now() - lastInteraction;
    const delay = (since < SLEEP_AFTER && SLEEP_AFTER - since < REST_ANIM_MS) ? Math.max(200, SLEEP_AFTER - since) : REST_ANIM_MS;
    restTimer = setTimeout(() => {
      restTimer = null;
      if (now() - lastInteraction >= SLEEP_AFTER) { restAnim = "breath"; restAnimStart = now(); restAnimUntil = now() + 1400; } // a sleeping breath
      else if (Math.random() < 0.6) { blinkStart = now(); nextBlink = now() + REST_ANIM_MS; }                                   // a blink
      else { restAnim = "bob"; restAnimStart = now(); restAnimUntil = now() + 700; }                                            // a glance
      wake();
    }, delay);
  }

  function drawStatic() {  // reduced-motion: one resting frame, no loop
    const grid = gridFor("D", 0, 0);
    paint(grid, staticPaint, { dy: 0, squashY: 1 }, facing < 0);
    const b = bounds();
    x = clamp(x, b.min, b.max);
    canvas.style.transform = "translate3d(" + snapCell(x) + "px," + baseY + "px,0)";
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) active = false;        // no work on a hidden tab
    else wake();
  });
  addEventListener("resize", () => { const b = bounds(); x = clamp(x, b.min, b.max); wake(); });

  /* ---- click-to-customise popup --------------------------------------- */
  const pop = document.getElementById("pop");
  const hint = document.getElementById("hint");
  const critTools = document.getElementById("critTools");
  const chatpop = document.getElementById("chatpop");
  let popupOpen = false, hintShown = false, toolsShown = false, toolsOver = false, chatOpen = false;

  function critterScreenBox() {
    const r = composer.getBoundingClientRect();
    return { x: r.left + snapCell(x) + PAD_SIDE * CELL, y: r.top - BODY + curLift, w: BODY, h: BODY };
  }
  // Show the chat/settings toolbar above the critter when the pointer is within
  // TOOL_R; keep it up (hysteresis) while you reach for it, so it's clickable.
  function updateTools(geo) {
    if (reduced.matches || popupOpen || chatOpen) { critTools.classList.remove("show"); toolsShown = false; return; }
    const near = mouseIn && geo.d <= TOOL_R;
    const keep = toolsShown && (geo.d <= 90 || toolsOver);
    toolsShown = near || keep;
    if (toolsShown) {
      dismissHint();
      const box = critterScreenBox();
      critTools.style.left = (box.x + box.w / 2) + "px";
      critTools.style.top = (box.y - 6) + "px";
      critTools.classList.add("show");
    } else critTools.classList.remove("show");
  }
  critTools.addEventListener("mouseenter", () => { toolsOver = true; });
  critTools.addEventListener("mouseleave", () => { toolsOver = false; });

  // toolbar actions
  document.getElementById("toolChat").addEventListener("click", (e) => { e.stopPropagation(); openChat(); });
  document.getElementById("toolSettings").addEventListener("click", (e) => { e.stopPropagation(); openPopup(); });
  // a click outside an open panel closes it
  addEventListener("click", (e) => {
    lastInteraction = now();
    if (popupOpen && !pop.contains(e.target)) closePopup();
    if (chatOpen && !chatpop.contains(e.target) && !critTools.contains(e.target)) closeChat();
  });

  function openPopup() {
    popupOpen = true;
    lastInteraction = now();
    toolsShown = false; critTools.classList.remove("show");
    dismissHint();
    syncPopup();
    const box = critterScreenBox();
    // prefer above the critter; flip below if it would clip the top
    let top = box.y - 12 - pop.offsetHeight;
    if (top < 8) top = box.y + box.h + 12;
    pop.style.left = clamp(box.x + box.w / 2 - 116, 8, innerWidth - 240) + "px";
    pop.style.top = top + "px";
    pop.classList.add("open");
    // measure again now that it's visible, then re-place vertically
    let top2 = box.y - 12 - pop.offsetHeight;
    pop.style.top = (top2 < 8 ? box.y + box.h + 12 : top2) + "px";
    wake();
  }
  function closePopup() { popupOpen = false; pop.classList.remove("open"); wake(); }
  document.getElementById("popX").addEventListener("click", closePopup);

  /* ---- Forge help chat ------------------------------------------------- */
  const FAQ = [
    ["What is Sycamore?", "Sycamore helps you build enterprise-grade apps and agents from a conversation. Describe what you need — like the prospect map above — and it assembles a live, editable, shareable app."],
    ["How do I build an agent?", "Describe the agent's job and the tools it should use, and Sycamore wires it up. Refine it in plain language, then ship when it's ready."],
    ["Who is the critter?", "That is your companion! It lives on the composer, watches your cursor, and reacts when you reach it. Open the gear in its menu to restyle it."],
  ];
  const chatLog = document.getElementById("chatLog");
  const chatInput = document.getElementById("chatInput");
  let chatSeeded = false;
  function addMsg(who, text) {
    const m = document.createElement("div");
    m.className = "chatpop__msg chatpop__msg--" + who;
    m.textContent = text;
    chatLog.appendChild(m);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function answer(q) {
    addMsg("me", q);
    const hit = FAQ.find(([question]) => question.toLowerCase() === q.toLowerCase());
    setTimeout(() => addMsg("bot", hit ? hit[1] : "Good question! Open the Sycamore docs from the top-right menu, or a teammate can jump into the shared session to help."), 260);
  }
  function seedChat() {
    addMsg("bot", "Hello! I am your personal help agent. Ask me anything about building enterprise grade apps and agents with Sycamore.");
    const chips = document.getElementById("chatChips");
    for (const [q] of FAQ) {
      const c = document.createElement("button");
      c.className = "chatpop__chip"; c.textContent = q;
      c.addEventListener("click", () => answer(q));
      chips.appendChild(c);
    }
  }
  function openChat() {
    chatOpen = true; lastInteraction = now(); toolsShown = false; critTools.classList.remove("show");
    if (!chatSeeded) { seedChat(); chatSeeded = true; }
    chatpop.classList.add("open"); dismissHint(); wake();
  }
  function closeChat() { chatOpen = false; chatpop.classList.remove("open"); wake(); }
  document.getElementById("chatX").addEventListener("click", closeChat);
  function chatSubmit() { const v = chatInput.value.trim(); if (v) { chatInput.value = ""; answer(v); } }
  document.getElementById("chatSend").addEventListener("click", chatSubmit);
  chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chatSubmit(); } });

  const seedInput = document.getElementById("seedInput");
  document.getElementById("dice").addEventListener("click", () => applySpec(generate(randSeed())));
  seedInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (seedInput.value.trim()) applySpec(generate(seedInput.value.trim())); } });
  pop.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;
    const dir = +btn.dataset.dir;
    if (btn.dataset.step === "top") cycleList(TOPS, "top", dir);
    else if (btn.dataset.step === "bottom") cycleList(BOTTOMS, "bottom", dir);
    else if (btn.dataset.step === "color") cycleColor(dir);
  });
  function cycleList(list, key, dir) {
    const i = list.findIndex((m) => m.name === spec[key]);
    const ni = ((i + dir) % list.length + list.length) % list.length;
    applySpec({ ...spec, [key]: list[ni].name });
  }
  function cycleColor(dir) {
    const start = PALETTE.findIndex((p) => p.name === spec.colors[0].name);
    const n = spec.colors.length;
    const ns = ((start + dir) % PALETTE.length + PALETTE.length) % PALETTE.length;
    const colors = [];
    for (let j = 0; j < n; j++) colors.push(PALETTE[(ns + j) % PALETTE.length]);
    applySpec({ ...spec, colors });
  }
  function syncPopup() {
    seedInput.value = spec.seed;
    document.getElementById("valTop").textContent = spec.top;
    document.getElementById("valBottom").textContent = spec.bottom;
    const sw = document.getElementById("valColor");
    sw.innerHTML = "";
    for (const c of spec.colors) { const i = document.createElement("i"); i.style.background = c.hex; sw.appendChild(i); }
  }

  function dismissHint() { hintShown = true; hint.classList.remove("show"); }

  /* ---- demo triggers (the buttons in the conversation) ----------------- */
  function forceAnim(kind) {
    const t = now();
    lastInteraction = t;
    forced = null; demoTarget = null; jump = null; react = null;
    const b = bounds();
    if (kind === "walk") { demoTarget = (x > (b.min + b.max) / 2) ? b.min : b.max; forced = { state: "demowalk", until: t + 2600 }; }
    else if (kind === "jump") { demoTarget = clamp(x + (x > (b.min + b.max) / 2 ? -60 : 60), b.min, b.max); jump = { t0: t, dur: 640, reach: 48 }; forced = { state: "jump", until: t + 640 }; }
    else if (REACT_DUR[kind]) { react = { kind, t0: t, dur: REACT_DUR[kind] }; }
    else if (kind === "think") { forced = { state: "think", until: t + 1900 }; }
    else if (kind === "celebrate") { celebrateUntil = t + 1300; }
    else if (kind === "sleep") { lastInteraction = t - SLEEP_AFTER - 4000; forced = { state: "sleep", until: t + 4000 }; restAnim = "breath"; restAnimStart = t; restAnimUntil = t + 4000; }
    else if (kind === "blink") { blinkStart = t; }
    wake();
  }
  document.querySelectorAll("[data-anim]").forEach((btn) =>
    btn.addEventListener("click", () => forceAnim(btn.dataset.anim)));

  /* ---- boot ------------------------------------------------------------ */
  const perf = document.getElementById("perf");
  syncPopup();
  if (reduced.matches) {
    drawStatic();
    perf.textContent = "reduced-motion: static critter (no animation loop)";
  } else {
    wake();
    // one-time discoverability nudge: point at the resting critter
    setTimeout(() => {
      if (hintShown || popupOpen || chatOpen) return;
      const box = critterScreenBox();
      hint.style.left = (box.x + box.w / 2) + "px";
      hint.style.top = (box.y - 6) + "px";
      hint.classList.add("show");
      setTimeout(dismissHint, 4200);
    }, 1000);
  }
})();
