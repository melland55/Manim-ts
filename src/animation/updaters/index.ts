/**
 * Animations and utility mobjects related to update functions.
 *
 * Python equivalent: manim/animation/updaters/__init__.py
 */

export {
  assertIsMobjectMethod,
  always,
  fAlways,
  alwaysRedraw,
  alwaysShift,
  alwaysRotate,
  turnAnimationIntoUpdater,
  cycleAnimation,
} from "./mobject_update_utils.js";

export {
  UpdateFromFunc,
  UpdateFromAlphaFunc,
  MaintainPositionRelativeTo,
} from "./update.js";

export type { UpdateFromFuncOptions } from "./update.js";
