/**
 * Mobjects representing vector fields.
 *
 * TypeScript port of manim/mobject/vector_field.py
 */

import type {
  IMobject,
  IVMobject,
  Point3D,
  RateFunc,
} from "../../core/types.js";
import {
  np,
  interpolate,
  inverseInterpolate,
  sigmoid,
  clamp,
  RIGHT,
  UP,
  OUT,
  easeOutSine,
  linear,
} from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";

import type { ParsableManimColor } from "../../utils/color/index.js";
import { ManimColor, colorToRgb, rgbToColor } from "../../utils/color/index.js";
import { BLUE_E, GREEN, RED, YELLOW } from "../../utils/color/manim_colors.js";

import { config } from "../../_config/index.js";
import { Mobject } from "../../mobject/mobject/index.js";
import { getVectorizedMobjectClass, RendererType } from "../../mobject/utils/index.js";
import { VMobject as RealVMobject, VGroup as RealVGroup } from "../../mobject/types/index.js";
import { Vector as RealVector } from "../../mobject/geometry/line/index.js";

import { AnimationGroup, Succession } from "../../animation/composition/index.js";
import { Create } from "../../animation/creation/index.js";
import { ShowPassingFlash } from "../../animation/indication/index.js";
import type { ShowPassingFlashOptions } from "../../animation/indication/index.js";
import { UpdateFromAlphaFunc } from "../../animation/updaters/index.js";

// ─── Types ──────────────────────────────────────────────────

type VectorFieldFunc = (pos: Point3D) => Point3D;
type ColorSchemeFunc = (vec: Point3D) => number;

// ─── Local type extensions ─────────────────────────────────
// Stream-line VMobjects carry dynamic scheduling fields used by animations.
// Alias the real classes with extended shape used by this module.

type VMobjectStub = RealVMobject & {
  duration: number;
  anim: { mobject: IMobject; runTime: number; begin(): void; finish(): void; interpolate(alpha: number): void } | null;
  time: number;
  setPointsSmoothly(points: Point3D[]): VMobjectStub;
  getAnchors(): Point3D[];
  colorUsingBackgroundImage(image: unknown): VMobjectStub;
  setRgbaArrayDirect(rgbas: unknown, name?: string): VMobjectStub;
};

const VMobjectStub = RealVMobject as unknown as new (...args: unknown[]) => VMobjectStub;
const VGroupStub = RealVGroup;
type VGroupStub = RealVGroup;
const VectorStub = RealVector;

// ─── Constants ──────────────────────────────────────────────

export const DEFAULT_SCALAR_FIELD_COLORS: ManimColor[] = [BLUE_E, GREEN, YELLOW, RED];

// ─── Options ────────────────────────────────────────────────

export interface VectorFieldOptions {
  color?: ParsableManimColor;
  colorScheme?: ColorSchemeFunc;
  minColorSchemeValue?: number;
  maxColorSchemeValue?: number;
  colors?: ParsableManimColor[];
}

export interface ArrowVectorFieldOptions extends VectorFieldOptions {
  xRange?: number[];
  yRange?: number[];
  zRange?: number[];
  threeDimensions?: boolean;
  lengthFunc?: (norm: number) => number;
  opacity?: number;
  vectorConfig?: Record<string, unknown>;
}

export interface StreamLinesOptions extends VectorFieldOptions {
  xRange?: number[];
  yRange?: number[];
  zRange?: number[];
  threeDimensions?: boolean;
  noiseFactor?: number | null;
  nRepeats?: number;
  dt?: number;
  virtualTime?: number;
  maxAnchorsPerLine?: number;
  padding?: number;
  strokeWidth?: number;
  opacity?: number;
}

export interface StreamLinesCreateOptions {
  lagRatio?: number;
  runTime?: number;
}

