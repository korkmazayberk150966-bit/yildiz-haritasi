import type { QualityProfile } from "../types";

export function detectInitialQuality(): QualityProfile {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const low = memory <= 2 || cores <= 4 || dpr > 2.5;
  const high = memory >= 8 && cores >= 8 && dpr <= 2;

  if (low) {
    return { name: "low", pixelRatio: 1, starPointLimit: 4500, gaiaPointLimit: 30000, cosmicPointLimit: 12000, antialias: false };
  }
  if (high) {
    return { name: "high", pixelRatio: Math.min(dpr, 2), starPointLimit: 12000, gaiaPointLimit: 180000, cosmicPointLimit: 80000, antialias: true };
  }
  return { name: "medium", pixelRatio: Math.min(dpr, 1.5), starPointLimit: 9000, gaiaPointLimit: 90000, cosmicPointLimit: 36000, antialias: true };
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
      starPointLimit: Math.min(this.profile.starPointLimit, 4500),
      gaiaPointLimit: Math.min(this.profile.gaiaPointLimit, 30000),
      cosmicPointLimit: Math.min(this.profile.cosmicPointLimit, 12000),
      antialias: false
    };
    this.onChange(this.profile);
  }
}
