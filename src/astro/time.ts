import tzlookup from "tz-lookup";

import type { ObservationTime, ResolvedLocation } from "../types";

function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return (asUtc - date.getTime()) / 60000;
}

export function resolveTimezone(latitude: number, longitude: number): string {
  return tzlookup(latitude, longitude);
}

export function resolveLocation(name: string, latitude: number, longitude: number): ResolvedLocation {
  return {
    name,
    latitude,
    longitude,
    timezone: resolveTimezone(latitude, longitude)
  };
}

export function localBirthTimeToUtc(date: string, time: string, timezone: string): ObservationTime {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "21:00").split(":").map(Number);
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0));
  const firstOffset = getOffsetMinutes(naiveUtc, timezone);
  const corrected = new Date(naiveUtc.getTime() - firstOffset * 60000);
  const secondOffset = getOffsetMinutes(corrected, timezone);
  const utcDate = new Date(naiveUtc.getTime() - secondOffset * 60000);

  return {
    localDateTime: `${date}T${time || "21:00"}`,
    utcDate,
    timezone
  };
}
