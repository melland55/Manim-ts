/**
 * Barrel export for the top-level opengl module.
 * TypeScript port of manim/opengl/__init__.py.
 *
 * This module re-exports from:
 * - renderer/shader (converted)
 * - utils/opengl (converted)
 * - mobject/opengl (TODO: not yet converted — re-export when available)
 */

// ── renderer.shader ──────────────────────────────────────────
export {
  type MeshTimeBasedUpdater,
  type MeshNonTimeBasedUpdater,
  type MeshUpdater,
  type GLContext,
  type GLProgram,
  type IOpenGLRenderer,
  type MeshOptions,
  type ShaderSource,
  shaderProgramCache,
  filePathToCodeMap,
  getShaderCodeFromFile,
  filterAttributes,
  Object3D,
  Mesh,
  Shader,
  FullScreenQuad,
} from "../renderer/shader/index.js";

// ── utils.opengl ─────────────────────────────────────────────
export {
  depth,
  type FlattenedMatrix4x4,
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
} from "../utils/opengl/index.js";

// ── mobject.opengl ───────────────────────────────────────────
// TODO: Re-export mobject.opengl classes when that module is converted.
// The following submodules should be re-exported here:
//   - dot_cloud (DotCloud, etc.)
//   - opengl_image_mobject (OpenGLImageMobject, etc.)
//   - opengl_mobject (OpenGLMobject, etc.)
//   - opengl_point_cloud_mobject (OpenGLPointCloudMobject, etc.)
//   - opengl_surface (OpenGLSurface, OpenGLParametricSurface, etc.)
//   - opengl_three_dimensions (OpenGLSurfaceMesh, etc.)
//   - opengl_vectorized_mobject (OpenGLVMobject, OpenGLVGroup, etc.)
//
// Once src/mobject/opengl/ is available, add:
// export * from "../mobject/opengl/index.js";
