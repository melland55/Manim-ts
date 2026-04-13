/**
 * Fading in and out of view.
 *
 * Python: manim.animation.fading
 *
 * Provides FadeIn and FadeOut animations that fade mobjects while optionally
 * shifting and scaling them.
 */

import type { IMobject, IScene, Point3D } from "../../core/types.js";
import { ORIGIN } from "../../core/math/index.js";
import { Transform } from "../growing/transform.js";
import type { TransformOptions } from "../growing/transform.js";
import { Mobject, Group } from "../../mobject/mobject/index.js";

// ─── Options ─────────────────────────────────────────────────

export interface FadeOptions extends TransformOptions {
  /** Vector by which the mobject shifts while fading. */
  shift?: Point3D;
  /**
   * Position to/from which the mobject moves while fading.
   * If a Mobject is given, its center is used.
   */
  targetPosition?: Point3D | Mobject;
  /** Scale factor applied to the faded copy. Defaults to 1. */
  scale?: number;
}

// ─── _Fade (internal base) ───────────────────────────────────

/**
 * Internal base class for fade animations.
 * Handles shift, target_position, and scale logic shared by FadeIn/FadeOut.
 */
class _Fade extends Transform {
  protected shiftVector: Point3D;
  protected scaleFactor: number;
  protected pointTarget: boolean;

  constructor(mobjects: Mobject[], options: FadeOptions = {}) {
    if (mobjects.length === 0) {
      throw new Error("At least one mobject must be passed.");
    }

    const mobject: Mobject =
      mobjects.length === 1 ? mobjects[0] : new Group(...mobjects);

    let shift = options.shift ?? null;
    let pointTarget = false;

    if (shift === null) {
      if (options.targetPosition != null) {
        let targetPos: Point3D;
        if (options.targetPosition instanceof Mobject) {
          targetPos = options.targetPosition.getCenter();
        } else {
          targetPos = options.targetPosition;
        }
        shift = targetPos.subtract(mobject.getCenter());
        pointTarget = true;
      } else {
        shift = ORIGIN;
      }
    }

    // Remove fade-specific keys before passing to Transform
    const { shift: _s, targetPosition: _tp, scale: _sc, ...transformOpts } = options;

    super(mobject as unknown as IMobject, transformOpts);

    this.shiftVector = shift;
    this.scaleFactor = options.scale ?? 1;
    this.pointTarget = pointTarget;
  }

  /**
   * Create a faded, shifted, and scaled copy of the mobject.
   *
   * @param fadeIn Whether the faded mobject is used for a fade-in animation.
   */
  protected _createFadedMobject(fadeIn: boolean): IMobject {
    const fadedMobject = this.mobject.copy();
    (fadedMobject as unknown as Mobject).fade(1);
    const directionModifier = fadeIn && !this.pointTarget ? -1 : 1;
    fadedMobject.shift(this.shiftVector.multiply(directionModifier));
    fadedMobject.scale(this.scaleFactor);
    return fadedMobject;
  }
}

// ─── FadeIn ──────────────────────────────────────────────────

/**
 * Fade in one or more mobjects.
 *
 * The mobjects start invisible (and optionally shifted/scaled) and transition
 * to their normal state.
 *
 * Python: manim.animation.fading.FadeIn
 */
export class FadeIn extends _Fade {
  constructor(...args: [...Mobject[], FadeOptions] | Mobject[]) {
    const { mobjects, options } = _parseArgs(args);
    super(mobjects, { ...options, introducer: true });
  }

  createTarget(): IMobject {
    return this.mobject;
  }

  createStartingMobject(): IMobject {
    return this._createFadedMobject(true);
  }
}

// ─── FadeOut ─────────────────────────────────────────────────

/**
 * Fade out one or more mobjects.
 *
 * The mobjects transition from their current state to invisible (and optionally
 * shifted/scaled).
 *
 * Python: manim.animation.fading.FadeOut
 */
export class FadeOut extends _Fade {
  constructor(...args: [...Mobject[], FadeOptions] | Mobject[]) {
    const { mobjects, options } = _parseArgs(args);
    super(mobjects, { ...options, remover: true });
  }

  createTarget(): IMobject {
    return this._createFadedMobject(false);
  }

  cleanUpFromScene(scene: IScene): void {
    super.cleanUpFromScene(scene);
    this.interpolate(0);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Parse variadic constructor args: any number of Mobjects followed by
 * an optional options object as the last argument.
 */
function _parseArgs(
  args: unknown[]
): { mobjects: Mobject[]; options: FadeOptions } {
  if (args.length === 0) {
    return { mobjects: [], options: {} };
  }

  const last = args[args.length - 1];
  if (last instanceof Mobject) {
    return { mobjects: args as Mobject[], options: {} };
  }

  return {
    mobjects: args.slice(0, -1) as Mobject[],
    options: (last ?? {}) as FadeOptions,
  };
}
