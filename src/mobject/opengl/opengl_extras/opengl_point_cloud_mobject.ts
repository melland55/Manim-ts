/**
 * TypeScript port of manim/mobject/opengl/opengl_point_cloud_mobject.py
 *
 * Point cloud mobject classes for OpenGL rendering.
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import { interpolate } from "../../../utils/bezier/index.js";
import {
  PURE_YELLOW,
  WHITE,
  BLACK,
  type ParsableManimColor,
  colorToRgba,
  colorGradient,
} from "../../../utils/color/index.js";
import { resizeWithInterpolation } from "../../../utils/iterables/index.js";
import { ORIGIN } from "../../../core/math/index.js";
import { OpenGLMobject, type OpenGLMobjectOptions } from "../opengl_mobject.js";
import type { Point3D } from "../../../core/types.js";

/**
 * Duck-type an NDArray. numpy-ts NDArrays are Proxy objects whose `has` trap
 * does not expose `shape`, so `"shape" in x` is always false at runtime — the
 * reliable check is for the `.get` method exposed by the proxy's `get` trap.
 */
function isNDArray(x: unknown): x is NDArray {
  return (
    x !== null &&
    typeof x === "object" &&
    typeof (x as { get?: unknown }).get === "function"
  );
}

// ─── OpenGLPMobject ──────────────────────────────────────────

export interface OpenGLPMobjectOptions extends OpenGLMobjectOptions {
  strokeWidth?: number;
  density?: number;
  points?: NDArray | number[][];
}

/**
 * Point cloud mobject — renders individual points with radii/colors.
 *
 * Python: manim.mobject.opengl.opengl_point_cloud_mobject.OpenGLPMobject
 */
export class OpenGLPMobject extends OpenGLMobject {
  static readonly OPENGL_POINT_RADIUS_SCALE_FACTOR = 0.01;

  strokeWidth: number;

  constructor(options: OpenGLPMobjectOptions = {}) {
    const {
      strokeWidth = 2.0,
      color = PURE_YELLOW,
      // renderPrimitive for POINTS — store as string constant
      ...rest
    } = options;
    super({ color, renderPrimitive: "POINTS", ...rest });
    this.strokeWidth = strokeWidth;
    this.uniforms["point_radius"] =
      this.strokeWidth * OpenGLPMobject.OPENGL_POINT_RADIUS_SCALE_FACTOR;

    // If points were provided in options, set them
    if (options.points) {
      const pts = isNDArray(options.points)
        ? options.points
        : np.array(options.points as number[][]);
      this.setPoints(pts);
    }
  }

  resetPoints(): this {
    this.rgbas = np.zeros([1, 4]);
    this.points = np.zeros([0, 3]);
    return this;
  }

  getArrayAttrs(): string[] {
    return ["points", "rgbas"];
  }

  /**
   * Add points with optional colors.
   * Points must be an Nx3 array. Rgbas must be Nx4 if provided.
   */
  addPoints(
    points: NDArray | number[][],
    options: {
      rgbas?: NDArray | number[][] | null;
      color?: ParsableManimColor | null;
      opacity?: number | null;
    } = {},
  ): this {
    let { rgbas = null, color = null, opacity = null } = options;

    if (rgbas === null && color === null) {
      color = PURE_YELLOW;
    }

    const pts = isNDArray(points) ? points : np.array(points as number[][]);

    this.appendPoints(pts);

    const numNewPoints = pts.shape[0];
    let newRgbas: NDArray;

    if (color !== null) {
      if (opacity === null) {
        const currentRgbas = this.rgbas;
        const lastRow = currentRgbas.shape[0] - 1;
        opacity = currentRgbas.get([lastRow, 3]) as number;
      }
      const rgba = colorToRgba(color, opacity);
      const rows: number[][] = [];
      for (let i = 0; i < numNewPoints; i++) {
        rows.push([...rgba]);
      }
      newRgbas = np.array(rows);
    } else if (rgbas !== null) {
      newRgbas = isNDArray(rgbas) ? rgbas : np.array(rgbas as number[][]);
    } else {
      throw new Error("points and rgbas must have same length");
    }

    if (this.rgbas.shape[0] === 0 || (this.rgbas.shape[0] === 1 && this.rgbas.shape[1] === 4)) {
      // First addition — check if initial rgbas is just the zero placeholder
      const currentArr = this.rgbas.toArray() as number[][];
      if (currentArr.length === 1 && currentArr[0].every((v) => v === 0)) {
        this.rgbas = newRgbas;
      } else {
        this.rgbas = np.vstack([this.rgbas, newRgbas]);
      }
    } else {
      this.rgbas = np.vstack([this.rgbas, newRgbas]);
    }

    return this;
  }

