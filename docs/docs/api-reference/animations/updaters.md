---
title: "Updaters"
sidebar_position: 10
---

# Updaters

Animations and helper functions for creating dynamic, continuously updating mobjects. Updaters run every frame and are the primary mechanism for reactive and data-driven animations.

## UpdateFromFunc

Updates a mobject every frame using a provided function. The function receives the mobject and can modify it in any way.

```typescript
import { UpdateFromFunc } from "manim-ts/animation/updaters";

const dot = new Dot();
const label = new Text("Position: 0");

await this.play(
  dot.animate.shift(RIGHT.scale(3)),
  new UpdateFromFunc(label, (mob) => {
    mob.setText(`Position: ${dot.getCenter()[0].toFixed(1)}`);
    mob.nextTo(dot, UP);
  }),
  { runTime: 3 }
);
```

### Constructor

```typescript
new UpdateFromFunc(mobject: Mobject, updateFunc: (mob: Mobject) => void, options?: AnimationOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to update |
| `updateFunc` | `(mob: Mobject) => void` | Function called every frame with the mobject |

## UpdateFromAlphaFunc

Like `UpdateFromFunc`, but also receives the interpolation alpha value (0 to 1) representing progress through the animation.

```typescript
import { UpdateFromAlphaFunc } from "manim-ts/animation/updaters";

const circle = new Circle();

