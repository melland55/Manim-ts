import { describe, it, expect } from "vitest";

/**
 * Tests for the mobject.graphing barrel export (index.ts).
 * Verifies that all public API is re-exported correctly.
 */

describe("mobject.graphing barrel export", () => {
  it("re-exports scale classes", async () => {
    const mod = await import("../../../src/mobject/graphing/index.js");
    expect(mod._ScaleBase).toBeDefined();
    expect(mod.LinearBase).toBeDefined();
    expect(mod.LogBase).toBeDefined();
  });

  it("re-exports number_line classes", async () => {
    const mod = await import("../../../src/mobject/graphing/index.js");
    expect(mod.NumberLine).toBeDefined();
    expect(mod.UnitInterval).toBeDefined();
  });

  it("re-exports functions classes", async () => {
    const mod = await import("../../../src/mobject/graphing/index.js");
    expect(mod.ParametricFunction).toBeDefined();
    expect(mod.FunctionGraph).toBeDefined();
    expect(mod.ImplicitFunction).toBeDefined();
  });

  it("re-exports probability classes", async () => {
    const mod = await import("../../../src/mobject/graphing/index.js");
    expect(mod.SampleSpace).toBeDefined();
    expect(mod.BarChart).toBeDefined();
  });

  it("LinearBase is a subclass of _ScaleBase", async () => {
    const { LinearBase, _ScaleBase } = await import(
      "../../../src/mobject/graphing/index.js"
    );
    const instance = new LinearBase();
    expect(instance).toBeInstanceOf(_ScaleBase);
  });

  it("LogBase is a subclass of _ScaleBase", async () => {
    const { LogBase, _ScaleBase } = await import(
      "../../../src/mobject/graphing/index.js"
    );
    const instance = new LogBase();
    expect(instance).toBeInstanceOf(_ScaleBase);
  });
});
