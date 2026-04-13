/**
 * Tests for src/mobject/value_tracker/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np } from "../../src/core/math/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import {
  ValueTracker,
  ComplexValueTracker,
} from "../../src/mobject/value_tracker/index.js";

describe("ValueTracker", () => {
  it("constructs with default value of 0", () => {
    const tracker = new ValueTracker();
    expect(tracker.getValue()).toBe(0);
  });

  it("constructs with a specified value", () => {
    const tracker = new ValueTracker({ value: 3.5 });
    expect(tracker.getValue()).toBe(3.5);
  });

  it("has a points array of shape [1, 3]", () => {
    const tracker = new ValueTracker({ value: 5 });
    expect(tracker.points.shape).toEqual([1, 3]);
  });

  it("setValue updates and returns this for chaining", () => {
    const tracker = new ValueTracker();
    const result = tracker.setValue(42);
    expect(result).toBe(tracker);
    expect(tracker.getValue()).toBe(42);
  });

  it("incrementValue adds to the current value", () => {
    const tracker = new ValueTracker({ value: 10 });
    tracker.incrementValue(5);
    expect(tracker.getValue()).toBe(15);
    tracker.incrementValue(-3);
    expect(tracker.getValue()).toBe(12);
  });

  it("toBoolean returns false for 0 and true for non-zero", () => {
    const zero = new ValueTracker({ value: 0 });
    expect(zero.toBoolean()).toBe(false);
    const nonZero = new ValueTracker({ value: 1 });
    expect(nonZero.toBoolean()).toBe(true);
    const negative = new ValueTracker({ value: -5 });
    expect(negative.toBoolean()).toBe(true);
  });

  it("addValue returns a new tracker with summed value", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.addValue(5);
    expect(result).toBeInstanceOf(ValueTracker);
    expect(result).not.toBe(tracker);
    expect(result.getValue()).toBe(15);
    expect(tracker.getValue()).toBe(10); // original unchanged
  });

  it("addValue throws for Mobject argument", () => {
    const tracker = new ValueTracker({ value: 10 });
    expect(() => tracker.addValue(new Mobject() as unknown as number)).toThrow(
      "Cannot increment ValueTracker by a Mobject",
    );
  });

  it("iAddValue mutates in-place", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.iAddValue(5);
    expect(result).toBe(tracker);
    expect(tracker.getValue()).toBe(15);
  });

  it("subtractValue returns a new tracker", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.subtractValue(3);
    expect(result.getValue()).toBe(7);
    expect(tracker.getValue()).toBe(10);
  });

  it("iSubtractValue mutates in-place", () => {
    const tracker = new ValueTracker({ value: 10 });
    tracker.iSubtractValue(4);
    expect(tracker.getValue()).toBe(6);
  });

  it("multiplyValue returns a new tracker", () => {
    const tracker = new ValueTracker({ value: 3 });
    const result = tracker.multiplyValue(4);
    expect(result.getValue()).toBe(12);
    expect(tracker.getValue()).toBe(3);
  });

  it("divideValue returns a new tracker", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.divideValue(4);
    expect(result.getValue()).toBe(2.5);
  });

  it("floorDivideValue returns floor division", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.floorDivideValue(3);
    expect(result.getValue()).toBe(3);
  });

  it("modValue returns modulo", () => {
    const tracker = new ValueTracker({ value: 10 });
    const result = tracker.modValue(3);
    expect(result.getValue()).toBe(1);
  });

  it("powValue returns exponentiation", () => {
    const tracker = new ValueTracker({ value: 2 });
    const result = tracker.powValue(3);
    expect(result.getValue()).toBe(8);
  });

  it("is an instance of Mobject", () => {
    const tracker = new ValueTracker();
    expect(tracker).toBeInstanceOf(Mobject);
  });

  it("interpolate works between two trackers", () => {
    const tracker = new ValueTracker();
    const t1 = new ValueTracker({ value: 0 });
    const t2 = new ValueTracker({ value: 10 });
    tracker.interpolate(t1, t2, 0.5);
    expect(tracker.getValue()).toBeCloseTo(5);
  });
});

describe("ComplexValueTracker", () => {
  it("constructs with default value { re: 0, im: 0 }", () => {
    const tracker = new ComplexValueTracker();
    const val = tracker.getComplexValue();
    expect(val.re).toBe(0);
    expect(val.im).toBe(0);
  });

  it("constructs with a specified complex value", () => {
    const tracker = new ComplexValueTracker({ value: { re: 3, im: 4 } });
    const val = tracker.getComplexValue();
    expect(val.re).toBe(3);
    expect(val.im).toBe(4);
  });

  it("setComplexValue updates both real and imaginary parts", () => {
    const tracker = new ComplexValueTracker();
    tracker.setComplexValue({ re: -2, im: 1 });
    const val = tracker.getComplexValue();
    expect(val.re).toBe(-2);
    expect(val.im).toBe(1);
  });

  it("getValue returns the real part", () => {
    const tracker = new ComplexValueTracker({ value: { re: 5, im: 7 } });
    expect(tracker.getValue()).toBe(5);
  });

  it("is an instance of ValueTracker and Mobject", () => {
    const tracker = new ComplexValueTracker();
    expect(tracker).toBeInstanceOf(ValueTracker);
    expect(tracker).toBeInstanceOf(Mobject);
  });

  it("stores value in points array as [re, im, 0]", () => {
    const tracker = new ComplexValueTracker({ value: { re: 3, im: 4 } });
    expect(tracker.points.get([0, 0])).toBe(3);
    expect(tracker.points.get([0, 1])).toBe(4);
    expect(tracker.points.get([0, 2])).toBe(0);
  });
});
