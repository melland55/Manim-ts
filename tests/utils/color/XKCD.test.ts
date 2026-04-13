/**
 * Tests for XKCD color constants module.
 */

import { describe, it, expect } from "vitest";
import { ManimColor } from "../../../src/utils/color/core.js";
import * as XKCD from "../../../src/utils/color/XKCD.js";

describe("XKCD colors", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(XKCD)) {
      expect(value, `${key} should be a ManimColor`).toBeInstanceOf(ManimColor);
    }
  });

  it("exports the expected number of color constants", () => {
    const count = Object.keys(XKCD).length;
    // 922 exported color constants from the XKCD color name survey
    expect(count).toBe(922);
  });

  it("ACIDGREEN is #8FFE09", () => {
    expect(XKCD.ACIDGREEN.toHex()).toBe("#8FFE09");
  });

  it("BLACK is #000000", () => {
    expect(XKCD.BLACK.toHex()).toBe("#000000");
  });

  it("WHITE is #FFFFFF", () => {
    expect(XKCD.WHITE.toHex()).toBe("#FFFFFF");
  });

  it("MANGO is #FFA62B (example from XKCD docs)", () => {
    expect(XKCD.MANGO.toHex()).toBe("#FFA62B");
  });

  it("RED is #E50000 (XKCD red, not pure red)", () => {
    expect(XKCD.RED.toHex()).toBe("#E50000");
  });

  it("YELLOWYGREEN is #BFF128 (last alphabetical entry)", () => {
    expect(XKCD.YELLOWYGREEN.toHex()).toBe("#BFF128");
  });

  it("can be accessed via the XKCD namespace from the barrel export", async () => {
    const { XKCD: XKCDNs } = await import("../../../src/utils/color/index.js");
    expect(XKCDNs.MANGO).toBeInstanceOf(ManimColor);
    expect(XKCDNs.MANGO.toHex()).toBe("#FFA62B");
  });
});
