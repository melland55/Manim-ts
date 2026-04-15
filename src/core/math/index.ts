/**
 * Core math utilities for manim-ts.
 *
 * numpy-ts is the primary math foundation. Agents converting Python Manim
 * should use np.* functions directly — the API mirrors NumPy almost exactly.
 * For example: np.array(), np.dot(), np.linalg.solve(), np.vstack(), etc.
 *
 * Manim-specific utilities (rate functions, bezier, quaternions, space_ops)
 * are also exported from this module. These have no numpy equivalent.
 *
 * gl-matrix is kept for 4x4 transform matrices (rotation, projection).
 */

import { vec3, mat4, glMatrix } from "gl-matrix";

// Configure gl-matrix to use Float64Array for all internal allocations.
// Without this, matrix operations silently round-trip through Float32.
glMatrix.setMatrixArrayType(Float64Array as unknown as Float32ArrayConstructor);

// ─── numpy-ts: the math foundation ──────────────────────────

import * as np from "numpy-ts";
import type { NDArray } from "numpy-ts";

// Re-export numpy-ts namespace — agents write np.array(), np.linalg.solve(), etc.
export { np };
export type { NDArray };

// Re-export commonly used numpy-ts functions for direct import convenience
export {
  array, zeros, ones, full, empty,
  arange, linspace, logspace,
  eye, identity, diag,
  dot, cross, matmul,
  vstack, hstack, concatenate, stack, reshape,
  transpose,
  clip, maximum, minimum,
  sum, mean, prod,
  sort, argsort, where,
  allclose, isclose,
  linalg,
  random,
} from "numpy-ts";

// ─── Types ───────────────────────────────────────────────────

/** A 3D point — NDArray with shape [3] */
export type Point3D = NDArray;

/** Array of 3D points — NDArray with shape [n, 3] */
export type Points3D = NDArray;

/** Rate function: maps [0,1] → [0,1] */
export type RateFunc = (t: number) => number;

// ─── Constants ───────────────────────────────────────────────

export const ORIGIN: Point3D = np.array([0, 0, 0]);
export const UP: Point3D = np.array([0, 1, 0]);
export const DOWN: Point3D = np.array([0, -1, 0]);
export const LEFT: Point3D = np.array([-1, 0, 0]);
export const RIGHT: Point3D = np.array([1, 0, 0]);
export const OUT: Point3D = np.array([0, 0, 1]);
export const IN: Point3D = np.array([0, 0, -1]);

export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const DEGREES = TAU / 360;

// ─── Convenience Point Factories ─────────────────────────────
// Thin wrappers over np.array() for common patterns

export function point3D(x: number, y: number, z: number): Point3D {
  return np.array([x, y, z]);
}

// ─── Scalar Math ─────────────────────────────────────────────
// These operate on plain numbers, not arrays.

