/**
 * Simple mobjects that can be used for storing (and updating) a value.
 *
 * TypeScript port of manim/mobject/value_tracker.py
 */

import { np } from "../../core/math/index.js";
import type { Points3D } from "../../core/math/index.js";
import { Mobject } from "../mobject/index.js";
import type { MobjectConstructorOptions } from "../mobject/index.js";
import { straightPath } from "../../utils/paths/index.js";
import type { PathFuncType } from "../../utils/paths/index.js";

// ─── ValueTracker ───────────────────────────────────────────

export interface ValueTrackerOptions extends MobjectConstructorOptions {
  value?: number;
}

/**
 * A mobject that can be used for tracking (real-valued) parameters.
 * Useful for animating parameter changes.
 *
 * Not meant to be displayed. Instead the position encodes some
 * number, often one which another animation or continual_animation
 * uses for its update function, and by treating it as a mobject it can
 * still be animated and manipulated just like anything else.
 */
export class ValueTracker extends Mobject {
  constructor(options: ValueTrackerOptions = {}) {
    const { value = 0, ...rest } = options;
    super(rest);
    this.set({ points: np.zeros([1, 3]) });
    this.setValue(value);
  }

  /** Get the current value of this ValueTracker. */
  getValue(): number {
    return this.points.get([0, 0]) as number;
  }

  /** Sets a new scalar value to the ValueTracker. */
  setValue(value: number): this {
    this.points.set([0, 0], value);
    return this;
  }

  /** Increments (adds) a scalar value to the ValueTracker. */
  incrementValue(dValue: number): this {
    this.setValue(this.getValue() + dValue);
    return this;
  }

  /** Return whether the value of this ValueTracker evaluates as true. */
  toBoolean(): boolean {
    return Boolean(this.getValue());
  }

  /**
   * Return a new ValueTracker whose value is this + dValue.
   * Named addValue to avoid conflict with Mobject.add() (submobjects).
   * Python equivalent: __add__
   */
  addValue(dValue: number | Mobject): ValueTracker {
    if (dValue instanceof Mobject) {
      throw new Error(
        "Cannot increment ValueTracker by a Mobject. Please provide a scalar value.",
      );
    }
    return new ValueTracker({ value: this.getValue() + dValue });
  }

  /**
   * In-place add: increments the value by dValue.
   * Python equivalent: __iadd__ (+=)
   */
  iAddValue(dValue: number | Mobject): this {
    if (dValue instanceof Mobject) {
      throw new Error(
        "Cannot increment ValueTracker by a Mobject. Please provide a scalar value.",
      );
    }
    this.incrementValue(dValue);
    return this;
  }

  /**
   * Return a new ValueTracker whose value is this - dValue.
   * Python equivalent: __sub__
   */
  subtractValue(dValue: number | Mobject): ValueTracker {
    if (dValue instanceof Mobject) {
      throw new Error(
        "Cannot decrement ValueTracker by a Mobject. Please provide a scalar value.",
      );
    }
    return new ValueTracker({ value: this.getValue() - dValue });
  }

  /**
   * In-place subtract: decrements the value by dValue.
   * Python equivalent: __isub__ (-=)
   */
  iSubtractValue(dValue: number | Mobject): this {
    if (dValue instanceof Mobject) {
      throw new Error(
        "Cannot decrement ValueTracker by a Mobject. Please provide a scalar value.",
      );
    }
    this.incrementValue(-dValue);
    return this;
  }

  /**
   * Return a new ValueTracker whose value is this * dValue.
   * Python equivalent: __mul__
   */
  multiplyValue(dValue: number): ValueTracker {
    return new ValueTracker({ value: this.getValue() * dValue });
  }

  /**
   * In-place multiply.
   * Python equivalent: __imul__ (*=)
   */
  iMultiplyValue(dValue: number): this {
    this.setValue(this.getValue() * dValue);
    return this;
  }

  /**
   * Return a new ValueTracker whose value is this / dValue.
   * Python equivalent: __truediv__
   */
  divideValue(dValue: number): ValueTracker {
    return new ValueTracker({ value: this.getValue() / dValue });
  }

  /**
   * In-place divide.
   * Python equivalent: __itruediv__ (/=)
   */
  iDivideValue(dValue: number): this {
    this.setValue(this.getValue() / dValue);
    return this;
  }

  /**
   * Return a new ValueTracker whose value is floor(this / dValue).
   * Python equivalent: __floordiv__
   */
  floorDivideValue(dValue: number): ValueTracker {
    return new ValueTracker({
      value: Math.floor(this.getValue() / dValue),
    });
  }

  /**
   * In-place floor division.
   * Python equivalent: __ifloordiv__ (//=)
   */
  iFloorDivideValue(dValue: number): this {
    this.setValue(Math.floor(this.getValue() / dValue));
    return this;
  }

  /**
   * Return a new ValueTracker whose value is this % dValue.
   * Python equivalent: __mod__
   */
  modValue(dValue: number): ValueTracker {
    return new ValueTracker({ value: this.getValue() % dValue });
  }

  /**
   * In-place modulo.
   * Python equivalent: __imod__ (%=)
   */
  iModValue(dValue: number): this {
    this.setValue(this.getValue() % dValue);
    return this;
  }

  /**
   * Return a new ValueTracker whose value is this ** dValue.
   * Python equivalent: __pow__
   */
  powValue(dValue: number): ValueTracker {
    return new ValueTracker({ value: this.getValue() ** dValue });
  }

  /**
   * In-place power.
   * Python equivalent: __ipow__ (**=)
   */
  iPowValue(dValue: number): this {
    this.setValue(this.getValue() ** dValue);
    return this;
  }

  /** Turns this into an interpolation between mobject1 and mobject2. */
  override interpolate(
    mobject1: Mobject,
    mobject2: Mobject,
    alpha: number,
    pathFunc: PathFuncType = straightPath(),
  ): this {
    this.set({ points: pathFunc(mobject1.points, mobject2.points, alpha) });
    return this;
  }
}

// ─── ComplexValueTracker ────────────────────────────────────

export interface ComplexValueTrackerOptions extends MobjectConstructorOptions {
  value?: { re: number; im: number };
}

/**
 * Tracks a complex-valued parameter.
 *
 * The value is internally stored as a points array [re, im, 0].
 * This can be accessed directly to represent the value geometrically.
 *
 * Since TypeScript has no native complex type, complex values are
 * represented as `{ re: number; im: number }`.
 */
export class ComplexValueTracker extends ValueTracker {
  constructor(options: ComplexValueTrackerOptions = {}) {
    const { value, ...rest } = options;
    super({ ...rest, value: 0 });
    if (value) {
      this.setComplexValue(value);
    }
  }

  /** Get the current value as a complex number { re, im }. */
  getComplexValue(): { re: number; im: number } {
    const re = this.points.get([0, 0]) as number;
    const im = this.points.get([0, 1]) as number;
    return { re, im };
  }

  /** Get the current value (returns the real part for scalar compatibility). */
  override getValue(): number {
    return this.points.get([0, 0]) as number;
  }

  /** Sets a new complex value to the ComplexValueTracker. */
  setComplexValue(value: { re: number; im: number }): this {
    this.points.set([0, 0], value.re);
    this.points.set([0, 1], value.im);
    return this;
  }

  /** Sets a new scalar value (sets real part, imaginary part stays). */
  override setValue(value: number): this {
    this.points.set([0, 0], value);
    return this;
  }
}
