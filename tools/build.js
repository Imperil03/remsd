const fs = require("fs");
const path = require("path");
const { transform: transformCss } = require("lightningcss");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const pagesDir = path.join(srcDir, "pages");
const partialsDir = path.join(srcDir, "partials");
const dataDir = path.join(srcDir, "data");
const templatesDir = path.join(srcDir, "templates");
const assetsDir = path.join(root, "assets");
const distDir = path.join(root, "dist");
const assetVersion = process.env.ASSET_VERSION || "20260831-internal-content-hub-v6";

const PAGE_FAMILIES = new Set(["hub", "service", "brand"]);
const SECTION_TYPES = new Set([
  "introProof", "serviceGrid", "popularWorks", "vehicleTypes", "brandStrip",
  "brandShowcase", "editorialContent", "symptoms", "workStages", "priceExamples",
  "relatedIndex", "faq",
]);

function fail(message) {
  throw new Error(`[build] ${message}`);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label}: ожидается объект`);
  return value;
}

function requireArray(value, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(`${label}: ожидается массив`);
  if (nonEmpty && !value.length) fail(`${label}: массив не должен быть пустым`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label}: обязательная строка не заполнена`);
  return value.trim();
}

function requireIsoDate(value, label) {
  const date = requireText(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${label}: ожидается дата YYYY-MM-DD`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail(`${label}: несуществующая календарная дата ${date}`);
  }
  return date;
}

function readJson(file) {
  if (!fs.existsSync(file)) fail(`не найден файл ${path.relative(root, file)}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${path.relative(root, file)}: невалидный JSON (${error.message})`);
  }
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

function minifyCssFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) minifyCssFiles(file);
    else if (entry.isFile() && entry.name.endsWith(".css")) {
      const result = transformCss({ filename: file, code: fs.readFileSync(file), minify: true });
      fs.writeFileSync(file, result.code);
    }
  }
}

function createCssBundles(cssDir) {
  const bundles = {
    "base.css": ["design-system.css", "styles.css", "site-chrome.css"],
    "home.css": ["design-system.css", "styles.css", "site-chrome.css", "styles-v3.css"],
    "internal.css": ["design-system.css", "styles.css", "site-chrome.css", "internal-pages.css"],
  };
  for (const [target, sources] of Object.entries(bundles)) {
    const css = sources.map((source) => fs.readFileSync(path.join(cssDir, source), "utf8")).join("\n");
    fs.writeFileSync(path.join(cssDir, target), css, "utf8");
  }
  return new Set(Object.values(bundles).flat());
}

function getHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) return getHtmlFiles(source);
    return entry.isFile() && entry.name.endsWith(".html") ? [source] : [];
  });
}

function normalizeRoute(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string") fail(`${label}: маршрут должен быть строкой`);
  if (/[?#]/.test(value)) fail(`${label}: query и fragment не входят в маршрут`);
  const route = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!route) {
    if (allowEmpty) return "";
    fail(`${label}: пустой маршрут`);
  }
  if (route.split("/").some((part) => !/^[a-z0-9-]+$/.test(part))) fail(`${label}: недопустимый маршрут «${value}»`);
  return route;
}

function routeFromSource(file) {
  const relative = path.relative(pagesDir, file).split(path.sep).join("/");
  if (relative === "index.html") return "";
  if (relative.endsWith("/index.html")) return normalizeRoute(relative.slice(0, -"/index.html".length), relative);
  return normalizeRoute(relative.replace(/\.html$/, ""), relative);
}

function outputFileForRoute(route) {
  if (route === "") return path.join(distDir, "index.html");
  if (route === "404") return path.join(distDir, "404.html");
  return path.join(distDir, ...route.split("/"), "index.html");
}

function getRootPath(relativeFile) {
  const dir = path.dirname(relativeFile);
  if (dir === ".") return "./";
  return "../".repeat(dir.split(path.sep).filter(Boolean).length);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function validateNoHtml(value, label) {
  if (typeof value === "string" && /[<>]/.test(value)) fail(`${label}: HTML в контентных JSON запрещён`);
  if (Array.isArray(value)) value.forEach((item, index) => validateNoHtml(item, `${label}[${index}]`));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => validateNoHtml(item, `${label}.${key}`));
  }
}

function validateAsset(asset, label) {
  const normalized = requireText(asset, label).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/")) fail(`${label}: путь должен начинаться с assets/`);
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(path.resolve(assetsDir) + path.sep) || !fs.existsSync(absolute)) {
    fail(`${label}: файл не найден (${normalized})`);
  }
}

function readPartials(homeStructuredData) {
  const partials = {};
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".html")) continue;
    partials[path.basename(file, ".html")] = fs.readFileSync(path.join(partialsDir, file), "utf8");
  }
  partials["home-structured-data"] = homeStructuredData;
  return partials;
}

function render(content, partials, context) {
  let output = content;
  for (let pass = 0; pass < 12; pass += 1) {
    let next = output;
    for (const [name, html] of Object.entries(partials)) next = next.replaceAll(`{{${name}}}`, html);
    if (next === output) break;
    output = next;
  }
  for (const [name, value] of Object.entries(context)) output = output.replaceAll(`{{${name}}}`, String(value));
  return output;
}

function assertNoPlaceholders(html, label) {
  const unresolved = html.match(/{{[^}]+}}/g);
  if (unresolved) fail(`${label}: остались placeholder ${[...new Set(unresolved)].join(", ")}`);
}

function toAbsoluteUrl(baseUrl, route, { file = false } = {}) {
  if (!route) return baseUrl;
  return new URL(file ? route : `${route.replace(/\/+$/, "")}/`, baseUrl).toString();
}

function assetUrl(baseUrl, asset) {
  return new URL(asset.replace(/^\/+/, ""), baseUrl).toString();
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replaceAll("<", "\\u003c")}\n</script>`;
}

function openingHoursNode(site) {
  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: site.openingHours.days,
    opens: site.openingHours.opens,
    closes: site.openingHours.closes,
  };
}

