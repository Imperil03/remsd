const path = require("path");
const sharp = require("sharp");

const imageDir = path.resolve(__dirname, "..", "assets", "img");
const source = path.join(imageDir, "logo-remsd.png");

async function main() {
  for (const [filename, size] of [["favicon.png", 64], ["apple-touch-icon.png", 180]]) {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(imageDir, filename));
    console.log(`Prepared ${filename}: ${size} × ${size}, transparent padding.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
