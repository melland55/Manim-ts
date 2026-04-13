/**
 * Mobjects representing raster images.
 *
 * TypeScript port of manim/mobject/types/image_mobject.py
 */

import type { NDArray } from "numpy-ts";

import { np, UP, DOWN, LEFT, RIGHT } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import { config } from "../../../_config/index.js";
import {
  RESAMPLING_ALGORITHMS,
  QUALITIES,
  DEFAULT_QUALITY,
} from "../../../constants/constants.js";
import { Mobject } from "../../mobject/index.js";
import type { MobjectConstructorOptions } from "../../mobject/index.js";
import { interpolate } from "../../../utils/bezier/index.js";
import {
  ManimColor,
  colorToIntRgb,
  type ParsableManimColor,
} from "../../../utils/color/core.js";
import { WHITE, YELLOW_C } from "../../../utils/color/manim_colors.js";
import {
  changeToRgbaArray,
  getFullRasterImagePath,
} from "../../../utils/images/index.js";
import type { PixelArray } from "../../../utils/images/index.js";

// Forward-declare types for dependencies that may not be fully converted yet
import type { MovingCamera } from "../../../camera/moving_camera/index.js";

// ─── Helper: pixel array utilities ──────────────────────────────────────────

/**
 * Flatten an NDArray to a plain number[].
 */
function flattenToNumbers(arr: NDArray): number[] {
  return arr.flatten().toArray() as number[];
}

/**
 * Reconstruct a 3D NDArray from a flat number[] given shape [H, W, C].
 */
function rebuildFromFlat(flat: number[], h: number, w: number, c: number): NDArray {
  const result: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      const pixel: number[] = [];
      for (let ch = 0; ch < c; ch++) {
        pixel.push(flat[row * w * c + col * c + ch]);
      }
      rowArr.push(pixel);
    }
    result.push(rowArr);
  }
  return np.array(result);
}

// ─── AbstractImageMobject ───────────────────────────────────────────────────

export interface AbstractImageMobjectOptions extends MobjectConstructorOptions {
  pixelArrayDtype?: string;
  resamplingAlgorithm?: string;
}

/**
 * Base class for image-based Mobjects.
 *
 * Automatically filters out black pixels.
 *
 * Python: manim.mobject.types.image_mobject.AbstractImageMobject
 */
export abstract class AbstractImageMobject extends Mobject {
  pixelArrayDtype!: string;
  scaleToResolution!: number | false;
  resamplingAlgorithm!: string;

  constructor(
    scaleToResolution: number | false,
    options: AbstractImageMobjectOptions = {},
  ) {
    const {
      pixelArrayDtype = "uint8",
      resamplingAlgorithm = RESAMPLING_ALGORITHMS["bicubic"],
      ...mobjectOpts
    } = options;
    // Set fields before super() calls resetPoints() → getPixelArray()
    // We need a workaround: set on the prototype chain before super
    // Actually, we must call super first in TS. Use a flag to handle.
    // The trick: initialize fields, then call super which calls resetPoints.
    // But TS requires super() first. So we override resetPoints to be a no-op
    // during construction, then call it manually after fields are set.

    // Temporarily store in a static to pass through super()
    AbstractImageMobject._pendingDtype = pixelArrayDtype;
    AbstractImageMobject._pendingResolution = scaleToResolution;
    AbstractImageMobject._pendingResampling = resamplingAlgorithm;

    super(mobjectOpts);

    // Fields are set in _initImageFields which is called from resetPoints
  }

  // Static temporaries for passing through super() constructor
  private static _pendingDtype: string = "uint8";
  private static _pendingResolution: number | false = 0;
  private static _pendingResampling: string = "bicubic";

  /**
   * Initialize image-specific fields. Called from resetPoints before
   * any pixel array access.
   */
  private _initImageFieldsIfNeeded(): void {
    if (this.pixelArrayDtype === undefined) {
      this.pixelArrayDtype = AbstractImageMobject._pendingDtype;
      this.scaleToResolution = AbstractImageMobject._pendingResolution;
      this.resamplingAlgorithm = AbstractImageMobject._pendingResampling;
    }
  }

  abstract getPixelArray(): PixelArray;

  setColor(
    color: ParsableManimColor = YELLOW_C,
    _family?: boolean,
  ): this {
    throw new Error("Not implemented — subclasses should override setColor.");
  }