function localBusinessNode(config, baseUrl) {
  const site = config.site;
  return {
    "@type": ["LocalBusiness", "AutoRepair"],
    "@id": `${baseUrl}#auto-repair`,
    name: site.name,
    url: baseUrl,
    image: [assetUrl(baseUrl, site.defaultSocialImage)],
    telephone: site.phoneHref.replace("tel:", ""),
    email: site.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    areaServed: site.areaServed.map((name, index) => ({
      "@type": index === 0 ? "City" : "AdministrativeArea",
      name,
    })),
    openingHoursSpecification: [openingHoursNode(site)],
    parentOrganization: { "@id": `${baseUrl}#organization` },
  };
}

function buildHomeStructuredData(config, baseUrl) {
  const site = config.site;
  return jsonLdScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}#organization`,
        name: site.name,
        url: baseUrl,
        logo: assetUrl(baseUrl, site.logo),
        telephone: site.phoneHref.replace("tel:", ""),
        email: site.email,
      },
      localBusinessNode(config, baseUrl),
    ],
  });
}

function buildInternalStructuredData(page, config, baseUrl) {
  const url = toAbsoluteUrl(baseUrl, page.path);
  const breadcrumbs = page.breadcrumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.label,
    item: crumb.href === undefined ? url : toAbsoluteUrl(baseUrl, normalizeRoute(crumb.href, `${page.path}.breadcrumbs`, { allowEmpty: true })),
  }));
  return jsonLdScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: breadcrumbs,
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.hero.h1,
        serviceType: "Ремонт грузовых автомобилей",
        description: page.metadata.description,
        url,
        provider: { "@id": `${baseUrl}#auto-repair` },
        areaServed: { "@type": "City", name: config.site.address.locality },
        availableChannel: {
          "@type": "ServiceChannel",
          servicePhone: {
            "@type": "ContactPoint",
            telephone: config.site.phoneHref.replace("tel:", ""),
            contactType: "service",
          },
        },
      },
      localBusinessNode(config, baseUrl),
    ],
  });
}

