/**
 * Custom type definitions for manim-ts.
 *
 * TypeScript port of manim/typing.py.
 *
 * All NumPy array types map to NDArray from numpy-ts.
 * "Like" variants additionally accept plain JS tuples/arrays,
 * representing anything that can be converted to the strict NDArray form.
 */

import type { NDArray } from "numpy-ts";
import type { IMobject, IAnimation } from "../core/types.js";

// ─── Primitive data types ─────────────────────────────────────

/** A double-precision floating-point value (64 bits). */
export type ManimFloat = number;

/** A 64-bit integer. */
export type ManimInt = number;

// ─── Color types ─────────────────────────────────────────────

/** Data type used in ManimColorInternal: a double-precision float in [0, 1]. */
export type ManimColorDType = ManimFloat;

/**
 * ``shape: (3,)``
 * NDArray of 3 floats in [0, 1] representing an RGB color.
 */
export type FloatRGB = NDArray;

/**
 * ``shape: (3,)``
 * Anything convertible to a FloatRGB NDArray: [R, G, B] in [0, 1].
 */
export type FloatRGBLike = FloatRGB | [number, number, number];

/**
 * ``shape: (M, 3)``
 * NDArray of M rows of 3 floats representing RGB colors.
 */
export type FloatRGB_Array = NDArray;

/**
 * ``shape: (M, 3)``
 * Anything convertible to a FloatRGB_Array NDArray.
 */
export type FloatRGBLike_Array = FloatRGB_Array | ReadonlyArray<FloatRGBLike>;

/**
 * ``shape: (3,)``
 * NDArray of 3 integers in [0, 255] representing an RGB color.
 */
export type IntRGB = NDArray;

/**
 * ``shape: (3,)``
 * Anything convertible to an IntRGB NDArray: [R, G, B] in [0, 255].
 */
export type IntRGBLike = IntRGB | [number, number, number];

/**
 * ``shape: (4,)``
 * NDArray of 4 floats in [0, 1] representing an RGBA color.
 */
export type FloatRGBA = NDArray;

/**
 * ``shape: (4,)``
 * Anything convertible to a FloatRGBA NDArray: [R, G, B, A] in [0, 1].
 */
export type FloatRGBALike = FloatRGBA | [number, number, number, number];

/**
 * ``shape: (M, 4)``
 * NDArray of M rows of 4 floats representing RGBA colors.
 */
export type FloatRGBA_Array = NDArray;

/**
 * ``shape: (M, 4)``
 * Anything convertible to a FloatRGBA_Array NDArray.
 */
export type FloatRGBALike_Array = FloatRGBA_Array | ReadonlyArray<FloatRGBALike>;

/**
 * ``shape: (4,)``
 * NDArray of 4 integers in [0, 255] representing an RGBA color.
 */
export type IntRGBA = NDArray;

/**
 * ``shape: (4,)``
 * Anything convertible to an IntRGBA NDArray: [R, G, B, A] in [0, 255].
 */
export type IntRGBALike = IntRGBA | [number, number, number, number];

/**
 * ``shape: (3,)``
 * NDArray of 3 floats in [0, 1] representing an HSV (or HSB) color.
 */
export type FloatHSV = FloatRGB;

/**
 * ``shape: (3,)``
 * Anything convertible to a FloatHSV NDArray.
 */
export type FloatHSVLike = FloatRGBLike;

/**
 * ``shape: (4,)``
 * NDArray of 4 floats in [0, 1] representing an HSVA color.
 */
export type FloatHSVA = FloatRGBA;

/**
 * ``shape: (4,)``
 * Anything convertible to a FloatHSVA NDArray.
 */
export type FloatHSVALike = FloatRGBALike;

/**
 * ``shape: (3,)``
 * NDArray of 3 floats in [0, 1] representing an HSL color.
 */
export type FloatHSL = FloatRGB;

/**
 * ``shape: (3,)``
 * Anything convertible to a FloatHSL NDArray.
 */
