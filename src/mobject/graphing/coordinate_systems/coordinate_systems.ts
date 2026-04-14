/**
 * Mobjects that represent coordinate systems.
 *
 * TypeScript port of manim/mobject/graphing/coordinate_systems.py
 *
 * In Python, Axes(VGroup, CoordinateSystem) uses multiple inheritance.
 * In TypeScript, we make CoordinateSystem a mixin (abstract class) and
 * Axes extends VMobject, with CoordinateSystem methods mixed in via
 * the class hierarchy: Axes extends CoordinateSystem which extends VMobject.
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
  UR,
  DL,
  DR,
  PI,
  TAU,
  DEGREES,
  SMALL_BUFF,
  MED_SMALL_BUFF,
  DEFAULT_DOT_RADIUS,
} from "../../../constants/constants.js";
import { config } from "../../../_config/index.js";
import { VMobject, VGroup, VDict } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { Mobject } from "../../mobject/index.js";
import { Line, Circle, Polygon, RegularPolygon } from "../../geometry/index.js";
import type { LineOptions } from "../../geometry/index.js";
import { NumberLine } from "../number_line/index.js";
import type { NumberLineOptions } from "../number_line/index.js";
import { ParametricFunction, ImplicitFunction } from "../functions/index.js";
import type { ParametricFunctionOptions } from "../functions/index.js";
import { LinearBase, _ScaleBase } from "../scale/index.js";
import { MathTex } from "../../text/tex_mobject/index.js";
import { Surface } from "../../three_d/index.js";
import {
  BLUE_D,
  GREEN,
  WHITE,
  BLACK,
  PURE_YELLOW,
  ManimColor,
  colorGradient,
  interpolateColor,
  invertColor,
} from "../../../utils/color/index.js";
import type { ParsableManimColor } from "../../../utils/color/core.js";
import {
  mergeDictsRecursively,
  updateDictRecursively,
} from "../../../utils/config_ops/index.js";
import { binarySearch } from "../../../utils/simple_functions/index.js";
import { angleOfVector } from "../../../utils/space_ops/index.js";
import { interpolate } from "../../../utils/bezier/index.js";
import type { IColor } from "../../../core/types.js";

// ─── Options interfaces ───────────────────────────────────────

export interface CoordinateSystemOptions {
  xRange?: number[];
  yRange?: number[];
  xLength?: number | null;
  yLength?: number | null;
  dimension?: number;
}

export interface AxesOptions extends CoordinateSystemOptions {
  axisConfig?: Record<string, unknown> | null;
  xAxisConfig?: Record<string, unknown> | null;
  yAxisConfig?: Record<string, unknown> | null;
  tips?: boolean;
}

export interface ThreeDAxesOptions extends AxesOptions {
  zRange?: number[];
  zLength?: number | null;
  zAxisConfig?: Record<string, unknown> | null;
  zNormal?: Point3D;
  numAxisPieces?: number;
  lightSource?: Point3D;
}

export interface NumberPlaneOptions extends AxesOptions {
  backgroundLineStyle?: Record<string, unknown> | null;
  fadedLineStyle?: Record<string, unknown> | null;
  fadedLineRatio?: number;
  makeSmoothAfterApplyingFunctions?: boolean;
}

export interface PolarPlaneOptions extends Omit<AxesOptions, "xRange" | "yRange" | "xLength" | "yLength"> {
  radiusMax?: number;
  size?: number | null;
  radiusStep?: number;
  azimuthStep?: number | null;
  azimuthUnits?: string | null;
  azimuthCompactFraction?: boolean;
  azimuthOffset?: number;
  azimuthDirection?: string;
  azimuthLabelBuff?: number;
  azimuthLabelFontSize?: number;
  radiusConfig?: Record<string, unknown> | null;
  backgroundLineStyle?: Record<string, unknown> | null;
  fadedLineStyle?: Record<string, unknown> | null;
  fadedLineRatio?: number;
  makeSmoothAfterApplyingFunctions?: boolean;
}

export interface ComplexPlaneOptions extends NumberPlaneOptions {}

// ─── Helper: simple fraction ──────────────────────────────────

function toFraction(value: number, maxDenominator: number = 100): [number, number] {
  if (value === 0) return [0, 1];
  const sign = value < 0 ? -1 : 1;
  let bestN = 0;
  let bestD = 1;
  let bestError = Math.abs(value);

  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(Math.abs(value) * d);
    const error = Math.abs(Math.abs(value) - n / d);
    if (error < bestError) {
      bestError = error;
      bestN = n;
      bestD = d;
      if (error < 1e-10) break;
    }
  }

  return [sign * bestN, bestD];
}

// ─── Helper type for graphs with underlying function ──────────

type GraphWithFunction = ParametricFunction & {
  underlyingFunction?: (x: number) => number;
};

// ─── Helper to create a label from a NumberLine ───────────────

function createLabelTex(
  axis: NumberLine,
  label: number | string | Mobject,
): Mobject {
  if (label instanceof Mobject) return label;
  return new MathTex([String(label)]);
}

// ─── CoordinateSystem ─────────────────────────────────────────

/**
 * Abstract base class for Axes and NumberPlane.
 *
 * In Python this is a plain class. Here it extends VMobject so that
 * subclasses (Axes, NumberPlane, etc.) are proper Mobjects with add(),
 * shift(), etc.
 */
export class CoordinateSystem extends VMobject {
  dimension: number;
  xRange: number[];
  yRange: number[];
  xLength: number | null;
  yLength: number | null;
  numSampledGraphPointsPerTick: number;
  xAxis!: NumberLine;

  constructor(options: CoordinateSystemOptions = {}) {
    super();

    const {
      xRange: xRangeInput,
      yRange: yRangeInput,
      xLength = null,
      yLength = null,
      dimension = 2,
    } = options;

    this.dimension = dimension;
    const defaultStep = 1;

    if (xRangeInput == null) {
      this.xRange = [
        Math.round(-config.frameXRadius),
        Math.round(config.frameXRadius),
        defaultStep,
      ];
    } else if (xRangeInput.length === 2) {
      this.xRange = [...xRangeInput, defaultStep];
    } else {
      this.xRange = [...xRangeInput];
    }

    if (yRangeInput == null) {
      this.yRange = [
        Math.round(-config.frameYRadius),
        Math.round(config.frameYRadius),
        defaultStep,
      ];
    } else if (yRangeInput.length === 2) {
      this.yRange = [...yRangeInput, defaultStep];
    } else {
      this.yRange = [...yRangeInput];
    }

    this.xLength = xLength;
    this.yLength = yLength;
    this.numSampledGraphPointsPerTick = 10;
  }

  coordsToPoint(...coords: number[]): Point3D {
    throw new Error("Not implemented — override in subclass");
  }

  pointToCoords(point: Point3D | number[]): number[] {
    throw new Error("Not implemented — override in subclass");
  }

  polarToPoint(radius: number, azimuth: number): Point3D {
    return this.coordsToPoint(
      radius * Math.cos(azimuth),
      radius * Math.sin(azimuth),
    );
  }

