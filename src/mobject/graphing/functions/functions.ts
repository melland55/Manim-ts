/**
 * Mobjects representing function graphs.
 *
 * TypeScript port of manim/mobject/graphing/functions.py
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import { VMobject } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { LinearBase, _ScaleBase } from "../scale/index.js";
import { config } from "../../../_config/index.js";
import { PURE_YELLOW } from "../../../utils/color/manim_colors.js";
import type { ParsableManimColor } from "../../../utils/color/core.js";

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Smooth the bezier curves of a VMobject by recomputing handles.
 *
 * TODO: Full smooth implementation requires getSmoothCubicBezierHandlePoints
 * from utils/bezier and anchor mode changing logic (change_anchor_mode("smooth")).
 * For now, the corners-based path is a reasonable approximation for function graphs.
 */
function makeSmooth(_vmob: VMobject): void {
  // No-op until full smooth infrastructure is available on VMobject.
}

// ─── Isoline plotter (replaces Python isosurfaces.plot_isoline) ──

/**
 * Simple marching-squares isoline extraction.
 * Finds curves where fn(x, y) = 0 within the given bounding box.
 *
 * @param fn - Function taking [x, y] and returning a scalar.
 * @param pmin - [xMin, yMin]
 * @param pmax - [xMax, yMax]
 * @param minDepth - Minimum grid subdivision depth.
 * @param maxQuads - Maximum number of quads to evaluate.
 * @returns Array of curves, each curve is an array of [x, y] points.
 */
function plotIsoline(
  fn: (u: [number, number]) => number,
  pmin: [number, number],
  pmax: [number, number],
  minDepth: number,
  maxQuads: number,
): number[][][] {
  const gridSize = Math.min(
    Math.pow(2, minDepth),
    Math.ceil(Math.sqrt(maxQuads)),
  );
  const nx = gridSize;
  const ny = gridSize;
  const dx = (pmax[0] - pmin[0]) / nx;
  const dy = (pmax[1] - pmin[1]) / ny;

  // Evaluate function on grid
  const vals: number[][] = [];
  for (let iy = 0; iy <= ny; iy++) {
    const row: number[] = [];
    for (let ix = 0; ix <= nx; ix++) {
      const x = pmin[0] + ix * dx;
      const y = pmin[1] + iy * dy;
      row.push(fn([x, y]));
    }
    vals.push(row);
  }

  // Marching squares: collect line segments where sign changes
  const segments: Array<[[number, number], [number, number]]> = [];

  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const x0 = pmin[0] + ix * dx;
      const y0 = pmin[1] + iy * dy;
      const x1 = x0 + dx;
      const y1 = y0 + dy;

      const v00 = vals[iy][ix];
      const v10 = vals[iy][ix + 1];
      const v01 = vals[iy + 1][ix];
      const v11 = vals[iy + 1][ix + 1];

      const interp = (
        xa: number, ya: number, va: number,
        xb: number, yb: number, vb: number,
      ): [number, number] => {
        const t = va / (va - vb);
        return [xa + t * (xb - xa), ya + t * (yb - ya)];
      };

      const idx =
        (v00 > 0 ? 1 : 0) |
        (v10 > 0 ? 2 : 0) |
        (v01 > 0 ? 4 : 0) |
        (v11 > 0 ? 8 : 0);

      const bottom = (): [number, number] => interp(x0, y0, v00, x1, y0, v10);
      const top = (): [number, number] => interp(x0, y1, v01, x1, y1, v11);
      const left = (): [number, number] => interp(x0, y0, v00, x0, y1, v01);
      const right = (): [number, number] => interp(x1, y0, v10, x1, y1, v11);

      switch (idx) {
        case 0: case 15: break;
        case 1: case 14: segments.push([bottom(), left()]); break;
        case 2: case 13: segments.push([bottom(), right()]); break;
        case 3: case 12: segments.push([left(), right()]); break;
        case 4: case 11: segments.push([top(), left()]); break;
        case 5: case 10: segments.push([bottom(), right()]); segments.push([top(), left()]); break;
        case 6: case 9: segments.push([bottom(), top()]); break;
        case 7: case 8: segments.push([top(), right()]); break;
      }
    }
  }

  // Chain segments into polylines
  if (segments.length === 0) return [];

  const EPS = dx * 0.01;
  const used = new Array<boolean>(segments.length).fill(false);
  const curves: number[][][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const chain: [number, number][] = [segments[i][0], segments[i][1]];

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const [a, b] = segments[j];
        const tail = chain[chain.length - 1];
        const head = chain[0];

        if (Math.abs(a[0] - tail[0]) < EPS && Math.abs(a[1] - tail[1]) < EPS) {
          chain.push(b); used[j] = true; changed = true;
        } else if (Math.abs(b[0] - tail[0]) < EPS && Math.abs(b[1] - tail[1]) < EPS) {
          chain.push(a); used[j] = true; changed = true;
        } else if (Math.abs(a[0] - head[0]) < EPS && Math.abs(a[1] - head[1]) < EPS) {
          chain.unshift(b); used[j] = true; changed = true;
        } else if (Math.abs(b[0] - head[0]) < EPS && Math.abs(b[1] - head[1]) < EPS) {
          chain.unshift(a); used[j] = true; changed = true;
        }
      }
    }

    curves.push(chain.map(([x, y]) => [x, y]));
  }

  return curves;
}

