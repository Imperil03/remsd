const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { details, cardText } = require("./contact-details");
const site = require("../../src/data/site-config.json").site;

module.exports = async function verifyContactPage(page, viewport, definition, materializePage) {
  await materializePage(page);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[data-site-nav] a[aria-current="page"]').textContent(), "Контакты");
  assert.equal(await page.locator("main > section").count(), 3);
  assert.equal(await page.locator(".contacts-department").count(), 3);
  assert.equal(await page.locator(".contacts-bank").count(), 2);
  for (const item of details.departments) assert.equal(await page.locator(`.contacts-department a[href="${item.href}"]`).count(), 1);
  assert.equal(await page.locator(".contacts-primary__phone").getAttribute("href"), site.phoneHref);
  assert.equal(await page.locator(".contacts-messenger").getAttribute("href"), details.messengers[0].href);
  assert.equal(await page.locator(".contacts-map iframe").getAttribute("src"), details.map.embedUrl);
  assert.deepEqual(await page.locator('.contacts-shortcuts a').evaluateAll((links) => links.map((link) => link.hash)), ['#kak-dobratsya', '#rekvizity']);
  for (const item of details.departments) assert((await page.locator(`.contacts-department a[href="${item.href}"]`).getAttribute('aria-label')).includes(item.label));
  const state = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll("main h1, main h2, main p, main th, main td, main caption, main a")]
      .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    return { clipped, overflow: document.documentElement.scrollWidth - innerWidth,
      headerGap: document.querySelector('.internal-breadcrumbs').getBoundingClientRect().top - document.querySelector('.v3-header').getBoundingClientRect().bottom,
      columns: getComputedStyle(document.querySelector(".contacts-channels")).gridTemplateColumns.split(" ").length,
      departmentLabelSize: parseFloat(getComputedStyle(document.querySelector('.contacts-department h2')).fontSize),
      personSize: parseFloat(getComputedStyle(document.querySelector('.contacts-department p')).fontSize),
      departmentColumns: getComputedStyle(document.querySelector('.contacts-department')).gridTemplateColumns.split(' ').length,
      mapBottomGap: Math.abs(document.querySelector('.contacts-map').getBoundingClientRect().bottom-document.querySelector('.contacts-entrance').getBoundingClientRect().bottom),
      addressDecoration: getComputedStyle(document.querySelector('.contacts-address-link')).textDecorationLine };
  });
  assert.deepEqual(state.clipped, [], `Текст не помещается: ${state.clipped.join("; ")}`);
  assert(state.overflow <= 1, `Переполнение ${state.overflow}px`);
  assert(state.headerGap >= 20, `Содержимое страницы перекрыто шапкой: ${state.headerGap}px`);
  assert.equal(state.columns, viewport.width <= 720 ? 1 : 2);
  assert(state.departmentLabelSize >= 16 && state.personSize >= 14, 'Названия отделов и имена должны оставаться читаемыми');
  if (viewport.width <= 520) assert.equal(state.departmentColumns, 1, 'На телефоне номер располагается под названием отдела');
  if (viewport.width > 720) assert(state.mapBottomGap <= 1, `Низ карты и фото не выровнен: ${state.mapBottomGap}px`);
  assert.equal(state.addressDecoration, 'underline', 'Адрес должен быть заметной ссылкой к проезду');
  for (const locator of [".contacts-primary__phone", ".contacts-email", ".contacts-messenger", ".contacts-download", ".contacts-copy"]) {
    const b = await page.locator(locator).boundingBox();
    assert(b.width >= 44 && b.height >= 44, `Малая область нажатия ${locator}`);
  }
  if ([1440, 390].includes(viewport.width)) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("[data-copy-requisites]").click();
    await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Реквизиты скопированы");
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n"), cardText(site));
    assert.equal(await page.locator("[data-copy-status]").getAttribute("data-copy-state"), "success");
    assert(await page.locator("[data-copy-check]").isVisible(), "После копирования видна отметка подтверждения");
    await page.waitForFunction(() => {
      const result = document.querySelector('[data-copy-status]').getBoundingClientRect();
      const callbar = document.querySelector('[data-mobile-callbar]');
      const limit = callbar && callbar.getAttribute('aria-hidden') !== 'true' ? Math.min(innerHeight, callbar.getBoundingClientRect().top) : innerHeight;
      return result.top >= 0 && result.bottom <= limit - 8;
    });
    await page.screenshot({ path: path.join(__dirname, `../../test-results/browser/contacts-copy-success-${viewport.width}.png`), fullPage: false });
    if (viewport.width === 1440) {
      // Repeated keyboard use and reduced motion retain the same real outcome.
      await page.locator("[data-copy-requisites]").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector('[data-copy-status]').dataset.copyState === 'success' && !document.querySelector('[data-copy-requisites]').disabled);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator("[data-copy-requisites]").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector('[data-copy-status]').dataset.copyState === 'success' && !document.querySelector('[data-copy-requisites]').disabled);
      assert.equal(await page.locator('[data-copy-check] path').evaluate((element) => element.getAnimations().length), 0, 'Reduced motion сохраняет статическую отметку без рисования');
      await page.locator('.contacts-shortcuts a[href="#rekvizity"]').click();
      assert.equal(await page.locator('#rekvizity-title').evaluate((element) => getComputedStyle(element, '::after').animationName), 'none');
      await page.locator('.contacts-download').focus();
      assert.equal(await page.locator('.contacts-download svg').evaluate((element) => getComputedStyle(element).transform), 'none');
      await page.evaluate(() => {
        window.contactCopyOriginalWrite = navigator.clipboard.writeText;
        Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Clipboard blocked for test'); } });
      });
      try {
        await page.locator('[data-copy-requisites]').click();
        await page.waitForFunction(() => document.querySelector('[data-copy-status]').dataset.copyState === 'error');
        assert(await page.locator('[data-copy-check]').isHidden(), 'Ошибка не показывает отметку успеха');
        assert(await page.locator('[data-copy-requisites]').isEnabled(), 'После ошибки можно повторить копирование');
        assert.match(await page.locator('[data-copy-message]').textContent(), /Не удалось скопировать/);
      } finally {
        await page.evaluate(() => {
          Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: window.contactCopyOriginalWrite });
          delete window.contactCopyOriginalWrite;
        });
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
    }
    const downloaded = page.waitForEvent("download");
    await page.locator(".contacts-download").focus();
    await page.keyboard.press("Enter");
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), "Реквизиты-РемСД.pdf");
    assert.deepEqual(fs.readFileSync(await download.path()), fs.readFileSync(path.join(__dirname, "../../assets/documents/remsd-requisites.pdf")));
    await page.locator(".contacts-copy-status").evaluate((e) => {
      e.querySelector('[data-copy-message]').textContent = '';
      e.querySelector('[data-copy-check]').setAttribute('hidden', '');
      delete e.dataset.copyState;
    });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
};
