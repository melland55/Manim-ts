/**
 * animation/growing — manim-ts
 *
 * Animations that introduce mobjects by growing them from points.
 * Python: manim.animation.growing
 */

export type { PathFunc } from "./path-functions.js";
export { straightPath, spiralPath } from "./path-functions.js";

export type { TransformOptions } from "./transform.js";
export { Transform } from "./transform.js";

export type {
  IMobjectWithCriticalPoint,
  IArrow,
  GrowFromPointOptions,
  GrowFromCenterOptions,
  GrowFromEdgeOptions,
  GrowArrowOptions,
  SpinInFromNothingOptions,
} from "./growing.js";

export {
  GrowFromPoint,
  GrowFromCenter,
  GrowFromEdge,
  GrowArrow,
  SpinInFromNothing,
} from "./growing.js";
