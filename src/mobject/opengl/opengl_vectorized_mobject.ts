/**
 * OpenGL Vectorized Mobject — shapes drawn with Bezier curves.
 *
 * TypeScript port of manim/mobject/opengl/opengl_vectorized_mobject.py
 */

import type { NDArray } from "numpy-ts";

import {
  np,
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
  PI,
  TAU,
  DEGREES,
  interpolate,
} from "../../core/math/index.js";
import type { Point3D, Points3D } from "../../core/math/index.js";
import {
  ManimColor,
  type ParsableManimColor,
  colorToRgba,
} from "../../utils/color/index.js";
import {
  WHITE,
  BLACK,
} from "../../utils/color/manim_colors.js";
import {
  DEFAULT_STROKE_WIDTH,
  RendererType,
  LineJointType,
} from "../../constants/constants.js";
import {
  TRIANGLES,
  type ShaderData,
  type VertexDType,
  ShaderWrapper,
} from "../../renderer/shader_wrapper/index.js";
import {
  bezier,
  partialBezierPoints,
  getQuadraticApproximationOfCubic,
  getSmoothCubicBezierHandlePoints,
  bezierRemap,
  integerInterpolate,
  proportionsAlongBezierCurveForPoint,
} from "../../utils/bezier/index.js";
import {
  makeEven,
  resizeWithInterpolation,
  tuplify,
} from "../../utils/iterables/index.js";
import {
  angleBetweenVectors,
  cross2d,
  earclipTriangulation,
  getUnitNormal,
  shoelaceDirection,
  zToVector,
} from "../../utils/space_ops/index.js";

import {
  OpenGLMobject,
  OpenGLGroup,
  OpenGLPoint,
  type OpenGLMobjectOptions,
} from "./opengl_mobject.js";

// ─── Decorator ──────────────────────────────────────────────

export function triggersRefreshedTriangulation<T extends OpenGLVMobject>(
  _target: T,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value as Function;
  descriptor.value = function (this: OpenGLVMobject, ...args: unknown[]) {
    const result = originalMethod.apply(this, args);
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return result;
  };
  return descriptor;
}

// ─── Types ──────────────────────────────────────────────────

export interface OpenGLVMobjectOptions extends OpenGLMobjectOptions {
  fillColor?: ParsableManimColor | null;
  fillOpacity?: number;
  strokeColor?: ParsableManimColor | null;
  strokeOpacity?: number;
  strokeWidth?: number;
  drawStrokeBehindFill?: boolean;
  preFunctionHandleToAnchorScaleFactor?: number;
  makeSmoothAfterApplyingFunctions?: boolean;
  backgroundImageFile?: string | null;
  toleranceForPointEquality?: number;
  nPointsPerCurve?: number;
  longLines?: boolean;
  shouldSubdivideSharpCurves?: boolean;
  shouldRemoveNullCurves?: boolean;
  jointType?: LineJointType | null;
  flatStroke?: boolean;
  triangulationLocked?: boolean;
}

// ─── OpenGLVMobject ─────────────────────────────────────────

export class OpenGLVMobject extends OpenGLMobject {
  fillOpacity: number;
  strokeOpacity: number;
  drawStrokeBehindFill: boolean;
  preFunctionHandleToAnchorScaleFactor: number;
  makeSmoothAfterApplyingFunctions: boolean;
  backgroundImageFile: string | null;
  toleranceForPointEquality: number;
  nPointsPerCurve: number;
  longLines: boolean;
  shouldSubdivideSharpCurves: boolean;
  shouldRemoveNullCurves: boolean;
  jointType: LineJointType;
  flatStroke: boolean;
  triangulationLocked: boolean;

  needsNewTriangulation: boolean;
  triangulation: Int32Array;
  orientation: number;

  fillData: NDArray | null;
  strokeData: NDArray | null;
  fillShaderWrapper: ShaderWrapper | null;
  strokeShaderWrapper: ShaderWrapper | null;

  private _fillColor: ManimColor | null;
  private _strokeColor: ManimColor | null;

  static fillDtype: VertexDType = {
    names: ["point", "unit_normal", "color", "vert_index"],
  };

  static strokeDtype: VertexDType = {
    names: ["point", "prev_point", "next_point", "unit_normal", "stroke_width", "color"],
  };

  static strokeShaderFolder = "quadratic_bezier_stroke";
  static fillShaderFolder = "quadratic_bezier_fill";

  constructor(options: OpenGLVMobjectOptions = {}) {
    const {
      fillColor = null,
      fillOpacity = 0.0,
      strokeColor = null,
      strokeOpacity = 1.0,
      strokeWidth = DEFAULT_STROKE_WIDTH,
      drawStrokeBehindFill = false,
      preFunctionHandleToAnchorScaleFactor = 0.01,
      makeSmoothAfterApplyingFunctions = false,
      backgroundImageFile = null,
      toleranceForPointEquality = 1e-8,
      nPointsPerCurve = 3,
      longLines = false,
      shouldSubdivideSharpCurves = false,
      shouldRemoveNullCurves = false,
      jointType = null,
      flatStroke = true,
      triangulationLocked = false,
      ...baseOpts
    } = options;

    // Initialize VMobject-specific properties before super()
    // because initData/initColors are called in super constructor
    const self = { data: {} } as unknown as OpenGLVMobject;

    // These need to be set before super() calls initColors
    Object.defineProperty(OpenGLVMobject.prototype, '_preInitFillOpacity', {
      value: fillOpacity,
      writable: true,
      configurable: true,
    });

    super({ ...baseOpts, renderPrimitive: TRIANGLES });

    this.fillOpacity = fillOpacity;
    this.strokeOpacity = strokeOpacity;
    this.drawStrokeBehindFill = drawStrokeBehindFill;
    this.preFunctionHandleToAnchorScaleFactor = preFunctionHandleToAnchorScaleFactor;
    this.makeSmoothAfterApplyingFunctions = makeSmoothAfterApplyingFunctions;
    this.backgroundImageFile = backgroundImageFile;
    this.toleranceForPointEquality = toleranceForPointEquality;
    this.nPointsPerCurve = nPointsPerCurve;
    this.longLines = longLines;
    this.shouldSubdivideSharpCurves = shouldSubdivideSharpCurves;
    this.shouldRemoveNullCurves = shouldRemoveNullCurves;
    this.jointType = jointType ?? LineJointType.AUTO;
    this.flatStroke = flatStroke;
    this.triangulationLocked = triangulationLocked;

    this.needsNewTriangulation = true;
    this.triangulation = new Int32Array(0);
    this.orientation = 1;

    this.fillData = null;
    this.strokeData = null;
    this.fillShaderWrapper = null;
    this.strokeShaderWrapper = null;

    this._fillColor = null;
    this._strokeColor = null;

    this.refreshUnitNormal();

    if (fillColor != null) {
      this._fillColor = ManimColor.parse(fillColor) as ManimColor;
    }
    if (strokeColor != null) {
      this._strokeColor = ManimColor.parse(strokeColor) as ManimColor;
    }

    // Re-initialize colors with VMobject-specific logic
    this.initColors();
  }

  protected _assertValidSubmobjects(submobjects: Iterable<OpenGLMobject>): this {
    return this._assertValidSubmobjectsInternal(submobjects, OpenGLVMobject as unknown as new (...args: never[]) => OpenGLMobject);
  }

  // @ts-expect-error — VMobject narrows the group class to OpenGLVGroup
  getGroupClass(): typeof OpenGLVGroup {
    return OpenGLVGroup;
  }

