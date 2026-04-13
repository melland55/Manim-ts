/**
 * Animations transforming one mobject into another.
 *
 * Python equivalent: manim/animation/transform.py
 */

import type { NDArray } from "numpy-ts";
import type {
  IMobject,
  IScene,
  AnimationOptions,
  Point3D,
} from "../../core/types.js";
import { np, ORIGIN, OUT, DEGREES, smooth, squishRateFunc } from "../../core/math/index.js";
import { Animation } from "../animation/index.js";
import { Mobject, Group } from "../../mobject/mobject/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";
import { MethodWithArgs } from "../../data_structures/index.js";
import {
  pathAlongArc,
  pathAlongCircles,
} from "../../utils/paths/index.js";
import type { PathFuncType } from "../../utils/paths/index.js";
import {
  DEFAULT_POINTWISE_FUNCTION_RUN_TIME,
} from "../../constants/index.js";

// ─── Helper to cast IMobject to Mobject ──────────────────────

/** Cast IMobject to Mobject — safe in this codebase since all IMobjects are Mobjects at runtime. */
function asMobject(mob: IMobject): Mobject {
  return mob as unknown as Mobject;
}

// ─── Transform Options ───────────────────────────────────────

export interface TransformOptions extends AnimationOptions {
  pathFunc?: PathFuncType;
  pathArc?: number;
  pathArcAxis?: Point3D;
  pathArcCenters?: NDArray | null;
  replaceMobjectWithTargetInScene?: boolean;
}

// ─── Transform ───────────────────────────────────────────────

export class Transform extends Animation {
  targetMobject: Mobject;
  targetCopy!: Mobject;
  replaceMobjectWithTargetInScene: boolean;
  pathArcAxis: Point3D;
  pathArcCenters: NDArray | null;

  private _pathArc!: number;
  private _pathFunc!: PathFuncType;

  constructor(
    mobject: Mobject,
    targetMobject?: Mobject | null,
    options: TransformOptions = {},
  ) {
    const {
      pathFunc,
      pathArc = 0,
      pathArcAxis = OUT,
      pathArcCenters = null,
      replaceMobjectWithTargetInScene = false,
      ...animOptions
    } = options;

    super(mobject as unknown as IMobject, animOptions);

    this.pathArcAxis = pathArcAxis;
    this.pathArcCenters = pathArcCenters;
    this.replaceMobjectWithTargetInScene = replaceMobjectWithTargetInScene;
    this.targetMobject = targetMobject ?? new Mobject();

    // Set pathArc (triggers setter which creates _pathFunc from pathAlongArc)
    this.pathArc = pathArc;

    // Override _pathFunc if explicit pathFunc was provided
    if (pathFunc != null) {
      this._pathFunc = pathFunc;
    } else if (pathArcCenters != null) {
      this._pathFunc = pathAlongCircles(
        pathArc,
        pathArcCenters,
        pathArcAxis,
      );
    }
  }

  /** The mobject being animated, typed as Mobject for internal use. */
  get mob(): Mobject {
    return asMobject(this.mobject);
  }

  get pathArc(): number {
    return this._pathArc;
  }

  set pathArc(value: number) {
    this._pathArc = value;
    this._pathFunc = pathAlongArc(
      this._pathArc,
      this.pathArcAxis,
    );
  }

  get pathFunc(): PathFuncType {
    return this._pathFunc;
  }

  set pathFunc(value: PathFuncType) {
    if (value != null) {
      this._pathFunc = value;
    }
  }

  begin(): void {
    this.targetMobject = this.createTarget();
    this.targetCopy = this.targetMobject.copy();
    this.mob.alignData(this.targetCopy);
    super.begin();
  }

  createTarget(): Mobject {
    return this.targetMobject;
  }

  cleanUpFromScene(scene: IScene): void {
    super.cleanUpFromScene(scene);
    if (this.replaceMobjectWithTargetInScene) {
      scene.remove(this.mobject);
      scene.add(this.targetMobject as unknown as IMobject);
    }
  }

  getAllMobjects(): IMobject[] {
    return [
      this.mobject,
      this.startingMobject,
      this.targetMobject as unknown as IMobject,
      this.targetCopy as unknown as IMobject,
    ].filter(Boolean);
  }

