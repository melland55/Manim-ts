/**
 * Mobject representing a number line.
 *
 * TypeScript port of manim/mobject/graphing/number_line.py
 */

import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import {
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
  MED_SMALL_BUFF,
  DEFAULT_ARROW_TIP_LENGTH,
  DEGREES,
} from "../../../constants/constants.js";
import { config } from "../../../_config/index.js";
import { Line } from "../../geometry/index.js";
import type { LineOptions } from "../../geometry/index.js";
import { _ScaleBase, LinearBase } from "../scale/index.js";
import { DecimalNumber, Integer } from "../../text/numbers/index.js";
import { MathTex, Tex } from "../../text/tex_mobject/index.js";
import { VMobject, VGroup } from "../../types/index.js";
import { Mobject } from "../../mobject/index.js";
import { interpolate } from "../../../utils/bezier/index.js";
import { mergeDictsRecursively } from "../../../utils/config_ops/index.js";
import { normalize } from "../../../utils/space_ops/index.js";
import type { IColor } from "../../../core/types.js";

// ─── Options ──────────────────────────────────────────────────

export interface NumberLineOptions extends LineOptions {
  xRange?: [number, number] | [number, number, number];
  length?: number | null;
  unitSize?: number;
  includeTicks?: boolean;
  tickSize?: number;
  numbersWithElongatedTicks?: number[];
  longerTickMultiple?: number;
  excludeOriginTick?: boolean;
  rotation?: number;
  strokeWidth?: number;
  includeTip?: boolean;
  tipWidth?: number;
  tipHeight?: number;
  includeNumbers?: boolean;
  fontSize?: number;
  labelDirection?: Point3D;
  labelConstructor?: typeof MathTex;
  scaling?: _ScaleBase;
  lineToNumberBuff?: number;
  decimalNumberConfig?: Record<string, unknown>;
  numbersToExclude?: number[];
  numbersToInclude?: number[] | null;
}

export interface UnitIntervalOptions extends NumberLineOptions {}

// ─── Helper ───────────────────────────────────────────────────

function decimalPlacesFromStep(step: number): number {
  const stepStr = String(step);
  if (!stepStr.includes(".")) return 0;
  return stepStr.split(".").pop()!.length;
}

// ─── NumberLine ───────────────────────────────────────────────

/**
 * Creates a number line with tick marks.
 */
export class NumberLine extends Line {
  xRange: number[];
  xMin: number;
  xMax: number;
  xStep: number;
  declare length: number | null;
  unitSize: number;
  includeTicks: boolean;
  tickSize: number;
  numbersWithElongatedTicks: number[];
  longerTickMultiple: number;
  excludeOriginTick: boolean;
  _rotation: number;
  includeTip: boolean;
  tipWidth: number;
  tipHeight: number;
  includeNumbers: boolean;
  fontSize: number;
  labelDirection: Point3D;
  labelConstructor: typeof MathTex;
  lineToNumberBuff: number;
  decimalNumberConfig: Record<string, unknown>;
  numbersToExclude: number[];
  numbersToInclude: number[] | null;
  scaling: _ScaleBase;
  ticks!: VGroup;
  numbers!: VGroup;
  labels!: VGroup;
  // NumberLine builds a custom triangular tip — a plain VMobject, not an
  // ArrowTip subclass like the inherited `tip` slot in TipableVMobject
  // declares. The runtime value is a VMobject; we widen the declared type
  // here via `declare` to avoid a subtype conflict with the base. This
  // mirrors Python Manim, where `NumberLine.tip` can be any VMobject.
  declare tip?: VMobject;

