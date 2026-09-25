const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { validatePageDefinition } = require("./internal-pages");
const { loadDocumentCatalog, validateDocumentCatalog, documentDate } = require("./documents");

module.exports = function checkCompanyPage({ root, catalog, siteConfig }) {
  const page = catalog.pages.find((item) => item.path === "o-kompanii");
  assert(page && page.family === "company", "Не найдена страница компании");
  assert.equal(catalog.contentModel.entityMap.get(page.entityRef).type, "organization");
  assert.deepEqual(page.sections.map((s) => s.type), ["companyFacts", "companyStory", "companyBase", "companyTeam", "companyApproach", "companyDocuments"]);
  const html = fs.readFileSync(path.join(root, "dist/o-kompanii/index.html"), "utf8");
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"] || []);
  assert(graph.some((item) => item["@type"] === "AboutPage"));
  assert(graph.some((item) => item["@type"] === "Organization"));
  assert(!graph.some((item) => item["@type"] === "Service"), "Компания не должна быть размечена как услуга");
  assert.equal((html.match(/<section\b/g) || []).length, 8);
  const ctas = [...html.matchAll(/<a[^>]*class="[^"]*v3-button[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ctas, [siteConfig.site.phoneHref, siteConfig.site.phoneHref]);
  const data = html.match(/<script type="application\/json" id="company-media-data">([\s\S]*?)<\/script>/)?.[1];
  assert(data, "Отсутствует список фотографий и документов");
  const groups = JSON.parse(data);
  assert.equal(groups["documents-conformity"].length, 6, "Сертификат соответствия должен объединять шесть листов");
  const documents = loadDocumentCatalog(root);
  assert.equal(documents.documents.length, 5);
  assert.deepEqual(documents.homePreviewIds, ["maz", "conformity"]);
  assert.equal((html.match(/class="company-documents__group"/g) || []).length, 3);
  for (const doc of documents.documents) {
    assert(html.includes(`id="document-${doc.id}"`));
    assert(html.includes(`data-company-media="documents-${doc.id}"`));
    assert(html.includes(documentDate(doc)));
  }
  assert.deepEqual(groups["documents-conformity"].map((item) => path.basename(item.src)), Array.from({ length: 6 }, (_, i) => `conformity-0${i + 1}.webp`));
  const home = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
  assert.equal((home.match(/class="v3-cert-card"/g) || []).length, 2);
  for (const id of documents.homePreviewIds) assert(home.includes(`o-kompanii/#document-${id}`));
  for (const id of ["v3-company-proof-title", "v3-cert-strip-title"]) assert(home.includes(`id="${id}"`));
  const nav = fs.readFileSync(path.join(root, "src/partials/main-nav.html"), "utf8");
  assert(!nav.includes("Сертификаты"));
  assert(home.includes('o-kompanii/#documents">Документы и сертификаты'));
  for (const items of Object.values(groups)) for (const item of items) {
    const target = path.resolve(root, "dist/o-kompanii", item.src);
    assert(target.startsWith(path.join(root, "dist/assets") + path.sep) && fs.existsSync(target), `Недоступное медиа: ${item.src}`);
    assert(item.alt && item.caption);
  }
  for (const candidate of ["index.html", "remont/kamaz/index.html", "o-kompanii/index.html"]) {
    const content = fs.readFileSync(path.join(root, "dist", candidate), "utf8");
    assert(content.includes("o-kompanii/"), `${candidate}: нет ссылки на компанию`);
  }
  assert(html.includes('loading="lazy"') && html.includes("map-widget/v1/"));
  const invalid = structuredClone(page);
  invalid.sections.find((s) => s.type === "companyDocuments").documentIds[0] = "unknown-document";
  assert.throws(() => validatePageDefinition(invalid, "company missing document", { root, assetsDir: path.join(root, "assets"), entityMap: catalog.contentModel.entityMap }), /неизвестный документ/);
  const missing = structuredClone(documents);
  missing.documents[0].pages[0].image = "assets/missing-certificate.webp";
  assert.throws(() => validateDocumentCatalog(missing, root), /файл не найден/);
  const badDate = structuredClone(documents);
  badDate.documents[0].validThrough = "2026-02-30";
  assert.throws(() => validateDocumentCatalog(badDate, root), /неверная дата/);
};
