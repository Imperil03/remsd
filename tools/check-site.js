const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const mode = process.env.SITE_MODE || "preview";
const internalData = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "internal-pages.json"), "utf8"));
const expectedHtml = ["404.html", "index.html", "remont-gruzovyh-avtomobiley/index.html"];
const internalFile = "remont-gruzovyh-avtomobiley/index.html";
const failures = [];
const fail = (message) => failures.push(message);

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
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
  const previewRelative = clean.startsWith("/remsd/") ? clean.slice("/remsd/".length) : null;
  const absolute = previewRelative !== null
    ? path.resolve(distDir, previewRelative)
    : clean.startsWith("/")
      ? path.resolve(distDir, clean.replace(/^\/+/, ""))
      : path.resolve(path.dirname(sourceFile), clean);
  if (absolute !== distDir && !absolute.startsWith(`${distDir}${path.sep}`)) return "outside";
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return absolute;
  return path.join(absolute, "index.html");
}

function collectStructuredTypes(value, bucket) {
  if (Array.isArray(value)) return value.forEach((item) => collectStructuredTypes(item, bucket));
  if (!value || typeof value !== "object") return;
  const type = value["@type"];
  if (Array.isArray(type)) type.forEach((item) => bucket.add(item));
  else if (typeof type === "string") bucket.add(type);
  Object.values(value).forEach((item) => collectStructuredTypes(item, bucket));
}

function parseStructuredTypes(html, relative) {
  const types = new Set();
  for (const script of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
    try {
      collectStructuredTypes(JSON.parse(script[1]), types);
    } catch (error) {
      fail(`${relative}: невалидный JSON-LD (${error.message})`);
    }
  }
  return types;
}

function count(html, pattern) {
  return (html.match(pattern) || []).length;
}

function sectionHtml(html, modifier) {
  return html.match(new RegExp(`<section[^>]+internal-section--${modifier}[\\s\\S]*?<\\/section>`, "i"))?.[0] || "";
}

