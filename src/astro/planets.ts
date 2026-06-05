import { Body, Equator, Observer } from "astronomy-engine";

import { raDecToAltAz } from "./math";
import type { ResolvedLocation, SkyObject } from "../types";

const BODIES: Array<{ body: Body; name: string; color: string }> = [
  { body: Body.Sun, name: "Gunes", color: "#fff1a8" },
  { body: Body.Moon, name: "Ay", color: "#dbe7ff" },
  { body: Body.Mercury, name: "Merkur", color: "#c7b9a6" },
  { body: Body.Venus, name: "Venus", color: "#ffe1a3" },
  { body: Body.Mars, name: "Mars", color: "#ff8a61" },
  { body: Body.Jupiter, name: "Jupiter", color: "#ffd6a1" },
  { body: Body.Saturn, name: "Saturn", color: "#ead8a0" }
];

export function computeSolarSystemObjects(date: Date, location: ResolvedLocation): SkyObject[] {
  const observer = new Observer(location.latitude, location.longitude, 0);
  return BODIES.map(({ body, name, color }) => {
    const equator = Equator(body, date, observer, true, true);
    const horizontal = raDecToAltAz(equator.ra, equator.dec, date, location.latitude, location.longitude);
    return { name, color, altitude: horizontal.altitude, azimuth: horizontal.azimuth };
  });
}
