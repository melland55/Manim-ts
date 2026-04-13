/**
 * Animations drawing attention to particular mobjects.
 *
 * TypeScript port of manim/animation/indication.py
 */

import type {
  IMobject,
  IScene,
  AnimationOptions,
  Point3D,
  RateFunc,
} from "../../core/types.js";
import {
  np,
  interpolate,
  inverseInterpolate,
  smooth,
  thereAndBack,
  TAU,
} from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import {
  RIGHT,
  UP,
  SMALL_BUFF,
  DEFAULT_STROKE_WIDTH,
} from "../../constants/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";
import { ManimColor } from "../../utils/color/index.js";
import { GREY, PURE_YELLOW } from "../../utils/color/manim_colors.js";
import { normalize } from "../../utils/space_ops/index.js";
import { config } from "../../_config/index.js";

import { Animation } from "../animation/index.js";
import { AnimationGroup } from "../composition/index.js";
import { Succession } from "../composition/index.js";
import { Create, ShowPartial, Uncreate } from "../creation/index.js";
import { FadeIn, FadeOut } from "../fading/index.js";
import { Homotopy } from "../movement/index.js";
import { Transform } from "../transform/index.js";
import { UpdateFromFunc } from "../updaters/index.js";
import { Mobject } from "../../mobject/mobject/index.js";

// ─── Dependency stubs for unconverted geometry module ────────
// TODO: Replace with real imports once mobject.geometry is converted.

class VMobjectStub extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  strokeWidth: number;

  constructor(options: {
    fillColor?: ParsableManimColor;
    fillOpacity?: number;
    strokeColor?: ParsableManimColor;
    strokeOpacity?: number;
    strokeWidth?: number;
    color?: ParsableManimColor;
    name?: string;
    zIndex?: number;
  } = {}) {
    super({ color: options.color, name: options.name, zIndex: options.zIndex });
    this.fillColor = options.fillColor
      ? ManimColor.parse(options.fillColor) as ManimColor
      : new ManimColor("#FFFFFF");
    this.fillOpacity = options.fillOpacity ?? 0.0;
    this.strokeColor = options.strokeColor
      ? ManimColor.parse(options.strokeColor) as ManimColor
      : new ManimColor("#FFFFFF");
    this.strokeOpacity = options.strokeOpacity ?? 1.0;
    this.strokeWidth = options.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  }

  setFill(options?: { color?: ParsableManimColor; opacity?: number }): this {
    if (options?.color != null) {
      this.fillColor = ManimColor.parse(options.color) as ManimColor;
    }
    if (options?.opacity != null) {
      this.fillOpacity = options.opacity;
    }
    return this;
  }

  setStroke(options?: { color?: ParsableManimColor; width?: number; opacity?: number }): this {
    if (options?.color != null) {
      this.strokeColor = ManimColor.parse(options.color) as ManimColor;
    }
    if (options?.width != null) {
      this.strokeWidth = options.width;
    }
    if (options?.opacity != null) {
      this.strokeOpacity = options.opacity;
    }
    return this;
  }

  getStrokeWidth(): number {
    return this.strokeWidth;
  }

  pointwiseBecomePartial(_other: IMobject, _a: number, _b: number): void {
    // Stub — real implementation in VMobject module
  }
}

class VGroupStub extends VMobjectStub {
  override add(...mobjects: Mobject[]): this {
    for (const m of mobjects) {
      this.submobjects.push(m);
    }
    return this;
  }
}

class DotStub extends VMobjectStub {
  radius: number;

  constructor(options: {
    point?: Point3D;
    radius?: number;
    strokeWidth?: number;
    fillOpacity?: number;
    fillColor?: ParsableManimColor;
    strokeColor?: ParsableManimColor;
    color?: ParsableManimColor;
  } = {}) {
    super({
      fillColor: options.fillColor ?? options.color,
      fillOpacity: options.fillOpacity ?? 1.0,
      strokeWidth: options.strokeWidth ?? 0,
      strokeColor: options.strokeColor,
      color: options.color,
    });
    this.radius = options.radius ?? 0.08;
    if (options.point) {
      this.moveTo(options.point);
    }
  }
}

class CircleStub extends VMobjectStub {
  _radius: number;

  constructor(options: {
    radius?: number;
    color?: ParsableManimColor;
    strokeWidth?: number;
  } = {}) {
    super({
      color: options.color,
      strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    });
    this._radius = options.radius ?? 1.0;
  }

  surroundMobject(mobject: IMobject, bufferFactor = 1.2): this {
    const w = mobject.getWidth();
    const h = mobject.getHeight();
    const diameter = Math.max(w, h) * bufferFactor;
    this._radius = diameter / 2;
    this.moveTo(mobject.getCenter());
    return this;
  }

