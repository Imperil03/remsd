const fs = require("fs");
const http = require("http");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const resultDir = path.join(root, "test-results", "lighthouse");
const host = "127.0.0.1";
const port = Number(process.env.LIGHTHOUSE_PORT || 4175);
const minScore = Number(process.env.LIGHTHOUSE_MIN_SCORE || 0.95);
const routes = ["/", "/remont/", "/remont-gbc/", "/remont/maz/"];

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const relative = pathname.replace(/^\/+/, "");
  const requested = path.resolve(distDir, relative);
  if (requested !== distDir && !requested.startsWith(`${distDir}${path.sep}`)) return null;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
  const index = path.join(requested, "index.html");
  return fs.existsSync(index) ? index : null;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
      if (pathname === "/__lighthouse-warmup__") {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "text/html; charset=utf-8",
        });
        response.end("<!doctype html><html><head><meta charset=\"utf-8\"><title>Warm-up</title></head><body><p>Warm-up</p></body></html>");
        return;
      }
      const file = resolveRequest(request.url);
      if (!file) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const extension = path.extname(file);
      const compressible = [".css", ".html", ".js", ".json", ".svg"].includes(extension);
      const acceptsGzip = /\bgzip\b/i.test(request.headers["accept-encoding"] || "");
      const headers = {
        "cache-control": "no-store",
        "content-type": mime[extension] || "application/octet-stream",
        vary: "Accept-Encoding",
      };
      if (compressible && acceptsGzip) {
        headers["content-encoding"] = "gzip";
        response.writeHead(200, headers);
        fs.createReadStream(file).pipe(zlib.createGzip({ level: 9 })).pipe(response);
      } else {
        response.writeHead(200, headers);
        fs.createReadStream(file).pipe(response);
      }
    });
    server.listen(port, host, () => resolve(server));
  });
}

function score(lhr, category) {
  return Math.round((lhr.categories[category]?.score || 0) * 100);
}

async function run() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error("Сначала соберите production-like dist/");
  const home = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  if (/name=["']robots["'][^>]+noindex/i.test(home)) {
    throw new Error("Lighthouse запускается только для indexable production-like сборки");
  }

  fs.mkdirSync(resultDir, { recursive: true });
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([
    import("lighthouse"),
    import("chrome-launcher"),
  ]);
  const server = await startServer();
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const failures = [];

  try {
    await lighthouse(`http://${host}:${port}/__lighthouse-warmup__`, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance"],
    });
    console.log("Lighthouse browser warm-up complete.");

    for (const route of routes) {
      const url = `http://${host}:${port}${route}`;
      const result = await lighthouse(url, {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      });
      const lhr = result.lhr;
      const metrics = {
        performance: score(lhr, "performance"),
        accessibility: score(lhr, "accessibility"),
        bestPractices: score(lhr, "best-practices"),
        seo: score(lhr, "seo"),
        fcp: Math.round(lhr.audits["first-contentful-paint"]?.numericValue ?? Infinity),
        lcp: Math.round(lhr.audits["largest-contentful-paint"]?.numericValue ?? Infinity),
        speedIndex: Math.round(lhr.audits["speed-index"]?.numericValue ?? Infinity),
        tbt: Math.round(lhr.audits["total-blocking-time"]?.numericValue ?? Infinity),
        cls: Number((lhr.audits["cumulative-layout-shift"]?.numericValue ?? Infinity).toFixed(3)),
        consoleErrors: lhr.audits["errors-in-console"]?.details?.items?.length || 0,
      };
      const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replaceAll("/", "-");
      fs.writeFileSync(path.join(resultDir, `${slug}.json`), result.report, "utf8");
      console.log(`${route} P${metrics.performance} A${metrics.accessibility} BP${metrics.bestPractices} SEO${metrics.seo} FCP ${metrics.fcp}ms LCP ${metrics.lcp}ms SI ${metrics.speedIndex}ms TBT ${metrics.tbt}ms CLS ${metrics.cls}`);

      for (const category of ["performance", "accessibility", "seo"]) {
        if (metrics[category] < minScore * 100) failures.push(`${route}: ${category} ${metrics[category]} < ${minScore * 100}`);
      }
      if (metrics.lcp >= 2500) failures.push(`${route}: LCP ${metrics.lcp}ms >= 2500ms`);
      if (metrics.cls >= 0.1) failures.push(`${route}: CLS ${metrics.cls} >= 0.1`);
      if (metrics.consoleErrors) failures.push(`${route}: ошибок в консоли ${metrics.consoleErrors}`);
    }
  } finally {
    try {
      await chrome.kill();
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      console.warn(`Chrome завершён, но временный профиль не удалён: ${error.message}`);
    }
    await new Promise((resolve) => server.close(resolve));
  }

  if (failures.length) throw new Error(`Lighthouse verification failed:\n- ${failures.join("\n- ")}`);
  console.log(`Lighthouse verification passed for ${routes.length} routes.`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
