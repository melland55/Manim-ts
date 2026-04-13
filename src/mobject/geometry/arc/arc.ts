/**
 * Mobjects that are curved — arcs, circles, dots, ellipses, sectors, etc.
 *
 * TypeScript port of manim/mobject/geometry/arc.py
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import { PI, TAU, ORIGIN, UP, RIGHT, LEFT, OUT } from "../../../core/math/index.js";
import type { IColor } from "../../../core/types.js";
import { VMobject } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { Mobject, Group } from "../../mobject/index.js";
import {
  angleOfVector,
  angleBetweenVectors,
  cartesianToSpherical,
  lineIntersection,
  perpendicularBisector,
  rotateVector,
} from "../../../utils/space_ops/index.js";
import { adjacentPairs } from "../../../utils/iterables/index.js";
import {
  ArrowTip,
  ArrowTriangleFilledTip,
} from "../tips/index.js";
import type { ArrowTriangleTipOptions } from "../tips/index.js";
import {
  DEFAULT_ARROW_TIP_LENGTH,
  DEFAULT_DOT_RADIUS,
  DEFAULT_SMALL_DOT_RADIUS,
  SMALL_BUFF,
  DEGREES,
} from "../../../constants/index.js";
import {
  WHITE,
  BLUE,
  RED,
  BLACK,
} from "../../../utils/color/manim_colors.js";
import type { ManimColor, ParsableManimColor } from "../../../utils/color/index.js";

// ── Helpers ────────────────────────────────────────────────────

/** Extract row i from an [n, 3] NDArray as a Point3D. */
function getRow(pts: NDArray, i: number): Point3D {
  return np.array([
    pts.get([i, 0]) as number,
    pts.get([i, 1]) as number,
    pts.get([i, 2]) as number,
  ]);
}

/** Helper: extract a row from 2D number[][] data as a Point3D. */
function arrToPoint(data: number[][], i: number): Point3D {
  return np.array(data[i]) as Point3D;
}

// ── TipableVMobject ────────────────────────────────────────────

export interface TipableVMobjectOptions extends VMobjectOptions {
  tipLength?: number;
  normalVector?: Point3D;
  tipStyle?: Record<string, unknown>;
}

/**
 * Shared functionality between Arc and Line for managing arrow tips.
 */
export class TipableVMobject extends VMobject {
  tipLength: number;
  normalVector: Point3D;
  tipStyle: Record<string, unknown>;
  tip?: ArrowTip;
  startTip?: ArrowTip;
  private _initPositioningAxis?: NDArray;

  constructor(options: TipableVMobjectOptions = {}) {
    super(options);
    this.tipLength = options.tipLength ?? DEFAULT_ARROW_TIP_LENGTH;
    this.normalVector = options.normalVector ?? (OUT as Point3D);
    this.tipStyle = options.tipStyle ?? {};
  }

  // ── Adding, Creating, Modifying tips ──

  addTip(options: {
    tip?: ArrowTip;
    tipShape?: new (opts: Record<string, unknown>) => ArrowTip;
    tipLength?: number;
    tipWidth?: number;
    atStart?: boolean;
  } = {}): this {
    const { tipShape, tipLength, tipWidth, atStart = false } = options;
    let { tip } = options;

    if (tip === undefined) {
      tip = this.createTip(tipShape, tipLength, tipWidth, atStart);
    } else {
      this.positionTip(tip, atStart);
    }
    this.resetEndpointsBasedOnTip(tip, atStart);
    this.assignTipAttr(tip, atStart);
    this.add(tip);
    return this;
  }

  createTip(
    tipShape?: new (opts: Record<string, unknown>) => ArrowTip,
    tipLength?: number,
    tipWidth?: number,
    atStart = false,
  ): ArrowTip {
    const tip = this.getUnpositionedTip(tipShape, tipLength, tipWidth);
    this.positionTip(tip, atStart);
    return tip;
  }

