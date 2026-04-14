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
import { np, partialBezierPoints, integerInterpolate, ORIGIN } from "../../core/math/index.js";
import type { Point3D, Points3D } from "../../core/math/index.js";
import type { IVMobject, IColor } from "../../core/types.js";
import { WHITE, BLUE, BLACK } from "../../utils/color/manim_colors.js";
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

  /**
   * Set the given points as straight-line corners of this VMobject.
   * Python: VMobject.set_points_as_corners(points)
   */
  setPointsAsCorners(corners: (Point3D | number[])[] | NDArray): this {
    const arr: Point3D[] = Array.isArray(corners)
      ? corners.map((c) =>
          Array.isArray(c) ? (np.array(c) as Point3D) : (c as Point3D),
        )
      : (() => {
          const nd = corners as NDArray;
          const n = nd.shape[0];
          const out: Point3D[] = [];
          for (let i = 0; i < n; i++) {
            const row: number[] = [];
            for (let j = 0; j < nd.shape[1]; j++) {
              row.push(nd.get([i, j]) as number);
            }
            out.push(np.array(row) as Point3D);
          }
          return out;
        })();
    this.clearPoints();
    if (arr.length < 1) return this;
    this.startNewPath(arr[0]);
    for (let i = 1; i < arr.length; i++) {
      this.addLineTo(arr[i]);
    }
    return this;
  }

  /**
   * Visual only; attaches an image used for per-pixel stroke color resolution
   * during rendering. Not yet implemented — stored for API parity.
   * Python: VMobject.color_using_background_image(image)
   */
  colorUsingBackgroundImage(image: unknown): this {
    (this as unknown as { backgroundImage?: unknown }).backgroundImage = image;
    return this;
  }

  /**
   * Overwrite this mobject's per-anchor RGBA array directly.
   * Python: OpenGLMobject.set_rgba_array_direct. Not yet renderer-wired —
   * stored on the instance so callers don't crash.
   */
  setRgbaArrayDirect(rgbas: unknown, name: string = "rgbas"): this {
    (this as unknown as Record<string, unknown>)[name] = rgbas;
    return this;
  }

  /**
   * Set the given points as smoothly-connected anchors of this VMobject.
   * Python: VMobject.set_points_smoothly(points) → set_points_as_corners + make_smooth
   *
   * NOTE: make_smooth is not yet ported; this currently produces a jagged path
   * with straight-line handles (same anchors, same visual endpoints).
   */
  setPointsSmoothly(corners: (Point3D | number[])[] | NDArray): this {
    this.setPointsAsCorners(corners);
    // TODO: port VMobject.make_smooth() for true spline smoothing.
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

  // ── Bezier tuples / subcurves ─────────────────────────────────

  /**
   * Return each cubic bezier segment as a 4-point tuple [a0, h1, h2, a1].
   * Python: vmobject.get_cubic_bezier_tuples()
   */
  getCubicBezierTuples(): Point3D[][] {
    const tuples: Point3D[][] = [];
    for (const subpath of this.getSubpaths()) {
      const n = subpath.shape[0];
      const numSegments = Math.floor((n - 1) / 3);
      for (let i = 0; i < numSegments; i++) {
        tuples.push([
          getRow(subpath, i * 3),
          getRow(subpath, i * 3 + 1),
          getRow(subpath, i * 3 + 2),
          getRow(subpath, i * 3 + 3),
        ]);
      }
    }
    return tuples;
  }

  /**
   * Copy stroke/fill style from another VMobject.
   * Python: vmobject.match_style(other)
   */
  matchStyle(vmob: VMobject): this {
    this.strokeColor = vmob.strokeColor;
    this.strokeWidth = vmob.strokeWidth;
    this.strokeOpacity = vmob.strokeOpacity;
    this.fillColor = vmob.fillColor;
    this.fillOpacity = vmob.fillOpacity;
    return this;
  }

  /**
   * Number of cubic Bézier segments in this VMobject.
   * Python: VMobject.get_num_curves()
   */
  getNumCurves(): number {
    // In our 3k+1 layout, each cubic occupies indices [3i … 3i+3],
    // and anchors are shared between adjacent cubics. The total segment
    // count per subpath is (subpathLength - 1) / 3.
    let total = 0;
    for (const sp of this.getSubpaths()) {
      total += Math.floor((sp.shape[0] - 1) / 3);
    }
    return total;
  }

  /**
   * Modify this VMobject's points to match the portion of the Bézier spline
   * described by `vmobject.points` with the parameter `t` between `a` and `b`.
   *
   * Python: VMobject.pointwise_become_partial(vmobject, a, b)
   */
  pointwiseBecomePartial(vmobject: VMobject, a: number, b: number): this {
    if (!(vmobject instanceof VMobject)) {
      throw new TypeError(
        `Expected a VMobject, got value ${vmobject} of type ${
          (vmobject as { constructor?: { name?: string } })?.constructor?.name ??
          typeof vmobject
        }.`,
      );
    }

    // Fast path: full curve — copy the source points verbatim.
    if (a <= 0 && b >= 1) {
      this.points = (vmobject.points as NDArray).copy
        ? ((vmobject.points as NDArray).copy() as Points3D)
        : (np.array(
            (vmobject.points as NDArray).toArray() as number[][],
          ) as Points3D);
      // Re-seed subpath starts to the source's (default: single subpath at 0).
      this._subpathStarts = [0];
      return this;
    }

    // Tuple-based implementation (our 3k+1 layout uses shared anchors, so
    // we rebuild the path from cubic tuples — semantically identical to
    // Python's 4k slicing, observable behavior matches).
    const tuples = vmobject.getCubicBezierTuples();
    const N = tuples.length;

    this.clearPoints();
    if (N === 0) return this;

    const [lowerIndex, lowerResidue] = integerInterpolate(0, N, a);
    const [upperIndex, upperResidue] = integerInterpolate(0, N, b);

    if (lowerIndex === upperIndex) {
      // Single-segment partial.
      const partial = partialBezierPoints(
        tuples[lowerIndex],
        lowerResidue,
        upperResidue,
      );
      this.startNewPath(partial[0]);
      this.addCubicBezierCurveTo(partial[1], partial[2], partial[3]);
      return this;
    }

    // Multi-segment: partial of lower, all middle, partial of upper.
    const lowerPartial = partialBezierPoints(
      tuples[lowerIndex],
      lowerResidue,
      1,
    );
    this.startNewPath(lowerPartial[0]);
    this.addCubicBezierCurveTo(lowerPartial[1], lowerPartial[2], lowerPartial[3]);

    for (let i = lowerIndex + 1; i < upperIndex; i++) {
      this.addCubicBezierCurveTo(tuples[i][1], tuples[i][2], tuples[i][3]);
    }

    const upperPartial = partialBezierPoints(tuples[upperIndex], 0, upperResidue);
    this.addCubicBezierCurveTo(upperPartial[1], upperPartial[2], upperPartial[3]);

    return this;
  }

  /**
   * Return a new VMobject that is the portion of this path from
   * proportion `a` to `b` (both in [0, 1]).
   * Python: vmobject.get_subcurve(a, b)
   */
  getSubcurve(a: number, b: number): VMobject {
    const tuples = this.getCubicBezierTuples();
    const N = tuples.length;
    const result = new VMobject();
    result.matchStyle(this);
    if (N === 0) return result;

    let firstPoint = true;
    for (let i = 0; i < N; i++) {
      const segStart = i / N;
      const segEnd = (i + 1) / N;
      if (segEnd <= a || segStart >= b) continue;

      const localA = Math.max(0, (a - segStart) / (segEnd - segStart));
      const localB = Math.min(1, (b - segStart) / (segEnd - segStart));
      const partial = partialBezierPoints(tuples[i], localA, localB);

      if (firstPoint) {
        result.startNewPath(partial[0]);
        firstPoint = false;
      }
      result.addCubicBezierCurveTo(partial[1], partial[2], partial[3]);
    }
    return result;
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

// ── VGroup ──────────────────────────────────────────────────────

/**
 * A group of VMobjects.
 * Python: manim.mobject.types.vectorized_mobject.VGroup
 */
export class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }

  override add(...vmobjects: VMobject[]): this {
    if (!vmobjects.every((m) => m instanceof VMobject)) {
      throw new TypeError("All submobjects must be of type VMobject");
    }
    return super.add(...vmobjects);
  }

  override setStyle(
    options: {
      fillColor?: IColor;
      fillOpacity?: number;
      strokeColor?: IColor;
      strokeWidth?: number;
      strokeOpacity?: number;
    } = {},
  ): this {
    super.setStyle(options);
    for (const mob of this.submobjects) {
      (mob as VMobject).setStyle(options);
    }
    return this;
  }

  override setFill(color?: IColor, opacity?: number): this {
    super.setFill(color, opacity);
    for (const mob of this.submobjects) {
      (mob as VMobject).setFill(color, opacity);
    }
    return this;
  }

  override setStroke(color?: IColor, width?: number, opacity?: number): this {
    super.setStroke(color, width, opacity);
    for (const mob of this.submobjects) {
      (mob as VMobject).setStroke(color, width, opacity);
    }
    return this;
  }

  /** Python VGroup.__add__: returns a new VGroup combining both. */
  concat(vmobject: VMobject): VGroup {
    return new VGroup(...(this.submobjects as VMobject[]), vmobject);
  }

  toString(): string {
    return (
      this.constructor.name +
      "(" +
      this.submobjects.map((mob) => String(mob)).join(", ") +
      ")"
    );
  }
}

