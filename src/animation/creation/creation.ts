/**
 * Animate the display or removal of a mobject from a scene.
 *
 * TypeScript port of manim/animation/creation.py
 */

import type {
  IMobject,
  IScene,
  AnimationOptions,
} from "../../core/types.js";
import {
  np,
  integerInterpolate,
  doubleSmooth,
  linear,
} from "../../core/math/index.js";
import { RIGHT, TAU } from "../../constants/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";
import { ManimColor } from "../../utils/color/index.js";
import { Animation } from "../animation/index.js";
import { Mobject, Group } from "../../mobject/mobject/index.js";
import { config } from "../../_config/index.js";

// ─── Type guards ────────────────────────────────────────────

function hasPointwiseBecomePartial(
  mob: IMobject,
): mob is IMobject & {
  pointwiseBecomePartial(other: IMobject, a: number, b: number): void;
} {
  return typeof (mob as unknown as Record<string, unknown>)["pointwiseBecomePartial"] === "function";
}

function isVMobjectLike(
  mob: IMobject,
): mob is IMobject & {
  setFill(options?: { color?: ParsableManimColor; opacity?: number }): IMobject;
  setStroke(options?: { color?: ParsableManimColor; width?: number; opacity?: number }): IMobject;
  getStrokeWidth(): number;
  getStrokeColor(): ManimColor;
  getFillOpacity(): number;
  getStrokeOpacity(): number;
  matchStyle(other: IMobject): IMobject;
  interpolate(m1: IMobject, m2: IMobject, alpha: number): IMobject;
  pointwiseBecomePartial(other: IMobject, a: number, b: number): void;
  familyMembersWithPoints(): IMobject[];
  invert(recursive?: boolean): void;
} {
  return (
    typeof (mob as unknown as Record<string, unknown>)["pointwiseBecomePartial"] === "function" &&
    typeof (mob as unknown as Record<string, unknown>)["setFill"] === "function"
  );
}

function asMobject(mob: IMobject): Mobject | null {
  return mob instanceof Mobject ? mob : null;
}

// ─── ShowPartial ────────────────────────────────────────────

export interface ShowPartialOptions extends AnimationOptions {
  reverseRateFunction?: boolean;
}

/**
 * Abstract class for Animations that show the VMobject partially.
 *
 * Raises TypeError if `mobject` does not have `pointwiseBecomePartial`.
 */
export class ShowPartial extends Animation {
  constructor(mobject: IMobject, options: ShowPartialOptions = {}) {
    if (!hasPointwiseBecomePartial(mobject)) {
      throw new TypeError(
        `${new.target.name} only works for VMobjects.`,
      );
    }
    const { reverseRateFunction, ...rest } = options;
    if (reverseRateFunction) {
      const origRate = rest.rateFunc ?? ((t: number) => t);
      rest.rateFunc = (t: number) => origRate(1 - t);
    }
    super(mobject, rest);
  }

  interpolateSubmobject(
    submobject: IMobject,
    startingSubmobject: IMobject,
    alpha: number,
  ): void {
    if (hasPointwiseBecomePartial(submobject)) {
      const [a, b] = this._getBounds(alpha);
      submobject.pointwiseBecomePartial(startingSubmobject, a, b);
    }
  }

  protected _getBounds(_alpha: number): [number, number] {
    throw new Error("Please use Create or ShowPassingFlash");
  }
}

// ─── Create ─────────────────────────────────────────────────

export interface CreateOptions extends ShowPartialOptions {
}

/**
 * Incrementally show a VMobject.
 */
export class Create extends ShowPartial {
  constructor(mobject: IMobject, options: CreateOptions = {}) {
    super(mobject, {
      lagRatio: 1.0,
      introducer: true,
      ...options,
    });
  }

  protected _getBounds(alpha: number): [number, number] {
    return [0, alpha];
  }
}

// ─── Uncreate ───────────────────────────────────────────────

export interface UncreateOptions extends CreateOptions {
}

/**
 * Like Create but in reverse.
 */
export class Uncreate extends Create {
  constructor(mobject: IMobject, options: UncreateOptions = {}) {
    super(mobject, {
      reverseRateFunction: true,
      remover: true,
      introducer: false,
      ...options,
    });
  }
}

// ─── DrawBorderThenFill ─────────────────────────────────────

export interface DrawBorderThenFillOptions extends AnimationOptions {
  strokeWidth?: number;
  strokeColor?: ParsableManimColor | null;
  reverseRateFunction?: boolean;
}

/**
 * Draw the border first and then show the fill.
 */
