/**
 * Mobjects representing objects from probability theory and statistics.
 *
 * TypeScript port of manim/mobject/graphing/probability.py
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
  SMALL_BUFF,
  MED_SMALL_BUFF,
} from "../../../constants/constants.js";
import { config, logger } from "../../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
  colorGradient,
} from "../../../utils/color/core.js";
import {
  BLUE_E,
  DARK_GREY,
  GREEN_E,
  LIGHT_GREY,
  MAROON_B,
  YELLOW,
} from "../../../utils/color/manim_colors.js";
import { tuplify } from "../../../utils/iterables/index.js";
import { Mobject } from "../../mobject/index.js";
import type { VMobjectOptions } from "../../types/vectorized_mobject.js";
import { VMobject } from "../../types/vectorized_mobject.js";
import {
  MathTex,
  Tex,
} from "../../text/tex_mobject/index.js";
import { Brace } from "../../svg/brace.js";

// ─── Dependency stubs for not-yet-converted modules ──────────
// TODO: Replace these stubs with real imports once the respective modules land

/**
 * Minimal VGroup stub.
 * TODO: Replace with import from ../../types/vectorized_mobject once VGroup is exported
 */
class VGroup extends VMobject {
  constructor(...vmobjects: Mobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

/**
 * Minimal Rectangle stub extending VMobject.
 * TODO: Replace with import from ../../geometry/polygram once Rectangle is converted
 */
class Rectangle extends VMobject {
  rectWidth: number;
  rectHeight: number;

  constructor(
    options: {
      width?: number;
      height?: number;
      fillColor?: ParsableManimColor;
      fillOpacity?: number;
      strokeWidth?: number;
      strokeColor?: ParsableManimColor;
    } = {},
  ) {
    super({
      fillColor:
        options.fillColor != null
          ? new ManimColor(options.fillColor)
          : undefined,
      fillOpacity: options.fillOpacity,
      strokeWidth: options.strokeWidth,
      strokeColor:
        options.strokeColor != null
          ? new ManimColor(options.strokeColor)
          : undefined,
    });
    this.rectWidth = options.width ?? 4.0;
    this.rectHeight = options.height ?? 2.0;
  }

  get width(): number {
    return this.rectWidth;
  }

  set width(value: number) {
    this.rectWidth = value;
  }

  get height(): number {
    return this.rectHeight;
  }

  set height(value: number) {
    this.rectHeight = value;
  }
}

/**
 * Minimal Axes stub.
 * TODO: Replace with import from ../coordinate_systems once Axes is converted
 */
class Axes extends Mobject {
  xAxis: AxesAxis;
  yAxis: AxesAxis;
  private _xRange: number[];
  private _yRange: number[];
  private _xLength: number;
  private _yLength: number;

  constructor(
    options: {
      xRange?: number[];
      yRange?: number[];
      xLength?: number;
      yLength?: number;
      xAxisConfig?: Record<string, unknown>;
      tips?: boolean;
    } = {},
  ) {
    super();
    this._xRange = options.xRange ?? [0, 1, 1];
    this._yRange = options.yRange ?? [0, 1, 1];
    this._xLength = options.xLength ?? 10;
    this._yLength = options.yLength ?? 6;
    this.xAxis = new AxesAxis({
      fontSizeVal: (options.xAxisConfig?.font_size as number) ?? 24,
      labelConstructor: (options.xAxisConfig?.label_constructor as typeof Tex) ?? Tex,
    });
    this.yAxis = new AxesAxis({});
    this.add(this.xAxis as unknown as Mobject);
    this.add(this.yAxis as unknown as Mobject);
  }

  /** Coordinates to point. */
  c2p(x: number, y: number, _z = 0): Point3D {
    const xMin = this._xRange[0];
    const xMax = this._xRange[1];
    const yMin = this._yRange[0];
    const yMax = this._yRange[1];
    const xFrac = xMax !== xMin ? (x - xMin) / (xMax - xMin) : 0;
    const yFrac = yMax !== yMin ? (y - yMin) / (yMax - yMin) : 0;
    const halfW = this._xLength / 2;
    const halfH = this._yLength / 2;
    return np.array([
      -halfW + xFrac * this._xLength,
      -halfH + yFrac * this._yLength,
      0,
    ]);
  }

  protected _updateDefaultConfigs(
    defaults: Record<string, unknown>[],
    overrides: (Record<string, unknown> | null | undefined)[],
  ): void {
    for (let i = 0; i < defaults.length; i++) {
      const override = overrides[i];
      if (override != null) {
        Object.assign(defaults[i], override);
      }
    }
  }
}

/** Minimal stub for an axis inside Axes. */
class AxesAxis extends Mobject {
  fontSize: number;
  labelConstructor: typeof Tex;
  lineToNumberBuff: number;
  labels: VGroup | null;

  constructor(
    options: {
      fontSizeVal?: number;
      labelConstructor?: typeof Tex;
    } = {},
  ) {
    super();
    this.fontSize = options.fontSizeVal ?? 24;
    this.labelConstructor = options.labelConstructor ?? Tex;
    this.lineToNumberBuff = MED_SMALL_BUFF;
    this.labels = null;
  }

  numberToPoint(value: number): Point3D {
    // Stub — real implementation in NumberLine
    return np.array([value, 0, 0]);
  }

  addNumbers(): void {
    // Stub
  }

  addLabels(): void {
    // Stub
  }
}

// ─── Constants ───────────────────────────────────────────────

const EPSILON = 0.0001;

// ─── SampleSpace ─────────────────────────────────────────────

export interface SampleSpaceOptions {
  height?: number;
  width?: number;
  fillColor?: ParsableManimColor;
  fillOpacity?: number;
  strokeWidth?: number;
  strokeColor?: ParsableManimColor;
  defaultLabelScaleVal?: number;
}

/**
 * A mobject representing a two-dimensional rectangular sampling space.
 */
export class SampleSpace extends Rectangle {
  defaultLabelScaleVal: number;
  title?: Mobject;
  label?: string;
  horizontalParts?: VGroup;
  verticalParts?: VGroup;

  constructor(options: SampleSpaceOptions = {}) {
    const {
      height = 3,
      width = 3,
      fillColor = DARK_GREY,
      fillOpacity = 1,
      strokeWidth = 0.5,
      strokeColor = LIGHT_GREY,
      defaultLabelScaleVal = 1,
    } = options;

    super({
      height,
      width,
      fillColor,
      fillOpacity,
      strokeWidth,
      strokeColor,
    });
    this.defaultLabelScaleVal = defaultLabelScaleVal;
  }

  addTitle(title = "Sample space", buff: number = MED_SMALL_BUFF): void {
    const titleMob = new Tex([title]);
    if (titleMob.width > this.width) {
      titleMob.width = this.width;
    }
    titleMob.nextTo(this, UP, { buff });
    this.title = titleMob;
    this.add(titleMob);
  }

  addLabel(label: string): void {
    this.label = label;
  }

  completePList(pList: number | Iterable<number>): number[] {
    const pListTuplified = tuplify(pList) as readonly number[];
    const newPList = [...pListTuplified];
    const remainder = 1.0 - newPList.reduce((a, b) => a + b, 0);
    if (Math.abs(remainder) > EPSILON) {
      newPList.push(remainder);
    }
    return newPList;
  }

  getDivisionAlongDimension(
    pList: number | Iterable<number>,
    dim: number,
    colors: ParsableManimColor[],
    vect: Point3D,
  ): VGroup {
    const pListComplete = this.completePList(pList);
    const colorsInGradient = colorGradient(colors, pListComplete.length);

    const negVect = (vect as NDArray).multiply(-1) as Point3D;
    let lastPoint = this.getEdgeCenter(negVect);
    const parts = new VGroup();

    for (let i = 0; i < pListComplete.length; i++) {
      const factor = pListComplete[i];
      const color = colorsInGradient[i];

      const part = new SampleSpace();
      part.setFill(color, 1);
      part.replace(this, 0, true);
      part.stretch(factor, dim);
      part.moveTo(lastPoint, negVect);
      lastPoint = part.getEdgeCenter(vect);
      parts.add(part);
    }
    return parts;
  }

  getHorizontalDivision(
    pList: number | Iterable<number>,
    colors: ParsableManimColor[] = [GREEN_E, BLUE_E],
    vect: Point3D = DOWN,
  ): VGroup {
    return this.getDivisionAlongDimension(pList, 1, colors, vect);
  }

  getVerticalDivision(
    pList: number | Iterable<number>,
    colors: ParsableManimColor[] = [MAROON_B, YELLOW],
    vect: Point3D = RIGHT,
  ): VGroup {
    return this.getDivisionAlongDimension(pList, 0, colors, vect);
  }

  divideHorizontally(
    pList: number | Iterable<number>,
    colors?: ParsableManimColor[],
    vect?: Point3D,
  ): void {
    this.horizontalParts = this.getHorizontalDivision(pList, colors, vect);
    this.add(this.horizontalParts);
  }

  divideVertically(
    pList: number | Iterable<number>,
    colors?: ParsableManimColor[],
    vect?: Point3D,
  ): void {
    this.verticalParts = this.getVerticalDivision(pList, colors, vect);
    this.add(this.verticalParts);
  }

  getSubdivisionBracesAndLabels(
    parts: VGroup & { braces?: VGroup; labels?: VGroup; labelKwargs?: Record<string, unknown> },
    labels: (string | Mobject)[],
    direction: Point3D,
    buff: number = SMALL_BUFF,
    minNumQuads = 1,
  ): VGroup {
    const labelMobs = new VGroup();
    const braces = new VGroup();

    const partsFamily = parts.submobjects;
    for (let i = 0; i < labels.length && i < partsFamily.length; i++) {
      const label = labels[i];
      const part = partsFamily[i];

      const brace = new Brace(part, direction, { buff });

      let labelMob: Mobject;
      if (label instanceof Mobject) {
        labelMob = label;
      } else {
        labelMob = new MathTex([label as string]);
        labelMob.scale(this.defaultLabelScaleVal);
      }
      labelMob.nextTo(brace, direction, { buff });

      braces.add(brace as unknown as Mobject);
      labelMobs.add(labelMob);
    }

    parts.braces = braces;
    parts.labels = labelMobs;
    parts.labelKwargs = {
      labels: labelMobs.copy(),
      direction,
      buff,
    };

    return new VGroup(braces, labelMobs);
  }

  getSideBracesAndLabels(
    labels: (string | Mobject)[],
    direction: Point3D = LEFT,
    options: { buff?: number; minNumQuads?: number } = {},
  ): VGroup {
    if (!this.horizontalParts) {
      throw new Error("SampleSpace has no horizontal_parts. Call divideHorizontally first.");
    }
    return this.getSubdivisionBracesAndLabels(
      this.horizontalParts as VGroup & { braces?: VGroup; labels?: VGroup },
      labels,
      direction,
      options.buff,
      options.minNumQuads,
    );
  }

  getTopBracesAndLabels(
    labels: (string | Mobject)[],
    options: { buff?: number; minNumQuads?: number } = {},
  ): VGroup {
    if (!this.verticalParts) {
      throw new Error("SampleSpace has no vertical_parts. Call divideVertically first.");
    }
    return this.getSubdivisionBracesAndLabels(
      this.verticalParts as VGroup & { braces?: VGroup; labels?: VGroup },
      labels,
      UP,
      options.buff,
      options.minNumQuads,
    );
  }

  getBottomBracesAndLabels(
    labels: (string | Mobject)[],
    options: { buff?: number; minNumQuads?: number } = {},
  ): VGroup {
    if (!this.verticalParts) {
      throw new Error("SampleSpace has no vertical_parts. Call divideVertically first.");
    }
    return this.getSubdivisionBracesAndLabels(
      this.verticalParts as VGroup & { braces?: VGroup; labels?: VGroup },
      labels,
      DOWN,
      options.buff,
      options.minNumQuads,
    );
  }

  addBracesAndLabels(): void {
    const attrs = ["horizontalParts", "verticalParts"] as const;
    for (const attr of attrs) {
      const parts = this[attr] as
        | (VGroup & { braces?: VGroup; labels?: VGroup })
        | undefined;
      if (!parts) continue;
      if (parts.braces) {
        this.add(parts.braces);
      }
      if (parts.labels) {
        this.add(parts.labels);
      }
    }
  }

  getItem(index: number): Mobject {
    if (this.horizontalParts) {
      return this.horizontalParts.submobjects[index];
    } else if (this.verticalParts) {
      return this.verticalParts.submobjects[index];
    }
    return this.getFamily()[index];
  }
}

// ─── BarChart ────────────────────────────────────────────────

export interface BarChartOptions {
  barNames?: string[];
  yRange?: number[];
  xLength?: number;
  yLength?: number;
  barColors?: ParsableManimColor[];
  barWidth?: number;
  barFillOpacity?: number;
  barStrokeWidth?: number;
  xAxisConfig?: Record<string, unknown>;
  yAxisConfig?: Record<string, unknown>;
  tips?: boolean;
}

/**
 * Creates a bar chart. Inherits from Axes, so it shares its methods
 * and attributes.
 */
export class BarChart extends Axes {
  values: number[];
  barNames: string[] | null;
  barColors: ParsableManimColor[];
  barWidth: number;
  barFillOpacity: number;
  barStrokeWidth: number;
  bars: VGroup;
  xLabels: VGroup | null;
  barLabels: VGroup | null;

  constructor(values: number[], options: BarChartOptions = {}) {
    const {
      barNames = null,
      barColors = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"],
      barWidth = 0.6,
      barFillOpacity = 0.7,
      barStrokeWidth = 3,
      tips = false,
      xAxisConfig: userXAxisConfig = undefined,
      yAxisConfig: userYAxisConfig = undefined,
    } = options;

    let { yRange, xLength, yLength } = options;

    yLength = yLength ?? config.frameHeight - 4;

    const xRange = [0, values.length, 1];

    if (yRange == null) {
      yRange = [
        Math.min(0, ...values),
        Math.max(0, ...values),
        Math.round((Math.max(0, ...values) / yLength) * 100) / 100,
      ];
    } else if (yRange.length === 2) {
      yRange = [
        ...yRange,
        Math.round((Math.max(0, ...values) / yLength) * 100) / 100,
      ];
    }

    if (xLength == null) {
      xLength = Math.min(values.length, config.frameWidth - 2);
    }

    const xAxisConfigDefaults: Record<string, unknown> = {
      font_size: 24,
      label_constructor: Tex,
    };
    if (userXAxisConfig != null) {
      Object.assign(xAxisConfigDefaults, userXAxisConfig);
    }

    super({
      xRange,
      yRange,
      xLength,
      yLength,
      xAxisConfig: xAxisConfigDefaults,
      tips,
    });

    this.values = [...values];
    this.barNames = barNames ? [...barNames] : null;
    this.barColors = [...barColors];
    this.barWidth = barWidth;
    this.barFillOpacity = barFillOpacity;
    this.barStrokeWidth = barStrokeWidth;
    this.bars = new VGroup();
    this.xLabels = null;
    this.barLabels = null;

    this._addBars();

    if (this.barNames != null) {
      this._addXAxisLabels();
    }

    this.yAxis.addNumbers();
  }

  private _updateColors(): void {
    this.bars.setColorByGradient(...this.barColors);
  }

  private _addXAxisLabels(): void {
    if (!this.barNames) return;

    const labels = new VGroup();

    for (let i = 0; i < this.barNames.length; i++) {
      const value = 0.5 + i;
      const barName = this.barNames[i];

      const direction = this.values[i] < 0 ? UP : DOWN;
      const barNameLabel = new (this.xAxis.labelConstructor)([barName]);

      barNameLabel.fontSize = this.xAxis.fontSize;
      barNameLabel.nextTo(
        this.xAxis.numberToPoint(value),
        direction,
        { buff: this.xAxis.lineToNumberBuff },
      );

      labels.add(barNameLabel);
    }

    this.xAxis.labels = labels;
    this.xAxis.add(labels as unknown as Mobject);
  }

  private _createBar(barNumber: number, value: number): Rectangle {
    const c2pValue = this.c2p(0, value);
    const c2pZero = this.c2p(0, 0);
    const barH = Math.abs(
      ((c2pValue as NDArray).get([1]) as number) -
      ((c2pZero as NDArray).get([1]) as number),
    );
    const barW = Math.abs(
      ((this.c2p(this.barWidth, 0) as NDArray).get([0]) as number) -
      ((c2pZero as NDArray).get([0]) as number),
    );

    const bar = new Rectangle({
      height: barH,
      width: barW,
      strokeWidth: this.barStrokeWidth,
      fillOpacity: this.barFillOpacity,
    });

    const pos = value >= 0 ? UP : DOWN;
    bar.nextTo(this.c2p(barNumber + 0.5, 0), pos, { buff: 0 });
    return bar;
  }

  private _addBars(): void {
    for (let i = 0; i < this.values.length; i++) {
      const tmpBar = this._createBar(i, this.values[i]);
      this.bars.add(tmpBar);
    }
    this._updateColors();
    this.addToBack(this.bars as unknown as Mobject);
  }

  getBarLabels(options: {
    color?: ParsableManimColor;
    fontSize?: number;
    buff?: number;
    labelConstructor?: typeof Tex;
  } = {}): VGroup {
    const {
      color = null,
      fontSize = 24,
      buff = MED_SMALL_BUFF,
      labelConstructor = Tex,
    } = options;

    const barLabels = new VGroup();
    const barsArr = this.bars.submobjects;

    for (let i = 0; i < barsArr.length && i < this.values.length; i++) {
      const bar = barsArr[i];
      const value = this.values[i];

      const barLbl = new labelConstructor([String(value)]);

      if (color == null) {
        barLbl.setColor(bar.color);
      } else {
        barLbl.setColor(new ManimColor(color));
      }

      barLbl.fontSize = fontSize;

      const pos = value >= 0 ? UP : DOWN;
      barLbl.nextTo(bar, pos, { buff });
      barLabels.add(barLbl);
    }

    return barLabels;
  }

  changeBarValues(values: Iterable<number>, updateColors = true): void {
    const valuesArr = [...values];

    const barsArr = this.bars.submobjects;
    for (let i = 0; i < barsArr.length && i < valuesArr.length; i++) {
      let bar = barsArr[i] as Rectangle;
      const value = valuesArr[i];
      const chartVal = this.values[i];

      let barLim: Point3D;
      let alignedEdge: Point3D;

      if (chartVal > 0) {
        barLim = bar.getBottom();
        alignedEdge = DOWN;
      } else {
        barLim = bar.getTop();
        alignedEdge = UP;
      }

      if (chartVal !== 0) {
        const quotient = value / chartVal;
        if (quotient < 0) {
          alignedEdge = chartVal > 0 ? UP : DOWN;
        }
        bar.stretchToFitHeight(Math.abs(quotient) * bar.height);
      } else {
        const tempBar = this._createBar(i, value);
        this.bars.remove(bar);
        // Insert at position i
        this.bars.submobjects.splice(i, 0, tempBar);
        bar = tempBar;
      }

      bar.moveTo(barLim, alignedEdge);
    }

    if (updateColors) {
      this._updateColors();
    }

    for (let i = 0; i < valuesArr.length && i < this.values.length; i++) {
      this.values[i] = valuesArr[i];
    }
  }
}
