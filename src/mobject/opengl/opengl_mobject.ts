/**
 * OpenGL Mobject base class.
 *
 * TypeScript port of manim/mobject/opengl/opengl_mobject.py
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
  integerInterpolate,
} from "../../core/math/index.js";
import type { Point3D, Points3D } from "../../core/math/index.js";
import type {
  IMobject,
  IAnimation,
  ColorArray,
} from "../../core/types.js";
import {
  ManimColor,
  type ParsableManimColor,
  colorToRgb,
  colorToRgba,
  rgbToHex,
  colorGradient,
  interpolateColor,
} from "../../utils/color/index.js";
import {
  WHITE,
  BLACK,
} from "../../utils/color/manim_colors.js";
import {
  SMALL_BUFF,
  MED_SMALL_BUFF,
  MED_LARGE_BUFF,
  LARGE_BUFF,
  DEFAULT_MOBJECT_TO_EDGE_BUFFER,
  DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
  DEFAULT_STROKE_WIDTH,
  RendererType,
} from "../../constants/constants.js";
import { MethodWithArgs } from "../../data_structures/index.js";
import {
  ShaderWrapper,
  TRIANGLES,
  POINTS,
  type ShaderData,
} from "../../renderer/shader_wrapper/index.js";
import {
  batchByProperty,
  listUpdate,
  listify,
  makeEven,
  resizeArray,
  resizePreservingOrder,
  resizeWithInterpolation,
  uniqChain,
} from "../../utils/iterables/index.js";
import { straightPath } from "../../utils/paths/index.js";
import type { PathFuncType } from "../../utils/paths/index.js";
import {
  angleBetweenVectors,
  normalize,
  rotationMatrix,
} from "../../utils/space_ops/index.js";
import { interpolate as bezierInterpolate } from "../../utils/bezier/index.js";

// ─── Type aliases ────────────────────────────────────────────

type TimeBasedUpdater = (mob: OpenGLMobject, dt: number) => void;
type NonTimeBasedUpdater = (mob: OpenGLMobject) => void;
type OpenGLUpdater = TimeBasedUpdater | NonTimeBasedUpdater;

type MappingFunction = (point: Point3D) => Point3D;
type MultiMappingFunction = (points: Points3D) => Points3D;

export type {
  TimeBasedUpdater,
  NonTimeBasedUpdater,
  OpenGLUpdater,
  MappingFunction,
  MultiMappingFunction,
};

// ─── Helpers ─────────────────────────────────────────────────

function affectsShaderInfoId<T extends OpenGLMobject>(
  target: T,
  method: () => void,
): void {
  for (const mob of target.getFamily()) {
    method.call(mob);
    mob.refreshShaderWrapperId();
  }
}

/** Structured clone that works for Mobject trees. */
function cloneMobject<T extends OpenGLMobject>(mob: T, visited?: Map<OpenGLMobject, OpenGLMobject>): T {
  if (!visited) visited = new Map();
  if (visited.has(mob)) return visited.get(mob) as T;

  const clone = Object.create(Object.getPrototypeOf(mob));
  visited.set(mob, clone);

  for (const key of Object.keys(mob)) {
    const val = (mob as Record<string, unknown>)[key];
    if (val instanceof OpenGLMobject) {
      (clone as Record<string, unknown>)[key] = cloneMobject(val, visited);
    } else if (key === "data") {
      // Deep clone data dict: each value is an NDArray
      const dataDict = val as Record<string, { copy: () => unknown }>;
      const clonedData: Record<string, unknown> = {};
      for (const dk of Object.keys(dataDict)) {
        const dv = dataDict[dk];
        clonedData[dk] = dv && typeof dv.copy === "function" ? dv.copy() : dv;
      }
      (clone as Record<string, unknown>)[key] = clonedData;
    } else if (key === "uniforms") {
      (clone as Record<string, unknown>)[key] = { ...(val as Record<string, unknown>) };
    } else if (val != null && typeof val === "object" && "copy" in val && typeof (val as { copy: Function }).copy === "function") {
      (clone as Record<string, unknown>)[key] = (val as { copy: () => unknown }).copy();
    } else if (Array.isArray(val)) {
      (clone as Record<string, unknown>)[key] = val.map((v) =>
        v instanceof OpenGLMobject ? cloneMobject(v, visited) : v,
      );
    } else {
      (clone as Record<string, unknown>)[key] = val;
    }
  }
  return clone;
}

// ─── OpenGLMobject ──────────────────────────────────────────

export interface OpenGLMobjectOptions {
  color?: ParsableManimColor | ParsableManimColor[];
  opacity?: number;
  dim?: number;
  gloss?: number;
  shadow?: number;
  renderPrimitive?: number | string;
  texturePaths?: Record<string, string> | null;
  depthTest?: boolean;
  isFixedInFrame?: boolean;
  isFixedOrientation?: boolean;
  listenToEvents?: boolean;
  modelMatrix?: NDArray | null;
  shouldRender?: boolean;
  name?: string;
}

export class OpenGLMobject {
  name: string;
  data: Record<string, NDArray>;
  uniforms: Record<string, number | readonly number[]>;

  opacity: number;
  dim: number;
  renderPrimitive: number | string;
  texturePaths: Record<string, string> | null;
  depthTest: boolean;
  listenToEvents: boolean;

  protected _submobjects: OpenGLMobject[];
  parents: OpenGLMobject[];
  parent: OpenGLMobject | null;
  family: OpenGLMobject[];
  lockedDataKeys: Set<string>;
  needsNewBoundingBox: boolean;
  modelMatrix: NDArray;

  color: ManimColor | ManimColor[];
  shaderIndices: number[] | null;
  shouldRender: boolean;

  // Updaters
  private _updaters: OpenGLUpdater[];
  private _updatingSuspended: boolean;
  private _hasTimeBasedUpdater: boolean;

  // Shader wrappers
  protected _shaderWrapper: ShaderWrapper | null;

  // Target for animations
  target: OpenGLMobject | null;
  savedState: OpenGLMobject | null;

  // ── Static ──

  static shaderDtype: Array<{ name: string; type: string; size: number }> = [
    { name: "point", type: "float32", size: 3 },
  ];
  static shaderFolder = "";

  constructor(options: OpenGLMobjectOptions = {}) {
    const {
      color = WHITE,
      opacity = 1,
      dim = 3,
      gloss = 0.0,
      shadow = 0.0,
      renderPrimitive = TRIANGLES,
      texturePaths = null,
      depthTest = false,
      isFixedInFrame = false,
      isFixedOrientation = false,
      listenToEvents = false,
      modelMatrix = null,
      shouldRender = true,
      name,
    } = options;

    this.name = name ?? this.constructor.name;
    this.data = {};
    this.uniforms = {};

    this.opacity = opacity;
    this.dim = dim;
    this.renderPrimitive = renderPrimitive;
    this.texturePaths = texturePaths;
    this.depthTest = depthTest;
    this.listenToEvents = listenToEvents;

    this._submobjects = [];
    this.parents = [];
    this.parent = null;
    this.family = [this];
    this.lockedDataKeys = new Set();
    this.needsNewBoundingBox = true;

    if (modelMatrix !== null) {
      this.modelMatrix = modelMatrix;
    } else {
      this.modelMatrix = np.eye(4);
    }

    this._updaters = [];
    this._updatingSuspended = false;
    this._hasTimeBasedUpdater = false;
    this._shaderWrapper = null;
    this.target = null;
    this.savedState = null;

    this.initData();
    this.initUpdaters();
    this.initPoints();
    this.color = ManimColor.parse(color) as ManimColor | ManimColor[];
    this.initColors();

    // Set uniforms
    this.uniforms["is_fixed_in_frame"] = isFixedInFrame ? 1.0 : 0.0;
    this.uniforms["is_fixed_orientation"] = isFixedOrientation ? 1.0 : 0.0;
    this.uniforms["fixed_orientation_center"] = [0, 0, 0];
    this.uniforms["gloss"] = gloss;
    this.uniforms["shadow"] = shadow;

    this.shaderIndices = null;

    if (this.depthTest) {
      this.applyDepthTest();
    }

    this.shouldRender = shouldRender;
  }

  // ── Validation ──

  protected _assertValidSubmobjects(submobjects: Iterable<OpenGLMobject>): this {
    return this._assertValidSubmobjectsInternal(submobjects, OpenGLMobject);
  }

