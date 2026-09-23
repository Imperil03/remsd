const assert = require("node:assert/strict");

module.exports = async function verifyBrandPage(page, viewport, definition, materializePage) {
  await materializePage(page);
  const sections = new Map(definition.sections.map((section) => [section.type, section]));
  assert.equal(await page.locator(".internal-section").count(), 11);
  assert.equal(await page.locator(".internal-model-range__item").count(), sections.get("modelRange").items.length);
  assert.equal(await page.locator(".internal-cost-factor").count(), sections.get("costEstimate").items.length);
  assert.equal(await page.locator(".internal-price-table, form").count(), 0);
  assert.equal(await page.locator("main a.v3-button").count(), 4);
  assert.equal(await page.locator('.internal-section--brandShowcase [aria-current="page"]').count(), 1);
  assert.equal(await page.locator('.internal-section--brandShowcase a[href*="remont/"]').count(), 22);
  assert.equal(await page.locator('[data-site-nav] a[aria-current="page"]').count(), 1);
  const metrics = await page.evaluate(() => {
    const visible = (element) => element.getBoundingClientRect().width > 0;
    const cards = [...document.querySelectorAll(".internal-service-card")];
    const rows = [];
    cards.forEach((card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      const row = rows.find((item) => Math.abs(item.top - top) < 2);
      if (row) row.count++; else rows.push({ top, count: 1 });
    });
    const clipped = [...document.querySelectorAll("main h1, main h2, main h3, main p, main summary, .internal-model-range__models li, .internal-intro__stats dd")]
      .filter(visible).filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.textContent.trim());
    const targets = [...document.querySelectorAll("main a.v3-button, .internal-faq summary")].filter(visible)
      .map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    const proofOrder = [...document.querySelectorAll(".internal-intro__stats div")].every((element) => element.querySelector("dd").getBoundingClientRect().top < element.querySelector("dt").getBoundingClientRect().top);
    return { overflow: document.documentElement.scrollWidth - innerWidth, rows: rows.map((row) => row.count), clipped, targets, proofOrder };
  });
  assert(metrics.overflow <= 1, "Брендовая страница имеет горизонтальную прокрутку");
  assert.deepEqual(metrics.clipped, [], `Обрезан текст: ${metrics.clipped.join("; ")}`);
  assert(metrics.proofOrder, "Условия работы: основной текст должен предшествовать пояснению");
  const columns = viewport.width <= 720 ? 1 : viewport.width <= 1120 ? 2 : 3;
  const count = sections.get("serviceGrid").items.length;
  assert.deepEqual(metrics.rows, Array.from({ length: Math.ceil(count / columns) }, (_, i) => Math.min(columns, count - i * columns)), "Сетка направлений марки");
  assert(metrics.targets.every((target) => target.width >= 44 && target.height >= 44), "Кнопка или вопрос меньше 44px");
  const summary = page.locator(".internal-faq summary").first();
  await summary.focus();
  assert.notEqual(await summary.evaluate((element) => getComputedStyle(element).outlineStyle), "none", "Нет keyboard focus FAQ");
  await summary.press("Enter");
  assert(await page.locator(".internal-faq details").first().getAttribute("open") !== null, "FAQ не раскрывается с клавиатуры");
  await summary.press("Enter");
};
