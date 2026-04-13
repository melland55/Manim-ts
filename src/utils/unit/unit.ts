/**
 * Unit conversion helpers for manim-ts.
 * Converted from: utils/unit.py
 */

import { np, PI, RIGHT, UP, OUT } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import type { ManimConfig } from "../../core/types.js";

// ─── Default config values (standard Manim defaults) ─────────
// Used when no global config has been set. The real config object
// is injected via setUnitConfig() once the config module is available.

let _config: Pick<ManimConfig, "pixelWidth" | "frameWidth" | "frameHeight"> = {
  pixelWidth: 1920,
  frameWidth: 14.222_222_222_222_222,
  frameHeight: 8.0,
};

/**
 * Override the config used by Pixels and Percent.
 * Call this after the global ManimConfig is initialized.
 */
export function setUnitConfig(
  cfg: Pick<ManimConfig, "pixelWidth" | "frameWidth" | "frameHeight">,
): void {
  _config = cfg;
}

// ─── _PixelUnits ─────────────────────────────────────────────

/**
 * Converts pixel distances to Manim frame units.
 *
 * Usage (mirroring Python's operator overloading):
 *   pixelDistance * Pixels  →  Pixels.times(pixelDistance)
 *   Pixels * pixelDistance  →  Pixels.times(pixelDistance)
 */
class _PixelUnits {
  /** Convert a pixel count to frame units: val * frameWidth / pixelWidth */
  times(val: number): number {
    return val * (_config.frameWidth / _config.pixelWidth);
  }
}

/** Singleton: convert pixel distances to frame (logical) units. */
export const Pixels = new _PixelUnits();

// ─── Degrees ─────────────────────────────────────────────────

/** Multiply by this to convert degrees to radians: angle * Degrees */
export const Degrees: number = PI / 180;

// ─── Munits ──────────────────────────────────────────────────

/** Identity multiplier (Manim frame units — already in logical units). */
export const Munits: number = 1;

// ─── Percent ─────────────────────────────────────────────────

/** Axis constants mirroring manim.constants (X_AXIS, Y_AXIS, Z_AXIS). */
const X_AXIS: Point3D = RIGHT; // [1, 0, 0]
const Y_AXIS: Point3D = UP;    // [0, 1, 0]
const Z_AXIS: Point3D = OUT;   // [0, 0, 1]

/**
 * Converts percentage values to frame units along a given axis.
 *
 * Usage (mirroring Python's operator overloading):
 *   50 * new Percent(X_AXIS)  →  new Percent(X_AXIS).times(50)
 *
 * Throws for Z axis (length is undefined in Manim).
 */
export class Percent {
  private readonly length: number;

  constructor(axis: Point3D) {
    if (np.array_equal(axis, X_AXIS)) {
      this.length = _config.frameWidth;
    } else if (np.array_equal(axis, Y_AXIS)) {
      this.length = _config.frameHeight;
    } else if (np.array_equal(axis, Z_AXIS)) {
      throw new Error("length of Z axis is undefined");
    } else {
      throw new Error("axis must be X_AXIS, Y_AXIS, or Z_AXIS");
    }
  }

  /** Convert a percentage to frame units: val / 100 * axisLength */
  times(val: number): number {
    return (val / 100) * this.length;
  }
}
