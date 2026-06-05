import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TEXTURES: Array<{ name: string; url: string; path: string }> = [
  { name: "Mercury", url: "https://space.jpl.nasa.gov/tmaps/pix/mer0muu2.jpg", path: "public/textures/planets/mercury.jpg" },
  { name: "Venus", url: "https://space.jpl.nasa.gov/tmaps/pix/ven0aaa2.jpg", path: "public/textures/planets/venus.jpg" },
  { name: "Earth day", url: "https://space.jpl.nasa.gov/tmaps/pix/ear0xuu2.jpg", path: "public/textures/planets/earth-day.jpg" },
  { name: "Earth night", url: "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002916/earthatnight-2048.png", path: "public/textures/planets/earth-night.png" },
  { name: "Earth clouds", url: "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg", path: "public/textures/planets/earth-clouds.jpg" },
  { name: "Mars", url: "https://space.jpl.nasa.gov/tmaps/pix/mar0kuu2.jpg", path: "public/textures/planets/mars.jpg" },
  { name: "Jupiter", url: "https://space.jpl.nasa.gov/tmaps/pix/jup0vss1.jpg", path: "public/textures/planets/jupiter.jpg" },
  { name: "Saturn", url: "https://space.jpl.nasa.gov/tmaps/pix/sat0fds1.jpg", path: "public/textures/planets/saturn.jpg" },
  { name: "Uranus", url: "https://space.jpl.nasa.gov/tmaps/pix/ura0fss1.jpg", path: "public/textures/planets/uranus.jpg" },
  { name: "Neptune", url: "https://space.jpl.nasa.gov/tmaps/pix/nep0fds1.jpg", path: "public/textures/planets/neptune.jpg" }
];

async function main(): Promise<void> {
  for (const texture of TEXTURES) {
    const output = resolve(texture.path);
    const response = await fetch(texture.url);
    if (!response.ok) throw new Error(`${texture.name} texture download failed: ${response.status}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, Buffer.from(await response.arrayBuffer()));
    console.log(`Downloaded ${texture.name} -> ${texture.path}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
