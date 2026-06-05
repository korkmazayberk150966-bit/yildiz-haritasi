export type LayerId = "sky" | "solar-system" | "milky-way" | "cosmic-web";

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
