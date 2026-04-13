---
title: Math
sidebar_position: 1
---

# Math

The core math module (`src/core/math/index.ts`) is the numerical foundation of manim-ts. It re-exports **numpy-ts** as the `np` namespace, provides direction and math constants, and implements Manim-specific utilities for points, angles, bezier curves, quaternions, and matrix transforms.

```typescript
import {
  np, ORIGIN, UP, DOWN, LEFT, RIGHT, OUT, IN,
  PI, TAU, DEGREES,
  point3D, interpolate, bezier, rotationMatrix,
  smooth, linear,
} from "manim-ts/core/math";
```

---

## numpy-ts (`np` namespace)

The `np` namespace mirrors Python NumPy almost exactly. All agents and user code should use `np.*` functions for array math.

### Types

| Type | Description |
|------|-------------|
| `NDArray` | N-dimensional array from numpy-ts |
| `Point3D` | `NDArray` with shape `[3]` -- a single 3D point |
| `Points3D` | `NDArray` with shape `[n, 3]` -- an array of 3D points |

### Common Functions

| Function | Description |
|----------|-------------|
| `np.array(data)` | Create an NDArray from nested JS arrays |
| `np.zeros(shape)` | Array of zeros |
| `np.ones(shape)` | Array of ones |
| `np.full(shape, value)` | Array filled with a value |
| `np.empty(shape)` | Uninitialized array |
| `np.arange(start, stop, step)` | Evenly spaced values in a range |
| `np.linspace(start, stop, num)` | Evenly spaced values over an interval |
| `np.logspace(start, stop, num)` | Log-spaced values |
| `np.eye(n)` | Identity matrix |
| `np.diag(v)` | Diagonal matrix from vector |
| `np.dot(a, b)` | Dot product |
| `np.cross(a, b)` | Cross product |
| `np.matmul(a, b)` | Matrix multiplication |
| `np.vstack(arrays)` | Stack arrays vertically |
| `np.hstack(arrays)` | Stack arrays horizontally |
| `np.concatenate(arrays, axis)` | Join arrays along an axis |
| `np.reshape(a, shape)` | Reshape an array |
| `np.transpose(a)` | Transpose |
| `np.clip(a, min, max)` | Clip values to a range |
| `np.sum(a, axis)` | Sum along axis |
| `np.mean(a, axis)` | Mean along axis |
| `np.sort(a)` | Sort values |
| `np.where(cond, x, y)` | Conditional selection |
| `np.allclose(a, b)` | Element-wise approximate equality |
| `np.linalg.norm(v)` | Vector/matrix norm |
| `np.linalg.solve(a, b)` | Solve linear system |

### Python to TypeScript

```python
# Python
import numpy as np
v = np.array([1, 2, 3])
m = np.zeros((3, 3))
result = np.dot(v, v)
solution = np.linalg.solve(A, b)
```

```typescript
// TypeScript
import { np } from "manim-ts/core/math";
const v = np.array([1, 2, 3]);
const m = np.zeros([3, 3]);
const result = np.dot(v, v);
const solution = np.linalg.solve(A, b);
```

:::note
Shape tuples use JS array syntax `[3, 3]` instead of Python tuple syntax `(3, 3)`.
:::

---

## Direction Constants

All direction constants are `Point3D` (NDArray of shape `[3]`).

| Constant | Value | Description |
|----------|-------|-------------|
| `ORIGIN` | `[0, 0, 0]` | The origin |
| `UP` | `[0, 1, 0]` | Positive y direction |
| `DOWN` | `[0, -1, 0]` | Negative y direction |
| `LEFT` | `[-1, 0, 0]` | Negative x direction |
| `RIGHT` | `[1, 0, 0]` | Positive x direction |
| `OUT` | `[0, 0, 1]` | Positive z direction (toward the viewer) |
| `IN` | `[0, 0, -1]` | Negative z direction (away from the viewer) |

### Python to TypeScript

