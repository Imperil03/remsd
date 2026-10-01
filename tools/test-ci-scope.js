const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { classifyChanges, assetVersionOnly, routesUsingAsset } = require("./lib/ci-scope");
const { selectBrowserScope } = require("./lib/browser-scope");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/data/internal-pages/index.json"), "utf8"));
const pages = manifest.pages.map((file) => ({ ...JSON.parse(fs.readFileSync(path.join(root, "src/data/internal-pages", file), "utf8")), file }));
const classify = (files, options = {}) => classifyChanges({ files, pages, ...options });
let checks = 0;
function check(label, callback) { callback(); checks++; console.log(`OK: ${label}`); }

check("Contact polish is one route, including cache-buster and generated files", () => {
  const result = classify(["assets/css/contact-page.css", "assets/css/contact-critical.css", "src/templates/contact-page.html", "tools/lib/contact-sections.js", "tools/lib/verify-contact-page.js", "tools/build.js", "dist/index.html", "dist/kontakty/index.html", "docs/contact-page.md"], { versionOnly: true });
  assert.equal(result.mode, "focused");
  assert.deepEqual(result.routes, ["/kontakty/"]);
  assert.equal(result.siteChanged, true);
});
check("One page's copy does not select its whole family", () => {
  assert.deepEqual(classify(["src/data/internal-pages/brand-hino.json"]).routes, ["/remont/hino/"]);
});
check("Home and reference hub have focused contracts", () => {
  assert.deepEqual(classify(["src/pages/index.html"]).routes, ["/"]);
  assert.deepEqual(classify(["src/data/internal-pages/remont-gruzovyh-avtomobiley.json"]).routes, ["/remont-gruzovyh-avtomobiley/"]);
});
check("Shared styles, menu, generator, manifest and unknown paths fall back to full", () => {
  for (const file of ["assets/css/site-chrome.css", "assets/css/internal-pages.css", "assets/js/main.js", "src/partials/main-nav.html", "tools/build.js", "src/data/internal-pages/index.json", "future-component.css"]) {
    assert.equal(classify([file]).mode, "full", file);
  }
});
check("Generated-only edits are not silently skipped", () => {
  assert.equal(classify(["dist/assets/css/contact.css"]).mode, "full");
});
check("Unmapped assets fail safe; referenced assets select their users", () => {
  assert.equal(classify(["assets/img/unknown.webp"]).mode, "full");
  const result = classify(["assets/img/contact.webp"], { assetRoutes: () => ["/kontakty/"] });
  assert.deepEqual(result.routes, ["/kontakty/"]);
});
check("Dedicated surfaces and document UI select only those surfaces", () => {
  assert.deepEqual(classify(["assets/css/company-page.css"]).routes, ["/o-kompanii/"]);
  assert.deepEqual(classify(["assets/css/document-ui.css"]).routes, ["/o-kompanii/", "/sertifikaty/"]);
  assert.deepEqual(classify(["assets/css/policy-page.css"]).routes, ["/policy/"]);
});
check("Contact source shared with rental selects both", () => {
  const result = classify(["src/data/contact-details.json"]);
  assert(result.routes.includes("/kontakty/"));
  assert(result.routes.includes("/arenda/"));
  assert(!result.routes.includes("/remont/hino/"));
});
check("CI and docs-only changes do not republish or invoke browsers", () => {
  const result = classify([".github/workflows/deploy-pages.yml", "tools/select-ci-scope.js", "tools/verify-browser.js", "tools/test-ci-scope.js", "tools/lib/ci-scope.js", "AGENTS.md", "docs/testing-policy.md"]);
  assert.deepEqual({ mode: result.mode, routes: result.routes, siteChanged: result.siteChanged }, { mode: "none", routes: [], siteChanged: false });
});
check("A version bump cannot conceal another build change, including CRLF", () => {
  const before = 'const assetVersion = process.env.ASSET_VERSION || "old";\r\nconst code = 1;\r\n';
  assert(assetVersionOnly(before, before.replace("old", "new")));
  assert(!assetVersionOnly(before, before.replace("old", "new").replace("code = 1", "code = 2")));
});
check("Focused home and hub never expand to all additional routes", () => {
  const paths = pages.map((page) => page.path);
  const reference = manifest.referenceByFamily.hub;
  const home = selectBrowserScope(paths, reference, "/");
  assert(home.focused && home.home && !home.reference);
  assert.deepEqual(home.additional, []);
  const hub = selectBrowserScope(paths, reference, `/${reference}/`);
  assert(hub.focused && !hub.home && hub.reference);
  assert.deepEqual(hub.additional, []);
  const contact = selectBrowserScope(paths, reference, "/kontakty/");
  assert(!contact.home && !contact.reference);
  assert.deepEqual(contact.additional, ["kontakty"]);
  assert.equal(selectBrowserScope(paths, reference).additional.length, paths.length - 1);
  assert.throws(() => selectBrowserScope(paths, reference, "/missing/"), /неизвестный маршрут/);
  assert.throws(() => selectBrowserScope(paths, reference, ","), /пустой список/);
});
check("Asset matching includes both HTML and stylesheet URLs", () => {
  const virtual = new Map([
    [path.join(root, "dist/index.html"), '<link href="assets/css/home.css"><img src="assets/img/home.webp">'],
    [path.join(root, "dist/assets/css/home.css"), '.hero{background:url(../img/background.webp)}'],
    [path.join(root, "dist/kontakty/index.html"), '<img src="../assets/img/entrance.webp">'],
  ]);
  const fakeFs = { existsSync: (file) => virtual.has(file), readFileSync: (file) => virtual.get(file) };
  assert.deepEqual(routesUsingAsset(root, pages, fakeFs, "assets/img/home.webp"), ["/"]);
  assert.deepEqual(routesUsingAsset(root, pages, fakeFs, "assets/img/background.webp"), ["/"]);
  assert.deepEqual(routesUsingAsset(root, pages, fakeFs, "assets/img/entrance.webp"), ["/kontakty/"]);
});
console.log(`CI scope checks passed: ${checks}`);
