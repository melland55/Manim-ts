/**
 * Mobjects used for displaying (non-LaTeX) text.
 *
 * TypeScript port of manim/mobject/text/text_mobject.py
 *
 * In Python Manim, text rendering is handled by manimpango (Pango bindings).
 * In this TypeScript port, text-to-SVG conversion requires a rendering backend.
 * The text settings/parsing logic is fully ported; the actual SVG generation
 * is stubbed and marked with TODO for a proper text rendering backend.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { createHash } from "crypto";

import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  ORIGIN,
  DOWN,
  RIGHT,
  LEFT,
  DEFAULT_FONT_SIZE,
  NORMAL,
  START_X,
  START_Y,
  SCALE_FACTOR_PER_FONT_POINT,
} from "../../../constants/constants.js";
import { config, logger } from "../../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
  colorGradient,
} from "../../../utils/color/core.js";
import { Mobject } from "../../mobject/index.js";
import {
  SVGMobject,
  type SVGMobjectOptions,
} from "../../svg/svg_mobject.js";

// ─── Constants ──────────────────────────────────────────────

export const TEXT_MOB_SCALE_FACTOR = 0.05;
export const DEFAULT_LINE_SPACING_SCALE = 0.3;
export const TEXT2SVG_ADJUSTMENT_FACTOR = 4.8;

import { VMobject, VGroup } from "../../types/index.js";
import { Dot } from "../../geometry/arc/index.js";

// ─── TextSetting ────────────────────────────────────────────
// Replaces manimpango.TextSetting

export class TextSetting {
  start: number;
  end: number;
  font: string;
  slant: string;
  weight: string;
  color: string;
  lineNum: number;

  constructor(
    start: number,
    end: number,
    options: {
      font?: string;
      slant?: string;
      weight?: string;
      color?: string;
    } = {},
  ) {
    this.start = start;
    this.end = end;
    this.font = options.font ?? "";
    this.slant = options.slant ?? NORMAL;
    this.weight = options.weight ?? NORMAL;
    this.color = options.color ?? "";
    this.lineNum = -1;
  }

  copy(): TextSetting {
    const c = new TextSetting(this.start, this.end, {
      font: this.font,
      slant: this.slant,
      weight: this.weight,
      color: this.color,
    });
    c.lineNum = this.lineNum;
    return c;
  }
}

// ─── PangoUtils stub ────────────────────────────────────────

class PangoUtils {
  /**
   * Remove trailing "M" command from SVG path data in a file.
   * In Python Manim this is handled by manimpango.PangoUtils.remove_last_M.
   */
  static removeLastM(fileName: string): void {
    // TODO: Port from manimpango — needs proper SVG path cleanup
    try {
      if (!existsSync(fileName)) return;
      let content = readFileSync(fileName, "utf-8");
      // Remove trailing M commands from path d attributes
      content = content.replace(/\s*M\s*"/, '"');
      writeFileSync(fileName, content, "utf-8");
    } catch {
      // Silently ignore if file operations fail
    }
  }
}

// ─── SVG generation helpers ─────────────────────────────────

function getTextDir(): string {
  // TODO: Use config.getDir("text_dir") once available
  const mediaDir =
    (config as unknown as Record<string, unknown>)["mediaDir"] ?? "./media";
  const textDir = join(String(mediaDir), "texts");
  if (!existsSync(textDir)) {
    mkdirSync(textDir, { recursive: true });
  }
  return textDir;
}

/**
 * Generate a minimal SVG file containing path data for text.
 *
 * TODO: Port from manimpango — needs a proper text rendering backend
 * (e.g., HarfBuzz/FreeType bindings or canvas-based glyph extraction)
 * to produce actual glyph outlines. Currently generates a placeholder
 * SVG with simple rectangular paths for each character.
 */
function textToSvgFile(
  text: string,
  settings: TextSetting[],
  fontSize: number,
  lineSpacing: number,
  disableLigatures: boolean,
  filePath: string,
  startX: number,
  startY: number,
  width: number,
  height: number,
): string {
  const size = fontSize / TEXT2SVG_ADJUSTMENT_FACTOR;
  const spacing = lineSpacing / TEXT2SVG_ADJUSTMENT_FACTOR;

  // Generate placeholder SVG paths for each character
  const paths: string[] = [];
  let curX = startX;
  let curY = startY;
  const charWidth = size * 0.6;
  const charHeight = size;

  for (const setting of settings) {
    for (let i = setting.start; i < setting.end; i++) {
      const ch = text[i];
      if (ch === "\n") {
        curX = startX;
        curY += spacing;
        continue;
      }
      if (ch === " ") {
        curX += charWidth * 0.5;
        continue;
      }

      // Generate a simple rectangular path for the character
      const x = curX;
      const y = curY;
      const fill = setting.color || "#FFFFFF";
      paths.push(
        `<path d="M ${x} ${y} L ${x + charWidth} ${y} L ${x + charWidth} ${y + charHeight} L ${x} ${y + charHeight} Z" fill="${fill}" stroke="none"/>`,
      );
      curX += charWidth;
    }
  }

  const svgContent = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...paths,
    "</svg>",
  ].join("\n");

  writeFileSync(filePath, svgContent, "utf-8");
  return resolve(filePath);
}

/**
 * Generate a minimal SVG file for markup text.
 *
 * TODO: Port from manimpango — needs proper Pango markup rendering.
 */
