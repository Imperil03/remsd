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
const assetVersion = process.env.ASSET_VERSION || "20260712-semantic-pilots";

const ENTITY_TYPES = new Set([
  "service",
  "component",
  "vehicleType",
  "brand",
  "symptom",
  "system",
  "method",
  "proof",
  "location",
]);
const PAGE_FAMILIES = new Set(["hub", "service", "brand", "legacy"]);
const SECTION_TYPES = new Set([
  "applicability",
  "serviceMap",
  "diagnosticMatrix",
  "workStages",
  "decisionCriteria",
  "relatedSystems",
  "costFactors",
  "proof",
  "preCall",
  "related",
  "contact",
]);
const PREDICATES = new Set([
  "locatedIn",
  "accepts",
  "partOf",
  "relatedTo",
  "requiresCheck",
  "verifiedBy",
  "includes",
  "appliesTo",
]);
const REQUIRED_SECTIONS = {
  hub: ["applicability", "serviceMap", "workStages", "proof", "preCall", "related", "contact"],
  service: [
    "applicability",
    "diagnosticMatrix",
    "workStages",
    "decisionCriteria",
    "relatedSystems",
    "costFactors",
    "preCall",
    "related",
    "contact",
  ],
  brand: ["proof", "serviceMap", "preCall", "workStages", "related", "contact"],
};

function fail(message) {
  throw new Error(`[build] ${message}`);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label}: ожидается объект`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label}: ожидается массив`);
  return value;
}

function requireNonEmptyArray(value, label) {
  const items = requireArray(value, label);
  if (!items.length) fail(`${label}: массив не должен быть пустым`);
  return items;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label}: обязательная строка не заполнена`);
  return value.trim();
}

function readJson(file, { required = true } = {}) {
  if (!fs.existsSync(file)) {
    if (required) fail(`не найден файл ${path.relative(root, file)}`);
    return null;
  }

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
    if (entry.isDirectory()) {
      minifyCssFiles(file);
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      const result = transformCss({
        filename: file,
        code: fs.readFileSync(file),
        minify: true,
      });
      fs.writeFileSync(file, result.code);
    }
  }
}

function createCssBundles(cssDir) {
  const bundles = {
    "home.css": ["styles.css", "styles-v3.css"],
    "semantic.css": ["styles.css", "semantic-pages.css"],
  };
  for (const [target, sources] of Object.entries(bundles)) {
    const css = sources.map((source) => fs.readFileSync(path.join(cssDir, source), "utf8")).join("\n");
    fs.writeFileSync(path.join(cssDir, target), css, "utf8");
  }
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
  const segments = route.split("/");
  if (segments.some((segment) => !/^[a-z0-9-]+$/.test(segment) || segment === "." || segment === "..")) {
    fail(`${label}: недопустимый маршрут «${value}»`);
  }
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
  const depth = dir.split(path.sep).filter(Boolean).length;
  return depth ? "../".repeat(depth) : "./";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function readPartials(homeStructuredData) {
  const partials = {};
  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".html")) continue;
    const name = path.basename(file, ".html");
    partials[name] = fs.readFileSync(path.join(partialsDir, file), "utf8");
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
  const suffix = file ? route : `${route.replace(/\/+$/, "")}/`;
  return new URL(suffix, baseUrl).toString();
}

function assetUrl(baseUrl, asset) {
  return new URL(asset.replace(/^\/+/, ""), baseUrl).toString();
}

function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function buildHomeStructuredData(config, baseUrl) {
  const site = config.site;
  const organizationId = `${baseUrl}#organization`;
  const autoRepairId = `${baseUrl}#auto-repair`;
  return jsonLdScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: site.name,
        url: baseUrl,
        logo: assetUrl(baseUrl, site.logo),
        telephone: site.phoneHref.replace("tel:", ""),
        email: site.email,
      },
      {
        "@type": ["LocalBusiness", "AutoRepair"],
        "@id": autoRepairId,
        name: site.name,
        url: baseUrl,
        image: [
          assetUrl(baseUrl, site.defaultSocialImage),
          assetUrl(baseUrl, "assets/img/gallery/large/base-entrance.webp"),
        ],
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
        parentOrganization: { "@id": organizationId },
      },
    ],
  });
}

function buildPilotStructuredData(page, config, entitiesById, baseUrl) {
  const url = toAbsoluteUrl(baseUrl, page.path);
  const entity = entitiesById.get(page.primaryEntity);
  const breadcrumbItems = page.breadcrumbs.map((crumb, index) => ({
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
        itemListElement: breadcrumbItems,
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: page.h1,
        serviceType: entity.name,
        description: page.metadata.description,
        url,
        mainEntityOfPage: url,
        provider: { "@id": `${baseUrl}#organization` },
        areaServed: {
          "@type": "City",
          name: config.site.address.locality,
        },
        availableChannel: {
          "@type": "ServiceChannel",
          servicePhone: {
            "@type": "ContactPoint",
            telephone: config.site.phoneHref.replace("tel:", ""),
            contactType: "service",
          },
        },
      },
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

function validateAsset(asset, label) {
  requireText(asset, label);
  const normalized = asset.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/")) fail(`${label}: путь должен начинаться с assets/`);
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(path.resolve(assetsDir) + path.sep) || !fs.existsSync(absolute)) {
    fail(`${label}: файл не найден (${normalized})`);
  }
}

function validateNoHtml(value, label) {
  if (typeof value === "string" && /[<>]/.test(value)) fail(`${label}: HTML в контентных JSON запрещён`);
  if (Array.isArray(value)) value.forEach((item, index) => validateNoHtml(item, `${label}[${index}]`));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) validateNoHtml(item, `${label}.${key}`);
  }
}

