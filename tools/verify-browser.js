const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const resultDir = path.join(root, "test-results", "browser");
const reviewDir = path.join(root, ".impeccable", "review");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const internalRoute = "/remont-gruzovyh-avtomobiley/";

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const relative = pathname.startsWith("/remsd/") ? pathname.slice("/remsd/".length) : pathname.replace(/^\/+/, "");
  const requested = path.resolve(distDir, relative);
  if (requested !== distDir && !requested.startsWith(`${distDir}${path.sep}`)) return null;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
  const index = path.join(requested, "index.html");
  return fs.existsSync(index) ? index : null;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const file = resolveRequest(request.url);
      if (!file) {
        response.writeHead(404, { "content-type": mime[".html"] });
        response.end(fs.readFileSync(path.join(distDir, "404.html")));
        return;
      }
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": mime[path.extname(file)] || "application/octet-stream",
      });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(port, host, () => resolve(server));
  });
}

async function verifyPage(page, route, label, { expectedStatus = 200 } = {}) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  const response = await page.goto(`http://${host}:${port}${route}`, { waitUntil: "domcontentloaded" });
  if (response?.status() !== expectedStatus) throw new Error(`${label}: HTTP ${response?.status()}, ожидался ${expectedStatus}`);
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => ({
    h1: document.querySelectorAll("h1").length,
    hrefHash: document.querySelectorAll('a[href="#"]').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    title: document.title,
  }));
  if (state.h1 !== 1) throw new Error(`${label}: найдено H1: ${state.h1}`);
  if (state.hrefHash) throw new Error(`${label}: найдено href=\"#\": ${state.hrefHash}`);
  if (state.overflow > 1) throw new Error(`${label}: горизонтальное переполнение ${state.overflow}px`);
  if (!state.title) throw new Error(`${label}: пустой title`);
  const relevantErrors = expectedStatus === 404
    ? errors.filter((error) => !/^console: Failed to load resource: the server responded with a status of 404/.test(error))
    : errors;
  if (expectedStatus === 404) {
    const assetsOk = await page.evaluate(() => {
      const headerLogo = document.querySelector(".v3-header img");
      return document.styleSheets.length > 0 && headerLogo instanceof HTMLImageElement && headerLogo.complete && headerLogo.naturalWidth > 0;
    });
    if (!assetsOk) throw new Error(`${label}: не загрузились CSS или изображения служебной страницы`);
  }
  if (relevantErrors.length) throw new Error(`${label}: ${relevantErrors.join("; ")}`);
}

async function verifyNavigation(page, collapsed) {
  const toggle = page.locator("[data-nav-toggle]");
  const nav = page.locator("[data-site-nav]");
  const state = await page.evaluate(() => {
    const button = document.querySelector("[data-nav-toggle]");
    const menu = document.querySelector("[data-site-nav]");
    return {
      toggleVisible: button instanceof HTMLElement && getComputedStyle(button).display !== "none",
      navHidden: menu?.hasAttribute("hidden") ?? true,
      navInert: menu?.hasAttribute("inert") ?? true,
    };
  });
  if (state.toggleVisible !== collapsed || state.navHidden !== collapsed || state.navInert !== collapsed) {
    throw new Error(`Шапка: collapsed=${collapsed}, state=${JSON.stringify(state)}`);
  }
  if (collapsed) {
    await toggle.click();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") throw new Error("Бургер не открыл меню");
  }
  const trigger = page.locator("[data-menu-toggle]").first();
  if (collapsed) await trigger.click();
  else {
    await trigger.focus();
    await page.keyboard.press("Enter");
  }
  if ((await trigger.getAttribute("aria-expanded")) !== "true") throw new Error("Подменю не открылось");
  const panel = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
  if (await panel.getAttribute("hidden") !== null || await panel.getAttribute("inert") !== null) throw new Error("Открытое подменю осталось hidden/inert");
  await page.keyboard.press("Escape");
  if ((await trigger.getAttribute("aria-expanded")) !== "false" || await panel.getAttribute("hidden") === null) throw new Error("Escape не закрыл подменю");
  if (collapsed && (await toggle.getAttribute("aria-expanded")) === "true") await page.keyboard.press("Escape");
  if (collapsed && (await toggle.getAttribute("aria-expanded")) !== "false") throw new Error("Escape не закрыл бургер");
  if (collapsed && (await nav.getAttribute("hidden")) === null) throw new Error("Закрытое мобильное меню осталось видимым");
}

async function verifyLightbox(page) {
  const opener = page.locator("[data-lightbox-item]").first();
  const dialog = page.locator("[data-media-lightbox]");
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  if (await dialog.getAttribute("hidden") !== null || await dialog.getAttribute("inert") !== null) throw new Error("Lightbox не открылся");
  await page.keyboard.press("Tab");
  if (!await page.evaluate(() => document.querySelector("[data-media-lightbox]")?.contains(document.activeElement))) throw new Error("Фокус вышел из lightbox");
  await page.keyboard.press("Escape");
  if (await dialog.getAttribute("hidden") === null) throw new Error("Escape не закрыл lightbox");
}

