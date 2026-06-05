export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function greenwichSiderealTime(date: Date): number {
  const jd = julianDate(date);
  const t = (jd - 2451545.0) / 36525;
  return normalizeDegrees(
    280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
  );
}

export function localSiderealTime(date: Date, longitude: number): number {
  return normalizeDegrees(greenwichSiderealTime(date) + longitude);
}

export function raDecToAltAz(
  raHours: number,
  decDegrees: number,
  date: Date,
  latitude: number,
  longitude: number
): { altitude: number; azimuth: number } {
  const lst = localSiderealTime(date, longitude);
  const hourAngle = normalizeDegrees(lst - raHours * 15) * DEG2RAD;
  const dec = decDegrees * DEG2RAD;
  const lat = latitude * DEG2RAD;

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(hourAngle);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));

  const y = -Math.sin(hourAngle);
  const x = Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle);
  const azimuth = Math.atan2(y, x);

  return {
    altitude: altitude * RAD2DEG,
    azimuth: normalizeDegrees(azimuth * RAD2DEG)
  };
}

export function altAzToUnitVector(altitude: number, azimuth: number): [number, number, number] {
  const alt = altitude * DEG2RAD;
  const az = azimuth * DEG2RAD;
  const radius = Math.cos(alt);
  return [radius * Math.sin(az), Math.sin(alt), radius * Math.cos(az)];
}

export function bvToKelvin(bv: number): number {
  const safeBv = clamp(Number.isFinite(bv) ? bv : 0.65, -0.4, 2.0);
  return 4600 * (1 / (0.92 * safeBv + 1.7) + 1 / (0.92 * safeBv + 0.62));
}

export function kelvinToRgb(kelvin: number): [number, number, number] {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  let red: number;
  let green: number;
  let blue: number;

  if (temp <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  return [clamp(red, 0, 255) / 255, clamp(green, 0, 255) / 255, clamp(blue, 0, 255) / 255];
}