  get circleWidth(): number {
    return this._radius * 2;
  }
}

class LineStub extends VMobjectStub {
  constructor(start: Point3D, end: Point3D, options: {
    color?: ParsableManimColor;
    strokeWidth?: number;
  } = {}) {
    super({
      color: options.color,
      strokeWidth: options.strokeWidth,
    });
    this.points = np.vstack([start, end]);
  }
}

class SurroundingRectangleStub extends VMobjectStub {
  constructor(mobject: IMobject, options: {
    color?: ParsableManimColor;
    buff?: number;
    strokeWidth?: number;
  } = {}) {
    super({
      color: options.color,
      strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    });
    const buff = options.buff ?? SMALL_BUFF;
    const center = mobject.getCenter();
    const w = mobject.getWidth() + 2 * buff;
    const h = mobject.getHeight() + 2 * buff;
    const cArr = center.toArray() as number[];
    const cx = cArr[0];
    const cy = cArr[1];
    const cz = cArr[2];
    this.points = np.array([
      [cx - w / 2, cy - h / 2, cz],
      [cx + w / 2, cy - h / 2, cz],
      [cx + w / 2, cy + h / 2, cz],
      [cx - w / 2, cy + h / 2, cz],
    ]);
  }
}

// ─── Type helpers ────────────────────────────────────────────

function hasPointwiseBecomePartial(
  mob: IMobject,
): mob is IMobject & {
  pointwiseBecomePartial(other: IMobject, a: number, b: number): void;
} {
  return typeof (mob as unknown as Record<string, unknown>)["pointwiseBecomePartial"] === "function";
}

function isMobjectLike(val: unknown): val is IMobject {
  return val != null && typeof (val as IMobject).getCenter === "function";
}

/**
 * Wiggle rate function with configurable number of wiggles.
 * Python: rate_functions.wiggle(t, wiggles)
 */
function wiggleFunc(t: number, wiggles: number): number {
  return thereAndBack(t) * Math.sin(wiggles * TAU * t);
}

// ─── FocusOn ─────────────────────────────────────────────────

export interface FocusOnOptions extends AnimationOptions {
  opacity?: number;
  color?: ParsableManimColor;
}

/**
 * Shrink a spotlight to a position.
 *
 * Python: manim.animation.indication.FocusOn
 */
export class FocusOn extends Transform {
  private focusPoint: Point3D | IMobject;
  private _focusColor: ManimColor;
  private _opacity: number;

  constructor(
    focusPoint: Point3D | IMobject,
    options: FocusOnOptions = {},
  ) {
    const {
      opacity = 0.2,
      color = GREY,
      runTime = 2,
      ...rest
    } = options;

    const parsedColor = ManimColor.parse(color) as ManimColor;

    const startingDot = new DotStub({
      radius: config.frameXRadius + config.frameYRadius,
      strokeWidth: 0,
      fillColor: parsedColor,
      fillOpacity: 0,
    });

    super(
      startingDot,
      undefined,
      { runTime, remover: true, ...rest },
    );

    this.focusPoint = focusPoint;
    this._focusColor = parsedColor;
    this._opacity = opacity;
  }

  override createTarget(): Mobject {
    const littleDot = new DotStub({ radius: 0 });
    littleDot.setFill({ color: this._focusColor, opacity: this._opacity });
    const focusPoint = this.focusPoint;
    littleDot.addUpdater((d: Mobject) => {
      if (isMobjectLike(focusPoint)) {
        d.moveTo(focusPoint.getCenter());
      } else {
        d.moveTo(focusPoint as Point3D);
      }
    });
    return littleDot;
  }
}

// ─── Indicate ────────────────────────────────────────────────

export interface IndicateOptions extends AnimationOptions {
  scaleFactor?: number;
  color?: ParsableManimColor;
}

/**
 * Indicate a Mobject by temporarily resizing and recoloring it.
 *
 * Python: manim.animation.indication.Indicate
 */
export class Indicate extends Transform {
  private _indicateColor: ManimColor;
  private scaleFactor: number;

  constructor(
    mobject: Mobject,
    options: IndicateOptions = {},
  ) {
    const {
      scaleFactor = 1.2,
      color = PURE_YELLOW,
      rateFunc = thereAndBack,
      ...rest
    } = options;

    super(mobject, undefined, { rateFunc, ...rest });

    this._indicateColor = ManimColor.parse(color) as ManimColor;
    this.scaleFactor = scaleFactor;
  }

