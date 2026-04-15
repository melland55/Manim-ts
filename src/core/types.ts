/**
 * Core type definitions for manim-ts.
 *
 * These interfaces are the CONTRACTS between modules.
 * Conversion agents MUST implement against these exactly.
 * Do not add fields. Do not rename. Do not change signatures.
 *
 * NOTE: These are all interfaces, NOT declare class.
 * The actual class implementations live in their respective modules
 * (e.g., src/mobject/mobject/ for Mobject). Use these for type
 * references across module boundaries. Agents implementing a class
 * should ensure their class satisfies the corresponding interface.
 */

import type { mat4 } from "gl-matrix";
import type { NDArray } from "numpy-ts";
import type { Point3D, Points3D, RateFunc } from "./math/index.js";

// Re-export math types so agents can import everything from one place
export type { NDArray, Point3D, Points3D, RateFunc };

// ─── Primitives ──────────────────────────────────────────────

/** RGBA color as 4 floats in [0, 1] */
export type ColorArray = [number, number, number, number];

/** Updater function called each frame */
export type Updater = (mob: IMobject, dt: number) => void;

// ─── Color ───────────────────────────────────────────────────

export interface IColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  toHex(): string;
  toArray(): ColorArray;
  interpolate(other: IColor, t: number): IColor;
  lighter(amount?: number): IColor;
  darker(amount?: number): IColor;
}

// ─── Config ──────────────────────────────────────────────────

export interface ManimConfig {
  pixelWidth: number;
  pixelHeight: number;
  frameRate: number;
  frameWidth: number;
  frameHeight: number;
  backgroundColor: IColor;
  mediaDir: string;
  quality: "low" | "medium" | "high" | "fourk";
  /**
   * Renderer backend selection. Mirrors ManimCE's `config.renderer`.
   * @default "cairo"
   */
  renderer?: "cairo" | "opengl";
}

// ─── Mobject ─────────────────────────────────────────────────

export interface MobjectOptions {
  color?: IColor;
  name?: string;
  targetPosition?: Point3D;
  zIndex?: number;
  opacity?: number;
}

/**
 * Interface for the base Mobject class.
 * Python: manim.mobject.mobject.Mobject
 *
 * The actual class implementation lives in src/mobject/mobject/.
 * Use this interface for type references in other modules.
 */
export interface IMobject {
  name: string;
  color: IColor;
  submobjects: IMobject[];
  updaters: Updater[];
  zIndex: number;

  // ── Positioning ──
  getCenter(): Point3D;
  getLeft(): Point3D;
  getRight(): Point3D;
  getTop(): Point3D;
  getBottom(): Point3D;
  getWidth(): number;
  getHeight(): number;

  moveTo(point: Point3D, alignedEdge?: Point3D): this;
  shift(...vectors: Point3D[]): this;
  scale(factor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this;
  rotate(angle: number, axis?: Point3D, options?: { aboutPoint?: Point3D }): this;
  flip(axis?: Point3D, options?: { aboutPoint?: Point3D }): this;

  nextTo(
    target: IMobject | Point3D,
    direction?: Point3D,
    options?: { buff?: number; alignedEdge?: Point3D }
  ): this;

  alignTo(target: IMobject | Point3D, direction: Point3D): this;

  // ── Hierarchy ──
  add(...mobjects: IMobject[]): this;
  remove(...mobjects: IMobject[]): this;
  getFamily(recurse?: boolean): IMobject[];

  // ── Style ──
  setColor(color: IColor | any): this;
  setOpacity(opacity: number): this;

  // ── Updaters ──
  addUpdater(updater: Updater, index?: number, callUpdater?: boolean): this;
  removeUpdater(updater: Updater): this;
  suspendUpdating?(recursive?: boolean): this;
  resumeUpdating?(recursive?: boolean): this;

  // ── Transform ──
  applyMatrix(matrix: mat4 | number[][]): this;
  applyFunction(fn: (point: Point3D) => Point3D): this;

  // ── Copy ──
  copy(): IMobject;

  // ── Internal ──
  getPointsDefiningBoundary?(): Points3D;
}

// ─── VMobject ────────────────────────────────────────────────

export interface VMobjectOptions extends MobjectOptions {
  fillColor?: IColor;
  fillOpacity?: number;
  strokeColor?: IColor;
  strokeOpacity?: number;
  strokeWidth?: number;
}

/**
 * Interface for vectorized Mobject — all shapes drawn with Bezier curves.
 * Python: manim.mobject.types.vectorized_mobject.VMobject
 */
export interface IVMobject extends IMobject {
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeOpacity: number;
  strokeWidth: number;
  points: Points3D;

  // ── Path construction ──
  startNewPath(point: Point3D): this;
  addLineTo(point: Point3D): this;
  addCubicBezierCurveTo(
    handle1: Point3D,
    handle2: Point3D,
    anchor: Point3D
  ): this;
  addQuadraticBezierCurveTo(handle: Point3D, anchor: Point3D): this;
  closePath(): this;
  clearPoints(): this;

  // ── Bezier accessors ──
  getAnchors(): Points3D;
  getHandles(): Points3D;
  getSubpaths(): Points3D[];
  getArcLength(): number;
  pointFromProportion(alpha: number): Point3D;

  // ── Style ──
  setFill(color?: IColor, opacity?: number): this;
  setStroke(color?: IColor, width?: number, opacity?: number): this;

  // ── Subpath operations ──
  appendVectorizedMobject(vmob: IVMobject): this;
}

// ─── Animation ───────────────────────────────────────────────

export interface AnimationOptions {
  runTime?: number;
  rateFunc?: RateFunc;
  lagRatio?: number;
  name?: string;
  remover?: boolean;
  introducer?: boolean;
  suspendMobjectUpdating?: boolean;
}

/**
 * Interface for the base Animation class.
 * Python: manim.animation.animation.Animation
 */
export interface IAnimation {
  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  begin(): void;
  finish(): void;
  interpolate(alpha: number): void;
  interpolateMobject(alpha: number): void;

  interpolateSubmobject(
    submob: IMobject,
    startSubmob: IMobject,
    alpha: number
  ): void;

  setupScene(scene: IScene): void;
  cleanUpFromScene(scene: IScene): void;
  getAllMobjects(): IMobject[];
  copy(): IAnimation;

  isFinished(alpha: number): boolean;
  getRunTime(): number;
}

// ─── Scene ───────────────────────────────────────────────────

export interface IScene {
  mobjects: IMobject[];
  time: number;
  camera: ICamera;

  add(...mobjects: IMobject[]): this;
  remove(...mobjects: IMobject[]): this;
  play(...animations: IAnimation[]): Promise<void>;
  wait(duration?: number, stopCondition?: () => boolean): Promise<void>;

  construct(): Promise<void>;
}

// ─── Camera ──────────────────────────────────────────────────

export interface ICamera {
  pixelWidth: number;
  pixelHeight: number;
  frameWidth: number;
  frameHeight: number;
  backgroundColor: IColor;

  getFrameCenter(): Point3D;
  setFrameCenter(point: Point3D): void;
  captureFrame(): void;
}

// ─── Renderer ────────────────────────────────────────────────

export interface IRenderer {
  init(canvas: HTMLCanvasElement | OffscreenCanvas): void;
  render(scene: IScene): void;
  clear(color: IColor): void;
  renderMobject(mob: IMobject, camera: ICamera): void;
}
