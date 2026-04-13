/**
 * Barrel export for the mobject.opengl.opengl_extras module.
 * TypeScript port of manim/mobject/opengl/ (extra modules).
 */

// Point cloud mobjects
export {
  OpenGLPMobject,
  OpenGLPGroup,
  OpenGLPMPoint,
} from "./opengl_point_cloud_mobject.js";
export type {
  OpenGLPMobjectOptions,
  OpenGLPMPointOptions,
} from "./opengl_point_cloud_mobject.js";

// Dot cloud
export { DotCloud, TrueDot } from "./dot_cloud.js";
export type { DotCloudOptions, TrueDotOptions } from "./dot_cloud.js";

// Surface
export {
  OpenGLSurface,
  OpenGLSurfaceGroup,
  OpenGLTexturedSurface,
} from "./opengl_surface.js";
export type {
  OpenGLSurfaceOptions,
  OpenGLSurfaceGroupOptions,
  OpenGLTexturedSurfaceOptions,
} from "./opengl_surface.js";

// Image mobject
export { OpenGLImageMobject } from "./opengl_image_mobject.js";
export type { OpenGLImageMobjectOptions } from "./opengl_image_mobject.js";

// 3D surface mesh
export { OpenGLSurfaceMesh } from "./opengl_three_dimensions.js";
export type { OpenGLSurfaceMeshOptions } from "./opengl_three_dimensions.js";
