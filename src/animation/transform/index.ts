/**
 * animation/transform — barrel export
 *
 * Re-exports all transform animation classes.
 * Python equivalent: manim/animation/transform.py
 */

export {
  Transform,
  ReplacementTransform,
  TransformFromCopy,
  ClockwiseTransform,
  CounterclockwiseTransform,
  MoveToTarget,
  _MethodAnimation,
  ApplyMethod,
  ApplyPointwiseFunction,
  ApplyPointwiseFunctionToCenter,
  FadeToColor,
  ScaleInPlace,
  ShrinkToCenter,
  Restore,
  ApplyFunction,
  ApplyMatrix,
  ApplyComplexFunction,
  CyclicReplace,
  Swap,
  TransformAnimations,
  FadeTransform,
  FadeTransformPieces,
} from "./transform.js";

export type { TransformOptions } from "./transform.js";