function markupTextToSvgFile(
  text: string,
  font: string,
  slant: string,
  weight: string,
  fontSize: number,
  lineSpacing: number,
  disableLigatures: boolean,
  filePath: string,
  startX: number,
  startY: number,
  width: number,
  height: number,
  options: { justify?: boolean; pangoWidth?: number } = {},
): string {
  // Strip markup tags for placeholder generation
  const plainText = text.replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, "x");
  const size = fontSize / TEXT2SVG_ADJUSTMENT_FACTOR;
  const spacing = lineSpacing / TEXT2SVG_ADJUSTMENT_FACTOR;

  const paths: string[] = [];
  let curX = startX;
  let curY = startY;
  const charWidth = size * 0.6;
  const charHeight = size;

  for (const ch of plainText) {
    if (ch === "\n") {
      curX = startX;
      curY += spacing;
      continue;
    }
    if (ch === " " || ch === "\t") {
      curX += charWidth * 0.5;
      continue;
    }

    paths.push(
      `<path d="M ${curX} ${curY} L ${curX + charWidth} ${curY} L ${curX + charWidth} ${curY + charHeight} L ${curX} ${curY + charHeight} Z" fill="#FFFFFF" stroke="none"/>`,
    );
    curX += charWidth;
  }

  const svgContent = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ...paths,
    "</svg>",
  ].join("\n");

  writeFileSync(filePath, svgContent, "utf-8");
  return resolve(filePath);
}

// ─── remove_invisible_chars ─────────────────────────────────

export function removeInvisibleChars(mobject: VMobject): VGroup {
  const mobjectWithoutDots = new VGroup();
  const firstChild = mobject.submobjects[0];
  if (firstChild instanceof VGroup) {
    for (const submob of mobject.submobjects) {
      mobjectWithoutDots.add(
        new VGroup(
          ...(submob.submobjects.filter(
            (k) => !(k instanceof Dot),
          ) as VMobject[]),
        ),
      );
    }
  } else {
    mobjectWithoutDots.add(
      ...(mobject.submobjects.filter(
        (k) => !(k instanceof Dot),
      ) as VMobject[]),
    );
  }
  return mobjectWithoutDots;
}

// ─── Text Options ───────────────────────────────────────────

export interface TextOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  color?: ParsableManimColor | null;
  fontSize?: number;
  lineSpacing?: number;
  font?: string;
  slant?: string;
  weight?: string;
  t2c?: Record<string, string>;
  t2f?: Record<string, string>;
  t2g?: Record<string, ParsableManimColor[]>;
  t2s?: Record<string, string>;
  t2w?: Record<string, string>;
  text2color?: Record<string, string>;
  text2font?: Record<string, string>;
  text2gradient?: Record<string, ParsableManimColor[]>;
  text2slant?: Record<string, string>;
  text2weight?: Record<string, string>;
  gradient?: ParsableManimColor[] | null;
  tabWidth?: number;
  warnMissingFont?: boolean;
  height?: number | null;
  width?: number | null;
  shouldCenter?: boolean;
  disableLigatures?: boolean;
  useSvgCache?: boolean;
}

// ─── Text ───────────────────────────────────────────────────

export class Text extends SVGMobject {
  originalText: string;
  declare text: string;
  font: string;
  _fontSize: number;
  slant: string;
  weight: string;
  gradient: ParsableManimColor[] | null;
  tabWidth: number;
  t2c: Record<string, string>;
  t2f: Record<string, string>;
  t2g: Record<string, ParsableManimColor[]>;
  t2s: Record<string, string>;
  t2w: Record<string, string>;
  lineSpacing: number;
  disableLigatures: boolean;
  chars: VGroup;
  initialHeight: number;

  // TODO: Port from manimpango — needs proper font listing backend
  static fontList(): string[] {
    return [];
  }

