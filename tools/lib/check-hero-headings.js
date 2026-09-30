const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { escapeHtml, loadContentModel } = require("./internal-pages");

const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&(?:nbsp|#160|#xA0);/gi, " ")
  .replace(/\s+/g, " ").trim();

module.exports = function checkHeroHeadings({ root, catalog }) {
  const { entityMap } = loadContentModel(path.join(root, "src", "data"));
  const read = (file) => fs.readFileSync(path.join(root, "dist", file), "utf8");
  const home = read("index.html").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  assert.equal(text(home), "Ремонт грузовых автомобилей и спецтехники", "Главная: текст H1");
  assert.deepEqual([...home.matchAll(/class="v3-hero-title__accent"[^>]*>([^<]+)</g)].map((match) => match[1]),
    ["грузовых автомобилей", "спецтехники"], "Главная: смысловые акценты H1");
  assert.equal((home.match(/class="v3-hero-title__line"/g) || []).length, 3, "Главная: три смысловые строки");

  for (const page of catalog.pages) {
    const { h1, accent } = page.hero;
    assert(!/Сургут/iu.test(h1), `${page.path}: город в H1`);
    if (page.family === "brand") {
      assert.equal(accent, entityMap.get(page.entityRef).name, `${page.path}: выделяется название марки`);
    } else if (!["company", "contact", "documents"].includes(page.family)) {
      const prefix = h1.match(/^(Кузовной ремонт|Ремонт|Аренда|Перевозка|Переработка) /u)?.[0];
      assert(prefix, `${page.path}: нет названия действия в H1`);
      assert.equal(accent, h1.slice(prefix.length), `${page.path}: выделяется весь вид техники или услуга`);
    }
    const rendered = read(`${page.path}/index.html`).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
    assert.equal(text(rendered), text(escapeHtml(h1)), `${page.path}: H1 не совпадает с данными`);
    const spans = [...rendered.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => text(match[1]));
    assert.deepEqual(spans, accent ? [text(escapeHtml(accent))] : [], `${page.path}: точный текст выделения`);
  }
};
