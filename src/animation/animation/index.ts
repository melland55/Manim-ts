/**
 * animation/animation — barrel export
 *
 * Re-exports the concrete Animation base class, Wait, Add, and utilities.
 */

export {
  Animation,
  Wait,
  Add,
  prepareAnimation,
  overrideAnimation,
  DEFAULT_ANIMATION_RUN_TIME,
  DEFAULT_ANIMATION_LAG_RATIO,
} from "./animation.js";

export type { ExtendedAnimationOptions, WaitOptions } from "./animation.js";

export type { IAnimation, AnimationOptions } from "../../core/types.js";