  constructor(text: string, options: TextOptions = {}) {
    // Pre-process all options before super() call
    const fillOpacity = options.fillOpacity ?? 1.0;
    const strokeWidth = options.strokeWidth ?? 0;
    const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    let lineSpacing = options.lineSpacing ?? -1;
    let font = options.font ?? "";
    const slant = options.slant ?? NORMAL;
    const weight = options.weight ?? NORMAL;
    const tabWidth = options.tabWidth ?? 4;
    const disableLigatures = options.disableLigatures ?? false;
    const useSvgCache = options.useSvgCache ?? false;
    const shouldCenter = options.shouldCenter ?? true;
    const svgHeight = options.height !== undefined ? options.height : null;
    const svgWidth = options.width !== undefined ? options.width : null;
    const gradient = options.gradient ?? null;

    // Font validation
    if (font && (options.warnMissingFont ?? true)) {
      const fontsList = Text.fontList();
      if (font.toLowerCase() === "sans-serif") {
        font = "sans";
      }
      if (fontsList.length > 0 && !fontsList.includes(font)) {
        if (fontsList.includes(font.charAt(0).toUpperCase() + font.slice(1))) {
          font = font.charAt(0).toUpperCase() + font.slice(1);
        } else if (fontsList.includes(font.toLowerCase())) {
          font = font.toLowerCase();
        } else {
          logger.warning(`Font ${font} not in available fonts.`);
        }
      }
    }

    // Process t2x mappings (long form takes precedence)
    let t2c = options.text2color ?? options.t2c ?? {};
    let t2f = options.text2font ?? options.t2f ?? {};
    let t2g = options.text2gradient ?? options.t2g ?? {};
    let t2s = options.text2slant ?? options.t2s ?? {};
    let t2w = options.text2weight ?? options.t2w ?? {};

    // Convert t2c values to hex
    const t2cHex: Record<string, string> = {};
    for (const [k, v] of Object.entries(t2c)) {
      t2cHex[k] = (ManimColor.parse(v) as ManimColor).toHex();
    }

    // Process text
    let textWithoutTabs = text;
    if (text.includes("\t")) {
      textWithoutTabs = text.replace(/\t/g, " ".repeat(tabWidth));
    }

    // Compute line spacing
    if (lineSpacing === -1) {
      lineSpacing = fontSize + fontSize * DEFAULT_LINE_SPACING_SCALE;
    } else {
      lineSpacing = fontSize + fontSize * lineSpacing;
    }

    // Determine color
    const parsedColor = options.color
      ? (ManimColor.parse(options.color) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    const colorHex = parsedColor.toHex();

    // Generate SVG file
    const svgFilePath = Text._text2svg(
      textWithoutTabs,
      {
        font,
        slant,
        weight,
        fontSize,
        lineSpacing,
        disableLigatures,
        t2c: t2cHex,
        t2f,
        t2g,
        t2s,
        t2w,
        gradient,
      },
      colorHex,
    );

    PangoUtils.removeLastM(svgFilePath);

    super({
      fileName: svgFilePath,
      fillOpacity,
      strokeWidth,
      height: svgHeight,
      width: svgWidth,
      shouldCenter,
      useSvgCache,
    });

    // Set instance properties
    this.originalText = text;
    this.text = text;
    this.font = font;
    this._fontSize = fontSize;
    this.slant = slant;
    this.weight = weight;
    this.gradient = gradient;
    this.tabWidth = tabWidth;
    this.t2c = t2cHex;
    this.t2f = t2f;
    this.t2g = t2g;
    this.t2s = t2s;
    this.t2w = t2w;
    this.lineSpacing = lineSpacing;
    this.disableLigatures = disableLigatures;

    // Generate character submobjects for ligature-disabled mode
    if (this.disableLigatures) {
      this.submobjects = [...this._genChars(textWithoutTabs).submobjects];
    }
    this.chars = new VGroup(...(this.submobjects as VMobject[]));

    // Strip spaces and newlines from text for indexing
    this.text = textWithoutTabs.replace(/ /g, "").replace(/\n/g, "");

    // Close glyph curves
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // In Python Manim, this post-processes SVG paths to close glyph outlines.
    // The logic depends on nPointsPerCurve (4 for Cairo, 3 for OpenGL).
    const nppc = (this as unknown as { nPointsPerCurve: number })
      .nPointsPerCurve ?? 4;
    for (const each of this.submobjects) {
      const mob = each as unknown as { points: import("numpy-ts").NDArray; dim: number };
      if (mob.points.shape[0] === 0) continue;

      const points = mob.points;
      const numPoints = points.shape[0];
      let curveStart = points.get([0]) as unknown as number[];

      const closedCurvePoints: number[][] = [];

      const addLineTo = (end: number[]) => {
        const start = closedCurvePoints[closedCurvePoints.length - 1];
        if (nppc === 3) {
          // OpenGL: quadratic bezier
          closedCurvePoints.push(
            start,
            start.map((v, d) => (v + end[d]) / 2),
            end,
          );
        } else {
          // Cairo: cubic bezier
          closedCurvePoints.push(
            start,
            start.map((v, d) => (2 * v + end[d]) / 3),
            start.map((v, d) => (v + 2 * end[d]) / 3),
            end,
          );
        }
      };

      for (let index = 0; index < numPoints; index++) {
        const point = (points.get([index]) as unknown as import("numpy-ts").NDArray).toArray() as number[];
        closedCurvePoints.push(point);
        if (
          index !== numPoints - 1 &&
          (index + 1) % nppc === 0
        ) {
          const nextPoint = (points.get([index + 1]) as unknown as import("numpy-ts").NDArray).toArray() as number[];
          const differs = point.some((v, d) => v !== nextPoint[d]);
          if (differs) {
            addLineTo(curveStart);
            curveStart = nextPoint;
          }
        }
      }
      // Close last curve
      addLineTo(curveStart);
      mob.points = np.array(closedCurvePoints);
    }

    // Scale for anti-aliasing
    if (svgHeight == null && svgWidth == null) {
      this.scale(TEXT_MOB_SCALE_FACTOR);
    }
    this.initialHeight = this.height;
  }

  toString(): string {
    return `Text(${JSON.stringify(this.originalText)})`;
  }

  get fontSize(): number {
    return (
      (this.height / this.initialHeight / TEXT_MOB_SCALE_FACTOR) *
      2.4 *
      (this._fontSize / DEFAULT_FONT_SIZE)
    );
  }

  set fontSize(fontVal: number) {
    if (fontVal <= 0) {
      throw new Error("font_size must be greater than 0.");
    }
    this.scale(fontVal / this.fontSize);
  }

  private _genChars(textContent: string): VGroup {
    const chars = new VGroup();
    let submobjectsCharIndex = 0;
    for (let charIndex = 0; charIndex < textContent.length; charIndex++) {
      if (/\s/.test(textContent[charIndex])) {
        const space = new Dot({
          radius: 0,
          fillOpacity: 0,
          strokeOpacity: 0,
        });
        if (charIndex === 0) {
          if (this.submobjects[submobjectsCharIndex]) {
            space.moveTo(this.submobjects[submobjectsCharIndex].getCenter());
          }
        } else if (this.submobjects[submobjectsCharIndex - 1]) {
          space.moveTo(
            this.submobjects[submobjectsCharIndex - 1].getCenter(),
          );
        }
        chars.add(space);
      } else {
        if (this.submobjects[submobjectsCharIndex]) {
          chars.add(this.submobjects[submobjectsCharIndex] as VMobject);
        }
        submobjectsCharIndex++;
      }
    }
    return chars;
  }

  _findIndexes(word: string, text: string): Array<[number, number]> {
    const temp = word.match(/^\[([0-9-]*):([0-9-]*)\]$/);
    if (temp) {
      let start = temp[1] !== "" ? parseInt(temp[1], 10) : 0;
      let end = temp[2] !== "" ? parseInt(temp[2], 10) : text.length;
      start = start < 0 ? text.length + start : start;
      end = end < 0 ? text.length + end : end;
      return [[start, end]];
    }
    const indexes: Array<[number, number]> = [];
    let index = text.indexOf(word);
    while (index !== -1) {
      indexes.push([index, index + word.length]);
      index = text.indexOf(word, index + word.length);
    }
    return indexes;
  }

  _text2hash(
    text: string,
    settings: {
      font: string;
      slant: string;
      weight: string;
      t2c: Record<string, string>;
      t2f: Record<string, string>;
      t2s: Record<string, string>;
      t2w: Record<string, string>;
      lineSpacing: number;
      fontSize: number;
      disableLigatures: boolean;
      gradient: ParsableManimColor[] | null;
    },
    color: string,
  ): string {
    let settingsStr =
      "PANGO" + settings.font + settings.slant + settings.weight + color;
    settingsStr += JSON.stringify(settings.t2f);
    settingsStr += JSON.stringify(settings.t2s);
    settingsStr += JSON.stringify(settings.t2w);
    settingsStr += JSON.stringify(settings.t2c);
    settingsStr += String(settings.lineSpacing) + String(settings.fontSize);
    settingsStr += String(settings.disableLigatures);
    settingsStr += JSON.stringify(settings.gradient);
    const idStr = text + settingsStr;
    const hasher = createHash("sha256");
    hasher.update(idStr);
    return hasher.digest("hex").slice(0, 16);
  }

  _mergeSettings(
    leftSetting: TextSetting,
    rightSetting: TextSetting,
    defaultArgs: Record<string, string>,
  ): TextSetting {
    const contained = rightSetting.end < leftSetting.end;
    const newSetting = contained
      ? leftSetting.copy()
      : rightSetting.copy();

    newSetting.start = contained ? rightSetting.end : leftSetting.end;
    leftSetting.end = rightSetting.start;
    if (!contained) {
      rightSetting.end = newSetting.start;
    }

    for (const arg of Object.keys(defaultArgs)) {
      const left = (leftSetting as unknown as Record<string, string>)[arg];
      const right = (rightSetting as unknown as Record<string, string>)[arg];
      const defaultVal = defaultArgs[arg];
      if (left !== defaultVal && right !== defaultVal) {
        throw new Error(
          `Ambiguous style for text '${this.text.slice(rightSetting.start, rightSetting.end)}':` +
            `'${arg}' cannot be both '${left}' and '${right}'.`,
        );
      }
      (rightSetting as unknown as Record<string, string>)[arg] =
        left !== defaultVal ? left : right;
    }
    return newSetting;
  }

  _getSettingsFromT2xs(
    t2xs: Array<[Record<string, string>, string]>,
    defaultArgs: Record<string, string>,
  ): TextSetting[] {
    const settings: TextSetting[] = [];
    const t2xwords = new Set<string>();
    for (const [t2x] of t2xs) {
      for (const key of Object.keys(t2x)) {
        t2xwords.add(key);
      }
    }

    for (const word of t2xwords) {
      const settingArgs: Record<string, string> = {};
      for (const [t2x, arg] of t2xs) {
        settingArgs[arg] =
          word in t2x ? String(t2x[word]) : defaultArgs[arg];
      }

      for (const [start, end] of this._findIndexes(word, this.text)) {
        settings.push(
          new TextSetting(start, end, settingArgs),
        );
      }
    }
    return settings;
  }

  _getSettingsFromGradient(
    defaultArgs: Record<string, string>,
  ): TextSetting[] {
    const settings: TextSetting[] = [];
    const args = { ...defaultArgs };

    if (this.gradient) {
      const colors = colorGradient(this.gradient, this.text.length) as ManimColor[];
      for (let i = 0; i < this.text.length; i++) {
        const settingArgs = { ...args, color: colors[i].toHex() };
        settings.push(new TextSetting(i, i + 1, settingArgs));
      }
    }

    for (const [word, gradient] of Object.entries(this.t2g)) {
      const colors = colorGradient(gradient, word.length) as ManimColor[];
      for (const [start, end] of this._findIndexes(word, this.text)) {
        for (let i = start; i < end; i++) {
          const settingArgs = {
            ...args,
            color: colors[i - start].toHex(),
          };
          settings.push(new TextSetting(i, i + 1, settingArgs));
        }
      }
    }
    return settings;
  }

  _text2settings(color: string): TextSetting[] {
    const t2xs: Array<[Record<string, string>, string]> = [
      [this.t2f, "font"],
      [this.t2s, "slant"],
      [this.t2w, "weight"],
      [this.t2c, "color"],
    ];

    const defaultArgs: Record<string, string> = {};
    for (const [, arg] of t2xs) {
      defaultArgs[arg] = arg !== "color"
        ? (this as unknown as Record<string, string>)[arg]
        : color;
    }

    let settings = this._getSettingsFromT2xs(t2xs, defaultArgs);
    settings.push(...this._getSettingsFromGradient(defaultArgs));

    // Handle overlaps
    settings.sort((a, b) => a.start - b.start);
    for (let index = 0; index < settings.length; index++) {
      if (index + 1 === settings.length) break;

      const setting = settings[index];
      const nextSetting = settings[index + 1];
      if (setting.end > nextSetting.start) {
        const newSetting = this._mergeSettings(
          setting,
          nextSetting,
          defaultArgs,
        );
        let newIndex = index + 1;
        while (
          newIndex < settings.length &&
          settings[newIndex].start < newSetting.start
        ) {
          newIndex++;
        }
        settings.splice(newIndex, 0, newSetting);
      }
    }

    // Fill gaps with default settings
    const tempSettings = [...settings];
    let start = 0;
    for (const setting of settings) {
      if (setting.start !== start) {
        tempSettings.push(new TextSetting(start, setting.start, defaultArgs));
      }
      start = setting.end;
    }
    if (start !== this.text.length) {
      tempSettings.push(
        new TextSetting(start, this.text.length, defaultArgs),
      );
    }
    settings = tempSettings.sort((a, b) => a.start - b.start);

    // Handle newlines
    let lineNum = 0;
    if (/\n/.test(this.text)) {
      for (const [forStart, forEnd] of this._findIndexes("\n", this.text)) {
        for (const setting of settings) {
          if (setting.lineNum === -1) {
            setting.lineNum = lineNum;
          }
          if (forStart < setting.end) {
            lineNum++;
            const newSetting = setting.copy();
            setting.end = forEnd;
            newSetting.start = forEnd;
            newSetting.lineNum = lineNum;
            settings.push(newSetting);
            settings.sort((a, b) => a.start - b.start);
            break;
          }
        }
      }
    }
    for (const setting of settings) {
      if (setting.lineNum === -1) {
        setting.lineNum = lineNum;
      }
    }

    return settings;
  }

  /**
   * Static method to generate SVG before super() call.
   */
  private static _text2svg(
    text: string,
    opts: {
      font: string;
      slant: string;
      weight: string;
      fontSize: number;
      lineSpacing: number;
      disableLigatures: boolean;
      t2c: Record<string, string>;
      t2f: Record<string, string>;
      t2g: Record<string, ParsableManimColor[]>;
      t2s: Record<string, string>;
      t2w: Record<string, string>;
      gradient: ParsableManimColor[] | null;
    },
    color: string,
  ): string {
    const size = opts.fontSize;
    const lineSpacing = opts.lineSpacing;

    const dirName = getTextDir();
    const hashName = Text.prototype._text2hash(text, opts, color);
    const filePath = join(dirName, hashName + ".svg");

    if (existsSync(filePath)) {
      return resolve(filePath);
    }

    // Generate text settings for rendering
    // Note: We create a temporary settings array for the default case
    const defaultSettings = [
      new TextSetting(0, text.length, {
        font: opts.font,
        slant: opts.slant,
        weight: opts.weight,
        color,
      }),
    ];

    const pixelWidth = (config as unknown as Record<string, unknown>)["pixelWidth"] ?? 1920;
    const pixelHeight = (config as unknown as Record<string, unknown>)["pixelHeight"] ?? 1080;

    return textToSvgFile(
      text,
      defaultSettings,
      size,
      lineSpacing,
      opts.disableLigatures,
      filePath,
      START_X ?? 0,
      START_Y ?? 0,
      Number(pixelWidth),
      Number(pixelHeight),
    );
  }

  initColors(propagateColors = true): this {
    // TODO: Port renderer-specific color initialization
    return this;
  }
}

// ─── MarkupText Options ─────────────────────────────────────

export interface MarkupTextOptions {
  fillOpacity?: number;
  strokeWidth?: number;
  color?: ParsableManimColor | null;
  fontSize?: number;
  lineSpacing?: number;
  font?: string;
  slant?: string;
  weight?: string;
  justify?: boolean;
  gradient?: ParsableManimColor[] | null;
  tabWidth?: number;
  height?: number | null;
  width?: number | null;
  shouldCenter?: boolean;
  disableLigatures?: boolean;
  warnMissingFont?: boolean;
}

// ─── MarkupText ─────────────────────────────────────────────

export class MarkupText extends SVGMobject {
  declare text: string;
  originalText: string;
  font: string;
  _fontSize: number;
  slant: string;
  weight: string;
  gradient: ParsableManimColor[] | null;
  tabWidth: number;
  justify: boolean;
  lineSpacing: number;
  disableLigatures: boolean;
  chars: VGroup;
  initialHeight: number;

