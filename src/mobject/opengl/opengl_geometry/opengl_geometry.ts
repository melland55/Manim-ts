/**
 * OpenGL geometry mobjects — arcs, circles, lines, arrows, polygons, etc.
 *
 * TypeScript port of manim/mobject/opengl/opengl_geometry.py
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
  angleOfVector,
  findIntersection,
} from "../../../core/math/index.js";
import type { Point3D, Points3D } from "../../../core/math/index.js";
import {
  WHITE,
  RED,
} from "../../../utils/color/manim_colors.js";
import { GREY_A } from "../../../utils/color/manim_colors.js";
import type { ParsableManimColor } from "../../../utils/color/index.js";
import {
  DEFAULT_DOT_RADIUS,
  DEFAULT_DASH_LENGTH,
  DEFAULT_ARROW_TIP_LENGTH,
  MED_SMALL_BUFF,
} from "../../../constants/constants.js";
import {
  OpenGLMobject,
} from "../opengl_mobject.js";
import {
  OpenGLVMobject,
  OpenGLVGroup,
  OpenGLDashedVMobject,
} from "../opengl_vectorized_mobject.js";
import type { OpenGLVMobjectOptions } from "../opengl_vectorized_mobject.js";
import {
  rotateVector,
  angleBetweenVectors,
  normalize,
  compassDirections,
} from "../../../utils/space_ops/index.js";
import {
  adjacentNTuples,
  adjacentPairs,
} from "../../../utils/iterables/index.js";
import { clip } from "../../../utils/simple_functions/index.js";

// ─── Constants ─────────────────────────────────────────────

const DEFAULT_ARROW_TIP_WIDTH = 0.35;

// ─── Types ─────────────────────────────────────────────────

export interface OpenGLTipableVMobjectOptions extends OpenGLVMobjectOptions {
  tipLength?: number;
  normalVector?: Point3D;
  tipConfig?: Partial<OpenGLArrowTipOptions>;
}

export interface OpenGLArcOptions extends OpenGLTipableVMobjectOptions {
  startAngle?: number;
  angle?: number;
  radius?: number;
  nComponents?: number;
  arcCenter?: Point3D;
}

export interface OpenGLArcBetweenPointsOptions extends OpenGLArcOptions {
  // angle is inherited
}

export interface OpenGLCircleOptions extends OpenGLArcOptions {
  // color is inherited
}

export interface OpenGLDotOptions extends OpenGLCircleOptions {
  point?: Point3D;
}

export interface OpenGLEllipseOptions extends OpenGLCircleOptions {
  width?: number;
  height?: number;
}

export interface OpenGLAnnularSectorOptions extends OpenGLArcOptions {
  innerRadius?: number;
  outerRadius?: number;
}

export interface OpenGLLineOptions extends OpenGLTipableVMobjectOptions {
  buff?: number;
  pathArc?: number;
}

export interface OpenGLDashedLineOptions extends OpenGLLineOptions {
  dashLength?: number;
  dashedRatio?: number;
}

export interface OpenGLTangentLineOptions extends OpenGLLineOptions {
  length?: number;
  dAlpha?: number;
}

export interface OpenGLElbowOptions extends OpenGLVMobjectOptions {
  width?: number;
  angle?: number;
}

export interface OpenGLArrowOptions extends OpenGLLineOptions {
  fillColor?: ParsableManimColor;
  fillOpacity?: number;
  thickness?: number;
  tipWidthRatio?: number;
  tipAngle?: number;
  maxTipLengthToLengthRatio?: number;
  maxWidthToLengthRatio?: number;
}

export interface OpenGLVectorOptions extends OpenGLArrowOptions {
  direction?: Point3D;
}

export interface OpenGLPolygonOptions extends OpenGLVMobjectOptions {
  // vertices passed positionally
}

export interface OpenGLRegularPolygonOptions extends OpenGLPolygonOptions {
  n?: number;
  startAngle?: number | null;
}

export interface OpenGLArrowTipOptions extends OpenGLRegularPolygonOptions {
  fillOpacity?: number;
  fillColor?: ParsableManimColor;
  width?: number;
  length?: number;
  angle?: number;
}

export interface OpenGLRectangleOptions extends OpenGLPolygonOptions {
  width?: number;
  height?: number;
}

export interface OpenGLSquareOptions extends OpenGLRectangleOptions {
  sideLength?: number;
}

export interface OpenGLRoundedRectangleOptions extends OpenGLRectangleOptions {
  cornerRadius?: number;
}

// ─── Helper: rotation matrix transpose ─────────────────────
// Python manim's rotation_matrix_transpose is not exported from space_ops,
// so we implement it locally for the OpenGLArrow path_arc case.

function rotationMatrixTranspose(angle: number, axis: NDArray): NDArray {
  const normAxis = normalize(axis);
  const arr = normAxis.toArray() as number[];
  const [ux, uy, uz] = arr;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  // Transposed rotation matrix (rows become columns)
  return np.array([
    [t * ux * ux + c, t * ux * uy + s * uz, t * ux * uz - s * uy],
    [t * ux * uy - s * uz, t * uy * uy + c, t * uy * uz + s * ux],
    [t * ux * uz + s * uy, t * uy * uz - s * ux, t * uz * uz + c],
  ]);
}

// ─── OpenGLTipableVMobject ─────────────────────────────────

export class OpenGLTipableVMobject extends OpenGLVMobject {
  tipLength: number;
  normalVector: Point3D;
  tipConfig: Partial<OpenGLArrowTipOptions>;
  tip?: OpenGLArrowTip;
  startTip?: OpenGLArrowTip;

  constructor(options: OpenGLTipableVMobjectOptions = {}) {
    const {
      tipLength = DEFAULT_ARROW_TIP_LENGTH,
      normalVector,
      tipConfig = {},
      ...baseOpts
    } = options;
    super(baseOpts);
    this.tipLength = tipLength;
    this.normalVector = normalVector ?? OUT;
    this.tipConfig = tipConfig;
  }

  addTip(atStart = false, tipOptions: Partial<OpenGLArrowTipOptions> = {}): this {
    const tip = this.createTip(atStart, tipOptions);
    this.resetEndpointsBasedOnTip(tip, atStart);
    this.assignTipAttr(tip, atStart);
    this.add(tip as unknown as OpenGLMobject);
    return this;
  }

  createTip(atStart = false, tipOptions: Partial<OpenGLArrowTipOptions> = {}): OpenGLArrowTip {
    const tip = this.getUnpositionedTip(tipOptions);
    this.positionTip(tip, atStart);
    return tip;
  }

  getUnpositionedTip(tipOptions: Partial<OpenGLArrowTipOptions> = {}): OpenGLArrowTip {
    const config: Partial<OpenGLArrowTipOptions> = {
      ...this.tipConfig,
      ...tipOptions,
    };
    return new OpenGLArrowTip(config);
  }

  positionTip(tip: OpenGLArrowTip, atStart = false): OpenGLArrowTip {
    let anchor: Point3D;
    let handle: Point3D;
    if (atStart) {
      anchor = this.getStart();
      handle = this.getFirstHandle();
    } else {
      handle = this.getLastHandle();
      anchor = this.getEnd();
    }
    const diff = handle.subtract(anchor);
    tip.rotate(angleOfVector(diff) - PI - tip.getAngle());
    tip.shift(anchor.subtract(tip.getTipPoint()));
    return tip;
  }

  resetEndpointsBasedOnTip(tip: OpenGLArrowTip, atStart: boolean): this {
    if (this.getLength() === 0) {
      return this;
    }
    let start: Point3D;
    let end: Point3D;
    if (atStart) {
      start = tip.getBase();
      end = this.getEnd();
    } else {
      start = this.getStart();
      end = tip.getBase();
    }
    this.putStartAndEndOn(start, end);
    return this;
  }

  assignTipAttr(tip: OpenGLArrowTip, atStart: boolean): this {
    if (atStart) {
      this.startTip = tip;
    } else {
      this.tip = tip;
    }
    return this;
  }

  hasTip(): boolean {
    return this.tip != null && this.submobjects.includes(this.tip as unknown as OpenGLVMobject);
  }

  hasStartTip(): boolean {
    return this.startTip != null && this.submobjects.includes(this.startTip as unknown as OpenGLVMobject);
  }

  popTips(): OpenGLVGroup {
    const [start, end] = this.getStartAndEnd();
    const result = new OpenGLVGroup();
    if (this.hasTip()) {
      result.add(this.tip! as unknown as OpenGLMobject);
      this.remove(this.tip! as unknown as OpenGLMobject);
    }
    if (this.hasStartTip()) {
      result.add(this.startTip! as unknown as OpenGLMobject);
      this.remove(this.startTip! as unknown as OpenGLMobject);
    }
    this.putStartAndEndOn(start, end);
    return result;
  }

  getTips(): OpenGLVGroup {
    const result = new OpenGLVGroup();
    if (this.tip != null) {
      result.add(this.tip as unknown as OpenGLMobject);
    }
    if (this.startTip != null) {
      result.add(this.startTip as unknown as OpenGLMobject);
    }
    return result;
  }

  getTip(): OpenGLArrowTip {
    const tips = this.getTips();
    if (tips.submobjects.length === 0) {
      throw new Error("tip not found");
    }
    return tips.submobjects[0] as unknown as OpenGLArrowTip;
  }

  getDefaultTipLength(): number {
    return this.tipLength;
  }

  getFirstHandle(): Point3D {
    return this.points.get([1]) as unknown as Point3D;
  }

  getLastHandle(): Point3D {
    const n = this.points.shape[0];
    return this.points.get([n - 2]) as unknown as Point3D;
  }

  getEnd(): Point3D {
    if (this.hasTip()) {
      return this.tip!.getStart();
    }
    return super.getEnd();
  }

  getStart(): Point3D {
    if (this.hasStartTip()) {
      return this.startTip!.getStart();
    }
    return super.getStart();
  }

  getLength(): number {
    const [start, end] = this.getStartAndEnd();
    return np.linalg.norm(start.subtract(end)) as number;
  }
}

// ─── OpenGLArc ─────────────────────────────────────────────

export class OpenGLArc extends OpenGLTipableVMobject {
  startAngle: number;
  arcAngle: number;
  radius: number;
  nComponents: number;
  arcCenter: Point3D;

  constructor(options: OpenGLArcOptions = {}) {
    const {
      startAngle = 0,
      angle = TAU / 4,
      radius = 1.0,
      nComponents = 8,
      arcCenter,
      ...baseOpts
    } = options;

    // Store before super() since initPoints may be called
    const self = Object.create(OpenGLArc.prototype);
    self.startAngle = startAngle;
    self.arcAngle = angle;
    self.radius = radius;
    self.nComponents = nComponents;
    self.arcCenter = arcCenter ?? ORIGIN;

    super(baseOpts);

    this.startAngle = startAngle;
    this.arcAngle = angle;
    this.radius = radius;
    this.nComponents = nComponents;
    this.arcCenter = arcCenter ?? ORIGIN;
    this.orientation = -1;

    // Call initPoints after all properties are set
    this.initPoints();
  }

  initPoints(): void {
    if (this.arcAngle == null) {
      return;
    }
    this.setPoints(
      OpenGLArc.createQuadraticBezierPoints(
        this.arcAngle,
        this.startAngle,
        this.nComponents,
      ),
    );
    this.scale(this.radius, { aboutPoint: ORIGIN });
    this.shift(this.arcCenter);
  }

  static createQuadraticBezierPoints(
    angle: number,
    startAngle = 0,
    nComponents = 8,
  ): NDArray {
    const sampleAngles: number[] = [];
    const numSamples = 2 * nComponents + 1;
    for (let i = 0; i < numSamples; i++) {
      sampleAngles.push(startAngle + (angle * i) / (numSamples - 1));
    }

    const samplesData: number[][] = sampleAngles.map((a) => [
      Math.cos(a), Math.sin(a), 0,
    ]);
    const samples = np.array(samplesData);

    const theta = angle / nComponents;
    const cosHalfTheta = Math.cos(theta / 2);

    // Scale odd-indexed samples: samples[1::2] /= cos(theta/2)
    for (let i = 1; i < numSamples; i += 2) {
      for (let j = 0; j < 3; j++) {
        const val = samples.get([i, j]) as number;
        samples.set([i, j], val / cosHalfTheta);
      }
    }

    const points = np.zeros([3 * nComponents, 3]);
    // points[0::3] = samples[0:-1:2]
    // points[1::3] = samples[1::2]
    // points[2::3] = samples[2::2]
    for (let k = 0; k < nComponents; k++) {
      for (let j = 0; j < 3; j++) {
        points.set([3 * k, j], samples.get([2 * k, j]) as number);
        points.set([3 * k + 1, j], samples.get([2 * k + 1, j]) as number);
        points.set([3 * k + 2, j], samples.get([2 * k + 2, j]) as number);
      }
    }

    return points;
  }

  getArcCenter(): Point3D {
    const a1 = this.getRow(this.points, 0);
    const h = this.getRow(this.points, 1);
    const a2 = this.getRow(this.points, 2);
    const t1 = h.subtract(a1);
    const t2 = h.subtract(a2);
    const n1 = rotateVector(t1, TAU / 4);
    const n2 = rotateVector(t2, TAU / 4);
    return findIntersection(a1, n1, a2, n2);
  }

  getStartAngle(): number {
    const diff = this.getStart().subtract(this.getArcCenter());
    const angle = angleOfVector(diff);
    return ((angle % TAU) + TAU) % TAU;
  }

  getStopAngle(): number {
    const diff = this.getEnd().subtract(this.getArcCenter());
    const angle = angleOfVector(diff);
    return ((angle % TAU) + TAU) % TAU;
  }

  moveArcCenterTo(point: Point3D): this {
    this.shift(point.subtract(this.getArcCenter()));
    return this;
  }

  /** Helper to extract a row from an NDArray as a 1D NDArray */
  protected getRow(arr: NDArray, row: number): NDArray {
    const cols = arr.shape[1];
    const data: number[] = [];
    for (let j = 0; j < cols; j++) {
      data.push(arr.get([row, j]) as number);
    }
    return np.array(data);
  }
}