  pointToPolar(point: Point3D | number[]): [number, number] {
    const [x, y] = this.pointToCoords(point);
    return [Math.sqrt(x * x + y * y), Math.atan2(y, x)];
  }

  c2p(...coords: number[]): Point3D {
    return this.coordsToPoint(...coords);
  }

  p2c(point: Point3D | number[]): number[] {
    return this.pointToCoords(point);
  }

  pr2pt(radius: number, azimuth: number): Point3D {
    return this.polarToPoint(radius, azimuth);
  }

  pt2pr(point: Point3D | number[]): [number, number] {
    return this.pointToPolar(point);
  }

  getAxes(): VGroup {
    throw new Error("Not implemented — override in subclass");
  }

  getAxis(index: number): NumberLine {
    return this.getAxes().submobjects[index] as unknown as NumberLine;
  }

  getOrigin(): Point3D {
    return this.coordsToPoint(0, 0);
  }

  getXAxis(): NumberLine {
    return this.getAxis(0);
  }

  getYAxis(): NumberLine {
    return this.getAxis(1);
  }

  getZAxis(): NumberLine {
    return this.getAxis(2);
  }

  getXUnitSize(): number {
    return this.getXAxis().getUnitSize();
  }

  getYUnitSize(): number {
    return this.getYAxis().getUnitSize();
  }

  getXAxisLabel(
    label: number | string | Mobject,
    edge: Point3D = UR as Point3D,
    direction: Point3D = UR as Point3D,
    buff: number = SMALL_BUFF,
  ): Mobject {
    return this._getAxisLabel(label, this.getXAxis() as unknown as Mobject, edge, direction, buff);
  }

  getYAxisLabel(
    label: number | string | Mobject,
    edge: Point3D = UR as Point3D,
    direction?: Point3D,
    buff: number = SMALL_BUFF,
  ): Mobject {
    const dir = direction ?? (UP as NDArray).multiply(0.5).add(RIGHT) as Point3D;
    return this._getAxisLabel(label, this.getYAxis() as unknown as Mobject, edge, dir, buff);
  }

  protected _getAxisLabel(
    label: number | string | Mobject,
    axis: Mobject,
    edge: Point3D,
    direction: Point3D,
    buff: number = SMALL_BUFF,
  ): Mobject {
    const labelMobject = createLabelTex(this.xAxis, label);
    labelMobject.nextTo(axis.getEdgeCenter(edge), direction, { buff });
    labelMobject.shiftOntoScreen(MED_SMALL_BUFF);
    return labelMobject;
  }

  getAxisLabels(): VGroup {
    throw new Error("Not implemented — override in subclass");
  }

  addCoordinates(
    ...axesNumbers: (Iterable<number> | Record<number, string | number | Mobject> | null | undefined)[]
  ): this {
    const coordLabels = new VGroup();
    if (axesNumbers.length === 0) {
      axesNumbers = new Array(this.dimension).fill(null);
    }

    const axes = this.getAxes();
    const axesSubs = axes.submobjects as unknown as NumberLine[];

    for (let i = 0; i < Math.min(axesSubs.length, axesNumbers.length); i++) {
      const axis = axesSubs[i];
      const values = axesNumbers[i];
      let labels: VGroup;

      if (values != null && typeof values === "object" && !(Symbol.iterator in values)) {
        axis.addLabels(values as Record<number, string | number | Mobject>);
        labels = axis.labels;
      } else if (values == null && axis.scaling.customLabels) {
        const tickRange = axis.getTickRange();
        const customLabels = axis.scaling.getCustomLabels(tickRange);
        const dict: Record<number, Mobject> = {};
        for (let j = 0; j < tickRange.length; j++) {
          dict[tickRange[j]] = customLabels[j] as unknown as Mobject;
        }
        axis.addLabels(dict);
        labels = axis.labels;
      } else {
        const vals = values != null ? Array.from(values as Iterable<number>) : undefined;
        axis.addNumbers({ xValues: vals });
        labels = axis.numbers;
      }
      coordLabels.add(labels as unknown as VMobject);
    }

    (this as unknown as Record<string, unknown>)["coordinateLabels"] = coordLabels;
    return this;
  }

  getLineFromAxisToPoint(
    index: number,
    point: Point3D | number[],
    options: {
      lineFunc?: new (opts: LineOptions) => Line;
      lineConfig?: Record<string, unknown>;
      color?: ParsableManimColor | null;
      strokeWidth?: number;
    } = {},
  ): Line {
    const {
      lineFunc,
      lineConfig: lineConfigInput,
      color: colorInput,
      strokeWidth = 2,
    } = options;

    const lineConfig: Record<string, unknown> = lineConfigInput ? { ...lineConfigInput } : {};
    lineConfig["strokeWidth"] = strokeWidth;

    const LineCtor = lineFunc ?? Line;
    const axis = this.getAxis(index);
    const p = ensureNDArray(point);

    const projected = axis.numberToPoint(axis.pointToNumber(p));
    return new LineCtor({
      start: projected,
      end: p,
      strokeWidth,
    } as LineOptions);
  }

  getVerticalLine(
    point: Point3D | number[],
    options: {
      lineFunc?: new (opts: LineOptions) => Line;
      lineConfig?: Record<string, unknown>;
      color?: ParsableManimColor | null;
      strokeWidth?: number;
    } = {},
  ): Line {
    return this.getLineFromAxisToPoint(0, point, options);
  }

  getHorizontalLine(
    point: Point3D | number[],
    options: {
      lineFunc?: new (opts: LineOptions) => Line;
      lineConfig?: Record<string, unknown>;
      color?: ParsableManimColor | null;
      strokeWidth?: number;
    } = {},
  ): Line {
    return this.getLineFromAxisToPoint(1, point, options);
  }

  getLinesToPoint(
    point: Point3D | number[],
    options: {
      lineFunc?: new (opts: LineOptions) => Line;
      lineConfig?: Record<string, unknown>;
      color?: ParsableManimColor | null;
      strokeWidth?: number;
    } = {},
  ): VGroup {
    return new VGroup(
      this.getHorizontalLine(point, options),
      this.getVerticalLine(point, options),
    );
  }

  // ─── Graphing ─────────────────────────────────────────────

  plot(
    func: (x: number) => number,
    options: {
      xRange?: number[] | null;
      useVectorized?: boolean;
      colorscale?: unknown[] | null;
      colorscaleAxis?: number;
    } & Record<string, unknown> = {},
  ): GraphWithFunction {
    const {
      xRange: xRangeInput,
      useVectorized = false,
      colorscale,
      colorscaleAxis = 1,
      ...kwargs
    } = options;

    const tRange = [...this.xRange];
    if (xRangeInput != null) {
      for (let i = 0; i < xRangeInput.length; i++) {
        tRange[i] = xRangeInput[i];
      }
    }

    if (xRangeInput == null || xRangeInput.length < 3) {
      tRange[2] /= this.numSampledGraphPointsPerTick;
    }

    const graph = new ParametricFunction(
      (t: number) => this.coordsToPoint(t, func(t)),
      {
        tRange: tRange as [number, number] | [number, number, number],
        scaling: this.xAxis.scaling,
        useVectorized,
        ...(kwargs as Partial<ParametricFunctionOptions>),
      },
    ) as GraphWithFunction;

    graph.underlyingFunction = func;

    // TODO: colorscale support
    return graph;
  }

