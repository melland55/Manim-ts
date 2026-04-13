/**
 * Functions determining transformation paths between sets of points.
 *
 * Python: manim/utils/paths.py
 */

import type { NDArray } from "numpy-ts";
import {
  np,
  OUT,
  rotationMatrix,
  applyMatrixToPoints,
} from "../../core/math/index.js";
import type { Points3D, Point3D } from "../../core/math/index.js";

// ─── Types ────────────────────────────────────────────────────

/**
 * A function that, given start/end point arrays and an alpha in [0,1],
 * returns the intermediate point array.
 *
 * Python: manim.typing.PathFuncType
 */
export type PathFuncType = (
  startPoints: Points3D,
  endPoints: Points3D,
  alpha: number
) => Points3D;

// ─── Internal constants ───────────────────────────────────────

const STRAIGHT_PATH_THRESHOLD = 0.01;

// ─── Helpers ─────────────────────────────────────────────────

/** Normalize a vector; return fallback when the norm is zero. */
function normalizeWithFallback(v: Point3D, fallback: Point3D = OUT): Point3D {
  const len = np.linalg.norm(v) as number;
  if (len < 1e-10) return np.array([...(fallback.toArray() as number[])]);
  return v.divide(len);
}

/**
 * Compute cross(u, v_i) for each row v_i of a Points3D matrix.
 * numpy-ts does not support broadcasting [3] × [n,3] in np.cross,
 * so we compute it row-by-row.
 *
 * Equivalent to Python's: np.cross(u, vects)  (with u shape [3], vects shape [n,3])
 */
function crossVecPoints(u: Point3D, vects: Points3D): Points3D {
  const ua = u.toArray() as number[];
  const ux = ua[0], uy = ua[1], uz = ua[2];
  const n = vects.shape[0];
  const result: number[][] = [];
  for (let i = 0; i < n; i++) {
    const v = vects.row(i).toArray() as number[];
    result.push([
      uy * v[2] - uz * v[1],
      uz * v[0] - ux * v[2],
      ux * v[1] - uy * v[0],
    ]);
  }
  return np.array(result) as Points3D;
}

/**
 * Element-wise linear interpolation between two Points3D arrays.
 * Equivalent to Python's `interpolate(start, end, alpha)` from utils.bezier,
 * which operates element-wise on numpy arrays.
 */
function interpolatePoints(
  start: Points3D,
  end: Points3D,
  alpha: number
): Points3D {
  return start.multiply(1 - alpha).add(end.multiply(alpha)) as Points3D;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Simplest path function. Each point in a set goes in a straight path
 * toward its destination.
 *
 * Python: straight_path()
 */
export function straightPath(): PathFuncType {
  return (
    startPoints: Points3D,
    endPoints: Points3D,
    alpha: number
  ): Points3D => interpolatePoints(startPoints, endPoints, alpha);
}

/**
 * Transforms each point by moving it roughly along a circle, each with
 * its own specified center. The path may be seen as each point smoothly
 * changing its orbit from its starting position to its destination.
 *
 * Python: path_along_circles(arc_angle, circles_centers, axis=OUT)
 *
 * @param arcAngle  The angle each point traverses around its quasicircle.
 * @param circlesCenters  The center(s) of each point's quasicircle. May be
 *   a single Point3D [3] (broadcast to all points) or Points3D [n,3].
 * @param axis  The axis of rotation.
 */
export function pathAlongCircles(
  arcAngle: number,
  circlesCenters: NDArray,
  axis: Point3D = OUT
): PathFuncType {
  const unitAxis = normalizeWithFallback(axis, OUT);

  return (
    startPoints: Points3D,
    endPoints: Points3D,
    alpha: number
  ): Points3D => {
    // Reverse-rotate end points back to "un-arc" them so interpolation
    // happens in the rotated frame.
    const rotMatNeg = rotationMatrix(-arcAngle, unitAxis);
    const endDisplaced = endPoints.subtract(circlesCenters) as Points3D;
    const detransformedEnd = circlesCenters.add(
      applyMatrixToPoints(rotMatNeg, endDisplaced)
    ) as Points3D;

    // Interpolate in the original frame, then apply forward rotation.
    const rotMat = rotationMatrix(alpha * arcAngle, unitAxis);
    const interpolated = interpolatePoints(startPoints, detransformedEnd, alpha);
    const interpDisplaced = interpolated.subtract(circlesCenters) as Points3D;
    return circlesCenters.add(
      applyMatrixToPoints(rotMat, interpDisplaced)
    ) as Points3D;
  };
}

/**
 * Transforms each point by moving it along a circular arc.
 *
 * Python: path_along_arc(arc_angle, axis=OUT)
 *
 * @param arcAngle  The angle each point traverses around a circular arc.
 * @param axis  The axis of rotation.
 */
export function pathAlongArc(
  arcAngle: number,
  axis: Point3D = OUT
): PathFuncType {
  if (Math.abs(arcAngle) < STRAIGHT_PATH_THRESHOLD) {
    return straightPath();
  }
  const unitAxis = normalizeWithFallback(axis, OUT);

  return (
    startPoints: Points3D,
    endPoints: Points3D,
    alpha: number
  ): Points3D => {
    const vects = endPoints.subtract(startPoints) as Points3D;
    let centers = startPoints.add(vects.multiply(0.5)) as Points3D;

    // When arc_angle == PI the correction term diverges (tan(PI/2) → ∞),
    // so skip it — the midpoints are already the correct arc centers.
    if (arcAngle !== Math.PI) {
      const tanHalf = Math.tan(arcAngle / 2);
      // cross(unitAxis, vects / 2) for each row of vects
      const halfVects = vects.divide(2) as Points3D;
      const crossed = crossVecPoints(unitAxis, halfVects);
      centers = centers.add(crossed.divide(tanHalf)) as Points3D;
    }

    const rotMat = rotationMatrix(alpha * arcAngle, unitAxis);
    const displaced = startPoints.subtract(centers) as Points3D;
    return centers.add(applyMatrixToPoints(rotMat, displaced)) as Points3D;
  };
}

/**
 * Transforms each point by moving clockwise around a half circle.
 *
 * Python: clockwise_path()
 */
export function clockwisePath(): PathFuncType {
  return pathAlongArc(-Math.PI);
}

/**
 * Transforms each point by moving counterclockwise around a half circle.
 *
 * Python: counterclockwise_path()
 */
export function counterclockwisePath(): PathFuncType {
  return pathAlongArc(Math.PI);
}

/**
 * Transforms each point by moving along a spiral to its destination.
 *
 * Python: spiral_path(angle, axis=OUT)
 *
 * @param angle  The angle each point traverses around a spiral.
 * @param axis   The axis of rotation.
 */
export function spiralPath(angle: number, axis: Point3D = OUT): PathFuncType {
  if (Math.abs(angle) < STRAIGHT_PATH_THRESHOLD) {
    return straightPath();
  }
  const unitAxis = normalizeWithFallback(axis, OUT);

  return (
    startPoints: Points3D,
    endPoints: Points3D,
    alpha: number
  ): Points3D => {
    // Python: start_points + alpha * np.dot(end_points - start_points, rot_matrix.T)
    // where rot_matrix = rotation_matrix((alpha - 1) * angle, unit_axis)
    const rotMat = rotationMatrix((alpha - 1) * angle, unitAxis);
    const diff = endPoints.subtract(startPoints) as Points3D;
    return startPoints.add(
      applyMatrixToPoints(rotMat, diff).multiply(alpha)
    ) as Points3D;
  };
}
