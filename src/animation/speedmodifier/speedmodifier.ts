/**
 * Utilities for modifying the speed at which animations are played.
 * Python: manim/animation/speedmodifier.py
 */

import type {
  IAnimation,
  IScene,
  IMobject,
  AnimationOptions,
  RateFunc,
  Updater,
} from "../../core/types.js";

// ── Dependency stubs ──────────────────────────────────────────────────────────
// These represent classes from modules not yet converted to TypeScript.
// When animation/animation and animation/composition are implemented,
// replace these with real imports.

/**
 * Extended animation interface capturing methods that the Animation base class
 * will expose beyond the IAnimation contract (not yet converted).
 * Python: manim.animation.animation.Animation
 */
export interface IAnimationExt extends IAnimation {
  /** Mutate the rate function in-place and return self. */
  setRateFunc(func: RateFunc): this;
  /** Advance time-dependent updaters on the mobject. */
  updateMobjects(dt: number): void;
}

/**
 * Interface for AnimationGroup (not yet converted).
 * Python: manim.animation.composition.AnimationGroup
 */
export interface IAnimationGroup extends IAnimationExt {
  animations: IAnimationExt[];
  group: IMobject | null;
}

/**
 * Interface for Wait animation (not yet converted).
 * Python: manim.animation.animation.Wait
 */
export type IWait = IAnimationExt;

/** Duck-type guard: does this animation look like an AnimationGroup? */
function isAnimationGroup(anim: IAnimation): anim is IAnimationGroup {
  return (
    "animations" in anim &&
    Array.isArray((anim as IAnimationGroup).animations)
  );
}

// ── piecewise helper ──────────────────────────────────────────────────────────

/**
 * Scalar equivalent of numpy.piecewise.
 * Returns funclist[i](x) for the first condlist[i] that is true.
 * Returns x unchanged if no condition matches.
 */
function piecewise(
  x: number,
  condlist: boolean[],
  funclist: Array<(t: number) => number>,
): number {
  for (let i = 0; i < condlist.length; i++) {
    if (condlist[i]) {
      return funclist[i](x);
    }
  }
  return x;
}

// ── ChangeSpeed ───────────────────────────────────────────────────────────────

export interface ChangeSpeedOptions extends AnimationOptions {
  /** Whether this ChangeSpeed animation controls dt for ChangeSpeed updaters. */
  affectsSpeedUpdaters?: boolean;
}

/**
 * Modifies the speed at which a wrapped animation plays.
 *
 * `AnimationGroup` with different `lagRatio` can also be used, combining
 * multiple animations into one. The `runTime` of the passed animation is
 * changed to modify the speed.
 *
 * Python: manim.animation.speedmodifier.ChangeSpeed
 *
 * @example
 * ```ts
 * new ChangeSpeed(
 *   new AnimationGroup(
 *     a.animate({ runTime: 1 }).shift(RIGHT.multiply(8)),
 *     b.animate({ runTime: 1 }).shift(LEFT.multiply(8)),
 *   ),
 *   { 0.3: 1, 0.4: 0.1, 0.6: 0.1, 1: 1 },
 *   linear,
 * )
 * ```
 */
export class ChangeSpeed implements IAnimation {
  // ── Static state shared across all ChangeSpeed instances ─────────────────

  /**
   * The current dt override for speed-aware updaters.
   * Python: ChangeSpeed.dt
   */
  static dt: number = 0;

  /**
   * Whether a ChangeSpeed animation that controls dt is currently playing.
   * Python: ChangeSpeed.is_changing_dt
   */
  static isChangingDt: boolean = false;

  // ── IAnimation fields ─────────────────────────────────────────────────────

  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  // ── Internal state ────────────────────────────────────────────────────────

  /** The wrapped animation (after setup). */
  readonly anim: IAnimationExt;

  /** Whether this instance controls dt for speed-aware updaters. */
  readonly affectsSpeedUpdaters: boolean;

  /** Current progress through the remapped timeline (for dt calculation). */
  private t: number = 0;

  /** Sorted speed nodes: proportion → speed factor. */
  private readonly speedinfo: Map<number, number>;

  /** Piecewise condition functions. */
  private readonly conditions: Array<(t: number) => boolean>;

  /** Piecewise mapping functions. */
  private readonly functions: Array<(t: number) => number>;

  // ── Quadratic speed-change math ───────────────────────────────────────────

  /**
   * Maps normalised progress x ∈ [0, f_inv_1] to proportion ∈ [0, 1] within
   * one speed segment.
   *
   * Vertical parabola satisfying:
   *   f(0) = 0,  f'(0) = initSpeed,  f'(f_inv_1) = finalSpeed
   *
   * Python: self.speed_modifier
   */
  private readonly speedModifier: (
    x: number,
    initSpeed: number,
    finalSpeed: number,
  ) => number;

