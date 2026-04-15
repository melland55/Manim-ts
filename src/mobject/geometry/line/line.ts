/**
 * Mobjects that are lines or variations of them.
 *
 * TypeScript port of manim/mobject/geometry/line.py
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  PI,
  ORIGIN,
  UP,
  RIGHT,
  LEFT,
  OUT,
} from "../../../core/math/index.js";
import { VMobject, VGroup } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { Mobject, Group } from "../../mobject/index.js";
import {
  TipableVMobject,
  Arc,
  ArcBetweenPoints,
  Dot,
} from "../arc/index.js";
import type {
  TipableVMobjectOptions,
} from "../arc/index.js";
import {
  ArrowTip,
  ArrowTriangleFilledTip,
} from "../tips/index.js";
import {
  DEFAULT_DASH_LENGTH,
  MED_SMALL_BUFF,
  DEGREES,
} from "../../../constants/index.js";
import {
  angleOfVector,
  lineIntersection,
  normalize,
} from "../../../utils/space_ops/index.js";
import {
  WHITE,
} from "../../../utils/color/manim_colors.js";
import type { ParsableManimColor } from "../../../utils/color/index.js";
import type { IColor } from "../../../core/types.js";

// ── Helpers ────────────────────────────────────────────────────

/**
 * Duck-type a value as a "point-like" (point or mobject) vs a plain options
 * object, for constructor overload discrimination.
 *
 * A point-like arg is: a Mobject, a plain number[], or an NDArray (detected
 * via presence of a `.get` method). Note: `"shape" in x` is unreliable for
 * numpy-ts NDArrays, which are Proxy objects whose `has` trap does not
 * expose `shape` — relying on it made `new Line(np.array(...), np.array(...))`
 * silently fall through to the defaults-only branch.
 */
function isPointLike(x: unknown): boolean {
  if (x === null || x === undefined) return false;
  if (x instanceof Mobject) return true;
  if (Array.isArray(x)) return true;
  if (typeof x === "object" &&
      typeof (x as { get?: unknown }).get === "function") return true;
  return false;
}

/** Extract row i from an [n, 3] NDArray as a Point3D. */
function getRow(pts: NDArray, i: number): Point3D {
  return np.array([
    pts.get([i, 0]) as number,
    pts.get([i, 1]) as number,
    pts.get([i, 2]) as number,
  ]);
}

// ── Type aliases ──────────────────────────────────────────────

type AngleQuadrant = [(-1 | 1), (-1 | 1)];

// ── DashedVMobject helper ─────────────────────────────────────
// Minimal implementation that creates dashed copies of a VMobject.
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once DashedVMobject is exported

function createDashedVMobject(
  vmobject: VMobject,
  numDashes: number,
  dashedRatio: number,
): VMobject[] {
  if (numDashes < 1) return [];

  const r = dashedRatio;
  const n = numDashes;

  // Mirror Python Manim's DashedVMobject (mobject/types/vectorized_mobject.py).
  // For open curves (like Line) the dashes are anchored at both ends:
  //   dash_len  = r / n
  //   void_len  = (1 - r) / (n - 1)  (for n > 1; else 1 - r)
  // This produces dashes at 0, period, 2*period, ... with the last dash
  // ending exactly at t = 1. Our previous implementation used
  // void_len = (1 - r) / n, which left a gap at the end of the line and
  // caused a phase drift vs Python.
  const dashLen = r / n;
  let voidLen: number;
  if (n === 1) {
    voidLen = 1 - r;
  } else {
    voidLen = (1 - r) / (n - 1);
  }
  const period = dashLen + voidLen;

  const dashes: VMobject[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * period;
    const b = Math.min(a + dashLen, 1);
    const dash = new VMobject();
    const startPt = vmobject.pointFromProportion(Math.min(Math.max(a, 0), 1));
    const endPt = vmobject.pointFromProportion(b);
    dash.startNewPath(startPt);
    dash.addLineTo(endPt);
    dash.strokeColor = vmobject.strokeColor;
    dash.strokeWidth = vmobject.strokeWidth;
    dash.strokeOpacity = vmobject.strokeOpacity;
    dashes.push(dash);
  }
  return dashes;
}

// ── Line ──────────────────────────────────────────────────────

