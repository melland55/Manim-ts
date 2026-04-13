/**
 * Tests for SVGNAMES module — SVG 1.1 color constants.
 */

import { describe, it, expect } from "vitest";
import * as SVGNAMES from "../../../src/utils/color/SVGNAMES.js";
import { ManimColor } from "../../../src/utils/color/core.js";

describe("SVGNAMES", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(SVGNAMES)) {
      expect(value).toBeInstanceOf(ManimColor);
    }
  });

  it("exports exactly 151 colors", () => {
    const count = Object.keys(SVGNAMES).length;
    expect(count).toBe(151);
  });

  it("ALICEBLUE has correct hex value", () => {
    expect(SVGNAMES.ALICEBLUE.toHex()).toBe("#EFF7FF");
  });

  it("LIGHTCORAL has correct hex value", () => {
    expect(SVGNAMES.LIGHTCORAL.toHex()).toBe("#EF7F7F");
  });

  it("RED is pure #FF0000", () => {
    expect(SVGNAMES.RED.toHex()).toBe("#FF0000");
  });

  it("WHITE is #FFFFFF", () => {
    expect(SVGNAMES.WHITE.toHex()).toBe("#FFFFFF");
  });

  it("BLACK is pure #000000", () => {
    expect(SVGNAMES.BLACK.toHex()).toBe("#000000");
  });

  it("GREY and GRAY are the same color", () => {
    expect(SVGNAMES.GREY.toHex()).toBe(SVGNAMES.GRAY.toHex());
  });

  it("colors support interpolation", () => {
    const mid = SVGNAMES.RED.interpolate(SVGNAMES.BLUE, 0.5);
    expect(mid).toBeInstanceOf(ManimColor);
  });

  it("colors can convert to RGBA array", () => {
    const arr = SVGNAMES.CYAN.toArray();
    expect(arr).toHaveLength(4);
    expect(arr[3]).toBe(1); // full opacity
  });

  it("YELLOW is pure #FFFF00", () => {
    expect(SVGNAMES.YELLOW.toHex()).toBe("#FFFF00");
  });
});
