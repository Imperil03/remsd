const { loadDocumentCatalog, resolveDocuments, documentDate } = require("./documents");

function createCompanySections({ requireObject, requireArray, requireText, validateAsset, escapeHtml: esc, normalizeRoute }) {
  const textList = (items, label) => requireArray(items, label, { nonEmpty: true }).forEach((item, i) => requireText(item, `${label}[${i}]`));
  function media(item, label, context) {
    requireObject(item, label);
    validateAsset(item.image, `${label}.image`, context);
    if (item.largeImage) validateAsset(item.largeImage, `${label}.largeImage`, context);
    requireText(item.imageAlt, `${label}.imageAlt`);
    requireText(item.caption, `${label}.caption`);
    for (const key of ["imageWidth", "imageHeight"]) {
      if (!Number.isInteger(item[key]) || item[key] < 1) throw new Error(`${label}.${key}: нужен размер изображения`);
    }
  }
  function pairs(items, label) {
    requireArray(items, label, { nonEmpty: true }).forEach((item, i) => {
      requireObject(item, `${label}[${i}]`);
      requireText(item.title, `${label}[${i}].title`);
      requireText(item.text, `${label}[${i}].text`);
    });
  }
  const head = (s) => `<header class="company-section__head"><h2 id="${esc(s.id)}-title">${esc(s.title)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ""}</header>`;
  const section = (s, cls, content) => `<section class="company-section ${cls}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"><div class="container">${content}</div></section>`;
  const photo = (item, rootPath, group, index = 0) => `<figure class="company-photo"><a href="${rootPath}${esc(item.largeImage || item.image)}" data-company-media="${esc(group)}" data-media-index="${index}" aria-label="Увеличить: ${esc(item.caption)}"><img src="${rootPath}${esc(item.image)}" alt="${esc(item.imageAlt)}" width="${item.imageWidth}" height="${item.imageHeight}" loading="lazy" decoding="async"><span class="company-photo__zoom" aria-hidden="true">Увеличить</span></a><figcaption>${esc(item.caption)}</figcaption></figure>`;
  return {
    companyFacts: {
      validate(s, label) {
        requireArray(s.items, `${label}.items`, { nonEmpty: true }).forEach((item, i) => {
          requireText(item.value, `${label}.items[${i}].value`);
          requireText(item.label, `${label}.items[${i}].label`);
        });
      },
      render(s) {
        return section(s, "company-facts", `<h2 class="company-visually-hidden" id="${esc(s.id)}-title">${esc(s.title)}</h2><dl>${s.items.map((i) => `<div><dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd></div>`).join("")}</dl>`);
      },
    },
    companyStory: {
      validate(s, label) { pairs(s.items, `${label}.items`); },
      render(s) {
        return section(s, "company-story", `${head(s)}<ol class="company-story__stages">${s.items.map((i, index) => `<li><span class="company-story__number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></li>`).join("")}</ol>`);
      },
    },
    companyBase: {
      validate(s, label, context) {
        textList(s.capabilities, `${label}.capabilities`);
        requireArray(s.photos, `${label}.photos`, { nonEmpty: true }).forEach((item, i) => media(item, `${label}.photos[${i}]`, context));
      },
      render(s, { rootPath }) {
        return section(s, "company-base", `<div class="company-base__heading">${head(s)}<ul class="company-base__capabilities">${s.capabilities.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="company-base__photos">${s.photos.map((item, i) => photo(item, rootPath, s.id, i)).join("")}</div>`);
      },
    },
    companyTeam: {
      validate(s, label, context) { media(s.photo, `${label}.photo`, context); pairs(s.items, `${label}.items`); },
      render(s, { rootPath }) {
        return section(s, "company-team", `<div class="company-team__layout"><div class="company-team__copy">${head(s)}<dl class="company-team__roles">${s.items.map((i) => `<div><dt>${esc(i.title)}</dt><dd>${esc(i.text)}</dd></div>`).join("")}</dl></div>${photo(s.photo, rootPath, s.id)}</div>`);
      },
    },
    companyApproach: {
      validate(s, label) { textList(s.paragraphs, `${label}.paragraphs`); pairs(s.items, `${label}.items`); },
      render(s) {
        return section(s, "company-approach", `<div class="company-approach__layout"><div>${head(s)}<div class="company-approach__copy">${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div></div><ol class="company-approach__principles">${s.items.map((i, index) => `<li><span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div></li>`).join("")}</ol></div>`);
      },
    },
    companyDocuments: {
      validate(s, label, context) {
        requireArray(s.brands, `${label}.brands`, { nonEmpty: true }).forEach((brand, i) => {
          requireText(brand.name, `${label}.brands[${i}].name`);
          normalizeRoute(brand.href, `${label}.brands[${i}].href`);
          validateAsset(brand.image, `${label}.brands[${i}].image`, context);
        });
        resolveDocuments(s.documentIds, loadDocumentCatalog(context.root));
      },
      render(s, { rootPath }) {
        const brands = s.brands.map((b) => `<li><a href="${rootPath}${esc(b.href)}/"><img src="${rootPath}${esc(b.image)}" alt="" width="220" height="120" loading="lazy" decoding="async"><span>${esc(b.name)}<small>Официальный сервис</small></span></a></li>`).join("");
        const catalog = loadDocumentCatalog();
        const selected = resolveDocuments(s.documentIds, catalog);
        const groups = catalog.groups.map((group) => {
          const docs = selected.filter((item) => item.group === group.id);
          if (!docs.length) return "";
          const cards = docs.map((item) => `<a class="company-document" id="document-${esc(item.id)}" href="${rootPath}${esc(item.pages[0].image)}" data-company-media="${esc(s.id)}-${esc(item.id)}" data-media-index="0" aria-label="Открыть: ${esc(item.caption)}"><div class="company-document__preview"><img src="${rootPath}${esc(item.image)}" alt="${esc(item.imageAlt)}" width="${item.imageWidth}" height="${item.imageHeight}" loading="lazy" decoding="async"></div><div class="company-document__copy"><h4>${esc(item.caption)}</h4><p>${esc(item.text)}</p><p class="company-document__date">${esc(documentDate(item))}</p><span class="company-document__action">${item.pages.length > 1 ? `Смотреть ${item.pages.length} листов` : "Открыть документ"}</span></div></a>`).join("");
          return `<div class="company-documents__group" aria-labelledby="${esc(s.id)}-${esc(group.id)}-title"><h3 id="${esc(s.id)}-${esc(group.id)}-title">${esc(group.title)}</h3><div class="company-documents__grid${docs.length === 1 ? " company-documents__grid--single" : ""}">${cards}</div></div>`;
        }).join("");
        return section(s, "company-documents", `${head(s)}<ul class="company-documents__brands" aria-label="Официальный сервис">${brands}</ul><div class="company-documents__groups">${groups}</div>`);
      },
    },
  };
}

function renderCompanyMediaData(page, rootPath) {
  const entry = (item) => ({ src: rootPath + (item.largeImage || item.image), alt: item.imageAlt, caption: item.caption, width: item.imageWidth, height: item.imageHeight });
  const groups = { hero: [entry({ ...page.hero, caption: page.hero.imageCaption })] };
  for (const section of page.sections) {
    if (section.type === "companyBase") groups[section.id] = section.photos.map(entry);
    if (section.type === "companyTeam") groups[section.id] = [entry(section.photo)];
    if (section.type === "companyDocuments") resolveDocuments(section.documentIds).forEach((item) => { groups[`${section.id}-${item.id}`] = item.pages.map(entry); });
  }
  return `<script type="application/json" id="company-media-data">${JSON.stringify(groups).replaceAll("<", "\\u003c")}</script>`;
}

module.exports = { createCompanySections, renderCompanyMediaData };
