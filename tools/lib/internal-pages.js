const fs = require("fs");
const path = require("path");

const PAGE_FAMILIES = new Set(["hub", "service", "brand"]);
const ENTITY_TYPE_BY_FAMILY = { hub: "service", service: "service", brand: "brand" };

function fail(message) {
  throw new Error(`[internal-pages] ${message}`);
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

function readJson(file, label = file) {
  if (!fs.existsSync(file)) fail(`${label}: файл не найден`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${label}: невалидный JSON (${error.message})`);
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validateNoHtml(value, label) {
  if (typeof value === "string" && /[<>]/.test(value)) fail(`${label}: HTML в контентных JSON запрещён`);
  if (Array.isArray(value)) value.forEach((item, index) => validateNoHtml(item, `${label}[${index}]`));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => validateNoHtml(item, `${label}.${key}`));
  }
}

function validateAsset(asset, label, { root, assetsDir }) {
  const normalized = requireText(asset, label).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("assets/")) fail(`${label}: путь должен начинаться с assets/`);
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(path.resolve(assetsDir) + path.sep) || !fs.existsSync(absolute)) {
    fail(`${label}: файл не найден (${normalized})`);
  }
}

function validateCta(cta, label) {
  requireObject(cta, label);
  requireText(cta.title, `${label}.title`);
  requireText(cta.text, `${label}.text`);
  requireText(cta.buttonLabel, `${label}.buttonLabel`);
}

function renderSectionHead(section, { centered = false } = {}) {
  const intro = section.intro ? `<p>${escapeHtml(section.intro)}</p>` : "";
  return `        <header class="internal-section__head${centered ? " internal-section__head--center" : ""}">
          <h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2>
          ${intro}
        </header>`;
}

function renderInlineCta({ id, modifier, cta }, site) {
  return `<aside class="internal-inline-cta internal-inline-cta--${escapeHtml(modifier)}" aria-labelledby="${escapeHtml(id)}">
  <div class="internal-inline-cta__content">
    <h3 id="${escapeHtml(id)}">${escapeHtml(cta.title)}</h3>
    <p>${escapeHtml(cta.text)}</p>
    <a class="v3-button v3-button--primary" href="${escapeHtml(site.phoneHref)}">${escapeHtml(cta.buttonLabel)}</a>
  </div>
</aside>`;
}

const SECTION_REGISTRY = {
  introProof: {
    validate(section, label, context) {
      requireArray(section.bullets, `${label}.bullets`, { nonEmpty: true }).forEach((item, index) => requireText(item, `${label}.bullets[${index}]`));
      requireText(section.statement, `${label}.statement`);
      validateAsset(section.image, `${label}.image`, context);
      requireText(section.imageAlt, `${label}.imageAlt`);
      requireArray(section.stats, `${label}.stats`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.stats[${index}]`);
        requireText(item.value, `${label}.stats[${index}].value`);
        requireText(item.label, `${label}.stats[${index}].label`);
      });
    },
    render(section, { rootPath }) {
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
    },
  },
  serviceGrid: {
    validate(section, label) {
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.title, `${label}.items[${index}].title`);
        requireText(item.text, `${label}.items[${index}].text`);
        requireText(item.icon, `${label}.items[${index}].icon`);
      });
      if (section.link !== undefined) {
        requireObject(section.link, `${label}.link`);
        requireText(section.link.label, `${label}.link.label`);
        requireText(section.link.targetSectionId, `${label}.link.targetSectionId`);
      }
    },
    render(section) {
      const items = section.items.map((item) => `<article class="internal-service-card">
  <svg class="internal-service-card__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg>
  <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
</article>`).join("\n");
      const link = section.link
        ? `<a class="internal-reference-link" href="#${escapeHtml(section.link.targetSectionId)}">${escapeHtml(section.link.label)}</a>`
        : "";
      return `<section class="internal-section internal-section--serviceGrid" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section, { centered: true })}<div class="internal-service-grid">${items}</div>${link}</div>
</section>`;
    },
  },
  popularWorks: {
    validate(section, label) {
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.title, `${label}.items[${index}].title`);
        requireText(item.icon, `${label}.items[${index}].icon`);
        if (item.href !== undefined) normalizeRoute(item.href, `${label}.items[${index}].href`);
      });
    },
    render(section, { rootPath }) {
      const items = section.items.map((item) => {
        const content = `<svg class="internal-popular-work__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg><span>${escapeHtml(item.title)}</span>`;
        return item.href
          ? `<li class="internal-popular-work internal-popular-work--linked"><a href="${rootPath}${escapeHtml(item.href)}/">${content}</a></li>`
          : `<li class="internal-popular-work">${content}</li>`;
      }).join("");
      return `<section class="internal-section internal-section--popularWorks" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<ul class="internal-popular-works" aria-label="${escapeHtml(section.ariaLabel || section.title)}">${items}</ul></div>
</section>`;
    },
  },
  vehicleTypes: {
    validate(section, label, context) {
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.title, `${label}.items[${index}].title`);
        requireText(item.text, `${label}.items[${index}].text`);
        validateAsset(item.image, `${label}.items[${index}].image`, context);
        requireText(item.alt, `${label}.items[${index}].alt`);
      });
    },
    render(section, { rootPath }) {
      const items = section.items.map((item) => `<article class="internal-vehicle-card">
  <img src="${rootPath}${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">
  <div class="internal-vehicle-card__copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
</article>`).join("\n");
      return `<section class="internal-section internal-section--vehicleTypes" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section, { centered: true })}<div class="internal-vehicle-mosaic">${items}</div></div>
</section>`;
    },
  },
  brandShowcase: {
    validate(section, label, context) {
      requireArray(section.official, `${label}.official`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.official[${index}]`);
        requireText(item.name, `${label}.official[${index}].name`);
        validateAsset(item.image, `${label}.official[${index}].image`, context);
      });
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => requireText(item, `${label}.items[${index}]`));
    },
    render(section, { rootPath }) {
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
    },
  },
  editorialContent: {
    validate(section, label) {
      requireText(section.lead, `${label}.lead`);
      requireArray(section.blocks, `${label}.blocks`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.blocks[${index}]`);
        requireText(item.title, `${label}.blocks[${index}].title`);
        requireText(item.text, `${label}.blocks[${index}].text`);
      });
    },
    render(section) {
      const blocks = section.blocks.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join("");
      return `<section class="internal-section internal-section--editorialContent" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container internal-editorial"><header><h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.lead)}</p></header><div class="internal-editorial__body">${blocks}</div></div>
</section>`;
    },
  },
  symptoms: {
    validate(section, label) {
      validateCta(section.cta, `${label}.cta`);
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.icon, `${label}.items[${index}].icon`);
        requireText(item.text, `${label}.items[${index}].text`);
      });
    },
    render(section, { site }) {
      const items = section.items.map((item) => `<li><svg class="internal-symptom__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg><span>${escapeHtml(item.text)}</span></li>`).join("");
      const cta = renderInlineCta({ id: `${section.id}-cta-title`, modifier: "symptoms", cta: section.cta }, site);
      return `<section class="internal-section internal-section--symptoms" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<div class="internal-symptoms-layout"><ul class="internal-symptoms">${items}</ul>${cta}</div></div>
</section>`;
    },
  },
  workStages: {
    validate(section, label) {
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.title, `${label}.items[${index}].title`);
        requireText(item.text, `${label}.items[${index}].text`);
        requireText(item.icon, `${label}.items[${index}].icon`);
      });
    },
    render(section) {
      const items = section.items.map((item, index) => `<li class="internal-timeline__item">
  <svg class="internal-timeline__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg>
  <span class="internal-timeline__number">${String(index + 1).padStart(2, "0")}</span>
  <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p>
</li>`).join("");
      return `<section class="internal-section internal-section--workStages" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<ol class="internal-timeline">${items}</ol></div>
</section>`;
    },
  },
  priceExamples: {
    validate(section, label) {
      validateCta(section.cta, `${label}.cta`);
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.service, `${label}.items[${index}].service`);
        requireText(item.price, `${label}.items[${index}].price`);
      });
      requireText(section.note, `${label}.note`);
    },
    render(section, { site }) {
      const renderTable = (items) => {
        const rows = items.map((item) => `<tr><th scope="row">${escapeHtml(item.service)}</th><td>${escapeHtml(item.price)}</td></tr>`).join("");
        return `<table class="internal-price-table"><thead class="visually-hidden"><tr><th>Услуга</th><th>Цена от</th></tr></thead><tbody>${rows}</tbody></table>`;
      };
      const midpoint = Math.ceil(section.items.length / 2);
      const cta = renderInlineCta({ id: `${section.id}-cta-title`, modifier: "prices", cta: section.cta }, site);
      return `<section class="internal-section internal-section--priceExamples" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}
    <div class="internal-price-content"><div class="internal-price-main">
      <div class="internal-price-layout">${renderTable(section.items.slice(0, midpoint))}${renderTable(section.items.slice(midpoint))}</div>
      <p class="internal-price-note">${escapeHtml(section.note)}</p>
    </div>${cta}</div>
  </div>
</section>`;
    },
  },
  relatedIndex: {
    validate(section, label) {
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.title, `${label}.items[${index}].title`);
        requireText(item.text, `${label}.items[${index}].text`);
        requireText(item.icon, `${label}.items[${index}].icon`);
        if (item.href !== undefined) normalizeRoute(item.href, `${label}.items[${index}].href`);
      });
    },
    render(section, { rootPath }) {
      const items = section.items.map((item) => {
        const content = `<svg class="internal-related-card__icon" aria-hidden="true"><use href="#internal-icon-${escapeHtml(item.icon)}"></use></svg>
  <div class="internal-related-card__copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>
  <span class="internal-related-card__arrow" aria-hidden="true"></span>`;
        if (item.href === undefined) return `<article class="internal-related-card">${content}</article>`;
        return `<a class="internal-related-card internal-related-card--link" href="${rootPath}${escapeHtml(item.href)}/">${content}</a>`;
      }).join("");
      return `<section class="internal-section internal-section--relatedIndex" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container">${renderSectionHead(section)}<div class="internal-related-index" aria-label="${escapeHtml(section.ariaLabel || section.title)}">${items}</div></div>
</section>`;
    },
  },
  faq: {
    validate(section, label) {
      requireObject(section.contact, `${label}.contact`);
      requireText(section.contact.title, `${label}.contact.title`);
      requireText(section.contact.text, `${label}.contact.text`);
      requireText(section.contact.linkLabel, `${label}.contact.linkLabel`);
      requireArray(section.items, `${label}.items`, { nonEmpty: true }).forEach((item, index) => {
        requireObject(item, `${label}.items[${index}]`);
        requireText(item.question, `${label}.items[${index}].question`);
        requireText(item.answer, `${label}.items[${index}].answer`);
      });
    },
    render(section, { site }) {
      const items = section.items.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("");
      return `<section class="internal-section internal-section--faq" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title">
  <div class="container internal-faq-layout"><div class="internal-faq__intro">${renderSectionHead(section)}
    <aside class="internal-faq__contact" aria-labelledby="${escapeHtml(section.id)}-contact-title">
      <h3 id="${escapeHtml(section.id)}-contact-title">${escapeHtml(section.contact.title)}</h3>
      <p>${escapeHtml(section.contact.text)}</p>
      <a class="internal-faq__contact-link" href="${escapeHtml(site.phoneHref)}">${escapeHtml(section.contact.linkLabel)}</a>
    </aside>
  </div><div class="internal-faq">${items}</div></div>
</section>`;
    },
  },
};

