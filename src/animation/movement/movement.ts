/**
 * Animations related to movement.
 *
 * Python equivalent: manim/animation/movement.py
 */

import type {
  IMobject,
  IVMobject,
  AnimationOptions,
  Point3D,
  RateFunc,
} from "../../core/types.js";
import { Animation } from "../animation/index.js";
import { np, linear } from "../../core/math/index.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Complex number as { real, imag } — mirrors Python's built-in complex type. */
export interface ComplexNumber {
  real: number;
  imag: number;
}

/** Type guard: does the mobject expose a `points` field (IVMobject shape)? */
function isVMobject(mob: IMobject): mob is IVMobject {
  return "points" in mob;
}

/** Extended VMobject interface for smooth-path support. */
interface IMakeSmoothVMobject extends IVMobject {
  makeSmooth(): this;
}

function hasMakeSmooth(mob: IVMobject): mob is IMakeSmoothVMobject {
  return typeof (mob as IMakeSmoothVMobject).makeSmooth === "function";
}

// ─── Homotopy options ─────────────────────────────────────────────────────────

export interface HomotopyOptions extends AnimationOptions {
  /**
   * Extra keyword arguments forwarded to Mobject.applyFunction.
   * NOTE: the TypeScript IMobject interface does not currently support
   * extra apply-function options, so these are stored but not forwarded.
   */
  applyFunctionKwargs?: Record<string, unknown>;
}

// ─── Homotopy ─────────────────────────────────────────────────────────────────

/**
 * A Homotopy animation.
 *
 * Transforms every point `(x, y, z)` of a mobject by passing it through a
 * user-supplied function `homotopy(x, y, z, t)` → `[x', y', z']`, where
 * `t` sweeps from 0 to 1 over the animation's run time.
 *
 * Python equivalent: `manim.animation.movement.Homotopy`
 */
export class Homotopy extends Animation {
  readonly homotopy: (
    x: number,
    y: number,
    z: number,
    t: number,
  ) => [number, number, number];

  protected readonly applyFunctionKwargs: Record<string, unknown>;

  constructor(
    homotopy: (
      x: number,
      y: number,
      z: number,
      t: number,
    ) => [number, number, number],
    mobject: IMobject,
    options: HomotopyOptions = {},
  ) {
    const { applyFunctionKwargs, ...animOptions } = options;
    // Default run time is 3 (matches Python default)
    const runTime = animOptions.runTime ?? 3;
    super(mobject, { ...animOptions, runTime });
    this.homotopy = homotopy;
    this.applyFunctionKwargs = applyFunctionKwargs ?? {};
  }

  /**
   * Returns a mapping function that applies the homotopy at a fixed time `t`.
   */
  functionAtTimeT(t: number): (p: Point3D) => Point3D {
    return (p: Point3D): Point3D => {
      const arr = p.toArray() as number[];
      const [x, y, z] = arr;
      const result = this.homotopy(x, y, z, t);
      return np.array(result) as Point3D;
    };
  }

  override interpolateSubmobject(
    submobject: IMobject,
    startingSubmobject: IMobject,
    alpha: number,
  ): void {
    if (!isVMobject(submobject) || !isVMobject(startingSubmobject)) {
      // Fallback for non-vectorized mobjects: just move to origin if no points.
      submobject.applyFunction(this.functionAtTimeT(alpha));
      return;
    }
    // Reset submobject points to the starting state, then transform.
    submobject.points = startingSubmobject.points.copy() as typeof submobject.points;
    // NOTE: applyFunctionKwargs are not forwarded — IMobject.applyFunction
    //       does not accept extra options in the TypeScript interface.
    submobject.applyFunction(this.functionAtTimeT(alpha));
  }
}

// ─── SmoothedVectorizedHomotopy ───────────────────────────────────────────────

/**
 * A homotopy that additionally smooths the resulting path after each step.
 *
 * Python equivalent: `manim.animation.movement.SmoothedVectorizedHomotopy`
 */
export class SmoothedVectorizedHomotopy extends Homotopy {
  override interpolateSubmobject(
    submobject: IMobject,
    startingSubmobject: IMobject,
    alpha: number,
  ): void {
    super.interpolateSubmobject(submobject, startingSubmobject, alpha);
    if (isVMobject(submobject) && hasMakeSmooth(submobject)) {
      submobject.makeSmooth();
    }
  }
}

