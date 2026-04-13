/**
 * Utility functions related to Bézier curves.
 * Converted from: utils/bezier.py
 */

import { np } from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import type { Point3D, Points3D } from "../../core/math/index.js";
import { choose } from "../simple_functions/index.js";

// ─── Internal Helpers ────────────────────────────────────────

/** Extract row i from a 2D NDArray as a plain number[]. */
function rowToArray(A: NDArray, i: number): number[] {
  const cols = A.shape[1];
  const row: number[] = [];
  for (let j = 0; j < cols; j++) {
    row.push(A.get([i, j]) as number);
  }
  return row;
}

/** Matrix multiply: A[m,k] @ B[k,n] → C[m,n] */
function matMul(A: NDArray, B: NDArray): NDArray {
  const m = A.shape[0];
  const k = A.shape[1];
  const n = B.shape[1];
  const result: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += (A.get([i, l]) as number) * (B.get([l, j]) as number);
      }
      row.push(sum);
    }
    result.push(row);
  }
  return np.array(result);
}

/** Evaluate polynomial with ascending-power coefficients at t. */
function evaluatePoly(coeffs: number[], t: number): number {
  let result = 0;
  let power = 1;
  for (const c of coeffs) {
    result += c * power;
    power *= t;
  }
  return result;
}

/** Round x to precision given by prec (e.g. prec=1e-6 → 6 decimal places). */
function roundToPrecision(x: number, prec: number): number {
  const decimals = Math.round(Math.log10(1 / prec));
  const factor = Math.pow(10, decimals);
  return Math.round(x * factor) / factor;
}

/** Remove near-duplicate values from a sorted list. */
function deduplicateRoots(roots: number[], tol: number): number[] {
  if (roots.length === 0) return roots;
  const sorted = [...roots].sort((a, b) => a - b);
  const result = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i] - result[result.length - 1]) > tol) {
      result.push(sorted[i]);
    }
  }
  return result;
}

/** Find real roots of polynomial (ascending-power coeffs) in [0, 1] using bisection. */
function findRealRootsInUnit(coeffs: number[], roundTo: number): number[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];

  if (n === 1) {
    // Linear: coeffs[0] + coeffs[1]*t = 0 → t = -coeffs[0]/coeffs[1]
    if (Math.abs(coeffs[1]) < 1e-12) return [];
    const root = -coeffs[0] / coeffs[1];
    if (root >= 0 && root <= 1) {
      return [roundToPrecision(root, roundTo)];
    }
    return [];
  }

  // General: sample and bisect
  const SAMPLES = Math.max(200, n * 20);
  const roots: number[] = [];
  let prevT = 0;
  let prevVal = evaluatePoly(coeffs, 0);

  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const val = evaluatePoly(coeffs, t);

    if (prevVal * val < 0) {
      // Sign change — bisect
      let lo = prevT, hi = t;
      let flo = prevVal;
      for (let iter = 0; iter < 60; iter++) {
        const m = (lo + hi) / 2;
        const fm = evaluatePoly(coeffs, m);
        if (Math.abs(fm) < 1e-15 || hi - lo < 1e-15) {
          const rounded = roundToPrecision(m, roundTo);
          if (rounded >= 0 && rounded <= 1) roots.push(rounded);
          break;
        }
        if (flo * fm < 0) { hi = m; } else { lo = m; flo = fm; }
      }
    } else if (Math.abs(val) < 1e-12) {
      const rounded = roundToPrecision(t, roundTo);
      if (rounded >= 0 && rounded <= 1) roots.push(rounded);
    }

    prevT = t;
    prevVal = val;
  }

  return deduplicateRoots(roots, roundTo * 10);
}

/** Intersection of two arrays with tolerance. */
function intersect1d(a: number[], b: number[], tol: number): number[] {
  return a.filter(x => b.some(y => Math.abs(x - y) <= tol));
}

/**
 * Build polynomial coefficients (ascending power order) for:
 *   B_dim(t) - coord = 0
 * where B_dim is the bezier curve projected to one dimension.
 */
function bezierPolyCoeffs(controlCoords: number[], coord: number): number[] {
  const n = controlCoords.length - 1;
  const terms: number[] = []; // descending power order
  for (let termPower = n; termPower >= 0; termPower--) {
    const outercoeff = choose(n, termPower);
    let termSum = 0;
    let sign = 1;
    for (let subtermNum = termPower; subtermNum >= 0; subtermNum--) {
      const innercoeff = choose(termPower, subtermNum) * sign;
      let subterm = innercoeff * controlCoords[subtermNum];
      if (termPower === 0) {
        subterm -= coord;
      }
      termSum += subterm;
      sign *= -1;
    }
    terms.push(outercoeff * termSum);
  }
  // Reverse to ascending power order
  return terms.reverse();
}