function makeUniqueMap(items, key, label) {
  const map = new Map();
  items.forEach((item, index) => {
    const id = requireText(item[key], `${label}[${index}].${key}`);
    if (map.has(id)) fail(`${label}: дублируется ${key} «${id}»`);
    map.set(id, item);
  });
  return map;
}

function validateConfig(config) {
  requireObject(config, "site-config.json");
  if (config.schemaVersion !== 1) fail("site-config.json: поддерживается schemaVersion 1");
  requireObject(config.modes, "site-config.modes");
  for (const mode of ["preview", "production"]) {
    const item = requireObject(config.modes[mode], `site-config.modes.${mode}`);
    const baseUrl = requireText(item.baseUrl, `site-config.modes.${mode}.baseUrl`);
    try {
      const url = new URL(baseUrl);
      if (!/^https?:$/.test(url.protocol) || !baseUrl.endsWith("/")) fail(`${mode}.baseUrl должен быть HTTP(S) URL со слешем`);
    } catch (error) {
      fail(`site-config.modes.${mode}.baseUrl: невалидный URL`);
    }
  }
  if (!config.modes[config.defaultMode]) fail("site-config.defaultMode: неизвестный режим");
  const site = requireObject(config.site, "site-config.site");
  ["name", "phone", "phoneHref", "email", "defaultSocialImage", "logo"].forEach((key) =>
    requireText(site[key], `site-config.site.${key}`),
  );
  requireObject(site.address, "site-config.site.address");
  ["street", "locality", "region", "country"].forEach((key) => requireText(site.address[key], `site.address.${key}`));
  requireObject(site.primaryCta, "site.primaryCta");
  ["label", "shortLabel", "href"].forEach((key) => requireText(site.primaryCta[key], `site.primaryCta.${key}`));
  validateAsset(site.defaultSocialImage, "site.defaultSocialImage");
  validateAsset(site.logo, "site.logo");
}

function validateGraph(entityData, relationData, config) {
  requireObject(entityData, "entities.json");
  requireObject(relationData, "relations.json");
  if (entityData.schemaVersion !== 1 || relationData.schemaVersion !== 1) fail("entities/relations: поддерживается schemaVersion 1");
  const entities = requireArray(entityData.entities, "entities.entities");
  const relations = requireArray(relationData.relations, "relations.relations");
  const entitiesById = makeUniqueMap(entities, "id", "entities");
  for (const entity of entities) {
    if (!/^[-a-z0-9]+$/.test(entity.id)) fail(`entity ${entity.id}: нестабильный id`);
    if (!ENTITY_TYPES.has(entity.type)) fail(`entity ${entity.id}: неизвестный type ${entity.type}`);
    requireText(entity.name, `entity ${entity.id}.name`);
    requireText(entity.description, `entity ${entity.id}.description`);
  }
  const relationsById = makeUniqueMap(relations, "id", "relations");
  for (const relation of relations) {
    if (!entitiesById.has(relation.subject)) fail(`relation ${relation.id}: неизвестный subject ${relation.subject}`);
    if (!entitiesById.has(relation.object)) fail(`relation ${relation.id}: неизвестный object ${relation.object}`);
    if (!PREDICATES.has(relation.predicate)) fail(`relation ${relation.id}: неизвестный predicate ${relation.predicate}`);
    requireText(relation.predicateLabel, `relation ${relation.id}.predicateLabel`);
  }
  const claims = requireArray(config.claims, "site-config.claims");
  const claimsById = makeUniqueMap(claims, "id", "claims");
  for (const claim of claims) {
    requireText(claim.text, `claim ${claim.id}.text`);
    requireText(claim.scope, `claim ${claim.id}.scope`);
    requireText(claim.source, `claim ${claim.id}.source`);
    if (claim.status !== "owner_approved") fail(`claim ${claim.id}: допускается только статус owner_approved`);
    requireArray(claim.entityRefs, `claim ${claim.id}.entityRefs`).forEach((id) => {
      if (!entitiesById.has(id)) fail(`claim ${claim.id}: неизвестная сущность ${id}`);
    });
  }
  validateNoHtml(entityData, "entities.json");
  validateNoHtml(relationData, "relations.json");
  return { entitiesById, relationsById, claimsById };
}

function validatePilotReferences(value, label, graph) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validatePilotReferences(item, `${label}[${index}]`, graph));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value)) {
    if (["primaryEntity", "entityId", "symptomEntityId"].includes(key) && !graph.entitiesById.has(item)) {
      fail(`${label}.${key}: неизвестная сущность ${item}`);
    }
    if (["entityIds", "relatedEntityIds"].includes(key)) {
      requireArray(item, `${label}.${key}`).forEach((id) => {
        if (!graph.entitiesById.has(id)) fail(`${label}.${key}: неизвестная сущность ${id}`);
      });
    }
    if (key === "relationIds") {
      requireArray(item, `${label}.relationIds`).forEach((id) => {
        if (!graph.relationsById.has(id)) fail(`${label}.relationIds: неизвестное отношение ${id}`);
      });
    }
    if (key === "claimId" && !graph.claimsById.has(item)) fail(`${label}.claimId: неизвестный claim ${item}`);
    if (["image", "largeImage", "socialImage"].includes(key)) validateAsset(item, `${label}.${key}`);
    if (key === "links") {
      requireObject(item, `${label}.links`);
      for (const entityId of Object.keys(item)) {
        if (!graph.entitiesById.has(entityId)) fail(`${label}.links: неизвестная сущность ${entityId}`);
      }
    }
    validatePilotReferences(item, `${label}.${key}`, graph);
  }
}