export function interpolate(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseInterpolate(start: number, end: number, value: number): number {
  if (start === end) return 0;
  return (value - start) / (end - start);
}

export function integerInterpolate(start: number, end: number, alpha: number): [number, number] {
  if (alpha >= 1) return [end - 1, 1.0];
  if (alpha <= 0) return [start, 0.0];
  const value = interpolate(start, end, alpha);
  const index = Math.floor(value);
  const residue = value - index;
  return [Math.min(index, end - 1), residue];
}

export function mid(a: number, b: number): number {
  return (a + b) / 2;
}

/** Clamp a scalar value. For array clipping, use np.clip(). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function approxEqual(a: number, b: number, epsilon = 1e-8): boolean {
  return Math.abs(a - b) < epsilon;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ─── Point / Vector Helpers ──────────────────────────────────
// Manim-specific operations not in numpy. These accept NDArray points.

/** Euclidean norm of a vector. Equivalent to np.linalg.norm(v). */
export function pointNorm(p: Point3D): number {
  return np.linalg.norm(p) as number;
}

/** Normalize a vector to unit length. */
export function normalizePoint(p: Point3D): Point3D {
  const len = pointNorm(p);
  if (len === 0) return np.zeros([3]);
  return p.divide(len);
}

/** Dot product of two 3D vectors. Equivalent to np.dot(a, b). */
export function dotProduct(a: Point3D, b: Point3D): number {
  return np.dot(a, b) as number;
}

/** Cross product of two 3D vectors. Equivalent to np.cross(a, b). */
export function crossProduct(a: Point3D, b: Point3D): Point3D {
  return np.cross(a, b) as Point3D;
}

/** Distance between two points. */
export function pointDistance(a: Point3D, b: Point3D): number {
  return np.linalg.norm(a.subtract(b)) as number;
}

/** Interpolate between two points. */
export function interpolatePoint(a: Point3D, b: Point3D, t: number): Point3D {
  return a.add(b.subtract(a).multiply(t));
}

/** Midpoint between two points. */
export function midPoint(a: Point3D, b: Point3D): Point3D {
  return interpolatePoint(a, b, 0.5);
}

// ─── Angle Operations ───────────────────────────────────────

export function angleOfVector(v: Point3D): number {
  const arr = v.toArray() as number[];
  return Math.atan2(arr[1], arr[0]);
}

export function angleBetweenVectors(v1: Point3D, v2: Point3D): number {
  const d = dotProduct(v1, v2);
  const n = pointNorm(v1) * pointNorm(v2);
  if (n === 0) return 0;
  return Math.acos(clamp(d / n, -1, 1));
}

export function rotateVector(
  vector: Point3D,
  angle: number,
  axis: Point3D = OUT
): Point3D {
  const m = rotationMatrix(angle, axis);
  return applyMatrixToPoint(m, vector);
}

export function getUnitNormal(v1: Point3D, v2: Point3D): Point3D {
  const cp = crossProduct(v1, v2);
  const norm = pointNorm(cp);
  if (norm === 0) return np.array([...OUT.toArray() as number[]]);
  return cp.divide(norm);
}

// ─── Center / Barycentrics ──────────────────────────────────

/** Center of mass of an array of points. Accepts NDArray [n,3] or Point3D[]. */
export function centerOfMass(points: Points3D | Point3D[]): Point3D {
  if (Array.isArray(points)) {
    if (points.length === 0) return np.zeros([3]);
    const stacked = np.vstack(points);
    return np.mean(stacked, 0) as Point3D;
  }
  // NDArray [n, 3]
  if (points.shape[0] === 0) return np.zeros([3]);
  return np.mean(points, 0) as Point3D;
}

// ─── Complex Number Operations ──────────────────────────────

export type Complex = [number, number]; // [real, imag]

export function complexToR3(z: Complex): Point3D {
  return np.array([z[0], z[1], 0]);
}

export function r3ToComplex(p: Point3D): Complex {
  const arr = p.toArray() as number[];
  return [arr[0], arr[1]];
}

export function complexMultiply(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

// ─── Line/Intersection Operations ───────────────────────────

export function findIntersection(
  p0: Point3D,
  v0: Point3D,
  p1: Point3D,
  v1: Point3D
): Point3D {
  const t = lineIntersectionT(p0, v0, p1, v1);
  return p0.add(v0.multiply(t));
}

function lineIntersectionT(
  p0: Point3D,
  v0: Point3D,
  p1: Point3D,
  v1: Point3D
): number {
  const v0a = v0.toArray() as number[];
  const v1a = v1.toArray() as number[];
  const cross = v0a[0] * v1a[1] - v0a[1] * v1a[0];
  if (Math.abs(cross) < 1e-10) return 0;
  const dp = p1.subtract(p0).toArray() as number[];
  return (dp[0] * v1a[1] - dp[1] * v1a[0]) / cross;
}

// ─── Coordinate Transforms ──────────────────────────────────

/**
 * Returns [r, theta, phi] from a Cartesian point [x, y, z].
 * Matches Python Manim's convention (manim.utils.space_ops.cartesian_to_spherical):
 *   theta = atan2(y, x)    — azimuthal angle from positive x-axis
 *   phi   = acos(z / r)    — polar angle from positive z-axis
 */
export function cartesianToSpherical(point: Point3D): [number, number, number] {
  const r = pointNorm(point);
  if (r === 0) return [0, 0, 0];
  const arr = point.toArray() as number[];
  const theta = Math.atan2(arr[1], arr[0]);
  const phi = Math.acos(clamp(arr[2] / r, -1, 1));
  return [r, theta, phi];
}

/**
 * Returns a Cartesian point [x, y, z] from spherical coordinates.
 * Matches Python Manim (manim.utils.space_ops.spherical_to_cartesian):
 *   theta = azimuth from +x axis, phi = polar angle from +z axis.
 */
export function sphericalToCartesian(r: number, theta: number, phi: number): Point3D {
  return np.array([
    r * Math.cos(theta) * Math.sin(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(phi),
  ]);
}

// ─── Bezier ──────────────────────────────────────────────────

/**
 * Create a bezier curve function from control points.
 * Accepts NDArray [n,3] or array of Point3D.
 */
export function bezier(controlPoints: Points3D | Point3D[]): (t: number) => Point3D {
  // Pre-extract to plain arrays for fast evaluation in the inner loop
  let pts: number[][];
  if (Array.isArray(controlPoints)) {
    pts = controlPoints.map(p => p.toArray() as number[]);
  } else {
    const rows = controlPoints.shape[0];
    pts = [];
    for (let i = 0; i < rows; i++) {
      pts.push(controlPoints.row(i).toArray() as number[]);
    }
  }

  const n = pts.length - 1;
  if (n === 0) return () => np.array([...pts[0]]);
  if (n < 0) return () => np.zeros([3]);

  const coeffs = binomialCoefficients(n);

  return (t: number): Point3D => {
    let rx = 0, ry = 0, rz = 0;
    const mt = 1 - t;

    for (let i = 0; i <= n; i++) {
      const weight = coeffs[i] * Math.pow(mt, n - i) * Math.pow(t, i);
      rx += weight * pts[i][0];
      ry += weight * pts[i][1];
      rz += weight * (pts[i][2] ?? 0);
    }

    return np.array([rx, ry, rz]);
  };
}

/**
 * Extract a partial bezier curve between parameters a and b.
 * Uses De Casteljau's algorithm.
 */
export function partialBezierPoints(
  points: Point3D[],
  a: number,
  b: number
): Point3D[] {
  if (a === 0 && b === 1) return points.map(p => np.array([...p.toArray() as number[]]));

  const aToEnd = splitBezierRight(points, a);
  const adjustedB = a === 1 ? 1 : (b - a) / (1 - a);
  return splitBezierLeft(aToEnd, adjustedB);
}

function splitBezierLeft(points: Point3D[], t: number): Point3D[] {
  const n = points.length;
  const result: Point3D[] = [np.array([...points[0].toArray() as number[]])];
  let current = points.map(p => np.array([...p.toArray() as number[]]));

  for (let level = 1; level < n; level++) {
    const next: Point3D[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(interpolatePoint(current[i], current[i + 1], t));
    }
    result.push(np.array([...next[0].toArray() as number[]]));
    current = next;
  }

  return result;
}

function splitBezierRight(points: Point3D[], t: number): Point3D[] {
  const n = points.length;
  let current = points.map(p => np.array([...p.toArray() as number[]]));

  const levels: Point3D[][] = [current];
  for (let level = 1; level < n; level++) {
    const next: Point3D[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(interpolatePoint(current[i], current[i + 1], t));
    }
    levels.push(next);
    current = next;
  }

  const result: Point3D[] = [];
  for (let level = n - 1; level >= 0; level--) {
    const last = levels[level][levels[level].length - 1];
    result.push(np.array([...last.toArray() as number[]]));
  }

  return result;
}

function binomialCoefficients(n: number): number[] {
  const coeffs = [1];
  for (let i = 1; i <= n; i++) {
    coeffs.push((coeffs[i - 1] * (n - i + 1)) / i);
  }
  return coeffs;
}

// ─── Rate Functions ─────────────────────────────────────────
// Matches manim.utils.rate_functions exactly.
// These are scalar functions (number → number), no NDArray involved.

function unitInterval(fn: RateFunc): RateFunc {
  return (t: number) => {
    if (t < 0) return 0;
    if (t > 1) return 1;
    return fn(t);
  };
}

function zeroOutside(fn: RateFunc): RateFunc {
  return (t: number) => {
    if (t < 0 || t > 1) return 0;
    return fn(t);
  };
}

export const linear: RateFunc = unitInterval((t) => t);

/**
 * Manim's default smooth function — sigmoid-based, NOT smoothstep.
 * Uses sigmoid with inflection=10.0.
 */
export const smooth: RateFunc = unitInterval((t) => {
  const inflection = 10.0;
  const error = sigmoid(-inflection / 2);
  return Math.min(
    Math.max(
      (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error),
      0
    ),
    1
  );
});

export function smoothWithInflection(inflection: number): RateFunc {
  return unitInterval((t) => {
    const error = sigmoid(-inflection / 2);
    return Math.min(
      Math.max(
        (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error),
        0
      ),
      1
    );
  });
}

/** 1st order SmoothStep: 3t² - 2t³. Not the same as smooth(). */
export const smoothstep: RateFunc = unitInterval((t) => 3 * t * t - 2 * t * t * t);

/** 2nd order SmoothStep */
export const smootherstep: RateFunc = unitInterval(
  (t) => 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3
);

/** 3rd order SmoothStep */
export const smoothererstep: RateFunc = unitInterval(
  (t) => 35 * t ** 4 - 84 * t ** 5 + 70 * t ** 6 - 20 * t ** 7
);

export const rushInto: RateFunc = unitInterval((t) => 2 * smooth(t / 2));
export const rushFrom: RateFunc = unitInterval((t) => 2 * smooth(t / 2 + 0.5) - 1);
export const slowInto: RateFunc = unitInterval((t) => Math.sqrt(1 - (1 - t) * (1 - t)));

export const doubleSmooth: RateFunc = unitInterval((t) => {
  if (t < 0.5) return 0.5 * smooth(2 * t);
  return 0.5 * (1 + smooth(2 * t - 1));
});

export const thereAndBack: RateFunc = zeroOutside((t) => {
  const newT = t < 0.5 ? 2 * t : 2 * (1 - t);
  return smooth(newT);
});

export function thereAndBackWithPause(pauseRatio = 1 / 3): RateFunc {
  return zeroOutside((t) => {
    const a = 2.0 / (1.0 - pauseRatio);
    if (t < 0.5 - pauseRatio / 2) return smooth(a * t);
    if (t < 0.5 + pauseRatio / 2) return 1;
    return smooth(a - a * t);
  });
}

export function runningStart(pullFactor = -0.5): RateFunc {
  return unitInterval((t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;
    const t6 = t5 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const mt4 = mt3 * mt;
    // Equivalent to evaluating the Bézier [0, 0, pullFactor, pullFactor, 1, 1, 1] at t.
    // Matches manim.utils.rate_functions.running_start exactly.
    return (
      15 * t2 * mt4 * pullFactor +
      20 * t3 * mt3 * pullFactor +
      15 * t4 * mt2 +
      6 * t5 * mt +
      t6
    );
  });
}

export function notQuiteThereRatio(func: RateFunc, proportion = 0.7): RateFunc {
  return (t: number) => proportion * func(t);
}

/**
 * Matches manim.utils.rate_functions.wiggle(t, wiggles=2).
 * Callable as a RateFunc: `wiggle(t)` uses the default of 2 wiggles.
 * For a custom count, call `wiggle(t, n)`.
 */
export const wiggle: RateFunc & ((t: number, wiggles?: number) => number) =
  ((t: number, wiggles: number = 2): number => {
    if (t < 0 || t > 1) return 0;
    return thereAndBack(t) * Math.sin(wiggles * PI * t);
  }) as RateFunc & ((t: number, wiggles?: number) => number);

export function squishRateFunc(func: RateFunc, a: number, b: number): RateFunc {
  return (t: number) => {
    if (t < a) return func(0);
    if (t > b) return func(1);
    return func((t - a) / (b - a));
  };
}

export const lingering: RateFunc = unitInterval((t) => {
  return squishRateFunc(smooth, 0, 0.8)(t);
});

export function exponentialDecay(halfLife = 0.1): RateFunc {
  return (t: number) => 1 - Math.pow(2, -t / halfLife);
}

export const easeInSine: RateFunc = unitInterval((t) => 1 - Math.cos((t * PI) / 2));
export const easeOutSine: RateFunc = unitInterval((t) => Math.sin((t * PI) / 2));
export const easeInOutSine: RateFunc = unitInterval((t) => -(Math.cos(PI * t) - 1) / 2);

// ─── Matrix Helpers (gl-matrix) ─────────────────────────────

export function rotationMatrix(angle: number, axis: Point3D = OUT): mat4 {
  const out = mat4.create();
  const arr = normalizePoint(axis).toArray() as number[];
  const normAxis = vec3.fromValues(arr[0], arr[1], arr[2]);
  return mat4.fromRotation(out, angle, normAxis);
}

export function applyMatrixToPoint(m: mat4, p: Point3D): Point3D {
  const arr = p.toArray() as number[];
  const v = vec3.fromValues(arr[0], arr[1], arr[2]);
  vec3.transformMat4(v, v, m);
  return np.array([v[0], v[1], v[2]]);
}

export function applyMatrixToPoints(m: mat4, points: Points3D): Points3D {
  const n = points.shape[0];
  const result: number[][] = [];
  const v = vec3.create();

  for (let i = 0; i < n; i++) {
    const row = points.row(i).toArray() as number[];
    vec3.set(v, row[0], row[1], row[2]);
    vec3.transformMat4(v, v, m);
    result.push([v[0], v[1], v[2]]);
  }

  return np.array(result);
}

// ─── Quaternion Operations ──────────────────────────────────

export type Quaternion = [number, number, number, number]; // [w, x, y, z]

export function quaternionFromAngleAxis(angle: number, axis: Point3D): Quaternion {
  const normAxis = normalizePoint(axis).toArray() as number[];
  const half = angle / 2;
  const s = Math.sin(half);
  return [Math.cos(half), normAxis[0] * s, normAxis[1] * s, normAxis[2] * s];
}

export function angleAxisFromQuaternion(q: Quaternion): { angle: number; axis: Point3D } {
  const [w, x, y, z] = q;
  const norm = Math.sqrt(x * x + y * y + z * z);
  if (norm < 1e-10) return { angle: 0, axis: np.array([...OUT.toArray() as number[]]) };
  return { angle: 2 * Math.atan2(norm, w), axis: np.array([x / norm, y / norm, z / norm]) };
}

export function quaternionMultiply(q1: Quaternion, q2: Quaternion): Quaternion {
  const [w1, x1, y1, z1] = q1;
  const [w2, x2, y2, z2] = q2;
  return [
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
  ];
}

export function quaternionConjugate(q: Quaternion): Quaternion {
  return [q[0], -q[1], -q[2], -q[3]];
}

// ─── Legacy / Compatibility Helpers ──────────────────────────
// These maintain backward compatibility with already-converted modules
// that used the old Float64Array-based API. New code should prefer
// numpy-ts operations directly (np.array, np.vstack, etc.).

export function addPoints(a: Point3D, b: Point3D): Point3D {
  return a.add(b);
}

export function subtractPoints(a: Point3D, b: Point3D): Point3D {
  return a.subtract(b);
}

export function scalePoint(p: Point3D, scalar: number): Point3D {
  return p.multiply(scalar);
}

export function clonePoint(p: Point3D): Point3D {
  return np.array([...p.toArray() as number[]]);
}

export function pointFromVec3(v: vec3): Point3D {
  return np.array([v[0], v[1], v[2]]);
}

/** Create Points3D (shape [n,3]) from array of [x,y,z] triples. */
export function pointsFromArray(coords: number[][]): Points3D {
  if (coords.length === 0) return np.zeros([0, 3]);
  return np.array(coords.map(c => [c[0], c[1] ?? 0, c[2] ?? 0]));
}

/** Create empty Points3D of given count. */
export function emptyPoints(count: number): Points3D {
  return np.zeros([count, 3]);
}

/** Number of points in a Points3D array. */
export function pointCount(points: Points3D): number {
  if (points.ndim === 1) return points.shape[0] === 0 ? 0 : 1;
  return points.shape[0];
}

/** Get a single point from Points3D by index. */
export function getPoint(points: Points3D, index: number): Point3D {
  if (points.ndim === 1) return np.array([...points.toArray() as number[]]);
  return np.array([...points.row(index).toArray() as number[]]);
}

/** Set a single point in Points3D by index (mutates). */
export function setPoint(points: Points3D, index: number, p: Point3D): void {
  const pa = p.toArray() as number[];
  points.set([index, 0], pa[0]);
  points.set([index, 1], pa[1]);
  points.set([index, 2], pa[2]);
}

/** Concatenate multiple Points3D arrays vertically. */
export function concatPoints(...arrays: Points3D[]): Points3D {
  const nonEmpty = arrays.filter(a => {
    if (a.ndim === 1) return a.shape[0] > 0;
    return a.shape[0] > 0;
  });
  if (nonEmpty.length === 0) return np.zeros([0, 3]);
  // Ensure all are 2D
  const twoDim = nonEmpty.map(a => a.ndim === 1 ? a.reshape(1, 3) : a);
  return np.vstack(twoDim);
}

/** Translate all points by an offset vector. */
export function translatePoints(points: Points3D, offset: Point3D): Points3D {
  return points.add(offset);
}

/** Scale all points by a factor, optionally about a center. */
export function scalePoints(points: Points3D, factor: number, aboutPoint?: Point3D): Points3D {
  if (!aboutPoint) return points.multiply(factor);
  const center = aboutPoint;
  return points.subtract(center).multiply(factor).add(center);
}

/** Compute axis-aligned bounding box of Points3D. */
export function pointsBoundingBox(points: Points3D): { min: Point3D; max: Point3D } {
  const n = pointCount(points);
  if (n === 0) return { min: np.zeros([3]), max: np.zeros([3]) };
  // Use numpy-ts amin/amax along axis 0 to get per-column min/max
  const minP = np.amin(points, 0) as Point3D;
  const maxP = np.amax(points, 0) as Point3D;
  return { min: minP, max: maxP };
}

/** Center of the bounding box of Points3D. */
export function pointsCenter(points: Points3D): Point3D {
  const { min, max } = pointsBoundingBox(points);
  return interpolatePoint(min, max, 0.5);
}
