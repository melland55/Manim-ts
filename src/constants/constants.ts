/**
 * Constant definitions.
 *
 * TypeScript port of manim/constants.py.
 *
 * Direction vectors (ORIGIN, UP, DOWN, etc.) and math constants (PI, TAU,
 * DEGREES) are re-exported from core/math to avoid duplication.
 */

import { np } from "../core/math/index.js";
import type { Vector3D } from "../typing/index.js";

// ─── Re-exports from core/math ───────────────────────────────
// These are defined there as the single source of truth.

export {
  ORIGIN, UP, DOWN, LEFT, RIGHT, IN, OUT,
  PI, TAU, DEGREES,
} from "../core/math/index.js";

// ─── Messages ────────────────────────────────────────────────

export const SCENE_NOT_FOUND_MESSAGE = `
   {} is not in the script
`;

export const CHOOSE_NUMBER_MESSAGE = `
Choose number corresponding to desired scene/arguments.
(Use comma separated list for multiple entries or use "*" to select all scenes.)
Choice(s): `;

export const INVALID_NUMBER_MESSAGE =
  "Invalid scene numbers have been specified. Aborting.";

export const NO_SCENE_MESSAGE = `
   There are no scenes inside that module
`;

// ─── Pango font style constants ──────────────────────────────

export const NORMAL = "NORMAL";
export const ITALIC = "ITALIC";
export const OBLIQUE = "OBLIQUE";
export const BOLD = "BOLD";

// Only for Pango from below
export const THIN = "THIN";
export const ULTRALIGHT = "ULTRALIGHT";
export const LIGHT = "LIGHT";
export const SEMILIGHT = "SEMILIGHT";
export const BOOK = "BOOK";
export const MEDIUM = "MEDIUM";
export const SEMIBOLD = "SEMIBOLD";
export const ULTRABOLD = "ULTRABOLD";
export const HEAVY = "HEAVY";
export const ULTRAHEAVY = "ULTRAHEAVY";

// ─── Resampling algorithms ───────────────────────────────────
// Python uses PIL.Image.Resampling enum values. We use string identifiers
// that map to the canonical algorithm name.

export const RESAMPLING_ALGORITHMS: Readonly<Record<string, string>> = {
  nearest: "nearest",
  none: "nearest",
  bilinear: "bilinear",
  linear: "bilinear",
  bicubic: "bicubic",
  cubic: "bicubic",
} as const;

// ─── Geometry: axes ──────────────────────────────────────────

export const X_AXIS: Vector3D = np.array([1.0, 0.0, 0.0]);
export const Y_AXIS: Vector3D = np.array([0.0, 1.0, 0.0]);
export const Z_AXIS: Vector3D = np.array([0.0, 0.0, 1.0]);

// ─── Geometry: diagonal directions ───────────────────────────

/** One step up plus one step left. */
export const UL: Vector3D = np.array([-1.0, 1.0, 0.0]);

/** One step up plus one step right. */
export const UR: Vector3D = np.array([1.0, 1.0, 0.0]);

/** One step down plus one step left. */
export const DL: Vector3D = np.array([-1.0, -1.0, 0.0]);

/** One step down plus one step right. */
export const DR: Vector3D = np.array([1.0, -1.0, 0.0]);

// ─── Geometry numeric constants ──────────────────────────────

export const START_X = 30;
export const START_Y = 20;
export const DEFAULT_DOT_RADIUS = 0.08;
export const DEFAULT_SMALL_DOT_RADIUS = 0.04;
export const DEFAULT_DASH_LENGTH = 0.05;
export const DEFAULT_ARROW_TIP_LENGTH = 0.35;

// ─── Default buffers (padding) ───────────────────────────────

export const SMALL_BUFF = 0.1;
export const MED_SMALL_BUFF = 0.25;
export const MED_LARGE_BUFF = 0.5;
export const LARGE_BUFF = 1;
export const DEFAULT_MOBJECT_TO_EDGE_BUFFER = MED_LARGE_BUFF;
export const DEFAULT_MOBJECT_TO_MOBJECT_BUFFER = MED_SMALL_BUFF;

// ─── Times in seconds ────────────────────────────────────────

export const DEFAULT_POINTWISE_FUNCTION_RUN_TIME = 3.0;
export const DEFAULT_WAIT_TIME = 1.0;

// ─── Misc defaults ───────────────────────────────────────────

export const DEFAULT_POINT_DENSITY_2D = 25;
export const DEFAULT_POINT_DENSITY_1D = 10;
export const DEFAULT_STROKE_WIDTH = 4;
export const DEFAULT_FONT_SIZE = 48;
export const SCALE_FACTOR_PER_FONT_POINT = 1 / 960;

// ─── Video quality definitions ───────────────────────────────

export interface QualityDict {
  flag: string | null;
  pixelHeight: number;
  pixelWidth: number;
  frameRate: number;
}

export const QUALITIES: Readonly<Record<string, QualityDict>> = {
  fourk_quality: {
    flag: "k",
    pixelHeight: 2160,
    pixelWidth: 3840,
    frameRate: 60,
  },
  production_quality: {
    flag: "p",
    pixelHeight: 1440,
    pixelWidth: 2560,
    frameRate: 60,
  },
  high_quality: {
    flag: "h",
    pixelHeight: 1080,
    pixelWidth: 1920,
    frameRate: 60,
  },
  medium_quality: {
    flag: "m",
    pixelHeight: 720,
    pixelWidth: 1280,
    frameRate: 30,
  },
  low_quality: {
    flag: "l",
    pixelHeight: 480,
    pixelWidth: 854,
    frameRate: 15,
  },
  example_quality: {
    flag: null,
    pixelHeight: 480,
    pixelWidth: 854,
    frameRate: 30,
  },
} as const;

export const DEFAULT_QUALITY = "high_quality";

// ─── CLI / epilog ────────────────────────────────────────────

export const EPILOG = "Made with <3 by Manim Community developers.";
export const SHIFT_VALUE = 65505;
export const CTRL_VALUE = 65507;

// CONTEXT_SETTINGS is a Python/cloup CLI construct with no TS equivalent.
// It is intentionally omitted.

// ─── Enumerations ────────────────────────────────────────────

/**
 * All renderer types that can be assigned to config.renderer.
 *
 * Python: manim.constants.RendererType
 */
export enum RendererType {
  /** A renderer based on the cairo backend. */
  CAIRO = "cairo",
  /** An OpenGL-based renderer. */
  OPENGL = "opengl",
}

/**
 * Collection of available line joint types.
 *
 * Python: manim.constants.LineJointType
 */
export enum LineJointType {
  AUTO = 0,
  ROUND = 1,
  BEVEL = 2,
  MITER = 3,
}

/**
 * Collection of available cap styles.
 *
 * Python: manim.constants.CapStyleType
 */
export enum CapStyleType {
  AUTO = 0,
  ROUND = 1,
  BUTT = 2,
  SQUARE = 3,
}
