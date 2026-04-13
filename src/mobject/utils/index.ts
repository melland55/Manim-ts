/**
 * mobject/utils — barrel export.
 * Mirrors manim/mobject/utils.py public API.
 */

export {
  RendererType,
  getActiveRenderer,
  getMobjectClass,
  getVectorizedMobjectClass,
  getPointMobjectClass,
} from "./utils.js";

export type {
  MobjectConstructor,
  VMobjectConstructor,
  PMobjectConstructor,
} from "./utils.js";