  /**
   * Sets the interpolation method for upscaling the image.
   *
   * By default the image is interpolated using bicubic algorithm.
   *
   * @param resamplingAlgorithm - One of the values in RESAMPLING_ALGORITHMS.
   */
  setResamplingAlgorithm(resamplingAlgorithm: string): this {
    const validAlgorithms = Object.values(RESAMPLING_ALGORITHMS);
    if (!validAlgorithms.includes(resamplingAlgorithm)) {
      throw new Error(
        "resamplingAlgorithm must be one of the values defined in " +
        "RESAMPLING_ALGORITHMS. Available algorithms: 'bicubic' (or 'cubic'), " +
        "'nearest' (or 'none'), 'bilinear' (or 'linear').",
      );
    }
    this.resamplingAlgorithm = resamplingAlgorithm;
    return this;
  }

  /**
   * Sets points to be the four image corners, then scales to match
   * the pixel array dimensions relative to the configured resolution.
   */
  resetPoints(): this {
    this._initImageFieldsIfNeeded();

    this.points = np.array([
      (UP as NDArray).add(LEFT).toArray(),
      (UP as NDArray).add(RIGHT).toArray(),
      (DOWN as NDArray).add(LEFT).toArray(),
      (DOWN as NDArray).add(RIGHT).toArray(),
    ]);
    this.center();

    const pixelArray = this.getPixelArray();
    const shape = pixelArray.shape as number[];
    const h = shape[0];
    const w = shape[1];

    let height: number;
    if (this.scaleToResolution) {
      height = h / (this.scaleToResolution as number) * config.frameHeight;
    } else {
      height = 3; // default for ImageMobjectFromCamera
    }
    this.stretchToFitHeight(height);
    this.stretchToFitWidth(height * w / h);
    return this;
  }
}

// ─── ImageMobject ───────────────────────────────────────────────────────────

export interface ImageMobjectOptions extends AbstractImageMobjectOptions {
  scaleToResolution?: number;
  invert?: boolean;
  imageMode?: string;
}

/**
 * Displays an Image from an NDArray or a file path.
 *
 * Python: manim.mobject.types.image_mobject.ImageMobject
 */
export class ImageMobject extends AbstractImageMobject {
  // Use `declare` so TS doesn't emit field initializers that overwrite
  // values set during super() → resetPoints() → _ensurePixelArray().
  declare pixelArray: NDArray;
  declare origAlphaPixelArray: NDArray;
  path?: string;
  fillOpacity!: number;
  strokeOpacity!: number;
  invertImage!: boolean;
  imageMode!: string;

  constructor(
    filenameOrArray: string | NDArray,
    options: ImageMobjectOptions = {},
  ) {
    const {
      scaleToResolution = (QUALITIES as Record<string, { pixelHeight: number }>)[DEFAULT_QUALITY].pixelHeight,
      invert = false,
      imageMode = "RGBA",
      pixelArrayDtype = "uint8",
      ...rest
    } = options;

    // We need to set up the pixel array BEFORE super() calls resetPoints().
    // Use the static pending pattern from the base class, plus store
    // instance data in a static map keyed by a token.
    // Actually — simpler approach: store everything needed in statics,
    // then retrieve in the subclass's getPixelArray/resetPoints.
    ImageMobject._pendingFilenameOrArray = filenameOrArray;
    ImageMobject._pendingInvert = invert;
    ImageMobject._pendingImageMode = imageMode;
    ImageMobject._pendingPixelArrayDtype = pixelArrayDtype;
    ImageMobject._pendingInstanceInit = false;

    super(scaleToResolution, { pixelArrayDtype, ...rest });

    // After super(), fields are guaranteed set via _ensurePixelArray
    this.fillOpacity = 1;
    this.strokeOpacity = 1;
    this.invertImage = invert;
    this.imageMode = imageMode;
  }

  // Static temporaries for passing pixel data through super() constructor
  private static _pendingFilenameOrArray: string | NDArray = "";
  private static _pendingInvert: boolean = false;
  private static _pendingImageMode: string = "RGBA";
  private static _pendingPixelArrayDtype: string = "uint8";
  private static _pendingInstanceInit: boolean = false;