// ─── Subdivision Matrix Builders ─────────────────────────────

function buildConstantSubdivisionMatrix(nDivisions: number): NDArray {
  return np.array(new Array(nDivisions).fill([1]));
}

function buildLinearSubdivisionMatrix(nDivisions: number): NDArray {
  const rows: number[][] = [];
  for (let i = 0; i < nDivisions; i++) {
    rows.push([1 - i / nDivisions, i / nDivisions]);
    rows.push([1 - (i + 1) / nDivisions, (i + 1) / nDivisions]);
  }
  return np.array(rows);
}

function buildQuadraticSubdivisionMatrix(nDivisions: number): NDArray {
  const nd = nDivisions;
  const nd2 = nd * nd;
  const rows: number[][] = [];
  for (let i = 0; i < nd; i++) {
    const ip1 = i + 1;
    const nmi = nd - i;
    const nmim1 = nmi - 1;
    rows.push([nmi * nmi / nd2, 2 * i * nmi / nd2, i * i / nd2]);
    rows.push([nmi * nmim1 / nd2, (i * nmim1 + ip1 * nmi) / nd2, i * ip1 / nd2]);
    rows.push([nmim1 * nmim1 / nd2, 2 * ip1 * nmim1 / nd2, ip1 * ip1 / nd2]);
  }
  return np.array(rows);
}

function buildCubicSubdivisionMatrix(nDivisions: number): NDArray {
  const nd = nDivisions;
  const nd3 = nd * nd * nd;
  const rows: number[][] = [];
  for (let i = 0; i < nd; i++) {
    const i2 = i * i, i3 = i2 * i;
    const ip1 = i + 1, ip12 = ip1 * ip1, ip13 = ip12 * ip1;
    const nmi = nd - i, nmi2 = nmi * nmi, nmi3 = nmi2 * nmi;
    const nmim1 = nmi - 1, nmim12 = nmim1 * nmim1, nmim13 = nmim12 * nmim1;
    rows.push([nmi3 / nd3, 3 * nmi2 * i / nd3, 3 * nmi * i2 / nd3, i3 / nd3]);
    rows.push([
      nmi2 * nmim1 / nd3,
      (2 * nmi * nmim1 * i + nmi2 * ip1) / nd3,
      (nmim1 * i2 + 2 * nmi * i * ip1) / nd3,
      i2 * ip1 / nd3,
    ]);
    rows.push([
      nmi * nmim12 / nd3,
      (nmim12 * i + 2 * nmi * nmim1 * ip1) / nd3,
      (2 * nmim1 * i * ip1 + nmi * ip12) / nd3,
      i * ip12 / nd3,
    ]);
    rows.push([nmim13 / nd3, 3 * nmim12 * ip1 / nd3, 3 * nmim1 * ip12 / nd3, ip13 / nd3]);
  }
  return np.array(rows);
}

// ─── Module-level Memos ──────────────────────────────────────

/** Memoized subdivision matrices for n_points ∈ {1,2,3,4}. */
const SUBDIVISION_MATRICES: Map<number, NDArray>[] = [
  new Map(), // n_points = 1
  new Map(), // n_points = 2
  new Map(), // n_points = 3
  new Map(), // n_points = 4
];

/** c' values memo for closed spline Thomas' algorithm. */
let CP_CLOSED_MEMO: number[] = [1 / 3];
/** u' values memo for closed spline Thomas' algorithm. */
let UP_CLOSED_MEMO: number[] = [1 / 3];
/** c' values memo for open spline Thomas' algorithm. */
let CP_OPEN_MEMO: number[] = [0.5];

// ─── Public API ──────────────────────────────────────────────

/**
 * Classic implementation of a Bézier curve.
 *
 * Given an array of control points (shape [d+1, 3]), returns a function
 * that evaluates the Bézier curve at parameter t ∈ [0, 1].
 */