  getUnpositionedTip(
    tipShape?: new (opts: Record<string, unknown>) => ArrowTip,
    tipLength?: number,
    tipWidth?: number,
  ): ArrowTip {
    const style: Record<string, unknown> = {};

    const TipClass = tipShape ?? ArrowTriangleFilledTip;

    if (TipClass === ArrowTriangleFilledTip) {
      if (tipWidth === undefined) {
        tipWidth = this.getDefaultTipLength();
      }
      style.width = tipWidth;
    }
    if (tipLength === undefined) {
      tipLength = this.getDefaultTipLength();
    }

    const color = this.getColor();
    style.fillColor = color;
    style.strokeColor = color;
    Object.assign(style, this.tipStyle);
    style.length = tipLength;

    return new TipClass(style) as ArrowTip;
  }

  positionTip(tip: ArrowTip, atStart = false): ArrowTip {
    let anchor: Point3D;
    let handle: Point3D;

    if (atStart) {
      anchor = this.getStart();
      handle = this.getFirstHandle();
    } else {
      handle = this.getLastHandle();
      anchor = this.getEnd();
    }

    const diff = (handle as NDArray).subtract(anchor) as Point3D;
    const angles = cartesianToSpherical(diff);
    const theta = angles[1] as number;
    const phi = angles[2] as number;

    tip.rotate(theta - PI - tip.tipAngle);

    if (this._initPositioningAxis === undefined) {
      const axis = np.array([
        Math.sin(theta),
        -Math.cos(theta),
        0,
      ]);
      tip.rotate(-phi + PI / 2, axis as Point3D);
      this._initPositioningAxis = axis;
    }

    tip.shift((anchor as NDArray).subtract(tip.tipPoint) as Point3D);
    return tip;
  }

  resetEndpointsBasedOnTip(tip: ArrowTip, atStart: boolean): this {
    if (this.getLength() === 0) {
      return this;
    }

    if (atStart) {
      this.putStartAndEndOn(tip.base, this.getEnd());
    } else {
      this.putStartAndEndOn(this.getStart(), tip.base);
    }
    return this;
  }

  assignTipAttr(tip: ArrowTip, atStart: boolean): this {
    if (atStart) {
      this.startTip = tip;
    } else {
      this.tip = tip;
    }
    return this;
  }

  // ── Checking for tips ──

  hasTip(): boolean {
    return this.tip !== undefined && this.submobjects.includes(this.tip);
  }

  hasStartTip(): boolean {
    return this.startTip !== undefined && this.submobjects.includes(this.startTip);
  }

  // ── Getters ──

  popTips(): Group {
    const [start, end] = this.getStartAndEnd();
    const result = new Group();
    if (this.hasTip()) {
      result.add(this.tip!);
      this.remove(this.tip!);
    }
    if (this.hasStartTip()) {
      result.add(this.startTip!);
      this.remove(this.startTip!);
    }
    if (result.submobjects.length > 0) {
      this.putStartAndEndOn(start, end);
    }
    return result;
  }

  getTips(): Group {
    const result = new Group();
    if (this.tip !== undefined) {
      result.add(this.tip);
    }
    if (this.startTip !== undefined) {
      result.add(this.startTip);
    }
    return result;
  }

  getTip(): VMobject {
    const tips = this.getTips();
    if (tips.submobjects.length === 0) {
      throw new Error("tip not found");
    }
    return tips.submobjects[0] as VMobject;
  }

  getDefaultTipLength(): number {
    return this.tipLength;
  }

  getFirstHandle(): Point3D {
    return getRow(this.points, 1);
  }

  getLastHandle(): Point3D {
    const n = this.points.shape[0];
    return getRow(this.points, n - 2);
  }

  override getEnd(): Point3D {
    if (this.hasTip()) {
      return this.tip!.getStart();
    }
    return this._getEndPoint();
  }

  override getStart(): Point3D {
    if (this.hasStartTip()) {
      return this.startTip!.getStart();
    }
    return this._getStartPoint();
  }

  /** Safe getStart using 2D indexing (works with numpy-ts). */
  private _getStartPoint(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, 0);
  }

  /** Safe getEnd using 2D indexing (works with numpy-ts). */
  private _getEndPoint(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, n - 1);
  }

  getLength(): number {
    const [start, end] = this.getStartAndEnd();
    return np.linalg.norm((start as NDArray).subtract(end)) as number;
  }
}

