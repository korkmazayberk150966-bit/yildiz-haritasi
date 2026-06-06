import * as THREE from "three";

import { localSiderealTime, raDecToAltAz } from "../astro/math";
import type { ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { createDeepSkyMaterial } from "./deepSpaceMaterial";
import {
  buildBlobGalaxyArrays,
  buildSpiralGalaxyArrays,
  createGalaxyMaterial,
  mergeGalaxyArraysToPoints,
  type GalaxyParticleArrays
} from "./galaxyParticles";
import { createRoundPointMaterial } from "./roundPointMaterial";
import {
  createVolumetricNebula,
  getNebulaColors,
  type SkyNebulaSpec
} from "./volumetricNebula";

const BASE = `${import.meta.env.BASE_URL}textures/deep-space/`;
const SKY_RADIUS = 180;

interface DeepSpaceManifest {
  skyMaps: {
    celestialNoBrightStars4k: string;
    celestialNoBrightStars8k: string;
  };
  nebulaAtlas: AtlasManifest<NebulaItem>;
  galaxyAtlas: AtlasManifest<unknown>;
}

interface AtlasManifest<T> {
  image: string;
  columns: number;
  rows: number;
  items: T[];
}

interface NebulaItem {
  key: string;
  title: string;
  ra: number;
  dec: number;
  angularSizeDeg: number;
}

export class DeepSpaceAssets {
  private textureLoader = new THREE.TextureLoader();
  private manifest?: DeepSpaceManifest;

  async loadManifest(): Promise<DeepSpaceManifest> {
    if (this.manifest) return this.manifest;
    const response = await fetch(`${BASE}manifest.json`);
    if (!response.ok) throw new Error("Deep-space manifest yüklenemedi.");
    this.manifest = await response.json() as DeepSpaceManifest;
    return this.manifest;
  }

  async loadTexture(path: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        `${import.meta.env.BASE_URL}${path}`,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          resolve(texture);
        },
        undefined,
        () => reject(new Error(`Doku yüklenemedi: ${path}`))
      );
    });
  }
}

// ─── KATMAN 1: Gökyüzü arka plan dokusu ──────────────────────────────────────
export async function createDeepSkyBackground(
  assets: DeepSpaceAssets,
  quality: QualityProfile,
  observation: ObservationTime,
  location: ResolvedLocation
): Promise<THREE.Mesh> {
  const manifest = await assets.loadManifest();
  const mapPath = quality.skyTextureTier === "8k"
    ? manifest.skyMaps.celestialNoBrightStars8k
    : manifest.skyMaps.celestialNoBrightStars4k;
  const texture = await assets.loadTexture(mapPath);
  const material = createDeepSkyMaterial(texture, location, localSiderealTime(observation.utcDate, location.longitude));
  return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 0.992, 64, 32), material);
}

// ─── KATMAN 1: Hacimsel parçacık nebulalar ────────────────────────────────────
export async function createVolumetricNebulaGroup(
  assets: DeepSpaceAssets,
  quality: QualityProfile,
  observation: ObservationTime,
  location: ResolvedLocation
): Promise<THREE.Group> {
  const manifest = await assets.loadManifest();
  const group = new THREE.Group();
  const pr = Math.min(window.devicePixelRatio || 1, 2);

  // Parçacık sayısı kaliteye göre
  const pCount = quality.name === "low" ? 220 : quality.name === "medium" ? 650 : 1600;

  for (const item of manifest.nebulaAtlas.items as NebulaItem[]) {
    const horizontal = raDecToAltAz(item.ra, item.dec, observation.utcDate, location.latitude, location.longitude);
    const alt = THREE.MathUtils.degToRad(horizontal.altitude);
    const az = THREE.MathUtils.degToRad(horizontal.azimuth);

    // Gökyüzünde 3B konum (biraz içeride, yıldızların altında)
    const d = SKY_RADIUS * 0.91;
    const center = new THREE.Vector3(
      Math.cos(alt) * Math.sin(az) * d,
      Math.sin(alt) * d,
      Math.cos(alt) * Math.cos(az) * d
    );

    // Ufkun altındaki nebulalar için çok düşük opaklık (görünmez)
    if (horizontal.altitude < -15) continue;
    const horizFade = Math.min(1, (horizontal.altitude + 15) / 20);

    // Nebula angular boyut → scene units yarıçap
    const angRad = THREE.MathUtils.degToRad(item.angularSizeDeg * 0.5);
    const radius = angRad * d;

    const [innerColor, outerColor] = getNebulaColors(item.key);
    const cloud = createVolumetricNebula({
      center,
      rx: radius,
      ry: radius * 0.55, // biraz basık
      rz: radius,
      innerColor,
      outerColor,
      particleCount: pCount,
      baseOpacity: 0.07 * horizFade,
      pixelRatio: pr
    });
    group.add(cloud);
  }
  return group;
}

