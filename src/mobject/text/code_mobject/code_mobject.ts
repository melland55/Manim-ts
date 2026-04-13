/**
 * Mobject representing highlighted source code listings.
 *
 * TypeScript port of manim/mobject/text/code_mobject.py
 *
 * Uses highlight.js (replaces Python pygments) for syntax highlighting,
 * and cheerio (replaces Python beautifulsoup4) for HTML parsing.
 */

import { load } from "cheerio";
import hljs from "highlight.js";

import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  LEFT,
  RIGHT,
  UP,
  SMALL_BUFF,
  DEFAULT_STROKE_WIDTH,
} from "../../../constants/constants.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../../utils/color/core.js";
import { WHITE } from "../../../utils/color/manim_colors.js";
import { Mobject } from "../../mobject/index.js";
import {
  Paragraph,
  type ParagraphOptions,
} from "../text_mobject/index.js";

// ─── Dependency stubs ───────────────────────────────────────
// These mirror the stub patterns used in other converted modules.
// Replace with real imports once the respective modules are fully converted.

// VMobject stub
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once converted
class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;

  constructor(
    options: {
      color?: ParsableManimColor | null;
      name?: string;
      fillColor?: ParsableManimColor | null;
      fillOpacity?: number;
      strokeColor?: ParsableManimColor | null;
      strokeOpacity?: number;
      strokeWidth?: number;
    } = {},
  ) {
    super({
      color: options.color ?? undefined,
      name: options.name,
    });
    this.fillColor = options.fillColor
      ? (ManimColor.parse(options.fillColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.fillOpacity = options.fillOpacity ?? 0.0;
    this.strokeColor = options.strokeColor
      ? (ManimColor.parse(options.strokeColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.strokeOpacity = options.strokeOpacity ?? 1.0;
    this.strokeWidth = options.strokeWidth ?? 4;
  }
}

// VGroup stub
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once converted
class VGroup extends VMobject {
  constructor(...vmobjects: Mobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

// Dot stub
// TODO: Replace with import from ../../geometry/ once converted
class Dot extends VMobject {
  constructor(
    options: {
      radius?: number;
      strokeWidth?: number;
      fillOpacity?: number;
      color?: ParsableManimColor | null;
      point?: Point3D;
    } = {},
  ) {
    super({
      fillOpacity: options.fillOpacity ?? 1.0,
      strokeWidth: options.strokeWidth ?? 0,
      color: options.color,
    });
    if (options.point) {
      this.moveTo(options.point);
    }
  }
}

// SurroundingRectangle stub
// TODO: Replace with import from ../../geometry/shape_matchers once converted
class SurroundingRectangle extends VMobject {
  constructor(
    mobject: Mobject,
    options: {
      buff?: number;
      fillColor?: ParsableManimColor | null;
      fillOpacity?: number;
      strokeColor?: ParsableManimColor | null;
      strokeWidth?: number;
      cornerRadius?: number;
    } = {},
  ) {
    super({
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity ?? 1,
      strokeColor: options.strokeColor,
      strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    });
    const buff = options.buff ?? SMALL_BUFF;
    const center = mobject.getCenter();
    const w = mobject.getWidth() + 2 * buff;
    const h = mobject.getHeight() + 2 * buff;
    const cArr = center.toArray() as number[];
    const cx = cArr[0];
    const cy = cArr[1];
    const cz = cArr[2];
    // Store 4 corner points as a rectangle
    this.points = np.array([
      [cx - w / 2, cy - h / 2, cz],
      [cx + w / 2, cy - h / 2, cz],
      [cx + w / 2, cy + h / 2, cz],
      [cx - w / 2, cy + h / 2, cz],
    ]);
  }
}

// ─── highlight.js style → color map ─────────────────────────

/**
 * Mapping from highlight.js themes to approximate CSS-based color schemes.
 * highlight.js uses CSS classes, not inline styles like pygments.
 * We provide a few built-in theme mappings; users can pass "vim", "emacs", etc.
 */
const HLJS_THEME_COLORS: Record<string, Record<string, string>> = {
  vim: {
    keyword: "#d7875f",
    string: "#87af5f",
    comment: "#585858",
    number: "#d7af5f",
    title: "#87afff",
    "title.function": "#87afff",
    "title.class": "#87afff",
    built_in: "#d7af5f",
    type: "#87afff",
    params: "#d7d7d7",
    literal: "#d7875f",
    attr: "#d7875f",
    symbol: "#87af5f",
    meta: "#d7875f",
    default: "#d7d7d7",
  },
  emacs: {
    keyword: "#a020f0",
    string: "#8b2252",
    comment: "#b22222",
    number: "#008b8b",
    title: "#0000ff",
    "title.function": "#0000ff",
    "title.class": "#0000ff",
    built_in: "#008b8b",
    type: "#228b22",
    params: "#000000",
    literal: "#008b8b",
    attr: "#8b2252",
    symbol: "#a020f0",
    meta: "#8b2252",
    default: "#000000",
  },
  monokai: {
    keyword: "#f92672",
    string: "#e6db74",
    comment: "#75715e",
    number: "#ae81ff",
    title: "#a6e22e",
    "title.function": "#a6e22e",
    "title.class": "#a6e22e",
    built_in: "#66d9ef",
    type: "#66d9ef",
    params: "#f8f8f2",
    literal: "#ae81ff",
    attr: "#a6e22e",
    symbol: "#ae81ff",
    meta: "#f92672",
    default: "#f8f8f2",
  },
  default: {
    keyword: "#333",
    string: "#d14",
    comment: "#998",
    number: "#099",
    title: "#900",
    "title.function": "#900",
    "title.class": "#445588",
    built_in: "#0086b3",
    type: "#458",
    params: "#333",
    literal: "#099",
    attr: "#008080",
    symbol: "#990073",
    meta: "#999",
    default: "#333",
  },
};

// ─── Helper: extract color ranges from highlighted HTML ─────

interface ColorRange {
  start: number;
  end: number;
  color: string | null;
}

/**
 * Highlights code using highlight.js and extracts per-character color ranges.
 * Returns an array of color ranges per line plus the code lines.
 */
function extractColorRanges(
  code: string,
  language: string | null,
  formatterStyle: string,
): { colorRanges: ColorRange[][]; codeLines: string[] } {
  // Highlight the code
  let result: ReturnType<typeof hljs.highlight>;
  if (language) {
    try {
      result = hljs.highlight(code, { language });
    } catch {
      // If the language is not recognized, try auto-detection
      result = hljs.highlightAuto(code);
    }
  } else {
    result = hljs.highlightAuto(code);
  }

  // Parse the highlighted HTML
  const html = `<pre>${result.value}</pre>`;
  const $ = load(html, { xml: false });
  const pre = $("pre");

  // Get the theme color map
  const themeColors =
    HLJS_THEME_COLORS[formatterStyle] ??
    HLJS_THEME_COLORS["vim"] ??
    {};

  // Walk through children extracting color ranges
  const colorRanges: ColorRange[][] = [];
  let currentLineRanges: ColorRange[] = [];
  let currentLineCharIndex = 0;

  function resolveColor(classNames: string): string | null {
    if (!classNames) return null;
    // hljs classes are like "hljs-keyword", "hljs-string", etc.
    for (const cls of classNames.split(/\s+/)) {
      const key = cls.replace(/^hljs-/, "");
      if (key in themeColors) {
        return themeColors[key];
      }
    }
    return null;
  }

  function processNode(node: unknown): void {
    const children = $(node as never).contents();
    children.each((_i: number, child: unknown) => {
      const el = child as { type: string; name?: string };
      if (el.type === "text") {
        const text = $(child as never).text();
        for (const char of text) {
          if (char === "\n") {
            colorRanges.push(currentLineRanges);
            currentLineRanges = [];
            currentLineCharIndex = 0;
          } else {
            currentLineCharIndex++;
          }
        }
      } else if (el.type === "tag" && el.name === "span") {
        const className = $(child as never).attr("class") ?? "";
        const color = resolveColor(className);
        const text = $(child as never).text();

        // Process the text content, handling newlines within spans
        let segmentStart = currentLineCharIndex;
        for (const char of text) {
          if (char === "\n") {
            if (currentLineCharIndex > segmentStart) {
              currentLineRanges.push({
                start: segmentStart,
                end: currentLineCharIndex,
                color,
              });
            }
            colorRanges.push(currentLineRanges);
            currentLineRanges = [];
            currentLineCharIndex = 0;
            segmentStart = 0;
          } else {
            currentLineCharIndex++;
          }
        }
        if (currentLineCharIndex > segmentStart) {
          currentLineRanges.push({
            start: segmentStart,
            end: currentLineCharIndex,
            color,
          });
        }
      }
    });
  }

  processNode(pre.get(0));
  // Push the last line
  colorRanges.push(currentLineRanges);

  // Split code into lines
  const codeLines = code.split("\n");
  // Remove trailing empty line if code ended with newline
  if (codeLines.length > 0 && codeLines[codeLines.length - 1] === "") {
    codeLines.pop();
  }

  return { colorRanges, codeLines };
}

// ─── Code Options ───────────────────────────────────────────

export interface CodeOptions {
  codeFile?: string;
  codeString?: string;
  language?: string | null;
  formatterStyle?: string;
  tabWidth?: number;
  addLineNumbers?: boolean;
  lineNumbersFrom?: number;
  background?: "rectangle" | "window";
  backgroundConfig?: Partial<BackgroundConfig>;
  paragraphConfig?: Partial<CodeParagraphConfig>;
}

export interface BackgroundConfig {
  buff: number;
  fillColor: ParsableManimColor;
  strokeColor: ParsableManimColor;
  cornerRadius: number;
  strokeWidth: number;
  fillOpacity: number;
}

export interface CodeParagraphConfig {
  font: string;
  fontSize: number;
  lineSpacing: number;
  disableLigatures: boolean;
}

// ─── Code ───────────────────────────────────────────────────

/**
 * A highlighted source code listing.
 *
 * Uses highlight.js for syntax highlighting (replaces Python pygments)
 * and cheerio for HTML parsing (replaces Python beautifulsoup4).
 *
 * @example
 * ```typescript
 * const listing = new Code({
 *   codeFile: "hello.ts",
 *   tabWidth: 4,
 *   formatterStyle: "vim",
 *   background: "window",
 *   language: "typescript",
 * });
 * ```
 */
export class Code extends VMobject {
  private static _stylesListCache: string[] | null = null;

  static defaultBackgroundConfig: BackgroundConfig = {
    buff: 0.3,
    fillColor: ManimColor.parse("#222222") as ManimColor,
    strokeColor: WHITE,
    cornerRadius: 0.2,
    strokeWidth: 1,
    fillOpacity: 1,
  };

  static defaultParagraphConfig: CodeParagraphConfig = {
    font: "Monospace",
    fontSize: 24,
    lineSpacing: 0.5,
    disableLigatures: true,
  };

  codeLines: Paragraph;
  lineNumbers?: Paragraph;
  background: VMobject;

  constructor(options: CodeOptions = {}) {
    super();

    const {
      codeFile,
      language = null,
      formatterStyle = "vim",
      tabWidth = 4,
      addLineNumbers = true,
      lineNumbersFrom = 1,
      background = "rectangle",
      backgroundConfig,
      paragraphConfig,
    } = options;
    let { codeString } = options;

    // Determine the code string and language
    let effectiveLanguage = language;

    if (codeFile != null) {
      // Read the file
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      codeString = fs.readFileSync(codeFile, "utf-8") as string;

      // Guess language from file extension if not provided
      if (effectiveLanguage == null) {
        const ext = codeFile.split(".").pop() ?? "";
        // Try to use the extension directly as a language name
        try {
          hljs.highlight("", { language: ext });
          effectiveLanguage = ext;
        } catch {
          // Auto-detect will be used
        }
      }
    } else if (codeString == null) {
      throw new Error("Either a code file or a code string must be specified.");
    }

    // Expand tabs
    codeString = codeString!.replace(
      /\t/g,
      " ".repeat(tabWidth),
    );

    // Extract color ranges using highlight.js
    const { colorRanges, codeLines: codeLineStrings } = extractColorRanges(
      codeString,
      effectiveLanguage,
      formatterStyle,
    );

    // Build paragraph config
    const baseParagraphConfig: Record<string, unknown> = {
      ...Code.defaultParagraphConfig,
      ...paragraphConfig,
    };

    // Create code lines paragraph
    this.codeLines = new Paragraph(
      ...codeLineStrings,
      baseParagraphConfig as ParagraphOptions,
    );

    // Apply syntax highlighting colors to each line
    const lineSubmobjects = this.codeLines.submobjects;
    for (
      let lineIdx = 0;
      lineIdx < lineSubmobjects.length && lineIdx < colorRanges.length;
      lineIdx++
    ) {
      const line = lineSubmobjects[lineIdx];
      const ranges = colorRanges[lineIdx];
      for (const { start, end, color } of ranges) {
        if (color == null) continue;
        // Apply color to the character range in this line
        const chars = line.submobjects.slice(start, end);
        for (const ch of chars) {
          ch.setColor(color);
        }
      }
    }

    // Add line numbers if requested
    if (addLineNumbers) {
      const lineNumConfig: Record<string, unknown> = {
        ...baseParagraphConfig,
        alignment: "right",
      };
      const lineNumberStrings = Array.from(
        { length: codeLineStrings.length },
        (_, i) => String(lineNumbersFrom + i),
      );
      this.lineNumbers = new Paragraph(
        ...lineNumberStrings,
        lineNumConfig as ParagraphOptions,
      );
      this.lineNumbers.nextTo(this.codeLines, LEFT).alignTo(this.codeLines, UP);
      this.add(this.lineNumbers);
    }

    // Filter out Dot placeholders from code lines (invisible space markers)
    for (const line of this.codeLines.submobjects) {
      line.submobjects = line.submobjects.filter((c) => !(c instanceof Dot));
    }
    this.add(this.codeLines);

    // Build background config
    const bgConfig: BackgroundConfig = {
      ...Code.defaultBackgroundConfig,
      ...backgroundConfig,
    };

    if (background === "rectangle") {
      this.background = new SurroundingRectangle(this, {
        buff: bgConfig.buff,
        fillColor: bgConfig.fillColor,
        fillOpacity: bgConfig.fillOpacity,
        strokeColor: bgConfig.strokeColor,
        strokeWidth: bgConfig.strokeWidth,
        cornerRadius: bgConfig.cornerRadius,
      });
    } else if (background === "window") {
      const buttons = new VGroup(
        new Dot({ radius: 0.1, strokeWidth: 0, color: "#ff5f56" }),
        new Dot({ radius: 0.1, strokeWidth: 0, color: "#ffbd2e" }),
        new Dot({ radius: 0.1, strokeWidth: 0, color: "#27c93f" }),
      );
      buttons.arrange(RIGHT, 0.1);
      buttons.nextTo(this, UP, { buff: 0.1 });
      buttons.alignTo(this, LEFT);
      buttons.shift(LEFT.multiply(0.1) as Point3D);

      this.background = new SurroundingRectangle(
        new VGroup(this, buttons),
        {
          buff: bgConfig.buff,
          fillColor: bgConfig.fillColor,
          fillOpacity: bgConfig.fillOpacity,
          strokeColor: bgConfig.strokeColor,
          strokeWidth: bgConfig.strokeWidth,
          cornerRadius: bgConfig.cornerRadius,
        },
      );
      buttons.shift(
        UP.multiply(0.1).add(LEFT.multiply(0.1)) as Point3D,
      );
      this.background.add(buttons);
    } else {
      throw new Error(`Unknown background type: ${background}`);
    }

    this.addToBack(this.background);
  }

  /**
   * Get the list of all available formatter styles.
   *
   * Returns the available highlight.js theme names that have
   * color mappings defined.
   */
  static getStylesList(): string[] {
    if (Code._stylesListCache == null) {
      Code._stylesListCache = Object.keys(HLJS_THEME_COLORS);
    }
    return Code._stylesListCache;
  }
}