export function bezier(points: NDArray): (t: number) => Point3D {
  const N = points.shape[0];
  const degree = N - 1;

  if (degree === 0) {
    const p0 = rowToArray(points, 0);
    return (_t: number) => np.array(p0);
  }

  if (degree === 1) {
    const p0 = rowToArray(points, 0);
    const p1 = rowToArray(points, 1);
    return (t: number) => np.array([
      p0[0] + t * (p1[0] - p0[0]),
      p0[1] + t * (p1[1] - p0[1]),
      p0[2] + t * (p1[2] - p0[2]),
    ]);
  }

  if (degree === 2) {
    const p0 = rowToArray(points, 0);
    const p1 = rowToArray(points, 1);
    const p2 = rowToArray(points, 2);
    return (t: number) => {
      const t2 = t * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      return np.array([
        mt2 * p0[0] + 2 * t * mt * p1[0] + t2 * p2[0],
        mt2 * p0[1] + 2 * t * mt * p1[1] + t2 * p2[1],
        mt2 * p0[2] + 2 * t * mt * p1[2] + t2 * p2[2],
      ]);
    };
  }

  if (degree === 3) {
    const p0 = rowToArray(points, 0);
    const p1 = rowToArray(points, 1);
    const p2 = rowToArray(points, 2);
    const p3 = rowToArray(points, 3);
    return (t: number) => {
      const t2 = t * t;
      const t3 = t2 * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      return np.array([
        mt3 * p0[0] + 3 * t * mt2 * p1[0] + 3 * t2 * mt * p2[0] + t3 * p3[0],
        mt3 * p0[1] + 3 * t * mt2 * p1[1] + 3 * t2 * mt * p2[1] + t3 * p3[1],
        mt3 * p0[2] + 3 * t * mt2 * p1[2] + 3 * t2 * mt * p2[2] + t3 * p3[2],
      ]);
    };
  }

  // Degree n ≥ 4: De Casteljau algorithm
  const dim = points.shape[1];
  const jsPoints: number[][] = [];
  for (let i = 0; i < N; i++) {
    jsPoints.push(rowToArray(points, i));
  }

  return (t: number) => {
    // Copy points for in-place De Casteljau
    const B = jsPoints.map(row => [...row]);
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree - i; j++) {
        for (let d = 0; d < dim; d++) {
          B[j][d] += t * (B[j + 1][d] - B[j][d]);
        }
      }
    }
    return np.array(B[0]);
  };
}

/**
 * Given an array of points defining a Bézier curve, and two numbers a, b
 * such that 0 ≤ a < b ≤ 1, return an array of the same size describing the
 * portion of the original Bézier on [a, b].
 */
export function partialBezierPoints(points: NDArray, a: number, b: number): NDArray {
  if (a === 1) {
    const n = points.shape[0];
    const last = rowToArray(points, n - 1);
    const rows: number[][] = new Array(n).fill(null).map(() => [...last]);
    return np.array(rows);
  }
  if (b === 0) {
    const n = points.shape[0];
    const first = rowToArray(points, 0);
    const rows: number[][] = new Array(n).fill(null).map(() => [...first]);
    return np.array(rows);
  }

  const degree = points.shape[0] - 1;

  if (degree === 3) {
    const ma = 1 - a, mb = 1 - b;
    const a2 = a * a, b2 = b * b, ma2 = ma * ma, mb2 = mb * mb;
    const a3 = a2 * a, b3 = b2 * b, ma3 = ma2 * ma, mb3 = mb2 * mb;
    const portionMatrix = np.array([
      [ma3, 3 * ma2 * a, 3 * ma * a2, a3],
      [ma2 * mb, 2 * ma * a * mb + ma2 * b, a2 * mb + 2 * ma * a * b, a2 * b],
      [ma * mb2, a * mb2 + 2 * ma * mb * b, 2 * a * mb * b + ma * b2, a * b2],
      [mb3, 3 * mb2 * b, 3 * mb * b2, b3],
    ]);
    return matMul(portionMatrix, points);
  }

  if (degree === 2) {
    const ma = 1 - a, mb = 1 - b;
    const portionMatrix = np.array([
      [ma * ma, 2 * a * ma, a * a],
      [ma * mb, a * mb + ma * b, a * b],
      [mb * mb, 2 * b * mb, b * b],
    ]);
    return matMul(portionMatrix, points);
  }

  if (degree === 1) {
    const p0 = rowToArray(points, 0);
    const p1 = rowToArray(points, 1);
    const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    return np.array([
      [p0[0] + a * dir[0], p0[1] + a * dir[1], p0[2] + a * dir[2]],
      [p0[0] + b * dir[0], p0[1] + b * dir[1], p0[2] + b * dir[2]],
    ]);
  }

  if (degree === 0) {
    return points;
  }

  // Fallback: nth-degree De Casteljau-based approach
  const N = points.shape[0];
  const dim = points.shape[1];
  const arr: number[][] = [];
  for (let i = 0; i < N; i++) {
    arr.push(rowToArray(points, i).map(v => v));
  }

  if (a !== 0) {
    for (let i = 1; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        for (let d = 0; d < dim; d++) {
          arr[j][d] += a * (arr[j + 1][d] - arr[j][d]);
        }
      }
    }
  }

  if (b !== 1) {
    const mu = (1 - b) / (1 - a);
    for (let i = 1; i < N; i++) {
      for (let j = N - 1; j >= i; j--) {
        for (let d = 0; d < dim; d++) {
          arr[j][d] += mu * (arr[j - 1][d] - arr[j][d]);
        }
      }
    }
  }

  return np.array(arr);
}

