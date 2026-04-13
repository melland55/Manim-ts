import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import {
  np,
  point3D,
  clonePoint,
  interpolate,
  inverseInterpolate,
  integerInterpolate,
  mid,
  clamp,
  linspace,
  approxEqual,
  sigmoid,
  interpolatePoint,
  midPoint,
  addPoints,
  subtractPoints,
  scalePoint,
  pointNorm,
  normalizePoint,
  pointDistance,
  dotProduct,
  crossProduct,
  angleOfVector,
  angleBetweenVectors,
  rotateVector,
  getUnitNormal,
  centerOfMass,
  complexToR3,
  r3ToComplex,
  complexMultiply,
  findIntersection,
  cartesianToSpherical,
  sphericalToCartesian,
  pointsFromArray,
  emptyPoints,
  pointCount,
  getPoint,
  setPoint,
  concatPoints,
  translatePoints,
  scalePoints,
  pointsBoundingBox,
  pointsCenter,
  bezier,
  partialBezierPoints,
  smooth,
  smoothstep,
  doubleSmooth,
  linear,
  rushInto,
  rushFrom,
  slowInto,
  thereAndBack,
  thereAndBackWithPause,
  wiggle,
  squishRateFunc,
  lingering,
  exponentialDecay,
  rotationMatrix,
  applyMatrixToPoint,
  quaternionFromAngleAxis,
  quaternionMultiply,
  quaternionConjugate,
  angleAxisFromQuaternion,
  PI,
  TAU,
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
} from "../../../src/core/math/index.js";

/** Helper: extract number array from NDArray point */
function arr(p: any): number[] {
  return p.toArray() as number[];
}

// ─── Scalar Math ────────────────────────────────────────────

describe("interpolate", () => {
  it("returns start at t=0", () => {
    expect(interpolate(2, 8, 0)).toBe(2);
  });
  it("returns end at t=1", () => {
    expect(interpolate(2, 8, 1)).toBe(8);
  });
  it("returns midpoint at t=0.5", () => {
    expect(interpolate(0, 10, 0.5)).toBe(5);
  });
  it("extrapolates beyond [0,1]", () => {
    expect(interpolate(0, 10, 2)).toBe(20);
  });
});

describe("inverseInterpolate", () => {
  it("returns 0 at start", () => {
    expect(inverseInterpolate(2, 8, 2)).toBe(0);
  });
  it("returns 1 at end", () => {
    expect(inverseInterpolate(2, 8, 8)).toBe(1);
  });
  it("returns 0.5 at midpoint", () => {
    expect(inverseInterpolate(0, 10, 5)).toBe(0.5);
  });
  it("handles equal start/end", () => {
    expect(inverseInterpolate(5, 5, 5)).toBe(0);
  });
});

describe("integerInterpolate", () => {
  it("returns [start, 0] at alpha=0", () => {
    const [idx, res] = integerInterpolate(0, 10, 0);
    expect(idx).toBe(0);
    expect(res).toBe(0);
  });
  it("returns [end-1, 1] at alpha=1", () => {
    const [idx, res] = integerInterpolate(0, 10, 1);
    expect(idx).toBe(9);
    expect(res).toBe(1.0);
  });
});

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("passes through values in range", () => expect(clamp(5, 0, 10)).toBe(5));
});

describe("linspace (numpy-ts)", () => {
  it("returns correct count", () => {
    const result = linspace(0, 1, 5);
    expect(result.shape[0]).toBe(5);
  });
  it("starts at start", () => {
    const result = arr(linspace(0, 10, 3));
    expect(result[0]).toBeCloseTo(0);
  });
  it("ends at end", () => {
    const result = arr(linspace(0, 10, 3));
    expect(result[2]).toBeCloseTo(10);
  });
});

