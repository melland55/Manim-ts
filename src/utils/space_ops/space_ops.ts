/**
 * Utility functions for two- and three-dimensional vectors.
 *
 * TypeScript port of manim/utils/space_ops.py
 */

import { np, linalg } from "../../core/math/index.js";
import type { NDArray } from "../../core/math/index.js";
import { trapezoid } from "numpy-ts";
import { DOWN, OUT, PI, RIGHT, TAU, UP } from "../../core/math/index.js";
import { adjacentPairs } from "../iterables/index.js";
import earcut from "earcut";

// ─── Type aliases ────────────────────────────────────────────

type Point3D = NDArray;
type Points3D = NDArray;
type Vector3D = NDArray;
type Vector2D = NDArray;
type Quaternion = [number, number, number, number]; // [w, x, y, z]

// ─── Internal helpers ────────────────────────────────────────

function normSquared(v: NDArray): number {
  return np.dot(v, v) as number;
}

function cross3d(v1: NDArray, v2: NDArray): NDArray {
  const a = v1.toArray() as number[];
  const b = v2.toArray() as number[];
  return np.array([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]);
}

// ─── Quaternions ─────────────────────────────────────────────

/**
 * Gets the Hamilton product of the quaternions provided.
 * Each quaternion is [w, x, y, z].
 */
export function quaternionMult(
  ...quats: Array<[number, number, number, number] | number[]>
): [number, number, number, number] {
  if (quats.length === 0) return [1, 0, 0, 0];
  let result: [number, number, number, number] = [
    quats[0][0],
    quats[0][1],
    quats[0][2],
    quats[0][3],
  ];
  for (let i = 1; i < quats.length; i++) {
    const [w1, x1, y1, z1] = result;
    const [w2, x2, y2, z2] = quats[i];
    result = [
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
      w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2,
      w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2,
    ];
  }
  return result;
}

/**
 * Gets a quaternion from an angle and an axis.
 * Returns [w, x, y, z].
 */
export function quaternionFromAngleAxis(
  angle: number,
  axis: NDArray,
  axisNormalized = false,
): [number, number, number, number] {
  const normAxis = axisNormalized ? axis : normalize(axis);
  const arr = normAxis.toArray() as number[];
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), arr[0] * s, arr[1] * s, arr[2] * s];
}

/**
 * Gets angle and axis from a quaternion [w, x, y, z].
 * Returns [angle, axis].
 */
export function angleAxisFromQuaternion(
  quaternion: [number, number, number, number] | number[],
): [number, NDArray] {
  const [w, x, y, z] = quaternion;
  const axisArr = np.array([x, y, z]);
  const axis = normalize(axisArr, np.array([1, 0, 0]));
  let angle = 2 * Math.acos(Math.min(1, Math.max(-1, w)));
  if (angle > TAU / 2) {
    angle = TAU - angle;
  }
  return [angle, axis];
}

/**
 * Returns the conjugate of the quaternion [w, x, y, z].
 */
export function quaternionConjugate(
  quaternion: [number, number, number, number] | number[],
): [number, number, number, number] {
  return [quaternion[0], -quaternion[1], -quaternion[2], -quaternion[3]];
}

// ─── Rotation ────────────────────────────────────────────────

/**
 * Rotates a vector by the given angle around the given axis.
 */
export function rotateVector(
  vector: NDArray,
  angle: number,
  axis: NDArray = OUT,
): NDArray {
  const arr = vector.toArray() as number[];
  if (arr.length > 3) {
    throw new Error("Vector must have the correct dimensions.");
  }
  let v = vector;
  if (arr.length === 2) {
    v = np.array([arr[0], arr[1], 0]);
  }
  const R = rotationMatrix(angle, axis);
  return applyRotationMatrix(R, v);
}

/**
 * Returns a band-diagonal matrix with 1s within `thickness` of the diagonal.
 */
export function thickDiagonal(dim: number, thickness = 2): NDArray {
  const result: number[][] = [];
  for (let i = 0; i < dim; i++) {
    const row: number[] = [];
    for (let j = 0; j < dim; j++) {
      row.push(Math.abs(i - j) < thickness ? 1 : 0);
    }
    result.push(row);
  }
  return np.array(result);
}

