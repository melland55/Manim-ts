import { describe, it, expect } from "vitest";
import { binarySearch, choose, clip, sigmoid } from "../../src/utils/simple_functions/index.js";

describe("binarySearch", () => {
  it("finds solution for x^2 + 3x + 1 = 11 in [0, 5]", () => {
    const solution = binarySearch((x) => x * x + 3 * x + 1, 11, 0, 5);
    expect(solution).not.toBeNull();
    expect(Math.abs(solution! - 2)).toBeLessThan(1e-4);
  });

  it("respects custom tolerance", () => {
    const solution = binarySearch((x) => x * x + 3 * x + 1, 11, 0, 5, 0.01);
    expect(solution).not.toBeNull();
    expect(Math.abs(solution! - 2)).toBeLessThan(0.01);
  });

  it("returns null when target is out of range", () => {
    const solution = binarySearch((x) => x * x + 3 * x + 1, 71, 0, 5);
    expect(solution).toBeNull();
  });

  it("finds solution for linear function", () => {
    const solution = binarySearch((x) => 2 * x + 1, 5, 0, 10);
    expect(solution).not.toBeNull();
    expect(Math.abs(solution! - 2)).toBeLessThan(1e-4);
  });

  it("returns bound when target matches exactly at boundary", () => {
    const solution = binarySearch((x) => x, 0, 0, 1);
    expect(solution).not.toBeNull();
    expect(Math.abs(solution! - 0)).toBeLessThan(1e-4);
  });
});

describe("choose", () => {
  it("computes basic binomial coefficients", () => {
    expect(choose(5, 0)).toBe(1);
    expect(choose(5, 1)).toBe(5);
    expect(choose(5, 2)).toBe(10);
    expect(choose(5, 5)).toBe(1);
  });

  it("returns 0 for k out of range", () => {
    expect(choose(5, 6)).toBe(0);
    expect(choose(5, -1)).toBe(0);
  });

  it("is symmetric: choose(n,k) == choose(n,n-k)", () => {
    expect(choose(10, 3)).toBe(choose(10, 7));
    expect(choose(8, 2)).toBe(choose(8, 6));
  });

  it("caches repeated calls (correctness check)", () => {
    expect(choose(6, 3)).toBe(20);
    expect(choose(6, 3)).toBe(20); // from cache
  });

  it("handles choose(0, 0)", () => {
    expect(choose(0, 0)).toBe(1);
  });
});

describe("clip", () => {
  it("returns value when within range", () => {
    expect(clip(15, 11, 20)).toBe(15);
  });

  it("returns min when value is below range", () => {
    expect(clip(5, 11, 20)).toBe(11);
  });

  it("returns max when value is above range", () => {
    expect(clip(25, 11, 20)).toBe(20);
  });

  it("works with strings", () => {
    expect(clip("a", "h", "k")).toBe("h");
    expect(clip("j", "h", "k")).toBe("j");
    expect(clip("z", "h", "k")).toBe("k");
  });

  it("handles boundary values", () => {
    expect(clip(0, 0, 1)).toBe(0);
    expect(clip(1, 0, 1)).toBe(1);
  });
});

describe("sigmoid", () => {
  it("returns 0.5 for x=0", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
  });

  it("approaches 1 for large positive x", () => {
    expect(sigmoid(100)).toBeCloseTo(1.0, 5);
  });

  it("approaches 0 for large negative x", () => {
    expect(sigmoid(-100)).toBeCloseTo(0.0, 5);
  });

  it("is symmetric: sigmoid(x) + sigmoid(-x) = 1", () => {
    expect(sigmoid(2) + sigmoid(-2)).toBeCloseTo(1.0, 10);
    expect(sigmoid(0.5) + sigmoid(-0.5)).toBeCloseTo(1.0, 10);
  });

  it("returns value in (0, 1) for finite inputs", () => {
    for (const x of [-5, -1, 0, 1, 5]) {
      const v = sigmoid(x);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });
});
