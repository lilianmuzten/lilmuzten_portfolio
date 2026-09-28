/* ================================================================
   DEPRECATED: "cycle portrait style" (monet / digits / princess).
   Kept for reference, no longer wired up — this block never runs. The
   #portraitToggle button in index.html is back in use, but now switches
   between the two engines below it (bubble mosaic / ASCII particle field)
   instead of cycling these three styles.
   ================================================================

// ---------- Portrait: three render styles over one particle engine ----------
// Samples a source image into a per-cell grid and renders it in one of three
// pixel-art styles, cycled in a fixed order (monet → digits → princess) by
// clicking the little alien-face button next to the canvas: a full-color
// "monet" mode that paints the whole frame in the photo's own sampled
// colors, a binary-code "digits" mode, and a pastel "princess" mode with
// twinkling sparkle accents. All three share one entrance animation:
// particles drift in from random offsets, fade in, then settle into a
// gentle idle breathing motion, so cycling to any of them feels consistent.
// Drop a photo in at assets/lil_photo.jpeg (a plain
// background, light or dark, works best) to use your own portrait. If it's
// missing or fails to load, a procedural placeholder silhouette is sampled
// the same way instead.

(function () {
  const canvas = document.getElementById("portrait");
  const ctx = canvas.getContext("2d");
  const toggleBtn = document.getElementById("portraitToggle");
  const iconCanvas = document.getElementById("portraitToggleIcon");

  const GRID_COLS = 56;
  const GRID_ROWS = 61;
  const DOT_COLOR = "94, 234, 212"; // matches --accent (#5eead4) as an rgb triple, digits mode
  const PRINCESS_COLOR = "255, 182, 217"; // soft pastel pink, princess mode
  const SPARKLE_COLOR = "255, 216, 115"; // warm gold, princess mode's sparkle accents
  const MIN_FONT_PX = 4;
  const MAX_FONT_FACTOR = 1.05; // fraction of one cell's size, for the brightest cells
  const INTENSITY_THRESHOLD = 0.08; // skip cells that are basically background
  const EDGE_NORMALIZER = 0.22; // typical strong local-contrast magnitude at this resolution
  const EDGE_BOOST = 0.6; // how much an edge adds on top of base intensity
  const PRINCESS_CHARS = " .:+*♥★".split(""); // sparse dots to hearts/stars
  const ENTRANCE_S = 1.2; // seconds for a particle to drift into place, any mode
  const FADE_S = 0.6; // seconds for a particle to fade to full opacity

  const MODES = ["monet", "digits", "princess"]; // fixed cycle order, not random
  const MODE_LABELS = { digits: "digit mode", monet: "monet mode", princess: "princess mode" };

  let mode = "digits";
  let intensities = null; // Float32Array(GRID_COLS * GRID_ROWS), current sample
  let colors = null; // string[] "r, g, b" per cell, same indexing, current sample
  let portraitAnimId = null;

  function luminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  // Corners are a decent proxy for "background" in a centered portrait.
  // If the background reads light, the subject is the darker region of the
  // frame, so intensity should track darkness rather than brightness (and
  // vice versa for a dark background like the original reference photo).
  function backgroundIsLight(data, width, height) {
    const corners = [
      0,
      (width - 1) * 4,
      (height - 1) * width * 4,
      ((height - 1) * width + width - 1) * 4,
    ];
    const avg = corners.reduce((sum, i) => sum + luminance(data[i], data[i + 1], data[i + 2]), 0) / corners.length;
    return avg > 0.5;
  }

  function cellMetrics() {
    const cellW = canvas.width / GRID_COLS;
    const cellH = canvas.height / GRID_ROWS;
    return { cellW, cellH, maxFontPx: Math.min(cellW, cellH) * MAX_FONT_FACTOR };
  }

  // Samples a source canvas into a per-cell intensity grid (0..1, boosted by
  // local contrast so thin details like glasses frames or hair edges stand
  // out instead of dissolving into flat, tonally-similar masses) *and* a
  // per-cell actual-color grid (for monet mode's real paint colors). Shared
  // by all three render modes so they read the exact same underlying sample.
  function buildIntensityMap(sourceCanvasCtx) {
    const { data } = sourceCanvasCtx.getImageData(0, 0, GRID_COLS, GRID_ROWS);
    const invert = backgroundIsLight(data, GRID_COLS, GRID_ROWS);

    const lumGrid = new Float32Array(GRID_COLS * GRID_ROWS);
    const colorGrid = new Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const i = (row * GRID_COLS + col) * 4;
        lumGrid[row * GRID_COLS + col] = luminance(data[i], data[i + 1], data[i + 2]);
        colorGrid[row * GRID_COLS + col] = `${data[i]}, ${data[i + 1]}, ${data[i + 2]}`;
      }
    }

    function edgeAt(row, col) {
      const here = lumGrid[row * GRID_COLS + col];
      let diff = 0;
      let n = 0;
      if (col > 0) { diff += Math.abs(here - lumGrid[row * GRID_COLS + col - 1]); n++; }
      if (col < GRID_COLS - 1) { diff += Math.abs(here - lumGrid[row * GRID_COLS + col + 1]); n++; }
      if (row > 0) { diff += Math.abs(here - lumGrid[(row - 1) * GRID_COLS + col]); n++; }
      if (row < GRID_ROWS - 1) { diff += Math.abs(here - lumGrid[(row + 1) * GRID_COLS + col]); n++; }
      return n ? diff / n : 0;
    }

    const intensityGrid = new Float32Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const brightness = lumGrid[row * GRID_COLS + col];
        const base = invert ? 1 - brightness : brightness;
        const edge = Math.min(edgeAt(row, col) / EDGE_NORMALIZER, 1);
        intensityGrid[row * GRID_COLS + col] = Math.min(base + edge * EDGE_BOOST, 1);
      }
    }
    return { intensities: intensityGrid, colors: colorGrid };
  }

  // ---- Particle builders: one per mode, same shape so they share an animator ----
  function buildDigitParticles() {
    const { cellW, cellH, maxFontPx } = cellMetrics();
    const particles = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const intensity = intensities[row * GRID_COLS + col];
        if (intensity < INTENSITY_THRESHOLD) continue;

        const targetX = col * cellW + cellW / 2;
        const targetY = row * cellH + cellH / 2;

        particles.push({
          startX: targetX + (Math.random() - 0.5) * 220,
          startY: targetY + (Math.random() - 0.5) * 220,
          targetX,
          targetY,
          char: Math.random() < 0.5 ? "0" : "1",
          color: DOT_COLOR,
          baseAlpha: intensity,
          fontSize: MIN_FONT_PX + intensity * (maxFontPx - MIN_FONT_PX),
          delay: Math.random() * 0.4,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }
    return particles;
  }

  // Same subject-only silhouette as digits (skips background cells), same
  // density-ramp trick, but in soft pastel pink with a scattering of extra
  // twinkling gold star/heart particles laid over the subject — a generic
  // fairytale-glam filter, not any specific character.
  function buildPrincessParticles() {
    const { cellW, cellH, maxFontPx } = cellMetrics();
    const particles = [];
    const activeCells = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const intensity = intensities[row * GRID_COLS + col];
        if (intensity < INTENSITY_THRESHOLD) continue;

        const targetX = col * cellW + cellW / 2;
        const targetY = row * cellH + cellH / 2;
        const charIndex = Math.floor(intensity * (PRINCESS_CHARS.length - 1));
        activeCells.push({ targetX, targetY });

        particles.push({
          startX: targetX + (Math.random() - 0.5) * 240,
          startY: targetY + (Math.random() - 0.5) * 240,
          targetX,
          targetY,
          char: PRINCESS_CHARS[charIndex],
          color: PRINCESS_COLOR,
          baseAlpha: 0.4 + intensity * 0.6,
          fontSize: MIN_FONT_PX + intensity * (maxFontPx - MIN_FONT_PX),
          delay: Math.random() * 0.4,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }

    // scatter a handful of twinkling gold sparkle accents over the subject
    const sparkleCount = Math.min(36, Math.floor(activeCells.length * 0.05));
    for (let i = 0; i < sparkleCount; i++) {
      const cell = activeCells[Math.floor(Math.random() * activeCells.length)];
      particles.push({
        startX: cell.targetX,
        startY: cell.targetY,
        targetX: cell.targetX + (Math.random() - 0.5) * cellW * 3,
        targetY: cell.targetY + (Math.random() - 0.5) * cellH * 3,
        char: Math.random() < 0.5 ? "★" : "♥",
        color: SPARKLE_COLOR,
        baseAlpha: 0.9,
        fontSize: maxFontPx * (0.8 + Math.random() * 0.6),
        delay: 0.3 + Math.random() * 0.6,
        shimmer: Math.random() * Math.PI * 2,
        twinkle: true,
      });
    }

    return particles;
  }

  // The one mode that doesn't isolate the subject: every cell gets a soft
  // round paint dab (a filled-circle glyph) in that cell's *actual* sampled
  // color, covering the whole frame — a full impressionist wash rather than
  // a graphic cutout, which is what makes it read as "Monet" rather than
  // just a fourth flavor of the same silhouette trick.
  function buildMonetParticles() {
    const { cellW, cellH, maxFontPx } = cellMetrics();
    const particles = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const intensity = intensities[row * GRID_COLS + col];
        const targetX = col * cellW + cellW / 2;
        const targetY = row * cellH + cellH / 2;

        particles.push({
          startX: targetX + (Math.random() - 0.5) * 180,
          startY: targetY + (Math.random() - 0.5) * 180,
          targetX,
          targetY,
          char: "●",
          color: colors[row * GRID_COLS + col],
          baseAlpha: 0.75 + intensity * 0.25,
          fontSize: maxFontPx * (1.15 + (Math.random() - 0.5) * 0.35),
          delay: Math.random() * 0.4,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }
    return particles;
  }

  // One entrance animation shared by all three modes: particles drift in from a
  // random offset, ease into their target cell, fade to full opacity, then
  // idle-breathe in place. Guards against a mid-flight mode switch by
  // capturing which mode it was started for and bailing once that's stale.
  function animatePortrait(particles) {
    const forMode = mode;
    const startTime = performance.now();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    function frame(now) {
      if (mode !== forMode) return;
      const elapsed = (now - startTime) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        const t = elapsed - p.delay;
        if (t < 0) return;

        const moveProgress = Math.min(t / ENTRANCE_S, 1);
        const easedMove = 1 - Math.pow(1 - moveProgress, 3);
        const settled = moveProgress >= 1;

        const breathX = settled ? Math.sin(elapsed * 0.6 + p.shimmer) * 1.2 : 0;
        const breathY = settled ? Math.cos(elapsed * 0.6 + p.shimmer) * 1.2 : 0;

        const drawX = p.targetX + (1 - easedMove) * (p.startX - p.targetX) + breathX;
        const drawY = p.targetY + (1 - easedMove) * (p.startY - p.targetY) + breathY;

        const alphaFade = Math.min(t / FADE_S, 1);
        // princess mode's sparkle particles blink faster than the shared
        // idle-breathing motion, like actual glitter catching the light
        const twinkle = p.twinkle ? 0.4 + 0.6 * Math.max(0, Math.sin(elapsed * 4 + p.shimmer)) : 1;
        ctx.font = `${p.fontSize.toFixed(1)}px "Courier New", Courier, monospace`;
        ctx.fillStyle = `rgba(${p.color}, ${(p.baseAlpha * alphaFade * twinkle).toFixed(3)})`;
        ctx.fillText(p.char, drawX, drawY);
      });

      portraitAnimId = requestAnimationFrame(frame);
    }

    portraitAnimId = requestAnimationFrame(frame);
  }

  const PARTICLE_BUILDERS = {
    digits: buildDigitParticles,
    monet: buildMonetParticles,
    princess: buildPrincessParticles,
  };

  function renderMode() {
    cancelAnimationFrame(portraitAnimId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    animatePortrait(PARTICLE_BUILDERS[mode]());
  }

  function sampleImage(img) {
    const off = document.createElement("canvas");
    off.width = GRID_COLS;
    off.height = GRID_ROWS;
    const offCtx = off.getContext("2d");

    // cover-fit the image into the sample grid so proportions stay sane
    const scale = Math.max(GRID_COLS / img.width, GRID_ROWS / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (GRID_COLS - drawW) / 2;
    const dy = (GRID_ROWS - drawH) / 2;

    offCtx.drawImage(img, dx, dy, drawW, drawH);
    ({ intensities, colors } = buildIntensityMap(offCtx));
    renderMode();
  }

  function drawPlaceholder() {
    // Procedural stand-in: a soft head-and-shoulders silhouette blob,
    // sampled the same way a real photo would be, so swapping in a real
    // photo later doesn't change the rendering logic at all.
    const off = document.createElement("canvas");
    off.width = GRID_COLS;
    off.height = GRID_ROWS;
    const offCtx = off.getContext("2d");

    offCtx.fillStyle = "#000000";
    offCtx.fillRect(0, 0, GRID_COLS, GRID_ROWS);

    const cx = GRID_COLS / 2;
    // head
    const headGrad = offCtx.createRadialGradient(cx, GRID_ROWS * 0.32, 1, cx, GRID_ROWS * 0.32, GRID_COLS * 0.28);
    headGrad.addColorStop(0, "#ffffff");
    headGrad.addColorStop(1, "rgba(0,0,0,0)");
    offCtx.fillStyle = headGrad;
    offCtx.beginPath();
    offCtx.ellipse(cx, GRID_ROWS * 0.32, GRID_COLS * 0.22, GRID_ROWS * 0.24, 0, 0, Math.PI * 2);
    offCtx.fill();

    // shoulders
    const shoulderGrad = offCtx.createRadialGradient(cx, GRID_ROWS * 0.95, 1, cx, GRID_ROWS * 0.95, GRID_COLS * 0.5);
    shoulderGrad.addColorStop(0, "#ffffff");
    shoulderGrad.addColorStop(1, "rgba(0,0,0,0)");
    offCtx.fillStyle = shoulderGrad;
    offCtx.beginPath();
    offCtx.ellipse(cx, GRID_ROWS * 0.95, GRID_COLS * 0.42, GRID_ROWS * 0.4, 0, 0, Math.PI * 2);
    offCtx.fill();

    ({ intensities, colors } = buildIntensityMap(offCtx));
    renderMode();
  }

  const img = new Image();
  img.onload = () => sampleImage(img);
  img.onerror = drawPlaceholder;
  img.src = "assets/lil_photo.jpeg";

  drawPixelIcon(document.getElementById("navAlienIcon"), drawAlienIcon);
  drawPixelIcon(iconCanvas, drawAlienIcon);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];

      toggleBtn.setAttribute("title", `Cycle portrait style (now: ${MODE_LABELS[mode]})`);

      // brief spin on the thumb as click feedback that a new style landed
      toggleBtn.classList.remove("portrait-toggle--spin");
      void toggleBtn.offsetWidth; // restart the animation even on rapid clicks
      toggleBtn.classList.add("portrait-toggle--spin");
      setTimeout(() => toggleBtn.classList.remove("portrait-toggle--spin"), 500);

      if (intensities) renderMode();
    });
  }
})();

================================================================
   END DEPRECATED
   ================================================================ */

