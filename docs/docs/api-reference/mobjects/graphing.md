---
title: "Graphing"
sidebar_position: 7
---

# Graphing

The graphing module provides coordinate systems, axes, number lines, function plots, and statistical charts. These are the primary tools for visualizing mathematical functions and data.

## Scale Classes

Scale classes define how values are mapped along an axis.

### LinearBase

The default linear scale. Values map proportionally.

```ts
import { LinearBase } from "manim-ts/mobjects/graphing";
```

### LogBase

Logarithmic scale. Values are mapped through `log_base(x)`.

```ts
import { LogBase } from "manim-ts/mobjects/graphing";

const logScale = new LogBase({ base: 10 });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `base` | `number` | `10` | Logarithm base |

---

## NumberLine

A configurable number line with tick marks and labels.

```ts
import { NumberLine } from "manim-ts/mobjects/graphing";
```

### NumberLineOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `xRange` | `[number, number, number]` | `[-4, 4, 1]` | `[min, max, step]` |
| `length` | `number` | `12` | Visual length in scene units |
| `includeTicks` | `boolean` | `true` | Whether to draw tick marks |
| `includeNumbers` | `boolean` | `false` | Whether to show numeric labels |
| `includeArrowTip` | `boolean` | `false` | Whether to add arrow tips at the ends |
| `scaling` | `LinearBase \| LogBase` | `new LinearBase()` | Scale type |
| `fontSize` | `number` | `36` | Font size for numeric labels |
| `tickSize` | `number` | `0.1` | Height of tick marks |
| `numbersWithElongatedTicks` | `number[]` | `[]` | Values that get taller tick marks |

```ts
const line = new NumberLine({
  xRange: [0, 10, 1],
  length: 10,
  includeNumbers: true,
  includeArrowTip: true,
});
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `numberToPoint()` | `(number: number) => Point3D` | Converts a numeric value to scene coordinates |
| `pointToNumber()` | `(point: Point3D) => number` | Converts scene coordinates to a numeric value |
| `getNumberMobject()` | `(number: number) => DecimalNumber` | Returns the label mobject for a value |
| `addTicks()` | `() => this` | Draws tick marks along the line |
| `addNumbers()` | `(numbers?: number[]) => this` | Adds numeric labels |

---

## CoordinateSystem

Abstract base class for 2D and 3D coordinate systems. Provides shared methods for plotting.

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `coordsToPoint()` | `(...coords: number[]) => Point3D` | Converts coordinate values to scene point (`c2p` alias) |
| `pointToCoords()` | `(point: Point3D) => number[]` | Converts a scene point back to coordinates (`p2c` alias) |
| `plot()` | `(fn: (x: number) => number, options?: PlotOptions) => ParametricFunction` | Plots a function `y = f(x)` |
| `plotParametricCurve()` | `(fn: (t: number) => Point3D, options?: PlotOptions) => ParametricFunction` | Plots a parametric curve |
| `plotImplicitCurve()` | `(fn: (x: number, y: number) => number, options?: PlotOptions) => ImplicitFunction` | Plots an implicit curve `f(x,y) = 0` |
| `getArea()` | `(graph: ParametricFunction, options?: AreaOptions) => VMobject` | Shades the area under a curve |
| `getVerticalLine()` | `(point: Point3D) => Line` | Draws a vertical line from the x-axis to the point |
| `getHorizontalLine()` | `(point: Point3D) => Line` | Draws a horizontal line from the y-axis to the point |

---

## Axes

A 2D coordinate system with an x-axis and a y-axis.

```ts
import { Axes } from "manim-ts/mobjects/graphing";
```

### AxesOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `xRange` | `[number, number, number]` | `[-4, 4, 1]` | x-axis `[min, max, step]` |
| `yRange` | `[number, number, number]` | `[-4, 4, 1]` | y-axis `[min, max, step]` |
| `xLength` | `number` | `12` | Visual length of the x-axis |
| `yLength` | `number` | `8` | Visual length of the y-axis |
| `axisConfig` | `Partial<NumberLineOptions>` | `{}` | Options applied to both axes |
| `xAxisConfig` | `Partial<NumberLineOptions>` | `{}` | Options for the x-axis only |
| `yAxisConfig` | `Partial<NumberLineOptions>` | `{}` | Options for the y-axis only |
| `tips` | `boolean` | `true` | Whether axes have arrow tips |

```ts
const axes = new Axes({
  xRange: [-3, 3, 1],
  yRange: [-2, 2, 1],
  xLength: 8,
  yLength: 6,
});

const graph = axes.plot((x) => Math.sin(x), { color: BLUE });
const area = axes.getArea(graph, { xRange: [0, PI], color: BLUE, opacity: 0.3 });
```

