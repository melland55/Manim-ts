/**
 * Animations for changing numbers.
 *
 * Python equivalent: manim/animation/numbers.py
 */

import { Animation } from "../animation/animation.js";
import type { ExtendedAnimationOptions } from "../animation/animation.js";
import type { IMobject } from "../../core/types.js";
import { interpolate } from "../../core/math/index.js";

// ─── Types ──────────────────────────────────────────────────

/**
 * Minimal interface for DecimalNumber mobject.
 * The actual DecimalNumber class lives in mobject/text/numbers (not yet converted).
 * We use a structural interface so this module compiles independently.
 */
export interface IDecimalNumber extends IMobject {
  number: number;
  setValue(value: number): IDecimalNumber;
}

// ─── ChangingDecimal ────────────────────────────────────────

export interface ChangingDecimalOptions extends ExtendedAnimationOptions {
  suspendMobjectUpdating?: boolean;
}

/**
 * Animate a DecimalNumber to values specified by a user-supplied function.
 *
 * @param decimalMob - The DecimalNumber instance to animate.
 * @param numberUpdateFunc - A function that returns the number to display at each point in the animation.
 * @param options - Animation options.
 *
 * @throws TypeError if decimalMob is not a DecimalNumber (checked via structural typing).
 *
 * @example
 * ```typescript
 * const number = new DecimalNumber(0);
 * scene.add(number);
 * await scene.play(
 *   new ChangingDecimal(number, (a) => 5 * a, { runTime: 3 })
 * );
 * ```
 */
export class ChangingDecimal extends Animation {
  numberUpdateFunc: (alpha: number) => number;

  constructor(
    decimalMob: IDecimalNumber,
    numberUpdateFunc: (alpha: number) => number,
    options: ChangingDecimalOptions = {},
  ) {
    ChangingDecimal.checkValidityOfInput(decimalMob);
    const { suspendMobjectUpdating = false, ...animOptions } = options;
    super(decimalMob as unknown as IMobject, {
      ...animOptions,
      suspendMobjectUpdating,
    });
    this.numberUpdateFunc = numberUpdateFunc;
  }

  private static checkValidityOfInput(decimalMob: IDecimalNumber): void {
    if (
      typeof decimalMob !== "object" ||
      decimalMob === null ||
      typeof (decimalMob as IDecimalNumber).setValue !== "function" ||
      typeof (decimalMob as IDecimalNumber).number !== "number"
    ) {
      throw new TypeError("ChangingDecimal can only take in a DecimalNumber");
    }
  }

  interpolateMobject(alpha: number): void {
    (this.mobject as unknown as IDecimalNumber).setValue(
      this.numberUpdateFunc(this.rateFunc(alpha)),
    );
  }
}

// ─── ChangeDecimalToValue ───────────────────────────────────

/**
 * Animate a DecimalNumber to a target value using linear interpolation.
 *
 * @param decimalMob - The DecimalNumber instance to animate.
 * @param targetNumber - The target value to transition to.
 * @param options - Animation options.
 *
 * @example
 * ```typescript
 * const number = new DecimalNumber(0);
 * scene.add(number);
 * await scene.play(new ChangeDecimalToValue(number, 10, { runTime: 3 }));
 * ```
 */
export class ChangeDecimalToValue extends ChangingDecimal {
  constructor(
    decimalMob: IDecimalNumber,
    targetNumber: number,
    options: ChangingDecimalOptions = {},
  ) {
    const startNumber = decimalMob.number;
    super(
      decimalMob,
      (a: number) => interpolate(startNumber, targetNumber, a),
      options,
    );
  }
}