// ─── OpenGLArcBetweenPoints ────────────────────────────────

export class OpenGLArcBetweenPoints extends OpenGLArc {
  constructor(
    start: Point3D,
    end: Point3D,
    options: OpenGLArcBetweenPointsOptions = {},
  ) {
    const { angle = TAU / 4, ...rest } = options;
    super({ angle, ...rest });
    if (angle === 0) {
      this.setPointsAsCorners([LEFT.toArray(), RIGHT.toArray()]);
    }
    this.putStartAndEndOn(start, end);
  }
}

// ─── OpenGLCurvedArrow ─────────────────────────────────────

export class OpenGLCurvedArrow extends OpenGLArcBetweenPoints {
  constructor(
    startPoint: Point3D,
    endPoint: Point3D,
    options: OpenGLArcBetweenPointsOptions = {},
  ) {
    super(startPoint, endPoint, options);
    this.addTip();
  }
}

// ─── OpenGLCurvedDoubleArrow ───────────────────────────────

export class OpenGLCurvedDoubleArrow extends OpenGLCurvedArrow {
  constructor(
    startPoint: Point3D,
    endPoint: Point3D,
    options: OpenGLArcBetweenPointsOptions = {},
  ) {
    super(startPoint, endPoint, options);
    this.addTip(true);
  }
}

