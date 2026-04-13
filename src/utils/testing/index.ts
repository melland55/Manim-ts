/**
 * Utilities for Manim tests.
 *
 * TypeScript port of manim/utils/testing/__init__.py.
 *
 * Provides frame comparison utilities for graphical unit testing,
 * adapted from Python pytest to TypeScript vitest.
 *
 * @module utils/testing
 */

export {
  framesComparison,
  SCENE_PARAMETER_NAME,
} from "./frames_comparison.js";
export type { FramesComparisonOptions } from "./frames_comparison.js";

export {
  _FramesTester,
  _ControlDataWriter,
  FRAME_ABSOLUTE_TOLERANCE,
  FRAME_MISMATCH_RATIO_TOLERANCE,
} from "./_frames_testers.js";

export {
  makeTestSceneClass,
  makeTestRendererClass,
  DummySceneFileWriter,
  makeSceneFileWriterClass,
} from "./_test_class_makers.js";

export { showDiffHelper } from "./_show_diff.js";