// ─── KATMAN 3: Samanyolu İÇİ görünümü — kamera diskin içinde ─────────────────
export function createMilkyWayInteriorLayer(quality: QualityProfile): THREE.Group {
  const group = new THREE.Group();
  const pr = Math.min(window.devicePixelRatio || 1, 2);

  // Büyük galaksi: kamera disk içinde (z=2.25, galaksi merkezi=0,0,0)
  const galaxyRadius = 6.5;
  const galaxyThickness = 0.14;

  // Parçacık sayıları
  const totalParticles = quality.name === "low" ? 6500 : quality.name === "medium" ? 18000 : 38000;

  const arrays = buildSpiralGalaxyArrays({
    center: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0), // kameraya düz
    radius: galaxyRadius,
    thickness: galaxyThickness,
    armCount: 4, // Samanyolu 4 kollu
    armBend: 1.8,
    particleCount: totalParticles,
    innerColor: new THREE.Color("#ffd080"),   // galaktik merkez sıcak sarı
    midColor: new THREE.Color("#ffe8c0"),     // kol beyazı
    outerColor: new THREE.Color("#8090ff"),   // dış disk soğuk mavi
    sizeScale: 1.0,
    opacityScale: 0.18
  });

  const pts = mergeGalaxyArraysToPoints([arrays], pr);
  group.add(pts);

  // Hacimsel toz nebulalar galaktik düzlemde
  if (quality.name !== "low") {
    const nebulaCount = quality.name === "medium" ? 2 : 4;
    const nebPCount = quality.name === "medium" ? 420 : 1100;

    for (let i = 0; i < nebulaCount; i++) {
      const angle = (i / nebulaCount) * Math.PI * 2 + Math.random() * 0.8;
      const r = 1.5 + Math.random() * 3.0;
      const center = new THREE.Vector3(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 0.15,
        Math.sin(angle) * r
      );
      const nebR = 0.3 + Math.random() * 0.5;
      // Alternatif renkler: toz kırmızısı, H-alpha pembe, OIII mavi
      const palettes: Array<[string, string]> = [
        ["#ff4060", "#2050ff"],
        ["#ff8040", "#40a0ff"],
        ["#20c880", "#8040ff"],
        ["#ffd040", "#ff6080"],
      ];
      const [ic, oc] = palettes[i % palettes.length];
      const cloud = createVolumetricNebula({
        center,
        rx: nebR, ry: nebR * 0.4, rz: nebR,
        innerColor: new THREE.Color(ic),
        outerColor: new THREE.Color(oc),
        particleCount: nebPCount,
        baseOpacity: 0.08,
        pixelRatio: pr
      });
      group.add(cloud);
    }
  }

  // Güneş konumu işareti
  group.add(createSunMarker());

  return group;
}