  static fontList(): string[] {
    return Text.fontList();
  }

  constructor(text: string, options: MarkupTextOptions = {}) {
    const fillOpacity = options.fillOpacity ?? 1.0;
    const strokeWidth = options.strokeWidth ?? 0;
    const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
    let lineSpacing = options.lineSpacing ?? -1;
    let font = options.font ?? "";
    const slant = options.slant ?? NORMAL;
    const weight = options.weight ?? NORMAL;
    const justify = options.justify ?? false;
    const gradient = options.gradient ?? null;
    const tabWidth = options.tabWidth ?? 4;
    const disableLigatures = options.disableLigatures ?? false;
    const shouldCenter = options.shouldCenter ?? true;
    const svgHeight = options.height !== undefined ? options.height : null;
    const svgWidth = options.width !== undefined ? options.width : null;

    // Font validation
    if (font && (options.warnMissingFont ?? true)) {
      const fontsList = Text.fontList();
      if (font.toLowerCase() === "sans-serif") {
        font = "sans";
      }
      if (fontsList.length > 0 && !fontsList.includes(font)) {
        if (fontsList.includes(font.charAt(0).toUpperCase() + font.slice(1))) {
          font = font.charAt(0).toUpperCase() + font.slice(1);
        } else if (fontsList.includes(font.toLowerCase())) {
          font = font.toLowerCase();
        } else {
          logger.warning(`Font ${font} not in available fonts.`);
        }
      }
    }

    let textContent = text;
    let textWithoutTabs = text;
    if (text.includes("\t")) {
      textWithoutTabs = text.replace(/\t/g, " ".repeat(tabWidth));
    }

    // Compute line spacing
    if (lineSpacing === -1) {
      lineSpacing = fontSize + fontSize * DEFAULT_LINE_SPACING_SCALE;
    } else {
      lineSpacing = fontSize + fontSize * lineSpacing;
    }

    const parsedColor = options.color
      ? (ManimColor.parse(options.color) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);

    // Extract custom tags before generating SVG
    // Note: gradient/color tags are processed after SVG generation
    const colormap = MarkupText._extractColorTags(textContent);
    textContent = colormap.text;
    const gradientmap = MarkupText._extractGradientTags(textContent);
    textContent = gradientmap.text;

    // Generate SVG
    const svgFilePath = MarkupText._text2svgStatic(
      textContent,
      font,
      slant,
      weight,
      fontSize,
      lineSpacing,
      disableLigatures,
      parsedColor,
      { justify, pangoWidth: 500 },
    );

    PangoUtils.removeLastM(svgFilePath);

    super({
      fileName: svgFilePath,
      fillOpacity,
      strokeWidth,
      height: svgHeight,
      width: svgWidth,
      shouldCenter,
    });

    this.originalText = text;
    this.text = textContent;
    this.font = font;
    this._fontSize = fontSize;
    this.slant = slant;
    this.weight = weight;
    this.gradient = gradient;
    this.tabWidth = tabWidth;
    this.justify = justify;
    this.lineSpacing = lineSpacing;
    this.disableLigatures = disableLigatures;

    this.chars = new VGroup(...(this.submobjects as VMobject[]));
    this.text = textWithoutTabs.replace(/ /g, "").replace(/\n/g, "");

    // Close glyph curves (same logic as Text)
    const nppc = (this as unknown as { nPointsPerCurve: number })
      .nPointsPerCurve ?? 4;
    for (const each of this.submobjects) {
      const mob = each as unknown as { points: import("numpy-ts").NDArray; dim: number };
      if (mob.points.shape[0] === 0) continue;

      const points = mob.points;
      const numPoints = points.shape[0];
      let curveStart = (points.get([0]) as unknown as import("numpy-ts").NDArray).toArray() as number[];

      const closedCurvePoints: number[][] = [];

      const addLineTo = (end: number[]) => {
        const start = closedCurvePoints[closedCurvePoints.length - 1];
        if (nppc === 3) {
          closedCurvePoints.push(
            start,
            start.map((v, d) => (v + end[d]) / 2),
            end,
          );
        } else {
          closedCurvePoints.push(
            start,
            start.map((v, d) => (2 * v + end[d]) / 3),
            start.map((v, d) => (v + 2 * end[d]) / 3),
            end,
          );
        }
      };

      for (let index = 0; index < numPoints; index++) {
        const point = (points.get([index]) as unknown as import("numpy-ts").NDArray).toArray() as number[];
        closedCurvePoints.push(point);
        if (
          index !== numPoints - 1 &&
          (index + 1) % nppc === 0
        ) {
          const nextPoint = (points.get([index + 1]) as unknown as import("numpy-ts").NDArray).toArray() as number[];
          const differs = point.some((v, d) => v !== nextPoint[d]);
          if (differs) {
            addLineTo(curveStart);
            curveStart = nextPoint;
          }
        }
      }
      addLineTo(curveStart);
      mob.points = np.array(closedCurvePoints);
    }

    // Apply gradient and color maps
    if (this.gradient) {
      (this as unknown as VMobject).setColorByGradient(...this.gradient);
    }
    for (const col of colormap.entries) {
      const startIdx = col.start - col.startOffset;
      const endIdx = col.end - col.startOffset - col.endOffset;
      const slice = this.chars.submobjects.slice(startIdx, endIdx);
      for (const mob of slice) {
        mob.setColor(MarkupText._parseColor(col.color));
      }
    }
    for (const grad of gradientmap.entries) {
      const startIdx = grad.start - grad.startOffset;
      const endIdx = grad.end - grad.startOffset - grad.endOffset;
      const slice = this.chars.submobjects.slice(startIdx, endIdx);
      const fromColor = MarkupText._parseColor(grad.from);
      const toColor = MarkupText._parseColor(grad.to);
      if (slice.length > 0) {
        const gradColors = colorGradient([fromColor, toColor], slice.length) as ManimColor[];
        for (let i = 0; i < slice.length; i++) {
          slice[i].setColor(gradColors[i]);
        }
      }
    }

    // Anti-aliasing scale
    if (svgHeight == null && svgWidth == null) {
      this.scale(TEXT_MOB_SCALE_FACTOR);
    }
    this.initialHeight = this.height;
  }