  protected _assertValidSubmobjectsInternal(
    submobjects: Iterable<OpenGLMobject>,
    mobClass: new (...args: never[]) => OpenGLMobject,
  ): this {
    let i = 0;
    for (const submob of submobjects) {
      if (!(submob instanceof mobClass)) {
        let errorMessage =
          `Only values of type ${mobClass.name} can be added ` +
          `as submobjects of ${this.constructor.name}, but the value ` +
          `${submob} (at index ${i}) is of type ` +
          `${(submob as object)?.constructor?.name ?? typeof submob}.`;
        if ((submob as object) instanceof OpenGLMobject) {
          errorMessage += " You can try adding this value into a Group instead.";
        }
        throw new TypeError(errorMessage);
      }
      if (submob === (this as OpenGLMobject)) {
        throw new Error(
          `Cannot add ${this.constructor.name} as a submobject of ` +
          `itself (at index ${i}).`,
        );
      }
      i++;
    }
    return this;
  }

  // ── String ──

  toString(): string {
    return this.constructor.name;
  }

  // ── Initialization ──

  initData(): void {
    this.data["points"] = np.zeros([0, 3]);
    this.data["bounding_box"] = np.zeros([3, 3]);
    this.data["rgbas"] = np.zeros([1, 4]);
  }

  initColors(): void {
    this.setColor(this.color, this.opacity);
  }

  initPoints(): void {
    // Override in subclasses
  }

  initUpdaters(): void {
    this._updaters = [];
    this._updatingSuspended = false;
    this._hasTimeBasedUpdater = false;
  }

  // ── Data accessors ──

  get points(): NDArray {
    return this.data["points"];
  }

  set points(value: NDArray) {
    this.data["points"] = value;
  }

  get rgbas(): NDArray {
    return this.data["rgbas"];
  }

  set rgbas(value: NDArray) {
    this.data["rgbas"] = value;
  }

  get boundingBox(): NDArray {
    return this.data["bounding_box"];
  }

  set boundingBox(value: NDArray) {
    this.data["bounding_box"] = value;
  }

  get gloss(): number {
    return (this.uniforms["gloss"] as number) ?? 0;
  }

  set gloss(value: number) {
    this.uniforms["gloss"] = value;
  }

  get shadow(): number {
    return (this.uniforms["shadow"] as number) ?? 0;
  }

  set shadow(value: number) {
    this.uniforms["shadow"] = value;
  }

  // ── Generic set ──

  set(attrs: Record<string, unknown>): this {
    for (const [attr, value] of Object.entries(attrs)) {
      (this as unknown as Record<string, unknown>)[attr] = value;
    }
    return this;
  }

  setData(data: Record<string, NDArray>): this {
    for (const key of Object.keys(data)) {
      this.data[key] = data[key].copy();
    }
    return this;
  }

  setUniforms(uniforms: Record<string, number | readonly number[]>): this {
    for (const key of Object.keys(uniforms)) {
      this.uniforms[key] = uniforms[key];
    }
    return this;
  }

  // ── Properties ──

  get animate(): _AnimationBuilder {
    return new _AnimationBuilder(this);
  }

  get width(): number {
    return this.lengthOverDim(0);
  }

  set width(value: number) {
    this.rescaleToFit(value, 0, false);
  }

  get height(): number {
    return this.lengthOverDim(1);
  }

  set height(value: number) {
    this.rescaleToFit(value, 1, false);
  }

  get depth(): number {
    return this.lengthOverDim(2);
  }

  set depth(value: number) {
    this.rescaleToFit(value, 2, false);
  }

  // ── Points ──

  resizePoints(
    newLength: number,
    resizeFunc: (arr: NDArray, n: number) => NDArray = resizeArray,
  ): this {
    if (newLength !== this.points.shape[0]) {
      this.points = resizeFunc(this.points, newLength);
    }
    this.refreshBoundingBox();
    return this;
  }

  setPoints(points: NDArray | number[][]): this {
    const arr = Array.isArray(points) ? np.array(points) : points;
    if (arr.shape[0] === this.points.shape[0]) {
      // Copy in-place
      const flat = arr.toArray() as number[][];
      for (let i = 0; i < flat.length; i++) {
        for (let j = 0; j < (flat[i] as number[]).length; j++) {
          this.points.set([i, j], (flat[i] as number[])[j]);
        }
      }
    } else {
      this.points = arr.copy();
    }
    this.refreshBoundingBox();
    return this;
  }

  applyOverAttrArrays(func: (arr: NDArray) => NDArray): this {
    for (const attr of this.getArrayAttrs()) {
      if (attr in this.data) {
        this.data[attr] = func(this.data[attr]);
      }
    }
    return this;
  }

  getArrayAttrs(): string[] {
    return ["points"];
  }

  appendPoints(newPoints: NDArray | number[][]): this {
    const arr = Array.isArray(newPoints) ? np.array(newPoints) : newPoints;
    if (this.points.shape[0] === 0) {
      this.points = arr.copy();
    } else {
      this.points = np.vstack([this.points, arr]);
    }
    this.refreshBoundingBox();
    return this;
  }

  reversePoints(): this {
    for (const mob of this.getFamily()) {
      for (const key of Object.keys(mob.data)) {
        const arr = mob.data[key];
        if (arr.shape[0] > 0) {
          // Reverse rows
          const rows: number[][] = [];
          for (let i = arr.shape[0] - 1; i >= 0; i--) {
            const row: number[] = [];
            for (let j = 0; j < arr.shape[1]; j++) {
              row.push(arr.get([i, j]) as number);
            }
            rows.push(row);
          }
          mob.data[key] = np.array(rows);
        }
      }
    }
    return this;
  }

  getMidpoint(): Point3D {
    return this.pointFromProportion(0.5);
  }

  applyPointsFunction(
    func: MultiMappingFunction,
    aboutPoint?: Point3D | null,
    aboutEdge: Point3D | null = ORIGIN,
    worksOnBoundingBox = false,
  ): this {
    if (aboutPoint == null && aboutEdge != null) {
      aboutPoint = this.getBoundingBoxPoint(aboutEdge);
    }

    for (const mob of this.getFamily()) {
      const arrs: NDArray[] = [];
      if (mob.hasPoints()) {
        arrs.push(mob.points);
      }
      if (worksOnBoundingBox) {
        arrs.push(mob.getBoundingBox());
      }

      for (const arr of arrs) {
        if (aboutPoint == null) {
          const result = func(arr);
          // Copy result back in
          for (let i = 0; i < arr.shape[0]; i++) {
            for (let j = 0; j < arr.shape[1]; j++) {
              arr.set([i, j], result.get([i, j]) as number);
            }
          }
        } else {
          const shifted = arr.subtract(aboutPoint);
          const result = func(shifted);
          const moved = result.add(aboutPoint);
          for (let i = 0; i < arr.shape[0]; i++) {
            for (let j = 0; j < arr.shape[1]; j++) {
              arr.set([i, j], moved.get([i, j]) as number);
            }
          }
        }
      }
    }

    if (!worksOnBoundingBox) {
      this.refreshBoundingBox(true);
    } else {
      for (const parent of this.parents) {
        parent.refreshBoundingBox();
      }
    }
    return this;
  }

  matchPoints(mobject: OpenGLMobject): this {
    this.setPoints(mobject.points);
    return this;
  }

  clearPoints(): this {
    this.points = np.zeros([0, 3]);
    return this;
  }

  getNumPoints(): number {
    return this.points.shape[0];
  }

  getAllPoints(): NDArray {
    if (this._submobjects.length > 0) {
      const arrays: NDArray[] = [];
      for (const sm of this.getFamily()) {
        if (sm.points.shape[0] > 0) {
          arrays.push(sm.points);
        }
      }
      if (arrays.length === 0) return np.zeros([0, 3]);
      return np.vstack(arrays);
    }
    return this.points;
  }

  hasPoints(): boolean {
    return this.getNumPoints() > 0;
  }

  // ── Bounding box ──

  getBoundingBox(): NDArray {
    if (this.needsNewBoundingBox) {
      this.boundingBox = this.computeBoundingBox();
      this.needsNewBoundingBox = false;
    }
    return this.boundingBox;
  }

  computeBoundingBox(): NDArray {
    const allPointArrays: NDArray[] = [];
    if (this.points.shape[0] > 0) {
      allPointArrays.push(this.points);
    }
    for (const mob of this.getFamily().slice(1)) {
      if (mob.hasPoints()) {
        allPointArrays.push(mob.getBoundingBox());
      }
    }

    if (allPointArrays.length === 0) {
      return np.zeros([3, this.dim]);
    }

    const allPoints = np.vstack(allPointArrays);
    const mins: number[] = [];
    const maxs: number[] = [];
    const mids: number[] = [];
    for (let j = 0; j < this.dim; j++) {
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < allPoints.shape[0]; i++) {
        const v = allPoints.get([i, j]) as number;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      mins.push(mn);
      maxs.push(mx);
      mids.push((mn + mx) / 2);
    }
    return np.array([mins, mids, maxs]);
  }

