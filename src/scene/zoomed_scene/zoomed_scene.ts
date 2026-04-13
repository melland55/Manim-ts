/**
 * ZoomedScene — a Scene with a zoomed-camera viewport.
 *
 * Provides a secondary MovingCamera that shows a magnified region of the
 * scene, rendered as a mini-display in a corner (or at a specified position).
 *
 * Mirrors Python's manim.scene.zoomed_scene.ZoomedScene.
 *
 * Examples:
 * ```typescript
 * class UseZoomedScene extends ZoomedScene {
 *   async construct() {
 *     // this.zoomedCamera.frame — the moveable scope rectangle
 *     // this.zoomedDisplay      — the mini image in the corner
 *     this.activateZooming(false);
 *     await this.wait(1);
 *   }
 * }
 * ```
 */

import type {
  IMobject,
  IAnimation,
  IScene,
  IColor,
  Updater,
  RateFunc,
} from "../../core/types.js";
import type { Point3D, Points3D } from "../../core/types.js";
import { np, ORIGIN, UP, RIGHT } from "../../core/math/index.js";
import type { mat4 } from "gl-matrix";
import { Camera } from "../../camera/index.js";
import type { CameraOptions } from "../../camera/index.js";
import { BLACK } from "../../core/color/index.js";
import { MovingCameraScene } from "../moving_camera_scene/index.js";
import type { MovingCameraSceneOptions } from "../moving_camera_scene/index.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default gap between a mobject and the scene edge (logical units). */
const DEFAULT_MOBJECT_TO_EDGE_BUFFER = 0.25;

// ─── BaseMobjectStub ─────────────────────────────────────────────────────────
// TODO: Replace with actual Mobject base class when the mobject module is converted.
// This provides the minimum IMobject surface area needed by ZoomedScene.

abstract class BaseMobjectStub implements IMobject {
  name: string = "";
  color: IColor = BLACK;
  submobjects: IMobject[] = [];
  updaters: Updater[] = [];
  zIndex: number = 0;

  abstract getCenter(): Point3D;
  abstract getWidth(): number;
  abstract getHeight(): number;

  getLeft(): Point3D {
    const c = this.getCenter();
    return np.array([
      (c.item(0) as number) - this.getWidth() / 2,
      c.item(1) as number,
      c.item(2) as number,
    ]);
  }

  getRight(): Point3D {
    const c = this.getCenter();
    return np.array([
      (c.item(0) as number) + this.getWidth() / 2,
      c.item(1) as number,
      c.item(2) as number,
    ]);
  }

  getTop(): Point3D {
    const c = this.getCenter();
    return np.array([
      c.item(0) as number,
      (c.item(1) as number) + this.getHeight() / 2,
      c.item(2) as number,
    ]);
  }

  getBottom(): Point3D {
    const c = this.getCenter();
    return np.array([
      c.item(0) as number,
      (c.item(1) as number) - this.getHeight() / 2,
      c.item(2) as number,
    ]);
  }

  abstract moveTo(point: Point3D, alignedEdge?: Point3D): this;

  shift(...vectors: Point3D[]): this {
    if (vectors.length === 0) return this;
    let total = np.zeros([3]) as Point3D;
    for (const v of vectors) {
      total = total.add(v) as unknown as Point3D;
    }
    const c = this.getCenter();
    return this.moveTo(c.add(total) as unknown as Point3D);
  }

  scale(_factor: number, _options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    return this;
  }