// ─── OpenGLCircle ──────────────────────────────────────────

export class OpenGLCircle extends OpenGLArc {
  constructor(options: OpenGLCircleOptions = {}) {
    const { color = RED, ...rest } = options;
    super({ startAngle: 0, angle: TAU, color, ...rest });
  }

  surround(
    mobject: OpenGLMobject,
    dimToMatch = 0,
    _stretch = false,
    buff: number = MED_SMALL_BUFF,
  ): this {
    this.replace(mobject, dimToMatch, _stretch);
    this.stretch((this.getWidth() + 2 * buff) / this.getWidth(), 0);
    this.stretch((this.getHeight() + 2 * buff) / this.getHeight(), 1);
    return this;
  }

  pointAtAngle(angle: number): Point3D {
    const startAngle = this.getStartAngle();
    return this.pointFromProportion((angle - startAngle) / TAU);
  }
}

// ─── OpenGLDot ─────────────────────────────────────────────

export class OpenGLDot extends OpenGLCircle {
  constructor(options: OpenGLDotOptions = {}) {
    const {
      point,
      radius = DEFAULT_DOT_RADIUS,
      strokeWidth = 0,
      fillOpacity = 1.0,
      color = WHITE,
      ...rest
    } = options;
    super({
      arcCenter: point ?? ORIGIN,
      radius,
      strokeWidth,
      fillOpacity,
      color,
      ...rest,
    });
  }
}

