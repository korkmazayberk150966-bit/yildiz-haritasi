import { altAzToUnitVector, raDecToAltAz } from "../astro/math";
import type { ResolvedLocation } from "../types";

export interface StarVertexData {
  positions: Float32Array;
  meta: Float32Array;
  count: number;
}

export async function loadSkyStars(
  url: string,
  date: Date,
  location: ResolvedLocation,
  limit: number
): Promise<StarVertexData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yıldız verisi yüklenemedi: ${response.status}`);
  const raw = new Float32Array(await response.arrayBuffer());
  const total = Math.floor(raw.length / 4);
  const count = Math.min(total, limit);
  const stride = Math.max(1, Math.floor(total / count));
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 2);
  let written = 0;

  for (let i = 0; i < total && written < count; i += stride) {
    const offset = i * 4;
    const ra = raw[offset];
    const dec = raw[offset + 1];
    const magnitude = raw[offset + 2];
    const bv = raw[offset + 3];
    const horizontal = raDecToAltAz(ra, dec, date, location.latitude, location.longitude);
    const vector = altAzToUnitVector(horizontal.altitude, horizontal.azimuth);
    positions.set(vector, written * 3);
    meta.set([magnitude, bv], written * 2);
    written += 1;
  }

  return { positions: positions.slice(0, written * 3), meta: meta.slice(0, written * 2), count: written };
}
