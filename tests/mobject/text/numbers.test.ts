/**
 * Tests for src/mobject/text/numbers/
 *
 * NOTE: DecimalNumber/Integer/Variable constructors require LaTeX to be
 * installed (they construct MathTex submobjects). Tests that exercise
 * construction are skipped in environments without LaTeX. Type-level
 * and export tests always run.
 */

import { describe, it, expect } from "vitest";

import {
  DecimalNumber,
  Integer,
  Variable,
} from "../../../src/mobject/text/numbers/index.js";

import type {
  DecimalNumberOptions,
  IntegerOptions,
  VariableOptions,
} from "../../../src/mobject/text/numbers/index.js";

// ─── Detect LaTeX availability ──────────────────────────────

let hasLatex = false;
try {
  const dn = new DecimalNumber({ number: 0 });
  hasLatex = true;
} catch {
  // LaTeX not available
}

const itIfLatex = hasLatex ? it : it.skip;

// ─── Exports ────────────────────────────────────────────────

describe("numbers barrel exports", () => {
  it("exports all public classes", () => {
    expect(DecimalNumber).toBeDefined();
    expect(Integer).toBeDefined();
    expect(Variable).toBeDefined();
  });

  it("classes are constructible types", () => {
    expect(typeof DecimalNumber).toBe("function");
    expect(typeof Integer).toBe("function");
    expect(typeof Variable).toBe("function");
  });
});

// ─── Option interfaces (type-level) ────────────────────────

describe("option interfaces", () => {
  it("DecimalNumberOptions is a valid type", () => {
    const opts: DecimalNumberOptions = {
      number: 3.14,
      numDecimalPlaces: 3,
      includeSign: true,
      groupWithCommas: false,
      showEllipsis: true,
      unit: "\\text{m}",
      unitBuffPerFontUnit: 0.003,
      fontSize: 36,
    };
    expect(opts.number).toBe(3.14);
    expect(opts.numDecimalPlaces).toBe(3);
    expect(opts.includeSign).toBe(true);
  });

  it("IntegerOptions extends DecimalNumberOptions", () => {
    const opts: IntegerOptions = {
      number: 42,
      includeSign: false,
      groupWithCommas: true,
    };
    expect(opts.number).toBe(42);
  });

  it("VariableOptions has color and name", () => {
    const opts: VariableOptions = {
      color: null,
      name: "myVar",
    };
    expect(opts.name).toBe("myVar");
  });
});

// ─── DecimalNumber (requires LaTeX) ─────────────────────────

describe("DecimalNumber", () => {
  itIfLatex("constructs with default options", () => {
    const dn = new DecimalNumber();
    expect(dn.number).toBe(0);
    expect(dn.numDecimalPlaces).toBe(2);
    expect(dn.includeSign).toBe(false);
    expect(dn.groupWithCommas).toBe(true);
    expect(dn.showEllipsis).toBe(false);
    expect(dn.unit).toBeNull();
  });

  itIfLatex("constructs with custom number", () => {
    const dn = new DecimalNumber({ number: 3.14159 });
    expect(dn.number).toBe(3.14159);
    expect(dn.getValue()).toBeCloseTo(3.14159, 4);
  });

  itIfLatex("getValue returns current number", () => {
    const dn = new DecimalNumber({ number: 42.5 });
    expect(dn.getValue()).toBe(42.5);
  });

  itIfLatex("setValue updates the number", () => {
    const dn = new DecimalNumber({ number: 0 });
    dn.setValue(10.5);
    expect(dn.getValue()).toBe(10.5);
  });

  itIfLatex("setValue returns this for chaining", () => {
    const dn = new DecimalNumber({ number: 0 });
    const result = dn.setValue(5);
    expect(result).toBe(dn);
  });

  itIfLatex("incrementValue adds to current value", () => {
    const dn = new DecimalNumber({ number: 5 });
    dn.incrementValue(3);
    expect(dn.getValue()).toBe(8);
  });

  itIfLatex("incrementValue defaults to 1", () => {
    const dn = new DecimalNumber({ number: 5 });
    dn.incrementValue();
    expect(dn.getValue()).toBe(6);
  });

  itIfLatex("handles negative numbers", () => {
    const dn = new DecimalNumber({ number: -3.5 });
    expect(dn.getValue()).toBe(-3.5);
  });

  itIfLatex("fontSize setter throws for non-positive", () => {
    const dn = new DecimalNumber({ number: 1 });
    expect(() => { dn.fontSize = -1; }).toThrow("font_size must be greater than 0.");
    expect(() => { dn.fontSize = 0; }).toThrow("font_size must be greater than 0.");
  });

  itIfLatex("_getNumString formats with comma grouping", () => {
    const dn = new DecimalNumber({ number: 1234.56, numDecimalPlaces: 2 });
    const result = dn._getNumString(1234.56);
    expect(result).toContain("1,234");
  });

  itIfLatex("_getNumString without commas", () => {
    const dn = new DecimalNumber({ number: 1234, groupWithCommas: false, numDecimalPlaces: 0 });
    const result = dn._getNumString(1234);
    expect(result).not.toContain(",");
    expect(result).toContain("1234");
  });
});

// ─── Integer (requires LaTeX) ───────────────────────────────

describe("Integer", () => {
  itIfLatex("constructs with default options", () => {
    const int = new Integer();
    expect(int.number).toBe(0);
    expect(int.numDecimalPlaces).toBe(0);
  });

  itIfLatex("getValue returns rounded integer", () => {
    const int = new Integer({ number: 2.7 });
    expect(int.getValue()).toBe(3);
  });

  itIfLatex("getValue rounds negative values", () => {
    const int = new Integer({ number: -2.3 });
    expect(int.getValue()).toBe(-2);
  });

  itIfLatex("getValue handles exact integers", () => {
    const int = new Integer({ number: 42 });
    expect(int.getValue()).toBe(42);
  });
});

// ─── Variable (requires LaTeX) ──────────────────────────────

describe("Variable", () => {
  itIfLatex("constructs with string label", () => {
    const v = new Variable(0.5, "x");
    expect(v.label).toBeDefined();
    expect(v.tracker).toBeDefined();
    expect(v.value).toBeDefined();
  });

  itIfLatex("tracker holds the initial value", () => {
    const v = new Variable(3.14, "pi");
    expect(v.tracker.getValue()).toBeCloseTo(3.14, 4);
  });

  itIfLatex("constructs with Integer varType", () => {
    const v = new Variable(5.7, "k", { varType: Integer });
    expect(v.value).toBeInstanceOf(Integer);
    expect(v.value.getValue()).toBe(6);
  });

  itIfLatex("has label and value as submobjects", () => {
    const v = new Variable(1, "x");
    expect(v.submobjects.length).toBeGreaterThanOrEqual(2);
  });
});
