/**
 * Mobjects related to SVG images.
 *
 * TypeScript port of manim/mobject/svg/__init__.py
 */

export { SVGMobject, VMobjectFromSVGPath } from "./svg_mobject.js";
export type { SVGMobjectOptions, VMobjectFromSVGPathOptions } from "./svg_mobject.js";

export {
  Brace,
  BraceLabel,
  BraceText,
  BraceBetweenPoints,
  ArcBrace,
} from "./brace.js";
export type { BraceOptions, BraceLabelOptions } from "./brace.js";