// ── Arc ────────────────────────────────────────────────────────

export interface ArcOptions extends TipableVMobjectOptions {
  radius?: number | null;
  startAngle?: number;
  angle?: number;
  numComponents?: number;
  arcCenter?: Point3D | number[];
}

/**
 * A circular arc.
 */
export class Arc extends TipableVMobject {
  radius: number;
  numComponents: number;
  arcCenter: Point3D;
  startAngle: number;
  angle: number;
  _failedToGetCenter: boolean;

  constructor(options: ArcOptions = {}) {
    super(options);
    let radius = options.radius;
    if (radius === null || radius === undefined) {
      radius = 1.0;
    }
    this.radius = radius;
    this.numComponents = options.numComponents ?? 9;
    this.startAngle = options.startAngle ?? 0;
    this.angle = options.angle ?? TAU / 4;
    this._failedToGetCenter = false;

    if (options.arcCenter !== undefined) {
      if (Array.isArray(options.arcCenter)) {
        this.arcCenter = np.array(options.arcCenter) as Point3D;
      } else {
        this.arcCenter = options.arcCenter;
      }
    } else {
      this.arcCenter = np.array([0, 0, 0]) as Point3D;
    }

    this._generatePoints();
  }

  private _generatePoints(): void {
    this._setPrePositionedPoints();
    this.scale(this.radius, { aboutPoint: ORIGIN as Point3D });
    this.shift(this.arcCenter);
  }

  private _setPrePositionedPoints(): void {
    if (this.numComponents < 2) return;

    // Build anchors on unit circle
    const anchorsData: number[][] = [];
    for (let i = 0; i < this.numComponents; i++) {
      const a = this.startAngle + (this.angle * i) / (this.numComponents - 1);
      anchorsData.push([Math.cos(a), Math.sin(a), 0]);
    }

    // Tangent vectors: rotate each anchor 90 deg via (x,y) -> (-y, x)
    const tangentData: number[][] = [];
    for (const ad of anchorsData) {
      tangentData.push([-ad[1], ad[0], 0]);
    }

    // Use tangent vectors to deduce cubic handles
    const dTheta = this.angle / (this.numComponents - 1.0);
    const factor = (4 / 3) * Math.tan(dTheta / 4);

    const nSegs = this.numComponents - 1;

    // Build using VMobject's path API
    this.clearPoints();
    this.startNewPath(np.array(anchorsData[0]) as Point3D);

    for (let i = 0; i < nSegs; i++) {
      const h1 = np.array([
        anchorsData[i][0] + factor * tangentData[i][0],
        anchorsData[i][1] + factor * tangentData[i][1],
        anchorsData[i][2] + factor * tangentData[i][2],
      ]) as Point3D;
      const h2 = np.array([
        anchorsData[i + 1][0] - factor * tangentData[i + 1][0],
        anchorsData[i + 1][1] - factor * tangentData[i + 1][1],
        anchorsData[i + 1][2] - factor * tangentData[i + 1][2],
      ]) as Point3D;
      const endAnchor = np.array(anchorsData[i + 1]) as Point3D;
      this.addCubicBezierCurveTo(h1, h2, endAnchor);
    }
  }

  /**
   * Set points as straight-line corners (each pair connected by a degenerate cubic).
   */
  protected setPointsAsCorners(corners: NDArray | number[][]): void {
    this.clearPoints();
    const arr = Array.isArray(corners) ? corners : (corners.toArray() as number[][]);
    if (arr.length < 2) return;

    this.startNewPath(np.array(arr[0]) as Point3D);
    for (let i = 1; i < arr.length; i++) {
      this.addLineTo(np.array(arr[i]) as Point3D);
    }
  }

  /**
   * Append raw points via VMobject path API.
   * Reads the newPoints array as cubic segments: first point is an anchor,
   * then every 3 consecutive points are (handle1, handle2, anchor).
   */
  protected appendRawPoints(newPoints: NDArray): void {
    const n = newPoints.shape[0];
    if (n === 0) return;

    if (this.getNumPoints() === 0) {
      this.startNewPath(getRow(newPoints, 0));
    }
    // Add cubic segments starting from index 1
    for (let i = 1; i + 2 < n; i += 3) {
      this.addCubicBezierCurveTo(
        getRow(newPoints, i),
        getRow(newPoints, i + 1),
        getRow(newPoints, i + 2),
      );
    }
  }

