const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const manifestPath = path.resolve(root, process.argv[2] || "docs/rental-hero-image-sources.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

(async () => {
  for (const variant of manifest.variants) {
    const input = fs.readFileSync(path.join(root, variant.source));
    if (variant.cropRegion === "right-53-percent-full-height") {
      const metadata = await sharp(input).metadata();
      const left = Math.floor(metadata.width * 0.47);
      variant.crop = { left, top: 0, width: metadata.width - left, height: metadata.height };
    }
    const output = path.join(root, variant.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:source="${xml(variant.source)}" dc:description="${xml(`${manifest.tool}; ${manifest.createdAt}; ${manifest.purpose} Prompt: ${variant.prompt}`)}"/></rdf:RDF></x:xmpmeta>`;
    const image = sharp(input);
    if (variant.crop) image.extract(variant.crop);
    const info = await image.resize({ width: variant.maxWidth, withoutEnlargement: true }).webp({ quality: variant.quality }).withXmp(xmp).toFile(output);
    variant.width = info.width;
    variant.height = info.height;
    variant.bytes = info.size;
    variant.sourceSha256 = crypto.createHash("sha256").update(input).digest("hex");
    console.log(`${variant.output}: ${info.width}x${info.height}, ${info.size} bytes`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
})().catch((error) => { console.error(error); process.exitCode = 1; });