export class DrawBorderThenFill extends Animation {
  strokeWidth: number;
  strokeColor: ParsableManimColor | null;
  outline!: IMobject;

  constructor(vmobject: IMobject, options: DrawBorderThenFillOptions = {}) {
    DrawBorderThenFill._typecheckInput(vmobject);
    const {
      strokeWidth = 2,
      strokeColor = null,
      reverseRateFunction,
      ...rest
    } = options;

    const animOpts: AnimationOptions = {
      runTime: 2,
      rateFunc: doubleSmooth,
      introducer: true,
      ...rest,
    };

    if (reverseRateFunction) {
      const origRate = animOpts.rateFunc ?? doubleSmooth;
      animOpts.rateFunc = (t: number) => origRate(1 - t);
    }

    super(vmobject, animOpts);
    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.outline = this.getOutline();
  }

  private static _typecheckInput(vmobject: IMobject): void {
    if (!hasPointwiseBecomePartial(vmobject)) {
      throw new TypeError(
        `DrawBorderThenFill only works for vectorized Mobjects`,
      );
    }
  }

  begin(): void {
    this.outline = this.getOutline();
    super.begin();
  }

  getOutline(): IMobject {
    const outline = this.mobject.copy();
    if (isVMobjectLike(outline)) {
      outline.setFill({ opacity: 0 });
      for (const sm of outline.familyMembersWithPoints()) {
        if (isVMobjectLike(sm)) {
          sm.setStroke({
            color: this.getStrokeColor(sm),
            width: this.strokeWidth,
          });
        }
      }
    }
    return outline;
  }

  getStrokeColor(vmobject: IMobject): ParsableManimColor {
    if (this.strokeColor) {
      return this.strokeColor;
    }
    if (isVMobjectLike(vmobject)) {
      if (vmobject.getStrokeWidth() > 0) {
        return vmobject.getStrokeColor();
      }
    }
    return vmobject.color as unknown as ParsableManimColor;
  }

  getAllMobjects(): IMobject[] {
    return [...super.getAllMobjects(), this.outline];
  }

  interpolateSubmobject(
    submobject: IMobject,
    startingSubmobject: IMobject,
    alpha: number,
  ): void {
    const [index, subalpha] = integerInterpolate(0, 2, alpha);
    if (index === 0) {
      if (hasPointwiseBecomePartial(submobject)) {
        submobject.pointwiseBecomePartial(this.outline, 0, subalpha);
      }
      if (isVMobjectLike(submobject) && isVMobjectLike(this.outline)) {
        submobject.matchStyle(this.outline);
      }
    } else {
      if (isVMobjectLike(submobject) && isVMobjectLike(this.outline)) {
        submobject.interpolate(this.outline, startingSubmobject, subalpha);
      }
    }
  }
}

// ─── Write ──────────────────────────────────────────────────

export interface WriteOptions extends DrawBorderThenFillOptions {
  reverse?: boolean;
}

/**
 * Simulate hand-writing a Text or hand-drawing a VMobject.
 */
export class Write extends DrawBorderThenFill {
  reverse: boolean;

  constructor(vmobject: IMobject, options: WriteOptions = {}) {
    const {
      reverse = false,
      runTime,
      lagRatio,
      ...rest
    } = options;

    const [computedRunTime, computedLagRatio] = Write._setDefaultConfigFromLength(
      vmobject,
      runTime,
      lagRatio,
    );

    const remover = rest.remover ?? reverse;

    super(vmobject, {
      rateFunc: linear,
      runTime: computedRunTime,
      lagRatio: computedLagRatio,
      introducer: !reverse,
      remover,
      ...rest,
    });

    this.reverse = reverse;
  }

  private static _setDefaultConfigFromLength(
    vmobject: IMobject,
    runTime: number | undefined,
    lagRatio: number | undefined,
  ): [number, number] {
    let length = 0;
    if (isVMobjectLike(vmobject)) {
      length = vmobject.familyMembersWithPoints().length;
    } else {
      const mob = asMobject(vmobject);
      if (mob) length = mob.familyMembersWithPoints().length;
    }

    const resolvedRunTime = runTime ?? (length < 15 ? 1 : 2);
    const resolvedLagRatio = lagRatio ?? Math.min(4.0 / Math.max(1.0, length), 0.2);
    return [resolvedRunTime, resolvedLagRatio];
  }

  reverseSubmobjects(): void {
    if (isVMobjectLike(this.mobject)) {
      this.mobject.invert(true);
    }
  }

  begin(): void {
    if (this.reverse) {
      this.reverseSubmobjects();
    }
    super.begin();
  }