function loadContentModel(dataDir) {
  const entitiesData = readJson(path.join(dataDir, "entities.json"), "entities.json");
  const relationsData = readJson(path.join(dataDir, "relations.json"), "relations.json");
  if (entitiesData.schemaVersion !== 1) fail("entities.json: поддерживается schemaVersion 1");
  if (relationsData.schemaVersion !== 1) fail("relations.json: поддерживается schemaVersion 1");
  const entities = requireArray(entitiesData.entities, "entities.json.entities", { nonEmpty: true });
  const entityMap = new Map();
  entities.forEach((entity, index) => {
    const label = `entities.json.entities[${index}]`;
    requireObject(entity, label);
    const id = requireText(entity.id, `${label}.id`);
    if (entityMap.has(id)) fail(`${label}.id: дублируется ${id}`);
    requireText(entity.type, `${label}.type`);
    requireText(entity.name, `${label}.name`);
    requireText(entity.description, `${label}.description`);
    entityMap.set(id, entity);
  });
  const relationIds = new Set();
  requireArray(relationsData.relations, "relations.json.relations").forEach((relation, index) => {
    const label = `relations.json.relations[${index}]`;
    requireObject(relation, label);
    const id = requireText(relation.id, `${label}.id`);
    if (relationIds.has(id)) fail(`${label}.id: дублируется ${id}`);
    relationIds.add(id);
    const subject = requireText(relation.subject, `${label}.subject`);
    const object = requireText(relation.object, `${label}.object`);
    requireText(relation.predicate, `${label}.predicate`);
    requireText(relation.predicateLabel, `${label}.predicateLabel`);
    if (!entityMap.has(subject)) fail(`${label}.subject: неизвестная сущность ${subject}`);
    if (!entityMap.has(object)) fail(`${label}.object: неизвестная сущность ${object}`);
  });
  validateNoHtml(entitiesData, "entities.json");
  validateNoHtml(relationsData, "relations.json");
  return { entities, entityMap, relations: relationsData.relations };
}