function validateOptionalText(value, label) {
  if (value !== undefined) requireText(value, label);
}

function validateSectionDefinition(section, label) {
  validateOptionalText(section.eyebrow, `${label}.eyebrow`);
  validateOptionalText(section.intro, `${label}.intro`);

  const validateTitleTextItems = () => {
    requireNonEmptyArray(section.items, `${label}.items`).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.title, `${label}.items[${index}].title`);
      requireText(item.text, `${label}.items[${index}].text`);
    });
  };

  if (section.type === "applicability") {
    requireNonEmptyArray(section.groups, `${label}.groups`).forEach((group, groupIndex) => {
      requireObject(group, `${label}.groups[${groupIndex}]`);
      requireText(group.title, `${label}.groups[${groupIndex}].title`);
      requireNonEmptyArray(group.items, `${label}.groups[${groupIndex}].items`).forEach((item, itemIndex) => {
        requireObject(item, `${label}.groups[${groupIndex}].items[${itemIndex}]`);
        requireText(item.entityId, `${label}.groups[${groupIndex}].items[${itemIndex}].entityId`);
        validateOptionalText(item.label, `${label}.groups[${groupIndex}].items[${itemIndex}].label`);
      });
    });
  } else if (section.type === "serviceMap") {
    requireNonEmptyArray(section.items, `${label}.items`).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.zone, `${label}.items[${index}].zone`);
      requireText(item.title, `${label}.items[${index}].title`);
      requireText(item.text, `${label}.items[${index}].text`);
    });
  } else if (section.type === "diagnosticMatrix") {
    requireNonEmptyArray(section.rows, `${label}.rows`).forEach((row, index) => {
      requireObject(row, `${label}.rows[${index}]`);
      requireText(row.symptomEntityId, `${label}.rows[${index}].symptomEntityId`);
      requireText(row.context, `${label}.rows[${index}].context`);
      requireText(row.firstCheck, `${label}.rows[${index}].firstCheck`);
      requireNonEmptyArray(row.relatedEntityIds, `${label}.rows[${index}].relatedEntityIds`);
    });
  } else if (["workStages", "decisionCriteria", "costFactors"].includes(section.type)) {
    validateTitleTextItems();
  } else if (section.type === "relatedSystems") {
    requireNonEmptyArray(section.relationIds, `${label}.relationIds`);
  } else if (section.type === "proof") {
    requireNonEmptyArray(section.items, `${label}.items`).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.entityId, `${label}.items[${index}].entityId`);
      requireText(item.image, `${label}.items[${index}].image`);
      requireText(item.alt, `${label}.items[${index}].alt`);
      validateOptionalText(item.title, `${label}.items[${index}].title`);
      validateOptionalText(item.text, `${label}.items[${index}].text`);
      validateOptionalText(item.linkLabel, `${label}.items[${index}].linkLabel`);
    });
  } else if (section.type === "preCall") {
    requireNonEmptyArray(section.items, `${label}.items`).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.label, `${label}.items[${index}].label`);
      requireText(item.text, `${label}.items[${index}].text`);
    });
  } else if (section.type === "related") {
    requireNonEmptyArray(section.items, `${label}.items`).forEach((item, index) => {
      requireObject(item, `${label}.items[${index}]`);
      requireText(item.href, `${label}.items[${index}].href`);
      requireText(item.label, `${label}.items[${index}].label`);
      requireText(item.text, `${label}.items[${index}].text`);
    });
  } else if (section.type === "contact") {
    requireText(section.intro, `${label}.intro`);
    if ((section.secondaryHref === undefined) !== (section.secondaryLabel === undefined)) {
      fail(`${label}: secondaryHref и secondaryLabel задаются вместе`);
    }
    validateOptionalText(section.secondaryLabel, `${label}.secondaryLabel`);
  }
}

