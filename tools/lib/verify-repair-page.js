const assert = require("node:assert/strict");

module.exports = async function verifyRepairPage(page, viewport, definition, materializePage) {
  const sections = new Map(definition.sections.map((section) => [section.type, section]));
  const selectors = { serviceGrid: ".internal-service-card", popularWorks: ".internal-popular-work", vehicleTypes: ".internal-vehicle-card", symptoms: ".internal-symptoms li", workStages: ".internal-timeline__item", priceExamples: ".internal-price-table tbody tr", relatedIndex: ".internal-related-card", faq: ".internal-faq details" };
  assert.equal(await page.locator(".internal-section").count(), definition.sections.length);
  for (const [type, selector] of Object.entries(selectors)) assert.equal(await page.locator(selector).count(), sections.get(type)?.items.length || 0, `${definition.path}: ${type}`);
  assert.equal(await page.locator("form").count(), 0);
  assert(await page.locator('[data-site-nav] a[aria-current="page"]').count() > 0, "Текущий маршрут не отмечен в меню");
  const ctas = page.locator("main a.v3-button");
  assert.equal(await ctas.count(), 4);
  for (const cta of await ctas.all()) {
    assert.equal(await cta.getAttribute("href"), "tel:+79224488822");
    const box = await cta.boundingBox();
    assert(box.width >= 44 && box.height >= 44, "CTA меньше 44px");
  }
  assert.equal(await page.locator(".internal-faq__contact-link").getAttribute("href"), "tel:+79224488822");
  for (const target of [...await ctas.all(), page.locator(".internal-faq__contact-link")]) {
    const focus = await target.evaluate((element) => {
      element.focus();
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height, outline: getComputedStyle(element).outlineStyle };
    });
    assert(focus.width >= 44 && focus.height >= 44 && focus.outline !== "none", "Телефонная ссылка нарушает focus/44px контракт");
  }
  await materializePage(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.querySelectorAll("main img")];
    images.forEach((image) => { image.loading = "eager"; });
    await Promise.race([
      Promise.all(images.map((image) => image.decode())),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Изображения не загрузились за 15 секунд")), 15000)),
    ]);
  });
  const metrics = await page.evaluate(() => {
    const rect = (element) => element.getBoundingClientRect();
    const rows = (selector) => {
      const result = [];
      for (const element of document.querySelectorAll(selector)) {
        const top = Math.round(rect(element).top);
        const row = result.find((item) => Math.abs(item.top - top) < 2);
        if (row) row.count++; else result.push({ top, count: 1 });
      }
      return result.map((item) => item.count);
    };
    const hero = rect(document.querySelector(".internal-hero__shell"));
    const boundaries = [...document.querySelectorAll("main .container, .v3-header__inner, .v3-footer__inner")].filter((e) => rect(e).width > 0).map((e) => ({ selector: e.className, left: rect(e).left, right: rect(e).right }));
    const clipped = [...document.querySelectorAll("main h1, main h2, main h3, main p, main summary, main th, main td, .internal-popular-work span, .internal-symptoms span")].filter((e) => {
      const style = getComputedStyle(e);
      return rect(e).width > 0 && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 && ["hidden", "clip"].includes(style.overflowY));
    }).map((e) => e.textContent.trim());
    const brokenWords = [...document.querySelectorAll(".internal-timeline__item h3")].flatMap((element) => {
      const node = element.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return [];
      return [...node.textContent.matchAll(/\S+/g)].filter((word) => {
        const range = document.createRange();
        range.setStart(node, word.index);
        range.setEnd(node, word.index + word[0].length);
        return range.getClientRects().length > 1;
      }).map((word) => word[0]);
    });
    return { overflow: document.documentElement.scrollWidth - innerWidth, hero: { left: hero.left, right: hero.right }, boundaries, clipped, brokenWords,
      services: rows(".internal-service-card"), popular: rows(".internal-popular-work"), vehicles: rows(".internal-vehicle-card"), stages: rows(".internal-timeline__item"),
      serviceText: [...document.querySelectorAll(".internal-service-card p")].map((e) => parseFloat(getComputedStyle(e).fontSize)) };
  });
  assert(metrics.overflow <= 1, "Горизонтальная прокрутка");
  assert.deepEqual(metrics.clipped, [], `Обрезан текст: ${metrics.clipped.join("; ")}`);
  assert.deepEqual(metrics.brokenWords, [], "Заголовок этапа разорван внутри слова");
  for (const box of metrics.boundaries) assert(Math.abs(box.left - metrics.hero.left) <= 1 && Math.abs(box.right - metrics.hero.right) <= 1, `Направляющая ${box.selector}`);
  const repeated = (columns, length) => Array.from({ length: Math.ceil(length / columns) }, (_, i) => Math.min(columns, length - i * columns));
  assert.deepEqual(metrics.services, repeated(viewport.width <= 520 ? 1 : viewport.width <= 1020 ? 2 : viewport.width <= 1120 ? 3 : 6, 6));
  assert.deepEqual(metrics.vehicles, repeated(viewport.width <= 520 ? 1 : viewport.width <= 1020 ? 2 : 3, 6));
  assert.deepEqual(metrics.popular, repeated(viewport.width <= 520 ? 1 : viewport.width <= 1020 ? 2 : 4, sections.get("popularWorks").items.length), "Неполный ряд популярных работ нарушает сетку");
  assert.deepEqual(metrics.stages, repeated(viewport.width >= 1280 ? 5 : 1, 5));
  assert(metrics.serviceText.every((size) => size >= 14), "Шрифт карточек уменьшен");
  if (viewport.width === 1120) {
    // A Linux browser may not have the same hyphenation dictionary as Windows.
    const clippedWithoutDictionary = await page.locator(".internal-related-card__copy").evaluateAll((copies) => {
      const texts = copies.flatMap((copy) => [...copy.querySelectorAll("h3, p")]);
      texts.forEach((element) => { element.style.hyphens = "none"; });
      const clipped = texts
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.trim());
      texts.forEach((element) => { element.style.removeProperty("hyphens"); });
      return clipped;
    });
    assert.deepEqual(clippedWithoutDictionary, [], "Длинные слова не помещаются без словаря переносов");
  }
  if (viewport.width <= 720) {
    const undersized = await page.evaluate(() => [...document.querySelectorAll("a, button, summary")].filter((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.classList.contains("skip-link") && (box.width < 44 || box.height < 44);
    }).map((element) => element.textContent.trim()));
    assert.deepEqual(undersized, [], "Интерактивные цели меньше 44px");
  }

  if ([1440, 390].includes(viewport.width)) {
    if (viewport.width <= 720) {
      const toggle = page.locator("[data-brand-toggle]");
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert(await page.locator("[data-brand-panel]").isVisible());
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    }
    for (const summary of await page.locator(".internal-faq summary").all()) {
      await summary.focus();
      await page.keyboard.press("Enter");
      assert(await summary.evaluate((e) => e.parentElement.open), "FAQ не открылся");
      await page.keyboard.press("Space");
      assert(!await summary.evaluate((e) => e.parentElement.open), "FAQ не закрылся");
    }
    if (viewport.width <= 720) {
      await page.evaluate(() => { window.scrollTo(0, 760); window.dispatchEvent(new Event("scroll")); });
      await page.waitForFunction(() => document.querySelector("[data-mobile-callbar]").getAttribute("aria-hidden") === "false");
      assert.equal(await page.locator("[data-mobile-callbar] a").getAttribute("href"), "tel:+79224488822");
    }
  }
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
};