  constructor(options: NumberLineOptions = {}) {
    const {
      xRange: xRangeInput,
      length: lengthInput = null,
      unitSize = 1,
      includeTicks = true,
      tickSize = 0.1,
      numbersWithElongatedTicks = [],
      longerTickMultiple = 2,
      excludeOriginTick = false,
      rotation = 0,
      strokeWidth = 2.0,
      includeTip = false,
      tipWidth = DEFAULT_ARROW_TIP_LENGTH,
      tipHeight = DEFAULT_ARROW_TIP_LENGTH,
      includeNumbers = false,
      fontSize = 36,
      labelDirection = DOWN as Point3D,
      labelConstructor = MathTex,
      scaling = new LinearBase(),
      lineToNumberBuff = MED_SMALL_BUFF,
      decimalNumberConfig: decimalNumberConfigInput,
      numbersToExclude = [],
      numbersToInclude = null,
      ...lineOpts
    } = options;

    // Resolve x_range
    let xRange: number[];
    if (xRangeInput === undefined || xRangeInput === null) {
      xRange = [
        Math.round(-config.frameXRadius),
        Math.round(config.frameXRadius),
        1,
      ];
    } else if (xRangeInput.length === 2) {
      xRange = [xRangeInput[0], xRangeInput[1], 1];
    } else {
      xRange = [...xRangeInput];
    }

    // Resolve decimal number config
    const decimalNumberConfig = decimalNumberConfigInput ?? {
      numDecimalPlaces: decimalPlacesFromStep(xRange[2]),
    };

    // Apply scaling to the range
    const scaledMin = scaling.function(xRange[0]);
    const scaledMax = scaling.function(xRange[1]);
    const scaledStep = scaling.function(xRange[2]);

    // Construct the Line from scaled endpoints along X axis
    super({
      start: np.array([xRange[0], 0, 0]) as Point3D,
      end: np.array([xRange[1], 0, 0]) as Point3D,
      strokeWidth,
      ...lineOpts,
    });

    this.xRange = xRange;
    this.xMin = scaledMin;
    this.xMax = scaledMax;
    this.xStep = scaledStep;
    this.length = lengthInput;
    this.unitSize = unitSize;
    this.includeTicks = includeTicks;
    this.tickSize = tickSize;
    this.numbersWithElongatedTicks = [...numbersWithElongatedTicks];
    this.longerTickMultiple = longerTickMultiple;
    this.excludeOriginTick = excludeOriginTick;
    this._rotation = rotation;
    this.includeTip = includeTip;
    this.tipWidth = tipWidth;
    this.tipHeight = tipHeight;
    this.includeNumbers = includeNumbers;
    this.fontSize = fontSize;
    this.labelDirection = labelDirection;
    this.labelConstructor = labelConstructor;
    this.lineToNumberBuff = lineToNumberBuff;
    this.decimalNumberConfig = decimalNumberConfig;
    this.numbersToExclude = [...numbersToExclude];
    this.numbersToInclude = numbersToInclude ? [...numbersToInclude] : null;
    this.scaling = scaling;

    // Apply length or unit_size scaling
    if (this.length !== null) {
      this.setLineLength(this.length);
      this.unitSize = this.getUnitSize();
    } else {
      this.scale(this.unitSize);
    }

    this.center();

    if (this.includeTip) {
      this._addTip();
    }

    if (this.includeTicks) {
      this.addTicks();
    }

    if (this._rotation !== 0) {
      this.rotate(this._rotation);
    }

    if (this.includeNumbers || this.numbersToInclude !== null) {
      if (this.scaling.customLabels) {
        const tickRange = this.getTickRange();
        const customLabels = this.scaling.getCustomLabels(
          tickRange,
          {
            unitDecimalPlaces:
              (decimalNumberConfig["numDecimalPlaces"] as number) ?? 0,
          },
        );

        const labelDict: Record<number, VMobject> = {};
        const tickArr = Array.from(tickRange);
        for (let i = 0; i < tickArr.length; i++) {
          labelDict[tickArr[i]] = customLabels[i] as unknown as VMobject;
        }
        this.addLabels(labelDict);
      } else {
        this.addNumbers({
          xValues: this.numbersToInclude ?? undefined,
          excluding: this.numbersToExclude,
          fontSize: this.fontSize,
        });
      }
    }
  }

  // ─── Point access overrides ─────────────────────────────────
  // numpy-ts .get([i]) fails on 2D arrays; use .slice() instead.

  override getStart(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return np.array(this.points.slice("0").toArray() as number[]) as Point3D;
  }

  override getEnd(): Point3D {
    const n = this.points.shape[0];
    if (n === 0) return np.array([0, 0, 0]) as Point3D;
    return np.array(
      this.points.slice(String(n - 1)).toArray() as number[],
    ) as Point3D;
  }

