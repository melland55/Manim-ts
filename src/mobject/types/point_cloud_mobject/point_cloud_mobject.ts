/**
 * Mobjects representing point clouds.
 *
 * TypeScript port of manim/mobject/types/point_cloud_mobject.py
 */

import type { NDArray } from "numpy-ts";

import { np, ORIGIN, UP, RIGHT, PI } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  DEFAULT_STROKE_WIDTH,
  DEFAULT_POINT_DENSITY_1D,
  DEFAULT_POINT_DENSITY_2D,
} from "../../../constants/constants.js";
import { Mobject } from "../../mobject/mobject.js";
import type { MobjectConstructorOptions } from "../../mobject/mobject.js";
import { interpolate } from "../../../utils/bezier/index.js";
import {
  ManimColor,
  type ParsableManimColor,
  colorToRgba,
  rgbaToColor,
  colorGradient,
} from "../../../utils/color/core.js";
import {
  BLACK,
  PURE_YELLOW,
  WHITE,
} from "../../../utils/color/manim_colors.js";

/**
 * Duck-type an NDArray. numpy-ts NDArrays are Proxy objects whose `has` trap
 * does NOT expose `shape`, so `"shape" in x` returns false at runtime — the
 * reliable check is for the `.get` method exposed by the proxy's `get` trap.
 */
function isNDArray(x: unknown): x is NDArray {
  return (
    x !== null &&
    typeof x === "object" &&
    typeof (x as { get?: unknown }).get === "function"
  );
}
import { stretchArrayToLength } from "../../../utils/iterables/index.js";

// ─── Options ────────────────────────────────────────────────

export interface PMobjectOptions extends MobjectConstructorOptions {
  strokeWidth?: number;
}

export interface Mobject1DOptions extends PMobjectOptions {
  density?: number;
}

export interface Mobject2DOptions extends PMobjectOptions {
  density?: number;
}

export interface PointCloudDotOptions extends Mobject1DOptions {
  center?: Point3D;
  radius?: number;
}

export interface PointOptions extends PMobjectOptions {
  location?: Point3D;
}

// ─── PMobject ───────────────────────────────────────────────

/**
 * A disc made of a cloud of Dots.
 *
 * Python: manim.mobject.types.point_cloud_mobject.PMobject
 */
export class PMobject extends Mobject {
  // Use `declare` to avoid runtime re-initialization that would
  // overwrite values set during super() → resetPoints().
  declare rgbas: NDArray;
  declare strokeWidth: number;

  constructor(options: PMobjectOptions = {}) {
    const { strokeWidth = DEFAULT_STROKE_WIDTH, ...rest } = options;
    super(rest);
    this.strokeWidth = strokeWidth;
  }

  override resetPoints(): this {
    this.rgbas = np.zeros([0, 4]);
    this.points = np.zeros([0, 3]);
    return this;
  }

  override getArrayAttrs(): string[] {
    return [...super.getArrayAttrs(), "rgbas"];
  }

  addPoints(
    points: NDArray | number[][],
    rgbas?: NDArray | number[][] | null,
    color?: ParsableManimColor | null,
    alpha: number = 1.0,
  ): this {
    const pts = isNDArray(points) ? points : np.array(points as number[][]);
    const numNewPoints = pts.shape[0];
    this.points = this.points.shape[0] === 0
      ? pts
      : np.vstack([this.points, pts]);

    let rgbaArr: NDArray;
    if (rgbas == null) {
      const c = color != null ? new ManimColor(color) : this.color;
      const rgba = colorToRgba(c, alpha);
      const rows: number[][] = [];
      for (let i = 0; i < numNewPoints; i++) {
        rows.push([...rgba]);
      }
      rgbaArr = numNewPoints > 0 ? np.array(rows) : np.zeros([0, 4]);
    } else {
      rgbaArr = isNDArray(rgbas) ? rgbas : np.array(rgbas as number[][]);
      if (rgbaArr.shape[0] !== numNewPoints) {
        throw new Error("points and rgbas must have same length");
      }
    }
    this.rgbas = this.rgbas.shape[0] === 0
      ? rgbaArr
      : np.vstack([this.rgbas, rgbaArr]);
    return this;
  }

