/**
 * Barrel export for the constants module.
 * TypeScript port of manim/constants.py.
 */

export {
  // Messages
  SCENE_NOT_FOUND_MESSAGE,
  CHOOSE_NUMBER_MESSAGE,
  INVALID_NUMBER_MESSAGE,
  NO_SCENE_MESSAGE,

  // Pango font style constants
  NORMAL,
  ITALIC,
  OBLIQUE,
  BOLD,
  THIN,
  ULTRALIGHT,
  LIGHT,
  SEMILIGHT,
  BOOK,
  MEDIUM,
  SEMIBOLD,
  ULTRABOLD,
  HEAVY,
  ULTRAHEAVY,

  // Resampling algorithms
  RESAMPLING_ALGORITHMS,

  // Geometry: cardinal directions (re-exported from core/math)
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  IN,
  OUT,

  // Geometry: axes
  X_AXIS,
  Y_AXIS,
  Z_AXIS,

  // Geometry: diagonals
  UL,
  UR,
  DL,
  DR,

  // Geometry numeric constants
  START_X,
  START_Y,
  DEFAULT_DOT_RADIUS,
  DEFAULT_SMALL_DOT_RADIUS,
  DEFAULT_DASH_LENGTH,
  DEFAULT_ARROW_TIP_LENGTH,

  // Default buffers
  SMALL_BUFF,
  MED_SMALL_BUFF,
  MED_LARGE_BUFF,
  LARGE_BUFF,
  DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,

  // Times
  DEFAULT_POINTWISE_FUNCTION_RUN_TIME,
  DEFAULT_WAIT_TIME,

  // Misc defaults
  DEFAULT_POINT_DENSITY_2D,
  DEFAULT_POINT_DENSITY_1D,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FONT_SIZE,
  SCALE_FACTOR_PER_FONT_POINT,

  // Math constants (re-exported from core/math)
  PI,
  TAU,
  DEGREES,

  // Video quality
  QUALITIES,
  DEFAULT_QUALITY,

  // CLI
  EPILOG,
  SHIFT_VALUE,
  CTRL_VALUE,

  // Enums
  RendererType,
  LineJointType,
  CapStyleType,
} from "./constants.js";

export type { QualityDict } from "./constants.js";
