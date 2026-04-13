/**
 * Tools for displaying multiple animations at once.
 *
 * Python equivalent: manim/animation/composition.py
 */

import type {
  IMobject,
  IScene,
  RateFunc,
} from "../../core/types.js";
import { Animation, prepareAnimation } from "../animation/index.js";
import type { ExtendedAnimationOptions } from "../animation/index.js";
import { AnimationBuilder, Group, Mobject } from "../../mobject/mobject/index.js";
import { removeListRedundancies } from "../../utils/iterables/index.js";
import { flattenIterableParameters } from "../../utils/parameter_parsing/index.js";
import { linear } from "../../utils/rate_functions/index.js";

// ─── Constants ───────────────────────────────────────────────

export const DEFAULT_LAGGED_START_LAG_RATIO = 0.05;

// ─── Types ───────────────────────────────────────────────────

export interface AnimationGroupOptions extends ExtendedAnimationOptions {
  group?: IMobject;
}

// ─── Internal timing record ──────────────────────────────────

interface AnimTiming {
  anim: Animation;
  start: number;
  end: number;
}

// ─── Arg parsing helper ──────────────────────────────────────

type AnimArg = Animation | AnimationBuilder | Iterable<Animation | AnimationBuilder>;

function isAnimArg(val: unknown): val is AnimArg {
  if (val instanceof Animation || val instanceof AnimationBuilder) return true;
  if (val != null && typeof val === "object" && Symbol.iterator in val) return true;
  return false;
}

function parseAnimGroupArgs(
  args: unknown[],
): { animArgs: AnimArg[]; options: AnimationGroupOptions } {
  let options: AnimationGroupOptions = {};
  let animArgs: AnimArg[];

  const last = args[args.length - 1];
  if (last != null && typeof last === "object" && !isAnimArg(last)) {
    options = last as AnimationGroupOptions;
    animArgs = args.slice(0, -1) as AnimArg[];
  } else {
    animArgs = args as AnimArg[];
  }

  return { animArgs, options };
}

// ─── AnimationGroup ──────────────────────────────────────────

/**
 * Plays a group or series of animations simultaneously.
 *
 * Python equivalent: manim.animation.composition.AnimationGroup
 */
export class AnimationGroup extends Animation {
  animations: Animation[];
  group: IMobject;

  protected animsWithTimings: AnimTiming[] = [];
  protected animsBegun: boolean[] = [];
  protected animsFinished: boolean[] = [];
  protected maxEndTime = 0;
  protected animGroupTime = 0;

  constructor(...args: unknown[]) {
    const { animArgs, options } = parseAnimGroupArgs(args);

    const flatAnims = flattenIterableParameters(animArgs);
    const animations = (flatAnims as Array<Animation | AnimationBuilder>).map(
      (a) => prepareAnimation(a),
    );

    const rateFunc = options.rateFunc ?? linear;
    const lagRatio = options.lagRatio ?? 0;

    let group: IMobject;
    if (options.group != null) {
      group = options.group;
    } else {
      const mobjects = removeListRedundancies(
        animations
          .filter((anim) => !anim.isIntroducer())
          .map((anim) => anim.mobject),
      );
      group = new Group(
        ...(mobjects as unknown as Mobject[]),
      ) as unknown as IMobject;
    }

    super(group, { ...options, rateFunc, lagRatio });

    this.animations = animations;
    this.group = group;
    this.runTime = this.initRunTime(
      options.runTime !== undefined ? options.runTime : null,
    );
  }

  getAllMobjects(): IMobject[] {
    return (this.group as unknown as Mobject).submobjects as unknown as IMobject[];
  }

  begin(): void {
    if (this.animations.length === 0) {
      throw new Error(
        `Trying to play ${this} without animations, this is not supported. ` +
          "Please add at least one subanimation.",
      );
    }
    this.animGroupTime = 0.0;
    if (this._suspendMobjectUpdating) {
      const mob = this.group as unknown as {
        suspendUpdating?: (recursive?: boolean) => void;
      };
      mob.suspendUpdating?.();
    }
    for (const anim of this.animations) {
      anim.begin();
    }
  }

