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
  if (!measurements.length) throw new Error(`Визуальный контракт: не найден ${label}`);
  const invalid = measurements.filter(({ value }) => value < min || value > max);
  if (invalid.length) {
    const details = invalid.map(({ name, value }) => `${name}=${value.toFixed(1)}px`).join(", ");
    throw new Error(`Визуальный контракт: ${label} вне ${min}–${max}px (${details})`);
  }
}

function verifyRows(label, actual, expected) {
  if (actual.length !== expected.length || actual.some((count, index) => count !== expected[index])) {
    throw new Error(`Визуальный контракт: ${label} образует ряды ${actual.join("+")}, ожидалось ${expected.join("+")}`);
  }
}

function repeatedRows(columns, items) {
  const rows = [];
  for (let remaining = items; remaining > 0; remaining -= columns) rows.push(Math.min(columns, remaining));
  return rows;
}

async function verifyInternalVisualContract(page, viewport) {
  await materializePage(page);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const measurements = (selector, readValue = (element) => element.getBoundingClientRect().height) =>
      [...document.querySelectorAll(selector)].map((element, index) => ({
        name: element.id || `${selector}[${index + 1}]`,
        value: readValue(element),
      }));
    const dimensions = (selector) => [...document.querySelectorAll(selector)].map((element, index) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        name: element.id || `${selector}[${index + 1}]`,
        width: rect.width,
        height: rect.height,
        minHeight: parseFloat(style.minHeight) || 0,
      };
    });
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const rowCounts = (selector) => {
      const rows = [];
      [...document.querySelectorAll(selector)]
        .map((element) => element.getBoundingClientRect())
        .sort((left, right) => left.top - right.top || left.left - right.left)
        .forEach((rect) => {
          let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) <= 3);
          if (!row) {
            row = { top: rect.top, count: 0 };
            rows.push(row);
          }
          row.count += 1;
        });
      return rows.map(({ count }) => count);
    };
    const tokenValue = (token) => {
      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;padding-top:var(${token})`;
      document.body.append(probe);
      const value = parseFloat(getComputedStyle(probe).paddingTop);
      probe.remove();
      return value;
    };
    const introMedia = document.querySelector(".internal-intro__media");
    const introMediaRect = introMedia?.getBoundingClientRect();
    const clippingSelectors = [
      ".internal-service-card h3", ".internal-service-card p",
      ".internal-vehicle-card__copy", ".internal-symptoms span",
      ".internal-timeline h3", ".internal-timeline p",
      ".internal-price-table th", ".internal-price-table td",
      ".internal-related-index span", ".internal-faq summary",
      ".internal-inline-cta__content", ".internal-inline-cta .v3-button",
    ];
    const clipped = clippingSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => element.scrollWidth - element.clientWidth > 2 || element.scrollHeight - element.clientHeight > 2)
      .map((element, index) => `${selector}[${index + 1}]`));
    const boundedSelectors = [
      ".internal-service-card", ".internal-vehicle-card", ".internal-brand-strip__item",
      ".internal-symptoms li", ".internal-inline-cta", ".internal-timeline__item",
      ".internal-price-table", ".internal-related-index span", ".internal-faq details",
    ];
    const outOfViewport = boundedSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1.5 || rect.right > document.documentElement.clientWidth + 1.5;
      })
      .map((element, index) => `${selector}[${index + 1}]`));

    return {
      sectionSpaceDefault: tokenValue("--section-space-default"),
      sectionSpaceCompact: tokenValue("--section-space-compact"),
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
      serviceCards: dimensions(".internal-service-card"),
      serviceTitles: measurements(".internal-service-card h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      serviceBodies: measurements(".internal-service-card p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      serviceIcons: measurements(".internal-service-card__icon", (element) => element.getBoundingClientRect().width),
      vehicleCards: dimensions(".internal-vehicle-card"),
      vehicleTitles: measurements(".internal-vehicle-card h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      vehicleBodies: measurements(".internal-vehicle-card p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      brandCells: dimensions(".internal-brand-strip__item"),
      brandLogoWidths: measurements(".internal-brand-strip img", (element) => element.getBoundingClientRect().width),
      brandLogoHeights: measurements(".internal-brand-strip img", (element) => element.getBoundingClientRect().height),
      symptoms: dimensions(".internal-symptoms li"),
      symptomText: measurements(".internal-symptoms li", (element) => parseFloat(getComputedStyle(element).fontSize)),
      symptomIcons: measurements(".internal-symptom__icon", (element) => element.getBoundingClientRect().width),
      stages: dimensions(".internal-timeline__item"),
      stageIcons: measurements(".internal-timeline__icon", (element) => element.getBoundingClientRect().width),
      stageTitles: measurements(".internal-timeline h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      stageBodies: measurements(".internal-timeline p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      priceRows: measurements(".internal-price-table tbody tr"),
      priceLabels: measurements(".internal-price-table th", (element) => parseFloat(getComputedStyle(element).fontSize)),
      priceValues: measurements(".internal-price-table td", (element) => parseFloat(getComputedStyle(element).fontSize)),
      related: measurements(".internal-related-index span"),
      relatedText: measurements(".internal-related-index span", (element) => parseFloat(getComputedStyle(element).fontSize)),
      faq: measurements(".internal-faq summary"),
      faqText: measurements(".internal-faq summary", (element) => parseFloat(getComputedStyle(element).fontSize)),
      rows: {
        services: rowCounts(".internal-service-card"),
        vehicles: rowCounts(".internal-vehicle-card"),
        brands: rowCounts(".internal-brand-strip__item"),
        symptoms: rowCounts(".internal-symptoms li"),
        stages: rowCounts(".internal-timeline__item"),
        prices: rowCounts(".internal-price-table"),
        related: rowCounts(".internal-related-index span"),
        faq: rowCounts(".internal-faq details"),
      },
      boxes: {
        symptomsMain: box(".internal-symptoms"),
        symptomsCta: box(".internal-inline-cta--symptoms"),
        priceMain: box(".internal-price-main"),
        priceCta: box(".internal-inline-cta--prices"),
      },
      mainCtas: dimensions("main a.v3-button"),
      clipped,
      outOfViewport,
    };
  });

  const width = viewport.width;
  const wide = width > 1020;
  const compact = width <= 720;
  const narrow = width <= 520;
  const compactSections = new Set(["repair-services", "vehicle-types", "truck-brands", "repair-process", "related-services"]);
  if (!metrics.sectionPaddings.length) throw new Error("Визуальный контракт: не найдены .internal-section");
  if (!compact && metrics.sectionSpaceDefault - metrics.sectionSpaceCompact < 20) {
    throw new Error(`Визуальный контракт: default/compact ритм не различим (${metrics.sectionSpaceDefault.toFixed(1)}/${metrics.sectionSpaceCompact.toFixed(1)}px)`);
  }
  const invalidSectionPaddings = metrics.sectionPaddings.filter(({ name, top, bottom }) => {
    const expected = compact || compactSections.has(name) ? metrics.sectionSpaceCompact : metrics.sectionSpaceDefault;
    return Math.abs(top - expected) > 1.5 || Math.abs(bottom - expected) > 1.5;
  });
  if (invalidSectionPaddings.length) {
    const details = invalidSectionPaddings
      .map(({ name, top, bottom }) => `${name}=${top.toFixed(1)}/${bottom.toFixed(1)}px`)
      .join(", ");
    throw new Error(`Визуальный контракт: нарушен переменный ритм секций (${details})`);
  }

  const headingRanges = {
    1440: [39.4, 40.6],
    1120: [35.4, 36.6],
    720: [31.4, 32.6],
    520: [31.4, 32.6],
    414: [31.4, 32.6],
    390: [30.5, 32],
    320: [29.4, 30.6],
  };
  const [headingMin, headingMax] = headingRanges[width];
  verifyMetricRange("заголовки секций", metrics.headings, headingMin, headingMax);
  if (metrics.introRatio < 1.95 || metrics.introRatio > 2.05) {
    throw new Error(`Визуальный контракт: intro-фото имеет соотношение ${metrics.introRatio.toFixed(2)}, ожидалось 2:1`);
  }
  verifyMetricRange("показатели intro", metrics.introStats, 104, 124);

  verifyRows("услуги", metrics.rows.services, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("техника", metrics.rows.vehicles, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("марки", metrics.rows.brands, wide ? [5, 4] : repeatedRows(narrow ? 2 : 3, 9));
  verifyRows("признаки", metrics.rows.symptoms, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("этапы", metrics.rows.stages, repeatedRows(wide ? 5 : 1, 5));
  verifyRows("таблицы цен", metrics.rows.prices, repeatedRows(compact ? 1 : 2, 2));
  verifyRows("связанные разделы", metrics.rows.related, repeatedRows(wide ? 4 : narrow ? 1 : 2, 8));
  verifyRows("FAQ", metrics.rows.faq, repeatedRows(width > 720 ? 2 : 1, 11));

  verifyMetricRange("заголовки услуг", metrics.serviceTitles, narrow ? 17.4 : 18.4, narrow ? 18.6 : 19.6);
  verifyMetricRange("текст услуг", metrics.serviceBodies, 15.4, 16.6);
  verifyMetricRange("иконки услуг", metrics.serviceIcons, narrow ? 50 : 54, narrow ? 54 : 58);
  verifyMetricRange("заголовки техники", metrics.vehicleTitles, narrow ? 16.4 : 19.4, narrow ? 17.6 : 20.6);
  verifyMetricRange("текст техники", metrics.vehicleBodies, 15.4, 16.6);
  verifyMetricRange("текст признаков", metrics.symptomText, 15.4, 16.6);
  verifyMetricRange("иконки признаков", metrics.symptomIcons, narrow ? 34 : 38, narrow ? 38 : 42);
  verifyMetricRange("иконки этапов", metrics.stageIcons, narrow ? 54 : 62, narrow ? 58 : 66);
  verifyMetricRange("заголовки этапов", metrics.stageTitles, 17.4, 18.6);
  verifyMetricRange("текст этапов", metrics.stageBodies, 15.4, 16.6);
  verifyMetricRange("названия цен", metrics.priceLabels, 15.4, 16.6);
  verifyMetricRange("значения цен", metrics.priceValues, narrow ? 16.4 : 17.4, narrow ? 17.6 : 18.6);
  verifyMetricRange("текст связанных разделов", metrics.relatedText, 15.4, 16.6);
  verifyMetricRange("текст FAQ", metrics.faqText, 16.4, 17.6);

  if (narrow) {
    const fixedServices = metrics.serviceCards.filter(({ minHeight }) => minHeight > 1);
    const fixedVehicles = metrics.vehicleCards.filter(({ minHeight }) => minHeight > 1);
    if (fixedServices.length || fixedVehicles.length) throw new Error("Визуальный контракт: горизонтальные mobile-карточки сохранили фиксированную высоту");
  } else {
    verifyMetricRange("высота карточек услуг", metrics.serviceCards.map(({ name, height: value }) => ({ name, value })), 208, 290);
    verifyMetricRange("высота карточек техники", metrics.vehicleCards.map(({ name, height: value }) => ({ name, value })), 298, 410);
  }
  verifyMetricRange("ячейки марок", metrics.brandCells.map(({ name, height: value }) => ({ name, value })), narrow ? 90 : 102, narrow ? 100 : 114);
  verifyMetricRange("ширина логотипов", metrics.brandLogoWidths, narrow ? 78 : width <= 1020 ? 88 : 98, narrow ? 114 : width <= 1020 ? 134 : 150);
  verifyMetricRange("высота логотипов", metrics.brandLogoHeights, narrow ? 28 : width <= 1020 ? 30 : 34, narrow ? 50 : width <= 1020 ? 58 : 66);
  verifyMetricRange("карточки признаков", metrics.symptoms.map(({ name, height: value }) => ({ name, value })), 94, 190);
  if (wide) verifyMetricRange("этапы desktop", metrics.stages.map(({ name, height: value }) => ({ name, value })), 218, 310);
  verifyMetricRange("строки цен", metrics.priceRows, 54, width <= 320 ? 110 : 90);
  verifyMetricRange("связанные разделы", metrics.related, narrow ? 62 : 66, 110);
  verifyMetricRange("FAQ summary", metrics.faq, narrow ? 62 : 66, Number.POSITIVE_INFINITY);

  for (const placement of [
    ["признаки", metrics.boxes.symptomsMain, metrics.boxes.symptomsCta],
    ["цены", metrics.boxes.priceMain, metrics.boxes.priceCta],
  ]) {
    const [label, main, cta] = placement;
    if (!main || !cta) throw new Error(`Визуальный контракт: не найден CTA блока «${label}»`);
    if (wide) {
      if (cta.x < main.right + 14 || Math.abs(cta.y - main.y) > 2 || cta.width < 318 || cta.width > 348) {
        throw new Error(`Визуальный контракт: CTA «${label}» не расположен справа (${JSON.stringify({ main, cta })})`);
      }
    } else if (cta.y < main.bottom + 14 || Math.abs(cta.width - main.width) > 2) {
      throw new Error(`Визуальный контракт: CTA «${label}» не расположен под содержимым (${JSON.stringify({ main, cta })})`);
    }
  }

  verifyMetricRange("CTA-кнопки", metrics.mainCtas.map(({ name, width: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  verifyMetricRange("CTA-кнопки", metrics.mainCtas.map(({ name, height: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  if (metrics.clipped.length) throw new Error(`Визуальный контракт: обрезан контент ${metrics.clipped.slice(0, 8).join(", ")}`);
  if (metrics.outOfViewport.length) throw new Error(`Визуальный контракт: элементы вышли за viewport ${metrics.outOfViewport.slice(0, 8).join(", ")}`);
}

async function verifyInternalContract(page, viewport) {
  const compact = viewport.width <= 720;
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
  if ((await page.locator(".internal-inline-cta").count()) !== 2) throw new Error("Ожидалось ровно 2 inline CTA");
  const ctas = page.locator("main a.v3-button");
  if ((await ctas.count()) !== 4) throw new Error(`Ожидалось 4 CTA, найдено ${await ctas.count()}`);
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
  for (let index = 0; index < await ctas.count(); index += 1) {
    const focusStyle = await ctas.nth(index).evaluate((element) => {
      element.focus();
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height };
    });
    if (focusStyle.outline === "none") throw new Error(`CTA ${index + 1} не показывает focus-visible`);
    if (focusStyle.width < 44 || focusStyle.height < 44) throw new Error(`CTA ${index + 1} меньше 44px`);
  }

  await verifyInternalVisualContract(page, viewport);
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
    const callbarTarget = await callbar.locator("a").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { href: element.getAttribute("href"), width: rect.width, height: rect.height };
    });
    if (callbarTarget.href !== "tel:+79224488822" || callbarTarget.width < 44 || callbarTarget.height < 44) {
      throw new Error(`Callbar нарушает телефонный/44px контракт: ${JSON.stringify(callbarTarget)}`);
    }
    await page.locator("[data-nav-toggle]").evaluate((element) => element.click());
    await page.waitForFunction(() => document.querySelector("[data-mobile-callbar]")?.getAttribute("aria-hidden") === "true", undefined, { timeout: 2000 });
    await page.keyboard.press("Escape");
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
      await verifyInternalContract(page, viewport);
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
