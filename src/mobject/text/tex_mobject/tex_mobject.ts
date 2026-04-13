/**
 * Mobjects representing text rendered using LaTeX.
 *
 * TypeScript port of manim/mobject/text/tex_mobject.py
 */

import type { NDArray } from "numpy-ts";

import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  UP,
  DOWN,
  LEFT,
  RIGHT,
  DEFAULT_FONT_SIZE,
  SCALE_FACTOR_PER_FONT_POINT,
  SMALL_BUFF,
  MED_SMALL_BUFF,
  MED_LARGE_BUFF,
  RendererType,
} from "../../../constants/constants.js";
import { config, logger } from "../../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../../utils/color/core.js";
import { BLACK } from "../../../utils/color/manim_colors.js";
import { Mobject } from "../../mobject/index.js";
import {
  SVGMobject,
  type SVGMobjectOptions,
} from "../../svg/svg_mobject.js";
import { TexTemplate } from "../../../utils/tex/index.js";
import { texToSvgFile } from "../../../utils/tex_file_writing/index.js";

// ─── Constants ──────────────────────────────────────────────

const MATHTEX_SUBSTRING = "substring";

// ─── Dependency stubs ───────────────────────────────────────
// These mirror the stubs used in svg_mobject.ts and text_mobject.ts.
// Replace with real imports once the respective modules are fully converted.

// VMobject stub
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once converted
class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;
  nPointsPerCurve: number;

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
    this.nPointsPerCurve = 4;
  }

  getGroupClass(): typeof VGroup {
    return VGroup;
  }

  setFill(color?: ParsableManimColor, opacity?: number): this {
    if (color !== undefined) {
      this.fillColor = ManimColor.parse(color) as ManimColor;
    }
    if (opacity !== undefined) {
      this.fillOpacity = opacity;
    }
    return this;
  }
}

// VGroup stub
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once converted
class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

// Line stub
// TODO: Replace with import from ../../geometry/index.js once converted
class LineStub extends VMobject {
  constructor(start: Point3D = np.array([-1, 0, 0]), end: Point3D = np.array([1, 0, 0])) {
    super();
    this.points = np.array([
      (start as NDArray).toArray(),
      (end as NDArray).toArray(),
    ]);
  }

  matchWidth(mobject: Mobject): this {
    const targetWidth = mobject.getWidth();
    const currentWidth = this.getWidth();
    if (currentWidth > 0) {
      this.scale(targetWidth / currentWidth);
    }
    return this;
  }
}

// ─── Options interfaces ─────────────────────────────────────

export interface SingleStringMathTexOptions extends SVGMobjectOptions {
  texString?: string;
  strokeWidth?: number;
  shouldCenter?: boolean;
  height?: number | null;
  organizeLeftToRight?: boolean;
  texEnvironment?: string | null;
  texTemplate?: TexTemplate | null;
  fontSize?: number;
  color?: ParsableManimColor | null;
}

export interface MathTexOptions extends SingleStringMathTexOptions {
  argSeparator?: string;
  substringsToIsolate?: Iterable<string> | null;
  texToColorMap?: Map<string, ParsableManimColor> | null;
}

export interface TexOptions extends MathTexOptions {
}

export interface BulletedListOptions extends TexOptions {
  buff?: number;
  dotScaleFactor?: number;
}

export interface TitleOptions extends TexOptions {
  includeUnderline?: boolean;
  matchUnderlineWidthToText?: boolean;
  underlineBuff?: number;
}

// ─── SingleStringMathTex ────────────────────────────────────

export class SingleStringMathTex extends SVGMobject {
  texString: string;
  organizeLeftToRight: boolean;
  texEnvironment: string | null;
  texTemplate: TexTemplate;
  initialHeight: number;
  private _fontSize: number;

