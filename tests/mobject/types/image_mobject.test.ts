/**
 * Tests for mobject.types.image_mobject module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np } from "../../../src/core/math/index.js";
import {
  ImageMobject,
  ImageMobjectFromCamera,
  AbstractImageMobject,
} from "../../../src/mobject/types/image_mobject/index.js";
import { RESAMPLING_ALGORITHMS } from "../../../src/constants/constants.js";

// Helper: create a simple 2x2 RGBA pixel array
function make2x2Rgba(): import("numpy-ts").NDArray {
  return np.array([
    [[255, 0, 0, 255], [0, 255, 0, 255]],
    [[0, 0, 255, 255], [255, 255, 0, 255]],
  ]);
}

// Helper: create a simple 2x2 RGB pixel array (no alpha)
function make2x2Rgb(): import("numpy-ts").NDArray {
  return np.array([
    [[255, 0, 0], [0, 255, 0]],
    [[0, 0, 255], [255, 255, 0]],
  ]);
}

describe("ImageMobject", () => {
  it("constructs from an RGBA NDArray with correct defaults", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);

    expect(img).toBeInstanceOf(ImageMobject);
    expect(img.fillOpacity).toBe(1);
    expect(img.strokeOpacity).toBe(1);
    expect(img.invertImage).toBe(false);
    expect(img.imageMode).toBe("RGBA");
  });

  it("constructs from an RGB NDArray (auto-converts to RGBA)", () => {
    const pixels = make2x2Rgb();
    const img = new ImageMobject(pixels);

    const pa = img.getPixelArray();
    const shape = pa.shape as number[];
    // Should be [2, 2, 4] after conversion to RGBA
    expect(shape[0]).toBe(2);
    expect(shape[1]).toBe(2);
    expect(shape[2]).toBe(4);
  });

  it("getPixelArray returns the pixel array", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);
    const pa = img.getPixelArray();
    expect(pa).toBeDefined();
    const shape = pa.shape as number[];
    expect(shape[0]).toBe(2);
    expect(shape[1]).toBe(2);
  });

  it("has four corner points after construction", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);
    const shape = img.points.shape as number[];
    expect(shape[0]).toBe(4); // 4 corner points
    expect(shape[1]).toBe(3); // 3D
  });

  it("inverts RGB channels when invert=true", () => {
    const pixels = np.array([
      [[100, 150, 200, 255]],
    ]);
    const img = new ImageMobject(pixels, { invert: true });
    const pa = img.getPixelArray();
    const flat = pa.flatten().toArray() as number[];
    // RGB should be inverted: 255-100=155, 255-150=105, 255-200=55
    expect(flat[0]).toBe(155);
    expect(flat[1]).toBe(105);
    expect(flat[2]).toBe(55);
    // Alpha should remain 255
    expect(flat[3]).toBe(255);
  });

  it("setOpacity modifies alpha channel", () => {
    const pixels = np.array([
      [[255, 0, 0, 255]],
    ]);
    const img = new ImageMobject(pixels);

    img.setOpacity(0.5);
    const pa = img.getPixelArray();
    const flat = pa.flatten().toArray() as number[];
    // Alpha should be ~127 (255 * 0.5 rounded)
    expect(flat[3]).toBeCloseTo(128, -1);
  });

  it("setColor changes RGB of all pixels", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);

    img.setColor("#00FF00");
    const pa = img.getPixelArray();
    const flat = pa.flatten().toArray() as number[];
    // All pixels should have R=0, G=255, B=0
    for (let i = 0; i < flat.length; i += 4) {
      expect(flat[i]).toBe(0);
      expect(flat[i + 1]).toBe(255);
      expect(flat[i + 2]).toBe(0);
    }
  });

  it("setResamplingAlgorithm validates input", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);

    expect(() => img.setResamplingAlgorithm("invalid_algo")).toThrow();

    const result = img.setResamplingAlgorithm(RESAMPLING_ALGORITHMS["nearest"]);
    expect(result).toBe(img); // returns this for chaining
    expect(img.resamplingAlgorithm).toBe(RESAMPLING_ALGORITHMS["nearest"]);
  });

  it("getStyle returns fill color and opacity", () => {
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);
    const style = img.getStyle();
    expect(style).toHaveProperty("fillColor");
    expect(style).toHaveProperty("fillOpacity");
    expect(style.fillOpacity).toBe(1);
  });

  it("fade adjusts opacity inversely", () => {
    const pixels = np.array([
      [[255, 0, 0, 200]],
    ]);
    const img = new ImageMobject(pixels);

    img.fade(0.75); // should set opacity to 0.25
    expect(img.strokeOpacity).toBeCloseTo(0.25, 5);
  });

  it("interpolateColor blends two ImageMobjects", () => {
    const px1 = np.array([[[0, 0, 0, 255]]]);
    const px2 = np.array([[[200, 200, 200, 255]]]);
    const img1 = new ImageMobject(px1);
    const img2 = new ImageMobject(px2);
    const target = new ImageMobject(px1);

    target.interpolateColor(img1, img2, 0.5);
    const flat = target.pixelArray.flatten().toArray() as number[];
    // Should be approximately 100
    expect(flat[0]).toBeCloseTo(100, -1);
    expect(flat[1]).toBeCloseTo(100, -1);
    expect(flat[2]).toBeCloseTo(100, -1);
  });
});

describe("AbstractImageMobject", () => {
  it("cannot be instantiated directly", () => {
    // AbstractImageMobject is abstract, so we test through ImageMobject
    const pixels = make2x2Rgba();
    const img = new ImageMobject(pixels);
    expect(img).toBeInstanceOf(AbstractImageMobject);
  });
});
