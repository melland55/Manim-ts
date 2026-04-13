---
title: "Vector Field"
sidebar_position: 11
---

# Vector Field

The vector field module provides classes for visualizing vector-valued functions across 2D and 3D space. These mobjects render arrows or stream lines to show the direction and magnitude of a vector field.

## VectorField

Abstract base class for vector field visualizations.

```ts
import { VectorField } from "manim-ts/mobjects/vector_field";
```

### VectorFieldOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `func` | `(point: Point3D) => Point3D` | (required) | The vector field function: takes a position and returns a vector |
| `color` | `ManimColor \| null` | `null` | Uniform color (overrides magnitude-based coloring) |
| `colorScheme` | `ManimColor[] \| null` | `null` | Array of colors for magnitude-based gradient |
| `minColorSchemeValue` | `number` | `0` | Minimum magnitude for color mapping |
| `maxColorSchemeValue` | `number` | `2` | Maximum magnitude for color mapping |
| `opacity` | `number` | `1` | Opacity of all vectors |
| `threeDimensional` | `boolean` | `false` | Whether the field extends into 3D space |

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `fitToCoordinateSystem()` | `(coordinateSystem: CoordinateSystem) => this` | Adjusts the field to match a coordinate system's range |
| `getColoredVectorByMagnitude()` | `(vector: Arrow, magnitude: number) => Arrow` | Colors a vector arrow based on its magnitude |

### Static Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `VectorField.shiftFunc()` | `(func: VectorFieldFunc, shiftVector: Point3D) => VectorFieldFunc` | Returns a shifted version of the vector field function |
| `VectorField.scaleFunc()` | `(func: VectorFieldFunc, scalar: number) => VectorFieldFunc` | Returns a scaled version of the vector field function |

---

## ArrowVectorField

Renders a grid of arrows showing the vector field direction and magnitude at each sample point.

```ts
import { ArrowVectorField } from "manim-ts/mobjects/vector_field";
```

### ArrowVectorFieldOptions

Extends `VectorFieldOptions`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `xRange` | `[number, number, number]` | `[-4, 4, 1]` | `[min, max, step]` for x sampling |
| `yRange` | `[number, number, number]` | `[-4, 4, 1]` | `[min, max, step]` for y sampling |
| `zRange` | `[number, number, number]` | `[-4, 4, 1]` | `[min, max, step]` for z sampling (3D only) |
| `lengthFunc` | `(length: number) => number` | sigmoid-based | Maps raw vector magnitudes to displayed arrow lengths |
| `arrowConfig` | `Partial<ArrowOptions>` | `{}` | Options passed to each `Arrow` mobject |

```ts
const field = new ArrowVectorField({
  func: (point) => {
    const [x, y] = [point.get(0), point.get(1)];
    return np.array([-y, x, 0]);
  },
  xRange: [-3, 3, 0.5],
  yRange: [-3, 3, 0.5],
});
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getVector()` | `(point: Point3D) => Arrow` | Returns the arrow at a specific point |

---

## StreamLines

Animated stream lines that flow through the vector field. Particles follow the field and trace visible paths.

```ts
import { StreamLines } from "manim-ts/mobjects/vector_field";
```

### StreamLinesOptions

Extends `VectorFieldOptions`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `xRange` | `[number, number, number]` | `[-4, 4, 0.5]` | Sampling range for seed points |
| `yRange` | `[number, number, number]` | `[-4, 4, 0.5]` | Sampling range for seed points |
| `nRepeats` | `number` | `1` | Number of times to loop the animation |
| `noiseRange` | `number` | `0` | Random offset added to seed positions |
| `dt` | `number` | `0.05` | Integration time step |
| `virtualTime` | `number` | `3` | Total integration time for each stream line |
| `maxAnchorsPerLine` | `number` | `100` | Maximum bezier anchors per line |
| `padding` | `number` | `3` | Extra padding beyond the range for spawning |
| `strokeWidth` | `number` | `1` | Stroke width of the stream lines |
| `opacity` | `number` | `1` | Opacity of the stream lines |
| `colorScheme` | `ManimColor[]` | `DEFAULT_SCALAR_FIELD_COLORS` | Colors mapped by magnitude |

```ts
const streamLines = new StreamLines({
  func: (point) => {
    const [x, y] = [point.get(0), point.get(1)];
    return np.array([-y, x, 0]);
  },
  xRange: [-3, 3, 0.3],
  yRange: [-3, 3, 0.3],
  strokeWidth: 2,
});
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `startAnimation()` | `(options?: AnimationOptions) => void` | Begins the stream line animation |
| `endAnimation()` | `() => void` | Stops the animation |

---

## DEFAULT_SCALAR_FIELD_COLORS

A constant array of colors used as the default gradient for magnitude-based coloring.

```ts
import { DEFAULT_SCALAR_FIELD_COLORS } from "manim-ts/mobjects/vector_field";

// Typically: [BLUE, GREEN, YELLOW, RED]
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class VectorFieldExample(Scene):
    def construct(self):
        field = ArrowVectorField(
            lambda pos: np.array([-pos[1], pos[0], 0]),
            x_range=[-3, 3, 0.5],
            y_range=[-3, 3, 0.5],
        )
        self.add(field)

        stream = StreamLines(
            lambda pos: np.array([-pos[1], pos[0], 0]),
            x_range=[-3, 3, 0.3],
            y_range=[-3, 3, 0.3],
            stroke_width=2,
        )
        stream.start_animation()
        self.add(stream)
        self.wait(3)
        stream.end_animation()
```

```ts
// TypeScript manim-ts
import { ArrowVectorField, StreamLines } from "manim-ts/mobjects/vector_field";
import { np } from "manim-ts/core/math";

class VectorFieldExample extends Scene {
  async construct() {
    const field = new ArrowVectorField({
      func: (pos) => np.array([-pos.get(1), pos.get(0), 0]),
      xRange: [-3, 3, 0.5],
      yRange: [-3, 3, 0.5],
    });
    this.add(field);

    const stream = new StreamLines({
      func: (pos) => np.array([-pos.get(1), pos.get(0), 0]),
      xRange: [-3, 3, 0.3],
      yRange: [-3, 3, 0.3],
      strokeWidth: 2,
    });
    stream.startAnimation();
    this.add(stream);
    await this.wait(3);
    stream.endAnimation();
  }
}
```

### Key Differences

- **Lambda to arrow function**: `lambda pos: np.array([-pos[1], pos[0], 0])` becomes `(pos) => np.array([-pos.get(1), pos.get(0), 0])`.
- **Array indexing**: `pos[1]` becomes `pos.get(1)` since numpy-ts NDArrays use `.get()` for element access.
- **`snake_case` to `camelCase`**: `x_range` becomes `xRange`, `stroke_width` becomes `strokeWidth`, etc.
- **Async construct**: The `construct` method is `async` to support `await this.wait(3)`.
