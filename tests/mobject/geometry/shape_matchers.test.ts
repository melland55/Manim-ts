/**
 * Tests for mobject/geometry/shape_matchers module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np } from "../../../src/core/math/index.js";
import type { Point3D } from "../../../src/core/math/index.js";
import { SMALL_BUFF } from "../../../src/constants/index.js";
import { Square, Rectangle } from "../../../src/mobject/geometry/polygram/index.js";
import {
  SurroundingRectangle,
  BackgroundRectangle,
  Cross,
  Underline,
} from "../../../src/mobject/geometry/shape_matchers/index.js";

describe("SurroundingRectangle", () => {
  it("constructs around a single mobject with default buff", () => {
    const sq = new Square({ sideLength: 2 });
    const sr = new SurroundingRectangle(sq);
    // Square has width=2, so surrounding rect width = 2 + 2*SMALL_BUFF
    expect(sr.getWidth()).toBeCloseTo(2 + 2 * SMALL_BUFF, 1);
    expect(sr.getHeight()).toBeCloseTo(2 + 2 * SMALL_BUFF, 1);
  });

  it("centers on the target mobject", () => {
    const sq = new Square({ sideLength: 2 });
    sq.shift(np.array([3, 2, 0]) as Point3D);
    const sr = new SurroundingRectangle(sq);
    const center = sr.getCenter();
    expect(center).toBeCloseToPoint(np.array([3, 2, 0]));
  });

  it("respects custom buff", () => {
    const sq = new Square({ sideLength: 2 });
    const sr = new SurroundingRectangle(sq, { buff: 1.0 });
    expect(sr.getWidth()).toBeCloseTo(4, 1);
    expect(sr.getHeight()).toBeCloseTo(4, 1);
  });

  it("supports tuple buff for different x/y padding", () => {
    const sq = new Square({ sideLength: 2 });
    const sr = new SurroundingRectangle(sq, { buff: [0.5, 1.0] });
    expect(sr.getWidth()).toBeCloseTo(3, 1);
    expect(sr.getHeight()).toBeCloseTo(4, 1);
  });

  it("accepts array of mobjects", () => {
    const sq1 = new Square({ sideLength: 1 });
    sq1.shift(np.array([-2, 0, 0]) as Point3D);
    const sq2 = new Square({ sideLength: 1 });
    sq2.shift(np.array([2, 0, 0]) as Point3D);
    const sr = new SurroundingRectangle([sq1, sq2]);
    // Group spans from -2.5 to 2.5 in x => width ~5
    expect(sr.getWidth()).toBeGreaterThan(4);
  });
});

describe("BackgroundRectangle", () => {
  it("constructs with default fill opacity 0.75", () => {
    const sq = new Square({ sideLength: 2 });
    const br = new BackgroundRectangle(sq);
    expect(br.fillOpacity).toBeCloseTo(0.75);
    expect(br.originalFillOpacity).toBeCloseTo(0.75);
  });

  it("has zero stroke by default", () => {
    const sq = new Square({ sideLength: 2 });
    const br = new BackgroundRectangle(sq);
    expect(br.strokeWidth).toBe(0);
    expect(br.strokeOpacity).toBe(0);
  });

  it("uses zero buff by default", () => {
    const sq = new Square({ sideLength: 2 });
    const br = new BackgroundRectangle(sq);
    expect(br.buff).toBe(0);
  });
});

describe("Cross", () => {
  it("constructs with default parameters", () => {
    const cross = new Cross();
    expect(cross.submobjects.length).toBe(2);
  });

  it("fits to a mobject when provided", () => {
    const sq = new Square({ sideLength: 2 });
    const cross = new Cross(sq);
    // Cross should roughly match the mobject dimensions
    expect(cross.getWidth()).toBeGreaterThan(0);
    expect(cross.getHeight()).toBeGreaterThan(0);
  });

  it("respects scale factor", () => {
    const cross1 = new Cross();
    const cross2 = new Cross(null, { scaleFactor: 2.0 });
    expect(cross2.getWidth()).toBeCloseTo(cross1.getWidth() * 2, 1);
  });
});

describe("Underline", () => {
  it("constructs beneath a mobject", () => {
    const rect = new Rectangle({ width: 4, height: 1 });
    const ul = new Underline(rect);
    // Underline width should match the mobject width
    expect(ul.getWidth()).toBeCloseTo(rect.getWidth(), 1);
  });

  it("is positioned below the mobject", () => {
    const rect = new Rectangle({ width: 4, height: 1 });
    const ul = new Underline(rect);
    const rectBottom = rect.getBottom();
    const ulCenter = ul.getCenter();
    // Underline center y should be below rect bottom y
    expect((ulCenter as import("numpy-ts").NDArray).item(1) as number)
      .toBeLessThan((rectBottom as import("numpy-ts").NDArray).item(1) as number);
  });
});
