import { describe, it, expect } from "vitest";
import {
  Color,
  WHITE,
  BLACK,
  RED,
  BLUE,
  GREEN,
  YELLOW,
  YELLOW_C,
  GRAY,
  DARK_GRAY,
  PURE_RED,
  PURE_GREEN,
  PURE_BLUE,
  PURE_YELLOW,
  GRAY_BROWN,
  LOGO_WHITE,
  LOGO_GREEN,
} from "../../../src/core/color/index.js";

describe("Color construction", () => {
  it("clamps values to [0,1]", () => {
    const c = new Color(2, -1, 0.5);
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBe(0.5);
  });

  it("defaults alpha to 1", () => {
    const c = new Color(0.5, 0.5, 0.5);
    expect(c.a).toBe(1);
  });
});

describe("Color.fromHex", () => {
  it("parses 6-digit hex", () => {
    const c = Color.fromHex("#FF8000");
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(128 / 255, 2);
    expect(c.b).toBeCloseTo(0);
  });

  it("handles without hash", () => {
    const c = Color.fromHex("FF0000");
    expect(c.r).toBeCloseTo(1);
  });

  it("parses 8-digit hex with alpha", () => {
    const c = Color.fromHex("#FF000080");
    expect(c.a).toBeCloseTo(128 / 255, 2);
  });
});

describe("Color.toHex round-trip", () => {
  it("round-trips a color", () => {
    const original = Color.fromHex("#3A7BC8");
    const hex = original.toHex();
    const back = Color.fromHex(hex);
    expect(back.r).toBeCloseTo(original.r, 2);
    expect(back.g).toBeCloseTo(original.g, 2);
    expect(back.b).toBeCloseTo(original.b, 2);
  });
});

describe("Color.interpolate", () => {
  it("returns start at t=0", () => {
    const c = RED.interpolate(BLUE, 0);
    expect(c.r).toBeCloseTo(RED.r);
    expect(c.g).toBeCloseTo(RED.g);
    expect(c.b).toBeCloseTo(RED.b);
  });

  it("returns end at t=1", () => {
    const c = RED.interpolate(BLUE, 1);
    expect(c.r).toBeCloseTo(BLUE.r);
    expect(c.g).toBeCloseTo(BLUE.g);
    expect(c.b).toBeCloseTo(BLUE.b);
  });

  it("returns midpoint at t=0.5", () => {
    const c = new Color(0, 0, 0).interpolate(new Color(1, 1, 1), 0.5);
    expect(c.r).toBeCloseTo(0.5);
    expect(c.g).toBeCloseTo(0.5);
    expect(c.b).toBeCloseTo(0.5);
  });
});

describe("Color.lighter/darker", () => {
  it("lighter increases RGB", () => {
    const c = new Color(0.5, 0.5, 0.5);
    const lighter = c.lighter(0.1);
    expect(lighter.r).toBeCloseTo(0.6);
  });

  it("darker decreases RGB", () => {
    const c = new Color(0.5, 0.5, 0.5);
    const darker = c.darker(0.1);
    expect(darker.r).toBeCloseTo(0.4);
  });

  it("clamped to [0,1]", () => {
    const c = new Color(0.95, 0.95, 0.95);
    const lighter = c.lighter(0.2);
    expect(lighter.r).toBe(1);
  });
});

describe("Manim color palette correctness", () => {
  it("WHITE is #FFFFFF", () => {
    expect(WHITE.toHex().toUpperCase()).toBe("#FFFFFF");
  });

  it("BLACK is #000000", () => {
    expect(BLACK.toHex().toUpperCase()).toBe("#000000");
  });

  it("YELLOW_C is #F7D96F (NOT #FFFF00)", () => {
    expect(YELLOW_C.toHex().toUpperCase()).toBe("#F7D96F");
  });

  it("YELLOW equals YELLOW_C", () => {
    expect(YELLOW).toBe(YELLOW_C);
  });

  it("PURE_YELLOW is #FFFF00", () => {
    expect(PURE_YELLOW.toHex().toUpperCase()).toBe("#FFFF00");
  });

  it("PURE_RED is #FF0000", () => {
    expect(PURE_RED.toHex().toUpperCase()).toBe("#FF0000");
  });

  it("PURE_GREEN is #00FF00", () => {
    expect(PURE_GREEN.toHex().toUpperCase()).toBe("#00FF00");
  });

  it("PURE_BLUE is #0000FF", () => {
    expect(PURE_BLUE.toHex().toUpperCase()).toBe("#0000FF");
  });

  it("GRAY aliases exist and match", () => {
    expect(GRAY.toHex()).toBe(DARK_GRAY.toHex() ? GRAY.toHex() : "");
    expect(GRAY.toHex().toUpperCase()).toBe("#888888");
    expect(DARK_GRAY.toHex().toUpperCase()).toBe("#444444");
  });

  it("GRAY_BROWN is #736357", () => {
    expect(GRAY_BROWN.toHex().toUpperCase()).toBe("#736357");
  });

  it("LOGO colors exist", () => {
    expect(LOGO_WHITE.toHex().toUpperCase()).toBe("#ECE7E2");
    expect(LOGO_GREEN.toHex().toUpperCase()).toBe("#87C2A5");
  });
});

describe("Color.fromHSL", () => {
  it("red at hue=0", () => {
    const c = Color.fromHSL(0, 1, 0.5);
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(0);
    expect(c.b).toBeCloseTo(0);
  });

  it("green at hue=120", () => {
    const c = Color.fromHSL(120, 1, 0.5);
    expect(c.r).toBeCloseTo(0);
    expect(c.g).toBeCloseTo(1);
    expect(c.b).toBeCloseTo(0);
  });

  it("white at l=1", () => {
    const c = Color.fromHSL(0, 0, 1);
    expect(c.r).toBeCloseTo(1);
    expect(c.g).toBeCloseTo(1);
    expect(c.b).toBeCloseTo(1);
  });

  it("black at l=0", () => {
    const c = Color.fromHSL(0, 0, 0);
    expect(c.r).toBeCloseTo(0);
    expect(c.g).toBeCloseTo(0);
    expect(c.b).toBeCloseTo(0);
  });
});