// ─── OpenGLEllipse ─────────────────────────────────────────

export class OpenGLEllipse extends OpenGLCircle {
  constructor(options: OpenGLEllipseOptions = {}) {
    const { width = 2, height = 1, ...rest } = options;
    super(rest);
    this.setWidth(width, true);
    this.setHeight(height, true);
  }
}

// ─── OpenGLAnnularSector ───────────────────────────────────

export class OpenGLAnnularSector extends OpenGLArc {
  innerRadius: number;
  outerRadius: number;

  constructor(options: OpenGLAnnularSectorOptions = {}) {
    const {
      innerRadius = 1,
      outerRadius = 2,
      angle = TAU / 4,
      startAngle = 0,
      fillOpacity = 1,
      strokeWidth = 0,
      color = WHITE,
      ...rest
    } = options;
    // Store before super since initPoints is called
    const tempSelf = { innerRadius, outerRadius };
    Object.assign(OpenGLAnnularSector.prototype, { _tempInner: innerRadius, _tempOuter: outerRadius });

    super({
      startAngle,
      angle,
      fillOpacity,
      strokeWidth,
      color,
      ...rest,
    });

    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;

    // Re-init points with correct radii
    this.clearPoints();
    this.initAnnularSectorPoints();
  }

  private initAnnularSectorPoints(): void {
    const innerArc = new OpenGLArc({
      startAngle: this.startAngle,
      angle: this.arcAngle,
      radius: this.innerRadius,
      arcCenter: this.arcCenter,
    });
    const outerArc = new OpenGLArc({
      startAngle: this.startAngle,
      angle: this.arcAngle,
      radius: this.outerRadius,
      arcCenter: this.arcCenter,
    });
    outerArc.reversePoints();
    this.appendPoints(innerArc.points);
    this.addLineTo(this.getRow(outerArc.points, 0));
    this.appendPoints(outerArc.points);
    this.addLineTo(this.getRow(innerArc.points, 0));
  }
}

// ─── OpenGLSector ──────────────────────────────────────────

export class OpenGLSector extends OpenGLAnnularSector {
  constructor(options: OpenGLAnnularSectorOptions = {}) {
    const { outerRadius = 1, innerRadius = 0, ...rest } = options;
    super({ innerRadius, outerRadius, ...rest });
  }
}

// ─── OpenGLAnnulus ─────────────────────────────────────────

export class OpenGLAnnulus extends OpenGLCircle {
  markPathsClosed: boolean;
  innerRadius: number;
  outerRadius: number;

  constructor(options: {
    innerRadius?: number;
    outerRadius?: number;
    fillOpacity?: number;
    strokeWidth?: number;
    color?: ParsableManimColor;
    markPathsClosed?: boolean;
  } & OpenGLCircleOptions = {}) {
    const {
      innerRadius = 1,
      outerRadius = 2,
      fillOpacity = 1,
      strokeWidth = 0,
      color = WHITE,
      markPathsClosed = false,
      ...rest
    } = options;
    super({ fillOpacity, strokeWidth, color, ...rest });
    this.markPathsClosed = markPathsClosed;
    this.innerRadius = innerRadius;
    this.outerRadius = outerRadius;

    // Re-init points for annulus
    this.clearPoints();
    this.initAnnulusPoints();
  }

  private initAnnulusPoints(): void {
    this.radius = this.outerRadius;
    const outerCircle = new OpenGLCircle({ radius: this.outerRadius });
    const innerCircle = new OpenGLCircle({ radius: this.innerRadius });
    innerCircle.reversePoints();
    this.appendPoints(outerCircle.points);
    this.appendPoints(innerCircle.points);
    this.shift(this.arcCenter);
  }
}

// ─── OpenGLLine ────────────────────────────────────────────

export class OpenGLLine extends OpenGLTipableVMobject {
  dim: number;
  buff: number;
  pathArc: number;
  lineStart: Point3D;
  lineEnd: Point3D;

  constructor(
    start: Point3D | OpenGLMobject = LEFT,
    end: Point3D | OpenGLMobject = RIGHT,
    options: OpenGLLineOptions = {},
  ) {
    const { buff = 0, pathArc = 0, ...baseOpts } = options;

    super(baseOpts);
    this.dim = 3;
    this.buff = buff;
    this.pathArc = pathArc;

    this.lineStart = ORIGIN;
    this.lineEnd = ORIGIN;

    this.setStartAndEndAttrs(start, end);
    this.initPoints();
  }

  initPoints(): void {
    if (this.lineStart == null || this.lineEnd == null) {
      return;
    }
    this.setPointsByEnds(this.lineStart, this.lineEnd, this.buff, this.pathArc);
  }

  setPointsByEnds(
    start: Point3D,
    end: Point3D,
    buff = 0,
    pathArc = 0,
  ): void {
    if (pathArc) {
      this.setPoints(OpenGLArc.createQuadraticBezierPoints(pathArc));
      this.putStartAndEndOn(start, end);
    } else {
      this.setPointsAsCorners([start.toArray(), end.toArray()]);
    }
    this.accountForBuff(this.buff);
  }

  setPathArc(newValue: number): void {
    this.pathArc = newValue;
    this.initPoints();
  }

