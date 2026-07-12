const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const resultDir = path.join(root, "test-results", "browser");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const relative = pathname.replace(/^\/+/, "");
  const requested = path.join(distDir, relative);
  if (!requested.startsWith(distDir)) return null;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) return requested;
  const index = path.join(requested, "index.html");
  if (fs.existsSync(index)) return index;
  return null;
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const file = resolveRequest(request.url);
      if (!file) {
        const fallback = path.join(distDir, "404.html");
        response.writeHead(404, { "content-type": mime[".html"] });
        response.end(fs.existsSync(fallback) ? fs.readFileSync(fallback) : "Not found");
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

async function verifyPage(page, route, label) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  const response = await page.goto(`http://${host}:${port}${route}`, { waitUntil: "domcontentloaded" });
  if (!response?.ok()) throw new Error(`${label}: HTTP ${response?.status()}`);
  await page.waitForTimeout(200);

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
  if (errors.length) throw new Error(`${label}: ${errors.join("; ")}`);
}

async function verifyNavigation(page, mobile) {
  const toggle = page.locator("[data-nav-toggle]");
  if (mobile) {
    await toggle.click();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") throw new Error("Бургер не открыл меню");
  }

  const trigger = page.locator("[data-menu-toggle]").first();
  if (await trigger.count()) {
    if (mobile) {
      await trigger.click();
    } else {
      await trigger.focus();
      await page.keyboard.press("Enter");
    }
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      throw new Error("Меню не синхронизировало aria-expanded при открытии");
    }
    const panelId = await trigger.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    if (await panel.getAttribute("hidden") !== null) throw new Error("Открытая панель осталась hidden");
    await page.keyboard.press("Escape");
    if ((await trigger.getAttribute("aria-expanded")) !== "false") {
      throw new Error("Escape не закрыл меню");
    }
    if (await panel.getAttribute("hidden") === null) throw new Error("Закрытая панель не получила hidden");
  }

  if (mobile) {
    if ((await toggle.getAttribute("aria-expanded")) === "true") {
      await page.keyboard.press("Escape");
    }
    if ((await toggle.getAttribute("aria-expanded")) !== "false") throw new Error("Escape не закрыл бургер");
  }
}

async function verifyLightbox(page) {
  const opener = page.locator("[data-lightbox-item]").first();
  const dialog = page.locator("[data-media-lightbox]");
  if (!(await opener.count()) || !(await dialog.count())) throw new Error("Lightbox: не найдены opener или dialog");
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  if (await dialog.getAttribute("hidden") !== null) throw new Error("Lightbox не открылся");
  if (await dialog.getAttribute("inert") !== null) throw new Error("Открытый lightbox остался inert");
  await page.keyboard.press("Tab");
  const focusInside = await page.evaluate(() => document.querySelector("[data-media-lightbox]")?.contains(document.activeElement));
  if (!focusInside) throw new Error("Фокус вышел за пределы lightbox");
  await page.keyboard.press("Escape");
  if (await dialog.getAttribute("hidden") === null) throw new Error("Escape не закрыл lightbox");
  const focusReturned = await page.evaluate(() => document.activeElement === document.querySelector("[data-lightbox-item]"));
  if (!focusReturned) throw new Error("Lightbox не вернул фокус на открывшую кнопку");
}

async function materializeHomeSections(page) {
  const sections = page.locator("main > :not(.v3-hero)");
  const count = await sections.count();
  for (let index = 0; index < count; index += 1) {
    await sections.nth(index).scrollIntoViewIfNeeded();
  }
  await page.evaluate(() => {
    document.querySelectorAll("main > :not(.v3-hero)").forEach((section) => {
      section.style.contentVisibility = "visible";
    });
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

async function verifyInternalHeaderBreakpoint(page, width) {
  const state = await page.evaluate(() => {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-site-nav]");
    return {
      toggleVisible: toggle instanceof HTMLElement && getComputedStyle(toggle).display !== "none",
      navHidden: nav?.hasAttribute("hidden") ?? true,
      navInert: nav?.hasAttribute("inert") ?? true,
    };
  });
  const collapsed = width <= 1020;
  if (state.toggleVisible !== collapsed) throw new Error(`/remont/ ${width}px: toggleVisible=${state.toggleVisible}`);
  if (state.navHidden !== collapsed || state.navInert !== collapsed) {
    throw new Error(`/remont/ ${width}px: navHidden=${state.navHidden}, navInert=${state.navInert}`);
  }
  if (collapsed) await verifyNavigation(page, true);
}

async function run() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error("Сначала соберите dist/");
  fs.mkdirSync(resultDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  let mobileHomeHeight = 0;

  try {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "tablet", width: 1120, height: 900 },
      { name: "mobile-414", width: 414, height: 896 },
      { name: "mobile-390", width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await verifyPage(page, "/", `Главная ${viewport.name}`);
      await verifyNavigation(page, viewport.width <= 1120);
      if (viewport.name === "desktop") await verifyLightbox(page);
      await page.screenshot({ path: path.join(resultDir, `home-${viewport.name}.png`), fullPage: false });

      if (viewport.width === 390) {
        await materializeHomeSections(page);
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        mobileHomeHeight = height;
        if (height > 12600) throw new Error(`Главная mobile выше целевого лимита: ${height}px`);
        await page.screenshot({ path: path.join(resultDir, "home-mobile-390-full.png"), fullPage: true });
        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = "auto";
          window.scrollTo(0, 700);
        });
        const callbar = page.locator("[data-mobile-callbar]");
        await page.waitForFunction(
          () => document.querySelector("[data-mobile-callbar]")?.getAttribute("aria-hidden") === "false",
          undefined,
          { timeout: 2000 },
        );
        if ((await callbar.getAttribute("aria-hidden")) !== "false") {
          throw new Error("Mobile callbar не появилась после начала прокрутки");
        }
      }

      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    for (const route of ["/remont/", "/remont-gbc/", "/remont/maz/"]) {
      await verifyPage(page, route, route);
      if ((await page.locator('nav[aria-label="Хлебные крошки"]').count()) !== 1) {
        throw new Error(`${route}: нет хлебных крошек`);
      }
      if ((await page.locator('a[href="tel:+79224488822"]').count()) < 1) {
        throw new Error(`${route}: нет CTA звонка`);
      }
      const slug = route.replace(/^\/|\/$/g, "").replaceAll("/", "-");
      await page.screenshot({ path: path.join(resultDir, `pilot-${slug}.png`), fullPage: false });
    }
    await context.close();

    for (const width of [1120, 1050, 1020, 390]) {
      const breakpointContext = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 900 } });
      const breakpointPage = await breakpointContext.newPage();
      await verifyPage(breakpointPage, "/remont/", `/remont/ ${width}px`);
      await verifyInternalHeaderBreakpoint(breakpointPage, width);
      if (width === 390) {
        await breakpointPage.evaluate(() => window.scrollTo(0, 700));
        await breakpointPage.waitForFunction(
          () => document.querySelector("[data-mobile-callbar]")?.getAttribute("aria-hidden") === "false",
          undefined,
          { timeout: 2000 },
        );
      }
      await breakpointContext.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`Browser verification passed: 4 home viewports, 3 pilot routes and 4 internal-header breakpoints; mobile home ${mobileHomeHeight}px.`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