function metadataBlock({ title, description, socialImage }, route, rootPath, config, mode, baseUrl) {
  const pageUrl = route === "404" ? toAbsoluteUrl(baseUrl, "404.html", { file: true }) : toAbsoluteUrl(baseUrl, route);
  const imageUrl = assetUrl(baseUrl, socialImage || config.site.defaultSocialImage);
  const robots = mode === "preview" ? "noindex,nofollow,noarchive" : "index,follow,max-image-preview:large";
  const canonical = mode === "production" ? `\n    <link rel="canonical" href="${escapeHtml(pageUrl)}">` : "";
  return `    <link rel="icon" type="image/png" href="${rootPath}assets/img/favicon.png">
    <link rel="apple-touch-icon" href="${rootPath}assets/img/apple-touch-icon.png">
    <meta name="robots" content="${robots}">${canonical}
    <meta property="og:locale" content="ru_RU">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(config.site.name)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(pageUrl)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`;
}

function enrichHead(html, metadata, route, rootPath, config, mode, baseUrl, structuredData = "") {
  if (!html.includes("</head>")) fail(`${route || "/"}: отсутствует </head>`);
  const additions = `${metadataBlock(metadata, route, rootPath, config, mode, baseUrl)}${structuredData ? `\n    ${structuredData}` : ""}`;
  return html.replace("  </head>", `${additions}\n  </head>`);
}

function extractMetadata(html, label, config) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1].trim();
  if (!title || !description) fail(`${label}: нужны title и meta description`);
  return { title, description, socialImage: config.site.defaultSocialImage };
}

function validateConfig(config) {
  requireObject(config, "site-config.json");
  if (config.schemaVersion !== 1) fail("site-config.json: поддерживается schemaVersion 1");
  requireObject(config.modes, "site-config.modes");
  for (const mode of ["preview", "production"]) {
    const baseUrl = requireText(config.modes[mode]?.baseUrl, `site-config.modes.${mode}.baseUrl`);
    try {
      if (!/^https?:$/.test(new URL(baseUrl).protocol) || !baseUrl.endsWith("/")) fail(`${mode}.baseUrl: нужен HTTP(S) URL со слешем`);
    } catch (error) {
      fail(`${mode}.baseUrl: невалидный URL`);
    }
  }
  const site = requireObject(config.site, "site-config.site");
  ["name", "phone", "phoneHref", "email", "mapUrl", "timeZone", "defaultSocialImage", "logo"].forEach((key) => requireText(site[key], `site.${key}`));
  requireObject(site.address, "site.address");
  ["street", "locality", "region", "country"].forEach((key) => requireText(site.address[key], `site.address.${key}`));
  requireArray(site.areaServed, "site.areaServed", { nonEmpty: true });
  requireObject(site.primaryCta, "site.primaryCta");
  ["label", "shortLabel", "href"].forEach((key) => requireText(site.primaryCta[key], `site.primaryCta.${key}`));
  const hours = requireObject(site.openingHours, "site.openingHours");
  requireArray(hours.days, "site.openingHours.days", { nonEmpty: true }).forEach((day, index) => requireText(day, `site.openingHours.days[${index}]`));
  ["opens", "closes", "label"].forEach((key) => requireText(hours[key], `site.openingHours.${key}`));
  validateAsset(site.defaultSocialImage, "site.defaultSocialImage");
  validateAsset(site.logo, "site.logo");
  requireArray(config.claims, "site-config.claims").forEach((claim, index) => {
    requireObject(claim, `claims[${index}]`);
    ["id", "text", "scope", "source"].forEach((key) => requireText(claim[key], `claims[${index}].${key}`));
    if (claim.status !== "owner_approved") fail(`claims[${index}].status: допускается owner_approved`);
    if (claim.validThrough !== undefined) requireIsoDate(claim.validThrough, `claims[${index}].validThrough`);
  });
}

function validateClaimExpiry(claims, mode, timeZone) {
  if (mode !== "production") return;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asOf = process.env.CLAIMS_AS_OF || `${values.year}-${values.month}-${values.day}`;
  requireIsoDate(asOf, "CLAIMS_AS_OF");
  for (const claim of claims) {
    if (claim.validThrough !== undefined && claim.validThrough < asOf) {
      fail(`claim ${claim.id}: срок validThrough ${claim.validThrough} истёк; production-сборка остановлена`);
    }
  }
}