  constructor(
    texString: string,
    options: SingleStringMathTexOptions = {},
  ) {
    const {
      strokeWidth = 0,
      shouldCenter = true,
      height = null,
      organizeLeftToRight = false,
      texEnvironment = "align*",
      texTemplate = null,
      fontSize = DEFAULT_FONT_SIZE,
      color = null,
      ...restOptions
    } = options;

    const resolvedColor = color ?? new VMobject().color;
    const resolvedTexTemplate = texTemplate ?? config.texTemplate ?? new TexTemplate();

    const modifiedExpression = SingleStringMathTex._getModifiedExpressionStatic(texString);
    const fileName = texToSvgFile(
      modifiedExpression,
      texEnvironment,
      resolvedTexTemplate,
    );

    super({
      fileName,
      shouldCenter,
      strokeWidth,
      height: height ?? undefined,
      color: resolvedColor,
      pathStringConfig: {
        shouldSubdivideSharpCurves: true,
        shouldRemoveNullCurves: true,
      },
      ...restOptions,
    });

    this.texString = texString;
    this._fontSize = fontSize;
    this.organizeLeftToRight = organizeLeftToRight;
    this.texEnvironment = texEnvironment;
    this.texTemplate = resolvedTexTemplate;

    this.initColors();

    // Used for scaling via fontSize setter
    this.initialHeight = this.height;

    if (height === null) {
      this.fontSize = this._fontSize;
    }

    if (this.organizeLeftToRight) {
      this._organizeSubmobjectsLeftToRight();
    }
  }

  toString(): string {
    return `${this.constructor.name}(${JSON.stringify(this.texString)})`;
  }

  get fontSize(): number {
    return this.height / this.initialHeight / SCALE_FACTOR_PER_FONT_POINT;
  }

  set fontSize(fontVal: number) {
    if (fontVal <= 0) {
      throw new Error("font_size must be greater than 0.");
    } else if (this.height > 0) {
      // Sometimes manim generates a SingleStringMathTex mobject with 0 height.
      // Can't be scaled regardless and will error without the elif.
      // Scale to a factor of the initial height so that setting
      // font_size does not depend on current size.
      this.scale(fontVal / this.fontSize);
    }
  }

  private static _getModifiedExpressionStatic(texString: string): string {
    let result = texString.trim();
    result = SingleStringMathTex._modifySpecialStringsStatic(result);
    return result;
  }

  private _getModifiedExpression(texString: string): string {
    let result = texString.trim();
    result = this._modifySpecialStrings(result);
    return result;
  }

  private static _modifySpecialStringsStatic(tex: string): string {
    tex = tex.trim();
    const shouldAddFiller = [
      tex === "\\over",
      tex === "\\overline",
      tex === "\\sqrt",
      tex === "\\sqrt{",
      tex.endsWith("_"),
      tex.endsWith("^"),
      tex.endsWith("dot"),
    ].some(Boolean);

    if (shouldAddFiller) {
      tex += "{\\quad}";
    }

    if (tex === "\\substack") {
      tex = "\\quad";
    }

    if (tex === "") {
      tex = "\\quad";
    }

    // To keep files from starting with a line break
    if (tex.startsWith("\\\\")) {
      tex = tex.replace("\\\\", "\\quad\\\\");
    }

    // Handle imbalanced \left and \right
    const countDelimiters = (str: string, substr: string): number => {
      const parts = str.split(substr).slice(1);
      return parts.filter((s) => s.length > 0 && "(){}[]|.\\".includes(s[0])).length;
    };
    const numLefts = countDelimiters(tex, "\\left");
    const numRights = countDelimiters(tex, "\\right");
    if (numLefts !== numRights) {
      tex = tex.replaceAll("\\left", "\\big");
      tex = tex.replaceAll("\\right", "\\big");
    }

    tex = SingleStringMathTex._removeStrayBracesStatic(tex);

    for (const context of ["array"]) {
      const beginIn = tex.includes(`\\begin{${context}}`);
      const endIn = tex.includes(`\\end{${context}}`);
      if (beginIn !== endIn) {
        tex = "";
      }
    }
    return tex;
  }

