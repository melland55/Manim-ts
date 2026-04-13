/**
 * Animations that update mobjects.
 *
 * Python equivalent: manim/animation/updaters/update.py
 */

import type { IMobject, Point3D } from "../../core/types.js";
import { np } from "../../core/math/index.js";
import {
  Animation,
  type ExtendedAnimationOptions,
} from "../animation/index.js";

// ─── UpdateFromFunc ──────────────────────────────────────────

export interface UpdateFromFuncOptions extends ExtendedAnimationOptions {
  suspendMobjectUpdating?: boolean;
}

/**
 * An animation whose interpolation calls a user-supplied function
 * on the mobject each frame.
 *
 * Useful when the state of one mobject depends on another
 * simultaneously animated mobject.
 */
export class UpdateFromFunc extends Animation {
  protected updateFunction: (mob: IMobject) => void;

  constructor(
    mobject: IMobject,
    updateFunction: (mob: IMobject) => void,
    options: UpdateFromFuncOptions = {},
  ) {
    const { suspendMobjectUpdating = false, ...rest } = options;
    super(mobject, { ...rest, suspendMobjectUpdating });
    this.updateFunction = updateFunction;
  }

  interpolateMobject(_alpha: number): void {
    this.updateFunction(this.mobject);
  }
}

// ─── UpdateFromAlphaFunc ─────────────────────────────────────

/**
 * Like UpdateFromFunc, but the update function also receives
 * the rate-function–adjusted alpha value.
 */
export class UpdateFromAlphaFunc extends Animation {
  protected updateFunction: (mob: IMobject, alpha: number) => void;

  constructor(
    mobject: IMobject,
    updateFunction: (mob: IMobject, alpha: number) => void,
    options: UpdateFromFuncOptions = {},
  ) {
    const { suspendMobjectUpdating = false, ...rest } = options;
    super(mobject, { ...rest, suspendMobjectUpdating });
    this.updateFunction = updateFunction;
  }

  interpolateMobject(alpha: number): void {
    this.updateFunction(this.mobject, this.rateFunc(alpha));
  }
}

// ─── MaintainPositionRelativeTo ──────────────────────────────

/**
 * Animation that keeps a mobject at a fixed offset from a tracked mobject.
 */
export class MaintainPositionRelativeTo extends Animation {
  protected trackedMobject: IMobject;
  protected diff: Point3D;

  constructor(
    mobject: IMobject,
    trackedMobject: IMobject,
    options: ExtendedAnimationOptions = {},
  ) {
    super(mobject, options);
    this.trackedMobject = trackedMobject;
    this.diff = np.subtract(
      mobject.getCenter(),
      trackedMobject.getCenter(),
    ) as Point3D;
  }

  interpolateMobject(_alpha: number): void {
    const target = this.trackedMobject.getCenter();
    const location = this.mobject.getCenter();
    const offset = np.subtract(target, location) as Point3D;
    const shift = np.add(offset, this.diff) as Point3D;
    this.mobject.shift(shift);
  }
}