  finish(): void {
    super.finish();
    if (this.reverse) {
      this.reverseSubmobjects();
    }
  }
}

// ─── Unwrite ────────────────────────────────────────────────

export interface UnwriteOptions extends WriteOptions {
}

/**
 * Simulate erasing by hand a Text or a VMobject.
 */
export class Unwrite extends Write {
  constructor(vmobject: IMobject, options: UnwriteOptions = {}) {
    super(vmobject, {
      reverse: true,
      reverseRateFunction: true,
      ...options,
    });
  }
}

// ─── SpiralIn ───────────────────────────────────────────────

export interface SpiralInOptions extends AnimationOptions {
  scaleFactor?: number;
  fadeInFraction?: number;
}

/**
 * Create the Mobject with sub-Mobjects flying in on spiral trajectories.
 */
export class SpiralIn extends Animation {
  shapes: IMobject;
  scaleFactor: number;
  shapeCenter: ReturnType<IMobject["getCenter"]>;
  fadeInFraction: number;

  private readonly finalPositions: ReturnType<IMobject["getCenter"]>[] = [];
  private readonly initialPositions: ReturnType<IMobject["getCenter"]>[] = [];

  constructor(shapes: IMobject, options: SpiralInOptions = {}) {
    const {
      scaleFactor = 8,
      fadeInFraction = 0.3,
      ...rest
    } = options;

    const shapesCopy = shapes.copy();
    const shapeCenter = shapes.getCenter();
    const cx = shapeCenter.get([0]) as number;
    const cy = shapeCenter.get([1]) as number;
    const cz = shapeCenter.get([2]) as number;

    const finalPositions: ReturnType<IMobject["getCenter"]>[] = [];
    const initialPositions: ReturnType<IMobject["getCenter"]>[] = [];

    for (const shape of shapes.submobjects) {
      const finalPos = shape.getCenter();
      const fx = finalPos.get([0]) as number;
      const fy = finalPos.get([1]) as number;
      const fz = finalPos.get([2]) as number;

      const initialPos = np.array([
        fx + (fx - cx) * scaleFactor,
        fy + (fy - cy) * scaleFactor,
        fz + (fz - cz) * scaleFactor,
      ]);

      finalPositions.push(finalPos);
      initialPositions.push(initialPos);

      shape.moveTo(initialPos);
      const mob = asMobject(shape);
      if (mob) mob.saveState();
    }

    super(shapes, { introducer: true, ...rest });

    this.shapes = shapesCopy;
    this.scaleFactor = scaleFactor;
    this.shapeCenter = shapeCenter;
    this.fadeInFraction = fadeInFraction;
    this.finalPositions = finalPositions;
    this.initialPositions = initialPositions;
  }

  interpolateMobject(alpha: number): void {
    alpha = this.rateFunc(alpha);

    for (let i = 0; i < this.shapes.submobjects.length; i++) {
      const originalShape = this.shapes.submobjects[i];
      const shape = this.mobject.submobjects[i];
      if (!shape) continue;

      const mob = asMobject(shape);
      if (mob) mob.restore();

      let fillOpacity = 0;
      let strokeOpacity = 0;
      if (isVMobjectLike(originalShape)) {
        fillOpacity = originalShape.getFillOpacity();
        strokeOpacity = originalShape.getStrokeOpacity();
      }

      const newFillOpacity = Math.min(
        fillOpacity,
        alpha * fillOpacity / this.fadeInFraction,
      );
      const newStrokeOpacity = Math.min(
        strokeOpacity,
        alpha * strokeOpacity / this.fadeInFraction,
      );

      const finalPos = this.finalPositions[i];
      const initialPos = this.initialPositions[i];
      if (finalPos && initialPos) {
        const dx = (finalPos.get([0]) as number) - (initialPos.get([0]) as number);
        const dy = (finalPos.get([1]) as number) - (initialPos.get([1]) as number);
        const dz = (finalPos.get([2]) as number) - (initialPos.get([2]) as number);
        shape.shift(np.array([dx * alpha, dy * alpha, dz * alpha]));
      }

      shape.rotate(TAU * alpha, undefined, { aboutPoint: this.shapeCenter });
      const mobShape = asMobject(shape);
      if (mobShape) {
        mobShape.rotate(-TAU * alpha, undefined, {
          aboutPoint: mobShape.getCenterOfMass(),
        });
      }

      if (isVMobjectLike(shape)) {
        shape.setFill({ opacity: newFillOpacity });
        shape.setStroke({ opacity: newStrokeOpacity });
      }
    }
  }
}

