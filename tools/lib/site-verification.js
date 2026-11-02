const fs = require("node:fs");
const path = require("node:path");

function loadSiteVerification(root) {
  const source = process.env.REMSD_VERIFICATION_DIR || path.join(root, ".local", "site-verification");
  if (!fs.existsSync(source)) throw new Error("Для production нужны приватные файлы Google и Яндекса (см. docs/seo-launch.md).");
  const entries = fs.readdirSync(source, { withFileTypes: true });
  const files = new Map();
  for (const [provider, pattern] of [["Google", /^google([a-f0-9]{16})\.html$/], ["Яндекс", /^yandex_([a-f0-9]{16})\.html$/]]) {
    const matches = entries.filter(entry => entry.isFile() && pattern.test(entry.name));
    if (matches.length !== 1) throw new Error('Ожидается один подтверждённый файл ' + provider);
    const name = matches[0].name;
    const data = fs.readFileSync(path.join(source, name));
    const contents = data.toString("utf8").trim();
    const token = name.match(pattern)[1];
    const valid = provider === "Google"
      ? contents === 'google-site-verification: ' + name
      : new RegExp('^<html>\\s*<head>\\s*(?:<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"\\s*/?>\\s*)?</head>\\s*<body>\\s*Verification: ' + token + '\\s*</body>\\s*</html>$', "i").test(contents);
    if (!valid) throw new Error('Содержимое файла подтверждения ' + provider + ' не соответствует его имени.');
    files.set(name, data);
  }
  return files;
}

function checkSiteVerification(distDir, files) {
  for (const [name, expected] of files) {
    const output = path.join(distDir, name);
    if (!fs.existsSync(output) || !fs.readFileSync(output).equals(expected)) {
      throw new Error("Сборка потеряла или изменила файл подтверждения поисковой системы.");
    }
  }
}

module.exports = { loadSiteVerification, checkSiteVerification };