  refreshBoundingBox(recurseDown = false, recurseUp = true): this {
    for (const mob of this.getFamily(recurseDown)) {
      mob.needsNewBoundingBox = true;
    }
    if (recurseUp) {
      for (const parent of this.parents) {
        parent.refreshBoundingBox();
      }
    }
    return this;
  }

  isPointTouching(point: Point3D, buff: number = MED_SMALL_BUFF): boolean {
    const bb = this.getBoundingBox();
    for (let j = 0; j < this.dim; j++) {
      const v = point.get([j]) as number;
      if (v < (bb.get([0, j]) as number) - buff) return false;
      if (v > (bb.get([2, j]) as number) + buff) return false;
    }
    return true;
  }

  // ── Submobject hierarchy ──

  get submobjects(): OpenGLMobject[] {
    return this._submobjects;
  }

  set submobjects(value: OpenGLMobject[]) {
    this.remove(...this._submobjects);
    this.add(...value);
  }

  add(...mobjects: OpenGLMobject[]): this {
    this._assertValidSubmobjects(mobjects);
    for (const mob of mobjects) {
      if (!this._submobjects.includes(mob)) {
        this._submobjects.push(mob);
        mob.parents.push(this);
        mob.parent = this;
      }
    }
    this.assembleFamily();
    return this;
  }

  insert(index: number, mobject: OpenGLMobject): this {
    this._assertValidSubmobjects([mobject]);
    this._submobjects.splice(index, 0, mobject);
    mobject.parents.push(this);
    mobject.parent = this;
    this.assembleFamily();
    return this;
  }

  remove(...mobjects: OpenGLMobject[]): this {
    for (const mob of mobjects) {
      const idx = this._submobjects.indexOf(mob);
      if (idx !== -1) {
        this._submobjects.splice(idx, 1);
        mob.parents = mob.parents.filter((p) => p !== this);
        if (mob.parent === this) {
          mob.parent = null;
        }
      }
    }
    this.assembleFamily();
    return this;
  }

  addToBack(...mobjects: OpenGLMobject[]): this {
    this._assertValidSubmobjects(mobjects);
    this.remove(...mobjects);
    this._submobjects = [...mobjects, ...this._submobjects];
    for (const mob of mobjects) {
      mob.parents.push(this);
      mob.parent = this;
    }
    this.assembleFamily();
    return this;
  }

  replaceSubmobject(index: number, newSubmob: OpenGLMobject): this {
    const old = this._submobjects[index];
    if (old) {
      old.parents = old.parents.filter((p) => p !== this);
    }
    this._submobjects[index] = newSubmob;
    newSubmob.parents.push(this);
    newSubmob.parent = this;
    this.assembleFamily();
    return this;
  }

  // ── Family ──

  getFamily(recurse = true): OpenGLMobject[] {
    if (recurse) {
      return this.family;
    }
    return [this];
  }

  assembleFamily(): this {
    const subFamilies: OpenGLMobject[] = [this];
    for (const sm of this._submobjects) {
      subFamilies.push(...sm.getFamily());
    }
    this.family = [...new Set(subFamilies)];
    for (const parent of this.parents) {
      parent.assembleFamily();
    }
    return this;
  }

  familyMembersWithPoints(): OpenGLMobject[] {
    return this.getFamily().filter((m) => m.hasPoints());
  }

  split(): OpenGLMobject[] {
    return [...this._submobjects];
  }

  getGroupClass(): typeof OpenGLGroup {
    return OpenGLGroup;
  }

  static getMobjectTypeClass(): typeof OpenGLMobject {
    return OpenGLMobject;
  }

  // ── Iterators ──

  [Symbol.iterator](): Iterator<OpenGLMobject> {
    return this.split()[Symbol.iterator]();
  }

  // ── Updaters ──

