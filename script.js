// ---------- Portrait: digit grid + ascii-particle modes ----------
// Samples brightness per grid cell from a source image and renders it in one
// of two pixel-art styles, picked via the little alien-face switch next to
// the canvas:
//   - "digits": draws a "0" or "1" per cell, sized/faded by intensity — a
//     binary-code rendering of the photo.
//   - "ascii": draws a character from a density ramp per cell.
// Both modes read the same underlying intensity grid (brightness + local
// contrast, so glasses/hair edges stand out) and both animate in the exact
// same way — particles drift in from random offsets, fade in, then settle
// into a gentle idle breathing motion — so switching either direction feels
// consistent. Drop a photo in at assets/lil_photo.jpeg (a plain background,
// light or dark, works best) to use your own portrait. If it's missing or
// fails to load, a procedural placeholder silhouette is sampled the same
// way instead.

(function () {
  const canvas = document.getElementById("portrait");
  const ctx = canvas.getContext("2d");
  const toggleBtn = document.getElementById("portraitToggle");
  const toggleLabel = toggleBtn?.querySelector(".portrait-toggle-label");
  const iconCanvas = document.getElementById("portraitToggleIcon");

  const GRID_COLS = 56;
  const GRID_ROWS = 61;
  const DOT_COLOR = "94, 234, 212"; // matches --accent (#5eead4) as an rgb triple
  const MIN_FONT_PX = 4;
  const MAX_FONT_FACTOR = 1.05; // fraction of one cell's size, for the brightest cells
  const INTENSITY_THRESHOLD = 0.08; // skip cells that are basically background
  const EDGE_NORMALIZER = 0.22; // typical strong local-contrast magnitude at this resolution
  const EDGE_BOOST = 0.6; // how much an edge adds on top of base intensity
  const ASCII_CHARS = " .:-=+*#%@".split(""); // sparse to dense
  const ENTRANCE_S = 1.2; // seconds for a particle to drift into place, either mode
  const FADE_S = 0.6; // seconds for a particle to fade to full opacity

  let mode = "digits"; // "digits" | "ascii"
  let intensities = null; // Float32Array(GRID_COLS * GRID_ROWS), current sample
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

  // Samples a source canvas into a per-cell intensity grid (0..1), boosted by
  // local contrast so thin details (glasses frames, hair edges) stand out
  // instead of dissolving into flat, tonally-similar masses like hair. Shared
  // by both render modes so they read the exact same underlying picture.
  function buildIntensityMap(sourceCanvasCtx) {
    const { data } = sourceCanvasCtx.getImageData(0, 0, GRID_COLS, GRID_ROWS);
    const invert = backgroundIsLight(data, GRID_COLS, GRID_ROWS);

    const lumGrid = new Float32Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const i = (row * GRID_COLS + col) * 4;
        lumGrid[row * GRID_COLS + col] = luminance(data[i], data[i + 1], data[i + 2]);
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

    const out = new Float32Array(GRID_COLS * GRID_ROWS);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const brightness = lumGrid[row * GRID_COLS + col];
        const base = invert ? 1 - brightness : brightness;
        const edge = Math.min(edgeAt(row, col) / EDGE_NORMALIZER, 1);
        out[row * GRID_COLS + col] = Math.min(base + edge * EDGE_BOOST, 1);
      }
    }
    return out;
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
          baseAlpha: intensity,
          fontSize: MIN_FONT_PX + intensity * (maxFontPx - MIN_FONT_PX),
          delay: Math.random() * 0.4,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }
    return particles;
  }

  function buildAsciiParticles() {
    const { cellW, cellH, maxFontPx } = cellMetrics();
    const particles = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const intensity = intensities[row * GRID_COLS + col];
        if (intensity < INTENSITY_THRESHOLD) continue;

        const targetX = col * cellW + cellW / 2;
        const targetY = row * cellH + cellH / 2;
        const charIndex = Math.floor(intensity * (ASCII_CHARS.length - 1));

        particles.push({
          startX: targetX + (Math.random() - 0.5) * 260,
          startY: targetY + (Math.random() - 0.5) * 260,
          targetX,
          targetY,
          char: ASCII_CHARS[charIndex],
          baseAlpha: 0.35 + intensity * 0.65,
          fontSize: MIN_FONT_PX + intensity * (maxFontPx - MIN_FONT_PX),
          delay: Math.random() * 0.4,
          shimmer: Math.random() * Math.PI * 2,
        });
      }
    }
    return particles;
  }

  // One entrance animation shared by both modes: particles drift in from a
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
        ctx.font = `${p.fontSize.toFixed(1)}px "Courier New", Courier, monospace`;
        ctx.fillStyle = `rgba(${DOT_COLOR}, ${(p.baseAlpha * alphaFade).toFixed(3)})`;
        ctx.fillText(p.char, drawX, drawY);
      });

      portraitAnimId = requestAnimationFrame(frame);
    }

    portraitAnimId = requestAnimationFrame(frame);
  }

  function renderMode() {
    cancelAnimationFrame(portraitAnimId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const particles = mode === "digits" ? buildDigitParticles() : buildAsciiParticles();
    animatePortrait(particles);
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
    intensities = buildIntensityMap(offCtx);
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

    intensities = buildIntensityMap(offCtx);
    renderMode();
  }

  const img = new Image();
  img.onload = () => sampleImage(img);
  img.onerror = drawPlaceholder;
  img.src = "assets/lil_photo.jpeg";

  // ---- Pixel-art alien: nav mascot + toggle thumb, one shared technique ----
  // Drawn with plain fillRect calls on a 12x12 base grid (scaled 2x to fill
  // a 24x24 canvas exactly, no blur). The hobby-card icons used to be drawn
  // this way too, but now use the real .gif art dropped into assets/
  // (see the hobby-icon-badge markup in index.html) instead.
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
  // shine, a faint mouth line. Used on the portrait-mode switch's thumb.
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

  drawPixelIcon(document.getElementById("navAlienIcon"), drawAlienIcon);
  drawPixelIcon(iconCanvas, drawAlienIcon);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      mode = mode === "digits" ? "ascii" : "digits";
      const isAscii = mode === "ascii";
      toggleBtn.classList.toggle("portrait-toggle--on", isAscii);
      toggleBtn.setAttribute("aria-checked", isAscii ? "true" : "false");
      if (toggleLabel) toggleLabel.textContent = isAscii ? "ascii mode" : "digit mode";
      if (intensities) renderMode();
    });
  }
})();

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