  private _modifySpecialStrings(tex: string): string {
    return SingleStringMathTex._modifySpecialStringsStatic(tex);
  }

  private static _removeStrayBracesStatic(tex: string): string {
    // "\{" does not count (it's a brace literal), but "\\{" counts (it's a new line and then brace)
    let numLefts = (tex.match(/{/g) || []).length
      - (tex.match(/\\{/g) || []).length
      + (tex.match(/\\\\{/g) || []).length;
    let numRights = (tex.match(/}/g) || []).length
      - (tex.match(/\\}/g) || []).length
      + (tex.match(/\\\\}/g) || []).length;

    while (numRights > numLefts) {
      tex = "{" + tex;
      numLefts += 1;
    }
    while (numLefts > numRights) {
      tex = tex + "}";
      numRights += 1;
    }
    return tex;
  }

  private _removeStrayBraces(tex: string): string {
    return SingleStringMathTex._removeStrayBracesStatic(tex);
  }

  protected _organizeSubmobjectsLeftToRight(): this {
    this.sort((p: Point3D) => p.get([0]) as number);
    return this;
  }

  getTexString(): string {
    return this.texString;
  }

  initColors(propagateColors = true): void {
    for (const submobject of this.submobjects) {
      // Needed to preserve original (non-black) TeX colors of individual submobjects
      if (submobject.color instanceof ManimColor && !(submobject.color as ManimColor).equals(BLACK as ManimColor)) {
        continue;
      }
      submobject.color = this.color;
    }
  }
}

// ─── MathTexPart ────────────────────────────────────────────

export class MathTexPart extends VMobject {
  texString: string = "";

  toString(): string {
    return `${this.constructor.name}(${JSON.stringify(this.texString)})`;
  }
}

// ─── MathTex ────────────────────────────────────────────────

export class MathTex extends SingleStringMathTex {
  texStrings: string[];
  argSeparator: string;
  substringsToIsolate: string[];
  texToColorMap: Map<string, ParsableManimColor>;
  braceNotationSplitOccurred: boolean;
  matchedStringsAndIds: Array<[string, string]>;
  declare texEnvironment: string | null;
  declare texTemplate: TexTemplate;

