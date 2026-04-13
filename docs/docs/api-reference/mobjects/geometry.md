---
title: "Geometry"
sidebar_position: 2
---

# Geometry

The geometry module provides the core 2D shapes used throughout manim-ts. All geometry classes extend `VMobject` and support fill, stroke, and animation out of the box.

## Arc

A circular arc defined by a radius, start angle, and sweep angle.

```ts
import { Arc } from "manim-ts/mobjects/geometry";
```

### ArcOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `radius` | `number` | `1` | Radius of the arc |
| `startAngle` | `number` | `0` | Starting angle in radians |
| `angle` | `number` | `TAU / 4` | Sweep angle in radians |
| `numComponents` | `number` | `9` | Number of cubic bezier curves used to approximate the arc |
| `arcCenter` | `Point3D` | `ORIGIN` | Center point of the arc |

```ts
const arc = new Arc({ radius: 2, startAngle: 0, angle: PI / 2, arcCenter: ORIGIN });
```

---

## Circle

A full circle. Extends `Arc` with `angle` set to `TAU`.

```ts
import { Circle } from "manim-ts/mobjects/geometry";
```

### CircleOptions

Extends `ArcOptions`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `radius` | `number` | `1` | Radius of the circle |
| `color` | `ManimColor` | `RED` | Stroke color |

```ts
const circle = new Circle({ radius: 2, color: BLUE });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `surround()` | `(mobject: IMobject, options?: SurroundOptions) => this` | Resizes and repositions to surround the target |
| `pointAtAngle()` | `(angle: number) => Point3D` | Returns the point on the circumference at the given angle |
| `fromThreePoints()` | `static (p1: Point3D, p2: Point3D, p3: Point3D) => Circle` | Constructs a circle through three points |

---

## Line

A straight line segment between two points.

```ts
import { Line } from "manim-ts/mobjects/geometry";
```

### LineOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `start` | `Point3D` | `LEFT` | Start point of the line |
| `end` | `Point3D` | `RIGHT` | End point of the line |
| `buffLength` | `number` | `0` | Shortens the line at both ends by this amount |
| `pathArc` | `number \| null` | `null` | If set, the line follows a curved arc path |

```ts
const line = new Line({ start: LEFT, end: RIGHT });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getLength()` | `() => number` | Returns the euclidean length of the line |
| `getSlope()` | `() => number` | Returns the slope (dy/dx) |
| `getAngle()` | `() => number` | Returns the angle of the line in radians |
| `getVector()` | `() => Point3D` | Returns the direction vector (end - start) |
| `getUnitVector()` | `() => Point3D` | Returns the normalized direction vector |
| `setAngle()` | `(angle: number) => this` | Rotates the line to the given angle |
| `setLength()` | `(length: number) => this` | Scales the line to the given length |

### Related Classes

- **`DashedLine`** -- a dashed variant of `Line`
- **`Arrow`** -- a line with an arrowhead tip
- **`DoubleArrow`** -- a line with arrowhead tips at both ends
- **`Vector`** -- an arrow anchored at the origin
- **`TangentLine`** -- a tangent line to a VMobject at a given alpha

---

## Polygon

A closed polygon defined by an array of vertices.

```ts
import { Polygon } from "manim-ts/mobjects/geometry";
```

### PolygonOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `vertices` | `Point3D[]` | (required) | Array of vertex positions |

```ts
const triangle = new Polygon({
  vertices: [
    np.array([-1, -1, 0]),
    np.array([1, -1, 0]),
    np.array([0, 1, 0]),
  ],
});
```

---

## RegularPolygon

A regular polygon with equal side lengths and angles.

```ts
import { RegularPolygon } from "manim-ts/mobjects/geometry";
```

### RegularPolygonOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `n` | `number` | `6` | Number of sides |
| `startAngle` | `number` | `TAU / 4` | Angle of the first vertex (from center, counter-clockwise from right) |

```ts
const hexagon = new RegularPolygon({ n: 6, color: GREEN });
```

---

## Square

A square with configurable side length.

```ts
import { Square } from "manim-ts/mobjects/geometry";
```

### SquareOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sideLength` | `number` | `2` | Length of each side |

```ts
const square = new Square({ sideLength: 3, color: YELLOW });
```

---

## Triangle

An equilateral triangle. This is a convenience subclass of `RegularPolygon` with `n = 3`.

```ts
import { Triangle } from "manim-ts/mobjects/geometry";

const tri = new Triangle({ color: ORANGE });
```

---

## Additional Shapes

| Class | Description |
|-------|-------------|
| `Dot` | A small filled circle (default radius 0.08) |
| `SmallDot` | Even smaller dot (default radius 0.04) |
| `Annulus` | Ring shape (two concentric circles) |
| `AnnularSector` | Sector of an annulus |
| `Sector` | Pie-slice sector of a circle |
| `Elbow` | Right-angle indicator |
| `RoundedRectangle` | Rectangle with rounded corners |
| `Star` | Star polygon |
| `ArcBetweenPoints` | Circular arc between two given points |
| `CurvedArrow` | Curved arrow between two points |
| `CurvedDoubleArrow` | Curved double-ended arrow |

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

circle = Circle(radius=2, color=BLUE)
line = Line(LEFT, RIGHT)
square = Square(side_length=3, fill_opacity=0.5, fill_color=GREEN)
poly = RegularPolygon(n=5, color=YELLOW)
arrow = Arrow(LEFT * 2, RIGHT * 2)
```

```ts
// TypeScript manim-ts
import {
  Circle, Line, Square, RegularPolygon, Arrow,
} from "manim-ts/mobjects/geometry";
import { BLUE, GREEN, YELLOW, LEFT, RIGHT } from "manim-ts/core";
import { np } from "manim-ts/core/math";

const circle = new Circle({ radius: 2, color: BLUE });
const line = new Line({ start: LEFT, end: RIGHT });
const square = new Square({ sideLength: 3, fillOpacity: 0.5, fillColor: GREEN });
const poly = new RegularPolygon({ n: 5, color: YELLOW });
const arrow = new Arrow({ start: LEFT.scale(2), end: RIGHT.scale(2) });
```

### Key Differences

- **Positional args become named options**: `Circle(radius=2, color=BLUE)` becomes `new Circle({ radius: 2, color: BLUE })`.
- **`snake_case` becomes `camelCase`**: `side_length` becomes `sideLength`, `fill_opacity` becomes `fillOpacity`.
- **Keyword-only in TS**: All constructor parameters are passed as a single options object.
- **Vector arithmetic**: `LEFT * 2` becomes `LEFT.scale(2)` or use `np.multiply(LEFT, 2)`.