// ─── Options interfaces ─────────────────────────────────────────

export interface ParametricFunctionOptions extends VMobjectOptions {
  tRange?: [number, number] | [number, number, number];
  scaling?: _ScaleBase;
  dt?: number;
  discontinuities?: Iterable<number> | null;
  useSmoothing?: boolean;
  useVectorized?: boolean;
}

export interface FunctionGraphOptions extends Omit<VMobjectOptions, "color"> {
  xRange?: [number, number] | [number, number, number] | null;
  color?: ParsableManimColor;
}

export interface ImplicitFunctionOptions extends VMobjectOptions {
  xRange?: [number, number] | null;
  yRange?: [number, number] | null;
  minDepth?: number;
  maxQuads?: number;
  useSmoothing?: boolean;
}

// ─── ParametricFunction ────────────────────────────────────────

/**
 * A parametric curve.
 *
 * The function should return (x, y, z) for a given parameter t.
 */
export class ParametricFunction extends VMobject {
  function!: (t: number) => Point3D;
  scaling!: _ScaleBase;
  dt!: number;
  discontinuities!: Iterable<number> | null;
  useSmoothing!: boolean;
  useVectorized!: boolean;
  tMin!: number;
  tMax!: number;
  tStep!: number;

  /** Guard: skip generatePoints when called from Mobject's constructor. */
  private _parametricReady = false;

  constructor(
    func: (t: number) => number[] | Point3D,
    options: ParametricFunctionOptions = {},
  ) {
    const {
      tRange = [0, 1],
      scaling = new LinearBase(),
      dt = 1e-8,
      discontinuities = null,
      useSmoothing = true,
      useVectorized = false,
      ...vmobOptions
    } = options;

    // super() calls this.generatePoints(), but _parametricReady is false so it's a no-op
    super(vmobOptions);

    // Wrap function to ensure NDArray output
    this.function = (t: number): Point3D => {
      const result = func(t);
      if (Array.isArray(result)) {
        return np.array(result) as Point3D;
      }
      return result as Point3D;
    };

    this.scaling = scaling;
    this.dt = dt;
    this.discontinuities = discontinuities;
    this.useSmoothing = useSmoothing;
    this.useVectorized = useVectorized;
    this.tMin = tRange[0];
    this.tMax = tRange[1];
    this.tStep = tRange.length === 3 ? tRange[2] : 0.01;

    // Now actually generate points
    this._parametricReady = true;
    this.generatePoints();
  }

  getFunction(): (t: number) => Point3D {
    return this.function;
  }

  getPointFromFunction(t: number): Point3D {
    return this.function(t);
  }

  generatePoints(): this {
    if (!this._parametricReady) return this;

    let boundaryTimes: number[];

    if (this.discontinuities != null) {
      const filteredDiscontinuities = Array.from(this.discontinuities).filter(
        (t) => this.tMin <= t && t <= this.tMax,
      );

      const times: number[] = [this.tMin, this.tMax];
      for (const d of filteredDiscontinuities) {
        times.push(d - this.dt);
        times.push(d + this.dt);
      }
      times.sort((a, b) => a - b);
      boundaryTimes = times;
    } else {
      boundaryTimes = [this.tMin, this.tMax];
    }

    for (let i = 0; i < boundaryTimes.length - 1; i += 2) {
      const t1 = boundaryTimes[i];
      const t2 = boundaryTimes[i + 1];

      // Generate t values using scaling
      const rawTs: number[] = [];
      for (let t = t1; t < t2; t += this.tStep) {
        rawTs.push(this.scaling.function(t));
      }
      rawTs.push(this.scaling.function(t2));

      if (this.useVectorized) {
        const tArray = np.array(rawTs);
        const result = (this.function as unknown as (t: NDArray) => NDArray)(tArray);
        const nPts = rawTs.length;
        const points: number[][] = [];
        for (let j = 0; j < nPts; j++) {
          const x = result.get([0, j]) as number;
          const y = result.get([1, j]) as number;
          let z: number;
          try {
            z = result.get([2, j]) as number;
          } catch {
            z = 0;
          }
          points.push([x, y, z]);
        }
        if (points.length === 0) continue;

        this.startNewPath(np.array(points[0]) as Point3D);
        for (let j = 1; j < points.length; j++) {
          this.addLineTo(np.array(points[j]) as Point3D);
        }
      } else {
        const points: Point3D[] = rawTs.map((t) => this.function(t));
        if (points.length === 0) continue;

        this.startNewPath(points[0]);
        for (let j = 1; j < points.length; j++) {
          this.addLineTo(points[j]);
        }
      }
    }

    if (this.useSmoothing) {
      makeSmooth(this);
    }

    return this;
  }

