/**
 * A collection of tip mobjects for use with TipableVMobject.
 *
 * TypeScript port of manim/mobject/geometry/tips.py
 *
 * NOTE: Python Manim uses multiple inheritance (e.g., ArrowTriangleTip(ArrowTip, Triangle)).
 * TypeScript doesn't support MI, so each concrete tip class extends the relevant shape
 * and includes the ArrowTip property logic directly via the arrowTipMixin helper.
 */

import { np, PI } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import type { IColor } from "../../../core/types.js";
import { VMobject } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { Circle, Triangle, Square } from "../index.js";
import type { CircleOptions, TriangleOptions, SquareOptions } from "../index.js";
import { DEFAULT_ARROW_TIP_LENGTH } from "../../../constants/index.js";
import { angleOfVector } from "../../../utils/space_ops/index.js";

// ── ArrowTip mixin properties ──────────────────────────────────

/**
 * Provides the ArrowTip property accessors. Since TypeScript lacks MI,
 * these are implemented as standalone functions that operate on any VMobject
 * with `points` and `pointFromProportion`.
 */
function getBase(mob: VMobject): Point3D {
  return mob.pointFromProportion(0.5);
}

function getTipPoint(mob: VMobject): Point3D {
  const nPts = mob.points.shape[0];
  if (nPts === 0) return np.array([0, 0, 0]);
  return np.array([
    mob.points.get([0, 0]) as number,
    mob.points.get([0, 1]) as number,
    mob.points.get([0, 2]) as number,
  ]);
}

function getTipVector(mob: VMobject): Point3D {
  const tip = getTipPoint(mob);
  const base = getBase(mob);
  return tip.subtract(base) as Point3D;
}

function getTipAngle(mob: VMobject): number {
  return angleOfVector(getTipVector(mob)) as number;
}

function getTipLength(mob: VMobject): number {
  return np.linalg.norm(getTipVector(mob)) as number;
}

// ── ArrowTip (abstract base) ───────────────────────────────────

/**
 * Base class for arrow tips.
 *
 * Cannot be instantiated directly — use one of the pre-defined subclasses
 * or create a custom one.
 */
export abstract class ArrowTip extends VMobject {
  startAngle: number = PI;

  constructor(options: VMobjectOptions = {}) {
    super(options);
    if (new.target === ArrowTip) {
      throw new Error("Has to be implemented in inheriting subclasses.");
    }
  }

  get base(): Point3D {
    return getBase(this);
  }

  get tipPoint(): Point3D {
    return getTipPoint(this);
  }

  get vector(): Point3D {
    return getTipVector(this);
  }

  get tipAngle(): number {
    return getTipAngle(this);
  }

  get length(): number {
    return getTipLength(this);
  }
}

// ── StealthTip ─────────────────────────────────────────────────

export interface StealthTipOptions extends VMobjectOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  length?: number;
  startAngle?: number;
}

/**
 * 'Stealth' fighter / kite arrow shape.
 *
 * Naming is inspired by the corresponding TikZ arrow shape.
 */
export class StealthTip extends VMobject {
  startAngle: number;

  constructor(options: StealthTipOptions = {}) {
    const fillOpacity = options.fillOpacity ?? 1;
    const strokeWidth = options.strokeWidth ?? 3;
    const tipLength = options.length ?? DEFAULT_ARROW_TIP_LENGTH / 2;

    super({
      ...options,
      fillOpacity,
      strokeWidth,
    });

    this.startAngle = options.startAngle ?? PI;

    // Build the stealth shape as corners
    const corners = [
      np.array([2, 0, 0]),   // tip
      np.array([-1.2, 1.6, 0]),
      np.array([0, 0, 0]),   // base
      np.array([-1.2, -1.6, 0]),
      np.array([2, 0, 0]),   // close path, back to tip
    ];

    this.clearPoints();
    this.startNewPath(corners[0]);
    for (let i = 1; i < corners.length; i++) {
      this.addLineTo(corners[i]);
    }

    const currentLength = this.length;
    if (currentLength > 0) {
      this.scale(tipLength / currentLength);
    }
  }

  // ── ArrowTip properties ──

  get base(): Point3D {
    return getBase(this);
  }

  get tipPoint(): Point3D {
    return getTipPoint(this);
  }

  get vector(): Point3D {
    return getTipVector(this);
  }

  get tipAngle(): number {
    return getTipAngle(this);
  }

  get length(): number {
    // For StealthTip, the length is computed as the height of
    // the triangle encompassing the stealth tip.
    return (np.linalg.norm(getTipVector(this)) as number) * 1.6;
  }
}

// ── ArrowTriangleTip ───────────────────────────────────────────