  plotImplicitCurve(
    func: (x: number, y: number) => number,
    options: {
      minDepth?: number;
      maxQuads?: number;
    } & Record<string, unknown> = {},
  ): ImplicitFunction {
    const { minDepth = 5, maxQuads = 1500, ...kwargs } = options;
    const xScale = this.getXAxis().scaling;
    const yScale = this.getYAxis().scaling;

    const graph = new ImplicitFunction(
      (x: number, y: number) => func(xScale.function(x), yScale.function(y)),
      {
        xRange: [this.xRange[0], this.xRange[1]],
        yRange: [this.yRange[0], this.yRange[1]],
        minDepth,
        maxQuads,
      },
    );

    graph.scale(this.getXUnitSize(), { aboutPoint: ORIGIN as Point3D });
    graph.shift(this.getOrigin());
    return graph;
  }

  plotParametricCurve(
    func: (t: number) => number[],
    options: {
      useVectorized?: boolean;
    } & Partial<ParametricFunctionOptions> = {},
  ): GraphWithFunction {
    const { useVectorized = false, ...kwargs } = options;
    const dim = this.dimension;
    const graph = new ParametricFunction(
      (t: number) => this.coordsToPoint(...func(t).slice(0, dim)),
      { useVectorized, ...kwargs },
    ) as GraphWithFunction;
    (graph as unknown as Record<string, unknown>).underlyingFunction = func;
    return graph;
  }

  plotPolarGraph(
    rFunc: (theta: number) => number,
    options: {
      thetaRange?: number[] | null;
    } & Partial<ParametricFunctionOptions> = {},
  ): GraphWithFunction {
    const { thetaRange: thetaRangeInput, ...kwargs } = options;
    const thetaRange = thetaRangeInput ?? [0, 2 * PI];
    const graph = new ParametricFunction(
      (th: number) => this.pr2pt(rFunc(th), th),
      { tRange: thetaRange as [number, number] | [number, number, number], ...kwargs },
    ) as GraphWithFunction;
    graph.underlyingFunction = rFunc;
    return graph;
  }

  plotSurface(
    func: (u: number, v: number) => number,
    options: {
      uRange?: number[];
      vRange?: number[];
    } & Record<string, unknown> = {},
  ): Mobject {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    const { uRange, vRange, ...kwargs } = options;
    return new VMobject();
  }

  inputToGraphPoint(
    x: number,
    graph: GraphWithFunction,
  ): Point3D {
    if (graph.underlyingFunction) {
      return graph.function(x);
    }
    throw new Error(`x=${x} not located in the range of the graph`);
  }

  inputToGraphCoords(
    x: number,
    graph: GraphWithFunction,
  ): [number, number] {
    return [x, graph.underlyingFunction!(x)];
  }

  i2gc(x: number, graph: GraphWithFunction): [number, number] {
    return this.inputToGraphCoords(x, graph);
  }

  i2gp(x: number, graph: GraphWithFunction): Point3D {
    return this.inputToGraphPoint(x, graph);
  }

  getGraphLabel(
    graph: GraphWithFunction,
    options: {
      label?: number | string | Mobject;
      xVal?: number | null;
      direction?: Point3D;
      buff?: number;
      color?: ParsableManimColor | null;
      dot?: boolean;
      dotConfig?: Record<string, unknown>;
    } = {},
  ): Mobject {
    const {
      label: labelInput = "f(x)",
      xVal,
      direction = RIGHT as Point3D,
      buff = MED_SMALL_BUFF,
      color: colorInput,
      dot: addDot = false,
      dotConfig = {},
    } = options;

    const color = colorInput ?? graph.getColor();
    const labelObject = createLabelTex(this.xAxis, labelInput);
    labelObject.setColor(color as unknown as ManimColor);

    let point: Point3D;
    if (xVal == null) {
      point = this.inputToGraphPoint(this.xRange[1], graph);
      for (let i = 0; i < 100; i++) {
        const x = this.xRange[1] - (this.xRange[1] - this.xRange[0]) * i / 99;
        point = this.inputToGraphPoint(x, graph);
        if ((point as NDArray).item(1) as number < config.frameYRadius) {
          break;
        }
      }
    } else {
      point = this.inputToGraphPoint(xVal, graph);
    }

    labelObject.nextTo(point, direction, { buff });
    labelObject.shiftOntoScreen();

    return labelObject;
  }

  // ─── Calculus ─────────────────────────────────────────────

  angleOfTangent(
    x: number,
    graph: GraphWithFunction,
    dx: number = 1e-8,
  ): number {
    const [x0, y0] = this.inputToGraphCoords(x, graph);
    const [x1, y1] = this.inputToGraphCoords(x + dx, graph);
    return angleOfVector(np.array([x1 - x0, y1 - y0, 0]) as Point3D) as number;
  }

  slopeOfTangent(
    x: number,
    graph: GraphWithFunction,
    dx: number = 1e-8,
  ): number {
    return Math.tan(this.angleOfTangent(x, graph, dx));
  }

  plotDerivativeGraph(
    graph: GraphWithFunction,
    options: Record<string, unknown> = {},
  ): GraphWithFunction {
    const deriv = (x: number): number => this.slopeOfTangent(x, graph);
    return this.plot(deriv, options);
  }

  plotAntiderivativeGraph(
    graph: GraphWithFunction,
    options: {
      yIntercept?: number;
      samples?: number;
    } & Record<string, unknown> = {},
  ): GraphWithFunction {
    const { yIntercept = 0, samples = 50, ...kwargs } = options;
    const underlyingFunc = graph.underlyingFunction!;

    const antideriv = (x: number): number => {
      if (samples <= 1) return yIntercept;
      let integral = 0;
      for (let i = 1; i < samples; i++) {
        const x0 = (x * (i - 1)) / (samples - 1);
        const x1 = (x * i) / (samples - 1);
        integral += 0.5 * (underlyingFunc(x0) + underlyingFunc(x1)) * (x1 - x0);
      }
      return integral + yIntercept;
    };

    return this.plot(antideriv, kwargs);
  }