// ── VDict ───────────────────────────────────────────────────────

/**
 * A dictionary-like VMobject container where submobjects are accessed by key.
 * Python: manim.mobject.types.vectorized_mobject.VDict
 */
export class VDict extends VMobject {
  private submobDict: Map<string, VMobject> = new Map();

  constructor(
    mappingOrIterable: Map<string, VMobject> | [string, VMobject][] = [],
  ) {
    super();
    const entries: [string, VMobject][] =
      mappingOrIterable instanceof Map
        ? Array.from(mappingOrIterable.entries())
        : mappingOrIterable;
    for (const [key, value] of entries) {
      this.addEntry(key, value);
    }
  }

  /** Add one or more key-value pairs. Mirrors Python's add(mapping_or_iterable). */
  addEntry(key: string, value: VMobject): this;
  addEntry(entries: [string, VMobject][]): this;
  addEntry(
    keyOrEntries: string | [string, VMobject][],
    value?: VMobject,
  ): this {
    if (typeof keyOrEntries === "string") {
      this.submobDict.set(keyOrEntries, value!);
      super.add(value!);
    } else {
      for (const [k, v] of keyOrEntries) {
        this.submobDict.set(k, v);
        super.add(v);
      }
    }
    return this;
  }

  /** Remove the VMobject stored under key (no-op if key absent). */
  removeKey(key: string): this {
    const mob = this.submobDict.get(key);
    if (mob !== undefined) {
      super.remove(mob);
      this.submobDict.delete(key);
    }
    return this;
  }