  setupScene(scene: IScene): void {
    for (const anim of this.animations) {
      anim.setupScene(scene);
    }
  }

  finish(): void {
    for (const anim of this.animations) {
      anim.finish();
    }
    this.animsBegun = this.animsBegun.map(() => true);
    this.animsFinished = this.animsFinished.map(() => true);
    if (this._suspendMobjectUpdating) {
      const mob = this.group as unknown as {
        resumeUpdating?: (recursive?: boolean) => void;
      };
      mob.resumeUpdating?.();
    }
  }

  cleanUpFromScene(scene: IScene): void {
    this._onFinish(scene);
    for (const anim of this.animations) {
      if (this.remover) {
        anim.remover = this.remover;
      }
      anim.cleanUpFromScene(scene);
    }
  }

  updateMobjects(dt: number): void {
    for (let i = 0; i < this.animsWithTimings.length; i++) {
      if (this.animsBegun[i] && !this.animsFinished[i]) {
        this.animsWithTimings[i].anim.updateMobjects(dt);
      }
    }
  }

  initRunTime(runTime: number | null): number {
    this.buildAnimationsWithTimings();
    this.maxEndTime =
      this.animsWithTimings.length > 0
        ? Math.max(...this.animsWithTimings.map((t) => t.end))
        : 0;
    return runTime ?? this.maxEndTime;
  }

  buildAnimationsWithTimings(): void {
    const n = this.animations.length;
    this.animsBegun = new Array<boolean>(n).fill(false);
    this.animsFinished = new Array<boolean>(n).fill(false);
    this.animsWithTimings = [];

    if (n === 0) return;

    const runTimes = this.animations.map((a) => a.runTime);

    let cumulativeLag = 0;
    for (let i = 0; i < n; i++) {
      const start = cumulativeLag;
      const end = start + runTimes[i];
      this.animsWithTimings.push({ anim: this.animations[i], start, end });
      if (i < n - 1) {
        cumulativeLag += runTimes[i] * this.lagRatio;
      }
    }
  }

  interpolate(alpha: number): void {
    const animGroupTime = this.rateFunc(alpha) * this.maxEndTime;
    const timeGoesBack = animGroupTime < this.animGroupTime;

    for (let i = 0; i < this.animsWithTimings.length; i++) {
      const { anim, start, end } = this.animsWithTimings[i];
      const newBegun = animGroupTime >= start;
      const newFinished = animGroupTime > end;

      const shouldUpdate =
        (this.animsBegun[i] || newBegun) &&
        (!this.animsFinished[i] || !newFinished);

      if (shouldUpdate) {
        let runTime = end - start;
        const zeroRunTime = runTime === 0;
        if (zeroRunTime) runTime = 1;

        let subAlpha = (animGroupTime - start) / runTime;

        if (timeGoesBack) {
          if (subAlpha < 0 || zeroRunTime) subAlpha = 0;
        } else {
          if (subAlpha > 1 || zeroRunTime) subAlpha = 1;
        }

        anim.interpolate(subAlpha);
      }

      this.animsBegun[i] = newBegun;
      this.animsFinished[i] = newFinished;
    }

    this.animGroupTime = animGroupTime;
  }
}

// ─── Succession ──────────────────────────────────────────────

/**
 * Plays a series of animations in succession.
 *
 * Python equivalent: manim.animation.composition.Succession
 */
export class Succession extends AnimationGroup {
  protected activeIndex = 0;
  protected activeAnimation: Animation | null = null;
  protected activeStartTime: number | null = null;
  protected activeEndTime: number | null = null;
  protected scene!: IScene;

