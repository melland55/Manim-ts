/**
 * Mobjects generated from an SVG file.
 *
 * TypeScript port of manim/mobject/svg/svg_mobject.py
 */

import { readFileSync } from "fs";

import type { NDArray } from "numpy-ts";
import { load as cheerioLoad, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import SVGPathCommander from "svg-path-commander";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { RIGHT } from "../../constants/constants.js";
import { config, logger } from "../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../utils/color/core.js";
import { getQuadraticApproximationOfCubic } from "../../utils/bezier/index.js";
import { getFullVectorImagePath } from "../../utils/images/index.js";
import { hashObj } from "../../utils/iterables/index.js";
import { Mobject } from "../mobject/index.js";

// ─── Dependency stubs ────────────────────────────────────────
// These classes are not yet converted. We define minimal local stubs
// so this module compiles. Replace with real imports once the
// respective modules land.

// VMobject stub — extends Mobject with vectorized mobject fields
// TODO: Replace with import from ../types/vectorized_mobject/index.js once converted
class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;
  nPointsPerCurve: number;

  constructor(options: VMobjectStubOptions = {}) {
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

  setStyle(options: {
    fillColor?: ParsableManimColor | string | null;
    fillOpacity?: number | null;
    strokeColor?: ParsableManimColor | string | null;
    strokeOpacity?: number | null;
    strokeWidth?: number | null;
  }): this {
    if (options.fillColor != null) {
      this.fillColor = ManimColor.parse(options.fillColor) as ManimColor;
    }
    if (options.fillOpacity != null) {
      this.fillOpacity = options.fillOpacity;
    }
    if (options.strokeColor != null) {
      this.strokeColor = ManimColor.parse(options.strokeColor) as ManimColor;
    }
    if (options.strokeOpacity != null) {
      this.strokeOpacity = options.strokeOpacity;
    }
    if (options.strokeWidth != null) {
      this.strokeWidth = options.strokeWidth;
    }
    return this;
  }

  hasPoints(): boolean {
    return this.points.shape[0] > 0;
  }

  setPointsAsCorners(points: Point3D[]): this {
    if (points.length <= 1) {
      this.points = np.zeros([0, 3]);
      return this;
    }
    const allPoints: number[][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const start = (points[i] as NDArray).toArray() as number[];
      const end = (points[i + 1] as NDArray).toArray() as number[];
      const cp1 = start.map((v, d) => (2 * v + end[d]) / 3);
      const cp2 = start.map((v, d) => (v + 2 * end[d]) / 3);
      allPoints.push(start, cp1, cp2, end);
    }
    this.points = np.array(allPoints);
    return this;
  }

  getGroupClass(): typeof VGroup {
    return VGroup;
  }

  getMobjectTypeClass(): typeof VMobject {
    return VMobject;
  }

  appendVectorizedMobject(vmob: VMobject): this {
    if (vmob.points.shape[0] > 0) {
      const current = this.points;
      if (current.shape[0] === 0) {
        this.points = vmob.points.copy();
      } else {
        this.points = np.vstack([current, vmob.points]);
      }
    }
    return this;
  }
}

interface VMobjectStubOptions {
  color?: ParsableManimColor | null;
  name?: string;
  fillColor?: ParsableManimColor | null;
  fillOpacity?: number;
  strokeColor?: ParsableManimColor | null;
  strokeOpacity?: number;
  strokeWidth?: number;
  backgroundStrokeWidth?: number;
  backgroundStrokeColor?: ParsableManimColor | null;
}

// VGroup stub
// TODO: Replace with import from ../types/vectorized_mobject/index.js once converted
class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

// Geometry stubs — minimal implementations for SVG element conversion
// TODO: Replace with imports from ../geometry/ once converted

class Line extends Mobject {
  constructor(
    public lineStart: Point3D = np.array([0, 0, 0]),
    public lineEnd: Point3D = np.array([0, 0, 0]),
  ) {
    super();
    this.points = np.array([
      (lineStart as NDArray).toArray(),
      (lineEnd as NDArray).toArray(),
    ]);
  }
}

class Circle extends VMobject {
  radius: number;

  constructor(options: { radius?: number } = {}) {
    super();
    this.radius = options.radius ?? 1.0;
  }
}

class Rectangle extends VMobject {
  rectWidth: number;
  rectHeight: number;

  constructor(options: { width?: number; height?: number } = {}) {
    super();
    this.rectWidth = options.width ?? 4.0;
    this.rectHeight = options.height ?? 2.0;
  }
}

class RoundedRectangle extends Rectangle {
  cornerRadius: number;

  constructor(
    options: { width?: number; height?: number; cornerRadius?: number } = {},
  ) {
    super(options);
    this.cornerRadius = options.cornerRadius ?? 0.5;
  }
}

class Polygon extends VMobject {
  constructor(...points: Point3D[]) {
    super();
    if (points.length > 0) {
      this.setPointsAsCorners([...points, points[0]]);
    }
  }
}

// ─── SVG hash cache ──────────────────────────────────────────

const SVG_HASH_TO_MOB_MAP: Map<number, SVGMobject> = new Map();

// ─── Helpers ─────────────────────────────────────────────────

function convertPointTo3d(x: number, y: number): Point3D {
  return np.array([x, y, 0.0]);
}

function parsePointsList(pointsStr: string): Point3D[] {
  const nums = pointsStr.trim().split(/[\s,]+/).map(Number);
  const result: Point3D[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    result.push(convertPointTo3d(nums[i], nums[i + 1]));
  }
  return result;
}

// Helper to safely get attr from a cheerio-wrapped element
function getAttr($: CheerioAPI, el: AnyNode, name: string): string | undefined {
  return $(el).attr(name);
}

// ─── SVGMobject ──────────────────────────────────────────────

export interface SVGMobjectOptions extends VMobjectStubOptions {
  fileName?: string | null;
  shouldCenter?: boolean;
  height?: number | null;
  width?: number | null;
  opacity?: number | null;
  svgDefault?: Record<string, unknown> | null;
  pathStringConfig?: Record<string, unknown> | null;
  useSvgCache?: boolean;
}

export class SVGMobject extends VMobject {
  fileName: string | null;
  shouldCenter: boolean;
  svgHeight: number | null;
  svgWidth: number | null;
  declare opacity: number | null;
  idToVgroupDict: Map<string, VGroup>;
  svgDefault: Record<string, unknown>;
  pathStringConfig: Record<string, unknown>;

  constructor(options: SVGMobjectOptions = {}) {
    super({
      color: undefined,
      strokeColor: undefined,
      fillColor: undefined,
    });

    this.fileName = options.fileName ?? null;
    this.shouldCenter = options.shouldCenter ?? true;
    this.svgHeight = options.height !== undefined ? options.height : 2;
    this.svgWidth = options.width !== undefined ? options.width : null;

    if (options.color !== undefined) {
      this.color = ManimColor.parse(options.color) as ManimColor;
    }
    this.opacity = options.opacity ?? null;

    if (options.fillColor !== undefined && options.fillColor !== null) {
      this.fillColor = ManimColor.parse(options.fillColor) as ManimColor;
    }
    if (options.fillOpacity !== undefined) {
      this.fillOpacity = options.fillOpacity;
    }
    if (options.strokeColor !== undefined && options.strokeColor !== null) {
      this.strokeColor = ManimColor.parse(options.strokeColor) as ManimColor;
    }
    if (options.strokeOpacity !== undefined) {
      this.strokeOpacity = options.strokeOpacity;
    }
    if (options.strokeWidth !== undefined) {
      this.strokeWidth = options.strokeWidth;
    } else {
      this.strokeWidth = 0;
    }

    this.idToVgroupDict = new Map();

    this.svgDefault = options.svgDefault ?? {
      color: null,
      opacity: null,
      fillColor: null,
      fillOpacity: null,
      strokeWidth: 0,
      strokeColor: null,
      strokeOpacity: null,
    };

    this.pathStringConfig = options.pathStringConfig ?? {};

    const useSvgCache = options.useSvgCache ?? true;
    this.initSvgMobject(useSvgCache);

    this.setStyle({
      fillColor: options.fillColor ?? null,
      fillOpacity: options.fillOpacity ?? null,
      strokeColor: options.strokeColor ?? null,
      strokeOpacity: options.strokeOpacity ?? null,
      strokeWidth: options.strokeWidth ?? null,
    });
    this.moveIntoPosition();
  }

  initSvgMobject(useSvgCache: boolean): void {
    if (useSvgCache) {
      const hashVal = hashObj(this.hashSeed);
      const cached = SVG_HASH_TO_MOB_MAP.get(hashVal);
      if (cached) {
        const mob = cached.copy() as unknown as SVGMobject;
        this.add(...mob.submobjects);
        this.idToVgroupDict = mob.idToVgroupDict;
        return;
      }
      this.generateMobject();
      SVG_HASH_TO_MOB_MAP.set(hashVal, this.copy() as unknown as SVGMobject);
    } else {
      this.generateMobject();
    }
  }

  get hashSeed(): unknown[] {
    return [
      this.constructor.name,
      this.svgDefault,
      this.pathStringConfig,
      this.fileName,
      config.renderer,
    ];
  }

  generateMobject(): void {
    const filePath = this.getFilePath();
    const svgContent = readFileSync(filePath, "utf-8");
    const modifiedContent = this.modifyXmlTree(svgContent);

    const parsed = this.getMobjectsFrom(modifiedContent);
    this.add(...parsed.mobjects);
    this.idToVgroupDict = parsed.vgroups;
    this.flip(RIGHT);
  }

  getFilePath(): string {
    if (this.fileName == null) {
      throw new Error("Must specify file for SVGMobject");
    }
    return getFullVectorImagePath(this.fileName);
  }

  modifyXmlTree(svgContent: string): string {
    const configStyleDict = this.generateConfigStyleDict();
    const $ = cheerioLoad(svgContent, { xmlMode: true });
    const root = $("svg");

    const styleKeys = [
      "fill",
      "fill-opacity",
      "stroke",
      "stroke-opacity",
      "stroke-width",
      "style",
    ];

    const rootStyleAttrs: Record<string, string> = {};
    for (const key of styleKeys) {
      const val = root.attr(key);
      if (val !== undefined) {
        rootStyleAttrs[key] = val;
      }
    }

    const children = root.html() ?? "";

    const configAttrs = Object.entries(configStyleDict)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    const rootAttrs = Object.entries(rootStyleAttrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");

    return `<svg><g ${configAttrs}><g ${rootAttrs}>${children}</g></g></svg>`;
  }

  generateConfigStyleDict(): Record<string, string> {
    const keysConvertingDict: Record<string, string[]> = {
      fill: ["color", "fillColor"],
      "fill-opacity": ["opacity", "fillOpacity"],
      stroke: ["color", "strokeColor"],
      "stroke-opacity": ["opacity", "strokeOpacity"],
      "stroke-width": ["strokeWidth"],
    };

    const result: Record<string, string> = {};
    for (const [svgKey, styleKeys] of Object.entries(keysConvertingDict)) {
      for (const styleKey of styleKeys) {
        if (this.svgDefault[styleKey] == null) {
          continue;
        }
        result[svgKey] = String(this.svgDefault[styleKey]);
      }
    }
    return result;
  }

  getMobjectsFrom(svgContent: string): {
    mobjects: VMobject[];
    vgroups: Map<string, VGroup>;
  } {
    const $ = cheerioLoad(svgContent, { xmlMode: true });
    const result: VMobject[] = [];
    const vgroups = new Map<string, VGroup>();
    vgroups.set("root", new VGroup());

    let groupIdNumber = 0;

    const processElement = (
      el: AnyNode,
      parentNames: string[],
    ): void => {
      const tagName = (el as { tagName?: string }).tagName ?? "";
      const groupName =
        getAttr($, el, "id") ?? `numbered_group_${groupIdNumber++}`;
      const vg = new VGroup();
      vgroups.set(groupName, vg);
      const currentParents = [...parentNames, groupName];

      if (tagName === "g" || tagName === "use" || tagName === "svg") {
        $(el).children().each((_i: number, child: AnyNode) => {
          processElement(child, currentParents);
        });
        return;
      }

      try {
        const mob = this.getMobFromShapeElement($, el);
        if (mob != null) {
          result.push(mob);
          for (const pName of parentNames) {
            const pGroup = vgroups.get(pName);
            if (pGroup) {
              pGroup.add(mob);
            }
          }
        }
      } catch (e) {
        logger.error(
          `Exception occurred in 'getMobjectsFrom'. Details: ${e}`,
        );
      }
    };

    $("svg")
      .children()
      .each((_i: number, el: AnyNode) => {
        processElement(el, ["root"]);
      });

    return { mobjects: result, vgroups };
  }

  getMobFromShapeElement(
    $: CheerioAPI,
    el: AnyNode,
  ): VMobject | null {
    const tagName = (el as { tagName?: string }).tagName ?? "";
    let mob: VMobject | null = null;

    switch (tagName) {
      case "path":
        mob = this.pathToMobject($, el);
        break;
      case "line":
        mob = SVGMobject.lineToMobjectFromEl($, el) as unknown as VMobject;
        break;
      case "rect":
        mob = SVGMobject.rectToMobjectFromEl($, el);
        break;
      case "circle":
      case "ellipse":
        mob = SVGMobject.ellipseToMobjectFromEl($, el);
        break;
      case "polygon":
        mob = SVGMobject.polygonToMobjectFromEl($, el);
        break;
      case "polyline":
        mob = this.polylineToMobject($, el);
        break;
      case "text":
        mob = SVGMobject.textToMobject();
        break;
      default:
        return null;
    }

    if (mob == null || !mob.hasPoints()) {
      return mob;
    }

    SVGMobject.applyStyleToMobject($, mob, el);
    SVGMobject.handleTransformStatic($, mob, el);
    return mob;
  }

  static handleTransformStatic(
    $: CheerioAPI,
    mob: VMobject,
    el: AnyNode,
  ): VMobject {
    const transformAttr = $(el).attr("transform");
    if (!transformAttr) return mob;

    const matrixMatch = transformAttr.match(
      /matrix\(\s*([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)\s*\)/,
    );
    if (matrixMatch) {
      const a = parseFloat(matrixMatch[1]);
      const b = parseFloat(matrixMatch[2]);
      const c = parseFloat(matrixMatch[3]);
      const d = parseFloat(matrixMatch[4]);
      const e = parseFloat(matrixMatch[5]);
      const f = parseFloat(matrixMatch[6]);

      const mat = np.array([
        [a, c],
        [b, d],
      ]);
      const vec = np.array([e, f, 0.0]);
      mob.applyMatrix(mat);
      mob.shift(vec);
      return mob;
    }

    const translateMatch = transformAttr.match(
      /translate\(\s*([^,\s]+)[\s,]*([^,\s)]*)\s*\)/,
    );
    if (translateMatch) {
      const tx = parseFloat(translateMatch[1]);
      const ty = translateMatch[2] ? parseFloat(translateMatch[2]) : 0;
      mob.shift(np.array([tx, ty, 0.0]));
    }

    const scaleMatch = transformAttr.match(
      /scale\(\s*([^,\s]+)[\s,]*([^,\s)]*)\s*\)/,
    );
    if (scaleMatch) {
      const sx = parseFloat(scaleMatch[1]);
      const sy = scaleMatch[2] ? parseFloat(scaleMatch[2]) : sx;
      const scaleMat = np.array([
        [sx, 0],
        [0, sy],
      ]);
      mob.applyMatrix(scaleMat);
    }

    const rotateMatch = transformAttr.match(
      /rotate\(\s*([^,\s]+)[\s,]*([^,\s)]*)[\s,]*([^,\s)]*)\s*\)/,
    );
    if (rotateMatch) {
      const angle = (parseFloat(rotateMatch[1]) * Math.PI) / 180;
      mob.rotate(angle);
    }

    return mob;
  }

  static applyStyleToMobject(
    $: CheerioAPI,
    mob: VMobject,
    el: AnyNode,
  ): VMobject {
    const $el = $(el);
    const strokeWidthAttr = $el.attr("stroke-width");
    const strokeColorAttr = $el.attr("stroke");
    const strokeOpacityAttr = $el.attr("stroke-opacity");
    const fillColorAttr = $el.attr("fill");
    const fillOpacityAttr = $el.attr("fill-opacity");

    const styleAttr = $el.attr("style") ?? "";
    const styleMap = new Map<string, string>();
    for (const part of styleAttr.split(";")) {
      const colonIdx = part.indexOf(":");
      if (colonIdx >= 0) {
        const key = part.slice(0, colonIdx).trim();
        const val = part.slice(colonIdx + 1).trim();
        if (key && val) {
          styleMap.set(key, val);
        }
      }
    }

    const sw = strokeWidthAttr ?? styleMap.get("stroke-width");
    const sc = strokeColorAttr ?? styleMap.get("stroke");
    const so = strokeOpacityAttr ?? styleMap.get("stroke-opacity");
    const fc = fillColorAttr ?? styleMap.get("fill");
    const fo = fillOpacityAttr ?? styleMap.get("fill-opacity");

    mob.setStyle({
      strokeWidth: sw != null ? parseFloat(sw) : null,
      strokeColor: sc != null && sc !== "none" ? sc : null,
      strokeOpacity: so != null ? parseFloat(so) : null,
      fillColor: fc != null && fc !== "none" ? fc : null,
      fillOpacity: fo != null ? parseFloat(fo) : (fc === "none" ? 0 : null),
    });

    return mob;
  }

  pathToMobject(
    $: CheerioAPI,
    el: AnyNode,
  ): VMobjectFromSVGPath {
    const dAttr = $(el).attr("d") ?? "";
    return new VMobjectFromSVGPath({
      pathString: dAttr,
      ...this.pathStringConfig,
    });
  }

  static lineToMobjectFromEl(
    $: CheerioAPI,
    el: AnyNode,
  ): Line {
    const $el = $(el);
    const x1 = parseFloat($el.attr("x1") ?? "0");
    const y1 = parseFloat($el.attr("y1") ?? "0");
    const x2 = parseFloat($el.attr("x2") ?? "0");
    const y2 = parseFloat($el.attr("y2") ?? "0");
    return new Line(convertPointTo3d(x1, y1), convertPointTo3d(x2, y2));
  }

  static rectToMobjectFromEl(
    $: CheerioAPI,
    el: AnyNode,
  ): Rectangle | RoundedRectangle {
    const $el = $(el);
    const x = parseFloat($el.attr("x") ?? "0");
    const y = parseFloat($el.attr("y") ?? "0");
    const w = parseFloat($el.attr("width") ?? "0");
    const h = parseFloat($el.attr("height") ?? "0");
    const rx = parseFloat($el.attr("rx") ?? "0");
    const ry = parseFloat($el.attr("ry") ?? "0");

    let mob: Rectangle | RoundedRectangle;
    if (rx === 0 || ry === 0) {
      mob = new Rectangle({ width: w, height: h });
    } else {
      mob = new RoundedRectangle({
        width: w,
        height: (h * rx) / ry,
        cornerRadius: rx,
      });
    }
    mob.shift(convertPointTo3d(x + w / 2, y + h / 2));
    return mob;
  }

  static ellipseToMobjectFromEl(
    $: CheerioAPI,
    el: AnyNode,
  ): Circle {
    const $el = $(el);
    const cx = parseFloat($el.attr("cx") ?? "0");
    const cy = parseFloat($el.attr("cy") ?? "0");
    const rx = parseFloat($el.attr("rx") ?? $el.attr("r") ?? "0");
    const ry = parseFloat($el.attr("ry") ?? $el.attr("r") ?? "0");

    const mob = new Circle({ radius: rx });
    mob.shift(convertPointTo3d(cx, cy));
    return mob;
  }

  static polygonToMobjectFromEl(
    $: CheerioAPI,
    el: AnyNode,
  ): Polygon {
    const pointsAttr = $(el).attr("points") ?? "";
    const points = parsePointsList(pointsAttr);
    return new Polygon(...points);
  }

  polylineToMobject(
    $: CheerioAPI,
    el: AnyNode,
  ): VMobject {
    const pointsAttr = $(el).attr("points") ?? "";
    const points = parsePointsList(pointsAttr);
    const vmob = new VMobject();
    vmob.setPointsAsCorners(points);
    return vmob;
  }

  static textToMobject(): VMobject | null {
    logger.warning("Unsupported element type: SVG <text>");
    return null;
  }

  moveIntoPosition(): void {
    if (this.shouldCenter) {
      this.center();
    }
    if (this.svgHeight != null) {
      this.set({ height: this.svgHeight });
    }
    if (this.svgWidth != null) {
      this.set({ width: this.svgWidth });
    }
  }
}