  getArcCenter(warning = true): Point3D {
    const n = this.points.shape[0];
    if (n < 4) {
      return np.array([0, 0, 0]) as Point3D;
    }

    const a1 = getRow(this.points, 0);
    const h1 = getRow(this.points, 1);
    const h2 = getRow(this.points, 2);
    const a2 = getRow(this.points, 3);

    // Check if a1 == a2
    if (np.allclose(a1, a2)) {
      return a1;
    }

    const t1 = (h1 as NDArray).subtract(a1) as Point3D;
    const t2 = (h2 as NDArray).subtract(a2) as Point3D;
    const n1 = rotateVector(t1, TAU / 4);
    const n2 = rotateVector(t2, TAU / 4);

    try {
      return lineIntersection(
        [a1, (a1 as NDArray).add(n1) as Point3D],
        [a2, (a2 as NDArray).add(n2) as Point3D],
      );
    } catch {
      if (warning) {
        console.warn("Can't find Arc center, using ORIGIN instead");
      }
      this._failedToGetCenter = true;
      return np.array([0, 0, 0]) as Point3D;
    }
  }

  moveArcCenterTo(point: Point3D | number[]): this {
    const p = Array.isArray(point) ? np.array(point) as Point3D : point;
    this.shift((p as NDArray).subtract(this.getArcCenter()) as Point3D);
    return this;
  }

  stopAngle(): number {
    const lastPoint = getRow(this.points, this.points.shape[0] - 1);
    const center = this.getArcCenter();
    const diff = (lastPoint as NDArray).subtract(center) as Point3D;
    const angle = angleOfVector(diff) as number;
    return ((angle % TAU) + TAU) % TAU;
  }
}

// ── ArcBetweenPoints ───────────────────────────────────────────

export interface ArcBetweenPointsOptions extends ArcOptions {
  start?: Point3D | number[];
  end?: Point3D | number[];
}

/**
 * An arc spanning between two given points.
 */
export class ArcBetweenPoints extends Arc {
  constructor(
    start: Point3D | number[],
    end: Point3D | number[],
    options: ArcOptions = {},
  ) {
    let { angle, radius } = options;
    angle = angle ?? TAU / 4;

    const startArr = Array.isArray(start) ? np.array(start) : start;
    const endArr = Array.isArray(end) ? np.array(end) : end;

    if (radius !== undefined && radius !== null) {
      let absRadius = radius;
      let sign: number;
      if (radius < 0) {
        sign = -2;
        absRadius = -radius;
      } else {
        sign = 2;
      }
      const halfdist = (np.linalg.norm(
        (startArr as NDArray).subtract(endArr),
      ) as number) / 2;
      if (absRadius < halfdist) {
        throw new Error(
          "ArcBetweenPoints called with a radius that is smaller than half the distance between the points.",
        );
      }
      const arcHeight = absRadius - Math.sqrt(absRadius ** 2 - halfdist ** 2);
      angle = Math.acos((absRadius - arcHeight) / absRadius) * sign;
    }

    super({ ...options, radius, angle });

    if (angle === 0) {
      this.setPointsAsCorners([
        [-1, 0, 0],
        [1, 0, 0],
      ]);
    }
    this.putStartAndEndOn(startArr as Point3D, endArr as Point3D);

    if (options.radius === undefined || options.radius === null) {
      const center = this.getArcCenter(false);
      if (!this._failedToGetCenter) {
        this.radius = np.linalg.norm(
          (startArr as NDArray).subtract(center),
        ) as number;
      } else {
        this.radius = Infinity;
      }
    }
  }
}

// ── TangentialArc ──────────────────────────────────────────────

export interface TangentialArcOptions extends ArcOptions {
  corner?: [number, number];
}

/**
 * Construct an arc that is tangent to two intersecting lines.
 */