function validateSection(section, label) {
  requireObject(section, label);
  requireText(section.id, `${label}.id`);
  const type = requireText(section.type, `${label}.type`);
  if (!SECTION_TYPES.has(type)) fail(`${label}.type: неизвестный тип ${type}`);
  requireText(section.title, `${label}.title`);
  if (section.intro !== undefined) requireText(section.intro, `${label}.intro`);

  if (type === "introProof") {
    requireArray(section.bullets, `${label}.bullets`, { nonEmpty: true }).forEach((item, index) => requireText(item, `${label}.bullets[${index}]`));
    requireText(section.statement, `${label}.statement`);
    validateAsset(section.image, `${label}.image`);
    requireText(section.imageAlt, `${label}.imageAlt`);
    requireArray(section.stats, `${label}.stats`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.value, `${label}.stats[${index}].value`);
      requireText(item.label, `${label}.stats[${index}].label`);
    });
  } else if (["serviceGrid", "workStages"].includes(type)) {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.title, `${label}.items[${index}].title`);
      requireText(item.text, `${label}.items[${index}].text`);
      requireText(item.icon, `${label}.items[${index}].icon`);
    });
  } else if (type === "vehicleTypes") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.title, `${label}.items[${index}].title`);
      requireText(item.text, `${label}.items[${index}].text`);
      validateAsset(item.image, `${label}.items[${index}].image`);
      requireText(item.alt, `${label}.items[${index}].alt`);
    });
  } else if (type === "popularWorks") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.title, `${label}.items[${index}].title`);
      requireText(item.icon, `${label}.items[${index}].icon`);
      if (item.href !== undefined) normalizeRoute(item.href, `${label}.items[${index}].href`);
    });
  } else if (type === "brandStrip") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.name, `${label}.items[${index}].name`);
      validateAsset(item.image, `${label}.items[${index}].image`);
    });
  } else if (type === "brandShowcase") {
    requireArray(section.official, `${label}.official`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.name, `${label}.official[${index}].name`);
      validateAsset(item.image, `${label}.official[${index}].image`);
    });
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => requireText(item, `${label}.items[${index}]`));
  } else if (type === "editorialContent") {
    requireText(section.lead, `${label}.lead`);
    requireArray(section.blocks, `${label}.blocks`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.title, `${label}.blocks[${index}].title`);
      requireText(item.text, `${label}.blocks[${index}].text`);
    });
  } else if (type === "symptoms") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.icon, `${label}.items[${index}].icon`);
      requireText(item.text, `${label}.items[${index}].text`);
    });
  } else if (type === "relatedIndex") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => requireText(item, `${label}.items[${index}]`));
  } else if (type === "priceExamples") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.service, `${label}.items[${index}].service`);
      requireText(item.price, `${label}.items[${index}].price`);
    });
    requireText(section.note, `${label}.note`);
  } else if (type === "faq") {
    requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
      requireText(item.question, `${label}.items[${index}].question`);
      requireText(item.answer, `${label}.items[${index}].answer`);
    });
  }
}

function validateInternalPages(data) {
  requireObject(data, "internal-pages.json");
  if (data.schemaVersion !== 2) fail("internal-pages.json: поддерживается schemaVersion 2");
  const pages = requireArray(data.pages, "internal-pages.pages", { nonEmpty: true });
  const paths = new Set();
  const titles = new Set();
  pages.forEach((page, index) => {
    const label = `internal-pages.pages[${index}]`;
    requireObject(page, label);
    page.path = normalizeRoute(page.path, `${label}.path`);
    if (paths.has(page.path)) fail(`${label}.path: маршрут дублируется`);
    paths.add(page.path);
    if (!PAGE_FAMILIES.has(page.family)) fail(`${label}.family: ожидается hub, service или brand`);
    const metadata = requireObject(page.metadata, `${label}.metadata`);
    ["title", "description"].forEach((key) => requireText(metadata[key], `${label}.metadata.${key}`));
    if (titles.has(metadata.title)) fail(`${label}.metadata.title: title должен быть уникальным`);
    titles.add(metadata.title);
    validateAsset(metadata.socialImage, `${label}.metadata.socialImage`);
    requireArray(page.breadcrumbs, `${label}.breadcrumbs`, { nonEmpty: true }).forEach((crumb, crumbIndex) => {
      requireText(crumb.label, `${label}.breadcrumbs[${crumbIndex}].label`);
      if (crumb.href !== undefined) normalizeRoute(crumb.href, `${label}.breadcrumbs[${crumbIndex}].href`, { allowEmpty: true });
    });
    const hero = requireObject(page.hero, `${label}.hero`);
    ["h1", "lead", "ctaLabel"].forEach((key) => requireText(hero[key], `${label}.hero.${key}`));
    if (hero.accent !== undefined) requireText(hero.accent, `${label}.hero.accent`);
    validateAsset(hero.image, `${label}.hero.image`);
    validateAsset(hero.mobileImage, `${label}.hero.mobileImage`);
    requireArray(hero.facts, `${label}.hero.facts`, { nonEmpty: true }).forEach((fact, factIndex) => {
      requireText(fact.icon, `${label}.hero.facts[${factIndex}].icon`);
      requireText(fact.label, `${label}.hero.facts[${factIndex}].label`);
      requireText(fact.value, `${label}.hero.facts[${factIndex}].value`);
    });
    const sectionIds = new Set();
    requireArray(page.sections, `${label}.sections`, { nonEmpty: true }).forEach((section, sectionIndex) => {
      validateSection(section, `${label}.sections[${sectionIndex}]`);
      if (sectionIds.has(section.id)) fail(`${label}.sections: дублируется id ${section.id}`);
      sectionIds.add(section.id);
    });
  });
  validateNoHtml(data, "internal-pages.json");
  return pages;
}

