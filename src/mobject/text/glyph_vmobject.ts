/**
 * GlyphText — opentype.js-backed text mobject.
 *
 * Loads a TTF/OTF font once (lazy, cached), extracts each character's glyph
 * as an SVG `d` string via opentype.js, converts the path to VMobject bezier
 * points via `svgPathToSubpaths`, lays glyphs out left-to-right using opentype
 * advance widths, and returns a VGroup of per-character VMobjects.
 *
 * This is the 1:1 analogue of Python Manim's Pango text path, ported for the
 * browser / Node.js opentype.js stack.
 *
 * Coordinate conventions:
 *   - opentype.js emits SVG-space paths (y increases downward, baseline at y=0,
 *     ascenders at negative y).
 *   - Manim uses y-up (positive y is up). We negate y to match — the same
 *     correction Python Manim's SVGMobject applies via `self.flip(RIGHT)`.
 *   - All coordinates are em-normalised (divided by fontSize), so the cap
 *     height of a typical uppercase letter is ≈ 0.7 Manim units at scale 1.
 *     Use `.scale(n)` on the returned VGroup to resize.
 */

import * as opentype from "opentype.js";
import { existsSync } from "fs";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { VMobject, VGroup } from "../types/index.js";
import type { VMobjectOptions } from "../types/index.js";
import { WHITE } from "../../utils/color/manim_colors.js";
import type { IColor } from "../../core/types.js";
import { svgPathToSubpaths } from "./svg_path_to_bezier.js";

// ── Font loading ──────────────────────────────────────────────────────────────

/** Candidate paths tried in order when no font is provided. */
const DEFAULT_FONT_CANDIDATES: string[] = [
  // Windows
  "C:/Windows/Fonts/calibri.ttf",
  "C:/Windows/Fonts/arial.ttf",
  // Linux (DejaVu is commonly available)
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  // macOS
  "/Library/Fonts/Arial.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
];

/** Module-level font cache: resolved path → opentype.Font. */
const fontCache = new Map<string, opentype.Font>();

/**
 * Browser-side default font, populated via preloadBrowserFont(). When set,
 * GlyphText uses it instead of probing the filesystem — the filesystem path
 * is unavailable in browsers and would otherwise throw.
 */
let browserDefaultFont: opentype.Font | null = null;

/**
 * Explicitly set an already-parsed opentype font as the browser default.
 * Useful when callers want to manage the fetch themselves.
 */
export function setDefaultFont(font: opentype.Font): void {
  browserDefaultFont = font;
}

/**
 * Fetch a TTF/OTF from a URL and install it as the browser default font.
 * Must be awaited before any browser-side Text/GlyphText construction.
 *
 * ```ts
 * await preloadFontFromUrl("/fonts/text.ttf");
 * const label = new Text("Hello");
 * ```
 */
