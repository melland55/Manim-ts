/**
 * Utility functions for three-dimensional mobjects.
 *
 * TypeScript port of manim/mobject/three_d/three_d_utils.py
 */

import { np, ORIGIN, UP } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { getUnitNormal } from "../../utils/space_ops/index.js";
import type { Mobject } from "../mobject/index.js";

// Use Mobject as stand-in for VMobject until mobject.types is converted.
// The functions only access .points and .getNumPoints() which exist on Mobject.
type VMobjectLike = Mobject & {
  points: import("numpy-ts").NDArray;
  getNumPoints(): number;
  getAnchors?(): import("numpy-ts").NDArray;
};

export function get3dVmobGradientStartAndEndPoints(
  vmob: VMobjectLike,
): [Point3D, Point3D] {
  return [
    get3dVmobStartCorner(vmob),
    get3dVmobEndCorner(vmob),
  ];
}

export function get3dVmobStartCornerIndex(
  _vmob: VMobjectLike,
): 0 {
  return 0;
}

export function get3dVmobEndCornerIndex(
  vmob: VMobjectLike,
): number {
  return Math.floor((vmob.getNumPoints() - 1) / 6) * 3;
}

export function get3dVmobStartCorner(
  vmob: VMobjectLike,
): Point3D {
  if (vmob.getNumPoints() === 0) {
    return np.array([...ORIGIN.toArray() as number[]]);
  }
  return vmob.points.get([get3dVmobStartCornerIndex(vmob)]) as unknown as Point3D;
}

export function get3dVmobEndCorner(
  vmob: VMobjectLike,
): Point3D {
  if (vmob.getNumPoints() === 0) {
    return np.array([...ORIGIN.toArray() as number[]]);
  }
  return vmob.points.get([get3dVmobEndCornerIndex(vmob)]) as unknown as Point3D;
}

export function get3dVmobUnitNormal(
  vmob: VMobjectLike,
  pointIndex: number,
): Point3D {
  const nPoints = vmob.getNumPoints();
  // If anchors ≤ 2, we can't determine a normal — return UP
  if (vmob.getAnchors) {
    const anchors = vmob.getAnchors();
    if (anchors.shape[0] <= 2) {
      return np.array([...UP.toArray() as number[]]);
    }
  } else if (nPoints <= 6) {
    // Without getAnchors, approximate: anchors ~ nPoints / 3
    return np.array([...UP.toArray() as number[]]);
  }

  const i = pointIndex;
  const im3 = i > 2 ? i - 3 : nPoints - 4;
  const ip3 = i < nPoints - 3 ? i + 3 : 3;

  const pI = vmob.points.get([i]) as unknown as Point3D;
  const pIp3 = vmob.points.get([ip3]) as unknown as Point3D;
  const pIm3 = vmob.points.get([im3]) as unknown as Point3D;

  const unitNormal = getUnitNormal(
    pIp3.subtract(pI),
    pIm3.subtract(pI),
  );

  if ((np.linalg.norm(unitNormal) as number) === 0) {
    return np.array([...UP.toArray() as number[]]);
  }
  return unitNormal;
}

export function get3dVmobStartCornerUnitNormal(
  vmob: VMobjectLike,
): Point3D {
  return get3dVmobUnitNormal(vmob, get3dVmobStartCornerIndex(vmob));
}

export function get3dVmobEndCornerUnitNormal(
  vmob: VMobjectLike,
): Point3D {
  return get3dVmobUnitNormal(vmob, get3dVmobEndCornerIndex(vmob));
}
