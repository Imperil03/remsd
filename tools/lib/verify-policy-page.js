const assert = require("node:assert/strict");
const { policyText } = require("./policy-sections");

module.exports = async function verifyPolicyPage(page, viewport, definition) {
  const normalize = (text) => text.replace(/\s+/g, " ").trim();
  const actual = `${await page.locator("h1").innerText()} ${await page.locator(".policy-copy").innerText()}`;
  assert.equal(normalize(actual), policyText(definition), "Опубликованный текст политики не совпадает с утверждённым исходником");
  assert.equal(await page.locator(".policy-section").count(), 12);
  const summary = page.locator(".policy-contents summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  assert(await page.locator(".policy-contents").evaluate((element) => element.open), "Содержание не открывается с клавиатуры");
  for (const section of definition.sections) {
    assert.equal(await page.locator(`.policy-contents a[href="#${section.id}"]`).count(), 1);
    assert.equal(await page.locator(`#${section.id}`).count(), 1);
  }
  const destination = definition.sections[7].id;
  await page.locator(`.policy-contents a[href="#${destination}"]`).click();
  assert(new URL(page.url()).hash === `#${destination}`, "Ссылка содержания не ведёт к разделу");
  await summary.click();
  await page.locator(".v3-footer__legal a").scrollIntoViewIfNeeded();
  const footerLink = page.locator(".v3-footer__legal a");
  const target = await footerLink.boundingBox();
  assert(target.height >= 44, "Недостаточная высота ссылки на политику");
  assert(new URL(await footerLink.getAttribute("href"), page.url()).pathname.endsWith("/policy/"));
  assert(await page.locator(".v3-footer__legal p").isVisible());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `Политика ${viewport.width}: горизонтальное переполнение ${overflow}px`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
};
