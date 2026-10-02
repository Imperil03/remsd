const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const decode = value => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#039;", "'").replaceAll("&#39;", "'");
function assertSiteUrl(value, baseUrl, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label}: нужен абсолютный production URL`); }
  const base = new URL(baseUrl);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`${label}: URL не принадлежит ${baseUrl}`);
}
function checkRelease(distDir, baseUrl) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.hostname === "localhost" || /^[\d.]+$/.test(base.hostname)) throw new Error("Release требует публичный HTTPS origin");
  const files = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory,entry.name);
    return entry.isDirectory() ? files(file) : entry.name.endsWith(".html") ? [file] : [];
  });
  const expected = new Set();
  for (const file of files(distDir)) {
    const relative = path.relative(distDir,file).replaceAll(path.sep,"/");
    const html = fs.readFileSync(file,"utf8");
    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
    const robots = html.match(/<meta\b[^>]*name="robots"[^>]*content="([^"]+)"/i)?.[1] || "";
    if (relative === "404.html") {
      if (!/\bnoindex\b/i.test(robots) || canonical) throw new Error("404.html: требуется noindex без canonical");
      continue;
    }
    const url = new URL(relative.replace(/(?:^|\/)index\.html$/, "/").replace(/^\//,""),baseUrl).href;
    expected.add(url);
    if (!/\bindex\b/i.test(robots) || /\bnoindex\b/i.test(robots)) throw new Error(`${relative}: release должен быть indexable`);
    if (!canonical || decode(canonical) !== url) throw new Error(`${relative}: неверный production canonical`);
    const ogUrl = html.match(/<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/i)?.[1];
    if (!ogUrl || decode(ogUrl) !== url) throw new Error(`${relative}: неверный og:url`);
    for (const name of ["og:image", "twitter:image"]) {
      const value = html.match(new RegExp(`<meta\\b[^>]*(?:property|name)="${name}"[^>]*content="([^"]+)"`, "i"))?.[1];
      if (!value) throw new Error(`${relative}: отсутствует ${name}`);
      assertSiteUrl(decode(value),baseUrl,relative+" "+name);
    }
    const urlKeys = new Set(["@id", "url", "item", "logo", "image", "contentUrl", "embedUrl", "sameAs"]);
    const inspect = (value, key="") => {
      if (key === "@context") return;
      if (urlKeys.has(key) && (value === null || (typeof value !== "string" && typeof value !== "object"))) throw new Error(`${relative}: невалидный JSON-LD URL ${key}`);
      if (typeof value === "string" && (urlKeys.has(key) || /^https?:/i.test(value))) assertSiteUrl(value,baseUrl,relative+" JSON-LD "+key);
      else if (Array.isArray(value)) value.forEach(item=>inspect(item,key));
      else if (value && typeof value === "object") Object.entries(value).forEach(([name,item])=>inspect(item,name));
    };
    const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    if (!scripts.length) throw new Error(`${relative}: отсутствует JSON-LD`);
    for (const match of scripts) inspect(JSON.parse(match[1]));
  }
  if (!expected.size) throw new Error("Release: нет содержательных HTML страниц");
  const sitemap = fs.readFileSync(path.join(distDir,"sitemap.xml"),"utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>decode(match[1]));
  if (locations.length !== expected.size || new Set(locations).size !== locations.length || locations.some(url=>!expected.has(url))) throw new Error("sitemap: состав/адреса не совпадают с production HTML");
  const robotsTxt = fs.readFileSync(path.join(distDir,"robots.txt"),"utf8");
  const sitemapLines = [...robotsTxt.matchAll(/^Sitemap:\s*(\S+)\s*$/gmi)].map(match => match[1]);
  if (sitemapLines.length !== 1 || sitemapLines[0] !== new URL("sitemap.xml",baseUrl).href || /^Disallow:\s*\/\s*$/mi.test(robotsTxt)) throw new Error("robots.txt: неверная production политика");
  return expected.size;
}
if (require.main === module) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root,"src/data/site-config.json"),"utf8"));
    console.log(`Production release origins OK: ${checkRelease(path.join(root,"dist"),config.modes.production.baseUrl)} pages; 404 noindex.`);
  } catch (error) {console.error(`[release] ${error.message}`); process.exitCode=1;}
}
module.exports = { checkRelease, assertSiteUrl };