  getSecantSlopeGroup(
    x: number,
    graph: GraphWithFunction,
    options: {
      dx?: number | null;
      dxLineColor?: ParsableManimColor;
      dyLineColor?: ParsableManimColor | null;
      includeSecantLine?: boolean;
      secantLineColor?: ParsableManimColor;
      secantLineLength?: number;
    } = {},
  ): VGroup {
    const {
      dx: dxInput,
      includeSecantLine = true,
      secantLineLength = 10,
    } = options;

    const group = new VGroup();
    const dx = dxInput ?? (this.xRange[1] - this.xRange[0]) / 10;

    const p1 = this.inputToGraphPoint(x, graph);
    const p2 = this.inputToGraphPoint(x + dx, graph);

    const interimPoint = np.array([
      (p2 as NDArray).item(0) as number,
      (p1 as NDArray).item(1) as number,
      0,
    ]) as Point3D;

    const dxLine = new Line({ start: p1, end: interimPoint });
    const dfLine = new Line({ start: interimPoint, end: p2 });
    group.add(dxLine, dfLine);

    if (includeSecantLine) {
      const secantLine = new Line({ start: p1, end: p2 });
      const curLen = (secantLine as unknown as NumberLine).getLineLength();
      if (curLen > 0) {
        secantLine.scale(secantLineLength / curLen);
      }
      group.add(secantLine);
    }

    return group;
  }

  getVerticalLinesToGraph(
    graph: GraphWithFunction,
    options: {
      xRange?: number[] | null;
      numLines?: number;
    } & Record<string, unknown> = {},
  ): VGroup {
    const { xRange: xRangeInput, numLines = 20, ...lineOpts } = options;
    const xr = xRangeInput ?? this.xRange;
    const lines: Line[] = [];
    for (let i = 0; i < numLines; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / (numLines - 1);
      lines.push(this.getVerticalLine(this.i2gp(x, graph)));
    }
    return new VGroup(...lines);
  }

  getTLabel(
    xVal: number,
    graph: GraphWithFunction,
    options: {
      label?: number | string | Mobject | null;
      labelColor?: ParsableManimColor | null;
      triangleSize?: number;
      triangleColor?: ParsableManimColor | null;
      lineFunc?: new (opts: LineOptions) => Line;
      lineColor?: ParsableManimColor;
    } = {},
  ): VGroup {
    const {
      label: labelInput = null,
      triangleSize = MED_SMALL_BUFF,
      lineColor = PURE_YELLOW as unknown as ParsableManimColor,
    } = options;

    const tLabelGroup = new VGroup();

    const triangle = new RegularPolygon(3);
    triangle.scale(triangleSize / (triangle.getHeight() || 1));
    triangle.moveTo(this.coordsToPoint(xVal, 0), UP as Point3D);

    if (labelInput != null) {
      const tLabel = createLabelTex(this.xAxis, labelInput);
      tLabel.nextTo(triangle, DOWN as Point3D);
      tLabelGroup.add(tLabel as unknown as VMobject);
    }

    const vLine = this.getVerticalLine(this.i2gp(xVal, graph));
    tLabelGroup.add(triangle, vLine);
    return tLabelGroup;
  }

  static _originShift(_axisRange: number[]): number {
    throw new Error("Not implemented — override in subclass");
  }
}

// ─── Axes ─────────────────────────────────────────────────────

/**
 * Creates a set of axes.
 */
export class Axes extends CoordinateSystem {
  axisConfig: Record<string, unknown>;
  xAxisConfig: Record<string, unknown>;
  yAxisConfig: Record<string, unknown>;
  axes!: VGroup;
  axisLabels?: VGroup;
  coordinateLabels?: VGroup;

  constructor(options: AxesOptions = {}) {
    const {
      xRange,
      yRange,
      xLength = Math.round(config.frameWidth) - 2,
      yLength = Math.round(config.frameHeight) - 2,
      axisConfig: axisConfigInput = null,
      xAxisConfig: xAxisConfigInput = null,
      yAxisConfig: yAxisConfigInput = null,
      tips = true,
    } = options;

    super({ xRange, yRange, xLength, yLength });

    this.axisConfig = {
      includeTip: tips,
      numbersToExclude: [0],
    };
    this.xAxisConfig = {};
    this.yAxisConfig = {
      rotation: 90 * DEGREES,
      labelDirection: LEFT as Point3D,
    };

    Axes._updateDefaultConfigs(
      [this.axisConfig, this.xAxisConfig, this.yAxisConfig],
      [axisConfigInput, xAxisConfigInput, yAxisConfigInput],
    );

    this.xAxisConfig = mergeDictsRecursively(this.axisConfig, this.xAxisConfig);
    this.yAxisConfig = mergeDictsRecursively(this.axisConfig, this.yAxisConfig);

    // Exclude origin tick for linear scales
    if (
      this.xAxisConfig["scaling"] == null ||
      this.xAxisConfig["scaling"] instanceof LinearBase
    ) {
      this.xAxisConfig["excludeOriginTick"] = true;
    } else {
      this.xAxisConfig["excludeOriginTick"] = false;
    }

    if (
      this.yAxisConfig["scaling"] == null ||
      this.yAxisConfig["scaling"] instanceof LinearBase
    ) {
      this.yAxisConfig["excludeOriginTick"] = true;
    } else {
      this.yAxisConfig["excludeOriginTick"] = false;
    }

    this.xAxis = this._createAxis(this.xRange, this.xAxisConfig, this.xLength!);
    const yAxis = this._createAxis(this.yRange, this.yAxisConfig, this.yLength!);

    this.axes = new VGroup(this.xAxis as unknown as VMobject, yAxis as unknown as VMobject);
    this.add(...this.axes.submobjects);

    // Find center point on each axis
    const linesCenterPoint: number[] = [];
    for (const axis of [this.xAxis, yAxis]) {
      linesCenterPoint.push(
        axis.scaling.function((axis.xRange[1] + axis.xRange[0]) / 2),
      );
    }

    // Shift to center
    const centerPt = this.coordsToPoint(...linesCenterPoint);
    this.shift((centerPt as NDArray).multiply(-1) as Point3D);
  }

  static _updateDefaultConfigs(
    defaultConfigs: Record<string, unknown>[],
    passedConfigs: (Record<string, unknown> | null | undefined)[],
  ): void {
    for (let i = 0; i < defaultConfigs.length; i++) {
      if (passedConfigs[i] != null) {
        updateDictRecursively(defaultConfigs[i], passedConfigs[i]!);
      }
    }
  }

