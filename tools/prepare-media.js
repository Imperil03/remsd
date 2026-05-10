const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "assets", "img");

const brandAssets = [
  ["kamaz", "https://static.tildacdn.com/tild3334-6135-4233-b435-316562646436/logo-kamaz.png"],
  ["maz", "https://static.tildacdn.com/tild6530-6533-4666-b435-386136373562/8f162a9s-1920.jpg"],
  ["ural", "https://static.tildacdn.com/tild6137-3265-4034-b666-613665303862/ural_logo.png"],
  ["volvo", "https://static.tildacdn.com/tild3937-3332-4234-a435-353864346637/volvo-speclogo.jpg"],
  ["jcb", "https://static.tildacdn.com/tild6330-6566-4164-b066-633435633066/jcb-speclogo.jpg"],
  ["scania", "https://static.tildacdn.com/tild3239-3464-4134-a536-383564613531/scania-speclogo.jpg"],
  ["renault", "https://static.tildacdn.com/tild6339-3230-4164-b533-326531373962/renault-speclogo.jpg"],
  ["new-holland", "https://static.tildacdn.com/tild6564-6534-4439-b362-643064623764/newholland-speclogo.jpg"],
  ["mercedes-benz", "https://static.tildacdn.com/tild3235-6536-4862-a237-386331633731/mercedes-speclogo.jpg"],
  ["man", "https://static.tildacdn.com/tild6363-6535-4330-b635-356634613235/man-speclogo.jpg"],
  ["komatsu", "https://static.tildacdn.com/tild3163-3232-4363-a230-653063343330/komatsu-speclogo.jpg"],
  ["john-deere", "https://static.tildacdn.com/tild6361-6339-4033-a233-306433643662/johndeer-speclogo.jpg"],
  ["uzst", "https://static.tildacdn.com/tild6266-6234-4231-a662-323961323739/car-brand_23.jpg"],
].map(([name, url]) => ({
  url,
  variants: [
    {
      output: `brands/${name}.webp`,
      width: 300,
      height: 170,
      fit: "contain",
      quality: 82,
    },
  ],
}));

const galleryAssets = [
  ["base-entrance", "https://static.tildacdn.com/tild3435-6130-4931-a433-343437313830/XXXL-_4_.jpg"],
  ["base-road-sign", "https://static.tildacdn.com/tild3235-6165-4563-a634-386263313461/XXXL.jpg"],
  ["shop-empty", "https://static.tildacdn.com/tild6438-3035-4936-a430-666161666534/XXXL_5.jpg"],
  [
    "volvo-service-bay",
    "https://static.tildacdn.com/tild3230-3336-4238-a335-313731616332/30258560096988472_cd.jpg",
    { left: 0, top: 0, width: 1440, height: 1660 },
  ],
  ["maz-service-bay", "https://static.tildacdn.com/tild3062-3162-4239-a434-343631656163/XXXL-_3_.jpg"],
  ["dump-truck-repair", "https://static.tildacdn.com/tild3035-3639-4530-a139-386264636535/_WhatsApp_2024-12-10.jpg"],
  ["chassis-repair", "https://static.tildacdn.com/tild6337-6562-4565-b162-333765663737/_WhatsApp_2024-12-10.jpg"],
  ["orange-truck-detail", "https://static.tildacdn.com/tild3063-6664-4164-b037-353565643265/_WhatsApp_2024-12-10.jpg"],
  ["engine-assembly", "https://static.tildacdn.com/tild3035-3439-4866-a132-306132383633/_WhatsApp_2024-12-10.jpg"],
  ["engine-work", "https://static.tildacdn.com/tild6162-3432-4330-a561-373838643462/_WhatsApp_2024-12-10.jpg"],
  ["loader-service", "https://static.tildacdn.com/tild3730-6365-4035-b934-376633323538/_WhatsApp_2024-12-10.jpg"],
  ["press-machine", "https://static.tildacdn.com/tild3361-3461-4236-b839-623536343632/_WhatsApp_2024-12-10.jpg"],
  ["production-zone", "https://static.tildacdn.com/tild6239-3735-4037-b034-623264346533/_WhatsApp_2024-12-10.jpg"],
  ["workbench-zone", "https://static.tildacdn.com/tild6266-3833-4965-b061-623366613334/_WhatsApp_2024-12-10.jpg"],
  ["shop-equipment", "https://static.tildacdn.com/tild6562-3631-4639-a162-623461666231/_WhatsApp_2024-12-10.jpg"],
  ["tool-zone", "https://static.tildacdn.com/tild6638-6366-4464-b639-366261333330/_WhatsApp_2024-12-10.jpg"],
].map(([name, url, crop]) => ({
  url,
  crop,
  variants: [
    {
      output: `gallery/thumb/${name}.webp`,
      width: 720,
      height: 520,
      fit: "cover",
      quality: 76,
    },
    {
      output: `gallery/large/${name}.webp`,
      width: 1440,
      height: 1080,
      fit: "inside",
      quality: 82,
    },
  ],
}));

