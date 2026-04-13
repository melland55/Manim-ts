/**
 * Barrel export for the renderer/vectorized_mobject_rendering module.
 * TypeScript port of manim/renderer/vectorized_mobject_rendering.py.
 */

export {
  // Types
  type FillVertexAttributes,
  type StrokeVertexAttributes,
  type IOpenGLCamera,
  type IOpenGLContext,
  type IOpenGLRenderer,
  type IOpenGLVMobject,
  type IVao,
  type IVbo,
  // Functions
  buildMatrixLists,
  triangulateMobject,
  renderOpenGLVectorizedMobjectFill,
  renderMobjectFillsWithMatrix,
  renderOpenGLVectorizedMobjectStroke,
  renderMobjectStrokesWithMatrix,
} from "./vectorized_mobject_rendering.js";
