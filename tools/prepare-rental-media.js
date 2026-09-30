const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sourcePage = "https://remsd.ru/arenda";
const names = ["crane-80", "crane-40", "crane-25-28", "crane-25-21", "crane-50", "loader-3", "bulldozer", "pipelayer", "crawler-excavator", "doosan-180", "grader", "concrete", "dump-truck", "mini-tractor", "loader-5"];
async function get(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    return response;
  } catch (error) {
    if (process.platform !== "win32") throw error;
    // Windows may expose the configured system proxy only to its native client.
    const base64 = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$response = Invoke-WebRequest -UseBasicParsing -Uri $env:REMSD_MEDIA_URL -TimeoutSec 45; [Convert]::ToBase64String($response.RawContentStream.ToArray())"], { env: { ...process.env, REMSD_MEDIA_URL: url }, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const buffer = Buffer.from(base64.trim(), "base64");
    return { text: async () => buffer.toString("utf8"), arrayBuffer: async () => buffer };
  }
}
async function main() {
  const html = await (await get(sourcePage)).text();
  const urls = [...html.matchAll(/<div\s+class="t853__bgimg\s+t-bgimg"\s+data-original="([^"]+)"/g)].map((match) => match[1]);
  if (urls.length !== names.length) throw new Error(`Каталог изменился: ожидалось ${names.length} фотографий, получено ${urls.length}. Проверьте соответствие карточек.`);
  const directory = path.join(root, "assets/img/rental");
  fs.mkdirSync(directory, { recursive: true });
  const images = [];
  const catalogFile = path.join(root, "src/data/rental-catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
  const categoryImages = new Set(catalog.categories.map((item) => item.image));
  for (let index = 0; index < names.length; index++) {
    const input = Buffer.from(await (await get(urls[index])).arrayBuffer());
    const origin = urls[index].replaceAll("&", "&amp;");
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:source>${origin}</dc:source></rdf:Description></rdf:RDF></x:xmpmeta>`;
    const output = `assets/img/rental/${names[index]}.webp`;
    const info = await sharp(input).rotate().resize({ width: 960, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).withXmp(xmp).toFile(path.join(root, output));
    const record = { id: names[index], source: urls[index], sourceCard: index + 1, output, width: info.width, height: info.height, sourceSha256: crypto.createHash("sha256").update(input).digest("hex") };
    if (categoryImages.has(output)) {
      record.thumbnail = `assets/img/rental/${names[index]}-thumb.webp`;
      const thumb = await sharp(input).rotate().resize(640, 400, { fit: "cover" }).webp({ quality: 72 }).withXmp(xmp).toFile(path.join(root, record.thumbnail));
      record.thumbnailWidth = thumb.width;
      record.thumbnailHeight = thumb.height;
    }
    images.push(record);
    if (names[index] === "crane-50") {
      for (const [file, width, height] of [["hero", 1672, 941], ["hero-mobile", 720, 920]]) {
        await sharp(input).rotate().resize(width, height, { fit: "cover", position: "centre" }).webp({ quality: 82 }).withXmp(xmp).toFile(path.join(directory, `${file}.webp`));
      }
    }
    console.log(`Prepared ${output} (${info.width}×${info.height})`);
  }
  const heroRecord = "docs/rental-hero-image-sources.json";
  const hero = fs.existsSync(path.join(root, heroRecord))
    ? { sourceRecord: heroRecord, kind: "generated-illustration", outputs: JSON.parse(fs.readFileSync(path.join(root, heroRecord), "utf8")).variants.map((item) => item.output) }
    : { sourceImageId: "crane-50", outputs: ["assets/img/rental/hero.webp", "assets/img/rental/hero-mobile.webp"] };
  fs.writeFileSync(path.join(root, "docs/rental-image-sources.json"), JSON.stringify({ schemaVersion: 1, sourcePage, capturedAt: "2026-09-26", images, hero }, null, 2) + "\n");
  for (const item of [...catalog.categories, ...catalog.equipment]) {
    const media = images.find((image) => image.output === item.image);
    if (media) { item.imageWidth = media.width; item.imageHeight = media.height; }
    if (media?.thumbnail && item.equipmentIds) {
      item.thumbnail = media.thumbnail;
      item.thumbnailWidth = media.thumbnailWidth;
      item.thumbnailHeight = media.thumbnailHeight;
    }
  }
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + "\n");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
