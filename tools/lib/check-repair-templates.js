const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadPageTemplates, resolvePageTemplate } = require("./page-templates");
const { validatePageDefinition, renderSection } = require("./internal-pages");

module.exports = function checkRepairTemplates({ root, dataDir, catalog, siteConfig }) {
  const templates = loadPageTemplates(dataDir);
  const template = templates["repair-v1"];
  const context = { root, assetsDir: path.join(root, "assets"), entityMap: catalog.contentModel.entityMap };
  const sources = catalog.manifest.pages.map((file) => JSON.parse(fs.readFileSync(path.join(dataDir, "internal-pages", file), "utf8")));
  const reference = sources.find((page) => page.path === catalog.manifest.referenceByFamily.hub);
  assert(reference?.template === "repair-v1", "Эталон должен использовать repair-v1");
  const before = JSON.stringify(reference);
  const resolved = resolvePageTemplate(reference, templates);
  assert.equal(JSON.stringify(reference), before, "Resolver изменяет исходный JSON");
  resolved.hero.facts[0].value = "mutation probe";
  assert.notEqual(template.heroFacts[0].value, "mutation probe", "Resolver разделяет изменяемые объекты");
  assert.throws(() => resolvePageTemplate({ ...reference, template: "missing" }, templates), /неизвестный шаблон/);
  for (const [type, key, value] of [["introProof", "stats", []], ["brandShowcase", "items", []], ["brandShowcase", "title", "override"], ["workStages", "items", []], ["faq", "contact", {}]]) {
    const copy = structuredClone(reference);
    copy.sections.find((section) => section.type === type)[key] = value;
    assert.throws(() => resolvePageTemplate(copy, templates), /общие данные/);
  }
  assert.throws(() => resolvePageTemplate({ ...reference, hero: { ...reference.hero, facts: [] } }, templates), /общие данные/);
  const reordered = structuredClone(reference);
  reordered.sections.reverse();
  assert.throws(() => resolvePageTemplate(reordered, templates), /порядок секций/);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/internal-service-page.json"), "utf8"));
  assert.deepEqual(resolvePageTemplate(fixture, templates), fixture, "Страница без template должна сохраниться");
  validatePageDefinition(resolvePageTemplate(fixture, templates), "fixture", context);
  assert.throws(() => resolvePageTemplate({ ...fixture, omitSections: ["symptoms"] }, templates), /omitSections/);
  const withoutSymptoms = structuredClone(reference);
  withoutSymptoms.omitSections = ["symptoms"];
  withoutSymptoms.sections = withoutSymptoms.sections.filter((section) => section.type !== "symptoms");
  const reduced = resolvePageTemplate(withoutSymptoms, templates);
  validatePageDefinition(reduced, "without symptoms", context);
  assert.equal(reduced.sections.length, 10);
  assert.equal(reduced.omitSections, undefined, "Authoring-настройка не должна попадать в PageDefinition");
  assert.deepEqual(withoutSymptoms.omitSections, ["symptoms"], "Resolver изменил источник");
  for (const invalid of [null, "symptoms", ["faq"], ["symptoms", "symptoms"]]) {
    assert.throws(() => resolvePageTemplate({ ...withoutSymptoms, omitSections: invalid }, templates), /omitSections/);
  }
  const undeclared = structuredClone(withoutSymptoms);
  delete undeclared.omitSections;
  assert.throws(() => resolvePageTemplate(undeclared, templates), /порядок секций/);
  assert.throws(() => resolvePageTemplate({ ...reference, omitSections: ["symptoms"] }, templates), /порядок секций/);
  const brandSource = sources.find((page) => page.template === "brand-v1");
  assert.throws(() => resolvePageTemplate({ ...brandSource, omitSections: ["symptoms"] }, templates), /omitSections/);

  const paragraphPage = resolvePageTemplate(reference, templates);
  const paragraphIntro = paragraphPage.sections.find((section) => section.type === "introProof");
  for (const key of ["intro", "bullets", "statement"]) delete paragraphIntro[key];
  paragraphIntro.paragraphs = ["Первый абзац & второй фрагмент.", "Второй абзац."];
  validatePageDefinition(paragraphPage, "paragraph intro", context);
  const paragraphHtml = renderSection(paragraphIntro, "../", siteConfig.site);
  assert.equal((paragraphHtml.match(/class="internal-intro__lead"/g) || []).length, 2);
  assert(paragraphHtml.includes("&amp;"), "Абзацы должны экранироваться");
  assert(!/internal-intro__(?:list|statement)/.test(paragraphHtml), "Старые элементы intro остались в разметке");
  for (const invalid of [[], [""], ["<b>HTML</b>"], "not an array"]) {
    const copy = structuredClone(paragraphPage);
    copy.sections.find((section) => section.type === "introProof").paragraphs = invalid;
    assert.throws(() => validatePageDefinition(copy, "invalid paragraphs", context), /paragraphs/);
  }
  for (const key of ["intro", "bullets", "statement"]) {
    const copy = structuredClone(paragraphPage);
    copy.sections.find((section) => section.type === "introProof")[key] = key === "bullets" ? ["old"] : "old";
    assert.throws(() => validatePageDefinition(copy, "mixed intro", context), /paragraphs нельзя совмещать/);
  }
  const invalidIcon = resolvePageTemplate(reference, templates);
  invalidIcon.hero.facts[0].icon = "does-not-exist";
  assert.throws(() => validatePageDefinition(invalidIcon, "icon probe", context), /неизвестная пиктограмма/);

  const newPriceCounts = { "remont-sedelnyh-tyagachey": 8, "remont-polupricepov-i-tralov": 4, "remont-avtobusov": 7, "remont-spectehniki": 8, "kuzovnoy-remont-gruzovoy-tehniki": 8 };
  const specialtyContracts = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/special-equipment-contract.json"), "utf8"));
  const specialtyByPath = new Map(specialtyContracts.map((item) => [item.path, item]));
  const descriptions = catalog.pages.map((page) => page.metadata.description);
  assert.equal(new Set(descriptions).size, descriptions.length, "Повторяются description страниц");
  for (const contract of specialtyContracts) assert(sources.some((source) => source.path === contract.path), `Не создана страница ${contract.path}`);
  for (const source of sources.filter((page) => page.template === "repair-v1")) {
    const page = catalog.pages.find((item) => item.path === source.path);
    const isTractor = page.path === "remont-sedelnyh-tyagachey";
    const section = (type) => page.sections.find((item) => item.type === type);
    assert.equal(page.template, undefined, "Полный PageDefinition не содержит template");
    assert.equal(page.omitSections, undefined);
    if (isTractor) {
      assert.deepEqual(source.omitSections, ["symptoms"]);
      assert.equal(page.sections.length, 10);
      assert.equal(section("introProof").paragraphs.length, 2);
      assert.equal(section("faq").intro, undefined);
      assert.deepEqual(section("vehicleTypes").items.map((item) => item.title), ["Тягачи 4×2", "Тягачи 6×2", "Тягачи 6×4"]);
      assert.deepEqual(section("priceExamples").items.map((item) => Number(item.price.replace(/\D/g, ""))), [1500, 25000, 16000, 12000, 4000, 2500, 2000, 6000]);
    } else {
      assert.equal(source.omitSections, undefined, `${page.path}: исключение добавлено за пределами страницы тягачей`);
      assert.equal(page.sections.length, 11);
    }
    assert.deepEqual(page.hero.facts, template.heroFacts);
    assert.deepEqual(section("introProof").stats, template.proofStats);
    assert.deepEqual(section("workStages").items, template.workStages);
    assert.deepEqual(section("faq").contact, template.faqContact);
    for (const [key, value] of Object.entries(template.brands)) assert.deepEqual(section("brandShowcase")[key], value);
    assert.equal(section("serviceGrid").items.length, 6);
    const specialty = specialtyByPath.get(page.path);
    const popularCount = specialty?.popularWorks ?? (page.path === reference.path || newPriceCounts[page.path] ? 16 : undefined);
    if (popularCount !== undefined) assert.equal(section("popularWorks").items.length, popularCount, `${page.path}: количество популярных работ`);
    assert.equal(section("vehicleTypes").items.length, isTractor ? 3 : 6);
    if (newPriceCounts[page.path]) {
      if (isTractor) assert.equal(section("symptoms"), undefined);
      else assert.equal(section("symptoms").items.length, 8);
      assert.equal(section("faq").items.length, isTractor ? 4 : 10);
      assert.equal(section("priceExamples").items.length, newPriceCounts[page.path]);
      assert.match(section("priceExamples").note, isTractor ? /без запчастей и\s+расходных материалов/u : /без запчастей и материалов/);
      for (const row of section("priceExamples").items) assert.match(row.price, /^от [\d\s]+ ₽$/u);
    }
    if (specialty) {
      assert.equal(page.family, "hub");
      assert.equal(section("introProof").bullets.length, specialty.introBullets);
      assert.equal(section("editorialContent").blocks.length, 3);
      assert(section("editorialContent").lead);
      assert.equal(section("symptoms").items.length, 8);
      assert.equal(section("relatedIndex").items.length, 8);
      assert.equal(section("faq").items.length, 5);
      assert.equal(section("priceExamples").items.length, 8);
      assert.match(section("priceExamples").note, /без запчастей и материалов/);
      assert.match(section("priceExamples").note, /после диагностики и дефектовки/);
      const prices = section("priceExamples").items.map((item) => {
        assert.match(item.price, /^от [\d\s]+ ₽$/u);
        return Number(item.price.replace(/\D/g, ""));
      });
      const extras = {
        "remont-buldozerov": [45000, 15000], "remont-truboukladchikov": [45000, 15000],
        "remont-ekskavatorov": [25000, 37000], "remont-samosvalov": [45000, 3000],
        "remont-dorozhnyh-katkov": [25000, 7000], "remont-traktorov": [45000, 12000],
      };
      assert.deepEqual(prices, [3500, 5000, 8000, 2500, 3000, 85000, ...(extras[page.path] || [45000, 25000])]);
      assert.equal(page.breadcrumbs.length, 3);
      assert.equal(page.breadcrumbs[1].href, "remont-spectehniki");
      for (const card of section("vehicleTypes").items) {
        if (card.image.includes("/components/")) {
          assert.equal(card.imageWidth, 960);
          assert.equal(card.imageHeight, 540);
          assert.match(card.alt, /^Иллюстрация/);
        }
      }
    }
    const html = fs.readFileSync(path.join(root, "dist", page.path, "index.html"), "utf8");
    assert(!/5000\+|средний срок ремонта/i.test(html), `${page.path}: устаревшие факты`);
    const buttons = [...html.matchAll(/<a[^>]*class="[^"]*v3-button[^>]*href="([^"]+)"/g)];
    assert.equal(buttons.length, isTractor ? 3 : 4, `${page.path}: число CTA`);
    if (isTractor) {
      assert(!html.includes('id="repair-signs"'), "Удалённая секция осталась на странице");
      assert.equal((html.match(/<th>Цена от<\/th>/g) || []).length, 2, "Общие заголовки таблиц изменены");
    }
    assert(buttons.every((match) => match[1] === siteConfig.site.phoneHref));
    for (const item of section("faq").items) {
      assert(html.includes(item.question) && html.includes(item.answer), `${page.path}: FAQ не совпадает с данными`);
    }
  }
  assert.deepEqual(template.proofStats.map((item) => item.value), ["10+", "500+", "80%", "1–2 дня"]);
  assert(!/5000|Средний срок ремонта/.test(JSON.stringify(siteConfig.claims)));
  const home = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
  const parent = catalog.pages.find((page) => page.path === "remont-spectehniki");
  assert.deepEqual(parent.sections.find((section) => section.type === "relatedIndex").items.map((item) => item.href), specialtyContracts.map((item) => item.path));
  const equipment = home.match(/<ul class="v3-equipment-grid"[^>]*>([\s\S]*?)<\/ul>/)?.[1] || "";
  for (const contract of specialtyContracts) assert(equipment.includes(`href="./${contract.path}/"`), `${contract.path}: карточка главной не активирована`);
  for (const brand of template.brands.official) assert(home.includes(`Ремонт ${brand.name}`) && home.includes(brand.image));
  for (const brand of template.brands.items) {
    const entityRef = template.brands.entityRefs?.[brand];
    const destination = catalog.pages.find((page) => page.entityRef === entityRef);
    assert(home.includes(destination ? `href="./${destination.path}/" aria-label="Ремонт ${brand}">${brand}</a>` : `<li>${brand}</li>`));
  }
  for (const page of catalog.pages) assert(home.includes(`href="./${page.path}/"`) || home.includes(`href="${page.path}/"`), `${page.path}: нет ссылки с главной`);
};
