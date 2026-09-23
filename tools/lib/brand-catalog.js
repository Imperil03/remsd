// One catalogue for the homepage, navigation and internal pages. A brand is
// linked only when its entity has a published PageDefinition in this build.
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function destination(brands, name, context) {
  const entityRef = brands.entityRefs?.[name];
  const route = context.routeByEntity?.get(entityRef);
  const current = Boolean(entityRef && entityRef === context.currentEntityRef);
  return { current, href: route && !current ? `${context.rootPath}${route}/` : null };
}

function renderOfficialBrands(brands, context) {
  return brands.official.map((brand) => {
    const { current, href } = destination(brands, brand.name, context);
    const tag = href ? "a" : "div";
    const attributes = href ? ` href="${escapeHtml(href)}" aria-label="Ремонт ${escapeHtml(brand.name)}, официальный сервис"` : current ? ' aria-current="page"' : "";
    const slug = brands.entityRefs?.[brand.name]?.replace(/^brand-/, "") || brand.image.split("/").pop().replace(/\.webp$/, "");
    return `<li class="v3-brand-card v3-brand-card--official${current ? " is-current-brand" : ""}" data-brand="${escapeHtml(slug)}">
  <${tag} class="v3-brand-card__body"${attributes}>
    <span class="v3-brand-card__logo"><img src="${context.rootPath}${escapeHtml(brand.image)}" alt="" width="220" height="120" loading="lazy" decoding="async"></span>
    <strong class="v3-brand-card__name">Ремонт ${escapeHtml(brand.name)}</strong>
    <span class="v3-brand-card__status">Официальный сервис${current ? " · Вы здесь" : ""}</span>
  </${tag}>
</li>`;
  }).join("\n");
}

function renderBrandMatrix(brands, context) {
  return brands.items.map((name) => {
    const { current, href } = destination(brands, name, context);
    const text = escapeHtml(name);
    if (href) return `<li><a href="${escapeHtml(href)}" aria-label="Ремонт ${text}">${text}</a></li>`;
    if (current) return `<li class="is-current-brand"><span aria-current="page">${text}<small>Вы здесь</small></span></li>`;
    return `<li>${text}</li>`;
  }).join("\n");
}

function renderBrandNavigation(brands, context, official = false) {
  const names = official ? brands.official.map((brand) => brand.name) : brands.items;
  return names.map((name) => {
    const { href, current } = destination(brands, name, context);
    const label = official ? `Ремонт ${name}` : name;
    const css = official ? ' class="main-nav__brand main-nav__brand--official"' : "";
    if (href) return `<a${css} href="${escapeHtml(href)}"${official ? ` aria-label="${escapeHtml(label)}, официальный сервис"` : ""}>${escapeHtml(label)}</a>`;
    return `<span${css}${current ? ' aria-current="page"' : ""}>${escapeHtml(label)}</span>`;
  }).join("\n");
}

module.exports = { renderOfficialBrands, renderBrandMatrix, renderBrandNavigation };