function validatePageDefinition(page, label, context) {
  requireObject(page, label);
  page.path = normalizeRoute(page.path, `${label}.path`);
  if (!PAGE_FAMILIES.has(page.family)) fail(`${label}.family: ожидается hub, service или brand`);
  const entityRef = requireText(page.entityRef, `${label}.entityRef`);
  const entity = context.entityMap.get(entityRef);
  if (!entity) fail(`${label}.entityRef: неизвестная сущность ${entityRef}`);
  if (entity.type !== ENTITY_TYPE_BY_FAMILY[page.family]) {
    fail(`${label}.entityRef: семейство ${page.family} ожидает сущность типа ${ENTITY_TYPE_BY_FAMILY[page.family]}, найдено ${entity.type}`);
  }
  const metadata = requireObject(page.metadata, `${label}.metadata`);
  ["title", "description", "serviceType"].forEach((key) => requireText(metadata[key], `${label}.metadata.${key}`));
  validateAsset(metadata.socialImage, `${label}.metadata.socialImage`, context);
  requireArray(page.breadcrumbs, `${label}.breadcrumbs`, { nonEmpty: true }).forEach((crumb, index) => {
    requireObject(crumb, `${label}.breadcrumbs[${index}]`);
    requireText(crumb.label, `${label}.breadcrumbs[${index}].label`);
    if (crumb.href !== undefined) normalizeRoute(crumb.href, `${label}.breadcrumbs[${index}].href`, { allowEmpty: true });
  });
  const hero = requireObject(page.hero, `${label}.hero`);
  ["h1", "lead", "ctaLabel"].forEach((key) => requireText(hero[key], `${label}.hero.${key}`));
  if (hero.accent !== undefined) requireText(hero.accent, `${label}.hero.accent`);
  validateAsset(hero.image, `${label}.hero.image`, context);
  validateAsset(hero.mobileImage, `${label}.hero.mobileImage`, context);
  requireArray(hero.facts, `${label}.hero.facts`, { nonEmpty: true }).forEach((fact, index) => {
    requireObject(fact, `${label}.hero.facts[${index}]`);
    requireText(fact.icon, `${label}.hero.facts[${index}].icon`);
    requireText(fact.label, `${label}.hero.facts[${index}].label`);
    requireText(fact.value, `${label}.hero.facts[${index}].value`);
  });
  const sectionIds = new Set();
  requireArray(page.sections, `${label}.sections`, { nonEmpty: true }).forEach((section, index) => {
    const sectionLabel = `${label}.sections[${index}]`;
    requireObject(section, sectionLabel);
    const id = requireText(section.id, `${sectionLabel}.id`);
    if (sectionIds.has(id)) fail(`${label}.sections: дублируется id ${id}`);
    sectionIds.add(id);
    const type = requireText(section.type, `${sectionLabel}.type`);
    const registry = SECTION_REGISTRY[type];
    if (!registry) fail(`${sectionLabel}.type: неизвестный тип ${type}`);
    requireText(section.title, `${sectionLabel}.title`);
    if (section.intro !== undefined) requireText(section.intro, `${sectionLabel}.intro`);
    if (section.ariaLabel !== undefined) requireText(section.ariaLabel, `${sectionLabel}.ariaLabel`);
    registry.validate(section, sectionLabel, context);
  });
  page.sections.forEach((section, index) => {
    if (section.type === "serviceGrid" && section.link && !sectionIds.has(section.link.targetSectionId)) {
      fail(`${label}.sections[${index}].link.targetSectionId: секция ${section.link.targetSectionId} не найдена`);
    }
  });
  validateCta(page.closingCta, `${label}.closingCta`);
  validateNoHtml(page, label);
  return page;
}

