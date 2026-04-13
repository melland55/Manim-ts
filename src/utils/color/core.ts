/**
 * Manim's (internal) color data structure and utilities for color conversion.
 *
 * TypeScript port of manim/utils/color/core.py
 *
 * Contains:
 * - ManimColor class (the core color representation)
 * - HSV subclass for HSV color space
 * - Helper functions for color conversion (color_to_rgb, etc.)
 * - Color gradient and interpolation utilities
 * - RandomColorGenerator for seeded random color selection
 */

import type { IColor, ColorArray } from "../../core/types.js";
import type {
  FloatRGBLike,
  FloatRGBALike,
  IntRGBLike,
  IntRGBALike,
  FloatHSVLike,
  FloatHSVALike,
  FloatHSLLike,
  Point3D,
  Vector3D,
} from "../../typing/index.js";
import { np } from "../../core/math/index.js";

// ─── Internal Color Conversion Helpers ───────────────────────

/** RGB [0,1] -> HSV [0,1] (matches Python colorsys.rgb_to_hsv) */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, v];
}

/** HSV [0,1] -> RGB [0,1] (matches Python colorsys.hsv_to_rgb) */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  if (s === 0) return [v, v, v];
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    case 5: return [v, p, q];
    default: return [v, v, v];
  }
}

/** RGB [0,1] -> HLS (h, l, s) (matches Python colorsys.rgb_to_hls) */
function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, l, s]; // Python colorsys returns (h, l, s)
}

/** HLS (h, l, s) -> RGB [0,1] (matches Python colorsys.hls_to_rgb) */
function hlsToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
}

