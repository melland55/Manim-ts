import { describe, it, expect } from "vitest";
import "../../tests/helpers/point-matchers.js";
import { np } from "../../src/core/math/index.js";
import {
  bezier,
  partialBezierPoints,
  splitBezier,
  subdivideBezier,
  bezierRemap,
  interpolate,
  integerInterpolate,
  mid,
  inverseInterpolate,
  matchInterpolate,
  isClosed,
  getSmoothCubicBezierHandlePoints,
  getQuadraticApproximationOfCubic,
  proportionsAlongBezierCurveForPoint,
  pointLiesOnBezier,
} from "../../src/utils/bezier/index.js";

// ─── bezier() ────────────────────────────────────────────────

describe("bezier", () => {
  it("degree-0: always returns the single control point", () => {
    const pts = np.array([[1, 2, 3]]);
    const fn = bezier(pts);
    expect(fn(0)).toBeCloseToPoint(np.array([1, 2, 3]));
    expect(fn(0.5)).toBeCloseToPoint(np.array([1, 2, 3]));
    expect(fn(1)).toBeCloseToPoint(np.array([1, 2, 3]));
  });

  it("degree-1: linearly interpolates between endpoints", () => {
    const pts = np.array([
      [0, 0, 0],
      [2, 4, 6],
    ]);
    const fn = bezier(pts);
    expect(fn(0)).toBeCloseToPoint(np.array([0, 0, 0]));
    expect(fn(1)).toBeCloseToPoint(np.array([2, 4, 6]));
    expect(fn(0.5)).toBeCloseToPoint(np.array([1, 2, 3]));
  });

  it("degree-2: evaluates quadratic bezier correctly", () => {
    // P0=(0,0,0), P1=(1,2,0), P2=(2,0,0)
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 0, 0],
    ]);
    const fn = bezier(pts);
    expect(fn(0)).toBeCloseToPoint(np.array([0, 0, 0]));
    expect(fn(1)).toBeCloseToPoint(np.array([2, 0, 0]));
    // At t=0.5: (1-0.5)^2*P0 + 2*0.5*0.5*P1 + 0.5^2*P2
    //         = 0.25*[0,0,0] + 0.5*[1,2,0] + 0.25*[2,0,0] = [1, 1, 0]
    expect(fn(0.5)).toBeCloseToPoint(np.array([1, 1, 0]));
  });

  it("degree-3: evaluates cubic bezier correctly", () => {
    // P0=(0,0,0), P1=(0,1,0), P2=(1,1,0), P3=(1,0,0)
    const pts = np.array([
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ]);
    const fn = bezier(pts);
    expect(fn(0)).toBeCloseToPoint(np.array([0, 0, 0]));
    expect(fn(1)).toBeCloseToPoint(np.array([1, 0, 0]));
    // At t=0.5: should be symmetric about x=0.5
    const mid = fn(0.5);
    const midArr = mid.toArray() as number[];
    expect(Math.abs(midArr[0] - 0.5)).toBeLessThan(1e-10);
  });
});

// ─── partialBezierPoints() ───────────────────────────────────

describe("partialBezierPoints", () => {
  it("full range [0,1] returns original points for linear", () => {
    const pts = np.array([
      [0, 0, 0],
      [4, 2, 0],
    ]);
    const result = partialBezierPoints(pts, 0, 1);
    const fn = bezier(result);
    expect(fn(0)).toBeCloseToPoint(np.array([0, 0, 0]));
    expect(fn(1)).toBeCloseToPoint(np.array([4, 2, 0]));
  });

  it("a=1 collapses to last point", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
    ]);
    const result = partialBezierPoints(pts, 1, 1);
    const arr0 = (result.row(0).toArray() as number[]);
    const arr1 = (result.row(1).toArray() as number[]);
    expect(arr0[0]).toBeCloseTo(2);
    expect(arr1[0]).toBeCloseTo(2);
  });

  it("b=0 collapses to first point", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
    ]);
    const result = partialBezierPoints(pts, 0, 0);
    const arr = (result.row(0).toArray() as number[]);
    expect(arr[0]).toBeCloseTo(0);
    expect(arr[1]).toBeCloseTo(0);
  });

  it("cubic partial [0, 0.5] starts at original start", () => {
    const pts = np.array([
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ]);
    const result = partialBezierPoints(pts, 0, 0.5);
    // Start should be P0
    const start = result.row(0).toArray() as number[];
    expect(start[0]).toBeCloseTo(0);
    expect(start[1]).toBeCloseTo(0);
    // The curve's end should match full curve at t=0.5
    const fn = bezier(pts);
    const midFull = fn(0.5).toArray() as number[];
    const endPartial = result.row(3).toArray() as number[];
    expect(endPartial[0]).toBeCloseTo(midFull[0]);
    expect(endPartial[1]).toBeCloseTo(midFull[1]);
  });
});

