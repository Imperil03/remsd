const fs = require("node:fs");
const path = require("node:path");
const { details, requisiteRows, bankRows, cardText } = require("./contact-details");

function renderContactChannels(site, esc) {
  const messenger = details.messengers.map((item) => `<a class="contacts-messenger" href="${esc(item.href)}" target="_blank" rel="noopener">${esc(item.label)}<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg></a>`).join("");
  const departments = details.departments.map((item) => `<div class="contacts-department"><div><h2>${esc(item.label)}</h2>${item.person ? `<p>${esc(item.person)}</p>` : ""}</div><a href="${esc(item.href)}">${esc(item.phone)}</a></div>`).join("");
  return `<div class="contacts-channels"><div class="contacts-primary"><p class="contacts-primary__label">Мастер · запись на ремонт</p><a class="contacts-primary__phone" href="${esc(site.phoneHref)}">${esc(site.phone)}</a><div class="contacts-primary__links"><a class="contacts-email" href="mailto:${esc(site.email)}">${esc(site.email)}</a>${messenger}</div><p class="contacts-hours">${esc(site.openingHours.label)}</p></div><div class="contacts-departments" aria-label="Телефоны отделов">${departments}</div></div>`;
}

function createContactSections({ requireText, validateAsset, escapeHtml: esc }) {
  return {
    contactLocation: {
      validate(s, label, context) {
        validateAsset(s.image, `${label}.image`, context);
        for (const key of ["imageAlt", "caption", "routeLabel"]) requireText(s[key], `${label}.${key}`);
        for (const key of ["imageWidth", "imageHeight"]) if (!Number.isInteger(s[key]) || s[key] < 1) throw new Error(`${label}.${key}: нужен размер изображения`);
      },
      render(s, { site, rootPath }) {
        return `<section class="contacts-location" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"><div class="container"><h2 id="${esc(s.id)}-title">${esc(s.title)}</h2><div class="contacts-location__layout"><div class="contacts-location__address"><p class="contacts-address">${esc(site.address.locality)},<br>${esc(site.address.street)}</p><a class="v3-button v3-button--primary" href="${esc(details.map.routeUrl)}" target="_blank" rel="noopener">${esc(s.routeLabel)}</a></div><div class="contacts-map"><iframe data-contact-map-src="${esc(details.map.embedUrl)}" title="РемСД на Яндекс.Картах" width="760" height="550" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div><figure class="contacts-entrance"><a href="${rootPath}${esc(s.image)}" target="_blank" rel="noopener" aria-label="Открыть фотографию въезда на базу"><img src="${rootPath}${esc(s.image)}" alt="${esc(s.imageAlt)}" width="${s.imageWidth}" height="${s.imageHeight}" loading="lazy" decoding="async"></a><figcaption>${esc(s.caption)}</figcaption></figure></div></div></section>`;
      },
    },
    contactRequisites: {
      validate(s, label) { for (const key of ["downloadLabel", "copyLabel"]) requireText(s[key], `${label}.${key}`); },
      render(s, { site, rootPath }) {
        const pdfPath = "assets/documents/remsd-requisites.pdf";
        const bytes = fs.statSync(path.join(__dirname, "../..", pdfPath)).size;
        const rows = requisiteRows(site).map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join("");
        const banks = details.organization.banks.map((bank) => `<table class="contacts-bank"><caption>${esc(bank.name)}</caption><tbody>${bankRows(bank).map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join("")}</tbody></table>`).join("");
        return `<section class="contacts-requisites" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"><div class="container contacts-requisites__layout"><div class="contacts-requisites__head"><h2 id="${esc(s.id)}-title">${esc(s.title)}</h2><a class="contacts-download" href="${rootPath}${pdfPath}" download="Реквизиты-РемСД.pdf"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg><span>${esc(s.downloadLabel)}<small>PDF, ${Math.ceil(bytes / 1024)} КБ</small></span></a><button class="contacts-copy" type="button" data-copy-requisites hidden>${esc(s.copyLabel)}</button><p class="contacts-copy-status" role="status" aria-live="polite" data-copy-status></p></div><div><table class="contacts-table" aria-label="Реквизиты ${esc(details.organization.name)}"><tbody>${rows}</tbody></table><div class="contacts-banks">${banks}</div></div></div><script type="application/json" id="contact-copy-data">${JSON.stringify(cardText(site)).replaceAll("<", "\\u003c")}</script></section>`;
      },
    },
  };
}

module.exports = { createContactSections, renderContactChannels };