export interface StartAnimationOptions {
  warmUp?: boolean;
  flowSpeed?: number;
  timeWidth?: number;
  rateFunc?: RateFunc;
  lineAnimationClass?: new (
    mobject: IMobject,
    options?: ShowPassingFlashOptions,
  ) => { mobject: IMobject; runTime: number; begin(): void; finish(): void; interpolate(alpha: number): void };
}

// ─── VectorField ────────────────────────────────────────────

export class VectorField extends VGroupStub {
  func: VectorFieldFunc;
  singleColor: boolean;
  colorScheme!: ColorSchemeFunc;
  rgbs!: number[][];
  posToRgb!: (pos: Point3D) => [number, number, number];
  posToColor!: (pos: Point3D) => ManimColor;
  submobMovementUpdater: ((mob: VectorField, dt: number) => void) | null;

  constructor(
    func: VectorFieldFunc,
    options: VectorFieldOptions = {},
  ) {
    const {
      color,
      colorScheme: colorSchemeFn,
      minColorSchemeValue = 0,
      maxColorSchemeValue = 2,
      colors = DEFAULT_SCALAR_FIELD_COLORS,
    } = options;

    super();
    if (color != null) {
      this.setColor(color);
    }
    this.func = func;

    if (color == null) {
      this.singleColor = false;
      const scheme: ColorSchemeFunc = colorSchemeFn ?? ((vec: Point3D) => np.linalg.norm(vec) as number);
      this.colorScheme = scheme;
      this.rgbs = colors.map((c) => [...colorToRgb(c)]);

      this.posToRgb = (pos: Point3D): [number, number, number] => {
        const vec = this.func(pos);
        const colorValue = clamp(
          this.colorScheme(vec),
          minColorSchemeValue,
          maxColorSchemeValue,
        );
        let alpha = inverseInterpolate(
          minColorSchemeValue,
          maxColorSchemeValue,
          colorValue,
        );
        alpha *= this.rgbs.length - 1;
        const c1 = this.rgbs[Math.floor(alpha)];
        const c2 = this.rgbs[Math.min(Math.floor(alpha) + 1, this.rgbs.length - 1)];
        const frac = alpha % 1;
        return [
          interpolate(c1[0], c2[0], frac),
          interpolate(c1[1], c2[1], frac),
          interpolate(c1[2], c2[2], frac),
        ];
      };

      this.posToColor = (pos: Point3D): ManimColor => {
        const rgb = this.posToRgb(pos);
        return rgbToColor(rgb);
      };
    } else {
      this.singleColor = true;
      this.color = ManimColor.parse(color) as ManimColor;
    }
    this.submobMovementUpdater = null;
  }

  static shiftFunc(
    func: VectorFieldFunc,
    shiftVector: Point3D,
  ): VectorFieldFunc {
    return (p: Point3D) => func(p.subtract(shiftVector) as Point3D);
  }

  static scaleFunc(
    func: VectorFieldFunc,
    scalar: number,
  ): VectorFieldFunc {
    return (p: Point3D) => func(p.multiply(scalar) as Point3D);
  }

  fitToCoordinateSystem(coordinateSystem: { coordsToPoint(...coords: number[]): Point3D }): void {
    this.applyFunction((pos: Point3D) => {
      const arr = pos.toArray() as number[];
      return coordinateSystem.coordsToPoint(...arr);
    });
  }

