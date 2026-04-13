/**
 * Animations that introduce mobjects to a scene by growing them from points.
 *
 * Python: manim.animation.growing
 *
 * All classes extend Transform. The key mechanic: createStartingMobject()
 * returns a shrunken/repositioned copy, while createTarget() returns the
 * mobject at full size in its final position. The animation interpolates
 * between the two states.
 */

import type { IMobject, IColor } from "../../core/types.js";
import type { Point3D } from "../../core/math/index.js";
import { PI } from "../../core/math/index.js";
import { Transform, type TransformOptions } from "./transform.js";
import { spiralPath } from "./path-functions.js";

// ─── Extended interfaces ──────────────────────────────────────

/**
 * An IMobject that supports getCriticalPoint — a method that returns a point
 * on the bounding box in the given direction.
 * Implemented by the Mobject base class (not yet converted).
 */
export interface IMobjectWithCriticalPoint extends IMobject {
  getCriticalPoint(direction: Point3D): Point3D;
}

/**
 * An Arrow mobject with a getStart() accessor.
 * Implemented by the Arrow class (not yet converted).
 */
export interface IArrow extends IMobject {
  /** The tail/start point of the arrow. */
  getStart(): Point3D;
}

// ─── Shared options types ────────────────────────────────────

export interface GrowFromPointOptions extends TransformOptions {
  // pointColor is a constructor parameter, not an option field
}

export type GrowFromCenterOptions = GrowFromPointOptions;
export type GrowFromEdgeOptions = GrowFromPointOptions;
export type GrowArrowOptions = GrowFromPointOptions;

export interface SpinInFromNothingOptions extends GrowFromCenterOptions {
  angle?: number;
}

// ─── GrowFromPoint ────────────────────────────────────────────

/**
 * Introduce a Mobject by growing it from a given point.
 *
 * The mobject starts as a zero-size copy located at `point` (optionally
 * colored with `pointColor`) and expands to its final size and position.
 *
 * Python: manim.animation.growing.GrowFromPoint
 */
export class GrowFromPoint extends Transform {
  protected point: Point3D;
  protected pointColor: IColor | null;

  constructor(
    mobject: IMobject,
    point: Point3D,
    pointColor: IColor | null = null,
    options: GrowFromPointOptions = {}
  ) {
    super(mobject, { introducer: true, ...options });
    this.point = point;
    this.pointColor = pointColor;
  }

  override createTarget(): IMobject {
    // The target is the mobject in its final, full-size state.
    return this.mobject;
  }

  override createStartingMobject(): IMobject {
    // Start from a zero-size copy anchored at the specified point.
    const start = super.createStartingMobject(); // mobject.copy()
    start.scale(0);
    start.moveTo(this.point);
    if (this.pointColor !== null) {
      start.setColor(this.pointColor);
    }
    return start;
  }
}

// ─── GrowFromCenter ───────────────────────────────────────────

/**
 * Introduce a Mobject by growing it from its own center.
 *
 * Python: manim.animation.growing.GrowFromCenter
 */
export class GrowFromCenter extends GrowFromPoint {
  constructor(
    mobject: IMobject,
    pointColor: IColor | null = null,
    options: GrowFromCenterOptions = {}
  ) {
    const point = mobject.getCenter();
    super(mobject, point, pointColor, options);
  }
}

// ─── GrowFromEdge ─────────────────────────────────────────────

/**
 * Introduce a Mobject by growing it from one of its bounding box edges.
 *
 * `edge` is a direction vector (e.g. DOWN, RIGHT, UR) selecting which
 * critical point on the bounding box to grow from.
 *
 * Python: manim.animation.growing.GrowFromEdge
 */
export class GrowFromEdge extends GrowFromPoint {
  constructor(
    mobject: IMobjectWithCriticalPoint,
    edge: Point3D,
    pointColor: IColor | null = null,
    options: GrowFromEdgeOptions = {}
  ) {
    const point = mobject.getCriticalPoint(edge);
    super(mobject as IMobject, point, pointColor, options);
  }
}

// ─── GrowArrow ────────────────────────────────────────────────

/**
 * Introduce an Arrow by growing it from its tail (start) toward its tip.
 *
 * Unlike GrowFromPoint, this version calls Arrow-specific scaling so that
 * the arrowhead also collapses to zero (scaleTips behavior).
 *
 * Python: manim.animation.growing.GrowArrow
 */
export class GrowArrow extends GrowFromPoint {
  constructor(
    arrow: IArrow,
    pointColor: IColor | null = null,
    options: GrowArrowOptions = {}
  ) {
    const point = arrow.getStart();
    super(arrow as IMobject, point, pointColor, options);
  }

  override createStartingMobject(): IMobject {
    const startArrow = this.mobject.copy();
    // Arrow.scale supports a scaleTips option to collapse arrowheads.
    // Use scale with aboutPoint; scaleTips is Arrow-specific and passed
    // via the options bag which the base IMobject.scale will safely ignore.
    startArrow.scale(0, { aboutPoint: this.point } as any);
    if (this.pointColor !== null) {
      startArrow.setColor(this.pointColor);
    }
    return startArrow;
  }
}

// ─── SpinInFromNothing ────────────────────────────────────────

/**
 * Introduce a Mobject by spinning it in from nothing at its center.
 *
 * Combines GrowFromCenter with a spiral path function so the object
 * rotates while expanding. The default spin is PI/2 (quarter turn).
 *
 * Python: manim.animation.growing.SpinInFromNothing
 */
export class SpinInFromNothing extends GrowFromCenter {
  /** The total rotation angle traversed during the animation. */
  readonly angle: number;

  constructor(
    mobject: IMobject,
    angle: number = PI / 2,
    pointColor: IColor | null = null,
    options: SpinInFromNothingOptions = {}
  ) {
    super(mobject, pointColor, {
      pathFunc: spiralPath(angle),
      ...options,
    });
    this.angle = angle;
  }
}
