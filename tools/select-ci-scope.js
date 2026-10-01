const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { classifyChanges, assetVersionOnly, routesUsingAsset } = require("./lib/ci-scope");

const root = path.resolve(__dirname, "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const gh = (endpoint) => JSON.parse(execFileSync("gh", ["api", endpoint], { cwd: root, encoding: "utf8" }));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/data/internal-pages/index.json"), "utf8"));
const pages = manifest.pages.map((file) => ({ ...JSON.parse(fs.readFileSync(path.join(root, "src/data/internal-pages", file), "utf8")), file }));
const allRoutes = ["/", ...pages.map((page) => `/${page.path}/`)];
const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
let scope;
let base = option("--base");
const head = option("--head") || "HEAD";

try {
  if (args.includes("--full") || process.env.CI_FULL_CHECKS === "true") {
    scope = { mode: "full", routes: allRoutes, siteChanged: true, reasons: ["Запрошен полный прогон"] };
  } else {
    if (!base) {
      const repository = process.env.GITHUB_REPOSITORY;
      if (!repository) throw new Error("Не указан --base или GITHUB_REPOSITORY");
      const deployments = gh(`repos/${repository}/deployments?environment=github-pages&per_page=20`);
      for (const deployment of deployments) {
        const statuses = gh(`repos/${repository}/deployments/${deployment.id}/statuses`);
        if (statuses[0]?.state === "success") { base = deployment.sha; break; }
      }
      if (!base) throw new Error("Нет успешного Pages deployment для сравнения");
    }
    if (!/^[a-f0-9]{7,40}$/i.test(base)) throw new Error("Некорректный SHA базы");
    try { git("cat-file", "-e", `${base}^{commit}`); }
    catch { git("fetch", "--no-tags", "--depth=1", "origin", base); }
    const files = git("diff", "--name-only", "--no-renames", base, head).split("\n").filter(Boolean);
    const versionOnly = files.includes("tools/build.js") && assetVersionOnly(git("show", `${base}:tools/build.js`), git("show", `${head}:tools/build.js`));
    scope = classifyChanges({ files, pages, versionOnly, assetRoutes: (file) => routesUsingAsset(root, pages, fs, file) });
  }
} catch (error) {
  scope = { mode: "full", routes: allRoutes, siteChanged: true, reasons: [`Безопасный полный прогон: ${error.message}`] };
}

console.log(`CI scope: ${scope.mode}; ${scope.routes.length} маршрутов; base: ${base || "не определена"}`);
console.log(scope.routes.join(",") || "Изменений публичного интерфейса нет");
scope.reasons.forEach((reason) => console.log(reason));
const outputs = { mode: scope.mode, routes: scope.mode === "full" ? "" : scope.routes.join(","), site_changed: String(scope.siteChanged) };
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(""));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## Область проверок\n\nРежим: **${scope.mode}**, маршрутов: **${scope.routes.length}**. Сравнение с последним успешным Pages deployment: \`${base || "не определена"}\`.\n\n${scope.routes.map((route) => `- \`${route}\``).join("\n")}\n\n${scope.reasons.join("\n")}\n`);
