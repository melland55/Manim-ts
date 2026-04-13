/**
 * Utility functions for continuous animation of mobjects.
 *
 * Python equivalent: manim/animation/updaters/mobject_update_utils.py
 */

import type { IMobject, Point3D } from "../../core/types.js";
import type { NDArray } from "numpy-ts";
import { np } from "../../core/math/index.js";
import { DEGREES, RIGHT } from "../../constants/index.js";
import { Mobject } from "../../mobject/mobject/index.js";
import { normalize } from "../../utils/space_ops/index.js";
import type { Animation } from "../animation/index.js";

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Assert that `method` is a bound method on a Mobject instance.
 *
 * In TypeScript we can't inspect `__self__` like Python, so we accept
 * an object + method-name pair or rely on the caller passing the mobject
 * separately.  This function checks that `mobject` is a Mobject.
 */
export function assertIsMobjectMethod(mobject: unknown): void {
  if (!(mobject instanceof Mobject)) {
    throw new Error("Expected a Mobject instance");
  }
}

// ─── always ───────────────────────────────────────────────────

/**
 * Attach an updater that continuously calls `method` on `mobject`
 * with the given arguments every frame.
 *
 * TypeScript adaptation: since we can't inspect bound-method `__self__`,
 * the caller passes `mobject` and `method` (a function that takes the
 * mobject as first arg) separately.
 */
export function always<T extends IMobject>(
  mobject: T,
  method: (mob: T, ...args: unknown[]) => void,
  ...args: unknown[]
): T {
  assertIsMobjectMethod(mobject);
  mobject.addUpdater(((m: IMobject) => method(m as T, ...args)) as (mob: IMobject, dt: number) => void);
  return mobject;
}

// ─── f_always ─────────────────────────────────────────────────

/**
 * More functional version of `always`: instead of taking in args,
 * takes functions which output the relevant arguments.
 */
export function fAlways<T extends IMobject>(
  mobject: T,
  method: (mob: T, ...args: unknown[]) => void,
  ...argGenerators: Array<() => unknown>
): T {
  assertIsMobjectMethod(mobject);
  const updater = (m: IMobject) => {
    const generatedArgs = argGenerators.map((gen) => gen());
    method(m as T, ...generatedArgs);
  };
  mobject.addUpdater(updater as (mob: IMobject, dt: number) => void);
  return mobject;
}

// ─── always_redraw ────────────────────────────────────────────

/**
 * Redraw the mobject constructed by a function every frame.
 *
 * Returns a mobject with an attached updater that continuously
 * regenerates the mobject according to the specified function.
 */
export function alwaysRedraw<T extends IMobject>(func: () => T): T {
  const mob = func();
  const m = mob as unknown as { become: (other: IMobject) => void };
  mob.addUpdater((() => {
    m.become(func());
  }) as (mob: IMobject, dt: number) => void);
  return mob;
}

// ─── always_shift ─────────────────────────────────────────────

/**
 * A mobject which is continuously shifted along some direction
 * at a certain rate.
 *
 * @param mobject - The mobject to shift.
 * @param direction - The direction to shift. The vector is normalized.
 * @param rate - Length in Manim units the mobject travels per second.
 */
export function alwaysShift(
  mobject: IMobject,
  direction: NDArray = RIGHT,
  rate: number = 0.1,
): IMobject {
  const normalizedDir = normalize(direction);
  mobject.addUpdater((m: IMobject, dt: number) => {
    m.shift(normalizedDir.multiply(dt * rate) as Point3D);
  });
  return mobject;
}

// ─── always_rotate ────────────────────────────────────────────

/**
 * A mobject which is continuously rotated at a certain rate.
 *
 * @param mobject - The mobject to be rotated.
 * @param rate - The angle rotated per second (default 20 * DEGREES).
 * @param options - Additional options passed to rotate().
 */
export function alwaysRotate(
  mobject: IMobject,
  rate: number = 20 * DEGREES,
  options?: { aboutPoint?: Point3D; axis?: Point3D },
): IMobject {
  const axis = options?.axis;
  const aboutPoint = options?.aboutPoint;
  mobject.addUpdater((m: IMobject, dt: number) => {
    m.rotate(dt * rate, axis, aboutPoint != null ? { aboutPoint } : undefined);
  });
  return mobject;
}

// ─── turn_animation_into_updater ──────────────────────────────

/**
 * Add an updater to the animation's mobject which applies the
 * interpolation and update functions of the animation.
 *
 * If `cycle` is true, repeats over and over. Otherwise the updater
 * is removed upon completion.
 *
 * @param animation - The animation to convert.
 * @param cycle - Whether to loop the animation.
 * @param delay - Delay in seconds before the animation starts.
 */
export function turnAnimationIntoUpdater(
  animation: Animation,
  cycle: boolean = false,
  delay: number = 0,
): IMobject {
  const mobject = animation.mobject;

  // Allow the animation's mobject to keep updating
  (animation as unknown as { _suspendMobjectUpdating: boolean })._suspendMobjectUpdating = false;
  animation.begin();

  let totalTime = -delay;

  const update = (m: IMobject, dt: number): void => {
    if (totalTime >= 0) {
      const runTime = animation.getRunTime();

      // Handle zero/negative runtime safely
      if (runTime <= 0) {
        animation.interpolate(1);
        animation.updateMobjects(dt);
        animation.finish();
        m.removeUpdater(update);
        return;
      }

      const timeRatio = totalTime / runTime;
      let alpha: number;
      if (cycle) {
        alpha = timeRatio % 1;
      } else {
        alpha = Math.max(0, Math.min(timeRatio, 1));
        if (alpha >= 1) {
          animation.finish();
          m.removeUpdater(update);
          return;
        }
      }
      animation.interpolate(alpha);
      animation.updateMobjects(dt);
    }
    totalTime += dt;
  };

  mobject.addUpdater(update);
  return mobject;
}

// ─── cycle_animation ──────────────────────────────────────────

/**
 * Convenience wrapper: turns an animation into a cycling updater.
 */
export function cycleAnimation(
  animation: Animation,
  delay: number = 0,
): IMobject {
  return turnAnimationIntoUpdater(animation, true, delay);
}