  rotate(_angle: number, _axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  flip(_axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  nextTo(
    _target: IMobject | Point3D,
    _direction?: Point3D,
    _options?: { buff?: number; alignedEdge?: Point3D },
  ): this {
    return this;
  }

  alignTo(_target: IMobject | Point3D, _direction: Point3D): this {
    return this;
  }

  add(..._mobjects: IMobject[]): this {
    return this;
  }

  remove(..._mobjects: IMobject[]): this {
    return this;
  }

  getFamily(_recurse?: boolean): IMobject[] {
    return [];
  }

  setColor(_color: IColor | unknown): this {
    return this;
  }

  setOpacity(_opacity: number): this {
    return this;
  }

  addUpdater(
    _updater: Updater,
    _index?: number,
    _callUpdater?: boolean,
  ): this {
    return this;
  }

  removeUpdater(_updater: Updater): this {
    return this;
  }

  applyMatrix(_matrix: mat4 | number[][]): this {
    return this;
  }

  applyFunction(_fn: (point: Point3D) => Point3D): this {
    return this;
  }

  abstract copy(): IMobject;

  getPointsDefiningBoundary(): Points3D {
    return np.zeros([0, 3]) as unknown as Points3D;
  }
}

// ─── CameraFrame ─────────────────────────────────────────────────────────────

interface CameraFrameState {
  width: number;
  height: number;
  center: Point3D;
  strokeWidth: number;
}

/**
 * CameraFrame — the rectangular viewport frame for a MovingCamera.
 *
 * Can be moved, scaled, and animated to control which region the
 * MovingCamera shows.  Supports save/restore for animation.
 *
 * TODO: Extend from Rectangle (VMobject) when the mobject module is converted.
 */
export class CameraFrame extends BaseMobjectStub {
  private _width: number;
  private _height: number;
  private _center: Point3D;

  /** Width of the stroke drawn around the frame. */
  strokeWidth: number;

  private _savedState: CameraFrameState | null = null;

  constructor(
    options: { width?: number; height?: number; strokeWidth?: number } = {},
  ) {
    super();
    this._width = options.width ?? 14.222;
    this._height = options.height ?? 8.0;
    this._center = ORIGIN.copy() as Point3D;
    this.strokeWidth = options.strokeWidth ?? 0;
    this.name = "CameraFrame";
  }

  override getCenter(): Point3D {
    return this._center.copy() as Point3D;
  }

  override getWidth(): number {
    return this._width;
  }

  override getHeight(): number {
    return this._height;
  }

  /**
   * Resize width without changing height.
   * Mirrors Python's `stretch_to_fit_width`.
   */
  stretchToFitWidth(width: number): this {
    this._width = width;
    return this;
  }

  /**
   * Resize height without changing width.
   * Mirrors Python's `stretch_to_fit_height`.
   */
  stretchToFitHeight(height: number): this {
    this._height = height;
    return this;
  }

  override scale(
    factor: number,
    _options?: { aboutPoint?: Point3D; aboutEdge?: Point3D },
  ): this {
    this._width *= factor;
    this._height *= factor;
    return this;
  }

  override moveTo(point: Point3D, _alignedEdge?: Point3D): this {
    this._center = point.copy() as Point3D;
    return this;
  }

  /** Move frame to the scene origin. */
  center(): this {
    this._center = ORIGIN.copy() as Point3D;
    return this;
  }

  /**
   * Set stroke properties.
   * Mirrors Python's VMobject `set_stroke`.
   */
  setStroke(
    options: { width?: number; color?: IColor; opacity?: number } = {},
  ): this {
    if (options.width !== undefined) {
      this.strokeWidth = options.width;
    }
    return this;
  }

  /** Save current state for later restore (used in animations). */
  saveState(): this {
    this._savedState = {
      width: this._width,
      height: this._height,
      center: this._center.copy() as Point3D,
      strokeWidth: this.strokeWidth,
    };
    return this;
  }

  /** Restore to last saved state. */
  restore(): this {
    if (this._savedState !== null) {
      this._width = this._savedState.width;
      this._height = this._savedState.height;
      this._center = this._savedState.center.copy() as Point3D;
      this.strokeWidth = this._savedState.strokeWidth;
    }
    return this;
  }

  override copy(): CameraFrame {
    const c = new CameraFrame({
      width: this._width,
      height: this._height,
      strokeWidth: this.strokeWidth,
    });
    c._center = this._center.copy() as Point3D;
    return c;
  }
}

// ─── MovingCamera ─────────────────────────────────────────────────────────────

export interface MovingCameraOptions extends CameraOptions {
  /** Stroke width of the camera frame rectangle (default 0). */
  defaultFrameStrokeWidth?: number;
  /** Background opacity for the camera output (default 1). */
  backgroundOpacity?: number;
}

/**
 * MovingCamera — a Camera with a moveable viewport frame.
 *
 * The {@link frame} property is a {@link CameraFrame} that can be animated.
 * Move, scale, or rotate it to change what portion of the scene is visible.
 *
 * Mirrors Python's manim.camera.moving_camera.MovingCamera.
 */
export class MovingCamera extends Camera {
  /** The animated frame that defines this camera's visible area. */
  frame: CameraFrame;

  /** Default stroke width used for the frame rectangle. */
  defaultFrameStrokeWidth: number;

  /** Opacity applied to the background layer when compositing. */
  backgroundOpacity: number;

  constructor(options: MovingCameraOptions = {}) {
    super(options);
    this.defaultFrameStrokeWidth = options.defaultFrameStrokeWidth ?? 0;
    this.backgroundOpacity = options.backgroundOpacity ?? 1;
    this.frame = new CameraFrame({
      width: this.frameWidth,
      height: this.frameHeight,
      strokeWidth: this.defaultFrameStrokeWidth,
    });
  }

  /**
   * Sync camera dimensions to match the current frame geometry.
   * Call after animating the frame to apply the new viewport.
   */
  resetFrameContext(): void {
    const center = this.frame.getCenter();
    this.setFrameCenter(center);
    this.frameWidth = this.frame.getWidth();
    this.frameHeight = this.frame.getHeight();
  }
}

// ─── MultiCamera ─────────────────────────────────────────────────────────────

/**
 * MultiCamera — a MovingCamera that can composite sub-camera renders.
 *
 * Used by ZoomedScene to layer the zoomed-display image on top of the
 * main scene output.
 *
 * Mirrors Python's manim.camera.multi_camera.MultiCamera.
 *
 * TODO: Full multi-camera compositing requires renderer integration.
 */
export class MultiCamera extends MovingCamera {
  /** Sub-camera image mobjects registered for compositing. */
  imageMobjectsFromCameras: ImageMobjectFromCamera[] = [];

  constructor(options: MovingCameraOptions = {}) {
    super(options);
  }

  /** Register an {@link ImageMobjectFromCamera} to be composited into this camera's output. */
  addImageMobjectFromCamera(imageMobject: ImageMobjectFromCamera): void {
    if (!this.imageMobjectsFromCameras.includes(imageMobject)) {
      this.imageMobjectsFromCameras.push(imageMobject);
    }
  }

  /** Unregister an {@link ImageMobjectFromCamera}. */
  removeImageMobjectFromCamera(imageMobject: ImageMobjectFromCamera): void {
    const idx = this.imageMobjectsFromCameras.indexOf(imageMobject);
    if (idx !== -1) {
      this.imageMobjectsFromCameras.splice(idx, 1);
    }
  }
}

// ─── ImageMobjectFromCamera ───────────────────────────────────────────────────

export interface ImageMobjectFromCameraOptions {
  /** Stroke width of the display border (default 3). */
  strokeWidth?: number;
  /** Stroke color of the display border. */
  strokeColor?: IColor;
  /** Fill opacity of the image (default 1). */
  fillOpacity?: number;
}

interface ImageMobjectState {
  width: number;
  height: number;
  center: Point3D;
}

/**
 * ImageMobjectFromCamera — a mobject that renders the output of a sub-camera.
 *
 * Positioned as a mini-display rectangle showing what the sub-camera sees.
 * Supports a display frame (border) and save/restore for animation.
 *
 * Mirrors Python's manim.mobject.types.image_mobject.ImageMobjectFromCamera.
 *
 * TODO: Full pixel rendering requires renderer integration.
 */
export class ImageMobjectFromCamera extends BaseMobjectStub {
  /** The sub-camera whose output this mobject displays. */
  camera: MovingCamera;

  /** Whether a display frame (border rectangle) has been added. */
  hasDisplayFrame: boolean = false;

  private _width: number;
  private _height: number;
  private _center: Point3D;
  private _savedState: ImageMobjectState | null = null;

  constructor(
    camera: MovingCamera,
    _options: ImageMobjectFromCameraOptions = {},
  ) {
    super();
    this.camera = camera;
    this._width = camera.frameWidth;
    this._height = camera.frameHeight;
    this._center = ORIGIN.copy() as Point3D;
    this.name = "ImageMobjectFromCamera";
  }

  override getCenter(): Point3D {
    return this._center.copy() as Point3D;
  }

  override getWidth(): number {
    return this._width;
  }

  override getHeight(): number {
    return this._height;
  }

  /** Resize width to fit (mirrors `stretch_to_fit_width`). */
  stretchToFitWidth(width: number): this {
    this._width = width;
    return this;
  }

  /** Resize height to fit (mirrors `stretch_to_fit_height`). */
  stretchToFitHeight(height: number): this {
    this._height = height;
    return this;
  }

  override moveTo(point: Point3D, _alignedEdge?: Point3D): this {
    this._center = point.copy() as Point3D;
    return this;
  }

  /**
   * Position the display in a corner of the scene.
   *
   * @param direction - A unit vector pointing to the desired corner
   *   (e.g. `UP.add(RIGHT)` for the upper-right corner).
   * @param options.buff - Gap between display edge and scene edge.
   *
   * Mirrors Python's `to_corner(direction, buff=...)`.
   */
  toCorner(
    direction: Point3D,
    options: { buff?: number } = {},
  ): this {
    const buff = options.buff ?? DEFAULT_MOBJECT_TO_EDGE_BUFFER;
    // Default Manim frame: 14.222 wide, 8.0 tall
    const frameWidth = 14.222;
    const frameHeight = 8.0;
    const dx = direction.item(0) as number;
    const dy = direction.item(1) as number;
    const x = dx * (frameWidth / 2 - this._width / 2 - buff);
    const y = dy * (frameHeight / 2 - this._height / 2 - buff);
    this._center = np.array([x, y, 0]) as Point3D;
    return this;
  }

  /**
   * Add a rectangular border around this image display.
   * Mirrors Python's `add_display_frame()`.
   *
   * TODO: Create an actual Rectangle VMobject when the mobject module is converted.
   */
  addDisplayFrame(): this {
    this.hasDisplayFrame = true;
    return this;
  }

  /** Save current state for later restore (used in animations). */
  saveState(): this {
    this._savedState = {
      width: this._width,
      height: this._height,
      center: this._center.copy() as Point3D,
    };
    return this;
  }

  /** Restore to last saved state. */
  restore(): this {
    if (this._savedState !== null) {
      this._width = this._savedState.width;
      this._height = this._savedState.height;
      this._center = this._savedState.center.copy() as Point3D;
    }
    return this;
  }

  /**
   * Resize and reposition to match another CameraFrame or ImageMobjectFromCamera.
   * Mirrors Python's `replace(target, stretch=True)`.
   */
  replace(
    target: CameraFrame | ImageMobjectFromCamera,
    _stretch: boolean = false,
  ): this {
    this._width = target.getWidth();
    this._height = target.getHeight();
    this._center = target.getCenter().copy() as Point3D;
    return this;
  }

  override copy(): ImageMobjectFromCamera {
    const c = new ImageMobjectFromCamera(this.camera, {});
    c._width = this._width;
    c._height = this._height;
    c._center = this._center.copy() as Point3D;
    c.hasDisplayFrame = this.hasDisplayFrame;
    return c;
  }
}

// ─── Animation stubs ─────────────────────────────────────────────────────────
// TODO: Replace with actual ApplyMethod from animation/transform when converted.

abstract class BaseAnimationStub implements IAnimation {
  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  constructor(
    mob: IMobject,
    options: { runTime?: number; rateFunc?: RateFunc; name?: string } = {},
  ) {
    this.mobject = mob;
    this.runTime = options.runTime ?? 1;
    this.rateFunc = options.rateFunc ?? ((t: number) => t);
    this.lagRatio = 0;
    this.name = options.name ?? this.constructor.name;
    this.remover = false;
    this.introducer = false;
  }

  abstract begin(): void;
  abstract finish(): void;
  abstract interpolate(alpha: number): void;

  interpolateMobject(_alpha: number): void {}
  interpolateSubmobject(
    _sub: IMobject,
    _start: IMobject,
    _alpha: number,
  ): void {}
  setupScene(_scene: IScene): void {}
  cleanUpFromScene(_scene: IScene): void {}
  getAllMobjects(): IMobject[] {
    return [this.mobject];
  }
  copy(): IAnimation {
    return this;
  }
  isFinished(alpha: number): boolean {
    return alpha >= 1;
  }
  getRunTime(): number {
    return this.runTime;
  }
}

/**
 * FrameRestoreAnimation — animates a CameraFrame back to its saved state.
 *
 * Stub for `ApplyMethod(frame.restore, run_time=...)`.
 * TODO: Implement full interpolation when VMobject system is available.
 */
class FrameRestoreAnimation extends BaseAnimationStub {
  private _frame: CameraFrame;

  constructor(
    frame: CameraFrame,
    options: { runTime?: number; rateFunc?: RateFunc } = {},
  ) {
    super(frame as unknown as IMobject, options);
    this._frame = frame;
  }

  begin(): void {}

  interpolate(alpha: number): void {
    // TODO: Interpolate frame geometry between start and saved states.
    // For now, snap to the saved state at completion.
    if (alpha >= 1) {
      this._frame.restore();
    }
  }

  finish(): void {
    this._frame.restore();
  }
}

/**
 * DisplayRestoreAnimation — animates an ImageMobjectFromCamera back to its saved state.
 *
 * Stub for `ApplyMethod(display.restore)`.
 * TODO: Implement full interpolation when VMobject system is available.
 */
class DisplayRestoreAnimation extends BaseAnimationStub {
  private _display: ImageMobjectFromCamera;

  constructor(
    display: ImageMobjectFromCamera,
    options: { runTime?: number; rateFunc?: RateFunc } = {},
  ) {
    super(display as unknown as IMobject, options);
    this._display = display;
  }

  begin(): void {}

  interpolate(alpha: number): void {
    // TODO: Interpolate display geometry between start and saved states.
    if (alpha >= 1) {
      this._display.restore();
    }
  }

  finish(): void {
    this._display.restore();
  }
}

// ─── ZoomedSceneOptions ───────────────────────────────────────────────────────

export interface ZoomedSceneOptions extends MovingCameraSceneOptions {
  /**
   * Height (logical units) of the zoomed mini-display (default 3).
   * Also controls the initial height of `zoomedCamera.frame`.
   */
  zoomedDisplayHeight?: number;

  /**
   * Width (logical units) of the zoomed mini-display (default 3).
   * Also controls the initial width of `zoomedCamera.frame`.
   */
  zoomedDisplayWidth?: number;

  /**
   * If set, the zoomed display is placed at this point.
   * Overrides `zoomedDisplayCorner`.
   */
  zoomedDisplayCenter?: Point3D | null;

  /**
   * Corner direction for the mini-display when `zoomedDisplayCenter` is null.
   * Use e.g. `UP.add(RIGHT)` for upper-right (default).
   */
  zoomedDisplayCorner?: Point3D;

  /** Gap between the mini-display and the scene edge (default 0.25). */
  zoomedDisplayCornerBuff?: number;

  /** Options forwarded to the internal MovingCamera constructor. */
  zoomedCameraConfig?: MovingCameraOptions;

  /** Options forwarded to the ImageMobjectFromCamera constructor. */
  zoomedCameraImageMobjectConfig?: ImageMobjectFromCameraOptions;

  /** Starting position of `zoomedCamera.frame` (default ORIGIN). */
  zoomedCameraFrameStartingPosition?: Point3D;

  /**
   * Ratio of the zoomed camera frame size to the display size.
   * A value of 0.15 means the frame covers 15 % of the display (default 0.15).
   */
  zoomFactor?: number;

  /** Stroke width of the display border in pixels (default 3). */
  imageFrameStrokeWidth?: number;

  /** Whether zooming starts already activated (default false). */
  zoomActivated?: boolean;
}

// ─── ZoomedScene ─────────────────────────────────────────────────────────────

/**
 * ZoomedScene — a Scene with a configurable zoomed-camera viewport.
 *
 * Creates a secondary {@link MovingCamera} (accessible as `zoomedCamera`)
 * whose frame can be moved around the scene.  The camera's output is shown
 * as a mini-display (`zoomedDisplay`) in the corner or at a custom position.
 *
 * Call {@link activateZooming} (or the Python-alias {@link activate_zooming})
 * to bring the viewport live.  Optionally pass `animate: true` to play the
 * zoom-in and pop-out entrance animations.
 *
 * Mirrors Python's `manim.scene.zoomed_scene.ZoomedScene`.
 */
export class ZoomedScene extends MovingCameraScene {
  /** Height (logical units) of the zoomed mini-display. */
  zoomedDisplayHeight: number;

  /** Width (logical units) of the zoomed mini-display. */
  zoomedDisplayWidth: number;

  /** Override position for the mini-display; `null` → use corner. */
  zoomedDisplayCenter: Point3D | null;

  /** Corner direction for the mini-display. */
  zoomedDisplayCorner: Point3D;

  /** Gap between the mini-display and the scene edge. */
  zoomedDisplayCornerBuff: number;

  /** Options forwarded to the MovingCamera constructor. */
  zoomedCameraConfig: MovingCameraOptions;

  /** Options forwarded to the ImageMobjectFromCamera constructor. */
  zoomedCameraImageMobjectConfig: ImageMobjectFromCameraOptions;

  /** Starting position of the zoomed camera frame. */
  zoomedCameraFrameStartingPosition: Point3D;

  /**
   * Ratio of the zoomed camera frame area to the display area.
   * @see {@link getZoomFactor}
   */
  zoomFactor: number;

  /** Stroke width of the display border in pixels. */
  imageFrameStrokeWidth: number;

  /** Whether the zoomed viewport is currently active. */
  zoomActivated: boolean;

  /** The secondary MovingCamera that shows the zoomed view. Available after {@link setup}. */
  zoomedCamera!: MovingCamera;

  /** The mini-display image mobject. Available after {@link setup}. */
  zoomedDisplay!: ImageMobjectFromCamera;

  constructor(options: ZoomedSceneOptions = {}) {
    super(options);

    this.zoomedDisplayHeight = options.zoomedDisplayHeight ?? 3;
    this.zoomedDisplayWidth = options.zoomedDisplayWidth ?? 3;
    this.zoomedDisplayCenter = options.zoomedDisplayCenter ?? null;
    this.zoomedDisplayCorner =
      options.zoomedDisplayCorner ?? (UP.add(RIGHT) as unknown as Point3D);
    this.zoomedDisplayCornerBuff =
      options.zoomedDisplayCornerBuff ?? DEFAULT_MOBJECT_TO_EDGE_BUFFER;
    this.zoomedCameraConfig = options.zoomedCameraConfig ?? {
      defaultFrameStrokeWidth: 2,
      backgroundOpacity: 1,
    };
    this.zoomedCameraImageMobjectConfig =
      options.zoomedCameraImageMobjectConfig ?? {};
    this.zoomedCameraFrameStartingPosition =
      options.zoomedCameraFrameStartingPosition ??
      (ORIGIN.copy() as unknown as Point3D);
    this.zoomFactor = options.zoomFactor ?? 0.15;
    this.imageFrameStrokeWidth = options.imageFrameStrokeWidth ?? 3;
    this.zoomActivated = options.zoomActivated ?? false;

    // Run setup() so zoomedCamera and zoomedDisplay are ready immediately.
    this.setup();
  }

  /**
   * Initialize the zoomed camera and mini-display.
   *
   * Called automatically from the constructor (mirroring how Python Manim
   * calls `setup()` from `Scene.__init__` via MRO).
   *
   * Subclasses may call `super.setup()` then customise `zoomedCamera` and
   * `zoomedDisplay` further.
   */
  setup(): void {
    const zoomedCamera = new MovingCamera(this.zoomedCameraConfig);
    const zoomedDisplay = new ImageMobjectFromCamera(
      zoomedCamera,
      this.zoomedCameraImageMobjectConfig,
    );

    zoomedDisplay.addDisplayFrame();

    // Resize both the camera frame and the display to the configured dimensions
    for (const mob of [zoomedCamera.frame, zoomedDisplay] as Array<
      CameraFrame | ImageMobjectFromCamera
    >) {
      mob.stretchToFitHeight(this.zoomedDisplayHeight);
      mob.stretchToFitWidth(this.zoomedDisplayWidth);
    }

    // Scale the camera frame to the zoom level
    zoomedCamera.frame.scale(this.zoomFactor);

    // Place the camera frame at its starting position
    zoomedCamera.frame.moveTo(this.zoomedCameraFrameStartingPosition);

    // Place the mini-display
    if (this.zoomedDisplayCenter !== null) {
      zoomedDisplay.moveTo(this.zoomedDisplayCenter);
    } else {
      zoomedDisplay.toCorner(this.zoomedDisplayCorner, {
        buff: this.zoomedDisplayCornerBuff,
      });
    }

    this.zoomedCamera = zoomedCamera;
    this.zoomedDisplay = zoomedDisplay;
  }

  /**
   * Activate the zoomed viewport.
   *
   * Registers the mini-display with the camera, optionally plays the
   * entrance animations, and adds the frame and display as foreground mobjects.
   *
   * @param animate - Play zoom-in and pop-out animations (default `false`).
   *
   * Mirrors Python's `ZoomedScene.activate_zooming`.
   */
  activateZooming(animate: boolean = false): void {
    this.zoomActivated = true;

    // Register the zoomed display with the renderer camera so it is composited.
    // TODO: When the renderer pipeline is integrated, call
    //       renderer.camera.addImageMobjectFromCamera(this.zoomedDisplay).
    if (this.camera instanceof MultiCamera) {
      this.camera.addImageMobjectFromCamera(this.zoomedDisplay);
    }

    if (animate) {
      void this.play(this.getZoomInAnimation());
      void this.play(this.getZoomedDisplayPopOutAnimation());
    }

    this.addForegroundMobjects(
      this.zoomedCamera.frame as unknown as IMobject,
      this.zoomedDisplay as unknown as IMobject,
    );
  }

  /**
   * Return an animation that expands the camera frame from full-screen
   * size/position to its configured zoomed-in size/position.
   *
   * @param runTime - Duration in seconds (default 2).
   * @param options - Additional animation options.
   *
   * Mirrors Python's `ZoomedScene.get_zoom_in_animation`.
   */
  getZoomInAnimation(
    runTime: number = 2,
    options: { rateFunc?: RateFunc } = {},
  ): IAnimation {
    const frame = this.zoomedCamera.frame;
    const fullFrameHeight = this.camera.frameHeight;
    const fullFrameWidth = this.camera.frameWidth;

    // Save the target (zoomed-in) state, then expand to full-screen as start
    frame.saveState();
    frame.stretchToFitWidth(fullFrameWidth);
    frame.stretchToFitHeight(fullFrameHeight);
    frame.center();
    frame.setStroke({ width: 0 });

    return new FrameRestoreAnimation(frame, { runTime, ...options });
  }

  /**
   * Return an animation that morphs the mini-display from the camera-frame
   * position/size to its display position/size.
   *
   * @param options - Animation options.
   *
   * Mirrors Python's `ZoomedScene.get_zoomed_display_pop_out_animation`.
   */
  getZoomedDisplayPopOutAnimation(
    options: { runTime?: number; rateFunc?: RateFunc } = {},
  ): IAnimation {
    const display = this.zoomedDisplay;
    display.saveState();
    display.replace(this.zoomedCamera.frame);
    return new DisplayRestoreAnimation(display, options);
  }

  /**
   * Return the current zoom factor.
   *
   * Defined as the ratio of the zoomed camera frame height to the mini-display
   * height — i.e. how much larger the scene area is compared to the display.
   *
   * Mirrors Python's `ZoomedScene.get_zoom_factor`.
   */
  getZoomFactor(): number {
    return this.zoomedCamera.frame.getHeight() / this.zoomedDisplay.getHeight();
  }

  // ── Python-compatible aliases ─────────────────────────────────────────────

  /** Python alias: `activate_zooming`. */
  activate_zooming(animate: boolean = false): void {
    this.activateZooming(animate);
  }

  /** Python alias: `get_zoom_in_animation`. */
  get_zoom_in_animation(
    runTime: number = 2,
    options: { rateFunc?: RateFunc } = {},
  ): IAnimation {
    return this.getZoomInAnimation(runTime, options);
  }

  /** Python alias: `get_zoomed_display_pop_out_animation`. */
  get_zoomed_display_pop_out_animation(
    options: { runTime?: number; rateFunc?: RateFunc } = {},
  ): IAnimation {
    return this.getZoomedDisplayPopOutAnimation(options);
  }

  /** Python alias: `get_zoom_factor`. */
  get_zoom_factor(): number {
    return this.getZoomFactor();
  }
}