const certificateAssets = [
  ["ural-certificate", "https://static.tildacdn.com/tild3834-6331-4734-a130-333464646662/_WhatsApp_2024-12-13.jpg"],
  ["weichai-training", "https://static.tildacdn.com/tild6133-6364-4736-b930-376433393030/_WhatsApp_2024-12-13.jpg"],
  ["advers-certificate", "https://static.tildacdn.com/tild6633-6133-4534-a437-366664643230/doc20241011155239022.jpg"],
  ["maz-certificate", "https://static.tildacdn.com/tild3336-3563-4663-b266-653538303339/maz.jpg"],
  ["conformity-01", "https://static.tildacdn.com/tild3964-3463-4461-b661-353861626337/1.jpg"],
  ["conformity-02", "https://static.tildacdn.com/tild3935-6533-4966-a462-393930323433/2.jpg"],
  ["conformity-03", "https://static.tildacdn.com/tild6338-3237-4231-a562-373331366365/3.jpg"],
  ["conformity-04", "https://static.tildacdn.com/tild6661-6538-4031-b233-333635373136/4.jpg"],
  ["conformity-05", "https://static.tildacdn.com/tild3166-3339-4930-a162-646433393837/5.jpg"],
  ["conformity-06", "https://static.tildacdn.com/tild6531-6637-4530-b434-636462343739/6.jpg"],
].map(([name, url]) => ({
  url,
  variants: [
    {
      output: `certificates/thumb/${name}.webp`,
      width: 420,
      height: 600,
      fit: "contain",
      quality: 78,
    },
    {
      output: `certificates/large/${name}.webp`,
      width: 1500,
      height: 1800,
      fit: "inside",
      quality: 84,
    },
  ],
}));

const jobs = [...brandAssets, ...galleryAssets, ...certificateAssets];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function cleanGeneratedDirs() {
  for (const dir of ["brands", "gallery", "certificates"]) {
    fs.rmSync(path.join(assetsDir, dir), { recursive: true, force: true });
  }
}

async function prepareVariant(input, job, variant) {
  const outputPath = path.join(assetsDir, variant.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let pipeline = sharp(input).rotate();
  if (job.crop) {
    pipeline = pipeline.extract(job.crop);
  }

  await pipeline
    .resize({
      width: variant.width,
      height: variant.height,
      fit: variant.fit,
      position: "attention",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .webp({ quality: variant.quality, effort: 6 })
    .toFile(outputPath);

  const size = fs.statSync(outputPath).size;
  console.log(`${variant.output} ${(size / 1024).toFixed(1)} KB`);
}

async function prepareAsset(job) {
  const input = await download(job.url);
  for (const variant of job.variants) {
    await prepareVariant(input, job, variant);
  }
}

async function main() {
  cleanGeneratedDirs();

  for (const job of jobs) {
    await prepareAsset(job);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
