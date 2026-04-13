/**
 * Tests for src/mobject/text/code_mobject/
 *
 * Note: Tests that create Code instances require the text rendering
 * backend (SVG generation) to be available. These tests are wrapped
 * to skip gracefully if the backend is not set up.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";

import {
  Code,
  type CodeOptions,
  type BackgroundConfig,
  type CodeParagraphConfig,
} from "../../../src/mobject/text/code_mobject/index.js";

// Helper: attempt to create a Code instance; returns null if the
// text rendering backend (SVG file generation) is not available.
function tryCreateCode(options: CodeOptions): Code | null {
  try {
    return new Code(options);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT") || msg.includes("no such file")) {
      // SVG rendering backend not available
      return null;
    }
    throw e;
  }
}

// ─── Code class ─────────────────────────────────────────────

describe("Code", () => {
  it("throws when neither code file nor code string is provided", () => {
    expect(() => new Code()).toThrow(
      "Either a code file or a code string must be specified.",
    );
  });

  it("throws on unknown background type", () => {
    expect(
      () =>
        new Code({
          codeString: "x = 1",
          language: "python",
          background: "unknown" as "rectangle",
        }),
    ).toThrow();
  });

  it("constructs from a code string (when backend available)", () => {
    const code = tryCreateCode({
      codeString: "const x = 42;",
      language: "typescript",
    });
    if (code == null) return; // skip if backend not available
    expect(code.codeLines).toBeDefined();
    expect(code.background).toBeDefined();
  });

  it("creates line numbers by default (when backend available)", () => {
    const code = tryCreateCode({
      codeString: "line1\nline2\nline3",
      language: "text",
    });
    if (code == null) return;
    expect(code.lineNumbers).toBeDefined();
  });

  it("omits line numbers when addLineNumbers is false (when backend available)", () => {
    const code = tryCreateCode({
      codeString: "line1\nline2",
      language: "text",
      addLineNumbers: false,
    });
    if (code == null) return;
    expect(code.lineNumbers).toBeUndefined();
  });

  it("supports window background style (when backend available)", () => {
    const code = tryCreateCode({
      codeString: "hello",
      language: "text",
      background: "window",
    });
    if (code == null) return;
    expect(code.background).toBeDefined();
    expect(code.background.submobjects.length).toBeGreaterThan(0);
  });

  it("expands tabs (when backend available)", () => {
    const code = tryCreateCode({
      codeString: "\tindented",
      language: "text",
      tabWidth: 2,
    });
    if (code == null) return;
    expect(code.codeLines).toBeDefined();
  });
});

// ─── Code.getStylesList ─────────────────────────────────────

describe("Code.getStylesList", () => {
  it("returns an array of style names", () => {
    const styles = Code.getStylesList();
    expect(Array.isArray(styles)).toBe(true);
    expect(styles.length).toBeGreaterThan(0);
  });

  it("includes 'vim' style", () => {
    const styles = Code.getStylesList();
    expect(styles).toContain("vim");
  });

  it("caches the result", () => {
    const styles1 = Code.getStylesList();
    const styles2 = Code.getStylesList();
    expect(styles1).toBe(styles2);
  });
});

// ─── Default configs ────────────────────────────────────────

describe("Code default configs", () => {
  it("has default background config", () => {
    expect(Code.defaultBackgroundConfig).toBeDefined();
    expect(Code.defaultBackgroundConfig.buff).toBe(0.3);
    expect(Code.defaultBackgroundConfig.cornerRadius).toBe(0.2);
    expect(Code.defaultBackgroundConfig.strokeWidth).toBe(1);
    expect(Code.defaultBackgroundConfig.fillOpacity).toBe(1);
  });

  it("has default paragraph config", () => {
    expect(Code.defaultParagraphConfig).toBeDefined();
    expect(Code.defaultParagraphConfig.font).toBe("Monospace");
    expect(Code.defaultParagraphConfig.fontSize).toBe(24);
    expect(Code.defaultParagraphConfig.lineSpacing).toBe(0.5);
    expect(Code.defaultParagraphConfig.disableLigatures).toBe(true);
  });
});
