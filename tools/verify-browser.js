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

function compareChromeBox(label, home, internal, tolerance = 1) {
  if (!home || !internal) throw new Error(`Общий chrome: не найден ${label}`);
  for (const property of ["x", "right", "width", "height"]) {
    if (Math.abs(home[property] - internal[property]) > tolerance) {
      throw new Error(`Общий chrome: ${label}.${property} различается (${home[property].toFixed(1)} / ${internal[property].toFixed(1)})`);
    }
  }
}

async function captureChrome(page, route, viewport) {
  await verifyPage(page, route, `${route} chrome ${viewport.width}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const collapsed = viewport.width <= 1120;
  if (collapsed) {
    await page.locator("[data-nav-toggle]").click();
    await page.waitForFunction(() => document.querySelector("[data-nav-toggle]")?.getAttribute("aria-expanded") === "true");
  }
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, right: rect.right, width: rect.width, height: rect.height };
    };
    const nav = document.querySelector(".v3-nav");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const active = document.querySelector(".v3-nav .main-nav__group.is-current > .main-nav__trigger, .v3-nav > a[aria-current='page']");
    const activeStyle = active ? getComputedStyle(active) : null;
    const activeLine = active ? getComputedStyle(active, active.matches(".main-nav__trigger") ? "::before" : "::after") : null;
    return {
      headerRail: box(".site-header-rail"),
      header: box(".v3-header"),
      logo: box(".v3-logo"),
      phone: box(".v3-header__phone"),
      toggle: box(".v3-nav-toggle"),
      navPanel: box(".v3-nav"),
      footerRail: box(".v3-footer > .container"),
      navStyle: navStyle && {
        fontFamily: navStyle.fontFamily,
        fontSize: parseFloat(navStyle.fontSize),
        fontWeight: Number(navStyle.fontWeight),
        color: navStyle.color,
      },
      activeStyle: activeStyle && { color: activeStyle.color },
      activeLine: activeLine && {
        height: parseFloat(activeLine.height),
        opacity: parseFloat(activeLine.opacity),
        backgroundColor: activeLine.backgroundColor,
      },
    };
  });
  if (collapsed) await page.keyboard.press("Escape");
  return metrics;
}

async function verifySharedChrome(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const homePage = await context.newPage();
  const internalPage = await context.newPage();
  const [home, internal] = await Promise.all([
    captureChrome(homePage, "/", viewport),
    captureChrome(internalPage, internalRoute, viewport),
  ]);
  for (const key of ["headerRail", "header", "logo", "phone", "toggle", "navPanel", "footerRail"]) {
    compareChromeBox(key, home[key], internal[key]);
  }
  const expectedRail = viewport.width <= 720
    ? Math.min(viewport.width - 28, 520)
    : Math.min(viewport.width - 72, 1312);
  if (Math.abs(home.headerRail.width - expectedRail) > 1 || Math.abs(home.footerRail.width - expectedRail) > 1) {
    throw new Error(`Общий chrome ${viewport.width}: ожидалась направляющая ${expectedRail}px, получено header=${home.headerRail.width.toFixed(1)}, footer=${home.footerRail.width.toFixed(1)}`);
  }
  for (const [label, metrics] of [["главная", home], ["внутренняя", internal]]) {
    if (!metrics.navStyle || metrics.navStyle.fontSize !== 14 || metrics.navStyle.fontWeight !== 600 || !metrics.navStyle.fontFamily.includes("Montserrat")) {
      throw new Error(`Общий chrome ${viewport.width}: типографика меню «${label}» ${JSON.stringify(metrics.navStyle)}`);
    }
  }
  if (!internal.activeStyle || internal.activeStyle.color !== internal.navStyle.color) {
    throw new Error(`Общий chrome ${viewport.width}: активный раздел изменил цвет текста (${JSON.stringify(internal.activeStyle)} / ${internal.navStyle.color})`);
  }
  if (!internal.activeLine || Math.abs(internal.activeLine.height - 2) > 0.5 || internal.activeLine.opacity < 0.99 || internal.activeLine.backgroundColor !== "rgb(245, 162, 26)") {
    throw new Error(`Общий chrome ${viewport.width}: активный раздел не отмечен янтарной линией (${JSON.stringify(internal.activeLine)})`);
  }
  await context.close();
}

async function verifyHomeLayout(page, viewport) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const box = (elementOrSelector) => {
      const element = typeof elementOrSelector === "string" ? document.querySelector(elementOrSelector) : elementOrSelector;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      hero: box(".v3-hero"),
      headerRail: box(".site-header-rail"),
      heroShell: box(".v3-hero__shell"),
      heading: box(".v3-hero h1"),
      proof: box(".v3-proof"),
      containers: [
        ...document.querySelectorAll(".v3-section__inner.container"),
        document.querySelector(".v3-footer > .container"),
      ].filter(Boolean).map(box),
    };
  });
  const expectedWidth = viewport.width <= 720
    ? Math.min(viewport.width - 28, 520)
    : Math.min(viewport.width - 72, 1312);
  for (const [label, box] of [["шапка", metrics.headerRail], ["hero", metrics.heroShell], ...metrics.containers.map((item, index) => [`контейнер-${index + 1}`, item])]) {
    if (!box || Math.abs(box.width - expectedWidth) > 1 || Math.abs(box.x - (viewport.width - expectedWidth) / 2) > 1) {
      throw new Error(`Главная ${viewport.width}: ${label} не совпадает с направляющей ${expectedWidth}px (${JSON.stringify(box)})`);
    }
  }
  if (viewport.width > 720 && (!metrics.proof || Math.abs(metrics.proof.x - metrics.heroShell.x) > 1 || Math.abs(metrics.proof.right - metrics.heroShell.right) > 1)) {
    throw new Error(`Главная ${viewport.width}: факты hero не совпадают с общей направляющей`);
  }
  if (viewport.width === 1992 && viewport.height === 1200) {
    if (!metrics.heading || metrics.heading.y < 273 || metrics.heading.y > 275) {
      throw new Error(`Главная 1992×1200: H1 должен начинаться около 274px, получено ${metrics.heading?.y}`);
    }
    if (!metrics.proof || !metrics.hero || metrics.proof.bottom > metrics.hero.bottom + 1) {
      throw new Error("Главная 1992×1200: нижние факты вышли за границу hero");
    }
  }
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
      ".internal-reference-link",
      ".internal-popular-work span", ".v3-brand-card__name", ".v3-brand-card__status",
      ".v3-brand-matrix li", ".internal-editorial p",
    ];
    const clipped = clippingSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => element.scrollWidth - element.clientWidth > 2 || element.scrollHeight - element.clientHeight > 2)
      .map((element, index) => `${selector}[${index + 1}]`));
    const boundedSelectors = [
      ".internal-service-card", ".internal-vehicle-card", ".internal-brand-strip__item",
      ".internal-symptoms li", ".internal-inline-cta", ".internal-timeline__item",
      ".internal-price-table", ".internal-related-index span", ".internal-faq details",
      ".internal-reference-link",
      ".internal-popular-work", ".v3-brand-card", ".v3-brand-matrix li",
      ".internal-editorial article",
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
      headings: measurements(".internal-section:not(.internal-section--brandShowcase) h2", (element) => parseFloat(getComputedStyle(element).fontSize)),
      brandHeading: measurements(".internal-brand-showcase__head h2", (element) => parseFloat(getComputedStyle(element).fontSize)),
      introRatio: introMediaRect ? introMediaRect.width / introMediaRect.height : 0,
      introStats: measurements(".internal-intro__stats > div"),
      serviceCards: dimensions(".internal-service-card"),
      serviceTitles: measurements(".internal-service-card h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      serviceBodies: measurements(".internal-service-card p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      serviceIcons: measurements(".internal-service-card__icon", (element) => element.getBoundingClientRect().width),
      popularCards: dimensions(".internal-popular-work"),
      popularTitles: measurements(".internal-popular-work span", (element) => parseFloat(getComputedStyle(element).fontSize)),
      popularIcons: measurements(".internal-popular-work__icon", (element) => element.getBoundingClientRect().width),
      vehicleCards: dimensions(".internal-vehicle-card"),
      vehicleTitles: measurements(".internal-vehicle-card h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      vehicleBodies: measurements(".internal-vehicle-card p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      brandCells: dimensions(".internal-brand-strip__item"),
      brandLogoWidths: measurements(".internal-brand-strip img", (element) => element.getBoundingClientRect().width),
      brandLogoHeights: measurements(".internal-brand-strip img", (element) => element.getBoundingClientRect().height),
      brandOfficialCards: dimensions(".internal-section--brandShowcase .v3-brand-card"),
      brandOfficialLogos: measurements(".internal-section--brandShowcase .v3-brand-card__logo img", (element) => element.getBoundingClientRect().height),
      brandMatrixItems: dimensions(".internal-section--brandShowcase .v3-brand-matrix li"),
      symptoms: dimensions(".internal-symptoms li"),
      symptomText: measurements(".internal-symptoms li", (element) => parseFloat(getComputedStyle(element).fontSize)),
      symptomIcons: measurements(".internal-symptom__icon", (element) => element.getBoundingClientRect().width),
      stages: dimensions(".internal-timeline__item"),
      stageIcons: measurements(".internal-timeline__icon", (element) => element.getBoundingClientRect().width),
      stageTitles: measurements(".internal-timeline h3", (element) => parseFloat(getComputedStyle(element).fontSize)),
      stageBodies: measurements(".internal-timeline p", (element) => parseFloat(getComputedStyle(element).fontSize)),
      stageTitleLayouts: [...document.querySelectorAll(".internal-timeline h3")].map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          name: element.textContent.trim(),
          lines: Math.round(rect.height / parseFloat(style.lineHeight)),
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
          hyphens: style.hyphens,
          overflows: element.scrollWidth > element.clientWidth + 1,
        };
      }),
      stageLine: (() => {
        const timeline = document.querySelector(".internal-timeline");
        if (!timeline) return null;
        const style = getComputedStyle(timeline, "::before");
        return {
          position: style.position,
          width: parseFloat(style.width),
          backgroundColor: style.backgroundColor,
          content: style.content,
        };
      })(),
      priceRows: measurements(".internal-price-table tbody tr"),
      priceLabels: measurements(".internal-price-table th", (element) => parseFloat(getComputedStyle(element).fontSize)),
      priceValues: measurements(".internal-price-table td", (element) => parseFloat(getComputedStyle(element).fontSize)),
      related: measurements(".internal-related-index span"),
      relatedText: measurements(".internal-related-index span", (element) => parseFloat(getComputedStyle(element).fontSize)),
      faq: measurements(".internal-faq summary"),
      faqText: measurements(".internal-faq summary", (element) => parseFloat(getComputedStyle(element).fontSize)),
      rows: {
        services: rowCounts(".internal-service-card"),
        popular: rowCounts(".internal-popular-work"),
        vehicles: rowCounts(".internal-vehicle-card"),
        brandOfficial: rowCounts(".internal-section--brandShowcase .v3-brand-card"),
        brandMatrix: rowCounts(".internal-section--brandShowcase .v3-brand-matrix li"),
        symptoms: rowCounts(".internal-symptoms li"),
        stages: rowCounts(".internal-timeline__item"),
        prices: rowCounts(".internal-price-table"),
        related: rowCounts(".internal-related-index span"),
        faq: rowCounts(".internal-faq details"),
      },
      boxes: {
        heroShell: box(".internal-hero__shell"),
        symptomsMain: box(".internal-symptoms"),
        symptomsCta: box(".internal-inline-cta--symptoms"),
        priceMain: box(".internal-price-main"),
        priceCta: box(".internal-inline-cta--prices"),
      },
      alignedContainers: [
        ...document.querySelectorAll(".internal-section > .container"),
        document.querySelector(".internal-close > .container"),
        document.querySelector(".v3-footer > .container"),
      ].filter(Boolean).map((element, index) => {
        const rect = element.getBoundingClientRect();
        return { name: element.parentElement?.id || element.parentElement?.className || `container-${index + 1}`, x: rect.x, right: rect.right, width: rect.width };
      }),
      mainCtas: dimensions("main a.v3-button"),
      referenceLinks: dimensions(".internal-reference-link"),
      clipped,
      outOfViewport,
    };
  });

  const width = viewport.width;
  const wide = width > 1020;
  const timelineWide = width >= 1280;
  const referenceWide = width > 1120;
  const compact = width <= 720;
  const narrow = width <= 520;
  const compactSections = new Set(["repair-process", "related-services"]);
  if (!metrics.sectionPaddings.length) throw new Error("Визуальный контракт: не найдены .internal-section");
  if (!compact && metrics.sectionSpaceDefault - metrics.sectionSpaceCompact < 20) {
    throw new Error(`Визуальный контракт: default/compact ритм не различим (${metrics.sectionSpaceDefault.toFixed(1)}/${metrics.sectionSpaceCompact.toFixed(1)}px)`);
  }
  const invalidSectionPaddings = metrics.sectionPaddings.filter(({ name, top, bottom }) => {
    let expectedTop = compact || compactSections.has(name) ? metrics.sectionSpaceCompact : metrics.sectionSpaceDefault;
    let expectedBottom = expectedTop;
    if (!compact && name === "repair-services") [expectedTop, expectedBottom] = [metrics.sectionSpaceCompact, 32];
    if (!compact && name === "popular-repair-services") [expectedTop, expectedBottom] = [48, 48];
    if (!compact && name === "vehicle-types") [expectedTop, expectedBottom] = [48, metrics.sectionSpaceCompact];
    return Math.abs(top - expectedTop) > 1.5 || Math.abs(bottom - expectedBottom) > 1.5;
  });
  if (invalidSectionPaddings.length) {
    const details = invalidSectionPaddings
      .map(({ name, top, bottom }) => `${name}=${top.toFixed(1)}/${bottom.toFixed(1)}px`)
      .join(", ");
    throw new Error(`Визуальный контракт: нарушен переменный ритм секций (${details})`);
  }

  const headingRanges = {
    1992: [31.4, 32.6],
    1440: [28.2, 29.4],
    1298: [27.4, 28.6],
    1280: [27.4, 28.6],
    1279: [27.4, 28.6],
    1120: [27.4, 28.6],
    720: [27.4, 28.6],
    520: [29.4, 30.6],
    414: [29.4, 30.6],
    390: [29.4, 30.6],
    320: [27.4, 28.6],
  };
  const [headingMin, headingMax] = headingRanges[width];
  verifyMetricRange("заголовки секций", metrics.headings, headingMin, headingMax);
  verifyMetricRange("заголовок блока марок", metrics.brandHeading, 29.4, 44.6);
  if (metrics.introRatio < 1.95 || metrics.introRatio > 2.05) {
    throw new Error(`Визуальный контракт: intro-фото имеет соотношение ${metrics.introRatio.toFixed(2)}, ожидалось 2:1`);
  }
  verifyMetricRange("показатели intro", metrics.introStats, 104, 124);

  verifyRows("услуги", metrics.rows.services, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("популярные работы", metrics.rows.popular, repeatedRows(wide ? 4 : narrow ? 1 : 2, 16));
  verifyRows("техника", metrics.rows.vehicles, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("официальные марки", metrics.rows.brandOfficial, [3]);
  verifyRows("матрица марок", metrics.rows.brandMatrix, repeatedRows(referenceWide ? 5 : compact ? 2 : 4, 20));
  verifyRows("признаки", metrics.rows.symptoms, repeatedRows(wide ? 3 : narrow ? 1 : 2, 6));
  verifyRows("этапы", metrics.rows.stages, repeatedRows(timelineWide ? 5 : 1, 5));
  verifyRows("таблицы цен", metrics.rows.prices, repeatedRows(compact ? 1 : 2, 2));
  verifyRows("связанные разделы", metrics.rows.related, repeatedRows(wide ? 4 : narrow ? 1 : 2, 8));
  verifyRows("FAQ", metrics.rows.faq, repeatedRows(width > 720 ? 2 : 1, 11));

  verifyMetricRange("заголовки услуг", metrics.serviceTitles, narrow ? 17.4 : 16.4, narrow ? 18.6 : 17.6);
  verifyMetricRange("текст услуг", metrics.serviceBodies, 13.4, 14.6);
  verifyMetricRange("иконки услуг", metrics.serviceIcons, narrow ? 50 : 54, narrow ? 54 : 58);
  verifyMetricRange("текст популярных работ", metrics.popularTitles, 15.4, 16.6);
  verifyMetricRange("иконки популярных работ", metrics.popularIcons, 42, 46);
  verifyMetricRange("заголовки техники", metrics.vehicleTitles, narrow ? 16.4 : 17.4, narrow ? 17.6 : 18.6);
  verifyMetricRange("текст техники", metrics.vehicleBodies, narrow ? 15.4 : 14.4, narrow ? 16.6 : 15.6);
  verifyMetricRange("текст признаков", metrics.symptomText, 14.4, 15.6);
  verifyMetricRange("иконки признаков", metrics.symptomIcons, narrow ? 34 : 30, narrow ? 38 : 34);
  verifyMetricRange("иконки этапов", metrics.stageIcons, 54, 58);
  verifyMetricRange("заголовки этапов", metrics.stageTitles, 17.4, 18.6);
  verifyMetricRange("текст этапов", metrics.stageBodies, 14.4, 15.6);
  const invalidStageWrapping = metrics.stageTitleLayouts.filter(({ overflowWrap, wordBreak, hyphens, overflows }) => (
    overflowWrap !== "normal" || wordBreak !== "normal" || hyphens !== "none" || overflows
  ));
  if (invalidStageWrapping.length) {
    throw new Error(`Визуальный контракт: заголовки этапов допускают разрыв слова (${JSON.stringify(invalidStageWrapping)})`);
  }
  if (timelineWide) {
    const agreement = metrics.stageTitleLayouts.find(({ name }) => name === "Согласование");
    if (!agreement || agreement.lines !== 1) throw new Error(`Визуальный контракт: «Согласование» должно занимать одну строку (${JSON.stringify(agreement)})`);
  } else if (!metrics.stageLine || metrics.stageLine.position !== "absolute" || Math.abs(metrics.stageLine.width - 3) > 0.5 || metrics.stageLine.backgroundColor !== "rgb(245, 162, 26)" || metrics.stageLine.content === "none") {
    throw new Error(`Визуальный контракт: вертикальный маршрут потерял янтарную ось (${JSON.stringify(metrics.stageLine)})`);
  }
  verifyMetricRange("названия цен", metrics.priceLabels, 15.4, 16.6);
  verifyMetricRange("значения цен", metrics.priceValues, narrow ? 16.4 : 17.4, narrow ? 17.6 : 18.6);
  verifyMetricRange("текст связанных разделов", metrics.relatedText, 15.4, 16.6);
  verifyMetricRange("текст FAQ", metrics.faqText, 16.4, 17.6);

  if (narrow) {
    const fixedServices = metrics.serviceCards.filter(({ minHeight }) => minHeight > 1);
    const fixedVehicles = metrics.vehicleCards.filter(({ minHeight }) => minHeight > 1);
    if (fixedServices.length || fixedVehicles.length) throw new Error("Визуальный контракт: горизонтальные mobile-карточки сохранили фиксированную высоту");
  } else {
    verifyMetricRange("высота карточек услуг", metrics.serviceCards.map(({ name, height: value }) => ({ name, value })), 194, referenceWide ? 260 : 290);
    verifyMetricRange("высота карточек техники", metrics.vehicleCards.map(({ name, height: value }) => ({ name, value })), 225, 330);
  }
  verifyMetricRange("карточки популярных работ", metrics.popularCards.map(({ name, height: value }) => ({ name, value })), 90, 150);
  verifyMetricRange("официальные карточки марок", metrics.brandOfficialCards.map(({ name, height: value }) => ({ name, value })), 124, 150);
  verifyMetricRange("логотипы официальных марок", metrics.brandOfficialLogos, compact ? 44 : 72, compact ? 48 : 80);
  verifyMetricRange("матрица марок", metrics.brandMatrixItems.map(({ name, height: value }) => ({ name, value })), compact ? 38 : 42, 60);
  verifyMetricRange("карточки признаков", metrics.symptoms.map(({ name, height: value }) => ({ name, value })), 82, 190);
  if (timelineWide) verifyMetricRange("этапы desktop", metrics.stages.map(({ name, height: value }) => ({ name, value })), 152, 230);
  verifyMetricRange("строки цен", metrics.priceRows, 54, width <= 320 ? 110 : 90);
  verifyMetricRange("связанные разделы", metrics.related, narrow ? 62 : 66, 110);
  verifyMetricRange("FAQ summary", metrics.faq, narrow ? 62 : 66, Number.POSITIVE_INFINITY);

  const heroShell = metrics.boxes.heroShell;
  if (!heroShell) throw new Error("Визуальный контракт: не найдена направляющая hero");
  const misaligned = metrics.alignedContainers.filter((container) => Math.abs(container.x - heroShell.x) > 1 || Math.abs(container.right - heroShell.right) > 1);
  if (misaligned.length) {
    throw new Error(`Визуальный контракт: контейнеры не совпадают с hero (${misaligned.map(({ name, x, right }) => `${name}=${x.toFixed(1)}..${right.toFixed(1)}`).join(", ")}; hero=${heroShell.x.toFixed(1)}..${heroShell.right.toFixed(1)})`);
  }

  for (const placement of [
    ["признаки", metrics.boxes.symptomsMain, metrics.boxes.symptomsCta],
    ["цены", metrics.boxes.priceMain, metrics.boxes.priceCta],
  ]) {
    const [label, main, cta] = placement;
    if (!main || !cta) throw new Error(`Визуальный контракт: не найден CTA блока «${label}»`);
    if (wide) {
      const minimumCtaWidth = width === 1120 && label === "цены" ? 278 : 318;
      if (cta.x < main.right + 13 || Math.abs(cta.y - main.y) > 2 || cta.width < minimumCtaWidth || cta.width > 362) {
        throw new Error(`Визуальный контракт: CTA «${label}» не расположен справа (${JSON.stringify({ main, cta })})`);
      }
    } else if (cta.y < main.bottom + 14 || Math.abs(cta.width - main.width) > 2) {
      throw new Error(`Визуальный контракт: CTA «${label}» не расположен под содержимым (${JSON.stringify({ main, cta })})`);
    }
  }

  verifyMetricRange("CTA-кнопки", metrics.mainCtas.map(({ name, width: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  verifyMetricRange("CTA-кнопки", metrics.mainCtas.map(({ name, height: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  verifyMetricRange("ссылки из референса", metrics.referenceLinks.map(({ name, width: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  verifyMetricRange("ссылки из референса", metrics.referenceLinks.map(({ name, height: value }) => ({ name, value })), 44, Number.POSITIVE_INFINITY);
  if (metrics.clipped.length) throw new Error(`Визуальный контракт: обрезан контент ${metrics.clipped.slice(0, 8).join(", ")}`);
  if (metrics.outOfViewport.length) throw new Error(`Визуальный контракт: элементы вышли за viewport ${metrics.outOfViewport.slice(0, 8).join(", ")}`);
}

async function verifyInternalContract(page, viewport) {
  const compact = viewport.width <= 720;
  const callbar = page.locator("[data-mobile-callbar]");
  if (compact && (await callbar.getAttribute("aria-hidden")) !== "true") throw new Error("Callbar видна до прокрутки");
  const expected = {
    ".internal-section": 11,
    ".internal-service-card": 6,
    ".internal-popular-work": 16,
    ".internal-vehicle-card": 6,
    ".internal-section--brandShowcase .v3-brand-card": 3,
    ".internal-section--brandShowcase .v3-brand-matrix li": 20,
    ".internal-editorial__body article": 3,
    ".internal-symptoms li": 6,
    ".internal-timeline__item": 5,
    ".internal-price-table tbody tr": 8,
    ".internal-related-index span": 8,
    ".internal-faq details": 11,
    ".internal-reference-link": 1,
  };
  for (const [selector, count] of Object.entries(expected)) {
    const actual = await page.locator(selector).count();
    if (actual !== count) throw new Error(`${internalRoute}: ${selector} — ${actual}, ожидалось ${count}`);
  }
  if ((await page.locator('nav[aria-label="Хлебные крошки"]').count()) !== 1) throw new Error("Нет хлебных крошек");
  if ((await page.locator("form").count()) !== 0) throw new Error("На внутренней странице появилась форма");
  if ((await page.locator("[class*=sidebar]").count()) !== 0) throw new Error("На внутренней странице появился sidebar");
  if ((await page.locator(".internal-inline-cta").count()) !== 2) throw new Error("Ожидалось ровно 2 inline CTA");
  const referenceLinks = page.locator(".internal-reference-link");
  const expectedReferenceHrefs = ["#related-services"];
  for (let index = 0; index < expectedReferenceHrefs.length; index += 1) {
    if ((await referenceLinks.nth(index).getAttribute("href")) !== expectedReferenceHrefs[index]) throw new Error(`Неверная ссылка из референса ${index + 1}`);
  }
  if ((await page.locator(".internal-popular-work a").count()) !== 0) throw new Error("Неопубликованные популярные работы не должны быть ложными ссылками");
  if ((await page.locator(".internal-price-meta").count()) !== 0) throw new Error("Удалённые реквизиты цен снова появились на странице");
  const editorialLength = await page.locator("#truck-repair-surgut").evaluate((section) => section.textContent.replace(/\s+/g, " ").trim().length);
  if (editorialLength < 1000 || editorialLength > 1600) throw new Error(`Полезный текст вне согласованного объёма: ${editorialLength} знаков`);
  const brandToggle = page.locator("[data-brand-toggle]");
  const brandPanel = page.locator("[data-brand-panel]");
  if (compact) {
    if ((await brandToggle.getAttribute("aria-expanded")) !== "false" || !await brandPanel.isHidden()) throw new Error("Матрица марок должна быть свёрнута на mobile");
    await brandToggle.focus();
    await page.keyboard.press("Enter");
    if ((await brandToggle.getAttribute("aria-expanded")) !== "true" || !await brandPanel.isVisible()) throw new Error("Матрица марок не раскрывается с клавиатуры");
  }
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
    const chromeViewports = [
      { name: "wide-1992", width: 1992, height: 1200 },
      { name: "desktop", width: 1440, height: 900 },
      { name: "reference-1298", width: 1298, height: 900 },
      { name: "timeline-wide-1280", width: 1280, height: 900 },
      { name: "timeline-stacked-1279", width: 1279, height: 900 },
      { name: "tablet", width: 1120, height: 900 },
      { name: "compact-720", width: 720, height: 900 },
      { name: "compact-520", width: 520, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-320", width: 320, height: 760 },
    ];
    for (const viewport of chromeViewports) await verifySharedChrome(browser, viewport);

    const homeViewports = [
      { name: "wide-1992", width: 1992, height: 1200 },
      { name: "desktop", width: 1440, height: 900 },
      { name: "reference-1298", width: 1298, height: 900 },
      { name: "timeline-wide-1280", width: 1280, height: 900 },
      { name: "timeline-stacked-1279", width: 1279, height: 900 },
      { name: "tablet", width: 1120, height: 900 },
      { name: "compact-720", width: 720, height: 900 },
      { name: "compact-520", width: 520, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
      { name: "mobile-320", width: 320, height: 760 },
    ];
    for (const viewport of homeViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, "/", `Главная ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      await verifyHomeLayout(page, viewport);
      if (viewport.name === "desktop") await verifyLightbox(page);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        document.documentElement.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
      await page.waitForTimeout(50);
      await page.locator(".v3-hero").screenshot({ path: path.join(resultDir, `home-${viewport.name}.png`) });
      await context.close();
    }

    const internalViewports = chromeViewports;
    for (const viewport of internalViewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, internalRoute, `Внутренняя ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      try {
        await verifyInternalContract(page, viewport);
      } catch (error) {
        throw new Error(`Внутренняя ${viewport.name}: ${error.message}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const screenshotPath = path.join(resultDir, `internal-${viewport.name}-full.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      if (viewport.name === "desktop") fs.copyFileSync(screenshotPath, path.join(reviewDir, "internal-desktop.png"));
      if (viewport.name === "reference-1298") {
        await page.locator("#repair-services").screenshot({ path: path.join(reviewDir, "internal-reference-services.png") });
        await page.locator("#popular-repair-services").screenshot({ path: path.join(reviewDir, "internal-reference-popular-works.png") });
        await page.locator("#vehicle-types").screenshot({ path: path.join(reviewDir, "internal-reference-vehicles.png") });
        await page.locator("#truck-brands").screenshot({ path: path.join(reviewDir, "internal-reference-brands.png") });
        await page.locator("#truck-repair-surgut").screenshot({ path: path.join(reviewDir, "internal-reference-editorial.png") });
        await page.locator("#repair-process").screenshot({ path: path.join(reviewDir, "internal-reference-process.png") });
      }
      if (viewport.name === "timeline-stacked-1279") {
        await page.locator("#repair-process").screenshot({ path: path.join(reviewDir, "internal-stacked-process.png") });
      }
      if (viewport.name === "mobile-390") {
        fs.copyFileSync(screenshotPath, path.join(reviewDir, "internal-mobile.png"));
        await page.locator("#popular-repair-services").screenshot({ path: path.join(reviewDir, "internal-mobile-popular-works.png") });
        await page.locator("#truck-brands").screenshot({ path: path.join(reviewDir, "internal-mobile-brands.png") });
        await page.locator("#truck-repair-surgut").screenshot({ path: path.join(reviewDir, "internal-mobile-editorial.png") });
      }
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
  console.log("Browser verification passed: общий chrome 11 viewport, главная 11 viewport, внутренний hub 11 viewport, wide guide, H1 alignment, stage wrapping, burger, FAQ, callbar, images, targets и 404.");
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