  override setColor(
    color: ParsableManimColor = PURE_YELLOW,
    family: boolean = true,
  ): this {
    const rgba = colorToRgba(color);
    const mobs = family ? this.familyMembersWithPoints() : [this as Mobject];
    for (const mob of mobs) {
      const pm = mob as PMobject;
      if (pm.rgbas && pm.rgbas.shape[0] > 0) {
        const numPoints = pm.rgbas.shape[0];
        const rows: number[][] = [];
        for (let i = 0; i < numPoints; i++) {
          rows.push([...rgba]);
        }
        pm.rgbas = np.array(rows);
      }
    }
    this.color = ManimColor.parse(color) as ManimColor;
    return this;
  }

  getStrokeWidth(): number {
    return this.strokeWidth;
  }

  setStrokeWidth(width: number, family: boolean = true): this {
    if (family) {
      for (const mob of this.familyMembersWithPoints()) {
        (mob as PMobject).strokeWidth = width;
      }
    }
    this.strokeWidth = width;
    return this;
  }

  setColorByGradient(...colors: ParsableManimColor[]): this {
    const gradientColors = colorGradient(colors, this.points.shape[0]);
    const rows: number[][] = gradientColors.map((c) => [...colorToRgba(c)]);
    this.rgbas = rows.length > 0 ? np.array(rows) : np.zeros([0, 4]);
    return this;
  }

  setColorsByRadialGradient(
    center?: Point3D | null,
    radius: number = 1,
    innerColor: ParsableManimColor = WHITE,
    outerColor: ParsableManimColor = BLACK,
  ): this {
    const startRgba = colorToRgba(innerColor);
    const endRgba = colorToRgba(outerColor);
    const ctr = center ?? this.getCenter();
    for (const mob of this.familyMembersWithPoints()) {
      const pm = mob as PMobject;
      const numPts = pm.points.shape[0];
      const rows: number[][] = [];
      for (let i = 0; i < numPts; i++) {
        const pt = np.array([...(pm.points.row(i).toArray() as number[])]);
        const diff = pt.subtract(ctr);
        const dist = np.linalg.norm(diff) as number;
        const alpha = dist / radius;
        const startArr = np.array(startRgba);
        const endArr = np.array(endRgba);
        const interpd = interpolate(startArr, endArr, alpha) as NDArray;
        rows.push(interpd.toArray() as number[]);
      }
      pm.rgbas = rows.length > 0 ? np.array(rows) : np.zeros([0, 4]);
    }
    return this;
  }

  matchColors(mobject: Mobject): this {
    Mobject.prototype.alignData.call(this, mobject);
    this.rgbas = (mobject as PMobject).rgbas.copy();
    return this;
  }

  filterOut(condition: (point: number[]) => boolean): this {
    for (const mob of this.familyMembersWithPoints()) {
      const pm = mob as PMobject;
      const numPts = pm.points.shape[0];
      const keepIndices: number[] = [];
      for (let i = 0; i < numPts; i++) {
        const pt = (np.array([...(pm.points.row(i).toArray() as number[])])).toArray() as number[];
        if (!condition(pt)) {
          keepIndices.push(i);
        }
      }
      if (keepIndices.length === 0) {
        pm.points = np.zeros([0, 3]);
        pm.rgbas = np.zeros([0, 4]);
      } else {
        pm.points = np.take(pm.points, keepIndices, 0);
        pm.rgbas = np.take(pm.rgbas, keepIndices, 0);
      }
    }
    return this;
  }

  thinOut(factor: number = 5): this {
    for (const mob of this.familyMembersWithPoints()) {
      const numPoints = this.getNumPoints();
      const indices: number[] = [];
      for (let i = 0; i < numPoints; i += factor) {
        indices.push(i);
      }
      if (indices.length === 0) {
        (mob as PMobject).points = np.zeros([0, 3]);
        (mob as PMobject).rgbas = np.zeros([0, 4]);
      } else {
        mob.applyOverAttrArrays(
          (arr: NDArray) => np.take(arr, indices, 0),
        );
      }
    }
    return this;
  }