// ─── splitBezier() ───────────────────────────────────────────

describe("splitBezier", () => {
  it("cubic split at t=0.5: left curve ends at full curve midpoint", () => {
    const pts = np.array([
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ]);
    const split = splitBezier(pts, 0.5);
    expect(split.shape[0]).toBe(8);

    const fn = bezier(pts);
    const midFull = fn(0.5).toArray() as number[];

    // Left curve last point = split[3]
    const leftEnd = split.row(3).toArray() as number[];
    expect(leftEnd[0]).toBeCloseTo(midFull[0]);
    expect(leftEnd[1]).toBeCloseTo(midFull[1]);

    // Right curve first point = split[4]
    const rightStart = split.row(4).toArray() as number[];
    expect(rightStart[0]).toBeCloseTo(midFull[0]);
    expect(rightStart[1]).toBeCloseTo(midFull[1]);
  });

  it("linear split returns 4 points with correct midpoint", () => {
    const pts = np.array([
      [0, 0, 0],
      [2, 0, 0],
    ]);
    const split = splitBezier(pts, 0.5);
    expect(split.shape[0]).toBe(4);
    const mid = split.row(1).toArray() as number[];
    expect(mid[0]).toBeCloseTo(1);
  });
});

// ─── subdivideBezier() ───────────────────────────────────────

describe("subdivideBezier", () => {
  it("n_divisions=1 returns original points", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 0, 0],
    ]);
    const result = subdivideBezier(pts, 1);
    expect(result.shape[0]).toBe(3);
  });

  it("quadratic subdivided into 2 has correct shape", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 0, 0],
    ]);
    const result = subdivideBezier(pts, 2);
    expect(result.shape[0]).toBe(6); // 2 * 3 points
  });

  it("cubic subdivided into 3 has correct shape", () => {
    const pts = np.array([
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ]);
    const result = subdivideBezier(pts, 3);
    expect(result.shape[0]).toBe(12); // 3 * 4 points
  });

  it("first subdivided curve starts at original start", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 0, 0],
    ]);
    const result = subdivideBezier(pts, 3);
    const start = result.row(0).toArray() as number[];
    expect(start[0]).toBeCloseTo(0);
    expect(start[1]).toBeCloseTo(0);
  });

  it("last subdivided curve ends at original end", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 0, 0],
    ]);
    const result = subdivideBezier(pts, 3);
    const n = result.shape[0];
    const end = result.row(n - 1).toArray() as number[];
    expect(end[0]).toBeCloseTo(2);
    expect(end[1]).toBeCloseTo(0);
  });
});

// ─── interpolate() ───────────────────────────────────────────

describe("interpolate", () => {
  it("scalar interpolation at 0, 0.5, 1", () => {
    expect(interpolate(0, 10, 0)).toBeCloseTo(0);
    expect(interpolate(0, 10, 0.5)).toBeCloseTo(5);
    expect(interpolate(0, 10, 1)).toBeCloseTo(10);
  });

  it("NDArray interpolation", () => {
    const a = np.array([0, 0, 0]);
    const b = np.array([2, 4, 6]);
    const result = interpolate(a, b, 0.5);
    expect(result).toBeCloseToPoint(np.array([1, 2, 3]));
  });
});

// ─── integerInterpolate() ────────────────────────────────────