  /**
   * Returns the normalised time at which the segment output reaches 1.
   * Python: self.f_inv_1
   */
  private readonly fInv1: (initSpeed: number, finalSpeed: number) => number;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    anim: IAnimationExt,
    speedinfo: Record<number, number>,
    rateFunc: RateFunc | null = null,
    affectsSpeedUpdaters: boolean = true,
    options: AnimationOptions = {},
  ) {
    // Set up the wrapped animation, reconstructing AnimationGroup if needed.
    if (isAnimationGroup(anim)) {
      const group = anim as IAnimationGroup;
      // Reconstruct the AnimationGroup with setup applied to each child.
      // The concrete AnimationGroup constructor is called via its own type
      // so that subclasses are preserved.
      const setupAnimations = group.animations.map((a) =>
        this.setup(a),
      );
      // Build a shallow clone that re-uses the group's configuration.
      // When animation/composition is converted, this becomes:
      //   this.anim = new (group.constructor as AnimationGroupCtor)(...)
      // For now we mutate the group in-place and re-use it.
      (group as { animations: IAnimationExt[] }).animations = setupAnimations;
      this.anim = group;
    } else {
      this.anim = this.setup(anim);
    }

    // Validate and record affects_speed_updaters.
    if (affectsSpeedUpdaters) {
      if (ChangeSpeed.isChangingDt) {
        throw new Error(
          "Only one animation at a time can play that changes speed (dt) for ChangeSpeed updaters",
        );
      }
      ChangeSpeed.isChangingDt = true;
      this.t = 0;
    }
    this.affectsSpeedUpdaters = affectsSpeedUpdaters;

    // The effective rate function applied before speed remapping.
    this.rateFunc = rateFunc ?? this.anim.rateFunc;

    // ── Quadratic helpers ────────────────────────────────────────────────────
    this.speedModifier = (
      x: number,
      initSpeed: number,
      finalSpeed: number,
    ): number =>
      ((finalSpeed ** 2 - initSpeed ** 2) * x ** 2) / 4 + initSpeed * x;

    this.fInv1 = (initSpeed: number, finalSpeed: number): number =>
      2 / (initSpeed + finalSpeed);

    // ── Normalise speedinfo ──────────────────────────────────────────────────
    const rawInfo = { ...speedinfo };
    if (!(0 in rawInfo)) {
      rawInfo[0] = 1;
    }
    if (!(1 in rawInfo)) {
      const sortedEntries = Object.entries(rawInfo).sort(
        ([a], [b]) => Number(a) - Number(b),
      );
      rawInfo[1] = Number(sortedEntries[sortedEntries.length - 1][1]);
    }

    this.speedinfo = new Map(
      Object.entries(rawInfo)
        .map(([k, v]) => [Number(k), v] as [number, number])
        .sort(([a], [b]) => a - b),
    );

    // ── Build piecewise conditions and functions ─────────────────────────────
    this.conditions = [];
    this.functions = [];

    const scaledTotalTime = this.getScaledTotalTime();
    const nodes = [...this.speedinfo.entries()];

    let prevnode = 0;
    let initSpeed = this.speedinfo.get(0)!;
    let currTime = 0;

    for (let i = 1; i < nodes.length; i++) {
      const [node, finalSpeed] = nodes[i];
      const dur = node - prevnode;

      // Capture loop variables for closures.
      const capturedCurrTime = currTime;
      const capturedInitSpeed = initSpeed;
      const capturedFinalSpeed = finalSpeed;
      const capturedDur = dur;
      const capturedPrevnode = prevnode;

      this.conditions.push((t: number): boolean => {
        const lowerBound = capturedCurrTime / scaledTotalTime;
        const upperBound =
          (capturedCurrTime +
            this.fInv1(capturedInitSpeed, capturedFinalSpeed) * capturedDur) /
          scaledTotalTime;
        return t >= lowerBound && t <= upperBound;
      });

      this.functions.push((t: number): number => {
        return (
          this.speedModifier(
            (scaledTotalTime * t - capturedCurrTime) / capturedDur,
            capturedInitSpeed,
            capturedFinalSpeed,
          ) *
            capturedDur +
          capturedPrevnode
        );
      });

      currTime += this.fInv1(initSpeed, finalSpeed) * dur;
      prevnode = node;
      initSpeed = finalSpeed;
    }

    // ── Wire up the modified rate function on the wrapped animation ───────────
    const func = (t: number): number => {
      if (t === 1) {
        ChangeSpeed.isChangingDt = false;
      }
      const rt = this.rateFunc(t);
      const newT = piecewise(
        rt,
        this.conditions.map((cond) => cond(rt)),
        this.functions,
      );
      if (this.affectsSpeedUpdaters) {
        ChangeSpeed.dt = (newT - this.t) * this.anim.runTime;
        this.t = newT;
      }
      return newT;
    };

    this.anim.setRateFunc(func);

    // ── IAnimation fields ────────────────────────────────────────────────────
    this.mobject = this.anim.mobject;
    this.runTime = scaledTotalTime * this.anim.runTime;
    this.lagRatio = options.lagRatio ?? 0;
    this.name = options.name ?? "ChangeSpeed";
    this.remover = options.remover ?? false;
    this.introducer = options.introducer ?? false;
  }

  // ── Setup helper ─────────────────────────────────────────────────────────

  /**
   * Prepares a single animation for use inside ChangeSpeed.
   *
   * For Wait animations the `interpolate` method is patched so that it
   * applies `rateFunc` rather than a no-op, mirroring the Python
   * `types.MethodType` trick.
   *
   * Python: ChangeSpeed.setup
   */
  setup(anim: IAnimationExt): IAnimationExt {
    // If this looks like a Wait (has rateFunc but no meaningful interpolate),
    // patch interpolate to apply rateFunc.  When animation/animation is
    // converted the isWait() guard should be tightened.
    if (isWait(anim)) {
      const rf = anim.rateFunc;
      anim.interpolate = (alpha: number): void => {
        rf(alpha);
      };
    }
    // prepare_animation: if anim is an _AnimationBuilder, call .build().
    // When mobject/mobject is converted this becomes prepareAnimation(anim).
    return anim;
  }

  // ── Scaled time helper ────────────────────────────────────────────────────

  /**
   * Returns the total time the remapped animation takes when runTime is
   * normalised to 1.
   *
   * Python: ChangeSpeed.get_scaled_total_time
   */
  getScaledTotalTime(): number {
    let prevnode = 0;
    let initSpeed = this.speedinfo.get(0)!;
    let totalTime = 0;

    const nodes = [...this.speedinfo.entries()];
    for (let i = 1; i < nodes.length; i++) {
      const [node, finalSpeed] = nodes[i];
      const dur = node - prevnode;
      totalTime += dur * this.fInv1(initSpeed, finalSpeed);
      prevnode = node;
      initSpeed = finalSpeed;
    }
    return totalTime;
  }

  // ── Static add_updater ────────────────────────────────────────────────────

  /**
   * Attaches an updater to a mobject that respects ChangeSpeed's dt override.
   *
   * When a ChangeSpeed animation with `affectsSpeedUpdaters=true` is playing,
   * updaters added via this method receive the remapped dt instead of the
   * scene's real dt.
   *
   * Python: ChangeSpeed.add_updater
   *
   * @param mobject         The mobject to attach the updater to.
   * @param updateFunction  The updater function (mob, dt?) => void.
   * @param index           Position in the updater list (optional).
   * @param callUpdater     Whether to call the updater immediately.
   */
  static addUpdater(
    mobject: IMobject,
    updateFunction: Updater | ((mob: IMobject) => void),
    index?: number,
    callUpdater: boolean = false,
  ): void {
    // Detect whether the updater expects a dt argument by checking its arity.
    // This mirrors Python's `inspect.signature` check for a "dt" parameter.
    if (updateFunction.length >= 2) {
      const dtUpdater = updateFunction as Updater;
      mobject.addUpdater(
        (mob: IMobject, dt: number): void => {
          dtUpdater(mob, ChangeSpeed.isChangingDt ? ChangeSpeed.dt : dt);
        },
        index,
        callUpdater,
      );
    } else {
      mobject.addUpdater(
        updateFunction as Updater,
        index,
        callUpdater,
      );
    }
  }

  // ── IAnimation lifecycle ──────────────────────────────────────────────────

  /** Python: ChangeSpeed.interpolate */
  interpolate(alpha: number): void {
    this.anim.interpolate(alpha);
  }

  /** Python: ChangeSpeed.update_mobjects */
  updateMobjects(dt: number): void {
    this.anim.updateMobjects(dt);
  }

  /** Python: ChangeSpeed.finish */
  finish(): void {
    ChangeSpeed.isChangingDt = false;
    this.anim.finish();
  }

  /** Python: ChangeSpeed.begin */
  begin(): void {
    this.anim.begin();
  }

  /** Python: ChangeSpeed.clean_up_from_scene */
  cleanUpFromScene(scene: IScene): void {
    this.anim.cleanUpFromScene(scene);
  }

  /** Python: ChangeSpeed._setup_scene */
  setupScene(scene: IScene): void {
    this.anim.setupScene(scene);
  }

  // ── IAnimation required methods ───────────────────────────────────────────

  interpolateMobject(alpha: number): void {
    this.anim.interpolateMobject(alpha);
  }

  interpolateSubmobject(
    submob: IMobject,
    startSubmob: IMobject,
    alpha: number,
  ): void {
    this.anim.interpolateSubmobject(submob, startSubmob, alpha);
  }

  getAllMobjects(): IMobject[] {
    return this.anim.getAllMobjects();
  }

  copy(): IAnimation {
    // Shallow copy — deep copy is deferred until Animation base class exists.
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }

  getRunTime(): number {
    return this.runTime;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Duck-type guard: is this animation a Wait?
 * A Wait has no meaningful `interpolate` (it's a no-op in the base class),
 * so we detect it by the absence of animations/group (not an AnimationGroup)
 * and the presence of a trivial interpolate implementation.
 *
 * When animation/animation is converted, this should be replaced with
 * `anim instanceof Wait`.
 */
function isWait(anim: IAnimationExt): boolean {
  // Heuristic: treat as Wait if it carries an `_isWait` marker or if
  // it has no mobject-specific content.  Real detection deferred until
  // animation/animation is converted.
  return "_isWait" in anim && (anim as { _isWait: unknown })._isWait === true;
}
