import { describe, expect, it } from "vitest";

import { clampPitch, computeAdaptiveMaxSpeed, movementInputFromKeys } from "./MilkyWayFlightController";

describe("MilkyWayFlightController helpers", () => {
  it("maps desktop flight keys into a normalized 6DOF input vector", () => {
    const input = movementInputFromKeys(new Set(["keyw", "keyd", "keyq"]));
    expect(input.length()).toBeCloseTo(1);
    expect(input.x).toBeGreaterThan(0);
    expect(input.y).toBeGreaterThan(0);
    expect(input.z).toBeLessThan(0);
  });

  it("supports arrow keys as movement aliases", () => {
    const input = movementInputFromKeys(new Set(["arrowup", "arrowleft"]));
    expect(input.x).toBeLessThan(0);
    expect(input.z).toBeLessThan(0);
  });

  it("clamps pitch before the camera flips", () => {
    expect(clampPitch(99)).toBeLessThan(Math.PI / 2);
    expect(clampPitch(-99)).toBeGreaterThan(-Math.PI / 2);
  });

  it("slows flight near interactive objects and accelerates with boost", () => {
    const cruising = computeAdaptiveMaxSpeed(false, 20);
    const close = computeAdaptiveMaxSpeed(false, 0.8);
    const boosted = computeAdaptiveMaxSpeed(true, 20);

    expect(close).toBeLessThan(cruising);
    expect(boosted).toBeGreaterThan(cruising * 5);
  });
});