  nudge(
    mob: Mobject,
    dt: number = 1,
    substeps: number = 1,
    pointwise: boolean = false,
  ): this {
    const rungeKutta = (p: Point3D, stepSize: number): Point3D => {
      const pArr = p.toArray() as number[];
      const k1 = this.func(p);
      const k2 = this.func(
        np.array(pArr).add(k1.multiply(0.5).multiply(stepSize)) as Point3D,
      );
      const k3 = this.func(
        np.array(pArr).add(k2.multiply(0.5).multiply(stepSize)) as Point3D,
      );
      const k4 = this.func(
        np.array(pArr).add(k3.multiply(stepSize)) as Point3D,
      );
      // stepSize / 6 * (k1 + 2*k2 + 2*k3 + k4)
      const sum = k1
        .add(k2.multiply(2))
        .add(k3.multiply(2))
        .add(k4);
      return sum.multiply(stepSize / 6.0) as Point3D;
    };

    const stepSize = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      if (pointwise) {
        mob.applyFunction((p: Point3D) => p.add(rungeKutta(p, stepSize)) as Point3D);
      } else {
        mob.shift(rungeKutta(mob.getCenter(), stepSize));
      }
    }
    return this;
  }

  nudgeSubmobjects(
    dt: number = 1,
    substeps: number = 1,
    pointwise: boolean = false,
  ): this {
    for (const mob of this.submobjects) {
      this.nudge(mob as Mobject, dt, substeps, pointwise);
    }
    return this;
  }

  getNudgeUpdater(
    speed: number = 1,
    pointwise: boolean = false,
  ): (mob: Mobject, dt: number) => void {
    return (mob: Mobject, dt: number) => {
      this.nudge(mob, dt * speed, 1, pointwise);
    };
  }

  startSubmobjectMovement(
    speed: number = 1,
    pointwise: boolean = false,
  ): this {
    this.stopSubmobjectMovement();
    this.submobMovementUpdater = (mob: VectorField, dt: number) => {
      mob.nudgeSubmobjects(dt * speed, 1, pointwise);
    };
    this.addUpdater(this.submobMovementUpdater as (mob: Mobject, dt: number) => void);
    return this;
  }

  stopSubmobjectMovement(): this {
    if (this.submobMovementUpdater) {
      this.removeUpdater(this.submobMovementUpdater as (mob: Mobject, dt: number) => void);
    }
    this.submobMovementUpdater = null;
    return this;
  }

  getColoredBackgroundImage(samplingRate: number = 5): Buffer {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // The Python version uses PIL.Image to generate a pixel buffer.
    // In TS we would use sharp or @napi-rs/canvas.
    if (this.singleColor) {
      throw new Error(
        "There is no point in generating an image if the vector field uses a single color.",
      );
    }
    const ph = Math.floor(config.pixelHeight / samplingRate);
    const pw = Math.floor(config.pixelWidth / samplingRate);
    const fw = config.frameWidth;
    const fh = config.frameHeight;

    const buffer = Buffer.alloc(ph * pw * 3);
    const xStep = fw / (pw - 1);
    const yStep = fh / (ph - 1);

    for (let row = 0; row < ph; row++) {
      for (let col = 0; col < pw; col++) {
        const x = -fw / 2 + col * xStep;
        const y = fh / 2 - row * yStep;
        const pos = np.array([x, y, 0]);
        const rgb = this.posToRgb(pos);
        const offset = (row * pw + col) * 3;
        buffer[offset] = Math.round(rgb[0] * 255);
        buffer[offset + 1] = Math.round(rgb[1] * 255);
        buffer[offset + 2] = Math.round(rgb[2] * 255);
      }
    }
    return buffer;
  }

  getVectorizedRgbaGradientFunction(
    start: number,
    end: number,
    colors: ParsableManimColor[],
  ): (values: number[], opacity?: number) => number[][] {
    const rgbs = colors.map((c) => [...colorToRgb(c)]);

    return (values: number[], opacity: number = 1.0): number[][] => {
      return values.map((val) => {
        let alpha = inverseInterpolate(start, end, val);
        alpha = clamp(alpha, 0, 1);
        const scaledAlpha = alpha * (rgbs.length - 1);
        const idx = Math.floor(scaledAlpha);
        const nextIdx = Math.min(idx + 1, rgbs.length - 1);
        const frac = scaledAlpha % 1;
        const c1 = rgbs[idx];
        const c2 = rgbs[nextIdx];
        return [
          interpolate(c1[0], c2[0], frac),
          interpolate(c1[1], c2[1], frac),
          interpolate(c1[2], c2[2], frac),
          opacity,
        ];
      });
    };
  }
}

