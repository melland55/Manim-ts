/**
 * Color system for manim-ts.
 * Implements IColor from core/types.ts with Manim's named color palette.
 *
 * All hex values verified against ManimCommunity/manim manim_colors.py
 */

import type { IColor, ColorArray } from "../types.js";
import { interpolate, clamp } from "../math/index.js";

export class Color implements IColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(r: number, g: number, b: number, a = 1.0) {
    this.r = clamp(r, 0, 1);
    this.g = clamp(g, 0, 1);
    this.b = clamp(b, 0, 1);
    this.a = clamp(a, 0, 1);
  }

  static fromHex(hex: string): Color {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1.0;
    return new Color(r, g, b, a);
  }

  static fromHSL(h: number, s: number, l: number, a = 1.0): Color {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }

    return new Color(r + m, g + m, b + m, a);
  }

  static fromRGB(r: number, g: number, b: number, a = 1.0): Color {
    return new Color(r / 255, g / 255, b / 255, a);
  }

  toHex(): string {
    const hex = (v: number) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
  }

  toArray(): ColorArray {
    return [this.r, this.g, this.b, this.a];
  }

  interpolate(other: IColor, t: number): Color {
    return new Color(
      interpolate(this.r, other.r, t),
      interpolate(this.g, other.g, t),
      interpolate(this.b, other.b, t),
      interpolate(this.a, other.a, t)
    );
  }

  lighter(amount = 0.2): Color {
    return new Color(
      clamp(this.r + amount, 0, 1),
      clamp(this.g + amount, 0, 1),
      clamp(this.b + amount, 0, 1),
      this.a
    );
  }

  darker(amount = 0.2): Color {
    return this.lighter(-amount);
  }

  withOpacity(opacity: number): Color {
    return new Color(this.r, this.g, this.b, opacity);
  }
}

// ─── Grayscale ──────────────────────────────────────────────

export const WHITE = Color.fromHex("#FFFFFF");
export const GRAY_A = Color.fromHex("#DDDDDD");
export const GREY_A = GRAY_A;
export const GRAY_B = Color.fromHex("#BBBBBB");
export const GREY_B = GRAY_B;
export const GRAY_C = Color.fromHex("#888888");
export const GREY_C = GRAY_C;
export const GRAY_D = Color.fromHex("#444444");
export const GREY_D = GRAY_D;
export const GRAY_E = Color.fromHex("#222222");
export const GREY_E = GRAY_E;
export const BLACK = Color.fromHex("#000000");

// Gray aliases
export const LIGHTER_GRAY = GRAY_A;
export const LIGHTER_GREY = GRAY_A;
export const LIGHT_GRAY = GRAY_B;
export const LIGHT_GREY = GRAY_B;
export const GRAY = GRAY_C;
export const GREY = GRAY_C;
export const DARK_GRAY = GRAY_D;
export const DARK_GREY = GRAY_D;
export const DARKER_GRAY = GRAY_E;
export const DARKER_GREY = GRAY_E;

// ─── Pure Colors ────────────────────────────────────────────

export const PURE_RED = Color.fromHex("#FF0000");
export const PURE_GREEN = Color.fromHex("#00FF00");
export const PURE_BLUE = Color.fromHex("#0000FF");
export const PURE_CYAN = Color.fromHex("#00FFFF");
export const PURE_MAGENTA = Color.fromHex("#FF00FF");
export const PURE_YELLOW = Color.fromHex("#FFFF00");

// ─── Blue ───────────────────────────────────────────────────

export const BLUE_A = Color.fromHex("#C7E9F1");
export const BLUE_B = Color.fromHex("#9CDCEB");
export const BLUE_C = Color.fromHex("#58C4DD");
export const BLUE_D = Color.fromHex("#29ABCA");
export const BLUE_E = Color.fromHex("#236B8E");
export const BLUE = BLUE_C;
export const DARK_BLUE = BLUE_E;

// ─── Teal ───────────────────────────────────────────────────

export const TEAL_A = Color.fromHex("#ACEAD7");
export const TEAL_B = Color.fromHex("#76DDC0");
export const TEAL_C = Color.fromHex("#5CD0B3");
export const TEAL_D = Color.fromHex("#55C1A7");
export const TEAL_E = Color.fromHex("#49A88F");
export const TEAL = TEAL_C;

// ─── Green ──────────────────────────────────────────────────

export const GREEN_A = Color.fromHex("#C9E2AE");
export const GREEN_B = Color.fromHex("#A6CF8C");
export const GREEN_C = Color.fromHex("#83C167");
export const GREEN_D = Color.fromHex("#77B05D");
export const GREEN_E = Color.fromHex("#699C52");
export const GREEN = GREEN_C;

// ─── Yellow (NOTE: YELLOW_C is #F7D96F, NOT #FFFF00) ───────

export const YELLOW_A = Color.fromHex("#FFF1B6");
export const YELLOW_B = Color.fromHex("#FFEA94");
export const YELLOW_C = Color.fromHex("#F7D96F");
export const YELLOW_D = Color.fromHex("#F4D345");
export const YELLOW_E = Color.fromHex("#E8C11C");
export const YELLOW = YELLOW_C;

// ─── Gold ───────────────────────────────────────────────────

export const GOLD_A = Color.fromHex("#F7C797");
export const GOLD_B = Color.fromHex("#F9B775");
export const GOLD_C = Color.fromHex("#F0AC5F");
export const GOLD_D = Color.fromHex("#E1A158");
export const GOLD_E = Color.fromHex("#C78D46");
export const GOLD = GOLD_C;

// ─── Red ────────────────────────────────────────────────────

export const RED_A = Color.fromHex("#F7A1A3");
export const RED_B = Color.fromHex("#FF8080");
export const RED_C = Color.fromHex("#FC6255");
export const RED_D = Color.fromHex("#E65A4C");
export const RED_E = Color.fromHex("#CF5044");
export const RED = RED_C;

// ─── Maroon ─────────────────────────────────────────────────

export const MAROON_A = Color.fromHex("#ECABC1");
export const MAROON_B = Color.fromHex("#EC92AB");
export const MAROON_C = Color.fromHex("#C55F73");
export const MAROON_D = Color.fromHex("#A24D61");
export const MAROON_E = Color.fromHex("#94424F");
export const MAROON = MAROON_C;

// ─── Purple ─────────────────────────────────────────────────

export const PURPLE_A = Color.fromHex("#CAA3E8");
export const PURPLE_B = Color.fromHex("#B189C6");
export const PURPLE_C = Color.fromHex("#9A72AC");
export const PURPLE_D = Color.fromHex("#715582");
export const PURPLE_E = Color.fromHex("#644172");
export const PURPLE = PURPLE_C;

// ─── Other ──────────────────────────────────────────────────

export const PINK = Color.fromHex("#D147BD");
export const LIGHT_PINK = Color.fromHex("#DC75CD");
export const ORANGE = Color.fromHex("#FF862F");
export const LIGHT_BROWN = Color.fromHex("#CD853F");
export const DARK_BROWN = Color.fromHex("#8B4513");
export const GRAY_BROWN = Color.fromHex("#736357");
export const GREY_BROWN = GRAY_BROWN;

// ─── Logo Colors ────────────────────────────────────────────

export const LOGO_WHITE = Color.fromHex("#ECE7E2");
export const LOGO_GREEN = Color.fromHex("#87C2A5");
export const LOGO_BLUE = Color.fromHex("#525893");
export const LOGO_RED = Color.fromHex("#E07A5F");
export const LOGO_BLACK = Color.fromHex("#343434");
