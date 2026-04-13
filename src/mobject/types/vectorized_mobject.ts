/**
 * VMobject — a Mobject whose geometry is defined by cubic bezier curves.
 *
 * TypeScript port of the core rendering-relevant subset of
 * manim/mobject/types/vectorized_mobject.py.
 *
 * Point layout (per subpath, n = 3k+1):
 *   anchor₀, handle1₀, handle2₀, anchor₁, handle1₁, handle2₁, anchor₂, …
 *
 * Each cubic segment occupies indices [3i … 3i+3].
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../core/math/index.js";
import type { Point3D, Points3D } from "../../core/math/index.js";
import type { IVMobject, IColor } from "../../core/types.js";
import { WHITE, BLUE } from "../../core/color/index.js";
import { Mobject } from "../mobject/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";

// ── Helpers ────────────────────────────────────────────────────

/** Extract row i from an [n, 3] NDArray as a Point3D. */
function getRow(pts: NDArray, i: number): Point3D {
  return np.array([
    pts.get([i, 0]) as number,
    pts.get([i, 1]) as number,
    pts.get([i, 2]) as number,
  ]);
}

/** Extract rows [start..end) from an [n, 3] NDArray as a new Points3D. */
function getRows(pts: NDArray, start: number, end: number): Points3D {
  const rows: number[][] = [];
  for (let i = start; i < end; i++) {
    rows.push([
      pts.get([i, 0]) as number,
      pts.get([i, 1]) as number,
      pts.get([i, 2]) as number,
    ]);
  }
  return np.array(rows) as Points3D;
}

// ── Defaults ────────────────────────────────────────────────────

const DEFAULT_FILL_COLOR: IColor = BLUE;
const DEFAULT_FILL_OPACITY = 0.0;
const DEFAULT_STROKE_COLOR: IColor = WHITE;
const DEFAULT_STROKE_OPACITY = 1.0;
const DEFAULT_STROKE_WIDTH = 4;

export interface VMobjectOptions {
  fillColor?: IColor;
  fillOpacity?: number;
  strokeColor?: IColor;
  strokeOpacity?: number;
  strokeWidth?: number;
  color?: IColor;
}

// ── VMobject ────────────────────────────────────────────────────

// Note: We don't formally `implements IVMobject` because Mobject uses concrete
// types (MobjectUpdater[]) that differ from IVMobject's interface types (Updater[]).
// The duck-typed isVMobject() check in the renderer still works correctly.
export class VMobject extends Mobject {
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeOpacity: number;
  strokeWidth: number;

  /** Indices into `this.points` where each subpath starts. */
  private _subpathStarts: number[] = [0];

  constructor(options: VMobjectOptions = {}) {
    super({ color: options.color as ParsableManimColor | undefined });
    this.fillColor = options.fillColor ?? DEFAULT_FILL_COLOR;
    this.fillOpacity = options.fillOpacity ?? DEFAULT_FILL_OPACITY;
    this.strokeColor = options.strokeColor ?? DEFAULT_STROKE_COLOR;
    this.strokeOpacity = options.strokeOpacity ?? DEFAULT_STROKE_OPACITY;
    this.strokeWidth = options.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  }

  // ── Path construction ──────────────────────────────────────────

  startNewPath(point: Point3D): this {
    const n = this.getNumPoints();
    if (n > 0) {
      this._subpathStarts.push(n);
    }
    this._appendPoint(point);
    return this;
  }

  addLineTo(point: Point3D): this {
    const last = this._lastPoint();
    // A straight line is a degenerate cubic where handles sit at 1/3 and 2/3.
    const h1 = (last as NDArray).add(
      (point as NDArray).subtract(last).multiply(1 / 3),
    ) as Point3D;
    const h2 = (last as NDArray).add(
      (point as NDArray).subtract(last).multiply(2 / 3),
    ) as Point3D;
    return this.addCubicBezierCurveTo(h1, h2, point);
  }

  addCubicBezierCurveTo(
    handle1: Point3D,
    handle2: Point3D,
    anchor: Point3D,
  ): this {
    this._appendPoint(handle1);
    this._appendPoint(handle2);
    this._appendPoint(anchor);
    return this;
  }

  addQuadraticBezierCurveTo(handle: Point3D, anchor: Point3D): this {
    // Degree-elevate: quadratic → cubic
    const last = this._lastPoint();
    const h1 = (last as NDArray).add(
      (handle as NDArray).subtract(last).multiply(2 / 3),
    ) as Point3D;
    const h2 = (anchor as NDArray).add(
      (handle as NDArray).subtract(anchor).multiply(2 / 3),
    ) as Point3D;
    return this.addCubicBezierCurveTo(h1, h2, anchor);
  }

  closePath(): this {
    const subpathStart = this._subpathStarts[this._subpathStarts.length - 1];
    const startPoint = this._getPoint(subpathStart);
    return this.addLineTo(startPoint);
  }

  clearPoints(): this {
    this.points = np.zeros([0, this.dim]);
    this._subpathStarts = [0];
    return this;
  }