function validatePilots(pilotData, graph) {
  requireObject(pilotData, "pilot-pages.json");
  if (pilotData.schemaVersion !== 1) fail("pilot-pages.json: поддерживается schemaVersion 1");
  const pages = requireArray(pilotData.pages, "pilot-pages.pages");
  const paths = new Set();
  const titles = new Set();
  const descriptions = new Set();
  const h1s = new Set();
  for (const [index, page] of pages.entries()) {
    const label = `pilot-pages.pages[${index}]`;
    page.path = normalizeRoute(page.path, `${label}.path`);
    if (paths.has(page.path)) fail(`pilot-pages: дублируется маршрут ${page.path}`);
    paths.add(page.path);
    if (!PAGE_FAMILIES.has(page.family) || page.family === "legacy") fail(`${label}.family: ожидается hub, service или brand`);
    if (!graph.entitiesById.has(page.primaryEntity)) fail(`${label}.primaryEntity: неизвестная сущность`);
    const metadata = requireObject(page.metadata, `${label}.metadata`);
    for (const [key, bucket] of [["title", titles], ["description", descriptions]]) {
      const text = requireText(metadata[key], `${label}.metadata.${key}`);
      if (bucket.has(text)) fail(`pilot-pages: неуникальный metadata.${key}`);
      bucket.add(text);
    }
    requireText(metadata.socialImage, `${label}.metadata.socialImage`);
    requireText(page.kicker, `${label}.kicker`);
    const h1 = requireText(page.h1, `${label}.h1`);
    if (h1s.has(h1)) fail("pilot-pages: H1 должны быть уникальны");
    h1s.add(h1);
    requireText(page.lead, `${label}.lead`);
    requireNonEmptyArray(page.heroFacts, `${label}.heroFacts`).forEach((fact, factIndex) => {
      requireObject(fact, `${label}.heroFacts[${factIndex}]`);
      if (![fact.text, fact.label, fact.claimId].some((value) => typeof value === "string" && value.trim())) {
        fail(`${label}.heroFacts[${factIndex}]: нужен text, label или claimId`);
      }
    });
    const breadcrumbs = requireArray(page.breadcrumbs, `${label}.breadcrumbs`);
    if (breadcrumbs.length < 2 || breadcrumbs[0].href !== "" || breadcrumbs.at(-1).href !== undefined) {
      fail(`${label}.breadcrumbs: нужны полные крошки от главной до текущей страницы`);
    }
    breadcrumbs.forEach((crumb, crumbIndex) => {
      requireObject(crumb, `${label}.breadcrumbs[${crumbIndex}]`);
      requireText(crumb.label, `${label}.breadcrumbs[${crumbIndex}].label`);
      if (crumbIndex < breadcrumbs.length - 1 && typeof crumb.href !== "string") {
        fail(`${label}.breadcrumbs[${crumbIndex}].href: обязательный маршрут не заполнен`);
      }
    });
    const sections = requireNonEmptyArray(page.sections, `${label}.sections`);
    const sectionIds = new Set();
    const sectionTypes = new Set();
    for (const section of sections) {
      requireText(section.id, `${label}.section.id`);
      if (!/^[a-z][a-z0-9-]*$/.test(section.id)) fail(`${label}: некорректный id секции ${section.id}`);
      if (sectionIds.has(section.id)) fail(`${label}: дублируется id секции ${section.id}`);
      sectionIds.add(section.id);
      if (!SECTION_TYPES.has(section.type)) fail(`${label}: неизвестный type секции ${section.type}`);
      sectionTypes.add(section.type);
      requireText(section.title, `${label}.${section.id}.title`);
      validateSectionDefinition(section, `${label}.${section.id}`);
    }
    for (const required of REQUIRED_SECTIONS[page.family]) {
      if (!sectionTypes.has(required)) fail(`${label}: для family ${page.family} нужна секция ${required}`);
    }
    validatePilotReferences(page, label, graph);
  }
  validateNoHtml(pilotData, "pilot-pages.json");
  return pages;
}

function validateLegacy(legacyPages) {
  requireArray(legacyPages, "seo-pages.json");
  const routes = new Set();
  for (const [index, page] of legacyPages.entries()) {
    page.path = normalizeRoute(page.path, `seo-pages[${index}].path`);
    if (routes.has(page.path)) fail(`seo-pages.json: дублируется маршрут ${page.path}`);
    routes.add(page.path);
    ["title", "description", "kicker", "h1", "lead", "worksTitle", "techTitle", "techText", "processTitle", "ctaTitle", "ctaText"].forEach(
      (key) => requireText(page[key], `seo-pages[${index}].${key}`),
    );
    ["works", "brands", "process", "related"].forEach((key) => requireArray(page[key], `seo-pages[${index}].${key}`));
  }
  return legacyPages;
}

function planRoutes(staticFiles, legacyPages, pilots, config) {
  const staticRoutes = new Map();
  for (const file of staticFiles) {
    const route = routeFromSource(file);
    if (staticRoutes.has(route)) fail(`src/pages: дублируется маршрут ${route || "/"}`);
    staticRoutes.set(route, file);
  }
  const legacyByRoute = new Map(legacyPages.map((page) => [page.path, page]));
  const pilotByRoute = new Map(pilots.map((page) => [page.path, page]));
  const skippedLegacy = new Set();
  const staticOverrides = new Set(requireArray(config.legacy?.staticPageOverrides || [], "site-config.legacy.staticPageOverrides").map((route) =>
    normalizeRoute(route, "staticPageOverrides"),
  ));

  for (const route of staticOverrides) {
    if (!staticRoutes.has(route) || !legacyByRoute.has(route)) fail(`staticPageOverrides ${route}: нужны и source page, и legacy page`);
    skippedLegacy.add(route);
  }
  for (const route of staticRoutes.keys()) {
    if (route && legacyByRoute.has(route) && !staticOverrides.has(route)) {
      fail(`дублируется маршрут ${route}: src/pages и seo-pages.json`);
    }
    if (pilotByRoute.has(route)) fail(`дублируется маршрут ${route}: src/pages и pilot-pages.json`);
  }
  for (const page of pilots) {
    if (legacyByRoute.has(page.path)) {
      if (page.replacesLegacy !== true) fail(`${page.path}: pilot дублирует legacy без replacesLegacy: true`);
      skippedLegacy.add(page.path);
    } else if (page.replacesLegacy === true) {
      fail(`${page.path}: replacesLegacy указан, но legacy route не найден`);
    }
  }

  const finalRoutes = new Set(staticRoutes.keys());
  for (const page of legacyPages) if (!skippedLegacy.has(page.path)) finalRoutes.add(page.path);
  for (const page of pilots) finalRoutes.add(page.path);
  return { staticRoutes, skippedLegacy, finalRoutes };
}

function validateGlobalMetadata(routePlan, legacyPages, pilots, config) {
  const titles = new Map();
  const descriptions = new Map();
  const register = (route, metadata) => {
    for (const [key, bucket] of [["title", titles], ["description", descriptions]]) {
      const value = requireText(metadata[key], `${route || "/"}.metadata.${key}`).replace(/\s+/g, " ");
      if (bucket.has(value)) {
        fail(`неуникальный metadata.${key} у маршрутов ${bucket.get(value)} и ${route || "/"}`);
      }
      bucket.set(value, route || "/");
    }
  };

  for (const [route, source] of routePlan.staticRoutes) {
    register(route, extractMetadata(fs.readFileSync(source, "utf8"), route || "/", config));
  }
  for (const page of legacyPages) {
    if (!routePlan.skippedLegacy.has(page.path)) register(page.path, page);
  }
  for (const page of pilots) register(page.path, page.metadata);
}

