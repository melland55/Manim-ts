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

// svg_path_to_bezier
export { svgPathToPoints, svgPathToSubpaths } from "./svg_path_to_bezier.js";

// code_mobject
export { Code } from "./code_mobject/index.js";

export type {
  CodeOptions,
  BackgroundConfig,
  CodeParagraphConfig,
} from "./code_mobject/index.js";

// mathjax_renderer
export { texToSvg } from "./mathjax_renderer.js";
export type { TexToSvgOptions } from "./mathjax_renderer.js";

// mathtex_browser — browser/Node backend (no pdflatex required)
export { BrowserMathTex } from "./mathtex_browser.js";

// glyph_vmobject — opentype.js-backed per-character text mobjects
export { GlyphText } from "./glyph_vmobject.js";
export type { GlyphTextOptions } from "./glyph_vmobject.js";
