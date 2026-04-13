import { describe, it, expect } from "vitest";
import { _ScaleBase, LinearBase, LogBase } from "../../../src/mobject/graphing/scale/index.js";

describe("LinearBase", () => {
  it("constructs with default scale factor of 1.0", () => {
    const scale = new LinearBase();
    expect(scale.scaleFactor).toBe(1.0);
    expect(scale.customLabels).toBe(false);
  });

  it("constructs with custom scale factor", () => {
    const scale = new LinearBase(2.5);
    expect(scale.scaleFactor).toBe(2.5);
  });

  it("function multiplies by scale factor", () => {
    const scale = new LinearBase(3);
    expect(scale.function(4)).toBe(12);
    expect(scale.function(0)).toBe(0);
    expect(scale.function(-2)).toBe(-6);
  });

  it("inverseFunction divides by scale factor", () => {
    const scale = new LinearBase(4);
    expect(scale.inverseFunction(8)).toBe(2);
    expect(scale.inverseFunction(0)).toBe(0);
  });

  it("function and inverseFunction are inverses", () => {
    const scale = new LinearBase(7.3);
    const values = [-100, -1, 0, 0.5, 1, 42, 999];
    for (const v of values) {
      expect(scale.inverseFunction(scale.function(v))).toBeCloseTo(v, 10);
      expect(scale.function(scale.inverseFunction(v))).toBeCloseTo(v, 10);
    }
  });

  it("identity when scale factor is 1", () => {
    const scale = new LinearBase(1);
    expect(scale.function(42)).toBe(42);
    expect(scale.inverseFunction(42)).toBe(42);
  });
});

describe("LogBase", () => {
  it("constructs with default base 10 and customLabels true", () => {
    const scale = new LogBase();
    expect(scale.base).toBe(10);
    expect(scale.customLabels).toBe(true);
  });

  it("constructs with custom base", () => {
    const scale = new LogBase(2);
    expect(scale.base).toBe(2);
  });

  it("function computes base^value", () => {
    const scale = new LogBase(10);
    expect(scale.function(0)).toBe(1);
    expect(scale.function(1)).toBe(10);
    expect(scale.function(2)).toBe(100);
    expect(scale.function(3)).toBe(1000);
  });

  it("function works with base 2", () => {
    const scale = new LogBase(2);
    expect(scale.function(0)).toBe(1);
    expect(scale.function(3)).toBe(8);
    expect(scale.function(10)).toBe(1024);
  });

  it("inverseFunction computes log_base(value)", () => {
    const scale = new LogBase(10);
    expect(scale.inverseFunction(1)).toBeCloseTo(0, 10);
    expect(scale.inverseFunction(10)).toBeCloseTo(1, 10);
    expect(scale.inverseFunction(100)).toBeCloseTo(2, 10);
    expect(scale.inverseFunction(1000)).toBeCloseTo(3, 10);
  });

  it("inverseFunction works with base 2", () => {
    const scale = new LogBase(2);
    expect(scale.inverseFunction(1)).toBeCloseTo(0, 10);
    expect(scale.inverseFunction(8)).toBeCloseTo(3, 10);
    expect(scale.inverseFunction(1024)).toBeCloseTo(10, 10);
  });

  it("inverseFunction throws for value <= 0", () => {
    const scale = new LogBase(10);
    expect(() => scale.inverseFunction(0)).toThrow("log(0) is undefined");
    expect(() => scale.inverseFunction(-5)).toThrow("log(0) is undefined");
  });

  it("function and inverseFunction are inverses", () => {
    const scale = new LogBase(10);
    const values = [-2, -1, 0, 1, 2, 3, 5];
    for (const v of values) {
      expect(scale.inverseFunction(scale.function(v))).toBeCloseTo(v, 10);
    }
    const positives = [0.01, 0.1, 1, 10, 100, 1000];
    for (const v of positives) {
      expect(scale.function(scale.inverseFunction(v))).toBeCloseTo(v, 8);
    }
  });

  it("getCustomLabels throws (Integer not yet converted)", () => {
    const scale = new LogBase(10);
    expect(() => scale.getCustomLabels([1, 10, 100])).toThrow(
      "Integer from mobject/text/numbers",
    );
  });
});

describe("_ScaleBase", () => {
  it("getCustomLabels throws NotImplementedError by default", () => {
    // Create a concrete subclass to test the base
    class TestScale extends _ScaleBase {
      function(value: number): number {
        return value;
      }
      inverseFunction(value: number): number {
        return value;
      }
    }
    const scale = new TestScale();
    expect(() => scale.getCustomLabels([])).toThrow("Not implemented");
  });
});
