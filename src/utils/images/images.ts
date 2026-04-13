/**
 * Image manipulation utilities for manim-ts.
 * Python: manim.utils.images
 */

import { np } from "../../core/math/index.js";
import type { NDArray } from "../../core/math/index.js";
import sharp from "sharp";
import { join } from "path";

// ─── Type aliases ─────────────────────────────────────────────────────────────

/** Pixel array: uint8 NDArray with shape [H, W, C]. */
export type PixelArray = NDArray;

/** RGB pixel array: uint8 NDArray with shape [H, W, 3]. */
export type RGBPixelArray = NDArray;

/** RGBA pixel array: uint8 NDArray with shape [H, W, 4]. */
export type RGBAPixelArray = NDArray;

// ─── File path resolution ─────────────────────────────────────────────────────

/**
 * Supported raster image extensions.
 * TODO: Import from ../../utils/file_ops/index.js once that module is converted.
 */
const RASTER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".ico"] as const;

/**
 * Supported vector image extensions.
 * TODO: Import from ../../utils/file_ops/index.js once that module is converted.
 */
const VECTOR_EXTENSIONS = [".svg"] as const;

/**
 * Stub for seek_full_path_from_defaults.
 * TODO: Replace with real import from ../../utils/file_ops/index.js once converted.
 */
function seekFullPathFromDefaults(
  fileName: string,
  defaultDir: string,
  extensions: readonly string[],
): string {
  // If already has a recognized extension, return as-is (resolved against defaultDir if relative)
  const hasExt = extensions.some((ext) =>
    fileName.toLowerCase().endsWith(ext),
  );
  if (hasExt) {
    return join(defaultDir, fileName);
  }
  // Try appending each extension
  for (const ext of extensions) {
    const candidate = join(defaultDir, `${fileName}${ext}`);
    return candidate; // Return first candidate — real implementation would check fs
  }
  return join(defaultDir, fileName);
}

/**
 * Resolves the full filesystem path for a raster image file.
 *
 * Searches in the configured assets directory and supports .jpg, .jpeg,
 * .png, .gif, and .ico extensions.
 *
 * Python: `manim.utils.images.get_full_raster_image_path`
 *
 * @param imageFileName - File name or path relative to the assets directory.
 * @returns Resolved absolute path string.
 */
export function getFullRasterImagePath(imageFileName: string): string {
  // TODO: Replace with config.get_dir("assets_dir") once config exposes assetsDir.
  const assetsDir = "./assets";
  return seekFullPathFromDefaults(imageFileName, assetsDir, RASTER_EXTENSIONS);
}

/**
 * Resolves the full filesystem path for a vector image (SVG) file.
 *
 * Searches in the configured assets directory and supports .svg extension.
 *
 * Python: `manim.utils.images.get_full_vector_image_path`
 *
 * @param imageFileName - File name or path relative to the assets directory.
 * @returns Resolved absolute path string.
 */
export function getFullVectorImagePath(imageFileName: string): string {
  // TODO: Replace with config.get_dir("assets_dir") once config exposes assetsDir.
  const assetsDir = "./assets";
  return seekFullPathFromDefaults(imageFileName, assetsDir, VECTOR_EXTENSIONS);
}

// ─── Pixel array helpers ──────────────────────────────────────────────────────

/**
 * Flatten an NDArray to a plain number[] via toArray().
 * Works for any shape — equivalent to Python's `arr.flatten().tolist()`.
 */
function flattenToNumbers(arr: NDArray): number[] {
  const nested = arr.flatten().toArray();
  return nested as number[];
}

/**
 * Reconstruct a 3D NDArray from a flat Uint8Array given shape [H, W, C].
 */
