import { describe, expect, it } from "vitest";

import { bvToKelvin, kelvinToRgb, localSiderealTime, raDecToAltAz } from "./math";
import { localBirthTimeToUtc, resolveTimezone } from "./time";

describe("astro math", () => {
  it("converts local birth time through an offline timezone", () => {
    const observation = localBirthTimeToUtc("1990-06-01", "21:00", "Europe/Istanbul");
    expect(observation.utcDate.toISOString()).toMatch(/^1990-06-01T18:00:00/);
  });

  it("resolves timezone from coordinates", () => {
    expect(resolveTimezone(41.0082, 28.9784)).toBe("Europe/Istanbul");
  });

  it("computes sidereal time and horizontal coordinates", () => {
    const date = new Date("2000-01-01T12:00:00Z");
    expect(localSiderealTime(date, 0)).toBeGreaterThan(280);
    const horizontal = raDecToAltAz(6, 20, date, 41, 29);
    expect(horizontal.altitude).toBeGreaterThanOrEqual(-90);
    expect(horizontal.altitude).toBeLessThanOrEqual(90);
    expect(horizontal.azimuth).toBeGreaterThanOrEqual(0);
    expect(horizontal.azimuth).toBeLessThan(360);
  });

  it("maps B-V color index to plausible blackbody colors", () => {
    const hot = kelvinToRgb(bvToKelvin(-0.2));
    const cool = kelvinToRgb(bvToKelvin(1.6));
    expect(hot[2]).toBeGreaterThan(cool[2]);
    expect(cool[0]).toBeGreaterThan(cool[2]);
  });
});