/** RGB to YIQ luminance (for contrasting color calculation) */
function rgbToYiqLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Hex regex: matches hex digits after # or 0x prefix
const RE_HEX = /((?<=#)|(?<=0x))[A-Fa-f0-9]{3,8}/i;

// ─── Color Name Registry ─────────────────────────────────────

/** Module-level color dictionary, set by index.ts after all colors are imported */
let _allColorDict: Map<string, ManimColor> | null = null;

export function _setColorDict(dict: Map<string, ManimColor>): void {
  _allColorDict = dict;
}

export function _getColorDict(): Map<string, ManimColor> | null {
  return _allColorDict;
}

// ─── Types ───────────────────────────────────────────────────

/**
 * All types that can be parsed into a ManimColor.
 */
export type ParsableManimColor =
  | ManimColor
  | number
  | string
  | readonly [number, number, number]
  | readonly [number, number, number, number];

// ─── ManimColor ──────────────────────────────────────────────

/**
 * Internal representation of a color.
 *
 * The internal representation is an array of 4 floats [r, g, b, a]
 * where r, g, b, a are between 0.0 and 1.0.
 */
export class ManimColor implements IColor {
  /** Internal RGBA value as [r, g, b, a] floats in [0, 1] */
  protected _value: [number, number, number, number];

  constructor(value?: ParsableManimColor | null, alpha: number = 1.0) {
    if (value === null || value === undefined) {
      this._value = [0, 0, 0, alpha];
    } else if (value instanceof ManimColor) {
      this._value = [...value._value];
    } else if (typeof value === "number") {
      this._value = ManimColor._fromInteger(value, alpha);
    } else if (typeof value === "string") {
      const result = RE_HEX.exec(value);
      if (result !== null) {
        this._value = ManimColor._fromHexString(result[0], alpha);
      } else {
        this._value = ManimColor._fromString(value, alpha);
      }
    } else if (Array.isArray(value) || (typeof value === "object" && "length" in value)) {
      const arr = value as readonly number[];
      const length = arr.length;
      // Heuristic: if any value > 1, treat as int (0-255); otherwise float (0-1)
      const isFloat = arr.every((x) => x >= 0 && x <= 1.0);
      if (isFloat) {
        if (length === 3) {
          this._value = [arr[0], arr[1], arr[2], alpha];
        } else if (length === 4) {
          this._value = [arr[0], arr[1], arr[2], arr[3]];
        } else {
          throw new Error(
            `ManimColor only accepts arrays of length 3 or 4, not ${length}`
          );
        }
      } else {
        if (length === 3) {
          this._value = [arr[0] / 255, arr[1] / 255, arr[2] / 255, alpha];
        } else if (length === 4) {
          this._value = [
            arr[0] / 255,
            arr[1] / 255,
            arr[2] / 255,
            arr[3] / 255,
          ];
        } else {
          throw new Error(
            `ManimColor only accepts arrays of length 3 or 4, not ${length}`
          );
        }
      }
    } else {
      throw new TypeError(
        "ManimColor only accepts ManimColor, number, string, " +
          "or arrays of 3 or 4 numbers"
      );
    }
  }

  // ── IColor properties ──

  get r(): number {
    return this._value[0];
  }

  get g(): number {
    return this._value[1];
  }

  get b(): number {
    return this._value[2];
  }

  get a(): number {
    return this._value[3];
  }

  // ── Internal static helpers ──

  private static _fromInteger(
    value: number,
    alpha: number
  ): [number, number, number, number] {
    return [
      ((value >> 16) & 0xff) / 255,
      ((value >> 8) & 0xff) / 255,
      (value & 0xff) / 255,
      alpha,
    ];
  }

  private static _fromHexString(
    hex: string,
    alpha: number
  ): [number, number, number, number] {
    // Expand shorthand (3 or 4 nibbles)
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length === 6) {
      hex += "FF";
    } else if (hex.length === 8) {
      alpha = parseInt(hex.slice(6, 8), 16) / 255;
    } else {
      throw new Error(
        "Hex colors must contain 3, 4, 6, or 8 hexadecimal digits"
      );
    }
    const tmp = parseInt(hex, 16);
    return [
      ((tmp >> 24) & 0xff) / 255,
      ((tmp >> 16) & 0xff) / 255,
      ((tmp >> 8) & 0xff) / 255,
      alpha,
    ];
  }

  private static _fromString(
    name: string,
    alpha: number
  ): [number, number, number, number] {
    if (_allColorDict) {
      const found = _allColorDict.get(name.toUpperCase());
      if (found) {
        const val: [number, number, number, number] = [...found._value];
        val[3] = alpha;
        return val;
      }
    }
    throw new Error(`Color ${name} not found`);
  }

  // ── Conversion methods ──

  toInteger(): number {
    const r = Math.round(this._value[0] * 255);
    const g = Math.round(this._value[1] * 255);
    const b = Math.round(this._value[2] * 255);
    return (r << 16) | (g << 8) | b;
  }

  toRgb(): [number, number, number] {
    return [this._value[0], this._value[1], this._value[2]];
  }

  toIntRgb(): [number, number, number] {
    return [
      Math.round(this._value[0] * 255),
      Math.round(this._value[1] * 255),
      Math.round(this._value[2] * 255),
    ];
  }

  toRgba(): [number, number, number, number] {
    return [...this._value];
  }

  toIntRgba(): [number, number, number, number] {
    return [
      Math.round(this._value[0] * 255),
      Math.round(this._value[1] * 255),
      Math.round(this._value[2] * 255),
      Math.round(this._value[3] * 255),
    ];
  }

  toRgbaWithAlpha(alpha: number): [number, number, number, number] {
    return [this._value[0], this._value[1], this._value[2], alpha];
  }

  toIntRgbaWithAlpha(alpha: number): [number, number, number, number] {
    return [
      Math.round(this._value[0] * 255),
      Math.round(this._value[1] * 255),
      Math.round(this._value[2] * 255),
      Math.round(alpha * 255),
    ];
  }

  toHex(withAlpha: boolean = false): string {
    const toHexByte = (v: number) =>
      Math.round(v * 255)
        .toString(16)
        .toUpperCase()
        .padStart(2, "0");
    let result = `#${toHexByte(this._value[0])}${toHexByte(this._value[1])}${toHexByte(this._value[2])}`;
    if (withAlpha) {
      result += toHexByte(this._value[3]);
    }
    return result;
  }

  toHsv(): [number, number, number] {
    return rgbToHsv(this._value[0], this._value[1], this._value[2]);
  }

  toHsl(): [number, number, number] {
    const [h, l, s] = rgbToHls(this._value[0], this._value[1], this._value[2]);
    return [h, s, l]; // Return as [h, s, l] not [h, l, s]
  }

  // ── IColor interface methods ──

  toArray(): ColorArray {
    return [...this._value];
  }

  // ── Manipulation methods ──

  invert(withAlpha: boolean = false): ManimColor {
    if (withAlpha) {
      return new ManimColor([
        1.0 - this._value[0],
        1.0 - this._value[1],
        1.0 - this._value[2],
        1.0 - this._value[3],
      ]);
    }
    return new ManimColor([
      1.0 - this._value[0],
      1.0 - this._value[1],
      1.0 - this._value[2],
      this._value[3],
    ]);
  }

  interpolate(other: IColor, alpha: number): ManimColor {
    return new ManimColor([
      this._value[0] * (1 - alpha) + other.r * alpha,
      this._value[1] * (1 - alpha) + other.g * alpha,
      this._value[2] * (1 - alpha) + other.b * alpha,
      this._value[3] * (1 - alpha) + other.a * alpha,
    ]);
  }

  darker(blend: number = 0.2): ManimColor {
    const alpha = this._value[3];
    const black = new ManimColor("#000000");
    const result = this.interpolate(black, blend);
    return result.opacity(alpha);
  }

  lighter(blend: number = 0.2): ManimColor {
    const alpha = this._value[3];
    const white = new ManimColor("#FFFFFF");
    const result = this.interpolate(white, blend);
    return result.opacity(alpha);
  }

  contrasting(
    threshold: number = 0.5,
    light?: ManimColor | null,
    dark?: ManimColor | null
  ): ManimColor {
    const luminance = rgbToYiqLuminance(
      this._value[0],
      this._value[1],
      this._value[2]
    );
    if (luminance < threshold) {
      return light ?? new ManimColor("#FFFFFF");
    }
    return dark ?? new ManimColor("#000000");
  }

  opacity(value: number): ManimColor {
    return new ManimColor([
      this._value[0],
      this._value[1],
      this._value[2],
      value,
    ]);
  }

  into<T extends ManimColor>(classType: new (...args: unknown[]) => T): T {
    // Convert to a different color space class
    if ("_fromInternal" in classType) {
      return (classType as unknown as { _fromInternal(v: [number, number, number, number]): T })._fromInternal(this._value);
    }
    return new classType(this._value) as T;
  }

  // ── Class factory methods ──

  static _fromInternal(value: [number, number, number, number]): ManimColor {
    return new ManimColor(value);
  }

  static fromRgb(
    rgb: FloatRGBLike | IntRGBLike | readonly [number, number, number],
    alpha: number = 1.0
  ): ManimColor {
    return ManimColor._fromInternal(
      new ManimColor(rgb as [number, number, number], alpha)._value
    );
  }

  static fromRgba(
    rgba: FloatRGBALike | IntRGBALike | readonly [number, number, number, number]
  ): ManimColor {
    return new ManimColor(rgba as [number, number, number, number]);
  }

  static fromHex(hexStr: string, alpha: number = 1.0): ManimColor {
    return ManimColor._fromInternal(new ManimColor(hexStr, alpha)._value);
  }

  static fromHsv(
    hsv: FloatHSVLike | readonly [number, number, number],
    alpha: number = 1.0
  ): ManimColor {
    const arr = Array.isArray(hsv) ? hsv : (hsv as unknown as number[]);
    const [r, g, b] = hsvToRgb(arr[0], arr[1], arr[2]);
    return new ManimColor([r, g, b, alpha]);
  }

  static fromHsl(
    hsl: FloatHSLLike | readonly [number, number, number],
    alpha: number = 1.0
  ): ManimColor {
    const arr = Array.isArray(hsl) ? hsl : (hsl as unknown as number[]);
    // HSL input is [h, s, l], but hlsToRgb expects (h, l, s)
    const [r, g, b] = hlsToRgb(arr[0], arr[2], arr[1]);
    return new ManimColor([r, g, b, alpha]);
  }

  static parse(
    color: ParsableManimColor | ParsableManimColor[] | null,
    alpha: number = 1.0
  ): ManimColor | ManimColor[] {
    if (Array.isArray(color) && color.length > 0 && (
      Array.isArray(color[0]) || typeof color[0] === "string" ||
      typeof color[0] === "number" || color[0] instanceof ManimColor
    )) {
      // Check if this looks like a sequence of colors vs a single color tuple
      // If first element is a ManimColor/string/non-number, it's a sequence
      if (
        color[0] instanceof ManimColor ||
        typeof color[0] === "string" ||
        Array.isArray(color[0])
      ) {
        return (color as ParsableManimColor[]).map(
          (c) => ManimColor._fromInternal(new ManimColor(c, alpha)._value)
        );
      }
    }
    return ManimColor._fromInternal(
      new ManimColor(color as ParsableManimColor | null, alpha)._value
    );
  }

  // ── Arithmetic methods (Python operator overloads) ──

  add(other: number | ManimColor): ManimColor {
    if (typeof other === "number") {
      return new ManimColor([
        this._value[0] + other,
        this._value[1] + other,
        this._value[2] + other,
        this._value[3] + other,
      ]);
    }
    return new ManimColor([
      this._value[0] + other._value[0],
      this._value[1] + other._value[1],
      this._value[2] + other._value[2],
      this._value[3] + other._value[3],
    ]);
  }

  subtract(other: number | ManimColor): ManimColor {
    if (typeof other === "number") {
      return new ManimColor([
        this._value[0] - other,
        this._value[1] - other,
        this._value[2] - other,
        this._value[3] - other,
      ]);
    }
    return new ManimColor([
      this._value[0] - other._value[0],
      this._value[1] - other._value[1],
      this._value[2] - other._value[2],
      this._value[3] - other._value[3],
    ]);
  }

  multiply(other: number | ManimColor): ManimColor {
    if (typeof other === "number") {
      return new ManimColor([
        this._value[0] * other,
        this._value[1] * other,
        this._value[2] * other,
        this._value[3] * other,
      ]);
    }
    return new ManimColor([
      this._value[0] * other._value[0],
      this._value[1] * other._value[1],
      this._value[2] * other._value[2],
      this._value[3] * other._value[3],
    ]);
  }

  divide(other: number | ManimColor): ManimColor {
    if (typeof other === "number") {
      return new ManimColor([
        this._value[0] / other,
        this._value[1] / other,
        this._value[2] / other,
        this._value[3] / other,
      ]);
    }
    return new ManimColor([
      this._value[0] / other._value[0],
      this._value[1] / other._value[1],
      this._value[2] / other._value[2],
      this._value[3] / other._value[3],
    ]);
  }

  // ── Indexing (Python __getitem__) ──

  getItem(index: number): number {
    return this._value[index];
  }

  // ── Bitwise operations ──

  bitwiseAnd(other: ManimColor): ManimColor {
    return new ManimColor(this.toInteger() & other.toInteger());
  }

  bitwiseOr(other: ManimColor): ManimColor {
    return new ManimColor(this.toInteger() | other.toInteger());
  }

  bitwiseXor(other: ManimColor): ManimColor {
    return new ManimColor(this.toInteger() ^ other.toInteger());
  }

  // ── Gradient (not yet implemented in Python Manim either) ──

  static gradient(
    _colors: ManimColor[],
    _length: number
  ): ManimColor | ManimColor[] {
    throw new Error("Not implemented. Use colorGradient() instead.");
  }

  // ── Comparison ──

  equals(other: ManimColor): boolean {
    return (
      Math.abs(this._value[0] - other._value[0]) < 1e-7 &&
      Math.abs(this._value[1] - other._value[1]) < 1e-7 &&
      Math.abs(this._value[2] - other._value[2]) < 1e-7 &&
      Math.abs(this._value[3] - other._value[3]) < 1e-7
    );
  }

  // ── String representation ──

  toString(): string {
    return this.toHex();
  }

  [Symbol.toPrimitive](hint: string): string | number {
    if (hint === "number") return this.toInteger();
    return this.toHex();
  }
}

/** RGBA Color Space alias */
export const RGBA = ManimColor;

// ─── HSV Color Space ─────────────────────────────────────────

/**
 * HSV Color Space.
 * Stores color internally as [h, s, v, a] and converts to/from RGB as needed.
 */
export class HSV extends ManimColor {
  private _hsv: [number, number, number, number];

  constructor(
    hsv: FloatHSVLike | FloatHSVALike | readonly number[],
    alpha: number = 1.0
  ) {
    super(null);
    const arr = Array.isArray(hsv) ? hsv : (hsv as unknown as number[]);
    if (arr.length === 3) {
      this._hsv = [arr[0], arr[1], arr[2], alpha];
    } else if (arr.length === 4) {
      this._hsv = [arr[0], arr[1], arr[2], arr[3]];
    } else {
      throw new Error("HSV Color must be an array of 3 or 4 values");
    }
    // Set internal RGB value from HSV
    this._updateRgbFromHsv();
  }

  private _updateRgbFromHsv(): void {
    const [r, g, b] = hsvToRgb(this._hsv[0], this._hsv[1], this._hsv[2]);
    this._value = [r, g, b, this._hsv[3]];
  }

  static override _fromInternal(
    value: [number, number, number, number]
  ): HSV {
    const [h, s, v] = rgbToHsv(value[0], value[1], value[2]);
    return new HSV([h, s, v, value[3]]);
  }

  get hue(): number {
    return this._hsv[0];
  }
  set hue(value: number) {
    this._hsv[0] = value;
    this._updateRgbFromHsv();
  }

  get saturation(): number {
    return this._hsv[1];
  }
  set saturation(value: number) {
    this._hsv[1] = value;
    this._updateRgbFromHsv();
  }

  get value(): number {
    return this._hsv[2];
  }
  set value(val: number) {
    this._hsv[2] = val;
    this._updateRgbFromHsv();
  }

  get h(): number {
    return this._hsv[0];
  }
  set h(value: number) {
    this.hue = value;
  }

  get s(): number {
    return this._hsv[1];
  }
  set s(value: number) {
    this.saturation = value;
  }

  get v(): number {
    return this._hsv[2];
  }
  set v(val: number) {
    this.value = val;
  }
}

// ─── Standalone Helper Functions ─────────────────────────────

export function colorToRgb(
  color: ParsableManimColor
): [number, number, number] {
  return new ManimColor(color).toRgb();
}

export function colorToRgba(
  color: ParsableManimColor,
  alpha: number = 1.0
): [number, number, number, number] {
  return new ManimColor(color).toRgbaWithAlpha(alpha);
}

export function colorToIntRgb(
  color: ParsableManimColor
): [number, number, number] {
  return new ManimColor(color).toIntRgb();
}

export function colorToIntRgba(
  color: ParsableManimColor,
  alpha: number = 1.0
): [number, number, number, number] {
  return new ManimColor(color).toIntRgbaWithAlpha(alpha);
}

export function rgbToColor(
  rgb: FloatRGBLike | IntRGBLike | readonly [number, number, number]
): ManimColor {
  return ManimColor.fromRgb(rgb);
}

export function rgbaToColor(
  rgba: FloatRGBALike | IntRGBALike | readonly [number, number, number, number]
): ManimColor {
  return ManimColor.fromRgba(rgba);
}

export function rgbToHex(
  rgb: FloatRGBLike | IntRGBLike | readonly [number, number, number]
): string {
  return ManimColor.fromRgb(rgb).toHex();
}

export function hexToRgb(hexCode: string): [number, number, number] {
  return new ManimColor(hexCode).toRgb();
}

export function invertColor<T extends ManimColor>(color: T): ManimColor {
  return color.invert();
}

export function colorGradient(
  referenceColors: Iterable<ParsableManimColor>,
  lengthOfOutput: number
): ManimColor[] {
  if (lengthOfOutput === 0) return [];

  const parsedColors = [...referenceColors].map((c) => new ManimColor(c));
  const numColors = parsedColors.length;

  if (numColors === 0) {
    throw new Error("Expected 1 or more reference colors. Got 0 colors.");
  }
  if (numColors === 1) {
    return Array(lengthOfOutput).fill(parsedColors[0]);
  }

  const rgbs = parsedColors.map((c) => c.toRgb());

  const result: ManimColor[] = [];
  for (let idx = 0; idx < lengthOfOutput; idx++) {
    let alpha = (idx / (lengthOfOutput - 1)) * (numColors - 1);
    let floor = Math.floor(alpha);
    let alphaMod1 = alpha - floor;

    // End edge case
    if (idx === lengthOfOutput - 1) {
      alphaMod1 = 1;
      floor = numColors - 2;
    }

    const [r1, g1, b1] = rgbs[floor];
    const [r2, g2, b2] = rgbs[floor + 1];
    result.push(
      rgbToColor([
        r1 * (1 - alphaMod1) + r2 * alphaMod1,
        g1 * (1 - alphaMod1) + g2 * alphaMod1,
        b1 * (1 - alphaMod1) + b2 * alphaMod1,
      ])
    );
  }
  return result;
}

export function interpolateColor(
  color1: ManimColor,
  color2: ManimColor,
  alpha: number
): ManimColor {
  return color1.interpolate(color2, alpha);
}

export function averageColor(
  ...colors: ParsableManimColor[]
): ManimColor {
  if (colors.length === 0) {
    throw new Error("Expected at least one color");
  }
  const rgbs = colors.map((c) => colorToRgb(c));
  const sum = [0, 0, 0];
  for (const [r, g, b] of rgbs) {
    sum[0] += r;
    sum[1] += g;
    sum[2] += b;
  }
  const n = rgbs.length;
  return rgbToColor([sum[0] / n, sum[1] / n, sum[2] / n]);
}

export function randomBrightColor(): ManimColor {
  const curr = colorToRgb(randomColor());
  return new ManimColor([
    0.5 * (curr[0] + 1),
    0.5 * (curr[1] + 1),
    0.5 * (curr[2] + 1),
  ]);
}

export function randomColor(): ManimColor {
  return RandomColorGenerator._randomColor();
}

/**
 * A generator for producing random colors from a given list of Manim colors,
 * optionally in a reproducible sequence using a seed value.
 */
export class RandomColorGenerator {
  private _rng: (() => number) | null;
  private _colors: ManimColor[];

  static _singleton: RandomColorGenerator | null = null;

  constructor(seed?: number | null, sampleColors?: ManimColor[] | null) {
    // Simple seeded PRNG (mulberry32)
    if (seed !== undefined && seed !== null) {
      let s = seed | 0;
      this._rng = () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    } else {
      this._rng = null;
    }
    this._colors = sampleColors ?? this._getDefaultColors();
  }

  private _getDefaultColors(): ManimColor[] {
    // Lazy import to avoid circular dependency
    try {
      // Will be populated after manim_colors module loads
      return _allManimColors ?? [new ManimColor("#FFFFFF")];
    } catch {
      return [new ManimColor("#FFFFFF")];
    }
  }

  next(): ManimColor {
    const rand = this._rng ? this._rng() : Math.random();
    const idx = Math.floor(rand * this._colors.length);
    return this._colors[idx];
  }

  static _randomColor(): ManimColor {
    if (!RandomColorGenerator._singleton) {
      RandomColorGenerator._singleton = new RandomColorGenerator();
    }
    return RandomColorGenerator._singleton.next();
  }
}

/** List of all manim default colors, set by manim_colors module */
let _allManimColors: ManimColor[] | null = null;

export function _setAllManimColors(colors: ManimColor[]): void {
  _allManimColors = colors;
  // Also update the singleton if it exists
  if (RandomColorGenerator._singleton) {
    RandomColorGenerator._singleton = null;
  }
}

/**
 * Add light or shadow to an RGB color based on surface orientation relative to light.
 */
export function getShadedRgb(
  rgb: [number, number, number],
  point: Point3D,
  unitNormalVect: Vector3D,
  lightSource: Point3D
): [number, number, number] {
  // toSun = normalize(lightSource - point)
  const diff = np.array([
    (lightSource as unknown as number[])[0] - (point as unknown as number[])[0],
    (lightSource as unknown as number[])[1] - (point as unknown as number[])[1],
    (lightSource as unknown as number[])[2] - (point as unknown as number[])[2],
  ]);
  const norm = np.linalg.norm(diff) as number;
  const toSun =
    norm === 0
      ? [0, 0, 0]
      : [
          (diff.get([0]) as number) / norm,
          (diff.get([1]) as number) / norm,
          (diff.get([2]) as number) / norm,
        ];

  // light = 0.5 * dot(unitNormalVect, toSun) ** 3
  const normalArr = (unitNormalVect as unknown as { toArray?: () => number[] }).toArray
    ? (unitNormalVect as unknown as { toArray: () => number[] }).toArray()
    : unitNormalVect as unknown as number[];
  const dotProduct =
    normalArr[0] * toSun[0] +
    normalArr[1] * toSun[1] +
    normalArr[2] * toSun[2];

  let light = 0.5 * Math.pow(dotProduct, 3);
  if (light < 0) {
    light *= 0.5;
  }

  return [rgb[0] + light, rgb[1] + light, rgb[2] + light];
}

// Re-export the ManimColorDType type name for compatibility
export type ManimColorDType = number;
