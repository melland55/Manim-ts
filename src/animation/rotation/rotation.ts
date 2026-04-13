/**
 * Animations related to rotation.
 *
 * Python: manim.animation.rotation
 */

import type {
  IAnimation,
  IScene,
  AnimationOptions,
  IMobject,
  Point3D,
} from "../../core/types.js";
import type { RateFunc } from "../../core/types.js";
import { OUT, PI, TAU, linear, smooth, rotateVector } from "../../core/math/index.js";
import { np } from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";

// ── Extended mobject interface for runtime capabilities ───────────────────────
// IMobject does not yet declare `become`; concrete Mobject implementations will
// provide it. We extend locally so the type-checker accepts our calls.

/** Mobject with the runtime methods rotation animations require. */
interface RotatableMobject extends IMobject {
  /** Reset all points/state to match another mobject (Manim Mobject.become). */
  become(other: IMobject): this;
  /**
   * Rotate by angle around axis, with optional aboutPoint or aboutEdge.
   * Extends the base IMobject.rotate signature to include aboutEdge.
   */
  rotate(
    angle: number,
    axis?: Point3D,
    options?: { aboutPoint?: Point3D; aboutEdge?: Point3D },
  ): this;
}

// ── Rotating ──────────────────────────────────────────────────────────────────

/**
 * Animation that rotates a Mobject continuously.
 *
 * Each frame the mobject is reset to its starting state and rotated by a
 * fraction of the total angle determined by the rate function. This produces
 * a smooth, reversible rotation without accumulating floating-point drift.
 *
 * Default `runTime` is 5 s, default `rateFunc` is `linear` (matches Python).
 *
 * Python: `manim.animation.rotation.Rotating`
 *
 * @example
 * ```ts
 * const anim = new Rotating(myMob, TAU, OUT, null, null, 3, linear);
 * ```
 */
export class Rotating implements IAnimation {
  mobject: IMobject;
  /** Snapshot of the mobject captured in `begin()`. */
  protected startingMobject!: IMobject;

  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;
  protected readonly suspendMobjectUpdating: boolean;

  /** Total rotation in radians over the full animation. */
  readonly angle: number;
  /** Rotation axis as a unit vector (default: OUT = +Z). */
  readonly axis: Point3D;
  /** Explicit rotation centre; takes priority over `aboutEdge`. */
  readonly aboutPoint: Point3D | null;
  /** Bounding-box edge to use as rotation centre when `aboutPoint` is null. */
  readonly aboutEdge: Point3D | null;

  /**
   * @param mobject      The mobject to rotate.
   * @param angle        Total rotation in radians (default: TAU — full circle).
   * @param axis         Rotation axis vector (default: OUT).
   * @param aboutPoint   Rotation centre (default: null — use mobject centre or aboutEdge).
   * @param aboutEdge    Bounding-box edge direction to rotate about (default: null).
   * @param runTime      Duration in seconds (default: 5).
   * @param rateFunc     Easing function (default: linear).
   * @param options      Additional AnimationOptions.
   */
  constructor(
    mobject: IMobject,
    angle: number = TAU,
    axis: Point3D = OUT,
    aboutPoint: Point3D | null = null,
    aboutEdge: Point3D | null = null,
    runTime: number = 5,
    rateFunc: RateFunc = linear,
    options: AnimationOptions = {},
  ) {
    this.mobject = mobject;
    this.angle = angle;
    this.axis = axis;
    this.aboutPoint = aboutPoint;
    this.aboutEdge = aboutEdge;
    this.runTime = runTime;
    this.rateFunc = rateFunc;
    this.lagRatio = options.lagRatio ?? 0;
    this.name = options.name ?? "Rotating";
    this.remover = options.remover ?? false;
    this.introducer = options.introducer ?? false;
    this.suspendMobjectUpdating = options.suspendMobjectUpdating ?? true;
  }

  /** Snapshot the mobject and optionally suspend its updaters. */
  begin(): void {
    this.startingMobject = this.mobject.copy();
    if (this.suspendMobjectUpdating) {
      this.mobject.suspendUpdating?.();
    }
  }

  /** Apply the final frame then resume updaters. */
  finish(): void {
    this.interpolate(1);
    if (this.suspendMobjectUpdating) {
      this.mobject.resumeUpdating?.();
    }
  }

  /**
   * Drive the animation at normalised time `alpha` ∈ [0, 1].
   * Delegates directly to `interpolateMobject` without pre-applying rateFunc —
   * the rate function is applied inside `interpolateMobject` (matching Python).
   */
  interpolate(alpha: number): void {
    this.interpolateMobject(alpha);
  }

