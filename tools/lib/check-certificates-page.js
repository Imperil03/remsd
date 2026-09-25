const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadDocumentCatalog, documentDate } = require("./documents");

module.exports = function checkCertificatesPage({ root, catalog }) {
  const page = catalog.pages.find((item) => item.path === "sertifikaty");
  assert.equal(page.family, "documents");
  const html = fs.readFileSync(path.join(root, "dist/sertifikaty/index.html"), "utf8");
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"] || []);
  assert(graph.some((node) => node["@type"] === "CollectionPage"));
  assert(!graph.some((node) => node["@type"] === "Service"));
  assert.equal((html.match(/class="company-document"/g) || []).length, 5);
  assert.equal((html.match(/class="company-documents__group"/g) || []).length, 3);
  const media = JSON.parse(html.match(/id="company-media-data">([\s\S]*?)<\/script>/)[1]);
  for (const doc of loadDocumentCatalog(root).documents) {
    assert(html.includes(`id="document-${doc.id}"`));
    assert(html.includes(documentDate(doc)));
    assert.equal(media[`documents-${doc.id}`].length, doc.pages.length);
    for (const image of media[`documents-${doc.id}`]) assert(fs.existsSync(path.resolve(root, "dist/sertifikaty", image.src)));
  }
  assert.deepEqual(media["documents-conformity"].map((image) => path.basename(image.src)), Array.from({ length: 6 }, (_, i) => `conformity-0${i + 1}.webp`));
  assert(!/Действующий|TODO|undefined/.test(html));
};