function validateHref(href, label, finalRoutes) {
  if (typeof href !== "string") fail(`${label}: href должен быть строкой`);
  if (href === "") {
    if (!finalRoutes.has("")) fail(`${label}: главная не найдена`);
    return;
  }
  if (href.startsWith("#")) {
    if (!/^#[a-z][a-z0-9-]*$/.test(href)) fail(`${label}: некорректный якорь ${href}`);
    return;
  }
  if (/^(?:https?:|mailto:|tel:)/.test(href)) return;
  if (/^[a-z]+:/i.test(href)) fail(`${label}: недопустимая схема ссылки`);
  const [routePart, fragment, extra] = href.split("#");
  if (extra !== undefined || /[?]/.test(routePart)) fail(`${label}: некорректная внутренняя ссылка ${href}`);
  if (fragment && !/^[a-z][a-z0-9-]*$/.test(fragment)) fail(`${label}: некорректный fragment ${fragment}`);
  const route = normalizeRoute(routePart, label, { allowEmpty: true });
  if (!finalRoutes.has(route)) fail(`${label}: ссылка ведёт на отсутствующий маршрут ${route || "/"}`);
}

function validateLinks(value, label, finalRoutes) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateLinks(item, `${label}[${index}]`, finalRoutes));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (["href", "secondaryHref", "breadcrumbHref"].includes(key)) validateHref(item, `${label}.${key}`, finalRoutes);
    else if (key === "links") {
      for (const [entityId, href] of Object.entries(item)) validateHref(href, `${label}.links.${entityId}`, finalRoutes);
    }
    validateLinks(item, `${label}.${key}`, finalRoutes);
  }
}