  constructor(
    texStrings: string[],
    options: MathTexOptions = {},
  ) {
    const {
      argSeparator = " ",
      substringsToIsolate = null,
      texToColorMap = null,
      texEnvironment = "align*",
      texTemplate = null,
      ...restOptions
    } = options;

    const resolvedTemplate = texTemplate ?? config.texTemplate ?? new TexTemplate();
    const resolvedSubstringsToIsolate = substringsToIsolate
      ? [...substringsToIsolate]
      : [];
    const resolvedTexToColorMap = texToColorMap ?? new Map<string, ParsableManimColor>();

    // Add color map keys to substrings to isolate
    for (const key of resolvedTexToColorMap.keys()) {
      resolvedSubstringsToIsolate.push(key);
    }

    // Prepare tex strings (validate and split double braces)
    let braceNotationSplitOccurred = false;
    const validated = texStrings.map((s) =>
      typeof s === "string" ? s : String(s),
    );
    const splitStrings: string[] = [];
    for (const texStr of validated) {
      const split = MathTex._splitDoubleBraces(texStr);
      splitStrings.push(...split);
    }
    if (splitStrings.length > validated.length) {
      braceNotationSplitOccurred = true;
    }
    const preparedTexStrings = splitStrings.filter((s) => s.length > 0);

    // Build the matched strings and IDs list
    const matchedStringsAndIds: Array<[string, string]> = [];

    // Join tex strings with unique delimiters
    let joinedString = "";
    let ssIdx = 0;
    for (let idx = 0; idx < preparedTexStrings.length; idx++) {
      const texStr = preparedTexStrings[idx];
      let stringPart = `\\special{dvisvgm:raw <g id='unique${String(idx).padStart(3, "0")}'>}`;
      matchedStringsAndIds.push([texStr, `unique${String(idx).padStart(3, "0")}`]);

      // Try to match with all substringsToIsolate
      let unprocessedString = texStr;
      let processedString = "";
      while (unprocessedString.length > 0) {
        const firstMatch = MathTex._locateFirstMatch(
          resolvedSubstringsToIsolate,
          unprocessedString,
        );

        if (firstMatch) {
          const [processed, remaining, matchInfo] = MathTex._handleMatch(
            ssIdx,
            firstMatch,
          );
          matchedStringsAndIds.push(matchInfo);
          processedString += processed;
          unprocessedString = remaining;
          ssIdx += 1;
        } else {
          processedString += unprocessedString;
          unprocessedString = "";
        }
      }

      stringPart += processedString;
      if (idx < preparedTexStrings.length - 1) {
        stringPart += argSeparator;
      }
      stringPart += "\\special{dvisvgm:raw </g>}";
      joinedString += stringPart;
    }

    try {
      super(joinedString, {
        texEnvironment,
        texTemplate: resolvedTemplate,
        ...restOptions,
      });
    } catch (compilationError) {
      if (braceNotationSplitOccurred) {
        logger.error(
          "A group of double braces, {{ ... }}, was detected in " +
          "your string. Manim splits TeX strings at the double " +
          "braces, which might have caused the current " +
          "compilation error. If you didn't use the double brace " +
          "split intentionally, add spaces between the braces to " +
          "avoid the automatic splitting: {{ ... }} --> { { ... } }.",
        );
      }
      throw compilationError;
    }

    // Store fields
    this.texStrings = preparedTexStrings;
    this.argSeparator = argSeparator;
    this.substringsToIsolate = resolvedSubstringsToIsolate;
    this.texToColorMap = resolvedTexToColorMap;
    this.braceNotationSplitOccurred = braceNotationSplitOccurred;
    this.matchedStringsAndIds = matchedStringsAndIds;

    // Override the tex_string to be the joined version
    this.texString = this.argSeparator + preparedTexStrings.join(this.argSeparator);

    this._breakUpBySubstrings();
    this.setColorByTexToColorMap(this.texToColorMap);

    if (this.organizeLeftToRight) {
      this._organizeSubmobjectsLeftToRight();
    }
  }

  private static _splitDoubleBraces(texString: string): string[] {
    const segments: string[] = [];
    let current = "";
    let i = 0;
    let insideManim = false;
    let innerDepth = 0;

    while (i < texString.length) {
      // Consume escape sequences as atomic units
      if (texString[i] === "\\" && i + 1 < texString.length) {
        const nextCh = texString[i + 1];
        if (nextCh === "\\" || nextCh === "{" || nextCh === "}") {
          current += texString.slice(i, i + 2);
          i += 2;
          continue;
        }
      }

      if (!insideManim) {
        // {{ opens a Manim group only at start-of-string or after whitespace
        if (
          texString.slice(i, i + 2) === "{{" &&
          (i === 0 || /\s/.test(texString[i - 1]))
        ) {
          segments.push(current);
          current = "";
          insideManim = true;
          innerDepth = 0;
          i += 2;
        } else {
          current += texString[i];
          i += 1;
        }
      } else {
        if (texString[i] === "{") {
          innerDepth += 1;
          current += texString[i];
          i += 1;
        } else if (
          texString[i] === "}" &&
          innerDepth === 0 &&
          texString.slice(i, i + 2) === "}}"
        ) {
          // }} at inner depth 0 closes the Manim group
          segments.push(current);
          current = "";
          insideManim = false;
          i += 2;
        } else if (texString[i] === "}") {
          innerDepth -= 1;
          current += texString[i];
          i += 1;
        } else {
          current += texString[i];
          i += 1;
        }
      }
    }

    segments.push(current);
    return segments;
  }

