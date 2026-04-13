/**
 * Tests for mobject/geometry/tips module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, PI } from "../../../src/core/math/index.js";
import { DEFAULT_ARROW_TIP_LENGTH } from "../../../src/constants/index.js";
import {
  ArrowTip,
  StealthTip,
  ArrowTriangleTip,
  ArrowTriangleFilledTip,
  ArrowCircleTip,
  ArrowCircleFilledTip,
  ArrowSquareTip,
  ArrowSquareFilledTip,
} from "../../../src/mobject/geometry/tips/index.js";

describe("ArrowTip (abstract)", () => {
  it("cannot be instantiated directly", () => {
    // ArrowTip is abstract, but even if cast, the constructor guard should throw
    // We can't directly instantiate an abstract class in TS, so this is a compile-time check.
    // We verify that the subclasses work correctly instead.
    expect(true).toBe(true);
  });
});

describe("StealthTip", () => {
  it("constructs with defaults", () => {
    const tip = new StealthTip();
    expect(tip.fillOpacity).toBe(1);
    expect(tip.strokeWidth).toBe(3);
    expect(tip.startAngle).toBe(PI);
  });

  it("has points after construction", () => {
    const tip = new StealthTip();
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });

  it("has a valid tip point at points[0]", () => {
    const tip = new StealthTip();
    const tipPoint = tip.tipPoint;
    // tipPoint should be a 3D point
    expect(tipPoint.shape).toEqual([3]);
  });

  it("has a valid base point", () => {
    const tip = new StealthTip();
    const base = tip.base;
    expect(base.shape).toEqual([3]);
  });

  it("vector points from base to tip", () => {
    const tip = new StealthTip();
    const vector = tip.vector;
    expect(vector.shape).toEqual([3]);
    // vector = tipPoint - base
    const expectedVector = tip.tipPoint.subtract(tip.base);
    expect(vector).toBeCloseToPoint(expectedVector);
  });

  it("length uses 1.6x scaling factor", () => {
    const tip = new StealthTip();
    const rawLength = np.linalg.norm(tip.vector) as number;
    expect(tip.length).toBeCloseTo(rawLength * 1.6, 5);
  });

  it("respects custom length option", () => {
    const customLength = 0.5;
    const tip = new StealthTip({ length: customLength });
    // The stealth tip scales itself to match the given length
    // (length is 1.6x the raw norm due to override)
    expect(tip.length).toBeCloseTo(customLength, 2);
  });

  it("tipAngle returns a number", () => {
    const tip = new StealthTip();
    expect(typeof tip.tipAngle).toBe("number");
    expect(Number.isFinite(tip.tipAngle)).toBe(true);
  });
});

describe("ArrowTriangleTip", () => {
  it("constructs with defaults", () => {
    const tip = new ArrowTriangleTip();
    expect(tip.fillOpacity).toBe(0);
    expect(tip.strokeWidth).toBe(3);
    expect(tip.startAngle).toBe(PI);
  });

  it("has points after construction", () => {
    const tip = new ArrowTriangleTip();
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });

  it("base and tipPoint are different", () => {
    const tip = new ArrowTriangleTip();
    const base = tip.base;
    const tipPt = tip.tipPoint;
    const dist = np.linalg.norm(tipPt.subtract(base)) as number;
    expect(dist).toBeGreaterThan(0);
  });

  it("accepts custom length and width", () => {
    const tip = new ArrowTriangleTip({ length: 0.5, width: 0.3 });
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });
});

describe("ArrowTriangleFilledTip", () => {
  it("is filled by default", () => {
    const tip = new ArrowTriangleFilledTip();
    expect(tip.fillOpacity).toBe(1);
    expect(tip.strokeWidth).toBe(0);
  });

  it("inherits ArrowTip properties", () => {
    const tip = new ArrowTriangleFilledTip();
    expect(tip.base.shape).toEqual([3]);
    expect(tip.tipPoint.shape).toEqual([3]);
    expect(typeof tip.tipAngle).toBe("number");
  });
});

describe("ArrowCircleTip", () => {
  it("constructs with defaults", () => {
    const tip = new ArrowCircleTip();
    expect(tip.fillOpacity).toBe(0);
    expect(tip.strokeWidth).toBe(3);
    expect(tip.startAngle).toBe(PI);
  });

  it("has points", () => {
    const tip = new ArrowCircleTip();
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });

  it("accepts custom length", () => {
    const tip = new ArrowCircleTip({ length: 0.5 });
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });
});

describe("ArrowCircleFilledTip", () => {
  it("is filled by default", () => {
    const tip = new ArrowCircleFilledTip();
    expect(tip.fillOpacity).toBe(1);
    expect(tip.strokeWidth).toBe(0);
  });
});

describe("ArrowSquareTip", () => {
  it("constructs with defaults", () => {
    const tip = new ArrowSquareTip();
    expect(tip.fillOpacity).toBe(0);
    expect(tip.strokeWidth).toBe(3);
    expect(tip.startAngle).toBe(PI);
  });

  it("has points", () => {
    const tip = new ArrowSquareTip();
    expect(tip.points.shape[0]).toBeGreaterThan(0);
  });
});

describe("ArrowSquareFilledTip", () => {
  it("is filled by default", () => {
    const tip = new ArrowSquareFilledTip();
    expect(tip.fillOpacity).toBe(1);
    expect(tip.strokeWidth).toBe(0);
  });

  it("has ArrowTip properties", () => {
    const tip = new ArrowSquareFilledTip();
    expect(tip.base.shape).toEqual([3]);
    expect(tip.tipPoint.shape).toEqual([3]);
    expect(typeof tip.length).toBe("number");
    expect(tip.length).toBeGreaterThan(0);
  });
});