function renderHref(href, rootPath) {
  if (href === "") return rootPath;
  if (href.startsWith("#") || /^(?:https?:|mailto:|tel:)/.test(href)) return escapeHtml(href);
  const [routePart, fragment] = href.split("#");
  const route = normalizeRoute(routePart, "renderHref", { allowEmpty: true });
  const suffix = route ? `${route}/` : "";
  return escapeHtml(`${rootPath}${suffix}${fragment ? `#${fragment}` : ""}`);
}

function renderLegacyList(items, rootPath) {
  return items
    .map((item) => {
      if (typeof item === "string") return `          <li>${escapeHtml(item)}</li>`;
      const suffix = item.text ? ` ${escapeHtml(item.text)}` : "";
      return `          <li><a href="${renderHref(item.href, rootPath)}">${escapeHtml(item.label)}</a>${suffix}</li>`;
    })
    .join("\n");
}

function renderLegacyBrands(items) {
  return items.map((item) => `          <span>${escapeHtml(item)}</span>`).join("\n");
}

function renderLegacyRelated(items, rootPath) {
  return items.map((item) => `        <a href="${renderHref(item.href, rootPath)}">${escapeHtml(item.label)}</a>`).join("\n");
}

function renderBreadcrumbs(page, rootPath) {
  const items = page.breadcrumbs
    .map((crumb, index) => {
      const current = index === page.breadcrumbs.length - 1;
      const content = current
        ? `<span aria-current="page">${escapeHtml(crumb.label)}</span>`
        : `<a href="${renderHref(crumb.href, rootPath)}">${escapeHtml(crumb.label)}</a>`;
      return `                <li>${content}</li>`;
    })
    .join("\n");
  return `            <nav class="semantic-hero__breadcrumbs semantic-breadcrumbs" aria-label="Хлебные крошки">\n              <ol>\n${items}\n              </ol>\n            </nav>`;
}

function renderHeroFacts(page, graph) {
  return page.heroFacts
    .map((fact) => {
      const claim = fact.claimId ? graph.claimsById.get(fact.claimId) : null;
      const text = fact.label || fact.text || claim?.text;
      if (!text) fail(`${page.path}: пустой heroFact`);
      return `            <li>${escapeHtml(text)}</li>`;
    })
    .join("\n");
}

function sectionHeader(section, index) {
  const eyebrow = section.eyebrow ? `<p class="semantic-section__eyebrow">${escapeHtml(section.eyebrow)}</p>` : "";
  const intro = section.intro ? `<p class="semantic-section__intro">${escapeHtml(section.intro)}</p>` : "";
  return `        <header class="semantic-section__head">
          <span class="semantic-section__index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <div>
            ${eyebrow}
            <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
            ${intro}
          </div>
        </header>`;
}

function sectionWrapper(section, index, body) {
  if (!body.trim()) return "";
  const typeClass = section.type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `      <section class="semantic-section semantic-section--${typeClass}" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
${sectionHeader(section, index)}
${body}
      </section>`;
}

function renderApplicability(section, graph, rootPath) {
  const groups = requireArray(section.groups, `${section.id}.groups`)
    .map((group) => {
      const items = requireArray(group.items, `${section.id}.${group.title}.items`)
        .map((item) => {
          const entity = graph.entitiesById.get(item.entityId);
          const label = item.label || entity.name;
          const inner = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(entity.description)}</span>`;
          const element = item.href
            ? `<a class="semantic-applicability__item semantic-section__link" href="${renderHref(item.href, rootPath)}">${inner}</a>`
            : `<div class="semantic-applicability__item">${inner}</div>`;
          return `              <li>${element}</li>`;
        })
        .join("\n");
      return `          <section class="semantic-applicability__group semantic-card">
            <h3>${escapeHtml(group.title)}</h3>
            <ul>
${items}
            </ul>
          </section>`;
    })
    .join("\n");
  return `        <div class="semantic-applicability semantic-index semantic-section__grid">\n${groups}\n        </div>`;
}

function renderServiceMap(section, rootPath) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map((item) => {
      const link = item.href
        ? `<a class="semantic-service-map__link semantic-section__link" href="${renderHref(item.href, rootPath)}">Открыть направление</a>`
        : "";
      return `          <article class="semantic-service-map__lane semantic-section__item">
            <span class="semantic-service-map__zone">${escapeHtml(item.zone)}</span>
            <div class="semantic-service-map__body">
              <h3 class="semantic-section__item-title">${escapeHtml(item.title)}</h3>
              <p class="semantic-section__item-text">${escapeHtml(item.text)}</p>
            </div>
            ${link}
          </article>`;
    })
    .join("\n");
  return `        <div class="semantic-service-map semantic-index">\n${items}\n        </div>`;
}

function renderDiagnosticMatrix(section, graph) {
  const rows = requireArray(section.rows, `${section.id}.rows`)
    .map((row) => {
      const symptom = graph.entitiesById.get(row.symptomEntityId);
      const systems = row.relatedEntityIds
        .map((id) => `<span>${escapeHtml(graph.entitiesById.get(id).name)}</span>`)
        .join("");
      return `              <tr class="semantic-diagnostic__row">
                <th class="semantic-diagnostic__cell" scope="row" data-label="Симптом и режим"><strong>${escapeHtml(symptom.name)}</strong><span>${escapeHtml(row.context)}</span></th>
                <td class="semantic-diagnostic__cell" data-label="Связанные системы"><div class="semantic-tags">${systems}</div></td>
                <td class="semantic-diagnostic__cell" data-label="Первая проверка">${escapeHtml(row.firstCheck)}</td>
              </tr>`;
    })
    .join("\n");
  return `        <div class="semantic-table-wrap">
          <table class="semantic-diagnostic semantic-table">
            <thead class="semantic-diagnostic__head">
              <tr><th>Симптом и режим</th><th>Связанные системы</th><th>Первая проверка</th></tr>
            </thead>
            <tbody>
${rows}
            </tbody>
          </table>
        </div>`;
}

function renderWorkStages(section) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map(
      (item, index) => `          <li class="semantic-steps__item">
            <span class="semantic-steps__number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <div class="semantic-steps__body"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
          </li>`,
    )
    .join("\n");
  return `        <ol class="semantic-steps semantic-workflow">\n${items}\n        </ol>`;
}

function renderCardGrid(section) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map(
      (item) => `          <article class="semantic-section__item semantic-card">
            <h3 class="semantic-section__item-title">${escapeHtml(item.title)}</h3>
            <p class="semantic-section__item-text">${escapeHtml(item.text)}</p>
          </article>`,
    )
    .join("\n");
  return `        <div class="semantic-section__grid semantic-index">\n${items}\n        </div>`;
}

function renderRelatedSystems(section, graph, rootPath) {
  const items = section.relationIds
    .map((id) => {
      const relation = graph.relationsById.get(id);
      const subject = graph.entitiesById.get(relation.subject);
      const object = graph.entitiesById.get(relation.object);
      const href = section.links?.[relation.object];
      const title = href
        ? `<a class="semantic-section__link" href="${renderHref(href, rootPath)}">${escapeHtml(object.name)}</a>`
        : escapeHtml(object.name);
      return `          <article class="semantic-section__item semantic-card">
            <p class="semantic-section__relation"><span>${escapeHtml(subject.name)}</span> <span>${escapeHtml(relation.predicateLabel)}</span></p>
            <h3 class="semantic-section__item-title">${title}</h3>
            <p class="semantic-section__item-text">${escapeHtml(relation.description || object.description)}</p>
          </article>`;
    })
    .join("\n");
  return `        <div class="semantic-section__grid semantic-index">\n${items}\n        </div>`;
}

function renderProof(section, graph, rootPath) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map((item) => {
      const entity = graph.entitiesById.get(item.entityId);
      const title = item.title || entity.name;
      const text = item.text || entity.description;
      const image = `<img class="semantic-proof__image" src="${escapeHtml(`${rootPath}${item.image}`)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">`;
      const mediaClass = item.image.includes("/certificates/")
        ? "semantic-proof__media semantic-proof__media--document"
        : "semantic-proof__media";
      const media = item.largeImage
        ? `<a class="${mediaClass}" href="${escapeHtml(`${rootPath}${item.largeImage}`)}" aria-label="Открыть изображение: ${escapeHtml(item.alt)}">${image}</a>`
        : `<div class="${mediaClass}">${image}</div>`;
      const link = item.href
        ? `<a class="semantic-section__link" href="${renderHref(item.href, rootPath)}">${escapeHtml(item.linkLabel || "Подробнее")}</a>`
        : "";
      return `          <article class="semantic-proof__item semantic-card">
            ${media}
            <div class="semantic-proof__body">
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(text)}</p>
              ${link}
            </div>
          </article>`;
    })
    .join("\n");
  return `        <div class="semantic-proof semantic-section__grid">\n${items}\n        </div>`;
}

function renderPreCall(section) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map(
      (item) => `          <div class="semantic-pre-call__item semantic-card">
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${escapeHtml(item.text)}</dd>
          </div>`,
    )
    .join("\n");
  return `        <dl class="semantic-pre-call semantic-index">\n${items}\n        </dl>`;
}

function renderRelated(section, rootPath) {
  const items = requireArray(section.items, `${section.id}.items`)
    .map(
      (item) => `          <a class="semantic-links__item semantic-card" href="${renderHref(item.href, rootPath)}">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.text)}</span>
          </a>`,
    )
    .join("\n");
  return `        <div class="semantic-links semantic-section__grid">\n${items}\n        </div>`;
}

function renderContact(section, rootPath, config) {
  const secondary = section.secondaryHref
    ? `<a class="button button--secondary" href="${renderHref(section.secondaryHref, rootPath)}">${escapeHtml(section.secondaryLabel)}</a>`
    : "";
  return `        <div class="semantic-contact semantic-callout">
          <div>
            <p>${escapeHtml(section.intro || "")}</p>
            <p class="semantic-contact__address">${escapeHtml(config.site.address.locality)}, ${escapeHtml(config.site.address.street)}</p>
          </div>
          <div class="semantic-contact__actions">
            <a class="button button--primary" href="${escapeHtml(config.site.primaryCta.href)}">${escapeHtml(config.site.primaryCta.label)}</a>
            ${secondary}
          </div>
        </div>`;
}

function renderSection(section, index, graph, rootPath, config) {
  let body = "";
  if (section.type === "applicability") body = renderApplicability(section, graph, rootPath);
  else if (section.type === "serviceMap") body = renderServiceMap(section, rootPath);
  else if (section.type === "diagnosticMatrix") body = renderDiagnosticMatrix(section, graph);
  else if (section.type === "workStages") body = renderWorkStages(section);
  else if (["decisionCriteria", "costFactors"].includes(section.type)) body = renderCardGrid(section);
  else if (section.type === "relatedSystems") body = renderRelatedSystems(section, graph, rootPath);
  else if (section.type === "proof") body = renderProof(section, graph, rootPath);
  else if (section.type === "preCall") body = renderPreCall(section);
  else if (section.type === "related") body = renderRelated(section, rootPath);
  else if (section.type === "contact") body = renderContact(section, rootPath, config);
  return sectionWrapper(section, index, body);
}

function writeHtml(route, html, writtenRoutes) {
  if (writtenRoutes.has(route)) fail(`попытка повторно записать маршрут ${route || "/"}`);
  const normalizedHtml = html
    .replace(/[ \t]+$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "> <")
    .trim();
  assertNoPlaceholders(normalizedHtml, route || "/");
  const target = outputFileForRoute(route);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, normalizedHtml, "utf8");
  writtenRoutes.add(route);
}

function buildSourcePages(routePlan, partials, config, mode, baseUrl, writtenRoutes) {
  for (const [route, source] of routePlan.staticRoutes) {
    const target = outputFileForRoute(route);
    const rootPath = getRootPath(path.relative(distDir, target));
    const homeCss = route === ""
      ? fs.readFileSync(path.join(distDir, "assets", "css", "home-critical.css"), "utf8")
        .replaceAll("../fonts/", `${rootPath}assets/fonts/`)
        .replaceAll("../img/", `${rootPath}assets/img/`)
      : "";
    const context = {
      rootPath,
      assetVersion,
      homeStyles: homeCss ? `<style data-critical-styles>${homeCss}</style>` : "",
    };
    const rendered = render(fs.readFileSync(source, "utf8"), partials, context);
    const metadata = extractMetadata(rendered, route || "/", config);
    writeHtml(route, enrichHead(rendered, metadata, route, rootPath, config, mode, baseUrl), writtenRoutes);
  }
}

function buildLegacyPages(legacyPages, routePlan, partials, config, mode, baseUrl, writtenRoutes) {
  const template = fs.readFileSync(path.join(templatesDir, "seo-page.html"), "utf8");
  for (const page of legacyPages) {
    if (routePlan.skippedLegacy.has(page.path)) continue;
    const target = outputFileForRoute(page.path);
    const rootPath = getRootPath(path.relative(distDir, target));
    const context = {
      rootPath,
      assetVersion,
      title: escapeHtml(page.title),
      description: escapeHtml(page.description),
      breadcrumbLabel: escapeHtml(page.breadcrumbLabel || "Ремонт"),
      breadcrumbHref: renderHref(page.breadcrumbHref || "remont/", rootPath).replace(rootPath, ""),
      kicker: escapeHtml(page.kicker),
      h1: escapeHtml(page.h1),
      lead: escapeHtml(page.lead),
      worksTitle: escapeHtml(page.worksTitle),
      works: renderLegacyList(page.works, rootPath),
      techTitle: escapeHtml(page.techTitle),
      techText: escapeHtml(page.techText),
      brands: renderLegacyBrands(page.brands),
      processTitle: escapeHtml(page.processTitle),
      process: renderLegacyList(page.process, rootPath),
      ctaTitle: escapeHtml(page.ctaTitle),
      ctaText: escapeHtml(page.ctaText),
      related: renderLegacyRelated(page.related, rootPath),
    };
    const rendered = render(template, partials, context);
    const metadata = { title: page.title, description: page.description, socialImage: config.site.defaultSocialImage };
    writeHtml(page.path, enrichHead(rendered, metadata, page.path, rootPath, config, mode, baseUrl), writtenRoutes);
  }
}

function buildPilotPages(pilots, partials, config, graph, mode, baseUrl, writtenRoutes) {
  const template = fs.readFileSync(path.join(templatesDir, "semantic-page.html"), "utf8");
  for (const page of pilots) {
    const target = outputFileForRoute(page.path);
    const rootPath = getRootPath(path.relative(distDir, target));
    const localNav = page.sections
      .map((section) => `            <a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
      .join("\n");
    const sections = page.sections.map((section, index) => renderSection(section, index, graph, rootPath, config)).filter(Boolean).join("\n\n");
    const context = {
      rootPath,
      assetVersion,
      family: escapeHtml(page.family),
      title: escapeHtml(page.metadata.title),
      description: escapeHtml(page.metadata.description),
      breadcrumbs: renderBreadcrumbs(page, rootPath),
      kicker: escapeHtml(page.kicker),
      h1: escapeHtml(page.h1),
      lead: escapeHtml(page.lead),
      heroFacts: renderHeroFacts(page, graph),
      localNav,
      sections,
      phoneHref: escapeHtml(config.site.phoneHref),
      phone: escapeHtml(config.site.phone),
      primaryCtaLabel: escapeHtml(config.site.primaryCta.label),
    };
    const rendered = render(template, partials, context);
    const structuredData = buildPilotStructuredData(page, config, graph.entitiesById, baseUrl);
    writeHtml(
      page.path,
      enrichHead(rendered, page.metadata, page.path, rootPath, config, mode, baseUrl, structuredData),
      writtenRoutes,
    );
  }
}