  update(dt = 0, recurse = true): this {
    if (this._updatingSuspended) return this;

    for (const updater of this._updaters) {
      if (updater.length >= 2) {
        (updater as TimeBasedUpdater)(this, dt);
      } else {
        (updater as NonTimeBasedUpdater)(this);
      }
    }
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.update(dt, recurse);
      }
    }
    return this;
  }

  getTimeBasedUpdaters(): TimeBasedUpdater[] {
    return this._updaters.filter((u) => u.length >= 2) as TimeBasedUpdater[];
  }

  hasTimeBasedUpdater(): boolean {
    return this._hasTimeBasedUpdater;
  }

  getUpdaters(): OpenGLUpdater[] {
    return [...this._updaters];
  }

  getFamilyUpdaters(): OpenGLUpdater[] {
    const updaters: OpenGLUpdater[] = [];
    for (const mob of this.getFamily()) {
      updaters.push(...mob.getUpdaters());
    }
    return updaters;
  }

  addUpdater(
    updateFunction: OpenGLUpdater,
    index?: number,
    callUpdater = true,
  ): this {
    if (index !== undefined) {
      this._updaters.splice(index, 0, updateFunction);
    } else {
      this._updaters.push(updateFunction);
    }
    this.refreshHasUpdaterStatus();
    if (callUpdater) {
      this.update(0);
    }
    return this;
  }

  removeUpdater(updateFunction: OpenGLUpdater): this {
    const idx = this._updaters.indexOf(updateFunction);
    if (idx !== -1) {
      this._updaters.splice(idx, 1);
    }
    this.refreshHasUpdaterStatus();
    return this;
  }

  clearUpdaters(recurse = true): this {
    this._updaters = [];
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.clearUpdaters();
      }
    }
    this.refreshHasUpdaterStatus();
    return this;
  }

  matchUpdaters(mobject: OpenGLMobject): this {
    this.clearUpdaters();
    for (const updater of mobject.getUpdaters()) {
      this.addUpdater(updater);
    }
    return this;
  }

  suspendUpdating(recurse = true): this {
    this._updatingSuspended = true;
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.suspendUpdating(recurse);
      }
    }
    return this;
  }

  resumeUpdating(recurse = true, callUpdater = true): this {
    this._updatingSuspended = false;
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.resumeUpdating(recurse, callUpdater);
      }
    }
    if (callUpdater) {
      for (const parent of this.parents) {
        parent.update(0, false);
      }
    }
    return this;
  }

  refreshHasUpdaterStatus(): this {
    this._hasTimeBasedUpdater = this._updaters.some((u) => u.length >= 2);
    return this;
  }

  // ── Transformations ──

  shift(vector: Point3D): this {
    this.applyPointsFunction(
      (points: NDArray) => points.add(vector),
      undefined,
      null,
      true,
    );
    return this;
  }

  scale(
    scaleFactor: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    const { aboutPoint, aboutEdge } = options;
    this.applyPointsFunction(
      (points: NDArray) => points.multiply(scaleFactor),
      aboutPoint ?? null,
      aboutEdge ?? (aboutPoint != null ? null : ORIGIN),
    );
    return this;
  }

  stretch(factor: number, dim: number, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    const func = (points: NDArray): NDArray => {
      const result = points.copy();
      for (let i = 0; i < result.shape[0]; i++) {
        result.set([i, dim], (result.get([i, dim]) as number) * factor);
      }
      return result;
    };
    this.applyPointsFunction(
      func,
      options.aboutPoint ?? null,
      options.aboutEdge ?? (options.aboutPoint != null ? null : ORIGIN),
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
    const rotMat = rotationMatrix(angle, axis);
    this.applyPointsFunction(
      (points: NDArray) => {
        // Apply rotation matrix to each point
        const result = np.zeros([...points.shape]);
        for (let i = 0; i < points.shape[0]; i++) {
          for (let j = 0; j < points.shape[1]; j++) {
            let val = 0;
            for (let k = 0; k < points.shape[1]; k++) {
              val += (rotMat.get([j, k]) as number) * (points.get([i, k]) as number);
            }
            result.set([i, j], val);
          }
        }
        return result;
      },
      options.aboutPoint ?? null,
      options.aboutEdge ?? null,
    );
    return this;
  }

  flip(axis: Point3D = UP, options: { aboutPoint?: Point3D } = {}): this {
    return this.rotate(PI, axis, options);
  }

  applyFunction(fn: MappingFunction, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    const multiFunc: MultiMappingFunction = (points: NDArray): NDArray => {
      const rows: number[][] = [];
      for (let i = 0; i < points.shape[0]; i++) {
        const row: number[] = [];
        for (let j = 0; j < points.shape[1]; j++) {
          row.push(points.get([i, j]) as number);
        }
        const result = fn(np.array(row));
        const resultArr: number[] = [];
        for (let j = 0; j < result.shape[0]; j++) {
          resultArr.push(result.get([j]) as number);
        }
        rows.push(resultArr);
      }
      return np.array(rows);
    };
    this.applyPointsFunction(
      multiFunc,
      options.aboutPoint ?? null,
      options.aboutEdge ?? null,
    );
    return this;
  }

  applyFunctionToPosition(fn: MappingFunction): this {
    this.moveTo(fn(this.getCenter()));
    return this;
  }

  applyFunctionToSubmobjectPositions(fn: MappingFunction): this {
    for (const submob of this._submobjects) {
      submob.applyFunctionToPosition(fn);
    }
    return this;
  }

  applyMatrix(matrix: NDArray, options: { aboutPoint?: Point3D } = {}): this {
    const func = (points: NDArray): NDArray => {
      // matrix @ points.T → .T
      const result = np.zeros([...points.shape]);
      const m = matrix.shape[0];
      for (let i = 0; i < points.shape[0]; i++) {
        for (let j = 0; j < m; j++) {
          let val = 0;
          for (let k = 0; k < points.shape[1]; k++) {
            val += (matrix.get([j, k]) as number) * (points.get([i, k]) as number);
          }
          result.set([i, j], val);
        }
      }
      return result;
    };
    this.applyPointsFunction(func, options.aboutPoint ?? null, null);
    return this;
  }

  applyComplexFunction(fn: (z: { re: number; im: number }) => { re: number; im: number }, options: { aboutPoint?: Point3D } = {}): this {
    const mappingFunc = (point: Point3D): Point3D => {
      const x = point.get([0]) as number;
      const y = point.get([1]) as number;
      const z = point.get([2]) as number;
      const result = fn({ re: x, im: y });
      return np.array([result.re, result.im, z]);
    };
    return this.applyFunction(mappingFunc, options);
  }

  hierarchicalModelMatrix(): NDArray {
    if (this.parent == null) {
      return this.modelMatrix;
    }
    // Chain parent model matrices
    const matrices: NDArray[] = [this.modelMatrix];
    let current: OpenGLMobject | null = this.parent;
    while (current != null) {
      matrices.push(current.modelMatrix);
      current = current.parent;
    }
    matrices.reverse();
    // Multiply matrices in order
    let result = matrices[0];
    for (let i = 1; i < matrices.length; i++) {
      const a = result;
      const b = matrices[i];
      const rows = a.shape[0];
      const cols = b.shape[1];
      const inner = a.shape[1];
      const out = np.zeros([rows, cols]);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let sum = 0;
          for (let k = 0; k < inner; k++) {
            sum += (a.get([r, k]) as number) * (b.get([k, c]) as number);
          }
          out.set([r, c], sum);
        }
      }
      result = out;
    }
    return result;
  }

  wag(
    direction: Point3D = RIGHT,
    axis: Point3D = DOWN,
    wagFactor = 1.0,
  ): this {
    for (const mob of this.getFamily()) {
      const alphas = np.zeros([mob.getNumPoints()]);
      const center = mob.getCenter();
      for (let i = 0; i < mob.getNumPoints(); i++) {
        const pt = mob.points.get([i]) as unknown as number[];
        const projOnAxis = np.dot(
          np.array([pt[0] - (center.get([0]) as number), pt[1] - (center.get([1]) as number), pt[2] - (center.get([2]) as number)]),
          axis,
        ) as number;
        alphas.set([i], projOnAxis);
      }

      // Normalize
      const maxAlpha = Math.max(
        ...Array.from({ length: alphas.shape[0] }, (_, i) => Math.abs(alphas.get([i]) as number)),
        1e-10,
      );

      for (let i = 0; i < mob.getNumPoints(); i++) {
        const a = (alphas.get([i]) as number) / maxAlpha;
        const nudge = direction.multiply(wagFactor * a);
        for (let j = 0; j < this.dim; j++) {
          mob.points.set(
            [i, j],
            (mob.points.get([i, j]) as number) + (nudge.get([j]) as number),
          );
        }
      }
    }
    return this;
  }

  // ── Positioning ──

  center(): this {
    this.shift(this.getCenter().multiply(-1));
    return this;
  }

  alignOnBorder(direction: Point3D, buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER): this {
    const targetPoint = np.array([
      direction.get([0]) as number === 0 ? 0 : Math.sign(direction.get([0]) as number) * (7.111 - buff),
      direction.get([1]) as number === 0 ? 0 : Math.sign(direction.get([1]) as number) * (4.0 - buff),
      0,
    ]);

    const pointToAlign = this.getBoundingBoxPoint(direction);
    const shiftVal = targetPoint.subtract(pointToAlign);
    this.shift(shiftVal);
    return this;
  }

  toCorner(corner: Point3D = LEFT.add(DOWN), buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER): this {
    return this.alignOnBorder(corner, buff);
  }

  toEdge(edge: Point3D = LEFT, buff: number = DEFAULT_MOBJECT_TO_EDGE_BUFFER): this {
    return this.alignOnBorder(edge, buff);
  }

  nextTo(
    mobjectOrPoint: OpenGLMobject | Point3D,
    direction: Point3D = RIGHT,
    options: {
      buff?: number;
      alignedEdge?: Point3D;
      submobjectToAlign?: OpenGLMobject;
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
    if (mobjectOrPoint instanceof OpenGLMobject) {
      const mob = mobjectOrPoint;
      targetPoint = mob.getBoundingBoxPoint(
        direction.add(alignedEdge),
      );
    } else {
      targetPoint = mobjectOrPoint;
    }

    let pointToAlign: Point3D;
    if (submobjectToAlign !== undefined) {
      pointToAlign = submobjectToAlign.getBoundingBoxPoint(
        direction.multiply(-1).add(alignedEdge),
      );
    } else if (indexOfSubmobjectToAlign !== undefined) {
      pointToAlign = this._submobjects[indexOfSubmobjectToAlign].getBoundingBoxPoint(
        direction.multiply(-1).add(alignedEdge),
      );
    } else {
      pointToAlign = this.getBoundingBoxPoint(
        direction.multiply(-1).add(alignedEdge),
      );
    }

    const shiftVal = targetPoint
      .subtract(pointToAlign)
      .add(direction.multiply(buff));

    // Apply coordinate mask
    const maskedShift = shiftVal.multiply(coorMask);
    this.shift(maskedShift);
    return this;
  }

  shiftOntoScreen(
    options: { buff?: number } = {},
  ): this {
    const { buff = DEFAULT_MOBJECT_TO_EDGE_BUFFER } = options;
    const spaceLengths = [7.111, 4.0]; // half frame width/height
    for (let dim = 0; dim < 2; dim++) {
      const bb = this.getBoundingBox();
      const minVal = bb.get([0, dim]) as number;
      const maxVal = bb.get([2, dim]) as number;
      if (minVal < -spaceLengths[dim] + buff) {
        const shift = np.zeros([3]);
        shift.set([dim], -spaceLengths[dim] + buff - minVal);
        this.shift(shift);
      }
      if (maxVal > spaceLengths[dim] - buff) {
        const shift = np.zeros([3]);
        shift.set([dim], spaceLengths[dim] - buff - maxVal);
        this.shift(shift);
      }
    }
    return this;
  }

  isOffScreen(): boolean {
    const bb = this.getBoundingBox();
    return (
      (bb.get([2, 0]) as number) < -7.111 ||
      (bb.get([0, 0]) as number) > 7.111 ||
      (bb.get([2, 1]) as number) < -4.0 ||
      (bb.get([0, 1]) as number) > 4.0
    );
  }

  stretchAboutPoint(factor: number, dim: number, point: Point3D): this {
    return this.stretch(factor, dim, { aboutPoint: point });
  }

  rescaleToFit(length: number, dim: number, stretch = false, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    const oldLength = this.lengthOverDim(dim);
    if (oldLength === 0) return this;
    if (stretch) {
      this.stretch(length / oldLength, dim, options);
    } else {
      this.scale(length / oldLength, options);
    }
    return this;
  }

  stretchToFitWidth(width: number, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(width, 0, true, options);
  }

  stretchToFitHeight(height: number, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(height, 1, true, options);
  }

  stretchToFitDepth(depth: number, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(depth, 2, true, options);
  }

  setWidth(width: number, stretch = false, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(width, 0, stretch, options);
  }

  setHeight(height: number, stretch = false, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(height, 1, stretch, options);
  }

  setDepth(depth: number, stretch = false, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(depth, 2, stretch, options);
  }

  setCoord(value: number, dim: number, direction?: Point3D): this {
    const curr = this.getCoord(dim, direction);
    const shift = np.zeros([3]);
    shift.set([dim], value - curr);
    this.shift(shift);
    return this;
  }

  setX(x: number, direction?: Point3D): this {
    return this.setCoord(x, 0, direction);
  }

  setY(y: number, direction?: Point3D): this {
    return this.setCoord(y, 1, direction);
  }

  setZ(z: number, direction?: Point3D): this {
    return this.setCoord(z, 2, direction);
  }

  spaceOutSubmobjects(factor = 1.5, options: { aboutEdge?: Point3D; aboutPoint?: Point3D } = {}): this {
    this.scale(factor, options);
    for (const submob of this._submobjects) {
      submob.scale(1 / factor);
    }
    return this;
  }

  moveTo(pointOrMobject: Point3D | OpenGLMobject, alignedEdge: Point3D = ORIGIN, coorMask: Point3D = np.array([1, 1, 1])): this {
    let targetPoint: Point3D;
    if (pointOrMobject instanceof OpenGLMobject) {
      targetPoint = pointOrMobject.getBoundingBoxPoint(alignedEdge);
    } else {
      targetPoint = pointOrMobject;
    }
    const pointToAlign = this.getBoundingBoxPoint(alignedEdge);
    const shiftVal = targetPoint.subtract(pointToAlign).multiply(coorMask);
    this.shift(shiftVal);
    return this;
  }

  replace(mobject: OpenGLMobject, dimToMatch = 0, stretch = false): this {
    if (!mobject.hasPoints() && mobject._submobjects.length === 0) {
      throw new Error(
        "Attempting to replace mobject with no points and no submobjects.",
      );
    }
    if (stretch) {
      for (let dim = 0; dim < this.dim; dim++) {
        this.rescaleToFit(
          mobject.lengthOverDim(dim),
          dim,
          true,
        );
      }
    } else {
      this.rescaleToFit(
        mobject.lengthOverDim(dimToMatch),
        dimToMatch,
        false,
      );
    }
    this.shift(mobject.getCenter().subtract(this.getCenter()));
    return this;
  }

  surround(
    mobject: OpenGLMobject,
    dimToMatch = 0,
    stretch = false,
    buff: number = MED_SMALL_BUFF,
  ): this {
    this.replace(mobject, dimToMatch, stretch);
    const lengths: number[] = [];
    for (let dim = 0; dim < this.dim; dim++) {
      lengths.push(mobject.lengthOverDim(dim));
    }
    const length = lengths[dimToMatch] + 2 * buff;
    this.setWidth(length);
    return this;
  }

  putStartAndEndOn(start: Point3D, end: Point3D): this {
    const currStart = this.getStart();
    const currEnd = this.getEnd();
    const currVect = currEnd.subtract(currStart);
    const targetVect = end.subtract(start);
    const currNorm = np.linalg.norm(currVect) as number;
    const targetNorm = np.linalg.norm(targetVect) as number;
    if (currNorm === 0 || targetNorm === 0) return this;
    this.scale(targetNorm / currNorm, { aboutPoint: currStart });

    const angle = Math.atan2(
      targetVect.get([1]) as number,
      targetVect.get([0]) as number,
    ) - Math.atan2(
      currVect.get([1]) as number,
      currVect.get([0]) as number,
    );
    this.rotate(angle, OUT, { aboutPoint: currStart });
    this.shift(start.subtract(this.getStart()));
    return this;
  }

  // ── Color ──

  setRgbaArray(
    color?: ParsableManimColor | ParsableManimColor[] | null,
    opacity?: number,
    name = "rgbas",
    recurse = true,
  ): this {
    if (color != null) {
      const colors = Array.isArray(color) ? color : [color];
      const rgbas: number[][] = colors.map((c) => {
        const rgb = colorToRgb(c);
        return [...rgb, opacity ?? 1.0];
      });
      this.data[name] = np.array(rgbas);
    }
    if (opacity != null && this.data[name]) {
      const arr = this.data[name];
      for (let i = 0; i < arr.shape[0]; i++) {
        arr.set([i, 3], opacity);
      }
    }
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.setRgbaArray(color, opacity, name, recurse);
      }
    }
    return this;
  }

  setRgbaArrayDirect(rgbas: NDArray, name = "rgbas", recurse = true): this {
    this.data[name] = rgbas;
    if (recurse) {
      for (const submob of this._submobjects) {
        submob.setRgbaArrayDirect(rgbas, name, recurse);
      }
    }
    return this;
  }

  setColor(
    color: ParsableManimColor | ParsableManimColor[],
    opacity?: number,
    recurse = true,
  ): this {
    this.setRgbaArray(color, opacity, "rgbas", recurse);
    const parsed = ManimColor.parse(color);
    this.color = parsed as ManimColor | ManimColor[];
    return this;
  }

  setOpacity(opacity: number, recurse = true): this {
    this.opacity = opacity;
    for (const mob of this.getFamily(recurse)) {
      const arr = mob.data["rgbas"];
      if (arr) {
        for (let i = 0; i < arr.shape[0]; i++) {
          arr.set([i, 3], opacity);
        }
      }
    }
    return this;
  }

  getColor(): string {
    const rgba = this.rgbas;
    if (rgba.shape[0] === 0) return "#ffffff";
    return rgbToHex([
      rgba.get([0, 0]) as number,
      rgba.get([0, 1]) as number,
      rgba.get([0, 2]) as number,
    ]);
  }

  getOpacity(): number {
    const rgba = this.rgbas;
    if (rgba.shape[0] === 0) return 1.0;
    return rgba.get([0, 3]) as number;
  }

  setColorByGradient(...colors: ParsableManimColor[]): this {
    const n = this.getNumPoints();
    if (n === 0) return this;
    const gradient = colorGradient(colors, n);
    const rgbas: number[][] = gradient.map((c: ManimColor) => {
      const rgb = colorToRgb(c);
      return [...rgb, this.getOpacity()];
    });
    this.data["rgbas"] = np.array(rgbas);
    return this;
  }

  setSubmobjectColorsByGradient(...colors: ParsableManimColor[]): this {
    if (this._submobjects.length === 0) return this;
    const gradient = colorGradient(colors, this._submobjects.length);
    for (let i = 0; i < this._submobjects.length; i++) {
      this._submobjects[i].setColor(gradient[i]);
    }
    return this;
  }

  fade(darkness = 0.5, recurse = true): this {
    this.setOpacity(1 - darkness, recurse);
    return this;
  }

  getGloss(): number {
    return this.gloss;
  }

  setGloss(gloss: number, recurse = true): this {
    for (const mob of this.getFamily(recurse)) {
      mob.gloss = gloss;
    }
    return this;
  }

  getShadow(): number {
    return this.shadow;
  }

  setShadow(shadow: number, recurse = true): this {
    for (const mob of this.getFamily(recurse)) {
      mob.shadow = shadow;
    }
    return this;
  }

  // ── Background Rectangle ──

  addBackgroundRectangle(
    color?: ParsableManimColor,
    opacity = 0.75,
  ): this {
    // TODO: Depends on BackgroundRectangle from geometry module
    // When available: const rect = new BackgroundRectangle(this, { color, opacity });
    // this.addToBack(rect);
    return this;
  }

  addBackgroundRectangleToSubmobjects(
    color?: ParsableManimColor,
    opacity = 0.75,
  ): this {
    for (const submob of this._submobjects) {
      submob.addBackgroundRectangle(color, opacity);
    }
    return this;
  }

  addBackgroundRectangleToFamilyMembersWithPoints(
    color?: ParsableManimColor,
    opacity = 0.75,
  ): this {
    for (const mob of this.familyMembersWithPoints()) {
      mob.addBackgroundRectangle(color, opacity);
    }
    return this;
  }

  // ── Getters ──

  getBoundingBoxPoint(direction: Point3D): Point3D {
    const bb = this.getBoundingBox();
    const indices: number[] = [];
    for (let j = 0; j < this.dim; j++) {
      const d = direction.get([j]) as number;
      if (d > 0) indices.push(2);
      else if (d < 0) indices.push(0);
      else indices.push(1);
    }
    const result: number[] = [];
    for (let j = 0; j < this.dim; j++) {
      result.push(bb.get([indices[j], j]) as number);
    }
    return np.array(result);
  }

  getEdgeCenter(direction: Point3D): Point3D {
    return this.getBoundingBoxPoint(direction);
  }

  getCorner(direction: Point3D): Point3D {
    return this.getBoundingBoxPoint(direction);
  }

  getCenter(): Point3D {
    return this.getBoundingBoxPoint(ORIGIN);
  }

  getCenterOfMass(): Point3D {
    if (this.getNumPoints() === 0) return ORIGIN;
    const pts = this.points;
    const sums: number[] = [0, 0, 0];
    for (let i = 0; i < pts.shape[0]; i++) {
      for (let j = 0; j < 3; j++) {
        sums[j] += pts.get([i, j]) as number;
      }
    }
    const n = pts.shape[0];
    return np.array([sums[0] / n, sums[1] / n, sums[2] / n]);
  }

  getBoundaryPoint(direction: Point3D): Point3D {
    return this.getBoundingBoxPoint(direction);
  }

  getContinuousBoundingBoxPoint(direction: Point3D): Point3D {
    const bb = this.getBoundingBox();
    const mins = bb.get([0]) as unknown as NDArray;
    const mids = bb.get([1]) as unknown as NDArray;
    const maxs = bb.get([2]) as unknown as NDArray;
    // This is a simplified version - the full implementation handles
    // arbitrary direction vectors
    return this.getBoundingBoxPoint(direction);
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
    const inDir = np.array([0, 0, -1]);
    return this.getEdgeCenter(inDir);
  }

  lengthOverDim(dim: number): number {
    const bb = this.getBoundingBox();
    return (bb.get([2, dim]) as number) - (bb.get([0, dim]) as number);
  }

  getWidth(): number {
    return this.lengthOverDim(0);
  }

  getHeight(): number {
    return this.lengthOverDim(1);
  }

  getDepth(): number {
    return this.lengthOverDim(2);
  }

  getCoord(dim: number, direction?: Point3D): number {
    const bb = this.getBoundingBox();
    if (direction == null) {
      return bb.get([1, dim]) as number; // midpoint
    }
    const d = direction.get([dim]) as number;
    if (d > 0) return bb.get([2, dim]) as number;
    if (d < 0) return bb.get([0, dim]) as number;
    return bb.get([1, dim]) as number;
  }

  getX(direction?: Point3D): number {
    return this.getCoord(0, direction);
  }

  getY(direction?: Point3D): number {
    return this.getCoord(1, direction);
  }

  getZ(direction?: Point3D): number {
    return this.getCoord(2, direction);
  }

  getStart(): Point3D {
    this.throwErrorIfNoPoints();
    const row: number[] = [];
    for (let j = 0; j < this.points.shape[1]; j++) {
      row.push(this.points.get([0, j]) as number);
    }
    return np.array(row);
  }

  getEnd(): Point3D {
    this.throwErrorIfNoPoints();
    const lastIdx = this.points.shape[0] - 1;
    const row: number[] = [];
    for (let j = 0; j < this.points.shape[1]; j++) {
      row.push(this.points.get([lastIdx, j]) as number);
    }
    return np.array(row);
  }

  getStartAndEnd(): [Point3D, Point3D] {
    return [this.getStart(), this.getEnd()];
  }

  pointFromProportion(alpha: number): Point3D {
    const pts = this.points;
    const n = pts.shape[0];
    if (n === 0) return ORIGIN;
    const idx = alpha * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.min(lower + 1, n - 1);
    const residue = idx - lower;

    const result: number[] = [];
    for (let j = 0; j < pts.shape[1]; j++) {
      const a = pts.get([lower, j]) as number;
      const b = pts.get([upper, j]) as number;
      result.push(interpolate(a, b, residue));
    }
    return np.array(result);
  }

  pfp(alpha: number): Point3D {
    return this.pointFromProportion(alpha);
  }

  getPieces(nPieces: number): OpenGLGroup {
    const template = this.copy();
    const group = new OpenGLGroup();
    for (let i = 0; i < nPieces; i++) {
      const piece = template.copy();
      piece.pointwiseBecomePartial(this, i / nPieces, (i + 1) / nPieces);
      group.add(piece);
    }
    return group;
  }

  getZIndexReferencePoint(): Point3D {
    return this.getCenter();
  }

  // ── Matching ──

  matchColor(mobject: OpenGLMobject): this {
    return this.setColor(mobject.getColor());
  }

  matchDimSize(mobject: OpenGLMobject, dim: number, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.rescaleToFit(mobject.lengthOverDim(dim), dim, false, options);
  }

  matchWidth(mobject: OpenGLMobject, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.matchDimSize(mobject, 0, options);
  }

  matchHeight(mobject: OpenGLMobject, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.matchDimSize(mobject, 1, options);
  }

  matchDepth(mobject: OpenGLMobject, options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {}): this {
    return this.matchDimSize(mobject, 2, options);
  }

  matchCoord(mobject: OpenGLMobject, dim: number, direction?: Point3D): this {
    return this.setCoord(mobject.getCoord(dim, direction), dim, direction);
  }

  matchX(mobject: OpenGLMobject, direction?: Point3D): this {
    return this.matchCoord(mobject, 0, direction);
  }

  matchY(mobject: OpenGLMobject, direction?: Point3D): this {
    return this.matchCoord(mobject, 1, direction);
  }

  matchZ(mobject: OpenGLMobject, direction?: Point3D): this {
    return this.matchCoord(mobject, 2, direction);
  }

  alignTo(mobjectOrPoint: OpenGLMobject | Point3D, direction: Point3D): this {
    if (mobjectOrPoint instanceof OpenGLMobject) {
      const point = mobjectOrPoint.getBoundingBoxPoint(direction);
      return this.alignTo(point, direction);
    }
    const bb = this.getBoundingBoxPoint(direction);
    const shift = mobjectOrPoint.subtract(bb);
    this.shift(shift);
    return this;
  }

  // ── Arrangement ──

  arrange(
    direction: Point3D = RIGHT,
    center = true,
    options: { buff?: number; alignedEdge?: Point3D } = {},
  ): this {
    const { buff = DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, alignedEdge = ORIGIN } = options;
    for (let i = 1; i < this._submobjects.length; i++) {
      this._submobjects[i].nextTo(
        this._submobjects[i - 1],
        direction,
        { buff, alignedEdge },
      );
    }
    if (center) {
      this.center();
    }
    return this;
  }

  arrangeInGrid(
    options: {
      rows?: number;
      cols?: number;
      buff?: number | [number, number];
      cellAlignment?: Point3D;
      rowAlignments?: string;
      colAlignments?: string;
      rowHeights?: (number | null)[];
      colWidths?: (number | null)[];
      flowOrder?: string;
    } = {},
  ): this {
    const {
      buff = MED_SMALL_BUFF,
      cellAlignment = ORIGIN,
      rowAlignments,
      colAlignments,
      rowHeights,
      colWidths,
      flowOrder = "rd",
    } = options;
    let { rows, cols } = options;

    const mobs = this._submobjects;
    const n = mobs.length;
    if (n === 0) return this;

    if (rows == null && cols == null) {
      rows = Math.ceil(Math.sqrt(n));
    }
    if (rows != null && cols == null) {
      cols = Math.ceil(n / rows);
    } else if (cols != null && rows == null) {
      rows = Math.ceil(n / cols);
    }
    const nRows = rows!;
    const nCols = cols!;

    const hBuff = typeof buff === "number" ? buff : buff[0];
    const vBuff = typeof buff === "number" ? buff : buff[1];

    // Create grid assignment based on flow order
    const grid: (OpenGLMobject | null)[][] = Array.from({ length: nRows }, () =>
      Array.from({ length: nCols }, () => null),
    );

    let idx = 0;
    if (flowOrder === "rd" || flowOrder === "right-down") {
      for (let r = 0; r < nRows && idx < n; r++) {
        for (let c = 0; c < nCols && idx < n; c++) {
          grid[r][c] = mobs[idx++];
        }
      }
    } else if (flowOrder === "dr" || flowOrder === "down-right") {
      for (let c = 0; c < nCols && idx < n; c++) {
        for (let r = 0; r < nRows && idx < n; r++) {
          grid[r][c] = mobs[idx++];
        }
      }
    } else {
      // Default to right-down
      for (let r = 0; r < nRows && idx < n; r++) {
        for (let c = 0; c < nCols && idx < n; c++) {
          grid[r][c] = mobs[idx++];
        }
      }
    }

    // Compute row heights and col widths
    const actualRowHeights: number[] = [];
    for (let r = 0; r < nRows; r++) {
      if (rowHeights && rowHeights[r] != null) {
        actualRowHeights.push(rowHeights[r]!);
      } else {
        let maxH = 0;
        for (let c = 0; c < nCols; c++) {
          const mob = grid[r][c];
          if (mob) maxH = Math.max(maxH, mob.getHeight());
        }
        actualRowHeights.push(maxH);
      }
    }

    const actualColWidths: number[] = [];
    for (let c = 0; c < nCols; c++) {
      if (colWidths && colWidths[c] != null) {
        actualColWidths.push(colWidths[c]!);
      } else {
        let maxW = 0;
        for (let r = 0; r < nRows; r++) {
          const mob = grid[r][c];
          if (mob) maxW = Math.max(maxW, mob.getWidth());
        }
        actualColWidths.push(maxW);
      }
    }

    // Place mobjects
    let y = 0;
    for (let r = 0; r < nRows; r++) {
      let x = 0;
      for (let c = 0; c < nCols; c++) {
        const mob = grid[r][c];
        if (mob) {
          const cellCenter = np.array([
            x + actualColWidths[c] / 2,
            -y - actualRowHeights[r] / 2,
            0,
          ]);
          mob.moveTo(cellCenter, cellAlignment);
        }
        x += actualColWidths[c] + hBuff;
      }
      y += actualRowHeights[r] + vBuff;
    }

    // Center the grid
    this.center();
    return this;
  }

  getGrid(nRows: number, nCols: number, height?: number): OpenGLGroup {
    const group = new OpenGLGroup();
    for (let i = 0; i < nRows * nCols; i++) {
      group.add(this.copy());
    }
    group.arrangeInGrid({ rows: nRows, cols: nCols });
    if (height != null) {
      group.setHeight(height);
    }
    return group;
  }

  sort(
    pointToNumFunc: (point: Point3D) => number = (p: Point3D) => p.get([0]) as number,
    submobFunc?: (mob: OpenGLMobject) => number,
  ): this {
    const func = submobFunc ?? ((mob: OpenGLMobject) => pointToNumFunc(mob.getCenter()));
    this._submobjects.sort((a, b) => func(a) - func(b));
    return this;
  }

  shuffle(recurse = false): this {
    const arr = this._submobjects;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (recurse) {
      for (const submob of arr) {
        submob.shuffle(true);
      }
    }
    return this;
  }

  invert(recursive = false): this {
    this._submobjects.reverse();
    if (recursive) {
      for (const submob of this._submobjects) {
        submob.invert(true);
      }
    }
    return this;
  }

  // ── Copy ──

  copy(): this {
    return cloneMobject(this);
  }

  deepcopy(): this {
    return cloneMobject(this);
  }

  generateTarget(useDeepCopy = false): OpenGLMobject {
    this.target = null;
    this.target = this.copy();
    return this.target;
  }

  saveState(useDeepCopy = false): this {
    this.savedState = this.copy();
    return this;
  }

  restore(): this {
    if (this.savedState == null) {
      throw new Error("Trying to restore mobject that was not saved.");
    }
    this.become(this.savedState);
    return this;
  }

  // ── Interpolation ──

  interpolateMobject(
    mobject1: OpenGLMobject,
    mobject2: OpenGLMobject,
    alpha: number,
    pathFunc: PathFuncType = straightPath(),
  ): this {
    for (const key of Object.keys(this.data)) {
      if (this.lockedDataKeys.has(key)) continue;
      const a = mobject1.data[key];
      const b = mobject2.data[key];
      if (a && b && a.shape[0] > 0 && b.shape[0] > 0) {
        this.data[key] = pathFunc(a, b, alpha);
      }
    }
    for (const key of Object.keys(this.uniforms)) {
      const a = mobject1.uniforms[key];
      const b = mobject2.uniforms[key];
      if (typeof a === "number" && typeof b === "number") {
        this.uniforms[key] = interpolate(a, b, alpha);
      }
    }
    return this;
  }

  pointwiseBecomePartial(mobject: OpenGLMobject, a: number, b: number): this {
    // Override in subclasses for more specific behavior
    const n = mobject.getNumPoints();
    const lower = Math.floor(a * n);
    const upper = Math.ceil(b * n);
    for (const key of Object.keys(this.data)) {
      this.data[key] = mobject.data[key]
        ? (() => {
            const src = mobject.data[key];
            if (src.shape[0] > 0) {
              const rows: number[][] = [];
              for (let i = lower; i < Math.min(upper, src.shape[0]); i++) {
                const row: number[] = [];
                for (let j = 0; j < src.shape[1]; j++) {
                  row.push(src.get([i, j]) as number);
                }
                rows.push(row);
              }
              return rows.length > 0 ? np.array(rows) : np.zeros([0, src.shape[1]]);
            }
            return src;
          })()
        : this.data[key];
    }
    return this;
  }

  become(
    mobject: OpenGLMobject,
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

    for (const key of Object.keys(mobject.data)) {
      if (this.lockedDataKeys.has(key)) continue;
      if (mobject.data[key]) {
        this.data[key] = mobject.data[key].copy();
      }
    }
    for (const key of Object.keys(mobject.uniforms)) {
      this.uniforms[key] = mobject.uniforms[key];
    }

    // Align submobject count
    while (this._submobjects.length > mobject._submobjects.length) {
      this.remove(this._submobjects[this._submobjects.length - 1]);
    }
    while (this._submobjects.length < mobject._submobjects.length) {
      const placeholder = new (this.constructor as typeof OpenGLMobject)();
      this.add(placeholder);
    }
    for (let i = 0; i < this._submobjects.length; i++) {
      this._submobjects[i].become(mobject._submobjects[i]);
    }

    if (matchHeight) this.matchHeight(mobject);
    if (matchWidth) this.matchWidth(mobject);
    if (matchDepth) this.matchDepth(mobject);
    if (matchCenter) this.moveTo(mobject.getCenter());

    return this;
  }

  // ── Alignment ──

  alignData(mobject: OpenGLMobject): this {
    this.alignPoints(mobject);
    return this;
  }

  alignPoints(mobject: OpenGLMobject): this {
    const count1 = this.getNumPoints();
    const count2 = mobject.getNumPoints();
    if (count1 < count2) {
      this.resizePoints(count2);
    } else if (count2 < count1) {
      mobject.resizePoints(count1);
    }
    return this;
  }

  alignFamily(mobject: OpenGLMobject): this {
    const mob1 = this.getFamily();
    const mob2 = mobject.getFamily();
    const maxLen = Math.max(mob1.length, mob2.length);
    if (mob1.length < maxLen) {
      this.addNMoreSubmobjects(maxLen - mob1.length);
    }
    if (mob2.length < maxLen) {
      mobject.addNMoreSubmobjects(maxLen - mob2.length);
    }
    return this;
  }

  alignDataAndFamily(mobject: OpenGLMobject): this {
    this.alignFamily(mobject);
    const family1 = this.getFamily();
    const family2 = mobject.getFamily();
    for (let i = 0; i < family1.length; i++) {
      family1[i].alignData(family2[i]);
    }
    return this;
  }

  pushSelfIntoSubmobjects(): this {
    const copy = this.copy();
    copy._submobjects = [];
    this.resizePoints(0);
    this.add(copy);
    return this;
  }

  addNMoreSubmobjects(n: number): this {
    if (this._submobjects.length === 0) {
      this.pushSelfIntoSubmobjects();
      n -= 1;
    }
    const curr = this._submobjects.length;
    const target = curr + n;
    for (let i = curr; i < target; i++) {
      const refIdx = i % curr;
      const submobCopy = this._submobjects[refIdx].copy();
      submobCopy.fade(1);
      submobCopy.clearPoints();
      this.add(submobCopy);
    }
    return this;
  }

  // ── Data Locking ──

  lockData(keys: string[]): void {
    for (const key of keys) {
      this.lockedDataKeys.add(key);
    }
  }

  lockMatchingData(mobject1: OpenGLMobject, mobject2: OpenGLMobject): this {
    for (const key of Object.keys(mobject1.data)) {
      const a = mobject1.data[key];
      const b = mobject2.data[key];
      if (a && b && a.shape[0] === b.shape[0]) {
        let match = true;
        for (let i = 0; i < a.shape[0] && match; i++) {
          for (let j = 0; j < a.shape[1] && match; j++) {
            if (a.get([i, j]) !== b.get([i, j])) {
              match = false;
            }
          }
        }
        if (match) {
          this.lockedDataKeys.add(key);
        }
      }
    }
    return this;
  }

  unlockData(): void {
    this.lockedDataKeys.clear();
  }

  // ── Frame ──

  fixInFrame(): this {
    this.uniforms["is_fixed_in_frame"] = 1.0;
    for (const mob of this._submobjects) {
      mob.fixInFrame();
    }
    return this;
  }

  fixOrientation(): this {
    this.uniforms["is_fixed_orientation"] = 1.0;
    const c = this.getCenter();
    this.uniforms["fixed_orientation_center"] = [
      c.get([0]) as number,
      c.get([1]) as number,
      c.get([2]) as number,
    ];
    for (const mob of this._submobjects) {
      mob.fixOrientation();
    }
    return this;
  }

  unfixFromFrame(): this {
    this.uniforms["is_fixed_in_frame"] = 0.0;
    for (const mob of this._submobjects) {
      mob.unfixFromFrame();
    }
    return this;
  }

  unfixOrientation(): this {
    this.uniforms["is_fixed_orientation"] = 0.0;
    for (const mob of this._submobjects) {
      mob.unfixOrientation();
    }
    return this;
  }

  applyDepthTest(): this {
    this.depthTest = true;
    for (const mob of this._submobjects) {
      mob.applyDepthTest();
    }
    return this;
  }

  deactivateDepthTest(): this {
    this.depthTest = false;
    for (const mob of this._submobjects) {
      mob.deactivateDepthTest();
    }
    return this;
  }

  // ── Shader code manipulation ──

  replaceShaderCode(oldCode: string, newCode: string): this {
    for (const mob of this.getFamily()) {
      const wrapper = mob.getShaderWrapper();
      if (wrapper) {
        // TODO: Port from OpenGL — needs shader wrapper code replacement
      }
    }
    return this;
  }

  setColorByCode(glslCode: string): this {
    // Inserts GLSL code with access to vec4 color, vec3 point, vec3 unit_normal
    this.replaceShaderCode(
      "///// INSERT COLOR FUNCTION HERE /////",
      glslCode,
    );
    return this;
  }

  setColorByXyzFunc(
    glslSnippet: string,
    minValue = -5.0,
    maxValue = 5.0,
    colormap = "viridis",
  ): this {
    const code = [
      `float x = point.x;`,
      `float y = point.y;`,
      `float z = point.z;`,
      `float value = ${glslSnippet};`,
      `float t = (value - ${minValue.toFixed(1)}) / ${(maxValue - minValue).toFixed(1)};`,
      `t = clamp(t, 0.0, 1.0);`,
      `color.rgb = colormap(t);`,
    ].join("\n");
    this.setColorByCode(code);
    return this;
  }

  // ── Shader (stubs) ──

  refreshShaderWrapperId(): this {
    // TODO: Port from OpenGL — needs shader wrapper ID refresh
    return this;
  }

  getShaderWrapper(): ShaderWrapper | null {
    // TODO: Port from OpenGL — needs full shader wrapper
    return this._shaderWrapper;
  }

  getShaderWrapperList(): ShaderWrapper[] {
    // TODO: Port from OpenGL — needs full shader wrapper list
    const result: ShaderWrapper[] = [];
    const wrapper = this.getShaderWrapper();
    if (wrapper) result.push(wrapper);
    for (const submob of this._submobjects) {
      result.push(...submob.getShaderWrapperList());
    }
    return result;
  }

  getShaderData(): NDArray {
    const n = this.getNumPoints();
    const data: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < 3; j++) {
        row.push(this.points.get([i, j]) as number);
      }
      data.push(row);
    }
    return data.length > 0 ? np.array(data) : np.zeros([0, 3]);
  }

  refreshShaderData(): void {
    // TODO: Port from OpenGL — needs shader data refresh
  }

  getShaderUniforms(): Record<string, number | readonly number[]> {
    return { ...this.uniforms };
  }

  getShaderVertIndices(): number[] | null {
    return this.shaderIndices;
  }

  checkDataAlignment(array: NDArray, dataKey: string): this {
    const data = this.data[dataKey];
    if (!data) return this;
    const dataLen = data.shape[0];
    const arrayLen = array.shape[0];
    if (dataLen !== 1 && dataLen !== arrayLen) {
      this.data[dataKey] = resizeWithInterpolation(data, arrayLen);
    }
    return this;
  }

  getResizedShaderDataArray(length: number): NDArray {
    // Returns a structured array with the shader dtype fields
    // For the base class, this is just point data (3 floats per vertex)
    return np.zeros([length, 3]);
  }

  readDataToShader(shaderData: NDArray, shaderKey: string, dataKey: string): void {
    const data = this.data[dataKey];
    if (!data || data.shape[0] === 0) return;
    // TODO: Port from OpenGL — needs proper shader data read
  }

  // ── Error ──

  throwErrorIfNoPoints(): void {
    if (!this.hasPoints()) {
      throw new Error(
        `${this.constructor.name} has no points. ` +
        "Call initPoints() or setPoints() first.",
      );
    }
  }

  // ── Duplicate / Grid ──

  duplicate(n: number): OpenGLGroup {
    const group = new OpenGLGroup();
    for (let i = 0; i < n; i++) {
      group.add(this.copy());
    }
    return group;
  }
}

