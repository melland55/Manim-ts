/**
 * Special rectangles — ScreenRectangle and FullScreenRectangle.
 *
 * TypeScript port of manim/mobject/frame.py
 */

import { config } from "../../_config/index.js";
import { Rectangle } from "../geometry/polygram/index.js";
import type { RectangleOptions } from "../geometry/polygram/index.js";

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