/**
 * Split a Bézier curve at parameter t into two curves.
 * Returns shape [2*N, dim] where each half has N control points.
 */
export function splitBezier(points: NDArray, t: number): NDArray {
  const N = points.shape[0];
  const degree = N - 1;

  if (degree === 3) {
    const mt = 1 - t;
    const mt2 = mt * mt, mt3 = mt2 * mt;
    const t2 = t * t, t3 = t2 * t;
    const two_mt_t = 2 * mt * t;
    const three_mt2_t = 3 * mt2 * t;
    const three_mt_t2 = 3 * mt * t2;
    const splitMatrix = np.array([
      [1, 0, 0, 0],
      [mt, t, 0, 0],
      [mt2, two_mt_t, t2, 0],
      [mt3, three_mt2_t, three_mt_t2, t3],
      [mt3, three_mt2_t, three_mt_t2, t3],
      [0, mt2, two_mt_t, t2],
      [0, 0, mt, t],
      [0, 0, 0, 1],
    ]);
    return matMul(splitMatrix, points);
  }

  if (degree === 2) {
    const mt = 1 - t;
    const mt2 = mt * mt, t2 = t * t;
    const two_tmt = 2 * t * mt;
    const splitMatrix = np.array([
      [1, 0, 0],
      [mt, t, 0],
      [mt2, two_tmt, t2],
      [mt2, two_tmt, t2],
      [0, mt, t],
      [0, 0, 1],
    ]);
    return matMul(splitMatrix, points);
  }

  if (degree === 1) {
    const p0 = rowToArray(points, 0);
    const p1 = rowToArray(points, 1);
    const mid = [
      p0[0] + t * (p1[0] - p0[0]),
      p0[1] + t * (p1[1] - p0[1]),
      p0[2] + t * (p1[2] - p0[2]),
    ];
    return np.array([p0, mid, mid, p1]);
  }

  if (degree === 0) {
    const p0 = rowToArray(points, 0);
    return np.array([p0, p0]);
  }

  // Fallback for nth degree
  const dim = points.shape[1];
  const left: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  const right: number[][] = [];
  for (let i = 0; i < N; i++) {
    right.push(rowToArray(points, i));
  }

  left[0] = [...right[0]];

  for (let i = 1; i < N; i++) {
    for (let j = 0; j < N - i; j++) {
      for (let d = 0; d < dim; d++) {
        right[j][d] += t * (right[j + 1][d] - right[j][d]);
      }
    }
    left[i] = [...right[0]];
  }

  return np.array([...left, ...right]);
}

/**
 * Get the memoized subdivision matrix for a bezier curve with nPoints control
 * points, subdivided into nDivisions equal parts.
 */
function getSubdivisionMatrix(nPoints: number, nDivisions: number): NDArray {
  if (nPoints < 1 || nPoints > 4) {
    throw new Error(
      `Subdivision matrix only supports 1-4 control points, got ${nPoints}`
    );
  }
  const memo = SUBDIVISION_MATRICES[nPoints - 1];
  const cached = memo.get(nDivisions);
  if (cached !== undefined) return cached;

  let matrix: NDArray;
  switch (nPoints) {
    case 1: matrix = buildConstantSubdivisionMatrix(nDivisions); break;
    case 2: matrix = buildLinearSubdivisionMatrix(nDivisions); break;
    case 3: matrix = buildQuadraticSubdivisionMatrix(nDivisions); break;
    case 4: matrix = buildCubicSubdivisionMatrix(nDivisions); break;
    default: throw new Error("unreachable");
  }

  memo.set(nDivisions, matrix);
  return matrix;
}

/**
 * Subdivide a Bézier curve into nDivisions subcurves of equal shape.
 * Returns shape [nDivisions * N, dim].
 */
export function subdivideBezier(points: NDArray, nDivisions: number): NDArray {
  if (nDivisions === 1) return points;

  const N = points.shape[0];
  const dim = points.shape[1];

  if (N <= 4) {
    const subdivMatrix = getSubdivisionMatrix(N, nDivisions);
    return matMul(subdivMatrix, points);
  }

  // Fallback for nth-degree: successive splitting
  const jsPoints: number[][] = [];
  for (let i = 0; i < N; i++) {
    jsPoints.push(rowToArray(points, i));
  }

  const beziers: number[][][] = Array.from({ length: nDivisions }, (_, k) =>
    k === nDivisions - 1
      ? jsPoints.map(row => [...row])
      : Array.from({ length: N }, () => new Array(dim).fill(0))
  );

  for (let curveNum = nDivisions - 1; curveNum > 0; curveNum--) {
    const curr = beziers[curveNum];
    const prev = beziers[curveNum - 1];
    prev[0] = [...curr[0]];
    const a = (nDivisions - curveNum) / (nDivisions - curveNum + 1);

    for (let i = 1; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        for (let d = 0; d < dim; d++) {
          curr[j][d] += a * (curr[j + 1][d] - curr[j][d]);
        }
      }
      prev[i] = [...curr[0]];
    }
  }

  const flatResult: number[][] = beziers.flat();
  return np.array(flatResult);
}