  protected getAllFamiliesZipped(): Array<[IMobject, IMobject]> {
    const mobs = [
      this.mob,
      asMobject(this.startingMobject),
      this.targetCopy,
    ];
    const families = mobs.map((m) => m.familyMembersWithPoints());
    const len = Math.min(...families.map((f) => f.length));
    const result: Array<[IMobject, IMobject]> = [];
    for (let i = 0; i < len; i++) {
      // Pack three families into the tuple slots:
      // [0] = mobject family, [1] = starting family, [2] = target copy family
      // We store it as a 2-tuple to satisfy base class signature; the third
      // element is accessed via _getTargetCopyFamilies cache.
      result.push([families[0][i] as unknown as IMobject, families[1][i] as unknown as IMobject]);
    }
    // Store target copy families for use in interpolateMobject
    this._targetCopyFamilies = families[2];
    return result;
  }

  private _targetCopyFamilies: Mobject[] = [];

  interpolateMobject(alpha: number): void {
    const families = this.getAllFamiliesZipped();
    const n = families.length;
    for (let i = 0; i < n; i++) {
      const subAlpha = this.getSubAlpha(alpha, i, n);
      const [sub, startSub] = families[i];
      const targetCopy = this._targetCopyFamilies[i];
      this._interpolateSubmobjectTransform(
        asMobject(sub), asMobject(startSub), subAlpha, targetCopy,
      );
    }
  }

  private _interpolateSubmobjectTransform(
    submobject: Mobject,
    startingSubmobject: Mobject,
    alpha: number,
    targetCopy: Mobject,
  ): void {
    submobject.interpolate(
      startingSubmobject,
      targetCopy,
      alpha,
      this.pathFunc,
    );
  }
}

// ─── ReplacementTransform ────────────────────────────────────

export class ReplacementTransform extends Transform {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformOptions = {},
  ) {
    super(mobject, targetMobject, {
      ...options,
      replaceMobjectWithTargetInScene: true,
    });
  }
}

// ─── TransformFromCopy ───────────────────────────────────────

export class TransformFromCopy extends Transform {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformOptions = {},
  ) {
    super(targetMobject, mobject, options);
  }

  interpolate(alpha: number): void {
    super.interpolate(1 - alpha);
  }
}

// ─── ClockwiseTransform ──────────────────────────────────────

export class ClockwiseTransform extends Transform {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformOptions = {},
  ) {
    super(mobject, targetMobject, {
      pathArc: -Math.PI,
      ...options,
    });
  }
}

// ─── CounterclockwiseTransform ───────────────────────────────

export class CounterclockwiseTransform extends Transform {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformOptions = {},
  ) {
    super(mobject, targetMobject, {
      pathArc: Math.PI,
      ...options,
    });
  }
}

// ─── MoveToTarget ────────────────────────────────────────────

export class MoveToTarget extends Transform {
  constructor(mobject: Mobject, options: TransformOptions = {}) {
    MoveToTarget.checkValidityOfInput(mobject);
    super(mobject, mobject.target!, options);
  }

  static checkValidityOfInput(mobject: Mobject): void {
    if (mobject.target == null) {
      throw new Error(
        "MoveToTarget called on mobject without attribute 'target'",
      );
    }
  }
}

// ─── _MethodAnimation ────────────────────────────────────────

export class _MethodAnimation extends MoveToTarget {
  methods: MethodWithArgs[];

  constructor(mobject: Mobject, methods: MethodWithArgs[]) {
    super(mobject);
    this.methods = methods;
  }

  finish(): void {
    for (const item of this.methods) {
      item.call();
    }
    super.finish();
  }
}

// ─── ApplyMethod ─────────────────────────────────────────────

/**
 * Animates a mobject by applying a method.
 *
 * In TypeScript, since bound methods work differently than Python,
 * pass the mobject, method name, and args explicitly.
 *
 * Usage:
 *   new ApplyMethod(mobject, "scale", [2])
 *   new ApplyMethod(mobject, "setColor", [RED], { runTime: 2 })
 */
export class ApplyMethod extends Transform {
  methodName: string;
  methodArgs: unknown[];

  constructor(
    mobject: Mobject,
    methodName: string,
    methodArgs: unknown[] = [],
    options: TransformOptions = {},
  ) {
    super(mobject, undefined, options);
    this.methodName = methodName;
    this.methodArgs = methodArgs;
  }

  createTarget(): Mobject {
    const target = this.mob.copy();
    const method = (target as unknown as Record<string, Function>)[this.methodName];
    if (typeof method !== "function") {
      throw new Error(
        `Method '${this.methodName}' not found on mobject`,
      );
    }
    method.call(target, ...this.methodArgs);
    return target;
  }
}

// ─── ApplyPointwiseFunction ──────────────────────────────────

export class ApplyPointwiseFunction extends Transform {
  constructor(
    func: (point: Point3D) => Point3D,
    mobject: Mobject,
    options: TransformOptions = {},
  ) {
    const target = mobject.copy();
    target.applyFunction(func);

    super(mobject, target, {
      runTime: options.runTime ?? DEFAULT_POINTWISE_FUNCTION_RUN_TIME,
      ...options,
    });
  }
}

