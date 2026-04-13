/**
 * Barrel export for mobject.text.text_mobject module.
 * TypeScript port of manim/mobject/text/text_mobject.py
 */

export {
  Text,
  MarkupText,
  Paragraph,
  TextSetting,
  removeInvisibleChars,
  registerFont,
  TEXT_MOB_SCALE_FACTOR,
  DEFAULT_LINE_SPACING_SCALE,
  TEXT2SVG_ADJUSTMENT_FACTOR,
} from "./text_mobject.js";

export type {
  TextOptions,
  MarkupTextOptions,
  ParagraphOptions,
} from "./text_mobject.js";