// ─── OpenGLGroup ────────────────────────────────────────────

export class OpenGLGroup extends OpenGLMobject {
  constructor(...mobjects: OpenGLMobject[]) {
    super();
    this.add(...mobjects);
  }
}

// ─── OpenGLPoint ────────────────────────────────────────────

export interface OpenGLPointOptions extends OpenGLMobjectOptions {
  artificialWidth?: number;
  artificialHeight?: number;
}

export class OpenGLPoint extends OpenGLMobject {
  artificialWidth: number;
  artificialHeight: number;

  constructor(
    location: Point3D = ORIGIN,
    options: OpenGLPointOptions = {},
  ) {
    super(options);
    this.artificialWidth = options.artificialWidth ?? 1e-6;
    this.artificialHeight = options.artificialHeight ?? 1e-6;
    this.setLocation(location);
  }

  override initData(): void {
    super.initData();
    this.points = np.zeros([1, 3]);
  }

  override getWidth(): number {
    return this.artificialWidth;
  }

  override getHeight(): number {
    return this.artificialHeight;
  }

  getLocation(): Point3D {
    const row: number[] = [];
    for (let j = 0; j < this.points.shape[1]; j++) {
      row.push(this.points.get([0, j]) as number);
    }
    return np.array(row);
  }

  override getBoundingBoxPoint(_direction: Point3D): Point3D {
    return this.getLocation();
  }