// ─── ComplexHomotopy ──────────────────────────────────────────────────────────

/**
 * A homotopy defined in the complex plane.
 *
 * The user supplies `complexHomotopy(z, t) → w` where both `z` and `w` are
 * complex numbers represented as `{ real, imag }`.  The x/y components of
 * each point are treated as real/imaginary parts; the z-component is
 * preserved unchanged.
 *
 * Python equivalent: `manim.animation.movement.ComplexHomotopy`
 */
export class ComplexHomotopy extends Homotopy {
  constructor(
    complexHomotopy: (z: ComplexNumber, t: number) => ComplexNumber,
    mobject: IMobject,
    options: HomotopyOptions = {},
  ) {
    /**
     * Wrap the complex homotopy into the real-valued (x,y,z,t) form expected
     * by the Homotopy base class.
     */
    const homotopy = (
      x: number,
      y: number,
      z: number,
      t: number,
    ): [number, number, number] => {
      const c = complexHomotopy({ real: x, imag: y }, t);
      return [c.real, c.imag, z];
    };
    super(homotopy, mobject, options);
  }
}

// ─── PhaseFlow ────────────────────────────────────────────────────────────────

export interface PhaseFlowOptions extends AnimationOptions {
  virtualTime?: number;
}

/**
 * Animates a mobject as if it were flowing along a vector field.
 *
 * The `vectorField` function maps each point to a velocity vector.  At each
 * animation frame the mobject's points are nudged by
 * `dt * vectorField(point)`, where `dt` is proportional to the change in
 * `rateFunc(alpha)` since the last frame.
 *
 * Python equivalent: `manim.animation.movement.PhaseFlow`
 */
export class PhaseFlow extends Animation {
  readonly virtualTime: number;
  readonly vectorField: (p: Point3D) => Point3D;
  private lastAlpha?: number;

  constructor(
    vectorField: (p: Point3D) => Point3D,
    mobject: IMobject,
    options: PhaseFlowOptions = {},
  ) {
    const { virtualTime, ...animOptions } = options;
    // Default rate_func is linear (matches Python)
    const rateFunc: RateFunc = animOptions.rateFunc ?? linear;
    super(mobject, { ...animOptions, rateFunc });
    this.virtualTime = virtualTime ?? 1;
    this.vectorField = vectorField;
  }

  /**
   * PhaseFlow overrides interpolateMobject so it can track the *delta* between
   * frames rather than using an absolute alpha.  The `alpha` received here is
   * already rate_func-adjusted (from Animation.interpolate).
   */
  override interpolateMobject(alpha: number): void {
    if (this.lastAlpha !== undefined) {
      const dt =
        this.virtualTime *
        (this.rateFunc(alpha) - this.rateFunc(this.lastAlpha));
      const field = this.vectorField;
      this.mobject.applyFunction((p: Point3D): Point3D => {
        const velocity = field(p);
        return p.add(velocity.multiply(dt)) as Point3D;
      });
    }
    this.lastAlpha = alpha;
  }
}

// ─── MoveAlongPath ────────────────────────────────────────────────────────────

/**
 * Make one mobject move along the path of another mobject.
 *
 * Typically used with `rate_func=linear` to avoid double-application of the
 * rate function (the path proportion is computed as `rateFunc(alpha)`, which
 * is already applied by the base class before `interpolateMobject` is called).
 *
 * Python equivalent: `manim.animation.movement.MoveAlongPath`
 *
 * @example
 *   this.play(new MoveAlongPath(dot, line, { rateFunc: linear }))
 */
export class MoveAlongPath extends Animation {
  readonly path: IVMobject;

  constructor(
    mobject: IMobject,
    path: IVMobject,
    options: AnimationOptions = {},
  ) {
    super(mobject, options);
    this.path = path;
  }

  /**
   * Move the mobject to the point on the path corresponding to the current
   * proportion.  `alpha` here is already rateFunc-adjusted; the internal
   * `rateFunc(alpha)` call mirrors the Python source exactly.
   */
  override interpolateMobject(alpha: number): void {
    const point = this.path.pointFromProportion(this.rateFunc(alpha));
    this.mobject.moveTo(point);
  }
}
