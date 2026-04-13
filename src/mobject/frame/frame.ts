/**
 * Special rectangles — ScreenRectangle and FullScreenRectangle.
 *
 * TypeScript port of manim/mobject/frame.py
 */

import { np } from "../../core/math/index.js";
import { Mobject } from "../mobject/mobject.js";
import { config } from "../../_config/index.js";

// ─── Dependency stubs for not-yet-converted modules ──────────
// TODO: Replace with import from ../geometry/polygram once converted

interface RectangleOptions {
  width?: number;
  height?: number;
  color?: unknown;
  fillColor?: unknown;
  fillOpacity?: number;
  strokeColor?: unknown;
  strokeOpacity?: number;
  strokeWidth?: number;
  [key: string]: unknown;
}

/**
 * Minimal Rectangle stub until mobject.geometry is converted.
 * Creates corner points so that Mobject's width/height accessors work.
 */
class Rectangle extends Mobject {
  constructor(options: RectangleOptions = {}) {
    super();
    const w = options.width ?? 4.0;
    const h = options.height ?? 2.0;
    const hw = w / 2;
    const hh = h / 2;
    // Set corner points so lengthOverDim works correctly
    this.points = np.array([
      [-hw, -hh, 0],
      [hw, -hh, 0],
      [hw, hh, 0],
      [-hw, hh, 0],
    ]);
  }
}

// ─── ScreenRectangle ─────────────────────────────────────────

export interface ScreenRectangleOptions extends RectangleOptions {
  aspectRatio?: number;
  height?: number;
}

/**
 * A rectangle with a fixed aspect ratio (default 16:9).
 *
 * Setting the `aspectRatio` property stretches the width to match.
 */
export class ScreenRectangle extends Rectangle {
  constructor(options: ScreenRectangleOptions = {}) {
    const aspectRatio = options.aspectRatio ?? 16.0 / 9.0;
    const h = options.height ?? 4;
    super({ ...options, width: aspectRatio * h, height: h });
  }

  /** The aspect ratio. Setting it stretches the width to accommodate. */
  get aspectRatio(): number {
    return this.width / this.height;
  }

  set aspectRatio(value: number) {
    this.stretchToFitWidth(value * this.height);
  }
}

// ─── FullScreenRectangle ─────────────────────────────────────

export interface FullScreenRectangleOptions extends ScreenRectangleOptions {}

/**
 * A ScreenRectangle sized to the full frame height from config.
 */
export class FullScreenRectangle extends ScreenRectangle {
  constructor(options: FullScreenRectangleOptions = {}) {
    super(options);
    this.height = config.frameHeight;
  }
}
