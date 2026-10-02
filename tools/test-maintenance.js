const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { loadInternalPageCatalog, validatePageDefinition, escapeHtml } = require("./lib/internal-pages");
const { createRentalSections, validateRentalRoutes } = require("./lib/rental-sections");
const { resolvePageTemplate, loadPageTemplates } = require("./lib/page-templates");
const { siteContext } = require("./lib/site-context");
const { monitorBrowserErrors } = require("./lib/browser-errors");
const { checkRelease } = require("./check-release");
const root=path.resolve(__dirname,"..");
const dataDir=path.join(root,"src/data");
const config=require("../src/data/site-config.json");
const catalog=loadInternalPageCatalog({root,dataDir,assetsDir:path.join(root,"assets"),siteConfig:config});
const context={root,assetsDir:path.join(root,"assets"),entityMap:catalog.contentModel.entityMap};
let count=0;
const check=(name,fn)=>{fn();count++;console.log(`OK ${name}`);};
function invalidPage(route,edit,pattern) {
  const page=structuredClone(catalog.pages.find(page=>page.path===route));
  edit(page);
  assert.throws(()=>validatePageDefinition(page,route,context),pattern);
}
check("current pages remain valid",()=>assert.equal(catalog.pages.length,require("../src/data/internal-pages/index.json").pages.length));
check("company requires documents",()=>invalidPage("o-kompanii",page=>page.sections=page.sections.filter(s=>s.type!=="companyDocuments"),/companyDocuments/));
check("company document anchor is stable",()=>invalidPage("o-kompanii",page=>page.sections.find(s=>s.type==="companyDocuments").id="other",/id documents/));
check("contacts require shortcuts",()=>invalidPage("kontakty",page=>page.sections.find(s=>s.type==="contactLocation").id="other",/kak-dobratsya/));
check("rental shell is required",()=>invalidPage("arenda/avtokrany",page=>delete page.rental,/rental: true/));
check("rental family is constrained",()=>invalidPage("arenda/avtokrany",page=>page.rental="true",/boolean/));
check("templates respect page families",()=>{
  const templates=loadPageTemplates(dataDir);
  assert.throws(()=>resolvePageTemplate({template:'repair-v1',family:'hub',rental:true},templates),/неарендное/);
  assert.throws(()=>resolvePageTemplate({template:'brand-v1',family:'hub'},templates),/семейство brand/);
});
check("rental routes exist before render",()=>{
  const source=structuredClone(require('../src/data/rental-catalog.json'));
  validateRentalRoutes(source,catalog.pages);
  source.categories[0].path='arenda/missing-category';
  assert.throws(()=>validateRentalRoutes(source,catalog.pages),/опубликованную/);
  source.categories[0].path='arenda/avtokrany';source.categories[0].entityRef='brand-kamaz';
  assert.throws(()=>validateRentalRoutes(source,catalog.pages),/entityRef/);
});
check("shared facts and escaping",()=>{
  const site=structuredClone(config.site); site.phone="Другой номер";site.phoneHref="tel:+70000000000";site.email='a&b@example.com';
  const data=siteContext(site,escapeHtml);
  assert.equal(data.sitePhone,"Другой номер");assert.equal(data.sitePhoneHref,site.phoneHref);
  assert.equal(data.siteEmail,'a&amp;b@example.com');assert.equal(data.siteHeaderAddress,"Сургут, Домостроителей, 13");
  assert.equal(data.siteAddress,"г. Сургут, ул. Домостроителей, 13");
  for(const file of fs.readdirSync(path.join(root,'src/partials')).filter(f=>f.endsWith('.html'))) {
    const html=fs.readFileSync(path.join(root,'src/partials',file),'utf8');
    assert(!html.includes(config.site.phoneHref),file+' duplicated phone');
    assert(!html.includes(config.site.email),file+' duplicated email');
  }
});
check("late browser errors fail",()=>{
  const page=new EventEmitter(),monitor=monitorBrowserErrors(page);
  monitor.begin("late scenario",200);monitor.assert();
  page.emit("pageerror",new Error("after interaction"));
  assert.throws(()=>monitor.assert(),/after interaction/);
  monitor.begin("404",404);
  page.emit("console",{type:()=>"error",text:()=>"Failed to load resource: the server responded with a status of 404 (Not Found)"});monitor.assert();
  page.emit("pageerror",new Error("not a network 404"));assert.throws(()=>monitor.assert(),/not a network 404/);
});
const results=path.join(root,"test-results");fs.mkdirSync(results,{recursive:true});
const temp=fs.mkdtempSync(path.join(results,"maintenance-data-"));
try {
  fs.mkdirSync(path.join(temp,"src/data"),{recursive:true});
  const requireArray=(value,label,{nonEmpty=false}={})=>{assert(Array.isArray(value),label);if(nonEmpty)assert(value.length,label);return value;};
  const requireText=(value,label)=>{assert(typeof value==='string'&&value.trim(),label);return value;};
  const registry=createRentalSections({requireArray,requireText,validateAsset:()=>{},escapeHtml,renderSectionHead:()=>''});
  const source=require("../src/data/rental-catalog.json");
  const validateRental=edit=>{const copy=structuredClone(source);edit(copy);fs.writeFileSync(path.join(temp,"src/data/rental-catalog.json"),JSON.stringify(copy));registry.rentalRates.validate({},"rates",{...context,root:temp});};
  check("valid rental catalog",()=>validateRental(()=>{}));
  check("missing rates fail early",()=>assert.throws(()=>validateRental(c=>delete c.equipment[0].rates),/rates/));
  check("missing catalog array fails clearly",()=>assert.throws(()=>validateRental(c=>delete c.categories),/rental.categories/));
  check("orphan machine fails early",()=>assert.throws(()=>validateRental(c=>c.categories.forEach(x=>x.equipmentIds=x.equipmentIds.filter(id=>id!==c.equipment[0].id))),/ровно одной/));
  check("duplicate membership fails",()=>assert.throws(()=>validateRental(c=>c.categories[1].equipmentIds.push(c.equipment[0].id)),/ровно одной/));
  const release=path.join(temp,"release");fs.mkdirSync(release);
  const origin=config.modes.production.baseUrl;
  const html=base=>`<html><head><meta name="robots" content="index,follow"><link rel="canonical" href="${base}"><meta property="og:url" content="${base}"><meta property="og:image" content="${base}assets/a.webp"><meta name="twitter:image" content="${base}assets/a.webp"><script type="application/ld+json">{"@context":"https://schema.org","url":"${base}"}</script></head></html>`;
  fs.writeFileSync(path.join(release,"index.html"),html(origin));
  fs.writeFileSync(path.join(release,"404.html"),'<meta name="robots" content="noindex,follow">');
  fs.writeFileSync(path.join(release,"sitemap.xml"),`<urlset><url><loc>${origin}</loc></url></urlset>`);
  fs.writeFileSync(path.join(release,"robots.txt"),`User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n`);
  check("production origin passes",()=>assert.equal(checkRelease(release,origin),1));
  for(const bad of ['http://127.0.0.1:4175/','https://imperil03.github.io/remsd/']) check("foreign release origin fails "+bad,()=>{fs.writeFileSync(path.join(release,"index.html"),html(bad));assert.throws(()=>checkRelease(release,origin),/canonical/);});
  check("mixed JSON-LD origin fails",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin).replace('"url":"'+origin+'"','"url":"http://localhost/"'));assert.throws(()=>checkRelease(release,origin),/JSON-LD/);});
  for(const bad of ['//preview.example/path','/relative','', 'ftp://remsd.ru/']) check("non-absolute JSON-LD fails "+bad,()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin).replace('"url":"'+origin+'"','"url":"'+bad+'"'));assert.throws(()=>checkRelease(release,origin),/JSON-LD/);});
  check("missing JSON-LD fails",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin).replace(/<script[\s\S]*?<\/script>/,''));assert.throws(()=>checkRelease(release,origin),/JSON-LD/);});
  check("missing social image fails",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin).replace(/<meta name="twitter:image"[^>]*>/,''));assert.throws(()=>checkRelease(release,origin),/twitter:image/);});
  check("null JSON-LD URL fails",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin).replace('"url":"'+origin+'"','"url":null'));assert.throws(()=>checkRelease(release,origin),/JSON-LD/);});
  check("sitemap prefix is not equality",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin));fs.writeFileSync(path.join(release,"robots.txt"),`Sitemap: ${origin}sitemap.xml-old\n`);assert.throws(()=>checkRelease(release,origin),/robots.txt/);});
  check("indexable 404 fails",()=>{fs.writeFileSync(path.join(release,"index.html"),html(origin));fs.writeFileSync(path.join(release,"404.html"),'<meta name="robots" content="index,follow">');assert.throws(()=>checkRelease(release,origin),/404.html/);});
} finally {
  if (!temp.startsWith(results+path.sep+'maintenance-data-')) throw new Error("Unexpected temporary target");
  fs.rmSync(temp,{recursive:true,force:true});
}
console.log(`Maintenance contracts passed: ${count} checks.`);
