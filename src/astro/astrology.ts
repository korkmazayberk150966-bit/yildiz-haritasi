/**
 * Astroloji hesaplamaları — astronomy-engine kullanarak geosentrik ekliptik
 * boylamından burç konumu ve Güneş açısı hesaplar.
 * NOT: Astrolojik yorumlar eğlence/ilham amaçlıdır; bilimsel iddia değildir.
 */

import { AngleFromSun, Body, Ecliptic, GeoVector } from "astronomy-engine";

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
  name: string;
  nameTR: string;
  degrees: number;
  orb: number;
  tone: "güçlü" | "uyumlu" | "sert" | "hafif" | "uyumsuz";
}

const ASPECTS: Aspect[] = [
  { name: "Conjunction",  nameTR: "Kavuşum",           degrees: 0,   orb: 8, tone: "güçlü" },
  { name: "Semi-sextile", nameTR: "Yarım Altmışlık",   degrees: 30,  orb: 2, tone: "hafif" },
  { name: "Sextile",      nameTR: "Altmışlık",         degrees: 60,  orb: 5, tone: "uyumlu" },
  { name: "Square",       nameTR: "Kare",               degrees: 90,  orb: 7, tone: "sert" },
  { name: "Trine",        nameTR: "Üçgen",              degrees: 120, orb: 8, tone: "uyumlu" },
  { name: "Quincunx",    nameTR: "Quincunx (İnconjunct)", degrees: 150, orb: 3, tone: "uyumsuz" },
  { name: "Opposition",   nameTR: "Karşıt",             degrees: 180, orb: 8, tone: "sert" },
];

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
  "Güneş": {
    symbol: "☉",
    shortMeaning: "Öz benlik ve yaşam enerjisi",
    keywords: "kimlik · ego · amaç · canlılık",
    fullMeaning: "Öz benlik, ego, yaşam enerjisi, kimlik ve amaç. \"Temelde kim olduğun.\" Canlılık ve özgüvenin kaynağı."
  },
  "Ay": {
    symbol: "☽",
    shortMeaning: "Duygular ve iç dünya",
    keywords: "sezgi · ihtiyaçlar · bilinçaltı · şefkat",
    fullMeaning: "Duygular, iç dünya, sezgi, ihtiyaçlar ve şefkat. \"Nasıl hissettiğin\" ve güvende hissetme biçimin; bilinçaltı ve içgüdüler."
  },
  "Merkür": {
    symbol: "☿",
    shortMeaning: "İletişim ve zihin",
    keywords: "düşünce · öğrenme · konuşma · analiz",
    fullMeaning: "İletişim, zihin, düşünme ve öğrenme. \"Nasıl düşünüp konuştuğun\"; bilgiyi işleme ve fikir alışverişi tarzın."
  },
  "Venüs": {
    symbol: "♀",
    shortMeaning: "Aşk, güzellik ve değerler",
    keywords: "ilişkiler · çekim · estetik · zevk",
    fullMeaning: "Aşk, güzellik, ilişkiler, zevkler ve değerler. \"Neyi ve nasıl sevdiğin\"; uyum, çekim ve estetik anlayışın."
  },
  "Mars": {
    symbol: "♂",
    shortMeaning: "Eylem, enerji ve tutku",
    keywords: "cesaret · dürtü · mücadele · arzu",
    fullMeaning: "Eylem, enerji, tutku, cesaret ve dürtü. \"Nasıl harekete geçtiğin\"; mücadele gücün, arzu ve öfkenin ifadesi."
  },
  "Jüpiter": {
    symbol: "♃",
    shortMeaning: "Genişleme, şans ve bilgelik",
    keywords: "bolluk · iyimserlik · cömertlik · fırsat",
    fullMeaning: "Genişleme, şans, bolluk, bilgelik ve iyimserlik. \"Nasıl büyüdüğün\"; inanç, cömertlik, fırsat ve felsefi bakış."
  },
  "Satürn": {
    symbol: "♄",
    shortMeaning: "Disiplin, sorumluluk ve olgunluk",
    keywords: "sınırlar · sabır · yapı · hayat dersleri",
    fullMeaning: "Disiplin, sorumluluk, sınırlar, zaman ve olgunluk. \"Kendini nasıl disipline ettiğin\"; yapı, sabır ve hayat dersleri."
  },
  "Uranüs": {
    symbol: "♅",
    shortMeaning: "Devrim, özgürlük ve yenilik",
    keywords: "değişim · teknoloji · özgün düşünce",
    fullMeaning: "Devrim, değişim, özgürlük ve yenilik. Beklenmedik dönüşümler, teknoloji ve özgün düşünce (kuşak gezegeni — toplumsal etkiler).",
    isGenerational: true
  },
  "Neptün": {
    symbol: "♆",
    shortMeaning: "Hayaller, ilham ve ruhsallık",
    keywords: "sezgi · sanat · idealler · illüzyon",
    fullMeaning: "Hayaller, ilham, ruhsallık ve sezgi. İdealler, sanat, sınırların erimesi; bazen illüzyon ve kaçış (kuşak gezegeni).",
    isGenerational: true
  },
  "Plüton": {
    symbol: "♇",
    shortMeaning: "Dönüşüm, güç ve yeniden doğuş",
    keywords: "derinlik · içsel güç · yenilenme",
    fullMeaning: "Dönüşüm, güç, yeniden doğuş ve derinlik. Yoğun değişim, içsel güç ve yenilenme (kuşak gezegeni).",
    isGenerational: true
  }
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
  const meaning = PLANET_MEANINGS[planetName];
  const keyTheme = meaning?.keywords.split("·")[0].trim() ?? planetName;
  const tone = aspectToneText(aspect.tone);
  return `Güneş ile ${aspect.nameTR} (${aspect.degrees}°, sapma ${orb}°) yapıyor. ${aspect.tone === "güçlü" ? "Enerjiler birleşir ve güçlenir:" : aspect.tone === "sert" ? "Gerilim ve meydan okuma:" : aspect.tone === "uyumlu" ? "Akıcı ve destekleyici:" : aspect.tone === "hafif" ? "Hafif, fark edilmesi gereken bir ilişki:" : "Sürekli ayar gerektiren bir gerilim:"} ${keyTheme} teması, kimliğinle ${tone} harmanlanıyor.`;
}
