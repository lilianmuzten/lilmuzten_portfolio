import js from "@eslint/js";

// Plain browser scripts (no bundler, no modules — see README's "no build
// step"), loaded in index.html as ordinary <script> tags in this order:
// i18n.js (defines the TRANSLATIONS global, see its own /* exported */
// comment) then script.js (consumes it). scripts/*.mjs is separate dev-only
// tooling (the smoke test), a real ES module run directly by Node.
const browserGlobals = {
  window: "readonly",
  document: "readonly",
  console: "readonly",
  localStorage: "readonly",
  performance: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  setTimeout: "readonly",
  Image: "readonly",
  getComputedStyle: "readonly",
};

export default [
  js.configs.recommended,
  {
    files: ["i18n.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
  },
  {
    files: ["script.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...browserGlobals, TRANSLATIONS: "readonly" },
    },
  },
  {
    // Node-side tooling, plus the browser globals its page.evaluate()
    // callbacks reference — those run inside the page, not here, but ESLint
    // lints the callback source as plain code in this file either way.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
        URL: "readonly",
        ...browserGlobals,
      },
    },
  },
  {
    ignores: ["node_modules/", "test-results/", "playwright-report/"],
  },
];