  override createTarget(): Mobject {
    const target = this.mob.copy();
    target.scale(this.scaleFactor);
    target.setColor(this._indicateColor);
    return target;
  }
}

// ─── Flash ───────────────────────────────────────────────────

export interface FlashOptions extends AnimationOptions {
  lineLength?: number;
  numLines?: number;
  flashRadius?: number;
  lineStrokeWidth?: number;
  color?: ParsableManimColor;
  timeWidth?: number;
}

/**
 * Send out lines in all directions from a point.
 *
 * Python: manim.animation.indication.Flash
 */
export class Flash extends AnimationGroup {
  point: Point3D;
  lines: VGroupStub;

  constructor(
    point: Point3D | IMobject,
    options: FlashOptions = {},
  ) {
    const {
      lineLength = 0.2,
      numLines = 12,
      flashRadius = 0.1,
      lineStrokeWidth = 3,
      color = PURE_YELLOW,
      timeWidth = 1,
      runTime = 1.0,
      ...rest
    } = options;

    // Resolve point
    let resolvedPoint: Point3D;
    if (isMobjectLike(point)) {
      resolvedPoint = point.getCenter();
    } else {
      resolvedPoint = np.array((point as NDArray).toArray()) as Point3D;
    }

    const parsedColor = ManimColor.parse(color) as ManimColor;

    // Create lines
    const lines = new VGroupStub();
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * TAU;
      const endPoint = resolvedPoint.add(
        RIGHT.multiply(lineLength),
      ) as Point3D;
      const line = new LineStub(resolvedPoint, endPoint);
      line.shift(RIGHT.multiply(flashRadius));
      line.rotate(angle, undefined, { aboutPoint: resolvedPoint });
      lines.add(line);
    }
    lines.setColor(parsedColor);
    lines.setStroke({ width: lineStrokeWidth });

    // Create line animations
    const animations: Animation[] = [];
    for (const sub of lines.submobjects) {
      animations.push(
        new ShowPassingFlash(sub as unknown as IMobject, {
          timeWidth,
          runTime,
          ...rest,
        }),
      );
    }

    super(...animations, { group: lines as unknown as IMobject });

    this.point = resolvedPoint;
    this.lines = lines;
  }
}

// ─── ShowPassingFlash ────────────────────────────────────────

export interface ShowPassingFlashOptions extends AnimationOptions {
  timeWidth?: number;
}

/**
 * Show only a sliver of the VMobject each frame.
 *
 * Python: manim.animation.indication.ShowPassingFlash
 */
export class ShowPassingFlash extends ShowPartial {
  timeWidth: number;

  constructor(
    mobject: IMobject,
    options: ShowPassingFlashOptions = {},
  ) {
    const { timeWidth = 0.1, ...rest } = options;
    super(mobject, { remover: true, introducer: true, ...rest });
    this.timeWidth = timeWidth;
  }

  protected override _getBounds(alpha: number): [number, number] {
    const tw = this.timeWidth;
    let upper = interpolate(0, 1 + tw, alpha);
    let lower = upper - tw;
    upper = Math.min(upper, 1);
    lower = Math.max(lower, 0);
    return [lower, upper];
  }

  override cleanUpFromScene(scene: IScene): void {
    super.cleanUpFromScene(scene);
    const families = this.getAllFamiliesZipped();
    for (const family of families) {
      const submob = family[0];
      const start = family[1];
      if (hasPointwiseBecomePartial(submob)) {
        submob.pointwiseBecomePartial(start, 0, 1);
      }
    }
  }
}

// ─── ShowPassingFlashWithThinningStrokeWidth ─────────────────

export interface ShowPassingFlashWithThinningStrokeWidthOptions extends AnimationOptions {
  nSegments?: number;
  timeWidth?: number;
}

/**
 * ShowPassingFlash with thinning stroke width.
 *
 * Python: manim.animation.indication.ShowPassingFlashWithThinningStrokeWidth
 */
export class ShowPassingFlashWithThinningStrokeWidth extends AnimationGroup {
  constructor(
    vmobject: IMobject,
    options: ShowPassingFlashWithThinningStrokeWidthOptions = {},
  ) {
    const {
      nSegments = 10,
      timeWidth = 0.1,
      ...rest
    } = options;

    const mob = vmobject as unknown as Mobject;
    const maxStrokeWidth = typeof (mob as unknown as VMobjectStub).getStrokeWidth === "function"
      ? (mob as unknown as VMobjectStub).getStrokeWidth()
      : DEFAULT_STROKE_WIDTH;

    const maxTimeWidth = timeWidth;
    const animations: Animation[] = [];

    for (let i = 0; i < nSegments; i++) {
      const sw = nSegments > 1 ? (i / (nSegments - 1)) * maxStrokeWidth : 0;
      const tw = nSegments > 1 ? maxTimeWidth * (1 - i / (nSegments - 1)) : maxTimeWidth;
      const copy = mob.copy();
      if (typeof (copy as unknown as VMobjectStub).setStroke === "function") {
        (copy as unknown as VMobjectStub).setStroke({ width: sw });
      }
      animations.push(
        new ShowPassingFlash(copy as unknown as IMobject, { timeWidth: tw, ...rest }),
      );
    }

    super(...animations);
  }
}