await this.play(new UpdateFromAlphaFunc(circle, (mob, alpha) => {
  mob.setColor(interpolateColor(BLUE, RED, alpha));
  mob.setOpacity(alpha);
}), { runTime: 2 });
```

### Constructor

```typescript
new UpdateFromAlphaFunc(
  mobject: Mobject,
  updateFunc: (mob: Mobject, alpha: number) => void,
  options?: AnimationOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to update |
| `updateFunc` | `(mob: Mobject, alpha: number) => void` | Function called with mobject and alpha [0, 1] |

## MaintainPositionRelativeTo

Keeps a mobject at a fixed offset relative to another mobject. As the reference mobject moves, the tracked mobject follows.

```typescript
import { MaintainPositionRelativeTo } from "manim-ts/animation/updaters";

const leader = new Circle();
const follower = new Dot().nextTo(leader, RIGHT);

await this.play(
  leader.animate.shift(UP.scale(2)),
  new MaintainPositionRelativeTo(follower, leader),
  { runTime: 2 }
);
```

### Constructor

```typescript
new MaintainPositionRelativeTo(
  mobject: Mobject,
  trackedMobject: Mobject,
  options?: AnimationOptions
)
```

## Helper Functions

These utility functions provide convenient ways to set up persistent updaters on mobjects without creating explicit animation objects.

### `always(mobject, method, ...args)`

Adds a persistent updater that calls a method on the mobject every frame. The updater remains active until explicitly removed.

```typescript
import { always } from "manim-ts/animation/updaters";

const label = new DecimalNumber(0);
const dot = new Dot();

// label always stays next to dot
always(label, "nextTo", dot, RIGHT);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to add the updater to |
| `method` | `string` | Method name to call on the mobject |
| `...args` | `any[]` | Arguments to pass to the method |

### `fAlways(mobject, method, ...argFuncs)`

Like `always`, but arguments are functions that are evaluated each frame. Useful when the arguments depend on dynamic values.

```typescript
import { fAlways } from "manim-ts/animation/updaters";

const label = new Text("");

// label text updates based on a dynamic value
fAlways(label, "setText", () => `Value: ${someValue.toFixed(2)}`);
```

### `alwaysRedraw(drawFunc)`

Creates a mobject that is redrawn from scratch every frame using the provided function. The function returns a new mobject each frame, and the result replaces the previous one.

```typescript
import { alwaysRedraw } from "manim-ts/animation/updaters";

const tracker = new ValueTracker(0);

const line = alwaysRedraw(() =>
  new Line(ORIGIN, np.array([tracker.getValue(), 0, 0]), { color: BLUE })
);

this.add(line);
await this.play(tracker.animate.setValue(3), { runTime: 2 });
```

### `alwaysShift(mobject, direction, rate)`

Adds an updater that continuously shifts the mobject in a given direction at a constant rate.

```typescript
import { alwaysShift } from "manim-ts/animation/updaters";

const dot = new Dot();
alwaysShift(dot, RIGHT, 0.5); // moves right at 0.5 units/second
this.add(dot);
await this.play(new Wait({ runTime: 4 }));
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to shift |
| `direction` | `Point3D` | Direction of movement |
| `rate` | `number` | Speed in units per second |

### `alwaysRotate(mobject, rate, options?)`

Adds an updater that continuously rotates the mobject at a constant angular rate.

```typescript
import { alwaysRotate } from "manim-ts/animation/updaters";

const square = new Square();
alwaysRotate(square, Math.PI / 2); // 90 degrees per second
this.add(square);
await this.play(new Wait({ runTime: 4 }));
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mobject` | `Mobject` | -- | The mobject to rotate |
| `rate` | `number` | -- | Angular velocity in radians per second |
| `options.aboutPoint` | `Point3D` | (center) | Point to rotate around |
| `options.axis` | `Point3D` | `OUT` | Axis of rotation |

## Utility Functions

### `turnAnimationIntoUpdater(animation)`

Converts a finite animation into a persistent updater. The animation plays once and then the final state is maintained, or the animation loops.

```typescript
import { turnAnimationIntoUpdater } from "manim-ts/animation/updaters";

const wiggleUpdater = turnAnimationIntoUpdater(new Wiggle(arrow));
arrow.addUpdater(wiggleUpdater);
```

### `cycleAnimation(animation)`

Creates an updater from an animation that cycles (loops) continuously.

```typescript
import { cycleAnimation } from "manim-ts/animation/updaters";

const pulseUpdater = cycleAnimation(new Indicate(dot));
dot.addUpdater(pulseUpdater);
```

## Common Patterns

### Dynamic label

```typescript
const tracker = new ValueTracker(0);
const number = alwaysRedraw(() =>
  new DecimalNumber(tracker.getValue()).moveTo(ORIGIN)
);

this.add(number);
await this.play(tracker.animate.setValue(100), { runTime: 5, rateFunc: linear });
```

### Line connecting two moving objects

```typescript
const dotA = new Dot(LEFT.scale(2));
const dotB = new Dot(RIGHT.scale(2));
const line = alwaysRedraw(() =>
  new Line(dotA.getCenter(), dotB.getCenter(), { color: WHITE })
);

this.add(dotA, dotB, line);
await this.play(
  dotA.animate.shift(UP.scale(2)),
  dotB.animate.shift(DOWN.scale(2)),
  { runTime: 2 }
);
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class UpdaterScene(Scene):
    def construct(self):
        dot = Dot()
        label = always_redraw(lambda: Text(f"x={dot.get_x():.1f}").next_to(dot, UP))
        
        self.add(dot, label)
        self.play(dot.animate.shift(RIGHT * 3), run_time=3)

        tracker = ValueTracker(0)
        number = DecimalNumber(0)
        f_always(number, DecimalNumber.set_value, tracker.get_value)
        
        self.add(number)
        self.play(tracker.animate.set_value(10), run_time=2)

        arrow = Arrow(LEFT, RIGHT)
        always_rotate(arrow, rate=PI/2, about_point=ORIGIN)
        self.add(arrow)
        self.wait(4)
```

### TypeScript (manim-ts)

```typescript
class UpdaterScene extends Scene {
  async construct(): Promise<void> {
    const dot = new Dot();
    const label = alwaysRedraw(() =>
      new Text(`x=${dot.getX().toFixed(1)}`).nextTo(dot, UP)
    );

    this.add(dot, label);
    await this.play(dot.animate.shift(RIGHT.scale(3)), { runTime: 3 });

    const tracker = new ValueTracker(0);
    const number = new DecimalNumber(0);
    fAlways(number, "setValue", () => tracker.getValue());

    this.add(number);
    await this.play(tracker.animate.setValue(10), { runTime: 2 });

    const arrow = new Arrow(LEFT, RIGHT);
    alwaysRotate(arrow, Math.PI / 2, { aboutPoint: ORIGIN });
    this.add(arrow);
    await this.play(new Wait({ runTime: 4 }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `always_redraw(lambda: ...)` | `alwaysRedraw(() => ...)` |
| `f_always(mob, method, func)` | `fAlways(mob, "method", func)` |
| `always_rotate(mob, rate=PI/2)` | `alwaysRotate(mob, Math.PI / 2)` |
| `always_shift(mob, RIGHT, 0.5)` | `alwaysShift(mob, RIGHT, 0.5)` |
| `UpdateFromFunc(mob, func)` | `new UpdateFromFunc(mob, func)` |
| `UpdateFromAlphaFunc(mob, func)` | `new UpdateFromAlphaFunc(mob, func)` |
| `about_point=ORIGIN` | `{ aboutPoint: ORIGIN }` |
| `f"x={val:.1f}"` | `` `x=${val.toFixed(1)}` `` |