  static getMobjectTypeClass(): typeof OpenGLVMobject {
    return OpenGLVMobject;
  }

  // @ts-expect-error — VMobject narrows submobjects to OpenGLVMobject[]
  get submobjects(): OpenGLVMobject[] {
    return this._submobjects as unknown as OpenGLVMobject[];
  }

  // @ts-expect-error — VMobject narrows submobjects to OpenGLVMobject[]
  set submobjects(value: OpenGLVMobject[]) {
    this.remove(...this._submobjects);
    this.add(...(value as unknown as OpenGLMobject[]));
  }

  // ── Data ──

  initData(): void {
    super.initData();
    delete this.data["rgbas"];
    this.data["fill_rgba"] = np.zeros([1, 4]);
    this.data["stroke_rgba"] = np.zeros([1, 4]);
    this.data["stroke_width"] = np.array([[DEFAULT_STROKE_WIDTH]]);
    this.data["unit_normal"] = np.zeros([1, 3]);
  }

  // ── Colors ──

  initColors(): void {
    this.setFill(
      this._fillColor ?? (this.color as ManimColor),
      this.fillOpacity,
    );
    this.setStroke(
      this._strokeColor ?? (this.color as ManimColor),
      this.data["stroke_width"]?.get([0, 0]) as number ?? DEFAULT_STROKE_WIDTH,
      this.strokeOpacity,
      this.drawStrokeBehindFill,
    );
    this.setGloss(this.gloss);
    this.setFlatStroke(this.flatStroke);
  }

  setFill(
    color?: ParsableManimColor | null,
    opacity?: number,
    recurse = true,
  ): this {
    if (opacity != null) {
      this.fillOpacity = opacity;
    }
    if (recurse) {
      for (const submob of this._submobjects) {
        (submob as unknown as OpenGLVMobject).setFill(color, opacity, recurse);
      }
    }
    this.setRgbaArray(color ?? undefined, opacity, "fill_rgba", recurse);
    return this;
  }

  setStroke(
    color?: ParsableManimColor | null,
    width?: number,
    opacity?: number,
    background?: boolean,
    recurse = true,
  ): this {
    if (opacity != null) {
      this.strokeOpacity = opacity;
    }
    if (recurse) {
      for (const submob of this._submobjects) {
        (submob as unknown as OpenGLVMobject).setStroke(color, width, opacity, background, recurse);
      }
    }
    this.setRgbaArray(color ?? undefined, opacity, "stroke_rgba", recurse);

    if (width != null) {
      for (const mob of this.getFamily(recurse)) {
        const vmob = mob as unknown as OpenGLVMobject;
        vmob.data["stroke_width"] = np.array([[width]]);
      }
    }
    if (background != null) {
      for (const mob of this.getFamily(recurse)) {
        (mob as unknown as OpenGLVMobject).drawStrokeBehindFill = background;
      }
    }
    return this;
  }

  setStyle(options: {
    fillColor?: ParsableManimColor | null;
    fillOpacity?: number;
    fillRgba?: NDArray;
    strokeColor?: ParsableManimColor | null;
    strokeOpacity?: number;
    strokeRgba?: NDArray;
    strokeWidth?: number;
    gloss?: number;
    shadow?: number;
    recurse?: boolean;
  } = {}): this {
    const {
      fillColor, fillOpacity,
      fillRgba, strokeColor,
      strokeOpacity, strokeRgba,
      strokeWidth, gloss, shadow,
      recurse = true,
    } = options;

    if (fillRgba != null) {
      this.data["fill_rgba"] = resizeWithInterpolation(fillRgba, fillRgba.shape[0]);
    } else {
      this.setFill(fillColor, fillOpacity, recurse);
    }

    if (strokeRgba != null) {
      this.data["stroke_rgba"] = resizeWithInterpolation(strokeRgba, strokeRgba.shape[0]);
      this.setStroke(undefined, strokeWidth);
    } else {
      this.setStroke(strokeColor, strokeWidth, strokeOpacity, undefined, recurse);
    }

    if (gloss != null) this.setGloss(gloss, recurse);
    if (shadow != null) this.setShadow(shadow, recurse);
    return this;
  }

  getStyle(): Record<string, unknown> {
    return {
      fillRgba: this.data["fill_rgba"],
      strokeRgba: this.data["stroke_rgba"],
      strokeWidth: this.data["stroke_width"],
      gloss: this.gloss,
      shadow: this.shadow,
    };
  }

  matchStyle(vmobject: OpenGLVMobject, recurse = true): this {
    const style = vmobject.getStyle();
    this.setStyle({
      fillRgba: style.fillRgba as NDArray | undefined,
      strokeRgba: style.strokeRgba as NDArray | undefined,
      strokeWidth: (style.strokeWidth as NDArray)?.get([0, 0]) as number | undefined,
      gloss: style.gloss as number | undefined,
      shadow: style.shadow as number | undefined,
      recurse: false,
    });
    if (recurse) {
      const submobs1 = this.submobjects;
      let submobs2 = vmobject.submobjects;
      if (submobs1.length === 0) return this;
      if (submobs2.length === 0) submobs2 = [vmobject];
      const [even1, even2] = makeEven(submobs1, submobs2);
      for (let i = 0; i < even1.length; i++) {
        (even1[i] as unknown as OpenGLVMobject).matchStyle(even2[i] as unknown as OpenGLVMobject);
      }
    }
    return this;
  }

  setColor(
    color: ParsableManimColor | ParsableManimColor[],
    opacity?: number,
    recurse = true,
  ): this {
    if (opacity != null) {
      this.opacity = opacity;
    }
    this.setFill(color as ParsableManimColor, opacity, recurse);
    this.setStroke(color as ParsableManimColor, undefined, opacity, undefined, recurse);
    return this;
  }

  setOpacity(opacity: number, recurse = true): this {
    this.setFill(undefined, opacity, recurse);
    this.setStroke(undefined, undefined, opacity, undefined, recurse);
    return this;
  }