```python
# Python
from manim import UP, DOWN, LEFT, RIGHT
obj.shift(UP * 2 + RIGHT)
```

```typescript
// TypeScript
import { UP, RIGHT, np } from "manim-ts/core/math";
obj.shift(UP.multiply(2).add(RIGHT));
```

---

## Math Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PI` | `Math.PI` (~3.14159) | Pi |
| `TAU` | `2 * Math.PI` (~6.28318) | Full circle in radians |
| `DEGREES` | `TAU / 360` (~0.01745) | Multiply to convert degrees to radians |

### Python to TypeScript

```python
# Python
from manim import PI, TAU, DEGREES
angle = 45 * DEGREES
```

```typescript
// TypeScript
import { PI, TAU, DEGREES } from "manim-ts/core/math";
const angle = 45 * DEGREES;
```

---

## Point Helpers

Functions for creating and operating on `Point3D` values.

### `point3D(x, y, z)`

Create a `Point3D` from three numbers. Thin wrapper over `np.array()`.

```typescript
const p = point3D(1, 2, 3); // equivalent to np.array([1, 2, 3])
```

### `pointNorm(p)`

Euclidean norm of a vector. Equivalent to `np.linalg.norm(v)`.

```typescript
pointNorm(point3D(3, 4, 0)); // 5
```

### `normalizePoint(p)`

Normalize a vector to unit length. Returns `np.zeros([3])` for zero vectors.

```typescript
normalizePoint(point3D(3, 0, 0)); // [1, 0, 0]
```

### `dotProduct(a, b)`

Dot product of two `Point3D` vectors.

```typescript
dotProduct(point3D(1, 0, 0), point3D(0, 1, 0)); // 0
```

### `crossProduct(a, b)`

Cross product of two `Point3D` vectors.

```typescript
crossProduct(RIGHT, UP); // OUT = [0, 0, 1]
```

### `pointDistance(a, b)`

Euclidean distance between two points.

```typescript
pointDistance(ORIGIN, point3D(3, 4, 0)); // 5
```

### `interpolatePoint(a, b, t)`

Linearly interpolate between two points.

```typescript
interpolatePoint(LEFT, RIGHT, 0.5); // ORIGIN
```

### `midPoint(a, b)`

Midpoint between two points. Shorthand for `interpolatePoint(a, b, 0.5)`.

```typescript
midPoint(point3D(0, 0, 0), point3D(2, 4, 6)); // [1, 2, 3]
```

### `centerOfMass(points)`

Center of mass (mean) of an array of points. Accepts `Points3D` (NDArray `[n,3]`) or `Point3D[]`.

```typescript
centerOfMass([point3D(0, 0, 0), point3D(2, 0, 0)]); // [1, 0, 0]
```

### Python to TypeScript

```python
# Python
from manim.utils.space_ops import normalize
v = normalize(np.array([3, 4, 0]))
```

```typescript
// TypeScript
import { normalizePoint, point3D } from "manim-ts/core/math";
const v = normalizePoint(point3D(3, 4, 0));
```

---

## Scalar Helpers

Functions that operate on plain numbers, not arrays.

| Function | Signature | Description |
|----------|-----------|-------------|
| `interpolate` | `(a: number, b: number, t: number) => number` | Linear interpolation `a + (b - a) * t` |
| `inverseInterpolate` | `(start: number, end: number, value: number) => number` | Inverse of interpolate; returns 0 if `start === end` |
| `integerInterpolate` | `(start: number, end: number, alpha: number) => [number, number]` | Returns `[index, residue]` for integer stepping |
| `mid` | `(a: number, b: number) => number` | `(a + b) / 2` |
| `clamp` | `(value: number, min: number, max: number) => number` | Clamp scalar to range. For arrays use `np.clip()` |
| `approxEqual` | `(a: number, b: number, epsilon?: number) => boolean` | Approximate equality (default epsilon `1e-8`) |
| `sigmoid` | `(x: number) => number` | Standard sigmoid `1 / (1 + exp(-x))` |