  sortPoints(
    fn: (p: number[]) => number = (p) => p[0],
  ): this {
    for (const mob of this.familyMembersWithPoints()) {
      const pm = mob as PMobject;
      const numPts = pm.points.shape[0];
      const keyed: Array<{ index: number; key: number }> = [];
      for (let i = 0; i < numPts; i++) {
        const pt = (np.array([...(pm.points.row(i).toArray() as number[])])).toArray() as number[];
        keyed.push({ index: i, key: fn(pt) });
      }
      keyed.sort((a, b) => a.key - b.key);
      const sortedIndices = keyed.map((k) => k.index);
      if (sortedIndices.length > 0) {
        mob.applyOverAttrArrays(
          (arr: NDArray) => np.take(arr, sortedIndices, 0),
        );
      }
    }
    return this;
  }

  fadeTo(
    color: ParsableManimColor,
    alpha: number,
    family: boolean = true,
  ): this {
    const targetRgba = np.array(colorToRgba(color));
    this.rgbas = interpolate(this.rgbas, targetRgba, alpha) as NDArray;
    if (family) {
      for (const mob of this.submobjects) {
        (mob as PMobject).fadeTo(color, alpha, family);
      }
    }
    return this;
  }

  getAllRgbas(): NDArray {
    return this.getMergedArray("rgbas");
  }

  ingestSubmobjects(): this {
    const attrs = this.getArrayAttrs();
    const arrays = attrs.map((attr) => this.getMergedArray(attr));
    for (let i = 0; i < attrs.length; i++) {
      (this as unknown as Record<string, NDArray>)[attrs[i]] = arrays[i];
    }
    this.submobjects = [];
    return this;
  }

  getColor(): ManimColor {
    if (this.rgbas.shape[0] === 0) {
      return this.color;
    }
    const firstRow = (np.array([...(this.rgbas.row(0).toArray() as number[])])).toArray() as number[];
    return rgbaToColor(firstRow as [number, number, number, number]);
  }

  pointFromProportion(alpha: number): Point3D {
    const index = Math.floor(alpha * (this.getNumPoints() - 1));
    return np.array([...(this.points.row(index).toArray() as number[])]);
  }

  static getMobjectTypeClass(): typeof PMobject {
    return PMobject;
  }

  // ── Alignment ──

  override alignPointsWithLarger(largerMobject: Mobject): void {
    if (!(largerMobject instanceof PMobject)) {
      throw new Error("Expected PMobject for alignment");
    }
    this.applyOverAttrArrays(
      (a: NDArray) => stretchArrayToLength(a, largerMobject.getNumPoints()),
    );
  }

  override getPointMobject(center?: Point3D): Point {
    const ctr = center ?? this.getCenter();
    return new Point({ location: ctr });
  }

  interpolateColor(
    mobject1: Mobject,
    mobject2: Mobject,
    alpha: number,
  ): this {
    const pm1 = mobject1 as PMobject;
    const pm2 = mobject2 as PMobject;
    this.rgbas = interpolate(pm1.rgbas, pm2.rgbas, alpha) as NDArray;
    this.setStrokeWidth(
      interpolate(
        pm1.getStrokeWidth(),
        pm2.getStrokeWidth(),
        alpha,
      ) as number,
    );
    return this;
  }

  pointwiseBecomePartial(mobject: Mobject, a: number, b: number): void {
    const numPts = mobject.getNumPoints();
    const lowerIndex = Math.floor(a * numPts);
    const upperIndex = Math.floor(b * numPts);
    for (const attr of this.getArrayAttrs()) {
      const fullArray = (mobject as unknown as Record<string, NDArray>)[attr];
      if (lowerIndex >= upperIndex) {
        (this as unknown as Record<string, NDArray>)[attr] = np.zeros([0, fullArray.shape[1]]);
      } else {
        const rows: number[][] = [];
        for (let i = lowerIndex; i < upperIndex; i++) {
          rows.push((np.array([...(fullArray.row(i).toArray() as number[])])).toArray() as number[]);
        }
        (this as unknown as Record<string, NDArray>)[attr] = np.array(rows);
      }
    }
  }
}

// ─── Mobject1D ──────────────────────────────────────────────

export class Mobject1D extends PMobject {
  declare density: number;
  declare epsilon: number;

  constructor(options: Mobject1DOptions = {}) {
    const { density = DEFAULT_POINT_DENSITY_1D, ...rest } = options;
    super(rest);
    this.density = density;
    this.epsilon = 1.0 / this.density;
  }