  override getStartAndEnd(): [Point3D, Point3D] {
    return [this.getStart(), this.getEnd()];
  }

  // ─── Line geometry helpers ──────────────────────────────────
  // The base Line class in this codebase is minimal, so we provide
  // these geometry methods directly.

  /** Get the angle of the line in radians. */
  getAngle(): number {
    const [s, e] = this.getStartAndEnd();
    const diff = (e as NDArray).subtract(s) as NDArray;
    return Math.atan2(diff.item(1) as number, diff.item(0) as number);
  }

  /** Get the length of the line segment. */
  getLineLength(): number {
    const [s, e] = this.getStartAndEnd();
    const diff = (e as NDArray).subtract(s) as NDArray;
    return np.linalg.norm(diff) as number;
  }

  /** Set the length of the line while preserving direction and center. */
  setLineLength(len: number): this {
    const currentLen = this.getLineLength();
    if (currentLen === 0) return this;
    this.scale(len / currentLen);
    return this;
  }

  /** Get a unit vector along the line direction. */
  getLineUnitVector(): Point3D {
    const [s, e] = this.getStartAndEnd();
    const diff = (e as NDArray).subtract(s) as NDArray;
    const norm = np.linalg.norm(diff) as number;
    if (norm === 0) return RIGHT as Point3D;
    return diff.divide(norm) as Point3D;
  }

  /** Add a triangular tip at the end of the line. */
  private _addTip(): void {
    const end = this.getEnd();
    const angle = this.getAngle();
    const h = this.tipHeight;
    const w = this.tipWidth;

    // Create a triangle tip as a VMobject
    const tip = new VMobject();
    const p0 = np.array([0, w / 2, 0]) as Point3D;
    const p1 = np.array([h, 0, 0]) as Point3D;
    const p2 = np.array([0, -w / 2, 0]) as Point3D;

    tip.startNewPath(p0);
    tip.addLineTo(p1);
    tip.addLineTo(p2);
    tip.closePath();

    tip.rotate(angle);
    tip.shift(end);

    if (this.strokeColor) {
      tip.setStroke(this.strokeColor, this.strokeWidth);
    }

    this.tip = tip;
    this.add(tip);
  }

  // ─── Rotation helpers ───────────────────────────────────────

  rotateAboutZero(
    angle: number,
    axis: Point3D = OUT as Point3D,
  ): this {
    return this.rotateAboutNumber(0, angle, axis);
  }

  rotateAboutNumber(
    number: number,
    angle: number,
    axis: Point3D = OUT as Point3D,
  ): this {
    return this.rotate(angle, axis, { aboutPoint: this.n2p(number) });
  }

  // ─── Ticks ──────────────────────────────────────────────────

  /** Adds ticks to the number line. */
  addTicks(): void {
    const ticks = new VGroup();
    const elongatedTickSize = this.tickSize * this.longerTickMultiple;
    const elongatedTickOffsets = this.numbersWithElongatedTicks.map(
      (v) => v - this.xRange[0],
    );

    for (const x of this.getTickRange()) {
      let size = this.tickSize;
      const offset = x - this.xRange[0];
      if (elongatedTickOffsets.some((o) => Math.abs(offset - o) < 1e-9)) {
        size = elongatedTickSize;
      }
      ticks.add(this.getTick(x, size));
    }
    this.add(ticks);
    this.ticks = ticks;
  }

  /** Generates a tick and positions it along the number line. */
  getTick(x: number, size?: number): Line {
    if (size === undefined) {
      size = this.tickSize;
    }
    const result = new Line({
      start: (DOWN as NDArray).multiply(size) as Point3D,
      end: (UP as NDArray).multiply(size) as Point3D,
    });
    result.rotate(this.getAngle());
    result.moveTo(this.numberToPoint(x));
    // Match style
    if (this.strokeColor) {
      result.setStroke(this.strokeColor, this.strokeWidth);
    }
    return result;
  }

  /** Returns the tick marks VGroup. */
  getTickMarks(): VGroup {
    return this.ticks;
  }

