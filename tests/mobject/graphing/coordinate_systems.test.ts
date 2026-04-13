import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np } from "../../../src/core/math/index.js";
import type { Point3D } from "../../../src/core/math/index.js";
import {
  CoordinateSystem,
  Axes,
  ThreeDAxes,
  NumberPlane,
  PolarPlane,
  ComplexPlane,
} from "../../../src/mobject/graphing/coordinate_systems/index.js";

// ─── Axes ────────────────────────────────────────────────────

describe("Axes", () => {
  it("constructs with default options", () => {
    const ax = new Axes();
    expect(ax).toBeInstanceOf(Axes);
    expect(ax).toBeInstanceOf(CoordinateSystem);
    expect(ax.dimension).toBe(2);
    expect(ax.xRange).toHaveLength(3);
    expect(ax.yRange).toHaveLength(3);
  });

  it("constructs with custom ranges", () => {
    const ax = new Axes({
      xRange: [0, 10, 2],
      yRange: [-5, 5, 1],
    });
    expect(ax.xRange).toEqual([0, 10, 2]);
    expect(ax.yRange).toEqual([-5, 5, 1]);
  });

  it("fills in step when only min/max provided", () => {
    const ax = new Axes({
      xRange: [0, 8],
      yRange: [-3, 3],
    });
    expect(ax.xRange).toEqual([0, 8, 1]);
    expect(ax.yRange).toEqual([-3, 3, 1]);
  });

  it("coordsToPoint returns a point", () => {
    const ax = new Axes();
    const pt = ax.coordsToPoint(0, 0);
    expect(pt).toBeDefined();
    // Origin on default axes should be near scene origin
    const arr = (pt as any).toArray() as number[];
    expect(arr).toHaveLength(3);
  });

  it("c2p is an alias for coordsToPoint", () => {
    const ax = new Axes();
    const pt1 = ax.coordsToPoint(1, 2);
    const pt2 = ax.c2p(1, 2);
    const arr1 = (pt1 as any).toArray() as number[];
    const arr2 = (pt2 as any).toArray() as number[];
    expect(arr1[0]).toBeCloseTo(arr2[0], 8);
    expect(arr1[1]).toBeCloseTo(arr2[1], 8);
    expect(arr1[2]).toBeCloseTo(arr2[2], 8);
  });

  it("pointToCoords is inverse of coordsToPoint", () => {
    const ax = new Axes({
      xRange: [-5, 5, 1],
      yRange: [-5, 5, 1],
    });
    const coords = [2, 3];
    const pt = ax.coordsToPoint(coords[0], coords[1]);
    const recovered = ax.pointToCoords(pt);
    expect(recovered[0]).toBeCloseTo(coords[0], 4);
    expect(recovered[1]).toBeCloseTo(coords[1], 4);
  });

  it("getOrigin returns the (0,0) point", () => {
    const ax = new Axes();
    const origin = ax.getOrigin();
    const pt00 = ax.coordsToPoint(0, 0);
    const o = (origin as any).toArray() as number[];
    const p = (pt00 as any).toArray() as number[];
    expect(o[0]).toBeCloseTo(p[0], 8);
    expect(o[1]).toBeCloseTo(p[1], 8);
  });

  it("getXAxis and getYAxis return NumberLine instances", () => {
    const ax = new Axes();
    const xAxis = ax.getXAxis();
    const yAxis = ax.getYAxis();
    expect(xAxis).toBeDefined();
    expect(yAxis).toBeDefined();
    expect(xAxis.xRange).toBeDefined();
    expect(yAxis.xRange).toBeDefined();
  });

  it("_originShift returns correct shift values", () => {
    // Both positive
    expect(Axes._originShift([2, 8])).toBe(2);
    // Both negative
    expect(Axes._originShift([-8, -2])).toBe(-2);
    // Spanning zero
    expect(Axes._originShift([-4, 4])).toBe(0);
    // Zero at min
    expect(Axes._originShift([0, 5])).toBe(0);
  });

  it("plot creates a ParametricFunction", () => {
    const ax = new Axes({ xRange: [-3, 3, 1], yRange: [-3, 3, 1] });
    const graph = ax.plot((x) => x * x);
    expect(graph).toBeDefined();
    expect(graph.underlyingFunction).toBeDefined();
    expect(graph.underlyingFunction!(2)).toBe(4);
  });

  it("inputToGraphCoords returns [x, f(x)]", () => {
    const ax = new Axes();
    const graph = ax.plot((x) => x * x);
    const [gx, gy] = ax.inputToGraphCoords(3, graph);
    expect(gx).toBe(3);
    expect(gy).toBe(9);
  });

  it("slopeOfTangent approximates derivative", () => {
    const ax = new Axes();
    const graph = ax.plot((x) => x * x);
    // d/dx(x^2) at x=3 should be ~6
    const slope = ax.slopeOfTangent(3, graph);
    expect(slope).toBeCloseTo(6, 2);
  });
});

// ─── ThreeDAxes ──────────────────────────────────────────────