// ─── VMobjectFromSVGPath ─────────────────────────────────────

export interface VMobjectFromSVGPathOptions extends VMobjectStubOptions {
  pathString?: string;
  pathObj?: unknown;
  longLines?: boolean;
  shouldSubdivideSharpCurves?: boolean;
  shouldRemoveNullCurves?: boolean;
}

export class VMobjectFromSVGPath extends VMobject {
  pathString: string;
  longLines: boolean;
  shouldSubdivideSharpCurves: boolean;
  shouldRemoveNullCurves: boolean;

  constructor(options: VMobjectFromSVGPathOptions = {}) {
    const {
      pathString = "",
      longLines = false,
      shouldSubdivideSharpCurves = false,
      shouldRemoveNullCurves = false,
      ...vmobOptions
    } = options;

    super(vmobOptions);

    this.pathString = pathString;
    this.longLines = longLines;
    this.shouldSubdivideSharpCurves = shouldSubdivideSharpCurves;
    this.shouldRemoveNullCurves = shouldRemoveNullCurves;

    this.handleCommands();
  }

  override generatePoints(): void {
    this.handleCommands();

    if (config.renderer === "opengl") {
      // TODO: Port from OpenGL — needs manual rendering implementation
    }
  }

  initPoints(): void {
    this.generatePoints();
  }