export class TangentialArc extends ArcBetweenPoints {
  constructor(
    line1: { getStart(): Point3D; getEnd(): Point3D; getUnitVector(): Point3D },
    line2: { getStart(): Point3D; getEnd(): Point3D; getUnitVector(): Point3D },
    options: TangentialArcOptions & { radius: number },
  ) {
    const { radius, corner = [1, 1], ...rest } = options;

    const intersectionPoint = lineIntersection(
      [line1.getStart(), line1.getEnd()],
      [line2.getStart(), line2.getEnd()],
    );

    const [s1, s2] = corner;
    const uv1 = line1.getUnitVector();
    const uv2 = line2.getUnitVector();
    const unitVector1 = (uv1 as NDArray).multiply(s1) as Point3D;
    const unitVector2 = (uv2 as NDArray).multiply(s2) as Point3D;

    const cornerAngle = angleBetweenVectors(unitVector1, unitVector2) as number;
    const tangentPointDistance = radius / Math.tan(cornerAngle / 2);

    const tangentPoint1 = (intersectionPoint as NDArray).add(
      (unitVector1 as NDArray).multiply(tangentPointDistance),
    ) as Point3D;
    const tangentPoint2 = (intersectionPoint as NDArray).add(
      (unitVector2 as NDArray).multiply(tangentPointDistance),
    ) as Point3D;

    const uv1x = unitVector1.get([0]) as number;
    const uv1y = unitVector1.get([1]) as number;
    const uv2x = unitVector2.get([0]) as number;
    const uv2y = unitVector2.get([1]) as number;
    const crossProduct = uv1x * uv2y - uv1y * uv2x;

    let startPoint: Point3D;
    let endPoint: Point3D;
    if (crossProduct < 0) {
      startPoint = tangentPoint1;
      endPoint = tangentPoint2;
    } else {
      startPoint = tangentPoint2;
      endPoint = tangentPoint1;
    }

    super(startPoint, endPoint, { ...rest, radius });
  }
}

// ── CurvedArrow ────────────────────────────────────────────────

export interface CurvedArrowOptions extends ArcOptions {
  tipShape?: new (opts: Record<string, unknown>) => ArrowTip;
}

/**
 * An arc with an arrow tip at the end.
 */
export class CurvedArrow extends ArcBetweenPoints {
  constructor(
    startPoint: Point3D | number[],
    endPoint: Point3D | number[],
    options: CurvedArrowOptions = {},
  ) {
    const { tipShape, ...rest } = options;
    super(startPoint, endPoint, rest);
    this.addTip({
      tipShape: tipShape ?? (ArrowTriangleFilledTip as unknown as new (opts: Record<string, unknown>) => ArrowTip),
    });
  }
}

// ── CurvedDoubleArrow ──────────────────────────────────────────

export interface CurvedDoubleArrowOptions extends CurvedArrowOptions {
  tipShapeStart?: new (opts: Record<string, unknown>) => ArrowTip;
  tipShapeEnd?: new (opts: Record<string, unknown>) => ArrowTip;
}

/**
 * An arc with arrow tips at both ends.
 */
export class CurvedDoubleArrow extends CurvedArrow {
  constructor(
    startPoint: Point3D | number[],
    endPoint: Point3D | number[],
    options: CurvedDoubleArrowOptions = {},
  ) {
    const {
      tipShapeStart,
      tipShapeEnd,
      ...rest
    } = options;

    // tipShapeEnd overrides tipShape for the end tip
    if (tipShapeEnd !== undefined) {
      rest.tipShape = tipShapeEnd;
    }

    super(startPoint, endPoint, rest);

    this.addTip({
      atStart: true,
      tipShape: tipShapeStart ?? (ArrowTriangleFilledTip as unknown as new (opts: Record<string, unknown>) => ArrowTip),
    });
  }
}

// ── Circle ─────────────────────────────────────────────────────

export interface CircleOptions extends ArcOptions {
  color?: IColor;
}

/**
 * A circle (Arc with angle = TAU).
 */
export class Circle extends Arc {
  constructor(options: CircleOptions = {}) {
    super({
      startAngle: 0,
      angle: TAU,
      color: options.color ?? RED,
      ...options,
    });
  }