  setLocation(point: Point3D): this {
    for (let j = 0; j < Math.min(this.points.shape[1], point.shape[0]); j++) {
      this.points.set([0, j], point.get([j]) as number);
    }
    return this;
  }
}

// ─── _AnimationBuilder ─────────────────────────────────────

export class _AnimationBuilder {
  private _mobject: OpenGLMobject;
  private _overriddenAnimation: (new (...args: unknown[]) => IAnimation) | null;
  private _animArgs: Record<string, unknown>;
  private _methods: Array<{ name: string; args: unknown[]; kwargs: Record<string, unknown> }>;
  private _isChaining: boolean;

  constructor(mobject: OpenGLMobject) {
    this._mobject = mobject;
    this._overriddenAnimation = null;
    this._animArgs = {};
    this._methods = [];
    this._isChaining = false;

    const handler: ProxyHandler<_AnimationBuilder> = {
      get: (target, prop) => {
        if (typeof prop === "string" && prop in target) {
          return (target as unknown as Record<string, unknown>)[prop];
        }
        if (
          typeof prop === "string" &&
          typeof (target._mobject as unknown as Record<string, Function>)[prop] === "function"
        ) {
          return (...args: unknown[]) => {
            target._methods.push({ name: prop, args, kwargs: {} });
            target._isChaining = true;
            return new Proxy(target, handler);
          };
        }
        return undefined;
      },
    };
    return new Proxy(this, handler);
  }

