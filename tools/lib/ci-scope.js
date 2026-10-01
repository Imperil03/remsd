const path = require("node:path");

function assetVersionOnly(before, after) {
  const pattern = /^const assetVersion = process\.env\.ASSET_VERSION \|\| "[^"\n]+";$/m;
  if (!pattern.test(before) || !pattern.test(after)) return false;
  const normalize = (source) => source.replace(/\r\n/g, "\n").replace(pattern, "const assetVersion = VERSION;");
  return normalize(before) === normalize(after);
}

function classifyChanges({ files, pages, assetRoutes = () => [], versionOnly = false }) {
  const allRoutes = ["/", ...pages.map((page) => `/${page.path}/`)];
  const selected = new Set();
  const reasons = [];
  let siteChanged = false;
  let full = false;
  let generated = false;
  const add = (routes, reason) => {
    if (!routes.length) { full = true; reasons.push(`Не удалось ограничить: ${reason}`); return; }
    routes.forEach((route) => selected.add(route));
  };
  const family = (name) => pages.filter((page) => page.family === name).map((page) => `/${page.path}/`);
  const rentals = pages.filter((page) => page.rental).map((page) => `/${page.path}/`);
  const surfaces = {
    contact: family("contact"),
    company: family("company"),
    certificates: pages.filter((page) => page.family === "documents" && page.layout !== "policy").map((page) => `/${page.path}/`),
    policy: pages.filter((page) => page.layout === "policy").map((page) => `/${page.path}/`),
  };
  const homePartials = new Set(["v3-hero", "v3-contact", "v3-company-proof", "v3-service-base", "v3-repair-services", "v3-special-equipment", "v3-tech-categories", "home-structured-data"]);

  for (const file of files) {
    if (/^(docs\/|\.agent\/|\.impeccable\/)/.test(file) || /^(AGENTS|README|DESIGN|PRODUCT)\.md$/.test(file) || file === ".gitignore") continue;
    if (file === ".github/workflows/deploy-pages.yml" || /^tools\/(select-ci-scope\.js|test-ci-scope\.js|lib\/(ci-scope|browser-scope)\.js)$/.test(file) || file === "tools/verify-browser.js") continue;
    if (file.startsWith("dist/")) { generated = true; continue; }
    siteChanged = true;
    if (file === "tools/build.js" && versionOnly) continue;
    const page = pages.find((item) => file === `src/data/internal-pages/${item.file}`);
    if (page) { add([`/${page.path}/`], file); continue; }
    if (file === "src/pages/index.html" || /^assets\/css\/(styles-v3|home-critical)\.css$/.test(file)) { add(["/"], file); continue; }
    const partial = file.match(/^src\/partials\/([a-z-]+)\.html$/)?.[1];
    if (homePartials.has(partial)) { add(["/"], file); continue; }
    const surface = file.match(/^src\/templates\/(contact|company|certificates|policy)-page\.html$/)?.[1]
      || file.match(/^assets\/css\/(contact|company|certificates|policy)-(?:page|critical)\.css$/)?.[1]
      || file.match(/^tools\/lib\/verify-(contact|company|certificates|policy)-page\.js$/)?.[1];
    if (surface) { add(surfaces[surface], file); continue; }
    if (file === "tools/lib/contact-sections.js" || file === "assets/js/contact.js") { add(surfaces.contact, file); continue; }
    if (file === "src/data/contact-details.json" || file === "tools/lib/contact-details.js") { add([...surfaces.contact, ...rentals], file); continue; }
    if (file === "assets/css/document-ui.css") { add([...surfaces.company, ...surfaces.certificates], file); continue; }
    if (/^assets\/css\/rental-(hero|critical)\.css$/.test(file)) { add(rentals, file); continue; }
    if (/^assets\/(img|documents)\//.test(file)) { add(assetRoutes(file), file); continue; }
    full = true;
    reasons.push(`Общий или неизвестный файл: ${file}`);
  }
  // A generated-only edit has no trustworthy source boundary. Rebuild and use
  // the full safety net rather than silently overlooking a published artifact.
  if (generated && !siteChanged) { full = true; siteChanged = true; reasons.push("Изменён только dist"); }
  const routes = full ? allRoutes : allRoutes.filter((route) => selected.has(route));
  const mode = full || routes.length === allRoutes.length ? "full" : routes.length ? "focused" : "none";
  return { mode, routes, siteChanged, reasons };
}

function routesUsingAsset(root, pages, fs, file) {
  const targets = [{ path: "", file: path.join(root, "dist", "index.html") },
    ...pages.map((page) => ({ path: page.path, file: path.join(root, "dist", page.path, "index.html") }))];
  const variants = [file, encodeURI(file), path.posix.relative("assets/css", file)];
  return targets.filter((target) => {
    if (!fs.existsSync(target.file)) return false;
    const html = fs.readFileSync(target.file, "utf8");
    if (variants.some((value) => html.includes(value))) return true;
    const stylesheets = [...html.matchAll(/assets\/css\/[a-z-]+\.css/g)].map((match) => path.join(root, "dist", match[0]));
    return stylesheets.some((stylesheet) => fs.existsSync(stylesheet) && variants.some((value) => fs.readFileSync(stylesheet, "utf8").includes(value)));
  }).map((target) => target.path ? `/${target.path}/` : "/");
}

module.exports = { classifyChanges, assetVersionOnly, routesUsingAsset };
