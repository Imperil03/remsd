const { loadDocumentCatalog, resolveDocuments, renderDocumentCard } = require("./documents");

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
        if (s.presentation !== "preview") throw new Error(`${label}.presentation: ожидается preview`);
      },
      render(s, { rootPath }) {
        const brands = s.brands.map((b) => `<li><a href="${rootPath}${esc(b.href)}/"><img src="${rootPath}${esc(b.image)}" alt="" width="220" height="120" loading="lazy" decoding="async"><span>${esc(b.name)}<small>Официальный сервис</small></span></a></li>`).join("");
        const catalog = loadDocumentCatalog();
        const selected = resolveDocuments(catalog.homePreviewIds.filter((id) => s.documentIds.includes(id)), catalog);
        const previews = selected.map((item) => renderDocumentCard(item, { rootPath, esc, preview: true })).join("");
        return section(s, "company-documents", `${head(s)}<ul class="company-documents__brands" aria-label="Официальный сервис">${brands}</ul><div class="company-documents__grid">${previews}</div><a class="company-documents__all" href="${rootPath}sertifikaty/">Все документы и сертификаты</a>`);
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
  }
  return `<script type="application/json" id="company-media-data">${JSON.stringify(groups).replaceAll("<", "\\u003c")}</script>`;
}

module.exports = { createCompanySections, renderCompanyMediaData };
