---
title: "VMobject"
sidebar_position: 3
---

# VMobject

`VMobject` (Vectorized Mobject) is the base class for all objects rendered as bezier curves. Most visible objects in manim-ts -- shapes, text, graphs -- are VMobjects. It stores points as cubic bezier curve data and provides methods for path construction, styling, and geometric queries.

## VMobject

```ts
import { VMobject } from "manim-ts/mobjects/vmobject";
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fillColor` | `ManimColor` | inherited | Fill color |
| `fillOpacity` | `number` | `0` | Fill opacity (0 = no fill, 1 = fully filled) |
| `strokeColor` | `ManimColor` | `WHITE` | Stroke color |
| `strokeOpacity` | `number` | `1` | Stroke opacity |
| `strokeWidth` | `number` | `4` | Stroke width in pixels |

```ts
const vmob = new VMobject({
  fillColor: BLUE,
  fillOpacity: 0.5,
  strokeColor: WHITE,
  strokeWidth: 2,
});
```

---

## Point Layout

VMobject stores its points as groups of four for cubic bezier curves:

```
anchor_0, handle_0a, handle_0b, anchor_1, handle_1a, handle_1b, anchor_2, ...
```

Each group of four consecutive points `[anchor_i, ctrl1_i, ctrl2_i, anchor_{i+1}]` defines one cubic bezier segment. The last anchor of one segment is the first anchor of the next, so points are stored as:

```
[a0, c1_0, c2_0, a1, c1_1, c2_1, a2, c1_2, c2_2, a3, ...]
```

This means anchors appear at indices `0, 3, 6, 9, ...` and control handles fill the positions in between.

---

## Path Construction Methods

These methods build up the bezier path data incrementally.

| Method | Signature | Description |
|--------|-----------|-------------|
| `startNewPath()` | `(point: Point3D) => this` | Begins a new subpath at the given point |
| `addLineTo()` | `(point: Point3D) => this` | Adds a straight line segment (bezier with collinear handles) |
| `addCubicBezierCurveTo()` | `(handle1: Point3D, handle2: Point3D, anchor: Point3D) => this` | Adds a cubic bezier curve segment |
| `addQuadraticBezierCurveTo()` | `(handle: Point3D, anchor: Point3D) => this` | Adds a quadratic bezier curve (converted to cubic internally) |
| `closePath()` | `() => this` | Closes the current subpath by connecting back to its start |
| `clearPoints()` | `() => this` | Removes all point data |

### Example: Manual Path Construction

```ts
const path = new VMobject({ strokeColor: YELLOW });
path.startNewPath(np.array([-2, 0, 0]));
path.addLineTo(np.array([0, 2, 0]));
path.addCubicBezierCurveTo(
  np.array([1, 2, 0]),   // handle 1
  np.array([2, 1, 0]),   // handle 2
  np.array([2, 0, 0])    // end anchor
);
path.closePath();
```

---

## Bezier Accessors

| Method | Signature | Description |
|--------|-----------|-------------|
| `getAnchors()` | `() => Points3D` | Returns all anchor points (every 3rd point starting from index 0) |
| `getHandles()` | `() => Points3D` | Returns all control handle points |
| `getSubpaths()` | `() => Points3D[]` | Returns point arrays for each separate subpath |
| `getArcLength()` | `() => number` | Computes the total arc length of all bezier curves |
| `pointFromProportion()` | `(alpha: number) => Point3D` | Returns the point at proportional distance `alpha` (0 to 1) along the path |
| `getCubicBezierTuples()` | `() => [Point3D, Point3D, Point3D, Point3D][]` | Returns bezier segments as 4-tuples |
| `getNumCurves()` | `() => number` | Returns the number of cubic bezier segments |
| `getStartAnchors()` | `() => Points3D` | Returns the starting anchor of each bezier segment |
| `getEndAnchors()` | `() => Points3D` | Returns the ending anchor of each bezier segment |

---

## Style Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setFill()` | `(options?: { color?: ManimColor; opacity?: number }) => this` | Sets fill color and/or opacity |
| `setStroke()` | `(options?: { color?: ManimColor; opacity?: number; width?: number }) => this` | Sets stroke color, opacity, and/or width |
| `setStyle()` | `(options?: StyleOptions) => this` | Sets fill and stroke properties in one call |

```ts
const shape = new Circle({ radius: 1 });
shape.setFill({ color: BLUE, opacity: 0.5 });
shape.setStroke({ color: WHITE, width: 2, opacity: 1 });
```

---

## VGroup

`VGroup` is the vectorized equivalent of `Group`. It holds a collection of `VMobject` instances and applies operations uniformly.

```ts
import { VGroup } from "manim-ts/mobjects/vmobject";

const shapes = new VGroup(
  new Circle({ color: RED }),
  new Square({ color: BLUE }),
  new Triangle({ color: GREEN }),
);
shapes.arrange(RIGHT, { buff: 0.5 });
shapes.setFill({ opacity: 0.3 });
```

---

## VDict

`VDict` maps string keys to `VMobject` values, enabling named access to components.

```ts
import { VDict } from "manim-ts/mobjects/vmobject";

const parts = new VDict({
  body: new Circle({ radius: 1 }),
  hat: new Triangle().nextTo(body, UP),
});
parts.get("body").setColor(RED);
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class BezierExample(Scene):
    def construct(self):
        vmob = VMobject(
            fill_color=BLUE,
            fill_opacity=0.5,
            stroke_color=WHITE,
            stroke_width=2,
        )
        vmob.start_new_path(np.array([-2, 0, 0]))
        vmob.add_line_to(np.array([0, 2, 0]))
        vmob.add_cubic_bezier_curve_to(
            np.array([1, 2, 0]),
            np.array([2, 1, 0]),
            np.array([2, 0, 0]),
        )
        vmob.close_path()

        alpha = 0.5
        point = vmob.point_from_proportion(alpha)
        anchors = vmob.get_anchors()
```

```ts
// TypeScript manim-ts
import { VMobject } from "manim-ts/mobjects/vmobject";
import { BLUE, WHITE } from "manim-ts/core";
import { np } from "manim-ts/core/math";

class BezierExample extends Scene {
  construct() {
    const vmob = new VMobject({
      fillColor: BLUE,
      fillOpacity: 0.5,
      strokeColor: WHITE,
      strokeWidth: 2,
    });
    vmob.startNewPath(np.array([-2, 0, 0]));
    vmob.addLineTo(np.array([0, 2, 0]));
    vmob.addCubicBezierCurveTo(
      np.array([1, 2, 0]),
      np.array([2, 1, 0]),
      np.array([2, 0, 0]),
    );
    vmob.closePath();

    const alpha = 0.5;
    const point = vmob.pointFromProportion(alpha);
    const anchors = vmob.getAnchors();
  }
}
```

### Key Differences

- **`snake_case` to `camelCase`**: `start_new_path` becomes `startNewPath`, `add_line_to` becomes `addLineTo`, etc.
- **Options object**: Constructor keyword arguments become a single options object with camelCase keys.
- **`np` import**: numpy-ts is imported from `manim-ts/core/math` and provides the same `np.array()` API.
