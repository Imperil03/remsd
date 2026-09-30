const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadPageTemplates, resolvePageTemplate } = require("./page-templates");
const { escapeHtml, validatePageDefinition, renderSection } = require("./internal-pages");

const BRAND_SLUGS = [
  "kamaz", "maz", "ural", "daf", "dongfeng", "faw", "foton", "gaz", "hino", "howo", "hyundai",
  "isuzu", "iveco", "jac", "man", "mercedes-benz", "mitsubishi-fuso", "renault-trucks", "sany",
  "scania", "shacman", "sitrak", "volvo",
];
const SECTION_ORDER = [
  "introProof", "serviceGrid", "popularWorks", "modelRange", "brandShowcase", "editorialContent",
  "symptoms", "workStages", "costEstimate", "relatedIndex", "faq",
];
const OFFICIAL = new Set(["kamaz", "maz", "ural"]);

function sectionHtml(html, type) {
  return html.match(new RegExp(`<section\\b[^>]*internal-section--${type}\\b[^>]*>[\\s\\S]*?<\\/section>`, "i"))?.[0] || "";
}

function links(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function buttonLinks(html) {
  return [...html.matchAll(/<a\b[^>]*class=["'][^"']*\bv3-button\b[^"']*["'][^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function requireTextInHtml(html, text, label) {
  assert(html.includes(escapeHtml(text)), `${label}: текст не попал в HTML: ${text}`);
}

module.exports = function checkBrandPages({ root, dataDir, catalog, siteConfig }) {
  const templates = loadPageTemplates(dataDir);
  const template = templates["brand-v1"];
  assert(template, "Не найден шаблон brand-v1");
  assert.deepEqual(template.sectionOrder, SECTION_ORDER, "brand-v1: изменён порядок 11 блоков");
  const sources = catalog.manifest.pages.map((file) => ({
    file,
    page: JSON.parse(fs.readFileSync(path.join(dataDir, "internal-pages", file), "utf8")),
  })).filter(({ page }) => page.family === "brand");
  assert.deepEqual(sources.map(({ page }) => page.path).sort(), BRAND_SLUGS.map((slug) => `remont/${slug}`).sort(), "Должны быть созданы ровно 23 маршрута марок");
  const context = { root, assetsDir: path.join(root, "assets"), entityMap: catalog.contentModel.entityMap };
  const publishedRoutes = new Set(catalog.pages.map((page) => page.path));
  const sourceMap = JSON.parse(fs.readFileSync(path.join(root, "docs/brand-source-map.json"), "utf8"));
  assert.equal(sourceMap.schemaVersion, 1, "Неверная версия карты переноса Word");
  assert.match(sourceMap.source.sha256, /^[a-f0-9]{64}$/i, "Карта переноса должна идентифицировать исходный Word по SHA-256");
  assert.deepEqual(sourceMap.pages.map((page) => page.route).sort(), BRAND_SLUGS.map((slug) => `remont/${slug}`).sort(), "Карта переноса должна охватывать все 23 марки");
  const provenanceByRoute = new Map(sourceMap.pages.map((page) => [page.route, page]));
  const copyContracts = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/brand-copy-contract.json"), "utf8"));
  const copyByRoute = new Map(copyContracts.map((contract) => [contract.route, contract]));
  assert.deepEqual([...copyByRoute.keys()].sort(), BRAND_SLUGS.map((slug) => `remont/${slug}`).sort());
  const revision = sourceMap.revisions.find((item) => item.id === "2026-09-30-eleven-brands");
  assert(revision && /^[a-f0-9]{64}$/i.test(revision.source.sha256), "Не указан источник редакции марок");
  for (const item of sourceMap.revisions) {
    assert(item.routes.every((route) => copyByRoute.has(route)), "Неизвестный маршрут в редакции");
    for (const input of item.sources || [item.source]) assert(input && /^[a-f0-9]{64}$/i.test(input.sha256), "Не указан хэш источника редакции");
  }
  assert.deepEqual([...new Set(sourceMap.revisions.flatMap((item) => item.routes))].sort(), [...copyByRoute.keys()].sort());
  const home = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
  const homeShowcase = home.match(/<section\b[^>]*\bv3-truck-brands\b[^>]*>[\s\S]*?<\/section>/i)?.[0] || "";
  const homeHeader = home.match(/<header\b[^>]*\bv3-header\b[^>]*>[\s\S]*?<\/header>/i)?.[0] || "";
  assert(homeShowcase && homeHeader, "Не найдены каталог марок и шапка главной");

  for (const { file, page: source } of sources) {
    const slug = source.path.split("/")[1];
    const label = source.path;
    const page = catalog.pages.find((item) => item.path === source.path);
    const section = (type) => page.sections.find((item) => item.type === type);
    const provenance = provenanceByRoute.get(source.path);
    const copyContract = copyByRoute.get(source.path);
    const sectionOrder = copyContract?.omitSymptoms ? SECTION_ORDER.filter((type) => type !== "symptoms") : SECTION_ORDER;
    assert.equal(file, `brand-${slug}.json`, `${label}: имя исходного файла`);
    assert.equal(source.template, "brand-v1", `${label}: нужен общий шаблон brand-v1`);
    assert.equal(source.entityRef, `brand-${slug}`, `${label}: неверная сущность марки`);
    assert.deepEqual(page.sections.map((item) => item.type), sectionOrder, `${label}: порядок блоков`);
    assert.deepEqual(source.omitSections, copyContract?.omitSymptoms ? ["symptoms"] : undefined, `${label}: незапланированное исключение секции`);
    assert.deepEqual(page.hero.facts, template.heroFacts, `${label}: общие преимущества`);
    assert.deepEqual(section("introProof").stats, template.proofStats, `${label}: общие условия работы`);
    for (const [key, value] of Object.entries(template.brands)) assert.deepEqual(section("brandShowcase")[key], value, `${label}: общий каталог марок`);
    if (copyContract) {
      assert.equal(page.sections.length, copyContract.sections);
      assert.equal(section("introProof").paragraphs.length, copyContract.introParagraphs);
      for (const key of ["intro", "bullets", "statement"]) assert.equal(section("introProof")[key], undefined);
      assert.equal(section("modelRange").note, copyContract.modelNote);
      section("modelRange").items.forEach((item, index) => {
        if ((copyContract.modelTextOmitted || []).includes(index)) assert.equal(item.text, undefined);
        else assert(item.text, `${label}: потеряно описание модели`);
      });
      assert.equal(section("costEstimate").note, undefined);
      assert.equal(section("costEstimate").items.length, 3);
      assert.equal(section("faq").intro, undefined);
      if (revision.faqOverrides[slug]) {
        const normalized = Object.fromEntries(Object.entries(section("faq").items[2]).map(([key, value]) => [key, value.replace(/\s+/g, " ")]));
        assert.deepEqual(normalized, revision.faqOverrides[slug], `${label}: согласованная замена FAQ`);
      }
    } else {
      assert.equal(section("introProof").paragraphs, undefined);
      assert.equal(section("introProof").bullets.length, 4);
      assert(section("introProof").statement && section("modelRange").note && section("costEstimate").note);
    }
    assert.deepEqual(section("workStages").items, templates["repair-v1"].workStages, `${label}: этапы должны быть общими`);
    assert.deepEqual(section("faq").contact, templates["repair-v1"].faqContact, `${label}: контакт FAQ должен быть общим`);
    assert.equal(section("workStages").items.length, 5, `${label}: пять этапов`);
    assert.equal(provenance.file, `src/data/internal-pages/${file}`, `${label}: карта переноса указывает другой файл`);
    for (const [key, type, itemsKey] of [
      ["serviceGroups", "serviceGrid", "items"], ["popularWorks", "popularWorks", "items"],
      ["features", "editorialContent", "blocks"], ["faq", "faq", "items"], ["symptoms", "symptoms", "items"],
    ]) {
      assert.equal(section(type)?.[itemsKey]?.length || 0, provenance.publishedCounts[key], `${label}: ${key} не совпадает с картой переноса`);
      if (["serviceGroups", "popularWorks", "features"].includes(key)) {
        assert.equal(provenance.publishedCounts[key], provenance.sourceCounts[key], `${label}: потеряны элементы исходника ${key}`);
      }
    }
    assert.deepEqual(section("modelRange").items.flatMap((item) => item.models || []).sort(), [...provenance.models].sort(), `${label}: модельный ряд не совпадает с исходником`);
    assert.equal(provenance.technicalFaqPreserved.length, provenance.sourceCounts.faq, `${label}: не учтены исходные технические вопросы`);
    const [startParagraph, endParagraph] = provenance.sourceParagraphRange;
    assert(startParagraph > 0 && endParagraph <= sourceMap.source.paragraphCount && startParagraph <= endParagraph, `${label}: неверный диапазон Word`);
    for (const mapping of provenance.mapping) {
      const [start, end] = mapping.sourceParagraphRange;
      assert(start >= startParagraph && end <= endParagraph && start <= end, `${label}: источник блока за пределами марки`);
      assert(mapping.destination.length && mapping.action, `${label}: не описано назначение исходного блока`);
    }
    const serviceCount = section("serviceGrid").items.length;
    assert(serviceCount >= 5 && serviceCount <= 7, `${label}: 5–7 направлений по исходнику`);
    if (slug === "ural") assert.equal(serviceCount, 7, "УРАЛ: сохранить семь направлений");
    const workCount = section("popularWorks").items.length;
    assert(workCount >= 13 && workCount <= 17, `${label}: количество работ должно сохранять исходник`);
    assert.equal(section("editorialContent").blocks.length, 3, `${label}: три технических подраздела`);
    const faqCount = section("faq").items.length;
    if (copyContract) assert.equal(faqCount, copyContract.faq, `${label}: пять согласованных FAQ`);
    else assert(faqCount >= 3 && faqCount <= 4, `${label}: 3–4 вопроса FAQ`);
    assert(section("modelRange").items.length, `${label}: отсутствуют модели или типы техники`);
    if (["sany", "sitrak"].includes(slug)) {
      assert(section("modelRange").items.every((item) => item.models === undefined), `${label}: нельзя добавлять отсутствующие в источнике модели`);
    }
    const heroClaims = JSON.stringify(source.hero);
    if (slug === "volvo") assert.equal(page.hero.h1.replace(/\s+/g, " "), "Ремонт грузовиков Volvo");
    assert.equal(/официальн(?:ый|ого|ом|ым)\s+сервис/iu.test(heroClaims), OFFICIAL.has(slug), `${label}: официальный статус в hero только у КАМАЗ, МАЗ и УРАЛ`);
    assert(!/\d[\d\s\u00a0]*(?:₽|руб(?:лей|ля|ль)?\b)/iu.test(JSON.stringify(section("costEstimate"))), `${label}: в расчёт стоимости добавлены неподтверждённые суммы`);
    for (const item of section("relatedIndex").items) {
      assert(item.href && publishedRoutes.has(item.href), `${label}: связанное направление должно вести на опубликованный маршрут`);
    }

    const html = fs.readFileSync(path.join(root, "dist", page.path, "index.html"), "utf8");
    const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || "";
    assert.deepEqual(buttonLinks(main), Array(copyContract ? 3 : 4).fill(siteConfig.site.phoneHref), `${label}: основные кнопки звонка`);
    assert.equal((main.match(/<section\b[^>]*\binternal-section\b/g) || []).length, sectionOrder.length, `${label}: число отрендеренных смысловых блоков`);
    assert.equal((main.match(/<aside\b[^>]*\binternal-inline-cta\b/g) || []).length, copyContract ? 1 : 2, `${label}: встроенные панели звонка`);
    if (copyContract) assert.equal(sectionHtml(html, "symptoms"), "", `${label}: удалённые симптомы остались в HTML`);
    for (const type of sectionOrder) {
      const rendered = sectionHtml(html, type);
      assert(rendered, `${label}: отсутствует HTML секции ${type}`);
      requireTextInHtml(rendered, section(type).title, `${label}/${type}`);
    }
    for (const type of ["symptoms", "costEstimate"].filter((type) => section(type))) {
      assert.deepEqual(buttonLinks(sectionHtml(html, type)), [siteConfig.site.phoneHref], `${label}/${type}: кнопка звонка`);
    }
    for (const item of section("serviceGrid").items) {
      for (const text of [item.title, item.text, ...(item.details || [])]) requireTextInHtml(sectionHtml(html, "serviceGrid"), text, `${label}/serviceGrid`);
    }
    for (const item of section("modelRange").items) {
      for (const text of [item.title, item.text, ...(item.models || [])].filter((text) => text !== undefined)) requireTextInHtml(sectionHtml(html, "modelRange"), text, `${label}/modelRange`);
    }
    for (const item of section("popularWorks").items) requireTextInHtml(sectionHtml(html, "popularWorks"), item.title, `${label}/popularWorks`);
    for (const item of section("costEstimate").items) {
      for (const text of [item.title, item.text]) requireTextInHtml(sectionHtml(html, "costEstimate"), text, `${label}/costEstimate`);
    }
    if (section("costEstimate").note) requireTextInHtml(sectionHtml(html, "costEstimate"), section("costEstimate").note, `${label}/costEstimate`);
    else assert(!sectionHtml(html, "costEstimate").includes("internal-cost-note"), `${label}: пустое примечание стоимости`);
    const faqHtml = sectionHtml(html, "faq");
    assert.equal((faqHtml.match(/<details>/g) || []).length, faqCount, `${label}: каждый вопрос FAQ должен раскрываться`);
    for (const item of section("faq").items) {
      requireTextInHtml(faqHtml, item.question, `${label}/faq`);
      requireTextInHtml(faqHtml, item.answer, `${label}/faq`);
    }
    const showcase = sectionHtml(html, "brandShowcase");
    assert.equal((showcase.match(/aria-current=["']page["']/g) || []).length, 1, `${label}: отметить текущую марку один раз`);
    assert(!/<a\b[^>]*aria-current=["']page["']/i.test(showcase), `${label}: текущая марка должна быть статической`);
    for (const brandSlug of BRAND_SLUGS) {
      const href = `../../remont/${brandSlug}/`;
      assert.equal(links(showcase).includes(href), brandSlug !== slug, `${label}: ссылка каталога ${brandSlug}`);
    }
    const homeHref = `./${page.path}/`;
    assert(links(homeShowcase).includes(homeHref), `${label}: карточка главной не активирована`);
    assert(links(homeHeader).includes(homeHref), `${label}: ссылка в меню не активирована`);
  }

  // These mutations verify rejection at the shared schema boundary, before build output exists.
  const reference = sources.find(({ page }) => page.path === "remont/kamaz").page;
  const validateMutation = (type, mutate, expected) => {
    const page = resolvePageTemplate(reference, templates);
    mutate(page.sections.find((section) => section.type === type));
    assert.throws(() => validatePageDefinition(page, `brand schema/${type}`, context), expected);
  };
  validateMutation("modelRange", (section) => { section.items = []; }, /массив не должен быть пустым/);
  validateMutation("modelRange", (section) => { section.items[0].models = [""]; }, /строка/);
  validateMutation("modelRange", (section) => { section.items[0].models = "6520"; }, /массив/);
  for (const text of ["", null, "<b>HTML</b>"]) validateMutation("modelRange", (section) => { section.items[0].text = text; }, /text/);
  const modelPage = resolvePageTemplate(reference, templates);
  const modelSection = modelPage.sections.find((section) => section.type === "modelRange");
  delete modelSection.items[0].text;
  validatePageDefinition(modelPage, "model list without text", context);
  assert(renderSection(modelSection, "../../", siteConfig.site).includes("internal-model-range__models"));
  assert(!renderSection(modelSection, "../../", siteConfig.site).includes("<p>"));
  delete modelSection.items[0].models;
  validatePageDefinition(modelPage, "title-only model item", context);
  const titleOnlyHtml = renderSection(modelSection, "../../", siteConfig.site);
  assert(titleOnlyHtml.includes("<h3>"));
  assert(!titleOnlyHtml.includes("internal-model-range__body"));
  const defaultBrandSource = structuredClone(reference);
  delete defaultBrandSource.omitSections;
  const repairSource = JSON.parse(fs.readFileSync(path.join(dataDir, "internal-pages/remont-gruzovyh-avtomobiley.json"), "utf8"));
  const legacySigns = structuredClone(repairSource.sections.find((section) => section.type === "symptoms"));
  legacySigns.id = "legacy-brand-signs";
  defaultBrandSource.sections.splice(6, 0, legacySigns);
  const defaultBrand = resolvePageTemplate(defaultBrandSource, templates);
  validatePageDefinition(defaultBrand, "legacy default brand composition", context);
  assert.equal(defaultBrand.sections.length, 11);
  validateMutation("costEstimate", (section) => { section.items = []; }, /массив не должен быть пустым/);
  for (const note of ["", null, "<b>HTML</b>"]) validateMutation("costEstimate", (section) => { section.note = note; }, /note/);
  const legacy = resolvePageTemplate(sources.find(({ page }) => page.path === "remont/volvo").page, templates);
  const legacyCost = legacy.sections.find((section) => section.type === "costEstimate");
  legacyCost.note = "Примечание прежнего варианта стоимости.";
  assert(renderSection(legacyCost, "../../", siteConfig.site).includes("internal-cost-note"));
  delete legacyCost.note;
  validatePageDefinition(legacy, "optional cost note", context);
  assert(!renderSection(legacyCost, "../../", siteConfig.site).includes("internal-cost-note"));
  validateMutation("costEstimate", (section) => { delete section.cta.buttonLabel; }, /строка/);
  validateMutation("serviceGrid", (section) => { section.items[0].details = [""]; }, /строка/);
  validateMutation("serviceGrid", (section) => { section.items[0].details = "Ремонт двигателя"; }, /массив/);
};