/**
 * Subdivide each curve in bezierTuples (shape [current, nppc, dim]) into as
 * many parts as necessary until the total count reaches newNumberOfCurves.
 * Returns shape [newNumberOfCurves, nppc, dim].
 */
export function bezierRemap(bezierTuples: NDArray, newNumberOfCurves: number): NDArray {
  const shape = bezierTuples.shape as [number, number, number];
  const [currentNum, nppc, dim] = shape;

  // Repeat indices: which original curve index each new curve maps to
  const repeatIndices: number[] = [];
  for (let i = 0; i < newNumberOfCurves; i++) {
    repeatIndices.push(Math.floor((i * currentNum) / newNumberOfCurves));
  }

  // split_factors[k] = how many pieces to split curve k into
  const splitFactors: number[] = new Array(currentNum).fill(0);
  for (const idx of repeatIndices) {
    splitFactors[idx]++;
  }

  // Build new tuples
  const newTuples: number[][][] = [];
  for (let curveIdx = 0; curveIdx < currentNum; curveIdx++) {
    const sf = splitFactors[curveIdx];
    // Extract curve shape [nppc, dim]
    const curveRows: number[][] = [];
    for (let j = 0; j < nppc; j++) {
      const row: number[] = [];
      for (let d = 0; d < dim; d++) {
        row.push(bezierTuples.get([curveIdx, j, d]) as number);
      }
      curveRows.push(row);
    }
    const curveNDArray = np.array(curveRows);
    // Subdivide into sf pieces: result shape [sf*nppc, dim]
    const subdivided = subdivideBezier(curveNDArray, sf);
    // Reshape to sf groups of nppc rows
    for (let s = 0; s < sf; s++) {
      const piece: number[][] = [];
      for (let j = 0; j < nppc; j++) {
        const row: number[] = [];
        for (let d = 0; d < dim; d++) {
          row.push(subdivided.get([s * nppc + j, d]) as number);
        }
        piece.push(row);
      }
      newTuples.push(piece);
    }
  }

  return np.array(newTuples);
}

// ─── Linear Interpolation Variants ───────────────────────────

/**
 * Linearly interpolates between two values start and end.
 * Works for both scalars and NDArrays.
 */
export function interpolate(start: number, end: number, alpha: number): number;
export function interpolate(start: NDArray, end: NDArray, alpha: number): NDArray;
export function interpolate(
  start: number | NDArray,
  end: number | NDArray,
  alpha: number,
): number | NDArray {
  if (typeof start === "number" && typeof end === "number") {
    return (1 - alpha) * start + alpha * end;
  }
  const s = start as NDArray;
  const e = end as NDArray;
  return s.add(e.subtract(s).multiply(alpha));
}

/**
 * Variant of interpolate returning an integer index and residue.
 * Returns [index, residue] where (end-start)*alpha = index + residue.
 */
export function integerInterpolate(
  start: number,
  end: number,
  alpha: number,
): [number, number] {
  if (alpha >= 1) return [Math.floor(end - 1), 1.0];
  if (alpha <= 0) return [Math.floor(start), 0.0];
  const value = Math.floor(interpolate(start, end, alpha) as number);
  const residue = ((end - start) * alpha) % 1;
  return [value, residue];
}

/**
 * Returns the midpoint between two values.
 * Works for both scalars and NDArrays.
 */
export function mid(start: number, end: number): number;
export function mid(start: NDArray, end: NDArray): NDArray;
export function mid(start: number | NDArray, end: number | NDArray): number | NDArray {
  if (typeof start === "number" && typeof end === "number") {
    return (start + end) / 2.0;
  }
  const s = start as NDArray;
  const e = end as NDArray;
  return s.add(e).multiply(0.5);
}

/**
 * Perform inverse interpolation: find alpha such that interpolate(start, end, alpha) ≈ value.
 * Works for both scalars and NDArrays.
 */