  accountForBuff(buff: number): this {
    if (buff === 0) {
      return this;
    }
    const length = this.pathArc === 0
      ? this.getLength()
      : this.getArcLength();
    if (length < 2 * buff) {
      return this;
    }
    const buffProp = buff / length;
    this.pointwiseBecomePartial(this, buffProp, 1 - buffProp);
    return this;
  }

  setStartAndEndAttrs(
    start: Point3D | OpenGLMobject,
    end: Point3D | OpenGLMobject,
  ): void {
    const roughStart = this.pointify(start);
    const roughEnd = this.pointify(end);
    const diff = roughEnd.subtract(roughStart);
    const vect = normalize(diff);
    this.lineStart = this.pointify(start, vect).add(vect.multiply(this.buff));
    this.lineEnd = this.pointify(end, vect.multiply(-1)).subtract(vect.multiply(this.buff));
  }

  pointify(
    mobOrPoint: Point3D | OpenGLMobject,
    direction?: NDArray,
  ): Point3D {
    if (mobOrPoint instanceof OpenGLMobject) {
      if (direction == null) {
        return mobOrPoint.getCenter();
      }
      return mobOrPoint.getContinuousBoundingBoxPoint(direction as Point3D);
    }
    // It's a Point3D (NDArray)
    const point = mobOrPoint;
    const result = np.zeros([this.dim]);
    const pointArr = point.toArray() as number[];
    for (let i = 0; i < Math.min(pointArr.length, this.dim); i++) {
      result.set([i], pointArr[i]);
    }
    return result;
  }

  putStartAndEndOn(start: Point3D, end: Point3D): this {
    const [currStart, currEnd] = this.getStartAndEnd();
    if (np.allclose(currStart, currEnd)) {
      this.setPointsByEnds(start, end, 0, this.pathArc);
    }
    return super.putStartAndEndOn(start, end);
  }

  getVector(): Point3D {
    return this.getEnd().subtract(this.getStart());
  }

  getUnitVector(): Point3D {
    return normalize(this.getVector());
  }

  getAngle(): number {
    return angleOfVector(this.getVector());
  }

  getProjection(point: Point3D): Point3D {
    const unitVect = this.getUnitVector();
    const start = this.getStart();
    const diff = point.subtract(start);
    const d = np.dot(diff, unitVect) as number;
    return start.add(unitVect.multiply(d));
  }

  getSlope(): number {
    return Math.tan(this.getAngle());
  }

  setAngle(angle: number, aboutPoint?: Point3D): this {
    const pt = aboutPoint ?? this.getStart();
    this.rotate(angle - this.getAngle(), undefined, { aboutPoint: pt });
    return this;
  }

  setLength(length: number): void {
    this.scale(length / this.getLength());
  }
}

// ─── OpenGLDashedLine ──────────────────────────────────────

export class OpenGLDashedLine extends OpenGLLine {
  dashedRatio: number;
  dashLength: number;

  constructor(
    start: Point3D | OpenGLMobject = LEFT,
    end: Point3D | OpenGLMobject = RIGHT,
    options: OpenGLDashedLineOptions = {},
  ) {
    const { dashLength = DEFAULT_DASH_LENGTH, dashedRatio = 0.5, ...rest } = options;

    super(start, end, rest);
    this.dashedRatio = dashedRatio;
    this.dashLength = dashLength;

    const numDashes = this.calculateNumDashes(dashedRatio);
    const dashes = new OpenGLDashedVMobject(this, {
      numDashes,
      dashedRatio,
    });
    this.clearPoints();
    this.add(...dashes.submobjects as unknown as OpenGLMobject[]);
  }

  calculateNumDashes(dashedRatio: number): number {
    return Math.max(
      2,
      Math.ceil((this.getLength() / this.dashLength) * dashedRatio),
    );
  }

  getStart(): Point3D {
    if (this.submobjects.length > 0) {
      return (this.submobjects[0] as unknown as OpenGLVMobject).getStart();
    }
    return super.getStart();
  }

  getEnd(): Point3D {
    if (this.submobjects.length > 0) {
      const last = this.submobjects[this.submobjects.length - 1] as unknown as OpenGLVMobject;
      return last.getEnd();
    }
    return super.getEnd();
  }

  getFirstHandle(): Point3D {
    const first = this.submobjects[0] as unknown as OpenGLVMobject;
    const pts = first.points;
    const data: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      data.push(pts.get([1, j]) as number);
    }
    return np.array(data);
  }

  getLastHandle(): Point3D {
    const last = this.submobjects[this.submobjects.length - 1] as unknown as OpenGLVMobject;
    const pts = last.points;
    const n = pts.shape[0];
    const data: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      data.push(pts.get([n - 2, j]) as number);
    }
    return np.array(data);
  }
}

// ─── OpenGLTangentLine ─────────────────────────────────────

export class OpenGLTangentLine extends OpenGLLine {
  tangentLength: number;
  dAlpha: number;

  constructor(
    vmob: OpenGLVMobject,
    alpha: number,
    options: OpenGLTangentLineOptions = {},
  ) {
    const { length = 1, dAlpha = 1e-6, ...rest } = options;

    const da = dAlpha;
    const a1 = clip(alpha - da, 0, 1);
    const a2 = clip(alpha + da, 0, 1);
    super(vmob.pfp(a1), vmob.pfp(a2), rest);
    this.tangentLength = length;
    this.dAlpha = dAlpha;
    this.scale(this.tangentLength / this.getLength());
  }
}

// ─── OpenGLElbow ───────────────────────────────────────────

export class OpenGLElbow extends OpenGLVMobject {
  elbowAngle: number;

