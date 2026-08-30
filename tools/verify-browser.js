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

function verifyMetricRange(label, measurements, min, max) {
  if (!measurements.length) throw new Error(`Desktop-контракт: не найден ${label}`);
  const invalid = measurements.filter(({ value }) => value < min || value > max);
  if (invalid.length) {
    const details = invalid.map(({ name, value }) => `${name}=${value.toFixed(1)}px`).join(", ");
    throw new Error(`Desktop-контракт: ${label} вне ${min}–${max}px (${details})`);
  }
}

async function verifyInternalDesktopVisualContract(page) {
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const measurements = (selector, readValue = (element) => element.getBoundingClientRect().height) =>
      [...document.querySelectorAll(selector)].map((element, index) => ({
        name: element.id || `${selector}[${index + 1}]`,
        value: readValue(element),
      }));
    const lineCount = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = [...range.getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => Math.round(rect.top));
      return new Set(lineTops).size;
    };
    const tokenProbe = document.createElement("div");
    tokenProbe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;padding-top:var(--section-space-default)";
    document.body.append(tokenProbe);
    const sectionSpaceDefault = parseFloat(getComputedStyle(tokenProbe).paddingTop);
    tokenProbe.remove();
    const introMedia = document.querySelector(".internal-intro__media");
    const introMediaRect = introMedia?.getBoundingClientRect();

    return {
      sectionSpaceDefault,
      sectionPaddings: [...document.querySelectorAll(".internal-section")].map((section, index) => {
        const style = getComputedStyle(section);
        return {
          name: section.id || `.internal-section[${index + 1}]`,
          top: parseFloat(style.paddingTop),
          bottom: parseFloat(style.paddingBottom),
        };
      }),
      headings: measurements(".internal-section h2", (element) => parseFloat(getComputedStyle(element).fontSize)),
      introRatio: introMediaRect ? introMediaRect.width / introMediaRect.height : 0,
      introStats: measurements(".internal-intro__stats > div"),
      services: measurements(".internal-service-card"),
      vehicles: measurements(".internal-vehicle-card"),
      brands: measurements(".internal-brand-strip__item"),
      symptoms: measurements(".internal-symptoms li"),
      stages: measurements(".internal-timeline__item"),
      priceRows: measurements(".internal-price-table tbody tr"),
      related: measurements(".internal-related-index span"),
      faq: [...document.querySelectorAll(".internal-faq summary")].map((element, index) => ({
        name: `.internal-faq summary[${index + 1}]`,
        value: element.getBoundingClientRect().height,
        lines: lineCount(element),
      })),
    };
  });

  if (metrics.sectionSpaceDefault < 103 || metrics.sectionSpaceDefault > 105) {
    throw new Error(`Desktop-контракт: --section-space-default=${metrics.sectionSpaceDefault}px, ожидалось около 104px`);
  }
  if (!metrics.sectionPaddings.length) throw new Error("Desktop-контракт: не найдены .internal-section");
  const invalidSectionPaddings = metrics.sectionPaddings.filter(({ top, bottom }) =>
    Math.abs(top - metrics.sectionSpaceDefault) > 1 || Math.abs(bottom - metrics.sectionSpaceDefault) > 1);
  if (invalidSectionPaddings.length) {
    const details = invalidSectionPaddings
      .map(({ name, top, bottom }) => `${name}=${top.toFixed(1)}/${bottom.toFixed(1)}px`)
      .join(", ");
    throw new Error(`Desktop-контракт: padding секций не равен --section-space-default (${details})`);
  }

  verifyMetricRange("заголовки секций", metrics.headings, 28, 32);
  if (metrics.introRatio < 1.95 || metrics.introRatio > 2.05) {
    throw new Error(`Desktop-контракт: intro-фото имеет соотношение ${metrics.introRatio.toFixed(2)}, ожидалось 2:1`);
  }
  verifyMetricRange("показатели intro", metrics.introStats, 88, 98);
  verifyMetricRange("карточки услуг", metrics.services, 220, 250);
  verifyMetricRange("карточки техники", metrics.vehicles, 180, 215);
  verifyMetricRange("ячейки марок", metrics.brands, 64, 72);
  verifyMetricRange("карточки признаков", metrics.symptoms, 68, 82);
  verifyMetricRange("карточки этапов", metrics.stages, 180, 205);
  verifyMetricRange("строки цен", metrics.priceRows, 40, 50);
  verifyMetricRange("связанные разделы", metrics.related, 52, 64);
  verifyMetricRange("FAQ summary", metrics.faq, 52, Number.POSITIVE_INFINITY);
  const oneLineFaq = metrics.faq.filter(({ lines }) => lines === 1);
  if (!oneLineFaq.length) throw new Error("Desktop-контракт: не найден однострочный FAQ summary для проверки плотности");
  verifyMetricRange("однострочные FAQ summary", oneLineFaq, 52, 64);
}

async function verifyInternalContract(page, compact) {
  const callbar = page.locator("[data-mobile-callbar]");
  if (compact && (await callbar.getAttribute("aria-hidden")) !== "true") throw new Error("Callbar видна до прокрутки");
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

  if (compact) {
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
      { name: "compact-720", width: 720, height: 900 },
      { name: "compact-520", width: 520, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-320", width: 320, height: 760 },
    ];
    for (const viewport of internalViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, internalRoute, `Внутренняя ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      await verifyInternalContract(page, viewport.width <= 720);
      if (viewport.name === "desktop") await verifyInternalDesktopVisualContract(page);
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
  console.log("Browser verification passed: главная 4 viewport, внутренний hub 7 viewport, desktop-геометрия, burger, FAQ, callbar, images, targets и 404.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
