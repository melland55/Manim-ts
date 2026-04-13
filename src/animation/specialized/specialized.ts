/**
 * Specialized animations for manim-ts.
 *
 * Python equivalent: manim/animation/specialized.py
 */

import type { IAnimation, IScene, RateFunc, IMobject } from "../../core/types.js";
import { ORIGIN } from "../../constants/index.js";
import type { Point3D } from "../../core/math/index.js";
import { linear } from "../../core/math/index.js";
import { Mobject, Group } from "../../mobject/mobject/index.js";
import { Restore } from "../transform/index.js";
import { Animation } from "../animation/animation.js";

// ─── Stub: AnimationGroup & LaggedStart ────────────────────
// animation.composition is not yet converted. Minimal stubs to
// unblock this module. Replace with real imports once composition lands.

const DEFAULT_LAGGED_START_LAG_RATIO = 0.05;

interface AnimationGroupOptions {
  group?: IMobject;
  runTime?: number;
  rateFunc?: RateFunc;
  lagRatio?: number;
  remover?: boolean;
  introducer?: boolean;
  suspendMobjectUpdating?: boolean;
  name?: string;
}

class AnimationGroup extends Animation {
  animations: IAnimation[];
  group: IMobject;
  protected maxEndTime: number = 0;
  protected animGroupTime: number = 0;
  private animsWithTimings: Array<{
    anim: IAnimation;
    start: number;
    end: number;
  }> = [];
  private animsBegun: boolean[] = [];
  private animsFinished: boolean[] = [];

  constructor(
    animations: IAnimation[],
    options: AnimationGroupOptions = {},
  ) {
    const mobjects = animations.map((a) => a.mobject) as unknown as Mobject[];
    const group = options.group ?? new Group(...mobjects);
    super(group as unknown as IMobject, {
      rateFunc: options.rateFunc ?? linear,
      lagRatio: options.lagRatio ?? 0,
      runTime: options.runTime,
      remover: options.remover,
      introducer: options.introducer,
      suspendMobjectUpdating: options.suspendMobjectUpdating,
      name: options.name,
    });
    this.animations = animations;
    this.group = group as IMobject;
    this.runTime = this.initRunTime(options.runTime);
  }

  override begin(): void {
    if (this.animations.length === 0) {
      throw new Error(
        `Trying to play ${this.constructor.name} without animations, this is not supported. ` +
          "Please add at least one subanimation.",
      );
    }
    this.animGroupTime = 0;
    for (const anim of this.animations) {
      anim.begin();
    }
  }

  override finish(): void {
    for (const anim of this.animations) {
      anim.finish();
    }
    this.animsBegun = this.animsBegun.map(() => true);
    this.animsFinished = this.animsFinished.map(() => true);
  }

  override cleanUpFromScene(scene: IScene): void {
    for (const anim of this.animations) {
      if (this.remover) {
        anim.remover = this.remover;
      }
      anim.cleanUpFromScene(scene);
    }
  }

  override getAllMobjects(): IMobject[] {
    return [this.group];
  }

  override interpolate(alpha: number): void {
    const animGroupTime = this.rateFunc(alpha) * this.maxEndTime;
    const timeGoesBack = animGroupTime < this.animGroupTime;

    for (let i = 0; i < this.animsWithTimings.length; i++) {
      const { anim, start, end } = this.animsWithTimings[i];
      const newBegun = animGroupTime >= start;
      const newFinished = animGroupTime > end;

      const wasActive =
        (this.animsBegun[i] || newBegun) &&
        (!this.animsFinished[i] || !newFinished);
      if (!wasActive) continue;

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
      this.animsBegun[i] = newBegun;
      this.animsFinished[i] = newFinished;
    }

    this.animGroupTime = animGroupTime;
  }

  protected initRunTime(runTime: number | undefined): number {
    this.buildAnimationsWithTimings();
    this.maxEndTime = this.animsWithTimings.reduce(
      (max, t) => Math.max(max, t.end),
      0,
    );
    return runTime ?? this.maxEndTime;
  }

  protected buildAnimationsWithTimings(): void {
    const n = this.animations.length;
    this.animsWithTimings = [];
    this.animsBegun = new Array(n).fill(false);
    this.animsFinished = new Array(n).fill(false);

    if (n === 0) return;

    let cumStart = 0;
    for (let i = 0; i < n; i++) {
      const rt = this.animations[i].runTime;
      const start = cumStart;
      const end = start + rt;
      this.animsWithTimings.push({ anim: this.animations[i], start, end });
      if (i < n - 1) {
        cumStart += rt * this.lagRatio;
      }
    }
  }
}

class LaggedStart extends AnimationGroup {
  constructor(
    animations: IAnimation[],
    options: AnimationGroupOptions = {},
  ) {
    super(animations, {
      ...options,
      lagRatio: options.lagRatio ?? DEFAULT_LAGGED_START_LAG_RATIO,
    });
  }
}

// ─── Broadcast ──────────────────────────────────────────────

export interface BroadcastOptions extends AnimationGroupOptions {
  focalPoint?: Point3D;
  nMobs?: number;
  initialOpacity?: number;
  finalOpacity?: number;
  initialWidth?: number;
}

/**
 * Broadcast a mobject starting from an initial width, up to its actual size.
 *
 * Creates copies of the mobject that emanate from a focal point, expanding
 * from `initialWidth` to the mobject's full size with fading opacity.
 *
 * Python equivalent: manim.animation.specialized.Broadcast
 */
export class Broadcast extends LaggedStart {
  focalPoint: Point3D;
  nMobs: number;
  initialOpacity: number;
  finalOpacity: number;
  initialWidth: number;

  constructor(
    mobject: Mobject,
    options: BroadcastOptions = {},
  ) {
    const focalPoint = options.focalPoint ?? ORIGIN;
    const nMobs = options.nMobs ?? 5;
    const initialOpacity = options.initialOpacity ?? 1;
    const finalOpacity = options.finalOpacity ?? 0;
    const initialWidth = options.initialWidth ?? 0.0;
    const remover = options.remover ?? true;
    const lagRatio = options.lagRatio ?? 0.2;
    const runTime = options.runTime ?? 3;

    const anims: IAnimation[] = [];

    // Determine if the mobject uses fill (has non-zero fillOpacity)
    const fillO = Boolean(
      (mobject as unknown as Record<string, unknown>).fillOpacity,
    );

    for (let i = 0; i < nMobs; i++) {
      const mob = mobject.copy();

      if (fillO) {
        mob.setOpacity(finalOpacity);
      } else {
        // setStroke exists on VMobject subclasses
        if (typeof (mob as unknown as Record<string, unknown>).setStroke === "function") {
          (mob as unknown as { setStroke(c?: unknown, w?: number, o?: number): unknown }).setStroke(
            undefined,
            undefined,
            finalOpacity,
          );
        }
      }

      mob.moveTo(focalPoint);
      mob.saveState();
      mob.set({ width: initialWidth });

      if (fillO) {
        mob.setOpacity(initialOpacity);
      } else {
        if (typeof (mob as unknown as Record<string, unknown>).setStroke === "function") {
          (mob as unknown as { setStroke(c?: unknown, w?: number, o?: number): unknown }).setStroke(
            undefined,
            undefined,
            initialOpacity,
          );
        }
      }

      anims.push(new Restore(mob, { remover }));
    }

    super(anims, { runTime, lagRatio, ...options });

    this.focalPoint = focalPoint;
    this.nMobs = nMobs;
    this.initialOpacity = initialOpacity;
    this.finalOpacity = finalOpacity;
    this.initialWidth = initialWidth;
  }
}
