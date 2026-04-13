/**
 * Base Animation class and related utilities for manim-ts.
 *
 * Python equivalent: manim/animation/animation.py
 */

import type {
  IAnimation,
  IMobject,
  IScene,
  AnimationOptions,
  RateFunc,
} from "../../core/types.js";
import { smooth, linear } from "../../core/math/index.js";
import { Mobject, Group, AnimationBuilder } from "../../mobject/mobject/index.js";

// ─── Constants ───────────────────────────────────────────────

export const DEFAULT_ANIMATION_RUN_TIME = 1.0;
export const DEFAULT_ANIMATION_LAG_RATIO = 0.0;

// ─── Animation ───────────────────────────────────────────────

export interface ExtendedAnimationOptions extends AnimationOptions {
  reverseRateFunction?: boolean;
  _onFinish?: (scene: IScene) => void;
}

export class Animation implements IAnimation {
  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  reverseRateFunction: boolean;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  protected startingMobject!: IMobject;
  protected _suspendMobjectUpdating: boolean;
  protected _onFinish: (scene: IScene) => void;

  private _runTime!: number;

  /** Original __init__ stored for setDefault() restore. */
  private static _originalDefaults: ExtendedAnimationOptions = {};
  private static _currentDefaults: ExtendedAnimationOptions = {};

  constructor(
    mobject: IMobject | null | undefined,
    options: ExtendedAnimationOptions = {},
  ) {
    const opts = { ...Animation._currentDefaults, ...options };
    this.mobject = (mobject ?? new Mobject()) as unknown as IMobject;
    this.runTime = opts.runTime ?? DEFAULT_ANIMATION_RUN_TIME;
    this.rateFunc = opts.rateFunc ?? smooth;
    this.reverseRateFunction = opts.reverseRateFunction ?? false;
    this.lagRatio = opts.lagRatio ?? DEFAULT_ANIMATION_LAG_RATIO;
    this.name = opts.name ?? "";
    this.remover = opts.remover ?? false;
    this.introducer = opts.introducer ?? false;
    this._suspendMobjectUpdating = opts.suspendMobjectUpdating ?? true;
    this._onFinish = opts._onFinish ?? (() => {});
  }

  // ── run_time property with validation ──

  get runTimeValue(): number {
    return this._runTime;
  }

  set runTimeValue(value: number) {
    if (value < 0) {
      throw new Error(
        `The run_time of ${this.constructor.name} cannot be negative. ` +
          `The given value was ${value}.`,
      );
    }
    this._runTime = value;
  }

  toString(): string {
    if (this.name) return this.name;
    return `${this.constructor.name}(${String(this.mobject)})`;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  begin(): void {
    this.startingMobject = this.createStartingMobject();
    if (this._suspendMobjectUpdating) {
      const mob = this.mobject as unknown as { suspendUpdating?: () => void };
      mob.suspendUpdating?.();
    }
    this.interpolate(0);
  }

  finish(): void {
    this.interpolate(1);
    if (this._suspendMobjectUpdating && this.mobject != null) {
      const mob = this.mobject as unknown as { resumeUpdating?: () => void };
      mob.resumeUpdating?.();
    }
  }

  cleanUpFromScene(scene: IScene): void {
    this._onFinish(scene);
    if (this.isRemover()) {
      scene.remove(this.mobject);
    }
  }

  setupScene(scene: IScene): void {
    if (scene == null) return;
    if (this.isIntroducer()) {
      // Add mobject if it's not already in the scene's family
      const familyMembers = scene.mobjects.flatMap((m) =>
        m.getFamily ? m.getFamily() : [m],
      );
      if (!familyMembers.includes(this.mobject)) {
        scene.add(this.mobject);
      }
    }
  }

  createStartingMobject(): IMobject {
    return this.mobject.copy();
  }

  // ─── Mobject access ────────────────────────────────────────

  getAllMobjects(): IMobject[] {
    return [this.mobject, this.startingMobject];
  }

  protected getAllFamiliesZipped(): Array<IMobject[]> {
    const allMobjects = this.getAllMobjects();
    const families = allMobjects.map((mob) => {
      const m = mob as unknown as Record<string, unknown>;
      if (typeof m.familyMembersWithPoints === "function") {
        return (m.familyMembersWithPoints as () => IMobject[])();
      }
      return mob.getFamily ? mob.getFamily() : [mob];
    });
    const len = Math.min(...families.map((f) => f.length));
    const result: Array<IMobject[]> = [];
    for (let i = 0; i < len; i++) {
      result.push(families.map((f) => f[i]));
    }
    return result;
  }

  updateMobjects(dt: number): void {
    for (const mob of this.getAllMobjectsToUpdate()) {
      const m = mob as unknown as Record<string, unknown>;
      if (typeof m.update === "function") {
        (m.update as (dt: number) => void)(dt);
      }
    }
  }

  getAllMobjectsToUpdate(): IMobject[] {
    return this.getAllMobjects().filter((m) => m !== this.mobject);
  }

  // ─── Interpolation ────────────────────────────────────────

  interpolate(alpha: number): void {
    this.interpolateMobject(alpha);
  }

  interpolateMobject(alpha: number): void {
    const families = this.getAllFamiliesZipped();
    const n = families.length;
    for (let i = 0; i < n; i++) {
      const subAlpha = this.getSubAlpha(alpha, i, n);
      this.interpolateSubmobject(
        families[i][0],
        families[i][1],
        subAlpha,
      );
    }
  }

  interpolateSubmobject(
    _submob: IMobject,
    _startSubmob: IMobject,
    _alpha: number,
  ): void {
    // Base: no-op. Override in subclasses.
  }

  protected getSubAlpha(
    alpha: number,
    index: number,
    numSubmobjects: number,
  ): number {
    const lagRatio = this.lagRatio;
    const fullLength = (numSubmobjects - 1) * lagRatio + 1;
    const value = alpha * fullLength;
    const lower = index * lagRatio;
    if (this.reverseRateFunction) {
      return this.rateFunc(1 - (value - lower));
    }
    return this.rateFunc(value - lower);
  }

  // ─── Copy ──────────────────────────────────────────────────

  copy(): IAnimation {
    const clone = Object.create(Object.getPrototypeOf(this)) as this;
    Object.assign(clone, this);
    return clone;
  }

  // ─── Getters & setters ────────────────────────────────────

  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }

