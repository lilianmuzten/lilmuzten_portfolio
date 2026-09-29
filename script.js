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

  const translations = {
    es: {
      "nav-about": "Acerca de",
      "nav-experience": "Experiencia",
      "nav-projects": "Proyectos personales",
      "nav-hobbies": "Pasatiempos",

      "greeting": 'Hola, <br> soy <span class="accent">Lian</span>...',
      "subtext": `
          Ingeniera de Datos que construye la infraestructura invisible que hace que los datos sean confiables — pipelines, no hojas de cálculo. <br>
          Nativa de AWS, hablo PySpark con fluidez y escribo SQL como un segundo idioma. Últimamente he estado incorporando herramientas de IA a mi flujo de trabajo — el mismo rigor, con una iteración más rápida.
        `,

      "about-heading": "Sobre mí",
      "about-body": `
          Actualmente soy Ingeniera de Datos en
          <a href="https://www.wizeline.com/" target="_blank" rel="noopener" class="inline-link">Wizeline</a>,
          donde construyo pipelines e infraestructura de datos para clientes como Dow Jones y
          Kellogg's, sobre PySpark y AWS. Anteriormente trabajé en
          <a href="https://www.indragroup.com/es/america-latina/mexico" target="_blank" rel="noopener" class="inline-link">Indra</a>,
          <a href="https://www.xaldigital.com/" target="_blank" rel="noopener" class="inline-link">XalDigital</a> e
          <a href="https://www.gob.mx/ineel" target="_blank" rel="noopener" class="inline-link">INEEL</a>,
          donde aprendí el oficio migrando sistemas legados a arquitecturas modernas nativas en la nube.
        `,
      "about-leisure": "En mis tiempos de ocio me gusta ver videos en YouTube para practicar y mejorar mi francés, me gusta leer sobre salud intestinal y montar a caballo los fines de semana. Mi app favorita es Pinterest.",

      "experience-heading": "Experiencia",

      "wizeline-role": "Ingeniera de Datos Senior",
      "wizeline-dates": "OCT 2021 — ACTUALIDAD · REMOTO",
      "wizeline-dowjones-bullets": `
                  <li>Desarrollé reportes con PySpark aplicando lógica y reglas de negocio, desplegando los datos finales en tablas de Athena para su visualización.</li>
                  <li>Identifiqué, evalué e implementé mejoras de proceso, analizando su impacto en los resultados del proyecto.</li>
                  <li>Migré DAGs de Airflow tradicional a MWAA, mejorando la eficiencia y el rendimiento.</li>
                  <li>Hice la transición de procesos de EMR a EMR Serverless, mejorando la escalabilidad y reduciendo la sobrecarga operativa y los tiempos de procesamiento.</li>
                `,
      "wizeline-kelloggs-bullets": `
                  <li>Lideré el proyecto para optimizar y adaptar una aplicación web para monitorear y gestionar información financiera de ventas, previamente almacenada en una hoja de cálculo de Excel.</li>
                  <li>Fui el enlace principal con el cliente, coordinando a un equipo de diseñadores y desarrolladores y traduciendo requerimientos complejos para el equipo.</li>
                `,
      "wizeline-academy-bullets": `
                  <li>Diseñé y creé la ruta de aprendizaje del Data Engineering Apprenticeship.</li>
                  <li>Trabajé en el modelado de datos y la optimización del proyecto final del Apprenticeship — utilizado por Wizeline para evaluar a nuevas contrataciones del equipo de Datos.</li>
                `,

      "de-role": "Ingeniera de Datos",

      "indra-dates": "ABR 2021 — OCT 2021 · REMOTO",
      "indra-bullets": `
                <li>Migré un proceso de Legacy a la plataforma Datio para construir un universo de datos de contratos y clientes morosos.</li>
                <li>Elaboré pruebas unitarias y de aceptación.</li>
              `,

      "xaldigital-dates": "DIC 2018 — DIC 2020 · CIUDAD DE MÉXICO",
      "xaldigital-bullets": `
                <li>Trabajé en proyectos de los sectores retail y seguros.</li>
                <li>Migré todo un proceso de planeación de surtido de archivos de Excel a PySpark.</li>
                <li>Automaticé pipelines de ETL usando servicios de AWS.</li>
                <li>Migré procesos de SQL a PySpark para mejorar la eficiencia y escalabilidad.</li>
                <li>Lideré el levantamiento de requerimientos y el análisis de negocio para proponer una arquitectura de Data Lake en AWS.</li>
                <li>Desarrollé una prueba de concepto para generar pronósticos de demanda de productos, arquitectada en AWS.</li>
                <li>Redacté documentación funcional y técnica de todos los procesos en los que participé.</li>
              `,

      "bigdata4all-dates": "NOV 2017 — DIC 2018 · INTERLOMAS, EDO. MÉX.",
      "bigdata4all-bullets": `
                <li>Migré procesos de SQL a PySpark para mejorar la eficiencia y escalabilidad.</li>
                <li>Automaticé pipelines de ETL usando servicios de AWS.</li>
                <li>Redacté documentación funcional y técnica de todos los procesos en los que participé.</li>
              `,

      "projects-heading": "Proyectos personales",
      "project1-desc": "Este sitio — un portafolio personal construido desde cero con un motor de retrato ASCII interactivo, sin framework y sin paso de build.",
      "project2-desc": "Trabajo en progreso.",
      "project3-desc": "Trabajo en progreso.",

      "hobbies-heading": "Pasatiempos",

      "hobby-horse-title": "Equitación",
      "hobby-horse-desc": "Desde niña siempre quise ser amazona, pero no empecé a tomar clases de equitación hasta marzo de 2026 — desde entonces ha sido mi actividad favorita.",

      "hobby-reading-title": "Lectura",
      "hobby-reading-desc": 'Actualmente estoy leyendo <a href="https://www.amazon.com.mx/Mind-Gut-Connection-Conversation-Impacts-Choices/dp/0062376551/ref=sr_1_1?crid=7TGLIIBMNMPB&dib=eyJ2IjoiMSJ9.qzM8tKtAd5Ytuijvg_Pr-HQ3B3-2EKRTzSHOgPHqiKOkRihcgkY3CXRrSAfSc6PR_7fSUCzV0YKtaiHtW7WtOJNg8F_EnSyTbLtfX_Uk9BIMp3IilsD98x2j8d8fL8geUWp4i195fg-9uksp6JgGxTqSVib3v2AFy3icdtnSUDpi11eZWFAxdG0VlSTV1-dLSNiByrWMRk355HsF6ggKQmNPNdUHii6s2VZ7vjz9viEVZY_nzOJ86wzGrHW5uRzQnjnx2ogDMhDlc-c6RidEEq4gGaVblfT83P0Vxl73r0I.avl3-HIfdzg_FO0Div3hN3GMUz7uPEaK5b4rOS-9S4s&dib_tag=se&keywords=the+mind+gut+connection&qid=1787098640&sprefix=%2Caps%2C175&sr=8-1&ufe=app_do%3Aamzn1.fos.45030d3a-91a9-4303-890a-776dee9077c1" target="_blank" rel="noopener" class="inline-link">"The Mind-Gut Connection"</a> de Emeran Mayer, MD.',
      "hobby-buy-book": "Regálame un libro",

      "hobby-piano-title": "Piano",
      "hobby-piano-desc": 'De vez en cuando toco el piano. Actualmente estoy aprendiendo la técnica a través de un canal de YouTube llamado "Piano Roadmap".',

      "footer-built": "Creado por Lilian Muñoz.",
      "footer-rights": "Todos los derechos reservados. ©",
    },

    fr: {
      "nav-about": "À propos",
      "nav-experience": "Expérience",
      "nav-projects": "Projets personnels",
      "nav-hobbies": "Loisirs",

      "greeting": 'Coucou, <br> je suis <span class="accent">Lian</span>...',
      "subtext": `
          Ingénieure de Données qui construit l'infrastructure invisible qui rend les données fiables — des pipelines, pas des feuilles de calcul. <br>
          Native AWS, je parle couramment PySpark et j'écris du SQL comme une seconde langue. Dernièrement, j'intègre des outils d'IA à mon flux de travail — la même rigueur, avec une itération plus rapide.
        `,

      "about-heading": "À propos de moi",
      "about-body": `
          Je suis actuellement Ingénieure de Données chez
          <a href="https://www.wizeline.com/" target="_blank" rel="noopener" class="inline-link">Wizeline</a>,
          où je construis des pipelines et une infrastructure de données pour des clients comme Dow Jones et
          Kellogg's, sur PySpark et AWS. Auparavant, j'ai travaillé chez
          <a href="https://www.indragroup.com/es/america-latina/mexico" target="_blank" rel="noopener" class="inline-link">Indra</a>,
          <a href="https://www.xaldigital.com/" target="_blank" rel="noopener" class="inline-link">XalDigital</a> et
          <a href="https://www.gob.mx/ineel" target="_blank" rel="noopener" class="inline-link">INEEL</a>,
          où j'ai appris le métier en migrant des systèmes hérités vers des architectures modernes natives du cloud.
        `,
      "about-leisure": "Pendant mon temps libre, j'aime regarder des vidéos YouTube pour pratiquer et améliorer mon français, lire sur la santé intestinale et faire de l'équitation le week-end. Mon application préférée est Pinterest.",

      "experience-heading": "Expérience",

      "wizeline-role": "Ingénieure de Données Senior",
      "wizeline-dates": "OCT 2021 — AUJOURD'HUI · À DISTANCE",
      "wizeline-dowjones-bullets": `
                  <li>Développé des rapports avec PySpark en appliquant la logique et les règles métier, en déployant les données finales dans des tables Athena pour la visualisation.</li>
                  <li>Identifié, évalué et mis en œuvre des améliorations de processus, en analysant leur impact sur les résultats du projet.</li>
                  <li>Migré des DAGs d'Airflow classique vers MWAA, améliorant l'efficacité et la performance.</li>
                  <li>Fait la transition des processus d'EMR vers EMR Serverless, améliorant l'évolutivité et réduisant la charge opérationnelle et les temps de traitement.</li>
                `,
      "wizeline-kelloggs-bullets": `
                  <li>Dirigé le projet d'optimisation et d'adaptation d'une application web pour surveiller et gérer les informations financières de ventes, auparavant stockées dans une feuille de calcul Excel.</li>
                  <li>Assuré le rôle de principal point de contact avec le client, en coordonnant une équipe de designers et de développeurs et en traduisant des exigences complexes pour l'équipe.</li>
                `,
      "wizeline-academy-bullets": `
                  <li>Conçu et créé le parcours d'apprentissage du Data Engineering Apprenticeship.</li>
                  <li>Travaillé sur la modélisation des données et l'optimisation du projet final de l'Apprenticeship — utilisé par Wizeline pour évaluer les nouvelles recrues de l'équipe Data.</li>
                `,

      "de-role": "Ingénieure de Données",

      "indra-dates": "AVR 2021 — OCT 2021 · À DISTANCE",
      "indra-bullets": `
                <li>Migré un processus de Legacy vers la plateforme Datio pour construire un univers de données de contrats et clients en défaut de paiement.</li>
                <li>Élaboré des tests unitaires et d'acceptation.</li>
              `,

      "xaldigital-dates": "DÉC 2018 — DÉC 2020 · MEXICO",
      "xaldigital-bullets": `
                <li>Travaillé sur des projets dans les secteurs du commerce de détail et de l'assurance.</li>
                <li>Migré tout un processus de planification d'assortiment de fichiers Excel vers PySpark.</li>
                <li>Automatisé des pipelines ETL avec des services AWS.</li>
                <li>Migré des processus SQL vers PySpark pour améliorer l'efficacité et l'évolutivité.</li>
                <li>Dirigé le recueil des besoins et l'analyse métier pour proposer une architecture Data Lake sur AWS.</li>
                <li>Développé une preuve de concept pour générer des prévisions de demande de produits, architecturée sur AWS.</li>
                <li>Rédigé la documentation fonctionnelle et technique de tous les processus auxquels j'ai contribué.</li>
              `,

      "bigdata4all-dates": "NOV 2017 — DÉC 2018 · INTERLOMAS, ÉTAT DE MEXICO",
      "bigdata4all-bullets": `
                <li>Migré des processus SQL vers PySpark pour améliorer l'efficacité et l'évolutivité.</li>
                <li>Automatisé des pipelines ETL avec des services AWS.</li>
                <li>Rédigé la documentation fonctionnelle et technique de tous les processus auxquels j'ai contribué.</li>
              `,

      "projects-heading": "Projets personnels",
      "project1-desc": "Ce site — un portfolio personnel conçu de A à Z avec un moteur de portrait ASCII interactif, sans framework ni étape de build.",
      "project2-desc": "Travail en cours.",
      "project3-desc": "Travail en cours.",

      "hobbies-heading": "Loisirs",

      "hobby-horse-title": "Équitation",
      "hobby-horse-desc": "Depuis toute petite, j'ai toujours voulu être cavalière, mais je n'ai commencé les cours d'équitation qu'en mars 2026 — depuis, c'est devenu mon activité préférée.",

      "hobby-reading-title": "Lecture",
      "hobby-reading-desc": `Je lis actuellement <a href="https://www.amazon.com.mx/Mind-Gut-Connection-Conversation-Impacts-Choices/dp/0062376551/ref=sr_1_1?crid=7TGLIIBMNMPB&dib=eyJ2IjoiMSJ9.qzM8tKtAd5Ytuijvg_Pr-HQ3B3-2EKRTzSHOgPHqiKOkRihcgkY3CXRrSAfSc6PR_7fSUCzV0YKtaiHtW7WtOJNg8F_EnSyTbLtfX_Uk9BIMp3IilsD98x2j8d8fL8geUWp4i195fg-9uksp6JgGxTqSVib3v2AFy3icdtnSUDpi11eZWFAxdG0VlSTV1-dLSNiByrWMRk355HsF6ggKQmNPNdUHii6s2VZ7vjz9viEVZY_nzOJ86wzGrHW5uRzQnjnx2ogDMhDlc-c6RidEEq4gGaVblfT83P0Vxl73r0I.avl3-HIfdzg_FO0Div3hN3GMUz7uPEaK5b4rOS-9S4s&dib_tag=se&keywords=the+mind+gut+connection&qid=1787098640&sprefix=%2Caps%2C175&sr=8-1&ufe=app_do%3Aamzn1.fos.45030d3a-91a9-4303-890a-776dee9077c1" target="_blank" rel="noopener" class="inline-link">"The Mind-Gut Connection"</a> d'Emeran Mayer, MD.`,
      "hobby-buy-book": "Offrez-moi un livre",

      "hobby-piano-title": "Piano",
      "hobby-piano-desc": `De temps en temps, je joue du piano. J'apprends actuellement la technique via une chaîne YouTube appelée "Piano Roadmap".`,

      "footer-built": "Créé par Lilian Muñoz.",
      "footer-rights": "Tous droits réservés. ©",
    },
  };

  const langButtons = document.querySelectorAll(".lang-switch-btn");
  const i18nNodes = document.querySelectorAll("[data-i18n]");
  const originalHTML = new Map();
  i18nNodes.forEach((el) => originalHTML.set(el, el.innerHTML));

  function applyLang(lang) {
    i18nNodes.forEach((el) => {
      const key = el.dataset.i18n;
      const translated = translations[lang]?.[key];
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
    } catch (e) {
      // storage unavailable (private mode, disabled cookies, etc.) — language
      // just won't persist across reloads
    }
  }

  let savedLang = "en";
  try {
    savedLang = localStorage.getItem(STORAGE_KEY) || "en";
  } catch (e) {
    // storage unavailable — fall back to the default
  }
  applyLang(savedLang);

  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });
})();