function loadInternalPageCatalog({ root, dataDir, assetsDir, siteConfig }) {
  const catalogDir = path.join(dataDir, "internal-pages");
  const manifest = readJson(path.join(catalogDir, "index.json"), "internal-pages/index.json");
  requireObject(manifest, "internal-pages/index.json");
  if (manifest.schemaVersion !== 3) fail("internal-pages/index.json: поддерживается schemaVersion 3");
  const contentModel = loadContentModel(dataDir);
  for (const [index, claim] of (siteConfig?.claims || []).entries()) {
    const entityRefs = claim.entityRefs === undefined
      ? []
      : requireArray(claim.entityRefs, `site-config.json.claims[${index}].entityRefs`);
    for (const [entityIndex, entityRefValue] of entityRefs.entries()) {
      const entityRef = requireText(entityRefValue, `site-config.json.claims[${index}].entityRefs[${entityIndex}]`);
      if (!contentModel.entityMap.has(entityRef)) fail(`site-config.json.claims[${index}].entityRefs: неизвестная сущность ${entityRef}`);
    }
  }
  const files = requireArray(manifest.pages, "internal-pages/index.json.pages", { nonEmpty: true });
  const seenFiles = new Set();
  const context = { root, assetsDir, entityMap: contentModel.entityMap };
  const pages = files.map((file, index) => {
    const label = `internal-pages/index.json.pages[${index}]`;
    const name = requireText(file, label);
    if (!/^[a-z0-9-]+\.json$/.test(name) || name === "index.json") fail(`${label}: недопустимое имя файла ${name}`);
    if (seenFiles.has(name)) fail(`${label}: файл дублируется ${name}`);
    seenFiles.add(name);
    return validatePageDefinition(readJson(path.join(catalogDir, name), `internal-pages/${name}`), `internal-pages/${name}`, context);
  });
  const paths = new Set();
  const titles = new Set();
  pages.forEach((page) => {
    if (paths.has(page.path)) fail(`internal-pages: маршрут дублируется ${page.path}`);
    paths.add(page.path);
    if (titles.has(page.metadata.title)) fail(`internal-pages: title дублируется ${page.metadata.title}`);
    titles.add(page.metadata.title);
  });
  const references = requireObject(manifest.referenceByFamily, "internal-pages/index.json.referenceByFamily");
  for (const [family, routeValue] of Object.entries(references)) {
    if (!PAGE_FAMILIES.has(family)) fail(`internal-pages/index.json.referenceByFamily: неизвестное семейство ${family}`);
    const route = normalizeRoute(routeValue, `internal-pages/index.json.referenceByFamily.${family}`);
    const page = pages.find((item) => item.path === route);
    if (!page) fail(`internal-pages/index.json.referenceByFamily.${family}: маршрут ${route} не найден`);
    if (page.family !== family) fail(`internal-pages/index.json.referenceByFamily.${family}: маршрут относится к ${page.family}`);
    references[family] = route;
  }
  return { manifest, pages, contentModel };
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

function renderSection(section, rootPath, site) {
  return SECTION_REGISTRY[section.type].render(section, { rootPath, site });
}

module.exports = {
  PAGE_FAMILIES,
  SECTION_TYPES: new Set(Object.keys(SECTION_REGISTRY)),
  escapeHtml,
  loadContentModel,
  loadInternalPageCatalog,
  normalizeRoute,
  renderBreadcrumbs,
  renderHeroFacts,
  renderHeroTitle,
  renderSection,
  validatePageDefinition,
};