describe("ThreeDAxes", () => {
  it("constructs with default options", () => {
    const ax = new ThreeDAxes();
    expect(ax).toBeInstanceOf(ThreeDAxes);
    expect(ax).toBeInstanceOf(Axes);
    expect(ax.dimension).toBe(3);
  });

  it("has z-axis", () => {
    const ax = new ThreeDAxes();
    expect(ax.zAxis).toBeDefined();
    expect(ax.getZAxis()).toBeDefined();
  });

  it("constructs with custom z range", () => {
    const ax = new ThreeDAxes({ zRange: [-10, 10, 2] });
    expect(ax.zRange).toEqual([-10, 10, 2]);
  });
});

// ─── NumberPlane ─────────────────────────────────────────────

describe("NumberPlane", () => {
  it("constructs with default options", () => {
    const plane = new NumberPlane();
    expect(plane).toBeInstanceOf(NumberPlane);
    expect(plane).toBeInstanceOf(Axes);
  });

  it("has background lines", () => {
    const plane = new NumberPlane();
    expect(plane.backgroundLines).toBeDefined();
    expect(plane.fadedLines).toBeDefined();
  });

  it("constructs with custom background style", () => {
    const plane = new NumberPlane({
      backgroundLineStyle: {
        strokeWidth: 4,
      },
    });
    expect(plane.backgroundLineStyle.strokeWidth).toBe(4);
  });
});

// ─── PolarPlane ──────────────────────────────────────────────

describe("PolarPlane", () => {
  it("constructs with default options", () => {
    const plane = new PolarPlane();
    expect(plane).toBeInstanceOf(PolarPlane);
    expect(plane).toBeInstanceOf(Axes);
    expect(plane.azimuthUnits).toBe("PI radians");
    expect(plane.azimuthDirection).toBe("CCW");
  });

  it("throws on invalid azimuth units", () => {
    expect(() => new PolarPlane({ azimuthUnits: "invalid" })).toThrow();
  });

  it("throws on invalid azimuth direction", () => {
    expect(() => new PolarPlane({ azimuthDirection: "INVALID" })).toThrow();
  });

  it("constructs with degrees", () => {
    const plane = new PolarPlane({ azimuthUnits: "degrees" });
    expect(plane.azimuthStep).toBe(36);
  });

  it("constructs with gradians", () => {
    const plane = new PolarPlane({ azimuthUnits: "gradians" });
    expect(plane.azimuthStep).toBe(40);
  });
});

// ─── ComplexPlane ────────────────────────────────────────────

describe("ComplexPlane", () => {
  it("constructs with default options", () => {
    const plane = new ComplexPlane();
    expect(plane).toBeInstanceOf(ComplexPlane);
    expect(plane).toBeInstanceOf(NumberPlane);
  });

  it("numberToPoint converts a real number", () => {
    const plane = new ComplexPlane();
    const pt = plane.numberToPoint(2);
    expect(pt).toBeDefined();
    // Should be equivalent to coordsToPoint(2, 0)
    const ptCoords = plane.coordsToPoint(2, 0);
    const arr1 = (pt as any).toArray() as number[];
    const arr2 = (ptCoords as any).toArray() as number[];
    expect(arr1[0]).toBeCloseTo(arr2[0], 8);
    expect(arr1[1]).toBeCloseTo(arr2[1], 8);
  });

  it("numberToPoint converts a complex number", () => {
    const plane = new ComplexPlane();
    const pt = plane.numberToPoint({ real: 1, imag: 2 });
    const ptCoords = plane.coordsToPoint(1, 2);
    const arr1 = (pt as any).toArray() as number[];
    const arr2 = (ptCoords as any).toArray() as number[];
    expect(arr1[0]).toBeCloseTo(arr2[0], 8);
    expect(arr1[1]).toBeCloseTo(arr2[1], 8);
  });

  it("pointToNumber is inverse of numberToPoint", () => {
    const plane = new ComplexPlane();
    const z = { real: 3, imag: -2 };
    const pt = plane.numberToPoint(z);
    const recovered = plane.pointToNumber(pt);
    expect(recovered.real).toBeCloseTo(z.real, 4);
    expect(recovered.imag).toBeCloseTo(z.imag, 4);
  });

  it("n2p and p2n are aliases", () => {
    const plane = new ComplexPlane();
    const pt = plane.n2p(5);
    const ptFull = plane.numberToPoint(5);
    const arr1 = (pt as any).toArray() as number[];
    const arr2 = (ptFull as any).toArray() as number[];
    expect(arr1[0]).toBeCloseTo(arr2[0], 8);
  });
});

// ─── toFraction helper (tested via PolarPlane.getRadianLabel) ──

describe("PolarPlane.getRadianLabel", () => {
  it("returns label for 0", () => {
    const plane = new PolarPlane({ azimuthUnits: "PI radians" });
    const label = plane.getRadianLabel(0);
    expect(label).toBeDefined();
  });

  it("returns label for 0.5 (PI radians = pi)", () => {
    const plane = new PolarPlane({ azimuthUnits: "PI radians" });
    const label = plane.getRadianLabel(0.5);
    expect(label).toBeDefined();
  });
});