  surround(
    mobject: Mobject,
    dimToMatch = 0,
    stretch = false,
    bufferFactor = 1.2,
  ): this {
    this.replace(mobject, dimToMatch, stretch);
    this.width = Math.sqrt(mobject.width ** 2 + mobject.height ** 2);
    return this.scale(bufferFactor);
  }

  pointAtAngle(angle: number): Point3D {
    let proportion = angle / TAU;
    proportion -= Math.floor(proportion);
    return this.pointFromProportion(proportion);
  }

  static fromThreePoints(
    p1: Point3D | number[],
    p2: Point3D | number[],
    p3: Point3D | number[],
    options: CircleOptions = {},
  ): Circle {
    const a1 = Array.isArray(p1) ? np.array(p1) as Point3D : p1;
    const a2 = Array.isArray(p2) ? np.array(p2) as Point3D : p2;
    const a3 = Array.isArray(p3) ? np.array(p3) as Point3D : p3;

    const center = lineIntersection(
      perpendicularBisector([a1, a2]),
      perpendicularBisector([a2, a3]),
    );
    const radius = np.linalg.norm(
      (a1 as NDArray).subtract(center),
    ) as number;
    return new Circle({ radius, ...options }).shift(center) as Circle;
  }
}

// ── Dot ────────────────────────────────────────────────────────

export interface DotOptions extends CircleOptions {
  point?: Point3D | number[];
  radius?: number;
}

/**
 * A circle with a very small radius.
 */
export class Dot extends Circle {
  constructor(options: DotOptions = {}) {
    const point = options.point ?? ORIGIN;
    const arcCenter = Array.isArray(point) ? np.array(point) as Point3D : point;

    const { point: _point, ...restOpts } = options;
    super({
      radius: options.radius ?? DEFAULT_DOT_RADIUS,
      strokeWidth: options.strokeWidth ?? 0,
      fillOpacity: options.fillOpacity ?? 1.0,
      color: options.color ?? WHITE,
      ...restOpts,
      arcCenter,
    });
  }
}

// ── AnnotationDot ──────────────────────────────────────────────

export interface AnnotationDotOptions extends DotOptions {
}

/**
 * A dot with bigger radius and bold stroke to annotate scenes.
 */
export class AnnotationDot extends Dot {
  constructor(options: AnnotationDotOptions = {}) {
    super({
      radius: DEFAULT_DOT_RADIUS * 1.3,
      strokeWidth: 5,
      strokeColor: options.strokeColor ?? WHITE,
      fillColor: options.fillColor ?? BLUE,
      ...options,
    });
  }
}

// ── LabeledDot ─────────────────────────────────────────────────

export interface LabeledDotOptions extends DotOptions {
  buff?: number;
}

/**
 * A Dot containing a label in its center.
 *
 * Note: Full label support requires the text/tex modules. This implementation
 * supports string labels as simple submobject text. For VMobject labels
 * passed directly, they are positioned at the dot's center.
 */
export class LabeledDot extends Dot {
  constructor(
    label: string | VMobject,
    options: LabeledDotOptions = {},
  ) {
    const buff = options.buff ?? SMALL_BUFF;

    let renderedLabel: VMobject;
    if (typeof label === "string") {
      // TODO: Use MathTex when available. For now, create a placeholder VMobject.
      renderedLabel = new VMobject();
    } else {
      renderedLabel = label;
    }

    let radius = options.radius;
    if (radius === undefined || radius === null) {
      const labelWidth = renderedLabel.width;
      const labelHeight = renderedLabel.height;
      radius = buff + Math.sqrt(labelWidth ** 2 + labelHeight ** 2) / 2;
    }

    super({ ...options, radius });

    renderedLabel.moveTo(this.getCenter());
    this.add(renderedLabel);
  }
}

// ── Ellipse ────────────────────────────────────────────────────

export interface EllipseOptions extends CircleOptions {
  width?: number;
  height?: number;
}

/**
 * An ellipse — a stretched circle.
 */
export class Ellipse extends Circle {
  constructor(options: EllipseOptions = {}) {
    super(options);
    const w = options.width ?? 2;
    const h = options.height ?? 1;
    this.stretchToFitWidth(w);
    this.stretchToFitHeight(h);
  }
}

