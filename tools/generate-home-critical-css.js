const fs = require("fs");
const http = require("http");
const path = require("path");
const postcss = require("postcss");
const puppeteer = require("puppeteer-core");
const { chromium } = require("playwright");
const { transform: transformCss } = require("lightningcss");
const { extractFontFaces } = require("./lib/font-faces");
const { loadInternalPageCatalog } = require("./lib/internal-pages");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const dataDir = path.join(root, "src", "data");
const siteConfig = JSON.parse(fs.readFileSync(path.join(dataDir, "site-config.json"), "utf8"));
const internalCatalog = loadInternalPageCatalog({ root, dataDir, assetsDir: path.join(root, "assets"), siteConfig });
const referenceRoute = internalCatalog.manifest.referenceByFamily.hub;
const referencePage = internalCatalog.pages.find((page) => page.path === referenceRoute);
const host = "127.0.0.1";
const port = Number(process.env.CRITICAL_PORT || 4178);
const targets = [
  {
    name: "home",
    file: "index.html",
    css: "home.css",
    fontSources: ["styles.css", "styles-v3.css"],
    heroClass: "v3-hero",
    bodyClass: "v3-page",
    output: "home-critical.css",
    prepend: ".v3-page :where(main > :not(.v3-hero)){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  },
  {
    name: "internal",
    file: `${referenceRoute}/index.html`,
    css: "internal.css",
    fontSources: ["styles.css"],
    heroClass: "internal-hero",
    bodyClass: `internal-page internal-page--${referencePage.family}`,
    output: "internal-critical.css",
    prepend: ".internal-page main>:not(.internal-hero){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  },
];

if (internalCatalog.manifest.referenceByFamily.company) {
  targets.push({
    name: "company", file: `${internalCatalog.manifest.referenceByFamily.company}/index.html`,
    css: "company.css", fontSources: ["styles.css"], heroClass: "company-hero", bodyClass: "company-page",
    output: "company-critical.css", extraClass: "company-facts",
    prepend: ".company-page main>:not(.company-hero):not(.company-facts){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  });
}

if (internalCatalog.manifest.referenceByFamily.contact) {
  targets.push({
    name: "contact", file: `${internalCatalog.manifest.referenceByFamily.contact}/index.html`,
    css: "contact.css", fontSources: ["styles.css"], heroClass: "contacts-hero", bodyClass: "contacts-page",
    output: "contact-critical.css",
    prepend: ".contacts-page main>:not(.contacts-hero){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  });
}

if (internalCatalog.manifest.referenceByFamily.documents) {
  targets.push({
    name: "certificates", file: `${internalCatalog.manifest.referenceByFamily.documents}/index.html`,
    css: "certificates.css", fontSources: ["styles.css"], heroClass: "certificates-hero", bodyClass: "certificates-page",
    output: "certificates-critical.css",
    prepend: ".certificates-page main>:not(.certificates-hero){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  });
}

// Read canonical sources rather than previously generated critical CSS or bundles,
// which may already omit definitions supplied by the inline critical stylesheet.
for (const target of targets) {
  target.fontFaces = extractFontFaces(target.fontSources
    .map((file) => fs.readFileSync(path.join(root, "assets", "css", file), "utf8"))
    .join("\n"));
}

function criticalShell(target) {
  const html = fs.readFileSync(path.join(distDir, target.file), "utf8");
  const escapedClass = target.heroClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hero = html.match(new RegExp(`<section class="[^"]*${escapedClass}[^"]*"[\\s\\S]*?<\\/section>`))?.[0];
  if (!hero) throw new Error(`Не удалось выделить первый экран ${target.name}`);
  const fontFaces = target.fontFaces.replaceAll("../fonts/", "./assets/fonts/");
  const extra = target.extraClass ? html.match(new RegExp(`<section class="[^"]*${target.extraClass}[^"]*"[\\s\\S]*?<\\/section>`))?.[0] || "" : "";
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><base href="/"><style>${fontFaces}</style><link rel="stylesheet" href="./assets/css/${target.css}"></head><body class="${target.bodyClass}"><main>${hero}${extra}</main></body></html>`;
}

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const requested = path.resolve(distDir, pathname.replace(/^\/+/, ""));
  if (requested !== distDir && !requested.startsWith(`${distDir}${path.sep}`)) return null;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
  const index = path.join(requested, "index.html");
  return fs.existsSync(index) ? index : null;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
      const match = pathname.match(/^\/__critical__\/([a-z]+)\/$/);
      if (match) {
        const target = targets.find((item) => item.name === match[1]);
        if (!target) return response.writeHead(404).end();
        response.writeHead(200, { "cache-control": "no-store", "content-type": "text/html; charset=utf-8" });
        response.end(criticalShell(target));
        return;
      }
      const file = resolveRequest(request.url);
      if (!file) return response.writeHead(404).end();
      response.writeHead(200, { "cache-control": "no-store" });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(port, host, () => resolve(server));
  });
}

function mergeRanges(ranges) {
  const merged = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function overlaps(node, ranges) {
  const start = node.source?.start?.offset;
  const end = node.source?.end?.offset;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  return ranges.some((range) => range.start < end + 1 && range.end > start);
}

function keepUsedNodes(container, ranges) {
  const kept = [];
  for (const node of container.nodes || []) {
    // Font definitions are appended explicitly from the canonical source once.
    if (node.type === "atrule" && node.name.toLowerCase() === "font-face") continue;
    const nestedAtRule = node.type === "atrule"
      && node.nodes
      && ["media", "supports", "layer", "container", "document"].includes(node.name);
    if (nestedAtRule) {
      const clone = node.clone({ nodes: [] });
      clone.append(keepUsedNodes(node, ranges));
      if (clone.nodes.length) kept.push(clone);
    } else if (["rule", "atrule"].includes(node.type) && overlaps(node, ranges)) {
      kept.push(node.clone());
    }
  }
  return kept;
}

async function collectCoverage(browser, target, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.coverage.startCSSCoverage();
  await page.goto(`http://${host}:${port}/__critical__/${target.name}/`, { waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const coverage = await page.coverage.stopCSSCoverage();
  await page.close();
  return coverage.find((entry) => entry.url.endsWith(`/assets/css/${target.css}`));
}

async function generateTarget(browser, target) {
  const entries = [];
  for (const viewport of [
    { width: 390, height: 844, deviceScaleFactor: 1 },
    { width: 1280, height: 900, deviceScaleFactor: 1 },
    { width: 1440, height: 900, deviceScaleFactor: 1 },
  ]) {
    const entry = await collectCoverage(browser, target, viewport);
    if (!entry) throw new Error(`CSS coverage не нашёл ${target.css}`);
    entries.push(entry);
  }
  const source = entries[0].text;
  if (entries.some((entry) => entry.text !== source)) throw new Error(`${target.css}: coverage вернул разные исходники`);
  const ranges = mergeRanges(entries.flatMap((entry) => entry.ranges));
  const parsed = postcss.parse(source, { from: target.css });
  const criticalRoot = postcss.root();
  criticalRoot.append(postcss.parse(target.prepend));
  criticalRoot.append(postcss.parse(target.fontFaces));
  criticalRoot.append(keepUsedNodes(parsed, ranges));
  const normalized = criticalRoot.toString()
    .replaceAll("./assets/fonts/", "../fonts/")
    .replaceAll("./assets/img/", "../img/");
  const outputFile = path.join(root, "assets", "css", target.output);
  const minified = transformCss({ filename: outputFile, code: Buffer.from(normalized), minify: true }).code;
  fs.writeFileSync(outputFile, minified);
  console.log(`Generated ${path.relative(root, outputFile)}: ${minified.length} bytes from ${source.length}.`);
}

async function run() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error("Сначала соберите dist/");
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromium.executablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (const target of targets) await generateTarget(browser, target);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
