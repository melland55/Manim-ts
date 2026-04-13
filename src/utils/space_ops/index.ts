/**
 * Barrel export for the space_ops module.
 * TypeScript port of manim/utils/space_ops.py
 */

export {
  quaternionMult,
  quaternionFromAngleAxis,
  angleAxisFromQuaternion,
  quaternionConjugate,
  rotateVector,
  thickDiagonal,
  rotationMatrix,
  rotationAboutZ,
  zToVector,
  angleOfVector,
  angleBetweenVectors,
  normalize,
  normalizeAlongAxis,
  getUnitNormal,
  compassDirections,
  regularVertices,
  complexToR3,
  r3ToComplex,
  complexFuncToR3Func,
  centerOfMass,
  midpoint,
  findIntersection,
  lineIntersection,
  getWindingNumber,
  shoelace,
  shoelaceDirection,
  cross2d,
  earclipTriangulation,
  cartesianToSpherical,
  sphericalToCartesian,
  perpendicularBisector,
} from "./space_ops.js";
