/**
 * Browser-capable Text mobject.
 *
 * Python Manim's `Text` uses Pango, which requires libpango + subprocess
 * access — unavailable in browsers. This wrapper uses opentype.js (via
 * GlyphText) to produce the same VMobject-of-bezier-glyphs output, driven by
 * a preloaded TTF/OTF font. For Latin/ASCII content the glyph outlines and
 * kerning are indistinguishable from Pango's output.
 *
 * ### Usage
 *
 * ```ts
 * import { preloadFontFromUrl } from "manim-ts/mobject/text";
 * import { Text } from "manim-ts/mobject/text/text_browser";
 *
 * await preloadFontFromUrl("/fonts/text.ttf");
 * const label = new Text("(0, 0)", { color: WHITE });
 * ```
 *
 * Arguments mirror Python Manim's Text as closely as the GlyphText API allows:
 * `text`, `fontSize`, `color`/`fillColor`/`strokeColor`, etc.
 */

import * as opentype from "opentype.js";
import { VGroup, VMobject } from "../types/vectorized_mobject.js";
import { GlyphText } from "./glyph_vmobject.js";
import type { GlyphTextOptions } from "./glyph_vmobject.js";
import { WHITE } from "../../utils/color/manim_colors.js";
import type { IColor } from "../../core/types.js";
/**
 * Scale factor applied to GlyphText's em-normalised glyphs at fontSize=48.
 * Empirically matches Python Manim's Pango Text default: cap height of a
 * digit lands at ≈ 0.28 Manim units, matching the reference renders.
 */
const BASE_SCALE_AT_48 = 0.62;

export interface TextOptions extends GlyphTextOptions {
  /**
   * Font size in points. Python Manim's default is 48.
   * Final scale is `fontSize / 48 * BASE_SCALE_AT_48`.
   */
  fontSize?: number;

  /**
   * Shortcut that sets both fill and stroke color. Matches Python Manim's
   * `Text(color=...)` shorthand.
   */
  color?: IColor;
}

/**
 * VGroup of per-character VMobjects produced via opentype.js. Matches the
 * shape, kerning, and em metrics of Python Manim's Pango output when given
 * the same font (e.g. DejaVu Sans).
 */
export class Text extends VGroup {
  readonly text: string;

  constructor(text: string, options: TextOptions = {}) {
    super();

    const {
      fontSize = 48,
      color,
      fillColor,
      strokeColor,
      ...rest
    } = options;

    const finalFill = fillColor ?? color ?? WHITE;
    const finalStroke = strokeColor ?? color ?? WHITE;

    const glyphs = GlyphText(text, {
      ...rest,
      fillColor: finalFill,
      strokeColor: finalStroke,
    });

    glyphs.scale((fontSize / 48) * BASE_SCALE_AT_48);

    this.text = text;
    this.add(...(glyphs.submobjects as VMobject[]));
  }
}

export type { GlyphTextOptions };
export { preloadFontFromUrl, setDefaultFont } from "./glyph_vmobject.js";
export type Font = opentype.Font;
