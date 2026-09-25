const fs = require("node:fs");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "../..");

function validateDocumentCatalog(catalog, root = projectRoot) {
  const fail = (message) => { throw new Error(`[documents] ${message}`); };
  const text = (value, label) => {
    if (typeof value !== "string" || !value.trim() || /[<>]/.test(value)) fail(`${label}: нужна строка без HTML`);
  };
  const id = (value, label) => { if (typeof value !== "string" || !/^[a-z][a-z0-9-]*$/.test(value)) fail(`${label}: неверный ID`); };
  const list = (value, label) => { if (!Array.isArray(value) || !value.length) fail(`${label}: нужен непустой массив`); };
  const date = (value, label) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${label}: неверная дата`);
  };
  const media = (item, label) => {
    if (!item || typeof item !== "object") fail(`${label}: нужен объект`);
    text(item.image, `${label}.image`);
    const absolute = path.resolve(root, item.image);
    if (!absolute.startsWith(path.join(root, "assets") + path.sep) || !fs.existsSync(absolute)) fail(`${label}.image: файл не найден`);
    text(item.imageAlt, `${label}.imageAlt`);
    text(item.caption, `${label}.caption`);
    for (const key of ["imageWidth", "imageHeight"]) if (!Number.isInteger(item[key]) || item[key] <= 0) fail(`${label}.${key}: нужен размер изображения`);
  };
  if (!catalog || catalog.schemaVersion !== 1) fail("неизвестная схема каталога");
  list(catalog.groups, "groups");
  const groups = new Set();
  for (const group of catalog.groups) {
    id(group.id, "group.id"); text(group.title, "group.title");
    if (groups.has(group.id)) fail(`дублируется группа ${group.id}`);
    groups.add(group.id);
  }
  list(catalog.documents, "documents");
  const ids = new Set();
  for (const doc of catalog.documents) {
    id(doc.id, "document.id");
    if (ids.has(doc.id)) fail(`дублируется документ ${doc.id}`);
    ids.add(doc.id);
    if (!groups.has(doc.group)) fail(`неизвестная группа ${doc.group}`);
    media(doc, doc.id); text(doc.text, `${doc.id}.text`);
    list(doc.pages, `${doc.id}.pages`);
    doc.pages.forEach((page, index) => media(page, `${doc.id}.pages[${index}]`));
    if (doc.issuedAt !== undefined) date(doc.issuedAt, `${doc.id}.issuedAt`);
    if (doc.validThrough !== undefined) date(doc.validThrough, `${doc.id}.validThrough`);
    if (doc.issuedAt && doc.validThrough && doc.validThrough < doc.issuedAt) fail(`${doc.id}: срок раньше даты выдачи`);
    if (!doc.validThrough && !doc.issuedAt) fail(`${doc.id}: нет даты выдачи или срока`);
    if (doc.validityYears !== undefined && (!Number.isInteger(doc.validityYears) || doc.validityYears < 1 || !doc.issuedAt || doc.validThrough)) fail(`${doc.id}: неверный срок в годах`);
  }
  list(catalog.homePreviewIds, "homePreviewIds");
  resolveDocuments(catalog.homePreviewIds, catalog);
  return catalog;
}

function loadDocumentCatalog(root = projectRoot) {
  return validateDocumentCatalog(JSON.parse(fs.readFileSync(path.join(root, "src/data/documents.json"), "utf8")), root);
}

function resolveDocuments(ids, catalog = loadDocumentCatalog()) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error("[documents] нужны уникальные ID документов");
  return ids.map((id) => {
    const doc = catalog.documents.find((item) => item.id === id);
    if (!doc) throw new Error(`[documents] неизвестный документ ${id}`);
    return doc;
  });
}

function documentDate(doc) {
  const format = (date) => date.split("-").reverse().join(".");
  if (doc.validThrough) return `Срок действия: до ${format(doc.validThrough)}`;
  if (doc.validityYears) {
    const years = { one: "год", few: "года", many: "лет", other: "лет" }[new Intl.PluralRules("ru").select(doc.validityYears)];
    return `Срок: ${doc.validityYears} ${years} с ${format(doc.issuedAt)}`;
  }
  return `Дата выдачи: ${format(doc.issuedAt)}`;
}

function renderHomeDocumentPreviews(catalog, rootPath, esc) {
  return resolveDocuments(catalog.homePreviewIds, catalog).map((doc) =>
    `<a class="v3-cert-card" href="${rootPath}sertifikaty/#document-${esc(doc.id)}"><span class="v3-cert-card__preview"><img src="${rootPath}${esc(doc.image)}" alt="${esc(doc.imageAlt)}" width="${doc.imageWidth}" height="${doc.imageHeight}" loading="lazy" decoding="async"></span><span class="v3-cert-card__copy"><strong>${esc(doc.caption)}</strong><span class="v3-cert-card__description">${esc(doc.text)}</span><span class="v3-cert-card__date">${esc(documentDate(doc))}</span><span class="v3-cert-card__action">Подробнее о документе</span></span></a>`
  ).join("\n");
}

function renderDocumentCard(item, { rootPath, esc, sectionId = "documents", preview = false }) {
  const href = preview ? `${rootPath}sertifikaty/#document-${item.id}` : rootPath + item.pages[0].image;
  const viewer = preview ? "" : ` data-company-media="${esc(sectionId)}-${esc(item.id)}" data-media-index="0" aria-label="Открыть: ${esc(item.caption)}"`;
  const action = preview ? "Подробнее о документе" : item.pages.length > 1 ? `Смотреть ${item.pages.length} листов` : "Открыть документ";
  return `<a class="company-document" id="document-${esc(item.id)}" href="${esc(href)}"${viewer}><div class="company-document__preview"><img src="${rootPath}${esc(item.image)}" alt="${esc(item.imageAlt)}" width="${item.imageWidth}" height="${item.imageHeight}" loading="lazy" decoding="async"></div><div class="company-document__copy"><h3>${esc(item.caption)}</h3><p>${esc(item.text)}</p><p class="company-document__date">${esc(documentDate(item))}</p><span class="company-document__action">${action}</span></div></a>`;
}

