import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { rankTileEntries, type TileManifestEntry } from "./streamingTiles";
import { detectInitialQuality } from "./quality";

function entry(id: string, lod: number, x: number): TileManifestEntry {
  return {
    id,
    kind: "stars",
    lod,
    url: `${id}.bin`,
    byteLength: 32,
    pointCount: 1,
    bounds: {
      min: [x - 0.5, -0.5, -0.5],
      max: [x + 0.5, 0.5, 0.5]
    }
  };
}

describe("streaming tile budgets", () => {
  it("ranks lower LOD first, then nearest tile", () => {
    const ranked = rankTileEntries(
      [
        entry("far-lod0", 0, 8),
        entry("near-lod1", 1, 0.2),
        entry("near-lod0", 0, 0.4),
        entry("far-lod1", 1, 12)
      ],
      new THREE.Vector3(0, 0, 0),
      3
    );

    expect(ranked.map((tile) => tile.id)).toEqual(["near-lod0", "far-lod0", "near-lod1"]);
  });

  it("quality profiles expose streaming and cinematic fallback fields", () => {
    const profile = detectInitialQuality();
    expect(profile.streamingBudgetMb).toBeGreaterThan(0);
    expect(profile.maxActiveTiles).toBeGreaterThan(0);
    expect(["full", "reduced", "off"]).toContain(profile.cinematicEffects);
  });
});