  fade(darkness = 0.5, recurse = true): this {
    const factor = 1.0 - darkness;
    this.setFill(undefined, factor * this.getFillOpacity(), false);
    this.setStroke(undefined, undefined, factor * this.getStrokeOpacity(), undefined, false);
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.fade(darkness, recurse);
      }
    }
    return this;
  }

  // ── Color getters ──

  getFillColors(): ManimColor[] {
    const rgba = this.data["fill_rgba"];
    if (!rgba || rgba.shape[0] === 0) return [];
    const colors: ManimColor[] = [];
    for (let i = 0; i < rgba.shape[0]; i++) {
      colors.push(ManimColor.fromRgb([
        rgba.get([i, 0]) as number,
        rgba.get([i, 1]) as number,
        rgba.get([i, 2]) as number,
      ]));
    }
    return colors;
  }

  getFillOpacities(): number[] {
    const rgba = this.data["fill_rgba"];
    if (!rgba || rgba.shape[0] === 0) return [];
    const opacities: number[] = [];
    for (let i = 0; i < rgba.shape[0]; i++) {
      opacities.push(rgba.get([i, 3]) as number);
    }
    return opacities;
  }

  getStrokeColors(): ManimColor[] {
    const rgba = this.data["stroke_rgba"];
    if (!rgba || rgba.shape[0] === 0) return [];
    const colors: ManimColor[] = [];
    for (let i = 0; i < rgba.shape[0]; i++) {
      colors.push(ManimColor.fromRgb([
        rgba.get([i, 0]) as number,
        rgba.get([i, 1]) as number,
        rgba.get([i, 2]) as number,
      ]));
    }
    return colors;
  }

  getStrokeOpacities(): number[] {
    const rgba = this.data["stroke_rgba"];
    if (!rgba || rgba.shape[0] === 0) return [];
    const opacities: number[] = [];
    for (let i = 0; i < rgba.shape[0]; i++) {
      opacities.push(rgba.get([i, 3]) as number);
    }
    return opacities;
  }

  getStrokeWidths(): NDArray {
    return this.data["stroke_width"];
  }

  getFillColor(): ManimColor {
    const colors = this.getFillColors();
    return colors[0] ?? (WHITE as unknown as ManimColor);
  }

  getFillOpacity(): number {
    const opacities = this.getFillOpacities();
    return opacities[0] ?? 0;
  }

  getStrokeColor(): ManimColor {
    const colors = this.getStrokeColors();
    return colors[0] ?? (WHITE as unknown as ManimColor);
  }

  getStrokeWidth(): number {
    const sw = this.data["stroke_width"];
    if (!sw || sw.shape[0] === 0) return DEFAULT_STROKE_WIDTH;
    return sw.get([0, 0]) as number;
  }

  getStrokeOpacity(): number {
    const opacities = this.getStrokeOpacities();
    return opacities[0] ?? 1;
  }

  // @ts-expect-error — VMobject returns ManimColor (richer than base string)
  getColor(): ManimColor {
    if (!this.hasFill()) {
      return this.getStrokeColor();
    }
    return this.getFillColor();
  }

  get strokeColor(): ManimColor {
    return this.getStrokeColor();
  }

  set strokeColor(value: ParsableManimColor) {
    this.setStroke(value);
  }

  get fillColor(): ManimColor {
    return this.getFillColor();
  }

  set fillColor(value: ParsableManimColor) {
    this.setFill(value);
  }

  hasStroke(): boolean {
    const widths = this.getStrokeWidths();
    const opacities = this.getStrokeOpacities();
    return widths != null && opacities != null &&
      opacities.some((o) => o > 0) &&
      (widths.shape[0] > 0);
  }

  hasFill(): boolean {
    const opacities = this.getFillOpacities();
    return opacities != null && opacities.some((o) => o > 0);
  }

  getOpacity(): number {
    if (this.hasFill()) return this.getFillOpacity();
    return this.getStrokeOpacity();
  }

  setFlatStroke(flatStroke = true, recurse = true): this {
    for (const mob of this.getFamily(recurse)) {
      (mob as unknown as OpenGLVMobject).flatStroke = flatStroke;
    }
    return this;
  }

  getFlatStroke(): boolean {
    return this.flatStroke;
  }

  // ── Points / Bezier ──

  setAnchorsAndHandles(anchors1: NDArray, handles: NDArray, anchors2: NDArray): this {
    const nppc = this.nPointsPerCurve;
    const n = anchors1.shape[0];
    const newPoints: number[][] = [];
    for (let i = 0; i < n; i++) {
      const arrays = [anchors1, handles, anchors2];
      for (let idx = 0; idx < nppc; idx++) {
        const arr = arrays[idx];
        const row: number[] = [];
        for (let j = 0; j < this.dim; j++) {
          row.push(arr.get([i, j]) as number);
        }
        newPoints.push(row);
      }
    }
    this.setPoints(np.array(newPoints));
    return this;
  }

  startNewPath(point: Point3D): this {
    this.appendPoints(np.array([point.toArray()]));
    return this;
  }

  addCubicBezierCurve(
    anchor1: Point3D,
    handle1: Point3D,
    handle2: Point3D,
    anchor2: Point3D,
  ): void {
    const newPoints = getQuadraticApproximationOfCubic(
      anchor1, handle1, handle2, anchor2,
    );
    this.appendPoints(newPoints);
  }

  addCubicBezierCurveTo(handle1: Point3D, handle2: Point3D, anchor: Point3D): void {
    this.throwErrorIfNoPoints();
    const quadraticApprox = getQuadraticApproximationOfCubic(
      this.getLastPoint(), handle1, handle2, anchor,
    );
    if (this.hasNewPathStarted()) {
      // Skip the first point (it duplicates existing last point)
      const rows: number[][] = [];
      for (let i = 1; i < quadraticApprox.shape[0]; i++) {
        const row: number[] = [];
        for (let j = 0; j < quadraticApprox.shape[1]; j++) {
          row.push(quadraticApprox.get([i, j]) as number);
        }
        rows.push(row);
      }
      this.appendPoints(np.array(rows));
    } else {
      this.appendPoints(quadraticApprox);
    }
  }

  addQuadraticBezierCurveTo(handle: Point3D, anchor: Point3D): void {
    this.throwErrorIfNoPoints();
    if (this.hasNewPathStarted()) {
      this.appendPoints(np.array([handle.toArray(), anchor.toArray()]));
    } else {
      const lastPt = this.getLastPoint();
      this.appendPoints(np.array([lastPt.toArray(), handle.toArray(), anchor.toArray()]));
    }
  }

  addLineTo(point: Point3D): this {
    const end = this.getLastPoint();
    const nppc = this.nPointsPerCurve;
    const alphas: number[] = [];
    for (let i = 0; i <= nppc - 1; i++) {
      alphas.push(i / (nppc - 1));
    }

    let points: number[][];
    if (this.longLines) {
      const halfway: number[] = [];
      for (let j = 0; j < this.dim; j++) {
        halfway.push(interpolate(end.get([j]) as number, point.get([j]) as number, 0.5));
      }
      const hwPt = np.array(halfway);
      const pts1 = alphas.map((a) => {
        const row: number[] = [];
        for (let j = 0; j < this.dim; j++) {
          row.push(interpolate(end.get([j]) as number, hwPt.get([j]) as number, a));
        }
        return row;
      });
      const pts2 = alphas.map((a) => {
        const row: number[] = [];
        for (let j = 0; j < this.dim; j++) {
          row.push(interpolate(hwPt.get([j]) as number, point.get([j]) as number, a));
        }
        return row;
      });
      points = [...pts1, ...pts2];
    } else {
      points = alphas.map((a) => {
        const row: number[] = [];
        for (let j = 0; j < this.dim; j++) {
          row.push(interpolate(end.get([j]) as number, point.get([j]) as number, a));
        }
        return row;
      });
    }

    if (this.hasNewPathStarted()) {
      points = points.slice(1);
    }
    this.appendPoints(np.array(points));
    return this;
  }

  addSmoothCurveTo(point: Point3D): this {
    if (this.hasNewPathStarted()) {
      this.addLineTo(point);
    } else {
      this.throwErrorIfNoPoints();
      const newHandle = this.getReflectionOfLastHandle();
      this.addQuadraticBezierCurveTo(newHandle, point);
    }
    return this;
  }

  addSmoothCubicCurveTo(handle: Point3D, point: Point3D): void {
    this.throwErrorIfNoPoints();
    const newHandle = this.getReflectionOfLastHandle();
    this.addCubicBezierCurveTo(newHandle, handle, point);
  }

  hasNewPathStarted(): boolean {
    return this.getNumPoints() % this.nPointsPerCurve === 1;
  }

  getLastPoint(): Point3D {
    const pts = this.points;
    const lastIdx = pts.shape[0] - 1;
    const row: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      row.push(pts.get([lastIdx, j]) as number);
    }
    return np.array(row);
  }

  getReflectionOfLastHandle(): Point3D {
    const pts = this.points;
    const n = pts.shape[0];
    const result: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      result.push(
        2 * (pts.get([n - 1, j]) as number) - (pts.get([n - 2, j]) as number),
      );
    }
    return np.array(result);
  }

  closePath(): void {
    if (!this.isClosed()) {
      const subpaths = this.getSubpaths();
      if (subpaths.length > 0) {
        const lastSubpath = subpaths[subpaths.length - 1];
        const firstPt: number[] = [];
        for (let j = 0; j < lastSubpath.shape[1]; j++) {
          firstPt.push(lastSubpath.get([0, j]) as number);
        }
        this.addLineTo(np.array(firstPt));
      }
    }
  }

  isClosed(): boolean {
    if (this.getNumPoints() < 2) return false;
    return this.considerPointsEquals(this.getStart(), this.getEnd());
  }

  addSubpath(points: NDArray): this {
    this.appendPoints(points);
    return this;
  }

  appendVectorizedMobject(vectorizedMobject: OpenGLVMobject): this {
    const newPoints = vectorizedMobject.points;
    if (this.hasNewPathStarted()) {
      // Remove the trailing path-start point
      this.resizePoints(this.getNumPoints() - 1);
    }
    this.appendPoints(newPoints);
    return this;
  }

  considerPointsEquals(p0: Point3D, p1: Point3D): boolean {
    return (np.linalg.norm(p1.subtract(p0)) as number) < this.toleranceForPointEquality;
  }

  // ── Curve info ──

  forceDirection(targetDirection: "CW" | "CCW"): this {
    if (targetDirection !== "CW" && targetDirection !== "CCW") {
      throw new Error('Invalid input for forceDirection. Use "CW" or "CCW"');
    }
    if (this.getDirection() !== targetDirection) {
      this.reversePoints();
    }
    return this;
  }

  reverseDirection(): this {
    const reversed: number[][] = [];
    for (let i = this.points.shape[0] - 1; i >= 0; i--) {
      const row: number[] = [];
      for (let j = 0; j < this.points.shape[1]; j++) {
        row.push(this.points.get([i, j]) as number);
      }
      reversed.push(row);
    }
    this.setPoints(np.array(reversed.length > 0 ? reversed : [[0, 0, 0]]));
    return this;
  }

  getDirection(): "CW" | "CCW" {
    // Determine winding direction using shoelace formula on 2D projection
    if (this.getNumPoints() < 3) return "CCW";
    const pts = this.points;
    let area = 0;
    const n = pts.shape[0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += (pts.get([i, 0]) as number) * (pts.get([j, 1]) as number);
      area -= (pts.get([j, 0]) as number) * (pts.get([i, 1]) as number);
    }
    return area >= 0 ? "CCW" : "CW";
  }

  getBezierTuplesFromPoints(points: NDArray): NDArray[] {
    const nppc = this.nPointsPerCurve;
    const n = points.shape[0];
    const remainder = n % nppc;
    const usable = n - remainder;
    const tuples: NDArray[] = [];
    for (let i = 0; i < usable; i += nppc) {
      const rows: number[][] = [];
      for (let k = 0; k < nppc; k++) {
        const row: number[] = [];
        for (let j = 0; j < points.shape[1]; j++) {
          row.push(points.get([i + k, j]) as number);
        }
        rows.push(row);
      }
      tuples.push(np.array(rows));
    }
    return tuples;
  }

  getBezierTuples(): NDArray[] {
    return this.getBezierTuplesFromPoints(this.points);
  }

  getSubpathsFromPoints(points: NDArray): NDArray[] {
    const nppc = this.nPointsPerCurve;
    const n = points.shape[0];
    if (n < nppc) return [];

    const splitIndices: number[] = [0];
    for (let i = nppc; i < n; i += nppc) {
      let dist = 0;
      for (let j = 0; j < points.shape[1]; j++) {
        const d = (points.get([i - 1, j]) as number) - (points.get([i, j]) as number);
        dist += d * d;
      }
      if (dist > this.toleranceForPointEquality) {
        splitIndices.push(i);
      }
    }
    splitIndices.push(n);

    const subpaths: NDArray[] = [];
    for (let k = 0; k < splitIndices.length - 1; k++) {
      const i1 = splitIndices[k];
      const i2 = splitIndices[k + 1];
      if (i2 - i1 >= nppc) {
        const rows: number[][] = [];
        for (let i = i1; i < i2; i++) {
          const row: number[] = [];
          for (let j = 0; j < points.shape[1]; j++) {
            row.push(points.get([i, j]) as number);
          }
          rows.push(row);
        }
        subpaths.push(np.array(rows));
      }
    }
    return subpaths;
  }

  getSubpaths(): NDArray[] {
    return this.getSubpathsFromPoints(this.points);
  }

  getNthCurvePoints(n: number): NDArray {
    const nppc = this.nPointsPerCurve;
    const start = n * nppc;
    const rows: number[][] = [];
    for (let i = start; i < start + nppc && i < this.points.shape[0]; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.points.shape[1]; j++) {
        row.push(this.points.get([i, j]) as number);
      }
      rows.push(row);
    }
    return np.array(rows.length > 0 ? rows : [[0, 0, 0]]);
  }

  getNthCurveFunctionApprox(n: number, numPoints = 10): (t: number) => Point3D {
    const curvePoints = this.getNthCurvePoints(n);
    return bezier(curvePoints);
  }

  getNumCurves(): number {
    return Math.floor(this.getNumPoints() / this.nPointsPerCurve);
  }

  getCurveFunctions(): Array<(t: number) => Point3D> {
    const numCurves = this.getNumCurves();
    return Array.from({ length: numCurves }, (_, i) =>
      this.getNthCurveFunctionApprox(i),
    );
  }

  getCurveFunctionsWithLengths(): Array<{ fn: (t: number) => Point3D; length: number }> {
    const numCurves = this.getNumCurves();
    return Array.from({ length: numCurves }, (_, i) => {
      const fn = this.getNthCurveFunctionApprox(i);
      return { fn, length: this.getNthCurveLength(i) };
    });
  }

  getNthCurveLength(n: number, samplePoints = 10): number {
    const fn = this.getNthCurveFunctionApprox(n);
    let length = 0;
    let prevPoint = fn(0);
    for (let i = 1; i <= samplePoints; i++) {
      const t = i / samplePoints;
      const nextPoint = fn(t);
      length += np.linalg.norm(nextPoint.subtract(prevPoint)) as number;
      prevPoint = nextPoint;
    }
    return length;
  }

  getArcLength(samplePoints = 10): number {
    let totalLength = 0;
    for (let i = 0; i < this.getNumCurves(); i++) {
      totalLength += this.getNthCurveLength(i, samplePoints);
    }
    return totalLength;
  }

  getAnchors(): NDArray {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    if (pts.shape[0] === 0) return np.zeros([0, 3]);
    const anchors: number[][] = [];
    for (let i = 0; i < pts.shape[0]; i += nppc) {
      const row: number[] = [];
      for (let j = 0; j < pts.shape[1]; j++) {
        row.push(pts.get([i, j]) as number);
      }
      anchors.push(row);
    }
    // Add the last anchor if it's a full curve
    const lastIdx = pts.shape[0] - 1;
    if (lastIdx >= 0 && lastIdx % nppc === nppc - 1) {
      const row: number[] = [];
      for (let j = 0; j < pts.shape[1]; j++) {
        row.push(pts.get([lastIdx, j]) as number);
      }
      anchors.push(row);
    }
    return np.array(anchors);
  }

  getStartAnchors(): NDArray {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    if (pts.shape[0] === 0) return np.zeros([0, 3]);
    const anchors: number[][] = [];
    for (let i = 0; i < pts.shape[0]; i += nppc) {
      const row: number[] = [];
      for (let j = 0; j < pts.shape[1]; j++) {
        row.push(pts.get([i, j]) as number);
      }
      anchors.push(row);
    }
    return np.array(anchors);
  }

  getEndAnchors(): NDArray {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    if (pts.shape[0] === 0) return np.zeros([0, 3]);
    const anchors: number[][] = [];
    for (let i = nppc - 1; i < pts.shape[0]; i += nppc) {
      const row: number[] = [];
      for (let j = 0; j < pts.shape[1]; j++) {
        row.push(pts.get([i, j]) as number);
      }
      anchors.push(row);
    }
    return np.array(anchors);
  }

  // ── Corner/Smooth modes ──

  addPointsAsCorners(points: NDArray | number[][]): this {
    const arr = Array.isArray(points) ? np.array(points) : points;
    for (let i = 0; i < arr.shape[0]; i++) {
      const row: number[] = [];
      for (let j = 0; j < arr.shape[1]; j++) {
        row.push(arr.get([i, j]) as number);
      }
      this.addLineTo(np.array(row));
    }
    return this;
  }

  setPointsAsCorners(points: NDArray | number[][]): this {
    const arr = Array.isArray(points) ? np.array(points) : points;
    const nppc = this.nPointsPerCurve;
    const n = arr.shape[0];
    if (n < 2) return this;

    // Build anchors1, handles (midpoints for quadratic), anchors2
    const anchors1: number[][] = [];
    const handles: number[][] = [];
    const anchors2: number[][] = [];

    for (let i = 0; i < n - 1; i++) {
      const row1: number[] = [];
      const rowH: number[] = [];
      const row2: number[] = [];
      for (let j = 0; j < arr.shape[1]; j++) {
        const a = arr.get([i, j]) as number;
        const b = arr.get([i + 1, j]) as number;
        row1.push(a);
        rowH.push(interpolate(a, b, 0.5));
        row2.push(b);
      }
      anchors1.push(row1);
      handles.push(rowH);
      anchors2.push(row2);
    }

    this.setAnchorsAndHandles(
      np.array(anchors1),
      np.array(handles),
      np.array(anchors2),
    );
    return this;
  }

  setPointsSmoothly(points: NDArray | number[][]): this {
    this.setPointsAsCorners(points);
    this.makeSmooth();
    return this;
  }

  changeAnchorMode(mode: "jagged" | "approx_smooth" | "true_smooth"): this {
    const nppc = this.nPointsPerCurve;
    for (const submob of this.familyMembersWithPoints() as unknown as OpenGLVMobject[]) {
      const subpaths = submob.getSubpaths();
      submob.clearPoints();
      for (const subpath of subpaths) {
        // Extract anchors
        const anchors: number[][] = [];
        for (let i = 0; i < subpath.shape[0]; i += nppc) {
          const row: number[] = [];
          for (let j = 0; j < subpath.shape[1]; j++) {
            row.push(subpath.get([i, j]) as number);
          }
          anchors.push(row);
        }
        // Add last anchor
        const lastRow: number[] = [];
        for (let j = 0; j < subpath.shape[1]; j++) {
          lastRow.push(subpath.get([subpath.shape[0] - 1, j]) as number);
        }
        anchors.push(lastRow);

        const anchorArr = np.array(anchors);

        if (mode === "true_smooth") {
          const [h1, h2] = getSmoothCubicBezierHandlePoints(anchorArr);
          // Get anchors without last
          const anchorsWithoutLast = np.array(anchors.slice(0, -1));
          const anchorsWithoutFirst = np.array(anchors.slice(1));
          const newSubpath = getQuadraticApproximationOfCubic(
            anchorsWithoutLast, h1, h2, anchorsWithoutFirst,
          );
          submob.appendPoints(newSubpath);
        } else if (mode === "jagged") {
          // Handles are midpoints of consecutive anchors
          const newPoints: number[][] = [];
          for (let i = 0; i < anchors.length - 1; i++) {
            newPoints.push(anchors[i]);
            const midRow: number[] = [];
            for (let j = 0; j < anchors[i].length; j++) {
              midRow.push((anchors[i][j] + anchors[i + 1][j]) / 2);
            }
            newPoints.push(midRow);
            newPoints.push(anchors[i + 1]);
          }
          submob.appendPoints(np.array(newPoints.length > 0 ? newPoints : [[0, 0, 0]]));
        }
      }
      submob.refreshTriangulation();
    }
    return this;
  }

  makeSmooth(): this {
    this.changeAnchorMode("true_smooth");
    return this;
  }

  makeApproximatelySmooth(): this {
    this.changeAnchorMode("approx_smooth");
    return this;
  }

  makeJagged(): this {
    this.changeAnchorMode("jagged");
    return this;
  }

  // ── Point proportion ──

  pointFromProportion(alpha: number): Point3D {
    if (this.getNumCurves() === 0) return ORIGIN;

    const curvesWithLengths = this.getCurveFunctionsWithLengths();
    const totalLength = curvesWithLengths.reduce((s, c) => s + c.length, 0);
    if (totalLength === 0) return this.getStart();

    const targetLength = alpha * totalLength;
    let accumulated = 0;
    for (const { fn, length } of curvesWithLengths) {
      if (accumulated + length >= targetLength) {
        const residue = length > 0 ? (targetLength - accumulated) / length : 0;
        return fn(residue);
      }
      accumulated += length;
    }
    return this.getEnd();
  }

  pfp(alpha: number): Point3D {
    return this.pointFromProportion(alpha);
  }

  // ── Triangulation ──

  refreshTriangulation(): this {
    for (const mob of this.getFamily()) {
      (mob as unknown as OpenGLVMobject).needsNewTriangulation = true;
    }
    return this;
  }

  getTriangulation(normalVector?: Point3D): Int32Array {
    if (normalVector == null) {
      normalVector = this.getUnitNormalVec();
    }

    if (!this.needsNewTriangulation) {
      return this.triangulation;
    }

    const pts = this.points;
    if (pts.shape[0] <= 1) {
      this.triangulation = new Int32Array(0);
      this.needsNewTriangulation = false;
      return this.triangulation;
    }

    // Rotate points so normal aligns with OUT if needed
    let workPoints = pts;
    const outVec = np.array([0, 0, 1]);
    if (!np.allclose(normalVector, outVec)) {
      const zMat = zToVector(normalVector);
      // Apply rotation: workPoints = pts dot zMat
      const rows: number[][] = [];
      for (let i = 0; i < pts.shape[0]; i++) {
        const p = [pts.get([i, 0]) as number, pts.get([i, 1]) as number, pts.get([i, 2]) as number];
        const r = [
          p[0] * (zMat.get([0, 0]) as number) + p[1] * (zMat.get([1, 0]) as number) + p[2] * (zMat.get([2, 0]) as number),
          p[0] * (zMat.get([0, 1]) as number) + p[1] * (zMat.get([1, 1]) as number) + p[2] * (zMat.get([2, 1]) as number),
          p[0] * (zMat.get([0, 2]) as number) + p[1] * (zMat.get([1, 2]) as number) + p[2] * (zMat.get([2, 2]) as number),
        ];
        rows.push(r);
      }
      workPoints = np.array(rows);
    }

    const n = workPoints.shape[0];
    const nppc = 3; // n_points_per_curve for quadratic bezier

    // Build indices array
    const indices: number[] = [];
    for (let i = 0; i < n; i++) indices.push(i);

    // Compute convexities for each bezier curve
    const numCurves = Math.floor(n / nppc);
    const atol = this.toleranceForPointEquality;

    const concaveParts: boolean[] = [];
    const endOfLoop: boolean[] = [];

    for (let c = 0; c < numCurves; c++) {
      const b0 = c * nppc;
      const b1 = b0 + 1;
      const b2 = b0 + 2;

      const v01x = (workPoints.get([b1, 0]) as number) - (workPoints.get([b0, 0]) as number);
      const v01y = (workPoints.get([b1, 1]) as number) - (workPoints.get([b0, 1]) as number);
      const v12x = (workPoints.get([b2, 0]) as number) - (workPoints.get([b1, 0]) as number);
      const v12y = (workPoints.get([b2, 1]) as number) - (workPoints.get([b1, 1]) as number);

      const crossVal = v01x * v12y - v01y * v12x;
      concaveParts.push(crossVal < 0);

      if (c < numCurves - 1) {
        const nextB0 = (c + 1) * nppc;
        let isDiff = false;
        for (let j = 0; j < workPoints.shape[1]; j++) {
          if (Math.abs((workPoints.get([b2, j]) as number) - (workPoints.get([nextB0, j]) as number)) > atol) {
            isDiff = true;
            break;
          }
        }
        endOfLoop.push(isDiff);
      } else {
        endOfLoop.push(true);
      }
    }

    // Inner vertex indices for polygon triangulation
    const innerVertIndices: number[] = [];
    for (let c = 0; c < numCurves; c++) {
      innerVertIndices.push(c * nppc); // b0 (start anchors)
      if (concaveParts[c]) {
        innerVertIndices.push(c * nppc + 1); // concave handles
      }
      if (endOfLoop[c]) {
        innerVertIndices.push(c * nppc + 2); // end-of-loop anchors
      }
    }
    innerVertIndices.sort((a, b) => a - b);

    // Compute ring boundaries
    const rings: number[] = [];
    for (let k = 0; k < innerVertIndices.length; k++) {
      if (innerVertIndices[k] % nppc === 2) {
        rings.push(k + 1);
      }
    }

    // Triangulate inner vertices
    const innerVerts: number[][] = [];
    for (const idx of innerVertIndices) {
      innerVerts.push([
        workPoints.get([idx, 0]) as number,
        workPoints.get([idx, 1]) as number,
        workPoints.get([idx, 2]) as number,
      ]);
    }

    let innerTriIndices: number[] = [];
    if (innerVerts.length >= 3) {
      const earclipResult = earclipTriangulation(np.array(innerVerts), rings);
      innerTriIndices = earclipResult.map((i: number) => innerVertIndices[i]);
    }

    // Combine: all point indices (for bezier triangles) + inner triangulation
    const triIndices = new Int32Array(indices.length + innerTriIndices.length);
    for (let i = 0; i < indices.length; i++) {
      triIndices[i] = indices[i];
    }
    for (let i = 0; i < innerTriIndices.length; i++) {
      triIndices[indices.length + i] = innerTriIndices[i];
    }

    this.triangulation = triIndices;
    this.needsNewTriangulation = false;
    return triIndices;
  }

  refreshUnitNormal(): this {
    for (const mob of this.getFamily()) {
      const vmob = mob as unknown as OpenGLVMobject;
      const normal = vmob.getUnitNormalVec(true);
      vmob.data["unit_normal"] = np.array([[
        normal.get([0]) as number,
        normal.get([1]) as number,
        normal.get([2]) as number,
      ]]);
    }
    return this;
  }

  getAreaVector(): Point3D {
    if (!this.hasPoints()) return np.array([0, 0, 0]);

    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    const n = pts.shape[0];

    // Get start anchors (p0) and end anchors (p1) for each curve
    let sumYZ = 0, sumZX = 0, sumXY = 0;
    for (let c = 0; c * nppc + nppc - 1 < n; c++) {
      const i0 = c * nppc;
      const i1 = i0 + nppc - 1;
      const p0x = pts.get([i0, 0]) as number;
      const p0y = pts.get([i0, 1]) as number;
      const p0z = pts.get([i0, 2]) as number;
      const p1x = pts.get([i1, 0]) as number;
      const p1y = pts.get([i1, 1]) as number;
      const p1z = pts.get([i1, 2]) as number;

      sumYZ += (p0y + p1y) * (p1z - p0z);
      sumZX += (p0z + p1z) * (p1x - p0x);
      sumXY += (p0x + p1x) * (p1y - p0y);
    }
    return np.array([0.5 * sumYZ, 0.5 * sumZX, 0.5 * sumXY]);
  }

  getUnitNormalVec(recompute = false): Point3D {
    if (!recompute) {
      const un = this.data["unit_normal"];
      if (un && un.shape[0] > 0) {
        return np.array([
          un.get([0, 0]) as number,
          un.get([0, 1]) as number,
          un.get([0, 2]) as number,
        ]);
      }
    }

    if (this.getNumPoints() < 3) {
      return np.array([0, 0, 1]); // OUT
    }

    const areaVect = this.getAreaVector();
    const area = np.linalg.norm(areaVect) as number;
    if (area > 0) {
      return np.array([
        (areaVect.get([0]) as number) / area,
        (areaVect.get([1]) as number) / area,
        (areaVect.get([2]) as number) / area,
      ]);
    }
    // Fallback: use first three points
    const pts = this.points;
    const v0 = np.array([
      (pts.get([1, 0]) as number) - (pts.get([0, 0]) as number),
      (pts.get([1, 1]) as number) - (pts.get([0, 1]) as number),
      (pts.get([1, 2]) as number) - (pts.get([0, 2]) as number),
    ]);
    const v1 = np.array([
      (pts.get([2, 0]) as number) - (pts.get([1, 0]) as number),
      (pts.get([2, 1]) as number) - (pts.get([1, 1]) as number),
      (pts.get([2, 2]) as number) - (pts.get([1, 2]) as number),
    ]);
    return getUnitNormal(v0, v1);
  }

  // Keep backward-compatible getUnitNormal alias
  getUnitNormal(): Point3D {
    return this.getUnitNormalVec();
  }

  // ── Alignment ──

  alignPoints(mobject: OpenGLMobject): this {
    if (!(mobject instanceof OpenGLVMobject)) {
      return super.alignPoints(mobject);
    }
    // Align number of subpaths
    const subpaths1 = this.getSubpaths();
    const subpaths2 = (mobject as unknown as OpenGLVMobject).getSubpaths();

    const n1 = subpaths1.length;
    const n2 = subpaths2.length;

    if (n1 !== n2) {
      const maxN = Math.max(n1, n2);
      if (n1 < maxN) {
        this.insertNCurves(maxN - n1);
      }
      if (n2 < maxN) {
        (mobject as unknown as OpenGLVMobject).insertNCurves(maxN - n2);
      }
    }

    // Align number of curves in each subpath
    const newSelf = this.getSubpaths();
    const newOther = (mobject as unknown as OpenGLVMobject).getSubpaths();
    for (let i = 0; i < Math.min(newSelf.length, newOther.length); i++) {
      const c1 = newSelf[i].shape[0] / this.nPointsPerCurve;
      const c2 = newOther[i].shape[0] / this.nPointsPerCurve;
      if (c1 < c2) {
        this.insertNCurves(Math.ceil(c2 - c1));
      } else if (c2 < c1) {
        (mobject as unknown as OpenGLVMobject).insertNCurves(Math.ceil(c1 - c2));
      }
    }

    return this;
  }

  insertNCurves(n: number, recurse = true): this {
    for (const mob of this.getFamily(recurse)) {
      const vmob = mob as unknown as OpenGLVMobject;
      if (vmob.getNumCurves() > 0) {
        const newPoints = vmob.insertNCurvesToPointList(n, vmob.points);
        if (vmob.hasNewPathStarted()) {
          const lastPt = vmob.getLastPoint();
          vmob.setPoints(np.vstack([newPoints, np.array([lastPt.toArray()])]));
        } else {
          vmob.setPoints(newPoints);
        }
      }
    }
    return this;
  }

  insertNCurvesToPointList(n: number, points: NDArray): NDArray {
    const nppc = this.nPointsPerCurve;
    if (points.shape[0] === 1) {
      // Single point: repeat it
      const row: number[] = [];
      for (let j = 0; j < points.shape[1]; j++) {
        row.push(points.get([0, j]) as number);
      }
      const repeated: number[][] = [];
      for (let i = 0; i < nppc * n; i++) {
        repeated.push([...row]);
      }
      return np.array(repeated);
    }

    const bezierTuples = this.getBezierTuplesFromPoints(points);
    const currentNumCurves = bezierTuples.length;
    const newNumCurves = currentNumCurves + n;

    // Stack NDArray[] into a single NDArray for bezierRemap
    const stacked = bezierTuples.length > 0 ? np.vstack(bezierTuples) : np.zeros([0, 3]);
    const newBezierTuples = bezierRemap(stacked, newNumCurves);

    // Flatten to points (reshape from [n*nppc, 3])
    const result = newBezierTuples;
    const rows: number[][] = [];
    for (let i = 0; i < result.shape[0]; i++) {
      const row: number[] = [];
      for (let j = 0; j < result.shape[1]; j++) {
        row.push(result.get([i, j]) as number);
      }
      rows.push(row);
    }
    return np.array(rows.length > 0 ? rows : [[0, 0, 0]]);
  }

  // ── Partial curves ──

  // @ts-expect-error — VMobject override accepts OpenGLVMobject + remap param
  pointwiseBecomePartial(
    vmobject: OpenGLVMobject,
    a: number,
    b: number,
    remap = true,
  ): this {
    if (a <= 0 && b >= 1) {
      this.setPoints(vmobject.points);
      return this;
    }
    const bezierTriplets = vmobject.getBezierTuples();
    const numQuadratics = bezierTriplets.length;
    if (numQuadratics === 0) {
      this.clearPoints();
      return this;
    }

    const [lowerIndex, lowerResidue] = integerInterpolate(0, numQuadratics, a);
    const [upperIndex, upperResidue] = integerInterpolate(0, numQuadratics, b);
    this.clearPoints();

    if (lowerIndex === upperIndex) {
      this.appendPoints(
        partialBezierPoints(bezierTriplets[lowerIndex], lowerResidue, upperResidue),
      );
    } else {
      this.appendPoints(
        partialBezierPoints(bezierTriplets[lowerIndex], lowerResidue, 1),
      );
      if (upperIndex > lowerIndex + 1) {
        const innerPoints = bezierTriplets.slice(lowerIndex + 1, upperIndex);
        if (innerPoints.length > 0) {
          if (remap) {
            const stacked = np.vstack(innerPoints);
            const remapped = bezierRemap(stacked, Math.max(numQuadratics - 2, 1));
            this.appendPoints(remapped);
          } else {
            for (const t of innerPoints) {
              this.appendPoints(t);
            }
          }
        }
      }
      this.appendPoints(
        partialBezierPoints(bezierTriplets[upperIndex], 0, upperResidue),
      );
    }
    return this;
  }

  getSubcurve(a: number, b: number): OpenGLVMobject {
    const vmob = new (this.constructor as typeof OpenGLVMobject)();
    vmob.pointwiseBecomePartial(this, a, b);
    return vmob;
  }

  // ── Subdivide / Null curves ──

  subdivideSharpCurves(angleThreshold: number = 30 * DEGREES, recurse = true): this {
    const vmobs = (this.getFamily(recurse) as unknown as OpenGLVMobject[]).filter(
      (vm) => vm.hasPoints(),
    );
    for (const vmob of vmobs) {
      const newPoints: NDArray[] = [];
      for (const tup of vmob.getBezierTuples()) {
        const v0: number[] = [];
        const v1: number[] = [];
        for (let j = 0; j < tup.shape[1]; j++) {
          v0.push((tup.get([1, j]) as number) - (tup.get([0, j]) as number));
          v1.push((tup.get([2, j]) as number) - (tup.get([1, j]) as number));
        }
        const angle = angleBetweenVectors(np.array(v0), np.array(v1)) as number;
        if (angle > angleThreshold) {
          const n = Math.ceil(angle / angleThreshold);
          for (let k = 0; k < n; k++) {
            const a1 = k / n;
            const a2 = (k + 1) / n;
            newPoints.push(partialBezierPoints(tup, a1, a2));
          }
        } else {
          newPoints.push(tup);
        }
      }
      if (newPoints.length > 0) {
        vmob.setPoints(np.vstack(newPoints));
      }
    }
    return this;
  }

  getPointsWithoutNullCurves(atol = 1e-9): NDArray {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    const n = pts.shape[0];
    if (n < nppc) return pts;

    const keptRows: number[][] = [];
    for (let curveStart = 0; curveStart + nppc <= n; curveStart += nppc) {
      let isDistinct = false;
      for (let i = 1; i < nppc && !isDistinct; i++) {
        for (let j = 0; j < pts.shape[1]; j++) {
          if (Math.abs((pts.get([curveStart + i, j]) as number) - (pts.get([curveStart, j]) as number)) > atol) {
            isDistinct = true;
            break;
          }
        }
      }
      if (isDistinct) {
        for (let i = curveStart; i < curveStart + nppc; i++) {
          const row: number[] = [];
          for (let j = 0; j < pts.shape[1]; j++) {
            row.push(pts.get([i, j]) as number);
          }
          keptRows.push(row);
        }
      }
    }
    return keptRows.length > 0 ? np.array(keptRows) : np.zeros([0, 3]);
  }

  proportionFromPoint(point: Point3D): number {
    this.throwErrorIfNoPoints();
    const numCurves = this.getNumCurves();
    const totalLength = this.getArcLength();
    let targetLength = 0;

    for (let n = 0; n < numCurves; n++) {
      const controlPoints = this.getNthCurvePoints(n);
      const length = this.getNthCurveLength(n);
      const proportions = proportionsAlongBezierCurveForPoint(point, controlPoints);
      if (proportions.length > 0) {
        const maxProportion = Math.max(...proportions);
        targetLength += length * maxProportion;
        return totalLength > 0 ? targetLength / totalLength : 0;
      }
      targetLength += length;
    }
    throw new Error(`Point does not lie on this curve.`);
  }

  getAnchorsAndHandles(): NDArray[] {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    const result: NDArray[] = [];
    for (let idx = 0; idx < nppc; idx++) {
      const rows: number[][] = [];
      for (let i = idx; i < pts.shape[0]; i += nppc) {
        const row: number[] = [];
        for (let j = 0; j < pts.shape[1]; j++) {
          row.push(pts.get([i, j]) as number);
        }
        rows.push(row);
      }
      result.push(rows.length > 0 ? np.array(rows) : np.zeros([0, 3]));
    }
    return result;
  }

  // ── Overrides with triangulation refresh ──

  setPoints(points: NDArray | number[][]): this {
    super.setPoints(points);
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return this;
  }

  setData(data: Record<string, NDArray>): this {
    super.setData(data);
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return this;
  }

  applyFunction(
    fn: (point: Point3D) => Point3D,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    super.applyFunction(fn, options);
    if (this.makeSmoothAfterApplyingFunctions) {
      this.makeApproximatelySmooth();
    }
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return this;
  }

  applyPointsFunction(
    func: (pts: NDArray) => NDArray,
    aboutPoint?: Point3D | null,
    aboutEdge?: Point3D | null,
    worksOnBoundingBox?: boolean,
  ): this {
    super.applyPointsFunction(func, aboutPoint, aboutEdge ?? ORIGIN, worksOnBoundingBox ?? false);
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return this;
  }

  flip(axis: Point3D = UP, options: { aboutPoint?: Point3D } = {}): this {
    super.flip(axis, options);
    this.refreshTriangulation();
    this.refreshUnitNormal();
    return this;
  }

  // ── Interpolation ──

  interpolateMobject(
    mobject1: OpenGLMobject,
    mobject2: OpenGLMobject,
    alpha: number,
  ): this {
    super.interpolateMobject(mobject1, mobject2, alpha);
    if (this.hasFill()) {
      const tri1 = (mobject1 as unknown as OpenGLVMobject).getTriangulation?.();
      const tri2 = (mobject2 as unknown as OpenGLVMobject).getTriangulation?.();
      if (tri1 && tri2 && (tri1.length !== tri2.length || !tri1.every((v, i) => v === tri2[i]))) {
        this.refreshTriangulation();
      }
    }
    return this;
  }

  // ── Shader data ──

  initShaderData(): void {
    // TODO: Port from OpenGL — needs WebGL2 shader data initialization
    this.fillData = null;
    this.strokeData = null;
    this.fillShaderWrapper = null;
    this.strokeShaderWrapper = null;
  }

  refreshShaderWrapperId(): this {
    if (this.fillShaderWrapper) this.fillShaderWrapper.refreshId();
    if (this.strokeShaderWrapper) this.strokeShaderWrapper.refreshId();
    return this;
  }

  getStrokeUniforms(): Record<string, number | readonly number[]> {
    const result = { ...this.uniforms };
    result["joint_type"] = this.jointType;
    result["flat_stroke"] = this.flatStroke ? 1.0 : 0.0;
    return result;
  }

  getFillUniforms(): Record<string, number | readonly number[]> {
    return {
      gloss: this.gloss,
      shadow: this.shadow,
    };
  }

  getShaderWrapperList(): ShaderWrapper[] {
    // TODO: Port from OpenGL — needs full WebGL2 shader wrapper list generation
    return [];
  }

  getShaderData(): NDArray {
    // TODO: Port from OpenGL — needs full shader data generation
    return super.getShaderData();
  }

  getFillShaderData(): NDArray {
    // TODO: Port from OpenGL — needs fill shader data
    return np.zeros([0, 3]);
  }

  getStrokeShaderData(): NDArray {
    // TODO: Port from OpenGL — needs stroke shader data
    return np.zeros([0, 3]);
  }

  refreshShaderData(): void {
    // TODO: Port from OpenGL — needs shader data refresh
  }
}