describe("integerInterpolate", () => {
  it("returns correct index and residue", () => {
    const [idx, residue] = integerInterpolate(0, 10, 0.46);
    expect(idx).toBe(4);
    expect(residue).toBeCloseTo(0.6);
  });

  it("alpha=0 returns start with residue 0", () => {
    const [idx, residue] = integerInterpolate(0, 10, 0);
    expect(idx).toBe(0);
    expect(residue).toBeCloseTo(0);
  });

  it("alpha=1 returns end-1 with residue 1", () => {
    const [idx, residue] = integerInterpolate(0, 10, 1);
    expect(idx).toBe(9);
    expect(residue).toBeCloseTo(1);
  });
});

// ─── mid() ──────────────────────────────────────────────────

describe("mid", () => {
  it("scalar midpoint", () => {
    expect(mid(2, 8)).toBeCloseTo(5);
  });

  it("NDArray midpoint", () => {
    const a = np.array([0, 0, 0]);
    const b = np.array([4, 8, 12]);
    const result = mid(a, b);
    expect(result).toBeCloseToPoint(np.array([2, 4, 6]));
  });
});

// ─── inverseInterpolate() ────────────────────────────────────

describe("inverseInterpolate", () => {
  it("scalar inverse", () => {
    expect(inverseInterpolate(2, 6, 4)).toBeCloseTo(0.5);
    expect(inverseInterpolate(0, 10, 0)).toBeCloseTo(0);
    expect(inverseInterpolate(0, 10, 10)).toBeCloseTo(1);
  });
});

// ─── matchInterpolate() ──────────────────────────────────────

describe("matchInterpolate", () => {
  it("matches python example: matchInterpolate(0,100,10,20,15)=50", () => {
    const result = matchInterpolate(0, 100, 10, 20, 15);
    expect(result as number).toBeCloseTo(50);
  });
});

// ─── isClosed() ──────────────────────────────────────────────

describe("isClosed", () => {
  it("returns true when first and last points are the same", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 3],
      [3, 2, 1],
      [0, 0, 0],
    ]);
    expect(isClosed(pts)).toBe(true);
  });

  it("returns true for near-zero difference (1e-10)", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 3],
      [3, 2, 1],
      [1e-10, 1e-10, 1e-10],
    ]);
    expect(isClosed(pts)).toBe(true);
  });

  it("returns false for clearly different endpoints", () => {
    const pts = np.array([
      [0, 0, 0],
      [1, 2, 3],
      [3, 2, 1],
      [1, 1, 1],
    ]);
    expect(isClosed(pts)).toBe(false);
  });
});

// ─── getSmoothCubicBezierHandlePoints() ──────────────────────

describe("getSmoothCubicBezierHandlePoints", () => {
  it("single anchor returns empty arrays", () => {
    const anchors = np.array([[0, 0, 0]]);
    const [h1, h2] = getSmoothCubicBezierHandlePoints(anchors);
    expect(h1.shape[0]).toBe(0);
    expect(h2.shape[0]).toBe(0);
  });

  it("two anchors returns interpolated handles", () => {
    const anchors = np.array([
      [0, 0, 0],
      [3, 0, 0],
    ]);
    const [h1, h2] = getSmoothCubicBezierHandlePoints(anchors);
    expect(h1.shape[0]).toBe(1);
    expect(h2.shape[0]).toBe(1);
    // h1 should be at alpha=1/3, h2 at alpha=2/3
    const h1arr = h1.row(0).toArray() as number[];
    const h2arr = h2.row(0).toArray() as number[];
    expect(h1arr[0]).toBeCloseTo(1);
    expect(h2arr[0]).toBeCloseTo(2);
  });

  it("three collinear anchors produces smooth spline", () => {
    const anchors = np.array([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]);
    const [h1, h2] = getSmoothCubicBezierHandlePoints(anchors);
    expect(h1.shape[0]).toBe(2);
    expect(h2.shape[0]).toBe(2);
    // For a straight line, handles should be collinear
    const h1_0 = h1.row(0).toArray() as number[];
    const h1_1 = h1.row(1).toArray() as number[];
    expect(h1_0[1]).toBeCloseTo(0); // y should be 0 for collinear points
    expect(h1_1[1]).toBeCloseTo(0);
  });
});

