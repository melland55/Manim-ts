/**
 * MovingCamera — a camera that follows and matches the size and position of
 * its 'frame', a rectangle that defines the visible region.
 *
 * Panning and zooming is achieved by moving and resizing the frame object.
 *
 * TypeScript port of manim.camera.moving_camera.MovingCamera.
 */

import type { IColor, IMobject, Point3D } from "../../core/types.js";
import { np } from "../../core/math/index.js";
import { WHITE } from "../../core/color/index.js";
import { Camera } from "../camera/index.js";
import type { CameraOptions } from "../camera/index.js";

// Default frame dimensions — must match Camera defaults
const DEFAULT_FRAME_HEIGHT = 8.0;
const DEFAULT_FRAME_WIDTH = 14.222;

// ─── CameraFrameAnimateProxy ──────────────────────────────────────────────────

/**
 * Records frame mutations as animation intent.
 *
 * In Python Manim, `frame.animate` returns an `_AnimationBuilder` that queues
 * operations for the scene's `play()` method.  This proxy accumulates the
 * intended final state so a scene can schedule a smooth interpolation.
 *
 * The proxy is returned by `MovingCamera.autoZoom(…, true)`.
 */
export class CameraFrameAnimateProxy {
  readonly frame: CameraFrame;
  private _targetX: number;
  private _targetY: number;
  private _targetWidth: number | undefined;
  private _targetHeight: number | undefined;

  constructor(frame: CameraFrame) {
    this.frame = frame;
    const center = frame.getCenter();
    this._targetX = center.item(0) as number;
    this._targetY = center.item(1) as number;
  }

  setX(x: number): this {
    this._targetX = x;
    return this;
  }

  setY(y: number): this {
    this._targetY = y;
    return this;
  }

  set(props: { width?: number; height?: number }): this {
    if (props.width !== undefined) this._targetWidth = props.width;
    if (props.height !== undefined) this._targetHeight = props.height;
    return this;
  }

  /**
   * Returns the intended final state of the frame after the animation.
   * Used by the scene / animation system to create a smooth transition.
   */
  getTargetState(): {
    x: number;
    y: number;
    width?: number;
    height?: number;
  } {
    return {
      x: this._targetX,
      y: this._targetY,
      width: this._targetWidth,
      height: this._targetHeight,
    };
  }

  /**
   * Apply the recorded mutations immediately, bypassing animation.
   * Useful for testing or when a direct (non-animated) update is needed.
   */
  applyImmediately(): CameraFrame {
    this.frame.setX(this._targetX);
    this.frame.setY(this._targetY);
    if (this._targetWidth !== undefined) {
      this.frame.set({ width: this._targetWidth });
    }
    if (this._targetHeight !== undefined) {
      this.frame.set({ height: this._targetHeight });
    }
    return this.frame;
  }
}

// ─── IMovableFrame ────────────────────────────────────────────────────────────

/**
 * The contract that MovingCamera requires from its frame object.
 *
 * Implemented by CameraFrame (the default).  Custom frames can implement
 * this interface to be used as a MovingCamera frame.
 */
export interface IMovableFrame {
  readonly width: number;
  readonly height: number;

  getCenter(): Point3D;
  moveTo(target: Point3D | { getCenter(): Point3D }): this;
  stretchToFitHeight(h: number): this;
  stretchToFitWidth(w: number): this;
  setStroke(color: IColor, width: number): this;
  /**
   * Returns the bounding-box point for the given direction vector.
   *
   * Direction is a unit vector such as `LEFT = [-1, 0, 0]`.
   * `getCriticalPoint(LEFT)` returns the center of the left edge.
   * `getCriticalPoint(UP)` returns the center of the top edge.
   */
  getCriticalPoint(direction: Point3D): Point3D;
  setX(x: number): this;
  setY(y: number): this;
  set(props: { width?: number; height?: number }): this;

  /** Animation proxy — records mutations for deferred application. */
  readonly animate: CameraFrameAnimateProxy;
}

// ─── CameraFrame ──────────────────────────────────────────────────────────────

/**
 * A minimal rectangular frame in world space.
 *
 * Tracks the center, width, and height of the region visible through the
 * MovingCamera.  Conceptually mirrors Python's ScreenRectangle without the
 * full VMobject rendering support (that is deferred to a future conversion).
 *
 * All mutating methods return `this` for method chaining.
 */
export class CameraFrame implements IMovableFrame {
  private _center: Point3D;
  private _width: number;
  private _height: number;

  /** Stroke color applied to the frame outline (cosmetic, rendering TODO). */
  strokeColor: IColor;
  /** Stroke width for the frame outline (cosmetic, rendering TODO). */
  strokeWidth: number;