describe("sigmoid", () => {
  it("returns 0.5 at x=0", () => {
    expect(sigmoid(0)).toBe(0.5);
  });
  it("approaches 1 for large positive x", () => {
    expect(sigmoid(10)).toBeCloseTo(1, 4);
  });
  it("approaches 0 for large negative x", () => {
    expect(sigmoid(-10)).toBeCloseTo(0, 4);
  });
});

// ─── Point Math ─────────────────────────────────────────────

describe("point3D", () => {
  it("creates an NDArray of shape [3]", () => {
    const p = point3D(1, 2, 3);
    expect(p.shape).toEqual([3]);
    const a = arr(p);
    expect(a[0]).toBe(1);
    expect(a[1]).toBe(2);
    expect(a[2]).toBe(3);
  });
});

describe("clonePoint", () => {
  it("creates an independent copy", () => {
    const p = point3D(1, 2, 3);
    const c = clonePoint(p);
    c.set([0], 99);
    expect(arr(p)[0]).toBe(1); // original unchanged
  });
});

describe("normalizePoint", () => {
  it("normalizes to unit length", () => {
    const p = normalizePoint(point3D(3, 0, 0));
    const a = arr(p);
    expect(a[0]).toBeCloseTo(1);
    expect(a[1]).toBeCloseTo(0);
    expect(a[2]).toBeCloseTo(0);
  });
  it("handles zero vector", () => {
    const p = normalizePoint(point3D(0, 0, 0));
    const a = arr(p);
    expect(a[0]).toBe(0);
    expect(a[1]).toBe(0);
    expect(a[2]).toBe(0);
  });
});

describe("crossProduct", () => {
  it("X cross Y = Z", () => {
    const result = crossProduct(point3D(1, 0, 0), point3D(0, 1, 0));
    expect(result).toBeCloseToPoint(point3D(0, 0, 1));
  });
  it("Y cross X = -Z", () => {
    const result = crossProduct(point3D(0, 1, 0), point3D(1, 0, 0));
    expect(result).toBeCloseToPoint(point3D(0, 0, -1));
  });
  it("parallel vectors give zero", () => {
    const result = crossProduct(point3D(1, 0, 0), point3D(2, 0, 0));
    expect(result).toBeCloseToPoint(point3D(0, 0, 0));
  });
});

describe("angleOfVector", () => {
  it("returns 0 for positive x-axis", () => {
    expect(angleOfVector(point3D(1, 0, 0))).toBeCloseTo(0);
  });
  it("returns PI/2 for positive y-axis", () => {
    expect(angleOfVector(point3D(0, 1, 0))).toBeCloseTo(PI / 2);
  });
  it("returns PI for negative x-axis", () => {
    expect(angleOfVector(point3D(-1, 0, 0))).toBeCloseTo(PI);
  });
});

describe("angleBetweenVectors", () => {
  it("returns 0 for same direction", () => {
    expect(angleBetweenVectors(point3D(1, 0, 0), point3D(2, 0, 0))).toBeCloseTo(0);
  });
  it("returns PI/2 for perpendicular", () => {
    expect(angleBetweenVectors(point3D(1, 0, 0), point3D(0, 1, 0))).toBeCloseTo(PI / 2);
  });
  it("returns PI for opposite", () => {
    expect(angleBetweenVectors(point3D(1, 0, 0), point3D(-1, 0, 0))).toBeCloseTo(PI);
  });
});

describe("centerOfMass", () => {
  it("returns origin for empty", () => {
    expect(centerOfMass([])).toBeCloseToPoint(ORIGIN);
  });
  it("returns the point for single point", () => {
    expect(centerOfMass([point3D(3, 4, 5)])).toBeCloseToPoint(point3D(3, 4, 5));
  });
  it("returns average for two points", () => {
    expect(centerOfMass([point3D(0, 0, 0), point3D(2, 4, 6)])).toBeCloseToPoint(
      point3D(1, 2, 3)
    );
  });
});

// ─── Complex Numbers ────────────────────────────────────────

