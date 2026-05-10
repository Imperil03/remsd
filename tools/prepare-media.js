const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "assets", "img");

const jobs = [
  {
    url: "https://static.tildacdn.com/tild3334-6135-4233-b435-316562646436/logo-kamaz.png",
    output: "brands/kamaz.webp",
    width: 260,
    height: 160,
    fit: "contain",
    quality: 82,
  },
  {
    url: "https://static.tildacdn.com/tild6530-6533-4666-b435-386136373562/8f162a9s-1920.jpg",
    output: "brands/maz.webp",
    width: 260,
    height: 160,
    fit: "contain",
    quality: 82,
  },
  {
    url: "https://static.tildacdn.com/tild6137-3265-4034-b666-613665303862/ural_logo.png",
    output: "brands/ural.webp",
    width: 260,
    height: 160,
    fit: "contain",
    quality: 82,
  },
  {
    url: "https://static.tildacdn.com/tild3937-3332-4234-a435-353864346637/volvo-speclogo.jpg",
    output: "brands/volvo.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6330-6566-4164-b066-633435633066/jcb-speclogo.jpg",
    output: "brands/jcb.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3239-3464-4134-a536-383564613531/scania-speclogo.jpg",
    output: "brands/scania.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6339-3230-4164-b533-326531373962/renault-speclogo.jpg",
    output: "brands/renault.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6564-6534-4439-b362-643064623764/newholland-speclogo.jpg",
    output: "brands/new-holland.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3235-6536-4862-a237-386331633731/mercedes-speclogo.jpg",
    output: "brands/mercedes-benz.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6363-6535-4330-b635-356634613235/man-speclogo.jpg",
    output: "brands/man.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3163-3232-4363-a230-653063343330/komatsu-speclogo.jpg",
    output: "brands/komatsu.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6361-6339-4033-a233-306433643662/johndeer-speclogo.jpg",
    output: "brands/john-deere.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6266-6234-4231-a662-323961323739/car-brand_23.jpg",
    output: "brands/uzst.webp",
    width: 220,
    height: 120,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3435-6130-4931-a433-343437313830/XXXL-_4_.jpg",
    output: "gallery/base-entrance.webp",
    width: 960,
    height: 640,
    fit: "cover",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3062-3162-4239-a434-343631656163/XXXL-_3_.jpg",
    output: "gallery/service-bay.webp",
    width: 720,
    height: 520,
    fit: "cover",
    quality: 76,
  },
  {
    url: "https://static.tildacdn.com/tild3035-3639-4530-a139-386264636535/_WhatsApp_2024-12-10.jpg",
    output: "gallery/truck-repair.webp",
    width: 720,
    height: 520,
    fit: "cover",
    quality: 76,
  },
  {
    url: "https://static.tildacdn.com/tild6162-3432-4330-a561-373838643462/_WhatsApp_2024-12-10.jpg",
    output: "gallery/engine-work.webp",
    width: 720,
    height: 520,
    fit: "cover",
    quality: 76,
  },
  {
    url: "https://static.tildacdn.com/tild6562-3631-4639-a162-623461666231/_WhatsApp_2024-12-10.jpg",
    output: "gallery/shop-equipment.webp",
    width: 720,
    height: 520,
    fit: "cover",
    quality: 76,
  },
  {
    url: "https://static.tildacdn.com/tild3336-3563-4663-b266-653538303339/maz.jpg",
    output: "certificates/maz-certificate.webp",
    width: 420,
    height: 600,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild3834-6331-4734-a130-333464646662/_WhatsApp_2024-12-13.jpg",
    output: "certificates/ural-certificate.webp",
    width: 420,
    height: 600,
    fit: "contain",
    quality: 78,
  },
  {
    url: "https://static.tildacdn.com/tild6633-6133-4534-a437-366664643230/doc20241011155239022.jpg",
    output: "certificates/advers-certificate.webp",
    width: 420,
    height: 600,
    fit: "contain",
    quality: 78,
  },
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function prepareAsset(job) {
  const outputPath = path.join(assetsDir, job.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const input = await download(job.url);
  await sharp(input)
    .rotate()
    .resize({
      width: job.width,
      height: job.height,
      fit: job.fit,
      position: "attention",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .webp({ quality: job.quality, effort: 6 })
    .toFile(outputPath);

  const size = fs.statSync(outputPath).size;
  console.log(`${job.output} ${(size / 1024).toFixed(1)} KB`);
}

async function main() {
  for (const job of jobs) {
    await prepareAsset(job);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
