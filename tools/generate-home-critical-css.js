const fs = require("fs");
const http = require("http");
const path = require("path");
const postcss = require("postcss");
const puppeteer = require("puppeteer-core");
const { chromium } = require("playwright");
const { transform: transformCss } = require("lightningcss");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const outputFile = path.join(root, "assets", "css", "home-critical.css");
const host = "127.0.0.1";
const port = Number(process.env.CRITICAL_PORT || 4178);

function criticalShell() {
  const html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  const hero = html.match(/<section class="v3-hero"[\s\S]*?<\/section>/)?.[0];
  if (!hero) throw new Error("Не удалось выделить первый экран главной");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><base href="/"><link rel="stylesheet" href="./assets/css/home.css"></head><body class="v3-page"><main>${hero}</main></body></html>`;
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
      if (pathname === "/__critical__/") {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "text/html; charset=utf-8",
        });
        response.end(criticalShell());
        return;
      }
      const file = resolveRequest(request.url);
      if (!file) {
        response.writeHead(404).end();
        return;
      }
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

async function collectCoverage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.coverage.startCSSCoverage();
  await page.goto(`http://${host}:${port}/__critical__/`, { waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const coverage = await page.coverage.stopCSSCoverage();
  await page.close();
  return coverage.sort((a, b) => b.text.length - a.text.length)[0];
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
    const entries = [];
    for (const viewport of [
      { width: 390, height: 844, deviceScaleFactor: 1 },
      { width: 1440, height: 900, deviceScaleFactor: 1 },
    ]) {
      entries.push(await collectCoverage(browser, viewport));
    }
    const source = entries[0].text;
    if (entries.some((entry) => entry.text !== source)) throw new Error("CSS coverage вернул разные исходники");
    const ranges = mergeRanges(entries.flatMap((entry) => entry.ranges));
    const parsed = postcss.parse(source, { from: "home.css" });
    const criticalRoot = postcss.root();
    criticalRoot.append(postcss.parse(".v3-page :where(main > :not(.v3-hero)){display:none}"));
    criticalRoot.append(keepUsedNodes(parsed, ranges));
    const normalized = criticalRoot.toString()
      .replaceAll("./assets/fonts/", "../fonts/")
      .replaceAll("./assets/img/", "../img/");
    const minified = transformCss({
      filename: outputFile,
      code: Buffer.from(normalized),
      minify: true,
    }).code;
    fs.writeFileSync(outputFile, minified);
    console.log(`Generated ${path.relative(root, outputFile)}: ${minified.length} bytes from ${source.length}.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