  protected _createAxis(
    rangeTerms: number[],
    axisConfig: Record<string, unknown>,
    length: number,
  ): NumberLine {
    const nlOpts: NumberLineOptions = {
      xRange: rangeTerms as [number, number, number],
      length,
    };

    // Transfer config keys to NumberLineOptions
    const keyMap: Record<string, keyof NumberLineOptions> = {
      includeTip: "includeTip",
      numbersToExclude: "numbersToExclude",
      excludeOriginTick: "excludeOriginTick",
      rotation: "rotation",
      labelDirection: "labelDirection",
      scaling: "scaling",
      strokeWidth: "strokeWidth",
      includeTicks: "includeTicks",
      includeNumbers: "includeNumbers",
      fontSize: "fontSize",
      lineToNumberBuff: "lineToNumberBuff",
      tickSize: "tickSize",
      numbersToInclude: "numbersToInclude",
      numbersWithElongatedTicks: "numbersWithElongatedTicks",
      tipWidth: "tipWidth",
      tipHeight: "tipHeight",
      decimalNumberConfig: "decimalNumberConfig",
      unitSize: "unitSize",
      // snake_case aliases from Python configs
      font_size: "fontSize",
      include_tip: "includeTip",
      include_ticks: "includeTicks",
      include_numbers: "includeNumbers",
      numbers_to_exclude: "numbersToExclude",
      numbers_to_include: "numbersToInclude",
      exclude_origin_tick: "excludeOriginTick",
      label_direction: "labelDirection",
      stroke_width: "strokeWidth",
      line_to_number_buff: "lineToNumberBuff",
      tick_size: "tickSize",
    };

    for (const [src, dst] of Object.entries(keyMap)) {
      if (axisConfig[src] != null) {
        (nlOpts as Record<string, unknown>)[dst] = axisConfig[src];
      }
    }

    const axis = new NumberLine(nlOpts);

    // Shift axis so that 0 is centered
    const originVal = Axes._originShift([axis.xMin, axis.xMax]);
    const originPoint = axis.numberToPoint(originVal);
    axis.shift((originPoint as NDArray).multiply(-1) as Point3D);

    return axis;
  }

  override coordsToPoint(...coords: number[]): Point3D {
    const origin = this.xAxis.numberToPoint(
      Axes._originShift([this.xAxis.xMin, this.xAxis.xMax]),
    );

    // Start with x-axis mapping
    let points = this.xAxis.numberToPoint(coords[0]);

    // Add contributions from other axes
    const otherAxes = this.axes.submobjects.slice(1) as unknown as NumberLine[];
    for (let i = 0; i < Math.min(otherAxes.length, coords.length - 1); i++) {
      const axisPoint = otherAxes[i].numberToPoint(coords[i + 1]);
      points = (points as NDArray).add(
        (axisPoint as NDArray).subtract(origin),
      ) as Point3D;
    }

    return points;
  }

  override pointToCoords(point: Point3D | number[]): number[] {
    const p = ensureNDArray(point);
    const result: number[] = [];
    const axesList = this.axes.submobjects as unknown as NumberLine[];
    for (const axis of axesList) {
      result.push(axis.pointToNumber(p));
    }
    return result;
  }

  override getAxes(): VGroup {
    return this.axes;
  }

  override getAxisLabels(
    xLabel: number | string | Mobject = "x",
    yLabel: number | string | Mobject = "y",
  ): VGroup {
    this.axisLabels = new VGroup(
      this.getXAxisLabel(xLabel) as unknown as VMobject,
      this.getYAxisLabel(yLabel) as unknown as VMobject,
    );
    return this.axisLabels;
  }

  plotLineGraph(
    xValues: number[],
    yValues: number[],
    options: {
      zValues?: number[] | null;
      lineColor?: ParsableManimColor;
      addVertexDots?: boolean;
      vertexDotRadius?: number;
      vertexDotStyle?: Record<string, unknown>;
    } = {},
  ): VDict {
    const {
      zValues: zValuesInput,
      addVertexDots = true,
      vertexDotRadius = DEFAULT_DOT_RADIUS,
      vertexDotStyle = {},
    } = options;

    const zValues = zValuesInput ?? new Array(xValues.length).fill(0);
    const lineGraph = new VDict();
    const graphLine = new VGroup();

    const vertices: Point3D[] = [];
    for (let i = 0; i < xValues.length; i++) {
      vertices.push(this.coordsToPoint(xValues[i], yValues[i], zValues[i]));
    }

    if (vertices.length > 1) {
      graphLine.startNewPath(vertices[0]);
      for (let i = 1; i < vertices.length; i++) {
        graphLine.addLineTo(vertices[i]);
      }
    }

    lineGraph.addEntry("line_graph", graphLine);

    if (addVertexDots) {
      const vertexDots = new VGroup();
      for (const vertex of vertices) {
        const dot = new Circle({ radius: vertexDotRadius });
        dot.moveTo(vertex);
        vertexDots.add(dot);
      }
      lineGraph.addEntry("vertex_dots", vertexDots);
    }

    return lineGraph;
  }

  static override _originShift(axisRange: number[]): number {
    if (axisRange[0] > 0) {
      return axisRange[0];
    }
    if (axisRange[1] < 0) {
      return axisRange[1];
    }
    return 0;
  }
}

// ─── ThreeDAxes ───────────────────────────────────────────────

/**
 * A 3-dimensional set of axes.
 */
export class ThreeDAxes extends Axes {
  zRange: number[];
  zLength: number | null;
  zAxisConfig: Record<string, unknown>;
  zNormal: Point3D;
  numAxisPieces: number;
  lightSource: Point3D;
  zAxis!: NumberLine;

  constructor(options: ThreeDAxesOptions = {}) {
    const {
      xRange = [-6, 6, 1],
      yRange = [-5, 5, 1],
      zRange: zRangeInput = [-4, 4, 1],
      xLength = config.frameHeight + 2.5,
      yLength = config.frameHeight + 2.5,
      zLength = config.frameHeight - 1.5,
      zAxisConfig: zAxisConfigInput = null,
      zNormal = DOWN as Point3D,
      numAxisPieces = 20,
      lightSource,
      ...rest
    } = options;

    super({
      xRange,
      yRange,
      xLength,
      yLength,
      ...rest,
    });

    this.zRange = zRangeInput ? [...zRangeInput] : [-4, 4, 1];
    this.zLength = zLength;

    this.zAxisConfig = {};
    Axes._updateDefaultConfigs([this.zAxisConfig], [zAxisConfigInput]);
    this.zAxisConfig = mergeDictsRecursively(this.axisConfig, this.zAxisConfig);

    this.zNormal = zNormal;
    this.numAxisPieces = numAxisPieces;
    this.lightSource = lightSource ??
      (DOWN as NDArray).multiply(9)
        .add((LEFT as NDArray).multiply(7))
        .add((OUT as NDArray).multiply(10)) as Point3D;

    this.dimension = 3;

    if (
      this.zAxisConfig["scaling"] == null ||
      this.zAxisConfig["scaling"] instanceof LinearBase
    ) {
      this.zAxisConfig["excludeOriginTick"] = true;
    } else {
      this.zAxisConfig["excludeOriginTick"] = false;
    }

    const zAxis = this._createAxis(this.zRange, this.zAxisConfig, this.zLength!);
    const zOrigin = Axes._originShift([zAxis.xMin, zAxis.xMax]);

    // Rotate and position z-axis
    zAxis.rotateAboutNumber(zOrigin, -PI / 2, UP as Point3D);
    zAxis.rotateAboutNumber(zOrigin, angleOfVector(this.zNormal) as number);
    const zOriginPoint = zAxis.numberToPoint(zOrigin);
    zAxis.shift((zOriginPoint as NDArray).multiply(-1) as Point3D);
    zAxis.shift(
      this.xAxis.numberToPoint(
        Axes._originShift([this.xAxis.xMin, this.xAxis.xMax]),
      ),
    );

    this.axes.add(zAxis as unknown as VMobject);
    this.add(zAxis as unknown as VMobject);
    this.zAxis = zAxis;
  }