  constructor(options: OpenGLElbowOptions = {}) {
    const { width = 0.2, angle = 0, ...rest } = options;
    super(rest);
    this.elbowAngle = angle;
    this.setPointsAsCorners([
      UP.toArray(),
      UP.add(RIGHT).toArray(),
      RIGHT.toArray(),
    ]);
    this.setWidth(width, false, { aboutPoint: ORIGIN });
    this.rotate(this.elbowAngle, undefined, { aboutPoint: ORIGIN });
  }
}

// ─── OpenGLArrow ───────────────────────────────────────────

export class OpenGLArrow extends OpenGLLine {
  thickness: number;
  tipWidthRatio: number;
  tipAngle: number;
  maxTipLengthToLengthRatio: number;
  maxWidthToLengthRatio: number;
  tipIndex: number;

  constructor(
    start: Point3D = LEFT,
    end: Point3D = RIGHT,
    options: OpenGLArrowOptions = {},
  ) {
    const {
      pathArc = 0,
      fillColor = GREY_A,
      fillOpacity = 1,
      strokeWidth = 0,
      buff = MED_SMALL_BUFF,
      thickness = 0.05,
      tipWidthRatio = 5,
      tipAngle = PI / 3,
      maxTipLengthToLengthRatio = 0.5,
      maxWidthToLengthRatio = 0.1,
      ...rest
    } = options;

    const arrowSelf = Object.create(OpenGLArrow.prototype);
    arrowSelf.thickness = thickness;
    arrowSelf.tipWidthRatio = tipWidthRatio;
    arrowSelf.tipAngle = tipAngle;
    arrowSelf.maxTipLengthToLengthRatio = maxTipLengthToLengthRatio;
    arrowSelf.maxWidthToLengthRatio = maxWidthToLengthRatio;
    arrowSelf.tipIndex = 0;

    super(start, end, {
      buff,
      pathArc,
      fillColor,
      fillOpacity,
      strokeWidth,
      ...rest,
    });

    this.thickness = thickness;
    this.tipWidthRatio = tipWidthRatio;
    this.tipAngle = tipAngle;
    this.maxTipLengthToLengthRatio = maxTipLengthToLengthRatio;
    this.maxWidthToLengthRatio = maxWidthToLengthRatio;
    this.tipIndex = arrowSelf.tipIndex ?? 0;
  }

  setPointsByEnds(
    start: Point3D,
    end: Point3D,
    buff = 0,
    pathArc = 0,
  ): void {
    const startArr = start.toArray() as number[];
    const endArr = end.toArray() as number[];
    const vectArr = endArr.map((v, i) => v - startArr[i]);
    const vect = np.array(vectArr);
    let length = Math.max(np.linalg.norm(vect) as number, 1e-8);

    let thickness = this.thickness ?? 0.05;
    const wRatio = (this.maxWidthToLengthRatio ?? 0.1) / (thickness / length);
    if (wRatio < 1) {
      thickness *= wRatio;
    }

    let tipWidth = (this.tipWidthRatio ?? 5) * thickness;
    let tipLength = tipWidth / (2 * Math.tan((this.tipAngle ?? PI / 3) / 2));
    const tRatio = (this.maxTipLengthToLengthRatio ?? 0.5) / (tipLength / length);
    if (tRatio < 1) {
      tipLength *= tRatio;
      tipWidth *= tRatio;
    }

    let points1: NDArray;
    let points2: NDArray;

    if (pathArc === 0) {
      // Straight arrow
      const rightArr = RIGHT.toArray() as number[];
      const halfRight = rightArr.map((v) => v * 0.5);
      const originArr = ORIGIN.toArray() as number[];

      const stemLen = length - tipLength;
      const p1Data = [
        rightArr.map((v) => v * stemLen),
        halfRight.map((v) => v * stemLen),
        originArr,
      ];
      const upArr = UP.toArray() as number[];
      const downArr = DOWN.toArray() as number[];

      points1 = np.array(p1Data.map((row) =>
        row.map((v, j) => v + thickness * upArr[j] / 2)
      ));
      const p1Reversed: number[][] = [];
      for (let i = p1Data.length - 1; i >= 0; i--) {
        p1Reversed.push(p1Data[i].map((v, j) => v + thickness * upArr[j] / 2 + thickness * downArr[j]));
      }
      points2 = np.array(p1Reversed);
    } else {
      // Curved arrow — solve for radius
      const a = 2 * (1 - Math.cos(pathArc));
      const b = -2 * tipLength * Math.sin(pathArc);
      const c = tipLength ** 2 - length ** 2;
      const R = (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a);

      const arcPts = OpenGLArc.createQuadraticBezierPoints(pathArc);
      const nRows = arcPts.shape[0];

      // Reverse for points2
      const pts2Data: number[][] = [];
      for (let i = nRows - 1; i >= 0; i--) {
        const row: number[] = [];
        for (let j = 0; j < 3; j++) {
          row.push(arcPts.get([i, j]) as number);
        }
        pts2Data.push(row);
      }

      // Scale
      const pts1Data: number[][] = [];
      for (let i = 0; i < nRows; i++) {
        const row: number[] = [];
        for (let j = 0; j < 3; j++) {
          row.push((arcPts.get([i, j]) as number) * (R + thickness / 2));
        }
        pts1Data.push(row);
      }

      for (let i = 0; i < pts2Data.length; i++) {
        for (let j = 0; j < 3; j++) {
          pts2Data[i][j] *= (R - thickness / 2);
        }
      }

      let effectiveTipLength = tipLength;
      if (pathArc < 0) {
        effectiveTipLength *= -1;
      }

      const rotT = rotationMatrixTranspose(PI / 2 - pathArc, OUT);
      const downArr = DOWN.toArray() as number[];

      for (const pts of [pts1Data, pts2Data]) {
        // Apply rotation: pts = np.dot(pts, rotT)
        const rotated: number[][] = [];
        for (let i = 0; i < pts.length; i++) {
          const row: number[] = [0, 0, 0];
          for (let k = 0; k < 3; k++) {
            for (let m = 0; m < 3; m++) {
              row[k] += pts[i][m] * (rotT.get([m, k]) as number);
            }
          }
          rotated.push(row);
        }
        for (let i = 0; i < pts.length; i++) {
          for (let j = 0; j < 3; j++) {
            pts[i][j] = rotated[i][j] + R * downArr[j];
          }
        }
      }

      points1 = np.array(pts1Data);
      points2 = np.array(pts2Data);
    }

    this.setPoints(points1);

    // Tip
    const upHalf = UP.multiply(tipWidth / 2);
    this.addLineTo(upHalf);
    const leftTip = LEFT.multiply(tipLength);
    this.addLineTo(leftTip);
    this.tipIndex = this.points.shape[0] - 1;
    const downHalf = DOWN.multiply(tipWidth / 2);
    this.addLineTo(downHalf);

    // Connect to points2[0]
    const p2Row0: number[] = [];
    for (let j = 0; j < points2.shape[1]; j++) {
      p2Row0.push(points2.get([0, j]) as number);
    }
    this.addLineTo(np.array(p2Row0));

    // Append points2
    this.appendPoints(points2);

    // Close — add line to points1[0]
    const p1Row0: number[] = [];
    for (let j = 0; j < points1.shape[1]; j++) {
      p1Row0.push(points1.get([0, j]) as number);
    }
    this.addLineTo(np.array(p1Row0));

    if (length > 0) {
      const currentLen = this.getLength();
      if (currentLen > 0) {
        super.scale(length / currentLen);
      }
    }

    this.rotate(angleOfVector(vect) - this.getAngle());
    const normVect = normalize(vect);
    const normVectArr = normVect.toArray() as number[];
    this.rotate(
      PI / 2 - Math.acos(normVectArr[2]),
      rotateVector(this.getUnitVector(), -PI / 2),
    );
    this.shift(start.subtract(this.getStart()));
    this.refreshTriangulation();
  }

