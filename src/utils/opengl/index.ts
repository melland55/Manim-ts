/**
 * Barrel export for utils/opengl.
 * TypeScript port of manim/utils/opengl.py.
 */

export { depth } from "./opengl.js";
export type { FlattenedMatrix4x4 } from "./opengl.js";
export {
  matrixToShaderInput,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
  translationMatrix,
  xRotationMatrix,
  yRotationMatrix,
  zRotationMatrix,
  rotateInPlaceMatrix,
  rotationMatrix,
  scaleMatrix,
  viewMatrix,
} from "./opengl.js";