  constructor(
    width: number = DEFAULT_FRAME_WIDTH,
    height: number = DEFAULT_FRAME_HEIGHT,
    center?: Point3D,
  ) {
    this._width = width;
    this._height = height;
    this._center =
      center !== undefined
        ? (center.copy() as unknown as Point3D)
        : (np.array([0, 0, 0]) as unknown as Point3D);
    this.strokeColor = WHITE;
    this.strokeWidth = 0;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  getCenter(): Point3D {
    return this._center.copy() as unknown as Point3D;
  }

  moveTo(target: Point3D | { getCenter(): Point3D }): this {
    if (
      typeof (target as { getCenter?: unknown }).getCenter === "function"
    ) {
      this._center = (target as { getCenter(): Point3D })
        .getCenter()
        .copy() as unknown as Point3D;
    } else {
      this._center = (target as Point3D).copy() as unknown as Point3D;
    }
    return this;
  }

  stretchToFitHeight(h: number): this {
    this._height = h;
    return this;
  }

  stretchToFitWidth(w: number): this {
    this._width = w;
    return this;
  }

  setStroke(color: IColor, width: number): this {
    this.strokeColor = color;
    this.strokeWidth = width;
    return this;
  }

  /**
   * Returns the bounding-box point for the given direction vector.
   *
   * For `LEFT = [-1, 0, 0]`  → center of the left edge.
   * For `UP   = [0,  1, 0]`  → center of the top edge.
   * For diagonal directions  → the corresponding corner.
   *
   * Formula: `center + direction ⊙ [width/2, height/2, 0]`
   */
  getCriticalPoint(direction: Point3D): Point3D {
    const cx = this._center.item(0) as number;
    const cy = this._center.item(1) as number;
    const dx = direction.item(0) as number;
    const dy = direction.item(1) as number;
    return np.array([
      cx + dx * (this._width / 2),
      cy + dy * (this._height / 2),
      0,
    ]) as unknown as Point3D;
  }

  setX(x: number): this {
    this._center = np.array([
      x,
      this._center.item(1) as number,
      this._center.item(2) as number,
    ]) as unknown as Point3D;
    return this;
  }

  setY(y: number): this {
    this._center = np.array([
      this._center.item(0) as number,
      y,
      this._center.item(2) as number,
    ]) as unknown as Point3D;
    return this;
  }

  set(props: { width?: number; height?: number }): this {
    if (props.width !== undefined) this._width = props.width;
    if (props.height !== undefined) this._height = props.height;
    return this;
  }

  /**
   * Returns a proxy that records mutations for animated application.
   *
   * Python: `self.frame.animate` → `_AnimationBuilder`
   */
  get animate(): CameraFrameAnimateProxy {
    return new CameraFrameAnimateProxy(this);
  }
}

// ─── MovingCameraOptions ──────────────────────────────────────────────────────

export interface MovingCameraOptions extends CameraOptions {
  /**
   * The rectangle that defines the visible region.
   * Defaults to a new CameraFrame sized to the camera's frameWidth/frameHeight.
   */
  frame?: IMovableFrame;
  /**
   * Which dimension is held fixed when resizing: `0` = width (default),
   * `1` = height.
   */
  fixedDimension?: number;
  /** Stroke color of the default frame.  Default: WHITE. */
  defaultFrameStrokeColor?: IColor;
  /** Stroke width of the default frame.  Default: 0. */
  defaultFrameStrokeWidth?: number;
}

// ─── MovingCamera ─────────────────────────────────────────────────────────────

/**
 * A camera that follows and matches the size and position of its `frame`.
 *
 * The frame is a {@link CameraFrame} (or any {@link IMovableFrame}) that defines
 * which region of space the camera displays.  Pan and zoom by moving or resizing
 * the frame:
 *
 * ```typescript
 * const cam = new MovingCamera();
 * cam.frame.moveTo(np.array([1, 2, 0]) as unknown as Point3D);
 * cam.frameWidth = 10;            // resizes the frame
 * ```
 *
 * Python: `manim.camera.moving_camera.MovingCamera`
 */
export class MovingCamera extends Camera {
  /** The rectangle in world space that defines the visible region. */
  frame: IMovableFrame;

  /** Controls which dimension is fixed during `autoZoom`. */
  fixedDimension: number;

  /** Stroke color applied to the default frame. */
  defaultFrameStrokeColor: IColor;

  /** Stroke width applied to the default frame. */
  defaultFrameStrokeWidth: number;