function rotationMatrixTransposeFromQuaternion(
  quat: [number, number, number, number],
): NDArray[] {
  const quatInv = quaternionConjugate(quat);
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((basis) => {
    const basisQuat: [number, number, number, number] = [0, basis[0], basis[1], basis[2]];
    const result = quaternionMult(quat, basisQuat, quatInv);
    return np.array([result[1], result[2], result[3]]);
  });
}

function rotationMatrixFromQuaternion(quat: [number, number, number, number]): NDArray {
  const cols = rotationMatrixTransposeFromQuaternion(quat);
  // Build 3x3 matrix: cols[j][i] is element [i,j]
  const data: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const row: number[] = [];
    for (let j = 0; j < 3; j++) {
      row.push(cols[j].get([i]) as number);
    }
    data.push(row);
  }
  return np.array(data);
}

/**
 * Rotation matrix in R^3 about a specified axis.
 * Returns a 3x3 NDArray (or 4x4 if homogeneous=true).
 */
export function rotationMatrix(
  angle: number,
  axis: NDArray,
  homogeneous = false,
): NDArray {
  // Rodrigues' rotation formula
  const normAxis = normalize(axis);
  const arr = normAxis.toArray() as number[];
  const [ux, uy, uz] = arr;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  const mat3 = np.array([
    [t * ux * ux + c,      t * ux * uy - s * uz, t * ux * uz + s * uy],
    [t * uy * ux + s * uz, t * uy * uy + c,      t * uy * uz - s * ux],
    [t * uz * ux - s * uy, t * uz * uy + s * ux, t * uz * uz + c],
  ]);

  if (!homogeneous) {
    return mat3;
  }

  const mat4 = np.eye(4);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      mat4.set([i, j], mat3.get([i, j]) as number);
    }
  }
  return mat4;
}

/**
 * Returns a rotation matrix for a rotation about the z-axis.
 */
export function rotationAboutZ(angle: number): NDArray {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return np.array([
    [c, -s, 0],
    [s,  c, 0],
    [0,  0, 1],
  ]);
}

/**
 * Returns a matrix in SO(3) which takes the z-axis to the (normalized) vector.
 */
export function zToVector(vector: NDArray): NDArray {
  const axisZ = normalize(vector);
  let axisY = normalize(cross3d(axisZ, RIGHT));
  let axisX = cross3d(axisY, axisZ);
  if ((linalg.norm(axisY) as number) === 0) {
    axisX = normalize(cross3d(UP, axisZ));
    const negCross = cross3d(axisX, axisZ);
    axisY = negCross.multiply(-1);
  }
  // Stack as columns: [axisX, axisY, axisZ].T
  const ax = axisX.toArray() as number[];
  const ay = axisY.toArray() as number[];
  const az = axisZ.toArray() as number[];
  return np.array([
    [ax[0], ay[0], az[0]],
    [ax[1], ay[1], az[1]],
    [ax[2], ay[2], az[2]],
  ]);
}

// ─── Angle operations ────────────────────────────────────────

/**
 * Returns polar coordinate theta when vector is projected on xy plane.
 * For a 2D array of shape [2, n], processes all columns.
 */
export function angleOfVector(vector: NDArray): number | NDArray {
  if (vector.ndim > 1) {
    if (vector.shape[0] < 2) {
      throw new Error("Vector must have the correct dimensions. (2, n)");
    }
    const n = vector.shape[1];
    const angles: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = vector.get([0, i]) as number;
      const y = vector.get([1, i]) as number;
      angles.push(Math.atan2(y, x));
    }
    return np.array(angles);
  }
  const arr = vector.toArray() as number[];
  return Math.atan2(arr[1], arr[0]);
}

/**
 * Returns the angle between two vectors (always in [0, pi]).
 */
