---
title: "Transform"
sidebar_position: 5
---

# Transform

Animations that morph one mobject into another by interpolating their points. This is one of the most powerful and frequently used animation families in manim-ts.

## Transform

The core morphing animation. Interpolates the points and style of a source mobject into those of a target mobject. After the animation, the source mobject has the appearance of the target, but it is still the same object in memory.

```typescript
import { Transform } from "manim-ts/animation/transform";

const circle = new Circle();
const square = new Square();
await this.play(new Transform(circle, square));
// circle now looks like square, but is still the circle object
```

### Constructor

```typescript
new Transform(mobject: Mobject, target: Mobject, options?: TransformOptions)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pathFunc` | `PathFunc` | `straightPath` | Function determining the interpolation path |
| `pathArc` | `number` | `0` | Arc angle for the interpolation path |
| `pathArcAxis` | `Point3D` | `OUT` | Axis of rotation for arc path |
| `replaceMobjectWithTargetInScene` | `boolean` | `false` | Whether to swap the mobject for the target |

## ReplacementTransform

Like `Transform`, but replaces the source mobject with the target mobject in the scene. After the animation, the source is removed and the target is present in the scene.

```typescript
import { ReplacementTransform } from "manim-ts/animation/transform";

const circle = new Circle();
const square = new Square();
await this.play(new ReplacementTransform(circle, square));
// circle is removed from scene, square is now in scene
```

## TransformFromCopy

Keeps the original mobject in place and transforms a copy of it into the target. Both the original and the target remain in the scene.

```typescript
import { TransformFromCopy } from "manim-ts/animation/transform";

const circle = new Circle().shift(LEFT.scale(2));
const square = new Square().shift(RIGHT.scale(2));
await this.play(new TransformFromCopy(circle, square));
// circle stays, square appears via morphing copy
```

## ClockwiseTransform

A `Transform` that follows a clockwise arc path between the source and target.

```typescript
import { ClockwiseTransform } from "manim-ts/animation/transform";

await this.play(new ClockwiseTransform(mobA, mobB));
```

## CounterclockwiseTransform

A `Transform` that follows a counterclockwise arc path.

```typescript
import { CounterclockwiseTransform } from "manim-ts/animation/transform";

await this.play(new CounterclockwiseTransform(mobA, mobB));
```

## MoveToTarget

Animates a mobject to its `.target` state. You must set `mob.target` before playing this animation.

```typescript
import { MoveToTarget } from "manim-ts/animation/transform";

const circle = new Circle();
circle.generateTarget();
circle.target!.shift(RIGHT.scale(2));
circle.target!.setColor(RED);
await this.play(new MoveToTarget(circle));
```

## ApplyMethod

Animates the result of calling a method on a mobject. The mobject transitions from its current state to the state it would have after the method is applied.

```typescript
import { ApplyMethod } from "manim-ts/animation/transform";

await this.play(new ApplyMethod(circle, "shift", [RIGHT.scale(2)]));
```

## ApplyPointwiseFunction

Applies a function to every point of the mobject, interpolating from the original positions.

```typescript
import { ApplyPointwiseFunction } from "manim-ts/animation/transform";

await this.play(new ApplyPointwiseFunction(
  (point: Point3D) => np.array([point[0] ** 2, point[1], point[2]]),
  mobject
));
```

## FadeToColor

Animates a color change on a mobject.

```typescript
import { FadeToColor } from "manim-ts/animation/transform";

await this.play(new FadeToColor(circle, RED));
```

## ScaleInPlace

Scales a mobject in place (from its center) with animation.

```typescript
import { ScaleInPlace } from "manim-ts/animation/transform";

await this.play(new ScaleInPlace(circle, 2)); // double the size
```

## ShrinkToCenter

Shrinks a mobject to zero scale at its center, effectively making it disappear.

```typescript
import { ShrinkToCenter } from "manim-ts/animation/transform";

await this.play(new ShrinkToCenter(circle));
```

## Restore

Restores a mobject to a previously saved state. You must call `mob.saveState()` before using this animation.

