---
title: "3D Objects"
sidebar_position: 5
---

# 3D Objects

The 3D modules provide volumetric and surface-based mobjects for three-dimensional scenes. These extend `VMobject` (via `ThreeDVMobject`) and work with manim-ts's 3D camera and lighting system.

## ThreeDVMobject

Base class for all 3D vectorized mobjects. Adds depth shading and 3D-aware rendering behavior on top of `VMobject`.

```ts
import { ThreeDVMobject } from "manim-ts/mobjects/three_d";
```

---

## Surface

A parametric surface defined by a mapping from `(u, v)` to 3D space.

```ts
import { Surface } from "manim-ts/mobjects/three_d";
```

### SurfaceOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uRange` | `[number, number]` | `[0, 1]` | Range of the u parameter |
| `vRange` | `[number, number]` | `[0, 1]` | Range of the v parameter |
| `resolution` | `[number, number]` | `[32, 32]` | Number of subdivisions in u and v |
| `fillColor` | `ManimColor` | `BLUE` | Surface fill color |
| `fillOpacity` | `number` | `1` | Surface fill opacity |
| `checkerboardColors` | `[ManimColor, ManimColor] \| null` | `null` | Alternating colors for a checkerboard pattern |

```ts
const surface = new Surface({
  uRange: [0, TAU],
  vRange: [-1, 1],
  resolution: [64, 16],
  func: (u: number, v: number) => np.array([
    Math.cos(u),
    Math.sin(u),
    v,
  ]),
});
```

---

## Primitive 3D Shapes

### Sphere

```ts
import { Sphere } from "manim-ts/mobjects/three_d";

const sphere = new Sphere({ radius: 1, resolution: [24, 48] });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `radius` | `number` | `1` | Radius of the sphere |
| `resolution` | `[number, number]` | `[24, 48]` | Latitude and longitude subdivisions |
| `uRange` | `[number, number]` | `[0, PI]` | Polar angle range |
| `vRange` | `[number, number]` | `[0, TAU]` | Azimuthal angle range |

### Cube

```ts
import { Cube } from "manim-ts/mobjects/three_d";

const cube = new Cube({ sideLength: 2, fillColor: ORANGE, fillOpacity: 0.8 });
```

### Prism

A rectangular prism (box) with independent width, height, and depth.

```ts
import { Prism } from "manim-ts/mobjects/three_d";

const box = new Prism({ dimensions: [3, 1, 2] });
```

### Cone

```ts
import { Cone } from "manim-ts/mobjects/three_d";

const cone = new Cone({ baseRadius: 1, height: 2, direction: UP });
```

### Cylinder

```ts
import { Cylinder } from "manim-ts/mobjects/three_d";

const cyl = new Cylinder({ radius: 0.5, height: 3, direction: UP });
```

### Torus

```ts
import { Torus } from "manim-ts/mobjects/three_d";

const torus = new Torus({ majorRadius: 2, minorRadius: 0.5 });
```

---

## 3D Lines and Arrows

### Line3D

A line segment in 3D space with cylindrical thickness.

```ts
import { Line3D } from "manim-ts/mobjects/three_d";

const line = new Line3D({
  start: np.array([-2, 0, 0]),
  end: np.array([2, 1, 1]),
});
```

### Arrow3D

A 3D arrow with a conical tip.

```ts
import { Arrow3D } from "manim-ts/mobjects/three_d";

const arrow = new Arrow3D({
  start: ORIGIN,
  end: np.array([1, 1, 1]),
  color: YELLOW,
});
```

### Dot3D

A small sphere used as a point marker.

```ts
import { Dot3D } from "manim-ts/mobjects/three_d";

const dot = new Dot3D({ point: np.array([1, 2, 3]), radius: 0.08, color: RED });
```

---

## Polyhedra

Regular and semi-regular polyhedra, built from face and vertex data.

| Class | Description |
|-------|-------------|
| `Polyhedron` | Base class; construct from `vertexCoords` and `facesList` |
| `Tetrahedron` | 4 triangular faces |
| `Octahedron` | 8 triangular faces |
| `Icosahedron` | 20 triangular faces |
| `Dodecahedron` | 12 pentagonal faces |

```ts
import { Icosahedron } from "manim-ts/mobjects/three_d";

const ico = new Icosahedron({ edgeLength: 2, fillColor: TEAL });
```

### Custom Polyhedron

```ts
import { Polyhedron } from "manim-ts/mobjects/three_d";

const custom = new Polyhedron({
  vertexCoords: [
    np.array([1, 1, 1]),
    np.array([-1, -1, 1]),
    np.array([-1, 1, -1]),
    np.array([1, -1, -1]),
  ],
  facesList: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]],
});
```

---

## ConvexHull3D

Computes and renders the convex hull of a set of 3D points. Uses the **convex-hull** package internally.

```ts
import { ConvexHull3D } from "manim-ts/mobjects/three_d";

const hull = new ConvexHull3D({
  points: [
    np.array([1, 0, 0]),
    np.array([0, 1, 0]),
    np.array([0, 0, 1]),
    np.array([-1, 0, 0]),
    np.array([0, -1, 0]),
    np.array([0, 0, -1]),
  ],
});
```

---

## Utility Functions

| Function | Description |
|----------|-------------|
| `get3dVmobGradientStartAndEndPoints(vmob)` | Computes gradient direction for shading a 3D VMobject |
| `get3dVmobUnitNormal(vmob)` | Returns the unit normal vector of a flat 3D VMobject |

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class ThreeDExample(ThreeDScene):
    def construct(self):
        axes = ThreeDAxes()
        sphere = Sphere(radius=1).set_color(BLUE)
        cube = Cube(side_length=2, fill_opacity=0.5)
        arrow = Arrow3D(ORIGIN, [1, 1, 1])
        torus = Torus(major_radius=2, minor_radius=0.5)

        surface = Surface(
            lambda u, v: [u * np.cos(v), u * np.sin(v), u],
            u_range=[0, 2],
            v_range=[0, TAU],
            resolution=(16, 32),
        )
```

```ts
// TypeScript manim-ts
import {
  Sphere, Cube, Arrow3D, Torus, Surface,
} from "manim-ts/mobjects/three_d";
import { ThreeDAxes } from "manim-ts/mobjects/graphing";
import { BLUE, ORIGIN, TAU } from "manim-ts/core";
import { np } from "manim-ts/core/math";

class ThreeDExample extends ThreeDScene {
  construct() {
    const axes = new ThreeDAxes();
    const sphere = new Sphere({ radius: 1 }).setColor(BLUE);
    const cube = new Cube({ sideLength: 2, fillOpacity: 0.5 });
    const arrow = new Arrow3D({ start: ORIGIN, end: np.array([1, 1, 1]) });
    const torus = new Torus({ majorRadius: 2, minorRadius: 0.5 });

    const surface = new Surface({
      func: (u: number, v: number) => np.array([
        u * Math.cos(v),
        u * Math.sin(v),
        u,
      ]),
      uRange: [0, 2],
      vRange: [0, TAU],
      resolution: [16, 32],
    });
  }
}
```

### Key Differences

- **Lambda to function**: Python lambda `lambda u, v: [...]` becomes a TypeScript arrow function returning `np.array(...)`.
- **Tuple to array**: Python tuples `(16, 32)` become TypeScript arrays `[16, 32]`.
- **`snake_case` to `camelCase`**: `side_length` becomes `sideLength`, `major_radius` becomes `majorRadius`, etc.
- **convex-hull package**: Replaces Python's custom qhull bindings for `ConvexHull3D`.
