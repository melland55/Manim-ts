/**
 * Barrel export for mobject.types module.
 * Python: manim.mobject.types
 */
export { VMobject } from "./vectorized_mobject.js";
export type { VMobjectOptions } from "./vectorized_mobject.js";

export {
  PMobject,
  Mobject1D,
  Mobject2D,
  PGroup,
  PointCloudDot,
  Point,
} from "./point_cloud_mobject/index.js";
export type {
  PMobjectOptions,
  Mobject1DOptions,
  Mobject2DOptions,
  PointCloudDotOptions,
  PointOptions,
} from "./point_cloud_mobject/index.js";
