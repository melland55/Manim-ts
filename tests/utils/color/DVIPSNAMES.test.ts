/**
 * Tests for DVIPSNAMES module — dvips driver color constants.
 */

import { describe, it, expect } from "vitest";
import * as DVIPSNAMES from "../../../src/utils/color/DVIPSNAMES.js";
import { ManimColor } from "../../../src/utils/color/core.js";

describe("DVIPSNAMES", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(DVIPSNAMES)) {
      expect(value).toBeInstanceOf(ManimColor);
    }
  });

  it("exports exactly 68 colors", () => {
    const count = Object.keys(DVIPSNAMES).length;
    expect(count).toBe(68);
  });

  it("AQUAMARINE has correct hex value", () => {
    expect(DVIPSNAMES.AQUAMARINE.toHex()).toBe("#00B5BE");
  });

  it("DARKORCHID has correct hex value", () => {
    expect(DVIPSNAMES.DARKORCHID.toHex()).toBe("#A4538A");
  });

  it("RED has correct hex value (dvips RED, not Manim RED)", () => {
    expect(DVIPSNAMES.RED.toHex()).toBe("#ED1B23");
  });

  it("WHITE is #FFFFFF", () => {
    expect(DVIPSNAMES.WHITE.toHex()).toBe("#FFFFFF");
  });

  it("BLACK is #221E1F (dvips black, not pure black)", () => {
    expect(DVIPSNAMES.BLACK.toHex()).toBe("#221E1F");
  });

  it("colors support interpolation", () => {
    const mid = DVIPSNAMES.RED.interpolate(DVIPSNAMES.BLUE, 0.5);
    expect(mid).toBeInstanceOf(ManimColor);
  });

  it("colors can convert to RGBA array", () => {
    const arr = DVIPSNAMES.CYAN.toArray();
    expect(arr).toHaveLength(4);
    expect(arr[3]).toBe(1); // full opacity
  });

  it("YELLOW has correct hex value", () => {
    expect(DVIPSNAMES.YELLOW.toHex()).toBe("#FFF200");
  });
});