export function inverseInterpolate(start: number, end: number, value: number): number;
export function inverseInterpolate(start: NDArray, end: NDArray, value: NDArray): NDArray;
export function inverseInterpolate(
  start: number | NDArray,
  end: number | NDArray,
  value: number | NDArray,
): number | NDArray {
  if (
    typeof start === "number" &&
    typeof end === "number" &&
    typeof value === "number"
  ) {
    if (start === end) return 0;
    return (value - start) / (end - start);
  }
  const s = start as NDArray;
  const e = end as NDArray;
  const v = value as NDArray;
  return v.subtract(s).divide(e.subtract(s));
}

/**
 * Interpolate a value from an old range to a new range.
 * Equivalent to: interpolate(new_start, new_end, inverse_interpolate(old_start, old_end, old_value))
 */
export function matchInterpolate(
  newStart: number,
  newEnd: number,
  oldStart: number,
  oldEnd: number,
  oldValue: number | NDArray,
): number | NDArray {
  if (typeof oldValue === "number") {
    const alpha = inverseInterpolate(oldStart, oldEnd, oldValue) as number;
    return interpolate(newStart, newEnd, alpha) as number;
  }
  const alpha = inverseInterpolate(
    np.array([oldStart]),
    np.array([oldEnd]),
    oldValue as NDArray,
  );
  // alpha is NDArray, multiply to get the range
  return alpha.multiply(newEnd - newStart).add(newStart);
}

// ─── Smooth Cubic Bézier Handle Points ───────────────────────

/**
 * Returns True if the spline given by points is closed (first ≈ last point).
 */
export function isClosed(points: NDArray): boolean {
  const n = points.shape[0];
  const startArr = rowToArray(points, 0);
  const endArr = rowToArray(points, n - 1);
  const rtol = 1e-5;
  const atol = 1e-8;
  const tol0 = atol + rtol * startArr[0];
  if (Math.abs(endArr[0] - startArr[0]) > tol0) return false;
  const tol1 = atol + rtol * startArr[1];
  if (Math.abs(endArr[1] - startArr[1]) > tol1) return false;
  const tol2 = atol + rtol * startArr[2];
  return Math.abs(endArr[2] - startArr[2]) <= tol2;
}

/**
 * Given anchor points for a cubic spline, compute the first and second handles
 * for each curve so the resulting spline is smooth.
 * Returns [H1, H2] each of shape [N, dim].
 */
export function getSmoothCubicBezierHandlePoints(
  anchors: NDArray,
): [NDArray, NDArray] {
  const nAnchors = anchors.shape[0];

  if (nAnchors === 1) {
    const dim = anchors.shape[1];
    return [np.zeros([0, dim]), np.zeros([0, dim])];
  }

  if (nAnchors === 2) {
    const a0 = rowToArray(anchors, 0);
    const a1 = rowToArray(anchors, 1);
    const val0 = a0.map((v, d) => v + (1 / 3) * (a1[d] - v));  // alpha = 1/3
    const val1 = a0.map((v, d) => v + (2 / 3) * (a1[d] - v));  // alpha = 2/3
    return [np.array([val0]), np.array([val1])];
  }

  if (isClosed(anchors)) {
    return getSmoothClosedCubicBezierHandlePoints(anchors);
  }
  return getSmoothOpenCubicBezierHandlePoints(anchors);
}

/**
 * Closed-curve variant of getSmoothCubicBezierHandlePoints.
 * Uses Thomas' algorithm with Sherman-Morrison correction for the cyclic system.
 */