export interface LineOptions extends TipableVMobjectOptions {
  start?: Point3D | number[] | Mobject;
  end?: Point3D | number[] | Mobject;
  buff?: number;
  pathArc?: number;
}

/**
 * A straight or curved line segment between two points or mobjects.
 */
export class Line extends TipableVMobject {
  dim: number;
  buff: number;
  pathArc: number;
  start!: Point3D;
  end!: Point3D;

  constructor(
    startOrOptions?: Point3D | number[] | Mobject | LineOptions,
    end?: Point3D | number[] | Mobject,
    options: LineOptions = {},
  ) {
    // Handle overloaded call patterns:
    //   new Line(start, end, options?)
    //   new Line(options?)
    let startArg: Point3D | number[] | Mobject;
    let endArg: Point3D | number[] | Mobject;
    let opts: LineOptions;

    if (isPointLike(startOrOptions)) {
      // Called as new Line(start, end, options?)
      startArg = startOrOptions as Point3D | number[] | Mobject;
      endArg = end ?? RIGHT;
      opts = options;
    } else {
      // Called as new Line(options?) or new Line()
      opts = (startOrOptions as LineOptions | undefined) ?? {};
      startArg = opts.start ?? LEFT;
      endArg = opts.end ?? RIGHT;
    }

    const buff = opts.buff ?? 0;
    const pathArc = opts.pathArc ?? 0;

    // Initialize start/end before super() by computing them
    // We need to set these before super() calls generatePoints
    // But super() must be called first in TS. So we set dummy values
    // and let generatePoints fill them in.

    // We must set properties before super() is called since TipableVMobject
    // constructor doesn't call generatePoints. We'll call it manually.
    const superOpts: TipableVMobjectOptions = { ...opts };
    delete (superOpts as Record<string, unknown>).start;
    delete (superOpts as Record<string, unknown>).end;
    delete (superOpts as Record<string, unknown>).buff;
    delete (superOpts as Record<string, unknown>).pathArc;

    // Temporarily set to dummy values — will be overwritten immediately
    // super() in TipableVMobject won't generate points (no generatePoints called)
    super(superOpts);

    this.dim = 3;
    this.buff = buff;
    this.pathArc = pathArc;

    // Set start/end attributes from the inputs
    this._setStartAndEndAttrs(startArg, endArg);

    // Generate points now
    this.generatePoints();
  }

  generatePoints(): void {
    // Guard: super() calls generatePoints before Line's constructor sets start/end
    if (this.start === undefined || this.end === undefined) return;
    this.setPointsByEnds(
      this.start,
      this.end,
      this.buff,
      this.pathArc,
    );
  }

  setPointsByEnds(
    start: Point3D | number[] | Mobject,
    end: Point3D | number[] | Mobject,
    buff = 0,
    pathArc = 0,
  ): void {
    this._setStartAndEndAttrs(start, end);
    if (pathArc) {
      const arc = new ArcBetweenPoints(this.start, this.end, { angle: this.pathArc });
      this.points = arc.points;
    } else {
      this._setPointsAsCorners([this.start, this.end]);
    }

    this._accountForBuff(buff);
  }

  initPoints(): void {
    this.generatePoints();
  }

  private _accountForBuff(buff: number): void {
    if (buff <= 0) return;
    const length = this.pathArc === 0 ? this.getLength() : this.getArcLength();
    if (length < 2 * buff) return;
    const buffProportion = buff / length;
    this._pointwiseBecomePartialSimple(buffProportion, 1 - buffProportion);
  }