describe("complex operations", () => {
  it("complexToR3 maps [a,b] to (a,b,0)", () => {
    expect(complexToR3([3, 4])).toBeCloseToPoint(point3D(3, 4, 0));
  });
  it("r3ToComplex round-trips", () => {
    expect(r3ToComplex(point3D(3, 4, 0))).toEqual([3, 4]);
  });
  it("complexMultiply: (1+i)(1-i) = 2", () => {
    const result = complexMultiply([1, 1], [1, -1]);
    expect(result[0]).toBeCloseTo(2);
    expect(result[1]).toBeCloseTo(0);
  });
});

// ─── Coordinate Transforms ──────────────────────────────────

describe("spherical/cartesian round-trip", () => {
  it("round-trips a point", () => {
    const p = point3D(1, 2, 3);
    const [r, theta, phi] = cartesianToSpherical(p);
    const back = sphericalToCartesian(r, theta, phi);
    expect(back).toBeCloseToPoint(p, 6);
  });
});

// ─── Points3D Operations ────────────────────────────────────

describe("Points3D", () => {
  it("pointsFromArray creates correct NDArray", () => {
    const pts = pointsFromArray([[1, 2, 3], [4, 5, 6]]);
    expect(pts.shape).toEqual([2, 3]);
    expect(pointCount(pts)).toBe(2);
    expect(getPoint(pts, 0)).toBeCloseToPoint(point3D(1, 2, 3));
    expect(getPoint(pts, 1)).toBeCloseToPoint(point3D(4, 5, 6));
  });

  it("setPoint modifies in place", () => {
    const pts = emptyPoints(2);
    setPoint(pts, 1, point3D(7, 8, 9));
    expect(getPoint(pts, 1)).toBeCloseToPoint(point3D(7, 8, 9));
  });

  it("concatPoints merges arrays", () => {
    const a = pointsFromArray([[1, 0, 0]]);
    const b = pointsFromArray([[0, 1, 0]]);
    const c = concatPoints(a, b);
    expect(pointCount(c)).toBe(2);
  });

  it("pointsBoundingBox handles single point", () => {
    const pts = pointsFromArray([[3, 4, 5]]);
    const { min, max } = pointsBoundingBox(pts);
    expect(min).toBeCloseToPoint(point3D(3, 4, 5));
    expect(max).toBeCloseToPoint(point3D(3, 4, 5));
  });
});

// ─── Bezier ─────────────────────────────────────────────────

describe("bezier", () => {
  it("linear bezier at t=0 returns first point", () => {
    const fn = bezier([point3D(0, 0, 0), point3D(1, 1, 0)]);
    expect(fn(0)).toBeCloseToPoint(point3D(0, 0, 0));
  });

  it("linear bezier at t=1 returns last point", () => {
    const fn = bezier([point3D(0, 0, 0), point3D(1, 1, 0)]);
    expect(fn(1)).toBeCloseToPoint(point3D(1, 1, 0));
  });

  it("linear bezier at t=0.5 returns midpoint", () => {
    const fn = bezier([point3D(0, 0, 0), point3D(2, 0, 0)]);
    expect(fn(0.5)).toBeCloseToPoint(point3D(1, 0, 0));
  });

  it("quadratic bezier at t=0.5", () => {
    const fn = bezier([point3D(0, 0, 0), point3D(1, 2, 0), point3D(2, 0, 0)]);
    expect(fn(0.5)).toBeCloseToPoint(point3D(1, 1, 0));
  });

  it("single control point returns that point", () => {
    const fn = bezier([point3D(5, 5, 5)]);
    expect(fn(0)).toBeCloseToPoint(point3D(5, 5, 5));
    expect(fn(0.5)).toBeCloseToPoint(point3D(5, 5, 5));
    expect(fn(1)).toBeCloseToPoint(point3D(5, 5, 5));
  });
});