  /** Retrieve the VMobject stored under key. */
  get(key: string): VMobject {
    const mob = this.submobDict.get(key);
    if (mob === undefined) throw new Error(`VDict key not found: ${key}`);
    return mob;
  }

  /** Assign a VMobject to key, replacing any existing entry. Mirrors Python's __setitem__. */
  setItem(key: string, value: VMobject): this {
    if (this.submobDict.has(key)) {
      this.removeKey(key);
    }
    return this.addEntry(key, value);
  }

  has(key: string): boolean {
    return this.submobDict.has(key);
  }

  keys(): IterableIterator<string> {
    return this.submobDict.keys();
  }

  values(): IterableIterator<VMobject> {
    return this.submobDict.values();
  }

  items(): IterableIterator<[string, VMobject]> {
    return this.submobDict.entries();
  }

  toString(): string {
    return (
      "VDict(" +
      Array.from(this.submobDict.entries())
        .map(([k, v]) => `(${k}, ${v})`)
        .join(", ") +
      ")"
    );
  }
}

// ── VectorizedPoint ─────────────────────────────────────────────

/**
 * An invisible single-point VMobject used as a positional anchor.
 * Python: manim.mobject.types.vectorized_mobject.VectorizedPoint
 */
export class VectorizedPoint extends VMobject {
  constructor(
    location: Point3D = ORIGIN,
    options: VMobjectOptions = {},
  ) {
    super({
      color: options.color ?? BLACK,
      fillOpacity: options.fillOpacity ?? 0,
      strokeWidth: options.strokeWidth ?? 0,
      ...options,
    });
    this.points = np.array([[
      location.item(0) as number,
      location.item(1) as number,
      location.item(2) as number,
    ]]);
  }

  getLocation(): Point3D {
    return np.array([
      this.points.get([0, 0]) as number,
      this.points.get([0, 1]) as number,
      this.points.get([0, 2]) as number,
    ]);
  }

  setLocation(newLoc: Point3D): this {
    this.points = np.array([[
      newLoc.item(0) as number,
      newLoc.item(1) as number,
      newLoc.item(2) as number,
    ]]);
    return this;
  }
}

// ── CurvesAsSubmobjects ─────────────────────────────────────────

/**
 * Splits a VMobject's bezier curves into individual VMobject submobjects.
 * Python: manim.mobject.types.vectorized_mobject.CurvesAsSubmobjects
 */
export class CurvesAsSubmobjects extends VGroup {
  constructor(vmobject: VMobject) {
    super();
    for (const tup of vmobject.getCubicBezierTuples()) {
      const part = new VMobject();
      part.startNewPath(tup[0]);
      part.addCubicBezierCurveTo(tup[1], tup[2], tup[3]);
      part.matchStyle(vmobject);
      this.add(part);
    }
  }
}

// ── DashedVMobject ──────────────────────────────────────────────

export interface DashedVMobjectOptions extends VMobjectOptions {
  numDashes?: number;
  dashedRatio?: number;
  dashOffset?: number;
}

/**
 * Renders a VMobject with a dashed stroke pattern.
 * Python: manim.mobject.types.vectorized_mobject.DashedVMobject
 */
export class DashedVMobject extends VMobject {
  numDashes: number;
  dashedRatio: number;

  constructor(vmobject: VMobject, options: DashedVMobjectOptions = {}) {
    const {
      numDashes = 15,
      dashedRatio = 0.5,
      dashOffset = 0,
      color = WHITE,
      fillOpacity,
      strokeWidth,
      strokeColor,
      strokeOpacity,
      fillColor,
    } = options;

    super({ color, fillOpacity, strokeWidth, strokeColor, strokeOpacity, fillColor });
    this.numDashes = numDashes;
    this.dashedRatio = dashedRatio;

    for (let i = 0; i < numDashes; i++) {
      const a = ((i + dashOffset) / numDashes) % 1;
      const b = a + dashedRatio / numDashes;
      if (b <= 1) {
        this.add(vmobject.getSubcurve(a, b));
      } else {
        // Dash wraps around: split into two parts
        this.add(vmobject.getSubcurve(a, 1));
        this.add(vmobject.getSubcurve(0, b - 1));
      }
    }
  }
}