  /**
   * Simple implementation of pointwiseBecomePartial for Line.
   * Trims the line to the proportion range [a, b].
   */
  private _pointwiseBecomePartialSimple(a: number, b: number): void {
    const n = this.getNumPoints();
    if (n < 4) return;

    // For a straight line (4 points = 1 cubic segment), interpolate
    const nSegs = Math.floor((n - 1) / 3);
    if (nSegs <= 0) return;

    const newPoints: number[][] = [];
    const totalSegs = nSegs;

    // Map a, b to segment space
    for (let seg = 0; seg < totalSegs; seg++) {
      const segStart = seg / totalSegs;
      const segEnd = (seg + 1) / totalSegs;

      // Skip segments entirely outside [a, b]
      if (segEnd <= a || segStart >= b) continue;

      // Clamp to [a, b]
      const t0 = Math.max(0, (a - segStart) / (segEnd - segStart));
      const t1 = Math.min(1, (b - segStart) / (segEnd - segStart));

      const baseIdx = seg * 3;
      const p0 = this._getPointArr(baseIdx);
      const p1 = this._getPointArr(baseIdx + 1);
      const p2 = this._getPointArr(baseIdx + 2);
      const p3 = this._getPointArr(baseIdx + 3);

      // De Casteljau split at t0 and t1
      const sub = subdivideCubic(p0, p1, p2, p3, t0, t1);
      if (newPoints.length === 0) {
        newPoints.push(sub[0], sub[1], sub[2], sub[3]);
      } else {
        newPoints.push(sub[1], sub[2], sub[3]);
      }
    }

    if (newPoints.length > 0) {
      this.clearPoints();
      this.startNewPath(np.array(newPoints[0]) as Point3D);
      for (let i = 1; i + 2 < newPoints.length; i += 3) {
        this.addCubicBezierCurveTo(
          np.array(newPoints[i]) as Point3D,
          np.array(newPoints[i + 1]) as Point3D,
          np.array(newPoints[i + 2]) as Point3D,
        );
      }
    }
  }

  private _getPointArr(idx: number): number[] {
    return [
      this.points.get([idx, 0]) as number,
      this.points.get([idx, 1]) as number,
      this.points.get([idx, 2]) as number,
    ];
  }

  private _setStartAndEndAttrs(
    start: Point3D | number[] | Mobject,
    end: Point3D | number[] | Mobject,
  ): void {
    const roughStart = this._pointify(start);
    const roughEnd = this._pointify(end);
    const vect = normalize(
      (roughEnd as NDArray).subtract(roughStart) as NDArray,
    );
    this.start = this._pointify(start, vect);
    this.end = this._pointify(end, (vect as NDArray).multiply(-1) as NDArray);
  }

  private _pointify(
    mobOrPoint: Mobject | Point3D | number[],
    direction?: NDArray | null,
  ): Point3D {
    if (mobOrPoint instanceof Mobject) {
      if (direction === undefined || direction === null) {
        return mobOrPoint.getCenter();
      } else {
        return mobOrPoint.getBoundaryPoint(direction as Point3D);
      }
    }
    if (Array.isArray(mobOrPoint)) {
      return np.array(mobOrPoint) as Point3D;
    }
    // Already an NDArray (Point3D)
    return mobOrPoint as Point3D;
  }

  /**
   * Set points as straight-line corners (each pair connected by a degenerate cubic).
   */
  private _setPointsAsCorners(corners: (Point3D | number[])[]): void {
    this.clearPoints();
    if (corners.length < 2) return;
    const first = Array.isArray(corners[0]) ? np.array(corners[0]) : corners[0];
    this.startNewPath(first as Point3D);
    for (let i = 1; i < corners.length; i++) {
      const pt = Array.isArray(corners[i]) ? np.array(corners[i]) : corners[i];
      this.addLineTo(pt as Point3D);
    }
  }

  setPathArc(newValue: number): void {
    this.pathArc = newValue;
    this.initPoints();
  }

  putStartAndEndOn(start: Point3D | number[], end: Point3D | number[]): this {
    const startPt = Array.isArray(start) ? np.array(start) as Point3D : start;
    const endPt = Array.isArray(end) ? np.array(end) as Point3D : end;

    const [currStart, currEnd] = this.getStartAndEnd();
    const diff = (currStart as NDArray).subtract(currEnd);
    const allZero = (diff.toArray() as number[]).every((v) => Math.abs(v) < 1e-15);
    if (allZero) {
      this.start = startPt;
      this.end = endPt;
      this.generatePoints();
    }
    return super.putStartAndEndOn(startPt, endPt);
  }

  getVector(): NDArray {
    return (this.getEnd() as NDArray).subtract(this.getStart()) as NDArray;
  }

  getUnitVector(): NDArray {
    return normalize(this.getVector());
  }

  getAngle(): number {
    return angleOfVector(this.getVector()) as number;
  }

