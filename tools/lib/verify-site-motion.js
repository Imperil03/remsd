const assert = require("node:assert/strict");
const path = require("node:path");

module.exports = async function verifySiteMotion(browser, baseUrl, resultDir, catalog) {
  const references = Object.values(catalog.manifest.referenceByFamily);
  const allRoutes = [...new Set(["", ...references, "arenda", "policy"])];
  const requested = (process.env.MOTION_ROUTES || '').split(',').map((route) => route.trim()).filter(Boolean).map((route) => route.replace(/^\/+|\/+$/g, ''));
  for (const route of requested) assert(allRoutes.includes(route), `Unknown motion review route: ${route}`);
  const routes = requested.length ? allRoutes.filter((route) => requested.includes(route)) : allRoutes;
  for (const width of [1440, 390]) for (const route of routes) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
    await context.addInitScript(() => {
      window.motionProbe = [];
      const native = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        const record = { ghost: this.hasAttribute('data-motion-ghost'), duration: options?.duration, frames, ended: false, cancelled: false };
        window.motionProbe.push(record);
        const animation = native.call(this, frames, options);
        animation.finished.then(() => { record.ended = true; }, () => { record.cancelled = true; });
        return animation;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const settle = () => page.waitForFunction(() => document.querySelectorAll('[data-motion-ghost]').length === 0);
    try {
      await page.goto(new URL(route ? `${route}/` : "", baseUrl).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every((link) => link.media === '' || link.media === 'all'));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => typeof window.REMSDMotion?.panelEnter === 'function');
      assert.equal(await page.locator('[data-site-nav]').count(), 1);
      const toggle = page.locator('[data-nav-toggle]');
      if (width <= 1120) {
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('[data-site-nav]').getAttribute('inert'), '');
        await toggle.click();
        assert.equal(await page.locator('[data-site-nav]').getAttribute('hidden'), null);
        await page.keyboard.press('Escape');
      } else {
        await page.locator('[data-menu-toggle]').first().focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-menu-toggle]').first().getAttribute('aria-expanded'), 'true');
        const linkColor = await page.locator('[data-menu-panel]').first().locator('.main-nav__column > a').first().evaluate((element) => getComputedStyle(element).color);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-menu-toggle]').first().getAttribute('aria-expanded'), 'false');
        const ghost = page.locator('body > [data-motion-ghost] .main-nav__column > a').first();
        if (await ghost.count()) assert.equal(await ghost.evaluate((element) => getComputedStyle(element).color), linkColor, 'Closing snapshot must preserve navigation colors');
      }
      await settle();
      assert(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map((element) => element.id); return ids.length === new Set(ids).size; }), 'Motion snapshots must not duplicate IDs');
      const disclosure = page.locator('.internal-faq details').first();
      if (await disclosure.count()) {
        const summary = disclosure.locator('summary');
        await summary.focus();
        await page.keyboard.press('Enter');
        assert(await disclosure.evaluate((element) => element.open));
        await page.keyboard.press('Enter');
        assert(!await disclosure.evaluate((element) => element.open));
        await page.keyboard.press('Enter');
        assert(await disclosure.evaluate((element) => element.open));
        await settle();
        await page.waitForFunction(() => document.querySelectorAll('.internal-faq').length === 0 || [...document.querySelector('.internal-faq').querySelectorAll('*')].every((element) => element.getAnimations().length === 0));
        await page.keyboard.press('Enter');
        await settle();
      }
      const opener = page.locator('[data-lightbox-item], [data-company-media]').first();
      let gallerySource;
      if (await opener.count()) {
        await opener.scrollIntoViewIfNeeded();
        const src = await opener.evaluate((element) => {
          if (element.hasAttribute('data-lightbox-item')) return element.dataset.largeSrc || element.querySelector('img').src;
          const groups = JSON.parse(document.getElementById('company-media-data').textContent);
          return groups[element.dataset.companyMedia][Number(element.dataset.mediaIndex) || 0].src;
        });
        gallerySource = src;
        await page.evaluate(async (url) => { const image = new Image(); image.src = url; await image.decode(); }, src);
        await opener.click();
        const viewer = page.locator('[data-media-lightbox], [data-company-viewer]');
        await viewer.waitFor({ state: 'visible' });
        assert.equal(await viewer.count(), 1);
        await page.keyboard.press('Escape');
        await viewer.waitFor({ state: 'hidden' });
        await settle();
        if (await page.locator('[data-company-viewer]').count()) {
          // Native close events are queued: replay close/reopen in one task.
          await opener.click();
          await page.evaluate(() => {
            window.motionCloseSeen = false;
            document.querySelector('[data-company-viewer]').addEventListener('close', () => { window.motionCloseSeen = true; }, { once: true });
            document.querySelector('[data-company-close]').click();
            document.querySelector('[data-company-media]').click();
          });
          await page.waitForFunction(() => window.motionCloseSeen);
          assert(await page.evaluate(() => document.querySelector('[data-company-viewer]').open && document.querySelector('[data-company-image]').getAttribute('src') && document.body.classList.contains('is-company-viewer-open')), 'A queued close must not clear the reopened viewer');
          await page.keyboard.press('Escape');
          await settle();
          if (width === 1440) {
            await page.locator('[data-menu-toggle]').first().focus();
            await page.keyboard.press('Enter');
            await opener.evaluate((element) => element.click());
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('[data-company-viewer]').open);
            await settle();
            await page.keyboard.press('Escape');
            await settle();
          }
        }
      }
      if (route === 'sertifikaty') {
        const documentLink = page.locator('#document-advers');
        if (await documentLink.count()) {
          const source = await documentLink.evaluate((element) => JSON.parse(document.getElementById('company-media-data').textContent)[element.dataset.companyMedia][0].src);
          await page.evaluate(async (url) => { const image = new Image(); image.src = url; await image.decode(); }, source);
          await page.evaluate(() => { window.motionProbe = []; });
          await documentLink.click();
          await page.waitForFunction(() => window.motionProbe.some((entry) => entry.ghost && entry.duration === 350));
          const record = await page.evaluate(() => window.motionProbe.find((entry) => entry.ghost && entry.duration === 350));
          assert.match(record.frames[0].clipPath, /^inset\(0px 0px 0px 0px\)$/, 'Complete landscape scans must not be cropped to fill portrait previews');
          await page.keyboard.press('Escape');
          await settle();
        }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => { window.motionProbe = []; });
      if (width <= 1120) { await toggle.click(); await toggle.click(); }
      else { await page.locator('[data-menu-toggle]').first().focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); }
      if (await disclosure.count()) { await disclosure.locator('summary').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); }
      assert.equal(await page.evaluate(() => window.motionProbe.length), 0, 'Reduced motion must not launch WAAPI sequences');
      await settle();
      if (route === 'o-kompanii' && width === 1440) {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate((src) => {
          window.motionProbe = [];
          const viewer = document.createElement('div');
          viewer.id = 'motion-load-fixture';
          viewer.style.cssText = 'position:fixed;top:120px;left:120px;width:320px;height:180px;pointer-events:none';
          const image = document.createElement('img');
          image.style.cssText = 'width:320px;height:180px;object-fit:contain';
          viewer.append(image);
          document.body.append(viewer);
          window.REMSDMotion.viewerEnter(viewer, image, {x:20,y:20,width:80,height:60,position:[.5,.5],fit:'cover'});
          setTimeout(() => { image.src = src; }, 200);
        }, gallerySource);
        await page.waitForFunction(() => window.motionProbe.some((entry) => entry.ghost && entry.duration === 350 && entry.ended));
        assert.equal(await page.evaluate(() => window.motionProbe.find((entry) => entry.ghost && entry.duration === 350).cancelled), false, 'Loading deadline must not cancel an animation that has started');
        await settle();
        await page.evaluate(() => document.getElementById('motion-load-fixture').remove());
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false);
      assert.deepEqual(errors, [], `${route || '/'} page errors`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(resultDir, `motion-${route.replaceAll('/', '-') || 'home'}-${width}.png`), fullPage: false });
      console.log(`Motion checked ${route || '/'} ${width}px: repeat, keyboard, cleanup and reduced motion`);
    } finally { await context.close(); }
  }
};
