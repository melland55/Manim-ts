/**
 * Barrel export for mobject.text module.
 * TypeScript port of manim/mobject/text/__init__.py
 *
 * Mobjects used to display Text using Pango or LaTeX.
 */

// text_mobject
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
} from "./text_mobject/index.js";

export type {
  TextOptions,
  MarkupTextOptions,
  ParagraphOptions,
} from "./text_mobject/index.js";

// tex_mobject
export {
  SingleStringMathTex,
  MathTex,
  MathTexPart,
  Tex,
  BulletedList,
  Title,
} from "./tex_mobject/index.js";

export type {
  SingleStringMathTexOptions,
  MathTexOptions,
  TexOptions,
  BulletedListOptions,
  TitleOptions,
} from "./tex_mobject/index.js";

// numbers
export {
  DecimalNumber,
  Integer,
  Variable,
} from "./numbers/index.js";

export type {
  DecimalNumberOptions,
  IntegerOptions,
  VariableOptions,
} from "./numbers/index.js";

// code_mobject
export { Code } from "./code_mobject/index.js";

export type {
  CodeOptions,
  BackgroundConfig,
  CodeParagraphConfig,
} from "./code_mobject/index.js";