// ─── ShowIncreasingSubsets ───────────────────────────────────

export interface ShowIncreasingSubsetsOptions extends AnimationOptions {
  intFunc?: (x: number) => number;
  reverseRateFunction?: boolean;
}

/**
 * Show one submobject at a time, leaving all previous ones displayed on screen.
 */
export class ShowIncreasingSubsets extends Animation {
  allSubmobs: IMobject[];
  intFunc: (x: number) => number;
  reverseRateFunction: boolean;

  constructor(group: IMobject, options: ShowIncreasingSubsetsOptions = {}) {
    const {
      intFunc = Math.floor,
      reverseRateFunction = false,
      suspendMobjectUpdating = false,
      ...rest
    } = options;

    const allSubmobs = [...group.submobjects];
    for (const mobj of allSubmobs) {
      mobj.setOpacity(0);
    }

    super(group, { suspendMobjectUpdating, ...rest });

    this.allSubmobs = allSubmobs;
    this.intFunc = intFunc;
    this.reverseRateFunction = reverseRateFunction;
  }

  interpolateMobject(alpha: number): void {
    const nSubmobs = this.allSubmobs.length;
    const value = this.reverseRateFunction
      ? 1 - this.rateFunc(alpha)
      : this.rateFunc(alpha);
    const index = Math.round(this.intFunc(value * nSubmobs));
    this.updateSubmobjectList(index);
  }

  updateSubmobjectList(index: number): void {
    for (const mobj of this.allSubmobs.slice(0, index)) {
      mobj.setOpacity(1);
    }
    for (const mobj of this.allSubmobs.slice(index)) {
      mobj.setOpacity(0);
    }
  }
}

// ─── AddTextLetterByLetter ──────────────────────────────────

export interface AddTextLetterByLetterOptions extends ShowIncreasingSubsetsOptions {
  timePerChar?: number;
}

/**
 * Show a Text letter by letter on the scene.
 */
export class AddTextLetterByLetter extends ShowIncreasingSubsets {
  timePerChar: number;

  constructor(text: IMobject, options: AddTextLetterByLetterOptions = {}) {
    const {
      timePerChar = 0.1,
      intFunc = Math.ceil,
      rateFunc = linear,
      reverseRateFunction = false,
      introducer = true,
      ...rest
    } = options;

    // Check for empty text
    let hasPoints = false;
    const textMob = asMobject(text);
    if (textMob) {
      hasPoints = textMob.familyMembersWithPoints().length > 0;
    } else {
      hasPoints = text.getFamily().some(
        (m) => "points" in m,
      );
    }
    if (!hasPoints) {
      throw new Error(
        `The text mobject does not seem to contain any characters.`,
      );
    }

    let runTime = rest.runTime;
    if (runTime === undefined) {
      const minTimePerChar = Math.max(1 / config.frameRate, timePerChar);
      runTime = minTimePerChar * text.submobjects.length;
    }

    super(text, {
      intFunc,
      rateFunc,
      reverseRateFunction,
      introducer,
      runTime,
      ...rest,
    });

    this.timePerChar = timePerChar;
  }
}

// ─── RemoveTextLetterByLetter ───────────────────────────────

export interface RemoveTextLetterByLetterOptions extends AddTextLetterByLetterOptions {
}

/**
 * Remove a Text letter by letter from the scene.
 */
export class RemoveTextLetterByLetter extends AddTextLetterByLetter {
  constructor(text: IMobject, options: RemoveTextLetterByLetterOptions = {}) {
    super(text, {
      reverseRateFunction: true,
      introducer: false,
      remover: true,
      ...options,
    });
  }
}

// ─── ShowSubmobjectsOneByOne ────────────────────────────────

/**
 * Show one submobject at a time, removing all previously displayed ones from screen.
 */
export class ShowSubmobjectsOneByOne extends ShowIncreasingSubsets {
  constructor(group: IMobject | IMobject[], options: ShowIncreasingSubsetsOptions = {}) {
    const items = Array.isArray(group) ? group : group.submobjects;
    const newGroup = new Group(...(items as unknown as Mobject[]));
    super(newGroup as unknown as IMobject, {
      intFunc: Math.ceil,
      ...options,
    });
  }

  updateSubmobjectList(index: number): void {
    const currentSubmobjects = this.allSubmobs.slice(0, index);
    for (const mobj of currentSubmobjects.slice(0, -1)) {
      mobj.setOpacity(0);
    }
    if (currentSubmobjects.length > 0) {
      currentSubmobjects[currentSubmobjects.length - 1].setOpacity(1);
    }
  }
}