  // ── Bezier accessors ──────────────────────────────────────────

  getAnchors(): Points3D {
    const n = this.getNumPoints();
    if (n === 0) return np.zeros([0, 3]) as Points3D;
    const rows: number[][] = [];
    for (let i = 0; i < n; i += 3) {
      rows.push([
        this.points.get([i, 0]) as number,
        this.points.get([i, 1]) as number,
        this.points.get([i, 2]) as number,
      ]);
    }
    return np.array(rows) as Points3D;
  }

  getHandles(): Points3D {
    const n = this.getNumPoints();
    if (n <= 1) return np.zeros([0, 3]) as Points3D;
    const rows: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (i % 3 !== 0) {
        rows.push([
          this.points.get([i, 0]) as number,
          this.points.get([i, 1]) as number,
          this.points.get([i, 2]) as number,
        ]);
      }
    }
    return np.array(rows) as Points3D;
  }

  getSubpaths(): Points3D[] {
    const n = this.getNumPoints();
    if (n === 0) return [];

    const starts = [...this._subpathStarts];
    const result: Points3D[] = [];

    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = i + 1 < starts.length ? starts[i + 1] : n;
      if (end - start < 4) continue; // need at least one cubic (4 points)
      result.push(getRows(this.points, start, end));
    }

    return result;
  }

  getArcLength(): number {
    let total = 0;
    const anchors = this.getAnchors();
    const nAnchors = anchors.shape[0];
    for (let i = 1; i < nAnchors; i++) {
      const dx = (anchors.get([i, 0]) as number) - (anchors.get([i - 1, 0]) as number);
      const dy = (anchors.get([i, 1]) as number) - (anchors.get([i - 1, 1]) as number);
      const dz = (anchors.get([i, 2]) as number) - (anchors.get([i - 1, 2]) as number);
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return total;
  }

  pointFromProportion(alpha: number): Point3D {
    const anchors = this.getAnchors();
    const n = anchors.shape[0];
    if (n === 0) return np.array([0, 0, 0]);
    if (n === 1) return getRow(anchors, 0);
    const idx = Math.min(Math.floor(alpha * (n - 1)), n - 2);
    const t = alpha * (n - 1) - idx;
    const ax = anchors.get([idx, 0]) as number;
    const ay = anchors.get([idx, 1]) as number;
    const az = anchors.get([idx, 2]) as number;
    const bx = anchors.get([idx + 1, 0]) as number;
    const by = anchors.get([idx + 1, 1]) as number;
    const bz = anchors.get([idx + 1, 2]) as number;
    return np.array([
      ax + (bx - ax) * t,
      ay + (by - ay) * t,
      az + (bz - az) * t,
    ]);
  }

  appendVectorizedMobject(vmob: IVMobject): this {
    const n = this.getNumPoints();
    if (n > 0) {
      this._subpathStarts.push(n);
    }
    if (vmob.points.shape[0] > 0) {
      if (this.getNumPoints() === 0) {
        this.points = vmob.points;
      } else {
        this.points = np.concatenate([this.points, vmob.points], 0);
      }
    }
    return this;
  }

  // ── Style ─────────────────────────────────────────────────────

  setFill(color?: IColor, opacity?: number): this {
    if (color !== undefined) this.fillColor = color;
    if (opacity !== undefined) this.fillOpacity = opacity;
    return this;
  }

  setStroke(color?: IColor, width?: number, opacity?: number): this {
    if (color !== undefined) this.strokeColor = color;
    if (width !== undefined) this.strokeWidth = width;
    if (opacity !== undefined) this.strokeOpacity = opacity;
    return this;
  }

  setStyle(options: {
    fillColor?: IColor;
    fillOpacity?: number;
    strokeColor?: IColor;
    strokeWidth?: number;
    strokeOpacity?: number;
  } = {}): this {
    if (options.fillColor !== undefined) this.fillColor = options.fillColor;
    if (options.fillOpacity !== undefined) this.fillOpacity = options.fillOpacity;
    if (options.strokeColor !== undefined) this.strokeColor = options.strokeColor;
    if (options.strokeWidth !== undefined) this.strokeWidth = options.strokeWidth;
    if (options.strokeOpacity !== undefined) this.strokeOpacity = options.strokeOpacity;
    return this;
  }

  // ── Internals ─────────────────────────────────────────────────

  private _appendPoint(point: Point3D): void {
    const row = np.array([
      Number(point.item(0)),
      Number(point.item(1)),
      Number(point.item(2)),
    ]).reshape(1, 3);

    if (this.getNumPoints() === 0) {
      this.points = row;
    } else {
      this.points = np.concatenate([this.points, row], 0);
    }
  }

  private _lastPoint(): Point3D {
    const n = this.getNumPoints();
    if (n === 0) return np.array([0, 0, 0]);
    return getRow(this.points, n - 1);
  }

  private _getPoint(index: number): Point3D {
    return getRow(this.points, index);
  }
}
