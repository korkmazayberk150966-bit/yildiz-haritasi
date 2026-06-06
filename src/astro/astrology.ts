/**
 * Astroloji hesaplamaları — astronomy-engine kullanarak geosentrik ekliptik
 * boylamından burç konumu ve Güneş açısı hesaplar.
 * NOT: Astrolojik yorumlar eğlence/ilham amaçlıdır; bilimsel iddia değildir.
 */

import { AngleFromSun, Body, Ecliptic, GeoVector } from "astronomy-engine";

import { ASTRO_GLOSSARY, findGlossaryPlanetByName, type AstroAspect } from "../data/astro-glossary";

// ─── Burç sistemi ─────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Koç", "Boğa", "İkizler", "Yengeç",
  "Aslan", "Başak", "Terazi", "Akrep",
  "Yay", "Oğlak", "Kova", "Balık"
] as const;

export type ZodiacSign = typeof ZODIAC_SIGNS[number];

export interface ZodiacPosition {
  sign: ZodiacSign;
  degree: number;  // 0-29 tam sayı
  exactDegree: number; // tam derece
  longitude: number;   // 0-360 ekliptik boylam
}

/**
 * Geosentrik ekliptik boylamdan burç+derece hesaplar.
 */
export function longitudeToZodiac(longitude: number): ZodiacPosition {
  const lon = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(lon / 30);
  const exactDegree = lon % 30;
  return {
    sign: ZODIAC_SIGNS[signIndex] as ZodiacSign,
    degree: Math.floor(exactDegree),
    exactDegree,
    longitude: lon
  };
}

/**
 * Bir gezegen için geosentrik ekliptik boylamı hesaplar.
 */
export function getPlanetLongitude(body: Body, date: Date): number {
  const vector = GeoVector(body === Body.Earth ? Body.Sun : body, date, true);
  return Ecliptic(vector).elon;
}

// ─── Açı (Aspect) sistemi ────────────────────────────────────────────────────

export interface Aspect {
  key: string;
  name: string;
  nameTR: string;
  degrees: number;
  orb: number;
  tone: "güçlü" | "uyumlu" | "sert" | "hafif" | "uyumsuz";
  meaning: string;
}

const ASPECT_EN_NAMES: Record<string, string> = {
  "conjunction": "Conjunction",
  "semi-sextile": "Semi-sextile",
  "sextile": "Sextile",
  "square": "Square",
  "trine": "Trine",
  "quincunx": "Quincunx",
  "opposition": "Opposition"
};

const ASPECTS: Aspect[] = ASTRO_GLOSSARY.aspects.map((aspect) => ({
  key: aspect.key,
  name: ASPECT_EN_NAMES[aspect.key] ?? aspect.name,
  nameTR: aspect.name,
  degrees: aspect.angle,
  orb: aspect.orb,
  tone: mapAspectTone(aspect),
  meaning: aspect.meaning
}));

export interface AspectResult {
  aspect: Aspect;
  orb: number; // gerçek sapma (derece)
  angleRaw: number; // 0-180 ham açı
}

/**
 * İki ekliptik boylam arasındaki astrolojik açıyı ve en yakın aspekt'i bulur.
 */
export function findAspect(lon1: number, lon2: number): AspectResult | null {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;

  let best: { aspect: Aspect; orbDiff: number } | null = null;
  for (const aspect of ASPECTS) {
    const orbDiff = Math.abs(diff - aspect.degrees);
    if (orbDiff <= aspect.orb) {
      if (!best || orbDiff < best.orbDiff) {
        best = { aspect, orbDiff };
      }
    }
  }
  if (!best) return null;
  return { aspect: best.aspect, orb: Math.round(best.orbDiff * 10) / 10, angleRaw: diff };
}

/**
 * astronomy-engine AngleFromSun ile gezegenin Güneş'e olan açısını alır.
 * (Geosentrik, 0-180°)
 */
export function getAngleFromSun(body: Body, date: Date): number {
  return AngleFromSun(body, date);
}

// ─── Astrolojik anlamlar ──────────────────────────────────────────────────────

export interface PlanetMeaning {
  symbol: string;
  shortMeaning: string;      // Pano özeti
  keywords: string;           // Anahtar kelimeler
  fullMeaning: string;        // Tam metin
  isGenerational?: boolean;   // Kuşak gezegeni mi?
}

export const PLANET_MEANINGS: Record<string, PlanetMeaning> = {
  ...Object.fromEntries(ASTRO_GLOSSARY.planets.map((planet) => [
    planet.name,
    {
      symbol: planet.symbol,
      shortMeaning: planet.represents,
      keywords: planet.keywords.join(" · "),
      fullMeaning: planet.meaning,
      isGenerational: planet.isGenerational
    }
  ]))
};

// Açı tonu → Türkçe UI metni
export function aspectToneText(tone: Aspect["tone"]): string {
  switch (tone) {
    case "güçlü":   return "güçlü ve yoğun biçimde";
    case "uyumlu":  return "akıcı ve destekleyici biçimde";
    case "sert":    return "gergin ve meydan okuyucu biçimde";
    case "hafif":   return "fark edilir ama ince biçimde";
    case "uyumsuz": return "uyumsuz, sürekli ayar gerektiren biçimde";
  }
}

/**
 * Gezegen açısı yorumu oluşturur.
 * Güneş için çağrılmamalı (referans gezegen Güneş'tir).
 */
export function buildAspectText(
  planetName: string,
  result: AspectResult | null,
  angleRaw?: number
): string {
  if (!result) {
    const raw = angleRaw !== undefined ? ` (ham açı: ${Math.round(angleRaw)}°)` : "";
    return `Güneş ile belirgin bir açı oluşmuyor${raw}.`;
  }
  const { aspect, orb } = result;
  const meaning = findGlossaryPlanetByName(planetName);
  const keyTheme = meaning?.keywords[0] ?? planetName;
  const tone = aspectToneText(aspect.tone);
  return `Güneş ile ${aspect.nameTR} (${aspect.degrees}°, sapma ${orb}°) yapıyor. ${aspect.meaning} ${planetName} temasındaki ${keyTheme} enerjisi Güneş'le ${tone} ilişki kurar.`;
}

function mapAspectTone(aspect: AstroAspect): Aspect["tone"] {
  switch (aspect.type) {
    case "güçlü":
      return "güçlü";
    case "hafif":
      return "hafif";
    case "yumuşak":
      return "uyumlu";
    case "sert":
      return "sert";
    case "uyumsuz":
      return "uyumsuz";
  }
}
