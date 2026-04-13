import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np } from "../../../src/core/math/index.js";
import { NumberLine, UnitInterval } from "../../../src/mobject/graphing/number_line/index.js";

describe("NumberLine", () => {
  it("constructs with default options", () => {
    const nl = new NumberLine();
    expect(nl.xRange).toHaveLength(3);
    expect(nl.xRange[2]).toBe(1);
    expect(nl.includeTicks).toBe(true);
    expect(nl.includeNumbers).toBe(false);
    expect(nl.includeTip).toBe(false);
  });

  it("constructs with custom x_range", () => {
    const nl = new NumberLine({ xRange: [-5, 5, 2] });
    expect(nl.xRange[0]).toBe(-5);
    expect(nl.xRange[1]).toBe(5);
    expect(nl.xRange[2]).toBe(2);
  });

  it("infers step=1 when only two values in x_range", () => {
    const nl = new NumberLine({ xRange: [-3, 3] });
    expect(nl.xRange[2]).toBe(1);
  });

  it("numberToPoint maps 0 to center for symmetric range", () => {
    const nl = new NumberLine({ xRange: [-5, 5, 1] });
    const center = nl.getCenter();
    const p = nl.numberToPoint(0);
    // Should be close to center
    (expect(p) as any).toBeCloseToPoint(center, 4);
  });

  it("numberToPoint maps endpoints correctly", () => {
    const nl = new NumberLine({ xRange: [-5, 5, 1] });
    const startPoint = nl.numberToPoint(-5);
    const endPoint = nl.numberToPoint(5);
    const nlStart = nl.getStart();
    const nlEnd = nl.getEnd();
    (expect(startPoint) as any).toBeCloseToPoint(nlStart, 4);
    (expect(endPoint) as any).toBeCloseToPoint(nlEnd, 4);
  });

  it("pointToNumber is inverse of numberToPoint", () => {
    const nl = new NumberLine({ xRange: [-5, 5, 1] });
    for (const val of [-4, -2, 0, 1, 3.5]) {
      const point = nl.numberToPoint(val);
      const recovered = nl.pointToNumber(point);
      expect(recovered).toBeCloseTo(val, 4);
    }
  });

  it("n2p and p2n are aliases", () => {
    const nl = new NumberLine({ xRange: [0, 10, 1] });
    const p = nl.n2p(5);
    const n = nl.p2n(p);
    expect(n).toBeCloseTo(5, 4);
  });

  it("getTickRange produces correct values", () => {
    const nl = new NumberLine({ xRange: [-2, 2, 1] });
    const ticks = nl.getTickRange();
    // Should include -2, -1, 0, 1 (not 2 since it's the endpoint)
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks).toContain(0);
  });

  it("creates ticks when includeTicks is true", () => {
    const nl = new NumberLine({ xRange: [-2, 2, 1], includeTicks: true });
    expect(nl.ticks).toBeDefined();
    expect(nl.ticks.submobjects.length).toBeGreaterThan(0);
  });

  it("getUnitSize returns correct ratio", () => {
    const nl = new NumberLine({ xRange: [-5, 5, 1], length: 10 });
    const unitSize = nl.getUnitSize();
    expect(unitSize).toBeCloseTo(1.0, 4);
  });

  it("handles includeTip option", () => {
    const nl = new NumberLine({ xRange: [-3, 3, 1], includeTip: true });
    expect(nl.tip).toBeDefined();
  });
});

describe("UnitInterval", () => {
  it("constructs with range [0, 1]", () => {
    const ui = new UnitInterval();
    expect(ui.xRange[0]).toBe(0);
    expect(ui.xRange[1]).toBe(1);
    expect(ui.xRange[2]).toBeCloseTo(0.1);
  });

  it("has elongated ticks at 0 and 1 by default", () => {
    const ui = new UnitInterval();
    expect(ui.numbersWithElongatedTicks).toEqual([0, 1]);
  });

  it("numberToPoint maps 0 to start and 1 to end", () => {
    const ui = new UnitInterval();
    const start = ui.getStart();
    const end = ui.getEnd();
    const p0 = ui.numberToPoint(0);
    const p1 = ui.numberToPoint(1);
    (expect(p0) as any).toBeCloseToPoint(start, 4);
    (expect(p1) as any).toBeCloseToPoint(end, 4);
  });
});
