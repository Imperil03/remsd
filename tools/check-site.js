const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const mode = process.env.SITE_MODE || "preview";
const pilotFiles = [
  "remont/index.html",
  "remont-gbc/index.html",
  "remont/maz/index.html",
];

const failures = [];
const incoming = new Map(pilotFiles.map((file) => [file, new Set()]));
const structuredTypes = new Map();
const titleOwners = new Map();
const descriptionOwners = new Map();

function fail(message) {
  failures.push(message);
}

function getFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? getFiles(absolute) : [absolute];
  });
}

function relativeFromDist(file) {
  return path.relative(distDir, file).split(path.sep).join("/");
}

function resolveLocalHref(sourceFile, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return null;
  const sourceDir = path.dirname(sourceFile);
  const absolute = clean.startsWith("/")
    ? path.join(distDir, clean.replace(/^\/+/, ""))
    : path.resolve(sourceDir, clean);
  const candidate = clean.endsWith("/") ? path.join(absolute, "index.html") : absolute;
  return path.normalize(candidate);
}

function collectStructuredTypes(value, bucket) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredTypes(item, bucket));
    return;
  }
  if (!value || typeof value !== "object") return;
  const type = value["@type"];
  if (Array.isArray(type)) type.forEach((item) => bucket.add(item));
  else if (typeof type === "string") bucket.add(type);
  Object.values(value).forEach((item) => collectStructuredTypes(item, bucket));
}

function registerUnique(bucket, value, relative, label) {
  if (!value) return;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (bucket.has(normalized)) fail(`${relative}: ${label} совпадает с ${bucket.get(normalized)}`);
  else bucket.set(normalized, relative);
}

if (!fs.existsSync(distDir)) {
  fail("dist/ не найден: сначала выполните сборку");
} else {
  const htmlFiles = getFiles(distDir).filter((file) => file.endsWith(".html"));

  for (const pilot of pilotFiles) {
    if (!fs.existsSync(path.join(distDir, pilot))) fail(`Не собран пилот: ${pilot}`);
  }

  for (const file of htmlFiles) {
    const relative = relativeFromDist(file);
    const html = fs.readFileSync(file, "utf8");

    if (/{{[^}]+}}/.test(html)) fail(`${relative}: остался неразрешённый placeholder`);
    if (/href\s*=\s*["']#["']/i.test(html)) fail(`${relative}: найден href="#"`);
    if (!/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)) fail(`${relative}: нет favicon`);
    if (!/<meta[^>]+property=["']og:title["']/i.test(html)) fail(`${relative}: нет Open Graph metadata`);

    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
    const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1];
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    if (!title) fail(`${relative}: нет title`);
    if (!description) fail(`${relative}: нет meta description`);
    registerUnique(titleOwners, title, relative, "title");
    registerUnique(descriptionOwners, description, relative, "meta description");
    if (h1Count !== 1) fail(`${relative}: ожидается один H1, найдено ${h1Count}`);

    if (mode === "preview" && !/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) {
      fail(`${relative}: preview-страница не закрыта noindex`);
    }
    if (mode === "production" && /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) {
      fail(`${relative}: production-страница содержит noindex`);
    }
    if (mode === "production" && !/<link[^>]+rel=["']canonical["']/i.test(html)) {
      fail(`${relative}: production-страница не содержит canonical`);
    }

    const pageStructuredTypes = new Set();
    for (const script of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
      try {
        collectStructuredTypes(JSON.parse(script[1]), pageStructuredTypes);
      } catch (error) {
        fail(`${relative}: невалидный JSON-LD (${error.message})`);
      }
    }
    structuredTypes.set(relative, pageStructuredTypes);

    for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href) || href.startsWith("#")) continue;
      const target = resolveLocalHref(file, href);
      if (!target || !target.startsWith(distDir)) {
        fail(`${relative}: ссылка выходит за пределы dist (${href})`);
        continue;
      }
      if (!fs.existsSync(target)) {
        fail(`${relative}: локальная ссылка ведёт на отсутствующий файл (${href})`);
        continue;
      }
    }

    const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
    const contextualHtml = mainHtml.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "");
    for (const match of contextualHtml.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href) || href.startsWith("#")) continue;
      const target = resolveLocalHref(file, href);
      if (!target || !fs.existsSync(target)) continue;
      const normalizedTarget = relativeFromDist(target);
      if (incoming.has(normalizedTarget) && normalizedTarget !== relative) incoming.get(normalizedTarget).add(relative);
    }
  }

  for (const expected of ["Organization", "LocalBusiness", "AutoRepair"]) {
    if (!structuredTypes.get("index.html")?.has(expected)) fail(`index.html: JSON-LD не содержит ${expected}`);
  }

  for (const pilot of pilotFiles) {
    const html = fs.existsSync(path.join(distDir, pilot))
      ? fs.readFileSync(path.join(distDir, pilot), "utf8")
      : "";
    if (!/<nav[^>]+aria-label=["']Хлебные крошки["']/i.test(html)) fail(`${pilot}: нет полных хлебных крошек`);
    for (const expected of ["BreadcrumbList", "Service"]) {
      if (!structuredTypes.get(pilot)?.has(expected)) fail(`${pilot}: JSON-LD не содержит ${expected}`);
    }
    if ((incoming.get(pilot)?.size || 0) < 3) {
      fail(`${pilot}: меньше трёх уникальных входящих контекстных ссылок`);
    }
  }

  if (mode === "preview" && fs.existsSync(path.join(distDir, "sitemap.xml"))) {
    fail("preview-сборка не должна публиковать sitemap.xml");
  }
  if (mode === "production" && !fs.existsSync(path.join(distDir, "sitemap.xml"))) {
    fail("production-сборка должна публиковать sitemap.xml");
  }
  const robotsFile = path.join(distDir, "robots.txt");
  if (!fs.existsSync(robotsFile)) {
    fail("robots.txt не собран");
  } else if (mode === "preview" && /Disallow:\s*\//i.test(fs.readFileSync(robotsFile, "utf8"))) {
    fail("preview robots.txt не должен блокировать обход: робот должен увидеть meta noindex");
  }
}

if (failures.length) {
  console.error(`Проверка сайта не пройдена (${failures.length}):`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Проверка сайта пройдена: режим ${mode}, пилоты и локальные ссылки валидны.`);
