/**
 * Base classes for objects that can be displayed.
 *
 * TypeScript port of manim/mobject/mobject.py
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
  TAU,
} from "../../core/math/index.js";
import type { Point3D, Points3D } from "../../core/math/index.js";
import type {
  IAnimation,
} from "../../core/types.js";
import {
  rotationMatrix,
  angleBetweenVectors,
  normalize,
} from "../../utils/space_ops/index.js";
import {
  ManimColor,
  type ParsableManimColor,
  interpolateColor,
  colorGradient,
} from "../../utils/color/core.js";
import {
  WHITE,
  BLACK,
  PURE_YELLOW,
} from "../../utils/color/manim_colors.js";
import {
  DL,
  MED_SMALL_BUFF,
  DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
} from "../../constants/constants.js";
import { config } from "../../_config/index.js";
import {
  listUpdate,
  removeListRedundancies,
} from "../../utils/iterables/index.js";
import { straightPath } from "../../utils/paths/index.js";
import type { PathFuncType } from "../../utils/paths/index.js";
import { MultiAnimationOverrideException } from "../../utils/exceptions/index.js";
import { MethodWithArgs } from "../../data_structures/index.js";
import { EventEmitter as PointerEventEmitter } from "../../scene/interaction/event_emitter.js";

// ─── Type aliases ────────────────────────────────────────────

type TimeBasedUpdater = (mob: Mobject, dt: number) => void;
type NonTimeBasedUpdater = (mob: Mobject) => void;
type MobjectUpdater = TimeBasedUpdater | NonTimeBasedUpdater;

type MappingFunction = (point: Point3D) => Point3D;
type MultiMappingFunction = (points: Points3D) => Points3D;
type FunctionOverride = (...args: unknown[]) => IAnimation;

// ─── Mobject ─────────────────────────────────────────────────

export class Mobject {
  name: string;
  dim: number;
  target: Mobject | null;
  zIndex: number;
  pointHash: string | null;
  submobjects: Mobject[];
  updaters: MobjectUpdater[];
  updatingSuspended: boolean;
  color: ManimColor;
  points: NDArray;
  savedState: Mobject | null;

  static animationOverrides: Map<
    new (...args: unknown[]) => IAnimation,
    FunctionOverride
  > = new Map();

  // Store original __init__ defaults for set_default
  private static _originalDefaults: Record<string, unknown> = {};
  private static _currentDefaults: Record<string, unknown> = {};

  constructor(options: MobjectConstructorOptions = {}) {
    const opts = { ...Mobject._currentDefaults, ...options };
    const color = (opts.color ?? WHITE) as ParsableManimColor;
    this.name = (opts.name as string | undefined) ?? this.constructor.name;
    this.dim = (opts.dim as number | undefined) ?? 3;
    this.target = (opts.target as Mobject | undefined) ?? null;
    this.zIndex = (opts.zIndex as number | undefined) ?? 0;
    this.pointHash = null;
    this.submobjects = [];
    this.updaters = [];
    this.updatingSuspended = false;
    this.color = ManimColor.parse(color) as ManimColor;
    this.savedState = null;
    this.points = np.zeros([0, this.dim]);

    this.resetPoints();
    this.generatePoints();
    this.initColors();
  }

  // ── Validation ──

  protected _assertValidSubmobjects(submobjects: Iterable<Mobject>): this {
    return this._assertValidSubmobjectsInternal(submobjects, Mobject);
  }

  protected _assertValidSubmobjectsInternal(
    submobjects: Iterable<Mobject>,
    mobClass: abstract new (...args: never[]) => Mobject,
  ): this {
    let i = 0;
    for (const submob of submobjects) {
      if (!(submob instanceof (mobClass as Function))) {
        let errorMessage =
          `Only values of type ${mobClass.name} can be added ` +
          `as submobjects of ${this.constructor.name}, but the value ` +
          `${submob} (at index ${i}) is of type ` +
          `${(submob as object)?.constructor?.name ?? typeof submob}.`;
        if (submob instanceof Mobject) {
          errorMessage += " You can try adding this value into a Group instead.";
        }
        throw new TypeError(errorMessage);
      }
      if (submob === (this as Mobject)) {
        throw new Error(
          `Cannot add ${this.constructor.name} as a submobject of ` +
          `itself (at index ${i}).`,
        );
      }
      i++;
    }
    return this;
  }

  // ── Animation overrides ──

  static animationOverrideFor(
    animationClass: new (...args: unknown[]) => IAnimation,
  ): FunctionOverride | null {
    return this.animationOverrides.get(animationClass) ?? null;
  }

  static addAnimationOverride(
    animationClass: new (...args: unknown[]) => IAnimation,
    overrideFunc: FunctionOverride,
  ): void {
    if (this.animationOverrides.has(animationClass)) {
      throw new MultiAnimationOverrideException(
        `The animation ${animationClass.name} for ` +
        `${this.name} is overridden by more than one method.`,
      );
    }
    this.animationOverrides.set(animationClass, overrideFunc);
  }

  static setDefault(defaults?: Record<string, unknown>): void {
    if (defaults && Object.keys(defaults).length > 0) {
      Object.assign(this._currentDefaults, defaults);
    } else {
      this._currentDefaults = {};
    }
  }

  // ── Properties ──

  get animate(): AnimationBuilder {
    return new AnimationBuilder(this);
  }

  get width(): number {
    return this.lengthOverDim(0);
  }

  set width(value: number) {
    this.scaleToFitWidth(value);
  }

  get height(): number {
    return this.lengthOverDim(1);
  }

  set height(value: number) {
    this.scaleToFitHeight(value);
  }

  get depth(): number {
    return this.lengthOverDim(2);
  }

  set depth(value: number) {
    this.scaleToFitDepth(value);
  }

  // ── String representation ──

  toString(): string {
    return this.name;
  }

  // ── Pointer events (additive; not part of Python Manim) ──
  // Lazily attach an EventEmitter on first use. No cost when unused.

  private _events?: PointerEventEmitter<Record<string, unknown>>;

  on(
    event: string,
    listener: (payload: unknown) => void,
  ): () => void {
    if (!this._events) {
      this._events = new PointerEventEmitter();
    }
    return this._events.on(event, listener as (p: unknown) => void);
  }

  off(event: string, listener: (payload: unknown) => void): void {
    if (!this._events) return;
    this._events.off(event, listener as (p: unknown) => void);
  }

  emit(event: string, payload: unknown): void {
    if (!this._events) return;
    if (this._events.hasListeners(event)) {
      this._events.emit(event, payload);
    }
  }

  // ── Points ──

  resetPoints(): this {
    this.points = np.zeros([0, this.dim]);
    return this;
  }

  initColors(_propagateColors = true): void {
    // Override in subclasses
  }

  generatePoints(): void {
    // Override in subclasses
  }

  getArrayAttrs(): string[] {
    return ["points"];
  }

  applyOverAttrArrays(func: MultiMappingFunction): this {
    for (const attr of this.getArrayAttrs()) {
      const current = (this as unknown as Record<string, unknown>)[attr] as NDArray;
      (this as unknown as Record<string, unknown>)[attr] = func(current);
    }
    return this;
  }

  // ── Submobject management ──

  add(...mobjects: Mobject[]): this {
    this._assertValidSubmobjects(mobjects);
    const uniqueMobjects = removeListRedundancies([...mobjects]);
    if (mobjects.length !== uniqueMobjects.length) {
      console.warn(
        "Attempted adding some Mobject as a child more than once, " +
        "this is not possible. Repetitions are ignored.",
      );
    }
    this.submobjects = listUpdate(this.submobjects, uniqueMobjects);
    return this;
  }

  insert(index: number, mobject: Mobject): void {
    this._assertValidSubmobjects([mobject]);
    this.submobjects.splice(index, 0, mobject);
  }

  addToBack(...mobjects: Mobject[]): this {
    this._assertValidSubmobjects(mobjects);
    this.remove(...mobjects);
    const unique = [...new Map(mobjects.map((m) => [m, m])).values()];
    this.submobjects = [...unique, ...this.submobjects];
    return this;
  }

  remove(...mobjects: Mobject[]): this {
    for (const mobject of mobjects) {
      const idx = this.submobjects.indexOf(mobject);
      if (idx !== -1) {
        this.submobjects.splice(idx, 1);
      }
    }
    return this;
  }

  // ── Generic set ──

  set(attrs: Record<string, unknown>): this {
    for (const [attr, value] of Object.entries(attrs)) {
      (this as unknown as Record<string, unknown>)[attr] = value;
    }
    return this;
  }

  // ── Copy ──

  copy(): this {
    return structuredCloneDeep(this);
  }

  generateTarget(useDeepCopy = false): Mobject {
    this.target = null; // Prevent unbounded linear recursion
    if (useDeepCopy) {
      this.target = structuredCloneDeep(this);
    } else {
      this.target = this.copy();
    }
    return this.target;
  }

  // ── Updating ──

  update(dt = 0, recursive = true): this {
    if (this.updatingSuspended) {
      return this;
    }
    for (const updater of this.updaters) {
      if (updater.length >= 2) {
        (updater as TimeBasedUpdater)(this, dt);
      } else {
        (updater as NonTimeBasedUpdater)(this);
      }
    }
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.update(dt, recursive);
      }
    }
    return this;
  }

  getTimeBasedUpdaters(): TimeBasedUpdater[] {
    return this.updaters.filter(
      (u): u is TimeBasedUpdater => u.length >= 2,
    );
  }

  hasTimeBasedUpdater(): boolean {
    return this.updaters.some((u) => u.length >= 2);
  }

  getUpdaters(): MobjectUpdater[] {
    return this.updaters;
  }

  getFamilyUpdaters(): MobjectUpdater[] {
    const result: MobjectUpdater[] = [];
    for (const sm of this.getFamily()) {
      result.push(...sm.getUpdaters());
    }
    return result;
  }

  addUpdater(
    updateFunction: MobjectUpdater,
    index?: number,
    callUpdater = false,
  ): this {
    if (index === undefined || index === null) {
      this.updaters.push(updateFunction);
    } else {
      this.updaters.splice(index, 0, updateFunction);
    }
    if (callUpdater) {
      if (updateFunction.length >= 2) {
        (updateFunction as TimeBasedUpdater)(this, 0);
      } else {
        (updateFunction as NonTimeBasedUpdater)(this);
      }
    }
    return this;
  }

  removeUpdater(updateFunction: MobjectUpdater): this {
    let idx = this.updaters.indexOf(updateFunction);
    while (idx !== -1) {
      this.updaters.splice(idx, 1);
      idx = this.updaters.indexOf(updateFunction);
    }
    return this;
  }

  clearUpdaters(recursive = true): this {
    this.updaters = [];
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.clearUpdaters();
      }
    }
    return this;
  }

  matchUpdaters(mobject: Mobject): this {
    this.clearUpdaters();
    for (const updater of mobject.getUpdaters()) {
      this.addUpdater(updater);
    }
    return this;
  }

  suspendUpdating(recursive = true): this {
    this.updatingSuspended = true;
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.suspendUpdating(recursive);
      }
    }
    return this;
  }

  resumeUpdating(recursive = true): this {
    this.updatingSuspended = false;
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.resumeUpdating(recursive);
      }
    }
    this.update(0, recursive);
    return this;
  }

  // ── Transforming operations ──

  applyToFamily(func: (mob: Mobject) => void): void {
    for (const mob of this.familyMembersWithPoints()) {
      func(mob);
    }
  }

  shift(...vectors: Point3D[]): this {
    const totalVector = vectors.reduce(
      (acc, v) => acc.add(v) as NDArray,
      np.zeros([this.dim]),
    );
    for (const mob of this.familyMembersWithPoints()) {
      mob.points = mob.points.add(totalVector) as NDArray;
    }
    return this;
  }

  scale(
    scaleFactor: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    this.applyPointsFunctionAboutPoint(
      (points: NDArray) => points.multiply(scaleFactor) as NDArray,
      options.aboutPoint,
      options.aboutEdge,
    );
    return this;
  }

  rotateAboutOrigin(angle: number, axis: Point3D = OUT): this {
    return this.rotate(angle, axis, { aboutPoint: ORIGIN });
  }

  rotate(
    angle: number,
    axis: Point3D = OUT,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    const rotMatrix = rotationMatrix(angle, axis) as NDArray;
    this.applyPointsFunctionAboutPoint(
      (points: NDArray) => {
        const rotT = rotMatrix.T as NDArray;
        return np.dot(points, rotT) as unknown as NDArray;
      },
      options.aboutPoint,
      options.aboutEdge,
    );
    return this;
  }

  flip(
    axis: Point3D = UP,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rotate(TAU / 2, axis, options);
  }

  stretch(
    factor: number,
    dim: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    const func = (points: NDArray): NDArray => {
      const arr = points.toArray() as number[][];
      for (let i = 0; i < arr.length; i++) {
        arr[i][dim] *= factor;
      }
      return np.array(arr);
    };
    this.applyPointsFunctionAboutPoint(func, options.aboutPoint, options.aboutEdge);
    return this;
  }

  applyFunction(
    func: MappingFunction,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    let aboutPoint = options.aboutPoint;
    const aboutEdge = options.aboutEdge;
    if (aboutPoint === undefined && aboutEdge === undefined) {
      aboutPoint = ORIGIN;
    }
    const multiMapping = (points: NDArray): NDArray => {
      const arr = points.toArray() as number[][];
      const result: number[][] = [];
      for (const row of arr) {
        const pt = np.array(row);
        const mapped = func(pt);
        result.push(mapped.toArray() as number[]);
      }
      return np.array(result);
    };
    this.applyPointsFunctionAboutPoint(multiMapping, aboutPoint, aboutEdge);
    return this;
  }

  applyFunctionToPosition(func: MappingFunction): this {
    this.moveTo(func(this.getCenter()));
    return this;
  }

  applyFunctionToSubmobjectPositions(func: MappingFunction): this {
    for (const submob of this.submobjects) {
      submob.applyFunctionToPosition(func);
    }
    return this;
  }

  applyMatrix(
    matrix: NDArray | number[][],
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    let aboutPoint = options.aboutPoint;
    const aboutEdge = options.aboutEdge;
    if (aboutPoint === undefined && aboutEdge === undefined) {
      aboutPoint = ORIGIN;
    }

    const matArr = Array.isArray(matrix) ? np.array(matrix) : matrix;
    const fullMatrix = np.eye(this.dim);
    const mShape = matArr.shape;
    const mRows = mShape[0];
    const mCols = mShape[1];
    for (let i = 0; i < mRows; i++) {
      for (let j = 0; j < mCols; j++) {
        fullMatrix.set([i, j], matArr.get([i, j]));
      }
    }

    this.applyPointsFunctionAboutPoint(
      (points: NDArray) => np.dot(points, fullMatrix.T as NDArray) as unknown as NDArray,
      aboutPoint,
      aboutEdge,
    );
    return this;
  }

  applyComplexFunction(
    func: (z: { re: number; im: number }) => { re: number; im: number },
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    const r3Func = (point: Point3D): Point3D => {
      const x = point.get([0]) as number;
      const y = point.get([1]) as number;
      const z = point.get([2]) as number;
      const result = func({ re: x, im: y });
      return np.array([result.re, result.im, z]);
    };
    return this.applyFunction(r3Func, options);
  }

  reversePoints(): this {
    for (const mob of this.familyMembersWithPoints()) {
      mob.applyOverAttrArrays((arr: NDArray) => {
        const data = arr.toArray() as number[][];
        data.reverse();
        return np.array(data);
      });
    }
    return this;
  }

  repeat(count: number): this {
    const repeatArray = (arr: NDArray): NDArray => {
      const data = arr.toArray() as number[][];
      const result: number[][] = [];
      for (let i = 0; i < count; i++) {
        result.push(...data);
      }
      return np.array(result.length > 0 ? result : []).reshape(-1, this.dim) as NDArray;
    };
    for (const mob of this.familyMembersWithPoints()) {
      mob.applyOverAttrArrays(repeatArray);
    }
    return this;
  }

  applyPointsFunctionAboutPoint(
    func: MultiMappingFunction,
    aboutPoint?: Point3D,
    aboutEdge?: Point3D,
  ): this {
    if (aboutPoint === undefined || aboutPoint === null) {
      if (aboutEdge === undefined || aboutEdge === null) {
        aboutEdge = ORIGIN;
      }
      aboutPoint = this.getCriticalPoint(aboutEdge);
    }
    // Copy to prevent mutation
    const ap = np.array((aboutPoint.toArray() as number[]).slice());
    for (const mob of this.familyMembersWithPoints()) {
      mob.points = mob.points.subtract(ap) as NDArray;
      mob.points = func(mob.points);
      mob.points = mob.points.add(ap) as NDArray;
    }
    return this;
  }

  poseAtAngle(): this {
    this.rotate(TAU / 14, (RIGHT as NDArray).add(UP) as Point3D);
    return this;
  }

  // ── Positioning methods ──

  center(): this {
    this.shift((this.getCenter() as NDArray).multiply(-1) as Point3D);
    return this;
  }

  alignOnBorder(
    direction: Point3D,
    buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  ): this {
    const dirArr = direction.toArray() as number[];
    const signArr = dirArr.map(Math.sign);
    const targetPoint = np.array([
      signArr[0] * config.frameXRadius,
      signArr[1] * config.frameYRadius,
      0,
    ]);
    const pointToAlign = this.getCriticalPoint(direction);
    const shiftVal = targetPoint
      .subtract(pointToAlign)
      .subtract((np.array(dirArr)).multiply(buff)) as NDArray;
    // Multiply by abs(sign(direction)) to zero out irrelevant dims
    const mask = np.array(dirArr.map((d) => Math.abs(Math.sign(d))));
    this.shift(shiftVal.multiply(mask) as Point3D);
    return this;
  }

  toCorner(
    corner: Point3D = DL,
    buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  ): this {
    return this.alignOnBorder(corner, buff);
  }

  toEdge(
    edge: Point3D = LEFT,
    buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  ): this {
    return this.alignOnBorder(edge, buff);
  }

  nextTo(
    mobjectOrPoint: Mobject | Point3D,
    direction: Point3D = RIGHT,
    options: {
      buff?: number;
      alignedEdge?: Point3D;
      submobjectToAlign?: Mobject;
      indexOfSubmobjectToAlign?: number;
      coorMask?: Point3D;
    } = {},
  ): this {
    const {
      buff = DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
      alignedEdge = ORIGIN,
      submobjectToAlign,
      indexOfSubmobjectToAlign,
      coorMask = np.array([1, 1, 1]),
    } = options;

    let targetPoint: Point3D;
    if (mobjectOrPoint instanceof Mobject) {
      const mob = mobjectOrPoint;
      let targetAligner: Mobject;
      if (indexOfSubmobjectToAlign !== undefined) {
        targetAligner = mob.submobjects[indexOfSubmobjectToAlign];
      } else {
        targetAligner = mob;
      }
      targetPoint = targetAligner.getCriticalPoint(
        (alignedEdge as NDArray).add(direction) as Point3D,
      );
    } else {
      targetPoint = mobjectOrPoint;
    }

    let aligner: Mobject;
    if (submobjectToAlign !== undefined) {
      aligner = submobjectToAlign;
    } else if (indexOfSubmobjectToAlign !== undefined) {
      aligner = this.submobjects[indexOfSubmobjectToAlign];
    } else {
      aligner = this;
    }

    const pointToAlign = aligner.getCriticalPoint(
      (alignedEdge as NDArray).subtract(direction) as Point3D,
    );

    const offset = (targetPoint as NDArray)
      .subtract(pointToAlign)
      .add((direction as NDArray).multiply(buff)) as NDArray;
    this.shift(offset.multiply(coorMask) as Point3D);
    return this;
  }

  shiftOntoScreen(buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER): this {
    const spaceLengths = [config.frameXRadius, config.frameYRadius];
    for (const vect of [UP, DOWN, LEFT, RIGHT]) {
      const vArr = vect.toArray() as number[];
      const dim = vArr.map(Math.abs).indexOf(Math.max(...vArr.map(Math.abs)));
      const maxVal = spaceLengths[dim] - buff;
      const edgeCenter = this.getEdgeCenter(vect);
      if ((np.dot(edgeCenter, vect) as number) > maxVal) {
        this.toEdge(vect, buff);
      }
    }
    return this;
  }

  isOffScreen(): boolean {
    if ((this.getLeft().get([0]) as number) > config.frameXRadius) return true;
    if ((this.getRight().get([0]) as number) < -config.frameXRadius) return true;
    if ((this.getBottom().get([1]) as number) > config.frameYRadius) return true;
    return (this.getTop().get([1]) as number) < -config.frameYRadius;
  }

  stretchAboutPoint(factor: number, dim: number, point: Point3D): this {
    return this.stretch(factor, dim, { aboutPoint: point });
  }

  rescaleToFit(
    length: number,
    dim: number,
    stretchMode = false,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    const oldLength = this.lengthOverDim(dim);
    if (oldLength === 0) return this;
    if (stretchMode) {
      this.stretch(length / oldLength, dim, options);
    } else {
      this.scale(length / oldLength, options);
    }
    return this;
  }

  scaleToFitWidth(
    w: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(w, 0, false, options);
  }

  stretchToFitWidth(
    w: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(w, 0, true, options);
  }

  scaleToFitHeight(
    h: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(h, 1, false, options);
  }

  stretchToFitHeight(
    h: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(h, 1, true, options);
  }

  scaleToFitDepth(
    d: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(d, 2, false, options);
  }

  stretchToFitDepth(
    d: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(d, 2, true, options);
  }

  setCoord(value: number, dim: number, direction: Point3D = ORIGIN): this {
    const curr = this.getCoord(dim, direction);
    const shiftVect = np.zeros([this.dim]);
    shiftVect.set([dim], value - curr);
    this.shift(shiftVect as Point3D);
    return this;
  }

  setX(x: number, direction: Point3D = ORIGIN): this {
    return this.setCoord(x, 0, direction);
  }

  setY(y: number, direction: Point3D = ORIGIN): this {
    return this.setCoord(y, 1, direction);
  }

  setZ(z: number, direction: Point3D = ORIGIN): this {
    return this.setCoord(z, 2, direction);
  }

  spaceOutSubmobjects(
    factor = 1.5,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    this.scale(factor, options);
    for (const submob of this.submobjects) {
      submob.scale(1.0 / factor);
    }
    return this;
  }

  moveTo(
    pointOrMobject: Point3D | Mobject,
    alignedEdge: Point3D = ORIGIN,
    coorMask: Point3D = np.array([1, 1, 1]),
  ): this {
    let target: Point3D;
    if (pointOrMobject instanceof Mobject) {
      target = pointOrMobject.getCriticalPoint(alignedEdge);
    } else {
      target = pointOrMobject;
    }
    const pointToAlign = this.getCriticalPoint(alignedEdge);
    const offset = (target as NDArray).subtract(pointToAlign) as NDArray;
    this.shift(offset.multiply(coorMask) as Point3D);
    return this;
  }

  replace(
    mobject: Mobject,
    dimToMatch = 0,
    stretchMode = false,
  ): this {
    if (mobject.getNumPoints() === 0 && mobject.submobjects.length === 0) {
      console.warn("Attempting to replace mobject with no points");
      return this;
    }
    if (stretchMode) {
      this.stretchToFitWidth(mobject.width);
      this.stretchToFitHeight(mobject.height);
    } else {
      this.rescaleToFit(mobject.lengthOverDim(dimToMatch), dimToMatch, false);
    }
    this.shift(
      (mobject.getCenter() as NDArray).subtract(this.getCenter()) as Point3D,
    );
    return this;
  }

  surround(
    mobject: Mobject,
    dimToMatch = 0,
    stretchMode = false,
    buff: number = MED_SMALL_BUFF,
  ): this {
    this.replace(mobject, dimToMatch, stretchMode);
    const length = mobject.lengthOverDim(dimToMatch);
    if (length > 0) {
      this.scale((length + buff) / length);
    }
    return this;
  }

  putStartAndEndOn(start: Point3D, end: Point3D): this {
    const [currStart, currEnd] = this.getStartAndEnd();
    const currVect = (currEnd as NDArray).subtract(currStart) as NDArray;
    const allZero = (currVect.toArray() as number[]).every((v) => v === 0);
    if (allZero) {
      this.points = np.array((start.toArray() as number[]).slice());
      return this;
    }
    const targetVect = (end as NDArray).subtract(start) as NDArray;
    const crossProd = np.cross(currVect, targetVect) as NDArray;
    const crossNorm = np.linalg.norm(crossProd) as number;
    const axis: Point3D = crossNorm !== 0
      ? (crossProd as NDArray).divide(crossNorm) as Point3D
      : OUT;

    const currNorm = np.linalg.norm(currVect) as number;
    const targetNorm = np.linalg.norm(targetVect) as number;
    this.scale(targetNorm / currNorm, { aboutPoint: currStart });
    this.rotate(
      angleBetweenVectors(currVect, targetVect),
      axis as Point3D,
      { aboutPoint: currStart },
    );
    this.shift((start as NDArray).subtract(currStart) as Point3D);
    return this;
  }

  // ── Background rectangle (stub — depends on geometry module) ──

  addBackgroundRectangle(
    _color?: ParsableManimColor,
    _opacity = 0.75,
  ): this {
    // TODO: Port from BackgroundRectangle in geometry.shape_matchers
    console.warn("addBackgroundRectangle: not yet implemented (needs geometry module)");
    return this;
  }

  addBackgroundRectangleToSubmobjects(): this {
    for (const submobject of this.submobjects) {
      submobject.addBackgroundRectangle();
    }
    return this;
  }

  addBackgroundRectangleToFamilyMembersWithPoints(): this {
    for (const mob of this.familyMembersWithPoints()) {
      mob.addBackgroundRectangle();
    }
    return this;
  }

  // ── Color functions ──

  setColor(color: ParsableManimColor = PURE_YELLOW, family = true): this {
    if (family) {
      for (const submob of this.submobjects) {
        submob.setColor(color, family);
      }
    }
    this.color = ManimColor.parse(color) as ManimColor;
    return this;
  }

  setColorByGradient(...colors: ParsableManimColor[]): this {
    this.setSubmobjectColorsByGradient(...colors);
    return this;
  }

  setColorsByRadialGradient(
    center?: Point3D,
    radius = 1,
    innerColor: ParsableManimColor = WHITE,
    outerColor: ParsableManimColor = BLACK,
  ): this {
    this.setSubmobjectColorsByRadialGradient(center, radius, innerColor, outerColor);
    return this;
  }

  setSubmobjectColorsByGradient(...colors: ParsableManimColor[]): this {
    if (colors.length === 0) {
      throw new Error("Need at least one color");
    }
    if (colors.length === 1) {
      return this.setColor(colors[0]);
    }
    const mobs = this.familyMembersWithPoints();
    const newColors = colorGradient(colors, mobs.length);
    for (let i = 0; i < mobs.length; i++) {
      mobs[i].setColor(newColors[i], false);
    }
    return this;
  }

  setSubmobjectColorsByRadialGradient(
    center?: Point3D,
    radius = 1,
    innerColor: ParsableManimColor = WHITE,
    outerColor: ParsableManimColor = BLACK,
  ): this {
    const c = center ?? this.getCenter();
    for (const mob of this.familyMembersWithPoints()) {
      const dist = np.linalg.norm(
        (mob.getCenter() as NDArray).subtract(c),
      ) as number;
      const t = Math.min(dist / radius, 1);
      const mobColor = interpolateColor(
        new ManimColor(innerColor),
        new ManimColor(outerColor),
        t,
      );
      mob.setColor(mobColor, false);
    }
    return this;
  }

  toOriginalColor(): this {
    this.setColor(this.color);
    return this;
  }

  fadeTo(color: ParsableManimColor, alpha: number, family = true): this {
    if (this.getNumPoints() > 0) {
      const newColor = interpolateColor(
        this.getColor(),
        new ManimColor(color),
        alpha,
      );
      this.setColor(newColor, false);
    }
    if (family) {
      for (const submob of this.submobjects) {
        submob.fadeTo(color, alpha);
      }
    }
    return this;
  }

  fade(darkness = 0.5, family = true): this {
    if (family) {
      for (const submob of this.submobjects) {
        submob.fade(darkness, family);
      }
    }
    return this;
  }

  getColor(): ManimColor {
    return this.color;
  }

  setOpacity(opacity: number): this {
    // Base implementation — subclasses override for fill/stroke opacity
    return this;
  }

  // ── State management ──

  saveState(): this {
    this.savedState = null; // Prevent exponential growth
    this.savedState = this.copy();
    return this;
  }

  restore(): this {
    if (this.savedState === null) {
      throw new Error("Trying to restore without having saved");
    }
    this.become(this.savedState);
    return this;
  }

  // ── Analysis & Getters ──

  reduceAcrossDimension(
    reduceFunc: (values: number[]) => number,
    dim: number,
  ): number {
    if (this.submobjects.length === 0 && this.getNumPoints() === 0) {
      return 0;
    }

    let rv: number | null = null;
    if (this.getNumPoints() > 0) {
      const col = this._getColumn(this.points, dim);
      rv = reduceFunc(col);
    }
    for (const mobj of this.submobjects) {
      const value = mobj.reduceAcrossDimension(reduceFunc, dim);
      rv = rv === null ? value : reduceFunc([value, rv]);
    }
    return rv!;
  }

  nonemptySubmobjects(): Mobject[] {
    return this.submobjects.filter(
      (submob) => submob.submobjects.length !== 0 || submob.getNumPoints() !== 0,
    );
  }

  getMergedArray(arrayAttr: string): NDArray {
    let result = (this as unknown as Record<string, unknown>)[arrayAttr] as NDArray;
    for (const submob of this.submobjects) {
      const subArr = submob.getMergedArray(arrayAttr);
      if (subArr.shape[0] > 0) {
        if (result.shape[0] === 0) {
          result = subArr;
        } else {
          result = np.vstack([result, subArr]);
        }
      }
    }
    return result;
  }

  getAllPoints(): NDArray {
    return this.getMergedArray("points");
  }

  getPointsDefiningBoundary(): NDArray {
    return this.getAllPoints();
  }

  getNumPoints(): number {
    return this.points.shape[0];
  }

  getExtremumAlongDim(
    points?: NDArray,
    dim = 0,
    key = 0,
  ): number {
    const npPoints = points ?? this.getPointsDefiningBoundary();
    if (npPoints.shape[0] === 0) return 0;
    const col = this._getColumn(npPoints, dim);
    if (key < 0) {
      return Math.min(...col);
    } else if (key === 0) {
      return (Math.min(...col) + Math.max(...col)) / 2;
    } else {
      return Math.max(...col);
    }
  }

  getCriticalPoint(direction: Point3D): Point3D {
    const result = np.zeros([this.dim]);
    const allPoints = this.getPointsDefiningBoundary();
    if (allPoints.shape[0] === 0) {
      return result as Point3D;
    }
    const dirArr = direction.toArray() as number[];
    for (let dim = 0; dim < this.dim; dim++) {
      const key = dirArr[dim];
      result.set([dim], this.getExtremumAlongDim(allPoints, dim, key));
    }
    return result as Point3D;
  }

  getEdgeCenter(direction: Point3D): Point3D {
    return this.getCriticalPoint(direction);
  }

  getCorner(direction: Point3D): Point3D {
    return this.getCriticalPoint(direction);
  }

  getCenter(): Point3D {
    return this.getCriticalPoint(np.zeros([this.dim]) as Point3D);
  }

  getCenterOfMass(): Point3D {
    const allPoints = this.getAllPoints();
    if (allPoints.shape[0] === 0) return np.zeros([this.dim]) as Point3D;
    return np.mean(allPoints, 0) as Point3D;
  }

  getBoundaryPoint(direction: Point3D): Point3D {
    const allPoints = this.getPointsDefiningBoundary();
    if (allPoints.shape[0] === 0) return np.zeros([this.dim]) as Point3D;
    const n = allPoints.shape[0];
    const dim = allPoints.shape[1];
    const dirArr: number[] = [];
    for (let j = 0; j < dim; j++) {
      dirArr.push(direction.get([j]) as number);
    }
    const dots: number[] = [];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < dim; j++) {
        s += (allPoints.get([i, j]) as number) * dirArr[j];
      }
      dots.push(s);
    }
    const maxIdx = dots.indexOf(Math.max(...dots));
    const rowArr: number[] = [];
    for (let j = 0; j < dim; j++) {
      rowArr.push(allPoints.get([maxIdx, j]) as number);
    }
    return np.array(rowArr) as Point3D;
  }

  getMidpoint(): Point3D {
    return this.pointFromProportion(0.5);
  }

  getTop(): Point3D {
    return this.getEdgeCenter(UP);
  }

  getBottom(): Point3D {
    return this.getEdgeCenter(DOWN);
  }

  getRight(): Point3D {
    return this.getEdgeCenter(RIGHT);
  }

  getLeft(): Point3D {
    return this.getEdgeCenter(LEFT);
  }

  getZenith(): Point3D {
    return this.getEdgeCenter(OUT);
  }

  getNadir(): Point3D {
    return this.getEdgeCenter(
      np.array([0, 0, -1]) as Point3D,
    );
  }

  lengthOverDim(dim: number): number {
    const maxCoord = this.reduceAcrossDimension(
      (vals) => Math.max(...vals),
      dim,
    );
    const minCoord = this.reduceAcrossDimension(
      (vals) => Math.min(...vals),
      dim,
    );
    return maxCoord - minCoord;
  }

  getCoord(dim: number, direction: Point3D = ORIGIN): number {
    const dirArr = direction.toArray() as number[];
    return this.getExtremumAlongDim(undefined, dim, dirArr[dim]);
  }

  getX(direction: Point3D = ORIGIN): number {
    return this.getCoord(0, direction);
  }

  getY(direction: Point3D = ORIGIN): number {
    return this.getCoord(1, direction);
  }

  getZ(direction: Point3D = ORIGIN): number {
    return this.getCoord(2, direction);
  }

  getStart(): Point3D {
    this.throwErrorIfNoPoints();
    return np.array([
      this.points.get([0, 0]) as number,
      this.points.get([0, 1]) as number,
      this.points.get([0, 2]) as number,
    ]) as Point3D;
  }

  getEnd(): Point3D {
    this.throwErrorIfNoPoints();
    const last = this.points.shape[0] - 1;
    return np.array([
      this.points.get([last, 0]) as number,
      this.points.get([last, 1]) as number,
      this.points.get([last, 2]) as number,
    ]) as Point3D;
  }

  getStartAndEnd(): [Point3D, Point3D] {
    return [this.getStart(), this.getEnd()];
  }

  pointFromProportion(_alpha: number): Point3D {
    throw new Error("Please override in a child class.");
  }

  proportionFromPoint(_point: Point3D): number {
    throw new Error("Please override in a child class.");
  }

  getPieces(nPieces: number): Group {
    const template = this.copy();
    template.submobjects = [];
    const alphas: number[] = [];
    for (let i = 0; i <= nPieces; i++) {
      alphas.push(i / nPieces);
    }
    const pieces: Mobject[] = [];
    for (let i = 0; i < nPieces; i++) {
      const piece = template.copy();
      // pointwiseBecomePartial is defined in VMobject subclass
      if ("pointwiseBecomePartial" in piece) {
        (piece as unknown as { pointwiseBecomePartial: (m: Mobject, a: number, b: number) => void })
          .pointwiseBecomePartial(this, alphas[i], alphas[i + 1]);
      }
      pieces.push(piece);
    }
    return new Group(...pieces);
  }

  getZIndexReferencePoint(): Point3D {
    return this.getCenter();
  }

  hasPoints(): boolean {
    return this.getNumPoints() > 0;
  }

  hasNoPoints(): boolean {
    return !this.hasPoints();
  }

  // ── Dimension / width / height getters (interface compat) ──

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  // ── Match properties ──

  matchColor(mobject: Mobject): this {
    return this.setColor(mobject.getColor());
  }

  matchDimSize(
    mobject: Mobject,
    dim: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.rescaleToFit(mobject.lengthOverDim(dim), dim, false, options);
  }

  matchWidth(
    mobject: Mobject,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.matchDimSize(mobject, 0, options);
  }

  matchHeight(
    mobject: Mobject,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.matchDimSize(mobject, 1, options);
  }

  matchDepth(
    mobject: Mobject,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return this.matchDimSize(mobject, 2, options);
  }

  matchCoord(
    mobject: Mobject,
    dim: number,
    direction: Point3D = ORIGIN,
  ): this {
    return this.setCoord(mobject.getCoord(dim, direction), dim, direction);
  }

  matchX(mobject: Mobject, direction: Point3D = ORIGIN): this {
    return this.matchCoord(mobject, 0, direction);
  }

  matchY(mobject: Mobject, direction: Point3D = ORIGIN): this {
    return this.matchCoord(mobject, 1, direction);
  }

  matchZ(mobject: Mobject, direction: Point3D = ORIGIN): this {
    return this.matchCoord(mobject, 2, direction);
  }

  alignTo(
    mobjectOrPoint: Mobject | Point3D,
    direction: Point3D = ORIGIN,
  ): this {
    let point: Point3D;
    if (mobjectOrPoint instanceof Mobject) {
      point = mobjectOrPoint.getCriticalPoint(direction);
    } else {
      point = mobjectOrPoint;
    }
    const dirArr = direction.toArray() as number[];
    const pointArr = point.toArray() as number[];
    for (let dim = 0; dim < this.dim; dim++) {
      if (dirArr[dim] !== 0) {
        this.setCoord(pointArr[dim], dim, direction);
      }
    }
    return this;
  }

  // ── Family matters ──

  getGroupClass(): typeof Group {
    return Group;
  }

  static getMobjectTypeClass(): typeof Mobject {
    return Mobject;
  }

  split(): Mobject[] {
    const result: Mobject[] = this.getNumPoints() > 0 ? [this] : [];
    return [...result, ...this.submobjects];
  }

  getFamily(recurse = true): Mobject[] {
    if (!recurse) return [this];
    const subFamilies = this.submobjects.map((x) => x.getFamily());
    const allMobjects: Mobject[] = [this];
    for (const fam of subFamilies) {
      allMobjects.push(...fam);
    }
    return removeListRedundancies(allMobjects);
  }

  familyMembersWithPoints(): Mobject[] {
    return this.getFamily().filter((m) => m.getNumPoints() > 0);
  }

  // ── Arrangement ──

  arrange(
    direction: Point3D = RIGHT,
    buff: number = DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
    centerResult = true,
  ): this {
    for (let i = 0; i < this.submobjects.length - 1; i++) {
      this.submobjects[i + 1].nextTo(this.submobjects[i], direction, { buff });
    }
    if (centerResult) {
      this.center();
    }
    return this;
  }

  arrangeInGrid(options: ArrangeInGridOptions = {}): this {
    let {
      rows,
      cols,
      buff = MED_SMALL_BUFF,
      cellAlignment = ORIGIN,
      rowAlignments,
      colAlignments,
      rowHeights,
      colWidths,
      flowOrder = "rd",
    } = options;

    const mobs = [...this.submobjects];
    const startPos = this.getCenter();

    // Determine rows/cols
    const initSize = (
      num: number | undefined,
      alignments: string | undefined,
      sizes: (number | null)[] | undefined,
    ): number | undefined => {
      if (num !== undefined) return num;
      if (alignments !== undefined) return alignments.length;
      if (sizes !== undefined) return sizes.length;
      return undefined;
    };

    cols = initSize(cols, colAlignments, colWidths);
    rows = initSize(rows, rowAlignments, rowHeights);

    if (rows === undefined && cols === undefined) {
      cols = Math.ceil(Math.sqrt(mobs.length));
    }
    if (rows === undefined) {
      rows = Math.ceil(mobs.length / cols!);
    }
    if (cols === undefined) {
      cols = Math.ceil(mobs.length / rows);
    }
    if (rows * cols < mobs.length) {
      throw new Error("Too few rows and columns to fit all submobjects.");
    }

    const buffX = typeof buff === "number" ? buff : buff[0];
    const buffY = typeof buff === "number" ? buff : buff[1];

    // Initialize alignment directions
    const charToDir: Record<string, Point3D> = {
      u: UP, c: ORIGIN, d: DOWN, l: LEFT, r: RIGHT,
    };

    const initAlignments = (
      alignments: string | undefined,
      num: number,
      validChars: Record<string, Point3D>,
      dir: Point3D,
    ): Point3D[] => {
      if (alignments === undefined) {
        const base = (cellAlignment as NDArray).multiply(dir) as Point3D;
        return Array(num).fill(base);
      }
      if (alignments.length !== num) {
        throw new Error("alignments has a mismatching size.");
      }
      return [...alignments].map((ch) => validChars[ch]);
    };

    const rowAlignDirs = initAlignments(
      rowAlignments, rows,
      { u: UP, c: ORIGIN, d: DOWN },
      RIGHT,
    );
    const colAlignDirs = initAlignments(
      colAlignments, cols,
      { l: LEFT, c: ORIGIN, r: RIGHT },
      UP,
    );

    // Flow order mapping
    const mapper: Record<string, (r: number, c: number) => number> = {
      dr: (r, c) => (rows! - r - 1) + c * rows!,
      dl: (r, c) => (rows! - r - 1) + (cols! - c - 1) * rows!,
      ur: (r, c) => r + c * rows!,
      ul: (r, c) => r + (cols! - c - 1) * rows!,
      rd: (r, c) => (rows! - r - 1) * cols! + c,
      ld: (r, c) => (rows! - r - 1) * cols! + (cols! - c - 1),
      ru: (r, c) => r * cols! + c,
      lu: (r, c) => r * cols! + (cols! - c - 1),
    };
    if (!(flowOrder in mapper)) {
      throw new Error(
        'flow_order must be one of: "dr", "rd", "ld", "dl", "ru", "ur", "lu", "ul".',
      );
    }
    const getMobIndex = mapper[flowOrder];

    // Reverse row directions (grid fills bottom-up)
    rowAlignDirs.reverse();
    const rowHeightsList = rowHeights ? [...rowHeights].reverse() : [];
    const colWidthsList = colWidths ? [...colWidths] : [];

    // Fill grid with placeholders
    const placeholder = new Mobject();
    while (mobs.length < rows * cols) {
      mobs.push(placeholder);
    }
    const grid: Mobject[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Mobject[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = getMobIndex(r, c);
        row.push(idx < mobs.length ? mobs[idx] : placeholder);
      }
      grid.push(row);
    }

    // Measure
    const measuredHeights = grid.map((row) =>
      Math.max(...row.map((m) => m.height)),
    );
    const measuredWidths: number[] = [];
    for (let c = 0; c < cols; c++) {
      measuredWidths.push(Math.max(...grid.map((row) => row[c].width)));
    }

    // Resolve sizes
    const initSizes = (
      sizes: (number | null)[] | undefined,
      num: number,
      measures: number[],
    ): number[] => {
      const s = sizes && sizes.length > 0 ? sizes : Array(num).fill(null);
      if (s.length !== num) throw new Error("sizes has a mismatching size.");
      return s.map((v, i) => (v !== null && v !== undefined ? v : measures[i]));
    };

    const heights = initSizes(
      rowHeightsList.length > 0 ? rowHeightsList : undefined,
      rows,
      measuredHeights,
    );
    const widths = initSizes(
      colWidthsList.length > 0 ? colWidthsList : undefined,
      cols,
      measuredWidths,
    );

    // Position each mob
    let y = 0;
    for (let r = 0; r < rows; r++) {
      let x = 0;
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] !== placeholder) {
          const alignment = (rowAlignDirs[r] as NDArray).add(colAlignDirs[c]) as Point3D;
          // Create a bounding box from (x,y) to (x+width, y+height) as two points
          const bl = np.array([x, y, 0]);
          const tr = np.array([x + widths[c], y + heights[r], 0]);
          const boxCenter = bl.add(tr).multiply(0.5) as Point3D;
          // Simple move to center of cell, adjusted by alignment
          const alignArr = alignment.toArray() as number[];
          const halfW = widths[c] / 2;
          const halfH = heights[r] / 2;
          const targetPt = np.array([
            (boxCenter.get([0]) as number) + alignArr[0] * halfW,
            (boxCenter.get([1]) as number) + alignArr[1] * halfH,
            0,
          ]);
          grid[r][c].moveTo(targetPt as Point3D, alignment);
        }
        x += widths[c] + buffX;
      }
      y += heights[r] + buffY;
    }

    this.moveTo(startPos);
    return this;
  }

  sort(
    pointToNumFunc: (p: Point3D) => number = (p) => p.get([0]) as number,
    submobFunc?: (m: Mobject) => number,
  ): this {
    const sortFn =
      submobFunc ?? ((m: Mobject) => pointToNumFunc(m.getCenter()));
    this.submobjects.sort((a, b) => sortFn(a) - sortFn(b));
    return this;
  }

  shuffle(recursive = false): void {
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.shuffle(true);
      }
    }
    // Fisher-Yates shuffle
    const arr = this.submobjects;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  invert(recursive = false): void {
    if (recursive) {
      for (const submob of this.submobjects) {
        submob.invert(true);
      }
    }
    this.submobjects.reverse();
  }

  arrangeSubmobjects(
    direction: Point3D = RIGHT,
    buff?: number,
    centerResult?: boolean,
  ): this {
    return this.arrange(direction, buff, centerResult);
  }

  sortSubmobjects(
    pointToNumFunc?: (p: Point3D) => number,
    submobFunc?: (m: Mobject) => number,
  ): this {
    return this.sort(pointToNumFunc, submobFunc);
  }

  shuffleSubmobjects(recursive?: boolean): void {
    return this.shuffle(recursive);
  }

  // ── Alignment ──

  alignData(mobject: Mobject, skipPointAlignment = false): void {
    this.nullPointAlign(mobject);
    this.alignSubmobjects(mobject);
    if (!skipPointAlignment) {
      this.alignPoints(mobject);
    }
    const selfFamily = this.submobjects;
    const otherFamily = mobject.submobjects;
    const len = Math.min(selfFamily.length, otherFamily.length);
    for (let i = 0; i < len; i++) {
      selfFamily[i].alignData(otherFamily[i]);
    }
  }

  getPointMobject(_center?: Point3D): Mobject {
    throw new Error(`getPointMobject not implemented for ${this.constructor.name}`);
  }

  alignPoints(mobject: Mobject): this {
    const count1 = this.getNumPoints();
    const count2 = mobject.getNumPoints();
    if (count1 < count2) {
      this.alignPointsWithLarger(mobject);
    } else if (count2 < count1) {
      mobject.alignPointsWithLarger(this);
    }
    return this;
  }

  alignPointsWithLarger(_largerMobject: Mobject): void {
    throw new Error("Please override in a child class.");
  }

  alignSubmobjects(mobject: Mobject): this {
    const n1 = this.submobjects.length;
    const n2 = mobject.submobjects.length;
    this.addNMoreSubmobjects(Math.max(0, n2 - n1));
    mobject.addNMoreSubmobjects(Math.max(0, n1 - n2));
    return this;
  }

  nullPointAlign(mobject: Mobject): this {
    for (const [m1, m2] of [
      [this, mobject],
      [mobject, this],
    ] as [Mobject, Mobject][]) {
      if (m1.hasNoPoints() && m2.hasPoints()) {
        m2.pushSelfIntoSubmobjects();
      }
    }
    return this;
  }

  pushSelfIntoSubmobjects(): this {
    const cpy = this.copy();
    cpy.submobjects = [];
    this.resetPoints();
    this.add(cpy);
    return this;
  }

  addNMoreSubmobjects(n: number): this | null {
    if (n === 0) return null;
    const curr = this.submobjects.length;
    if (curr === 0) {
      this.submobjects = [];
      for (let i = 0; i < n; i++) {
        this.submobjects.push(this.getPointMobject());
      }
      return null;
    }
    const target = curr + n;
    const repeatIndices: number[] = [];
    for (let i = 0; i < target; i++) {
      repeatIndices.push(Math.floor((i * curr) / target));
    }
    const splitFactors: number[] = [];
    for (let i = 0; i < curr; i++) {
      splitFactors.push(repeatIndices.filter((idx) => idx === i).length);
    }
    const newSubmobs: Mobject[] = [];
    for (let i = 0; i < curr; i++) {
      newSubmobs.push(this.submobjects[i]);
      for (let j = 1; j < splitFactors[i]; j++) {
        newSubmobs.push(this.submobjects[i].copy().fade(1));
      }
    }
    this.submobjects = newSubmobs;
    return this;
  }

  repeatSubmobject(submob: Mobject): Mobject {
    return submob.copy();
  }

  interpolate(
    mobject1: Mobject,
    mobject2: Mobject,
    alpha: number,
    pathFunc: PathFuncType = straightPath(),
  ): this {
    this.points = pathFunc(mobject1.points, mobject2.points, alpha);
    this.interpolateColor(mobject1, mobject2, alpha);
    return this;
  }

  interpolateColor(
    _mobject1: Mobject,
    _mobject2: Mobject,
    _alpha: number,
  ): void {
    // Override in subclass
  }

  become(
    mobject: Mobject,
    options: {
      matchHeight?: boolean;
      matchWidth?: boolean;
      matchDepth?: boolean;
      matchCenter?: boolean;
      stretch?: boolean;
    } = {},
  ): this {
    const {
      matchHeight = false,
      matchWidth = false,
      matchDepth = false,
      matchCenter = false,
      stretch = false,
    } = options;

    let source = mobject;
    if (stretch || matchHeight || matchWidth || matchDepth || matchCenter) {
      source = mobject.copy();
      if (stretch) {
        source.stretchToFitHeight(this.height);
        source.stretchToFitWidth(this.width);
        source.stretchToFitDepth(this.depth);
      } else {
        if (matchHeight) source.matchHeight(this);
        if (matchWidth) source.matchWidth(this);
        if (matchDepth) source.matchDepth(this);
      }
      if (matchCenter) {
        source.moveTo(this.getCenter());
      }
    }

    this.alignData(source, true);
    const selfFamily = this.getFamily();
    const sourceFamily = source.getFamily();
    const len = Math.min(selfFamily.length, sourceFamily.length);
    for (let i = 0; i < len; i++) {
      const sm1 = selfFamily[i];
      const sm2 = sourceFamily[i];
      sm1.points = np.array(
        (sm2.points.toArray() as number[][]).map((row) => [...row]),
      );
      sm1.interpolateColor(sm1, sm2, 1);
    }
    return this;
  }

  matchPoints(mobject: Mobject): this {
    const selfFamily = this.getFamily();
    const otherFamily = mobject.getFamily();
    const len = Math.min(selfFamily.length, otherFamily.length);
    for (let i = 0; i < len; i++) {
      selfFamily[i].points = np.array(
        (otherFamily[i].points.toArray() as number[][]).map((row) => [...row]),
      );
    }
    return this;
  }

  // ── Errors ──

  throwErrorIfNoPoints(): void {
    if (this.hasNoPoints()) {
      throw new Error(
        `Cannot call method for a Mobject with no points`,
      );
    }
  }

  // ── Z-index ──

  setZIndex(zIndexValue: number, family = true): this {
    if (family) {
      for (const submob of this.submobjects) {
        submob.setZIndex(zIndexValue, family);
      }
    }
    this.zIndex = zIndexValue;
    return this;
  }

  setZIndexByZCoord(): this {
    const center = this.getCenter();
    const zCoord = center.get([2]) as number;
    this.setZIndex(zCoord);
    return this;
  }

  // ── Display (stubs — depend on Camera) ──

  // TODO: Port getImage, show, saveImage — needs Camera implementation

  // ── Private helpers ──

  private _getColumn(arr: NDArray, dim: number): number[] {
    const data = arr.toArray() as number[][];
    return data.map((row) => row[dim]);
  }
}

// ─── Constructor options ─────────────────────────────────────

export interface MobjectConstructorOptions {
  color?: ParsableManimColor;
  name?: string;
  dim?: number;
  target?: Mobject;
  zIndex?: number;
}

// ─── ArrangeInGrid options ───────────────────────────────────

export interface ArrangeInGridOptions {
  rows?: number;
  cols?: number;
  buff?: number | [number, number];
  cellAlignment?: Point3D;
  rowAlignments?: string;
  colAlignments?: string;
  rowHeights?: (number | null)[];
  colWidths?: (number | null)[];
  flowOrder?: string;
}

// ─── Group ───────────────────────────────────────────────────

export class Group extends Mobject {
  constructor(...mobjects: Mobject[]) {
    super();
    this.add(...mobjects);
  }
}

// ─── AnimationBuilder ────────────────────────────────────────

export class AnimationBuilder {
  mobject: Mobject;
  overriddenAnimation: IAnimation | null;
  isChaining: boolean;
  methods: MethodWithArgs[];
  cannotPassArgs: boolean;
  animArgs: Record<string, unknown>;

  constructor(mobject: Mobject) {
    this.mobject = mobject;
    this.mobject.generateTarget();
    this.overriddenAnimation = null;
    this.isChaining = false;
    this.methods = [];
    this.cannotPassArgs = false;
    this.animArgs = {};
  }

  call(kwargs: Record<string, unknown>): this {
    if (this.cannotPassArgs) {
      throw new Error(
        "Animation arguments must be passed before accessing methods and can only be passed once",
      );
    }
    this.animArgs = kwargs;
    this.cannotPassArgs = true;
    return this;
  }

  getMethod(methodName: string): (...args: unknown[]) => AnimationBuilder {
    const target = this.mobject.target!;
    const method = (target as unknown as Record<string, unknown>)[methodName];
    if (typeof method !== "function") {
      throw new Error(`${methodName} is not a method on target`);
    }

    const self = this;
    const updateTarget = (...methodArgs: unknown[]): AnimationBuilder => {
      self.methods.push(
        new MethodWithArgs(
          method.bind(target) as (...args: unknown[]) => unknown,
          methodArgs,
        ),
      );
      (method as Function).apply(target, methodArgs);
      return self;
    };

    this.isChaining = true;
    this.cannotPassArgs = true;
    return updateTarget;
  }

  build(): IAnimation {
    // TODO: Port _MethodAnimation from animation.transform
    throw new Error(
      "AnimationBuilder.build() requires _MethodAnimation from animation.transform (not yet converted).",
    );
  }
}

// ─── UpdaterBuilder ──────────────────────────────────────────

export class UpdaterBuilder {
  private _mobject: Mobject;

  constructor(mobject: Mobject) {
    this._mobject = mobject;
  }

  getMethod(name: string): (...args: unknown[]) => UpdaterBuilder {
    const self = this;
    return (...methodArgs: unknown[]): UpdaterBuilder => {
      self._mobject.addUpdater(
        (m: Mobject) => {
          const method = (m as unknown as Record<string, unknown>)[name];
          if (typeof method === "function") {
            (method as Function).apply(m, methodArgs);
          }
        },
        undefined,
        true,
      );
      return self;
    };
  }
}

// ─── overrideAnimate decorator ───────────────────────────────

export function overrideAnimate<T extends (...args: unknown[]) => unknown>(
  method: T,
): (animationMethod: T) => T {
  return (animationMethod: T): T => {
    (method as Record<string, unknown>)._overrideAnimation = animationMethod;
    return animationMethod;
  };
}

// ─── Deep clone helper ───────────────────────────────────────

function structuredCloneDeep<T extends Mobject>(obj: T): T {
  const Cls = obj.constructor as new (...args: unknown[]) => T;
  const result = Object.create(Cls.prototype) as T;

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      (result as Record<string, unknown>)[key] = value;
    } else if (value instanceof Mobject) {
      (result as Record<string, unknown>)[key] = structuredCloneDeep(value);
    } else if (
      typeof value === "object" &&
      typeof (value as { toArray?: unknown }).toArray === "function" &&
      typeof (value as { get?: unknown }).get === "function"
    ) {
      // NDArray — deep copy. Duck-type via `.toArray` and `.get` methods
      // because numpy-ts NDArrays are Proxies whose `has` trap does not
      // expose `shape`, making `"shape" in value` unreliable at runtime.
      const arr = (value as NDArray).toArray();
      (result as Record<string, unknown>)[key] = np.array(
        Array.isArray(arr) && Array.isArray(arr[0])
          ? (arr as number[][]).map((row: number[]) => [...row])
          : Array.isArray(arr) ? [...arr] : arr,
      );
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((item: unknown) =>
        item instanceof Mobject ? structuredCloneDeep(item) : item,
      );
    } else if (value instanceof ManimColor) {
      (result as Record<string, unknown>)[key] = new ManimColor(value);
    } else if (value instanceof Map) {
      (result as Record<string, unknown>)[key] = new Map(value);
    } else if (value instanceof Set) {
      (result as Record<string, unknown>)[key] = new Set(value);
    } else {
      // Primitives, functions, etc.
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
