/**
 * Tests for BS381 (British Standard) color constants module.
 */

import { describe, it, expect } from "vitest";
import { ManimColor } from "../../../src/utils/color/core.js";
import * as BS381 from "../../../src/utils/color/BS381.js";

describe("BS381 colors", () => {
  it("all exports are ManimColor instances", () => {
    for (const [key, value] of Object.entries(BS381)) {
      expect(value, `${key} should be a ManimColor`).toBeInstanceOf(ManimColor);
    }
  });

  it("exports the expected number of color constants", () => {
    const count = Object.keys(BS381).length;
    expect(count).toBe(287);
  });

  it("OXFORD_BLUE is #1F3057", () => {
    expect(BS381.OXFORD_BLUE.toHex()).toBe("#1F3057");
  });

  it("BS381_105 matches OXFORD_BLUE", () => {
    expect(BS381.BS381_105.toHex()).toBe(BS381.OXFORD_BLUE.toHex());
  });

  it("CANARY_YELLOW is #FEEC04", () => {
    expect(BS381.CANARY_YELLOW.toHex()).toBe("#FEEC04");
  });

  it("CRIMSON is #8B1A32", () => {
    expect(BS381.CRIMSON.toHex()).toBe("#8B1A32");
  });

  it("aliases share the same hex value (CHERRY and POST_OFFICE_RED)", () => {
    expect(BS381.CHERRY.toHex()).toBe(BS381.POST_OFFICE_RED.toHex());
    expect(BS381.CHERRY.toHex()).toBe("#C41C22");
  });

  it("triple alias: SUNRISE and SUNSHINE share BS381_387", () => {
    expect(BS381.SUNRISE.toHex()).toBe(BS381.SUNSHINE.toHex());
    expect(BS381.BS381_387.toHex()).toBe(BS381.SUNRISE.toHex());
  });

  it("TRAFFIC_GREEN and DEEP_CHROME_GREEN share BS381_267", () => {
    expect(BS381.TRAFFIC_GREEN.toHex()).toBe(BS381.DEEP_CHROME_GREEN.toHex());
    expect(BS381.BS381_267.toHex()).toBe("#476A4C");
  });

  it("can be accessed via the BS381 namespace from the barrel export", async () => {
    const { BS381: BS381Ns } = await import("../../../src/utils/color/index.js");
    expect(BS381Ns.EMERALD_GREEN).toBeInstanceOf(ManimColor);
    expect(BS381Ns.EMERALD_GREEN.toHex()).toBe("#428B64");
  });
});