function renderDocumentGroups(section, { rootPath, esc }) {
  const catalog = loadDocumentCatalog();
  const selected = resolveDocuments(section.documentIds, catalog);
  return catalog.groups.map((group) => {
    const docs = selected.filter((item) => item.group === group.id);
    if (!docs.length) return "";
    const cards = docs.map((item) => renderDocumentCard(item, { rootPath, esc, sectionId: section.id })).join("");
    return `<div class="company-documents__group" aria-labelledby="${esc(section.id)}-${esc(group.id)}-title"><h2 id="${esc(section.id)}-${esc(group.id)}-title">${esc(group.title)}</h2><div class="company-documents__grid${docs.length === 1 ? " company-documents__grid--single" : ""}">${cards}</div></div>`;
  }).join("");
}

function createDocumentSections({ escapeHtml: esc }) {
  return {
    documentCatalog: {
      validate(section, label, context) { resolveDocuments(section.documentIds, loadDocumentCatalog(context.root)); },
      render(section, { rootPath }) {
        return `<section class="certificates-catalog" id="${esc(section.id)}" aria-label="${esc(section.title)}"><div class="container company-documents__groups">${renderDocumentGroups(section, { rootPath, esc })}</div></section>`;
      },
    },
  };
}

function renderDocumentMediaData(page, rootPath) {
  const groups = {};
  for (const section of page.sections.filter((item) => item.type === "documentCatalog")) {
    for (const item of resolveDocuments(section.documentIds)) groups[`${section.id}-${item.id}`] = item.pages.map((p) => ({ src: rootPath + p.image, alt: p.imageAlt, caption: p.caption, width: p.imageWidth, height: p.imageHeight }));
  }
  return `<script type="application/json" id="company-media-data">${JSON.stringify(groups).replaceAll("<", "\\u003c")}</script>`;
}

module.exports = { loadDocumentCatalog, validateDocumentCatalog, resolveDocuments, documentDate, renderHomeDocumentPreviews, renderDocumentCard, createDocumentSections, renderDocumentMediaData };
