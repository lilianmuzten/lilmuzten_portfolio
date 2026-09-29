# Lilian Muñoz — Portfolio

Personal portfolio site for **Lilian Muñoz**, Data Engineer. Plain HTML/CSS/JS,
no build step, no framework — deployed straight to GitHub Pages.

**Live:** https://lilianmuzten.github.io/lilmuzten_portfolio/

![Hero section preview](assets/readme-preview.png)

## Features

- **About / Experience / Personal projects / Hobbies** sections, with a
  tabbed work-history panel.
- **Interactive ASCII portrait** — the real photo is what's shown at rest;
  hovering it crossfades to the hero photo sampled into a monospace ASCII
  density ramp on a `<canvas>`, with live mouse/touch physics: nearby
  characters get pushed away from the cursor and ease back into place, adapted
  to plain JS. Leaving the photo crossfades back.
- **Wandering nav mascot** — a pixel-art alien drifts back and forth in the
  nav bar, drawn with plain `fillRect` calls, no image assets.
- **EN/ES/FR language switch** in the nav, translating the page in place via
  the `data-i18n` dictionary in `i18n.js`, with the choice remembered in
  `localStorage`.

## Project structure

```
.
├── index.html          # all page markup/sections
├── styles.css          # all styling
├── script.js           # nav mascot, ASCII portrait engine + hover reveal,
│                       # experience tabs, and the language switch
├── i18n.js             # EN/ES/FR translation dictionary, consumed by script.js
├── assets/             # photos, hobby icons (gifs), favicons
├── favicon.ico
├── apple-touch-icon.png
├── scripts/smoke-test.mjs   # dev-only: see "Checks" below
├── eslint.config.js         # dev-only
├── package.json             # dev-only — the deployed site itself has no build step
└── .github/workflows/       # CI: runs the checks below on push/PR
```

## Running locally

No install, no build step — it's static files. Any local server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly as a `file://` URL also works, but a local
server avoids any browser quirks around `fetch`/`Image` loading from disk.)

## Checks

Dev-only tooling — none of it runs as part of deploying the site, and
GitHub Pages never sees it:

```bash
npm install
npm run lint   # eslint over script.js / i18n.js
npm test       # scripts/smoke-test.mjs: serves the site, drives it in
               # headless Chromium (Playwright), and asserts the hover
               # reveal, language switch, icon sprite, and personal-projects
               # links all still work
```

`.github/workflows/check.yml` runs both on every push/PR to `main`.

## Deployment

Pushes to `main` publish directly via GitHub Pages (Settings → Pages →
Deploy from a branch) — the site itself still has no build step; the CI
workflow above only checks the branch, it doesn't produce what gets deployed.

## Credits

- Hobby icons: `book.gif`, `horse.gif`, `piano.gif` in `assets/`.
- The ASCII portrait engine and several UI sizing/style details are adapted
  from [Gazi Jarin](https://github.com/gazijarin)'s portfolio
  (Gazi-portfolio/Gazi-V2), ported to plain JS/HTML with no React/build step.

---

© Lilian Muñoz. All rights reserved.