  private static _locateFirstMatch(
    substringsToIsolate: string[],
    unprocessedString: string,
  ): RegExpMatchArray | null {
    let firstMatchStart = unprocessedString.length;
    let firstMatchLength = 0;
    let firstMatch: RegExpMatchArray | null = null;

    for (const substring of substringsToIsolate) {
      const escaped = substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(.*?)(${escaped})(.*)`);
      const match = unprocessedString.match(regex);
      if (match && match[1].length < firstMatchStart) {
        firstMatch = match;
        firstMatchStart = match[1].length;
        firstMatchLength = match[2].length;
      } else if (match && match[1].length === firstMatchStart) {
        if (firstMatchLength < match[2].length) {
          firstMatch = match;
          firstMatchStart = match[1].length;
          firstMatchLength = match[2].length;
        }
      }
    }
    return firstMatch;
  }

  private static _handleMatch(
    ssIdx: number,
    firstMatch: RegExpMatchArray,
  ): [string, string, [string, string]] {
    const preMatch = firstMatch[1];
    const matchedString = firstMatch[2];
    const postMatch = firstMatch[3];
    const idStr = `unique${String(ssIdx).padStart(3, "0")}${MATHTEX_SUBSTRING}`;
    const preString = `\\special{dvisvgm:raw <g id='${idStr}'>}`;
    const postString = "\\special{dvisvgm:raw </g>}";
    const processedString = preMatch + preString + matchedString + postString;
    return [processedString, postMatch, [matchedString, idStr]];
  }

  private get _substringMatches(): Array<[string, string]> {
    return this.matchedStringsAndIds.filter(
      ([, id]) => id.endsWith(MATHTEX_SUBSTRING),
    );
  }

  private get _mainMatches(): Array<[string, string]> {
    return this.matchedStringsAndIds.filter(
      ([, id]) => !id.endsWith(MATHTEX_SUBSTRING),
    );
  }

  private _breakUpBySubstrings(): this {
    const newSubmobjects: Mobject[] = [];
    try {
      for (const [texStr, texStringId] of this._mainMatches) {
        const mtp = new MathTexPart();
        mtp.texString = texStr;
        const vgroup = this.idToVgroupDict.get(texStringId);
        if (vgroup) {
          mtp.add(...vgroup.submobjects);
        }
        newSubmobjects.push(mtp);
      }
    } catch {
      logger.error(
        "MathTex: Could not find SVG group for tex part. Using fallback to root group.",
      );
      const rootGroup = this.idToVgroupDict.get("root");
      if (rootGroup) {
        newSubmobjects.push(rootGroup as unknown as Mobject);
      }
    }
    this.submobjects = newSubmobjects;
    return this;
  }

  getPartByTex(tex: string): Mobject | null {
    for (const [texStr, matchId] of this.matchedStringsAndIds) {
      if (texStr === tex) {
        return this.idToVgroupDict.get(matchId) ?? null;
      }
    }
    return null;
  }

  setColorByTex(tex: string, color: ParsableManimColor): this {
    for (const [texStr, matchId] of this.matchedStringsAndIds) {
      if (texStr === tex) {
        const group = this.idToVgroupDict.get(matchId) as Mobject | undefined;
        if (group) {
          group.setColor(color);
        }
      }
    }
    return this;
  }

  setOpacityByTex(
    tex: string,
    opacity: number = 0.5,
    remainingOpacity?: number,
  ): this {
    if (remainingOpacity !== undefined) {
      this.setOpacity(remainingOpacity);
    }
    for (const [texStr, matchId] of this.matchedStringsAndIds) {
      if (texStr === tex) {
        const group = this.idToVgroupDict.get(matchId) as Mobject | undefined;
        if (group) {
          group.setOpacity(opacity);
        }
      }
    }
    return this;
  }

  setColorByTexToColorMap(
    texsToColorMap: Map<string, ParsableManimColor>,
  ): this {
    for (const [texs, color] of texsToColorMap) {
      for (const [matchTex, matchId] of this.matchedStringsAndIds) {
        if (matchTex === texs) {
          const group = this.idToVgroupDict.get(matchId) as Mobject | undefined;
          if (group) {
            group.setColor(color);
          }
        }
      }
    }
    return this;
  }

  indexOfPart(part: VMobject): number {
    const splitSelf = this.split();
    const idx = splitSelf.indexOf(part);
    if (idx === -1) {
      throw new Error("Trying to get index of part not in MathTex");
    }
    return idx;
  }

  sortAlphabetically(): void {
    this.submobjects.sort((a, b) => {
      const aStr = (a as MathTexPart).texString ?? "";
      const bStr = (b as MathTexPart).texString ?? "";
      return aStr.localeCompare(bStr);
    });
  }
}

// ─── Tex ────────────────────────────────────────────────────

export class Tex extends MathTex {
  constructor(
    texStrings: string[],
    options: TexOptions = {},
  ) {
    const {
      argSeparator = "",
      texEnvironment = "center",
      ...restOptions
    } = options;

    super(texStrings, {
      argSeparator,
      texEnvironment,
      ...restOptions,
    });
  }
}

// ─── BulletedList ───────────────────────────────────────────

export class BulletedList extends Tex {
  buff: number;
  dotScaleFactor: number;

  constructor(
    items: string[],
    options: BulletedListOptions = {},
  ) {
    const {
      buff = MED_LARGE_BUFF,
      dotScaleFactor = 2,
      texEnvironment = null,
      ...restOptions
    } = options;

    const lineSeparatedItems = items.map((s) => s + "\\\\");

    super(lineSeparatedItems, {
      texEnvironment,
      ...restOptions,
    });

    this.buff = buff;
    this.dotScaleFactor = dotScaleFactor;

    for (const part of this.submobjects) {
      const dot = new MathTex(["\\cdot"]);
      dot.scale(this.dotScaleFactor);
      if (part.submobjects.length > 0) {
        dot.nextTo(part.submobjects[0], LEFT, { buff: SMALL_BUFF });
      }
      part.addToBack(dot);
    }
    this.arrange(DOWN, this.buff, false);
    // Align left edges
    for (const sub of this.submobjects) {
      sub.alignTo(this, LEFT);
    }
  }

  fadeAllBut(indexOrString: number | string, opacity: number = 0.5): void {
    let part: Mobject | null;
    if (typeof indexOrString === "string") {
      part = this.getPartByTex(indexOrString) as Mobject | null;
      if (part === null) {
        throw new Error(
          `Could not locate part by provided tex string '${indexOrString}'.`,
        );
      }
    } else if (typeof indexOrString === "number") {
      part = this.submobjects[indexOrString];
    } else {
      throw new TypeError(`Expected number or string, got ${typeof indexOrString}`);
    }
    for (const otherPart of this.submobjects) {
      if (otherPart === part) {
        (otherPart as VMobject).setFill(undefined, 1);
      } else {
        (otherPart as VMobject).setFill(undefined, opacity);
      }
    }
  }
}

// ─── Title ──────────────────────────────────────────────────

export class Title extends Tex {
  includeUnderline: boolean;
  matchUnderlineWidthToText: boolean;
  underlineBuff: number;
  underline?: Mobject;

  constructor(
    textParts: string[],
    options: TitleOptions = {},
  ) {
    const {
      includeUnderline = true,
      matchUnderlineWidthToText = false,
      underlineBuff = MED_SMALL_BUFF,
      ...restOptions
    } = options;

    super(textParts, restOptions);

    this.includeUnderline = includeUnderline;
    this.matchUnderlineWidthToText = matchUnderlineWidthToText;
    this.underlineBuff = underlineBuff;

    this.toEdge(UP);

    if (this.includeUnderline) {
      const underlineWidth = config.frameWidth - 2;
      const underline = new LineStub(LEFT, RIGHT);
      underline.nextTo(this, DOWN, { buff: this.underlineBuff });
      if (this.matchUnderlineWidthToText) {
        underline.matchWidth(this);
      } else {
        underline.width = underlineWidth;
      }
      this.add(underline);
      this.underline = underline;
    }
  }
}
