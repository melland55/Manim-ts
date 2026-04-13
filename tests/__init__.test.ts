/**
 * Tests for src/__init__/index.ts
 *
 * Verifies that the top-level barrel export correctly re-exports everything
 * from the converted core modules and exposes the VERSION constant.
 */

import { describe, it, expect } from "vitest";

import {
  // Version
  VERSION,

  // Math exports
  np,
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
  IN,
  PI,
  TAU,
  DEGREES,
  interpolate,
  clamp,
  smooth,
  linear,
  thereAndBack,
  bezier,
  rotateVector,
  centerOfMass,
  pointNorm,
  normalizePoint,

  // Color exports
  Color,
  WHITE,
  BLACK,
  RED,
  GREEN,
  BLUE,
  YELLOW,
  PURE_RED,
  PURE_GREEN,
  PURE_BLUE,
  PURE_YELLOW,
} from "../src/__init__/index.js";

// ─── Version ─────────────────────────────────────────────────────────────────

describe("VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("matches the expected fallback value for a source checkout", () => {
    // The Python __init__.py falls back to "0.0.0+unknown" when the package
    // is not installed via pip — we use the same sentinel.
    expect(VERSION).toBe("0.0.0+unknown");
  });
});

// ─── Math re-exports ─────────────────────────────────────────────────────────

describe("math re-exports", () => {
  it("exports the np namespace", () => {
    expect(np).toBeDefined();
    expect(typeof np.array).toBe("function");
    expect(typeof np.zeros).toBe("function");
  });

  it("exports 3-D direction constants", () => {
    const originArr = ORIGIN.toArray() as number[];
    expect(originArr).toEqual([0, 0, 0]);

    const upArr = UP.toArray() as number[];
    expect(upArr).toEqual([0, 1, 0]);

    const downArr = DOWN.toArray() as number[];
    expect(downArr).toEqual([0, -1, 0]);

    const leftArr = LEFT.toArray() as number[];
    expect(leftArr).toEqual([-1, 0, 0]);

    const rightArr = RIGHT.toArray() as number[];
    expect(rightArr).toEqual([1, 0, 0]);

    const outArr = OUT.toArray() as number[];
    expect(outArr).toEqual([0, 0, 1]);

    const inArr = IN.toArray() as number[];
    expect(inArr).toEqual([0, 0, -1]);
  });

  it("exports correct PI, TAU, DEGREES", () => {
    expect(PI).toBeCloseTo(Math.PI, 10);
    expect(TAU).toBeCloseTo(2 * Math.PI, 10);
    expect(DEGREES).toBeCloseTo(Math.PI / 180, 10);
  });

  it("exports scalar interpolate", () => {
    expect(interpolate(0, 10, 0.5)).toBe(5);
    expect(interpolate(0, 10, 0)).toBe(0);
    expect(interpolate(0, 10, 1)).toBe(10);
  });

  it("exports clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("exports smooth rate function", () => {
    expect(smooth(0)).toBeCloseTo(0, 4);
    expect(smooth(1)).toBeCloseTo(1, 4);
    expect(smooth(0.5)).toBeCloseTo(0.5, 4);
  });

  it("exports linear rate function", () => {
    expect(linear(0)).toBe(0);
    expect(linear(0.4)).toBeCloseTo(0.4);
    expect(linear(1)).toBe(1);
  });

  it("exports thereAndBack rate function", () => {
    expect(thereAndBack(0)).toBeCloseTo(0, 4);
    expect(thereAndBack(0.5)).toBeCloseTo(1, 1);
    expect(thereAndBack(1)).toBeCloseTo(0, 4);
  });

  it("exports bezier curve builder", () => {
    const pts = [np.array([0, 0, 0]), np.array([1, 0, 0])];
    const curve = bezier(pts);
    const midPt = curve(0.5).toArray() as number[];
    expect(midPt[0]).toBeCloseTo(0.5);
    expect(midPt[1]).toBeCloseTo(0);
    expect(midPt[2]).toBeCloseTo(0);
  });

  it("exports rotateVector", () => {
    const v = RIGHT;
    const rotated = rotateVector(v, Math.PI / 2, OUT);
    const arr = rotated.toArray() as number[];
    // 90° around Z: RIGHT → UP
    expect(arr[0]).toBeCloseTo(0, 5);
    expect(arr[1]).toBeCloseTo(1, 5);
    expect(arr[2]).toBeCloseTo(0, 5);
  });

  it("exports centerOfMass", () => {
    const pts = [np.array([0, 0, 0]), np.array([2, 0, 0])];
    const c = centerOfMass(pts).toArray() as number[];
    expect(c[0]).toBeCloseTo(1);
    expect(c[1]).toBeCloseTo(0);
    expect(c[2]).toBeCloseTo(0);
  });

  it("exports normalizePoint", () => {
    const v = np.array([3, 4, 0]);
    const n = normalizePoint(v).toArray() as number[];
    expect(pointNorm(np.array(n))).toBeCloseTo(1);
    expect(n[0]).toBeCloseTo(0.6);
    expect(n[1]).toBeCloseTo(0.8);
  });
});

// ─── Color re-exports ─────────────────────────────────────────────────────────

describe("color re-exports", () => {
  it("exports the Color class", () => {
    const c = new Color(1, 0, 0);
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0);
  });

  it("exports Color.fromHex", () => {
    const c = Color.fromHex("#FF0000");
    expect(c.r).toBeCloseTo(1, 4);
    expect(c.g).toBeCloseTo(0, 4);
    expect(c.b).toBeCloseTo(0, 4);
  });

  it("exports named grayscale colors", () => {
    expect(WHITE.r).toBeCloseTo(1);
    expect(WHITE.g).toBeCloseTo(1);
    expect(WHITE.b).toBeCloseTo(1);

    expect(BLACK.r).toBeCloseTo(0);
    expect(BLACK.g).toBeCloseTo(0);
    expect(BLACK.b).toBeCloseTo(0);
  });

  it("exports primary named colors", () => {
    // Pure primaries
    expect(PURE_RED.toHex().toLowerCase()).toBe("#ff0000");
    expect(PURE_GREEN.toHex().toLowerCase()).toBe("#00ff00");
    expect(PURE_BLUE.toHex().toLowerCase()).toBe("#0000ff");
    expect(PURE_YELLOW.toHex().toLowerCase()).toBe("#ffff00");

    // Manim-palette primaries (not pure)
    expect(RED.toHex().toLowerCase()).toBe("#fc6255");
    expect(GREEN.toHex().toLowerCase()).toBe("#83c167");
    expect(BLUE.toHex().toLowerCase()).toBe("#58c4dd");
    // YELLOW in Manim is warm gold, NOT pure yellow
    expect(YELLOW.toHex().toLowerCase()).toBe("#f7d96f");
  });

  it("exports interpolate on Color", () => {
    const mid = WHITE.interpolate(BLACK, 0.5);
    expect(mid.r).toBeCloseTo(0.5);
    expect(mid.g).toBeCloseTo(0.5);
    expect(mid.b).toBeCloseTo(0.5);
  });

  it("exports lighter / darker on Color", () => {
    const gray = Color.fromHex("#888888");
    const lighter = gray.lighter(0.2);
    const darker = gray.darker(0.2);
    expect(lighter.r).toBeGreaterThan(gray.r);
    expect(darker.r).toBeLessThan(gray.r);
  });
});