  constructor(...args: unknown[]) {
    const { animArgs, options } = parseAnimGroupArgs(args);
    super(...animArgs, { ...options, lagRatio: options.lagRatio ?? 1 });
  }

  begin(): void {
    if (this.animations.length === 0) {
      throw new Error(
        `Trying to play ${this} without animations, this is not supported. ` +
          "Please add at least one subanimation.",
      );
    }
    this.updateActiveAnimation(0);
  }

  finish(): void {
    while (this.activeAnimation !== null) {
      this.nextAnimation();
    }
  }

  updateMobjects(dt: number): void {
    if (this.activeAnimation) {
      this.activeAnimation.updateMobjects(dt);
    }
  }

  setupScene(scene: IScene): void {
    if (scene == null) return;
    if (this.isIntroducer()) {
      for (const anim of this.animations) {
        if (!anim.isIntroducer() && anim.mobject != null) {
          scene.add(anim.mobject);
        }
      }
    }
    this.scene = scene;
  }

  updateActiveAnimation(index: number): void {
    this.activeIndex = index;
    if (index >= this.animations.length) {
      this.activeAnimation = null;
      this.activeStartTime = null;
      this.activeEndTime = null;
    } else {
      this.activeAnimation = this.animations[index];
      this.activeAnimation.setupScene(this.scene);
      this.activeAnimation.begin();
      this.activeStartTime = this.animsWithTimings[index].start;
      this.activeEndTime = this.animsWithTimings[index].end;
    }
  }

  nextAnimation(): void {
    if (this.activeAnimation !== null) {
      this.activeAnimation.finish();
    }
    this.updateActiveAnimation(this.activeIndex + 1);
  }

  interpolate(alpha: number): void {
    const currentTime = this.rateFunc(alpha) * this.maxEndTime;
    while (this.activeEndTime !== null && currentTime >= this.activeEndTime) {
      this.nextAnimation();
    }
    if (this.activeAnimation !== null && this.activeStartTime !== null) {
      const elapsed = currentTime - this.activeStartTime;
      const activeRunTime = this.activeAnimation.runTime;
      const subAlpha = activeRunTime !== 0.0 ? elapsed / activeRunTime : 1.0;
      this.activeAnimation.interpolate(subAlpha);
    }
  }
}

// ─── LaggedStart ─────────────────────────────────────────────

/**
 * Adjusts the timing of a series of animations according to lagRatio.
 *
 * Python equivalent: manim.animation.composition.LaggedStart
 */
export class LaggedStart extends AnimationGroup {
  constructor(...args: unknown[]) {
    const { animArgs, options } = parseAnimGroupArgs(args);
    super(...animArgs, {
      ...options,
      lagRatio: options.lagRatio ?? DEFAULT_LAGGED_START_LAG_RATIO,
    });
  }
}

// ─── LaggedStartMap ──────────────────────────────────────────

/**
 * Plays a series of animations while mapping a function to submobjects.
 *
 * Python equivalent: manim.animation.composition.LaggedStartMap
 */
export class LaggedStartMap extends LaggedStart {
  constructor(
    animationClass: new (
      mobject: IMobject,
      options?: Record<string, unknown>,
    ) => Animation,
    mobject: IMobject,
    argCreator?: ((mob: IMobject) => IMobject) | null,
    options: {
      runTime?: number;
      lagRatio?: number;
      [key: string]: unknown;
    } = {},
  ) {
    const creator = argCreator ?? ((mob: IMobject) => mob);
    const {
      runTime = 2,
      lagRatio = DEFAULT_LAGGED_START_LAG_RATIO,
      ...animKwargs
    } = options;

    const submobjects = (mobject as unknown as Mobject)
      .submobjects as unknown as IMobject[];
    const animations = submobjects.map((submob) => {
      const arg = creator(submob);
      return new animationClass(arg, animKwargs);
    });

    super(...animations, { runTime, lagRatio });
  }
}