  /**
   * Ensure pixel array is initialized. Called from getPixelArray which
   * may be invoked during super() constructor via resetPoints().
   */
  private _ensurePixelArray(): void {
    if (this.pixelArray !== undefined) return;

    const filenameOrArray = ImageMobject._pendingFilenameOrArray;
    const invert = ImageMobject._pendingInvert;
    const dtype = ImageMobject._pendingPixelArrayDtype;

    if (typeof filenameOrArray === "string") {
      // File path — load synchronously is not possible with sharp,
      // so we store the path and create a placeholder pixel array.
      // TODO: Implement async image loading with sharp
      const path = getFullRasterImagePath(filenameOrArray);
      this.path = path;
      // Create a 1x1 RGBA placeholder — real loading requires async I/O
      this.pixelArray = np.array([[[255, 255, 255, 255]]]);
    } else {
      this.pixelArray = np.array(filenameOrArray.toArray());
    }

    this.pixelArray = changeToRgbaArray(this.pixelArray, dtype);

    if (invert) {
      this._invertPixelArrayRgb();
    }

    this.origAlphaPixelArray = this._extractAlphaChannel();
    this.invertImage = invert;
    ImageMobject._pendingInstanceInit = true;
  }

  /**
   * Invert RGB channels (not alpha) of the pixel array.
   */
  private _invertPixelArrayRgb(): void {
    const shape = this.pixelArray.shape as number[];
    const h = shape[0];
    const w = shape[1];
    const flat = flattenToNumbers(this.pixelArray);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const idx = (row * w + col) * 4;
        flat[idx] = 255 - flat[idx];
        flat[idx + 1] = 255 - flat[idx + 1];
        flat[idx + 2] = 255 - flat[idx + 2];
        // Alpha channel (idx+3) left unchanged
      }
    }

    this.pixelArray = rebuildFromFlat(flat, h, w, 4);
  }

  /**
   * Extract the alpha channel as a separate NDArray of shape [H, W].
   */
  private _extractAlphaChannel(): NDArray {
    const shape = this.pixelArray.shape as number[];
    const h = shape[0];
    const w = shape[1];
    const flat = flattenToNumbers(this.pixelArray);
    const alpha: number[][] = [];

    for (let row = 0; row < h; row++) {
      const rowArr: number[] = [];
      for (let col = 0; col < w; col++) {
        rowArr.push(flat[(row * w + col) * 4 + 3]);
      }
      alpha.push(rowArr);
    }

    return np.array(alpha);
  }

  getPixelArray(): PixelArray {
    this._ensurePixelArray();
    return this.pixelArray;
  }

  setColor(
    color: ParsableManimColor = YELLOW_C,
    family: boolean = true,
  ): this {
    const rgb = colorToIntRgb(color);
    const shape = this.pixelArray.shape as number[];
    const h = shape[0];
    const w = shape[1];
    const flat = flattenToNumbers(this.pixelArray);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const idx = (row * w + col) * 4;
        flat[idx] = rgb[0];
        flat[idx + 1] = rgb[1];
        flat[idx + 2] = rgb[2];
      }
    }

    this.pixelArray = rebuildFromFlat(flat, h, w, 4);

    if (family) {
      for (const submob of this.submobjects) {
        if (submob instanceof ImageMobject) {
          submob.setColor(color, family);
        }
      }
    }

    this.color = ManimColor.parse(color) as ManimColor;
    return this;
  }

  /**
   * Sets the image's opacity.
   *
   * @param alpha - The alpha value, 1 being opaque and 0 being transparent.
   */
  setOpacity(alpha: number): this {
    const shape = this.pixelArray.shape as number[];
    const h = shape[0];
    const w = shape[1];
    const flat = flattenToNumbers(this.pixelArray);
    const origFlat = flattenToNumbers(this.origAlphaPixelArray);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        flat[(row * w + col) * 4 + 3] = Math.round(origFlat[row * w + col] * alpha);
      }
    }

    this.pixelArray = rebuildFromFlat(flat, h, w, 4);
    this.strokeOpacity = alpha;
    return this;
  }

  /**
   * Sets the image's opacity using a 1 - alpha relationship.
   *
   * @param darkness - 1 being transparent and 0 being opaque.
   * @param family - Whether submobjects should also be affected.
   */
  fade(darkness: number = 0.5, family: boolean = true): this {
    this.setOpacity(1 - darkness);
    super.fade(darkness, family);
    return this;
  }

  /**
   * Interpolates pixel color values between two ImageMobjects.
   *
   * @param mobject1 - The ImageMobject to transform from.
   * @param mobject2 - The ImageMobject to transform into.
   * @param alpha - Interpolation parameter (0 = mobject1, 1 = mobject2).
   */
  interpolateColor(
    mobject1: ImageMobject,
    mobject2: ImageMobject,
    alpha: number,
  ): void {
    const shape1 = mobject1.pixelArray.shape as number[];
    const shape2 = mobject2.pixelArray.shape as number[];

    if (
      shape1[0] !== shape2[0] ||
      shape1[1] !== shape2[1] ||
      shape1[2] !== shape2[2]
    ) {
      throw new Error(
        `Mobject pixel array shapes incompatible for interpolation.\n` +
        `Mobject 1 (${mobject1}) : [${shape1}]\n` +
        `Mobject 2 (${mobject2}) : [${shape2}]`,
      );
    }

    this.fillOpacity = interpolate(
      mobject1.fillOpacity,
      mobject2.fillOpacity,
      alpha,
    ) as number;
    this.strokeOpacity = interpolate(
      mobject1.strokeOpacity,
      mobject2.strokeOpacity,
      alpha,
    ) as number;

    // Interpolate pixel arrays element-wise
    this.pixelArray = interpolate(
      mobject1.pixelArray,
      mobject2.pixelArray,
      alpha,
    ) as NDArray;
  }

  getStyle(): Record<string, unknown> {
    return {
      fillColor: this.color.toHex(),
      fillOpacity: this.fillOpacity,
    };
  }
}