---

## NumberPlane

A 2D coordinate grid with background lines.

```ts
import { NumberPlane } from "manim-ts/mobjects/graphing";

const plane = new NumberPlane({
  xRange: [-5, 5, 1],
  yRange: [-5, 5, 1],
  backgroundLineStyle: { strokeColor: BLUE_D, strokeOpacity: 0.4 },
});
```

---

## ComplexPlane

A `NumberPlane` labeled for complex number coordinates (real and imaginary axes).

```ts
import { ComplexPlane } from "manim-ts/mobjects/graphing";

const plane = new ComplexPlane();
const point = plane.numberToPoint(2 + 3i); // if using complex number support
// or
const point2 = plane.coordsToPoint(2, 3);
```

### Additional Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `numberToPoint()` | `(z: { re: number; im: number }) => Point3D` | Converts a complex number to scene coordinates |
| `pointToNumber()` | `(point: Point3D) => { re: number; im: number }` | Converts scene coordinates to a complex number |

---

## ThreeDAxes

A 3D coordinate system with x, y, and z axes.

```ts
import { ThreeDAxes } from "manim-ts/mobjects/graphing";

const axes = new ThreeDAxes({
  xRange: [-3, 3, 1],
  yRange: [-3, 3, 1],
  zRange: [-3, 3, 1],
  xLength: 8,
  yLength: 8,
  zLength: 6,
});
```

---

## Function Plot Classes

### ParametricFunction

A curve defined by a parametric function `t -> Point3D`.

```ts
import { ParametricFunction } from "manim-ts/mobjects/graphing";

const helix = new ParametricFunction({
  func: (t: number) => np.array([Math.cos(t), Math.sin(t), t / TAU]),
  tRange: [0, TAU * 3],
  color: YELLOW,
});
```

### FunctionGraph

A curve defined by `y = f(x)`. Internally uses `ParametricFunction`.

```ts
import { FunctionGraph } from "manim-ts/mobjects/graphing";

const sine = new FunctionGraph({
  func: (x: number) => Math.sin(x),
  xRange: [-PI, PI],
  color: GREEN,
});
```

### ImplicitFunction

Plots the level set `f(x, y) = 0` using the **isosurface** package.

```ts
import { ImplicitFunction } from "manim-ts/mobjects/graphing";

const ellipse = new ImplicitFunction({
  func: (x: number, y: number) => x * x / 4 + y * y - 1,
  xRange: [-3, 3],
  yRange: [-2, 2],
  color: WHITE,
});
```

---

## BarChart

A bar chart visualization.

```ts
import { BarChart } from "manim-ts/mobjects/graphing";

const chart = new BarChart({
  values: [3, 5, 2, 8, 4],
  barNames: ["A", "B", "C", "D", "E"],
  barColors: [RED, GREEN, BLUE, YELLOW, PURPLE],
  yRange: [0, 10, 2],
});
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class GraphExample(Scene):
    def construct(self):
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-2, 2, 1],
            x_length=8,
            y_length=6,
        )
        graph = axes.plot(lambda x: np.sin(x), color=BLUE)
        area = axes.get_area(graph, x_range=[0, PI], color=BLUE, opacity=0.3)

        number_line = NumberLine(
            x_range=[0, 10, 1],
            length=10,
            include_numbers=True,
        )
```

```ts
// TypeScript manim-ts
import { Axes, NumberLine } from "manim-ts/mobjects/graphing";
import { BLUE, PI } from "manim-ts/core";

class GraphExample extends Scene {
  construct() {
    const axes = new Axes({
      xRange: [-3, 3, 1],
      yRange: [-2, 2, 1],
      xLength: 8,
      yLength: 6,
    });
    const graph = axes.plot((x) => Math.sin(x), { color: BLUE });
    const area = axes.getArea(graph, { xRange: [0, PI], color: BLUE, opacity: 0.3 });

    const numberLine = new NumberLine({
      xRange: [0, 10, 1],
      length: 10,
      includeNumbers: true,
    });
  }
}
```

### Key Differences

- **`lambda` to arrow function**: `lambda x: np.sin(x)` becomes `(x) => Math.sin(x)`.
- **`np.sin` to `Math.sin`**: Standard math functions use JavaScript's `Math` object; numpy-ts `np` is used for array operations.
- **Underscore to camelCase**: `x_range` becomes `xRange`, `include_numbers` becomes `includeNumbers`, etc.
- **isosurface package**: Replaces Python's isosurfaces library for implicit function plotting.