export type FloatHSLLike = FloatRGBLike;

/**
 * ``shape: (4,)``
 * Internal RGBA color representation used by ManimColor.
 * 4 floats in [0, 1]: [R, G, B, A].
 */
export type ManimColorInternal = FloatRGBA;

// ─── Point types ─────────────────────────────────────────────

/** Default dtype for point arrays: double-precision float. */
export type PointDType = ManimFloat;

/**
 * ``shape: (2,)``
 * NDArray representing a 2D point: [x, y].
 */
export type Point2D = NDArray;

/**
 * ``shape: (2,)``
 * Anything convertible to a Point2D NDArray: [x, y].
 */
export type Point2DLike = Point2D | [number, number];

/**
 * ``shape: (M, 2)``
 * NDArray representing a sequence of Point2D objects.
 */
export type Point2D_Array = NDArray;

/**
 * ``shape: (M, 2)``
 * Anything convertible to a Point2D_Array NDArray.
 */
export type Point2DLike_Array = Point2D_Array | ReadonlyArray<Point2DLike>;

/**
 * ``shape: (3,)``
 * NDArray representing a 3D point: [x, y, z].
 */
export type Point3D = NDArray;

/**
 * ``shape: (3,)``
 * Anything convertible to a Point3D NDArray: [x, y, z].
 */
export type Point3DLike = Point3D | [number, number, number];

/**
 * ``shape: (M, 3)``
 * NDArray representing a sequence of Point3D objects.
 */
export type Point3D_Array = NDArray;

/**
 * ``shape: (M, 3)``
 * Anything convertible to a Point3D_Array NDArray.
 */
export type Point3DLike_Array = Point3D_Array | ReadonlyArray<Point3DLike>;

/**
 * ``shape: (N,)``
 * NDArray representing an N-dimensional point.
 */
export type PointND = NDArray;

/**
 * ``shape: (N,)``
 * Anything convertible to a PointND NDArray.
 */
export type PointNDLike = PointND | ReadonlyArray<number>;

/**
 * ``shape: (M, N)``
 * NDArray representing a sequence of PointND objects.
 */
export type PointND_Array = NDArray;

/**
 * ``shape: (M, N)``
 * Anything convertible to a PointND_Array NDArray.
 */
export type PointNDLike_Array = PointND_Array | ReadonlyArray<PointNDLike>;

// ─── Vector types ─────────────────────────────────────────────

/**
 * ``shape: (2,)``
 * NDArray representing a 2D vector: [x, y].
 *
 * Do not confuse with the Vector VMobject.
 */
export type Vector2D = NDArray;

/**
 * ``shape: (2,)``
 * Anything convertible to a Vector2D NDArray.
 */
export type Vector2DLike = NDArray | [number, number];

/**
 * ``shape: (M, 2)``
 * NDArray representing a sequence of Vector2D objects.
 */
export type Vector2D_Array = NDArray;

/**
 * ``shape: (M, 2)``
 * Anything convertible to a Vector2D_Array NDArray.
 */
export type Vector2DLike_Array = Vector2D_Array | ReadonlyArray<Vector2DLike>;

/**
 * ``shape: (3,)``
 * NDArray representing a 3D vector: [x, y, z].
 *
 * Do not confuse with the Vector VMobject.
 */
export type Vector3D = NDArray;

/**
 * ``shape: (3,)``
 * Anything convertible to a Vector3D NDArray.
 */
export type Vector3DLike = NDArray | [number, number, number];

/**
 * ``shape: (M, 3)``
 * NDArray representing a sequence of Vector3D objects.
 */
export type Vector3D_Array = NDArray;

/**
 * ``shape: (M, 3)``
 * Anything convertible to a Vector3D_Array NDArray.
 */
export type Vector3DLike_Array = NDArray | ReadonlyArray<Vector3DLike>;

/**
 * ``shape: (N,)``
 * NDArray representing an N-dimensional vector.
 *
 * Named VectorND (not Vector) to avoid collision with the Vector VMobject.
 */
