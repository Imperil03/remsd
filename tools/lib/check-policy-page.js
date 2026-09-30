const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { policyText } = require("./policy-sections");
const { details } = require("./contact-details");
const contract = require("../fixtures/policy-copy-contract.json");

module.exports = function checkPolicyPage({ root, catalog, siteConfig }) {
  const page = catalog.pages.find((item) => item.path === "policy");
  assert.equal(page.family, "documents");
  assert.equal(page.layout, "policy");
  assert.equal(page.sections.length, contract.sectionCount);
  const text = policyText(page);
  assert.equal(createHash("sha256").update(text).digest("hex"), contract.textSha256, "Текст политики изменён сверх одобренных замен реквизитов");
  assert(text.includes(details.organization.name));
  assert(text.includes(siteConfig.site.email));
  assert(text.includes(`${siteConfig.modes.production.baseUrl}policy/`));
  for (const replacement of contract.replacements) assert(!text.includes(replacement.from), "В политике остались данные исходного оператора");
  const notice = "Информация об услугах, ценах и сроках на сайте носит справочный характер и не является публичной офертой (п. 2 ст. 437 ГК РФ).";
  for (const route of ["", "404", ...catalog.pages.map((item) => item.path)]) {
    const file = route === "404" ? "404.html" : route ? `${route}/index.html` : "index.html";
    const html = fs.readFileSync(path.join(root, "dist", file), "utf8");
    const footer = html.match(/<footer class="v3-footer">([\s\S]*?)<\/footer>/)?.[1] || "";
    assert(footer.includes(notice), `${file}: нет точного текста об оферте`);
    assert.equal((footer.match(/>Политика обработки персональных данных<\/a>/g) || []).length, 1, `${file}: нет единственной ссылки на политику`);
    assert(/href="[^"]*policy\/"/.test(footer), `${file}: неверный адрес политики`);
  }
};