  resetPointsAroundEnds(): this {
    this.setPointsByEnds(
      this.getStart(),
      this.getEnd(),
      0,
      this.pathArc,
    );
    return this;
  }

  getStart(): Point3D {
    const nppc = this.nPointsPerCurve;
    const pts = this.points;
    const n = pts.shape[0];
    const start: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      start.push(((pts.get([0, j]) as number) + (pts.get([n - nppc, j]) as number)) / 2);
    }
    return np.array(start);
  }

  getEnd(): Point3D {
    const pts = this.points;
    const data: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      data.push(pts.get([this.tipIndex, j]) as number);
    }
    return np.array(data);
  }

  putStartAndEndOn(start: Point3D, end: Point3D): this {
    this.setPointsByEnds(start, end, 0, this.pathArc);
    return this;
  }

  scale(factor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    super.scale(factor, options);
    this.resetPointsAroundEnds();
    return this;
  }

  setThickness(thickness: number): this {
    this.thickness = thickness;
    this.resetPointsAroundEnds();
    return this;
  }

  setPathArc(pathArc: number): void {
    this.pathArc = pathArc;
    this.resetPointsAroundEnds();
  }
}

// ─── OpenGLVector ──────────────────────────────────────────

export class OpenGLVector extends OpenGLArrow {
  constructor(options: OpenGLVectorOptions = {}) {
    const { direction, buff = 0, ...rest } = options;
    let dir = direction ?? RIGHT;
    const dirArr = dir.toArray() as number[];
    if (dirArr.length === 2) {
      dir = np.array([dirArr[0], dirArr[1], 0]);
    }
    super(ORIGIN, dir, { buff, ...rest });
  }
}

// ─── OpenGLDoubleArrow ─────────────────────────────────────

export class OpenGLDoubleArrow extends OpenGLArrow {
  constructor(
    start: Point3D = LEFT,
    end: Point3D = RIGHT,
    options: OpenGLArrowOptions = {},
  ) {
    super(start, end, options);
    this.addTip(true);
  }
}

// ─── OpenGLCubicBezier ─────────────────────────────────────

export class OpenGLCubicBezier extends OpenGLVMobject {
  constructor(
    a0: Point3D,
    h0: Point3D,
    h1: Point3D,
    a1: Point3D,
    options: OpenGLVMobjectOptions = {},
  ) {
    super(options);
    this.addCubicBezierCurve(a0, h0, h1, a1);
  }
}

// ─── OpenGLPolygon ─────────────────────────────────────────

export class OpenGLPolygon extends OpenGLVMobject {
  vertices: NDArray;

  constructor(vertices: Point3D[], options: OpenGLPolygonOptions = {}) {
    super(options);
    const vertData: number[][] = vertices.map((v) => v.toArray() as number[]);
    this.vertices = np.array(vertData);
    this.initPolygonPoints();
  }

  private initPolygonPoints(): void {
    const vertData = this.vertices.toArray() as number[][];
    const corners = [...vertData, vertData[0]];
    this.setPointsAsCorners(corners);
  }

  getVertices(): NDArray {
    return this.getStartAnchors();
  }