// ── AnnularSector ──────────────────────────────────────────────

export interface AnnularSectorOptions extends ArcOptions {
  innerRadius?: number;
  outerRadius?: number;
}

/**
 * A sector of an annulus.
 */
export class AnnularSector extends Arc {
  innerRadius: number;
  outerRadius: number;

  constructor(options: AnnularSectorOptions = {}) {
    const innerRadius = options.innerRadius ?? 1;
    const outerRadius = options.outerRadius ?? 2;

    super({
      startAngle: options.startAngle ?? 0,
      angle: options.angle ?? TAU / 4,
      fillOpacity: options.fillOpacity ?? 1,
      strokeWidth: options.strokeWidth ?? 0,
      color: options.color ?? WHITE,
      ...options,
    });

    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;

    this._generateAnnularSectorPoints();
  }

  private _generateAnnularSectorPoints(): void {
    const innerArc = new Arc({
      startAngle: this.startAngle,
      angle: this.angle,
      radius: this.innerRadius,
      arcCenter: this.arcCenter,
    });
    const outerArc = new Arc({
      startAngle: this.startAngle,
      angle: this.angle,
      radius: this.outerRadius,
      arcCenter: this.arcCenter,
    });
    outerArc.reversePoints();

    this.clearPoints();
    this.appendRawPoints(innerArc.points);
    this.addLineTo(getRow(outerArc.points, 0));
    this.appendRawPoints(outerArc.points);
    this.addLineTo(getRow(innerArc.points, 0));
  }
}

// ── Sector ─────────────────────────────────────────────────────

export interface SectorOptions extends AnnularSectorOptions {
}

/**
 * A sector of a circle (annular sector with inner radius = 0).
 */
export class Sector extends AnnularSector {
  constructor(options: SectorOptions = {}) {
    super({
      innerRadius: 0,
      outerRadius: options.radius ?? 1,
      ...options,
    });
  }
}

// ── Annulus ─────────────────────────────────────────────────────

export interface AnnulusOptions extends CircleOptions {
  innerRadius?: number;
  outerRadius?: number;
  markPathsClosed?: boolean;
}

/**
 * Region between two concentric circles.
 */
export class Annulus extends Circle {
  innerRadius: number;
  outerRadius: number;
  markPathsClosed: boolean;

  constructor(options: AnnulusOptions = {}) {
    const innerRadius = options.innerRadius ?? 1;
    const outerRadius = options.outerRadius ?? 2;

    super({
      fillOpacity: options.fillOpacity ?? 1,
      strokeWidth: options.strokeWidth ?? 0,
      color: options.color ?? WHITE,
      ...options,
    });

    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;
    this.markPathsClosed = options.markPathsClosed ?? false;

    this._generateAnnulusPoints();
  }

  private _generateAnnulusPoints(): void {
    const outerCircle = new Circle({ radius: this.outerRadius });
    const innerCircle = new Circle({ radius: this.innerRadius });
    innerCircle.reversePoints();

    this.clearPoints();
    this.appendRawPoints(outerCircle.points);
    this.appendRawPoints(innerCircle.points);
    this.shift(this.arcCenter);
  }
}

// ── CubicBezier ────────────────────────────────────────────────

export interface CubicBezierOptions extends VMobjectOptions {
}

/**
 * A single cubic Bezier curve defined by 4 control points.
 */
export class CubicBezier extends VMobject {
  constructor(
    startAnchor: Point3D | number[],
    startHandle: Point3D | number[],
    endHandle: Point3D | number[],
    endAnchor: Point3D | number[],
    options: CubicBezierOptions = {},
  ) {
    super(options);

    const sa = Array.isArray(startAnchor) ? np.array(startAnchor) as Point3D : startAnchor;
    const sh = Array.isArray(startHandle) ? np.array(startHandle) as Point3D : startHandle;
    const eh = Array.isArray(endHandle) ? np.array(endHandle) as Point3D : endHandle;
    const ea = Array.isArray(endAnchor) ? np.array(endAnchor) as Point3D : endAnchor;

    this.startNewPath(sa);
    this.addCubicBezierCurveTo(sh, eh, ea);
  }

