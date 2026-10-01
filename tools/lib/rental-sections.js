const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

function loadRentalCatalog(projectRoot = root) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, "src/data/rental-catalog.json"), "utf8"));
}
function formatRate(rate) {
  return `${new Intl.NumberFormat("ru-RU").format(rate.amount)} ₽/ч`;
}
function createRentalSections({ requireArray, requireText, validateAsset, escapeHtml: esc, renderSectionHead }) {
  const select = (section, catalog) => {
    if (section.type === "equipmentCatalog") {
      const category = catalog.categories.find((item) => item.id === section.categoryId);
      if (!category) throw new Error(`Неизвестная категория аренды: ${section.categoryId}`);
      return category.equipmentIds.map((id) => {
        const item = catalog.equipment.find((entry) => entry.id === id);
        if (!item) throw new Error(`Неизвестная техника: ${id}`);
        return item;
      });
    }
    return catalog.categories.filter((item) => item.kind === section.kind);
  };
  function validateCatalog(catalog, context) {
    if (catalog.schemaVersion !== 1) throw new Error("rental-catalog: неизвестная версия");
    const ids = new Set();
    for (const item of [...catalog.categories, ...catalog.equipment]) {
      requireText(item.id, "rental.id");
      if (ids.has(item.id)) throw new Error(`rental: дублируется ${item.id}`);
      ids.add(item.id);
      requireText(item.name, `${item.id}.name`);
      requireText(item.text, `${item.id}.text`);
      if (item.image) {
        validateAsset(item.image, `${item.id}.image`, context);
        requireText(item.alt, `${item.id}.alt`);
        if (![item.imageWidth, item.imageHeight].every((value) => Number.isInteger(value) && value > 0)) throw new Error(`${item.id}: нужны размеры изображения`);
      }
      if (item.thumbnail) {
        validateAsset(item.thumbnail, `${item.id}.thumbnail`, context);
        if (![item.thumbnailWidth, item.thumbnailHeight].every((value) => Number.isInteger(value) && value > 0)) throw new Error(`${item.id}: нужны размеры превью`);
      }
      for (const spec of item.specs || []) {
        requireText(spec.label, `${item.id}.spec.label`);
        requireText(spec.value, `${item.id}.spec.value`);
      }
      for (const rate of item.rates || []) {
        requireText(rate.label, `${item.id}.rate.label`);
        if (!Number.isInteger(rate.amount) || rate.amount <= 0) throw new Error(`${item.id}: некорректный тариф`);
        if (rate.note !== undefined) requireText(rate.note, `${item.id}.rate.note`);
      }
    }
    for (const category of catalog.categories) {
      if (!["equipment", "service"].includes(category.kind)) throw new Error(`${category.id}: неверная группа`);
      if (!/^arenda\/[a-z0-9-]+$/.test(category.path)) throw new Error(`${category.id}: неверный маршрут`);
      if (!context.entityMap.has(category.entityRef)) throw new Error(`${category.id}: отсутствует entityRef`);
      for (const id of category.equipmentIds) if (!catalog.equipment.some((item) => item.id === id)) throw new Error(`${category.id}: неизвестный вариант ${id}`);
    }
    requireText(catalog.terms, "rental.terms");
  }
  const wrap = (section, content) => `<section class="internal-section internal-section--${esc(section.type)}" id="${esc(section.id)}" aria-labelledby="${esc(section.id)}-title"><div class="container">${renderSectionHead(section)}${content}</div></section>`;
  const photo = (item, rootPath, className) => item.image
    ? `<img class="${className}" src="${rootPath}${esc(item.thumbnail || item.image)}" alt="${esc(item.alt)}" width="${item.thumbnailWidth || item.imageWidth}" height="${item.thumbnailHeight || item.imageHeight}" loading="lazy" decoding="async">`
    : `<div class="${className} rental-photo--empty" aria-hidden="true"><svg><use href="#internal-icon-${esc(item.icon || "delivery")}"></use></svg></div>`;
  const terms = (catalog) => `<p class="rental-terms">${esc(catalog.terms)}</p>`;
  return {
    rentalCatalog: {
      validate(section, label, context) {
        const catalog = loadRentalCatalog(context.root);
        validateCatalog(catalog, context);
        if (!["equipment", "service"].includes(section.kind)) throw new Error(`${label}.kind: неверная группа`);
        requireArray(select(section, catalog), label, { nonEmpty: true });
      },
      render(section, { rootPath, routeByEntity }) {
        const items = select(section, loadRentalCatalog()).map((item) => {
          if (routeByEntity.get(item.entityRef) !== item.path) throw new Error(`Категория ${item.id} не опубликована`);
          return `<a class="rental-category" href="${rootPath}${esc(item.path)}/">${photo(item, rootPath, "rental-category__photo")}<div class="rental-category__copy"><h3>${esc(item.name)}</h3><p>${esc(item.text)}</p><span class="rental-category__link">Подробнее<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5"/></svg></span></div></a>`;
        }).join("\n");
        return wrap(section, `<div class="rental-categories rental-categories--${section.kind}">${items}</div>`);
      },
    },
    equipmentCatalog: {
      validate(section, label, context) {
        const catalog = loadRentalCatalog(context.root);
        validateCatalog(catalog, context);
        requireArray(select(section, catalog), label, { nonEmpty: true });
      },
      render(section, { rootPath }) {
        const catalog = loadRentalCatalog();
        const equipment = select(section, catalog);
        const items = equipment.map((item) => {
          const specs = (item.specs || []).map((spec) => `<div><dt>${esc(spec.label)}</dt><dd>${esc(spec.value)}</dd></div>`).join("");
          const rates = item.rates.length ? item.rates.map((rate) => `<div><dt>${esc(rate.label)}</dt><dd>${esc(formatRate(rate))}</dd></div>`).join("") : "<div><dt>Стоимость аренды</dt><dd>По запросу</dd></div>";
          return `<article class="rental-machine" id="machine-${esc(item.id)}" data-equipment-id="${esc(item.id)}">${photo(item, rootPath, "rental-machine__photo")}<div class="rental-machine__body"><h3>${esc(item.name)}</h3><p>${esc(item.text)}</p>${specs ? `<dl class="rental-specs">${specs}</dl>` : ""}<dl class="rental-machine__rates">${rates}</dl>${item.note ? `<p class="rental-machine__note">${esc(item.note)}</p>` : ""}</div></article>`;
        }).join("\n");
        return wrap(section, `<div class="rental-machines${equipment.length === 1 ? " rental-machines--single" : ""}">${items}</div>${terms(catalog)}<p class="rental-availability">Наличие техники на нужные даты уточните по телефону или в WhatsApp.</p>`);
      },
    },
    rentalRates: {
      validate(section, label, context) { validateCatalog(loadRentalCatalog(context.root), context); },
      render(section, { rootPath }) {
        const catalog = loadRentalCatalog();
        const rows = catalog.equipment.flatMap((item) => item.rates.map((rate) => {
          const category = catalog.categories.find((entry) => entry.equipmentIds.includes(item.id));
          const note = rate.note || item.note;
          return `<tr><th scope="row"><a href="${rootPath}${esc(category.path)}/#machine-${esc(item.id)}">${esc(item.name)}${rate.label === "Аренда" ? "" : ` ${esc(rate.label.toLocaleLowerCase("ru"))}`}</a>${note ? `<span class="rental-rate-note">${esc(note)}</span>` : ""}</th><td>${esc(formatRate(rate).replace(/\/ч$/, ""))}</td></tr>`;
        })).join("\n");
        return wrap(section, `<table class="rental-rate-table"><caption class="visually-hidden">Почасовая стоимость техники и оборудования</caption><thead><tr><th scope="col">Техника и оборудование</th><th scope="col">Цена за час</th></tr></thead><tbody>${rows}</tbody></table>`);
      },
    },
  };
}
module.exports = { createRentalSections, loadRentalCatalog, formatRate };
