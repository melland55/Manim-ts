---
title: "Value Tracker"
sidebar_position: 12
---

# Value Tracker

Value trackers are lightweight mobjects that hold a numeric value and participate in the animation system. They are the primary tool for creating reactive animations where multiple mobjects respond to a single changing value.

## ValueTracker

Tracks a single numeric value. Since `ValueTracker` is a `Mobject`, it can be targeted by animations like `animate` and responds to updaters.

```ts
import { ValueTracker } from "manim-ts/mobjects/value_tracker";
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `value` | `number` | `0` | Initial tracked value |

```ts
const tracker = new ValueTracker({ value: 0 });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getValue()` | `() => number` | Returns the current tracked value |
| `setValue()` | `(value: number) => this` | Sets the tracked value |
| `incrementValue()` | `(delta: number) => this` | Adds `delta` to the current value |
| `interpolate()` | `(mobject1: IMobject, mobject2: IMobject, alpha: number) => this` | Sets value by interpolating between two mobjects |

### Using with Updaters

The most common pattern is to create a `ValueTracker`, add updaters to other mobjects that read from it, then animate the tracker's value.

```ts
const tracker = new ValueTracker({ value: 0 });

const dot = new Dot({ point: ORIGIN, color: RED });
dot.addUpdater((mob) => {
  const x = tracker.getValue();
  mob.moveTo(np.array([x, Math.sin(x), 0]));
});

const label = new DecimalNumber({ number: 0 });
label.addUpdater((mob) => {
  mob.setValue(tracker.getValue());
  mob.nextTo(dot, UP);
});

// Animate the tracker from 0 to 2*PI
scene.play(tracker.animate.setValue(TAU), { runTime: 3 });
```

### Using with animate

Since `ValueTracker` extends `Mobject`, the `.animate` builder works directly:

```ts
// Smoothly animate the value from current to 5
scene.play(tracker.animate.setValue(5), { runTime: 2 });

// Increment by 3 over 1 second
scene.play(tracker.animate.incrementValue(3), { runTime: 1 });
```

---

## ComplexValueTracker

Tracks a complex number value, stored as two components (real and imaginary).

```ts
import { ComplexValueTracker } from "manim-ts/mobjects/value_tracker";
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `value` | `{ re: number; im: number }` | `{ re: 0, im: 0 }` | Initial complex value |

```ts
const cTracker = new ComplexValueTracker({ value: { re: 1, im: 0 } });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getValue()` | `() => { re: number; im: number }` | Returns the current complex value |
| `setValue()` | `(value: { re: number; im: number }) => this` | Sets the complex value |

### Example: Complex Plane Animation

```ts
const plane = new ComplexPlane();
const tracker = new ComplexValueTracker({ value: { re: 1, im: 0 } });

const dot = new Dot({ color: YELLOW });
dot.addUpdater((mob) => {
  const z = tracker.getValue();
  mob.moveTo(plane.numberToPoint(z));
});

const label = new MathTex({ texStrings: ["z"] });
label.addUpdater((mob) => {
  mob.nextTo(dot, UR, { buff: 0.1 });
});

// Animate from 1+0i to 0+2i
scene.play(tracker.animate.setValue({ re: 0, im: 2 }), { runTime: 2 });
```

---

## Common Patterns

### Linking Multiple Mobjects to One Value

```ts
const t = new ValueTracker({ value: 0 });

const axes = new Axes({ xRange: [-1, 7, 1], yRange: [-2, 2, 1] });
const graph = axes.plot((x) => Math.sin(x), { color: BLUE });

const dot = new Dot({ color: RED });
dot.addUpdater((mob) => {
  const x = t.getValue();
  mob.moveTo(axes.coordsToPoint(x, Math.sin(x)));
});

const vLine = new DashedLine({ start: ORIGIN, end: ORIGIN });
vLine.addUpdater((mob) => {
  const x = t.getValue();
  mob.putStartAndEnd(
    axes.coordsToPoint(x, 0),
    axes.coordsToPoint(x, Math.sin(x)),
  );
});

scene.play(t.animate.setValue(TAU), { runTime: 4, rateFunc: linear });
```

### Chaining Value Changes

```ts
const tracker = new ValueTracker({ value: 0 });

await scene.play(tracker.animate.setValue(3), { runTime: 1 });
await scene.play(tracker.animate.setValue(-2), { runTime: 1 });
await scene.play(tracker.animate.incrementValue(5), { runTime: 1 });
// Final value: 3
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class TrackerExample(Scene):
    def construct(self):
        tracker = ValueTracker(0)

        dot = Dot(color=RED)
        dot.add_updater(
            lambda m: m.move_to(RIGHT * tracker.get_value())
        )

        label = DecimalNumber(0)
        label.add_updater(lambda m: m.set_value(tracker.get_value()))
        label.add_updater(lambda m: m.next_to(dot, UP))

        self.add(dot, label)
        self.play(tracker.animate.set_value(5), run_time=3)
        self.play(tracker.animate.increment_value(-3), run_time=2)
```

```ts
// TypeScript manim-ts
import { ValueTracker } from "manim-ts/mobjects/value_tracker";
import { Dot } from "manim-ts/mobjects/geometry";
import { DecimalNumber } from "manim-ts/mobjects/text";
import { RED, RIGHT, UP } from "manim-ts/core";

class TrackerExample extends Scene {
  async construct() {
    const tracker = new ValueTracker({ value: 0 });

    const dot = new Dot({ color: RED });
    dot.addUpdater((m) => m.moveTo(RIGHT.scale(tracker.getValue())));

    const label = new DecimalNumber({ number: 0 });
    label.addUpdater((m) => m.setValue(tracker.getValue()));
    label.addUpdater((m) => m.nextTo(dot, UP));

    this.add(dot, label);
    await this.play(tracker.animate.setValue(5), { runTime: 3 });
    await this.play(tracker.animate.incrementValue(-3), { runTime: 2 });
  }
}
```

### Key Differences

- **Constructor**: `ValueTracker(0)` becomes `new ValueTracker({ value: 0 })`.
- **`lambda` to arrow function**: Python lambdas become TypeScript arrow functions.
- **`snake_case` to `camelCase`**: `get_value` becomes `getValue`, `set_value` becomes `setValue`, `add_updater` becomes `addUpdater`.
- **Async/await**: `self.play(...)` becomes `await this.play(...)` since animations are async in TypeScript.
- **Animation options object**: `run_time=3` (keyword arg) becomes `{ runTime: 3 }` (options object).
- **Vector arithmetic**: `RIGHT * tracker.get_value()` becomes `RIGHT.scale(tracker.getValue())`.