  getProjection(point: Point3D | number[]): Point3D {
    const pt = Array.isArray(point) ? np.array(point) : point;
    const start = this.getStart();
    const end = this.getEnd();
    const unitVect = normalize((end as NDArray).subtract(start) as NDArray);
    const d = np.dot((pt as NDArray).subtract(start), unitVect) as number;
    return (start as NDArray).add(unitVect.multiply(d)) as Point3D;
  }

  getSlope(): number {
    return Math.tan(this.getAngle());
  }

  setAngle(angle: number, aboutPoint?: Point3D | number[]): this {
    let pt: Point3D;
    if (aboutPoint === undefined) {
      pt = this.getStart();
    } else {
      pt = Array.isArray(aboutPoint) ? np.array(aboutPoint) as Point3D : aboutPoint;
    }
    this.rotate(angle - this.getAngle(), undefined, { aboutPoint: pt });
    return this;
  }

  setLength(length: number): this {
    const scaleFactor = length / this.getLength();
    return this.scale(scaleFactor);
  }
}

// ── DashedLine ────────────────────────────────────────────────

export interface DashedLineOptions extends LineOptions {
  dashLength?: number;
  dashedRatio?: number;
}

/**
 * A dashed Line.
 */
export class DashedLine extends Line {
  dashLength: number;
  dashedRatio: number;

  constructor(
    startOrOptions?: Point3D | number[] | Mobject | DashedLineOptions,
    end?: Point3D | number[] | Mobject,
    options: DashedLineOptions = {},
  ) {
    // Extract dash-specific options
    let opts: DashedLineOptions;
    if (isPointLike(startOrOptions)) {
      opts = options;
    } else {
      opts = (startOrOptions as DashedLineOptions | undefined) ?? {};
    }

    const dashLength = opts.dashLength ?? DEFAULT_DASH_LENGTH;
    const dashedRatio = opts.dashedRatio ?? 0.5;

    // Remove dash options before passing to Line
    const lineOpts = { ...opts };
    delete (lineOpts as Record<string, unknown>).dashLength;
    delete (lineOpts as Record<string, unknown>).dashedRatio;

    if (isPointLike(startOrOptions)) {
      super(startOrOptions as Point3D | number[] | Mobject, end, lineOpts);
    } else {
      super(lineOpts);
    }

    this.dashLength = dashLength;
    this.dashedRatio = dashedRatio;

    const numDashes = this._calculateNumDashes();
    const dashes = createDashedVMobject(this, numDashes, dashedRatio);
    this.clearPoints();
    for (const dash of dashes) {
      this.add(dash);
    }
  }

  private _calculateNumDashes(): number {
    return Math.max(
      2,
      Math.ceil((this.getLength() / this.dashLength) * this.dashedRatio),
    );
  }

  override getStart(): Point3D {
    if (this.submobjects.length > 0) {
      return this.submobjects[0].getStart();
    }
    return super.getStart();
  }

  override getEnd(): Point3D {
    if (this.submobjects.length > 0) {
      return this.submobjects[this.submobjects.length - 1].getEnd();
    }
    return super.getEnd();
  }

  getFirstHandle(): Point3D {
    return getRow(this.submobjects[0].points, 1);
  }

  getLastHandle(): Point3D {
    const lastSub = this.submobjects[this.submobjects.length - 1];
    return getRow(lastSub.points, 2);
  }
}

// ── TangentLine ───────────────────────────────────────────────

export interface TangentLineOptions extends LineOptions {
  length?: number;
  dAlpha?: number;
}

/**
 * Constructs a line tangent to a VMobject at a specific point.
 */
export class TangentLine extends Line {
  tangentLength: number;
  dAlpha: number;

  constructor(
    vmob: VMobject,
    alpha: number,
    options: TangentLineOptions = {},
  ) {
    const length = options.length ?? 1;
    const dAlpha = options.dAlpha ?? 1e-6;

    const a1 = Math.max(alpha - dAlpha, 0);
    const a2 = Math.min(alpha + dAlpha, 1);

    const lineOpts = { ...options };
    delete (lineOpts as Record<string, unknown>).length;
    delete (lineOpts as Record<string, unknown>).dAlpha;

    super(
      vmob.pointFromProportion(a1),
      vmob.pointFromProportion(a2),
      lineOpts,
    );

    this.tangentLength = length;
    this.dAlpha = dAlpha;

    const currentLength = this.getLength();
    if (currentLength > 0) {
      this.scale(this.tangentLength / currentLength);
    }
  }
}

