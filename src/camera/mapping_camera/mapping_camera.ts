/**
 * mapping_camera — cameras that support spatial mapping / distortion effects.
 *
 * Mirrors manim.camera.mapping_camera:
 *   - MappingCamera      — applies an arbitrary point mapping before projection
 *   - OldMultiCamera     — composites multiple sub-cameras onto one canvas
 *   - SplitScreenCamera  — two-panel split-screen built on OldMultiCamera
 *
 * Rendering note: Python Manim uses numpy pixel arrays for compositing.
 * Here we use @napi-rs/canvas ImageData / drawImage equivalents.
 */

import type { CanvasContext2D } from "../../core/canvas-factory.js";
import type { IMobject, IVMobject, Point3D, Points3D } from "../../core/types.js";
import { np } from "../../core/math/index.js";
import { Camera } from "../camera/index.js";
import type { CameraOptions } from "../camera/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Local duck-type for VMobject curve-count operations.
 * The VMobject class is not yet converted, so we guard with a runtime check.
 */
interface ICurveableMobject extends IVMobject {
  getNumCurves(): number;
  insertNCurves(n: number): void;
}

function hasCurveOps(mob: IMobject): mob is ICurveableMobject {
  const m = mob as unknown as Record<string, unknown>;
  return (
    "points" in mob &&
    typeof m["getNumCurves"] === "function" &&
    typeof m["insertNCurves"] === "function"
  );
}

// ─── CaptureMobjectsOptions ───────────────────────────────────────────────────

export interface CaptureMobjectsOptions {
  includeSubmobjects?: boolean;
  excludedMobjects?: IMobject[];
}

// ─── MappingCamera ────────────────────────────────────────────────────────────

export interface MappingCameraOptions extends CameraOptions {
  /**
   * Function mapping each 3D world-space point to a new 3D point before
   * projection to pixels.  Defaults to the identity function.
   */
  mappingFunc?: (point: Point3D) => Point3D;
  /**
   * Minimum number of Bezier curves a VMobject must have before capture.
   * Objects below this threshold get additional curves inserted so the
   * spatial mapping doesn't produce visible straight-line artefacts.
   * Default: 50.
   */
  minNumCurves?: number;
  /**
   * When true the original mobjects are mutated in place during capture.
   * When false (default) copies are made so the scene's objects are untouched.
   */
  allowObjectIntrusion?: boolean;
}

/**
 * A camera that warps world-space points through an arbitrary mapping function
 * before projecting them to pixel coordinates.
 *
 * Python: manim.camera.mapping_camera.MappingCamera
 */
export class MappingCamera extends Camera {
  mappingFunc: (point: Point3D) => Point3D;
  minNumCurves: number;
  allowObjectIntrusion: boolean;

  constructor(options: MappingCameraOptions = {}) {
    super(options);
    this.mappingFunc = options.mappingFunc ?? ((p) => p);
    this.minNumCurves = options.minNumCurves ?? 50;
    this.allowObjectIntrusion = options.allowObjectIntrusion ?? false;
  }

  /**
   * Convert a world-space point to pixel coordinates, passing it through
   * `mappingFunc` first.
   */
  override worldToPixel(worldPoint: Point3D): [number, number] {
    return super.worldToPixel(this.mappingFunc(worldPoint));
  }

  /**
   * Apply `mappingFunc` to every row of a Points3D array and then project
   * each mapped point to pixel coordinates.
   *
   * Python equivalent: `np.apply_along_axis(self.mapping_func, 1, points)`
   * followed by `super().points_to_pixel_coords(mobject, mapped)`.
   */
  pointsToPixelCoords(points: Points3D): [number, number][] {
    const n = points.shape[0];
    const result: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      // Build a 1-D Point3D from the i-th row of the 2-D array.
      // np.array([points.get([i, j])]) is the numpy-ts idiom for row extraction.
      const row = np.array([
        points.get([i, 0]) as number,
        points.get([i, 1]) as number,
        points.get([i, 2]) as number,
      ]) as unknown as Point3D;
      result.push(super.worldToPixel(this.mappingFunc(row)));
    }
    return result;
  }

  /**
   * Capture mobjects for rendering after applying the spatial mapping.
   *
   * Copies each mobject unless `allowObjectIntrusion` is true, then ensures
   * every VMobject has at least `minNumCurves` Bezier curves so the distortion
   * doesn't produce visible straight-line artefacts.
   *
   * Python: MappingCamera.capture_mobjects
   */
  captureMobjects(
    mobjects: IMobject[],
    _options: CaptureMobjectsOptions = {},
  ): void {
    const targets: IMobject[] = this.allowObjectIntrusion
      ? mobjects
      : mobjects.map((m) => m.copy());

    for (const mob of targets) {
      if (hasCurveOps(mob)) {
        const n = mob.getNumCurves();
        if (n > 0 && n < this.minNumCurves) {
          mob.insertNCurves(this.minNumCurves);
        }
      }
    }

    // Rendering is performed by the scene/renderer using this camera's
    // overridden worldToPixel, which applies mappingFunc automatically.
    // TODO: Port full pixel-array rendering from Python Cairo — needs
    // manual Canvas2D implementation in the renderer layer.
  }
}