  roundCorners(radius = 0.5): this {
    const vertices = this.getVertices();
    const nVerts = vertices.shape[0];

    // Convert to array of NDArrays
    const vertList: NDArray[] = [];
    for (let i = 0; i < nVerts; i++) {
      const row: number[] = [];
      for (let j = 0; j < vertices.shape[1]; j++) {
        row.push(vertices.get([i, j]) as number);
      }
      vertList.push(np.array(row));
    }

    const arcs: OpenGLArcBetweenPoints[] = [];
    const tuples = adjacentNTuples(vertList, 3);
    for (const [v1, v2, v3] of tuples) {
      const vect1 = v2.subtract(v1);
      const vect2 = v3.subtract(v2);
      const unitVect1 = normalize(vect1);
      const unitVect2 = normalize(vect2);
      let angle = angleBetweenVectors(vect1, vect2);
      angle *= Math.sign(radius);
      const cutOffLength = Math.abs(radius) * Math.tan(angle / 2);
      const cross = np.cross(vect1, vect2);
      const crossArr = cross.toArray() as number[];
      const sign = Math.sign(crossArr[2]);
      const arc = new OpenGLArcBetweenPoints(
        v2.subtract(unitVect1.multiply(cutOffLength)),
        v2.add(unitVect2.multiply(cutOffLength)),
        { angle: sign * angle, nComponents: 2 },
      );
      arcs.push(arc);
    }

    this.clearPoints();
    // Rotate arcs so we start with the last
    const rotatedArcs = [arcs[arcs.length - 1], ...arcs.slice(0, -1)];
    const pairs = adjacentPairs(rotatedArcs);
    for (const [arc1, arc2] of pairs) {
      this.appendPoints(arc1.points);
      const line = new OpenGLLine(arc1.getEnd(), arc2.getStart());
      const arcLen = arc1.getArcLength();
      if (arcLen > 0) {
        const lenRatio = line.getLength() / arcLen;
        line.insertNCurves(Math.floor(arc1.getNumCurves() * lenRatio));
      }
      this.appendPoints(line.points);
    }
    return this;
  }
}

// ─── OpenGLRegularPolygon ──────────────────────────────────

export class OpenGLRegularPolygon extends OpenGLPolygon {
  polygonStartAngle: number;

  constructor(options: OpenGLRegularPolygonOptions = {}) {
    const { n = 6, startAngle = null, ...rest } = options;
    let sa: number;
    if (startAngle != null) {
      sa = startAngle;
    } else {
      sa = n % 2 === 0 ? 0 : 90 * DEGREES;
    }

    const startVect = rotateVector(RIGHT, sa);
    const dirs = compassDirections(n, startVect);
    // Convert NDArray rows to Point3D[]
    const vertices: Point3D[] = [];
    for (let i = 0; i < dirs.shape[0]; i++) {
      const row: number[] = [];
      for (let j = 0; j < dirs.shape[1]; j++) {
        row.push(dirs.get([i, j]) as number);
      }
      vertices.push(np.array(row));
    }
    super(vertices, rest);
    this.polygonStartAngle = sa;
  }
}

// ─── OpenGLTriangle ────────────────────────────────────────

export class OpenGLTriangle extends OpenGLRegularPolygon {
  constructor(options: OpenGLPolygonOptions = {}) {
    super({ n: 3, ...options });
  }
}

// ─── OpenGLArrowTip ────────────────────────────────────────

export class OpenGLArrowTip extends OpenGLTriangle {
  constructor(options: OpenGLArrowTipOptions = {}) {
    const {
      fillOpacity = 1,
      fillColor = WHITE,
      strokeWidth = 0,
      width = DEFAULT_ARROW_TIP_WIDTH,
      length = DEFAULT_ARROW_TIP_LENGTH,
      ...rest
    } = options;
    super({
      startAngle: 0,
      fillOpacity,
      fillColor,
      strokeWidth,
      ...rest,
    });
    this.setWidth(width, true);
    this.setHeight(length, true);
  }

  getBase(): Point3D {
    return this.pointFromProportion(0.5);
  }

  getTipPoint(): Point3D {
    const pts = this.points;
    const data: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      data.push(pts.get([0, j]) as number);
    }
    return np.array(data);
  }

  getVector(): Point3D {
    return this.getTipPoint().subtract(this.getBase());
  }

  getAngle(): number {
    return angleOfVector(this.getVector());
  }

  getLength(): number {
    return np.linalg.norm(this.getVector()) as number;
  }
}

// ─── OpenGLRectangle ───────────────────────────────────────

export class OpenGLRectangle extends OpenGLPolygon {
  constructor(options: OpenGLRectangleOptions = {}) {
    const { color = WHITE, width = 4.0, height = 2.0, ...rest } = options;
    const ur = np.array([1, 1, 0]);
    const ul = np.array([-1, 1, 0]);
    const dl = np.array([-1, -1, 0]);
    const dr = np.array([1, -1, 0]);
    super([ur, ul, dl, dr], { color, ...rest });
    this.setWidth(width, true);
    this.setHeight(height, true);
  }
}

// ─── OpenGLSquare ──────────────────────────────────────────

export class OpenGLSquare extends OpenGLRectangle {
  sideLength: number;

  constructor(options: OpenGLSquareOptions = {}) {
    const { sideLength = 2.0, ...rest } = options;
    super({ height: sideLength, width: sideLength, ...rest });
    this.sideLength = sideLength;
  }
}

// ─── OpenGLRoundedRectangle ────────────────────────────────

export class OpenGLRoundedRectangle extends OpenGLRectangle {
  cornerRadius: number;

  constructor(options: OpenGLRoundedRectangleOptions = {}) {
    const { cornerRadius = 0.5, ...rest } = options;
    super(rest);
    this.cornerRadius = cornerRadius;
    this.roundCorners(this.cornerRadius);
  }
}