// ─── ApplyWave ───────────────────────────────────────────────

export interface ApplyWaveOptions extends AnimationOptions {
  direction?: Point3D;
  amplitude?: number;
  waveFunc?: RateFunc;
  timeWidth?: number;
  ripples?: number;
}

/**
 * Send a wave through the Mobject distorting it temporarily.
 *
 * Python: manim.animation.indication.ApplyWave
 */
export class ApplyWave extends Homotopy {
  constructor(
    mobject: IMobject,
    options: ApplyWaveOptions = {},
  ) {
    const {
      direction = UP,
      amplitude = 0.2,
      waveFunc = smooth,
      timeWidth = 1,
      ripples = 1,
      runTime = 2,
      ...rest
    } = options;

    const xMin = (mobject.getLeft().toArray() as number[])[0];
    const xMax = (mobject.getRight().toArray() as number[])[0];
    const vect = normalize(direction).multiply(amplitude);

    function wave(t: number): number {
      t = 1 - t;
      if (t >= 1 || t <= 0) return 0;

      const phases = ripples * 2;
      const phase = Math.floor(t * phases);

      if (phase === 0) {
        return waveFunc(t * phases);
      } else if (phase === phases - 1) {
        const tLocal = t - phase / phases;
        return (1 - waveFunc(tLocal * phases)) * (2 * (ripples % 2) - 1);
      } else {
        const phaseIdx = Math.floor((phase - 1) / 2);
        const tLocal = t - (2 * phaseIdx + 1) / phases;
        return (1 - 2 * waveFunc(tLocal * ripples)) * (1 - 2 * (phaseIdx % 2));
      }
    }

    function homotopy(
      x: number, y: number, z: number, t: number,
    ): [number, number, number] {
      const upper = interpolate(0, 1 + timeWidth, t);
      const lower = upper - timeWidth;
      const relativeX = inverseInterpolate(xMin, xMax, x);
      const wavePhase = inverseInterpolate(lower, upper, relativeX);
      const nudge = vect.multiply(wave(wavePhase));
      const nudgeArr = nudge.toArray() as number[];
      return [x + nudgeArr[0], y + nudgeArr[1], z + nudgeArr[2]];
    }

    super(homotopy, mobject, { runTime, ...rest });
  }
}

// ─── Wiggle ──────────────────────────────────────────────────

export interface WiggleOptions extends AnimationOptions {
  scaleValue?: number;
  rotationAngle?: number;
  nWiggles?: number;
  scaleAboutPoint?: Point3D | null;
  rotateAboutPoint?: Point3D | null;
}

/**
 * Wiggle a Mobject.
 *
 * Python: manim.animation.indication.Wiggle
 */
export class Wiggle extends Animation {
  private scaleValue: number;
  private rotationAngle: number;
  private nWiggles: number;
  private _scaleAboutPoint: Point3D | null;
  private _rotateAboutPoint: Point3D | null;

  constructor(
    mobject: IMobject,
    options: WiggleOptions = {},
  ) {
    const {
      scaleValue = 1.1,
      rotationAngle = 0.01 * TAU,
      nWiggles = 6,
      scaleAboutPoint = null,
      rotateAboutPoint = null,
      runTime = 2,
      ...rest
    } = options;

    super(mobject, { runTime, ...rest });

    this.scaleValue = scaleValue;
    this.rotationAngle = rotationAngle;
    this.nWiggles = nWiggles;
    this._scaleAboutPoint = scaleAboutPoint
      ? np.array((scaleAboutPoint as NDArray).toArray()) as Point3D
      : null;
    this._rotateAboutPoint = rotateAboutPoint
      ? np.array((rotateAboutPoint as NDArray).toArray()) as Point3D
      : null;
  }

  private getScaleAboutPoint(): Point3D {
    if (this._scaleAboutPoint !== null) {
      return this._scaleAboutPoint;
    }
    return this.mobject.getCenter();
  }