  override getYAxisLabel(
    label: number | string | Mobject,
    edge: Point3D = UR as Point3D,
    direction: Point3D = UR as Point3D,
    buff: number = SMALL_BUFF,
    rotation: number = PI / 2,
    rotationAxis: Point3D = OUT as Point3D,
  ): Mobject {
    const positionedLabel = this._getAxisLabel(
      label,
      this.getYAxis() as unknown as Mobject,
      edge,
      direction,
      buff,
    );
    positionedLabel.rotate(rotation, rotationAxis);
    return positionedLabel;
  }

  getZAxisLabel(
    label: number | string | Mobject,
    edge: Point3D = OUT as Point3D,
    direction: Point3D = RIGHT as Point3D,
    buff: number = SMALL_BUFF,
    rotation: number = PI / 2,
    rotationAxis: Point3D = RIGHT as Point3D,
  ): Mobject {
    const positionedLabel = this._getAxisLabel(
      label,
      this.getZAxis() as unknown as Mobject,
      edge,
      direction,
      buff,
    );
    positionedLabel.rotate(rotation, rotationAxis);
    return positionedLabel;
  }

  override getAxisLabels(
    xLabel: number | string | Mobject = "x",
    yLabel: number | string | Mobject = "y",
    zLabel: number | string | Mobject = "z",
  ): VGroup {
    this.axisLabels = new VGroup(
      this.getXAxisLabel(xLabel) as unknown as VMobject,
      this.getYAxisLabel(yLabel) as unknown as VMobject,
      this.getZAxisLabel(zLabel) as unknown as VMobject,
    );
    return this.axisLabels;
  }
}

// ─── NumberPlane ──────────────────────────────────────────────

/**
 * Creates a cartesian plane with background lines.
 */
export class NumberPlane extends Axes {
  backgroundLineStyle: Record<string, unknown>;
  fadedLineStyle: Record<string, unknown> | null;
  fadedLineRatio: number;
  makeSmoothAfterApplyingFunctions: boolean;
  backgroundLines!: VGroup;
  fadedLines!: VGroup;
  xLines?: VGroup;
  yLines?: VGroup;

  constructor(options: NumberPlaneOptions = {}) {
    const {
      xRange = [
        -config.frameXRadius,
        config.frameXRadius,
        1,
      ],
      yRange = [
        -config.frameYRadius,
        config.frameYRadius,
        1,
      ],
      xLength = null,
      yLength = null,
      backgroundLineStyle: bgStyleInput = null,
      fadedLineStyle: fadedStyleInput = null,
      fadedLineRatio = 1,
      makeSmoothAfterApplyingFunctions = true,
      axisConfig: axisConfigInput,
      yAxisConfig: yAxisConfigInput,
      ...rest
    } = options;

    // Default configs for NumberPlane
    const npAxisConfig: Record<string, unknown> = {
      strokeWidth: 2,
      includeTicks: false,
      includeTip: false,
      lineToNumberBuff: SMALL_BUFF,
      labelDirection: DR as Point3D,
      fontSize: 24,
    };
    const npYAxisConfig: Record<string, unknown> = { labelDirection: DR as Point3D };
    const npBgLineStyle: Record<string, unknown> = {
      strokeColor: BLUE_D,
      strokeWidth: 2,
      strokeOpacity: 1,
    };

    Axes._updateDefaultConfigs(
      [npAxisConfig, npYAxisConfig, npBgLineStyle],
      [
        axisConfigInput as Record<string, unknown> | null ?? null,
        yAxisConfigInput as Record<string, unknown> | null ?? null,
        bgStyleInput,
      ],
    );

    const bgLineStyleFinal = { ...npBgLineStyle };

    super({
      xRange,
      yRange,
      xLength,
      yLength,
      axisConfig: npAxisConfig,
      yAxisConfig: npYAxisConfig,
      ...rest,
    });

    this.backgroundLineStyle = bgLineStyleFinal;
    this.fadedLineStyle = fadedStyleInput;
    this.fadedLineRatio = fadedLineRatio;
    this.makeSmoothAfterApplyingFunctions = makeSmoothAfterApplyingFunctions;

    this._initBackgroundLines();
  }

  protected _initBackgroundLines(): void {
    if (this.fadedLineStyle == null) {
      const style: Record<string, unknown> = { ...this.backgroundLineStyle };
      for (const key of Object.keys(style)) {
        if (typeof style[key] === "number") {
          style[key] = (style[key] as number) * 0.5;
        }
      }
      this.fadedLineStyle = style;
    }

    const [bgLines, fadedLines] = this._getLines();
    this.backgroundLines = bgLines;
    this.fadedLines = fadedLines;

    this.addToBack(
      this.fadedLines as unknown as Mobject,
      this.backgroundLines as unknown as Mobject,
    );
  }

  protected _getLines(): [VGroup, VGroup] {
    const xAxis = this.getXAxis();
    const yAxis = this.getYAxis();

    const [xLines1, xLines2] = this._getLinesParallelToAxis(
      xAxis,
      yAxis,
      yAxis.xRange[2],
      this.fadedLineRatio,
    );

    const [yLines1, yLines2] = this._getLinesParallelToAxis(
      yAxis,
      xAxis,
      xAxis.xRange[2],
      this.fadedLineRatio,
    );

    this.xLines = xLines1;
    this.yLines = yLines1;

    const lines1 = new VGroup(
      ...(xLines1.submobjects as unknown as VMobject[]),
      ...(yLines1.submobjects as unknown as VMobject[]),
    );
    const lines2 = new VGroup(
      ...(xLines2.submobjects as unknown as VMobject[]),
      ...(yLines2.submobjects as unknown as VMobject[]),
    );

    return [lines1, lines2];
  }

  protected _getLinesParallelToAxis(
    axisParallelTo: NumberLine,
    axisPerpTo: NumberLine,
    freq: number,
    ratioFadedLines: number,
  ): [VGroup, VGroup] {
    const lineStart = axisParallelTo.getStart();
    const lineEnd = axisParallelTo.getEnd();

    if (ratioFadedLines === 0) {
      ratioFadedLines = 1;
    }
    const step = (1 / ratioFadedLines) * freq;
    const lines1 = new VGroup();
    const lines2 = new VGroup();
    const unitVector = axisPerpTo.getUnitVector();

    const [xMin, xMax] = [axisPerpTo.xRange[0], axisPerpTo.xRange[1]];
    let effMin = xMin;
    let effMax = xMax;

    if (axisPerpTo.xMin > 0 && xMin < 0) {
      effMin = 0;
      effMax = Math.abs(xMin) + Math.abs(xMax);
    }

    const ranges: number[][] = [[0], [], []];

    for (let x = step; x < Math.min(effMax - effMin, effMax); x += step) {
      ranges[1].push(x);
    }
    for (let x = -step; x > Math.max(effMin - effMax, effMin); x -= step) {
      ranges[2].push(x);
    }

    for (const inputs of ranges) {
      for (let k = 0; k < inputs.length; k++) {
        const x = inputs[k];
        const newLine = new Line({ start: lineStart, end: lineEnd });
        newLine.shift((unitVector as NDArray).multiply(x) as Point3D);
        if ((k + 1) % ratioFadedLines === 0) {
          lines1.add(newLine);
        } else {
          lines2.add(newLine);
        }
      }
    }

    return [lines1, lines2];
  }