export function angleBetweenVectors(v1: NDArray, v2: NDArray): number {
  const n1 = normalize(v1);
  const n2 = normalize(v2);
  return 2 * Math.atan2(
    linalg.norm(n1.subtract(n2)) as number,
    linalg.norm(n1.add(n2)) as number,
  );
}

// ─── Normalization ───────────────────────────────────────────

/**
 * Normalizes a vector to unit length. Returns fallback (or zero vector) if norm is zero.
 */
export function normalize(
  vect: NDArray,
  fallBack: NDArray | null = null,
): NDArray {
  const norm = linalg.norm(vect) as number;
  if (norm > 0) {
    return vect.divide(norm);
  }
  if (fallBack !== null) return fallBack;
  const arr = vect.toArray() as number[];
  return np.zeros([arr.length]);
}

/**
 * Normalizes an array along the specified axis (0 or 1).
 */
export function normalizeAlongAxis(array: NDArray, axis: number): NDArray {
  const data = array.toArray() as number[][];
  const rows = array.shape[0];
  const cols = array.shape[1];

  if (axis === 1) {
    // Normalize each row
    for (let i = 0; i < rows; i++) {
      let norm = 0;
      for (let j = 0; j < cols; j++) {
        norm += data[i][j] * data[i][j];
      }
      norm = Math.sqrt(norm);
      if (norm === 0) norm = 1;
      for (let j = 0; j < cols; j++) {
        data[i][j] /= norm;
      }
    }
  } else {
    // Normalize each column (axis=0)
    for (let j = 0; j < cols; j++) {
      let norm = 0;
      for (let i = 0; i < rows; i++) {
        norm += data[i][j] * data[i][j];
      }
      norm = Math.sqrt(norm);
      if (norm === 0) norm = 1;
      for (let i = 0; i < rows; i++) {
        data[i][j] /= norm;
      }
    }
  }
  return np.array(data);
}

/**
 * Gets the unit normal of two vectors.
 */
export function getUnitNormal(v1: NDArray, v2: NDArray, tol = 1e-6): NDArray {
  const np_v1 = v1.toArray() as number[];
  const np_v2 = v2.toArray() as number[];

  const div1 = Math.max(...np_v1.map(Math.abs));
  const div2 = Math.max(...np_v2.map(Math.abs));

  let u: NDArray;

  if (div1 === 0.0) {
    if (div2 === 0.0) {
      return np.array([...DOWN.toArray() as number[]]);
    }
    u = np.array(np_v2).divide(div2);
  } else if (div2 === 0.0) {
    u = np.array(np_v1).divide(div1);
  } else {
    const u1 = np.array(np_v1).divide(div1);
    const u2 = np.array(np_v2).divide(div2);
    const cp = cross3d(u1, u2);
    const cpNorm = Math.sqrt(normSquared(cp));
    if (cpNorm > tol) {
      return cp.divide(cpNorm);
    }
    u = u1;
  }

  const ua = u.toArray() as number[];
  if (Math.abs(ua[0]) < tol && Math.abs(ua[1]) < tol) {
    return np.array([...(DOWN.toArray() as number[])]);
  }

  const cp = np.array([
    -ua[0] * ua[2],
    -ua[1] * ua[2],
    ua[0] * ua[0] + ua[1] * ua[1],
  ]);
  const cpNorm = Math.sqrt(normSquared(cp));
  return cp.divide(cpNorm);
}

// ─── Compass / vertices ──────────────────────────────────────

/**
 * Finds n evenly-spaced directions around the unit circle, starting from startVect.
 */
export function compassDirections(n = 4, startVect: NDArray = RIGHT): NDArray {
  const angle = TAU / n;
  const dirs: NDArray[] = [];
  for (let k = 0; k < n; k++) {
    dirs.push(rotateVector(startVect, k * angle) as NDArray);
  }
  return np.vstack(dirs);
}

/**
 * Generates n regularly spaced vertices around a circle of given radius.
 * Returns [vertices, startAngle].
 */