// ---- Pixel-art alien: nav mascot + portrait-toggle thumb ----
// Drawn with plain fillRect calls on a 12x12 base grid (scaled 2x to fill a
// 24x24 canvas exactly, no blur). Declared at top level (not inside an IIFE)
// so both the wandering nav mascot below and the portrait-mode toggle
// button's icon (see the toggle controller further down) can share it
// instead of each keeping their own copy.
const ICON_BODY = "#ddd0fa"; // --lilac-bright
const ICON_EYE = "#0a0e1a"; // --bg
const ICON_SHINE = "#5eead4"; // --accent

function drawPixelIcon(targetCanvas, draw) {
  const targetCtx = targetCanvas?.getContext("2d");
  if (!targetCtx) return;
  const SCALE = 2;
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  targetCtx.save();
  targetCtx.scale(SCALE, SCALE);
  draw(targetCtx);
  targetCtx.restore();
}

// A classic grey-alien face: egg-shaped head, two huge almond eyes with a
// shine, a faint mouth line.
function drawAlienIcon(c) {
  c.fillStyle = ICON_BODY;
  c.fillRect(4, 0, 4, 1);
  c.fillRect(3, 1, 6, 1);
  c.fillRect(2, 2, 8, 1);
  c.fillRect(1, 3, 10, 5);
  c.fillRect(2, 8, 8, 1);
  c.fillRect(3, 9, 6, 1);
  c.fillRect(4, 10, 4, 1);

  c.fillStyle = ICON_EYE;
  c.fillRect(2, 4, 3, 4);
  c.fillRect(7, 4, 3, 4);

  c.fillStyle = ICON_SHINE;
  c.fillRect(2, 4, 1, 1);
  c.fillRect(7, 4, 1, 1);

  c.fillStyle = ICON_EYE;
  c.fillRect(5, 9, 2, 1);
}