  getVector(coords: number[]): Line {
    return new Line({
      start: this.coordsToPoint(0, 0),
      end: this.coordsToPoint(...coords),
    });
  }

  prepareForNonlinearTransform(_numInsertedCurves: number = 50): this {
    // TODO: Requires familyMembersWithPoints and insertNCurves
    return this;
  }
}

// ─── PolarPlane ───────────────────────────────────────────────

/**
 * Creates a polar plane with background lines.
 */
export class PolarPlane extends Axes {
  azimuthUnits: string | null;
  azimuthDirection: string;
  azimuthStep: number;
  azimuthOffset: number;
  azimuthLabelBuff: number;
  azimuthLabelFontSize: number;
  azimuthCompactFraction: boolean;
  radiusConfig: Record<string, unknown>;
  backgroundLineStyle: Record<string, unknown>;
  fadedLineStyle: Record<string, unknown> | null;
  fadedLineRatio: number;
  makeSmoothAfterApplyingFunctions: boolean;
  backgroundLines!: VGroup;
  fadedLines!: VGroup;
  declare coordinateLabels: VGroup | undefined;

  constructor(options: PolarPlaneOptions = {}) {
    const {
      radiusMax = config.frameYRadius,
      size = null,
      radiusStep = 1,
      azimuthStep: azimuthStepInput = null,
      azimuthUnits = "PI radians",
      azimuthCompactFraction = true,
      azimuthOffset = 0,
      azimuthDirection = "CCW",
      azimuthLabelBuff = SMALL_BUFF,
      azimuthLabelFontSize = 24,
      radiusConfig: radiusConfigInput = null,
      backgroundLineStyle: bgStyleInput = null,
      fadedLineStyle: fadedStyleInput = null,
      fadedLineRatio = 1,
      makeSmoothAfterApplyingFunctions = true,
      ...rest
    } = options;

    // Validation
    const validAzimuthUnits = ["PI radians", "TAU radians", "degrees", "gradians", null];
    if (!validAzimuthUnits.includes(azimuthUnits as string | null)) {
      throw new Error(
        "Invalid azimuth units. Expected one of: PI radians, TAU radians, degrees, gradians or None.",
      );
    }

    if (!["CW", "CCW"].includes(azimuthDirection)) {
      throw new Error("Invalid azimuth units. Expected one of: CW, CCW.");
    }

    const radiusConfig: Record<string, unknown> = {
      strokeWidth: 2,
      includeTicks: false,
      includeTip: false,
      lineToNumberBuff: SMALL_BUFF,
      labelDirection: DL as Point3D,
      fontSize: 24,
    };

    const bgLineStyle: Record<string, unknown> = {
      strokeColor: BLUE_D,
      strokeWidth: 2,
      strokeOpacity: 1,
    };

    const azimuthStepMap: Record<string, number> = {
      "PI radians": 20,
      "TAU radians": 20,
      "degrees": 36,
      "gradians": 40,
    };
    const computedAzimuthStep = azimuthStepInput ??
      (azimuthUnits != null ? (azimuthStepMap[azimuthUnits] ?? 1) : 1);

    Axes._updateDefaultConfigs(
      [radiusConfig, bgLineStyle],
      [radiusConfigInput, bgStyleInput],
    );

    super({
      xRange: [-radiusMax, radiusMax, radiusStep],
      yRange: [-radiusMax, radiusMax, radiusStep],
      xLength: size ?? undefined,
      yLength: size ?? undefined,
      axisConfig: radiusConfig,
      ...rest,
    });

    this.azimuthUnits = azimuthUnits;
    this.azimuthDirection = azimuthDirection;
    this.azimuthStep = computedAzimuthStep;
    this.azimuthOffset = azimuthOffset;
    this.azimuthLabelBuff = azimuthLabelBuff;
    this.azimuthLabelFontSize = azimuthLabelFontSize;
    this.azimuthCompactFraction = azimuthCompactFraction;
    this.radiusConfig = radiusConfig;
    this.backgroundLineStyle = { ...bgLineStyle };
    this.fadedLineStyle = fadedStyleInput;
    this.fadedLineRatio = fadedLineRatio;
    this.makeSmoothAfterApplyingFunctions = makeSmoothAfterApplyingFunctions;

    this._initBackgroundLines();
  }

  private _initBackgroundLines(): void {
    if (this.fadedLineStyle == null) {
      const style: Record<string, unknown> = { ...this.backgroundLineStyle };
      for (const key of Object.keys(style)) {
        if (typeof style[key] === "number") {
          style[key] = (style[key] as number) * 0.5;
        }
      }
      this.fadedLineStyle = style;
    }

    const [bgLines, fadedLines] = this._getLines();
    this.backgroundLines = bgLines;
    this.fadedLines = fadedLines;

    this.addToBack(
      this.fadedLines as unknown as Mobject,
      this.backgroundLines as unknown as Mobject,
    );
  }

  private _getLines(): [VGroup, VGroup] {
    const center = this.getOrigin();
    let ratioFadedLines = this.fadedLineRatio;
    const offset = this.azimuthOffset;

    if (ratioFadedLines === 0) {
      ratioFadedLines = 1;
    }

    const rstep = (1 / ratioFadedLines) * this.xAxis.xRange[2];
    const astep = (1 / ratioFadedLines) * (TAU * (1 / this.azimuthStep));

    const rlines1 = new VGroup();
    const rlines2 = new VGroup();
    const alines1 = new VGroup();
    const alines2 = new VGroup();

    // Radius circles
    const xMax = this.xAxis.xRange[1];
    const unitVector = (this.xAxis.getUnitVector() as NDArray).item(0) as number;

    for (let k = 0, x = 0; x <= xMax + rstep * 0.5; x += rstep, k++) {
      if (x === 0) continue;
      const newCircle = new Circle({ radius: x * Math.abs(unitVector) });
      newCircle.moveTo(center);
      if (k % ratioFadedLines === 0) {
        alines1.add(newCircle);
      } else {
        alines2.add(newCircle);
      }
    }

    // Radial lines
    const lineEnd = this.getXAxis().getEnd();

    for (let k = 0, angle = 0; angle < TAU; angle += astep, k++) {
      const newLine = new Line({ start: center, end: lineEnd });
      newLine.rotate(angle + offset, undefined, { aboutPoint: center });
      if (k % ratioFadedLines === 0) {
        rlines1.add(newLine);
      } else {
        rlines2.add(newLine);
      }
    }

    const lines1 = new VGroup(
      ...(rlines1.submobjects as unknown as VMobject[]),
      ...(alines1.submobjects as unknown as VMobject[]),
    );
    const lines2 = new VGroup(
      ...(rlines2.submobjects as unknown as VMobject[]),
      ...(alines2.submobjects as unknown as VMobject[]),
    );

    return [lines1, lines2];
  }

