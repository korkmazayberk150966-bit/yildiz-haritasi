import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Entry {
  id: string;
  kind: "stars" | "dust" | "nebula";
  lod: number;
  url: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  byteLength: number;
  pointCount: number;
}

const outDir = join(process.cwd(), "public", "tiles");
mkdirSync(outDir, { recursive: true });

const entries: Entry[] = [
  makeTile("root-stars", "stars", 0, 2200, 7.2, 0),
  makeTile("root-dust", "dust", 0, 1200, 5.8, 1),
  makeTile("near-arm-a", "stars", 1, 1800, 3.8, 2, 2.4),
  makeTile("near-arm-b", "stars", 1, 1800, 3.8, 3, -2.4),
  makeTile("dust-lane-a", "dust", 1, 900, 3.4, 4, 1.1),
  makeTile("nebula-local", "nebula", 2, 520, 1.9, 5, -0.9)
];

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({
    version: 1,
    coordinateSystem: "galactic-cartesian",
    units: "scene",
    rootUrl: "tiles/",
    tiles: entries
  }, null, 2)
);

function makeTile(
  id: Entry["id"],
  kind: Entry["kind"],
  lod: number,
  pointCount: number,
  radius: number,
  seed: number,
  offsetX = 0
): Entry {
  const rng = mulberry32(0x515100 + seed);
  const floats = new Float32Array(pointCount * 8);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < pointCount; i++) {
    const angle = rng() * Math.PI * 2;
    const arm = Math.sin(angle * 2.2 + seed) * 0.65;
    const r = Math.pow(rng(), 0.72) * radius;
    const x = Math.cos(angle) * r + offsetX + arm;
    const y = (rng() - 0.5) * (kind === "dust" ? 0.42 : 0.24);
    const z = Math.sin(angle) * r + Math.cos(angle * 3.0) * 0.25;
    const warmth = kind === "dust" ? 0.78 + rng() * 0.18 : 0.86 + rng() * 0.14;
    const blue = kind === "dust" ? 0.42 + rng() * 0.18 : 0.76 + rng() * 0.2;
    const offset = i * 8;
    floats[offset] = x;
    floats[offset + 1] = y;
    floats[offset + 2] = z;
    floats[offset + 3] = kind === "dust" ? 0.72 * warmth : 0.55 + rng() * 0.35;
    floats[offset + 4] = kind === "dust" ? 0.45 * warmth : 0.62 + rng() * 0.28;
    floats[offset + 5] = blue;
    floats[offset + 6] = kind === "dust" ? 2.5 + rng() * 4.5 : 0.7 + rng() * 1.8;
    floats[offset + 7] = kind === "dust" ? 0.12 + rng() * 0.24 : 0.28 + rng() * 0.55;
    min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); max[2] = Math.max(max[2], z);
  }

  const url = `${id}.bin`;
  writeFileSync(join(outDir, url), Buffer.from(floats.buffer));
  return { id, kind, lod, url, bounds: { min, max }, byteLength: floats.byteLength, pointCount };
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