// ─── ArrowVectorField ──────────────────────────────────────

export class ArrowVectorField extends VectorField {
  xRange: number[];
  yRange: number[];
  zRange: number[];
  lengthFunc: (norm: number) => number;
  opacity: number;
  vectorConfig: Record<string, unknown>;

  constructor(
    func: VectorFieldFunc,
    options: ArrowVectorFieldOptions = {},
  ) {
    const {
      xRange: xRangeOpt,
      yRange: yRangeOpt,
      zRange: zRangeOpt,
      threeDimensions = false,
      lengthFunc = (norm: number) => 0.45 * sigmoid(norm),
      opacity = 1.0,
      vectorConfig,
      ...baseOptions
    } = options;

    const xRange = xRangeOpt ? [...xRangeOpt] : [
      Math.floor(-config.frameWidth / 2),
      Math.ceil(config.frameWidth / 2),
    ];
    const yRange = yRangeOpt ? [...yRangeOpt] : [
      Math.floor(-config.frameHeight / 2),
      Math.ceil(config.frameHeight / 2),
    ];

    const ranges: number[][] = [xRange, yRange];

    if (threeDimensions || zRangeOpt) {
      const zRange = zRangeOpt ? [...zRangeOpt] : [...yRange];
      ranges.push(zRange);
    } else {
      ranges.push([0, 0]);
    }

    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].length === 2) {
        ranges[i].push(0.5);
      }
      ranges[i][1] += ranges[i][2];
    }

    const [finalXRange, finalYRange, finalZRange] = ranges;

    super(func, baseOptions);

    this.xRange = finalXRange;
    this.yRange = finalYRange;
    this.zRange = finalZRange;
    this.lengthFunc = lengthFunc;
    this.opacity = opacity;
    this.vectorConfig = vectorConfig ?? {};
    this.func = func;

    // Generate vectors at grid positions
    const xValues = arangeValues(this.xRange);
    const yValues = arangeValues(this.yRange);
    const zValues = arangeValues(this.zRange);

    const vectors: Mobject[] = [];
    for (const x of xValues) {
      for (const y of yValues) {
        for (const z of zValues) {
          const point = (RIGHT as NDArray).multiply(x)
            .add((UP as NDArray).multiply(y))
            .add((OUT as NDArray).multiply(z)) as Point3D;
          vectors.push(this.getVector(point));
        }
      }
    }
    this.add(...(vectors as unknown as RealVMobject[]));
    this.setOpacity(this.opacity);
  }

  getVector(point: Point3D): Mobject {
    const output = np.array([...(this.func(point).toArray() as number[])]);
    const norm = np.linalg.norm(output) as number;
    let scaledOutput: Point3D;
    if (norm !== 0) {
      scaledOutput = output.multiply(this.lengthFunc(norm) / norm) as Point3D;
    } else {
      scaledOutput = output as Point3D;
    }
    const vect = new VectorStub(scaledOutput, this.vectorConfig);
    vect.shift(point);
    if (this.singleColor) {
      vect.setColor(this.color);
    } else {
      vect.setColor(this.posToColor(point));
    }
    return vect;
  }
}

// ─── StreamLines ────────────────────────────────────────────

export class StreamLines extends VectorField {
  xRange: number[];
  yRange: number[];
  zRange: number[];
  noiseFactor: number;
  nRepeats: number;
  virtualTime: number;
  maxAnchorsPerLine: number;
  padding: number;
  strokeWidth: number;
  streamLines: Mobject[];
  backgroundImg: Buffer | null;
  valuesToRgbas: ((values: number[], opacity?: number) => number[][]) | null;
  flowAnimation: ((mob: StreamLines, dt: number) => void) | null;
  flowSpeed: number;
  timeWidth: number;

