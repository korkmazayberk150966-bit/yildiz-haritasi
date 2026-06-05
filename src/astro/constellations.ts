import { altAzToUnitVector, raDecToAltAz } from "./math";
import type { ResolvedLocation } from "../types";

export interface ConstellationSegment {
  name: string;
  from: [number, number];
  to: [number, number];
}

// Compact J2000 line sample for the first offline build. HYG stars are also J2000;
// precession is intentionally ignored for naked-eye scale rendering.
export const CONSTELLATION_SEGMENTS: ConstellationSegment[] = [
  { name: "Orion", from: [5.9195, 7.4071], to: [5.6036, -1.2019] },
  { name: "Orion", from: [5.6036, -1.2019], to: [5.5334, -0.2991] },
  { name: "Orion", from: [5.5334, -0.2991], to: [5.2423, -8.2016] },
  { name: "Orion", from: [5.9195, 7.4071], to: [5.4189, 6.3497] },
  { name: "Ursa Major", from: [11.0621, 61.7510], to: [11.8972, 53.6948] },
  { name: "Ursa Major", from: [11.8972, 53.6948], to: [12.2571, 57.0326] },
  { name: "Ursa Major", from: [12.2571, 57.0326], to: [12.9005, 55.9598] },
  { name: "Ursa Major", from: [12.9005, 55.9598], to: [13.3987, 54.9254] },
  { name: "Cygnus", from: [20.6905, 45.2803], to: [20.3705, 40.2567] },
  { name: "Cygnus", from: [20.3705, 40.2567], to: [19.5120, 27.9597] },
  { name: "Cygnus", from: [20.3705, 40.2567], to: [19.7496, 45.1308] }
];

export function constellationSegmentToVectors(
  segment: ConstellationSegment,
  date: Date,
  location: ResolvedLocation
): [[number, number, number], [number, number, number]] {
  const from = raDecToAltAz(segment.from[0], segment.from[1], date, location.latitude, location.longitude);
  const to = raDecToAltAz(segment.to[0], segment.to[1], date, location.latitude, location.longitude);
  return [altAzToUnitVector(from.altitude, from.azimuth), altAzToUnitVector(to.altitude, to.azimuth)];
}
