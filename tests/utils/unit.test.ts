import { describe, it, expect, beforeEach } from "vitest";
import { np, RIGHT, UP, OUT, PI } from "../../src/core/math/index.js";
import { Pixels, Degrees, Munits, Percent, setUnitConfig } from "../../src/utils/unit/index.js";

// Reset to standard Manim defaults before each test.
beforeEach(() => {
  setUnitConfig({ pixelWidth: 1920, frameWidth: 14.222_222_222_222_222, frameHeight: 8.0 });
});

describe("Degrees", () => {
  it("equals PI / 180", () => {
    expect(Degrees).toBeCloseTo(PI / 180);
  });

  it("converts 180 degrees to PI radians", () => {
    expect(180 * Degrees).toBeCloseTo(PI);
  });

  it("converts 90 degrees to PI/2 radians", () => {
    expect(90 * Degrees).toBeCloseTo(PI / 2);
  });

  it("converts 360 degrees to TAU radians", () => {
    expect(360 * Degrees).toBeCloseTo(2 * PI);
  });
});

describe("Munits", () => {
  it("is 1 (identity)", () => {
    expect(Munits).toBe(1);
  });

  it("leaves values unchanged when multiplied", () => {
    expect(3.5 * Munits).toBe(3.5);
  });
});

describe("Pixels", () => {
  it("converts pixel distance to frame units using default config", () => {
    // 1 pixel = frameWidth / pixelWidth ≈ 14.222... / 1920
    const expected = 14.222_222_222_222_222 / 1920;
    expect(Pixels.times(1)).toBeCloseTo(expected);
  });

  it("scales linearly", () => {
    const one = Pixels.times(1);
    expect(Pixels.times(100)).toBeCloseTo(one * 100);
  });

  it("returns 0 for 0 pixels", () => {
    expect(Pixels.times(0)).toBe(0);
  });

  it("respects updated config", () => {
    setUnitConfig({ pixelWidth: 960, frameWidth: 10, frameHeight: 5 });
    expect(Pixels.times(1)).toBeCloseTo(10 / 960);
  });
});

describe("Percent", () => {
  it("X axis: 100% equals frameWidth", () => {
    const p = new Percent(RIGHT);
    expect(p.times(100)).toBeCloseTo(14.222_222_222_222_222);
  });

  it("X axis: 50% equals half of frameWidth", () => {
    const p = new Percent(RIGHT);
    expect(p.times(50)).toBeCloseTo(14.222_222_222_222_222 / 2);
  });

  it("Y axis: 100% equals frameHeight", () => {
    const p = new Percent(UP);
    expect(p.times(100)).toBeCloseTo(8.0);
  });

  it("Y axis: 50% equals 4.0", () => {
    const p = new Percent(UP);
    expect(p.times(50)).toBeCloseTo(4.0);
  });

  it("Z axis: throws NotImplementedError", () => {
    expect(() => new Percent(OUT)).toThrow("length of Z axis is undefined");
  });

  it("unknown axis: throws error", () => {
    expect(() => new Percent(np.array([1, 1, 0]))).toThrow();
  });

  it("respects updated config", () => {
    setUnitConfig({ pixelWidth: 1920, frameWidth: 10, frameHeight: 5 });
    const p = new Percent(RIGHT);
    expect(p.times(100)).toBeCloseTo(10);
  });
});