// ─── AddTextWordByWord ──────────────────────────────────────

// NOTE: Marked as broken in the Python source ("TODO, this is broken...").
// Requires Succession from animation/composition (not yet converted).

export interface AddTextWordByWordOptions extends AnimationOptions {
  timePerChar?: number;
}

/**
 * Show a Text word by word on the scene.
 * Note: currently broken (matches Python Manim status).
 *
 * TODO: Implement properly once animation/composition (Succession) is converted.
 */
export class AddTextWordByWord extends Animation {
  timePerChar: number;

  constructor(textMobject: IMobject, options: AddTextWordByWordOptions = {}) {
    const {
      timePerChar = 0.06,
      ...rest
    } = options;

    super(textMobject, rest);
    this.timePerChar = timePerChar;
  }
}

// ─── TypeWithCursor ─────────────────────────────────────────

export interface TypeWithCursorOptions extends AddTextLetterByLetterOptions {
  cursor: IMobject;
  buff?: number;
  keepCursorY?: boolean;
  leaveCursorOn?: boolean;
}

/**
 * Similar to AddTextLetterByLetter, but with an additional cursor mobject at the end.
 */
export class TypeWithCursor extends AddTextLetterByLetter {
  cursor: IMobject;
  buff: number;
  keepCursorY: boolean;
  leaveCursorOn: boolean;
  private yCursor: number = 0;
  private cursorInitialPosition!: ReturnType<IMobject["getCenter"]>;

  constructor(text: IMobject, options: TypeWithCursorOptions) {
    const {
      cursor,
      buff = 0.1,
      keepCursorY = true,
      leaveCursorOn = true,
      timePerChar = 0.1,
      reverseRateFunction = false,
      introducer = true,
      ...rest
    } = options;

    super(text, {
      timePerChar,
      reverseRateFunction,
      introducer,
      ...rest,
    });

    this.cursor = cursor;
    this.buff = buff;
    this.keepCursorY = keepCursorY;
    this.leaveCursorOn = leaveCursorOn;
  }

  begin(): void {
    this.yCursor = this.cursor.getCenter().get([1]) as number;
    this.cursorInitialPosition = this.mobject.getCenter();
    if (this.keepCursorY) {
      this._setCursorY(this.yCursor);
    }

    this.cursor.setOpacity(0);
    this.mobject.add(this.cursor);
    super.begin();
  }

  finish(): void {
    if (this.leaveCursorOn) {
      this.cursor.setOpacity(1);
    } else {
      this.cursor.setOpacity(0);
      this.mobject.remove(this.cursor);
    }
    super.finish();
  }

  cleanUpFromScene(scene: IScene): void {
    if (!this.leaveCursorOn) {
      scene.remove(this.cursor);
    }
    super.cleanUpFromScene(scene);
  }

  updateSubmobjectList(index: number): void {
    for (const mobj of this.allSubmobs.slice(0, index)) {
      mobj.setOpacity(1);
    }
    for (const mobj of this.allSubmobs.slice(index)) {
      mobj.setOpacity(0);
    }

    if (index !== 0 && this.allSubmobs.length > 0) {
      this.cursor.nextTo(this.allSubmobs[index - 1], RIGHT, { buff: this.buff });
      this._setCursorY(this.cursorInitialPosition.get([1]) as number);
    } else if (this.allSubmobs.length > 0) {
      this.cursor.moveTo(this.allSubmobs[0].getCenter());
      this._setCursorY(this.cursorInitialPosition.get([1]) as number);
    }

    if (this.keepCursorY) {
      this._setCursorY(this.yCursor);
    }
    this.cursor.setOpacity(1);
  }

  private _setCursorY(targetY: number): void {
    const curY = this.cursor.getCenter().get([1]) as number;
    const dy = targetY - curY;
    if (Math.abs(dy) > 1e-10) {
      this.cursor.shift(np.array([0, dy, 0]));
    }
  }
}

// ─── UntypeWithCursor ───────────────────────────────────────

export interface UntypeWithCursorOptions extends Omit<TypeWithCursorOptions, "cursor"> {
  cursor: IMobject;
}

/**
 * Similar to RemoveTextLetterByLetter, but with an additional cursor mobject at the end.
 */
export class UntypeWithCursor extends TypeWithCursor {
  constructor(text: IMobject, options: UntypeWithCursorOptions) {
    super(text, {
      reverseRateFunction: true,
      introducer: false,
      remover: true,
      ...options,
    });
  }
}