export async function preloadFontFromUrl(url: string): Promise<opentype.Font> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`preloadFontFromUrl: failed to fetch ${url} (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const font = opentype.parse(buf);
  browserDefaultFont = font;
  return font;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function resolveDefaultFontPath(): string {
  for (const candidate of DEFAULT_FONT_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "GlyphText: no default system font found. " +
      "In Node: install a fallback font or pass opts.font. " +
      "In browser: call preloadFontFromUrl(url) before constructing Text."
  );
}

/** Load a font, using the module-level cache for repeated calls. */
function loadFont(fontPath: string): opentype.Font {
  if (!fontCache.has(fontPath)) {
    fontCache.set(fontPath, opentype.loadSync(fontPath));
  }
  return fontCache.get(fontPath)!;
}

/**
 * Return the opentype font to use for this GlyphText invocation. Browser
 * callers must preload the default font; Node callers fall back to the
 * filesystem candidates.
 */
function resolveFont(fontOpt: string | opentype.Font | undefined): opentype.Font {
  if (fontOpt && typeof fontOpt !== "string") return fontOpt;
  if (typeof fontOpt === "string") return loadFont(fontOpt);
  if (browserDefaultFont) return browserDefaultFont;
  if (isBrowser()) {
    throw new Error(
      "GlyphText: no font available in browser. " +
        "Call preloadFontFromUrl(url) before constructing Text.",
    );
  }
  return loadFont(resolveDefaultFontPath());
}

// ── Glyph → VMobject ──────────────────────────────────────────────────────────

interface GlyphStyle {
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeWidth: number;
  strokeOpacity: number;
}

/**
 * Build a VMobject from a single glyph's SVG `d` string.
 *
 * The `d` string comes from opentype.js in SVG coordinate space (y-down).
 * We negate y here to convert to Manim's y-up convention.
 */
function glyphDToVMobject(d: string, style: GlyphStyle): VMobject {
  const vmob = new VMobject({
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeOpacity: style.strokeOpacity,
  });

  const subpaths = svgPathToSubpaths(d);
  for (const sp of subpaths) {
    const n = sp.shape[0];
    if (n < 4) continue; // need at least anchor + one cubic segment

    const anchor0: Point3D = np.array([
      sp.get([0, 0]) as number,
      -(sp.get([0, 1]) as number), // negate y: SVG y-down → Manim y-up
      0,
    ]);
    vmob.startNewPath(anchor0);

    for (let i = 1; i < n; i += 3) {
      const h1: Point3D = np.array([
        sp.get([i, 0]) as number,
        -(sp.get([i, 1]) as number),
        0,
      ]);
      const h2: Point3D = np.array([
        sp.get([i + 1, 0]) as number,
        -(sp.get([i + 1, 1]) as number),
        0,
      ]);
      const anchor: Point3D = np.array([
        sp.get([i + 2, 0]) as number,
        -(sp.get([i + 2, 1]) as number),
        0,
      ]);
      vmob.addCubicBezierCurveTo(h1, h2, anchor);
    }
  }

  return vmob;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GlyphTextOptions extends VMobjectOptions {
  /**
   * TTF/OTF font source. Accepts:
   * - `string`: absolute filesystem path (Node only).
   * - `opentype.Font`: a pre-parsed font (browser or Node).
   * - `undefined`: use the browser default set via preloadFontFromUrl, or
   *   fall back to system font candidates in Node.
   */
  font?: string | opentype.Font;

  /**
   * Font render size in pixels passed to opentype.js. Controls the resolution
   * of the toPathData output but NOT the final Manim scale — all coordinates
   * are divided by this value to produce em-normalised units (cap height ≈ 0.7).
   * Default: 48.
   */
  fontSize?: number;
}

/**
 * Create a VGroup of per-character VMobjects representing `content`.
 *
 * Each submobject spans exactly one Unicode character (code point). Glyphs are
 * laid out left-to-right using opentype's advance widths plus pairwise kerning.
 *
 * Coordinates are em-normalised — a typical uppercase letter is ≈ 0.7 units
 * tall. Use `.scale(n)` on the returned VGroup to resize to the desired height.
 *
 * @example
 * const text = GlyphText("Hello", { font: "/path/to/font.ttf" });
 * text.scale(2).moveTo(ORIGIN);
 * scene.add(text);
 */
export function GlyphText(content: string, opts: GlyphTextOptions = {}): VGroup {
  const font = resolveFont(opts.font);
  const fontSize = opts.fontSize ?? 48;

  // em-normalise: divide opentype pixel coords by fontSize → 1 unit ≈ 1 em
  const emScale = 1.0 / fontSize;

  const style: GlyphStyle = {
    fillColor: (opts.fillColor as IColor) ?? WHITE,
    fillOpacity: opts.fillOpacity ?? 1.0,
    strokeColor: (opts.strokeColor as IColor) ?? WHITE,
    strokeWidth: opts.strokeWidth ?? 0,
    strokeOpacity: opts.strokeOpacity ?? 0.0,
  };

  const charVmobjects: VMobject[] = [];

  // Track x-cursor in opentype pixel space (at fontSize scale).
  let xPixel = 0;
  const chars = [...content]; // spread handles multi-code-unit chars
  const glyphList = chars.map((ch) => font.charToGlyph(ch));

  for (let i = 0; i < chars.length; i++) {
    const glyph = glyphList[i];

    // Get the glyph's SVG path with current x-offset applied.
    const pathObj = glyph.getPath(xPixel, 0, fontSize);
    const d = pathObj.toPathData(3);

    // Build the VMobject for this glyph.
    const vmob = glyphDToVMobject(d, style);

    // Scale from pixel space to em-normalised Manim coordinates.
    const nPts = vmob.points.shape[0];
    if (nPts > 0) {
      for (let r = 0; r < nPts; r++) {
        vmob.points.set([r, 0], (vmob.points.get([r, 0]) as number) * emScale);
        vmob.points.set([r, 1], (vmob.points.get([r, 1]) as number) * emScale);
        // z is already 0
      }
      charVmobjects.push(vmob);
    }

    // Advance cursor: advance width + pairwise kerning to next glyph.
    const advPx = (glyph.advanceWidth ?? 0) / font.unitsPerEm * fontSize;
    let kernPx = 0;
    if (i + 1 < glyphList.length) {
      const kv = font.getKerningValue(glyph, glyphList[i + 1]);
      kernPx = (kv ?? 0) / font.unitsPerEm * fontSize;
    }
    xPixel += advPx + kernPx;
  }

  return new VGroup(...charVmobjects);
}
