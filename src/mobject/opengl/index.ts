/**
 * Barrel export for the mobject.opengl module.
 * TypeScript port of manim/mobject/opengl/__init__.py
 */

export {
  OpenGLMobject,
  OpenGLGroup,
  OpenGLPoint,
  _AnimationBuilder,
  overrideAnimate,
} from "./opengl_mobject.js";

export type {
  OpenGLMobjectOptions,
  OpenGLPointOptions,
  TimeBasedUpdater,
  NonTimeBasedUpdater,
  OpenGLUpdater,
  MappingFunction,
  MultiMappingFunction,
} from "./opengl_mobject.js";

export {
  triggersRefreshedTriangulation,
  OpenGLVMobject,
  OpenGLVGroup,
  OpenGLVectorizedPoint,
  OpenGLCurvesAsSubmobjects,
  OpenGLDashedVMobject,
} from "./opengl_vectorized_mobject.js";

export type {
  OpenGLVMobjectOptions,
} from "./opengl_vectorized_mobject.js";
