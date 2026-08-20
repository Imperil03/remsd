const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const pagesDir = path.join(srcDir, "pages");
const partialsDir = path.join(srcDir, "partials");
const dataDir = path.join(srcDir, "data");
const templatesDir = path.join(srcDir, "templates");
const assetsDir = path.join(root, "assets");
const distDir = path.join(root, "dist");
const assetVersion = process.env.ASSET_VERSION || "20260820-internal-service";
const defaultSiteUrl = "https://imperil03.github.io/remsd/";
const siteUrl = new URL(process.env.SITE_URL || defaultSiteUrl).href;

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDir(source, target);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}

function readPartials() {
  const partials = {};

  for (const file of fs.readdirSync(partialsDir)) {
    if (!file.endsWith(".html")) continue;
    const name = path.basename(file, ".html");
    partials[name] = fs.readFileSync(path.join(partialsDir, file), "utf8");
  }

  return partials;
}

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function render(content, partials, context) {
  let output = content;

  for (let pass = 0; pass < 10; pass += 1) {
    let next = output;

    for (const [name, html] of Object.entries(partials)) {
      next = next.replaceAll(`{{${name}}}`, html);
    }

    if (next === output) break;
    output = next;
  }

  for (const [name, value] of Object.entries(context)) {
    output = output.replaceAll(`{{${name}}}`, value);
  }

  return output;
}

function getHtmlFiles(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getHtmlFiles(source));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(source);
    }
  }

  return files;
}

function getRootPath(relativeFile) {
  const dir = path.dirname(relativeFile);
  if (dir === ".") return "./";
  const depth = dir.split(path.sep).filter(Boolean).length;
  if (depth === 0) return "./";
  return "../".repeat(depth);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function relativeHref(rootPath, href = "") {
  if (/^(?:https?:|tel:|mailto:)/.test(href)) return escapeHtml(href);
  return `${rootPath}${escapeHtml(href)}`;
}

function absoluteUrl(href = "") {
  return new URL(String(href).replace(/^\/+/, ""), siteUrl).href;
}

function pageAbsoluteUrl(pagePath) {
  return absoluteUrl(`${String(pagePath).replace(/^\/+|\/+$/g, "")}/`);
}

function buildPages() {
  const partials = readPartials();

  for (const source of getHtmlFiles(pagesDir)) {
    const relativeFile = path.relative(pagesDir, source);
    const target = path.join(distDir, relativeFile);
    const html = fs.readFileSync(source, "utf8");
    const context = {
      rootPath: getRootPath(relativeFile),
      assetVersion,
      siteUrl: escapeHtml(siteUrl),
    };

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(html, partials, context), "utf8");
  }
}

function renderList(items, rootPath = "") {
  return items
    .map((item) => {
      if (typeof item === "string") return `          <li>${escapeHtml(item)}</li>`;

      const suffix = item.text ? ` ${escapeHtml(item.text)}` : "";
      return `          <li><a href="${relativeHref(rootPath, item.href)}">${escapeHtml(item.label)}</a>${suffix}</li>`;
    })
    .join("\n");
}

function renderBrands(items) {
  return items.map((item) => `          <span>${escapeHtml(item)}</span>`).join("\n");
}

function renderRelated(items, rootPath) {
  return items
    .map((item) => `        <a href="${relativeHref(rootPath, item.href)}">${escapeHtml(item.label)}</a>`)
    .join("\n");
}

function renderParagraph(paragraph) {
  if (typeof paragraph === "string") return `          <p>${escapeHtml(paragraph)}</p>`;

  if (paragraph && paragraph.prefix && paragraph.strong) {
    return `          <p>${escapeHtml(paragraph.prefix)} <strong>${escapeHtml(paragraph.strong)}</strong>.</p>`;
  }

  throw new Error("Unsupported paragraph shape in internal-service page");
}

function renderParagraphs(paragraphs = []) {
  return paragraphs.map(renderParagraph).join("\n");
}

function renderBreadcrumbs(items, rootPath) {
  return items
    .map((item, index) => {
      const separator = index === 0 ? "" : '        <span aria-hidden="true">/</span>\n';
      if (item.href === undefined) {
        return `${separator}        <span aria-current="page">${escapeHtml(item.label)}</span>`;
      }

      return `${separator}        <a href="${relativeHref(rootPath, item.href)}">${escapeHtml(item.label)}</a>`;
    })
    .join("\n");
}

function renderTocLinks(items) {
  return items
    .map((item) => `          <a href="#${escapeHtml(item.id)}" data-dossier-nav-link>${escapeHtml(item.label)}</a>`)
    .join("\n");
}

function renderProseSection(section) {
  return `
        <section class="dossier-section dossier-section--prose" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
${renderParagraphs(section.paragraphs)}
        </section>`;
}

function renderServiceMap(section, rootPath) {
  const items = section.items
    .map((item, index) => {
      const title = item.href
        ? `<a href="${relativeHref(rootPath, item.href)}">${escapeHtml(item.title)}</a>`
        : escapeHtml(item.title);

      return `
          <article class="dossier-lane">
            <span class="dossier-lane__number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <div class="dossier-lane__content">
              <h3>${title}</h3>
${renderParagraphs(item.paragraphs)}
            </div>
          </article>`;
    })
    .join("");

  return `
        <section class="dossier-section dossier-section--service-map" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
          <div class="dossier-service-map">
${items}
          </div>
        </section>`;
}