### Python to TypeScript

```python
# Python
from manim.utils.bezier import interpolate
val = interpolate(0, 10, 0.3)  # 3.0
```

```typescript
// TypeScript
import { interpolate } from "manim-ts/core/math";
const val = interpolate(0, 10, 0.3); // 3.0
```

---

## Angle Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `angleOfVector` | `(v: Point3D) => number` | Angle of a 2D vector (atan2 of y, x) |
| `angleBetweenVectors` | `(v1: Point3D, v2: Point3D) => number` | Unsigned angle between two vectors |
| `rotateVector` | `(vector: Point3D, angle: number, axis?: Point3D) => Point3D` | Rotate vector by angle around axis (default `OUT`) |
| `getUnitNormal` | `(v1: Point3D, v2: Point3D) => Point3D` | Unit normal of the plane spanned by v1 and v2 |

### Python to TypeScript

```python
# Python
from manim.utils.space_ops import angle_of_vector, rotate_vector
theta = angle_of_vector(np.array([1, 1, 0]))
rotated = rotate_vector(RIGHT, PI / 4)
```

```typescript
// TypeScript
import { angleOfVector, rotateVector, RIGHT, PI, point3D } from "manim-ts/core/math";
const theta = angleOfVector(point3D(1, 1, 0));
const rotated = rotateVector(RIGHT, PI / 4);
```

---

## Complex Number Operations

The `Complex` type is `[number, number]` representing `[real, imaginary]`.

| Function | Signature | Description |
|----------|-----------|-------------|
| `complexToR3` | `(z: Complex) => Point3D` | Convert complex number to 3D point `[re, im, 0]` |
| `r3ToComplex` | `(p: Point3D) => Complex` | Extract `[x, y]` from a 3D point |
| `complexMultiply` | `(a: Complex, b: Complex) => Complex` | Complex multiplication |

### Python to TypeScript

```python
# Python
z = complex(3, 4)
point = np.array([z.real, z.imag, 0])
```

```typescript
// TypeScript
import { complexToR3, complexMultiply, type Complex } from "manim-ts/core/math";
const z: Complex = [3, 4];
const point = complexToR3(z); // [3, 4, 0]
```

---

## Coordinate Transforms

| Function | Signature | Description |
|----------|-----------|-------------|
| `cartesianToSpherical` | `(point: Point3D) => [r, theta, phi]` | Cartesian to spherical coordinates |
| `sphericalToCartesian` | `(r: number, theta: number, phi: number) => Point3D` | Spherical to Cartesian coordinates |

`theta` is the polar angle (from positive z-axis), `phi` is the azimuthal angle (from positive x-axis in the xy-plane).

### Python to TypeScript

```python
# Python
from manim.utils.space_ops import cartesian_to_spherical
r, theta, phi = cartesian_to_spherical(np.array([1, 0, 0]))
```

```typescript
// TypeScript
import { cartesianToSpherical, sphericalToCartesian } from "manim-ts/core/math";
const [r, theta, phi] = cartesianToSpherical(point3D(1, 0, 0));
const point = sphericalToCartesian(1, PI / 2, 0); // [1, 0, 0]
```

---

## Bezier Curves

### `bezier(controlPoints)`

Create a bezier curve function from control points. Accepts `Points3D` (NDArray `[n,3]`) or `Point3D[]`. Returns a function `(t: number) => Point3D` that evaluates the curve at parameter `t` in `[0, 1]`.

```typescript
import { bezier, point3D, ORIGIN, RIGHT, UP } from "manim-ts/core/math";

const curve = bezier([ORIGIN, UP, RIGHT]);
const midpoint = curve(0.5); // Point on quadratic bezier at t=0.5
```

### `partialBezierPoints(points, a, b)`

Extract a partial bezier curve between parameters `a` and `b` using De Casteljau's algorithm. Returns a new array of control points.

```typescript
import { partialBezierPoints, ORIGIN, RIGHT, UP } from "manim-ts/core/math";

const controls = [ORIGIN, UP, RIGHT];
const partial = partialBezierPoints(controls, 0.25, 0.75);
```