function renderBreadcrumbs(page, rootPath) {
  const items = page.breadcrumbs.map((crumb, index) => {
    const last = index === page.breadcrumbs.length - 1;
    if (last || crumb.href === undefined) return `              <li aria-current="page">${escapeHtml(crumb.label)}</li>`;
    const href = crumb.href === "" ? rootPath : `${rootPath}${crumb.href.replace(/^\/+|\/+$/g, "")}/`;
    return `              <li><a href="${escapeHtml(href)}">${escapeHtml(crumb.label)}</a></li>`;
  }).join("\n");
  return `            <nav class="internal-breadcrumbs" aria-label="Хлебные крошки">\n              <ol>\n${items}\n              </ol>\n            </nav>`;
}

function renderHeroTitle(hero) {
  const title = requireText(hero.h1, "hero.h1");
  if (!hero.accent || !title.endsWith(hero.accent)) return escapeHtml(title);
  const base = title.slice(0, -hero.accent.length).trim();
  return `${escapeHtml(base)} <span>${escapeHtml(hero.accent)}</span>`;
}

function renderHeroFacts(hero) {
  return hero.facts.map((fact) => `            <div>
              <svg class="internal-hero__fact-icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(fact.icon)}"></use></svg>
              <dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd>
            </div>`).join("\n");
}

function renderSectionHead(section, { centered = false } = {}) {
  const intro = section.intro ? `<p>${escapeHtml(section.intro)}</p>` : "";
  return `        <header class="internal-section__head${centered ? " internal-section__head--center" : ""}">
          <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
          ${intro}
        </header>`;
}

function renderIntroProof(section, rootPath) {
  const bullets = section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const stats = section.stats.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join("");
  return `<section class="internal-section internal-section--introProof" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container internal-intro">
    <div class="internal-intro__copy">
      <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
      <p class="internal-intro__lead">${escapeHtml(section.intro)}</p>
      <ul class="internal-intro__list">${bullets}</ul>
      <p class="internal-intro__statement">${escapeHtml(section.statement)}</p>
    </div>
    <figure class="internal-intro__media"><img src="${rootPath}${escapeHtml(section.image)}" alt="${escapeHtml(section.imageAlt)}" width="937" height="1080" loading="lazy" decoding="async"></figure>
    <dl class="internal-intro__stats">${stats}</dl>
  </div>
</section>`;
}

function renderServiceGrid(section) {
  const items = section.items.map((item) => `<article class="internal-service-card">
  <svg class="internal-service-card__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg>
  <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
</article>`).join("\n");
  return `<section class="internal-section internal-section--serviceGrid" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section, { centered: true })}<div class="internal-service-grid">${items}</div><a class="internal-reference-link" href="#related-services">Смотреть все услуги</a></div>
</section>`;
}