function build404(partials, config, mode, baseUrl, writtenRoutes) {
  const source = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Страница не найдена — РемСД</title>
    <meta name="description" content="Запрошенная страница не найдена. Перейдите к направлениям ремонта или свяжитесь с мастером РемСД в Сургуте.">
    <link rel="stylesheet" href="{{rootPath}}assets/css/styles.css?v={{assetVersion}}">
  </head>
  <body>
    <a class="skip-link" href="#main-content">Перейти к содержанию</a>
    {{header}}
    <main id="main-content" tabindex="-1">
      <section class="page-hero">
        <div class="container page-hero__inner">
          <p class="eyebrow">Ошибка 404</p>
          <h1>Такой страницы нет</h1>
          <p class="page-hero__lead">Адрес мог измениться или в ссылке есть ошибка. Откройте карту ремонта либо вернитесь на главную.</p>
          <div class="page-hero__actions">
            <a class="button button--primary" href="{{rootPath}}remont/">Выбрать направление ремонта</a>
            <a class="button button--secondary" href="{{rootPath}}">На главную</a>
          </div>
        </div>
      </section>
    </main>
    {{footer}}
    {{mobile-callbar}}
    <script src="{{rootPath}}assets/js/main.js?v={{assetVersion}}"></script>
  </body>
</html>`;
  const rootPath = "./";
  const rendered = render(source, partials, { rootPath, assetVersion });
  const metadata = {
    title: "Страница не найдена — РемСД",
    description: "Запрошенная страница не найдена. Перейдите к направлениям ремонта или свяжитесь с мастером РемСД в Сургуте.",
    socialImage: config.site.defaultSocialImage,
  };
  writeHtml("404", enrichHead(rendered, metadata, "404", rootPath, config, mode, baseUrl), writtenRoutes);
}

function writeSeoFiles(mode, baseUrl, finalRoutes) {
  const robots = mode === "preview"
    ? "User-agent: *\nAllow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", baseUrl)}\n`;
  fs.writeFileSync(path.join(distDir, "robots.txt"), robots, "utf8");
  if (mode !== "production") return;
  const urls = [...finalRoutes]
    .filter((route) => route !== "404")
    .sort()
    .map((route) => `  <url><loc>${escapeXml(toAbsoluteUrl(baseUrl, route))}</loc></url>`)
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf8");
}