async function materializePage(page) {
  const blocks = page.locator("main > section, main > div");
  for (let index = 0; index < await blocks.count(); index += 1) await blocks.nth(index).scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelectorAll("main > *").forEach((item) => { item.style.contentVisibility = "visible"; });
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(200);
}

async function verifyInternalContract(page, mobile) {
  const callbar = page.locator("[data-mobile-callbar]");
  if (mobile && (await callbar.getAttribute("aria-hidden")) !== "true") throw new Error("Callbar видна до прокрутки");
  const expected = {
    ".internal-section": 9,
    ".internal-service-card": 6,
    ".internal-vehicle-card": 6,
    ".internal-brand-strip__item": 9,
    ".internal-symptoms li": 6,
    ".internal-timeline__item": 5,
    ".internal-price-table tbody tr": 8,
    ".internal-related-index span": 8,
    ".internal-faq details": 11,
  };
  for (const [selector, count] of Object.entries(expected)) {
    const actual = await page.locator(selector).count();
    if (actual !== count) throw new Error(`${internalRoute}: ${selector} — ${actual}, ожидалось ${count}`);
  }
  if ((await page.locator('nav[aria-label="Хлебные крошки"]').count()) !== 1) throw new Error("Нет хлебных крошек");
  if ((await page.locator("form").count()) !== 0) throw new Error("На внутренней странице появилась форма");
  if ((await page.locator("[class*=sidebar]").count()) !== 0) throw new Error("На внутренней странице появился sidebar");
  const ctas = page.locator("main a.v3-button");
  if ((await ctas.count()) !== 2) throw new Error(`Ожидалось 2 CTA, найдено ${await ctas.count()}`);
  for (let index = 0; index < await ctas.count(); index += 1) {
    if ((await ctas.nth(index).getAttribute("href")) !== "tel:+79224488822") throw new Error("CTA не ведёт на утверждённый телефон");
  }
  const jsonLdValid = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].every((script) => {
    try { JSON.parse(script.textContent); return true; } catch { return false; }
  }));
  if (!jsonLdValid) throw new Error("Невалидный JSON-LD в браузере");
  const summary = page.locator(".internal-faq summary").first();
  await summary.scrollIntoViewIfNeeded();
  await summary.focus();
  await page.keyboard.press("Enter");
  if (!await summary.locator("xpath=..").evaluate((details) => details.open)) throw new Error("FAQ не открывается с клавиатуры");
  await page.keyboard.press("Space");
  if (await summary.locator("xpath=..").evaluate((details) => details.open)) throw new Error("FAQ не закрывается с клавиатуры");
  const focusStyle = await page.locator(".internal-hero a.v3-button").evaluate((element) => {
    element.focus();
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height };
  });
  if (focusStyle.outline === "none") throw new Error("CTA не показывает focus-visible");
  if (focusStyle.width < 44 || focusStyle.height < 44) throw new Error("CTA меньше 44px");

  await materializePage(page);
  const brokenImages = await page.evaluate(() => [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.src));
  if (brokenImages.length) throw new Error(`Не загрузились изображения: ${brokenImages.join(", ")}`);

  if (mobile) {
    const undersized = await page.evaluate(() => [...document.querySelectorAll("a, button, summary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && !element.classList.contains("skip-link");
      })
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}:${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`));
    if (undersized.length) throw new Error(`Цели меньше 44px: ${undersized.slice(0, 8).join(", ")}`);
    await page.evaluate(() => {
      window.scrollTo(0, 760);
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForFunction(() => document.querySelector("[data-mobile-callbar]")?.getAttribute("aria-hidden") === "false", undefined, { timeout: 2000 });
  }
}

async function run() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error("Сначала соберите dist/");
  fs.mkdirSync(resultDir, { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const homeViewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 1120, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
    ];
    for (const viewport of homeViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, "/", `Главная ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      if (viewport.name === "desktop") await verifyLightbox(page);
      await page.screenshot({ path: path.join(resultDir, `home-${viewport.name}.png`) });
      await context.close();
    }

    const internalViewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 1120, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-320", width: 320, height: 760 },
    ];
    for (const viewport of internalViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, internalRoute, `Внутренняя ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      await verifyInternalContract(page, viewport.width <= 414);
      await page.evaluate(() => window.scrollTo(0, 0));
      const screenshotPath = path.join(resultDir, `internal-${viewport.name}-full.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      if (viewport.name === "desktop") fs.copyFileSync(screenshotPath, path.join(reviewDir, "internal-desktop.png"));
      if (viewport.name === "mobile-390") fs.copyFileSync(screenshotPath, path.join(reviewDir, "internal-mobile.png"));
      await context.close();
    }

    const page404Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page404 = await page404Context.newPage();
    await verifyPage(page404, "/route-that-must-not-exist/", "404", { expectedStatus: 404 });
    await page404Context.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log("Browser verification passed: главная 4 viewport, внутренний hub 5 viewport, burger, FAQ, callbar, images, targets и 404.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
