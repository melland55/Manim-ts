/**
 * Utilities for working with colors and predefined color constants.
 *
 * TypeScript port of manim/utils/color/__init__.py
 */

import * as AS2700 from "./AS2700.js";
import * as BS381 from "./BS381.js";
import * as DVIPSNAMES from "./DVIPSNAMES.js";
import * as ManimColorsModule from "./manim_colors.js";
import * as SVGNAMES from "./SVGNAMES.js";
import * as X11 from "./X11.js";
import * as XKCD from "./XKCD.js";
import {
  ManimColor,
  _setColorDict,
  _setAllManimColors,
} from "./core.js";
import { _allManimColors } from "./manim_colors.js";

// Re-export submodules as namespaces
export { AS2700, BS381, DVIPSNAMES, SVGNAMES, X11, XKCD };

// Re-export everything from core
export {
  ManimColor,
  HSV,
  RGBA,
  type ParsableManimColor,
  type ManimColorDType,
  colorToRgb,
  colorToRgba,
  colorToIntRgb,
  colorToIntRgba,
  rgbToColor,
  rgbaToColor,
  rgbToHex,
  hexToRgb,
  invertColor,
  colorGradient,
  interpolateColor,
  averageColor,
  randomBrightColor,
  randomColor,
  RandomColorGenerator,
  getShadedRgb,
} from "./core.js";

// Re-export everything from manim_colors
export * from "./manim_colors.js";

// ─── Build the global color dictionary ──────────────────────

function buildAllColorDict(): Map<string, ManimColor> {
  const dict = new Map<string, ManimColor>();

  const modules: Record<string, unknown>[] = [
    ManimColorsModule as unknown as Record<string, unknown>,
    AS2700 as unknown as Record<string, unknown>,
    BS381 as unknown as Record<string, unknown>,
    DVIPSNAMES as unknown as Record<string, unknown>,
    SVGNAMES as unknown as Record<string, unknown>,
    X11 as unknown as Record<string, unknown>,
    XKCD as unknown as Record<string, unknown>,
  ];

  for (const mod of modules) {
    for (const [key, value] of Object.entries(mod)) {
      if (value instanceof ManimColor && !key.startsWith("_")) {
        dict.set(key.toUpperCase(), value);
      }
    }
  }

  return dict;
}

// Initialize the color dictionary and manim colors list
_setAllManimColors(_allManimColors);
const _allColorDict = buildAllColorDict();
_setColorDict(_allColorDict);

export { _allColorDict };