function renderDiagnostics(section) {
  return `
        <section class="dossier-section dossier-section--diagnostics" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
          <div class="dossier-diagnostics__text">
${renderParagraphs(section.paragraphs)}
          </div>
        </section>`;
}

function renderBrandSection(section, rootPath) {
  const official = section.official
    .map((item) => `
            <a class="dossier-official-brand" href="${relativeHref(rootPath, item.href)}">
              <span class="dossier-official-brand__logo"><img src="${relativeHref(rootPath, item.logo)}" alt="" width="${Number(item.width)}" height="${Number(item.height)}" loading="lazy" decoding="async"></span>
              <span>${escapeHtml(item.name)}</span>
            </a>`)
    .join("");

  const others = section.others
    .map((item) => `
            <li>
              <img src="${relativeHref(rootPath, item.logo)}" alt="" width="220" height="120" loading="lazy" decoding="async">
              <span>${escapeHtml(item.name)}</span>
            </li>`)
    .join("");

  return `
        <section class="dossier-section dossier-section--brands" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.intro)}</p>
          <p class="dossier-brands__official-line"><strong>${escapeHtml(section.officialPrefix)}</strong> ${escapeHtml(section.officialText)}</p>
          <div class="dossier-official-brands" aria-label="Официальный сервис по маркам">
${official}
          </div>
          <p>${escapeHtml(section.otherText)}</p>
          <ul class="dossier-brand-register" aria-label="Другие марки грузовых автомобилей">
${others}
          </ul>
          <p class="dossier-note">${escapeHtml(section.note)}</p>
        </section>`;
}

function renderTimeline(section) {
  const items = section.items
    .map((item, index) => `
          <article class="dossier-timeline__step">
            <span class="dossier-timeline__number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
            </div>
          </article>`)
    .join("");

  return `
        <section class="dossier-section dossier-section--timeline" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
          <div class="dossier-timeline">
${items}
          </div>
        </section>`;
}

function renderSplitProse(section) {
  const items = section.items
    .map((item) => `
          <article class="dossier-operational" id="${escapeHtml(item.id)}" data-dossier-section>
            <h2>${escapeHtml(item.title)}</h2>
${renderParagraphs(item.paragraphs)}
          </article>`)
    .join("");

  return `
        <div class="dossier-operational-grid">
${items}
        </div>`;
}

function renderGallery(section, rootPath) {
  const images = section.images
    .map((item) => `
            <button class="dossier-gallery__item" type="button" data-lightbox-item data-lightbox-group="truck-service-base" data-large-src="${relativeHref(rootPath, item.large)}" data-caption="${escapeHtml(item.caption)}">
              <img src="${relativeHref(rootPath, item.thumb)}" alt="${escapeHtml(item.alt)}" width="${Number(item.width)}" height="${Number(item.height)}" loading="lazy" decoding="async">
              <span>${escapeHtml(item.caption)}</span>
            </button>`)
    .join("");

  return `
        <section class="dossier-section dossier-section--base" id="${escapeHtml(section.id)}" data-dossier-section>
          <div class="dossier-base__copy">
            <h2>${escapeHtml(section.title)}</h2>
${renderParagraphs(section.paragraphs)}
          </div>
          <div class="dossier-gallery" aria-label="Фотографии ремонтной базы РемСД">
${images}
          </div>
        </section>`;
}

function renderFaq(section) {
  const items = section.items
    .map((item, index) => `
          <details class="dossier-faq__item"${index === 0 ? " open" : ""}>
            <summary>${escapeHtml(item.question)}</summary>
            <div><p>${escapeHtml(item.answer)}</p></div>
          </details>`)
    .join("");

  return `
        <section class="dossier-section dossier-section--faq" id="${escapeHtml(section.id)}" data-dossier-section>
          <h2>${escapeHtml(section.title)}</h2>
          <div class="dossier-faq">
${items}
          </div>
        </section>`;
}

function renderInternalSections(sections, rootPath) {
  return sections
    .map((section) => {
      switch (section.type) {
        case "prose": return renderProseSection(section);
        case "service-map": return renderServiceMap(section, rootPath);
        case "diagnostics": return renderDiagnostics(section);
        case "brands": return renderBrandSection(section, rootPath);
        case "timeline": return renderTimeline(section);
        case "split-prose": return renderSplitProse(section);
        case "gallery": return renderGallery(section, rootPath);
        case "faq": return renderFaq(section);
        default: throw new Error(`Unknown internal-service section type: ${section.type}`);
      }
    })
    .join("\n");
}

