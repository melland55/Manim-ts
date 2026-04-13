---
title: "Mobject (Base)"
sidebar_position: 1
---

# Mobject (Base)

The `Mobject` class is the foundational building block in manim-ts. Every mathematical object -- shapes, text, graphs, 3D surfaces -- ultimately inherits from `Mobject`. It provides the core interface for positioning, styling, grouping, and animating objects.

## Mobject

```ts
import { Mobject } from "manim-ts/mobjects/mobject";
```

### Constructor Options

The `MobjectConstructorOptions` interface defines the base options available to every mobject:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `ManimColor` | `WHITE` | The primary color of the mobject |
| `name` | `string` | Class name | A human-readable label for debugging |
| `zIndex` | `number` | `0` | Controls draw order (higher = on top) |
| `opacity` | `number` | `1` | Overall opacity (0 = transparent, 1 = opaque) |

```ts
const mob = new Mobject({ color: BLUE, name: "my-object", zIndex: 2, opacity: 0.5 });
```

### Positioning Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getCenter()` | `() => Point3D` | Returns the center point of the mobject's bounding box |
| `getWidth()` | `() => number` | Returns the width of the bounding box |
| `getHeight()` | `() => number` | Returns the height of the bounding box |
| `moveTo()` | `(target: Point3D \| IMobject) => this` | Moves the mobject so its center aligns with the target |
| `shift()` | `(...vectors: Point3D[]) => this` | Translates the mobject by the sum of the given vectors |
| `scale()` | `(factor: number, options?: ScaleOptions) => this` | Scales the mobject about a point |
| `rotate()` | `(angle: number, options?: RotateOptions) => this` | Rotates by the given angle (radians) about an axis |
| `flip()` | `(axis?: Point3D) => this` | Reflects the mobject across the given axis |
| `nextTo()` | `(target: IMobject \| Point3D, direction?: Point3D, options?: NextToOptions) => this` | Places this mobject adjacent to another |
| `alignTo()` | `(target: IMobject \| Point3D, direction: Point3D) => this` | Aligns an edge of this mobject with the target |

### Hierarchy Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `add()` | `(...mobjects: IMobject[]) => this` | Adds child mobjects (submobjects) |
| `remove()` | `(...mobjects: IMobject[]) => this` | Removes child mobjects |
| `getFamily()` | `(recurse?: boolean) => IMobject[]` | Returns this mobject and all descendants |
| `copy()` | `() => this` | Returns a deep copy of the mobject |

### Style Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setColor()` | `(color: ManimColor) => this` | Sets the primary color |
| `setOpacity()` | `(opacity: number) => this` | Sets the overall opacity |

### Transform Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `applyMatrix()` | `(matrix: number[][]) => this` | Applies a transformation matrix to all points |
| `applyFunction()` | `(fn: (point: Point3D) => Point3D) => this` | Applies a point-wise function to all points |

### Updaters

| Method | Signature | Description |
|--------|-----------|-------------|
| `addUpdater()` | `(updater: UpdaterFn, options?: UpdaterOptions) => this` | Registers a function called every frame |

---

## Group

A `Group` is a container that holds multiple `Mobject` instances and treats them as a single unit for transforms and animations.

```ts
import { Group } from "manim-ts/mobjects/mobject";

const group = new Group(circle, square, triangle);
group.arrange(RIGHT, { buff: 0.5 });
```

### ArrangeInGridOptions

When calling `group.arrangeInGrid()`, you can pass these options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | `number` | auto | Number of rows |
| `cols` | `number` | auto | Number of columns |
| `buff` | `number` | `0.5` | Spacing between cells |
| `cellAlignment` | `Point3D` | `ORIGIN` | Alignment within each cell |
| `flowOrder` | `"rd" \| "dr"` | `"rd"` | Fill direction: right-then-down or down-then-right |

---

## AnimationBuilder

The `AnimationBuilder` provides a chainable API for creating animations from mobject method calls, similar to Python Manim's `.animate` syntax.

```ts
// Python: self.play(circle.animate.shift(RIGHT).set_color(RED))
scene.play(circle.animate.shift(RIGHT).setColor(RED));
```

---

## UpdaterBuilder

The `UpdaterBuilder` offers a fluent API for constructing updater functions that are called each frame.

```ts
circle.addUpdater((mob, dt) => {
  mob.rotate(dt * TAU);
});
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class Example(Scene):
    def construct(self):
        mob = Mobject(color=BLUE, name="demo")
        mob.shift(RIGHT * 2)
        mob.scale(1.5)

        group = Group(Circle(), Square())
        group.arrange(DOWN, buff=0.3)
        group.move_to(ORIGIN)
```

```ts
// TypeScript manim-ts
import { Mobject, Group } from "manim-ts/mobjects/mobject";
import { Circle, Square } from "manim-ts/mobjects/geometry";
import { BLUE, RIGHT, DOWN, ORIGIN } from "manim-ts/core";

class Example extends Scene {
  construct() {
    const mob = new Mobject({ color: BLUE, name: "demo" });
    mob.shift(RIGHT.scale(2));
    mob.scale(1.5);

    const group = new Group(new Circle(), new Square());
    group.arrange(DOWN, { buff: 0.3 });
    group.moveTo(ORIGIN);
  }
}
```

### Key Differences

- **Named constructor args**: Python uses positional/keyword args; TypeScript uses an options object.
- **Method names**: Python `snake_case` becomes TypeScript `camelCase` (e.g., `move_to` becomes `moveTo`).
- **Chaining**: Most mutating methods return `this` for fluent chaining.
- **No `*args`**: Variable arguments are replaced with explicit typed parameters or rest parameters.
