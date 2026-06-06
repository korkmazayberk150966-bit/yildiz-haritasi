import type { QualityProfile } from "../types";

export function detectInitialQuality(): QualityProfile {
  const nav = typeof navigator === "undefined" ? undefined : navigator as Navigator & { deviceMemory?: number };
  const memory = nav?.deviceMemory ?? 4;
  const cores = nav?.hardwareConcurrency ?? 4;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const low = memory <= 2 || cores <= 4 || dpr > 2.5;
  const high = memory >= 8 && cores >= 8 && dpr <= 2;

  if (low) {
    return {
      name: "low",
      pixelRatio: 1,
      starPointLimit: 6000,
      gaiaPointLimit: 30000,
      cosmicPointLimit: 12000,
      antialias: false,
      skyTextureTier: "4k",
      deepSpaceSpriteLimit: 220,
      useHeroSprites: true,
      cinematicEffects: "off",
      streamingBudgetMb: 48,
      maxActiveTiles: 8,
      raymarchEnabled: false,
      blackHoleEffectEnabled: false
    };
  }
  if (high) {
    return {
      name: "high",
      pixelRatio: Math.min(dpr, 2),
      starPointLimit: 16000,
      gaiaPointLimit: 180000,
      cosmicPointLimit: 80000,
      antialias: true,
      skyTextureTier: "8k",
      deepSpaceSpriteLimit: 900,
      useHeroSprites: true,
      cinematicEffects: "full",
      streamingBudgetMb: 160,
      maxActiveTiles: 28,
      raymarchEnabled: true,
      blackHoleEffectEnabled: true
    };
  }
  return {
    name: "medium",
    pixelRatio: Math.min(dpr, 1.5),
    starPointLimit: 11000,
    gaiaPointLimit: 90000,
    cosmicPointLimit: 36000,
    antialias: true,
    skyTextureTier: "4k",
    deepSpaceSpriteLimit: 520,
    useHeroSprites: true,
    cinematicEffects: "reduced",
    streamingBudgetMb: 96,
    maxActiveTiles: 16,
    raymarchEnabled: false,
    blackHoleEffectEnabled: false
  };
}

export class AdaptiveQualityController {
  private frames = 0;
  private start = performance.now();

  constructor(private profile: QualityProfile, private onChange: (profile: QualityProfile) => void) {}

  get current(): QualityProfile {
    return this.profile;
  }

  sampleFrame(): void {
    this.frames += 1;
    const elapsed = performance.now() - this.start;
    if (elapsed < 2500) return;
    const fps = (this.frames * 1000) / elapsed;
    this.frames = 0;
    this.start = performance.now();
    if (fps >= 34 || this.profile.name === "low") return;
    this.profile = {
      name: "low",
      pixelRatio: 1,
      starPointLimit: Math.min(this.profile.starPointLimit, 6000),
      gaiaPointLimit: Math.min(this.profile.gaiaPointLimit, 30000),
      cosmicPointLimit: Math.min(this.profile.cosmicPointLimit, 12000),
      antialias: false,
      skyTextureTier: "4k",
      deepSpaceSpriteLimit: Math.min(this.profile.deepSpaceSpriteLimit, 220),
      useHeroSprites: true,
      cinematicEffects: "off",
      streamingBudgetMb: 48,
      maxActiveTiles: 8,
      raymarchEnabled: false,
      blackHoleEffectEnabled: false
    };
    this.onChange(this.profile);
  }
}
