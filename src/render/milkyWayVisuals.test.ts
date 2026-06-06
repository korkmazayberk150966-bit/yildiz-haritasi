import { describe, expect, it } from "vitest";

import { milkyWayGlowLayerCount, milkyWayRaymarchSteps } from "./deepSpaceLayers";
import { detectInitialQuality } from "./quality";

describe("Milky Way HD visual quality settings", () => {
  it("uses multiple depth layers for unresolved galactic glow", () => {
    expect(milkyWayGlowLayerCount({ milkyWayGlowQuality: "basic" })).toBeGreaterThan(1);
    expect(milkyWayGlowLayerCount({ milkyWayGlowQuality: "layered" })).toBeGreaterThan(
      milkyWayGlowLayerCount({ milkyWayGlowQuality: "basic" })
    );
    expect(milkyWayGlowLayerCount({ milkyWayGlowQuality: "volumetric" })).toBeGreaterThan(
      milkyWayGlowLayerCount({ milkyWayGlowQuality: "layered" })
    );
  });

  it("caps high profile raymarch steps and disables them for non-raymarch profiles", () => {
    expect(milkyWayRaymarchSteps({ nebulaQuality: "particle", raymarchStepCap: 36 })).toBe(0);
    expect(milkyWayRaymarchSteps({ nebulaQuality: "raymarch", raymarchStepCap: 99 })).toBe(36);
    expect(milkyWayRaymarchSteps({ nebulaQuality: "raymarch", raymarchStepCap: 18 })).toBe(18);
  });

  it("exposes HD visual fallbacks on detected quality profile", () => {
    const quality = detectInitialQuality();
    expect(["basic", "layered", "volumetric"]).toContain(quality.milkyWayGlowQuality);
    expect(["basic", "layered", "high"]).toContain(quality.dustQuality);
    expect(["particle", "billboard", "raymarch"]).toContain(quality.nebulaQuality);
    expect(quality.heroStarLimit).toBeGreaterThan(0);
    expect(quality.raymarchStepCap).toBeGreaterThanOrEqual(0);
    expect(quality.halfResNebula).toBe(true);
  });
});
