import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const SVS_BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851";
const OUTPUT_DIR = "public/textures/deep-space";

const NEBULAE = [
  { key: "orion", title: "Orion Nebula", ra: 5.588, dec: -5.391, angularSizeDeg: 1.1, url: "https://images-assets.nasa.gov/image/PIA04227/PIA04227~medium.jpg" },
  { key: "crab", title: "Crab Nebula", ra: 5.576, dec: 22.014, angularSizeDeg: 0.12, url: "https://images-assets.nasa.gov/image/PIA03606/PIA03606~medium.jpg" },
  { key: "eagle", title: "Eagle Nebula / Pillars", ra: 18.314, dec: -13.817, angularSizeDeg: 0.45, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000842/GSFC_20171208_Archive_e000842~medium.jpg" },
  { key: "carina", title: "Carina Nebula", ra: 10.752, dec: -59.867, angularSizeDeg: 1.8, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e002076/GSFC_20171208_Archive_e002076~medium.jpg" }
];

const GALAXIES = [
  { key: "andromeda", title: "Andromeda Galaxy", hero: true, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000833/GSFC_20171208_Archive_e000833~small.jpg" },
  { key: "whirlpool", title: "Whirlpool Galaxy", hero: true, url: "https://images-assets.nasa.gov/image/PIA04230/PIA04230~small.jpg" },
  { key: "sombrero", title: "Sombrero Galaxy", hero: true, url: "https://images-assets.nasa.gov/image/PIA15226/PIA15226~medium.jpg" },
  { key: "spiral-1", title: "Hubble Spiral Galaxy", hero: false, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000158/GSFC_20171208_Archive_e000158~medium.jpg" },
  { key: "spiral-2", title: "Hubble Sunflower Galaxy", hero: false, url: "https://images-assets.nasa.gov/image/hubble-sees-a-galactic-sunflower_21136469209_o/hubble-sees-a-galactic-sunflower_21136469209_o~small.jpg" },
  { key: "elliptical-1", title: "Hubble Elliptical Galaxy", hero: false, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000504/GSFC_20171208_Archive_e000504~medium.jpg" },
  { key: "elliptical-2", title: "NGC 454", hero: false, url: "https://images-assets.nasa.gov/image/PIA10386/PIA10386~medium.jpg" },
  { key: "irregular-1", title: "Hubble Irregular Galaxy", hero: false, url: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000154/GSFC_20171208_Archive_e000154~small.jpg" },
  { key: "irregular-2", title: "Dwarf Galaxy", hero: false, url: "https://images-assets.nasa.gov/image/hubble-peers-at-a-distinctly-disorganized-dwarf-galaxy_25568403123_o/hubble-peers-at-a-distinctly-disorganized-dwarf-galaxy_25568403123_o~small.jpg" }
];

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await buildSkyMaps();
  await buildAtlas("nebula-atlas.webp", NEBULAE, 512);
  await buildAtlas("galaxy-atlas.webp", GALAXIES, 512);
  await writeManifest();
}

async function buildSkyMaps(): Promise<void> {
  await convertSkyMap("4k", 4096);
  if (!process.argv.includes("--skip-8k")) {
    await convertSkyMap("8k", 8192);
  } else {
    await convertSkyMap("8k", 4096);
  }
}

async function convertSkyMap(tier: "4k" | "8k", width: number): Promise<void> {
  const output = `${OUTPUT_DIR}/milkyway-celestial-${tier}.webp`;
  const exrUrl = `${SVS_BASE}/milkyway_2020_${tier}.exr`;
  const fallbackUrl = `${SVS_BASE}/milkyway_2020_4k_print.jpg`;
  if (process.argv.includes("--prefer-fallback")) {
    await convertImage(await download(fallbackUrl), output, Math.min(width, 4096), true);
    return;
  }
  try {
    await convertImage(await download(exrUrl), output, width);
  } catch (error) {
    console.warn(`EXR conversion unavailable for ${tier}; using SVS print fallback.`, error instanceof Error ? error.message : error);
    await convertImage(await download(fallbackUrl), output, Math.min(width, 4096), true);
  }
}

async function convertImage(source: Buffer, output: string, width: number, allowUpscale = false): Promise<void> {
  await sharp(source, { limitInputPixels: false })
    .resize({ width, withoutEnlargement: !allowUpscale })
    .modulate({ brightness: 1.08, saturation: 1.08 })
    .webp({ quality: 82, effort: 5 })
    .toFile(resolve(output));
  console.log(`Wrote ${output}`);
}

async function buildAtlas(name: string, items: Array<{ url: string }>, tileSize: number): Promise<void> {
  const columns = 4;
  const rows = Math.ceil(items.length / columns);
  const composites = await Promise.all(items.map(async (item, index) => {
    const image = await download(item.url);
    const left = (index % columns) * tileSize;
    const top = Math.floor(index / columns) * tileSize;
    const input = await sharp(image)
      .resize(tileSize, tileSize, { fit: "cover" })
      .modulate({ brightness: 1.05, saturation: 1.06 })
      .webp({ quality: 82 })
      .toBuffer();
    return { input, left, top };
  }));
  await sharp({
    create: {
      width: columns * tileSize,
      height: rows * tileSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .webp({ quality: 84, effort: 5 })
    .toFile(resolve(OUTPUT_DIR, name));
  console.log(`Wrote ${name}`);
}

async function writeManifest(): Promise<void> {
  const manifest = {
    skyMaps: {
      celestialNoBrightStars4k: "textures/deep-space/milkyway-celestial-4k.webp",
      celestialNoBrightStars8k: "textures/deep-space/milkyway-celestial-8k.webp"
    },
    nebulaAtlas: {
      image: "textures/deep-space/nebula-atlas.webp",
      columns: 4,
      rows: Math.ceil(NEBULAE.length / 4),
      items: NEBULAE
    },
    galaxyAtlas: {
      image: "textures/deep-space/galaxy-atlas.webp",
      columns: 4,
      rows: Math.ceil(GALAXIES.length / 4),
      items: GALAXIES
    }
  };
  const output = resolve(OUTPUT_DIR, "manifest.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(manifest, null, 2));
  console.log("Wrote manifest.json");
}

async function download(url: string): Promise<Buffer> {
  const candidates = url.includes("images-assets.nasa.gov")
    ? [url, url.replace(/~medium\./, "~small."), url.replace(/~medium\./, "~thumb."), url.replace(/~small\./, "~medium."), url.replace(/~small\./, "~thumb.")]
    : [url];

  let lastStatus = 0;
  for (const candidate of [...new Set(candidates)]) {
    const response = await fetch(candidate, {
      headers: {
        "User-Agent": "Mozilla/5.0 YildizHaritasi/0.1",
        "Referer": "https://images.nasa.gov/"
      }
    });
    lastStatus = response.status;
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Download failed ${lastStatus}: ${url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