function main() {
  const config = readJson(path.join(dataDir, "site-config.json"));
  const entityData = readJson(path.join(dataDir, "entities.json"));
  const relationData = readJson(path.join(dataDir, "relations.json"));
  const pilotData = readJson(path.join(dataDir, "pilot-pages.json"));
  const legacyPages = validateLegacy(readJson(path.join(dataDir, "seo-pages.json")));
  validateConfig(config);
  const graph = validateGraph(entityData, relationData, config);
  const pilots = validatePilots(pilotData, graph);
  const mode = process.env.SITE_MODE || process.env.BUILD_MODE || config.defaultMode;
  if (!config.modes[mode]) fail(`SITE_MODE: неизвестный режим ${mode}`);
  const baseUrl = process.env.SITE_URL || config.modes[mode].baseUrl;
  try {
    if (!new URL(baseUrl).protocol.startsWith("http") || !baseUrl.endsWith("/")) fail("SITE_URL должен оканчиваться слешем");
  } catch (error) {
    fail("SITE_URL: невалидный URL");
  }

  const routePlan = planRoutes(getHtmlFiles(pagesDir), legacyPages, pilots, config);
  validateGlobalMetadata(routePlan, legacyPages, pilots, config);
  validateLinks(legacyPages, "seo-pages", routePlan.finalRoutes);
  validateLinks(pilots, "pilot-pages", routePlan.finalRoutes);

  cleanDir(distDir);
  copyDir(assetsDir, path.join(distDir, "assets"));
  const outputCssDir = path.join(distDir, "assets", "css");
  createCssBundles(outputCssDir);
  minifyCssFiles(outputCssDir);
  const homeStructuredData = buildHomeStructuredData(config, baseUrl);
  const partials = readPartials(homeStructuredData);
  const writtenRoutes = new Set();
  buildSourcePages(routePlan, partials, config, mode, baseUrl, writtenRoutes);
  buildLegacyPages(legacyPages, routePlan, partials, config, mode, baseUrl, writtenRoutes);
  buildPilotPages(pilots, partials, config, graph, mode, baseUrl, writtenRoutes);
  if (!routePlan.staticRoutes.has("404")) {
    routePlan.finalRoutes.add("404");
    build404(partials, config, mode, baseUrl, writtenRoutes);
  }
  writeSeoFiles(mode, baseUrl, routePlan.finalRoutes);

  console.log(`Built dist/ in ${mode} mode: ${writtenRoutes.size} HTML pages${mode === "production" ? " with sitemap" : " without sitemap"}.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