  override getAxes(): VGroup {
    return this.axes;
  }

  getVector(coords: number[]): Line {
    return new Line({
      start: this.coordsToPoint(0, 0),
      end: this.coordsToPoint(...coords),
    });
  }

  prepareForNonlinearTransform(_numInsertedCurves: number = 50): this {
    return this;
  }

  getCoordinateLabels(
    options: {
      rValues?: number[] | null;
      aValues?: number[] | null;
    } = {},
  ): VGroup {
    const { rValues: rInput, aValues: aInput } = options;

    const rValues = rInput ?? this.getXAxis().getTickRange().filter((r) => r >= 0);
    const aValues = aInput ?? (() => {
      const vals: number[] = [];
      for (let i = 0; i < this.azimuthStep; i++) {
        vals.push(i / this.azimuthStep);
      }
      return vals;
    })();

    this.getXAxis().addNumbers({ xValues: rValues });

    const aTex: Mobject[] = [];

    if (this.azimuthUnits === "PI radians" || this.azimuthUnits === "TAU radians") {
      for (const a of aValues) {
        const label = this.getRadianLabel(a, this.azimuthLabelFontSize);
        aTex.push(label);
      }
    } else if (this.azimuthUnits === "degrees") {
      for (const a of aValues) {
        aTex.push(new MathTex([`${360 * a}^{\\circ}`], { fontSize: this.azimuthLabelFontSize }));
      }
    } else if (this.azimuthUnits === "gradians") {
      for (const a of aValues) {
        aTex.push(new MathTex([`${400 * a}^{g}`], { fontSize: this.azimuthLabelFontSize }));
      }
    } else {
      for (const a of aValues) {
        aTex.push(new MathTex([`${a}`], { fontSize: this.azimuthLabelFontSize }));
      }
    }

    const aMobs = new VGroup(...(aTex as unknown as VMobject[]));
    this.coordinateLabels = new VGroup(
      this.getXAxis().numbers as unknown as VMobject,
      aMobs,
    );
    return this.coordinateLabels;
  }

  override addCoordinates(
    ...args: unknown[]
  ): this {
    const rValues = args[0] as number[] | null | undefined;
    const aValues = args[1] as number[] | null | undefined;
    this.add(
      this.getCoordinateLabels({
        rValues: rValues ?? null,
        aValues: aValues ?? null,
      }) as unknown as Mobject,
    );
    return this;
  }

  getRadianLabel(
    number: number,
    fontSize: number = 24,
  ): MathTex {
    const constantLabel: Record<string, string> = {
      "PI radians": "\\pi",
      "TAU radians": "\\tau",
    };
    const constant = constantLabel[this.azimuthUnits!];
    const divisionMultiplier: Record<string, number> = {
      "PI radians": 2,
      "TAU radians": 1,
    };
    const division = number * divisionMultiplier[this.azimuthUnits!];

    const frac = toFraction(division, 100);
    let str: string;

    if (frac[0] === 0) {
      str = "0";
    } else if (frac[0] === 1 && frac[1] === 1) {
      str = constant;
    } else if (frac[0] === 1) {
      if (this.azimuthCompactFraction) {
        str = `\\tfrac{${constant}}{${frac[1]}}`;
      } else {
        str = `\\tfrac{1}{${frac[1]}}${constant}`;
      }
    } else if (frac[1] === 1) {
      str = `${frac[0]}${constant}`;
    } else {
      if (this.azimuthCompactFraction) {
        str = `\\tfrac{${frac[0]}${constant}}{${frac[1]}}`;
      } else {
        str = `\\tfrac{${frac[0]}}{${frac[1]}}${constant}`;
      }
    }

    return new MathTex([str], { fontSize });
  }
}

// ─── ComplexPlane ─────────────────────────────────────────────

/** A complex number representation for TypeScript (no native complex). */
export interface ComplexNumber {
  real: number;
  imag: number;
}

/**
 * A NumberPlane specialized for use with complex numbers.
 */
export class ComplexPlane extends NumberPlane {
  constructor(options: ComplexPlaneOptions = {}) {
    super(options);
  }

  numberToPoint(number: number | ComplexNumber): Point3D {
    let real: number;
    let imag: number;
    if (typeof number === "number") {
      real = number;
      imag = 0;
    } else {
      real = number.real;
      imag = number.imag;
    }
    return this.coordsToPoint(real, imag);
  }

  n2p(number: number | ComplexNumber): Point3D {
    return this.numberToPoint(number);
  }

  pointToNumber(point: Point3D | number[]): ComplexNumber {
    const [x, y] = this.pointToCoords(point);
    return { real: x, imag: y };
  }

  p2n(point: Point3D | number[]): ComplexNumber {
    return this.pointToNumber(point);
  }

  private _getDefaultCoordinateValues(): (number | ComplexNumber)[] {
    const xNumbers = this.getXAxis().getTickRange();
    const yNumbers = this.getYAxis().getTickRange();
    const yComplex: ComplexNumber[] = yNumbers
      .filter((y) => y !== 0)
      .map((y) => ({ real: 0, imag: y }));
    return [...xNumbers, ...yComplex];
  }

  getComplexCoordinateLabels(
    ...numbers: (number | ComplexNumber)[]
  ): VGroup {
    if (numbers.length === 0) {
      numbers = this._getDefaultCoordinateValues();
    }

    const coordLabels = new VGroup();
    for (const num of numbers) {
      const z = typeof num === "number"
        ? { real: num, imag: 0 }
        : num;

      let axis: NumberLine;
      let value: number;
      if (Math.abs(z.imag) > Math.abs(z.real)) {
        axis = this.getYAxis();
        value = z.imag;
      } else {
        axis = this.getXAxis();
        value = z.real;
      }
      const numberMob = axis.getNumberMobject(value);
      coordLabels.add(numberMob as unknown as VMobject);
    }
    (this as unknown as Record<string, unknown>)["coordinateLabels"] = coordLabels;
    return coordLabels;
  }

  override addCoordinates(
    ...args: unknown[]
  ): this {
    const numbers = args as (number | ComplexNumber)[];
    this.add(this.getComplexCoordinateLabels(...numbers) as unknown as Mobject);
    return this;
  }
}

// ─── Utility ─────────────────────────────────────────────────

function ensureNDArray(point: Point3D | number[]): Point3D {
  if (Array.isArray(point) && !(point as unknown as NDArray).shape) {
    return np.array(point) as Point3D;
  }
  return point as Point3D;
}
