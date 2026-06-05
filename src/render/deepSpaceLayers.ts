import * as THREE from "three";

import { localSiderealTime, raDecToAltAz } from "../astro/math";
import type { ObservationTime, QualityProfile, ResolvedLocation } from "../types";
import { createAtlasBillboardMaterial, createDeepSkyMaterial } from "./deepSpaceMaterial";

const BASE = `${import.meta.env.BASE_URL}textures/deep-space/`;
const SKY_RADIUS = 180;

interface DeepSpaceManifest {
  skyMaps: {
    celestialNoBrightStars4k: string;
    celestialNoBrightStars8k: string;
  };
  nebulaAtlas: AtlasManifest<NebulaItem>;
  galaxyAtlas: AtlasManifest<GalaxyItem>;
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

interface GalaxyItem {
  key: string;
  title: string;
  hero: boolean;
}

export class DeepSpaceAssets {
  private textureLoader = new THREE.TextureLoader();
  private manifest?: DeepSpaceManifest;

  async loadManifest(): Promise<DeepSpaceManifest> {
    if (this.manifest) return this.manifest;
    const response = await fetch(`${BASE}manifest.json`);
    if (!response.ok) throw new Error("Deep-space manifest yuklenemedi.");
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
        () => reject(new Error(`Doku yuklenemedi: ${path}`))
      );
    });
  }
}

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

export async function createNebulaSprites(
  assets: DeepSpaceAssets,
  observation: ObservationTime,
  location: ResolvedLocation
): Promise<THREE.Group> {
  const manifest = await assets.loadManifest();
  const texture = await assets.loadTexture(manifest.nebulaAtlas.image);
  const group = new THREE.Group();
  const columns = manifest.nebulaAtlas.columns;
  const rows = manifest.nebulaAtlas.rows;

  manifest.nebulaAtlas.items.forEach((item, index) => {
    const tileTexture = texture.clone();
    tileTexture.needsUpdate = true;
    tileTexture.repeat.set(1 / columns, 1 / rows);
    tileTexture.offset.set((index % columns) / columns, 1 - (Math.floor(index / columns) + 1) / rows);
    const horizontal = raDecToAltAz(item.ra, item.dec, observation.utcDate, location.latitude, location.longitude);
    const alt = THREE.MathUtils.degToRad(horizontal.altitude);
    const az = THREE.MathUtils.degToRad(horizontal.azimuth);
    const position = new THREE.Vector3(
      Math.cos(alt) * Math.sin(az) * SKY_RADIUS,
      Math.sin(alt) * SKY_RADIUS,
      Math.cos(alt) * Math.cos(az) * SKY_RADIUS
    );
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tileTexture,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const scale = Math.max(1.8, item.angularSizeDeg * 1.4);
    sprite.position.copy(position);
    sprite.scale.set(scale, scale, 1);
    group.add(sprite);
  });
  return group;
}

export async function createMilkyWayExternalLayer(assets: DeepSpaceAssets, quality: QualityProfile): Promise<THREE.Group> {
  const manifest = await assets.loadManifest();
  const texture = await assets.loadTexture(manifest.galaxyAtlas.image);
  const group = new THREE.Group();
  const material = createAtlasBillboardMaterial(texture, manifest.galaxyAtlas.columns, manifest.galaxyAtlas.rows);
  const geometry = new THREE.BufferGeometry();
  const count = quality.name === "low" ? 160 : quality.name === "medium" ? 340 : 620;
  const positions = new Float32Array(count * 3);
  const atlas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const intensities = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const radius = Math.sqrt(Math.random()) * 4.2;
    const theta = Math.random() * Math.PI * 2;
    positions.set([Math.cos(theta) * radius, (Math.random() - 0.5) * 0.08, Math.sin(theta) * radius * 0.62], i * 3);
    atlas[i] = 3 + Math.floor(Math.random() * Math.max(1, manifest.galaxyAtlas.items.length - 3));
    sizes[i] = 16 + Math.random() * 18;
    intensities[i] = 0.22 + Math.random() * 0.26;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("atlasIndex", new THREE.BufferAttribute(atlas, 1));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
  group.add(new THREE.Points(geometry, material));
  group.add(createSunMarker());
  return group;
}

export async function createCosmicGalaxyLayer(assets: DeepSpaceAssets, quality: QualityProfile): Promise<THREE.Group> {
  const manifest = await assets.loadManifest();
  const texture = await assets.loadTexture(manifest.galaxyAtlas.image);
  const group = new THREE.Group();
  const count = quality.deepSpaceSpriteLimit;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const atlas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const intensities = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const r = 30 + Math.cbrt(Math.random()) * 390;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.65, r * Math.sin(phi) * Math.sin(theta)], i * 3);
    atlas[i] = Math.floor(Math.random() * manifest.galaxyAtlas.items.length);
    sizes[i] = 9 + Math.random() * 30 * (1 - r / 430);
    intensities[i] = 0.18 + (1 - r / 430) * 0.65;
  }

  if (quality.useHeroSprites) {
    [[0, -62, 28, 74], [1, 78, -18, -84], [2, 30, 58, -52]].forEach(([tile, x, y, z], i) => {
      const offset = i * 3;
      positions.set([x, y, z], offset);
      atlas[i] = tile;
      sizes[i] = 54;
      intensities[i] = 0.88;
    });
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("atlasIndex", new THREE.BufferAttribute(atlas, 1));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
  group.add(new THREE.Points(geometry, createAtlasBillboardMaterial(texture, manifest.galaxyAtlas.columns, manifest.galaxyAtlas.rows)));
  return group;
}

function createSunMarker(): THREE.Group {
  const group = new THREE.Group();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#ffe7a8" })
  );
  marker.position.set(1.25, 0.05, 0.1);
  group.add(marker);
  return group;
}