// ── Elbow ─────────────────────────────────────────────────────

export interface ElbowOptions extends VMobjectOptions {
  width?: number;
  angle?: number;
}

/**
 * Two lines that create a right angle about each other: L-shape.
 */
export class Elbow extends VMobject {
  elbowAngle: number;

  constructor(options: ElbowOptions = {}) {
    super(options);
    this.elbowAngle = options.angle ?? 0;
    const width = options.width ?? 0.2;

    this._setPointsAsCorners([UP, (UP as NDArray).add(RIGHT) as Point3D, RIGHT as Point3D]);
    this.scaleToFitWidth(width, { aboutPoint: ORIGIN as Point3D });
    this.rotate(this.elbowAngle, undefined, { aboutPoint: ORIGIN as Point3D });
  }

  private _setPointsAsCorners(corners: (Point3D | NDArray)[]): void {
    this.clearPoints();
    if (corners.length < 2) return;
    this.startNewPath(corners[0] as Point3D);
    for (let i = 1; i < corners.length; i++) {
      this.addLineTo(corners[i] as Point3D);
    }
  }
}

// ── Arrow ─────────────────────────────────────────────────────

export interface ArrowOptions extends LineOptions {
  strokeWidth?: number;
  maxTipLengthToLengthRatio?: number;
  maxStrokeWidthToLengthRatio?: number;
  tipShape?: new (opts: Record<string, unknown>) => ArrowTip;
}

/**
 * An arrow.
 */
export class Arrow extends Line {
  maxTipLengthToLengthRatio: number;
  maxStrokeWidthToLengthRatio: number;
  initialStrokeWidth: number;

  constructor(
    startOrOptions?: Point3D | number[] | Mobject | ArrowOptions,
    end?: Point3D | number[] | Mobject,
    options: ArrowOptions = {},
  ) {
    // Parse options to extract Arrow-specific params
    let opts: ArrowOptions;
    let startArg: Point3D | number[] | Mobject | undefined;
    let endArg: Point3D | number[] | Mobject | undefined;

    if (isPointLike(startOrOptions)) {
      opts = options;
      startArg = startOrOptions as Point3D | number[] | Mobject;
      endArg = end;
    } else {
      opts = (startOrOptions as ArrowOptions | undefined) ?? {};
      startArg = undefined;
      endArg = undefined;
    }

    const maxTipLengthToLengthRatio = opts.maxTipLengthToLengthRatio ?? 0.25;
    const maxStrokeWidthToLengthRatio = opts.maxStrokeWidthToLengthRatio ?? 5;
    const tipShape = opts.tipShape ?? ArrowTriangleFilledTip;
    const strokeWidth = opts.strokeWidth ?? 6;

    // Build line options
    const lineOpts: LineOptions = { ...opts };
    delete (lineOpts as Record<string, unknown>).maxTipLengthToLengthRatio;
    delete (lineOpts as Record<string, unknown>).maxStrokeWidthToLengthRatio;
    delete (lineOpts as Record<string, unknown>).tipShape;

    if (lineOpts.buff === undefined) {
      lineOpts.buff = MED_SMALL_BUFF;
    }
    (lineOpts as VMobjectOptions).strokeWidth = strokeWidth;

    if (startArg !== undefined) {
      super(startArg, endArg, lineOpts);
    } else {
      super(lineOpts);
    }

    this.maxTipLengthToLengthRatio = maxTipLengthToLengthRatio;
    this.maxStrokeWidthToLengthRatio = maxStrokeWidthToLengthRatio;
    this.initialStrokeWidth = this.strokeWidth;

    this.addTip({ tipShape: tipShape as unknown as new (opts: Record<string, unknown>) => ArrowTip });
    this._setStrokeWidthFromLength();
  }