  constructor(
    func: VectorFieldFunc,
    options: StreamLinesOptions = {},
  ) {
    const {
      xRange: xRangeOpt,
      yRange: yRangeOpt,
      zRange: zRangeOpt,
      threeDimensions = false,
      noiseFactor = null,
      nRepeats = 1,
      dt = 0.05,
      virtualTime = 3,
      maxAnchorsPerLine = 100,
      padding = 3,
      strokeWidth = 1,
      opacity = 1,
      ...baseOptions
    } = options;

    const xRange = xRangeOpt ? [...xRangeOpt] : [
      Math.floor(-config.frameWidth / 2),
      Math.ceil(config.frameWidth / 2),
    ];
    const yRange = yRangeOpt ? [...yRangeOpt] : [
      Math.floor(-config.frameHeight / 2),
      Math.ceil(config.frameHeight / 2),
    ];

    const ranges: number[][] = [xRange, yRange];

    if (threeDimensions || zRangeOpt) {
      const zRange = zRangeOpt ? [...zRangeOpt] : [...yRange];
      ranges.push(zRange);
    } else {
      ranges.push([0, 0]);
    }

    for (let i = 0; i < ranges.length; i++) {
      if (ranges[i].length === 2) {
        ranges[i].push(0.5);
      }
      ranges[i][1] += ranges[i][2];
    }

    const [finalXRange, finalYRange, finalZRange] = ranges;

    super(func, baseOptions);

    this.xRange = finalXRange;
    this.yRange = finalYRange;
    this.zRange = finalZRange;
    this.noiseFactor = noiseFactor ?? this.yRange[2] / 2;
    this.nRepeats = nRepeats;
    this.virtualTime = virtualTime;
    this.maxAnchorsPerLine = maxAnchorsPerLine;
    this.padding = padding;
    this.strokeWidth = strokeWidth;
    this.backgroundImg = null;
    this.valuesToRgbas = null;
    this.flowAnimation = null;
    this.flowSpeed = 1;
    this.timeWidth = 0.3;

    // Generate start points with seeded randomness
    const halfNoise = this.noiseFactor / 2;
    const seededRandom = createSeededRandom(0);

    const startPoints: Point3D[] = [];
    const xValues = arangeValues(this.xRange);
    const yValues = arangeValues(this.yRange);
    const zValues = arangeValues(this.zRange);

    for (let n = 0; n < this.nRepeats; n++) {
      for (const x of xValues) {
        for (const y of yValues) {
          for (const z of zValues) {
            const noise = [seededRandom(), seededRandom(), seededRandom()];
            const point = (RIGHT as NDArray).multiply(x - halfNoise)
              .add((UP as NDArray).multiply(y - halfNoise))
              .add((OUT as NDArray).multiply(z - halfNoise))
              .add(np.array(noise).multiply(this.noiseFactor)) as Point3D;
            startPoints.push(point);
          }
        }
      }
    }

    const outsideBox = (p: Point3D): boolean => {
      const pArr = p.toArray() as number[];
      return (
        pArr[0] < this.xRange[0] - this.padding ||
        pArr[0] > this.xRange[1] + this.padding - this.xRange[2] ||
        pArr[1] < this.yRange[0] - this.padding ||
        pArr[1] > this.yRange[1] + this.padding - this.yRange[2] ||
        pArr[2] < this.zRange[0] - this.padding ||
        pArr[2] > this.zRange[1] + this.padding - this.zRange[2]
      );
    };

    const maxSteps = Math.ceil(virtualTime / dt) + 1;

    if (!this.singleColor) {
      this.backgroundImg = this.getColoredBackgroundImage();
      if (config.renderer === RendererType.OPENGL) {
        this.valuesToRgbas = this.getVectorizedRgbaGradientFunction(
          baseOptions.minColorSchemeValue ?? 0,
          baseOptions.maxColorSchemeValue ?? 2,
          (baseOptions.colors ?? DEFAULT_SCALAR_FIELD_COLORS) as ParsableManimColor[],
        );
      }
    }

    for (const startPoint of startPoints) {
      const points: Point3D[] = [startPoint];
      for (let step = 0; step < maxSteps; step++) {
        const lastPoint = points[points.length - 1];
        const velocity = func(lastPoint);
        const newPoint = lastPoint.add(velocity.multiply(dt)) as Point3D;
        if (outsideBox(newPoint)) {
          break;
        }
        points.push(newPoint);
      }

      let step = maxSteps;
      if (!step) continue;

      let line: VMobjectStub;
      try {
        const VMobjectClass = getVectorizedMobjectClass();
        line = new (VMobjectClass as unknown as new () => VMobjectStub)();
      } catch {
        line = new VMobjectStub();
      }

      (line as VMobjectStub).duration = step * dt;
      const stride = Math.max(1, Math.floor(points.length / this.maxAnchorsPerLine));
      const sampledPoints: Point3D[] = [];
      for (let i = 0; i < points.length; i += stride) {
        sampledPoints.push(points[i]);
      }
      line.setPointsSmoothly(sampledPoints);

      if (this.singleColor) {
        line.setStroke(this.color as unknown as import("../../core/types.js").IColor, this.strokeWidth, opacity);
      } else {
        if (config.renderer === RendererType.OPENGL) {
          line.setStroke(undefined, this.strokeWidth / 4.0);
          if (this.valuesToRgbas && line.points.shape[0] > 0) {
            const norms: number[] = [];
            const numPts = line.points.shape[0];
            for (let i = 0; i < numPts; i++) {
              const pt = line.points.ndim === 1
                ? line.points
                : np.array([...(line.points.row(i).toArray() as number[])]);
              norms.push(np.linalg.norm(this.func(pt as Point3D)) as number);
            }
            line.setRgbaArrayDirect(this.valuesToRgbas(norms, opacity), "stroke_rgba");
          }
        } else {
          const isNon2D = this.zRange[0] !== 0 || this.zRange[1] !== 0.5 || this.zRange[2] !== 0.5;
          if (isNon2D) {
            const anchors = line.getAnchors() as unknown as Point3D[];
            if (anchors.length > 0) {
              const strokeColors = anchors.map((p: Point3D) => this.posToColor(p));
              line.setStroke(strokeColors as unknown as import("../../core/types.js").IColor);
            }
          } else {
            line.colorUsingBackgroundImage(this.backgroundImg);
          }
          line.setStroke(undefined, this.strokeWidth, opacity);
        }
      }
      this.add(line as unknown as RealVMobject);
    }
    this.streamLines = [...this.submobjects];
  }

