const fs = require("fs");
const http = require("http");
const path = require("path");
const postcss = require("postcss");
const puppeteer = require("puppeteer-core");
const { chromium } = require("playwright");
const { transform: transformCss } = require("lightningcss");
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
    heroClass: "v3-hero",
    bodyClass: "v3-page",
    output: "home-critical.css",
    prepend: ".v3-page :where(main > :not(.v3-hero)){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  },
  {
    name: "internal",
    file: `${referenceRoute}/index.html`,
    css: "internal.css",
    heroClass: "internal-hero",
    bodyClass: `internal-page internal-page--${referencePage.family}`,
    output: "internal-critical.css",
    prepend: ".internal-page main>:not(.internal-hero){content-visibility:hidden;contain-intrinsic-block-size:900px}",
  },
];

function criticalShell(target) {
  const html = fs.readFileSync(path.join(distDir, target.file), "utf8");
  const escapedClass = target.heroClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hero = html.match(new RegExp(`<section class="[^"]*${escapedClass}[^"]*"[\\s\\S]*?<\\/section>`))?.[0];
  if (!hero) throw new Error(`Не удалось выделить первый экран ${target.name}`);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><base href="/"><link rel="stylesheet" href="./assets/css/${target.css}"></head><body class="${target.bodyClass}"><main>${hero}</main></body></html>`;
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
    const criticalFont = node.type === "atrule"
      && node.name === "font-face"
      && /(?:Montserrat Variable|Source Sans 3 Variable|Geologica V3)/.test(node.toString());
    const nestedAtRule = node.type === "atrule"
      && node.nodes
      && ["media", "supports", "layer", "container", "document"].includes(node.name);
    if (criticalFont) {
      kept.push(node.clone());
    } else if (nestedAtRule) {
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
