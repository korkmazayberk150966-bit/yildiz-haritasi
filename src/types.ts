export type LayerId = "sky" | "stars" | "constellations" | "solar-system" | "milky-way" | "cosmic-web";
export type AppMode = "free-roam" | "astrology";

export interface BirthInput {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  cityName?: string;
}

export interface ResolvedLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface ObservationTime {
  localDateTime: string;
  utcDate: Date;
  timezone: string;
}

export interface SkyObject {
  name: string;
  altitude: number;
  azimuth: number;
  magnitude?: number;
  color: string;
}

export interface QualityProfile {
  name: "low" | "medium" | "high";
  pixelRatio: number;
  starPointLimit: number;
  gaiaPointLimit: number;
  cosmicPointLimit: number;
  antialias: boolean;
  skyTextureTier: "4k" | "8k";
  deepSpaceSpriteLimit: number;
  useHeroSprites: boolean;
  cinematicEffects: "full" | "reduced" | "off";
  streamingBudgetMb: number;
  maxActiveTiles: number;
  raymarchEnabled: boolean;
  blackHoleEffectEnabled: boolean;
  milkyWayGlowQuality: "basic" | "layered" | "volumetric";
  dustQuality: "basic" | "layered" | "high";
  nebulaQuality: "particle" | "billboard" | "raymarch";
  heroStarLimit: number;
  postFxLevel: "basic" | "polished" | "cinematic";
  raymarchStepCap: number;
  halfResNebula: boolean;
}

export interface RenderLayer {
  id: LayerId;
  label: string;
  mount(): Promise<void> | void;
  show(): void;
  hide(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