  /** Generates the range of values where ticks are placed. */
  getTickRange(): number[] {
    const [xMin, xMax, xStep] = this.xRange;
    let effectiveMax = xMax;
    if (!this.includeTip) {
      effectiveMax += 1e-6;
    }

    let tickRange: number[];

    // Handle cases where min and max are both positive or both negative
    if ((xMin < xMax && xMax < 0) || (xMax > xMin && xMin > 0)) {
      tickRange = [];
      for (let v = xMin; v < effectiveMax; v += xStep) {
        tickRange.push(v);
      }
    } else {
      let startPoint = 0;
      if (this.excludeOriginTick) {
        startPoint += xStep;
      }

      const xMinSegment: number[] = [];
      for (let v = startPoint; v < Math.abs(xMin) + 1e-6; v += xStep) {
        xMinSegment.push(-v);
      }

      const xMaxSegment: number[] = [];
      for (let v = startPoint; v < effectiveMax; v += xStep) {
        xMaxSegment.push(v);
      }

      // Unique and sort
      const combined = [...xMinSegment, ...xMaxSegment];
      tickRange = [...new Set(combined)].sort((a, b) => a - b);
    }

    // Apply scaling function to each tick value
    return tickRange.map((v) => this.scaling.function(v));
  }

  // ─── Coordinate conversions ─────────────────────────────────

  /** Converts a value on the number line to a scene point. */
  numberToPoint(number: number | number[]): Point3D {
    const isScalar = typeof number === "number";
    const nums = isScalar ? [number] : number;

    const start = this.getStart();
    const end = this.getEnd();

    const results: Point3D[] = [];
    for (const n of nums) {
      const invN = this.scaling.inverseFunction(n);
      const alpha = (invN - this.xRange[0]) / (this.xRange[1] - this.xRange[0]);
      const point = interpolate(start, end, alpha) as Point3D;
      results.push(point);
    }

    if (isScalar) {
      return results[0];
    }
    // For array input, stack results
    return np.vstack(results) as Point3D;
  }

  /** Converts a scene point to a value on the number line. */
  pointToNumber(point: number[] | Point3D): number {
    const p = np.array(
      Array.isArray(point) && typeof point[0] === "number"
        ? point
        : (point as NDArray).toArray(),
    );
    const [start, end] = this.getStartAndEnd();
    const unitVect = normalize(
      (end as NDArray).subtract(start) as NDArray,
    );
    const diff = p.subtract(start as NDArray) as NDArray;
    const endMinusStart = (end as NDArray).subtract(start) as NDArray;

    const proportion =
      (np.dot(diff, unitVect) as number) /
      (np.dot(endMinusStart, unitVect) as number);

    return interpolate(this.xMin, this.xMax, proportion) as number;
  }

  /** Abbreviation for numberToPoint. */
  n2p(number: number | number[]): Point3D {
    return this.numberToPoint(number);
  }

  /** Abbreviation for pointToNumber. */
  p2n(point: number[] | Point3D): number {
    return this.pointToNumber(point);
  }

  // ─── Unit helpers ───────────────────────────────────────────

  /** Returns the distance per unit on the number line. */
  getUnitSize(): number {
    return this.getLineLength() / (this.xRange[1] - this.xRange[0]);
  }

  /** Returns a unit vector along the line, scaled by unitSize. */
  getUnitVector(): Point3D {
    return this.getLineUnitVector().multiply(this.unitSize) as Point3D;
  }

  // ─── Number labels ─────────────────────────────────────────

  /** Generates a positioned DecimalNumber for a value on the line. */
  getNumberMobject(
    x: number,
    options: {
      direction?: Point3D;
      buff?: number;
      fontSize?: number;
      labelConstructor?: typeof MathTex;
      [key: string]: unknown;
    } = {},
  ): Mobject {
    const {
      direction,
      buff,
      fontSize: fs,
      labelConstructor: lc,
      ...numberConfig
    } = options;

    const mergedConfig = mergeDictsRecursively(
      this.decimalNumberConfig,
      numberConfig,
    );

    const dir = direction ?? this.labelDirection;
    const b = buff ?? this.lineToNumberBuff;
    const size = fs ?? this.fontSize;
    const constructor = lc ?? this.labelConstructor;

    const numMob = new DecimalNumber({
      number: x,
      fontSize: size,
      mobClass: constructor as unknown as typeof MathTex,
      ...mergedConfig,
    });

    numMob.nextTo(this.numberToPoint(x), dir, { buff: b });

    // Align negative numbers without the minus sign offset
    const dirArr = (dir as NDArray).toArray() as number[];
    if (x < 0 && dirArr[0] === 0) {
      const minusWidth =
        numMob.submobjects.length > 0
          ? numMob.submobjects[0].width
          : 0;
      numMob.shift((LEFT as NDArray).multiply(minusWidth / 2) as Point3D);
    }

    return numMob;
  }