// ─── ApplyPointwiseFunctionToCenter ──────────────────────────

export class ApplyPointwiseFunctionToCenter extends Transform {
  constructor(
    func: (point: Point3D) => Point3D,
    mobject: Mobject,
    options: TransformOptions = {},
  ) {
    const target = mobject.copy();
    target.moveTo(func(mobject.getCenter()));
    super(mobject, target, options);
  }
}

// ─── FadeToColor ─────────────────────────────────────────────

export class FadeToColor extends Transform {
  constructor(
    mobject: Mobject,
    color: ParsableManimColor,
    options: TransformOptions = {},
  ) {
    const target = mobject.copy();
    target.setColor(color);
    super(mobject, target, options);
  }
}

// ─── ScaleInPlace ────────────────────────────────────────────

export class ScaleInPlace extends Transform {
  constructor(
    mobject: Mobject,
    scaleFactor: number,
    options: TransformOptions = {},
  ) {
    const target = mobject.copy();
    target.scale(scaleFactor);
    super(mobject, target, options);
  }
}

// ─── ShrinkToCenter ──────────────────────────────────────────

export class ShrinkToCenter extends ScaleInPlace {
  constructor(mobject: Mobject, options: TransformOptions = {}) {
    super(mobject, 0, options);
  }
}

// ─── Restore ─────────────────────────────────────────────────

export class Restore extends Transform {
  constructor(mobject: Mobject, options: TransformOptions = {}) {
    if (mobject.savedState == null) {
      throw new Error("Trying to restore without having saved");
    }
    super(mobject, mobject.savedState, options);
  }
}

// ─── ApplyFunction ───────────────────────────────────────────

export class ApplyFunction extends Transform {
  applyFn: (mobject: Mobject) => Mobject;

  constructor(
    func: (mobject: Mobject) => Mobject,
    mobject: Mobject,
    options: TransformOptions = {},
  ) {
    super(mobject, undefined, options);
    this.applyFn = func;
  }

  createTarget(): Mobject {
    const target = this.applyFn(this.mob.copy());
    if (!(target instanceof Mobject)) {
      throw new TypeError(
        "Functions passed to ApplyFunction must return object of type Mobject",
      );
    }
    return target;
  }
}

// ─── ApplyMatrix ─────────────────────────────────────────────

export class ApplyMatrix extends ApplyPointwiseFunction {
  constructor(
    matrix: NDArray | number[][],
    mobject: Mobject,
    options: TransformOptions & { aboutPoint?: Point3D } = {},
  ) {
    const { aboutPoint = ORIGIN, ...restOptions } = options;
    const initialized = ApplyMatrix.initializeMatrix(matrix);
    const aboutPt = aboutPoint;

    const func = (p: Point3D): Point3D => {
      const diff = p.subtract(aboutPt) as NDArray;
      return (np.dot(diff, initialized.T as NDArray) as NDArray).add(aboutPt) as Point3D;
    };

    super(func, mobject, restOptions);
  }

  static initializeMatrix(matrix: NDArray | number[][]): NDArray {
    const mat = Array.isArray(matrix) ? np.array(matrix) : matrix;
    const shape = mat.shape;
    if (shape[0] === 2 && shape[1] === 2) {
      const newMatrix = np.eye(3);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          newMatrix.set([i, j], mat.get([i, j]));
        }
      }
      return newMatrix;
    } else if (shape[0] === 3 && shape[1] === 3) {
      return mat;
    }
    throw new Error("Matrix has bad dimensions");
  }
}

// ─── ApplyComplexFunction ────────────────────────────────────

export class ApplyComplexFunction extends Transform {
  complexFunc: (z: { re: number; im: number }) => { re: number; im: number };

  constructor(
    func: (z: { re: number; im: number }) => { re: number; im: number },
    mobject: Mobject,
    options: TransformOptions = {},
  ) {
    const target = mobject.copy();
    target.applyComplexFunction(func);

    // Compute path_arc from func(1)
    const func1 = func({ re: 1, im: 0 });
    const pathArc = Math.atan2(func1.im, func1.re);

    super(mobject, target, { pathArc, ...options });
    this.complexFunc = func;
  }
}

// ─── CyclicReplace ───────────────────────────────────────────

export class CyclicReplace extends Transform {
  group: Group;

  constructor(
    mobjects: Mobject[],
    options: TransformOptions = {},
  ) {
    const group = new Group(...mobjects);
    super(group, undefined, {
      pathArc: 90 * DEGREES,
      ...options,
    });
    this.group = group;
  }