  create(options: StreamLinesCreateOptions = {}): AnimationGroup {
    let { runTime, lagRatio } = options;

    if (runTime == null) {
      runTime = this.virtualTime;
    }
    if (lagRatio == null) {
      lagRatio = this.streamLines.length > 0
        ? runTime / 2 / this.streamLines.length
        : 0;
    }

    const animations = this.streamLines.map(
      (line) => new Create(line as unknown as IMobject, { runTime }),
    );
    // Shuffle animations randomly
    for (let i = animations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [animations[i], animations[j]] = [animations[j], animations[i]];
    }
    return new AnimationGroup(...animations, { lagRatio });
  }

  startAnimation(options: StartAnimationOptions = {}): void {
    const {
      warmUp = true,
      flowSpeed = 1,
      timeWidth = 0.3,
      rateFunc = linear,
      lineAnimationClass = ShowPassingFlash,
    } = options;

    for (const lineBase of this.streamLines) {
      const line = lineBase as unknown as VMobjectStub;
      const lineRunTime = line.duration / flowSpeed;
      line.anim = new (lineAnimationClass as unknown as new (
        mob: IMobject,
        opts?: ShowPassingFlashOptions,
      ) => { mobject: IMobject; runTime: number; begin(): void; finish(): void; interpolate(alpha: number): void })(
        line as unknown as IMobject,
        {
          runTime: lineRunTime,
          rateFunc,
          timeWidth,
        },
      );
      line.anim.begin();
      line.time = Math.random() * this.virtualTime;
      if (warmUp) {
        line.time *= -1;
      }
      this.add(line.anim.mobject as unknown as RealVMobject);
    }

    const updater = (mob: Mobject, dt: number) => {
      const self = mob as unknown as StreamLines;
      for (const lineBase of self.streamLines) {
        const line = lineBase as unknown as VMobjectStub;
        line.time += dt * flowSpeed;
        if (line.time >= self.virtualTime) {
          line.time -= self.virtualTime;
        }
        if (line.anim) {
          line.anim.interpolate(clamp(line.time / line.anim.runTime, 0, 1));
        }
      }
    };

    this.addUpdater(updater);
    this.flowAnimation = updater as unknown as (mob: StreamLines, dt: number) => void;
    this.flowSpeed = flowSpeed;
    this.timeWidth = timeWidth;
  }

