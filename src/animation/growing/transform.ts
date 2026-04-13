/**
 * Transform — base animation class for morphing one mobject into another.
 *
 * Python: manim.animation.transform.Transform
 *
 * A Transform stores a starting copy and a target copy of the mobject,
 * then interpolates between them each frame using a PathFunc. Subclasses
 * override createTarget() and createStartingMobject() to control the
 * start/end states.
 */

import type {
  IAnimation,
  IMobject,
  IVMobject,
  IScene,
  AnimationOptions,
  RateFunc,
} from "../../core/types.js";
import { smooth, squishRateFunc, linear } from "../../core/math/index.js";
import { type PathFunc, straightPath } from "./path-functions.js";

// ─── Options ─────────────────────────────────────────────────

export interface TransformOptions extends AnimationOptions {
  /** Path function controlling point trajectories. Defaults to straightPath(). */
  pathFunc?: PathFunc;
}

// ─── Transform ───────────────────────────────────────────────

/**
 * Base animation class that transitions a mobject from one state to another.
 *
 * begin() calls createTarget() and createStartingMobject() to produce the
 * two endpoint states. Each frame, interpolateMobject() blends their point
 * arrays using pathFunc and updates the live mobject.
 *
 * Python: manim.animation.transform.Transform
 */
export class Transform implements IAnimation {
  // ── IAnimation fields ──────────────────────────────────────
  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  // ── Internal state ─────────────────────────────────────────
  protected pathFunc: PathFunc;
  protected startingMobject: IMobject | null = null;
  protected targetMobject: IMobject | null = null;

  constructor(mobject: IMobject, options: TransformOptions = {}) {
    this.mobject = mobject;
    this.runTime = options.runTime ?? 1.0;
    this.rateFunc = options.rateFunc ?? smooth;
    this.lagRatio = options.lagRatio ?? 0;
    this.name = options.name ?? this.constructor.name;
    this.remover = options.remover ?? false;
    this.introducer = options.introducer ?? false;
    this.pathFunc = options.pathFunc ?? straightPath();
  }

  // ── Lifecycle ──────────────────────────────────────────────

  begin(): void {
    this.targetMobject = this.createTarget();
    this.startingMobject = this.createStartingMobject();
  }

  finish(): void {
    // Snap to final state
    this.interpolateMobject(1);
  }

  // ── Interpolation ──────────────────────────────────────────

  interpolate(alpha: number): void {
    this.interpolateMobject(this.rateFunc(alpha));
  }

  interpolateMobject(alpha: number): void {
    if (!this.startingMobject || !this.targetMobject) return;

    const startFamily = this.startingMobject.getFamily();
    const targetFamily = this.targetMobject.getFamily();
    const mobFamily = this.mobject.getFamily();
    const n = Math.min(startFamily.length, targetFamily.length, mobFamily.length);

    for (let i = 0; i < n; i++) {
      const subAlpha = this._getSubAlpha(alpha, i, n);
      this._interpolateThree(mobFamily[i], startFamily[i], targetFamily[i], subAlpha);
    }
  }

  /**
   * Satisfies IAnimation interface. Called externally; internally Transform
   * uses _interpolateThree (which also has the target) for full interpolation.
   */
  interpolateSubmobject(submob: IMobject, startSubmob: IMobject, alpha: number): void {
    if (!this.targetMobject) return;
    const mobFamily = this.mobject.getFamily();
    const targetFamily = this.targetMobject.getFamily();
    const idx = mobFamily.indexOf(submob);
    const targetSub =
      idx >= 0 && idx < targetFamily.length ? targetFamily[idx] : this.targetMobject;
    this._interpolateThree(submob, startSubmob, targetSub, alpha);
  }

  // ── Overridable factory methods ────────────────────────────

  /**
   * Return the end state of the animation.
   * Default: the mobject itself (identity transform).
   */
  createTarget(): IMobject {
    return this.mobject;
  }

  /**
   * Return the start state of the animation.
   * Default: a copy of the mobject as it exists when begin() is called.
   */
  createStartingMobject(): IMobject {
    return this.mobject.copy();
  }

  // ── IAnimation plumbing ────────────────────────────────────

  setupScene(_scene: IScene): void {
    // no-op — subclasses may override
  }

  cleanUpFromScene(_scene: IScene): void {
    // no-op — subclasses may override
  }

  getAllMobjects(): IMobject[] {
    const result: IMobject[] = [this.mobject];
    if (this.startingMobject) result.push(this.startingMobject);
    return result;
  }

  copy(): IAnimation {
    return Object.assign(Object.create(Object.getPrototypeOf(this) as object), this) as IAnimation;
  }

  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }

  getRunTime(): number {
    return this.runTime;
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Interpolate three parallel submobjects: the live mob, its start copy,
   * and its target copy. Updates mob.points (if VMobject) and mob.color.
   */
  private _interpolateThree(
    mob: IMobject,
    start: IMobject,
    target: IMobject,
    alpha: number
  ): void {
    // Point interpolation for VMobjects (those with a `points` property)
    type WithPoints = { points: IVMobject["points"] };
    const startV = start as IMobject & Partial<WithPoints>;
    const targetV = target as IMobject & Partial<WithPoints>;
    const mobV = mob as IMobject & Partial<WithPoints>;

    if (
      startV.points !== undefined &&
      targetV.points !== undefined &&
      mobV.points !== undefined
    ) {
      mobV.points = this.pathFunc(startV.points, targetV.points, alpha);
    }

    // Color interpolation
    mob.setColor(start.color.interpolate(target.color, alpha));
  }

  /**
   * Compute the alpha value for a submobject at position `index` out of
   * `total`, accounting for lagRatio (staggered playback).
   */
  private _getSubAlpha(alpha: number, index: number, total: number): number {
    if (this.lagRatio === 0 || total <= 1) return alpha;
    const fullLength = (total - 1) * this.lagRatio + 1;
    const a = (index * this.lagRatio) / fullLength;
    const b = (index * this.lagRatio + 1) / fullLength;
    return squishRateFunc(linear, a, b)(alpha);
  }
}