// ─── OpenGLVGroup ───────────────────────────────────────────

export class OpenGLVGroup extends OpenGLVMobject {
  constructor(...vmobjects: OpenGLVMobject[]) {
    super();
    this.add(...(vmobjects as unknown as OpenGLMobject[]));
  }

  protected _assertValidSubmobjects(submobjects: Iterable<OpenGLMobject>): this {
    return this._assertValidSubmobjectsInternal(submobjects, OpenGLVMobject as unknown as new (...args: never[]) => OpenGLMobject);
  }

  // @ts-expect-error — narrowing iterator type for VMobject group
  [Symbol.iterator](): Iterator<OpenGLVMobject> {
    return (this._submobjects as unknown as OpenGLVMobject[])[Symbol.iterator]();
  }
}

// ─── OpenGLVectorizedPoint ──────────────────────────────────

export class OpenGLVectorizedPoint extends OpenGLVMobject {
  artificialWidth: number;
  artificialHeight: number;

  constructor(
    location: Point3D = ORIGIN,
    options: OpenGLVMobjectOptions & {
      artificialWidth?: number;
      artificialHeight?: number;
    } = {},
  ) {
    const {
      artificialWidth = 0.01,
      artificialHeight = 0.01,
      ...vmobOpts
    } = options;
    super({ strokeWidth: 0, fillOpacity: 0, ...vmobOpts });
    this.artificialWidth = artificialWidth;
    this.artificialHeight = artificialHeight;
    this.setPoints(np.array([location.toArray()]));
  }