```typescript
import { Restore } from "manim-ts/animation/transform";

circle.saveState();
circle.shift(RIGHT.scale(2));
circle.setColor(RED);
await this.play(new Restore(circle));
// circle returns to its original position and color
```

## ApplyMatrix

Applies a matrix transformation to a mobject with animation.

```typescript
import { ApplyMatrix } from "manim-ts/animation/transform";

const matrix = [[2, 1], [0, 1]]; // shear matrix
await this.play(new ApplyMatrix(matrix, mobject));
```

## ApplyComplexFunction

Applies a complex function to each point of the mobject, treating (x, y) as a complex number.

```typescript
import { ApplyComplexFunction } from "manim-ts/animation/transform";

// z -> z^2
await this.play(new ApplyComplexFunction(
  (z: [number, number]) => [z[0] * z[0] - z[1] * z[1], 2 * z[0] * z[1]],
  mobject
));
```

## CyclicReplace

Cyclically replaces the positions of a list of mobjects. Each mobject moves to the position of the next one in the list.

```typescript
import { CyclicReplace } from "manim-ts/animation/transform";

await this.play(new CyclicReplace([mobA, mobB, mobC]));
```

## Swap

Swaps the positions of two mobjects. A special case of `CyclicReplace` with exactly two mobjects.

```typescript
import { Swap } from "manim-ts/animation/transform";

await this.play(new Swap(mobA, mobB));
```

## FadeTransform

Cross-fades one mobject into another. Unlike `Transform`, this uses opacity blending rather than point interpolation, producing a dissolve effect.

```typescript
import { FadeTransform } from "manim-ts/animation/transform";

await this.play(new FadeTransform(circle, square));
```

## FadeTransformPieces

Like `FadeTransform`, but operates on individual submobjects, cross-fading each piece separately.

```typescript
import { FadeTransformPieces } from "manim-ts/animation/transform";

await this.play(new FadeTransformPieces(groupA, groupB));
```

## Path Functions

Functions that define the interpolation path between source and target positions.

### `straightPath()`

Linear interpolation between points (default).

```typescript
import { straightPath } from "manim-ts/animation/transform";

await this.play(new Transform(a, b, { pathFunc: straightPath() }));
```

### `spiralPath()`

Spiral interpolation path.

```typescript
import { spiralPath } from "manim-ts/animation/transform";

await this.play(new Transform(a, b, { pathFunc: spiralPath() }));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class TransformScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        square = Square(color=RED)
        triangle = Triangle(color=GREEN)

        self.play(Create(circle))
        self.play(Transform(circle, square))
        self.play(ReplacementTransform(square, triangle))

        circle2 = Circle()
        circle2.generate_target()
        circle2.target.shift(RIGHT * 2)
        circle2.target.set_color(YELLOW)
        self.play(MoveToTarget(circle2))

        circle2.save_state()
        self.play(circle2.animate.scale(0.5).shift(LEFT))
        self.play(Restore(circle2))
```

### TypeScript (manim-ts)

```typescript
class TransformScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ color: BLUE });
    const square = new Square({ color: RED });
    const triangle = new Triangle({ color: GREEN });

    await this.play(new Create(circle));
    await this.play(new Transform(circle, square));
    await this.play(new ReplacementTransform(square, triangle));

    const circle2 = new Circle();
    circle2.generateTarget();
    circle2.target!.shift(RIGHT.scale(2));
    circle2.target!.setColor(YELLOW);
    await this.play(new MoveToTarget(circle2));

    circle2.saveState();
    await this.play(circle2.animate.scale(0.5).shift(LEFT));
    await this.play(new Restore(circle2));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `Transform(a, b)` | `new Transform(a, b)` |
| `ReplacementTransform(a, b)` | `new ReplacementTransform(a, b)` |
| `generate_target()` | `generateTarget()` |
| `circle.target.shift(RIGHT * 2)` | `circle.target!.shift(RIGHT.scale(2))` |
| `save_state()` | `saveState()` |
| `Restore(mob)` | `new Restore(mob)` |
| `path_func=straight_path()` | `pathFunc: straightPath()` |
| `path_arc=PI/2` | `pathArc: Math.PI / 2` |