  build(): { mobject: OpenGLMobject; targetMobject: OpenGLMobject; methods: Array<{ name: string; args: unknown[] }> } {
    const targetMobject = this._mobject.copy();
    for (const { name, args } of this._methods) {
      const method = (targetMobject as unknown as Record<string, Function>)[name];
      if (typeof method === "function") {
        method.apply(targetMobject, args);
      }
    }
    return {
      mobject: this._mobject,
      targetMobject,
      methods: this._methods,
    };
  }
}

// ─── Decorator for animation override ──────────────────────

/**
 * Decorator for overriding animation behavior when using `.animate`.
 * The decorated method should accept the mobject and anim_args, and return an Animation.
 *
 * Usage:
 * ```
 * class MyMobject extends OpenGLMobject {
 *   @overrideAnimate
 *   myMethod(...args) { ... }
 *
 *   static _overrideAnimateMyMethod(mob, animArgs) {
 *     return new SomeAnimation(mob, ...);
 *   }
 * }
 * ```
 */
export function overrideAnimate(
  method: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
  const originalMethod = method;
  const decorated = function (this: unknown, ...args: unknown[]): unknown {
    return originalMethod.apply(this, args);
  };
  (decorated as unknown as Record<string, unknown>)._overrideAnimate = true;
  return decorated;
}