export interface ArrowTriangleTipOptions extends VMobjectOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  length?: number;
  width?: number;
  startAngle?: number;
}

/**
 * Triangular arrow tip.
 */
export class ArrowTriangleTip extends Triangle {
  startAngle: number;

  constructor(options: ArrowTriangleTipOptions = {}) {
    const fillOpacity = options.fillOpacity ?? 0;
    const strokeWidth = options.strokeWidth ?? 3;
    const tipLength = options.length ?? DEFAULT_ARROW_TIP_LENGTH;
    const tipWidth = options.width ?? DEFAULT_ARROW_TIP_LENGTH;
    const startAngle = options.startAngle ?? PI;

    super({
      ...options,
      fillOpacity,
      strokeWidth,
    });

    this.startAngle = startAngle;
    this.width = tipWidth;
    this.stretchToFitWidth(tipLength);
    this.stretchToFitHeight(tipWidth);
  }

  // ── ArrowTip properties ──

  get base(): Point3D {
    return getBase(this);
  }

  get tipPoint(): Point3D {
    return getTipPoint(this);
  }

  get vector(): Point3D {
    return getTipVector(this);
  }

  get tipAngle(): number {
    return getTipAngle(this);
  }

  get tipLength(): number {
    return getTipLength(this);
  }
}

// ── ArrowTriangleFilledTip ─────────────────────────────────────

/**
 * Triangular arrow tip with filled tip.
 * This is the default arrow tip shape.
 */
export class ArrowTriangleFilledTip extends ArrowTriangleTip {
  constructor(options: ArrowTriangleTipOptions = {}) {
    super({
      fillOpacity: 1,
      strokeWidth: 0,
      ...options,
    });
  }
}

// ── ArrowCircleTip ─────────────────────────────────────────────

export interface ArrowCircleTipOptions extends VMobjectOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  length?: number;
  startAngle?: number;
}

/**
 * Circular arrow tip.
 */
export class ArrowCircleTip extends Circle {
  startAngle: number;

  constructor(options: ArrowCircleTipOptions = {}) {
    const fillOpacity = options.fillOpacity ?? 0;
    const strokeWidth = options.strokeWidth ?? 3;
    const tipLength = options.length ?? DEFAULT_ARROW_TIP_LENGTH;

    super({
      ...options,
      fillOpacity,
      strokeWidth,
    });

    this.startAngle = options.startAngle ?? PI;
    this.width = tipLength;
    this.stretchToFitHeight(tipLength);
  }

  // ── ArrowTip properties ──

  get base(): Point3D {
    return getBase(this);
  }

  get tipPoint(): Point3D {
    return getTipPoint(this);
  }

  get vector(): Point3D {
    return getTipVector(this);
  }

  get tipAngle(): number {
    return getTipAngle(this);
  }

  get length(): number {
    return getTipLength(this);
  }
}

// ── ArrowCircleFilledTip ───────────────────────────────────────

/**
 * Circular arrow tip with filled tip.
 */
export class ArrowCircleFilledTip extends ArrowCircleTip {
  constructor(options: ArrowCircleTipOptions = {}) {
    super({
      fillOpacity: 1,
      strokeWidth: 0,
      ...options,
    });
  }
}

// ── ArrowSquareTip ─────────────────────────────────────────────

export interface ArrowSquareTipOptions extends VMobjectOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  length?: number;
  startAngle?: number;
}

/**
 * Square arrow tip.
 */
export class ArrowSquareTip extends Square {
  startAngle: number;

  constructor(options: ArrowSquareTipOptions = {}) {
    const fillOpacity = options.fillOpacity ?? 0;
    const strokeWidth = options.strokeWidth ?? 3;
    const tipLength = options.length ?? DEFAULT_ARROW_TIP_LENGTH;

    super({
      ...options,
      fillOpacity,
      strokeWidth,
      sideLength: tipLength,
    });

    this.startAngle = options.startAngle ?? PI;
    this.width = tipLength;
    this.stretchToFitHeight(tipLength);
  }

  // ── ArrowTip properties ──

  get base(): Point3D {
    return getBase(this);
  }

  get tipPoint(): Point3D {
    return getTipPoint(this);
  }

  get vector(): Point3D {
    return getTipVector(this);
  }

  get tipAngle(): number {
    return getTipAngle(this);
  }

  get length(): number {
    return getTipLength(this);
  }
}

// ── ArrowSquareFilledTip ───────────────────────────────────────

/**
 * Square arrow tip with filled tip.
 */
export class ArrowSquareFilledTip extends ArrowSquareTip {
  constructor(options: ArrowSquareTipOptions = {}) {
    super({
      fillOpacity: 1,
      strokeWidth: 0,
      ...options,
    });
  }
}