// ─── getQuadraticApproximationOfCubic() ──────────────────────

describe("getQuadraticApproximationOfCubic", () => {
  it("single curve: returns 6 points", () => {
    const a0 = np.array([0, 0, 0]);
    const h0 = np.array([0, 1, 0]);
    const h1 = np.array([1, 1, 0]);
    const a1 = np.array([1, 0, 0]);
    const result = getQuadraticApproximationOfCubic(a0, h0, h1, a1);
    expect(result.shape[0]).toBe(6);
  });

  it("single curve: starts at a0 and ends at a1", () => {
    const a0 = np.array([0, 0, 0]);
    const h0 = np.array([0, 1, 0]);
    const h1 = np.array([1, 1, 0]);
    const a1 = np.array([1, 0, 0]);
    const result = getQuadraticApproximationOfCubic(a0, h0, h1, a1);
    const first = result.row(0).toArray() as number[];
    const last = result.row(5).toArray() as number[];
    expect(first[0]).toBeCloseTo(0);
    expect(first[1]).toBeCloseTo(0);
    expect(last[0]).toBeCloseTo(1);
    expect(last[1]).toBeCloseTo(0);
  });

  it("points 2 and 3 (k) are equal (connecting point)", () => {
    const a0 = np.array([0, 0, 0]);
    const h0 = np.array([0, 2, 0]);
    const h1 = np.array([2, 2, 0]);
    const a1 = np.array([2, 0, 0]);
    const result = getQuadraticApproximationOfCubic(a0, h0, h1, a1);
    const k1 = result.row(2).toArray() as number[];
    const k2 = result.row(3).toArray() as number[];
    expect(k1[0]).toBeCloseTo(k2[0]);
    expect(k1[1]).toBeCloseTo(k2[1]);
  });
});

// ─── proportionsAlongBezierCurveForPoint / pointLiesOnBezier ─

describe("pointLiesOnBezier", () => {
  it("midpoint of linear bezier lies on it", () => {
    const ctrl = np.array([
      [0, 0, 0],
      [2, 0, 0],
    ]);
    const point = np.array([1, 0, 0]);
    expect(pointLiesOnBezier(point, ctrl)).toBe(true);
  });

  it("point off curve returns false", () => {
    const ctrl = np.array([
      [0, 0, 0],
      [2, 0, 0],
    ]);
    const point = np.array([1, 1, 0]);
    expect(pointLiesOnBezier(point, ctrl)).toBe(false);
  });

  it("endpoint lies on linear bezier", () => {
    const ctrl = np.array([
      [0, 0, 0],
      [3, 3, 0],
    ]);
    expect(pointLiesOnBezier(np.array([0, 0, 0]), ctrl)).toBe(true);
    expect(pointLiesOnBezier(np.array([3, 3, 0]), ctrl)).toBe(true);
  });
});

describe("proportionsAlongBezierCurveForPoint", () => {
  it("midpoint of linear bezier has proportion 0.5", () => {
    const ctrl = np.array([
      [0, 0, 0],
      [4, 0, 0],
    ]);
    const result = proportionsAlongBezierCurveForPoint(np.array([2, 0, 0]), ctrl);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBeCloseTo(0.5, 4);
  });
});

// ─── bezierRemap() ───────────────────────────────────────────

describe("bezierRemap", () => {
  it("remap 1 cubic to 2 cubics: correct shape", () => {
    // Shape (1, 4, 3): one cubic bezier
    const tuples = np.array([[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]);
    const result = bezierRemap(tuples, 2);
    // Result shape should be (2, 4, 3)
    expect(result.shape[0]).toBe(2);
    expect(result.shape[1]).toBe(4);
    expect(result.shape[2]).toBe(3);
  });

  it("remap 2 cubics to 4 cubics: correct shape", () => {
    const tuples = np.array([
      [[0,0,0],[0,1,0],[1,1,0],[1,0,0]],
      [[1,0,0],[1,-1,0],[2,-1,0],[2,0,0]],
    ]);
    const result = bezierRemap(tuples, 4);
    expect(result.shape[0]).toBe(4);
  });
});