  private getRotateAboutPoint(): Point3D {
    if (this._rotateAboutPoint !== null) {
      return this._rotateAboutPoint;
    }
    return this.mobject.getCenter();
  }

  override interpolateSubmobject(
    submobject: IMobject,
    startingSubmobject: IMobject,
    alpha: number,
  ): void {
    const subMob = submobject as unknown as Mobject;
    const startMob = startingSubmobject as unknown as Mobject;
    if (subMob.points && startMob.points) {
      subMob.points = startMob.points.copy() as NDArray;
    }
    submobject.scale(
      interpolate(1, this.scaleValue, thereAndBack(alpha)),
      { aboutPoint: this.getScaleAboutPoint() },
    );
    submobject.rotate(
      wiggleFunc(alpha, this.nWiggles) * this.rotationAngle,
      undefined,
      { aboutPoint: this.getRotateAboutPoint() },
    );
  }
}

// ─── Circumscribe ────────────────────────────────────────────

export interface CircumscribeOptions extends AnimationOptions {
  shape?: "Rectangle" | "Circle";
  fadeIn?: boolean;
  fadeOut?: boolean;
  timeWidth?: number;
  buff?: number;
  color?: ParsableManimColor;
  strokeWidth?: number;
}

/**
 * Draw a temporary line surrounding the mobject.
 *
 * Python: manim.animation.indication.Circumscribe
 */
export class Circumscribe extends Succession {
  constructor(
    mobject: IMobject,
    options: CircumscribeOptions = {},
  ) {
    const {
      shape = "Rectangle",
      fadeIn: fadeInOpt = false,
      fadeOut: fadeOutOpt = false,
      timeWidth = 0.3,
      buff = SMALL_BUFF,
      color = PURE_YELLOW,
      runTime = 1,
      strokeWidth = DEFAULT_STROKE_WIDTH,
      ...rest
    } = options;

    const parsedColor = ManimColor.parse(color) as ManimColor;
    let frame: Mobject;

    if (shape === "Rectangle") {
      frame = new SurroundingRectangleStub(mobject, {
        color: parsedColor,
        buff,
        strokeWidth,
      });
    } else if (shape === "Circle") {
      const circle = new CircleStub({
        color: parsedColor,
        strokeWidth,
      });
      circle.surroundMobject(mobject, 1);
      const radius = circle.circleWidth / 2;
      circle.scale((radius + buff) / radius);
      frame = circle;
    } else {
      throw new Error("shape should be either 'Rectangle' or 'Circle'.");
    }

    const frameMob = frame as unknown as Mobject;

    if (fadeInOpt && fadeOutOpt) {
      super(
        new FadeIn(frameMob, { runTime: runTime / 2 }),
        new FadeOut(frameMob, { runTime: runTime / 2 }),
        rest,
      );
    } else if (fadeInOpt) {
      super(
        new FadeIn(frameMob, { runTime: runTime / 2 }),
        new Uncreate(frame as unknown as IMobject, { runTime: runTime / 2 }),
        rest,
      );
    } else if (fadeOutOpt) {
      super(
        new Create(frame as unknown as IMobject, { runTime: runTime / 2 }),
        new FadeOut(frameMob, { runTime: runTime / 2 }),
        rest,
      );
    } else {
      super(
        new ShowPassingFlash(frame as unknown as IMobject, {
          timeWidth,
          runTime,
        }),
        rest,
      );
    }
  }
}

// ─── Blink ───────────────────────────────────────────────────

export interface BlinkOptions extends AnimationOptions {
  timeOn?: number;
  timeOff?: number;
  blinks?: number;
  hideAtEnd?: boolean;
}

/**
 * Blink the mobject.
 *
 * Python: manim.animation.indication.Blink
 */
export class Blink extends Succession {
  constructor(
    mobject: IMobject,
    options: BlinkOptions = {},
  ) {
    const {
      timeOn = 0.5,
      timeOff = 0.5,
      blinks = 1,
      hideAtEnd = false,
      ...rest
    } = options;

    const animations: Animation[] = [];

    for (let i = 0; i < blinks; i++) {
      animations.push(
        new UpdateFromFunc(
          mobject,
          (mob: IMobject) => mob.setOpacity(1.0),
          { runTime: timeOn },
        ),
        new UpdateFromFunc(
          mobject,
          (mob: IMobject) => mob.setOpacity(0.0),
          { runTime: timeOff },
        ),
      );
    }

    if (!hideAtEnd) {
      animations.push(
        new UpdateFromFunc(
          mobject,
          (mob: IMobject) => mob.setOpacity(1.0),
          { runTime: timeOn },
        ),
      );
    }

    super(...animations, rest);
  }
}