(function () {
  drawPixelIcon(document.getElementById("navAlienIcon"), drawAlienIcon);
})();

// Shared background test, used by the ASCII engine below to leave the
// studio wall out of the render (the deprecated bubble-mosaic engine
// further down used it too, while it was active): a cell/pixel counts as
// background if it's bright AND close to neutral gray. Brightness alone
// can't always tell wall from skin, so this checks color, not just
// brightness — tuned for a plain, fairly light backdrop; swap in a
// different portrait photo and re-check this pair if it's a different setup.
const BG_MIN_BRIGHTNESS = 0.72;
const BG_MAX_SPREAD = 0.1; // max channel - min channel, as a fraction of 255

// A light-colored garment (e.g. a white/pale blouse peeking through a dark
// blazer) is just as bright and neutral as the wall, so the test above alone
// wipes it out along with the real background. What tells them apart isn't
// color, it's geometry: the actual wall always touches the edge of the
// photo, while a bright patch of clothing is enclosed by darker subject
// pixels on all sides. This flood-fills the background-candidate mask
// starting only from the grid's edge, so only a candidate region connected
// all the way out to the border is confirmed background — a candidate
// "island" fully surrounded by non-candidate (subject) cells is left alone.
function floodFillBackground(cols, rows, isCandidate, inBounds) {
  const confirmed = new Uint8Array(cols * rows);
  const queue = [];

  function tryEnqueue(idx) {
    if (confirmed[idx] || !inBounds[idx] || !isCandidate[idx]) return;
    confirmed[idx] = 1;
    queue.push(idx);
  }

  for (let col = 0; col < cols; col++) {
    tryEnqueue(col);
    tryEnqueue((rows - 1) * cols + col);
  }
  for (let row = 0; row < rows; row++) {
    tryEnqueue(row * cols);
    tryEnqueue(row * cols + cols - 1);
  }

  while (queue.length) {
    const idx = queue.pop();
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    if (col > 0) tryEnqueue(idx - 1);
    if (col < cols - 1) tryEnqueue(idx + 1);
    if (row > 0) tryEnqueue(idx - cols);
    if (row < rows - 1) tryEnqueue(idx + cols);
  }

  return confirmed;
}

