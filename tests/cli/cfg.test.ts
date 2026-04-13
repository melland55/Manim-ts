import { describe, it, expect } from "vitest";
import {
  RICH_COLOUR_INSTRUCTIONS,
  RICH_NON_STYLE_ENTRIES,
  valueFromString,
  isValidStyle,
  replaceKeys,
} from "../../src/cli/cfg/index.js";

// ─── valueFromString ─────────────────────────────────────────────────────────

describe("valueFromString", () => {
  it("returns true for 'True'", () => {
    expect(valueFromString("True")).toBe(true);
  });

  it("returns false for 'False'", () => {
    expect(valueFromString("False")).toBe(false);
  });

  it("parses integer strings", () => {
    expect(valueFromString("42")).toBe(42);
    expect(valueFromString("-7")).toBe(-7);
    expect(valueFromString("0")).toBe(0);
  });

  it("parses float strings", () => {
    expect(valueFromString("3.14")).toBeCloseTo(3.14);
    expect(valueFromString("-0.5")).toBeCloseTo(-0.5);
  });

  it("returns raw string for non-literal values", () => {
    expect(valueFromString("hello")).toBe("hello");
    expect(valueFromString("")).toBe("");
    expect(valueFromString("some sentence")).toBe("some sentence");
  });

  it("returns string for 'None'", () => {
    expect(valueFromString("None")).toBe("None");
  });
});

// ─── isValidStyle ─────────────────────────────────────────────────────────────

describe("isValidStyle", () => {
  it("returns true for a non-empty style string", () => {
    expect(isValidStyle("bold")).toBe(true);
    expect(isValidStyle("red")).toBe(true);
    expect(isValidStyle("#FF0000")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidStyle("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isValidStyle("   ")).toBe(false);
  });
});

// ─── replaceKeys ──────────────────────────────────────────────────────────────

describe("replaceKeys", () => {
  it("replaces underscores with dots", () => {
    const dict = { log_width: "80" };
    const result = replaceKeys(dict);
    expect(result).toHaveProperty("log.width");
    expect(result["log.width"]).toBe("80");
    expect(result).not.toHaveProperty("log_width");
  });

  it("replaces dots with underscores when no underscores present", () => {
    const dict = { "log.width": "80" };
    const result = replaceKeys(dict);
    expect(result).toHaveProperty("log_width");
    expect(result["log_width"]).toBe("80");
    expect(result).not.toHaveProperty("log.width");
  });

  it("preserves values during key transformation", () => {
    const dict = { background_color: "#000000", frame_rate: "30" };
    const result = replaceKeys(dict);
    expect(result["background.color"]).toBe("#000000");
    expect(result["frame.rate"]).toBe("30");
  });

  it("returns the same object reference (mutates in place)", () => {
    const dict = { some_key: "value" };
    const result = replaceKeys(dict);
    expect(result).toBe(dict);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("RICH_COLOUR_INSTRUCTIONS is a non-empty string", () => {
    expect(typeof RICH_COLOUR_INSTRUCTIONS).toBe("string");
    expect(RICH_COLOUR_INSTRUCTIONS.length).toBeGreaterThan(0);
  });

  it("RICH_NON_STYLE_ENTRIES contains expected entries", () => {
    expect(RICH_NON_STYLE_ENTRIES).toContain("log.width");
    expect(RICH_NON_STYLE_ENTRIES).toContain("log.height");
    expect(RICH_NON_STYLE_ENTRIES).toContain("log.timestamps");
  });

  it("RICH_NON_STYLE_ENTRIES has exactly 3 entries", () => {
    expect(RICH_NON_STYLE_ENTRIES).toHaveLength(3);
  });
});
