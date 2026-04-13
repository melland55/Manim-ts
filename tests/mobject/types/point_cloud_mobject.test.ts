/**
 * Tests for mobject.types.point_cloud_mobject module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, ORIGIN, UP, RIGHT, getPoint } from "../../../src/core/math/index.js";
import {
  PMobject,
  Mobject1D,
  Mobject2D,
  PGroup,
  PointCloudDot,
  Point,
} from "../../../src/mobject/types/point_cloud_mobject/index.js";
import { PURE_YELLOW, WHITE, BLACK, RED, BLUE } from "../../../src/utils/color/manim_colors.js";
import { colorToRgba } from "../../../src/utils/color/core.js";

describe("PMobject", () => {
  it("constructs with default options", () => {
    const pm = new PMobject();
    expect(pm.getNumPoints()).toBe(0);
    expect(pm.rgbas.shape[0]).toBe(0);
    expect(pm.strokeWidth).toBe(4); // DEFAULT_STROKE_WIDTH
  });

  it("constructs with custom strokeWidth", () => {
    const pm = new PMobject({ strokeWidth: 8 });
    expect(pm.strokeWidth).toBe(8);
  });

  it("addPoints adds points and auto-generates rgbas", () => {
    const pm = new PMobject();
    const points = np.array([[1, 0, 0], [2, 0, 0], [3, 0, 0]]);
    pm.addPoints(points);
    expect(pm.getNumPoints()).toBe(3);
    expect(pm.rgbas.shape[0]).toBe(3);
    expect(pm.rgbas.shape[1]).toBe(4);
  });

  it("addPoints with explicit rgbas", () => {
    const pm = new PMobject();
    const points = np.array([[1, 0, 0], [2, 0, 0]]);
    const rgbas = np.array([[1, 0, 0, 1], [0, 1, 0, 1]]);
    pm.addPoints(points, rgbas);
    expect(pm.getNumPoints()).toBe(2);
    expect(pm.rgbas.shape[0]).toBe(2);
  });

  it("addPoints throws on mismatched rgbas length", () => {
    const pm = new PMobject();
    const points = np.array([[1, 0, 0], [2, 0, 0]]);
    const rgbas = np.array([[1, 0, 0, 1]]);
    expect(() => pm.addPoints(points, rgbas)).toThrow("points and rgbas must have same length");
  });

  it("getArrayAttrs includes rgbas", () => {
    const pm = new PMobject();
    const attrs = pm.getArrayAttrs();
    expect(attrs).toContain("points");
    expect(attrs).toContain("rgbas");
  });

  it("setStrokeWidth updates stroke width", () => {
    const pm = new PMobject({ strokeWidth: 2 });
    pm.setStrokeWidth(6);
    expect(pm.getStrokeWidth()).toBe(6);
  });

  it("thinOut reduces points", () => {
    const pm = new PMobject();
    const points: number[][] = [];
    for (let i = 0; i < 20; i++) {
      points.push([i, 0, 0]);
    }
    pm.addPoints(np.array(points));
    expect(pm.getNumPoints()).toBe(20);
    pm.thinOut(5);
    expect(pm.getNumPoints()).toBe(4); // 0, 5, 10, 15
  });

  it("sortPoints sorts by x coordinate", () => {
    const pm = new PMobject();
    pm.addPoints(np.array([[3, 0, 0], [1, 0, 0], [2, 0, 0]]));
    pm.sortPoints((p) => p[0]);
    const firstPt = getPoint(pm.points, 0);
    expect(firstPt.toArray()).toEqual([1, 0, 0]);
    const lastPt = getPoint(pm.points, 2);
    expect(lastPt.toArray()).toEqual([3, 0, 0]);
  });

  it("pointFromProportion returns correct point", () => {
    const pm = new PMobject();
    pm.addPoints(np.array([[0, 0, 0], [1, 0, 0], [2, 0, 0]]));
    const pt = pm.pointFromProportion(0);
    expect(pt).toBeCloseToPoint(np.array([0, 0, 0]));
    const pt2 = pm.pointFromProportion(1);
    expect(pt2).toBeCloseToPoint(np.array([2, 0, 0]));
  });
});

describe("Mobject1D", () => {
  it("constructs with default density", () => {
    const m = new Mobject1D();
    expect(m.density).toBe(10); // DEFAULT_POINT_DENSITY_1D
    expect(m.epsilon).toBeCloseTo(0.1);
  });

  it("addLine generates points along line", () => {
    const m = new Mobject1D({ density: 10 });
    m.addLine([0, 0, 0], [1, 0, 0]);
    expect(m.getNumPoints()).toBeGreaterThan(0);
  });

  it("addLine with zero-length creates single point", () => {
    const m = new Mobject1D();
    m.addLine([1, 2, 3], [1, 2, 3]);
    expect(m.getNumPoints()).toBe(1);
  });
});

describe("Mobject2D", () => {
  it("constructs with default density", () => {
    const m = new Mobject2D();
    expect(m.density).toBe(25); // DEFAULT_POINT_DENSITY_2D
    expect(m.epsilon).toBeCloseTo(0.04);
  });
});

describe("PGroup", () => {
  it("constructs with PMobject children", () => {
    const p1 = new PMobject();
    const p2 = new PMobject();
    const pg = new PGroup(p1, p2);
    expect(pg.submobjects.length).toBe(2);
  });

  it("rejects non-PMobject children", () => {
    expect(() => {
      // @ts-expect-error testing runtime validation
      new PGroup({} as PMobject);
    }).toThrow();
  });
});

describe("PointCloudDot", () => {
  it("constructs with default options and generates points", () => {
    const dot = new PointCloudDot();
    expect(dot.getNumPoints()).toBeGreaterThan(0);
    expect(dot.radius).toBe(2.0);
    expect(dot.strokeWidth).toBe(2);
  });

  it("constructs with custom radius", () => {
    const dot = new PointCloudDot({ radius: 1.0, density: 5 });
    expect(dot.radius).toBe(1.0);
    expect(dot.getNumPoints()).toBeGreaterThan(0);
  });

  it("generates circular point cloud", () => {
    const dot = new PointCloudDot({ radius: 1.0, density: 5 });
    const numPts = dot.getNumPoints();
    for (let i = 0; i < numPts; i++) {
      const pt = getPoint(dot.points, i).toArray() as number[];
      const dist = Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1]);
      expect(dist).toBeLessThanOrEqual(1.0 + 0.01);
    }
  });
});

describe("Point", () => {
  it("constructs at origin by default", () => {
    const pt = new Point();
    expect(pt.getNumPoints()).toBeGreaterThan(0);
    const firstPt = getPoint(pt.points, 0);
    expect(firstPt).toBeCloseToPoint(ORIGIN);
  });

  it("constructs at specified location", () => {
    const loc = np.array([1, 2, 3]);
    const pt = new Point({ location: loc });
    expect(pt.getNumPoints()).toBeGreaterThan(0);
    const firstPt = getPoint(pt.points, 0);
    expect(firstPt).toBeCloseToPoint(loc);
  });

  it("defaults to BLACK color", () => {
    const pt = new Point();
    expect(pt.color.toHex()).toBe(BLACK.toHex());
  });
});