  /**
   * Reset to starting state and rotate by `rateFunc(alpha) * angle`.
   *
   * Note: the rate function is applied here (not in `interpolate`), mirroring
   * the Python implementation which does the same.
   */
  interpolateMobject(alpha: number): void {
    const mob = this.mobject as RotatableMobject;
    mob.become(this.startingMobject);

    const rotateOptions: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {};
    if (this.aboutPoint !== null) rotateOptions.aboutPoint = this.aboutPoint;
    if (this.aboutEdge !== null) rotateOptions.aboutEdge = this.aboutEdge;

    mob.rotate(this.rateFunc(alpha) * this.angle, this.axis, rotateOptions);
  }

  /** No-op: rotation is handled wholesale in `interpolateMobject`. */
  interpolateSubmobject(
    _submob: IMobject,
    _startSubmob: IMobject,
    _alpha: number,
  ): void {
    // Intentionally empty — overridden by interpolateMobject.
  }

  setupScene(_scene: IScene): void {
    // No scene setup required for Rotating.
  }

  cleanUpFromScene(scene: IScene): void {
    if (this.remover) {
      scene.remove(this.mobject);
    }
  }

  getAllMobjects(): IMobject[] {
    return [this.mobject, this.startingMobject];
  }

  copy(): IAnimation {
    const c = new Rotating(
      this.mobject,
      this.angle,
      this.axis,
      this.aboutPoint,
      this.aboutEdge,
      this.runTime,
      this.rateFunc,
      {
        lagRatio: this.lagRatio,
        name: this.name,
        remover: this.remover,
        introducer: this.introducer,
        suspendMobjectUpdating: this.suspendMobjectUpdating,
      },
    );
    if (this.startingMobject !== undefined) {
      c.startingMobject = this.startingMobject;
    }
    return c;
  }

  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }

  getRunTime(): number {
    return this.runTime;
  }
}

// ── Rotate ────────────────────────────────────────────────────────────────────

/**
 * Options specific to the Rotate animation.
 * `pathArc` and `pathArcAxis` default to the rotation angle/axis.
 */
export interface RotateOptions extends AnimationOptions {
  /**
   * Arc angle used for interpolating point paths (default: equals `angle`).
   * Set to 0 to interpolate along straight lines instead of arcs.
   */
  pathArc?: number;
  /** Axis for the arc path (default: equals `axis`). */
  pathArcAxis?: Point3D;
}

/**
 * Animation that rotates a Mobject via Transform-style interpolation.
 *
 * A rotated copy (`target`) is created at the start of the animation.
 * Each frame the mobject is reset to its starting state and partially rotated
 * so that points travel along circular arcs (when `pathArc` != 0) rather than
 * straight lines.
 *
 * Default `rateFunc` is `smooth` (matches Python Transform default).
 * Default `aboutPoint` is the mobject's centre.
 *
 * Python: `manim.animation.rotation.Rotate`
 *
 * @example
 * ```ts
 * const anim = new Rotate(myMob, PI, OUT);
 * ```
 */
export class Rotate implements IAnimation {
  mobject: IMobject;
  /** Snapshot of the mobject at animation start. */
  protected startingMobject!: IMobject;
  /** The fully-rotated target mobject (created in `begin()`). */
  protected targetMobject!: IMobject;

  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;
  protected readonly suspendMobjectUpdating: boolean;

  /** Rotation angle in radians (default: PI). */
  readonly angle: number;
  /** Rotation axis (default: OUT = +Z). */
  readonly axis: Point3D;
  /** Rotation centre (default: mobject's centre at construction time). */
  readonly aboutPoint: Point3D;
  /** Bounding-box edge direction to rotate about (used when aboutPoint is absent). */
  readonly aboutEdge: Point3D | null;

  /** Arc angle for path interpolation (set to `angle` by default). */
  readonly pathArc: number;
  /** Axis for arc path interpolation (set to `axis` by default). */
  readonly pathArcAxis: Point3D;
  /** Centre point for arc path interpolation (set to `aboutPoint`). */
  readonly pathArcCenters: Point3D;

  /**
   * @param mobject    The mobject to rotate.
   * @param angle      Rotation angle in radians (default: PI).
   * @param axis       Rotation axis (default: OUT).
   * @param aboutPoint Rotation centre (default: null → mobject.getCenter()).
   * @param aboutEdge  Bounding-box edge direction (default: null).
   * @param options    AnimationOptions plus optional pathArc / pathArcAxis overrides.
   */
  constructor(
    mobject: IMobject,
    angle: number = PI,
    axis: Point3D = OUT,
    aboutPoint: Point3D | null = null,
    aboutEdge: Point3D | null = null,
    options: RotateOptions = {},
  ) {
    this.mobject = mobject;
    this.angle = angle;
    this.axis = axis;
    this.aboutEdge = aboutEdge;
    // If no aboutPoint provided, use the mobject's current centre (matches Python).
    this.aboutPoint = aboutPoint ?? mobject.getCenter();

    // Arc path parameters — default to match the rotation geometry.
    this.pathArc = options.pathArc ?? angle;
    this.pathArcAxis = options.pathArcAxis ?? axis;
    this.pathArcCenters = this.aboutPoint;

    this.runTime = options.runTime ?? 1;
    this.rateFunc = options.rateFunc ?? smooth;
    this.lagRatio = options.lagRatio ?? 0;
    this.name = options.name ?? "Rotate";
    this.remover = options.remover ?? false;
    this.introducer = options.introducer ?? false;
    this.suspendMobjectUpdating = options.suspendMobjectUpdating ?? true;
  }