  get fontSize(): number {
    return (
      (this.height / this.initialHeight / TEXT_MOB_SCALE_FACTOR) *
      2.4 *
      (this._fontSize / DEFAULT_FONT_SIZE)
    );
  }

  set fontSize(fontVal: number) {
    if (fontVal <= 0) {
      throw new Error("font_size must be greater than 0.");
    }
    this.scale(fontVal / this.fontSize);
  }

  _text2hash(color: ParsableManimColor): string {
    const parsedColor = ManimColor.parse(color) as ManimColor;
    let settings =
      "MARKUPPANGO" +
      this.font +
      this.slant +
      this.weight +
      parsedColor.toHex().toLowerCase();
    settings += String(this.lineSpacing) + String(this._fontSize);
    settings += String(this.disableLigatures);
    settings += String(this.justify);
    const idStr = this.text + settings;
    const hasher = createHash("sha256");
    hasher.update(idStr);
    return hasher.digest("hex").slice(0, 16);
  }

  private static _text2svgStatic(
    text: string,
    font: string,
    slant: string,
    weight: string,
    fontSize: number,
    lineSpacing: number,
    disableLigatures: boolean,
    color: ManimColor,
    options: { justify?: boolean; pangoWidth?: number } = {},
  ): string {
    const size = fontSize;
    const ls = lineSpacing;

    const dirName = getTextDir();

    // Hash for file name
    let settingsStr =
      "MARKUPPANGO" + font + slant + weight + color.toHex().toLowerCase();
    settingsStr += String(ls) + String(size);
    settingsStr += String(disableLigatures);
    settingsStr += String(options.justify ?? false);
    const idStr = text + settingsStr;
    const hasher = createHash("sha256");
    hasher.update(idStr);
    const hashName = hasher.digest("hex").slice(0, 16);

    const filePath = join(dirName, hashName + ".svg");
    if (existsSync(filePath)) {
      return resolve(filePath);
    }

    return markupTextToSvgFile(
      text,
      font,
      slant,
      weight,
      size,
      ls,
      disableLigatures,
      filePath,
      START_X ?? 0,
      START_Y ?? 0,
      600,
      400,
      options,
    );
  }