function renderFinalCta(cta) {
  return `
      <section class="dossier-final" id="${escapeHtml(cta.id)}" aria-labelledby="dossier-final-title">
        <div class="container dossier-final__inner">
          <div class="dossier-final__copy">
            <h2 id="dossier-final-title">${escapeHtml(cta.title)}</h2>
            <p>${escapeHtml(cta.text)}</p>
          </div>
          <div class="dossier-final__contact">
            <a class="dossier-button dossier-button--primary" href="tel:${escapeHtml(cta.phoneHref)}">${escapeHtml(cta.buttonLabel)}</a>
            <a class="dossier-final__phone" href="tel:${escapeHtml(cta.phoneHref)}">${escapeHtml(cta.phone)}</a>
            <p>${escapeHtml(cta.address)}</p>
          </div>
        </div>
      </section>`;
}

function renderStructuredData(page, canonicalUrl) {
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const webpageId = `${canonicalUrl}#webpage`;
  const serviceId = `${canonicalUrl}#service`;
  const imageUrl = absoluteUrl(page.seo.social.image);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: canonicalUrl,
        name: page.seo.title,
        description: page.seo.description,
        inLanguage: "ru-RU",
        image: imageUrl,
        breadcrumb: { "@id": breadcrumbId },
        mainEntity: { "@id": serviceId },
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name: page.hero.h1,
        serviceType: "Ремонт грузовых автомобилей",
        description: page.seo.description,
        url: canonicalUrl,
        provider: { "@id": `${siteUrl}#auto-repair` },
        areaServed: { "@type": "City", name: "Сургут" },
        mainEntityOfPage: { "@id": webpageId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: page.breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.label,
          item: item.href === undefined ? canonicalUrl : absoluteUrl(item.href),
        })),
      },
    ],
  };

  return JSON.stringify(graph, null, 2).replaceAll("<", "\\u003c");
}

function buildInternalServiceContext(page, rootPath) {
  const canonicalUrl = absoluteUrl(page.seo.canonicalPath || `${page.path}/`);
  const tocLinks = renderTocLinks(page.toc);

  return {
    rootPath,
    assetVersion,
    title: escapeHtml(page.seo.title),
    description: escapeHtml(page.seo.description),
    canonicalUrl: escapeHtml(canonicalUrl),
    socialTitle: escapeHtml(page.seo.social.title),
    socialDescription: escapeHtml(page.seo.social.description),
    ogImage: escapeHtml(absoluteUrl(page.seo.social.image)),
    ogImageAlt: escapeHtml(page.seo.social.imageAlt),
    heroImageSrc: relativeHref(rootPath, page.hero.image.src),
    heroImageAlt: escapeHtml(page.hero.image.alt),
    heroImageWidth: String(Number(page.hero.image.width)),
    heroImageHeight: String(Number(page.hero.image.height)),
    heroImageCaption: escapeHtml(page.hero.image.caption),
    breadcrumbs: renderBreadcrumbs(page.breadcrumbs, rootPath),
    h1: escapeHtml(page.hero.h1),
    lead: escapeHtml(page.hero.lead),
    heroCtaLabel: escapeHtml(page.hero.ctaLabel),
    tocDesktop: tocLinks,
    tocMobile: tocLinks,
    sections: renderInternalSections(page.sections, rootPath),
    finalCta: renderFinalCta(page.finalCta),
    structuredData: renderStructuredData(page, canonicalUrl),
  };
}

function buildSeoPages() {
  const partials = readPartials();
  const pages = readJson(path.join(dataDir, "seo-pages.json"));
  if (!pages.length) return;

  const templates = {
    default: fs.readFileSync(path.join(templatesDir, "seo-page.html"), "utf8"),
    "internal-service": fs.readFileSync(path.join(templatesDir, "internal-service-page.html"), "utf8"),
  };

  for (const page of pages) {
    const target = path.join(distDir, page.path, "index.html");
    if (fs.existsSync(target)) continue;

    const relativeFile = path.relative(distDir, target);
    const rootPath = getRootPath(relativeFile);
    const templateKey = page.template || "default";
    const template = templates[templateKey];
    if (!template) throw new Error(`Unknown SEO page template: ${templateKey}`);

    const context = templateKey === "internal-service"
      ? buildInternalServiceContext(page, rootPath)
      : {
        rootPath,
        assetVersion,
        title: escapeHtml(page.title),
        description: escapeHtml(page.description),
        breadcrumbLabel: escapeHtml(page.breadcrumbLabel || "Ремонт"),
        breadcrumbHref: escapeHtml(page.breadcrumbHref || "remont/"),
        kicker: escapeHtml(page.kicker),
        h1: escapeHtml(page.h1),
        lead: escapeHtml(page.lead),
        worksTitle: escapeHtml(page.worksTitle),
        works: renderList(page.works, rootPath),
        techTitle: escapeHtml(page.techTitle),
        techText: escapeHtml(page.techText),
        brands: renderBrands(page.brands),
        processTitle: escapeHtml(page.processTitle),
        process: renderList(page.process, rootPath),
        ctaTitle: escapeHtml(page.ctaTitle),
        ctaText: escapeHtml(page.ctaText),
        related: renderRelated(page.related, rootPath),
      };

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(template, partials, context), "utf8");
  }
}

cleanDir(distDir);
copyDir(assetsDir, path.join(distDir, "assets"));
buildPages();
buildSeoPages();
console.log("Built dist/");
