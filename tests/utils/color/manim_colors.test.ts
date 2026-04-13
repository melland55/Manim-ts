/**
 * Tests for manim_colors module — Manim's default color palette.
 */

import { describe, it, expect } from "vitest";
import {
  WHITE, BLACK, GRAY, GREY,
  GRAY_A, GREY_A, GRAY_B, GREY_B, GRAY_C, GREY_C,
  GRAY_D, GREY_D, GRAY_E, GREY_E,
  LIGHTER_GRAY, LIGHTER_GREY, LIGHT_GRAY, LIGHT_GREY,
  DARK_GRAY, DARK_GREY, DARKER_GRAY, DARKER_GREY,
  PURE_RED, PURE_GREEN, PURE_BLUE, PURE_CYAN, PURE_MAGENTA, PURE_YELLOW,
  BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E, BLUE, DARK_BLUE,
  TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E, TEAL,
  GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E, GREEN,
  YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E, YELLOW,
  GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E, GOLD,
  RED_A, RED_B, RED_C, RED_D, RED_E, RED,
  MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E, MAROON,
  PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E, PURPLE,
  PINK, LIGHT_PINK, ORANGE, LIGHT_BROWN, DARK_BROWN,
  GRAY_BROWN, GREY_BROWN,
  LOGO_WHITE, LOGO_GREEN, LOGO_BLUE, LOGO_RED, LOGO_BLACK,
  _allManimColors,
} from "../../../src/utils/color/manim_colors.js";
import { ManimColor } from "../../../src/utils/color/core.js";

describe("manim_colors", () => {
  it("all exports are ManimColor instances", () => {
    for (const color of _allManimColors) {
      expect(color).toBeInstanceOf(ManimColor);
    }
  });

  it("contains the expected number of colors", () => {
    // Python has duplicates (GREY/GRAY aliases), so count all entries
    expect(_allManimColors.length).toBeGreaterThanOrEqual(70);
  });

  it("WHITE is #FFFFFF", () => {
    expect(WHITE.toHex()).toBe("#FFFFFF");
  });

  it("BLACK is #000000", () => {
    expect(BLACK.toHex()).toBe("#000000");
  });

  it("GREY aliases match GRAY counterparts", () => {
    expect(GREY_A.toHex()).toBe(GRAY_A.toHex());
    expect(GREY_B.toHex()).toBe(GRAY_B.toHex());
    expect(GREY_C.toHex()).toBe(GRAY_C.toHex());
    expect(GREY_D.toHex()).toBe(GRAY_D.toHex());
    expect(GREY_E.toHex()).toBe(GRAY_E.toHex());
    expect(GREY.toHex()).toBe(GRAY.toHex());
    expect(LIGHTER_GREY.toHex()).toBe(LIGHTER_GRAY.toHex());
    expect(LIGHT_GREY.toHex()).toBe(LIGHT_GRAY.toHex());
    expect(DARK_GREY.toHex()).toBe(DARK_GRAY.toHex());
    expect(DARKER_GREY.toHex()).toBe(DARKER_GRAY.toHex());
    expect(GREY_BROWN.toHex()).toBe(GRAY_BROWN.toHex());
  });

  it("named gray aliases map to correct scale positions", () => {
    expect(LIGHTER_GRAY.toHex()).toBe(GRAY_A.toHex());
    expect(LIGHT_GRAY.toHex()).toBe(GRAY_B.toHex());
    expect(GRAY.toHex()).toBe(GRAY_C.toHex());
    expect(DARK_GRAY.toHex()).toBe(GRAY_D.toHex());
    expect(DARKER_GRAY.toHex()).toBe(GRAY_E.toHex());
  });

  it("pure colors have correct hex values", () => {
    expect(PURE_RED.toHex()).toBe("#FF0000");
    expect(PURE_GREEN.toHex()).toBe("#00FF00");
    expect(PURE_BLUE.toHex()).toBe("#0000FF");
    expect(PURE_CYAN.toHex()).toBe("#00FFFF");
    expect(PURE_MAGENTA.toHex()).toBe("#FF00FF");
    expect(PURE_YELLOW.toHex()).toBe("#FFFF00");
  });

  it("YELLOW is warm gold (#F7D96F), not pure yellow", () => {
    expect(YELLOW.toHex()).toBe("#F7D96F");
    expect(YELLOW_C.toHex()).toBe("#F7D96F");
    expect(YELLOW.toHex()).not.toBe("#FFFF00");
  });

  it("shorthand colors match their _C variant", () => {
    expect(BLUE.toHex()).toBe(BLUE_C.toHex());
    expect(TEAL.toHex()).toBe(TEAL_C.toHex());
    expect(GREEN.toHex()).toBe(GREEN_C.toHex());
    expect(YELLOW.toHex()).toBe(YELLOW_C.toHex());
    expect(GOLD.toHex()).toBe(GOLD_C.toHex());
    expect(RED.toHex()).toBe(RED_C.toHex());
    expect(MAROON.toHex()).toBe(MAROON_C.toHex());
    expect(PURPLE.toHex()).toBe(PURPLE_C.toHex());
  });

  it("logo colors have correct hex values", () => {
    expect(LOGO_WHITE.toHex()).toBe("#ECE7E2");
    expect(LOGO_GREEN.toHex()).toBe("#87C2A5");
    expect(LOGO_BLUE.toHex()).toBe("#525893");
    expect(LOGO_RED.toHex()).toBe("#E07A5F");
    expect(LOGO_BLACK.toHex()).toBe("#343434");
  });

  it("DARK_BLUE equals BLUE_E", () => {
    expect(DARK_BLUE.toHex()).toBe(BLUE_E.toHex());
  });
});
