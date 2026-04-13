/**
 * Tests for AS2700 (Australian Standard) color constants module.
 */

import { describe, it, expect } from "vitest";
import { ManimColor } from "../../../src/utils/color/core.js";
import * as AS2700 from "../../../src/utils/color/AS2700.js";

describe("AS2700 colors", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(AS2700)) {
      expect(value, `${key} should be a ManimColor`).toBeInstanceOf(ManimColor);
    }
  });

  it("exports the expected number of color constants", () => {
    const count = Object.keys(AS2700).length;
    expect(count).toBe(206);
  });

  it("B23_BRIGHT_BLUE is #174F90", () => {
    expect(AS2700.B23_BRIGHT_BLUE.toHex()).toBe("#174F90");
  });

  it("N14_WHITE is #FFFFFF", () => {
    expect(AS2700.N14_WHITE.toHex()).toBe("#FFFFFF");
  });

  it("N61_BLACK is #2A2A2C", () => {
    expect(AS2700.N61_BLACK.toHex()).toBe("#2A2A2C");
  });

  it("R11_INTERNATIONAL_ORANGE is #CE482A", () => {
    expect(AS2700.R11_INTERNATIONAL_ORANGE.toHex()).toBe("#CE482A");
  });

  it("Y11_CANARY is #E7BD11", () => {
    expect(AS2700.Y11_CANARY.toHex()).toBe("#E7BD11");
  });

  it("G17_MINT_GREEN is #006B45", () => {
    expect(AS2700.G17_MINT_GREEN.toHex()).toBe("#006B45");
  });

  it("T63_TEAL is #183F4E", () => {
    expect(AS2700.T63_TEAL.toHex()).toBe("#183F4E");
  });

  it("X62_DARK_EARTH and X61_WOMBAT share the same hex (#6E5D52)", () => {
    expect(AS2700.X61_WOMBAT.toHex()).toBe("#6E5D52");
    expect(AS2700.X62_DARK_EARTH.toHex()).toBe("#6E5D52");
  });
});