export type VectorND = NDArray;

/**
 * ``shape: (N,)``
 * Anything convertible to a VectorND NDArray.
 */
export type VectorNDLike = NDArray | ReadonlyArray<number>;

/**
 * ``shape: (M, N)``
 * NDArray representing a sequence of VectorND objects.
 */
export type VectorND_Array = NDArray;

/**
 * ``shape: (M, N)``
 * Anything convertible to a VectorND_Array NDArray.
 */
export type VectorNDLike_Array = NDArray | ReadonlyArray<VectorNDLike>;

/**
 * ``shape: (1, N)``
 * A row vector: [[x, y, ...]].
 */
export type RowVector = NDArray;

/**
 * ``shape: (N, 1)``
 * A column vector: [[x], [y], ...].
 */
export type ColVector = NDArray;

// ─── Matrix types ─────────────────────────────────────────────

/**
 * ``shape: (M, N)``
 * An M×N matrix of floats.
 */
export type MatrixMN = NDArray;

/**
 * ``shape: (M, N)``
 * A MatrixMN filled with zeros, typically from np.zeros([M, N]).
 */
export type Zeros = MatrixMN;

// ─── Bézier types ─────────────────────────────────────────────

/**
 * ``shape: (3, 3)``
 * Three 3D control points for a single quadratic Bézier curve.
 */
export type QuadraticBezierPoints = Point3D_Array;

/**
 * ``shape: (3, 3)``
 * Anything convertible to QuadraticBezierPoints.
 */
export type QuadraticBezierPointsLike =
  | QuadraticBezierPoints
  | [Point3DLike, Point3DLike, Point3DLike];

/**
 * ``shape: (N, 3, 3)``
 * NDArray of N QuadraticBezierPoints objects.
 */
export type QuadraticBezierPoints_Array = NDArray;

/**
 * ``shape: (N, 3, 3)``
 * Anything convertible to a QuadraticBezierPoints_Array NDArray.
 */
export type QuadraticBezierPointsLike_Array =
  | QuadraticBezierPoints_Array
  | ReadonlyArray<QuadraticBezierPointsLike>;

/**
 * ``shape: (3*N, 3)``
 * 3N points where each block of 3 is a quadratic Bézier curve.
 */
export type QuadraticBezierPath = Point3D_Array;

/**
 * ``shape: (3*N, 3)``
 * Anything convertible to a QuadraticBezierPath NDArray.
 */
export type QuadraticBezierPathLike = Point3DLike_Array;

/**
 * ``shape: (3*N, 3)``
 * A QuadraticBezierPath where all N curves are connected (a quadratic spline).
 */
export type QuadraticSpline = QuadraticBezierPath;

/**
 * ``shape: (3*N, 3)``
 * Anything convertible to a QuadraticSpline NDArray.
 */
export type QuadraticSplineLike = QuadraticBezierPathLike;

/**
 * ``shape: (4, 3)``
 * Four 3D control points for a single cubic Bézier curve.
 */
export type CubicBezierPoints = Point3D_Array;

/**
 * ``shape: (4, 3)``
 * Anything convertible to CubicBezierPoints.
 */
export type CubicBezierPointsLike =
  | CubicBezierPoints
  | [Point3DLike, Point3DLike, Point3DLike, Point3DLike];

/**
 * ``shape: (N, 4, 3)``
 * NDArray of N CubicBezierPoints objects.
 */
export type CubicBezierPoints_Array = NDArray;

/**
 * ``shape: (N, 4, 3)``
 * Anything convertible to a CubicBezierPoints_Array NDArray.
 */
export type CubicBezierPointsLike_Array =
  | CubicBezierPoints_Array
  | ReadonlyArray<CubicBezierPointsLike>;

/**
 * ``shape: (4*N, 3)``
 * 4N points where each block of 4 is a cubic Bézier curve.
 */
export type CubicBezierPath = Point3D_Array;

/**
 * ``shape: (4*N, 3)``
 * Anything convertible to a CubicBezierPath NDArray.
 */
