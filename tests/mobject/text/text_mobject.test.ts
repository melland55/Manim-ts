/**
 * Tests for src/mobject/text/text_mobject/
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";

import {
  Text,
  MarkupText,
  TextSetting,
  TEXT_MOB_SCALE_FACTOR,
  DEFAULT_LINE_SPACING_SCALE,
  TEXT2SVG_ADJUSTMENT_FACTOR,
} from "../../../src/mobject/text/text_mobject/index.js";

// ─── TextSetting ────────────────────────────────────────────

describe("TextSetting", () => {
  it("constructs with defaults", () => {
    const setting = new TextSetting(0, 5);
    expect(setting.start).toBe(0);
    expect(setting.end).toBe(5);
    expect(setting.font).toBe("");
    expect(setting.slant).toBe("NORMAL");
    expect(setting.weight).toBe("NORMAL");
    expect(setting.color).toBe("");
    expect(setting.lineNum).toBe(-1);
  });

  it("constructs with custom options", () => {
    const setting = new TextSetting(2, 10, {
      font: "Arial",
      slant: "ITALIC",
      weight: "BOLD",
      color: "#FF0000",
    });
    expect(setting.start).toBe(2);
    expect(setting.end).toBe(10);
    expect(setting.font).toBe("Arial");
    expect(setting.slant).toBe("ITALIC");
    expect(setting.weight).toBe("BOLD");
    expect(setting.color).toBe("#FF0000");
    expect(setting.lineNum).toBe(-1);
  });

  it("copy creates an independent clone", () => {
    const original = new TextSetting(0, 5, {
      font: "Helvetica",
      color: "#00FF00",
    });
    original.lineNum = 3;

    const copied = original.copy();
    expect(copied.start).toBe(0);
    expect(copied.end).toBe(5);
    expect(copied.font).toBe("Helvetica");
    expect(copied.color).toBe("#00FF00");
    expect(copied.lineNum).toBe(3);

    // Modifying copy should not affect original
    copied.start = 10;
    copied.lineNum = 7;
    expect(original.start).toBe(0);
    expect(original.lineNum).toBe(3);
  });
});

// ─── Constants ──────────────────────────────────────────────

describe("text_mobject constants", () => {
  it("TEXT_MOB_SCALE_FACTOR has expected value", () => {
    expect(TEXT_MOB_SCALE_FACTOR).toBe(0.05);
  });

  it("DEFAULT_LINE_SPACING_SCALE has expected value", () => {
    expect(DEFAULT_LINE_SPACING_SCALE).toBe(0.3);
  });

  it("TEXT2SVG_ADJUSTMENT_FACTOR has expected value", () => {
    expect(TEXT2SVG_ADJUSTMENT_FACTOR).toBe(4.8);
  });
});

// ─── Text._findIndexes ─────────────────────────────────────

describe("Text._findIndexes", () => {
  // We test this via creating a Text instance and calling the method.
  // Since Text constructor needs file I/O, we test the method logic directly.
  let textInstance: Text;

  // Create a minimal Text instance - constructor may fail if SVG
  // generation has issues, so we test the pure logic methods
  // by creating a direct instance when possible.

  it("finds substring indexes correctly", () => {
    // Test the static-like logic by using prototype method
    const proto = Text.prototype;
    const result = proto._findIndexes("world", "hello world foo world");
    expect(result).toEqual([
      [6, 11],
      [16, 21],
    ]);
  });

  it("finds no matches for missing substring", () => {
    const result = Text.prototype._findIndexes("xyz", "hello world");
    expect(result).toEqual([]);
  });

  it("handles slice notation [start:end]", () => {
    const result = Text.prototype._findIndexes("[2:5]", "hello world");
    expect(result).toEqual([[2, 5]]);
  });

  it("handles slice notation with open start [:end]", () => {
    const result = Text.prototype._findIndexes("[:3]", "hello");
    expect(result).toEqual([[0, 3]]);
  });

  it("handles slice notation with open end [start:]", () => {
    const result = Text.prototype._findIndexes("[3:]", "hello");
    expect(result).toEqual([[3, 5]]);
  });

  it("handles negative slice indexes", () => {
    const result = Text.prototype._findIndexes("[-3:]", "hello");
    expect(result).toEqual([[2, 5]]);
  });

  it("handles single character search", () => {
    const result = Text.prototype._findIndexes("l", "hello");
    expect(result).toEqual([
      [2, 3],
      [3, 4],
    ]);
  });
});

// ─── Text._text2hash ───────────────────────────────────────

describe("Text._text2hash", () => {
  it("produces a 16-char hex hash", () => {
    const hash = Text.prototype._text2hash("hello", {
      font: "",
      slant: "NORMAL",
      weight: "NORMAL",
      t2c: {},
      t2f: {},
      t2s: {},
      t2w: {},
      lineSpacing: 62.4,
      fontSize: 48,
      disableLigatures: false,
      gradient: null,
    }, "#FFFFFF");
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true);
  });

  it("produces different hashes for different text", () => {
    const settings = {
      font: "",
      slant: "NORMAL",
      weight: "NORMAL",
      t2c: {},
      t2f: {},
      t2s: {},
      t2w: {},
      lineSpacing: 62.4,
      fontSize: 48,
      disableLigatures: false,
      gradient: null,
    };
    const hash1 = Text.prototype._text2hash("hello", settings, "#FFFFFF");
    const hash2 = Text.prototype._text2hash("world", settings, "#FFFFFF");
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different colors", () => {
    const settings = {
      font: "",
      slant: "NORMAL",
      weight: "NORMAL",
      t2c: {},
      t2f: {},
      t2s: {},
      t2w: {},
      lineSpacing: 62.4,
      fontSize: 48,
      disableLigatures: false,
      gradient: null,
    };
    const hash1 = Text.prototype._text2hash("hello", settings, "#FFFFFF");
    const hash2 = Text.prototype._text2hash("hello", settings, "#FF0000");
    expect(hash1).not.toBe(hash2);
  });

  it("is deterministic (same input = same hash)", () => {
    const settings = {
      font: "Arial",
      slant: "ITALIC",
      weight: "BOLD",
      t2c: { hello: "#FF0000" },
      t2f: {},
      t2s: {},
      t2w: {},
      lineSpacing: 62.4,
      fontSize: 48,
      disableLigatures: true,
      gradient: null,
    };
    const hash1 = Text.prototype._text2hash("test", settings, "#000000");
    const hash2 = Text.prototype._text2hash("test", settings, "#000000");
    expect(hash1).toBe(hash2);
  });
});

// ─── MarkupText._countRealChars ─────────────────────────────

describe("MarkupText._countRealChars", () => {
  it("counts plain text characters (excluding spaces)", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars("hello")).toBe(5);
  });

  it("excludes spaces and tabs", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars("hello world")).toBe(10);
  });

  it("excludes markup tags", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars('<span foreground="red">hello</span>')).toBe(5);
  });

  it("handles HTML entities as single chars", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars("A&amp;B")).toBe(3);
  });

  it("handles nested tags", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars("<b><i>text</i></b>")).toBe(4);
  });

  it("returns 0 for empty string", () => {
    const instance = Object.create(MarkupText.prototype);
    expect(instance._countRealChars("")).toBe(0);
  });
});

// ─── Text.fontList ──────────────────────────────────────────

describe("Text.fontList", () => {
  it("returns an array", () => {
    const fonts = Text.fontList();
    expect(Array.isArray(fonts)).toBe(true);
  });
});

// ─── MarkupText._parseColor ────────────────────────────────

describe("MarkupText._parseColor", () => {
  it("parses hex color strings", () => {
    const color = MarkupText._parseColor("#ff0000");
    expect(color.toHex().toLowerCase()).toContain("ff0000");
  });
});
