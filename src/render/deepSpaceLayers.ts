import * as THREE from "three";

import { localSiderealTime, raDecToAltAz } from "../astro/math";
import type { ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { createDeepSkyMaterial } from "./deepSpaceMaterial";
import { buildBlobGalaxyArrays, buildSpiralGalaxyArrays, mergeGalaxyArraysToPoints, type GalaxyParticleArrays } from "./galaxyParticles";
import { GALACTIC_CENTER, SUN_START } from "./MilkyWayFlightController";
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

  group.add(createInteriorStarField(quality));
  group.add(createGalacticDustBand(quality));
  group.add(createGalacticCenterGlow(quality));

  // Hacimsel toz/nebulalar galaktik düzlemde; içinden uçulabilir yerel bulutlar
  if (quality.name !== "low") {
    const nebulaCount = quality.name === "medium" ? 3 : 5;
    const nebPCount = quality.name === "medium" ? 520 : 1300;

    for (let i = 0; i < nebulaCount; i++) {
      const z = -3.5 - i * 5.2;
      const side = i % 2 === 0 ? -1 : 1;
      const center = new THREE.Vector3(
        side * (1.8 + Math.random() * 2.8),
        (Math.random() - 0.5) * 0.52,
        z + (Math.random() - 0.5) * 2.4
      );
      const nebR = 0.42 + Math.random() * 0.72;
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
        rx: nebR * 1.5, ry: nebR * 0.62, rz: nebR * 1.3,
        innerColor: new THREE.Color(ic),
        outerColor: new THREE.Color(oc),
        particleCount: nebPCount,
        baseOpacity: 0.08,
        pixelRatio: pr
      });
      cloud.userData = {
        type: "nebula",
        info: {
          name: `Yerel Hacimsel Nebula ${i + 1}`,
          desc: "MVP temsili 3B nebula bulutu. Gerçek Edenhofer/Gaia tabanlı hacimsel veri sonraki fazda aynı uçuş sahnesine bağlanacak.",
          distance: `${Math.round(Math.abs(z) * 300)} ışık yılı`
        }
      };
      group.add(cloud);
    }
  }

  // Güneş konumu işareti
  group.add(createSunMarker());
  group.add(createSagittariusAStar(quality));

  return group;
}

function createInteriorStarField(quality: QualityProfile): THREE.Points {
  const count = quality.name === "low" ? 9000 : quality.name === "medium" ? 22000 : 46000;
  const radius = quality.name === "low" ? 34 : 54;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const intensities = new Float32Array(count);
  const rng = mulberry32(0x1c0ffee);

  for (let i = 0; i < count; i++) {
    const zBias = -Math.pow(rng(), 0.58) * radius;
    const bandChance = rng();
    const x = (rng() - 0.5) * radius * (bandChance < 0.72 ? 1.3 : 2.1);
    const y = bandChance < 0.72
      ? (rng() - 0.5) * (0.35 + rng() * 1.1)
      : (rng() - 0.5) * radius * 0.72;
    const z = zBias + (rng() - 0.5) * 8;
    positions.set([x, y, z], i * 3);

    const warmTowardCenter = THREE.MathUtils.clamp(1 - Math.abs(z - GALACTIC_CENTER.z) / 90, 0, 1);
    const base = new THREE.Color("#9fb8ff").lerp(new THREE.Color("#ffe0a8"), warmTowardCenter * 0.85 + rng() * 0.12);
    colors.set([base.r, base.g, base.b], i * 3);
    sizes[i] = bandChance < 0.72 ? 0.55 + rng() * 1.7 : 0.45 + rng() * 1.2;
    intensities[i] = bandChance < 0.72 ? 0.24 + rng() * 0.62 : 0.12 + rng() * 0.38;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
  return new THREE.Points(geometry, createRoundPointMaterial({
    opacity: quality.name === "low" ? 0.62 : 0.74,
    maxPointSize: quality.name === "low" ? 3 : 4.2
  }));
}

function createGalacticDustBand(quality: QualityProfile): THREE.Points {
  const count = quality.name === "low" ? 1800 : quality.name === "medium" ? 5200 : 9800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const intensities = new Float32Array(count);
  const rng = mulberry32(0x51a7d057);

  for (let i = 0; i < count; i++) {
    const lane = rng() < 0.5 ? -0.72 : 0.72;
    const z = -rng() * 64;
    const x = (rng() - 0.5) * 34 + Math.sin(z * 0.12) * 2.2;
    const y = lane * (0.18 + rng() * 0.74) + (rng() - 0.5) * 0.28;
    positions.set([x, y, z], i * 3);
    colors.set([0.24 + rng() * 0.12, 0.17 + rng() * 0.08, 0.12 + rng() * 0.06], i * 3);
    sizes[i] = 3.5 + rng() * 8.5;
    intensities[i] = 0.08 + rng() * 0.18;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
  return new THREE.Points(geometry, createRoundPointMaterial({
    opacity: quality.name === "low" ? 0.18 : 0.24,
    maxPointSize: quality.name === "low" ? 8 : 11
  }));
}

function createGalacticCenterGlow(quality: QualityProfile): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uStrength: { value: quality.name === "low" ? 0.34 : 0.62 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uStrength;
      void main() {
        vec2 p = vUv - 0.5;
        float core = exp(-dot(p, p) * 7.5);
        float disk = exp(-(p.x * p.x * 2.0 + p.y * p.y * 22.0));
        vec3 color = mix(vec3(1.0, 0.50, 0.18), vec3(1.0, 0.86, 0.58), core);
        gl_FragColor = vec4(color, (core * 0.42 + disk * 0.18) * uStrength);
      }
    `
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), material);
  glow.position.copy(GALACTIC_CENTER).add(new THREE.Vector3(0, 0, 4));
  glow.lookAt(SUN_START);
  group.add(glow);
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
  marker.position.copy(SUN_START).add(new THREE.Vector3(0.32, 0.02, 0.12));
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

function createSagittariusAStar(quality: QualityProfile): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(GALACTIC_CENTER);
  group.userData = {
    type: "black-hole",
    info: {
      name: "Sagittarius A*",
      desc: "Samanyolu'nun merkezindeki süper kütleli kara delik. Kütlesi yaklaşık 4,3 milyon Güneş kütlesi, uzaklığı yaklaşık 26.000 ışık yılıdır.",
      distance: "~26.000 ışık yılı",
      mass: "~4,3 milyon Güneş kütlesi"
    }
  };

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(quality.name === "low" ? 0.22 : 0.34, 32, 16),
    new THREE.MeshBasicMaterial({ color: "#02030a" })
  );
  core.userData = group.userData;
  group.add(core);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#ffb35a",
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.82, 96), ringMaterial);
  ring.rotation.x = THREE.MathUtils.degToRad(74);
  ring.lookAt(SUN_START);
  ring.userData = group.userData;
  group.add(ring);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 32, 16),
    new THREE.MeshBasicMaterial({
      color: "#ff8a3d",
      transparent: true,
      opacity: quality.name === "low" ? 0.04 : 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.userData = group.userData;
  group.add(glow);

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
