/**
 * Barrel export for the renderer/shader module.
 * TypeScript port of manim/renderer/shader.py.
 */

export {
  // Type aliases
  type MeshTimeBasedUpdater,
  type MeshNonTimeBasedUpdater,
  type MeshUpdater,
  // Interfaces
  type GLContext,
  type GLProgram,
  type IOpenGLRenderer,
  type MeshOptions,
  type ShaderSource,
  // Module-level caches (exposed for testing / cache management)
  shaderProgramCache,
  filePathToCodeMap,
  // Helper functions
  getShaderCodeFromFile,
  filterAttributes,
  // Classes
  Object3D,
  Mesh,
  Shader,
  FullScreenQuad,
} from "./shader.js";