export function getSmoothClosedCubicBezierHandlePoints(
  anchors: NDArray,
): [NDArray, NDArray] {
  const nAnchors = anchors.shape[0];
  const N = nAnchors - 1; // number of curves
  const dim = anchors.shape[1];

  // Extract rows for convenience
  const A: number[][] = [];
  for (let i = 0; i <= N; i++) {
    A.push(rowToArray(anchors, i));
  }

  // ── Forward Substitution 1: compute c' and u' ────────────────
  // These are memoized in CP_CLOSED_MEMO and UP_CLOSED_MEMO.
  const lenMemo = CP_CLOSED_MEMO.length;
  const cp: number[] = new Array(N - 1).fill(0);
  const up: number[] = new Array(N - 1).fill(0);

  if (lenMemo >= N - 1) {
    for (let i = 0; i < N - 1; i++) {
      cp[i] = CP_CLOSED_MEMO[i];
      up[i] = UP_CLOSED_MEMO[i];
    }
  } else {
    for (let i = 0; i < lenMemo; i++) {
      cp[i] = CP_CLOSED_MEMO[i];
      up[i] = UP_CLOSED_MEMO[i];
    }
    for (let i = lenMemo; i < N - 1; i++) {
      cp[i] = 1 / (4 - cp[i - 1]);
      up[i] = -cp[i] * up[i - 1];
    }
    CP_CLOSED_MEMO = [...cp];
    UP_CLOSED_MEMO = [...up];
  }

  // Last element of u' differs
  const cpLastDiv = 1 / (3 - cp[N - 2]);
  const upLast = cpLastDiv * (1 - up[N - 2]);

  // ── Backward Substitution 1: compute q ───────────────────────
  // q shape: (N, dim), but each row has the same scalar in all dims
  // because up is scalar-valued
  const q: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  // q[N-1] = upLast (broadcast scalar)
  for (let d = 0; d < dim; d++) q[N - 1][d] = upLast;
  for (let i = N - 2; i >= 0; i--) {
    for (let d = 0; d < dim; d++) {
      q[i][d] = up[i] - cp[i] * q[i + 1][d];
    }
  }

  // ── Forward Substitution 2: compute D' ───────────────────────
  // AUX[i] = 4*A[i] + 2*A[i+1] for i in 0..N-1
  const Dp: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  const AUX: number[][] = [];
  for (let i = 0; i < N; i++) {
    AUX.push(A[i].map((v, d) => 4 * v + 2 * A[i + 1][d]));
  }

  for (let d = 0; d < dim; d++) Dp[0][d] = AUX[0][d] / 3;
  for (let i = 1; i < N - 1; i++) {
    for (let d = 0; d < dim; d++) {
      Dp[i][d] = cp[i] * (AUX[i][d] - Dp[i - 1][d]);
    }
  }
  for (let d = 0; d < dim; d++) {
    Dp[N - 1][d] = cpLastDiv * (AUX[N - 1][d] - Dp[N - 2][d]);
  }

  // ── Backward Substitution 2: Y = D' ──────────────────────────
  const Y = Dp; // Y is defined as a view of Dp
  for (let i = N - 2; i >= 0; i--) {
    for (let d = 0; d < dim; d++) {
      Y[i][d] = Dp[i][d] - cp[i] * Y[i + 1][d];
    }
  }

  // ── Compute H1 = Y - 1/(1 + q[0] + q[N-1]) * q * (Y[0] + Y[N-1]) ────
  // factor[d] = 1 + q[0][d] + q[N-1][d]
  // Since q rows are scalar-valued (same in all dims), factor is dim-wise
  const H1: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  for (let d = 0; d < dim; d++) {
    const factor = 1 + q[0][d] + q[N - 1][d];
    const sumY = Y[0][d] + Y[N - 1][d];
    const invFactor = factor !== 0 ? 1 / factor : 0;
    for (let i = 0; i < N; i++) {
      H1[i][d] = Y[i][d] - invFactor * q[i][d] * sumY;
    }
  }

  // ── Compute H2 ────────────────────────────────────────────────
  const H2: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  for (let i = 0; i < N - 1; i++) {
    for (let d = 0; d < dim; d++) {
      H2[i][d] = 2 * A[i + 1][d] - H1[i + 1][d];
    }
  }
  for (let d = 0; d < dim; d++) {
    H2[N - 1][d] = 2 * A[N][d] - H1[0][d];
  }

  return [np.array(H1), np.array(H2)];
}

/**
 * Open-curve variant of getSmoothCubicBezierHandlePoints.
 * Uses Thomas' algorithm (tridiagonal matrix algorithm).
 */
export function getSmoothOpenCubicBezierHandlePoints(
  anchors: NDArray,
): [NDArray, NDArray] {
  const nAnchors = anchors.shape[0];
  const N = nAnchors - 1; // number of curves
  const dim = anchors.shape[1];

  // Extract rows
  const A: number[][] = [];
  for (let i = 0; i <= N; i++) {
    A.push(rowToArray(anchors, i));
  }

  // ── Compute c' with memoization ───────────────────────────────
  const lenMemo = CP_OPEN_MEMO.length;
  const cp: number[] = new Array(N - 1).fill(0);

  if (lenMemo >= N - 1) {
    for (let i = 0; i < N - 1; i++) cp[i] = CP_OPEN_MEMO[i];
  } else {
    for (let i = 0; i < lenMemo; i++) cp[i] = CP_OPEN_MEMO[i];
    for (let i = lenMemo; i < N - 1; i++) {
      cp[i] = 1 / (4 - cp[i - 1]);
    }
    CP_OPEN_MEMO = [...cp];
  }

  // ── Compute D' ────────────────────────────────────────────────
  const Dp: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  for (let d = 0; d < dim; d++) {
    Dp[0][d] = 0.5 * A[0][d] + A[1][d];
  }
  for (let i = 1; i < N - 1; i++) {
    for (let d = 0; d < dim; d++) {
      const aux = 4 * A[i][d] + 2 * A[i + 1][d];
      Dp[i][d] = cp[i] * (aux - Dp[i - 1][d]);
    }
  }
  if (N > 1) {
    const lastFactor = 1 / (7 - 2 * cp[N - 2]);
    for (let d = 0; d < dim; d++) {
      Dp[N - 1][d] = lastFactor * (8 * A[N - 1][d] + A[N][d] - 2 * Dp[N - 2][d]);
    }
  }

  // ── Backward Substitution → H1 ────────────────────────────────
  const H1 = Dp; // H1 is a view of Dp
  for (let i = N - 2; i >= 0; i--) {
    for (let d = 0; d < dim; d++) {
      H1[i][d] = Dp[i][d] - cp[i] * H1[i + 1][d];
    }
  }

  // ── Compute H2 ────────────────────────────────────────────────
  const H2: number[][] = new Array(N).fill(null).map(() => new Array(dim).fill(0));
  for (let i = 0; i < N - 1; i++) {
    for (let d = 0; d < dim; d++) {
      H2[i][d] = 2 * A[i + 1][d] - H1[i + 1][d];
    }
  }
  if (N > 0) {
    for (let d = 0; d < dim; d++) {
      H2[N - 1][d] = 0.5 * (A[N][d] + H1[N - 1][d]);
    }
  }

  return [np.array(H1), np.array(H2)];
}