  _countRealChars(s: string): number {
    let count = 0;
    let level = 0;
    // Replace HTML entities with single char
    const processed = s.replace(/&[^;]+;/g, "x");
    for (const c of processed) {
      if (c === "<") {
        level++;
      }
      if (c === ">" && level > 0) {
        level--;
      } else if (c !== " " && c !== "\t" && level === 0) {
        count++;
      }
    }
    return count;
  }

  private static _extractGradientTags(text: string): {
    entries: Array<{
      start: number;
      end: number;
      from: string;
      to: string;
      startOffset: number;
      endOffset: number;
    }>;
    text: string;
  } {
    const regex =
      /<gradient\s+from="([^"]+)"\s+to="([^"]+)"(\s+offset="([^"]+)")?>(.+?)<\/gradient>/gs;
    const entries: Array<{
      start: number;
      end: number;
      from: string;
      to: string;
      startOffset: number;
      endOffset: number;
    }> = [];

    const instance = new MarkupTextHelper();
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = instance.countRealChars(text.slice(0, match.index));
      const end = start + instance.countRealChars(match[5]);
      const offsetStr = match[4];
      const offsets = offsetStr ? offsetStr.split(",") : ["0"];
      const startOffset = offsets[0] ? parseInt(offsets[0], 10) : 0;
      const endOffset =
        offsets.length === 2 && offsets[1]
          ? parseInt(offsets[1], 10)
          : 0;

      entries.push({
        start,
        end,
        from: match[1],
        to: match[2],
        startOffset,
        endOffset,
      });
    }

