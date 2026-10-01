const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRentalCatalog, formatRate } = require("./rental-sections");

module.exports = function checkRentalPages({ root, catalog }) {
  const rental = loadRentalCatalog(root);
  const pages = catalog.pages.filter((page) => page.rental);
  assert.equal(pages.length, 12, "Раздел аренды должен содержать 12 страниц");
  assert.equal(rental.categories.filter((item) => item.kind === "equipment").length, 9);
  assert.equal(rental.categories.filter((item) => item.kind === "service").length, 2);
  const expectedRates = { "crane-40": [4500], "crawler-excavator": [4500], "doosan-180": [5500, 6500, 6500], "loader-5": [3500], grader: [3500], "dump-truck": [3000], "mini-tractor": [3000] };
  assert.deepEqual(Object.fromEntries(rental.equipment.filter((item) => item.rates.length).map((item) => [item.id, item.rates.map((rate) => rate.amount)])), expectedRates, "Тарифы не соответствуют подтверждённому перечню");
  assert.deepEqual(rental.equipment.find((item) => item.id === "doosan-180").rates.map((rate) => rate.label), ["С ковшом", "С гидромолотом", "С гидроплитой"]);
  assert.equal(rental.equipment.find((item) => item.id === "loader-3").specs.find((spec) => spec.label === "Объём ковша").value, "1,8 м³");
  assert.match(rental.equipment.find((item) => item.id === "crawler-excavator").note, /с выбранным навесным оборудованием/);
  const usedEquipment = rental.categories.flatMap((item) => item.equipmentIds);
  assert.equal(new Set(usedEquipment).size, usedEquipment.length, "Машина должна принадлежать одной категории");
  assert.deepEqual([...usedEquipment].sort(), rental.equipment.map((item) => item.id).sort());
  for (const page of pages) {
    assert.equal(page.family, page.path === "arenda" ? "hub" : "service");
    assert(!page.template, "Аренда не наследует ремонтный шаблон");
    const html = fs.readFileSync(path.join(root, "dist", page.path, "index.html"), "utf8");
    const main = html.match(/<main\b[\s\S]*?<\/main>/)[0];
    const withoutHeader = main.replace(/<div class="site-header-rail">[\s\S]*?<\/header>\s*<\/div>/, "");
    assert(!/<form\b/.test(html));
    assert(!/Записаться на диагностику|Позвонить мастеру|На все работы|60 секунд/i.test(withoutHeader), `${page.path}: ремонтный или неподтверждённый текст`);
    if (page.path === "arenda") {
      assert.match(page.hero.lead, /При аренде от 15 дней предоставляем скидку\./);
      assert(!/скидк[^.]*\d+\s*%/i.test(withoutHeader), "Нельзя придумывать процент скидки");
      assert.deepEqual(page.sections.map((section) => section.id), ["catalog", "prices", "conditions", "additional-services"]);
      assert(!page.sections.some((section) => section.type === "faq"));
      assert.equal(page.hero.ctaLabel, "Запросить расчёт");
      assert.equal(page.closingCta.buttonLabel, "Запросить расчёт");
      assert(!page.hero.facts.some((fact) => fact.label === "Связь"));
      assert.equal(page.hero.facts.find((fact) => fact.label === "Приём звонков").value, "08:00–22:00");
    } else {
      const category = rental.categories.find((item) => item.path === page.path);
      const discount = "При аренде от 15 дней предоставляем скидку.";
      if (category.kind === "equipment") {
        assert.equal(withoutHeader.split(discount).length - 1, 1, `${page.path}: согласованная скидка должна быть указана один раз`);
        assert.match(page.hero.lead, /(?:с машинист(?:ом|ами)|с водителем).+без/);
      } else assert(!/скидк/i.test(withoutHeader), `${page.path}: скидка не относится к услуге`);
      assert(!/скидк[^.]*\d+\s*%/i.test(withoutHeader), "Нельзя придумывать процент скидки");
      assert.equal(page.hero.ctaLabel, "Запросить расчёт");
      assert.equal(page.closingCta.buttonLabel, "Запросить расчёт");
      assert.deepEqual(page.hero.facts.map((fact) => fact.icon), ["clock"]);
      assert.equal(page.hero.facts[0].value, "08:00–22:00");
      assert(!page.sections.some((section) => section.type === "faq" || section.type === "editorialContent"));
      assert.equal(page.sections.filter((section) => section.type === "rentalOrder").length, 1);
      assert(!/rental-terms|rental-availability|Нужна помощь с выбором/.test(withoutHeader));
    }
    assert(html.includes('href="https://wa.me/79224488822"'));
    assert(html.includes(page.mobileCallbar.text));
    for (const match of html.matchAll(/<use\b[^>]*href="#(internal-icon-[^"]+)"/g)) assert(html.includes(`id="${match[1]}"`), `${page.path}: удалена используемая пиктограмма ${match[1]}`);
    assert(html.includes('data-equipment-id=') || !page.sections.some((section) => section.type === "equipmentCatalog"));
    const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
    assert(!/"@type"\s*:\s*"(?:Offer|FAQPage|AggregateRating)"/.test(JSON.stringify(schema)));
    if (page.path !== "arenda") {
      const category = rental.categories.find((item) => item.path === page.path);
      assert.equal(category.entityRef, page.entityRef);
      assert(catalog.contentModel.relations.some((relation) => relation.subject === page.entityRef && relation.predicate === "servesTask"), "Нет связи услуги с задачей");
      for (const id of category.equipmentIds) {
        assert(main.includes(`id="machine-${id}"`));
        for (const rate of rental.equipment.find((item) => item.id === id).rates) assert(main.includes(formatRate(rate)));
      }
    }
  }
  const images = JSON.parse(fs.readFileSync(path.join(root, "docs/rental-image-sources.json"), "utf8"));
  assert.equal(images.images.length, 15, "Не все исходные фото сопоставлены");
  console.log("Rental contract passed: 12 routes, 14 machines, 9 tariffs, source records and semantic relations.");
};
