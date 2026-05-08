const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const pagesDir = path.join(srcDir, "pages");
const partialsDir = path.join(srcDir, "partials");
const assetsDir = path.join(root, "assets");
const distDir = path.join(root, "dist");

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

function render(content, partials) {
  let output = content;

  for (const [name, html] of Object.entries(partials)) {
    output = output.replaceAll(`{{${name}}}`, html);
  }

  return output;
}

function buildPages() {
  const partials = readPartials();

  for (const file of fs.readdirSync(pagesDir)) {
    if (!file.endsWith(".html")) continue;

    const source = path.join(pagesDir, file);
    const target = path.join(distDir, file);
    const html = fs.readFileSync(source, "utf8");

    fs.writeFileSync(target, render(html, partials), "utf8");
  }
}

cleanDir(distDir);
copyDir(assetsDir, path.join(distDir, "assets"));
buildPages();

console.log("Built dist/");