function renderPopularWorks(section, rootPath) {
  const items = section.items.map((item) => {
    const content = `<svg class="internal-popular-work__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg><span>${escapeHtml(item.title)}</span>`;
    return item.href
      ? `<li class="internal-popular-work internal-popular-work--linked"><a href="${rootPath}${escapeHtml(item.href)}/">${content}</a></li>`
      : `<li class="internal-popular-work">${content}</li>`;
  }).join("");
  return `<section class="internal-section internal-section--popularWorks" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<ul class="internal-popular-works" aria-label="Популярные работы по ремонту грузовых автомобилей">${items}</ul></div>
</section>`;
}

function renderVehicleTypes(section, rootPath) {
  const items = section.items.map((item) => `<article class="internal-vehicle-card">
  <img src="${rootPath}${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">
  <div class="internal-vehicle-card__copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
</article>`).join("\n");
  return `<section class="internal-section internal-section--vehicleTypes" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section, { centered: true })}<div class="internal-vehicle-mosaic">${items}</div></div>
</section>`;
}

function renderBrandStrip(section, rootPath) {
  const items = section.items.map((item) => `<div class="internal-brand-strip__item"><img src="${rootPath}${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async"></div>`).join("");
  return `<section class="internal-section internal-section--brandStrip" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section, { centered: true })}<div class="internal-brand-strip" aria-label="Марки грузовых автомобилей">${items}</div><a class="internal-reference-link internal-reference-link--accent" href="${rootPath}#v3-truck-brands-title">Смотреть все марки</a></div>
</section>`;
}

function renderBrandShowcase(section, rootPath) {
  const official = section.official.map((item) => `<li class="v3-brand-card v3-brand-card--official">
  <div class="v3-brand-card__body">
    <span class="v3-brand-card__logo"><img src="${rootPath}${escapeHtml(item.image)}" alt="" width="220" height="120" loading="lazy" decoding="async"></span>
    <strong class="v3-brand-card__name">Ремонт ${escapeHtml(item.name)}</strong>
    <span class="v3-brand-card__status">Официальный сервис</span>
  </div>
</li>`).join("");
  const matrix = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="internal-section internal-section--brandShowcase v3-truck-brands" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">
    <header class="internal-brand-showcase__head"><h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.intro)}</p></header>
    <ul class="v3-brand-grid" aria-label="Официальный сервис грузовых автомобилей">${official}</ul>
    <button class="v3-brand-toggle" type="button" aria-expanded="false" aria-controls="internal-brand-matrix" data-brand-toggle><span>Все марки, которые принимаем</span><span aria-hidden="true">${section.items.length}</span></button>
    <ul class="v3-brand-matrix" id="internal-brand-matrix" aria-label="Другие марки грузовых автомобилей" data-brand-panel>${matrix}</ul>
  </div>
</section>`;
}

function renderEditorialContent(section) {
  const blocks = section.blocks.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join("");
  return `<section class="internal-section internal-section--editorialContent" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container internal-editorial"><header><h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.lead)}</p></header><div class="internal-editorial__body">${blocks}</div></div>
</section>`;
}

function renderInlineCta({ id, modifier, title, text }, site) {
  return `<aside class="internal-inline-cta internal-inline-cta--${escapeHtml(modifier)}" aria-labelledby="${escapeHtml(id)}">
  <div class="internal-inline-cta__content">
    <h3 id="${escapeHtml(id)}">${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    <a class="v3-button v3-button--primary" href="${escapeHtml(site.phoneHref)}">${escapeHtml(site.primaryCta.label)}</a>
  </div>
</aside>`;
}

function renderSymptoms(section, site) {
  const items = section.items.map((item) => `<li><svg class="internal-symptom__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg><span>${escapeHtml(item.text)}</span></li>`).join("");
  const cta = renderInlineCta({
    id: `${section.id}-cta-title`,
    modifier: "symptoms",
    title: "Есть признаки неисправности?",
    text: "Позвоните мастеру, назовите марку автомобиля и опишите неисправность — уточним, с чего начать диагностику.",
  }, site);
  return `<section class="internal-section internal-section--symptoms" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<div class="internal-symptoms-layout"><ul class="internal-symptoms">${items}</ul>${cta}</div></div>
</section>`;
}

function renderWorkStages(section) {
  const items = section.items.map((item, index) => `<li class="internal-timeline__item">
  <svg class="internal-timeline__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg>
  <span class="internal-timeline__number">${String(index + 1).padStart(2, "0")}</span>
  <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p>
</li>`).join("");
  return `<section class="internal-section internal-section--workStages" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<ol class="internal-timeline">${items}</ol></div>
</section>`;
}