  /** Returns a VGroup of number mobjects. */
  getNumberMobjects(...numbers: number[]): VGroup {
    if (numbers.length === 0) {
      numbers = this.getTickRange();
    }
    return new VGroup(
      ...numbers.map((n) => this.getNumberMobject(n) as unknown as VMobject),
    );
  }

  /** Returns a VGroup of label mobjects. */
  getLabels(): VGroup {
    return this.getNumberMobjects();
  }

  /** Adds number labels at tick positions. */
  addNumbers(options: {
    xValues?: number[];
    excluding?: number[];
    fontSize?: number;
    labelConstructor?: typeof MathTex;
    [key: string]: unknown;
  } = {}): this {
    const {
      xValues,
      excluding,
      fontSize: fs,
      labelConstructor: lc,
      ...kwargs
    } = options;

    const values = xValues ?? this.getTickRange();
    const excl = excluding ?? this.numbersToExclude;
    const size = fs ?? this.fontSize;
    const constructor = lc ?? this.labelConstructor;

    const numbers = new VGroup();
    for (const x of values) {
      if (excl.includes(x)) continue;
      numbers.add(
        this.getNumberMobject(x, {
          fontSize: size,
          labelConstructor: constructor,
          ...kwargs,
        }) as unknown as VMobject,
      );
    }
    this.add(numbers);
    this.numbers = numbers;
    return this;
  }

  /** Adds labels at specific positions using a dictionary. */
  addLabels(
    dictValues: Record<number, string | number | Mobject>,
    options: {
      direction?: Point3D;
      buff?: number;
      fontSize?: number;
      labelConstructor?: typeof MathTex;
    } = {},
  ): this {
    const dir = options.direction ?? this.labelDirection;
    const b = options.buff ?? this.lineToNumberBuff;
    const fs = options.fontSize ?? this.fontSize;
    const lc = options.labelConstructor ?? this.labelConstructor;

    const labels = new VGroup();
    for (const [xStr, labelValue] of Object.entries(dictValues)) {
      const x = Number(xStr);

      let label: Mobject;
      if (typeof labelValue === "object" && labelValue instanceof Mobject) {
        label = labelValue;
      } else if (typeof labelValue === "string" && lc === MathTex) {
        label = new Tex([labelValue]);
      } else {
        label = this._createLabelTex(labelValue, lc);
      }

      // Set font size if possible
      if ("fontSize" in label) {
        (label as { fontSize: number }).fontSize = fs;
      }

      label.nextTo(this.numberToPoint(x), dir, { buff: b });
      labels.add(label as unknown as VMobject);
    }

    this.labels = labels;
    this.add(labels);
    return this;
  }

  /** Creates a label mobject from a value. */
  private _createLabelTex(
    labelTex: string | number | Mobject,
    labelConstructor?: typeof MathTex,
  ): Mobject {
    if (typeof labelTex === "object" && labelTex instanceof Mobject) {
      return labelTex;
    }
    const ctor = labelConstructor ?? this.labelConstructor;
    const text = typeof labelTex === "string" ? labelTex : String(labelTex);
    return new ctor([text]);
  }
}

// ─── UnitInterval ─────────────────────────────────────────────

/**
 * A NumberLine representing the interval [0, 1].
 */
export class UnitInterval extends NumberLine {
  constructor(options: UnitIntervalOptions = {}) {
    const {
      unitSize = 10,
      numbersWithElongatedTicks = [0, 1],
      decimalNumberConfig = { numDecimalPlaces: 1 },
      ...rest
    } = options;

    super({
      xRange: [0, 1, 0.1],
      unitSize,
      numbersWithElongatedTicks,
      decimalNumberConfig,
      ...rest,
    });
  }
}