export function regularVertices(
  n: number,
  options: { radius?: number; startAngle?: number | null } = {},
): [NDArray, number] {
  const radius = options.radius ?? 1;
  let startAngle = options.startAngle ?? null;
  if (startAngle === null) {
    startAngle = n % 2 === 0 ? 0 : TAU / 4;
  }
  const startVector = rotateVector(RIGHT.multiply(radius), startAngle) as NDArray;
  const vertices = compassDirections(n, startVector);
  return [vertices, startAngle];
}

// ─── Complex ─────────────────────────────────────────────────

/**
 * Converts a complex number to an R3 point [real, imag, 0].
 */
export function complexToR3(complexNum: { real: number; imag: number } | [number, number]): NDArray {
  if (Array.isArray(complexNum)) {
    return np.array([complexNum[0], complexNum[1], 0]);
  }
  return np.array([complexNum.real, complexNum.imag, 0]);
}

/**
 * Converts an R3 point to a complex number [real, imag].
 */
export function r3ToComplex(point: NDArray): [number, number] {
  const arr = point.toArray() as number[];
  return [arr[0], arr[1]];
}

/**
 * Lifts a complex function to an R3 → R3 function.
 */
export function complexFuncToR3Func(
  complexFunc: (z: [number, number]) => [number, number],
): (p: NDArray) => NDArray {
  return (p: NDArray) => complexToR3(complexFunc(r3ToComplex(p)));
}

// ─── Center / midpoint ───────────────────────────────────────

/**
 * Gets the center of mass of an array of points.
 */
export function centerOfMass(points: NDArray): NDArray {
  const n = points.shape[0];
  return np.mean(points, 0) as NDArray;
}

/**
 * Gets the midpoint of two points.
 */
export function midpoint(point1: NDArray, point2: NDArray): NDArray {
  return centerOfMass(np.vstack([point1.reshape(1, -1), point2.reshape(1, -1)]));
}

// ─── Intersection ────────────────────────────────────────────

/**
 * Returns the intersection of two lines in the xy-plane, each defined
 * by two distinct points.
 */
export function lineIntersection(
  line1: [NDArray, NDArray],
  line2: [NDArray, NDArray],
): NDArray {
  // Check for z != 0
  const allPoints = [line1[0], line1[1], line2[0], line2[1]];
  for (const p of allPoints) {
    const arr = p.toArray() as number[];
    if (arr.length > 2 && arr[2] !== 0) {
      throw new Error("Coords must be in the xy-plane.");
    }
  }

  // Represent each line as a homogeneous 3-vector via cross product of padded points
  const pad = (p: NDArray): [number, number, number] => {
    const arr = p.toArray() as number[];
    return [arr[0], arr[1], 1];
  };

  const crossVec = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  const l1 = crossVec(pad(line1[0]), pad(line1[1]));
  const l2 = crossVec(pad(line2[0]), pad(line2[1]));
  const [x, y, z] = crossVec(l1, l2);

  if (z === 0) {
    throw new Error("The lines are parallel, there is no unique intersection point.");
  }

  return np.array([x / z, y / z, 0]);
}

/**
 * Returns the intersections of lines through p0s in directions v0s
 * with lines through p1s in directions v1s.
 * For 3D, returns the closest point on the first ray to the second.
 */
export function findIntersection(
  p0s: NDArray[],
  v0s: NDArray[],
  p1s: NDArray[],
  v1s: NDArray[],
  threshold = 1e-5,
): NDArray[] {
  const result: NDArray[] = [];
  const len = Math.min(p0s.length, v0s.length, p1s.length, v1s.length);
  for (let i = 0; i < len; i++) {
    const p0 = p0s[i], v0 = v0s[i], p1 = p1s[i], v1 = v1s[i];
    const normal = cross3d(v1, cross3d(v0, v1));
    const denom = Math.max(np.dot(v0, normal) as number, threshold);
    const t = (np.dot(p1.subtract(p0), normal) as number) / denom;
    result.push(p0.add(v0.multiply(t)));
  }
  return result;
}

// ─── Winding number ──────────────────────────────────────────

/**
 * Determine the number of times a polygon winds around the origin.
 * The orientation is measured mathematically positively (counterclockwise).
 */
