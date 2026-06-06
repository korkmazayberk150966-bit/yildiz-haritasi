import * as THREE from "three";

import type { QualityProfile } from "../types";
import { createRoundPointMaterial } from "./roundPointMaterial";

export type TileKind = "stars" | "dust" | "nebula";

export interface TileBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface TileManifestEntry {
  id: string;
  kind: TileKind;
  lod: number;
  url: string;
  bounds: TileBounds;
  byteLength: number;
  pointCount: number;
}

export interface TileManifest {
  version: 1;
  coordinateSystem: "galactic-cartesian";
  units: "scene";
  rootUrl: string;
  tiles: TileManifestEntry[];
}

export function rankTileEntries(
  tiles: TileManifestEntry[],
  cameraPosition: THREE.Vector3,
  maxActiveTiles: number
): TileManifestEntry[] {
  return [...tiles]
    .map((entry) => ({ entry, distance: distanceToPoint(entry, cameraPosition) }))
    .sort((a, b) => a.entry.lod - b.entry.lod || a.distance - b.distance)
    .slice(0, maxActiveTiles)
    .map((item) => item.entry);
}

interface LoadedTile {
  entry: TileManifestEntry;
  object: THREE.Points;
  lastUsed: number;
}

export class TileLoader {
  private manifest?: TileManifest;
  private controllers = new Map<string, AbortController>();

  constructor(private baseUrl = `${import.meta.env.BASE_URL}tiles/`) {}

  async loadManifest(): Promise<TileManifest> {
    if (this.manifest) return this.manifest;
    const response = await fetch(`${this.baseUrl}manifest.json`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Tile manifest yüklenemedi: ${response.status}`);
    this.manifest = await response.json() as TileManifest;
    return this.manifest;
  }

  async loadTile(entry: TileManifestEntry): Promise<ArrayBuffer> {
    const controller = new AbortController();
    this.controllers.set(entry.id, controller);
    try {
      const response = await fetch(`${this.baseUrl}${entry.url}`, {
        cache: "force-cache",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Tile yüklenemedi: ${entry.id}`);
      return await response.arrayBuffer();
    } finally {
      this.controllers.delete(entry.id);
    }
  }

  abort(id: string): void {
    this.controllers.get(id)?.abort();
  }
}

export class TileManager {
  readonly group = new THREE.Group();
  private loader: TileLoader;
  private loaded = new Map<string, LoadedTile>();
  private loading = new Set<string>();
  private manifest?: TileManifest;
  private lastRefresh = 0;

  constructor(private quality: QualityProfile, baseUrl?: string) {
    this.loader = new TileLoader(baseUrl);
  }

  async mount(): Promise<void> {
    this.manifest = await this.loader.loadManifest();
  }

  update(camera: THREE.Camera): void {
    if (!this.manifest) return;
    const now = performance.now();
    if (now - this.lastRefresh < 350) return;
    this.lastRefresh = now;

    const wanted = rankTileEntries(this.manifest.tiles, camera.position, this.quality.maxActiveTiles);
    const wantedIds = new Set(wanted.map((entry) => entry.id));
    for (const entry of wanted) void this.ensureTile(entry, now);
    for (const [id, tile] of this.loaded) {
      if (wantedIds.has(id)) {
        tile.lastUsed = now;
        continue;
      }
      if (now - tile.lastUsed > 1500) this.unloadTile(id);
    }
  }

  dispose(): void {
    for (const id of this.loading) this.loader.abort(id);
    for (const id of this.loaded.keys()) this.unloadTile(id);
  }

  private async ensureTile(entry: TileManifestEntry, now: number): Promise<void> {
    const existing = this.loaded.get(entry.id);
    if (existing) {
      existing.lastUsed = now;
      return;
    }
    if (this.loading.has(entry.id)) return;
    this.loading.add(entry.id);
    try {
      const buffer = await this.loader.loadTile(entry);
      const object = this.decodeTile(entry, buffer);
      object.userData = {
        type: entry.kind,
        info: {
          name: entry.kind === "dust" ? "Yerel Toz Bulutu" : "Yıldız Alanı",
          desc: "Prosedürel/temsili progressive streaming MVP tile verisi. Büyük bilimsel veri setleri için aynı sözleşme sonraki ETL fazında kullanılacak.",
          tileId: entry.id
        }
      };
      this.loaded.set(entry.id, { entry, object, lastUsed: performance.now() });
      this.group.add(object);
    } catch (error) {
      console.warn("[tiles] tile skipped", entry.id, error);
    } finally {
      this.loading.delete(entry.id);
    }
  }

  private unloadTile(id: string): void {
    const tile = this.loaded.get(id);
    if (!tile) return;
    this.group.remove(tile.object);
    tile.object.geometry.dispose();
    if (Array.isArray(tile.object.material)) {
      tile.object.material.forEach((material) => material.dispose());
    } else {
      tile.object.material.dispose();
    }
    this.loaded.delete(id);
  }

  private decodeTile(entry: TileManifestEntry, buffer: ArrayBuffer): THREE.Points {
    const floats = new Float32Array(buffer);
    const stride = 8;
    const count = Math.floor(floats.length / stride);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const intensities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const offset = i * stride;
      positions.set([floats[offset], floats[offset + 1], floats[offset + 2]], i * 3);
      colors.set([floats[offset + 3], floats[offset + 4], floats[offset + 5]], i * 3);
      sizes[i] = floats[offset + 6];
      intensities[i] = floats[offset + 7];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("intensity", new THREE.BufferAttribute(intensities, 1));
    const opacity = entry.kind === "dust" ? 0.42 : 0.72;
    return new THREE.Points(geometry, createRoundPointMaterial({ opacity, maxPointSize: entry.kind === "dust" ? 7 : 3.5 }));
  }

}

function distanceToPoint(entry: TileManifestEntry, point: THREE.Vector3): number {
  const center = new THREE.Vector3(
    (entry.bounds.min[0] + entry.bounds.max[0]) * 0.5,
    (entry.bounds.min[1] + entry.bounds.max[1]) * 0.5,
    (entry.bounds.min[2] + entry.bounds.max[2]) * 0.5
  );
  return center.distanceTo(point);
}