function rebuildFromFlat(flat: Uint8Array, h: number, w: number, c: number): NDArray {
  const nums = Array.from(flat);
  // Build nested [H][W][C] array
  const result: number[][][] = [];
  for (let row = 0; row < h; row++) {
    const rowArr: number[][] = [];
    for (let col = 0; col < w; col++) {
      const pixel: number[] = [];
      for (let ch = 0; ch < c; ch++) {
        pixel.push(nums[row * w * c + col * c + ch]);
      }
      rowArr.push(pixel);
    }
    result.push(rowArr);
  }
  return np.array(result);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * "Drags" pixel values forward across frames: for each element position,
 * once a non-zero value appears in some frame it persists into all later frames.
 *
 * Equivalent to the Python operation:
 *   `curr += (curr == 0) * frame`   (element-wise, repeated for each frame)
 *
 * Python: `manim.utils.images.drag_pixels`
 *
 * @param frames - Sequence of pixel arrays with the same shape [H, W, C].
 * @returns New list of pixel arrays with dragged values.
 */
export function dragPixels(frames: PixelArray[]): NDArray[] {
  if (frames.length === 0) return [];

  const shape = frames[0].shape as number[];
  const h = shape[0];
  const w = shape[1];
  const c = shape[2] ?? 1;

  // Work with a flat Uint8Array for efficient element-wise mutation
  const currFlat = new Uint8Array(flattenToNumbers(frames[0]));
  const newFrames: NDArray[] = [];

  for (const frame of frames) {
    const frameFlat = new Uint8Array(flattenToNumbers(frame));
    // curr += (curr == 0) * frame  →  fill zeros in curr with frame values
    for (let i = 0; i < currFlat.length; i++) {
      if (currFlat[i] === 0) {
        currFlat[i] = frameFlat[i];
      }
    }
    newFrames.push(rebuildFromFlat(new Uint8Array(currFlat), h, w, c));
  }

  return newFrames;
}

/**
 * Inverts all pixel values in an image: `255 - pixel`.
 *
 * The alpha channel (if present) is also inverted, matching Python Manim's
 * behaviour of treating all channels uniformly.
 *
 * Python: `manim.utils.images.invert_image`
 *
 * @param image - Pixel array with shape [H, W, C].
 * @returns A `sharp` Sharp instance containing the inverted image buffer.
 */
export function invertImage(image: PixelArray): sharp.Sharp {
  const shape = image.shape as number[];
  const h = shape[0];
  const w = shape[1];
  const c = shape[2] ?? 1;

  const flat = new Uint8Array(flattenToNumbers(image));
  const inverted = new Uint8Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    inverted[i] = 255 - flat[i];
  }

  const buffer = Buffer.from(inverted.buffer);
  return sharp(buffer, {
    raw: { width: w, height: h, channels: c as 1 | 2 | 3 | 4 },
  });
}

/**
 * Converts an RGB (or greyscale) pixel array to RGBA by appending a fully
 * opaque alpha channel (value 255).
 *
 * Handles the following input shapes:
 * - `[H, W]`      → treated as `[H, W, 1]` (greyscale)
 * - `[H, W, 1]`   → repeated to `[H, W, 3]` then alpha-padded
 * - `[H, W, 3]`   → alpha channel appended → `[H, W, 4]`
 * - `[H, W, 4]`   → returned unchanged
 *
 * Python: `manim.utils.images.change_to_rgba_array`
 *
 * @param image - Input pixel array.
 * @param dtype - Unused (kept for API compatibility with Python).
 * @returns RGBA pixel array with shape `[H, W, 4]`.
 */
export function changeToRgbaArray(
  image: RGBPixelArray,
  _dtype: string = "uint8",
): RGBAPixelArray {
  const shape = image.shape as number[];
  let h = shape[0];
  let w = shape[1];
  let c = shape.length === 2 ? 1 : (shape[2] ?? 1);

  // Flatten source to a flat Uint8Array
  let flat = new Uint8Array(flattenToNumbers(image));

  // If 2D, reshape to [H, W, 1] — flat array is already correct length
  // (h * w * 1 == h * w)

  // If single channel, repeat to 3 channels
  if (c === 1) {
    const expanded = new Uint8Array(h * w * 3);
    for (let i = 0; i < h * w; i++) {
      const val = flat[i];
      expanded[i * 3] = val;
      expanded[i * 3 + 1] = val;
      expanded[i * 3 + 2] = val;
    }
    flat = expanded;
    c = 3;
  }

  // If 3 channels, append fully-opaque alpha
  if (c === 3) {
    const rgba = new Uint8Array(h * w * 4);
    for (let i = 0; i < h * w; i++) {
      rgba[i * 4] = flat[i * 3];
      rgba[i * 4 + 1] = flat[i * 3 + 1];
      rgba[i * 4 + 2] = flat[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    flat = rgba;
    c = 4;
  }

  // Rebuild as NDArray [H, W, 4]
  return rebuildFromFlat(flat, h, w, c);
}
