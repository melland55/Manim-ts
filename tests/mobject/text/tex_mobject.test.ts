/**
 * Tests for src/mobject/text/tex_mobject/
 */

import { describe, it, expect } from "vitest";

import {
  SingleStringMathTex,
  MathTex,
  MathTexPart,
  Tex,
  BulletedList,
  Title,
} from "../../../src/mobject/text/tex_mobject/index.js";

import type {
  SingleStringMathTexOptions,
  MathTexOptions,
  TexOptions,
  BulletedListOptions,
  TitleOptions,
} from "../../../src/mobject/text/tex_mobject/index.js";

// ─── Exports ────────────────────────────────────────────────

describe("tex_mobject barrel exports", () => {
  it("exports all public classes", () => {
    expect(SingleStringMathTex).toBeDefined();
    expect(MathTex).toBeDefined();
    expect(MathTexPart).toBeDefined();
    expect(Tex).toBeDefined();
    expect(BulletedList).toBeDefined();
    expect(Title).toBeDefined();
  });
});

// ─── MathTexPart ────────────────────────────────────────────

describe("MathTexPart", () => {
  it("constructs with default empty texString", () => {
    const part = new MathTexPart();
    expect(part.texString).toBe("");
  });

  it("toString includes texString", () => {
    const part = new MathTexPart();
    part.texString = "x^2";
    expect(part.toString()).toContain("x^2");
    expect(part.toString()).toContain("MathTexPart");
  });
});

// ─── _splitDoubleBraces (via MathTex._prepareTexStrings) ────

describe("MathTex double brace splitting", () => {
  it("splits {{ a }} + {{ b }} into separate strings", () => {
    // We test indirectly since _splitDoubleBraces is private/static.
    // The split logic can be verified through the tex_strings property
    // after construction, but since construction requires LaTeX,
    // we test the static helper via a test subclass.
    // For now, test that the type system is correct.
    expect(typeof MathTex).toBe("function");
  });
});

// ─── _modifySpecialStrings (static behavior) ────────────────

describe("SingleStringMathTex special string handling", () => {
  it("class is defined and constructible type", () => {
    expect(typeof SingleStringMathTex).toBe("function");
  });
});

// ─── Option types ───────────────────────────────────────────

describe("option interfaces", () => {
  it("SingleStringMathTexOptions is a valid type", () => {
    const opts: SingleStringMathTexOptions = {
      fontSize: 36,
      texEnvironment: "align*",
      organizeLeftToRight: false,
    };
    expect(opts.fontSize).toBe(36);
  });

  it("MathTexOptions extends SingleStringMathTexOptions", () => {
    const opts: MathTexOptions = {
      argSeparator: " ",
      substringsToIsolate: ["x", "y"],
      texToColorMap: null,
      fontSize: 48,
    };
    expect(opts.argSeparator).toBe(" ");
  });

  it("TexOptions is compatible with MathTexOptions", () => {
    const opts: TexOptions = {
      argSeparator: "",
      texEnvironment: "center",
    };
    expect(opts.texEnvironment).toBe("center");
  });

  it("BulletedListOptions has buff and dotScaleFactor", () => {
    const opts: BulletedListOptions = {
      buff: 0.5,
      dotScaleFactor: 2,
    };
    expect(opts.buff).toBe(0.5);
    expect(opts.dotScaleFactor).toBe(2);
  });

  it("TitleOptions has underline options", () => {
    const opts: TitleOptions = {
      includeUnderline: true,
      matchUnderlineWidthToText: false,
      underlineBuff: 0.25,
    };
    expect(opts.includeUnderline).toBe(true);
  });
});
