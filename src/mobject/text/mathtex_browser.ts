/**
 * Browser-capable MathTex implementation using MathJax + cheerio.
 *
 * Replaces the LaTeX-subprocess-based MathTex for environments where
 * pdflatex/dvisvgm are unavailable (browser, Node.js without TeX).
 *
 * Rendering pipeline:
 *   TeX string → texToSvg() (MathJax) → cheerio parse → <path> elements
 *   → VMobject subpaths (via svgPathToSubpaths) → VGroup with viewBox
 *   transform applied (scale + Y-flip so the group sits at Manim scene coords).
 *
 * The resulting VGroup is a drop-in for the SVGMobject-based MathTex:
 *   - Same constructor signature: (texStrings: string[], options?: MathTexOptions)
 *   - fontSize get/set (mirrors SingleStringMathTex)
 *   - texString / texStrings / argSeparator fields
 */

import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { VGroup, VMobject } from "../types/vectorized_mobject.js";
import { texToSvg } from "./mathjax_renderer.js";
import { svgPathToSubpaths } from "./svg_path_to_bezier.js";
import type { MathTexOptions } from "./tex_mobject/index.js";
import {
  DEFAULT_FONT_SIZE,
  SCALE_FACTOR_PER_FONT_POINT,
} from "../../constants/constants.js";

// Re-export the options type so callers can import from one place.
export type { MathTexOptions };

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Parse the SVG `viewBox` attribute string into its four numeric components.
 * Returns null if the attribute is absent or malformed.
 */
function parseViewBox(
  vb: string | undefined,
): [number, number, number, number] | null {
  if (!vb) return null;
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some(isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

// ── SVG transform parsing ────────────────────────────────────────────────────
//
// MathJax positions each glyph via a `<use>` element nested inside `<g>`
// wrappers that carry `transform` attributes (typically `translate(x,y)` or
// `matrix(a,b,c,d,e,f)`, occasionally `scale(s)`). To place glyphs correctly
// we compose the full ancestor transform chain into a single 2x3 affine
// matrix and apply it to each path point.
//
// Matrix layout: [a, b, c, d, e, f] representing
//   | a c e |
//   | b d f |
//   | 0 0 1 |

type Mat2x3 = [number, number, number, number, number, number];

const IDENTITY: Mat2x3 = [1, 0, 0, 1, 0, 0];

function multiply(m: Mat2x3, n: Mat2x3): Mat2x3 {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyMat(m: Mat2x3, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Parse a single SVG transform attribute string into a 2x3 matrix. */
function parseTransform(attr: string | undefined): Mat2x3 {
  if (!attr) return IDENTITY;
  let out: Mat2x3 = IDENTITY;
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attr)) !== null) {
    const op = match[1];
    const args = match[2]
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number);
    let step: Mat2x3 = IDENTITY;
    if (op === "matrix" && args.length === 6) {
      step = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (op === "translate") {
      step = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    } else if (op === "scale") {
      const sx = args[0] ?? 1;
      const sy = args.length > 1 ? args[1] : sx;
      step = [sx, 0, 0, sy, 0, 0];
    } else if (op === "rotate") {
      const a = ((args[0] ?? 0) * Math.PI) / 180;
      step = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
    }
    out = multiply(out, step);
  }
  return out;
}

/**
 * Walk from `node` up to the SVG root, composing `transform` attributes along
 * the way. Skips the outermost `scale(1,-1)` that MathJax uses to convert
 * math-space to SVG-space — buildVMobjectFromPath already treats paths as
 * Y-up so applying that flip here would double-flip the glyph.
 */
function composeAncestorTransform(
  $: CheerioAPI,
  node: Cheerio<AnyNode>,
): Mat2x3 {
  const chain: Mat2x3[] = [];
  let cursor: Cheerio<AnyNode> = node;
  // Include the node's own transform.
  chain.push(parseTransform(cursor.attr("transform")));
  // Walk ancestors.
  for (;;) {
    const parent = cursor.parent();
    if (!parent || parent.length === 0) break;
    const tag = (parent.get(0) as { name?: string })?.name;
    if (!tag || tag === "svg") break;
    const tx = parent.attr("transform");
    if (tx) {
      const mat = parseTransform(tx);
      // Detect the outer Y-flip MathJax wraps around the whole tree and skip it.
      const isYFlip =
        mat[0] === 1 && mat[1] === 0 && mat[2] === 0 && mat[3] === -1 &&
        mat[4] === 0 && mat[5] === 0;
      if (!isYFlip) chain.push(mat);
    }
    cursor = parent;
  }
  // Compose outermost → innermost so a point p maps to M_outer * ... * M_inner * p.
  let combined: Mat2x3 = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    combined = multiply(combined, chain[i]);
  }
  return combined;
}

