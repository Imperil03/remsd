// Presentation variants share facts, not copied contact strings.
function siteContext(site, escapeHtml) {
  const values = {
    sitePhone: site.phone,
    sitePhoneHref: site.phoneHref,
    siteEmail: site.email,
    siteMailHref: `mailto:${site.email}`,
    siteHeaderAddress: `${site.address.locality}, ${site.address.street.replace(/^ул\.\s*/u, "")}`,
    siteAddress: `г. ${site.address.locality}, ${site.address.street}`,
    siteStreet: site.address.street,
    siteOpeningHoursLabel: site.openingHours.label,
    siteMapUrl: site.mapUrl,
    siteMapEmbedUrl: `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(`${site.address.locality}, ${site.address.street}`)}&z=16`,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value)]));
}
module.exports = { siteContext };