  /**
   * Removes all but every nth point for n = factor.
   */
  thinOut(factor: number = 5): this {
    for (const mob of this.familyMembersWithPoints() as OpenGLPMobject[]) {
      const numPoints = mob.getNumPoints();
      const indices: number[] = [];
      for (let i = 0; i < numPoints; i += factor) {
        indices.push(i);
      }

      if (mob.points.shape[0] === mob.rgbas.shape[0]) {
        const rgbaRows: number[][] = [];
        const rgbasArr = mob.rgbas.toArray() as number[][];
        for (const idx of indices) {
          rgbaRows.push(rgbasArr[idx]);
        }
        mob.setRgbaArrayDirect(np.array(rgbaRows));
      }

      const pointsArr = mob.points.toArray() as number[][];
      const newPoints: number[][] = [];
      for (const idx of indices) {
        newPoints.push(pointsArr[idx]);
      }
      mob.setPoints(np.array(newPoints));
    }
    return this;
  }

  /**
   * Set colors by gradient across all points.
   */
  setColorByGradient(...colors: ParsableManimColor[]): this {
    const numPoints = this.getNumPoints();
    const gradient = colorGradient(colors, numPoints);
    const rgbaRows: number[][] = gradient.map((c) => [...colorToRgba(c)]);
    this.rgbas = np.array(rgbaRows);
    return this;
  }

  /**
   * Set colors by radial gradient from center.
   */
  setColorsByRadialGradient(options: {
    center?: Point3D | null;
    radius?: number;
    innerColor?: ParsableManimColor;
    outerColor?: ParsableManimColor;
  } = {}): this {
    const {
      center = null,
      radius = 1,
      innerColor = WHITE,
      outerColor = BLACK,
    } = options;

    const startRgba = colorToRgba(innerColor);
    const endRgba = colorToRgba(outerColor);
    const actualCenter = center ?? this.getCenter();
    const centerArr = actualCenter.toArray() as number[];

    for (const mob of this.familyMembersWithPoints() as OpenGLPMobject[]) {
      const pts = mob.points.toArray() as number[][];
      const rgbaRows: number[][] = [];

      for (const pt of pts) {
        const dx = Math.abs(pt[0] - centerArr[0]);
        const dy = Math.abs(pt[1] - centerArr[1]);
        const dz = Math.abs(pt[2] - centerArr[2]);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const alpha = dist / radius;

        const row: number[] = [];
        for (let c = 0; c < 4; c++) {
          row.push((1 - alpha) * startRgba[c] + alpha * endRgba[c]);
        }
        rgbaRows.push(row);
      }

      mob.rgbas = np.array(rgbaRows);
    }
    return this;
  }

  /**
   * Match colors from another PMobject, resizing if needed.
   */
  matchColors(pmobject: OpenGLPMobject): this {
    this.rgbas = resizeWithInterpolation(pmobject.rgbas, this.getNumPoints());
    return this;
  }

  /**
   * Fade towards a target color.
   */
  fadeTo(
    color: ParsableManimColor,
    alpha: number,
    family: boolean = true,
  ): this {
    const targetRgba = np.array([colorToRgba(color)]);
    const targetExpanded = resizeWithInterpolation(targetRgba, this.getNumPoints());
    const rgbas = interpolate(this.rgbas, targetExpanded, alpha) as NDArray;

    if (family) {
      for (const mob of this._submobjects as OpenGLPMobject[]) {
        if (mob instanceof OpenGLPMobject) {
          mob.fadeTo(color, alpha, family);
        }
      }
    }

    this.setRgbaArrayDirect(rgbas);
    return this;
  }