  getRunTime(): number {
    return this.runTime;
  }

  setRunTime(runTime: number): this {
    this.runTime = runTime;
    return this;
  }

  setRateFunc(rateFunc: RateFunc): this {
    this.rateFunc = rateFunc;
    return this;
  }

  getRateFunc(): RateFunc {
    return this.rateFunc;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  isRemover(): boolean {
    return this.remover;
  }

  isIntroducer(): boolean {
    return this.introducer;
  }

  // ─── setDefault (class-level) ──────────────────────────────

  static setDefault(kwargs?: ExtendedAnimationOptions): void {
    if (kwargs && Object.keys(kwargs).length > 0) {
      this._currentDefaults = { ...this._currentDefaults, ...kwargs };
    } else {
      this._currentDefaults = {};
    }
  }
}

// ─── Wait ────────────────────────────────────────────────────

export interface WaitOptions extends ExtendedAnimationOptions {
  stopCondition?: (() => boolean) | null;
  frozenFrame?: boolean | null;
}

/**
 * A "no operation" animation.
 *
 * Plays for the given run_time without modifying any mobject.
 */
export class Wait extends Animation {
  duration: number;
  stopCondition: (() => boolean) | null;
  isStaticWait: boolean | null;

  constructor(options: WaitOptions = {}) {
    const {
      stopCondition = null,
      frozenFrame = null,
      runTime = 1,
      rateFunc,
      ...rest
    } = options;

    if (stopCondition && frozenFrame) {
      throw new Error("A static Wait animation cannot have a stop condition.");
    }

    super(null, {
      runTime,
      rateFunc: rateFunc ?? linear,
      ...rest,
    });

    this.duration = runTime;
    this.stopCondition = stopCondition;
    this.isStaticWait = frozenFrame ?? null;
  }

  begin(): void {
    // no-op
  }

  finish(): void {
    // no-op
  }

  cleanUpFromScene(_scene: IScene): void {
    // no-op
  }

  updateMobjects(_dt: number): void {
    // no-op
  }

  interpolate(_alpha: number): void {
    // no-op
  }
}

// ─── Add ─────────────────────────────────────────────────────

/**
 * Add Mobjects to a scene without animating them.
 *
 * Similar to Scene.add(), but as an Animation that can be
 * grouped with other animations (e.g., in Succession).
 */
export class Add extends Animation {
  constructor(
    mobjects: IMobject | IMobject[],
    options: ExtendedAnimationOptions = {},
  ) {
    const mobs = Array.isArray(mobjects) ? mobjects : [mobjects];
    const mobject =
      mobs.length === 1
        ? mobs[0]
        : (new Group(...(mobs as unknown as Mobject[])) as unknown as IMobject);
    super(mobject, {
      runTime: options.runTime ?? 0,
      introducer: true,
      ...options,
    });
  }

  begin(): void {
    // no-op
  }

  finish(): void {
    // no-op
  }

  cleanUpFromScene(_scene: IScene): void {
    // no-op
  }

  updateMobjects(_dt: number): void {
    // no-op
  }

  interpolate(_alpha: number): void {
    // no-op
  }
}

// ─── prepareAnimation ────────────────────────────────────────

/**
 * Returns either an unchanged animation, or the animation built
 * from a passed AnimationBuilder.
 */
export function prepareAnimation(
  anim: Animation | AnimationBuilder,
): Animation {
  if (anim instanceof AnimationBuilder) {
    return anim.build() as Animation;
  }
  if (anim instanceof Animation) {
    return anim;
  }
  throw new TypeError(
    `Object ${String(anim)} cannot be converted to an animation`,
  );
}

// ─── overrideAnimation ───────────────────────────────────────

/**
 * Decorator-style function used to mark methods as overrides for
 * specific Animation types.
 *
 * In TypeScript, use as a higher-order function:
 * ```
 * class MySquare extends Square {
 *   static {
 *     overrideAnimation(FadeIn)(MySquare.prototype._fadeInOverride);
 *   }
 *   _fadeInOverride(kwargs) { return new Create(this, kwargs); }
 * }
 * ```
 *
 * Or call Mobject.addAnimationOverride directly.
 */
export function overrideAnimation(
  animationClass: new (...args: unknown[]) => Animation,
): (func: (...args: unknown[]) => Animation) => (...args: unknown[]) => Animation {
  return (func) => {
    (func as unknown as Record<string, unknown>)._overrideAnimation =
      animationClass;
    return func;
  };
}