/**
 * Approximate a cubic Bézier with two quadratic Béziers.
 * Given control points a0, h0, h1, a1 of a cubic, returns 6 points (or 6N
 * points for N-curve batch input) defining two quadratic curves per cubic.
 */
export function getQuadraticApproximationOfCubic(
  a0: NDArray,
  h0: NDArray,
  h1: NDArray,
  a1: NDArray,
): NDArray {
  const is1D = a0.ndim === 1;

  if (is1D) {
    // m0 = 0.25*(3*h0 + a0), m1 = 0.25*(3*h1 + a1), k = 0.5*(m0 + m1)
    const a0a = a0.toArray() as number[];
    const h0a = h0.toArray() as number[];
    const h1a = h1.toArray() as number[];
    const a1a = a1.toArray() as number[];
    const m0 = a0a.map((v, d) => 0.25 * (3 * h0a[d] + v));
    const m1 = a1a.map((v, d) => 0.25 * (3 * h1a[d] + v));
    const k = m0.map((v, d) => 0.5 * (v + m1[d]));
    return np.array([a0a, m0, k, k, m1, a1a]);
  }

  // Batched: a0, h0, h1, a1 each shape [N, dim]
  const N = a0.shape[0];
  const m0 = a0.multiply(0.25).add(h0.multiply(0.75));
  const m1 = a1.multiply(0.25).add(h1.multiply(0.75));
  const k = m0.add(m1).multiply(0.5);

  const rows: number[][] = [];
  for (let i = 0; i < N; i++) {
    rows.push(rowToArray(a0, i));
    rows.push(rowToArray(m0, i));
    rows.push(rowToArray(k, i));
    rows.push(rowToArray(k, i));
    rows.push(rowToArray(m1, i));
    rows.push(rowToArray(a1, i));
  }
  return np.array(rows);
}

/**
 * Obtains the proportions t ∈ [0, 1] along the bezier curve at which the
 * given point lies, by solving the bezier polynomial per dimension.
 */
export function proportionsAlongBezierCurveForPoint(
  point: NDArray,
  controlPoints: NDArray,
  roundTo = 1e-6,
): number[] {
  const pointArr = point.toArray() as number[];
  const nCp = controlPoints.shape[0];
  const n = nCp - 1;

  let commonRoots: number[] | null = null;

  for (let dim = 0; dim < 3; dim++) {
    const coord = pointArr[dim];
    const controlCoords: number[] = [];
    for (let k = 0; k < nCp; k++) {
      controlCoords.push(controlPoints.get([k, dim]) as number);
    }

    const coeffs = bezierPolyCoeffs(controlCoords, coord);

    // If all coefficients are zero, this dimension is degenerate — skip
    if (coeffs.every(c => Math.abs(c) < 1e-12)) continue;

    const roots = findRealRootsInUnit(coeffs, roundTo);

    if (commonRoots === null) {
      commonRoots = roots;
    } else {
      commonRoots = intersect1d(commonRoots, roots, roundTo * 10);
    }

    if (commonRoots.length === 0) break;
  }

  return commonRoots ?? [];
}

/**
 * Checks if the given point lies on the bezier curve with the given control points.
 */
export function pointLiesOnBezier(
  point: NDArray,
  controlPoints: NDArray,
  roundTo = 1e-6,
): boolean {
  const roots = proportionsAlongBezierCurveForPoint(point, controlPoints, roundTo);
  return roots.length > 0;
}
