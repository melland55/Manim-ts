/**
 * Mobjects used to mark and annotate other mobjects.
 * TypeScript port of manim/mobject/geometry/shape_matchers.py
 */

import type { Point3D } from "../../../core/math/index.js";
import type { IColor } from "../../../core/types.js";
import type { ParsableManimColor } from "../../../utils/color/index.js";
import { BLACK, PURE_YELLOW, RED } from "../../../utils/color/index.js";
import {
  DOWN,
  LEFT,
  RIGHT,
  SMALL_BUFF,
  UP,
} from "../../../constants/index.js";
import { config, logger } from "../../../_config/index.js";
import { Mobject, Group } from "../../mobject/index.js";
import { VMobject } from "../../types/index.js";
import { RoundedRectangle } from "../polygram/index.js";
import type { RoundedRectangleOptions } from "../polygram/index.js";
import { Line } from "../line/index.js";
import type { LineOptions } from "../line/index.js";
import { np } from "../../../core/math/index.js";
import type { NDArray } from "numpy-ts";

// ─── SurroundingRectangle ────────────────────────────────────

export interface SurroundingRectangleOptions extends RoundedRectangleOptions {
  color?: IColor;
  buff?: number | [number, number];
  cornerRadius?: number | number[];
}

/**
 * A rectangle surrounding one or more Mobjects.
 */
export class SurroundingRectangle extends RoundedRectangle {
  buff: number | [number, number];

  constructor(
    mobjects: Mobject | Mobject[],
    options: SurroundingRectangleOptions = {},
  ) {
    const {
      color,
      buff = SMALL_BUFF,
      cornerRadius = 0.0,
      ...rest
    } = options;

    const mobjectArray = Array.isArray(mobjects) ? mobjects : [mobjects];

    const buffX = typeof buff === "number" ? buff : buff[0];
    const buffY = typeof buff === "number" ? buff : buff[1];

    const group = new Group(...mobjectArray);

    super({
      color: color ?? (PURE_YELLOW as unknown as IColor),
      width: group.getWidth() + 2 * buffX,
      height: group.getHeight() + 2 * buffY,
      cornerRadius,
      ...rest,
    });

    this.buff = buff;
    this.moveTo(group.getCenter());
  }
}

// ─── BackgroundRectangle ─────────────────────────────────────

export interface BackgroundRectangleOptions extends SurroundingRectangleOptions {
  strokeWidth?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

/**
 * A background rectangle. Its default color is the background color
 * of the scene.
 */
export class BackgroundRectangle extends SurroundingRectangle {
  originalFillOpacity: number;

  constructor(
    mobjects: Mobject | Mobject[],
    options: BackgroundRectangleOptions = {},
  ) {
    const {
      color,
      strokeWidth = 0,
      strokeOpacity = 0,
      fillOpacity = 0.75,
      buff = 0,
      ...rest
    } = options;

    const resolvedColor = color ?? (config.backgroundColor as unknown as IColor);

    super(mobjects, {
      color: resolvedColor,
      strokeWidth,
      strokeOpacity,
      fillOpacity,
      buff,
      ...rest,
    });

    this.originalFillOpacity = this.fillOpacity;
  }

  pointwiseBecomePartial(mobject: Mobject, _a: number, b: number): this {
    this.setFill(undefined, b * this.originalFillOpacity);
    return this;
  }

  override setStyle(options: {
    fillColor?: IColor;
    fillOpacity?: number;
    strokeColor?: IColor;
    strokeWidth?: number;
    strokeOpacity?: number;
  } = {}): this {
    const { fillOpacity, ...extraKeys } = options;
    super.setStyle({
      strokeColor: BLACK as unknown as IColor,
      strokeWidth: 0,
      fillColor: BLACK as unknown as IColor,
      fillOpacity: fillOpacity ?? this.fillOpacity,
    });
    const remainingKeys = Object.keys(extraKeys).filter(
      (k) => k !== "fillOpacity",
    );
    if (remainingKeys.length > 0) {
      logger.info(
        `Argument ${JSON.stringify(extraKeys)} is ignored in BackgroundRectangle.setStyle.`,
      );
    }
    return this;
  }
}

// ─── Cross ───────────────────────────────────────────────────

export interface CrossOptions {
  strokeColor?: ParsableManimColor;
  strokeWidth?: number;
  scaleFactor?: number;
}

/**
 * Creates a cross mark. Optionally fits to a given mobject.
 */
export class Cross extends VMobject {
  private _lines: [Line, Line];

  constructor(
    mobject?: Mobject | null,
    options: CrossOptions = {},
  ) {
    const {
      strokeColor = RED as unknown as ParsableManimColor,
      strokeWidth = 6.0,
      scaleFactor = 1.0,
    } = options;

    super();

    const lineA = new Line({
      start: (UP as NDArray).add(LEFT) as Point3D,
      end: (DOWN as NDArray).add(RIGHT) as Point3D,
    });
    const lineB = new Line({
      start: (UP as NDArray).add(RIGHT) as Point3D,
      end: (DOWN as NDArray).add(LEFT) as Point3D,
    });

    this._lines = [lineA, lineB];
    this.add(lineA, lineB);

    if (mobject != null) {
      this.replace(mobject, 0, true);
    }
    this.scale(scaleFactor);
    this.setStroke(strokeColor as unknown as IColor, strokeWidth);
  }
}

// ─── Underline ───────────────────────────────────────────────

export interface UnderlineOptions extends LineOptions {
  buff?: number;
}

/**
 * Creates an underline beneath a mobject.
 */
export class Underline extends Line {
  buff: number;

  constructor(
    mobject: Mobject,
    options: UnderlineOptions = {},
  ) {
    const { buff = SMALL_BUFF, ...rest } = options;

    super({
      start: LEFT as Point3D,
      end: RIGHT as Point3D,
      ...rest,
    });

    this.buff = buff;
    this.matchWidth(mobject);
    this.nextTo(mobject, DOWN as Point3D, { buff: this.buff });
  }
}
