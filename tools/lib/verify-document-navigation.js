const assert = require("node:assert/strict");
const path = require("node:path");

module.exports = async function verifyDocumentNavigation(browser, baseUrl, resultDir) {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
    const page = await context.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.locator(".v3-cert-strip").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.querySelectorAll('.v3-cert-card img')].every((img) => img.complete && img.naturalWidth));
      assert.equal(await page.locator(".v3-cert-card").count(), 2);
      assert.equal(await page.locator('[data-site-nav] a').filter({ hasText: "Сертификаты" }).count(), 0);
      const columns = await page.locator(".v3-cert-strip__grid").evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
      assert.equal(columns, width <= 720 ? 1 : 2);
      assert.equal(await page.locator('.v3-cert-card img').evaluateAll((images) => images.every((img) => getComputedStyle(img).objectFit === "contain")), true);
      await page.locator(".v3-cert-strip").screenshot({ path: path.join(resultDir, `home-documents-${width}.png`), style: "[data-mobile-callbar] {visibility:hidden!important}" });
      for (const id of ["maz", "conformity"]) {
        if (id !== "maz") await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.locator(`.v3-cert-card[href$="#document-${id}"]`).click();
        await page.waitForURL(`**/o-kompanii/#document-${id}`);
        await page.waitForFunction(() => document.querySelector('link[rel="stylesheet"][href*="/company.css"]')?.media === "all");
        await page.evaluate(() => document.fonts.ready);
        const card = page.locator(`#document-${id}`);
        await page.waitForFunction((id) => {
          const b = document.getElementById(`document-${id}`).getBoundingClientRect();
          return b.top >= -1 && b.top < innerHeight - 44;
        }, id);
        assert.equal(await page.locator('[data-site-nav] a[aria-current="page"]').textContent(), "О компании");
        await card.press("Enter");
        const viewer = page.locator("[data-company-viewer]");
        await viewer.waitFor({ state: "visible" });
        assert.equal(await page.locator("[data-company-counter]").textContent(), id === "conformity" ? "1 / 6" : "");
        await page.keyboard.press("Escape");
        assert(await card.evaluate((e) => document.activeElement === e));
      }
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.locator('.v3-footer a[href$="o-kompanii/#documents"]').click();
      await page.waitForURL("**/o-kompanii/#documents");
      assert.equal(await page.locator("#documents-title").textContent(), "Документы и сертификаты");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(overflow <= 1, `Documents ${width}px: overflow ${overflow}`);
    } finally { await context.close(); }
  }
  console.log("Document navigation checked: home previews, footer, anchors and viewer at 1440/390/320px.");
};
