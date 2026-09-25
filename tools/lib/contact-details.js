const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const details = require("../../src/data/contact-details.json");

function requisiteRows(site) {
  const org = details.organization;
  const rows = [
    ["Наименование", org.name],
    ["Полное наименование", org.fullName],
    ["ИНН", org.inn], ["КПП", org.kpp], ["ОГРН", org.ogrn],
    ["Юридический адрес", org.legalAddress],
    ["Фактический адрес", org.physicalAddress],
    ["Генеральный директор", org.director],
    ["ОКПО", org.okpo], ["ОКТМО", org.oktmo], ["ОКВЭД", org.okved],
  ];
  return rows;
}

function bankRows(bank) { return [["Расчётный счёт", bank.account], ["БИК", bank.bik], ["Корр. счёт", bank.correspondentAccount]]; }

function cardText(site) {
  return [...requisiteRows(site), ...details.organization.banks.flatMap((bank) => [["Банк", bank.name], ...bankRows(bank)]), ["Телефон", site.phone], ["Электронная почта", site.email], ["Сайт", "https://remsd.ru/"]]
    .map(([label, value]) => `${label}: ${value}`).join("\n");
}

function cardHash(site) { return createHash("sha256").update(cardText(site)).digest("hex"); }

function validateContactDetails(root, site) {
  for (const item of details.departments) {
    if (!item.label || !/^tel:\+7\d{10}$/.test(item.href) || item.phone.replace(/\D/g, "") !== item.href.replace(/\D/g, "")) throw new Error("Некорректный телефон отдела");
  }
  for (const item of details.messengers) if (!item.label || !/^https:\/\//.test(item.href)) throw new Error("Некорректная ссылка мессенджера");
  for (const [field, length] of [["inn", 10], ["kpp", 9], ["ogrn", 13]]) if (!new RegExp(`^\\d{${length}}$`).test(details.organization[field])) throw new Error(`Некорректные реквизиты: ${field}`);
  for (const [label, value] of requisiteRows(site)) if (typeof value !== "string" || !value.trim()) throw new Error(`Не заполнено поле ${label}`);
  for (const bank of details.organization.banks) {
    if (!bank.name || !/^\d{9}$/.test(bank.bik) || !/^\d{20}$/.test(bank.account) || !/^\d{20}$/.test(bank.correspondentAccount)) throw new Error("Некорректные банковские реквизиты");
  }
  const pdf = path.join(root, "assets/documents/remsd-requisites.pdf");
  const manifest = path.join(root, "src/data/contact-card-manifest.json");
  if (!fs.existsSync(pdf) || !fs.existsSync(manifest)) throw new Error("Подготовьте PDF реквизитов: npm run prepare:contacts");
  const current = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const pdfHash = createHash("sha256").update(fs.readFileSync(pdf)).digest("hex");
  if (current.sourceHash !== cardHash(site) || current.pdfHash !== pdfHash) throw new Error("PDF реквизитов не соответствует данным: npm run prepare:contacts");
}

module.exports = { details, requisiteRows, bankRows, cardText, cardHash, validateContactDetails };