  handleCommands(): void {
    if (!this.pathString || this.pathString.trim() === "") {
      this.points = np.zeros([0, 3]);
      return;
    }

    let normalizedPath: string;
    try {
      const commander = new SVGPathCommander(this.pathString);
      normalizedPath = commander.normalize().toString();
    } catch {
      this.points = np.zeros([0, 3]);
      return;
    }

    const allPoints: number[][] = [];
    let lastMove: number[] | null = null;
    let curveStart: number[] | null = null;
    let lastTrueMove: number[] | null = null;

    const movePen = (pt: number[], trueMove = false): void => {
      lastMove = pt;
      if (curveStart == null) {
        curveStart = lastMove;
      }
      if (trueMove) {
        lastTrueMove = lastMove;
      }
    };

    const addCubic = (
      start: number[],
      cp1: number[],
      cp2: number[],
      end: number[],
    ): void => {
      if (this.nPointsPerCurve === 4) {
        allPoints.push(start, cp1, cp2, end);
      } else {
        const s = np.array(start);
        const c1 = np.array(cp1);
        const c2 = np.array(cp2);
        const e = np.array(end);
        const twoQuads = getQuadraticApproximationOfCubic(s, c1, c2, e);
        for (let i = 0; i < 6; i++) {
          const row = twoQuads.get([i]) as unknown as NDArray;
          allPoints.push(row.toArray() as number[]);
        }
      }
      movePen(end);
    };

    const addLine = (start: number[], end: number[]): void => {
      if (this.nPointsPerCurve === 4) {
        const cp1 = start.map((v, d) => (2 * v + end[d]) / 3);
        const cp2 = start.map((v, d) => (v + 2 * end[d]) / 3);
        allPoints.push(start, cp1, cp2, end);
      } else {
        const mid = start.map((v, d) => (v + end[d]) / 2);
        allPoints.push(start, mid, end);
      }
      movePen(end);
    };

    const addQuad = (
      start: number[],
      cp: number[],
      end: number[],
    ): void => {
      if (this.nPointsPerCurve === 4) {
        const cp1 = start.map((v, d) => (v + 2 * cp[d]) / 3);
        const cp2 = end.map((v, d) => (2 * cp[d] + v) / 3);
        allPoints.push(start, cp1, cp2, end);
      } else {
        allPoints.push(start, cp, end);
      }
      movePen(end);
    };

    const segments = parsePathSegments(normalizedPath);

    for (const seg of segments) {
      switch (seg.type) {
        case "M": {
          movePen([seg.x, seg.y, 0], true);
          break;
        }
        case "L": {
          if (lastMove) {
            addLine(lastMove, [seg.x, seg.y, 0]);
          }
          break;
        }
        case "Q": {
          if (lastMove) {
            addQuad(
              lastMove,
              [seg.cpx, seg.cpy, 0],
              [seg.x, seg.y, 0],
            );
          }
          break;
        }
        case "C": {
          if (lastMove) {
            addCubic(
              lastMove,
              [seg.cp1x, seg.cp1y, 0],
              [seg.cp2x, seg.cp2y, 0],
              [seg.x, seg.y, 0],
            );
          }
          break;
        }
        case "Z": {
          if (lastMove && lastTrueMove) {
            const dx = lastMove[0] - lastTrueMove[0];
            const dy = lastMove[1] - lastTrueMove[1];
            const dz = lastMove[2] - lastTrueMove[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > 0.0001) {
              addLine(lastMove, lastTrueMove);
            }
          }
          curveStart = null;
          break;
        }
      }
    }

    if (allPoints.length > 0) {
      this.points = np.array(allPoints);
    } else {
      this.points = np.zeros([0, 3]);
    }
  }
}

