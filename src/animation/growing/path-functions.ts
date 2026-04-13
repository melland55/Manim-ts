/**
 * Path functions for Transform-based animations.
 *
 * A PathFunc interpolates between two arrays of 3D points given a progress
 * value alpha ∈ [0, 1]. These are used by Transform and its subclasses to
 * control the trajectory each point takes when morphing between states.
 *
 * Python: manim.utils.paths (straight_path, spiral_path)
 */

import {
  np,
  OUT,
  rotationMatrix,
  applyMatrixToPoints,
  normalizePoint,
} from "../../core/math/index.js";
import type { Points3D, Point3D } from "../../core/math/index.js";

/**
 * A function that interpolates between two sets of 3D points.
 * Python: manim.typing.PathFuncType
 */
export type PathFunc = (
  startPoints: Points3D,
  endPoints: Points3D,
  alpha: number
) => Points3D;

const STRAIGHT_PATH_THRESHOLD = 0.01;

/**
 * Straight-line path: each point travels directly to its destination.
 * Python: manim.utils.paths.straight_path
 */
export function straightPath(): PathFunc {
  return (startPoints: Points3D, endPoints: Points3D, alpha: number): Points3D => {
    // start + alpha * (end - start)
    return startPoints.add(endPoints.subtract(startPoints).multiply(alpha));
  };
}

/**
 * Spiral path: each point travels along a spiral toward its destination.
 * Points rotate around the given axis while linearly advancing toward target.
 *
 * Python: manim.utils.paths.spiral_path
 */
export function spiralPath(angle: number, axis: Point3D = OUT): PathFunc {
  if (Math.abs(angle) < STRAIGHT_PATH_THRESHOLD) {
    return straightPath();
  }

  const unitAxis = normalizePoint(axis);

  return (startPoints: Points3D, endPoints: Points3D, alpha: number): Points3D => {
    // rot_matrix = rotation_matrix((alpha - 1) * angle, unit_axis)
    // result = start_points + alpha * dot(end_points - start_points, rot_matrix.T)
    // (For column-vector convention via applyMatrixToPoints, rot.T ≡ rot with negated angle)
    const rotMat = rotationMatrix((alpha - 1) * angle, unitAxis);
    const diff = endPoints.subtract(startPoints);
    const rotatedDiff = applyMatrixToPoints(rotMat, diff);
    return startPoints.add(rotatedDiff.multiply(alpha));
  };
}
