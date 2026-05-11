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
const assetVersion = process.env.ASSET_VERSION || "20260511-main-merge";

// Check if v2 mode
const isV2 = process.argv.includes('--v2');

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

  for (const [name, html] of Object.entries(partials)) {
    output = output.replaceAll(`{{${name}}}`, html);
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

function buildPages() {
  const partials = readPartials();

  for (const source of getHtmlFiles(pagesDir)) {
    if (path.basename(source) === "index-v2.html") continue;

    const relativeFile = path.relative(pagesDir, source);
    const target = path.join(distDir, relativeFile);
    const html = fs.readFileSync(source, "utf8");
    const context = {
      rootPath: getRootPath(relativeFile),
      assetVersion,
    };

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(html, partials, context), "utf8");
  }
}

function renderList(items, rootPath = "") {
  return items
    .map((item) => {
      if (typeof item === "string") return `          <li>${item}</li>`;

      const suffix = item.text ? ` ${item.text}` : "";
      return `          <li><a href="${rootPath}${item.href}">${item.label}</a>${suffix}</li>`;
    })
    .join("\n");
}

function renderBrands(items) {
  return items.map((item) => `          <span>${item}</span>`).join("\n");
}

function renderRelated(items, rootPath) {
  return items
    .map((item) => `        <a href="${rootPath}${item.href}">${item.label}</a>`)
    .join("\n");
}

function buildSeoPages() {
  const partials = readPartials();
  const pages = readJson(path.join(dataDir, "seo-pages.json"));
  if (!pages.length) return;

  const template = fs.readFileSync(path.join(templatesDir, "seo-page.html"), "utf8");

  for (const page of pages) {
    const target = path.join(distDir, page.path, "index.html");
    if (fs.existsSync(target)) continue;

    const relativeFile = path.relative(distDir, target);
    const rootPath = getRootPath(relativeFile);
    const context = {
      rootPath,
      assetVersion,
      title: page.title,
      description: page.description,
      breadcrumbLabel: page.breadcrumbLabel || "Ремонт",
      breadcrumbHref: page.breadcrumbHref || "remont/",
      kicker: page.kicker,
      h1: page.h1,
      lead: page.lead,
      worksTitle: page.worksTitle,
      works: renderList(page.works, rootPath),
      techTitle: page.techTitle,
      techText: page.techText,
      brands: renderBrands(page.brands),
      processTitle: page.processTitle,
      process: renderList(page.process, rootPath),
      ctaTitle: page.ctaTitle,
      ctaText: page.ctaText,
      related: renderRelated(page.related, rootPath),
    };

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(template, partials, context), "utf8");
  }
}

function buildV2() {
  const partials = readPartials();
  const v2Dir = path.join(distDir, "v2");
  const assetsV2Dir = path.join(v2Dir, "assets");

  cleanDir(v2Dir);
  copyDir(assetsDir, assetsV2Dir);

  // Build v2 index
  const source = path.join(pagesDir, "index-v2.html");
  const html = fs.readFileSync(source, "utf8");
  const context = {
    rootPath: "./",
    assetVersion: assetVersion + "-v2",
  };
  const target = path.join(v2Dir, "index.html");
  fs.writeFileSync(target, render(html, partials, context), "utf8");
  console.log("Built v2/");
}

// Main build
if (isV2) {
  buildV2();
} else {
  cleanDir(distDir);
  copyDir(assetsDir, path.join(distDir, "assets"));
  buildPages();
  buildSeoPages();
  buildV2();
  console.log("Built dist/");
}