// ─── Path segment parser ─────────────────────────────────────

interface PathSegment {
  type: string;
  x: number;
  y: number;
  cpx: number;
  cpy: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
}

function parsePathSegments(pathStr: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const cmdRegex = /([MLHVCSQTAZ])\s*((?:[-+]?\d*\.?\d+(?:e[-+]?\d+)?[\s,]*)*)/gi;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(pathStr)) !== null) {
    const cmd = match[1].toUpperCase();
    const numStr = match[2].trim();
    const nums = numStr
      ? numStr.split(/[\s,]+/).map(Number)
      : [];

    const empty = { cpx: 0, cpy: 0, cp1x: 0, cp1y: 0, cp2x: 0, cp2y: 0 };

    switch (cmd) {
      case "M": {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          segments.push({
            type: i === 0 ? "M" : "L",
            x: nums[i], y: nums[i + 1],
            ...empty,
          });
        }
        break;
      }
      case "L": {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          segments.push({ type: "L", x: nums[i], y: nums[i + 1], ...empty });
        }
        break;
      }
      case "H": {
        for (const n of nums) {
          segments.push({ type: "L", x: n, y: 0, ...empty });
        }
        break;
      }
      case "V": {
        for (const n of nums) {
          segments.push({ type: "L", x: 0, y: n, ...empty });
        }
        break;
      }
      case "C": {
        for (let i = 0; i + 5 < nums.length; i += 6) {
          segments.push({
            type: "C",
            cp1x: nums[i], cp1y: nums[i + 1],
            cp2x: nums[i + 2], cp2y: nums[i + 3],
            x: nums[i + 4], y: nums[i + 5],
            cpx: 0, cpy: 0,
          });
        }
        break;
      }
      case "Q": {
        for (let i = 0; i + 3 < nums.length; i += 4) {
          segments.push({
            type: "Q",
            cpx: nums[i], cpy: nums[i + 1],
            x: nums[i + 2], y: nums[i + 3],
            cp1x: 0, cp1y: 0, cp2x: 0, cp2y: 0,
          });
        }
        break;
      }
      case "Z": {
        segments.push({ type: "Z", x: 0, y: 0, ...empty });
        break;
      }
    }
  }

  return segments;
}

// Re-export stubs for use by brace.ts
export { VMobject as _VMobjectStub, VGroup as _VGroupStub, Line as _LineStub };
export { Circle as _CircleStub, Rectangle as _RectangleStub, RoundedRectangle as _RoundedRectangleStub };
export { Polygon as _PolygonStub };
export type { VMobjectStubOptions };