function renderPriceTable(items) {
  const rows = items.map((item) => `<tr><th scope="row">${escapeHtml(item.service)}</th><td>${escapeHtml(item.price)}</td></tr>`).join("");
  return `<table class="internal-price-table"><thead class="visually-hidden"><tr><th>Услуга</th><th>Цена от</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPriceExamples(section, site) {
  const midpoint = Math.ceil(section.items.length / 2);
  const cta = renderInlineCta({
    id: `${section.id}-cta-title`,
    modifier: "prices",
    title: "Нужна точная стоимость?",
    text: "Сначала мастер определяет причину неисправности и объём необходимых работ.",
  }, site);
  return `<section class="internal-section internal-section--priceExamples" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}
    <div class="internal-price-content"><div class="internal-price-main">
      <div class="internal-price-layout">${renderPriceTable(section.items.slice(0, midpoint))}${renderPriceTable(section.items.slice(midpoint))}</div>
      <p class="internal-price-note">${escapeHtml(section.note)}</p>
    </div>${cta}</div>
  </div>
</section>`;
}

function renderRelatedIndex(section) {
  const items = section.items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  return `<section class="internal-section internal-section--relatedIndex" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<div class="internal-related-index" aria-label="Будущие направления сайта">${items}</div></div>
</section>`;
}

function renderFaq(section) {
  const items = section.items.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("");
  return `<section class="internal-section internal-section--faq" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container internal-faq-layout">${renderSectionHead(section)}<div class="internal-faq">${items}</div></div>
</section>`;
}

function renderSection(section, rootPath, site) {
  const renderers = {
    introProof: () => renderIntroProof(section, rootPath),
    serviceGrid: () => renderServiceGrid(section),
    popularWorks: () => renderPopularWorks(section, rootPath),
    vehicleTypes: () => renderVehicleTypes(section, rootPath),
    brandStrip: () => renderBrandStrip(section, rootPath),
    brandShowcase: () => renderBrandShowcase(section, rootPath),
    editorialContent: () => renderEditorialContent(section),
    symptoms: () => renderSymptoms(section, site),
    workStages: () => renderWorkStages(section),
    priceExamples: () => renderPriceExamples(section, site),
    relatedIndex: () => renderRelatedIndex(section),
    faq: () => renderFaq(section),
  };
  return renderers[section.type]();
}

function writeHtml(route, html, writtenRoutes) {
  if (writtenRoutes.has(route)) fail(`попытка повторно записать маршрут ${route || "/"}`);
  const normalized = html.replace(/[ \t]+$/gm, "").replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "> <").trim();
  assertNoPlaceholders(normalized, route || "/");
  const target = outputFileForRoute(route);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, normalized, "utf8");
  writtenRoutes.add(route);
}

function buildStaticPages(staticFiles, partials, config, mode, baseUrl, writtenRoutes) {
  for (const source of staticFiles) {
    const route = routeFromSource(source);
    const target = outputFileForRoute(route);
    const rootPath = route === "404"
      ? new URL(baseUrl).pathname
      : getRootPath(path.relative(distDir, target));
    const homeCss = route === ""
      ? fs.readFileSync(path.join(distDir, "assets", "css", "home-critical.css"), "utf8")
        .replaceAll("../fonts/", `${rootPath}assets/fonts/`)
        .replaceAll("../img/", `${rootPath}assets/img/`)
      : "";
    const rendered = render(fs.readFileSync(source, "utf8"), partials, {
      rootPath,
      assetVersion,
      homeStyles: homeCss ? `<style data-critical-styles>${homeCss}</style>` : "",
    });
    const metadata = extractMetadata(rendered, route || "/", config);
    writeHtml(route, enrichHead(rendered, metadata, route, rootPath, config, mode, baseUrl), writtenRoutes);
  }
}

function buildInternalPages(pages, partials, config, mode, baseUrl, writtenRoutes) {
  const template = fs.readFileSync(path.join(templatesDir, "internal-page.html"), "utf8");
  const internalCriticalFile = path.join(assetsDir, "css", "internal-critical.css");
  for (const page of pages) {
    const target = outputFileForRoute(page.path);
    const rootPath = getRootPath(path.relative(distDir, target));
    const internalCriticalCss = fs.existsSync(internalCriticalFile)
      ? fs.readFileSync(internalCriticalFile, "utf8")
        .replaceAll("../fonts/", `${rootPath}assets/fonts/`)
        .replaceAll("../img/", `${rootPath}assets/img/`)
      : "";
    const rendered = render(template, partials, {
      rootPath,
      assetVersion,
      internalStyles: internalCriticalCss ? `<style data-critical-styles>${internalCriticalCss}</style>` : "",
      family: escapeHtml(page.family),
      title: escapeHtml(page.metadata.title),
      description: escapeHtml(page.metadata.description),
      heroImage: escapeHtml(page.hero.image),
      heroMobileImage: escapeHtml(page.hero.mobileImage),
      h1: renderHeroTitle(page.hero),
      lead: escapeHtml(page.hero.lead),
      heroCtaLabel: escapeHtml(page.hero.ctaLabel),
      heroFacts: renderHeroFacts(page.hero),
      breadcrumbs: renderBreadcrumbs(page, rootPath),
      sections: page.sections.map((section) => renderSection(section, rootPath, config.site)).join("\n"),
      phoneHref: escapeHtml(config.site.phoneHref),
      phone: escapeHtml(config.site.phone),
      address: escapeHtml(`${config.site.address.locality}, ${config.site.address.street}`),
      openingHoursLabel: escapeHtml(config.site.openingHours.label),
    });
    writeHtml(
      page.path,
      enrichHead(rendered, page.metadata, page.path, rootPath, config, mode, baseUrl, buildInternalStructuredData(page, config, baseUrl)),
      writtenRoutes,
    );
  }
}

function writeSeoFiles(mode, baseUrl, finalRoutes) {
  const robots = mode === "preview"
    ? "User-agent: *\nAllow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", baseUrl)}\n`;
  fs.writeFileSync(path.join(distDir, "robots.txt"), robots, "utf8");
  if (mode !== "production") return;
  const urls = [...finalRoutes].filter((route) => route !== "404").sort()
    .map((route) => `  <url><loc>${escapeHtml(toAbsoluteUrl(baseUrl, route))}</loc></url>`).join("\n");
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "utf8");
}