// ─── ShiftedCamera (internal) ─────────────────────────────────────────────────

/** Describes a sub-camera and its pixel offset within the master canvas. */
interface ShiftedCamera {
  camera: Camera;
  /** Leftmost pixel column of this sub-camera's region. */
  startX: number;
  /** Topmost pixel row of this sub-camera's region. */
  startY: number;
  /** One-past-last pixel column. */
  endX: number;
  /** One-past-last pixel row. */
  endY: number;
}

// ─── OldMultiCamera ───────────────────────────────────────────────────────────

/**
 * A camera that composites multiple sub-cameras onto a single canvas.
 *
 * Each sub-camera renders independently; their output is blitted into the
 * corresponding pixel region of the master canvas (later cameras overwrite
 * earlier ones).
 *
 * Python: manim.camera.mapping_camera.OldMultiCamera
 *
 * Note: The Python implementation uses raw numpy pixel arrays.  Here we use
 * Canvas2D's `drawImage` to composite each sub-camera's canvas onto the master.
 *
 * @param camerasWithPositions  Array of `[camera, [startY, startX]]` pairs.
 *   The position tuple uses Python's (row, col) / (y, x) convention.
 * @param options  CameraOptions forwarded to the master Camera constructor.
 */
export class OldMultiCamera extends Camera {
  protected readonly shiftedCameras: ShiftedCamera[];

  constructor(
    camerasWithPositions: [Camera, [number, number]][],
    options: CameraOptions = {},
  ) {
    super(options);

    this.shiftedCameras = camerasWithPositions.map(([cam, [startY, startX]]) => ({
      camera: cam,
      startX,
      startY,
      endX: startX + cam.pixelWidth,
      endY: startY + cam.pixelHeight,
    }));
  }

  /**
   * Capture mobjects into each sub-camera, then composite into the master canvas.
   *
   * Python: loops over shifted_cameras, calls capture_mobjects on each,
   * then copies pixel_array slices.  Here we use `drawImage` instead.
   */
  captureMobjects(
    mobjects: IMobject[],
    options: CaptureMobjectsOptions = {},
  ): void {
    for (const sc of this.shiftedCameras) {
      if (sc.camera instanceof MappingCamera) {
        sc.camera.captureMobjects(mobjects, options);
      }
      // Composite sub-camera's canvas into the master canvas at its offset.
      // Cast context to any — both @napi-rs/canvas and browser CanvasRenderingContext2D support drawImage.
      (this.context as any).drawImage(
        sc.camera.canvas,
        sc.startX,
        sc.startY,
      );
    }
    // TODO: Port full pixel-array rendering from Python Cairo — sub-cameras
    // need their own full renderer pass before the drawImage composite.
  }

  /**
   * Initialise the background for the master canvas and all sub-cameras.
   *
   * Python: copies a pixel_array slice into each sub-camera's background.
   * Here we clear each camera's canvas with its background colour.
   */
  initBackground(): void {
    super.captureFrame();
    for (const sc of this.shiftedCameras) {
      sc.camera.captureFrame();
    }
  }

  /**
   * Propagate a background image to each sub-camera's region.
   *
   * Python: slices the numpy pixel array and passes each slice to
   * `camera.set_background`.
   *
   * TODO: Implement via ImageData / putImageData when a full pixel-array
   * pipeline is available.
   */
  setBackground(_pixelArray: unknown, _options?: Record<string, unknown>): void {
    // TODO: Port pixel_array slice assignment to Canvas2D ImageData.
  }

  /**
   * Propagate a new pixel array to the master camera and each sub-camera.
   *
   * TODO: Implement via ImageData / putImageData.
   */
  setPixelArray(_pixelArray: unknown, _options?: Record<string, unknown>): void {
    // TODO: Port pixel_array operations to Canvas2D ImageData.
  }
}

// ─── SplitScreenCamera ────────────────────────────────────────────────────────

/**
 * A split-screen camera that places `leftCamera` and `rightCamera` side-by-side.
 *
 * Both sub-cameras are resized to occupy exactly half the master frame width
 * (ceiling division so an odd pixel width distributes correctly).
 *
 * Python: manim.camera.mapping_camera.SplitScreenCamera
 */
export class SplitScreenCamera extends OldMultiCamera {
  readonly leftCamera: Camera;
  readonly rightCamera: Camera;

  constructor(
    leftCamera: Camera,
    rightCamera: Camera,
    options: CameraOptions = {},
  ) {
    // Resolve master pixel width from options (mirrors Python's Camera.__init__(**kwargs))
    const masterWidth = options.pixelWidth ?? 1920;
    const masterHeight = options.pixelHeight ?? 1080;
    const halfWidth = Math.ceil(masterWidth / 2);

    // Resize each sub-camera to half-width at the master height.
    // Python: camera.reset_pixel_shape(camera.pixel_height, half_width)
    leftCamera.resize(halfWidth, masterHeight);
    rightCamera.resize(halfWidth, masterHeight);

    super(
      [
        [leftCamera, [0, 0]],
        [rightCamera, [0, halfWidth]],
      ],
      options,
    );

    this.leftCamera = leftCamera;
    this.rightCamera = rightCamera;
  }
}