    const cleanedText = text.replace(
      /<gradient[^>]+>(.+?)<\/gradient>/gs,
      "$1",
    );
    return { entries, text: cleanedText };
  }

  static _parseColor(col: string): ManimColor {
    if (/^#[0-9a-f]{6}$/i.test(col)) {
      return ManimColor.parse(col) as ManimColor;
    }
    return ManimColor.parse(col) as ManimColor;
  }

  private static _extractColorTags(text: string): {
    entries: Array<{
      start: number;
      end: number;
      color: string;
      startOffset: number;
      endOffset: number;
    }>;
    text: string;
  } {
    const regex =
      /<color\s+col="([^"]+)"(\s+offset="([^"]+)")?>(.+?)<\/color>/gs;
    const entries: Array<{
      start: number;
      end: number;
      color: string;
      startOffset: number;
      endOffset: number;
    }> = [];

    if (regex.test(text)) {
      logger.warning(
        'Using <color> tags in MarkupText is deprecated. Please use <span foreground="..."> instead.',
      );
    }

    const instance = new MarkupTextHelper();
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = instance.countRealChars(text.slice(0, match.index));
      const end = start + instance.countRealChars(match[4]);
      const offsetStr = match[3];
      const offsets = offsetStr ? offsetStr.split(",") : ["0"];
      const startOffset = offsets[0] ? parseInt(offsets[0], 10) : 0;
      const endOffset =
        offsets.length === 2 && offsets[1]
          ? parseInt(offsets[1], 10)
          : 0;

      entries.push({
        start,
        end,
        color: match[1],
        startOffset,
        endOffset,
      });
    }

    const cleanedText = text.replace(
      /<color[^>]+>(.+?)<\/color>/gs,
      "$1",
    );
    return { entries, text: cleanedText };
  }

  toString(): string {
    return `MarkupText(${JSON.stringify(this.originalText)})`;
  }
}

// Helper class for MarkupText static methods that need _countRealChars
class MarkupTextHelper {
  countRealChars(s: string): number {
    let count = 0;
    let level = 0;
    const processed = s.replace(/&[^;]+;/g, "x");
    for (const c of processed) {
      if (c === "<") {
        level++;
      }
      if (c === ">" && level > 0) {
        level--;
      } else if (c !== " " && c !== "\t" && level === 0) {
        count++;
      }
    }
    return count;
  }
}

// ─── Paragraph Options ──────────────────────────────────────

export interface ParagraphOptions extends TextOptions {
  lineSpacing?: number;
  alignment?: string | null;
}

// ─── Paragraph ──────────────────────────────────────────────

export class Paragraph extends VGroup {
  declare lineSpacing: number;
  alignment: string | null;
  considerSpacesAsChars: boolean;
  linesText: Text;
  chars: VGroup;
  linesChars: Mobject[];
  linesAlignments: Array<string | null>;
  linesInitialPositions: Point3D[];

