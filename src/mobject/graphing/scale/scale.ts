/**
 * TypeScript port of manim/mobject/graphing/scale.py
 *
 * Scale classes for graphing/functions — used by NumberLine and Axes
 * to transform values (e.g., logarithmic axes).
 */

import type { IVMobject } from "../../../core/types.js";

// ─── Base class ──────────────────────────────────────────────

/**
 * Scale base class for graphing/functions.
 *
 * @param customLabels - Whether to create custom labels when plotted on a NumberLine.
 */
export abstract class _ScaleBase {
  customLabels: boolean;

  constructor(customLabels: boolean = false) {
    this.customLabels = customLabels;
  }

  /**
   * The function that will be used to scale values.
   * @param value - The number to be scaled.
   * @returns The scaled value.
   */
  abstract function(value: number): number;

  /**
   * The inverse of `function`. Used for plotting on a particular axis.
   * @param value - The value to invert.
   * @returns The inverted value.
   */
  abstract inverseFunction(value: number): number;

  /**
   * Custom instructions for generating labels along an axis.
   *
   * @param valRange - The position of labels. Also used for defining label content.
   * @param kwargs - Additional arguments forwarded to label construction.
   * @returns A list of VMobject labels.
   */
  getCustomLabels(
    valRange: Iterable<number>,
    kwargs?: Record<string, unknown>,
  ): IVMobject[] {
    throw new Error("Not implemented");
  }
}

// ─── LinearBase ──────────────────────────────────────────────

/**
 * The default scaling class. Applies a linear scale factor.
 */
export class LinearBase extends _ScaleBase {
  scaleFactor: number;

  /**
   * @param scaleFactor - The slope of the linear function, by default 1.0
   */
  constructor(scaleFactor: number = 1.0) {
    super(false);
    this.scaleFactor = scaleFactor;
  }

  /**
   * Multiplies the value by the scale factor.
   */
  function(value: number): number {
    return this.scaleFactor * value;
  }

  /**
   * Inverse of function. Divides the value by the scale factor.
   */
  inverseFunction(value: number): number {
    return value / this.scaleFactor;
  }
}

// ─── LogBase ─────────────────────────────────────────────────

/**
 * Scale for logarithmic graphs/functions.
 *
 * @example
 * ```typescript
 * const scale = new LogBase(2);
 * scale.function(3); // 2^3 = 8
 * scale.inverseFunction(8); // log2(8) = 3
 * ```
 */
export class LogBase extends _ScaleBase {
  base: number;

  /**
   * @param base - The base of the log, by default 10.
   * @param customLabels - Whether to include LaTeX axis labels, by default true.
   */
  constructor(base: number = 10, customLabels: boolean = true) {
    super(false);
    this.base = base;
    this.customLabels = customLabels;
  }

  /**
   * Scales the value to fit it to a logarithmic scale.
   * `this.function(5) === 10 ** 5` (for base 10).
   */
  function(value: number): number {
    return this.base ** value;
  }

  /**
   * Inverse of `function`. The value must be greater than 0.
   * @throws {Error} If value <= 0.
   */
  inverseFunction(value: number): number {
    if (value <= 0) {
      throw new Error(
        "log(0) is undefined. Make sure the value is in the domain of the function",
      );
    }
    return Math.log(value) / Math.log(this.base);
  }

  /**
   * Produces custom labels in the form of `base^exponent`.
   *
   * Note: In the original Python, this returns `Integer` mobjects.
   * Since the `text.numbers` module may not yet be converted, this
   * method signature matches the Python API but the actual Integer
   * import must be resolved when that module is available.
   *
   * @param valRange - The iterable of values used to create the labels. Determines the exponent.
   * @param unitDecimalPlaces - The number of decimal places in the exponent.
   * @param baseConfig - Additional arguments passed to Integer.
   * @returns A list of label mobjects.
   */
  getCustomLabels(
    valRange: Iterable<number>,
    kwargs?: Record<string, unknown>,
  ): IVMobject[] {
    const unitDecimalPlaces =
      (kwargs?.["unitDecimalPlaces"] as number | undefined) ?? 0;

    // TODO: Requires Integer from mobject/text/numbers (not yet converted).
    // When available, replace with:
    //   import { Integer } from "../../text/numbers/index.js";
    //   return values.map(i =>
    //     new Integer(this.base, {
    //       unit: `^{${this.inverseFunction(i).toFixed(unitDecimalPlaces)}}`,
    //       ...baseConfig,
    //     })
    //   );
    const values = Array.from(valRange);
    throw new Error(
      `LogBase.getCustomLabels requires Integer from mobject/text/numbers ` +
        `(not yet converted). Would produce ${values.length} labels for base=${this.base}.`,
    );
  }
}