export function getWindingNumber(points: NDArray[]): number {
  let totalAngle = 0;
  for (const [p1, p2] of adjacentPairs(points)) {
    const a1 = angleOfVector(p1) as number;
    const a2 = angleOfVector(p2) as number;
    let dAngle = a2 - a1;
    // Use Python-style modulo (always non-negative) to normalize angle
    dAngle = (((dAngle + PI) % TAU) + TAU) % TAU - PI;
    totalAngle += dAngle;
  }
  return totalAngle / TAU;
}

// ─── Shoelace ────────────────────────────────────────────────

/**
 * 2D implementation of the shoelace formula. Returns signed area.
 */
export function shoelace(xy: NDArray): number {
  const x = getColumn(xy, 0);
  const y = getColumn(xy, 1);
  return trapezoid(y, x) as unknown as number;
}

/**
 * Uses the shoelace area to determine if points are CW or CCW.
 */
export function shoelaceDirection(xy: NDArray): "CW" | "CCW" {
  const area = shoelace(xy);
  return area > 0 ? "CW" : "CCW";
}

// ─── Cross 2D ────────────────────────────────────────────────

/**
 * Compute the 2D cross product (determinant) of the first two components
 * of vectors a and b. Handles both single vectors and arrays of vectors.
 */
export function cross2d(a: NDArray, b: NDArray): number | NDArray {
  if (a.ndim === 2) {
    const n = a.shape[0];
    const result: number[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = a.get([i, 0]) as number;
      const a1 = a.get([i, 1]) as number;
      const b0 = b.get([i, 0]) as number;
      const b1 = b.get([i, 1]) as number;
      result.push(a0 * b1 - a1 * b0);
    }
    return np.array(result);
  }
  const a0 = a.get([0]) as number;
  const a1 = a.get([1]) as number;
  const b0 = b.get([0]) as number;
  const b1 = b.get([1]) as number;
  return a0 * b1 - b0 * a1;
}

// ─── Earclip triangulation ───────────────────────────────────

/**
 * Returns a list of indices giving a triangulation of a polygon,
 * potentially with holes.
 *
 * @param verts - NDArray of points (shape [n, 2] or [n, 3])
 * @param ringEnds - list of indices where ring ends are
 */
export function earclipTriangulation(verts: NDArray, ringEnds: number[]): number[] {
  const vertsArr = verts.toArray() as number[][];
  const n = vertsArr.length;

  // Build rings
  const rings: number[][] = [];
  let prev = 0;
  for (const end of ringEnds) {
    const ring: number[] = [];
    for (let i = prev; i < end; i++) ring.push(i);
    rings.push(ring);
    prev = end;
  }

  const attachedRings = [rings[0]];
  const detachedRings = rings.slice(1);
  const loopConnections: Map<number, number> = new Map();

  while (detachedRings.length > 0) {
    const allAttached = attachedRings.flat().filter(i => !loopConnections.has(i));
    const allDetached = detachedRings.flat().filter(i => !loopConnections.has(i));

    // Estimate midpoint of detached rings
    const j0 = allDetached[0];
    const jMid = allDetached[Math.floor(allDetached.length / 2)];
    const tmpJVert = midpointArr(vertsArr[j0], vertsArr[jMid]);

    // Closest point on attached rings to tmpJVert
    let i = allAttached.reduce((best, idx) =>
      normSquaredArr(subtractArr(vertsArr[idx], tmpJVert)) <
      normSquaredArr(subtractArr(vertsArr[best], tmpJVert)) ? idx : best
    );

    // Closest point on detached rings to i
    let j = allDetached.reduce((best, idx) =>
      normSquaredArr(subtractArr(vertsArr[i], vertsArr[idx])) <
      normSquaredArr(subtractArr(vertsArr[i], vertsArr[best])) ? idx : best
    );

    // Recalculate i based on j
    i = allAttached.reduce((best, idx) =>
      normSquaredArr(subtractArr(vertsArr[idx], vertsArr[j])) <
      normSquaredArr(subtractArr(vertsArr[best], vertsArr[j])) ? idx : best
    );

    loopConnections.set(i, j);
    loopConnections.set(j, i);

    const jRingIdx = detachedRings.findIndex(
      ring => ring.length > 0 && ring[0] <= j && j < ring[ring.length - 1]
    );
    if (jRingIdx === -1) {
      throw new Error("Could not find a ring to attach");
    }
    const newRing = detachedRings.splice(jRingIdx, 1)[0];
    attachedRings.push(newRing);
  }

  // Setup linked list (next index in ring)
  const after: number[] = new Array(n).fill(0);
  let end0 = 0;
  for (const end1 of ringEnds) {
    for (let i = end0; i < end1 - 1; i++) {
      after[i] = i + 1;
    }
    after[end1 - 1] = end0;
    end0 = end1;
  }

  // Walk around the polygon collecting indices
  const indices: number[] = [];
  let idx = 0;
  const totalSteps = n + ringEnds.length - 1;
  for (let step = 0; step < totalSteps; step++) {
    if (loopConnections.has(idx)) {
      const jIdx = loopConnections.get(idx)!;
      indices.push(idx, jIdx);
      idx = after[jIdx];
    } else {
      indices.push(idx);
      idx = after[idx];
    }
    if (idx === 0) break;
  }

  // Extract 2D coords for earcut
  const coords2d: number[] = [];
  for (const vi of indices) {
    coords2d.push(vertsArr[vi][0], vertsArr[vi][1]);
  }
  const holeIndices = indices.length > 0 ? [indices.length] : undefined;

  const metaIndices = earcut(coords2d, holeIndices);
  return metaIndices.map(mi => indices[mi]);
}