  getWidth(): number {
    return this.artificialWidth;
  }

  getHeight(): number {
    return this.artificialHeight;
  }

  getLocation(): Point3D {
    if (this.getNumPoints() === 0) return ORIGIN;
    const row: number[] = [];
    for (let j = 0; j < this.points.shape[1]; j++) {
      row.push(this.points.get([0, j]) as number);
    }
    return np.array(row);
  }

  setLocation(point: Point3D): this {
    this.setPoints(np.array([point.toArray()]));
    return this;
  }
}

// ─── OpenGLCurvesAsSubmobjects ──────────────────────────────

export class OpenGLCurvesAsSubmobjects extends OpenGLVGroup {
  constructor(vmobject: OpenGLVMobject, options: OpenGLVMobjectOptions = {}) {
    super();
    const tuples = vmobject.getBezierTuples();
    for (const tuple of tuples) {
      const part = new OpenGLVMobject(options);
      part.setPoints(tuple);
      this.add(part as unknown as OpenGLMobject);
    }
  }
}

// ─── OpenGLDashedVMobject ───────────────────────────────────

export class OpenGLDashedVMobject extends OpenGLVMobject {
  numDashes: number;
  dashedRatio: number;

  constructor(
    vmobject: OpenGLVMobject,
    options: {
      numDashes?: number;
      dashedRatio?: number;
      color?: ParsableManimColor | null;
    } & OpenGLVMobjectOptions = {},
  ) {
    const {
      numDashes = 15,
      dashedRatio = 0.5,
      color = WHITE as unknown as ParsableManimColor,
      ...vmobOpts
    } = options;
    super({ color, ...vmobOpts });
    this.numDashes = numDashes;
    this.dashedRatio = dashedRatio;

    const r = dashedRatio;
    const n = numDashes;
    if (n > 0) {
      const dashLen = r / n;
      const isClosed = vmobject.isClosed();
      const voidLen = isClosed ? (1 - r) / n : (n > 1 ? (1 - r) / (n - 1) : 0);

      const subcurves: OpenGLVMobject[] = [];
      for (let i = 0; i < n; i++) {
        const a = i * (dashLen + voidLen);
        const b = a + dashLen;
        subcurves.push(vmobject.getSubcurve(a, Math.min(b, 1)));
      }
      this.add(...(subcurves as unknown as OpenGLMobject[]));
    }
    this.matchStyle(vmobject, false);
  }
}