  override scale(
    factor: number,
    scaleOrOptions?: boolean | { aboutPoint?: Point3D; aboutEdge?: Point3D },
  ): this {
    const scaleTips = typeof scaleOrOptions === "boolean" ? scaleOrOptions : false;
    const scaleOpts = typeof scaleOrOptions === "object" ? scaleOrOptions : undefined;

    if (this._getSafeLength() === 0) return this;

    if (scaleTips) {
      super.scale(factor, scaleOpts);
      this._setStrokeWidthFromLength();
      return this;
    }

    const hasTipFlag = this.hasTip();
    const hasStartTipFlag = this.hasStartTip();
    let oldTips: Group | undefined;
    if (hasTipFlag || hasStartTipFlag) {
      oldTips = this.popTips();
    }

    super.scale(factor, scaleOpts);
    this._setStrokeWidthFromLength();

    if (hasTipFlag && oldTips) {
      this.addTip({ tip: oldTips.submobjects[0] as ArrowTip });
    }
    if (hasStartTipFlag && oldTips) {
      const idx = hasTipFlag ? 1 : 0;
      this.addTip({ tip: oldTips.submobjects[idx] as ArrowTip, atStart: true });
    }
    return this;
  }

  getNormalVector(): NDArray {
    const startAnchors = this.tip!.getAnchors();
    const p0 = getRow(startAnchors, 0);
    const p1 = getRow(startAnchors, 1);
    const p2 = getRow(startAnchors, 2);
    const diff1 = (p2 as NDArray).subtract(p1) as NDArray;
    const diff2 = (p1 as NDArray).subtract(p0) as NDArray;
    return normalize(np.cross(diff1, diff2) as NDArray);
  }

  resetNormalVector(): this {
    (this as Record<string, unknown>).normalVector = this.getNormalVector();
    return this;
  }

  override getDefaultTipLength(): number {
    const maxRatio = this.maxTipLengthToLengthRatio;
    return Math.min(this.tipLength, maxRatio * this._getSafeLength());
  }

  /**
   * Get length safely, falling back to raw point distance if tip getStart fails.
   */
  private _getSafeLength(): number {
    try {
      return this.getLength();
    } catch {
      // Fallback: compute from raw points if tip.getStart() fails
      const n = this.points.shape[0];
      if (n === 0) return 0;
      const start = getRow(this.points, 0);
      const end = getRow(this.points, n - 1);
      return np.linalg.norm((start as NDArray).subtract(end)) as number;
    }
  }

  private _setStrokeWidthFromLength(): this {
    const maxRatio = this.maxStrokeWidthToLengthRatio;
    const len = this._getSafeLength();
    this.setStroke(
      undefined,
      Math.min(this.initialStrokeWidth, maxRatio * len),
    );
    return this;
  }
}

// ── Vector ────────────────────────────────────────────────────

export interface VectorOptions extends ArrowOptions {
  direction?: Point3D | number[];
}

/**
 * A vector specialized for use in graphs.
 */
export class Vector extends Arrow {
  constructor(
    directionOrOptions?: Point3D | number[] | VectorOptions,
    options: VectorOptions = {},
  ) {
    let direction: number[];
    let opts: VectorOptions;

    if (isPointLike(directionOrOptions)) {
      opts = options;
      direction = Array.isArray(directionOrOptions)
        ? directionOrOptions
        : ((directionOrOptions as NDArray).toArray() as number[]);
    } else {
      opts = (directionOrOptions as VectorOptions | undefined) ?? {};
      const dir = opts.direction ?? RIGHT;
      direction = Array.isArray(dir) ? dir : (dir.toArray() as number[]);
    }

    if (direction.length === 2) {
      direction = [...direction, 0];
    }

    const arrowOpts: ArrowOptions = { ...opts };
    delete (arrowOpts as Record<string, unknown>).direction;
    arrowOpts.buff = arrowOpts.buff ?? 0;

    super(
      np.array([0, 0, 0]) as Point3D,
      np.array(direction) as Point3D,
      arrowOpts,
    );
  }

  // coordinate_label depends on Matrix mobject which may not be converted yet
  // TODO: Implement coordinateLabel once Matrix mobject is available
}

// ── DoubleArrow ───────────────────────────────────────────────

export interface DoubleArrowOptions extends ArrowOptions {
  tipShapeEnd?: new (opts: Record<string, unknown>) => ArrowTip;
  tipShapeStart?: new (opts: Record<string, unknown>) => ArrowTip;
}

/**
 * An arrow with tips on both ends.
 */
