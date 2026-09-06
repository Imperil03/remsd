const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(`[page-templates] ${message}`);
}

function loadPageTemplates(dataDir) {
  const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, "page-templates.json"), "utf8"));
  if (catalog.schemaVersion !== 1 || !catalog.templates?.["repair-v1"]) fail("page-templates.json: требуется schemaVersion 1 и repair-v1");
  return catalog.templates;
}

// Authoring-only expansion: consumers continue to receive a complete PageDefinition.
function resolvePageTemplate(source, templates, label = "page") {
  const page = structuredClone(source);
  if (page.template === undefined) return page;
  const template = templates[page.template];
  if (!Object.hasOwn(templates, page.template) || !template) fail(`${label}: неизвестный шаблон «${page.template}»`);
  if (!page.hero || !Array.isArray(page.sections)) fail(`${label}: шаблону нужны hero и sections`);
  const types = page.sections.map((section) => section.type);
  if (JSON.stringify(types) !== JSON.stringify(template.sectionOrder)) fail(`${label}: порядок секций должен соответствовать ${page.template}`);
  function inject(target, key, value, field) {
    if (Object.hasOwn(target, key)) fail(`${label}.${field}: общие данные задаются только в page-templates.json`);
    target[key] = structuredClone(value);
  }
  inject(page.hero, "facts", template.heroFacts, "hero.facts");
  for (const section of page.sections) {
    if (section.type === "introProof") inject(section, "stats", template.proofStats, "introProof.stats");
    if (section.type === "brandShowcase") {
      for (const [key, value] of Object.entries(template.brands)) inject(section, key, value, `brandShowcase.${key}`);
    }
    if (section.type === "workStages") inject(section, "items", template.workStages, "workStages.items");
    if (section.type === "faq") inject(section, "contact", template.faqContact, "faq.contact");
  }
  delete page.template;
  return page;
}

module.exports = { loadPageTemplates, resolvePageTemplate };