  constructor(...args: [...string[], ParagraphOptions] | string[]) {
    super();

    // Parse arguments: last arg may be options object
    let textLines: string[];
    let lineSpacing = -1;
    let alignment: string | null = null;
    let textOptions: TextOptions = {};

    const lastArg = args[args.length - 1];
    if (typeof lastArg === "object" && lastArg !== null && !Array.isArray(lastArg)) {
      const opts = lastArg as ParagraphOptions;
      textLines = args.slice(0, -1) as string[];
      lineSpacing = opts.lineSpacing ?? -1;
      alignment = opts.alignment ?? null;
      textOptions = opts;
    } else {
      textLines = args as string[];
    }

    this.lineSpacing = lineSpacing;
    this.alignment = alignment;
    this.considerSpacesAsChars = textOptions.disableLigatures ?? false;

    const linesStr = textLines.join("\n");
    this.linesText = new Text(linesStr, {
      lineSpacing,
      ...textOptions,
    });

    const linesStrList = linesStr.split("\n");
    this.chars = this._genChars(linesStrList);

    this.linesChars = [...this.chars.submobjects];
    this.linesAlignments = new Array(this.chars.submobjects.length).fill(
      this.alignment,
    );
    this.linesInitialPositions = this.linesChars.map((line) =>
      line.getCenter(),
    );
    this.add(...(this.linesChars as VMobject[]));
    this.moveTo(np.array([0, 0, 0]));
    if (this.alignment) {
      this._setAllLinesAlignments(this.alignment);
    }
  }

  private _genChars(linesStrList: string[]): VGroup {
    let charIndexCounter = 0;
    const chars = new VGroup();
    for (let lineNo = 0; lineNo < linesStrList.length; lineNo++) {
      const lineStr = linesStrList[lineNo];
      let charCount: number;
      if (this.considerSpacesAsChars) {
        charCount = lineStr.length;
      } else {
        charCount = 0;
        for (const char of lineStr) {
          if (!/\s/.test(char)) {
            charCount++;
          }
        }
      }

      const lineGroup = new VGroup();
      const lineChars = this.linesText.chars.submobjects.slice(
        charIndexCounter,
        charIndexCounter + charCount,
      );
      if (lineChars.length > 0) {
        lineGroup.add(...(lineChars as VMobject[]));
      }
      chars.add(lineGroup);

      charIndexCounter += charCount;
      if (this.considerSpacesAsChars) {
        charIndexCounter += 1; // count the \n separator
      }
    }
    return chars;
  }

  _setAllLinesAlignments(alignment: string): this {
    for (let lineNo = 0; lineNo < this.linesChars.length; lineNo++) {
      this._changeAlignmentForALine(alignment, lineNo);
    }
    return this;
  }

  _setLineAlignment(alignment: string, lineNo: number): this {
    this._changeAlignmentForALine(alignment, lineNo);
    return this;
  }

  _setAllLinesToInitialPositions(): this {
    this.linesAlignments = new Array(this.linesChars.length).fill(null);
    for (let lineNo = 0; lineNo < this.linesChars.length; lineNo++) {
      this.submobjects[lineNo].moveTo(
        this.getCenter().add(this.linesInitialPositions[lineNo]) as Point3D,
      );
    }
    return this;
  }

  _setLineToInitialPosition(lineNo: number): this {
    this.linesAlignments[lineNo] = null;
    this.submobjects[lineNo].moveTo(
      this.getCenter().add(this.linesInitialPositions[lineNo]) as Point3D,
    );
    return this;
  }

  private _changeAlignmentForALine(
    alignment: string,
    lineNo: number,
  ): void {
    this.linesAlignments[lineNo] = alignment;
    const line = this.submobjects[lineNo];
    if (!line) return;

    const centerArr = this.getCenter().toArray() as number[];
    const lineCenterArr = line.getCenter().toArray() as number[];

    if (alignment === "center") {
      line.moveTo(np.array([centerArr[0], lineCenterArr[1], 0]));
    } else if (alignment === "right") {
      const rightArr = this.getRight().toArray() as number[];
      line.moveTo(
        np.array([
          rightArr[0] - line.width / 2,
          lineCenterArr[1],
          0,
        ]),
      );
    } else if (alignment === "left") {
      const leftArr = this.getLeft().toArray() as number[];
      line.moveTo(
        np.array([
          leftArr[0] + line.width / 2,
          lineCenterArr[1],
          0,
        ]),
      );
    }
  }
}

// ─── register_font ──────────────────────────────────────────

/**
 * Register a font file for use with Text/MarkupText.
 *
 * In Python Manim, this uses manimpango.register_font/unregister_font.
 * In this TypeScript port, font registration requires a system-level
 * font backend.
 *
 * @param fontFile - Path to the font file (.ttf, .otf, etc.)
 * @param callback - Function to execute while the font is registered
 *
 * TODO: Port from manimpango — needs proper font registration backend
 */
export async function registerFont<T>(
  fontFile: string,
  callback: () => T | Promise<T>,
): Promise<T> {
  // Search for font file in common locations
  const possiblePaths = [
    fontFile,
    join("assets", "fonts", fontFile),
    join("fonts", fontFile),
  ];

  let resolvedPath: string | null = null;
  for (const p of possiblePaths) {
    const fullPath = resolve(p);
    if (existsSync(fullPath)) {
      resolvedPath = fullPath;
      break;
    }
  }

  if (!resolvedPath) {
    throw new Error(
      `Can't find ${fontFile}. Checked paths: ${possiblePaths.join(", ")}`,
    );
  }

  // TODO: Actually register the font with the rendering backend
  logger.info(`Registering font: ${resolvedPath}`);
  try {
    return await callback();
  } finally {
    // TODO: Unregister the font
    logger.info(`Unregistering font: ${resolvedPath}`);
  }
}