  initPoints(): void {
    this.generatePoints();
  }
}

// ─── FunctionGraph ─────────────────────────────────────────────

/**
 * A ParametricFunction that spans the length of the scene by default.
 *
 * Takes a function f(x) -> y and plots it as y = f(x).
 */
export class FunctionGraph extends ParametricFunction {
  xRange: [number, number] | [number, number, number];
  parametricFunction: (t: number) => Point3D;
  private _originalFunction: (t: number) => number;

  constructor(
    func: (x: number) => number,
    options: FunctionGraphOptions & Omit<ParametricFunctionOptions, "tRange"> = {},
  ) {
    const {
      xRange,
      color = PURE_YELLOW as ParsableManimColor,
      ...restOptions
    } = options;

    const resolvedXRange: [number, number] | [number, number, number] = xRange
      ? xRange
      : [-config.frameXRadius, config.frameXRadius];

    const parametricFunc = (t: number): Point3D =>
      np.array([t, func(t), 0]) as Point3D;

    super(parametricFunc, {
      tRange: resolvedXRange,
      color: color as VMobjectOptions["color"],
      ...restOptions,
    });

    this.xRange = resolvedXRange;
    this.parametricFunction = parametricFunc;
    this._originalFunction = func;
  }

  getFunction(): (t: number) => Point3D {
    return this._originalFunction as unknown as (t: number) => Point3D;
  }

  getPointFromFunction(x: number): Point3D {
    return this.parametricFunction(x);
  }
}

// ─── ImplicitFunction ──────────────────────────────────────────

/**
 * An implicit function.
 *
 * Plots the curve where f(x, y) = 0.
 */
export class ImplicitFunction extends VMobject {
  function!: (x: number, y: number) => number;
  minDepth!: number;
  maxQuads!: number;
  useSmoothing!: boolean;
  xRange!: [number, number];
  yRange!: [number, number];

  /** Guard: skip generatePoints when called from Mobject's constructor. */
  private _implicitReady = false;

  constructor(
    func: (x: number, y: number) => number,
    options: ImplicitFunctionOptions = {},
  ) {
    const {
      xRange,
      yRange,
      minDepth = 5,
      maxQuads = 1500,
      useSmoothing = true,
      ...vmobOptions
    } = options;

    // super() calls this.generatePoints(), but _implicitReady is false so it's a no-op
    super(vmobOptions);

    this.function = func;
    this.minDepth = minDepth;
    this.maxQuads = maxQuads;
    this.useSmoothing = useSmoothing;
    this.xRange = xRange ?? [
      -config.frameWidth / 2,
      config.frameWidth / 2,
    ];
    this.yRange = yRange ?? [
      -config.frameHeight / 2,
      config.frameHeight / 2,
    ];

    // Now actually generate points
    this._implicitReady = true;
    this.generatePoints();
  }

  generatePoints(): this {
    if (!this._implicitReady) return this;

    const pmin: [number, number] = [this.xRange[0], this.yRange[0]];
    const pmax: [number, number] = [this.xRange[1], this.yRange[1]];

    const curves = plotIsoline(
      (u: [number, number]) => this.function(u[0], u[1]),
      pmin,
      pmax,
      this.minDepth,
      this.maxQuads,
    );

    for (const curve of curves) {
      if (curve.length === 0) continue;

      const points3d = curve.map(([x, y]) => np.array([x, y, 0]) as Point3D);

      this.startNewPath(points3d[0]);
      for (let i = 1; i < points3d.length; i++) {
        this.addLineTo(points3d[i]);
      }
    }

    if (this.useSmoothing) {
      makeSmooth(this);
    }

    return this;
  }

  initPoints(): void {
    this.generatePoints();
  }
}