  override getStart(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, 0);
  }

  override getEnd(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, n - 1);
  }
}

// ── ArcPolygon ─────────────────────────────────────────────────

export interface ArcPolygonOptions extends VMobjectOptions {
  angle?: number;
  radius?: number | null;
  arcConfig?: Record<string, unknown>[] | Record<string, unknown> | null;
}

/**
 * A generalized polygon allowing for points to be connected with arcs.
 */
export class ArcPolygon extends VMobject {
  arcs: ArcBetweenPoints[];

  constructor(
    vertices: (Point3D | number[])[],
    options: ArcPolygonOptions = {},
  ) {
    super(options);

    const n = vertices.length;
    const pointPairs: [Point3D | number[], Point3D | number[]][] = [];
    for (let k = 0; k < n; k++) {
      pointPairs.push([vertices[k], vertices[(k + 1) % n]]);
    }

    let allArcConfigs: Record<string, unknown>[];

    if (!options.arcConfig) {
      if (options.radius !== undefined && options.radius !== null) {
        allArcConfigs = pointPairs.map(() => ({ radius: options.radius }));
      } else {
        const angle = options.angle ?? PI / 4;
        allArcConfigs = pointPairs.map(() => ({ angle }));
      }
    } else if (!Array.isArray(options.arcConfig)) {
      allArcConfigs = pointPairs.map(() => options.arcConfig as Record<string, unknown>);
    } else {
      allArcConfigs = options.arcConfig;
    }

    const arcs: ArcBetweenPoints[] = [];
    for (let i = 0; i < pointPairs.length; i++) {
      const [p1, p2] = pointPairs[i];
      const conf = allArcConfigs[i];
      arcs.push(new ArcBetweenPoints(p1, p2, conf as ArcOptions));
    }

    this.add(...arcs);
    for (const arc of arcs) {
      this._appendArcPoints(arc.points);
    }

    this.arcs = arcs;
  }

  override getStart(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, 0);
  }

  override getEnd(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, n - 1);
  }

  private _appendArcPoints(newPoints: NDArray): void {
    const n = newPoints.shape[0];
    if (n === 0) return;
    if (this.getNumPoints() === 0) {
      this.startNewPath(getRow(newPoints, 0));
    }
    for (let i = 1; i + 2 < n; i += 3) {
      this.addCubicBezierCurveTo(
        getRow(newPoints, i),
        getRow(newPoints, i + 1),
        getRow(newPoints, i + 2),
      );
    }
  }
}

// ── ArcPolygonFromArcs ─────────────────────────────────────────

/**
 * A generalized polygon built from pre-defined arcs.
 */
export class ArcPolygonFromArcs extends VMobject {
  arcs: (Arc | ArcBetweenPoints)[];

  constructor(
    arcs: (Arc | ArcBetweenPoints)[],
    options: VMobjectOptions = {},
  ) {
    super(options);

    this.add(...arcs);
    this.arcs = [...arcs];

    const pairs = adjacentPairs(arcs);
    for (const [arc1, arc2] of pairs) {
      this._appendArcPoints(arc1.points);
      // Connect arc1's end to arc2's start with a line
      const lineEnd = arc2.getStart();
      if (this.getNumPoints() > 0) {
        const lastPt = this.getEnd();
        const diff = (lineEnd as NDArray).subtract(lastPt) as Point3D;
        const lineDist = np.linalg.norm(diff) as number;
        if (lineDist > 1e-10) {
          this.addLineTo(lineEnd);
        }
      }
    }
  }

  override getStart(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, 0);
  }

  override getEnd(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return getRow(this.points, n - 1);
  }

  private _appendArcPoints(newPoints: NDArray): void {
    const n = newPoints.shape[0];
    if (n === 0) return;
    if (this.getNumPoints() === 0) {
      this.startNewPath(getRow(newPoints, 0));
    }
    for (let i = 1; i + 2 < n; i += 3) {
      this.addCubicBezierCurveTo(
        getRow(newPoints, i),
        getRow(newPoints, i + 1),
        getRow(newPoints, i + 2),
      );
    }
  }
}
