/**
 * Headless MathJax SVG renderer.
 *
 * Converts a TeX string to a plain SVG string containing only <path> elements
 * (no <use> references). Uses MathJax's liteAdaptor so no DOM is required.
 *
 * Initialization is lazy — the MathJax document is created on first call and
 * reused for all subsequent calls.
 */

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";

export interface TexToSvgOptions {
  /** Render in display mode (block, centred). Default: false (inline). */
  display?: boolean;
}

// ── Lazy singleton ────────────────────────────────────────────────────────────

type MathJaxDocument = ReturnType<typeof mathjax.document>;

let _adaptor: ReturnType<typeof liteAdaptor> | null = null;
let _mjDoc: MathJaxDocument | null = null;

function getMjDoc(): { adaptor: ReturnType<typeof liteAdaptor>; doc: MathJaxDocument } {
  if (_adaptor && _mjDoc) {
    return { adaptor: _adaptor, doc: _mjDoc };
  }

  _adaptor = liteAdaptor();
  RegisterHTMLHandler(_adaptor);

  _mjDoc = mathjax.document("", {
    InputJax: new TeX({ packages: ["base", "ams"] }),
    OutputJax: new SVG({
      // fontCache: 'none' ensures every glyph is emitted as an inline <path>
      // — no <defs>/<use> references, which is required for downstream parsing.
      fontCache: "none",
      internalSpeechTitles: false,
    }),
  });

  return { adaptor: _adaptor, doc: _mjDoc };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a TeX expression to an SVG string.
 *
 * The returned string is a standalone `<svg …>…</svg>` element whose children
 * are plain `<path d="…"/>` nodes — no `<use>` references, no external
 * resources.
 *
 * @param tex     TeX source, e.g. `"\\frac{a}{b}"` or `"E = mc^2"`
 * @param opts    Rendering options
 * @returns       SVG string
 *
 * @example
 * const svg = texToSvg("\\int_0^1 x^2 \\, dx");
 * // '<svg xmlns="http://www.w3.org/2000/svg" …><g …><path d="…"/></g></svg>'
 */
export function texToSvg(tex: string, opts: TexToSvgOptions = {}): string {
  const { display = false } = opts;
  const { adaptor, doc } = getMjDoc();

  const node = doc.convert(tex, { display });
  const outerHtml: string = adaptor.outerHTML(node);

  // MathJax wraps the SVG in a <mjx-container> element; extract the inner SVG.
  const svgMatch = outerHtml.match(/<svg[\s\S]*<\/svg>/);
  if (!svgMatch) {
    throw new Error(`MathJax produced no SVG for input: ${tex}`);
  }

  return svgMatch[0];
}