export class DoubleArrow extends Arrow {
  constructor(
    startOrOptions?: Point3D | number[] | Mobject | DoubleArrowOptions,
    end?: Point3D | number[] | Mobject,
    options: DoubleArrowOptions = {},
  ) {
    let opts: DoubleArrowOptions;
    if (isPointLike(startOrOptions)) {
      opts = options;
    } else {
      opts = (startOrOptions as DoubleArrowOptions | undefined) ?? {};
    }

    // Handle tip shape options
    const arrowOpts: ArrowOptions = { ...opts };
    if (opts.tipShapeEnd !== undefined) {
      arrowOpts.tipShape = opts.tipShapeEnd;
    }
    const tipShapeStart = opts.tipShapeStart ?? ArrowTriangleFilledTip;
    delete (arrowOpts as Record<string, unknown>).tipShapeEnd;
    delete (arrowOpts as Record<string, unknown>).tipShapeStart;

    if (isPointLike(startOrOptions)) {
      super(startOrOptions as Point3D | number[] | Mobject, end, arrowOpts);
    } else {
      super(arrowOpts);
    }

    this.addTip({ atStart: true, tipShape: tipShapeStart as unknown as new (opts: Record<string, unknown>) => ArrowTip });
  }
}

// ── Angle ─────────────────────────────────────────────────────

export interface AngleOptions extends VMobjectOptions {
  radius?: number | null;
  quadrant?: AngleQuadrant;
  otherAngle?: boolean;
  dot?: boolean;
  dotRadius?: number | null;
  dotDistance?: number;
  dotColor?: ParsableManimColor;
  elbow?: boolean;
}

/**
 * A circular arc or elbow-type mobject representing an angle of two lines.
 */
export class Angle extends VMobject {
  lines: [Line, Line];
  quadrant: AngleQuadrant;
  dotDistance: number;
  elbow: boolean;
  angleValue: number;
  radius: number;
  dotRadius?: number;

  constructor(
    line1: Line,
    line2: Line,
    options: AngleOptions = {},
  ) {
    super(options);
    this.lines = [line1, line2];
    this.quadrant = options.quadrant ?? [1, 1];
    this.dotDistance = options.dotDistance ?? 0.55;
    this.elbow = options.elbow ?? false;
    this.angleValue = 0;

    const inter = lineIntersection(
      [line1.getStart(), line1.getEnd()],
      [line2.getStart(), line2.getEnd()],
    );

    let radius = options.radius ?? null;

    if (radius === null || radius === undefined) {
      let dist1: number;
      if (this.quadrant[0] === 1) {
        dist1 = np.linalg.norm((line1.getEnd() as NDArray).subtract(inter)) as number;
      } else {
        dist1 = np.linalg.norm((line1.getStart() as NDArray).subtract(inter)) as number;
      }
      let dist2: number;
      if (this.quadrant[1] === 1) {
        dist2 = np.linalg.norm((line2.getEnd() as NDArray).subtract(inter)) as number;
      } else {
        dist2 = np.linalg.norm((line2.getStart() as NDArray).subtract(inter)) as number;
      }
      const minDist = Math.min(dist1, dist2);
      if (minDist < 0.6) {
        radius = (2 / 3) * minDist;
      } else {
        radius = 0.4;
      }
    }
    this.radius = radius;

    const anchorAngle1 = (inter as NDArray).add(
      line1.getUnitVector().multiply(this.quadrant[0] * radius),
    ) as Point3D;
    const anchorAngle2 = (inter as NDArray).add(
      line2.getUnitVector().multiply(this.quadrant[1] * radius),
    ) as Point3D;

    let angleMobject: VMobject;

    if (this.elbow) {
      const anchorMiddle = (inter as NDArray)
        .add(line1.getUnitVector().multiply(this.quadrant[0] * radius))
        .add(line2.getUnitVector().multiply(this.quadrant[1] * radius)) as Point3D;

      angleMobject = new Elbow(options);
      // Set points as corners
      angleMobject.clearPoints();
      angleMobject.startNewPath(anchorAngle1);
      angleMobject.addLineTo(anchorMiddle);
      angleMobject.addLineTo(anchorAngle2);
    } else {
      const angle1 = angleOfVector(
        (anchorAngle1 as NDArray).subtract(inter) as NDArray,
      ) as number;
      const angle2 = angleOfVector(
        (anchorAngle2 as NDArray).subtract(inter) as NDArray,
      ) as number;

      let startAngle: number;
      let angleFin: number;
      const otherAngle = options.otherAngle ?? false;

      if (!otherAngle) {
        startAngle = angle1;
        if (angle2 > angle1) {
          angleFin = angle2 - angle1;
        } else {
          angleFin = 2 * PI - (angle1 - angle2);
        }
      } else {
        startAngle = angle1;
        if (angle2 < angle1) {
          angleFin = -angle1 + angle2;
        } else {
          angleFin = -2 * PI + (angle2 - angle1);
        }
      }

      this.angleValue = angleFin;

      angleMobject = new Arc({
        radius,
        angle: this.angleValue,
        startAngle,
        arcCenter: inter,
        ...options,
      });

      if (options.dot) {
        let dotRadius = options.dotRadius ?? null;
        if (dotRadius === null) {
          dotRadius = radius / 10;
        }
        this.dotRadius = dotRadius;
        const dotColor = options.dotColor ?? WHITE;

        const rightDot = new Dot({ point: ORIGIN, radius: dotRadius, color: dotColor as IColor });
        const arcCenter = angleMobject.getCenter();
        const diff = (arcCenter as NDArray).subtract(inter) as NDArray;
        const diffNorm = np.linalg.norm(diff) as number;
        let dotAnchor: Point3D;
        if (diffNorm > 0) {
          dotAnchor = (inter as NDArray).add(
            diff.divide(diffNorm).multiply(radius * this.dotDistance),
          ) as Point3D;
        } else {
          dotAnchor = inter as Point3D;
        }
        rightDot.moveTo(dotAnchor);
        this.add(rightDot);
      }
    }

    this.points = angleMobject.points;
  }

