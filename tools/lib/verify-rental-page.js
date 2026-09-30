const assert = require("node:assert/strict");
const { loadRentalCatalog, formatRate } = require("./rental-sections");
const awaitPhotos = (page) => page.waitForFunction(() => [...document.querySelectorAll('.rental-category img, .rental-machine img')].every((image) => image.complete && image.naturalWidth > 0));

module.exports = async function verifyRentalPage(page, viewport, definition, materializePage) {
  const catalog = loadRentalCatalog();
  await materializePage(page);
  await awaitPhotos(page);
  assert.equal(await page.locator("main .internal-section").count(), definition.sections.length);
  assert.equal(await page.locator("main a.v3-button").count(), 2);
  assert.equal(await page.locator("main .rental-messenger").count(), 2);
  assert.equal(await page.locator("form").count(), 0);
  assert.equal(await page.locator('.main-nav__group--rent a[aria-current="page"]').count(), 1);
  // The callbar can become hidden after materialization scrolls back to the top.
  // Check its stored caption independently of that transient visibility state.
  assert.equal(await page.locator('[data-mobile-callbar] .mobile-callbar__text').textContent(), definition.mobileCallbar.text);
  for (const cta of await page.locator('main a.v3-button').all()) assert.equal(await cta.getAttribute('href'), 'tel:+79224488822');
  if (definition.path === "arenda") {
    assert.equal(await page.locator(".rental-categories--equipment .rental-category").count(), 9);
    assert.equal(await page.locator(".rental-categories--service .rental-category").count(), 2);
    assert.equal(await page.locator(".rental-rate-table tbody tr").count(), 9);
  } else {
    const category = catalog.categories.find((item) => item.path === definition.path);
    assert.equal(await page.locator(".rental-machine").count(), category.equipmentIds.length);
    for (const id of category.equipmentIds) {
      const machine = page.locator(`[data-equipment-id="${id}"]`);
      for (const rate of catalog.equipment.find((item) => item.id === id).rates) assert((await machine.innerText()).includes(formatRate(rate)));
    }
  }
  const metrics = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll('main h1, main h2, main h3, main p, main dt, main dd, main th, main td')].filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim());
    const photos = [...document.querySelectorAll('.rental-category img, .rental-machine img')].filter((el) => !el.complete || !el.naturalWidth).map((el) => el.src);
    // Shared header controls have their own viewport contract in verifyNavigation.
    const shortTargets = [...document.querySelectorAll('main a, main summary')].filter((el) => {const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && !el.closest('[inert], .site-header-rail') && !el.classList.contains('skip-link') && (r.width<44 || r.height<44);}).map((el) => el.textContent.trim());
    return {overflow:document.documentElement.scrollWidth-innerWidth,clipped,photos,shortTargets};
  });
  assert(metrics.overflow <= 1, 'Горизонтальная прокрутка');
  assert.deepEqual(metrics.clipped, [], `Обрезанный текст: ${metrics.clipped.join('; ')}`);
  assert.deepEqual(metrics.photos, [], 'Фотографии не загрузились');
  assert.deepEqual(metrics.shortTargets, [], `Цели меньше 44px: ${metrics.shortTargets.join('; ')}`);
  const summary=page.locator('.internal-faq summary').first();
  if(await summary.count()) {
    await summary.focus(); await page.keyboard.press('Enter');
    assert(await summary.evaluate(el=>el.parentElement.open));
    await page.keyboard.press('Space'); assert(!(await summary.evaluate(el=>el.parentElement.open)));
  }
  if ([1440,390].includes(viewport.width)) {
    await page.evaluate(() => window.scrollTo(0, 0));
    if (viewport.width <= 1120) {
      await page.locator('[data-nav-toggle]').click();
      // Opening the burger transfers focus on the next animation frame.
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-site-nav] [data-menu-toggle]'));
    }
    const rentalToggle = page.locator('[aria-controls="main-nav-rent"]');
    await rentalToggle.focus();
    await page.keyboard.press('Enter');
    const lastRentalLink = page.locator('#main-nav-rent a').last();
    await lastRentalLink.waitFor({ state: 'visible' });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('main-nav-rent')).opacity === '1');
    await lastRentalLink.focus();
    await page.waitForFunction(() => { const links=document.querySelectorAll('#main-nav-rent a'); const r=links[links.length-1].getBoundingClientRect(); return r.height>0 && r.top>=0 && r.bottom<=innerHeight+1; });
    const lastBox = await lastRentalLink.boundingBox();
    assert(lastBox && lastBox.y >= 0 && lastBox.y + lastBox.height <= viewport.height + 1, 'Последний пункт аренды недоступен в меню');
    assert.equal(await page.locator('[data-mobile-callbar]').getAttribute('aria-hidden'), 'true');
    await page.keyboard.press('Escape');
    if (viewport.width <= 1120 && await page.locator('[data-nav-toggle]').getAttribute('aria-expanded') === 'true') await page.keyboard.press('Escape');
    const jump=page.locator('.rental-jump a').first();
    await jump.focus();
    assert.notEqual(await jump.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    await jump.click();
    assert(await page.evaluate(()=>location.hash.length>1));
    if(definition.path==='arenda') {
      await page.locator('.rental-categories--equipment a').first().click();
      assert(new URL(page.url()).pathname.endsWith('/arenda/avtokrany/'));
      await page.locator('.internal-breadcrumbs a').last().click();
      assert(new URL(page.url()).pathname.endsWith('/arenda/'));
      // Returning to the hub creates a new document: settle deferred CSS and lazy images again.
      await materializePage(page);
      await page.evaluate(() => document.fonts.ready);
      await awaitPhotos(page);
    }
  }
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
};
