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
  const state = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll("main h1, main h2, main p, main th, main td, main caption, main a")]
      .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    return { clipped, overflow: document.documentElement.scrollWidth - innerWidth,
      headerGap: document.querySelector('.internal-breadcrumbs').getBoundingClientRect().top - document.querySelector('.v3-header').getBoundingClientRect().bottom,
      columns: getComputedStyle(document.querySelector(".contacts-channels")).gridTemplateColumns.split(" ").length };
  });
  assert.deepEqual(state.clipped, [], `Текст не помещается: ${state.clipped.join("; ")}`);
  assert(state.overflow <= 1, `Переполнение ${state.overflow}px`);
  assert(state.headerGap >= 20, `Содержимое страницы перекрыто шапкой: ${state.headerGap}px`);
  assert.equal(state.columns, viewport.width <= 720 ? 1 : 2);
  for (const locator of [".contacts-primary__phone", ".contacts-email", ".contacts-messenger", ".contacts-download", ".contacts-copy"]) {
    const b = await page.locator(locator).boundingBox();
    assert(b.width >= 44 && b.height >= 44, `Малая область нажатия ${locator}`);
  }
  if ([1440, 390].includes(viewport.width)) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("[data-copy-requisites]").click();
    await page.waitForFunction(() => document.querySelector("[data-copy-status]").textContent === "Реквизиты скопированы");
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n"), cardText(site));
    const downloaded = page.waitForEvent("download");
    await page.locator(".contacts-download").focus();
    await page.keyboard.press("Enter");
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), "Реквизиты-РемСД.pdf");
    assert.deepEqual(fs.readFileSync(await download.path()), fs.readFileSync(path.join(__dirname, "../../assets/documents/remsd-requisites.pdf")));
    await page.locator(".contacts-copy-status").evaluate((e) => { e.textContent = ""; });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
};
