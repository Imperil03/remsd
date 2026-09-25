const assert = require("node:assert/strict");

module.exports = async function verifyCompanyPage(page, viewport, definition, materializePage) {
  assert.equal(await page.locator(".company-contact__map iframe").getAttribute("src"), null, "Карта загружается до прокрутки к контактам");
  await materializePage(page);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("main > section").count(), 8);
  assert.equal(await page.locator("main a.v3-button").count(), 2);
  assert.equal(await page.locator('[data-site-nav] a[aria-current="page"]').textContent(), "О компании");
  assert.equal(await page.locator(".company-document").count(), 2);
  assert.equal(await page.locator(".company-documents__group").count(), 0);
  assert.equal(await page.locator(".company-story__stages > li").count(), 3);
  assert.equal(await page.locator(".company-team__roles > div").count(), 4);
  const result = await page.evaluate(() => {
    const bounds = (e) => e.getBoundingClientRect();
    const visible = (e) => bounds(e).width && bounds(e).height;
    const clipped = [...document.querySelectorAll("main h1, main h2, main h3, main h4, main p, main dt, main dd, main figcaption")]
      .filter((e) => visible(e) && !e.classList.contains("company-visually-hidden") && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    const meta = document.querySelector(".v3-header__meta");
    const hero = document.querySelector(".company-hero__inner");
    const phone = document.querySelector(".v3-header__phone");
    const company = document.querySelector('[data-site-nav] a[href$="o-kompanii/"]');
    const facts = [...document.querySelectorAll(".company-facts dl > div")].map((e) => Math.round(bounds(e).top));
    return { overflow: document.documentElement.scrollWidth - innerWidth, clipped,
      metaVisible: getComputedStyle(meta).display !== "none", phoneVisible: visible(phone),
      navOverflow: company && visible(company) ? bounds(company).right > bounds(document.querySelector(".v3-header")).right : false,
      heroColumns: getComputedStyle(hero).gridTemplateColumns.split(" ").length, factsRows: new Set(facts).size,
      documentColumns: getComputedStyle(document.querySelector(".company-documents__grid")).gridTemplateColumns.split(" ").length };
  });
  assert(result.overflow <= 1, `Company overflow ${result.overflow}px`);
  assert.deepEqual(result.clipped, [], `Company clipped: ${result.clipped.join("; ")}`);
  assert.equal(result.metaVisible, viewport.width > 1280, "Метаданные шапки должны скрываться до 1280px");
  assert(!result.navOverflow, "Пункт компании выходит за шапку");
  assert.equal(result.heroColumns, viewport.width <= 720 ? 1 : 2);
  assert.equal(result.factsRows, viewport.width <= 720 ? 2 : 1);
  assert.equal(result.documentColumns, viewport.width <= 720 ? 1 : 2);
  for (const cta of await page.locator("main a.v3-button").all()) {
    assert.equal(await cta.getAttribute("href"), "tel:+79224488822");
    const b = await cta.boundingBox();
    assert(b.width >= 44 && b.height >= 44);
  }
  if ([1440, 390].includes(viewport.width)) {
    const dialog = page.locator("[data-company-viewer]");
    const photo = page.locator('[data-company-media="company-base"]').first();
    await photo.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await page.locator("[data-company-counter]").textContent(), "1 / 3");
    await page.locator("[data-company-next]").click();
    assert.equal(await page.locator("[data-company-counter]").textContent(), "2 / 3");
    await page.locator("[data-company-close]").click();
    assert(await photo.evaluate((e) => document.activeElement === e));
  }
};