/**
 * Build a VMobject from one SVG `d` attribute, applying an affine transform
 * (scaleX, scaleY, translateX, translateY) to map from SVG coordinate space
 * to Manim scene coordinates.
 *
 * Uses svgPathToSubpaths so that multi-contour glyphs (letter holes, etc.)
 * are represented as separate subpaths — identical to how SVGMobject handles
 * compound paths.
 *
 * Returns null if the path is empty or produces no valid cubics.
 */
function buildVMobjectFromPath(
  d: string,
  scaleX: number,
  scaleY: number,
  translateX: number,
  translateY: number,
  preTransform: Mat2x3 = IDENTITY,
): VMobject | null {
  const subpaths = svgPathToSubpaths(d);
  if (subpaths.length === 0) return null;

  const vmob = new VMobject({ fillOpacity: 1, strokeWidth: 0 });

  const mapPoint = (rawX: number, rawY: number): [number, number] => {
    const [tx, ty] = applyMat(preTransform, rawX, rawY);
    return [tx * scaleX + translateX, ty * scaleY + translateY];
  };

  for (const sp of subpaths) {
    const n = sp.shape[0] as number;
    // Need at least anchor₀ + handle1 + handle2 + anchor₁ = 4 rows (one cubic).
    if (n < 4) continue;

    const [x0, y0] = mapPoint(
      sp.get([0, 0]) as number,
      sp.get([0, 1]) as number,
    );
    vmob.startNewPath(np.array([x0, y0, 0]) as Point3D);

    // Add each cubic bezier segment (groups of 3: handle1, handle2, anchor).
    for (let i = 1; i + 2 < n; i += 3) {
      const [h1x, h1y] = mapPoint(
        sp.get([i, 0]) as number,
        sp.get([i, 1]) as number,
      );
      const [h2x, h2y] = mapPoint(
        sp.get([i + 1, 0]) as number,
        sp.get([i + 1, 1]) as number,
      );
      const [ax, ay] = mapPoint(
        sp.get([i + 2, 0]) as number,
        sp.get([i + 2, 1]) as number,
      );
      vmob.addCubicBezierCurveTo(
        np.array([h1x, h1y, 0]) as Point3D,
        np.array([h2x, h2y, 0]) as Point3D,
        np.array([ax, ay, 0]) as Point3D,
      );
    }
  }

  return vmob;
}

// ── BrowserMathTex ────────────────────────────────────────────────────────────

/**
 * MathTex rendered via MathJax SVG + cheerio path extraction.
 *
 * No external TeX tools (pdflatex, dvisvgm) are required — rendering is
 * handled entirely in process by mathjax_renderer.ts.
 *
 * ### Coordinate mapping
 *
 * MathJax produces an SVG with a `viewBox` whose Y axis points downward and
 * whose units are ~1/1000 em.  We apply the following transform so the group
 * sits at Manim scene coordinates:
 *
 * - Scale so the full viewBox height maps to 1.0 Manim unit (the "initial
 *   height" used by the fontSize setter).
 * - Flip the Y axis (SVG down → Manim up).
 * - Translate so the formula is centred at the origin.
 *
 * After construction, `fontSize` is applied just like `SingleStringMathTex`,
 * scaling the group to the requested point size.
 */
export class BrowserMathTex extends VGroup {
  readonly texString: string;
  readonly texStrings: string[];
  readonly argSeparator: string;

  /** Height of the group immediately after SVG parse (before fontSize scale). */
  private _initialHeight: number;