// ---------- Portrait: ASCII particle engine ----------
// The sole active #portrait engine (the bubble-mosaic engine and its
// toggle button further down are deprecated — see those blocks).
//
// Ported (ported, not copy-pasted — this project is plain JS/HTML with no
// React/build step) from Gazi Jarin's portfolio, src/components/AsciiPortrait.jsx
// (Gazi-portfolio/Gazi-V2). One fixed look: the source photo sampled into a
// monospace ASCII density ramp (" .:-=+*#%@" sparse→dense). Particles drift
// in from random offsets and fade in, then run a live mouse/touch physics
// simulation — nearby particles get pushed away from the cursor/finger and
// ease back to their resting cell, with a gentle idle "breathing" jitter
// while the pointer is engaged (or during the first few seconds after
// load). The pre-baked `asciiData` cache from the original component is
// intentionally left out: it's a lookup keyed to Gazi's own profile.png at
// his exact breakpoint sizes, meaningless for assets/lian_photo.jpeg — this
// keeps only the live image-processing path (also the original component's
// own fallback when that cache misses). Gazi's original also resized the
// canvas itself per breakpoint; here the canvas is a fixed 480x480 buffer
// (see index.html), left to CSS to scale down responsively.
(function () {
  const canvas = document.getElementById("portrait");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const size = canvas.width; // fixed 480 (see index.html)

  const chars = " .:-=+*#%@".split(""); // sparse to dense
  const MIN_CHAR_INDEX = 3; // never pick chars[0]/[1] (blank/near-blank) for a
  // subject pixel — dark hair or a black blazer has low brightness, and mapping
  // brightness straight to density made those areas render as literal gaps
  let particles = [];
  let startTime = null;
  let dataReady = false;

  const mouse = { x: -1000, y: -1000, active: false };
  const mouseTarget = { x: -1000, y: -1000 };

  function createParticlesFromRaw(rawParticles) {
    return rawParticles.map((p) => ({
      x: p.x + (Math.random() - 0.5) * 400,
      y: p.y + (Math.random() - 0.5) * 400,
      targetX: p.x,
      targetY: p.y,
      vx: 0,
      vy: 0,
      char: p.char,
      baseAlpha: p.alpha,
      currentAlpha: 0,
      delay: Math.random() * 0.4,
      shimmer: Math.random() * Math.PI * 2,
    }));
  }

  function processImage(img) {
    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d");
    offscreen.width = size;
    offscreen.height = size;

    const scale = 0.8;
    const imgAspect = img.width / img.height;

    let drawHeight = size * scale;
    let drawWidth = drawHeight * imgAspect;

    if (drawWidth > size * scale) {
      drawWidth = size * scale;
      drawHeight = drawWidth / imgAspect;
    }

    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;

    offCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    const imageData = offCtx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    const fontSize = 7;
    const colGap = fontSize * 0.7;
    const rowGap = fontSize * 1.1;
    const cols = Math.ceil(size / colGap);
    const rows = Math.ceil(size / rowGap);
    const cellCount = cols * rows;

    // First pass: sample every grid point's color once.
    const inBounds = new Uint8Array(cellCount);
    const isCandidate = new Uint8Array(cellCount); // bright + neutral, background-ish
    const brightnessGrid = new Float32Array(cellCount);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const x = col * colGap;
        const y = row * rowGap;
        const i = (Math.floor(y) * size + Math.floor(x)) * 4;
        const a = pixels[i + 3];
        if (a <= 128) continue; // stays 0/0, letterbox padding

        inBounds[idx] = 1;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const brightness = (r + g + b) / (3 * 255);
        const spread = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        brightnessGrid[idx] = brightness;
        isCandidate[idx] = brightness > BG_MIN_BRIGHTNESS && spread < BG_MAX_SPREAD ? 1 : 0;
      }
    }

    // A background-candidate cell only really is background if it connects
    // all the way out to the photo's edge (see floodFillBackground) — a
    // bright, neutral patch enclosed by darker subject (a light blouse
    // peeking through a dark blazer) stays in.
    const confirmedBackground = floodFillBackground(cols, rows, isCandidate, inBounds);

    // Second pass: emit one particle per subject grid point.
    const rawParticles = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (!inBounds[idx] || confirmedBackground[idx]) continue;

        const brightness = brightnessGrid[idx];
        // A straight brightness→density mapping alone would make anything
        // dark (hair, a black blazer) round down to chars[0]/[1] — blank or
        // near-blank — so those areas rendered as literal gaps instead of
        // filled-in detail. Floor it so every subject pixel stays visible.
        const charIndex = Math.max(MIN_CHAR_INDEX, Math.floor(brightness * (chars.length - 1)));

        rawParticles.push({
          x: Number((col * colGap).toFixed(1)),
          y: Number((row * rowGap).toFixed(1)),
          char: chars[charIndex],
          alpha: Number((0.4 + brightness * 0.6).toFixed(2)),
        });
      }
    }
    return rawParticles;
  }

  function loadParticles() {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = "assets/lian_photo.jpeg";
    img.onload = () => {
      particles = createParticlesFromRaw(processImage(img));
      dataReady = true;
      startTime = performance.now();
    };
  }

  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, size, size);
    if (!dataReady || !particles.length) return;

    const elapsed = (performance.now() - startTime) / 1000;
    mouse.x += (mouseTarget.x - mouse.x) * 0.15;
    mouse.y += (mouseTarget.y - mouse.y) * 0.15;

    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    particles.forEach((p) => {
      const particleTime = elapsed - p.delay;
      if (particleTime < 0) return;

      const fadeProgress = Math.min(particleTime / 1.5, 1);
      const easedFade = 1 - Math.pow(1 - fadeProgress, 2);

      const isActive = mouse.active || particleTime < 3.0;
      const shimmerVal = isActive ? Math.sin(elapsed * 2 + p.shimmer) * 0.1 : 0;
      p.currentAlpha = Math.max(0, p.baseAlpha * easedFade + shimmerVal);

      const moveProgress = Math.min(particleTime / 2.5, 1);
      const easedMove = 1 - Math.pow(1 - moveProgress, 3);

      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = size * 0.2; // proportional to size

        if (dist < maxDist && dist > 0) {
          const force = (1 - dist / maxDist) * 4;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;

      const pullStrength = 0.01 + easedMove * 0.08;
      p.vx += dx * pullStrength;
      p.vy += dy * pullStrength;

      if (isActive) {
        const breathX = Math.sin(elapsed * 0.5 + p.targetY * 0.1) * 0.15;
        const breathY = Math.cos(elapsed * 0.5 + p.targetX * 0.1) * 0.15;
        p.vx += breathX;
        p.vy += breathY;
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else {
        // rapidly settle when inactive
        p.vx *= 0.85;
        p.vy *= 0.85;

        if (particleTime > 4.0 && Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
          p.x = p.targetX;
          p.y = p.targetY;
          p.vx = 0;
          p.vy = 0;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      ctx.fillStyle = `rgba(100, 255, 218, ${p.currentAlpha})`;
      ctx.fillText(p.char, p.x, p.y);
    });
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouseTarget.x = e.clientX - rect.left;
    mouseTarget.y = e.clientY - rect.top;
    mouse.active = true;
  }

  function handleTouchMove(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseTarget.x = touch.clientX - rect.left;
    mouseTarget.y = touch.clientY - rect.top;
    mouse.active = true;
    if (e.cancelable) e.preventDefault();
  }

  function handleLeave() {
    mouse.active = false;
    mouseTarget.x = -1000;
    mouseTarget.y = -1000;
  }

  canvas.style.cursor = "crosshair";
  canvas.style.touchAction = "none";
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseleave", handleLeave);
  canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
  canvas.addEventListener("touchend", handleLeave);

  loadParticles();
  draw();
})();

// ---------- Portrait mode toggle: ASCII ↔ real photo ----------
// Clicking the little pixel-art alien icon crossfades #portrait between the
// ASCII particle engine above and the real photo sitting right underneath
// it (see .portrait-photo / .portrait-wrap--photo in styles.css) — a 1s
// opacity transition with no delay, so the real photo is fully in view
// exactly 1s after the click, not a staggered per-particle reveal. The
// ASCII engine itself isn't paused while the photo is showing (cheap enough
// to just keep running unseen), so switching back is instant.
(function () {
  const wrap = document.querySelector(".portrait-wrap");
  const toggleBtn = document.getElementById("portraitToggle");
  const iconCanvas = document.getElementById("portraitToggleIcon");
  if (!wrap || !toggleBtn) return;

  let showingPhoto = false;

  drawPixelIcon(iconCanvas, drawAlienIcon);

  toggleBtn.addEventListener("click", () => {
    showingPhoto = !showingPhoto;
    wrap.classList.toggle("portrait-wrap--photo", showingPhoto);

    const label = showingPhoto ? "Show ASCII animation" : "Show real photo";
    toggleBtn.setAttribute("title", label);
    toggleBtn.setAttribute("aria-label", label);

    // brief spin on the thumb as click feedback that a new style landed
    toggleBtn.classList.remove("portrait-toggle--spin");
    void toggleBtn.offsetWidth; // restart the animation even on rapid clicks
    toggleBtn.classList.add("portrait-toggle--spin");
    setTimeout(() => toggleBtn.classList.remove("portrait-toggle--spin"), 500);
  });
})();

/* ================================================================
   DEPRECATED: "rising bubble engine" (bubble mosaic).
   Kept for reference, no longer wired up — the ASCII particle engine above
   is now the sole active #portrait engine, and the #portraitToggle button
   that used to switch between the two is commented out in index.html.
   ================================================================

// ---------- Portrait: rising bubble engine ----------
// The active #portrait engine. Soap-bubbles are "born" below the canvas,
// float/sway upward and inflate into place, assembling the actual photo out
// of bubbles — like the Fairy Godmother's entrance in Shrek 2 dissolving
// into (here, reassembling from) a swarm of bubbles. As soon as the cursor
// (or a touch) reaches the canvas, every bubble bursts into a little flash
// of sparkles, and a moment later they all start rising again from scratch,
// rebuilding the same portrait.
//
// Earlier passes tried to draw just an outline (subject-vs-background
// contour, then internal brow/eye/mouth accents on top of that) — outlines
// read fine as an abstract shape but never actually looked like *this
// photo*, because a thin line necessarily throws away everything but edges.
// This pass fills the whole subject silhouette with bubbles, each tinted
// with that cell's own real color sampled from the photo — a bubble
// mosaic/photo-pointillism, the same trick as the deprecated cycle engine's
// "monet" mode above, so the likeness comes from color and shading (the
// same way a low-res thumbnail is still obviously a photo) instead of
// depending on edges alone.
//
// The subject/background split still matters, so the mosaic fills a
// recognizable head-and-shoulders cutout instead of a plain rectangle: a
// cell counts as background if it's bright AND close to neutral gray (the
// studio wall), which survives even where brightness alone can't tell wall
// from skin (see the shared BG_MIN_BRIGHTNESS/BG_MAX_SPREAD above, also used
// by the ASCII engine) — and a light-colored garment (also bright/neutral)
// is told apart from the real wall by floodFillBackground, since only the
// wall actually connects out to the photo's edge. Two majority-vote cleanup
// passes erase stray misreads, and the photo is contain-fit (not cropped)
// onto an otherwise-transparent square so a subject that reaches the
// frame's own edge (hair touching the top of the shot) still closes off
// cleanly instead of leaving the cutout looking cut open there.
(function () {
  const canvas = document.getElementById("portrait");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const GRID_COLS = 36;
  const GRID_ROWS = 36; // #portrait is square, so a square grid
  const MIN_R_FACTOR = 0.55; // fraction of one cell's size, smallest bubble
  const MAX_R_FACTOR = 0.74; // fraction of one cell's size, largest bubble — bubbles
  // touch/overlap slightly for a full mosaic with no gaps between cells
  const PLACEHOLDER_COLOR = "148, 163, 184"; // neutral slate, used only if the photo
  // fails to load (see drawPlaceholder) — a real photo always supplies its own colors
  const SPARKLE_COLORS = ["255, 255, 255", "255, 255, 255", "94, 234, 212", "221, 208, 250"]; // pop
  // flares stay teal/lilac/white regardless of the mosaic's own colors — a consistent
  // "magic" accent, not tied to whatever's under the cursor when it bursts

  const RISE_S = 1.4; // seconds for a bubble to float up into its resting spot
  const BIRTH_SPREAD_S = 1.1; // birth delay is spread across this window
  const WAVE_WEIGHT = 0.75; // how much of that spread is a bottom-to-top wave (bubbles
  // lower in the mosaic are born first) vs. plain randomness (the rest) — a deliberate
  // choreographed fill reads as designed, not as random particles popping up
  const SETTLE_OVERSHOOT = 1.35; // how far a bubble overshoots its size/position before
  // springing back on arrival — subtle (see easeOutBack), not a cartoon bounce
  const POP_S = 0.22; // seconds for a bubble to burst once popping starts — snappy,
  // not a slow fade, so the pop reads as an instant reaction to the cursor arriving
  const POP_STAGGER_S = 0.06; // random extra delay so bubbles don't pop in perfect lockstep
  const BOB_AMP_PX = 1.6; // idle floating wobble once settled
  const SWAY_AMP_PX = 10; // horizontal drift while rising, eases out as it settles
  const SPARKLE_LIFE_S = 0.4; // how long a single pop sparkle lives

  let bubbles = [];
  let sparkles = []; // ephemeral pop flares: {x, y, vx, vy, maxSize, born, color}
  let engineState = "forming"; // "forming" | "idle" | "popping"
  let phaseStart = performance.now();
  let animationId = null;
  let waveMinY = 0;
  let waveMaxY = 1; // vertical span of the current mosaic, cached for the birth-delay wave

  // Standard "ease out back": eases to 1 but overshoots past it first, then settles —
  // the spring/bounce feel of a bubble arriving and gently over-inflating before easing
  // back to its resting size, instead of just decelerating to a stop.
  function easeOutBack(t, overshoot = SETTLE_OVERSHOOT) {
    const c3 = overshoot + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
  }

  // Bottom-to-top wave + a little randomness, instead of a pure random delay: bubbles
  // lower in the mosaic (targetY closer to waveMaxY) are born first, as if a rising
  // water level of bubbles were filling the silhouette upward.
  function birthDelayFor(targetY) {
    const normalizedY = (targetY - waveMinY) / (waveMaxY - waveMinY || 1); // 0 top, 1 bottom
    const wavePart = (1 - normalizedY) * BIRTH_SPREAD_S * WAVE_WEIGHT;
    const jitterPart = Math.random() * BIRTH_SPREAD_S * (1 - WAVE_WEIGHT);
    return wavePart + jitterPart;
  }

  // Segments the photo into subject vs. background by color (see the file
  // header) and returns one cell per subject pixel — row/col plus that
  // cell's own sampled "r, g, b" string — ready to become a mosaic of
  // bubbles. `sourceCanvasCtx` is expected to hold the photo contain-fit
  // (not cropped) onto an otherwise-transparent square; the alpha channel
  // is how real photo content is told apart from the letterbox padding.
  function buildMosaicCells(sourceCanvasCtx) {
    const { data } = sourceCanvasCtx.getImageData(0, 0, GRID_COLS, GRID_ROWS);
    const cellCount = GRID_COLS * GRID_ROWS;

    const inBounds = new Uint8Array(cellCount); // real photo content vs. transparent padding
    const isCandidate = new Uint8Array(cellCount); // bright + neutral, background-ish
    const colors = new Array(cellCount);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const i = idx * 4;
        if (data[i + 3] <= 128) continue; // stays 0/0, letterbox padding
        inBounds[idx] = 1;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        colors[idx] = `${r}, ${g}, ${b}`;
        const brightness = (r + g + b) / 3 / 255;
        const spread = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        isCandidate[idx] = brightness > BG_MIN_BRIGHTNESS && spread < BG_MAX_SPREAD ? 1 : 0;
      }
    }

    // A background-candidate cell only really is background if it connects
    // all the way out to the photo's edge (see floodFillBackground) — a
    // bright, neutral patch enclosed by darker subject (a light blouse
    // peeking through a dark blazer) stays foreground.
    const confirmedBackground = floodFillBackground(GRID_COLS, GRID_ROWS, isCandidate, inBounds);
    let foreground = new Uint8Array(cellCount);
    for (let idx = 0; idx < cellCount; idx++) {
      foreground[idx] = inBounds[idx] && !confirmedBackground[idx] ? 1 : 0;
    }

    // Majority-vote cleanup, twice: each cell becomes whatever most of its
    // (in-bounds) 3x3 neighborhood already is. This erases stray misreads —
    // a fleck of shadowed wall, a highlight on skin — without eating into
    // the real silhouette.
    function majorityClean(mask) {
      const out = new Uint8Array(cellCount);
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const idx = row * GRID_COLS + col;
          if (!inBounds[idx]) continue;
          let ones = 0;
          let total = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const r = row + dr;
              const c = col + dc;
              if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
              const nIdx = r * GRID_COLS + c;
              if (!inBounds[nIdx]) continue;
              total++;
              ones += mask[nIdx];
            }
          }
          out[idx] = total && ones * 2 >= total ? 1 : 0;
        }
      }
      return out;
    }

    let clean = majorityClean(foreground);
    clean = majorityClean(clean);

    const cells = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        if (inBounds[idx] && clean[idx]) cells.push({ row, col, color: colors[idx] });
      }
    }
    return cells;
  }

  function makeBubble(targetX, targetY, targetR, color) {
    return {
      targetX,
      targetY,
      targetR,
      color,
      x: targetX,
      y: canvas.height + targetR + Math.random() * 60, // born just below the canvas
      r: 0,
      alpha: 0,
      birthDelay: birthDelayFor(targetY),
      swaySeed: Math.random() * Math.PI * 2,
      swaySpeed: 1.4 + Math.random() * 0.8,
      bobSeed: Math.random() * Math.PI * 2,
      bobSpeed: 0.5 + Math.random() * 0.3,
      popDelay: 0,
      sparked: false,
    };
  }

  function resetBubbles() {
    bubbles.forEach((b) => {
      b.x = b.targetX;
      b.y = canvas.height + b.targetR + Math.random() * 60;
      b.r = 0;
      b.alpha = 0;
      b.birthDelay = birthDelayFor(b.targetY);
      b.swaySeed = Math.random() * Math.PI * 2;
      b.popDelay = 0;
      b.sparked = false;
    });
    engineState = "forming";
    phaseStart = performance.now();
  }

  function startPopping() {
    if (engineState === "popping") return;
    bubbles.forEach((b) => { b.popDelay = Math.random() * POP_STAGGER_S; });
    engineState = "popping";
    phaseStart = performance.now();
  }

  function buildBubblesFromMosaic(cells) {
    const cellW = canvas.width / GRID_COLS;
    const cellH = canvas.height / GRID_ROWS;
    const minR = Math.min(cellW, cellH) * MIN_R_FACTOR;
    const maxR = Math.min(cellW, cellH) * MAX_R_FACTOR;

    // Cache the mosaic's own vertical span (not the whole canvas) so the
    // bottom-to-top wave spans exactly the rows the silhouette occupies.
    const rows = cells.map((c) => c.row);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    waveMinY = minRow * cellH + cellH / 2;
    waveMaxY = maxRow * cellH + cellH / 2;

    bubbles = cells.map(({ row, col, color }) => {
      const targetX = col * cellW + cellW / 2;
      const targetY = row * cellH + cellH / 2;
      const targetR = minR + Math.random() * (maxR - minR);
      return makeBubble(targetX, targetY, targetR, color);
    });
    sparkles = [];
    engineState = "forming";
    phaseStart = performance.now();
  }

  function sampleImage(img) {
    const off = document.createElement("canvas");
    off.width = GRID_COLS;
    off.height = GRID_ROWS;
    const offCtx = off.getContext("2d");

    // Contain-fit, not cropped: the whole photo — hairline to shoulders —
    // stays visible within the square grid, letterboxed on an otherwise
    // transparent canvas.
    const scale = 0.8;
    const imgAspect = img.width / img.height;
    let drawWidth = GRID_ROWS * scale * imgAspect;
    let drawHeight = GRID_ROWS * scale;
    if (drawWidth > GRID_COLS * scale) {
      drawWidth = GRID_COLS * scale;
      drawHeight = drawWidth / imgAspect;
    }
    const dx = (GRID_COLS - drawWidth) / 2;
    const dy = (GRID_ROWS - drawHeight) / 2;
    offCtx.drawImage(img, dx, dy, drawWidth, drawHeight);

    buildBubblesFromMosaic(buildMosaicCells(offCtx));
  }

  function drawPlaceholder() {
    // Same head-and-shoulders silhouette fallback as the deprecated cycle
    // engine, in case the photo is missing — left on an otherwise
    // transparent canvas (no background fill) so it gets the same
    // alpha-bounded treatment as a real photo above. A flat neutral color
    // stands in for per-cell photo color, since there isn't one.
    const off = document.createElement("canvas");
    off.width = GRID_COLS;
    off.height = GRID_ROWS;
    const offCtx = off.getContext("2d");

    const cx = GRID_COLS / 2;
    const headGrad = offCtx.createRadialGradient(cx, GRID_ROWS * 0.32, 1, cx, GRID_ROWS * 0.32, GRID_COLS * 0.28);
    headGrad.addColorStop(0, "#14202b");
    headGrad.addColorStop(1, "rgba(0,0,0,0)");
    offCtx.fillStyle = headGrad;
    offCtx.beginPath();
    offCtx.ellipse(cx, GRID_ROWS * 0.32, GRID_COLS * 0.22, GRID_ROWS * 0.24, 0, 0, Math.PI * 2);
    offCtx.fill();

    const shoulderGrad = offCtx.createRadialGradient(cx, GRID_ROWS * 0.95, 1, cx, GRID_ROWS * 0.95, GRID_COLS * 0.5);
    shoulderGrad.addColorStop(0, "#14202b");
    shoulderGrad.addColorStop(1, "rgba(0,0,0,0)");
    offCtx.fillStyle = shoulderGrad;
    offCtx.beginPath();
    offCtx.ellipse(cx, GRID_ROWS * 0.95, GRID_COLS * 0.42, GRID_ROWS * 0.4, 0, 0, Math.PI * 2);
    offCtx.fill();

    const cells = buildMosaicCells(offCtx).map((cell) => ({ ...cell, color: PLACEHOLDER_COLOR }));
    buildBubblesFromMosaic(cells);
  }

  // A real glass-sphere shading model: a mostly-transparent center that
  // gets more tinted toward the rim (the fresnel effect real soap bubbles
  // and glass spheres show), a crisp thin rim stroke, one soft directional
  // highlight, and a tiny catch-light on the opposite side — tinted per
  // bubble with that cell's own sampled photo color, which is what makes
  // the whole mosaic read as the actual photo instead of a uniform pattern.
  function drawBubble(x, y, r, alpha, color) {
    if (r <= 0 || alpha <= 0) return;

    const fill = ctx.createRadialGradient(x, y, 0, x, y, r);
    fill.addColorStop(0, `rgba(${color}, ${(0.35 * alpha).toFixed(3)})`);
    fill.addColorStop(0.7, `rgba(${color}, ${(0.55 * alpha).toFixed(3)})`);
    fill.addColorStop(0.9, `rgba(${color}, ${(0.8 * alpha).toFixed(3)})`);
    fill.addColorStop(1, `rgba(${color}, ${(0.92 * alpha).toFixed(3)})`);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r * 0.97, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.28 * alpha).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.stroke();

    const hlR = r * 0.42;
    const hlX = x - r * 0.32;
    const hlY = y - r * 0.36;
    const highlight = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
    highlight.addColorStop(0, `rgba(255, 255, 255, ${(0.55 * alpha).toFixed(3)})`);
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
    ctx.fill();
  }

  // A little four-point "twinkle" glyph (✦), used for the pop flashes.
  function drawSparkle(x, y, size, alpha, color) {
    if (size <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    // soft flash glow behind the star so it reads as a burst of light,
    // not just another small shape among the bubbles
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    glow.addColorStop(0, `rgba(${color}, 0.55)`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // a real four-point star (sharp spikes, thin waist) — round-cornered
    // shapes at this size just read as another small circle, this doesn't
    ctx.fillStyle = `rgb(${color})`;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.18, -size * 0.18);
    ctx.lineTo(size, 0);
    ctx.lineTo(size * 0.18, size * 0.18);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.18, size * 0.18);
    ctx.lineTo(-size, 0);
    ctx.lineTo(-size * 0.18, -size * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Every bubble popping at once, each spawning several flecks, buries the
  // whole silhouette in stars — not a pop, a firework. Only a minority of
  // bubbles get a sparkle at all, one apiece, so the flashes read as
  // scattered highlights over the burst instead of solid noise.
  function spawnSparkles(b) {
    if (Math.random() > 0.35) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = b.targetR * (1.2 + Math.random() * 1.4);
    sparkles.push({
      x: b.x,
      y: b.y,
      vx: Math.cos(angle) * dist,
      vy: Math.sin(angle) * dist,
      maxSize: b.targetR * (0.4 + Math.random() * 0.3),
      born: performance.now(),
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    });
  }

  function drawSparkles(now) {
    if (!sparkles.length) return;
    sparkles = sparkles.filter((s) => (now - s.born) / 1000 < SPARKLE_LIFE_S);
    sparkles.forEach((s) => {
      const progress = (now - s.born) / 1000 / SPARKLE_LIFE_S;
      const eased = 1 - Math.pow(1 - progress, 2);
      const size = s.maxSize * Math.sin(progress * Math.PI); // grows then shrinks
      const alpha = 1 - progress;
      drawSparkle(s.x + s.vx * eased, s.y + s.vy * eased, size, alpha, s.color);
    });
  }

  function draw(now) {
    animationId = requestAnimationFrame(draw);
    if (portraitMode !== "bubbles") return; // parked — the active engine owns the canvas

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!bubbles.length) { drawSparkles(now); return; }

    const elapsed = (now - phaseStart) / 1000;
    let allSettled = true;
    let allPopped = true;

    bubbles.forEach((b) => {
      if (engineState === "popping") {
        const t = elapsed - b.popDelay;
        if (t < 0) {
          allPopped = false; // hasn't started popping yet, so definitely not popped
          // still its pre-pop resting bubble, drawn below
        } else {
          if (!b.sparked) {
            spawnSparkles(b);
            b.sparked = true;
          }
          const progress = Math.min(t / POP_S, 1);
          if (progress < 1) allPopped = false;
          const eased = 1 - Math.pow(1 - progress, 2);
          const fade = 1 - eased;
          drawBubble(b.x, b.y, b.targetR * (1 - eased * 0.5), fade, b.color);
          return;
        }
      }

      if (engineState === "forming") {
        const t = elapsed - b.birthDelay;
        if (t < 0) { allSettled = false; return; } // not born yet, so definitely not settled
        const progress = Math.min(t / RISE_S, 1);
        if (progress < 1) allSettled = false;
        // Position and size spring past their resting values and settle back
        // (easeOutBack); alpha fades in on a plain curve so opacity never
        // over/undershoots — a flicker there would just look like a glitch.
        const easedSpring = easeOutBack(progress);
        const easedAlpha = 1 - Math.pow(1 - progress, 2);

        const riseY = canvas.height + b.targetR + 60; // fixed birth line, just below the canvas
        b.y = riseY + (b.targetY - riseY) * easedSpring;
        const sway = Math.sin(elapsed * b.swaySpeed + b.swaySeed) * SWAY_AMP_PX * (1 - easedAlpha);
        b.x = b.targetX + sway;
        b.r = Math.max(0, b.targetR * easedSpring);
        b.alpha = easedAlpha;
      } else if (engineState === "idle") {
        const bob = Math.sin(elapsed * b.bobSpeed + b.bobSeed) * BOB_AMP_PX;
        b.y = b.targetY + bob;
        b.x = b.targetX;
        b.r = b.targetR;
        b.alpha = 1;
      }

      drawBubble(b.x, b.y, b.r, b.alpha, b.color);
    });

    drawSparkles(now); // on top of every bubble, so a pop flash always reads clearly

    if (engineState === "forming" && allSettled) {
      engineState = "idle";
      phaseStart = now;
    } else if (engineState === "popping" && allPopped) {
      resetBubbles();
    }
  }

  function handleEnter() {
    if (portraitMode !== "bubbles") return;
    startPopping();
  }

  canvas.style.touchAction = "none"; // same either engine, set once here
  canvas.addEventListener("mouseenter", handleEnter);
  canvas.addEventListener("touchstart", handleEnter, { passive: true });

  const img = new Image();
  img.onload = () => sampleImage(img);
  img.onerror = drawPlaceholder;
  img.src = "assets/lil_photo.jpeg";

  animationId = requestAnimationFrame(draw);
})();

// ---------- Portrait mode toggle: controller ----------
// Cycles `portraitMode` between the two engines above by clicking the
// little pixel-art alien icon next to the canvas — just the icon itself, no
// label text and no pill/track behind it. A quick spin gives click feedback
// that the style changed. Each engine's own draw loop and pointer handlers
// already check portraitMode and no-op when they're not the current one;
// this controller only flips that flag and updates the button/canvas chrome
// (title, aria-label, cursor) to match.
(function () {
  const canvas = document.getElementById("portrait");
  const toggleBtn = document.getElementById("portraitToggle");
  const iconCanvas = document.getElementById("portraitToggleIcon");
  if (!canvas || !toggleBtn) return;

  const MODES = ["bubbles", "ascii"]; // fixed cycle order, not random
  const MODE_LABELS = { bubbles: "bubble mosaic", ascii: "ascii particles" };
  const MODE_ARIA_LABELS = { bubbles: "Bubble mosaic portrait", ascii: "ASCII particle portrait" };
  const MODE_CURSORS = { bubbles: "pointer", ascii: "crosshair" };

  function applyMode() {
    canvas.setAttribute("aria-label", MODE_ARIA_LABELS[portraitMode]);
    canvas.style.cursor = MODE_CURSORS[portraitMode];
    toggleBtn.setAttribute("title", `Cycle portrait style (now: ${MODE_LABELS[portraitMode]})`);
  }

  applyMode();
  drawPixelIcon(iconCanvas, drawAlienIcon);

  toggleBtn.addEventListener("click", () => {
    portraitMode = MODES[(MODES.indexOf(portraitMode) + 1) % MODES.length];
    applyMode();

    // brief spin on the thumb as click feedback that a new style landed
    toggleBtn.classList.remove("portrait-toggle--spin");
    void toggleBtn.offsetWidth; // restart the animation even on rapid clicks
    toggleBtn.classList.add("portrait-toggle--spin");
    setTimeout(() => toggleBtn.classList.remove("portrait-toggle--spin"), 500);
  });
})();

================================================================
   END DEPRECATED
   ================================================================ */

// ---------- Experience tabs ----------
(function () {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(`panel-${btn.dataset.target}`)?.classList.add("active");
    });
  });
})();