// ─── ImageMobjectFromCamera ─────────────────────────────────────────────────

export interface ImageMobjectFromCameraOptions extends AbstractImageMobjectOptions {
  defaultDisplayFrameConfig?: Record<string, unknown>;
}

/**
 * An image mobject whose pixel data comes from a camera.
 *
 * Python: manim.mobject.types.image_mobject.ImageMobjectFromCamera
 */
export class ImageMobjectFromCamera extends AbstractImageMobject {
  camera: MovingCamera;
  defaultDisplayFrameConfig: Record<string, unknown>;
  pixelArray: PixelArray;
  displayFrame?: Mobject;

  constructor(
    camera: MovingCamera,
    options: ImageMobjectFromCameraOptions = {},
  ) {
    const {
      defaultDisplayFrameConfig,
      ...rest
    } = options;

    ImageMobjectFromCamera._pendingCamera = camera;

    super(false, rest);

    this.camera = camera;
    this.defaultDisplayFrameConfig = defaultDisplayFrameConfig ?? {
      strokeWidth: 3,
      strokeColor: WHITE,
      buff: 0,
    };
    // Refresh pixel array reference
    this.pixelArray = (this.camera as unknown as { pixelArray: PixelArray }).pixelArray;
  }

  private static _pendingCamera: MovingCamera | null = null;

  getPixelArray(): PixelArray {
    if (this.camera) {
      this.pixelArray = (this.camera as unknown as { pixelArray: PixelArray }).pixelArray;
    } else if (ImageMobjectFromCamera._pendingCamera) {
      const cam = ImageMobjectFromCamera._pendingCamera;
      this.pixelArray = (cam as unknown as { pixelArray: PixelArray }).pixelArray;
    }
    return this.pixelArray;
  }

  /**
   * Adds a display frame (SurroundingRectangle) around this image.
   *
   * TODO: Import SurroundingRectangle from geometry/shape_matchers once converted.
   */
  addDisplayFrame(frameConfig: Record<string, unknown> = {}): this {
    const mergedConfig = { ...this.defaultDisplayFrameConfig, ...frameConfig };
    // TODO: Replace with SurroundingRectangle once geometry/shape_matchers is converted
    // this.displayFrame = new SurroundingRectangle(this, mergedConfig);
    // this.add(this.displayFrame);
    void mergedConfig;
    return this;
  }

  /**
   * Interpolates pixel color values between two ImageMobjectFromCamera instances.
   */
  interpolateColor(
    mobject1: ImageMobjectFromCamera,
    mobject2: ImageMobjectFromCamera,
    alpha: number,
  ): void {
    const shape1 = mobject1.pixelArray.shape as number[];
    const shape2 = mobject2.pixelArray.shape as number[];

    if (
      shape1[0] !== shape2[0] ||
      shape1[1] !== shape2[1] ||
      shape1[2] !== shape2[2]
    ) {
      throw new Error(
        `Mobject pixel array shapes incompatible for interpolation.\n` +
        `Mobject 1 (${mobject1}) : [${shape1}]\n` +
        `Mobject 2 (${mobject2}) : [${shape2}]`,
      );
    }

    this.pixelArray = interpolate(
      mobject1.pixelArray,
      mobject2.pixelArray,
      alpha,
    ) as NDArray;
  }
}