  constructor(texStrings: string[], options: MathTexOptions = {}) {
    super();

    const { argSeparator = " ", fontSize = DEFAULT_FONT_SIZE } = options;

    this.texStrings = texStrings;
    this.argSeparator = argSeparator;
    this.texString = texStrings.join(argSeparator);

    // ── 1. Render TeX → SVG ──────────────────────────────────────────────────
    const svgStr = texToSvg(this.texString, { display: false });

    // ── 2. Parse SVG ─────────────────────────────────────────────────────────
    const $ = load(svgStr, { xmlMode: true });
    const svgRoot = $("svg").first();

    // ── 3. Build viewBox → Manim transform ───────────────────────────────────
    //
    // MathJax wraps all glyph paths in an outer `<g transform="scale(1,-1)">`
    // — i.e. path `d` attributes are in MathJax math-space (Y-up) and the
    // scale(1,-1) transform flips them into SVG Y-down for rendering. We read
    // the raw `d` strings (ignoring parent transforms), so our input is already
    // Y-up. Applying another Y-flip renders the glyph upside-down — use
    // `scaleY = +s` instead.
    //
    // For scale, use a fixed `1 SVG unit = 1/100 Manim unit` factor rather than
    // normalising the viewBox to height 1. Normalising collapses all glyphs to
    // ~1.0 units tall before `fontSize` is applied, and the subsequent
    // fontSize=48 scale (0.05x) shrinks them to ~0.05 units — too small to
    // read. A fixed factor preserves the natural glyph height so the standard
    // font-size pipeline matches Python Manim's perceptual output.

    const SVG_TO_MANIM = 1 / 100;
    let scaleX = SVG_TO_MANIM;
    let scaleY = SVG_TO_MANIM;
    let translateX = 0;
    let translateY = 0;

    const vb = parseViewBox(svgRoot.attr("viewBox"));
    if (vb) {
      const [minX, minY, vbWidth, vbHeight] = vb;
      if (vbHeight > 0 && vbWidth > 0) {
        // Centre the glyph at the origin. Translation is in the final (Manim)
        // coordinate system, so multiply by the same scale factor.
        // In SVG coords, bbox centre is (minX + vbW/2, minY + vbH/2); after
        // flipping to math-space (Y-up), the centre in math coords is
        // (minX + vbW/2, -(minY + vbH/2)). We want that centre at (0,0):
        translateX = -(minX + vbWidth / 2) * SVG_TO_MANIM;
        translateY = (minY + vbHeight / 2) * SVG_TO_MANIM;
      }
    }

    // ── 4. Convert glyph references → VMobjects ──────────────────────────────
    //
    // MathJax emits each unique glyph once inside `<defs>` as a `<path>` with
    // an id, and positions instances via `<use xlink:href="#id">` elements
    // nested in `<g transform="translate(x,0)">` wrappers. Walking $("path")
    // alone gives every glyph at the origin (stacked garbage). We instead
    // build a defs map and iterate over every `<use>`, composing its ancestor
    // transform chain so each glyph lands at its intended position.

    const defsById = new Map<string, string>();
    $("defs path").each((_i, el) => {
      const id = $(el).attr("id");
      const d = $(el).attr("d");
      if (id && d) defsById.set(id, d);
    });

    const vmobjects: VMobject[] = [];

    const uses = $("use");
    if (uses.length > 0) {
      uses.each((_i, el) => {
        const node = $(el);
        const href = node.attr("xlink:href") ?? node.attr("href");
        if (!href) return;
        const id = href.startsWith("#") ? href.slice(1) : href;
        const d = defsById.get(id);
        if (!d) return;
        const preTransform = composeAncestorTransform($, node);
        const vmob = buildVMobjectFromPath(
          d,
          scaleX,
          scaleY,
          translateX,
          translateY,
          preTransform,
        );
        if (vmob !== null) vmobjects.push(vmob);
      });
    } else {
      // Fallback for SVG backends that inline paths directly (no <use>/<defs>).
      $("path").each((_i, el) => {
        const node = $(el);
        const d = node.attr("d");
        if (!d) return;
        const preTransform = composeAncestorTransform($, node);
        const vmob = buildVMobjectFromPath(
          d,
          scaleX,
          scaleY,
          translateX,
          translateY,
          preTransform,
        );
        if (vmob !== null) vmobjects.push(vmob);
      });
    }

    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }

    // ── 5. Capture initial height for fontSize get/set ────────────────────────
    const h = this.getHeight();
    this._initialHeight = h > 0 ? h : 1;

    // Apply the requested font size (mirrors SingleStringMathTex constructor).
    this.fontSize = fontSize;
  }

  /**
   * Current font size in points.
   *
   * Equivalent to `height / initialHeight / SCALE_FACTOR_PER_FONT_POINT`,
   * mirroring `SingleStringMathTex.fontSize`.
   */
  get fontSize(): number {
    const h = this.getHeight();
    if (h === 0) return DEFAULT_FONT_SIZE;
    return h / this._initialHeight / SCALE_FACTOR_PER_FONT_POINT;
  }

  set fontSize(value: number) {
    if (value <= 0) throw new Error("fontSize must be greater than 0");
    const current = this.fontSize;
    if (current > 0 && current !== value) {
      this.scale(value / current);
    }
  }
}

/**
 * Named alias so callers can swap to this backend with a one-line import change:
 *
 * ```typescript
 * // Before (requires pdflatex):
 * import { MathTex } from "./tex_mobject/index.js";
 * // After (browser-compatible):
 * import { MathTex } from "./mathtex_browser.js";
 * ```
 */
export { BrowserMathTex as MathTex };