  constructor(options: MovingCameraOptions = {}) {
    const frameHeight = options.frameHeight ?? DEFAULT_FRAME_HEIGHT;
    const frameWidth = options.frameWidth ?? DEFAULT_FRAME_WIDTH;
    const strokeColor = options.defaultFrameStrokeColor ?? WHITE;
    const strokeWidth = options.defaultFrameStrokeWidth ?? 0;

    // Build the default frame before calling super() so the Object.defineProperty
    // overrides run with a valid frame reference.
    const frame: IMovableFrame =
      options.frame ??
      (() => {
        const f = new CameraFrame(frameWidth, frameHeight);
        f.setStroke(strokeColor, strokeWidth);
        return f;
      })();

    super(options);

    this.frame = frame;
    this.fixedDimension = options.fixedDimension ?? 0;
    this.defaultFrameStrokeColor = strokeColor;
    this.defaultFrameStrokeWidth = strokeWidth;

    // Camera's constructor sets `this.frameWidth` and `this.frameHeight` as
    // own data properties.  We replace them with accessors that delegate to
    // the frame object so that coordinate conversion always reflects the live
    // frame dimensions.
    Object.defineProperty(this, "frameWidth", {
      get: () => this.frame.width,
      set: (w: number) => {
        this.frame.stretchToFitWidth(w);
      },
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(this, "frameHeight", {
      get: () => this.frame.height,
      set: (h: number) => {
        this.frame.stretchToFitHeight(h);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // ── Frame center ─────────────────────────────────────────────────────────

  /**
   * Returns the center of the frame in world coordinates.
   *
   * Python: `MovingCamera.frame_center` (getter)
   */
  override getFrameCenter(): Point3D {
    return this.frame.getCenter();
  }

  /**
   * Moves the frame so that its center is at `point`.
   *
   * Python: `MovingCamera.frame_center` (setter) — accepts a `Point3DLike`
   * or a `Mobject` (the frame is moved to the mobject's center).
   */
  override setFrameCenter(point: Point3D): void {
    this.frame.moveTo(point);
  }

  // ── Coordinate conversion ─────────────────────────────────────────────────

  /**
   * Convert a world-space point to pixel coordinates using the frame's
   * current center and dimensions.
   *
   * Overrides Camera.worldToPixel so that coordinate conversion always
   * reflects the live frame state rather than the Camera's cached _frameCenter.
   */
  override worldToPixel(worldPoint: Point3D): [number, number] {
    const center = this.frame.getCenter();
    const cx = center.item(0) as number;
    const cy = center.item(1) as number;
    const fw = this.frame.width;
    const fh = this.frame.height;
    const wx = worldPoint.item(0) as number;
    const wy = worldPoint.item(1) as number;

    const frameLeft = cx - fw / 2;
    const frameTop = cy + fh / 2;

    const px = ((wx - frameLeft) / fw) * this.pixelWidth;
    const py = ((frameTop - wy) / fh) * this.pixelHeight;

    return [px, py];
  }

  // ── Cairo stubs ───────────────────────────────────────────────────────────

  /**
   * Since the frame moves dynamically, the Cairo context must be regenerated
   * every frame — this method always returns `null` (no cache).
   *
   * Python: `MovingCamera.get_cached_cairo_context`
   * TODO: Port from Cairo/Canvas2D — needs manual rendering implementation
   */
  getCachedCairoContext(_pixelArray: unknown): null {
    return null;
  }

  /**
   * No-op: the moving camera never caches its rendering context.
   *
   * Python: `MovingCamera.cache_cairo_context`
   * TODO: Port from Cairo/Canvas2D — needs manual rendering implementation
   */
  cacheCairoContext(_pixelArray: unknown, _ctx: unknown): void {
    // No-op — moving camera regenerates context every frame
  }

  /**
   * Capture mobjects into this camera's frame.
   *
   * The Python implementation calls `super().capture_mobjects()`.  Here we
   * clear the canvas background; full mobject rendering is handled by the
   * renderer/scene layer.
   *
   * Python: `MovingCamera.capture_mobjects`
   * TODO: Port from Cairo/Canvas2D — needs manual rendering implementation
   */
  captureMobjects(
    _mobjects: IMobject[],
    _options: Record<string, unknown> = {},
  ): void {
    this.captureFrame();
  }

  // ── Movement detection ────────────────────────────────────────────────────

  /**
   * Returns the mobjects whose movement implies camera movement.
   *
   * The scene uses this to determine when all other mobjects on screen should
   * be treated as moving.
   *
   * Python: `MovingCamera.get_mobjects_indicating_movement` → `[self.frame]`
   */
  getMobjectsIndicatingMovement(): IMobject[] {
    // CameraFrame is not yet a full IMobject; cast for API compatibility.
    // When ScreenRectangle/CameraFrame is converted to extend Mobject, remove cast.
    return [this.frame as unknown as IMobject];
  }

  // ── Visibility check ──────────────────────────────────────────────────────

  /**
   * Returns `true` if the mobject's bounding box overlaps the current frame.
   *
   * Python: `Camera.is_in_frame` (inherited; MovingCamera's frame is dynamic)
   */
  isInFrame(mobject: IMobject): boolean {
    const center = this.frame.getCenter();
    const cx = center.item(0) as number;
    const cy = center.item(1) as number;
    const hw = this.frame.width / 2;
    const hh = this.frame.height / 2;

    const frameLeft = cx - hw;
    const frameRight = cx + hw;
    const frameBottom = cy - hh;
    const frameTop = cy + hh;

    const mobLeft = mobject.getLeft().item(0) as number;
    const mobRight = mobject.getRight().item(0) as number;
    const mobBottom = mobject.getBottom().item(1) as number;
    const mobTop = mobject.getTop().item(1) as number;

    // Bounding-box overlap test
    return (
      mobRight >= frameLeft &&
      mobLeft <= frameRight &&
      mobTop >= frameBottom &&
      mobBottom <= frameTop
    );
  }

  // ── Auto zoom ─────────────────────────────────────────────────────────────

  /**
   * Zoom the camera to fit all given mobjects, with an optional margin.
   *
   * When `animate` is `false`, the frame is repositioned and resized
   * immediately and the modified frame is returned.
   *
   * When `animate` is `true` (default), a {@link CameraFrameAnimateProxy} is
   * returned.  Pass it to `scene.play()` to animate the zoom.
   *
   * Only works correctly for 2D mobjects in the XY-plane (camera not rotated).
   *
   * Python: `MovingCamera.auto_zoom`
   *
   * @param mobjects   Mobjects to fit in the frame.
   * @param margin     Extra space added around the bounding box (default 0).
   * @param onlyMobjectsInFrame  When true, skip mobjects outside the frame.
   * @param animate    When false, apply immediately; when true, return proxy.
   */
  autoZoom(
    mobjects: Iterable<IMobject>,
    margin?: number,
    onlyMobjectsInFrame?: boolean,
    animate?: false,
  ): IMovableFrame;
  autoZoom(
    mobjects: Iterable<IMobject>,
    margin?: number,
    onlyMobjectsInFrame?: boolean,
    animate?: true,
  ): CameraFrameAnimateProxy;
  autoZoom(
    mobjects: Iterable<IMobject>,
    margin: number = 0,
    onlyMobjectsInFrame: boolean = false,
    animate: boolean = true,
  ): CameraFrameAnimateProxy | IMovableFrame {
    const [xLeft, xRight, yUp, yDown] = this._getBoundingBox(
      mobjects,
      onlyMobjectsInFrame,
    );

    const x = (xLeft + xRight) / 2;
    const y = (yUp + yDown) / 2;
    const newWidth = Math.abs(xLeft - xRight);
    const newHeight = Math.abs(yUp - yDown);

    const zoomByWidth =
      newWidth / this.frame.width > newHeight / this.frame.height;

    if (animate) {
      const proxy = this.frame.animate;
      if (zoomByWidth) {
        return proxy.setX(x).setY(y).set({ width: newWidth + margin });
      } else {
        return proxy.setX(x).setY(y).set({ height: newHeight + margin });
      }
    } else {
      if (zoomByWidth) {
        return this.frame.setX(x).setY(y).set({ width: newWidth + margin });
      } else {
        return this.frame.setX(x).setY(y).set({ height: newHeight + margin });
      }
    }
  }

  /**
   * Compute the axis-aligned bounding box of the given mobjects.
   *
   * Returns `[xLeft, xRight, yUp, yDown]`.
   * Throws if no valid (non-frame, in-frame) mobjects are found.
   *
   * Python: `MovingCamera._get_bounding_box`
   */
  private _getBoundingBox(
    mobjects: Iterable<IMobject>,
    onlyMobjectsInFrame: boolean,
  ): [number, number, number, number] {
    let found = false;
    let xLeft = 0;
    let xRight = 0;
    let yUp = 0;
    let yDown = 0;

    for (const m of mobjects) {
      // Skip the camera frame itself
      if ((m as unknown) === (this.frame as unknown)) continue;
      // Skip off-screen mobjects when requested
      if (onlyMobjectsInFrame && !this.isInFrame(m)) continue;

      const mLeft = m.getLeft().item(0) as number;
      const mRight = m.getRight().item(0) as number;
      const mTop = m.getTop().item(1) as number;
      const mBottom = m.getBottom().item(1) as number;

      if (!found) {
        xLeft = mLeft;
        xRight = mRight;
        yUp = mTop;
        yDown = mBottom;
        found = true;
      } else {
        if (mLeft < xLeft) xLeft = mLeft;
        if (mRight > xRight) xRight = mRight;
        if (mTop > yUp) yUp = mTop;
        if (mBottom < yDown) yDown = mBottom;
      }
    }

    if (!found) {
      throw new Error(
        "Could not determine bounding box of the mobjects given to 'autoZoom'.",
      );
    }

    return [xLeft, xRight, yUp, yDown];
  }
}
