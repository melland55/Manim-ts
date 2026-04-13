/**
 * Tests for src/animation/numbers — ChangingDecimal, ChangeDecimalToValue.
 */

import { describe, it, expect, vi } from "vitest";
import {
  ChangingDecimal,
  ChangeDecimalToValue,
  type IDecimalNumber,
} from "../../src/animation/numbers/index.js";
import { smooth, linear } from "../../src/core/math/index.js";
import type { IMobject, Point3D, IColor } from "../../src/core/types.js";
import { np } from "../../src/core/math/index.js";

// ── Mock DecimalNumber ──────────────────────────────────────

function makeMockDecimalNumber(initialValue: number = 0): IDecimalNumber {
  const mockColor: IColor = {
    r: 1, g: 1, b: 1, a: 1,
    toHex: () => "#ffffff",
    toArray: () => [1, 1, 1, 1] as [number, number, number, number],
    interpolate: (other: IColor, t: number) => mockColor,
    lighter: () => mockColor,
    darker: () => mockColor,
  };

  const mob: IDecimalNumber = {
    number: initialValue,
    setValue(value: number) {
      this.number = value;
      return this;
    },
    name: "DecimalNumber",
    color: mockColor,
    submobjects: [],
    updaters: [],
    zIndex: 0,
    getCenter: () => np.array([0, 0, 0]) as unknown as Point3D,
    getLeft: () => np.array([-1, 0, 0]) as unknown as Point3D,
    getRight: () => np.array([1, 0, 0]) as unknown as Point3D,
    getTop: () => np.array([0, 1, 0]) as unknown as Point3D,
    getBottom: () => np.array([0, -1, 0]) as unknown as Point3D,
    getWidth: () => 2,
    getHeight: () => 2,
    moveTo() { return this; },
    shift() { return this; },
    scale() { return this; },
    rotate() { return this; },
    flip() { return this; },
    nextTo() { return this; },
    alignTo() { return this; },
    add() { return this; },
    remove() { return this; },
    getFamily() { return [this]; },
    setColor() { return this; },
    setOpacity() { return this; },
    addUpdater() { return this; },
    removeUpdater() { return this; },
    applyMatrix() { return this; },
    applyFunction() { return this; },
    copy() { return makeMockDecimalNumber(this.number); },
  };

  return mob;
}

// ─── ChangingDecimal ────────────────────────────────────────

describe("ChangingDecimal", () => {
  it("constructs with a DecimalNumber and update function", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangingDecimal(decimal, (a) => a * 10);
    expect(anim.mobject).toBe(decimal);
    expect(anim.numberUpdateFunc).toBeTypeOf("function");
  });

  it("uses default runTime of 1", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangingDecimal(decimal, (a) => a);
    expect(anim.runTime).toBe(1);
  });

  it("accepts custom runTime", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangingDecimal(decimal, (a) => a, { runTime: 3 });
    expect(anim.runTime).toBe(3);
  });

  it("throws TypeError for non-DecimalNumber input", () => {
    const notDecimal = { name: "fake" } as unknown as IDecimalNumber;
    expect(() => new ChangingDecimal(notDecimal, (a) => a)).toThrow(TypeError);
  });

  it("interpolateMobject updates the decimal value via rateFunc", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangingDecimal(decimal, (a) => a * 100, {
      rateFunc: linear,
    });

    anim.interpolateMobject(0);
    expect(decimal.number).toBeCloseTo(0);

    anim.interpolateMobject(0.5);
    expect(decimal.number).toBeCloseTo(50);

    anim.interpolateMobject(1);
    expect(decimal.number).toBeCloseTo(100);
  });

  it("applies the rate function before calling numberUpdateFunc", () => {
    const decimal = makeMockDecimalNumber(0);
    // With a custom rateFunc that always returns 1
    const anim = new ChangingDecimal(decimal, (a) => a * 10, {
      rateFunc: () => 1,
    });

    anim.interpolateMobject(0.3);
    // rateFunc always returns 1, so numberUpdateFunc gets 1
    expect(decimal.number).toBeCloseTo(10);
  });

  it("supports suspendMobjectUpdating option", () => {
    const decimal = makeMockDecimalNumber(5);
    const anim = new ChangingDecimal(decimal, (a) => a, {
      suspendMobjectUpdating: true,
    });
    // Should construct without error
    expect(anim).toBeDefined();
  });
});

// ─── ChangeDecimalToValue ───────────────────────────────────

describe("ChangeDecimalToValue", () => {
  it("interpolates from start value to target value", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangeDecimalToValue(decimal, 10, { rateFunc: linear });

    anim.interpolateMobject(0);
    expect(decimal.number).toBeCloseTo(0);

    anim.interpolateMobject(0.5);
    expect(decimal.number).toBeCloseTo(5);

    anim.interpolateMobject(1);
    expect(decimal.number).toBeCloseTo(10);
  });

  it("handles negative target values", () => {
    const decimal = makeMockDecimalNumber(10);
    const anim = new ChangeDecimalToValue(decimal, -10, { rateFunc: linear });

    anim.interpolateMobject(0.5);
    expect(decimal.number).toBeCloseTo(0);

    anim.interpolateMobject(1);
    expect(decimal.number).toBeCloseTo(-10);
  });

  it("handles start equal to target (no change)", () => {
    const decimal = makeMockDecimalNumber(5);
    const anim = new ChangeDecimalToValue(decimal, 5, { rateFunc: linear });

    anim.interpolateMobject(0.5);
    expect(decimal.number).toBeCloseTo(5);
  });

  it("captures start value at construction time", () => {
    const decimal = makeMockDecimalNumber(3);
    const anim = new ChangeDecimalToValue(decimal, 10, { rateFunc: linear });

    // Mutate the decimal's number after construction
    decimal.number = 100;

    // Animation should still interpolate from 3 to 10, not from 100
    anim.interpolateMobject(0);
    expect(decimal.number).toBeCloseTo(3);

    anim.interpolateMobject(1);
    expect(decimal.number).toBeCloseTo(10);
  });

  it("accepts custom animation options", () => {
    const decimal = makeMockDecimalNumber(0);
    const anim = new ChangeDecimalToValue(decimal, 100, {
      runTime: 5,
      rateFunc: linear,
    });
    expect(anim.runTime).toBe(5);
  });
});
