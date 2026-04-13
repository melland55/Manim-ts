/**
 * Tests for X11 color constants module.
 */

import { describe, it, expect } from "vitest";
import { ManimColor } from "../../../src/utils/color/core.js";
import * as X11 from "../../../src/utils/color/X11.js";

describe("X11 colors", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(X11)) {
      expect(value, `${key} should be a ManimColor`).toBeInstanceOf(ManimColor);
    }
  });

  it("exports the expected number of color constants", () => {
    const count = Object.keys(X11).length;
    // 504 exported color constants
    expect(count).toBe(504);
  });

  it("ALICEBLUE is #F0F8FF", () => {
    expect(X11.ALICEBLUE.toHex()).toBe("#F0F8FF");
  });

  it("BLACK is #000000", () => {
    expect(X11.BLACK.toHex()).toBe("#000000");
  });

  it("WHITE is #FFFFFF", () => {
    expect(X11.WHITE.toHex()).toBe("#FFFFFF");
  });

  it("RED1 is #FF0000", () => {
    expect(X11.RED1.toHex()).toBe("#FF0000");
  });

  it("GRAY50 is #7F7F7F (midpoint gray)", () => {
    expect(X11.GRAY50.toHex()).toBe("#7F7F7F");
  });

  it("YELLOWGREEN is #9ACD32", () => {
    expect(X11.YELLOWGREEN.toHex()).toBe("#9ACD32");
  });

  it("colors with numbered variants have correct ordering (BLUE series)", () => {
    // BLUE1 is brightest, BLUE4 is darkest
    const b1 = X11.BLUE1.toHex();
    const b2 = X11.BLUE2.toHex();
    const b4 = X11.BLUE4.toHex();
    expect(b1).toBe("#0000FF");
    expect(b2).toBe("#0000EE");
    expect(b4).toBe("#00008B");
  });

  it("can be accessed via the X11 namespace from the barrel export", async () => {
    const { X11: X11Ns } = await import("../../../src/utils/color/index.js");
    expect(X11Ns.CORAL).toBeInstanceOf(ManimColor);
    expect(X11Ns.CORAL.toHex()).toBe("#FF7F50");
  });
});
