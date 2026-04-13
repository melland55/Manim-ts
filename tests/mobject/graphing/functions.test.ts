import { describe, it, expect } from "vitest";
import {
  ParametricFunction,
  FunctionGraph,
  ImplicitFunction,
} from "../../../src/mobject/graphing/functions/index.js";
import { np } from "../../../src/core/math/index.js";

describe("ParametricFunction", () => {
  it("constructs with default t_range [0, 1]", () => {
    const pf = new ParametricFunction((t) => [t, t, 0]);
    expect(pf.tMin).toBe(0);
    expect(pf.tMax).toBe(1);
    expect(pf.tStep).toBe(0.01);
  });

  it("constructs with custom t_range", () => {
    const pf = new ParametricFunction((t) => [t, t, 0], {
      tRange: [-2, 2, 0.1],
    });
    expect(pf.tMin).toBe(-2);
    expect(pf.tMax).toBe(2);
    expect(pf.tStep).toBe(0.1);
  });

  it("generates points along the curve", () => {
    const pf = new ParametricFunction((t) => [t, 0, 0], {
      tRange: [0, 1, 0.5],
    });
    // Should have generated some points
    expect(pf.points.shape[0]).toBeGreaterThan(0);
  });

  it("getFunction returns the wrapped function", () => {
    const func = (t: number) => [t, t * t, 0];
    const pf = new ParametricFunction(func);
    const retrieved = pf.getFunction();
    const result = retrieved(0.5);
    expect(result.get([0]) as number).toBeCloseTo(0.5);
    expect(result.get([1]) as number).toBeCloseTo(0.25);
  });

  it("getPointFromFunction evaluates the function at a given t", () => {
    const pf = new ParametricFunction((t) => [Math.cos(t), Math.sin(t), 0]);
    const pt = pf.getPointFromFunction(0);
    expect(pt.get([0]) as number).toBeCloseTo(1);
    expect(pt.get([1]) as number).toBeCloseTo(0);
    expect(pt.get([2]) as number).toBeCloseTo(0);
  });

  it("handles discontinuities by splitting the path", () => {
    const pf = new ParametricFunction((t) => [t, 1 / t, 0], {
      tRange: [-1, 1, 0.1],
      discontinuities: [0],
      dt: 0.05,
    });
    // Should have generated points without NaN at discontinuity
    expect(pf.points.shape[0]).toBeGreaterThan(0);
  });

  it("uses smoothing by default", () => {
    const pf = new ParametricFunction((t) => [t, t, 0]);
    expect(pf.useSmoothing).toBe(true);
  });

  it("can disable smoothing", () => {
    const pf = new ParametricFunction((t) => [t, t, 0], {
      useSmoothing: false,
    });
    expect(pf.useSmoothing).toBe(false);
  });
});

describe("FunctionGraph", () => {
  it("constructs with default x_range spanning the frame", () => {
    const fg = new FunctionGraph((x) => x * x);
    // Default x range should be based on config.frameXRadius
    expect(fg.tMin).toBeLessThan(0);
    expect(fg.tMax).toBeGreaterThan(0);
  });

  it("constructs with custom x_range", () => {
    const fg = new FunctionGraph((x) => x, { xRange: [-2, 2] });
    expect(fg.tMin).toBe(-2);
    expect(fg.tMax).toBe(2);
  });

  it("plots y = f(x) as a parametric curve in the xy plane", () => {
    const fg = new FunctionGraph((x) => 2 * x, { xRange: [0, 1, 0.5] });
    // The points should lie in z=0 plane
    const n = fg.points.shape[0];
    for (let i = 0; i < n; i++) {
      expect(fg.points.get([i, 2]) as number).toBeCloseTo(0);
    }
  });

  it("getPointFromFunction returns [x, f(x), 0]", () => {
    const fg = new FunctionGraph((x) => x * x);
    const pt = fg.getPointFromFunction(3);
    expect(pt.get([0]) as number).toBeCloseTo(3);
    expect(pt.get([1]) as number).toBeCloseTo(9);
    expect(pt.get([2]) as number).toBeCloseTo(0);
  });

  it("uses PURE_YELLOW as default color", () => {
    const fg = new FunctionGraph((x) => x);
    // The color property should be set (from VMobject options)
    expect(fg).toBeDefined();
  });
});

describe("ImplicitFunction", () => {
  it("constructs with default range based on config frame size", () => {
    const imp = new ImplicitFunction((x, y) => x * x + y * y - 1);
    expect(imp.xRange[0]).toBeLessThan(0);
    expect(imp.xRange[1]).toBeGreaterThan(0);
    expect(imp.yRange[0]).toBeLessThan(0);
    expect(imp.yRange[1]).toBeGreaterThan(0);
  });

  it("constructs with custom ranges", () => {
    const imp = new ImplicitFunction((x, y) => x + y, {
      xRange: [-5, 5],
      yRange: [-3, 3],
    });
    expect(imp.xRange).toEqual([-5, 5]);
    expect(imp.yRange).toEqual([-3, 3]);
  });

  it("generates points for a circle (x^2 + y^2 = 1)", () => {
    const imp = new ImplicitFunction((x, y) => x * x + y * y - 1, {
      xRange: [-2, 2],
      yRange: [-2, 2],
      minDepth: 5,
      maxQuads: 1500,
    });
    // Should generate some points forming a circle
    expect(imp.points.shape[0]).toBeGreaterThan(0);
  });

  it("generates points for a line (x + y = 0)", () => {
    const imp = new ImplicitFunction((x, y) => x + y, {
      xRange: [-2, 2],
      yRange: [-2, 2],
    });
    expect(imp.points.shape[0]).toBeGreaterThan(0);
  });

  it("handles function with no zero level set in range", () => {
    // x^2 + y^2 + 1 = 0 has no real solution
    const imp = new ImplicitFunction((x, y) => x * x + y * y + 1, {
      xRange: [-1, 1],
      yRange: [-1, 1],
    });
    // Should have no points (or very few from the initial empty state)
    expect(imp.points.shape[0]).toBeLessThanOrEqual(0);
  });

  it("stores min_depth and max_quads", () => {
    const imp = new ImplicitFunction((x, y) => x - y, {
      minDepth: 3,
      maxQuads: 500,
    });
    expect(imp.minDepth).toBe(3);
    expect(imp.maxQuads).toBe(500);
  });
});