// ─── Spherical coordinates ───────────────────────────────────

/**
 * Returns [r, theta, phi] from a Cartesian vector [x, y, z].
 * r = distance, theta = azimuth (arctan2(y, x)), phi = polar angle (arccos(z/r)).
 */
export function cartesianToSpherical(vec: NDArray): NDArray {
  const norm = linalg.norm(vec) as number;
  if (norm === 0) return np.zeros([3]);
  const arr = vec.toArray() as number[];
  const r = norm;
  const phi = Math.acos(Math.min(1, Math.max(-1, arr[2] / r)));
  const theta = Math.atan2(arr[1], arr[0]);
  return np.array([r, theta, phi]);
}

/**
 * Returns [x, y, z] from spherical coordinates [r, theta, phi].
 */
export function sphericalToCartesian(spherical: NDArray | [number, number, number]): NDArray {
  const arr = Array.isArray(spherical)
    ? spherical
    : (spherical.toArray() as number[]);
  const [r, theta, phi] = arr;
  return np.array([
    r * Math.cos(theta) * Math.sin(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(phi),
  ]);
}

// ─── Perpendicular bisector ──────────────────────────────────

/**
 * Returns two points that are the ends of the perpendicular bisector
 * of the two points in `line`.
 */
export function perpendicularBisector(
  line: [NDArray, NDArray],
  normVector: NDArray = OUT,
): [NDArray, NDArray] {
  const [p1, p2] = line;
  const direction = cross3d(p1.subtract(p2), normVector);
  const m = midpoint(p1, p2);
  return [m.add(direction), m.subtract(direction)];
}

// ─── Private array helpers ───────────────────────────────────

function getColumn(arr: NDArray, col: number): NDArray {
  const n = arr.shape[0];
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(arr.get([i, col]) as number);
  }
  return np.array(result);
}

function midpointArr(a: number[], b: number[]): number[] {
  return a.map((v, i) => (v + b[i]) / 2);
}

function subtractArr(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function normSquaredArr(v: number[]): number {
  return v.reduce((sum, x) => sum + x * x, 0);
}

/** Apply a 3x3 NDArray rotation matrix to a 3D vector. */
function applyRotationMatrix(R: NDArray, v: NDArray): NDArray {
  const arr = v.toArray() as number[];
  const result: number[] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result[i] += (R.get([i, j]) as number) * arr[j];
    }
  }
  return np.array(result);
}