describe("partialBezierPoints", () => {
  it("a=0, b=1 returns cloned points", () => {
    const pts = [point3D(0, 0, 0), point3D(1, 1, 0), point3D(2, 0, 0)];
    const result = partialBezierPoints(pts, 0, 1);
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseToPoint(pts[0]);
    expect(result[2]).toBeCloseToPoint(pts[2]);
  });

  it("a=0, b=0.5 first point is same", () => {
    const pts = [point3D(0, 0, 0), point3D(1, 1, 0), point3D(2, 0, 0)];
    const result = partialBezierPoints(pts, 0, 0.5);
    expect(result[0]).toBeCloseToPoint(point3D(0, 0, 0));
  });

  it("partial bezier evaluates correctly at endpoints", () => {
    const pts = [point3D(0, 0, 0), point3D(1, 2, 0), point3D(2, 0, 0)];
    const origFn = bezier(pts);
    const partial = partialBezierPoints(pts, 0.2, 0.7);
    const partialFn = bezier(partial);

    expect(partialFn(0)).toBeCloseToPoint(origFn(0.2), 6);
    expect(partialFn(1)).toBeCloseToPoint(origFn(0.7), 6);
  });
});

// ─── Rate Functions ─────────────────────────────────────────

describe("smooth (sigmoid-based)", () => {
  it("returns 0 at t=0", () => {
    expect(smooth(0)).toBeCloseTo(0, 4);
  });
  it("returns 1 at t=1", () => {
    expect(smooth(1)).toBeCloseTo(1, 4);
  });
  it("returns ~0.5 at t=0.5", () => {
    expect(smooth(0.5)).toBeCloseTo(0.5, 4);
  });
  it("is monotonically increasing", () => {
    let prev = smooth(0);
    for (let t = 0.1; t <= 1.0; t += 0.1) {
      const val = smooth(t);
      expect(val).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = val;
    }
  });
  it("clamps below 0", () => {
    expect(smooth(-1)).toBe(0);
  });
  it("clamps above 1", () => {
    expect(smooth(2)).toBe(1);
  });
});

describe("smoothstep (NOT smooth)", () => {
  it("returns 0 at t=0", () => expect(smoothstep(0)).toBe(0));
  it("returns 1 at t=1", () => expect(smoothstep(1)).toBe(1));
  it("returns 0.5 at t=0.5", () => expect(smoothstep(0.5)).toBe(0.5));
  it("differs from smooth at t=0.2", () => {
    expect(Math.abs(smooth(0.2) - smoothstep(0.2))).toBeGreaterThan(0.01);
  });
});

describe("doubleSmooth", () => {
  it("returns 0 at t=0", () => expect(doubleSmooth(0)).toBeCloseTo(0, 4));
  it("returns ~0.5 at t=0.5", () => {
    expect(doubleSmooth(0.5)).toBeCloseTo(0.5, 4);
  });
  it("returns 1 at t=1", () => expect(doubleSmooth(1)).toBeCloseTo(1, 4));
});

describe("linear", () => {
  it("returns t unchanged", () => {
    expect(linear(0.3)).toBeCloseTo(0.3);
  });
  it("clamps below 0", () => expect(linear(-0.5)).toBe(0));
  it("clamps above 1", () => expect(linear(1.5)).toBe(1));
});

describe("thereAndBack", () => {
  it("returns 0 at t=0", () => expect(thereAndBack(0)).toBeCloseTo(0, 4));
  it("returns ~1 at t=0.5", () => expect(thereAndBack(0.5)).toBeCloseTo(1, 2));
  it("returns 0 at t=1", () => expect(thereAndBack(1)).toBeCloseTo(0, 4));
  it("returns 0 outside [0,1]", () => {
    expect(thereAndBack(-0.5)).toBe(0);
    expect(thereAndBack(1.5)).toBe(0);
  });
});