  /**
   * Create the fully-rotated target mobject.
   *
   * Python: `Rotate.create_target`
   */
  createTarget(): IMobject {
    const target = this.mobject.copy() as RotatableMobject;

    const rotateOptions: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {
      aboutPoint: this.aboutPoint,
    };
    if (this.aboutEdge !== null) rotateOptions.aboutEdge = this.aboutEdge;

    target.rotate(this.angle, this.axis, rotateOptions);
    return target;
  }

  /** Snapshot the mobject, create the target, and optionally suspend updaters. */
  begin(): void {
    this.targetMobject = this.createTarget();
    this.startingMobject = this.mobject.copy();
    if (this.suspendMobjectUpdating) {
      this.mobject.suspendUpdating?.();
    }
  }

  /** Apply the final frame then resume updaters. */
  finish(): void {
    this.interpolate(1);
    if (this.suspendMobjectUpdating) {
      this.mobject.resumeUpdating?.();
    }
  }

  /**
   * Drive the animation at normalised time `alpha` ∈ [0, 1].
   * Applies the rate function before delegating to `interpolateMobject`.
   */
  interpolate(alpha: number): void {
    this.interpolateMobject(this.rateFunc(alpha));
  }

  /**
   * Apply an arc-path rotation at progress `alpha` (already rate-func'd).
   *
   * The mobject is reset to its starting state, then each point is rotated
   * by `alpha * pathArc` around `pathArcCenters` along `pathArcAxis`.
   * When `pathArc` is 0, falls back to straight-line (linear) interpolation.
   */
  interpolateMobject(alpha: number): void {
    const mob = this.mobject as RotatableMobject;
    mob.become(this.startingMobject);

    if (this.pathArc !== 0) {
      // Arc path: rotate every point by alpha * pathArc around pathArcCenters.
      const center = this.pathArcCenters;
      const arcAngle = alpha * this.pathArc;
      const arcAxis = this.pathArcAxis;
      const centerArr = center.toArray() as number[];

      mob.applyFunction((point: Point3D): Point3D => {
        const pArr = point.toArray() as number[];
        const relative = np.array([
          pArr[0] - centerArr[0],
          pArr[1] - centerArr[1],
          pArr[2] - centerArr[2],
        ]);
        const rotated = rotateVector(relative, arcAngle, arcAxis) as NDArray;
        const rArr = rotated.toArray() as number[];
        return np.array([
          rArr[0] + centerArr[0],
          rArr[1] + centerArr[1],
          rArr[2] + centerArr[2],
        ]);
      });
    } else {
      // Straight-line interpolation: lerp from start toward target.
      // Apply the rotation scaled to alpha.
      mob.rotate(alpha * this.angle, this.axis, { aboutPoint: this.aboutPoint });
    }
  }

  /**
   * Interpolate a single submobject from its start state toward the target.
   * The base implementation delegates to the parent's `interpolateMobject`
   * which handles the whole family together.
   */
  interpolateSubmobject(
    _submob: IMobject,
    _startSubmob: IMobject,
    _alpha: number,
  ): void {
    // Rotation is handled wholesale in interpolateMobject.
  }

  setupScene(_scene: IScene): void {
    // No scene setup required for Rotate.
  }

  cleanUpFromScene(scene: IScene): void {
    if (this.remover) {
      scene.remove(this.mobject);
    }
  }

  getAllMobjects(): IMobject[] {
    return [this.mobject, this.startingMobject, this.targetMobject];
  }

  copy(): IAnimation {
    const c = new Rotate(
      this.mobject,
      this.angle,
      this.axis,
      this.aboutPoint,
      this.aboutEdge,
      {
        runTime: this.runTime,
        rateFunc: this.rateFunc,
        lagRatio: this.lagRatio,
        name: this.name,
        remover: this.remover,
        introducer: this.introducer,
        suspendMobjectUpdating: this.suspendMobjectUpdating,
        pathArc: this.pathArc,
        pathArcAxis: this.pathArcAxis,
      },
    );
    if (this.startingMobject !== undefined) {
      c.startingMobject = this.startingMobject;
    }
    if (this.targetMobject !== undefined) {
      c.targetMobject = this.targetMobject;
    }
    return c;
  }

  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }

  getRunTime(): number {
    return this.runTime;
  }
}