  /**
   * Remove points that satisfy the condition.
   * Condition receives a point [x, y, z] and returns true to remove.
   */
  filterOut(condition: (point: number[]) => boolean): this {
    for (const mob of this.familyMembersWithPoints() as OpenGLPMobject[]) {
      const pts = mob.points.toArray() as number[][];
      const keepIndices: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        if (!condition(pts[i])) {
          keepIndices.push(i);
        }
      }

      const newPoints: number[][] = keepIndices.map((i) => pts[i]);
      mob.setPoints(np.array(newPoints.length > 0 ? newPoints : [[0, 0, 0]]).reshape(newPoints.length > 0 ? newPoints.length : 0, 3));

      if (mob.rgbas.shape[0] === pts.length) {
        const rgbasArr = mob.rgbas.toArray() as number[][];
        const newRgbas: number[][] = keepIndices.map((i) => rgbasArr[i]);
        mob.rgbas = np.array(newRgbas.length > 0 ? newRgbas : [[0, 0, 0, 0]]);
      }
    }
    return this;
  }

  /**
   * Sort points by a function mapping R^3 → R.
   */
  sortPoints(fn: (point: number[]) => number = (p) => p[0]): this {
    for (const mob of this.familyMembersWithPoints() as OpenGLPMobject[]) {
      const pts = mob.points.toArray() as number[][];
      const indices = pts.map((_, i) => i);
      indices.sort((a, b) => fn(pts[a]) - fn(pts[b]));

      const sortedPoints: number[][] = indices.map((i) => pts[i]);
      mob.setPoints(np.array(sortedPoints));

      if (mob.rgbas.shape[0] === pts.length) {
        const rgbasArr = mob.rgbas.toArray() as number[][];
        const sortedRgbas: number[][] = indices.map((i) => rgbasArr[i]);
        mob.rgbas = np.array(sortedRgbas);
      }
    }
    return this;
  }

  /**
   * Collect all submobject data into this mobject.
   */
  ingestSubmobjects(): this {
    const allPoints: NDArray[] = [];
    const allRgbas: NDArray[] = [];
    for (const sm of this.getFamily() as OpenGLPMobject[]) {
      if (sm.hasPoints()) {
        allPoints.push(sm.points);
        allRgbas.push(sm.rgbas);
      }
    }
    if (allPoints.length > 0) {
      this.points = np.vstack(allPoints);
      this.rgbas = np.vstack(allRgbas);
    }
    return this;
  }

  /**
   * Get point at a given proportion along the point list.
   */
  pointFromProportion(alpha: number): Point3D {
    const index = Math.floor(alpha * (this.getNumPoints() - 1));
    const pts = this.points.toArray() as number[][];
    return np.array(pts[index]);
  }

  /**
   * Become a partial version of another PMobject between proportions a and b.
   */
  pointwiseBecomePartial(pmobject: OpenGLPMobject, a: number, b: number): this {
    const lowerIndex = Math.floor(a * pmobject.getNumPoints());
    const upperIndex = Math.floor(b * pmobject.getNumPoints());

    const pts = pmobject.points.toArray() as number[][];
    const slicedPoints = pts.slice(lowerIndex, upperIndex);
    this.setPoints(
      np.array(slicedPoints.length > 0 ? slicedPoints : []).reshape(slicedPoints.length, 3),
    );

    const rgbas = pmobject.rgbas.toArray() as number[][];
    const slicedRgbas = rgbas.slice(lowerIndex, upperIndex);
    if (slicedRgbas.length > 0) {
      this.rgbas = np.array(slicedRgbas);
    }

    return this;
  }

  /**
   * Get shader data for rendering.
   */
  getShaderData(): NDArray {
    // TODO: Port from OpenGL — needs manual rendering implementation
    const n = this.points.shape[0];
    return np.zeros([n, 7]); // point(3) + color(4)
  }

  /**
   * Set rgba array directly (bypassing color conversion).
   */
  setRgbaArrayDirect(rgbas: NDArray): this {
    this.rgbas = rgbas;
    return this;
  }

  static getMobjectTypeClass(): typeof OpenGLPMobject {
    return OpenGLPMobject;
  }
}

// ─── OpenGLPGroup ────────────────────────────────────────────

/**
 * Group of point cloud mobjects.
 *
 * Python: manim.mobject.opengl.opengl_point_cloud_mobject.OpenGLPGroup
 */
export class OpenGLPGroup extends OpenGLPMobject {
  constructor(...pmobs: OpenGLPMobject[]) {
    if (!pmobs.every((m) => m instanceof OpenGLPMobject)) {
      throw new Error("All submobjects must be of type OpenGLPMobject");
    }
    super();
    this.add(...pmobs);
  }

  fadeTo(
    color: ParsableManimColor,
    alpha: number,
    family: boolean = true,
  ): this {
    if (family) {
      for (const mob of this._submobjects as OpenGLPMobject[]) {
        if (mob instanceof OpenGLPMobject) {
          mob.fadeTo(color, alpha, family);
        }
      }
    }
    return this;
  }
}

// ─── OpenGLPMPoint ───────────────────────────────────────────

export interface OpenGLPMPointOptions extends OpenGLPMobjectOptions {
  location?: Point3D | number[];
}

/**
 * Single-point PMobject.
 *
 * Python: manim.mobject.opengl.opengl_point_cloud_mobject.OpenGLPMPoint
 */
export class OpenGLPMPoint extends OpenGLPMobject {
  location: Point3D;

  constructor(options: OpenGLPMPointOptions = {}) {
    const {
      location = ORIGIN,
      strokeWidth = 4.0,
      ...rest
    } = options;
    super({ strokeWidth, ...rest });
    this.location = isNDArray(location)
      ? location
      : np.array(location as number[]);
    this.initPoints();
  }

  override initPoints(): void {
    if (!this.location) return;
    const loc = this.location.toArray() as number[];
    this.points = np.array([loc]);
  }
}