describe("squishRateFunc", () => {
  it("squishes smooth into [0.2, 0.8]", () => {
    const squished = squishRateFunc(smooth, 0.2, 0.8);
    expect(squished(0.1)).toBeCloseTo(smooth(0), 4);
    expect(squished(0.5)).toBeCloseTo(smooth(0.5), 4);
    expect(squished(0.9)).toBeCloseTo(smooth(1), 4);
  });
});

// ─── Matrix / Rotation ──────────────────────────────────────

describe("rotationMatrix", () => {
  it("90 degree rotation around Z maps X to Y", () => {
    const m = rotationMatrix(PI / 2, OUT);
    const result = applyMatrixToPoint(m, point3D(1, 0, 0));
    expect(result).toBeCloseToPoint(point3D(0, 1, 0), 6);
  });

  it("180 degree rotation around Z maps X to -X", () => {
    const m = rotationMatrix(PI, OUT);
    const result = applyMatrixToPoint(m, point3D(1, 0, 0));
    expect(result).toBeCloseToPoint(point3D(-1, 0, 0), 6);
  });
});

describe("rotateVector", () => {
  it("rotates X by 90 around Z to get Y", () => {
    const result = rotateVector(point3D(1, 0, 0), PI / 2, OUT);
    expect(result).toBeCloseToPoint(point3D(0, 1, 0), 6);
  });
});

// ─── Quaternion ─────────────────────────────────────────────

describe("quaternion operations", () => {
  it("round-trips angle-axis", () => {
    const q = quaternionFromAngleAxis(PI / 3, point3D(0, 0, 1));
    const { angle, axis } = angleAxisFromQuaternion(q);
    expect(angle).toBeCloseTo(PI / 3, 6);
    expect(axis).toBeCloseToPoint(point3D(0, 0, 1), 6);
  });

  it("conjugate reverses rotation", () => {
    const q = quaternionFromAngleAxis(PI / 4, OUT);
    const qc = quaternionConjugate(q);
    const product = quaternionMultiply(q, qc);
    expect(product[0]).toBeCloseTo(1, 6);
    expect(product[1]).toBeCloseTo(0, 6);
    expect(product[2]).toBeCloseTo(0, 6);
    expect(product[3]).toBeCloseTo(0, 6);
  });
});

// ─── numpy-ts integration ───────────────────────────────────

describe("numpy-ts basics", () => {
  it("np.array creates NDArray", () => {
    const a = np.array([1, 2, 3]);
    expect(a.shape).toEqual([3]);
    expect(a.toArray()).toEqual([1, 2, 3]);
  });

  it("np.zeros creates zero array", () => {
    const z = np.zeros([2, 3]);
    expect(z.shape).toEqual([2, 3]);
  });

  it("np.dot computes dot product", () => {
    const a = np.array([1, 0, 0]);
    const b = np.array([0, 1, 0]);
    expect(np.dot(a, b) as number).toBe(0);
  });

  it("np.linalg.norm computes vector length", () => {
    const v = np.array([3, 4, 0]);
    expect(np.linalg.norm(v) as number).toBeCloseTo(5);
  });

  it("np.vstack stacks arrays vertically", () => {
    const a = np.array([[1, 2, 3]]);
    const b = np.array([[4, 5, 6]]);
    const result = np.vstack([a, b]);
    expect(result.shape).toEqual([2, 3]);
  });

  it("NDArray arithmetic works", () => {
    const a = np.array([1, 2, 3]);
    const b = np.array([4, 5, 6]);
    const sum = a.add(b);
    expect(sum.toArray()).toEqual([5, 7, 9]);
  });

  it("np.linalg.solve solves linear system", () => {
    // Solve: 2x = 6 → x = 3
    const A = np.array([[2]]);
    const b = np.array([6]);
    const x = np.linalg.solve(A, b);
    expect((x.toArray() as number[])[0]).toBeCloseTo(3);
  });
});