### Python to TypeScript

```python
# Python
from manim.utils.bezier import bezier, partial_bezier_points
curve_fn = bezier(control_points)
point = curve_fn(0.5)
sub_controls = partial_bezier_points(points, 0.2, 0.8)
```

```typescript
// TypeScript
import { bezier, partialBezierPoints } from "manim-ts/core/math";
const curveFn = bezier(controlPoints);
const point = curveFn(0.5);
const subControls = partialBezierPoints(points, 0.2, 0.8);
```

---

## Matrix Operations (gl-matrix)

gl-matrix is configured to use `Float64Array` internally (not `Float32Array`) for full double-precision math.

| Function | Signature | Description |
|----------|-----------|-------------|
| `rotationMatrix` | `(angle: number, axis?: Point3D) => mat4` | 4x4 rotation matrix around axis (default `OUT`) |
| `applyMatrixToPoint` | `(m: mat4, p: Point3D) => Point3D` | Transform a single point by a 4x4 matrix |
| `applyMatrixToPoints` | `(m: mat4, points: Points3D) => Points3D` | Transform all points in a `Points3D` array |

### Python to TypeScript

```python
# Python
from manim.utils.space_ops import rotation_matrix
import numpy as np
mat = rotation_matrix(np.pi / 4, OUT)
point = mat @ np.array([1, 0, 0])
```

```typescript
// TypeScript
import { rotationMatrix, applyMatrixToPoint, RIGHT, PI, OUT } from "manim-ts/core/math";
const mat = rotationMatrix(PI / 4, OUT);
const point = applyMatrixToPoint(mat, RIGHT);
```

---

## Quaternions

The `Quaternion` type is `[w, x, y, z]` (scalar-first convention).

| Function | Signature | Description |
|----------|-----------|-------------|
| `quaternionFromAngleAxis` | `(angle: number, axis: Point3D) => Quaternion` | Create quaternion from angle-axis |
| `angleAxisFromQuaternion` | `(q: Quaternion) => { angle, axis }` | Extract angle and axis from quaternion |
| `quaternionMultiply` | `(q1: Quaternion, q2: Quaternion) => Quaternion` | Hamilton product |
| `quaternionConjugate` | `(q: Quaternion) => Quaternion` | Conjugate `[w, -x, -y, -z]` |

### Python to TypeScript

```python
# Python
from manim.utils.space_ops import quaternion_from_angle_axis
q = quaternion_from_angle_axis(PI / 2, OUT)
```

```typescript
// TypeScript
import { quaternionFromAngleAxis, quaternionMultiply, PI, OUT } from "manim-ts/core/math";
const q = quaternionFromAngleAxis(PI / 2, OUT);
```

---

## Points3D Helpers

Bulk operations on `Points3D` arrays and compatibility helpers.

| Function | Signature | Description |
|----------|-----------|-------------|
| `addPoints` | `(a: Point3D, b: Point3D) => Point3D` | Element-wise addition |
| `subtractPoints` | `(a: Point3D, b: Point3D) => Point3D` | Element-wise subtraction |
| `scalePoint` | `(p: Point3D, scalar: number) => Point3D` | Scalar multiplication |
| `clonePoint` | `(p: Point3D) => Point3D` | Deep copy a point |
| `pointFromVec3` | `(v: vec3) => Point3D` | Convert gl-matrix vec3 to Point3D |
| `pointsFromArray` | `(coords: number[][]) => Points3D` | Create Points3D from `[x,y,z]` triples |
| `emptyPoints` | `(count: number) => Points3D` | Allocate zero-filled Points3D |
| `pointCount` | `(points: Points3D) => number` | Number of points in a Points3D array |
| `getPoint` | `(points: Points3D, index: number) => Point3D` | Get a single point by index |
| `setPoint` | `(points: Points3D, index: number, p: Point3D) => void` | Set a point by index (mutates) |
| `concatPoints` | `(...arrays: Points3D[]) => Points3D` | Concatenate multiple Points3D vertically |
| `translatePoints` | `(points: Points3D, offset: Point3D) => Points3D` | Translate all points by an offset |
| `scalePoints` | `(points: Points3D, factor: number, aboutPoint?: Point3D) => Points3D` | Scale points, optionally about a center |
| `pointsBoundingBox` | `(points: Points3D) => { min: Point3D; max: Point3D }` | Axis-aligned bounding box |
| `pointsCenter` | `(points: Points3D) => Point3D` | Center of the bounding box |

