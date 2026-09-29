// ---- Pixel-art alien: nav mascot ----
// Drawn with plain fillRect calls on a 12x12 base grid (scaled 2x to fill a
// 24x24 canvas exactly, no blur). Declared at top level (not inside an IIFE)
// so the wandering nav mascot below can use it.
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

// Background test used by the ASCII engine below to leave the studio wall
// out of the render: a cell/pixel counts as background if it's bright AND
// close to neutral gray. Brightness alone
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
// The sole #portrait engine. Runs continuously in the background; see the
// "Portrait: reveal ASCII engine on hover" block further down for how/when
// it's actually shown.
//
// One fixed look: the source photo sampled into a monospace ASCII density
// ramp (" .:-=+*#%@" sparse→dense). Particles drift in from random offsets
// and fade in, then run a live mouse/touch physics simulation — nearby
// particles get pushed away from the cursor/finger and ease back to their
// resting cell, with a gentle idle "breathing" jitter while the pointer is
// engaged (or during the first few seconds after load). There's no
// pre-baked per-size data cache — just a live image-processing pass — since
// the canvas is a fixed 480x480 buffer (see index.html), left to CSS to
// scale down responsively, so there's only ever one size to process.
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

// ---------- Portrait: reveal ASCII engine on hover ----------
// Resting state is the real photo (baked in as .portrait-wrap--photo on
// .portrait-wrap in index.html, so there's no flash-of-ASCII before this
// runs). Hovering the stage fades it out to reveal the live ASCII particle
// engine underneath — a 1s crossfade, see .portrait-photo /
// .portrait-wrap--photo in styles.css — and since the
// engine keeps running unseen the whole time, the mouse-repulsion physics
// (wired to #portrait itself, elsewhere in this file) is already live the
// instant it fades in. Leaving the stage fades back to the photo.
// touchstart/touchend mirror enter/leave for touch devices, which have no
// hover state.
(function () {
  const wrap = document.querySelector(".portrait-wrap");
  const stage = document.querySelector(".portrait-stage");
  if (!wrap || !stage) return;

  const showAscii = () => wrap.classList.remove("portrait-wrap--photo");
  const showPhoto = () => wrap.classList.add("portrait-wrap--photo");

  stage.addEventListener("mouseenter", showAscii);
  stage.addEventListener("mouseleave", showPhoto);
  stage.addEventListener("touchstart", showAscii, { passive: true });
  stage.addEventListener("touchend", showPhoto);
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

// ---------- Language switch (EN/ES/FR) ----------
(function () {
  const STORAGE_KEY = "lang";

  const langButtons = document.querySelectorAll(".lang-switch-btn");
  const i18nNodes = document.querySelectorAll("[data-i18n]");
  const originalHTML = new Map();
  i18nNodes.forEach((el) => originalHTML.set(el, el.innerHTML));

  function applyLang(lang) {
    i18nNodes.forEach((el) => {
      const key = el.dataset.i18n;
      const translated = TRANSLATIONS[lang]?.[key];
      el.innerHTML = translated !== undefined ? translated : originalHTML.get(el);
    });
    document.documentElement.lang = lang;
    langButtons.forEach((btn) => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage unavailable (private mode, disabled cookies, etc.) — language
      // just won't persist across reloads
    }
  }

  let savedLang = "en";
  try {
    savedLang = localStorage.getItem(STORAGE_KEY) || "en";
  } catch {
    // storage unavailable — fall back to the default
  }
  applyLang(savedLang);

  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });
})();
