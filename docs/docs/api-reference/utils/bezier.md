---
title: Bezier Curves
sidebar_position: 2
---

# Bezier Curves

Bezier curves are the geometric foundation of all vector graphics in manim-ts. Every `VMobject` (circles, lines, arcs, text outlines) stores its shape as sequences of cubic bezier control points.

```ts
import { bezier, partialBezierPoints, KAPPA } from "manim-ts";
```

## Cubic Bezier Point Layout

manim-ts represents bezier curves as sequences of **cubic** bezier segments. Each segment consists of 4 control points:

```
Anchor1 --- Handle1 --- Handle2 --- Anchor2
  P0          P1          P2          P3
```

- **Anchor1 (P0)** -- The starting point of the curve segment.
- **Handle1 (P1)** -- Controls the direction the curve leaves Anchor1.
- **Handle2 (P2)** -- Controls the direction the curve arrives at Anchor2.
- **Anchor2 (P3)** -- The ending point of the curve segment.

A VMobject's `points` array stores these in sequence. For a path with N segments, there are `4N` points total (with shared anchors between adjacent segments stored redundantly):

```
Segment 1: [A0, H0, H1, A1]
Segment 2: [A1, H2, H3, A2]
Segment 3: [A2, H4, H5, A3]
...
```

## Core Functions

### `bezier(controlPoints: Point3D[]): (t: number) => Point3D`

Returns a parametric function for a bezier curve of any degree defined by the given control points. The returned function takes a parameter `t` in `[0, 1]` and returns the corresponding point on the curve.

```ts
// Quadratic bezier (3 control points)
const quadratic = bezier([
  np.array([0, 0, 0]),
  np.array([1, 2, 0]),
  np.array([2, 0, 0]),
]);
quadratic(0);    // => [0, 0, 0] (start)
quadratic(0.5);  // => [1, 1, 0] (midpoint)
quadratic(1);    // => [2, 0, 0] (end)

// Cubic bezier (4 control points)
const cubic = bezier([
  np.array([0, 0, 0]),
  np.array([0, 1, 0]),
  np.array([1, 1, 0]),
  np.array([1, 0, 0]),
]);
cubic(0.5);  // => [0.5, 0.75, 0]
```

The degree of the bezier curve is determined by the number of control points minus one. For cubic beziers (the most common), provide 4 points.

### `partialBezierPoints(points: Point3D[], a: number, b: number): Point3D[]`

Extracts the control points for a **portion** of a bezier curve. Given a cubic bezier defined by 4 control points and a sub-interval `[a, b]` within `[0, 1]`, returns 4 new control points that trace the same path but only over the sub-interval.

```ts
const points = [
  np.array([0, 0, 0]),
  np.array([0, 1, 0]),
  np.array([1, 1, 0]),
  np.array([1, 0, 0]),
];

// Get the first half of the curve
const firstHalf = partialBezierPoints(points, 0, 0.5);

// Get the middle third
const middleThird = partialBezierPoints(points, 0.33, 0.67);
```

This is critical for animations like `Create` and `ShowPassingFlash` that progressively reveal portions of a path.

### `splitBezier(points: Point3D[], t: number): [Point3D[], Point3D[]]`

Splits a bezier curve at parameter `t` using De Casteljau's algorithm. Returns two sets of control points: one for the curve from 0 to t, and one for the curve from t to 1.

```ts
const [left, right] = splitBezier(points, 0.5);
// left traces the curve from t=0 to t=0.5
// right traces the curve from t=0.5 to t=1
```

### `bezierRemap(points: Points3D, numCurves: number): Points3D`

Remaps a set of bezier curves to a different number of segments while preserving the overall shape. Used internally when morphing between shapes with different numbers of curve segments.

## The KAPPA Constant

```ts
const KAPPA = (4 / 3) * (Math.sqrt(2) - 1);  // approximately 0.5522847498
```

`KAPPA` is the magic number for approximating circular arcs with cubic bezier curves. When a quarter-circle of radius `r` is centered at the origin, the optimal bezier handles have length `r * KAPPA`.

```
Quarter circle approximation:

  Anchor:  (r, 0)
  Handle1: (r, r * KAPPA)
  Handle2: (r * KAPPA, r)
  Anchor:  (0, r)
```

This gives a maximum radial error of about 0.027%, which is imperceptible at normal resolutions. manim-ts uses this constant when constructing `Circle`, `Arc`, `Ellipse`, and other curved shapes.

## Integration with bezier-js

For complex bezier operations (intersections, bounding boxes, nearest points), manim-ts uses the [bezier-js](https://github.com/Pomax/bezierjs) library.

```ts
import { Bezier } from "bezier-js";

const curve = new Bezier(
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 }
);

curve.length();           // Arc length
curve.bbox();             // Bounding box
curve.intersects(other);  // Intersections with another curve
curve.project({ x, y }); // Nearest point on curve
```

The core bezier functions in manim-ts operate on `Point3D` arrays directly for performance and compatibility with the numpy-ts math pipeline. The bezier-js library is used selectively for operations that would be complex to implement from scratch.

## Practical Example

Creating a custom VMobject path from bezier control points:

```ts
class CustomPath extends VMobject {
  constructor() {
    super();
    // Define a curve with two cubic segments
    this.setPoints([
      // Segment 1
      np.array([-2, 0, 0]),   // anchor
      np.array([-2, 1, 0]),   // handle
      np.array([-1, 1, 0]),   // handle
      np.array([0, 0, 0]),    // anchor
      // Segment 2
      np.array([0, 0, 0]),    // anchor (shared)
      np.array([1, -1, 0]),   // handle
      np.array([2, -1, 0]),   // handle
      np.array([2, 0, 0]),    // anchor
    ]);
  }
}
```