function main() {
  const config = readJson(path.join(dataDir, "site-config.json"));
  const internalPages = validateInternalPages(readJson(path.join(dataDir, "internal-pages.json")));
  validateConfig(config);
  const mode = process.env.SITE_MODE || process.env.BUILD_MODE || config.defaultMode;
  if (!config.modes[mode]) fail(`SITE_MODE: неизвестный режим ${mode}`);
  validateClaimExpiry(config.claims, mode, config.site.timeZone);
  const baseUrl = process.env.SITE_URL || config.modes[mode].baseUrl;
  if (!baseUrl.endsWith("/")) fail("SITE_URL должен оканчиваться слешем");

  const staticFiles = getHtmlFiles(pagesDir);
  const staticRoutes = new Set(staticFiles.map(routeFromSource));
  const internalRoutes = new Set(internalPages.map((page) => page.path));
  for (const route of internalRoutes) if (staticRoutes.has(route)) fail(`дублируется маршрут ${route}`);
  const finalRoutes = new Set([...staticRoutes, ...internalRoutes]);

  cleanDir(distDir);
  copyDir(assetsDir, path.join(distDir, "assets"));
  const outputCssDir = path.join(distDir, "assets", "css");
  const physicalCssLayers = createCssBundles(outputCssDir);
  for (const layer of physicalCssLayers) fs.rmSync(path.join(outputCssDir, layer), { force: true });
  fs.rmSync(path.join(outputCssDir, "internal-critical.css"), { force: true });
  minifyCssFiles(outputCssDir);

  const partials = readPartials(buildHomeStructuredData(config, baseUrl));
  const writtenRoutes = new Set();
  buildStaticPages(staticFiles, partials, config, mode, baseUrl, writtenRoutes);
  buildInternalPages(internalPages, partials, config, mode, baseUrl, writtenRoutes);
  writeSeoFiles(mode, baseUrl, finalRoutes);
  console.log(`Built dist/ in ${mode} mode: ${writtenRoutes.size} HTML pages${mode === "production" ? " with sitemap" : " without sitemap"}.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