  getLines(): VGroup {
    return new VGroup(...this.lines);
  }

  getValue(degrees = false): number {
    return degrees ? this.angleValue / DEGREES : this.angleValue;
  }

  static fromThreePoints(
    A: Point3D | number[],
    B: Point3D | number[],
    C: Point3D | number[],
    options: AngleOptions = {},
  ): Angle {
    const bPt = Array.isArray(B) ? np.array(B) as Point3D : B;
    const aPt = Array.isArray(A) ? np.array(A) as Point3D : A;
    const cPt = Array.isArray(C) ? np.array(C) as Point3D : C;
    return new Angle(
      new Line(bPt, aPt),
      new Line(bPt, cPt),
      options,
    );
  }
}

// ── RightAngle ────────────────────────────────────────────────

export interface RightAngleOptions extends AngleOptions {
  length?: number | null;
}

/**
 * An elbow-type mobject representing a right angle between two lines.
 */
export class RightAngle extends Angle {
  constructor(
    line1: Line,
    line2: Line,
    options: RightAngleOptions = {},
  ) {
    const angleOpts: AngleOptions = { ...options };
    angleOpts.radius = options.length ?? angleOpts.radius;
    angleOpts.elbow = true;
    delete (angleOpts as Record<string, unknown>).length;
    super(line1, line2, angleOpts);
  }
}

// ── De Casteljau subdivision helper ───────────────────────────

function lerpArr(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t);
}

/**
 * Extract the sub-cubic between parameters t0 and t1
 * using double De Casteljau split.
 */
function subdivideCubic(
  p0: number[], p1: number[], p2: number[], p3: number[],
  t0: number, t1: number,
): [number[], number[], number[], number[]] {
  // Split at t1 first to get [0..t1], then split result at t0/t1
  const [left1] = splitCubicAt(p0, p1, p2, p3, t1);
  if (t0 <= 0) return left1;
  const ratio = t0 / t1;
  const [, right] = splitCubicAt(left1[0], left1[1], left1[2], left1[3], ratio);
  return right;
}

function splitCubicAt(
  p0: number[], p1: number[], p2: number[], p3: number[],
  t: number,
): [[number[], number[], number[], number[]], [number[], number[], number[], number[]]] {
  const a = lerpArr(p0, p1, t);
  const b = lerpArr(p1, p2, t);
  const c = lerpArr(p2, p3, t);
  const d = lerpArr(a, b, t);
  const e = lerpArr(b, c, t);
  const f = lerpArr(d, e, t);
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ];
}
