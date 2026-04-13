import { describe, it, expect } from "vitest";
import {
  SampleSpace,
  BarChart,
} from "../../../src/mobject/graphing/probability/index.js";

// ─── SampleSpace ─────────────────────────────────────────────

describe("SampleSpace", () => {
  it("constructs with default options", () => {
    const ss = new SampleSpace();
    expect(ss.rectWidth).toBe(3);
    expect(ss.rectHeight).toBe(3);
    expect(ss.defaultLabelScaleVal).toBe(1);
  });

  it("constructs with custom dimensions", () => {
    const ss = new SampleSpace({ width: 5, height: 4, defaultLabelScaleVal: 2 });
    expect(ss.rectWidth).toBe(5);
    expect(ss.rectHeight).toBe(4);
    expect(ss.defaultLabelScaleVal).toBe(2);
  });

  it("completePList appends remainder", () => {
    const ss = new SampleSpace();
    const result = ss.completePList([0.3, 0.2]);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(0.3);
    expect(result[1]).toBeCloseTo(0.2);
    expect(result[2]).toBeCloseTo(0.5);
  });

  it("completePList does not append when sum is 1", () => {
    const ss = new SampleSpace();
    const result = ss.completePList([0.5, 0.5]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
  });

  it("completePList handles single number", () => {
    const ss = new SampleSpace();
    const result = ss.completePList(0.7);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(0.7);
    expect(result[1]).toBeCloseTo(0.3);
  });

  it("completePList handles near-unity sums within epsilon", () => {
    const ss = new SampleSpace();
    // Sum is 0.99999 — within EPSILON of 1.0
    const result = ss.completePList([0.5, 0.49999]);
    expect(result).toHaveLength(2);
  });

  it("addLabel stores label string", () => {
    const ss = new SampleSpace();
    ss.addLabel("test label");
    expect(ss.label).toBe("test label");
  });

  it("getItem falls back to getFamily when no divisions", () => {
    const ss = new SampleSpace();
    const item = ss.getItem(0);
    expect(item).toBeDefined();
  });

  it("constructs with custom fill and stroke", () => {
    const ss = new SampleSpace({
      fillOpacity: 0.5,
      strokeWidth: 2,
    });
    expect(ss.fillOpacity).toBe(0.5);
    expect(ss.strokeWidth).toBe(2);
  });
});

// ─── BarChart ────────────────────────────────────────────────

describe("BarChart", () => {
  it("constructs with values (no bar names to avoid LaTeX)", () => {
    const chart = new BarChart([10, 20, 30]);
    expect(chart.values).toEqual([10, 20, 30]);
    expect(chart.bars.submobjects).toHaveLength(3);
  });

  it("stores bar visual properties", () => {
    const chart = new BarChart([5], {
      barWidth: 0.8,
      barFillOpacity: 0.9,
      barStrokeWidth: 5,
    });
    expect(chart.barWidth).toBe(0.8);
    expect(chart.barFillOpacity).toBe(0.9);
    expect(chart.barStrokeWidth).toBe(5);
  });

  it("uses default bar colors", () => {
    const chart = new BarChart([1]);
    expect(chart.barColors).toEqual([
      "#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600",
    ]);
  });

  it("handles negative values", () => {
    const chart = new BarChart([-5, 10, -3]);
    expect(chart.values).toEqual([-5, 10, -3]);
    expect(chart.bars.submobjects).toHaveLength(3);
  });

  it("handles all-zero values", () => {
    const chart = new BarChart([0, 0, 0]);
    expect(chart.values).toEqual([0, 0, 0]);
    expect(chart.bars.submobjects).toHaveLength(3);
  });

  it("changeBarValues updates stored values", () => {
    const chart = new BarChart([10, 20, 30]);
    chart.changeBarValues([5, 15, 25]);
    expect(chart.values).toEqual([5, 15, 25]);
  });

  it("computes y_range automatically when not provided", () => {
    const chart = new BarChart([-10, 20, 5]);
    expect(chart.values).toEqual([-10, 20, 5]);
    // Just verify it constructs without error
    expect(chart.bars.submobjects).toHaveLength(3);
  });

  it("accepts custom y_range", () => {
    const chart = new BarChart([10, 20], { yRange: [-20, 50, 10] });
    expect(chart.values).toEqual([10, 20]);
    expect(chart.bars.submobjects).toHaveLength(2);
  });

  it("handles single value", () => {
    const chart = new BarChart([42]);
    expect(chart.values).toEqual([42]);
    expect(chart.bars.submobjects).toHaveLength(1);
  });
});