if (!fs.existsSync(distDir)) {
  fail("dist/ не найден: сначала выполните сборку");
} else {
  const htmlFiles = getFiles(distDir).filter((file) => file.endsWith(".html"));
  const actualHtml = htmlFiles.map(relativeFromDist).sort();
  if (JSON.stringify(actualHtml) !== JSON.stringify(expectedHtml)) {
    fail(`сборка должна содержать ровно ${expectedHtml.join(", ")}; найдено: ${actualHtml.join(", ")}`);
  }
  const publicCss = fs.readdirSync(path.join(distDir, "assets", "css")).filter((file) => file.endsWith(".css")).sort();
  const expectedCss = ["base.css", "home-critical.css", "home.css", "internal.css"];
  if (JSON.stringify(publicCss) !== JSON.stringify(expectedCss)) {
    fail(`публичный CSS должен содержать только ${expectedCss.join(", ")}; найдено: ${publicCss.join(", ")}`);
  }

  const titles = new Map();
  const descriptions = new Map();
  const typesByPage = new Map();

  for (const file of htmlFiles) {
    const relative = relativeFromDist(file);
    const html = fs.readFileSync(file, "utf8");
    if (/{{[^}]+}}/.test(html)) fail(`${relative}: остался placeholder`);
    if (/href\s*=\s*["']#["']/i.test(html)) fail(`${relative}: найден href=\"#\"`);
    if (!/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)) fail(`${relative}: нет favicon`);
    if (!/<meta[^>]+property=["']og:title["']/i.test(html)) fail(`${relative}: нет Open Graph metadata`);
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, " ").trim();
    const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1].trim();
    if (!title) fail(`${relative}: нет title`);
    if (!description) fail(`${relative}: нет meta description`);
    if (title && titles.has(title)) fail(`${relative}: title совпадает с ${titles.get(title)}`);
    else if (title) titles.set(title, relative);
    if (description && descriptions.has(description)) fail(`${relative}: description совпадает с ${descriptions.get(description)}`);
    else if (description) descriptions.set(description, relative);
    const h1Count = count(html, /<h1\b/gi);
    if (h1Count !== 1) fail(`${relative}: ожидается один H1, найдено ${h1Count}`);
    if (mode === "preview" && !/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) fail(`${relative}: preview не закрыт noindex`);
    if (mode === "production" && /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) fail(`${relative}: production содержит noindex`);
    if (mode === "production" && !/<link[^>]+rel=["']canonical["']/i.test(html)) fail(`${relative}: production не содержит canonical`);
    typesByPage.set(relative, parseStructuredTypes(html, relative));

    for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href) || href.startsWith("#")) continue;
      const target = resolveLocalHref(file, href);
      if (target === "outside") fail(`${relative}: ссылка выходит за пределы dist (${href})`);
      else if (target && !fs.existsSync(target)) fail(`${relative}: битая локальная ссылка (${href})`);
    }
  }

  for (const type of ["Organization", "LocalBusiness", "AutoRepair"]) {
    if (!typesByPage.get("index.html")?.has(type)) fail(`index.html: JSON-LD не содержит ${type}`);
  }

  const internalPath = path.join(distDir, internalFile);
  const internalHtml = fs.existsSync(internalPath) ? fs.readFileSync(internalPath, "utf8") : "";
  for (const type of ["BreadcrumbList", "Service", "LocalBusiness", "AutoRepair"]) {
    if (!typesByPage.get(internalFile)?.has(type)) fail(`${internalFile}: JSON-LD не содержит ${type}`);
  }
  for (const forbidden of ["FAQPage", "Offer", "AggregateRating", "Review"]) {
    if (typesByPage.get(internalFile)?.has(forbidden)) fail(`${internalFile}: JSON-LD не должен содержать ${forbidden}`);
  }
  if (count(internalHtml, /<section\b[^>]*class=["'][^"']*internal-section\b/gi) !== 9) fail(`${internalFile}: ожидается 9 модульных секций`);
  if (count(internalHtml, /<nav\b[^>]+aria-label=["']Хлебные крошки["']/gi) !== 1) fail(`${internalFile}: нет хлебных крошек`);
  if (count(internalHtml, /<div><dt>[^<]+<\/dt><dd>[^<]+<\/dd><\/div>/gi) < 8) fail(`${internalFile}: не выведены hero-факты и показатели intro`);
  const expectedCounts = {
    serviceGrid: [/<article class="internal-service-card">/g, 6],
    vehicleTypes: [/<article class="internal-vehicle-card">/g, 6],
    brandStrip: [/<div class="internal-brand-strip__item">/g, 9],
    symptoms: [/<li>/gi, 6],
    workStages: [/<li class="internal-timeline__item">/g, 5],
    priceExamples: [/<th scope="row">/g, 8],
    relatedIndex: [/<span>/gi, 8],
    faq: [/<details>/g, 11],
  };
  for (const [section, [itemPattern, expected]] of Object.entries(expectedCounts)) {
    const source = sectionHtml(internalHtml, section);
    const actual = count(source, itemPattern);
    if (actual !== expected) fail(`${internalFile}: ${section} должен содержать ${expected} элементов, найдено ${actual}`);
  }
  const buttons = [...internalHtml.matchAll(/<a\b[^>]*class=["'][^"']*v3-button[^"']*["'][^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (buttons.length !== 2 || buttons.some((href) => href !== "tel:+79224488822")) fail(`${internalFile}: hero и контактный пролог должны содержать ровно два телефонных CTA`);
  if (/<form\b/i.test(internalHtml)) fail(`${internalFile}: формы запрещены`);
  if (/sidebar/i.test(internalHtml)) fail(`${internalFile}: sidebar запрещён`);
  if (!internalHtml.includes("Точная стоимость определяется после диагностики. Цены указаны ориентировочно")) fail(`${internalFile}: отсутствует утверждённая оговорка о цене`);
  if (!internalHtml.includes("Ежедневно с 08:00 до 22:00")) fail(`${internalFile}: отсутствует утверждённый график`);
  const pageDefinition = internalData.pages.find((page) => page.path === "remont-gruzovyh-avtomobiley");
  const faqDefinition = pageDefinition?.sections.find((section) => section.type === "faq");
  for (const item of faqDefinition?.items || []) {
    if (!internalHtml.includes(item.question) || !internalHtml.includes(item.answer)) fail(`${internalFile}: FAQ изменён: ${item.question}`);
  }

  if (mode === "preview" && fs.existsSync(path.join(distDir, "sitemap.xml"))) fail("preview не должен публиковать sitemap.xml");
  if (mode === "production" && !fs.existsSync(path.join(distDir, "sitemap.xml"))) fail("production должен публиковать sitemap.xml");
  const robotsFile = path.join(distDir, "robots.txt");
  if (!fs.existsSync(robotsFile)) fail("robots.txt не собран");
  else if (mode === "preview" && /Disallow:\s*\//i.test(fs.readFileSync(robotsFile, "utf8"))) fail("preview robots.txt не должен блокировать обход");
}

if (failures.length) {
  console.error(`Проверка сайта не пройдена (${failures.length}):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Проверка сайта пройдена: режим ${mode}, опубликованы главная, эталонный hub и 404.`);
