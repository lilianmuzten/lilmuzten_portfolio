// Smoke test for this static site: serves the repo root over HTTP, drives it
// in headless Chromium via Playwright, and asserts the handful of behaviors
// that are easy to silently break (a stray <script> reorder, a class-name
// typo, an i18n key mismatch) but that no build step would ever catch, since
// there isn't one — see README.md. Run with `npm test`; exits non-zero and
// prints the failing assertion on any mismatch, for CI.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 8123;

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

function startServer() {
  const server = createServer(async (req, res) => {
    const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    try {
      const data = await readFile(join(ROOT, path));
      res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(path)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(500);

  // 1. i18n.js loaded before script.js and defines what script.js expects.
  // TRANSLATIONS is a top-level `const` in a classic (non-module) script, so
  // it's a global *lexical* binding, not a `window` property — reference it
  // bare, the way script.js itself does.
  const translationsType = await page.evaluate(() => typeof TRANSLATIONS);
  assert(translationsType === "object", `TRANSLATIONS should be an object, got ${translationsType}`);

  // 2. Portrait: resting state is the photo, hovering reveals the ASCII engine
  const initialClass = await page.evaluate(() => document.querySelector(".portrait-wrap").className);
  assert(initialClass.includes("portrait-wrap--photo"), `expected photo to be the resting state, got class="${initialClass}"`);

  await page.hover(".portrait-stage");
  await page.waitForTimeout(1200); // the 1s crossfade
  const hoveredClass = await page.evaluate(() => document.querySelector(".portrait-wrap").className);
  assert(!hoveredClass.includes("portrait-wrap--photo"), `expected the ASCII engine to show on hover, got class="${hoveredClass}"`);

  await page.mouse.move(5, 5); // move off the stage
  await page.waitForTimeout(1200);
  const leftClass = await page.evaluate(() => document.querySelector(".portrait-wrap").className);
  assert(leftClass.includes("portrait-wrap--photo"), `expected the photo back after leaving the stage, got class="${leftClass}"`);

  // 3. Icon sprite: symbols exist and are actually referenced
  const spriteOk = await page.evaluate(() =>
    ["icon-github", "icon-external-link", "icon-folder"].every((id) => document.getElementById(id))
  );
  assert(spriteOk, "expected all three icon sprite <symbol>s to be present");
  const danglingUses = await page.evaluate(() =>
    [...document.querySelectorAll("use")].filter((u) => !document.getElementById(u.getAttribute("href").slice(1))).length
  );
  assert(danglingUses === 0, `expected no <use> to reference a missing symbol, found ${danglingUses}`);

  // 4. Language switch: EN -> ES -> FR all update the greeting and <html lang>
  for (const lang of ["es", "fr", "en"]) {
    await page.click(`.lang-switch-btn[data-lang="${lang}"]`);
    await page.waitForTimeout(100);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    assert(htmlLang === lang, `expected <html lang="${lang}">, got "${htmlLang}"`);
  }

  // 5. Personal projects: live-project link only on the card that has one
  const liveLinkCounts = await page.evaluate(() =>
    [...document.querySelectorAll(".project-card")].map((card) => card.querySelectorAll('a[aria-label="Open live project"]').length)
  );
  assert(
    JSON.stringify(liveLinkCounts) === JSON.stringify([1, 0, 0]),
    `expected exactly the first project card to have a live-project link, got counts ${JSON.stringify(liveLinkCounts)}`
  );

  // 6. Mobile: no horizontal overflow, and the hamburger menu works. A
  // narrow viewport is where a wide nav or an oversized hero photo pushes
  // the page past its own width or buries the greeting below the fold —
  // neither shows up at the 1400px width used above.
  const mobile = await browser.newPage({ viewport: { width: 375, height: 900 } });
  mobile.on("pageerror", (err) => consoleErrors.push(String(err)));
  mobile.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await mobile.goto(`http://localhost:${PORT}/index.html`);
  await mobile.waitForTimeout(500);

  const mobileScrollWidth = await mobile.evaluate(() => document.documentElement.scrollWidth);
  assert(mobileScrollWidth <= 375, `expected no horizontal overflow at 375px, got scrollWidth=${mobileScrollWidth}`);

  const heroOrder = await mobile.evaluate(() => {
    const text = document.querySelector(".hero-text").getBoundingClientRect();
    const photo = document.querySelector(".portrait-wrap").getBoundingClientRect();
    return text.top < photo.top;
  });
  assert(heroOrder, "expected the greeting to appear above the photo on a phone-width screen");

  const tabsHiddenInitially = await mobile.evaluate(() => getComputedStyle(document.getElementById("navTabs")).display === "none");
  assert(tabsHiddenInitially, "expected .nav-tabs to start collapsed on a phone-width screen");

  const toggleVisible = await mobile.evaluate(() => getComputedStyle(document.getElementById("navToggle")).display !== "none");
  assert(toggleVisible, "expected #navToggle (the hamburger button) to be visible on a phone-width screen");

  if (toggleVisible) {
    await mobile.click("#navToggle", { timeout: 2000 });
    await mobile.waitForTimeout(150);
    const tabsShownAfterToggle = await mobile.evaluate(() => getComputedStyle(document.getElementById("navTabs")).display !== "none");
    assert(tabsShownAfterToggle, "expected .nav-tabs to open on #navToggle click");

    if (tabsShownAfterToggle) {
      await mobile.click("#navTabs .nav-tab", { timeout: 2000 });
      await mobile.waitForTimeout(150);
      const tabsHiddenAfterLinkClick = await mobile.evaluate(() => getComputedStyle(document.getElementById("navTabs")).display === "none");
      assert(tabsHiddenAfterLinkClick, "expected .nav-tabs to close after clicking a link inside it");
    }
  }

  await mobile.close();

  // 7. No console errors or uncaught exceptions across all of the above
  assert(consoleErrors.length === 0, `expected no console errors, got: ${consoleErrors.join(" | ")}`);

  await browser.close();
  server.close();

  if (failures.length) {
    console.error(`✗ ${failures.length} smoke test assertion(s) failed:\n`);
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  console.log("✓ smoke test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