export type CubicBezierPathLike = Point3DLike_Array;

/**
 * ``shape: (4*N, 3)``
 * A CubicBezierPath where all N curves are connected (a cubic spline).
 */
export type CubicSpline = CubicBezierPath;

/**
 * ``shape: (4*N, 3)``
 * Anything convertible to a CubicSpline NDArray.
 */
export type CubicSplineLike = CubicBezierPathLike;

/**
 * ``shape: (PPC, 3)``
 * PPC (Points Per Curve = n+1) control points for a single nth-degree Bézier curve.
 */
export type BezierPoints = Point3D_Array;

/**
 * ``shape: (PPC, 3)``
 * Anything convertible to a BezierPoints NDArray.
 */
export type BezierPointsLike = Point3DLike_Array;

/**
 * ``shape: (N, PPC, 3)``
 * NDArray of N BezierPoints objects.
 */
export type BezierPoints_Array = NDArray;

/**
 * ``shape: (N, PPC, 3)``
 * Anything convertible to a BezierPoints_Array NDArray.
 */
export type BezierPointsLike_Array =
  | BezierPoints_Array
  | ReadonlyArray<BezierPointsLike>;

/**
 * ``shape: (PPC*N, 3)``
 * PPC*N points where each block of PPC is an nth-degree Bézier curve.
 */
export type BezierPath = Point3D_Array;

/**
 * ``shape: (PPC*N, 3)``
 * Anything convertible to a BezierPath NDArray.
 */
export type BezierPathLike = Point3DLike_Array;

/**
 * ``shape: (PPC*N, 3)``
 * A BezierPath where all N curves are connected, forming a spline.
 */
export type Spline = BezierPath;

/**
 * ``shape: (PPC*N, 3)``
 * Anything convertible to a Spline NDArray.
 */
export type SplineLike = BezierPathLike;

/**
 * ``shape: (3*PPC*N,)``
 * A flattened 1D array of Bézier control points.
 */
export type FlatBezierPoints = NDArray | readonly number[];

// ─── Function types ───────────────────────────────────────────

/**
 * A function that returns an IAnimation for a given IMobject.
 * Python: Callable (FunctionOverride)
 */
export type FunctionOverride = (
  mobject: IMobject,
  ...args: unknown[]
) => IAnimation;

/**
 * A function mapping two Point3DLike values and an alpha in [0,1] to a new
 * Point3DLike, used for path interpolation.
 */
export type PathFuncType = (
  start: Point3DLike,
  end: Point3DLike,
  alpha: number,
) => Point3DLike;

/**
 * A function mapping a Point3D to another Point3D.
 */
export type MappingFunction = (point: Point3D) => Point3D;

/**
 * A function mapping a Point3D_Array to another Point3D_Array.
 */
export type MultiMappingFunction = (points: Point3D_Array) => Point3D_Array;

// ─── Image types ──────────────────────────────────────────────

/**
 * ``shape: (height, width) | (height, width, 3) | (height, width, 4)``
 * Rasterized image where every value is an integer in [0, 255].
 */
export type PixelArray = NDArray;

/**
 * ``shape: (height, width)``
 * Grayscale PixelArray where each value indicates lightness.
 */
export type GrayscalePixelArray = PixelArray;

/**
 * ``shape: (height, width, 3)``
 * RGB PixelArray (fully opaque).
 */
export type RGBPixelArray = PixelArray;

/**
 * ``shape: (height, width, 4)``
 * RGBA PixelArray with per-pixel alpha.
 */
export type RGBAPixelArray = PixelArray;

// ─── Path types ───────────────────────────────────────────────

/**
 * A string or URL representing a path to a directory or file.
 * Python: str | PathLike[str]
 */
export type StrPath = string | URL;

/**
 * A string, bytes, or URL representing a path to a directory or file.
 * Python: str | bytes | PathLike[str] | PathLike[bytes]
 */
export type StrOrBytesPath = string | Uint8Array | URL;