  addLine(
    start: NDArray | number[],
    end: NDArray | number[],
    color?: ParsableManimColor | null,
  ): void {
    const s = Array.isArray(start) ? np.array(start) : start;
    const e = Array.isArray(end) ? np.array(end) : end;
    const diff = e.subtract(s);
    const length = np.linalg.norm(diff) as number;
    let points: NDArray;
    if (length === 0) {
      points = s.reshape(1, 3);
    } else {
      const epsilon = this.epsilon / length;
      const rows: number[][] = [];
      for (let t = 0; t < 1; t += epsilon) {
        const pt = interpolate(s, e, t) as NDArray;
        rows.push(pt.toArray() as number[]);
      }
      points = rows.length > 0 ? np.array(rows) : np.zeros([0, 3]);
    }
    this.addPoints(points, null, color);
  }
}

// ─── Mobject2D ──────────────────────────────────────────────

export class Mobject2D extends PMobject {
  declare density: number;
  declare epsilon: number;

  constructor(options: Mobject2DOptions = {}) {
    const { density = DEFAULT_POINT_DENSITY_2D, ...rest } = options;
    super(rest);
    this.density = density;
    this.epsilon = 1.0 / this.density;
  }
}

// ─── PGroup ─────────────────────────────────────────────────

/**
 * A group for several point mobjects.
 *
 * Python: manim.mobject.types.point_cloud_mobject.PGroup
 */
export class PGroup extends PMobject {
  constructor(...pmobs: PMobject[]) {
    super();
    for (const m of pmobs) {
      if (!(m instanceof PMobject)) {
        throw new Error(
          "All submobjects must be of type PMobject",
        );
      }
    }
    this.add(...pmobs);
  }

  override fadeTo(
    color: ParsableManimColor,
    alpha: number,
    family: boolean = true,
  ): this {
    if (family) {
      for (const mob of this.submobjects) {
        (mob as PMobject).fadeTo(color, alpha, family);
      }
    }
    return this;
  }
}

// ─── PointCloudDot ──────────────────────────────────────────

/**
 * A disc made of a cloud of dots.
 *
 * Python: manim.mobject.types.point_cloud_mobject.PointCloudDot
 */
export class PointCloudDot extends Mobject1D {
  declare radius: number;

  constructor(options: PointCloudDotOptions = {}) {
    const {
      center = ORIGIN,
      radius = 2.0,
      strokeWidth = 2,
      density = DEFAULT_POINT_DENSITY_1D,
      color = PURE_YELLOW,
      ...rest
    } = options;
    // Set radius and epsilon before super() triggers generatePoints().
    // We use Object.defineProperty to set instance props before super().
    // Actually, we can't — TS forbids this before super(). Instead,
    // we rely on generatePoints() being a no-op when radius is undefined,
    // then manually generate after.
    super({ strokeWidth, density, color, ...rest });
    this.radius = radius;
    this.epsilon = 1.0 / density;
    // Now generate the actual points
    this.resetPoints();
    this.generatePoints();
    this.shift(center as NDArray);
  }

  override generatePoints(): void {
    // Guard: during super() construction, radius may not be set yet
    if (this.radius === undefined) return;

    const rows: number[][] = [];
    for (let r = this.epsilon; r < this.radius; r += this.epsilon) {
      const numTheta = Math.floor(2 * PI * (r + this.epsilon) / this.epsilon);
      const thetas = np.linspace(0, 2 * PI, numTheta);
      const thetaArr = thetas.toArray() as number[];
      for (const theta of thetaArr) {
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        rows.push([x, y, 0]);
      }
    }
    if (rows.length > 0) {
      this.addPoints(np.array(rows));
    }
  }
}

// ─── Point ──────────────────────────────────────────────────

/**
 * A mobject representing a point.
 *
 * Python: manim.mobject.types.point_cloud_mobject.Point
 */
export class Point extends PMobject {
  declare location: Point3D;

  constructor(options: PointOptions = {}) {
    const { location = ORIGIN, color = BLACK, ...rest } = options;
    super({ color, ...rest });
    this.location = Array.isArray(location) ? np.array(location) : location as NDArray;
    // Regenerate points now that location is set
    this.resetPoints();
    this.generatePoints();
  }

  override generatePoints(): void {
    // Guard: during super() construction, location may not be set yet
    if (this.location === undefined) return;
    const loc = this.location as NDArray;
    this.addPoints(loc.reshape(1, 3));
  }
}