// ─── KATMAN 4: Kozmik Galaksi Katmanı — LOD sistemi ─────────────────────────
export function createCosmicGalaxyLayer(quality: QualityProfile): THREE.Group {
  const group = new THREE.Group();
  const pr = Math.min(window.devicePixelRatio || 1, 2);

  // LOD sayıları — kararına göre
  const heroCount = quality.name === "low" ? 8 : quality.name === "medium" ? 14 : 20;
  const bgCount   = quality.name === "low" ? 45 : quality.name === "medium" ? 130 : 280;
  const heroParticles = quality.name === "low" ? 420 : quality.name === "medium" ? 1100 : 2200;
  const bgParticles   = quality.name === "low" ? 28  : quality.name === "medium" ? 70  : 130;

  const allArrays: GalaxyParticleArrays[] = [];

  // Kahraman galaksiler — yakın, tam spiral
  const heroColors: Array<[string, string, string]> = [
    ["#ffd080", "#ffffff", "#8090ff"],  // Andromeda tipi
    ["#ffa040", "#ffeecc", "#60a0ff"],  // Whirlpool tipi
    ["#ffe060", "#fff0c0", "#4080ff"],  // Sombrero tipi
    ["#ff8060", "#ffddcc", "#7060ff"],  // NGC spiral
    ["#ffe8a0", "#ffffff", "#90a8ff"],  // Sarmal
  ];

  const rng = mulberry32(0xdeadbeef);

  for (let i = 0; i < heroCount; i++) {
    // Yarı-küresel dağılım, 25-150 birim mesafe
    const r = 25 + rng() * 125;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const center = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.72,
      r * Math.sin(phi) * Math.sin(theta)
    );

    // Rastgele oryantasyon
    const rotation = new THREE.Euler(
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
      rng() * Math.PI * 2
    );

    const colPalette = heroColors[i % heroColors.length];
    const sizeS = 1.8 * (1 - r / 180); // yakın → büyük
    const opS   = 0.34 + (1 - r / 150) * 0.22;
    const galRadius = 2.5 + rng() * 3.5;

    const arrays = buildSpiralGalaxyArrays({
      center,
      rotation,
      radius: galRadius,
      thickness: galRadius * 0.025,
      armCount: rng() > 0.5 ? 2 : 4,
      armBend: 1.2 + rng() * 1.4,
      particleCount: heroParticles,
      innerColor: new THREE.Color(colPalette[0]),
      midColor:   new THREE.Color(colPalette[1]),
      outerColor: new THREE.Color(colPalette[2]),
      sizeScale: Math.max(0.3, sizeS),
      opacityScale: Math.max(0.035, opS * 0.32)
    });
    allArrays.push(arrays);
  }

  // Arka plan galaksiler — uzak, blob
  const bgPalettes: THREE.Color[] = [
    new THREE.Color("#ffd090"), new THREE.Color("#90b0ff"),
    new THREE.Color("#ffa060"), new THREE.Color("#c0d8ff"),
    new THREE.Color("#ffcc80"), new THREE.Color("#a0c0ff"),
  ];

  for (let i = 0; i < bgCount; i++) {
    const r = 120 + rng() * 300;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const center = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.85,
      r * Math.sin(phi) * Math.sin(theta)
    );

    const blob = buildBlobGalaxyArrays({
      center,
      radius: 0.5 + rng() * 1.5,
      flattening: 0.3 + rng() * 0.5,
      color: bgPalettes[i % bgPalettes.length],
      particleCount: bgParticles,
      sizeScale: Math.max(0.15, 0.8 * (1 - r / 430)),
      opacityScale: Math.max(0.018, 0.095 * (1 - r / 430))
    });
    allArrays.push(blob);
  }

  // Tek draw call ile tümünü birleştir
  if (allArrays.length > 0) {
    group.add(mergeGalaxyArraysToPoints(allArrays, pr));
  }

  return group;
}

// ─── Güneş konumu işareti ─────────────────────────────────────────────────────
function createSunMarker(): THREE.Group {
  const group = new THREE.Group();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#ffe7a8" })
  );
  marker.position.set(1.3, 0.02, 0.08);
  group.add(marker);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 16),
    new THREE.MeshBasicMaterial({
      color: "#ffcc44",
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  halo.position.copy(marker.position);
  group.add(halo);
  return group;
}

// ─── Küçük deterministik RNG (seed'li) ───────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// SkyApp'in fallback sistemi için geriye dönük uyumluluk
export { createRoundPointMaterial };
