const assert = require("node:assert/strict");

module.exports = async function verifyCertificatesPage(page, viewport, definition, materializePage) {
  await materializePage(page);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[data-site-nav] a[aria-current="page"]').textContent(), "Сертификаты");
  assert.equal(await page.locator("main > section").count(), 2);
  assert.equal(await page.locator(".company-document").count(), 5);
  assert.deepEqual(await page.locator(".company-documents__group > h2").allTextContents(), ["Сервисные полномочия", "Обучение специалистов", "Соответствие услуг"]);
  const result = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll("main h1, main h2, main h3, main p")].filter((e) => e.clientWidth && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
    return { clipped, overflow: document.documentElement.scrollWidth - innerWidth,
      headerGap: document.querySelector('.internal-breadcrumbs').getBoundingClientRect().top - document.querySelector('.v3-header').getBoundingClientRect().bottom,
      columns: getComputedStyle(document.querySelector('.company-documents__grid')).gridTemplateColumns.split(' ').length,
      contained: [...document.querySelectorAll('.company-document img')].every((e) => getComputedStyle(e).objectFit === 'contain') };
  });
  assert.deepEqual(result.clipped, [], `Certificates clipped: ${result.clipped.join('; ')}`);
  assert(result.overflow <= 1);
  assert(result.headerGap >= 20);
  assert(result.contained);
  assert.equal(result.columns, viewport.width <= 720 ? 1 : 2);
  if ([1440, 390].includes(viewport.width)) {
    const opener = page.locator('#document-conformity');
    await opener.press('Enter');
    const dialog = page.locator('[data-company-viewer]');
    await dialog.waitFor({ state: 'visible' });
    for (let sheet = 1; sheet <= 6; sheet++) {
      if (sheet > 1) await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('[data-company-counter]').textContent(), `${sheet} / 6`);
      assert((await page.locator('[data-company-image]').getAttribute('src')).endsWith(`conformity-0${sheet}.webp`));
      await page.waitForFunction(() => { const image = document.querySelector('[data-company-image]'); return image.complete && image.naturalWidth > 0; });
    }
    assert(await page.locator('[data-company-next]').isDisabled());
    for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); assert(await dialog.evaluate((e) => e.contains(document.activeElement))); }
    await page.keyboard.press('Escape');
    assert(!await dialog.isVisible());
    assert(await opener.evaluate((e) => document.activeElement === e));
    await page.locator('#document-maz').press('Enter');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-company-counter]').textContent(), '');
    assert(!await page.locator('[data-company-next]').isVisible());
    await page.keyboard.press('Escape');
    assert(await page.locator('#document-maz').evaluate((e) => document.activeElement === e));
    await page.evaluate(() => window.scrollTo(0, 0));
  }
};
