/**
 * Tests for src/utils/images/images.ts
 * Python: manim.utils.images
 */

import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import {
  dragPixels,
  invertImage,
  changeToRgbaArray,
  getFullRasterImagePath,
  getFullVectorImagePath,
} from "../../src/utils/images/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a tiny [H, W, C] NDArray from a nested number array.
 * Rows: outer array, columns: middle, channels: inner.
 */
function makePixelArray(data: number[][][]) {
  return np.array(data);
}

// ─── getFullRasterImagePath ───────────────────────────────────────────────────

describe("getFullRasterImagePath", () => {
  it("appends a raster extension when the filename has none", () => {
    const result = getFullRasterImagePath("logo");
    // Should contain a raster extension candidate
    expect([".jpg", ".jpeg", ".png", ".gif", ".ico"].some((ext) =>
      result.endsWith(ext),
    )).toBe(true);
  });

  it("keeps an existing .png extension", () => {
    const result = getFullRasterImagePath("logo.png");
    expect(result.endsWith(".png")).toBe(true);
  });

  it("keeps an existing .jpg extension", () => {
    const result = getFullRasterImagePath("photo.jpg");
    expect(result.endsWith(".jpg")).toBe(true);
  });
});

// ─── getFullVectorImagePath ───────────────────────────────────────────────────

describe("getFullVectorImagePath", () => {
  it("appends .svg when the filename has no extension", () => {
    const result = getFullVectorImagePath("icon");
    expect(result.endsWith(".svg")).toBe(true);
  });

  it("keeps an existing .svg extension", () => {
    const result = getFullVectorImagePath("diagram.svg");
    expect(result.endsWith(".svg")).toBe(true);
  });
});

// ─── dragPixels ───────────────────────────────────────────────────────────────

describe("dragPixels", () => {
  it("returns an empty array for empty input", () => {
    expect(dragPixels([])).toEqual([]);
  });

  it("first frame: curr starts as frame[0], so result matches frame[0]", () => {
    const frame = makePixelArray([[[100, 200, 50]]]);
    const result = dragPixels([frame]);
    expect(result).toHaveLength(1);
    const flat = result[0].flatten().toArray() as number[];
    expect(flat).toEqual([100, 200, 50]);
  });

  it("drags non-zero values forward: zero pixels are filled from later frames", () => {
    // Frame 0: pixel (0,0) channel 0 = 100, channels 1,2 = 0
    const frame0 = makePixelArray([[[100, 0, 0]]]);
    // Frame 1: pixel (0,0) all channels = 200
    const frame1 = makePixelArray([[[200, 200, 200]]]);

    const result = dragPixels([frame0, frame1]);
    expect(result).toHaveLength(2);

    // After frame0: curr = [100, 0, 0]
    const flat0 = result[0].flatten().toArray() as number[];
    expect(flat0).toEqual([100, 0, 0]);

    // After frame1: channel 0 already 100 (non-zero, not replaced),
    // channels 1 and 2 were 0 → filled from frame1 → 200
    const flat1 = result[1].flatten().toArray() as number[];
    expect(flat1).toEqual([100, 200, 200]);
  });

  it("non-zero values are never overwritten once set", () => {
    const frame0 = makePixelArray([[[50, 0, 0]]]);
    const frame1 = makePixelArray([[[99, 99, 99]]]);
    const frame2 = makePixelArray([[[1, 1, 1]]]);

    const result = dragPixels([frame0, frame1, frame2]);
    const flat2 = result[2].flatten().toArray() as number[];
    // channel 0: was 50 → never 0, so stays 50
    expect(flat2[0]).toBe(50);
  });
});

// ─── invertImage ─────────────────────────────────────────────────────────────

describe("invertImage", () => {
  it("returns a sharp instance", async () => {
    const image = makePixelArray([[[100, 150, 200]]]);
    const result = invertImage(image);
    // sharp.Sharp has a `toBuffer` method
    expect(typeof result.toBuffer).toBe("function");
  });

  it("produces correctly inverted pixel values in the output buffer", async () => {
    // 1×1 RGB pixel: [100, 150, 200]
    const image = makePixelArray([[[100, 150, 200]]]);
    const result = invertImage(image);
    const { data } = await result.raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(255 - 100); // 155
    expect(data[1]).toBe(255 - 150); // 105
    expect(data[2]).toBe(255 - 200); // 55
  });

  it("inverts a fully-white pixel to black", async () => {
    const image = makePixelArray([[[255, 255, 255]]]);
    const { data } = await invertImage(image).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
  });

  it("inverts a fully-black pixel to white", async () => {
    const image = makePixelArray([[[0, 0, 0]]]);
    const { data } = await invertImage(image).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(255);
    expect(data[2]).toBe(255);
  });
});

// ─── changeToRgbaArray ────────────────────────────────────────────────────────

describe("changeToRgbaArray", () => {
  it("adds a fully-opaque alpha channel to an RGB array", () => {
    const rgb = makePixelArray([[[255, 0, 128]]]);
    const rgba = changeToRgbaArray(rgb);
    const shape = rgba.shape as number[];
    expect(shape[2]).toBe(4);
    const flat = rgba.flatten().toArray() as number[];
    expect(flat).toEqual([255, 0, 128, 255]);
  });

  it("expands a single-channel [H,W,1] array to RGBA", () => {
    const grey = makePixelArray([[[200]]]);
    const rgba = changeToRgbaArray(grey);
    const shape = rgba.shape as number[];
    expect(shape[2]).toBe(4);
    const flat = rgba.flatten().toArray() as number[];
    // grey value repeated 3× then alpha 255
    expect(flat).toEqual([200, 200, 200, 255]);
  });

  it("returns a 4-channel array unchanged (still 4 channels)", () => {
    const existing = makePixelArray([[[100, 100, 100, 128]]]);
    const result = changeToRgbaArray(existing);
    const shape = result.shape as number[];
    expect(shape[2]).toBe(4);
    const flat = result.flatten().toArray() as number[];
    // 4-channel path falls through without modification
    expect(flat).toEqual([100, 100, 100, 128]);
  });

  it("preserves spatial dimensions (H and W)", () => {
    // 2×2 RGB image
    const rgb = makePixelArray([
      [[255, 0, 0], [0, 255, 0]],
      [[0, 0, 255], [100, 100, 100]],
    ]);
    const rgba = changeToRgbaArray(rgb);
    const shape = rgba.shape as number[];
    expect(shape[0]).toBe(2);
    expect(shape[1]).toBe(2);
    expect(shape[2]).toBe(4);
  });

  it("alpha channel is always 255 for each pixel", () => {
    const rgb = makePixelArray([
      [[10, 20, 30], [40, 50, 60]],
    ]);
    const rgba = changeToRgbaArray(rgb);
    const flat = rgba.flatten().toArray() as number[];
    // Pixels: [10,20,30,255, 40,50,60,255]
    expect(flat[3]).toBe(255);
    expect(flat[7]).toBe(255);
  });
});