  endAnimation(): AnimationGroup {
    if (this.flowAnimation == null) {
      throw new Error("You have to start the animation before fading it out.");
    }

    const hideAndWait = (_mob: IMobject, alpha: number) => {
      if (alpha === 0) {
        (_mob as unknown as VMobjectStub).setStroke(undefined, undefined, 0);
      } else if (alpha === 1) {
        (_mob as unknown as VMobjectStub).setStroke(undefined, undefined, 1);
      }
    };

    const maxRunTime = this.virtualTime / this.flowSpeed;
    const creationRateFunc = easeOutSine;
    const creationStartingSpeed = creationRateFunc(0.001) * 1000;
    const creationRunTime = maxRunTime / (1 + this.timeWidth) * creationStartingSpeed;

    const dtVal = 1 / config.frameRate;

    this.removeUpdater(this.flowAnimation as unknown as (mob: Mobject, dt: number) => void);
    this.flowAnimation = null;

    const animations: (AnimationGroup | Succession)[] = [];

    for (const lineBase of this.streamLines) {
      const line = lineBase as unknown as VMobjectStub;

      const createAnim = new Create(
        line as unknown as IMobject,
        {
          runTime: creationRunTime,
          rateFunc: creationRateFunc,
        },
      );

      if (line.time <= 0) {
        const finishUpdater = (_mob: IMobject, alpha: number) => {
          hideAndWait(_mob, alpha);
        };
        animations.push(
          new Succession(
            new UpdateFromAlphaFunc(
              line as unknown as IMobject,
              finishUpdater,
              { runTime: -line.time / this.flowSpeed },
            ),
            createAnim,
          ),
        );
        if (line.anim) {
          this.remove(line.anim.mobject as unknown as Mobject);
          line.anim.finish();
        }
      } else {
        const remainingTime = maxRunTime - line.time / this.flowSpeed;
        const finishCycleUpdater = (_mob: IMobject, alpha: number) => {
          const l = _mob as unknown as VMobjectStub;
          l.time += dtVal * this.flowSpeed;
          if (l.anim) {
            l.anim.interpolate(Math.min(l.time / l.anim.runTime, 1));
          }
          if (alpha === 1) {
            if (l.anim) {
              this.remove(l.anim.mobject as unknown as Mobject);
              l.anim.finish();
            }
          }
        };
        animations.push(
          new Succession(
            new UpdateFromAlphaFunc(
              line as unknown as IMobject,
              finishCycleUpdater,
              { runTime: remainingTime },
            ),
            createAnim,
          ),
        );
      }
    }
    return new AnimationGroup(...animations);
  }
}

// ─── Helpers ────────────────────────────────────────────────

function arangeValues(range: number[]): number[] {
  const [start, stop, step] = range;
  const result: number[] = [];
  for (let v = start; v < stop; v += step) {
    result.push(v);
  }
  return result;
}

function createSeededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    // Simple xorshift-based PRNG for reproducibility
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
