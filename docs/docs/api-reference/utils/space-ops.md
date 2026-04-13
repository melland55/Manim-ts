---
title: Space Operations
sidebar_position: 5
---

# Space Operations

Spatial math utilities for working with vectors, angles, coordinate transformations, and geometric operations. These functions operate on `Point3D` (NDArray of shape [3]) and are built on top of numpy-ts.

```ts
import {
  rotateVector,
  getUnitNormal,
  angleOfVector,
  angleBetweenVectors,
  complexToR3,
  r3ToComplex,
  cartesianToSpherical,
  sphericalToCartesian,
  findIntersection,
  centerOfMass,
} from "manim-ts";
```

## Vector Operations

### `rotateVector(vector: Point3D, angle: number, axis?: Point3D): Point3D`

Rotates a vector by the given angle (in radians). For 2D rotation, only `vector` and `angle` are needed. For 3D rotation, specify the rotation `axis`.

```ts
// 2D rotation: rotate RIGHT by 90 degrees
rotateVector(RIGHT, PI / 2);
// => approximately [0, 1, 0] (UP)

// 3D rotation: rotate around z-axis
rotateVector(np.array([1, 0, 0]), PI / 2, OUT);
// => approximately [0, 1, 0]
```

### `getUnitNormal(v1: Point3D, v2: Point3D): Point3D`

Returns the unit normal vector perpendicular to the plane defined by two vectors. Computed via the cross product and normalized.

```ts
getUnitNormal(RIGHT, UP);
// => [0, 0, 1] (OUT)

getUnitNormal(RIGHT, OUT);
// => [0, -1, 0] (DOWN)
```

### `angleOfVector(vector: Point3D): number`

Returns the angle of a 2D vector relative to the positive x-axis, in radians. Range: `(-PI, PI]`.

```ts
angleOfVector(RIGHT);           // => 0
angleOfVector(UP);              // => PI / 2
angleOfVector(LEFT);            // => PI
angleOfVector(np.array([1, 1, 0])); // => PI / 4
```

### `angleBetweenVectors(v1: Point3D, v2: Point3D): number`

Returns the unsigned angle between two vectors, in radians. Range: `[0, PI]`.

```ts
angleBetweenVectors(RIGHT, UP);    // => PI / 2
angleBetweenVectors(RIGHT, LEFT);  // => PI
angleBetweenVectors(RIGHT, RIGHT); // => 0
```

### `normalize(vector: Point3D): Point3D`

Returns the unit vector in the same direction. If the input is the zero vector, returns the zero vector.

```ts
normalize(np.array([3, 4, 0]));
// => [0.6, 0.8, 0]
```

### `cross(v1: Point3D, v2: Point3D): Point3D`

Computes the cross product of two 3D vectors.

```ts
cross(RIGHT, UP);  // => OUT ([0, 0, 1])
cross(UP, RIGHT);  // => IN  ([0, 0, -1])
```

## Complex Number Operations

manim-ts represents complex numbers as 2D points in the xy-plane, with x as the real part and y as the imaginary part.

### `complexToR3(z: [number, number]): Point3D`

Converts a complex number `[real, imag]` to a 3D point `[real, imag, 0]`.

```ts
complexToR3([3, 4]);
// => [3, 4, 0]
```

### `r3ToComplex(point: Point3D): [number, number]`

Extracts the real and imaginary parts from a 3D point.

```ts
r3ToComplex(np.array([3, 4, 0]));
// => [3, 4]
```

### `complexMultiply(z1: [number, number], z2: [number, number]): [number, number]`

Multiplies two complex numbers.

```ts
complexMultiply([1, 2], [3, 4]);
// => [-5, 10]  (i.e., (1+2i)(3+4i) = -5+10i)
```

This is used internally for conformal mappings and complex transformations.

## Coordinate Transforms

### `cartesianToSpherical(point: Point3D): [number, number, number]`

Converts Cartesian `[x, y, z]` coordinates to spherical `[r, theta, phi]` coordinates.

- **r** -- Radial distance from origin
- **theta** -- Azimuthal angle in xy-plane from positive x-axis
- **phi** -- Polar angle from positive z-axis

```ts
cartesianToSpherical(np.array([1, 0, 0]));
// => [1, 0, PI/2]  (on x-axis, in xy-plane)

cartesianToSpherical(np.array([0, 0, 1]));
// => [1, 0, 0]  (on z-axis)
```

### `sphericalToCartesian(r: number, theta: number, phi: number): Point3D`

Converts spherical coordinates back to Cartesian.

```ts
sphericalToCartesian(1, 0, PI / 2);
// => approximately [1, 0, 0]

sphericalToCartesian(1, PI / 2, PI / 2);
// => approximately [0, 1, 0]
```

## Line Operations

### `findIntersection(p0: Point3D, v0: Point3D, p1: Point3D, v1: Point3D): Point3D`

Finds the intersection point of two lines in 2D/3D space. Each line is defined by a point and a direction vector.

- **p0, v0** -- First line: point and direction
- **p1, v1** -- Second line: point and direction

```ts
// Intersection of y=x and y=-x+2
findIntersection(
  np.array([0, 0, 0]), np.array([1, 1, 0]),   // y = x
  np.array([0, 2, 0]), np.array([1, -1, 0]),   // y = -x + 2
);
// => [1, 1, 0]
```

Returns the closest point if the lines are skew (non-intersecting in 3D).

### `lineIntersection(line1: [Point3D, Point3D], line2: [Point3D, Point3D]): Point3D`

Alternative interface that takes two endpoint pairs instead of point-direction pairs.

```ts
lineIntersection(
  [np.array([0, 0, 0]), np.array([2, 2, 0])],
  [np.array([0, 2, 0]), np.array([2, 0, 0])],
);
// => [1, 1, 0]
```

## Mass Operations

### `centerOfMass(points: Point3D[]): Point3D`

Returns the centroid (arithmetic mean) of a set of points.

```ts
centerOfMass([
  np.array([0, 0, 0]),
  np.array([2, 0, 0]),
  np.array([1, 2, 0]),
]);
// => [1, 0.667, 0]
```

This is used extensively for positioning mobjects at the center of groups and for computing mobject centers.

## Compass Directions

manim-ts provides standard direction constants as `Point3D` values:

```ts
const RIGHT = np.array([1, 0, 0]);
const LEFT  = np.array([-1, 0, 0]);
const UP    = np.array([0, 1, 0]);
const DOWN  = np.array([0, -1, 0]);
const OUT   = np.array([0, 0, 1]);
const IN    = np.array([0, 0, -1]);
const ORIGIN = np.array([0, 0, 0]);

// Diagonal directions
const UL = np.array([-1, 1, 0]);   // Upper left
const UR = np.array([1, 1, 0]);    // Upper right
const DL = np.array([-1, -1, 0]);  // Down left
const DR = np.array([1, -1, 0]);   // Down right
```
