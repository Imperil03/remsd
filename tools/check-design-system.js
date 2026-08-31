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
  "section-space-compact",
  "section-space-default",
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

for (const [token, value] of [["layout-container", "1312px"], ["layout-gutter", "36px"]]) {
  if (!new RegExp(`--${token}\\s*:\\s*${value}\\s*;`).test(tokenCss)) {
    fail(`${tokenFile}: --${token} должен быть ${value}`);
  }
}

if ((tokenCss.match(/:root\s*\{/g) || []).length !== 1) {
  fail(`${tokenFile}: должен содержать ровно один :root`);
}

const consumerCssFiles = ["styles.css", "site-chrome.css", "styles-v3.css", "internal-pages.css"];
for (const file of consumerCssFiles) {
  const source = fs.readFileSync(path.join(cssDir, file), "utf8");
  if (/:root\s*\{/.test(source)) fail(`assets/css/${file}: глобальные токены разрешены только в design-system.css`);
}

for (const file of ["styles-v3.css", "internal-pages.css"]) {
  const source = fs.readFileSync(path.join(cssDir, file), "utf8");
  const sharedChromeSelector = source.match(/\.v3-(?:header|nav|logo|footer)[\w-]*/);
  if (sharedChromeSelector) {
    fail(`assets/css/${file}: ${sharedChromeSelector[0]} принадлежит только site-chrome.css`);
  }
}

const internalPagesCss = read("assets/css/internal-pages.css");
const homepageCss = read("assets/css/styles-v3.css");
const siteChromeCss = read("assets/css/site-chrome.css");
function selectorDeclares(source, selector, declarationPattern) {
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).some(([, selectors, declarations]) => (
    selectors.split(",").map((item) => item.trim()).includes(selector) && declarationPattern.test(declarations)
  ));
}

const defaultRhythm = /padding-block\s*:\s*var\(--section-space-default\)\s*;?/;
const compactRhythm = /padding-block\s*:\s*var\(--section-space-compact\)\s*;?/;
if (!selectorDeclares(internalPagesCss, ".internal-section", defaultRhythm)) {
  fail("assets/css/internal-pages.css: .internal-section должен использовать var(--section-space-default)");
}
for (const modifier of ["workStages", "relatedIndex"]) {
  if (!selectorDeclares(internalPagesCss, `.internal-section--${modifier}`, compactRhythm)) {
    fail(`assets/css/internal-pages.css: .internal-section--${modifier} должен использовать var(--section-space-compact)`);
  }
}
const groupedRhythm = [
  [".internal-section--serviceGrid", /padding-block\s*:\s*var\(--section-space-compact\)\s+32px\s*;?/],
  [".internal-section--popularWorks", /padding-block\s*:\s*48px\s*;?/],
  [".internal-section--vehicleTypes", /padding-block\s*:\s*48px\s+var\(--section-space-compact\)\s*;?/],
  [".internal-section--brandStrip", /padding-block\s*:\s*32px\s+var\(--section-space-compact\)\s*;?/],
];
for (const [selector, pattern] of groupedRhythm) {
  if (!selectorDeclares(internalPagesCss, selector, pattern)) {
    fail(`assets/css/internal-pages.css: ${selector} должен поддерживать общий 64px-ритм связки`);
  }
}
if (!selectorDeclares(internalPagesCss, ".internal-page .container", /width\s*:\s*min\(calc\(100%\s*-\s*\(2\s*\*\s*var\(--layout-gutter\)\)\),\s*var\(--layout-container\)\)\s*;?/)) {
  fail("assets/css/internal-pages.css: контейнер внутренней страницы должен использовать общую направляющую --layout-container");
}

const sharedGuide = /width\s*:\s*min\(calc\(100%\s*-\s*\(2\s*\*\s*var\(--layout-gutter\)\)\),\s*var\(--layout-container\)\)\s*;?/;
for (const [source, selector] of [
  [homepageCss, ".v3-hero__shell"],
  [siteChromeCss, ".site-header-rail"],
  [internalPagesCss, ".internal-hero__shell"],
  [internalPagesCss, ".internal-page .container"],
]) {
  if (!selectorDeclares(source, selector, sharedGuide)) fail(`${selector}: должен использовать общую направляющую --layout-container`);
}
if (!selectorDeclares(homepageCss, ".v3-hero__frame", /padding\s*:\s*0\s*;?/)) {
  fail("assets/css/styles-v3.css: .v3-hero__frame не должен добавлять desktop inset");
}

const gridContracts = [
  [".internal-service-grid", 6],
  [".internal-popular-works", 4],
  [".internal-vehicle-mosaic", 3],
  [".internal-timeline", 5],
];
for (const [selector, columns] of gridContracts) {
  const columnsPattern = new RegExp(`grid-template-columns\\s*:\\s*repeat\\(\\s*${columns}\\s*,\\s*minmax\\(\\s*0\\s*,\\s*1fr\\s*\\)\\s*\\)\\s*;?`);
  if (!selectorDeclares(internalPagesCss, selector, columnsPattern)) {
    fail(`assets/css/internal-pages.css: ${selector} должен иметь desktop-сетку ${columns} колонок`);
  }
}
for (const [selector, columns] of [[".internal-section--brandShowcase .v3-brand-grid", 3], [".internal-section--brandShowcase .v3-brand-matrix", 5]]) {
  const pattern = new RegExp(`grid-template-columns\\s*:\\s*repeat\\(\\s*${columns}\\s*,\\s*minmax\\(\\s*0\\s*,\\s*1fr\\s*\\)\\s*\\)\\s*;?`);
  if (!selectorDeclares(internalPagesCss, selector, pattern)) {
    fail(`assets/css/internal-pages.css: ${selector} должен иметь desktop-сетку ${columns} колонок`);
  }
}

for (const selector of [".internal-symptoms-layout", ".internal-price-content", ".internal-inline-cta"]) {
  if (!selectorDeclares(internalPagesCss, selector, /display\s*:\s*grid\s*;?/)) {
    fail(`assets/css/internal-pages.css: отсутствует ${selector}`);
  }
}
if (!/\.internal-inline-cta--symptoms\s*\{[^}]*chassis-repair\.webp[^}]*\}/s.test(internalPagesCss)) {
  fail("assets/css/internal-pages.css: CTA признаков должна использовать chassis-repair.webp");
}
if (!/\.internal-inline-cta--prices\s*\{[^}]*engine-work\.webp[^}]*\}/s.test(internalPagesCss)) {
  fail("assets/css/internal-pages.css: CTA цен должна использовать engine-work.webp");
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
  ["assets/css/internal-pages.css", 1279],
  ["assets/css/internal-pages.css", 1020],
  ["assets/css/internal-pages.css", 720],
  ["assets/css/internal-pages.css", 520],
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
