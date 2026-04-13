/**
 * Tests for the typing module.
 *
 * Since the module is entirely type aliases (no runtime values), these tests
 * verify that:
 *   1. Named exports exist (importable without error).
 *   2. The types correctly accept/reject values at runtime via duck-typing.
 *   3. NDArray-based types round-trip through numpy-ts operations.
 *   4. Function types accept correctly-shaped callables.
 */

import { describe, it, expect } from "vitest";
import { np } from "../src/core/math/index.js";
import type {
  ManimFloat,
  ManimInt,
  FloatRGB,
  FloatRGBLike,
  FloatRGBA,
  FloatRGBALike,
  IntRGB,
  IntRGBA,
  Point2D,
  Point2DLike,
  Point3D,
  Point3DLike,
  Point3D_Array,
  Point3DLike_Array,
  PointND,
  Vector3D,
  MatrixMN,
  QuadraticBezierPoints,
  CubicBezierPoints,
  BezierPath,
  FlatBezierPoints,
  PathFuncType,
  MappingFunction,
  MultiMappingFunction,
  PixelArray,
  StrPath,
  StrOrBytesPath,
} from "../src/typing/index.js";

// ─── Primitive types ─────────────────────────────────────────

describe("ManimFloat / ManimInt", () => {
  it("ManimFloat accepts number values", () => {
    const f: ManimFloat = 3.14;
    expect(typeof f).toBe("number");
  });

  it("ManimInt accepts integer number values", () => {
    const n: ManimInt = 42;
    expect(Number.isInteger(n)).toBe(true);
  });
});

// ─── Color types ─────────────────────────────────────────────

describe("Color types", () => {
  it("FloatRGB is an NDArray of shape [3]", () => {
    const rgb: FloatRGB = np.array([0.5, 0.3, 0.8]);
    expect(rgb.shape).toEqual([3]);
  });

  it("FloatRGBLike accepts a plain tuple", () => {
    const like: FloatRGBLike = [0.1, 0.2, 0.3];
    expect(like).toHaveLength(3);
  });

  it("FloatRGBA is an NDArray of shape [4]", () => {
    const rgba: FloatRGBA = np.array([1.0, 0.5, 0.0, 1.0]);
    expect(rgba.shape).toEqual([4]);
  });

  it("FloatRGBALike accepts a plain tuple", () => {
    const like: FloatRGBALike = [0.0, 0.5, 1.0, 0.8];
    expect(like).toHaveLength(4);
  });

  it("IntRGB accepts an NDArray of integers", () => {
    const rgb: IntRGB = np.array([255, 128, 0]);
    expect(rgb.shape).toEqual([3]);
  });

  it("IntRGBA accepts an NDArray of 4 integers", () => {
    const rgba: IntRGBA = np.array([255, 128, 0, 200]);
    expect(rgba.shape).toEqual([4]);
  });
});

// ─── Point types ─────────────────────────────────────────────

describe("Point types", () => {
  it("Point2D is an NDArray of shape [2]", () => {
    const p: Point2D = np.array([1.0, 2.0]);
    expect(p.shape).toEqual([2]);
  });

  it("Point2DLike accepts a plain [x, y] tuple", () => {
    const like: Point2DLike = [3.0, 4.0];
    expect(like).toHaveLength(2);
  });

  it("Point3D is an NDArray of shape [3]", () => {
    const p: Point3D = np.array([1.0, 2.0, 3.0]);
    expect(p.shape).toEqual([3]);
  });

  it("Point3DLike accepts a plain [x, y, z] tuple", () => {
    const like: Point3DLike = [1.0, 2.0, 3.0];
    expect(like).toHaveLength(3);
  });

  it("Point3D_Array is an NDArray of shape [N, 3]", () => {
    const arr: Point3D_Array = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(arr.shape).toEqual([3, 3]);
  });

  it("Point3DLike_Array accepts a JS array of tuples", () => {
    const arr: Point3DLike_Array = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    expect(arr).toHaveLength(3);
  });

  it("PointND accepts an NDArray of arbitrary dimension", () => {
    const p: PointND = np.array([1.0, 2.0, 3.0, 4.0, 5.0]);
    expect(p.shape).toEqual([5]);
  });
});

