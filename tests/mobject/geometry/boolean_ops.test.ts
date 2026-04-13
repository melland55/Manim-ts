import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";

import { np } from "../../../src/core/math/index.js";
import type { Point3D } from "../../../src/core/math/index.js";
import { VMobject } from "../../../src/mobject/types/index.js";
import { Square, Circle, Polygon } from "../../../src/mobject/geometry/index.js";
import {
  Union,
  Intersection,
  Difference,
  Exclusion,
} from "../../../src/mobject/geometry/boolean_ops/index.js";

/** Helper: create a square VMobject centered at a point using line paths. */
function makeSquare(cx: number, cy: number, size: number): VMobject {
  const half = size / 2;
  const sq = new VMobject();
  sq.startNewPath(np.array([cx - half, cy - half, 0]) as Point3D);
  sq.addLineTo(np.array([cx + half, cy - half, 0]) as Point3D);
  sq.addLineTo(np.array([cx + half, cy + half, 0]) as Point3D);
  sq.addLineTo(np.array([cx - half, cy + half, 0]) as Point3D);
  sq.addLineTo(np.array([cx - half, cy - half, 0]) as Point3D);
  return sq;
}

describe("Union", () => {
  it("throws if fewer than 2 VMobjects are passed", () => {
    const sq = makeSquare(0, 0, 2);
    expect(() => new Union(sq)).toThrow("At least 2 mobjects needed");
  });

  it("produces a result with points for two overlapping squares", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(1, 0, 2);
    const result = new Union(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
  });

  it("union of two identical squares has similar area to one square", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(0, 0, 2);
    const result = new Union(sq1, sq2);
    // The union should have points forming roughly a 2x2 square
    expect(result.getNumPoints()).toBeGreaterThan(0);
    // Width and height should be approximately 2
    const w = result.getWidth();
    const h = result.getHeight();
    expect(w).toBeCloseTo(2, 1);
    expect(h).toBeCloseTo(2, 1);
  });

  it("union of non-overlapping squares spans both", () => {
    const sq1 = makeSquare(-2, 0, 1);
    const sq2 = makeSquare(2, 0, 1);
    const result = new Union(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
    // Total width should span from -2.5 to 2.5 = 5
    expect(result.getWidth()).toBeCloseTo(5, 1);
  });

  it("accepts options object as last argument", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(1, 0, 2);
    const result = new Union(sq1, sq2, { fillOpacity: 0.5 });
    expect(result.fillOpacity).toBe(0.5);
  });
});

describe("Intersection", () => {
  it("throws if fewer than 2 VMobjects are passed", () => {
    const sq = makeSquare(0, 0, 2);
    expect(() => new Intersection(sq)).toThrow("At least 2 mobjects needed");
  });

  it("intersection of two overlapping squares has points", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(0.5, 0, 2);
    const result = new Intersection(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
  });

  it("intersection of two overlapping squares is smaller than either", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(1, 0, 2);
    const result = new Intersection(sq1, sq2);
    // Overlap region is 1x2
    expect(result.getWidth()).toBeCloseTo(1, 1);
    expect(result.getHeight()).toBeCloseTo(2, 1);
  });

  it("intersection of non-overlapping squares is empty", () => {
    const sq1 = makeSquare(-5, 0, 1);
    const sq2 = makeSquare(5, 0, 1);
    const result = new Intersection(sq1, sq2);
    expect(result.getNumPoints()).toBe(0);
  });

  it("supports more than 2 VMobjects", () => {
    const sq1 = makeSquare(0, 0, 4);
    const sq2 = makeSquare(1, 0, 4);
    const sq3 = makeSquare(0.5, 0, 4);
    const result = new Intersection(sq1, sq2, sq3);
    expect(result.getNumPoints()).toBeGreaterThan(0);
  });
});

describe("Difference", () => {
  it("difference of a square with itself is empty", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(0, 0, 2);
    const result = new Difference(sq1, sq2);
    expect(result.getNumPoints()).toBe(0);
  });

  it("difference with non-overlapping shape preserves subject", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(10, 0, 2);
    const result = new Difference(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
    expect(result.getWidth()).toBeCloseTo(2, 1);
    expect(result.getHeight()).toBeCloseTo(2, 1);
  });

  it("partial overlap produces a smaller shape", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(1, 0, 2);
    const result = new Difference(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
    // Should be narrower than original
    expect(result.getWidth()).toBeLessThan(2);
  });
});

describe("Exclusion", () => {
  it("XOR of identical squares is empty", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(0, 0, 2);
    const result = new Exclusion(sq1, sq2);
    expect(result.getNumPoints()).toBe(0);
  });

  it("XOR of non-overlapping squares keeps both", () => {
    const sq1 = makeSquare(-3, 0, 1);
    const sq2 = makeSquare(3, 0, 1);
    const result = new Exclusion(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
    expect(result.getWidth()).toBeCloseTo(7, 1);
  });

  it("XOR of overlapping squares removes intersection region", () => {
    const sq1 = makeSquare(0, 0, 2);
    const sq2 = makeSquare(1, 0, 2);
    const result = new Exclusion(sq1, sq2);
    expect(result.getNumPoints()).toBeGreaterThan(0);
    // Total width = 3 (from -1 to 2)
    expect(result.getWidth()).toBeCloseTo(3, 1);
  });
});