  createTarget(): Mobject {
    const target = this.group.copy();
    const targetSubs = target.submobjects;
    // Cycle: [last, first, second, ..., second-to-last]
    const cycledTargets = [
      targetSubs[targetSubs.length - 1],
      ...targetSubs.slice(0, -1),
    ];
    for (let i = 0; i < cycledTargets.length; i++) {
      cycledTargets[i].moveTo(this.group.submobjects[i].getCenter());
    }
    return target;
  }
}

// ─── Swap ────────────────────────────────────────────────────

export class Swap extends CyclicReplace {}

// ─── TransformAnimations ─────────────────────────────────────

export class TransformAnimations extends Transform {
  startAnim: Animation;
  endAnim: Animation;

  constructor(
    startAnim: Animation,
    endAnim: Animation,
    options: TransformOptions = {},
  ) {
    const {
      rateFunc = squishRateFunc(smooth, 0, 1),
      runTime,
      ...restOptions
    } = options;

    const effectiveRunTime = runTime ?? Math.max(startAnim.runTime, endAnim.runTime);

    startAnim.runTime = effectiveRunTime;
    endAnim.runTime = effectiveRunTime;

    super(asMobject(startAnim.mobject), asMobject(endAnim.mobject), {
      rateFunc,
      runTime: effectiveRunTime,
      ...restOptions,
    });

    this.startAnim = startAnim;
    this.endAnim = endAnim;
  }

  interpolate(alpha: number): void {
    this.startAnim.interpolate(alpha);
    this.endAnim.interpolate(alpha);
    super.interpolate(alpha);
  }
}

// ─── FadeTransform ───────────────────────────────────────────

export class FadeTransform extends Transform {
  toAddOnCompletion: Mobject;
  stretch: boolean;
  dimToMatch: number;
  endingMobject!: Mobject;

  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformOptions & { stretch?: boolean; dimToMatch?: number } = {},
  ) {
    const { stretch = true, dimToMatch = 1, ...transformOptions } = options;

    mobject.saveState();
    const group = new Group(mobject, targetMobject.copy());

    super(group, undefined, transformOptions);

    this.toAddOnCompletion = targetMobject;
    this.stretch = stretch;
    this.dimToMatch = dimToMatch;
  }

  begin(): void {
    this.endingMobject = this.mob.copy();
    // Call Animation.begin directly (not Transform.begin)
    Animation.prototype.begin.call(this);

    const start = asMobject(this.startingMobject);
    const end = this.endingMobject;

    // At start: target faded to match source position
    // At end: source faded to match target position
    this.ghostTo(start.submobjects[1], start.submobjects[0]);
    this.ghostTo(end.submobjects[0], end.submobjects[1]);
  }

  ghostTo(source: Mobject, target: Mobject): void {
    if (target.getNumPoints() > 0 || target.submobjects.length > 0) {
      source.replace(target, this.dimToMatch, this.stretch);
    }
    source.setOpacity(0);
  }

  getAllMobjects(): IMobject[] {
    return [
      this.mobject,
      this.startingMobject,
      this.endingMobject as unknown as IMobject,
    ].filter(Boolean);
  }

  protected getAllFamiliesZipped(): Array<[IMobject, IMobject]> {
    // Use Animation's 2-family version, not Transform's 3-family version
    const mobFamily = this.mobject.getFamily();
    const startMob = this.startingMobject;
    const startFamily = startMob != null ? startMob.getFamily() : mobFamily;
    const len = Math.min(mobFamily.length, startFamily.length);
    const result: Array<[IMobject, IMobject]> = [];
    for (let i = 0; i < len; i++) {
      result.push([mobFamily[i], startFamily[i]]);
    }
    return result;
  }

  cleanUpFromScene(scene: IScene): void {
    Animation.prototype.cleanUpFromScene.call(this, scene);
    scene.remove(this.mobject);
    this.mob.submobjects[0]?.restore?.();
    scene.add(this.toAddOnCompletion as unknown as IMobject);
  }
}

// ─── FadeTransformPieces ─────────────────────────────────────

export class FadeTransformPieces extends FadeTransform {
  begin(): void {
    const mob = this.mob;
    if (mob.submobjects.length >= 2) {
      mob.submobjects[0].alignSubmobjects?.(mob.submobjects[1]);
    }
    super.begin();
  }

  ghostTo(source: Mobject, target: Mobject): void {
    const sourceFamily = source.getFamily() as Mobject[];
    const targetFamily = target.getFamily() as Mobject[];
    const len = Math.min(sourceFamily.length, targetFamily.length);
    for (let i = 0; i < len; i++) {
      super.ghostTo(sourceFamily[i], targetFamily[i]);
    }
  }
}
