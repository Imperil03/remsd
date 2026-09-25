const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { details, requisiteRows, cardText, validateContactDetails } = require("./contact-details");

module.exports = function checkContactPage({ root, catalog, siteConfig }) {
  validateContactDetails(root, siteConfig.site);
  const page = catalog.pages.find((item) => item.path === "kontakty");
  assert.equal(page.family, "contact");
  const html = fs.readFileSync(path.join(root, "dist/kontakty/index.html"), "utf8");
  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"] || []);
  assert(graph.some((node) => node["@type"] === "ContactPage"));
  assert(!graph.some((node) => node["@type"] === "Service"));
  const copy = JSON.parse(html.match(/id="contact-copy-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(copy, cardText(siteConfig.site));
  assert.equal((html.match(/<section\b/g) || []).length, 3);
  for (const [, value] of requisiteRows(siteConfig.site)) assert(copy.includes(value));
  for (const bank of details.organization.banks) for (const field of ["account", "bik", "correspondentAccount"]) assert(html.includes(bank[field]));
  for (const item of details.departments) assert(html.includes(item.href));
  assert(html.includes('download="Реквизиты-РемСД.pdf"'));
  assert(html.includes("data-contact-map-src="));
  assert(!/черновик|заполнител|неподтвержден|TODO|undefined/i.test(html));
  for (const route of ["index.html", "o-kompanii/index.html", "remont/kamaz/index.html"]) {
    const content = fs.readFileSync(path.join(root, "dist", route), "utf8");
    assert((content.match(/href="[^"]*kontakty\/"/g) || []).length >= 2, `${route}: ссылки на контакты`);
  }
};