### Python to TypeScript

```python
# Python
import numpy as np
points = np.array([[0, 0, 0], [1, 1, 0], [2, 0, 0]])
shifted = points + np.array([1, 0, 0])
center = points.mean(axis=0)
```

```typescript
// TypeScript
import { pointsFromArray, translatePoints, pointsCenter, RIGHT } from "manim-ts/core/math";
const points = pointsFromArray([[0, 0, 0], [1, 1, 0], [2, 0, 0]]);
const shifted = translatePoints(points, RIGHT);
const center = pointsCenter(points);
```

---

## Rate Functions

Rate functions map `[0, 1]` to `[0, 1]` and control animation easing. Type: `RateFunc = (t: number) => number`.

### Built-in Rate Functions

| Function | Description |
|----------|-------------|
| `linear` | Identity `t` |
| `smooth` | Manim's default sigmoid-based smooth (inflection=10) |
| `smoothstep` | 1st-order SmoothStep: `3t^2 - 2t^3` |
| `smootherstep` | 2nd-order SmoothStep |
| `smoothererstep` | 3rd-order SmoothStep |
| `rushInto` | Fast start, smooth stop |
| `rushFrom` | Smooth start, fast stop |
| `slowInto` | Decelerating circular ease |
| `doubleSmooth` | Smooth in the first half, smooth in the second |
| `thereAndBack` | Smooth up then smooth down, zero at endpoints |
| `wiggle` | `thereAndBack(t) * sin(TAU * t)` |
| `lingering` | Smooth squished to `[0, 0.8]` |
| `easeInSine` | Sine ease-in |
| `easeOutSine` | Sine ease-out |
| `easeInOutSine` | Sine ease-in-out |

### Parameterized Rate Functions

| Factory | Signature | Description |
|---------|-----------|-------------|
| `smoothWithInflection` | `(inflection: number) => RateFunc` | Sigmoid smooth with custom inflection |
| `thereAndBackWithPause` | `(pauseRatio?: number) => RateFunc` | There-and-back with a flat pause in the middle |
| `runningStart` | `(pullFactor?: number) => RateFunc` | Anticipation before moving forward |
| `notQuiteThereRatio` | `(func: RateFunc, proportion?: number) => RateFunc` | Scale output to stop short |
| `squishRateFunc` | `(func: RateFunc, a: number, b: number) => RateFunc` | Remap func to act only within `[a, b]` |
| `exponentialDecay` | `(halfLife?: number) => RateFunc` | Exponential decay curve |

### Python to TypeScript

```python
# Python
from manim import smooth, there_and_back, rush_into
```

```typescript
// TypeScript
import { smooth, thereAndBack, rushInto } from "manim-ts/core/math";
```

:::tip
Python's `snake_case` rate function names become `camelCase` in TypeScript: `there_and_back` becomes `thereAndBack`, `rush_into` becomes `rushInto`, etc.
:::

---

## Line / Intersection Operations

### `findIntersection(p0, v0, p1, v1)`

Find the intersection point of two 2D lines. Each line is defined by a point and a direction vector. Returns a point on the first line closest to the intersection.

```typescript
import { findIntersection, ORIGIN, RIGHT, UP, point3D } from "manim-ts/core/math";

const hit = findIntersection(ORIGIN, RIGHT, point3D(1, -1, 0), UP);
// hit = [1, 0, 0]
```
