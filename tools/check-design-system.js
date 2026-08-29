const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cssDir = path.join(root, "assets", "css");
const srcDir = path.join(root, "src");

const failures = [];
const fail = (message) => failures.push(message);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const tokenFile = "assets/css/design-system.css";
const tokenCss = read(tokenFile);
const requiredTokens = [
  "font-heading",
  "font-body",
  "text-primary",
  "text-secondary",
  "text-inverse",
  "text-on-accent",
  "surface-page",
  "surface-card",
  "surface-muted",
  "surface-dark",
  "surface-dark-raised",
  "action-primary",
  "action-primary-hover",
  "action-secondary",
  "action-secondary-hover",
  "border-subtle",
  "border-default",
  "border-strong",
  "focus-ring",
  "shadow-card",
  "shadow-card-hover",
  "shadow-overlay",
  "layout-container",
  "layout-gutter",
  "radius-sm",
  "radius-md",
  "control-height-compact",
  "control-height-default",
  "control-height-prominent",
  "breakpoint-compact",
  "breakpoint-internal-nav",
  "breakpoint-home-nav",
];

for (const token of requiredTokens) {
  if (!new RegExp(`--${token}\\s*:`).test(tokenCss)) fail(`${tokenFile}: отсутствует --${token}`);
}

if ((tokenCss.match(/:root\s*\{/g) || []).length !== 1) {
  fail(`${tokenFile}: должен содержать ровно один :root`);
}

const consumerCssFiles = ["styles.css", "site-chrome.css", "styles-v3.css", "internal-pages.css"];
for (const file of consumerCssFiles) {
  const source = fs.readFileSync(path.join(cssDir, file), "utf8");
  if (/:root\s*\{/.test(source)) fail(`assets/css/${file}: глобальные токены разрешены только в design-system.css`);
}

const expectedBundles = {
  "base.css": ["design-system.css", "styles.css", "site-chrome.css"],
  "home.css": ["design-system.css", "styles.css", "site-chrome.css", "styles-v3.css"],
  "internal.css": ["design-system.css", "styles.css", "site-chrome.css", "internal-pages.css"],
};
const buildSource = read("tools/build.js");
for (const [bundle, expected] of Object.entries(expectedBundles)) {
  const match = buildSource.match(new RegExp(`"${bundle.replace(".", "\\.")}"\\s*:\\s*\\[([^\\]]+)\\]`));
  if (!match) {
    fail(`tools/build.js: не найден bundle ${bundle}`);
    continue;
  }
  const actual = Array.from(match[1].matchAll(/"([^"]+\.css)"/g), (item) => item[1]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`tools/build.js: ${bundle} должен собираться как ${expected.join(" -> ")}`);
  }
}

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith(".html") ? [target] : [];
  });
}

const physicalLayers = /assets\/css\/(?:design-system|styles|site-chrome|styles-v3|internal-pages)\.css/;
for (const file of htmlFiles(srcDir)) {
  const source = fs.readFileSync(file, "utf8");
  if (physicalLayers.test(source)) {
    fail(`${path.relative(root, file)}: подключайте base.css, home.css или internal.css, а не физический CSS-слой`);
  }
}

const mainJs = read("assets/js/main.js");
for (const [name, value] of Object.entries({ compact: 720, internalNav: 1020, homeNav: 1120 })) {
  if (!new RegExp(`${name}\\s*:\\s*${value}(?:,|\\s)`).test(mainJs)) {
    fail(`assets/js/main.js: DESIGN_BREAKPOINTS.${name} должен быть ${value}`);
  }
}

const breakpointChecks = [
  ["assets/css/styles.css", 1020],
  ["assets/css/site-chrome.css", 1120],
  ["assets/css/styles-v3.css", 1120],
  ["assets/css/styles-v3.css", 720],
  ["assets/css/internal-pages.css", 1120],
  ["assets/css/internal-pages.css", 720],
];
for (const [file, value] of breakpointChecks) {
  const source = read(file);
  if (!new RegExp(`@media\\s*\\(max-width:\\s*${value}px\\)`).test(source)) {
    fail(`${file}: отсутствует контрактный breakpoint ${value}px`);
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`[design-system] ${message}`));
  process.exit(1);
}

console.log(`Design-system contract OK: ${requiredTokens.length} tokens, ${Object.keys(expectedBundles).length} bundles.`);