// ─── Vector types ─────────────────────────────────────────────

describe("Vector types", () => {
  it("Vector3D is an NDArray of shape [3]", () => {
    const v: Vector3D = np.array([0.0, 1.0, 0.0]);
    expect(v.shape).toEqual([3]);
  });
});

// ─── Matrix types ─────────────────────────────────────────────

describe("Matrix types", () => {
  it("MatrixMN is an NDArray of shape [M, N]", () => {
    const m: MatrixMN = np.zeros([4, 4]);
    expect(m.shape).toEqual([4, 4]);
  });
});

// ─── Bézier types ─────────────────────────────────────────────

describe("Bézier types", () => {
  it("QuadraticBezierPoints is an NDArray of shape [3, 3]", () => {
    const pts: QuadraticBezierPoints = np.array([
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
    ]);
    expect(pts.shape).toEqual([3, 3]);
  });

  it("CubicBezierPoints is an NDArray of shape [4, 3]", () => {
    const pts: CubicBezierPoints = np.array([
      [0, 0, 0],
      [1, 2, 0],
      [2, 2, 0],
      [3, 0, 0],
    ]);
    expect(pts.shape).toEqual([4, 3]);
  });

  it("BezierPath is an NDArray with shape [4*N, 3]", () => {
    // Two cubic Bézier curves → 8 points
    const path: BezierPath = np.zeros([8, 3]);
    expect(path.shape).toEqual([8, 3]);
  });

  it("FlatBezierPoints accepts a plain JS array", () => {
    const flat: FlatBezierPoints = [0, 0, 0, 1, 1, 0, 2, 0, 0];
    expect(Array.isArray(flat)).toBe(true);
  });

  it("FlatBezierPoints accepts an NDArray", () => {
    const flat: FlatBezierPoints = np.array([0, 0, 0, 1, 1, 0, 2, 0, 0]);
    expect(flat.shape).toEqual([9]);
  });
});

// ─── Function types ───────────────────────────────────────────

describe("Function types", () => {
  it("MappingFunction maps a Point3D to a Point3D", () => {
    const fn: MappingFunction = (p) => np.array(p.toArray() as number[]).multiply(2) as Point3D;
    const input = np.array([1.0, 2.0, 3.0]);
    const output = fn(input);
    expect(output.shape).toEqual([3]);
  });

  it("MultiMappingFunction maps a Point3D_Array to a Point3D_Array", () => {
    const fn: MultiMappingFunction = (pts) => pts;
    const input = np.zeros([5, 3]);
    const output = fn(input);
    expect(output.shape).toEqual([5, 3]);
  });

  it("PathFuncType accepts start, end, alpha and returns a Point3DLike", () => {
    const lerp: PathFuncType = (start, end, alpha) => {
      if (Array.isArray(start) && Array.isArray(end)) {
        return start.map((s, i) => s + (end[i] - s) * alpha) as [number, number, number];
      }
      return start;
    };
    const result = lerp([0, 0, 0], [1, 0, 0], 0.5);
    expect(result).toEqual([0.5, 0, 0]);
  });
});

// ─── Image types ──────────────────────────────────────────────

describe("Image types", () => {
  it("PixelArray is an NDArray representing an image", () => {
    // Grayscale 4x4 image
    const img: PixelArray = np.zeros([4, 4]);
    expect(img.shape).toEqual([4, 4]);
  });
});

// ─── Path types ───────────────────────────────────────────────

describe("Path types", () => {
  it("StrPath accepts a string", () => {
    const p: StrPath = "./output/scene.mp4";
    expect(typeof p).toBe("string");
  });

  it("StrPath accepts a URL", () => {
    const p: StrPath = new URL("file:///tmp/scene.mp4");
    expect(p).toBeInstanceOf(URL);
  });

  it("StrOrBytesPath accepts a string", () => {
    const p: StrOrBytesPath = "/tmp/frame.png";
    expect(typeof p).toBe("string");
  });

  it("StrOrBytesPath accepts Uint8Array bytes", () => {
    const p: StrOrBytesPath = new Uint8Array([47, 116, 109, 112]);
    expect(p).toBeInstanceOf(Uint8Array);
  });
});
