---
title: "Rotation"
sidebar_position: 6
---

# Rotation

Animations for rotating mobjects. Includes both one-shot rotation animations and continuous rotation updaters.

## Rotate

Rotates a mobject by a specified angle over the animation's duration. This is a one-shot animation that rotates from the current orientation to the final orientation.

```typescript
import { Rotate } from "manim-ts/animation/rotation";

const square = new Square({ color: BLUE });

// Rotate 90 degrees (PI/2 radians)
await this.play(new Rotate(square, { angle: Math.PI / 2 }));

// Rotate about a specific point
await this.play(new Rotate(square, {
  angle: Math.PI,
  aboutPoint: ORIGIN,
}));

// Rotate about a specific axis (3D)
await this.play(new Rotate(square, {
  angle: Math.PI / 4,
  axis: UP,
}));
```

### Constructor

```typescript
new Rotate(mobject: Mobject, options?: RotateOptions)
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `angle` | `number` | `Math.PI` | Rotation angle in radians |
| `axis` | `Point3D` | `OUT` | Axis of rotation (default: z-axis, i.e., in-plane rotation) |
| `aboutPoint` | `Point3D \| undefined` | `undefined` | Point to rotate around (default: mobject's center) |
| `aboutEdge` | `Point3D \| undefined` | `undefined` | Edge direction to rotate around |

### Behavior

- By default, the mobject rotates around its own center.
- When `aboutPoint` is specified, the mobject orbits around that point.
- When `aboutEdge` is specified, the mobject rotates around the corresponding edge point.
- The `axis` parameter controls the 3D axis of rotation. `OUT` (default) means rotation in the XY plane.

## Rotating

A continuous rotation updater that rotates the mobject every frame. Unlike `Rotate`, this creates an ongoing rotation effect for as long as the updater is active.

```typescript
import { Rotating } from "manim-ts/animation/rotation";

const circle = new Circle();

// Continuously rotate
await this.play(new Rotating(circle, {
  angle: Math.PI * 2,  // one full rotation
  runTime: 3,
}));
```

### Constructor

```typescript
new Rotating(mobject: Mobject, options?: RotatingOptions)
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `angle` | `number` | `Math.PI * 2` | Total rotation angle over the full duration |
| `axis` | `Point3D` | `OUT` | Axis of rotation |
| `aboutPoint` | `Point3D \| undefined` | `undefined` | Point to rotate around |
| `aboutEdge` | `Point3D \| undefined` | `undefined` | Edge direction to rotate around |
| `rateFunc` | `(t: number) => number` | `linear` | Rate function (default is linear for continuous rotation) |

### Behavior

- Uses `linear` as the default rate function (unlike most animations which default to `smooth`), giving a constant angular velocity.
- The rotation is cumulative over the animation's duration.

## Common Patterns

### Rotate around another object

```typescript
const center = new Dot(ORIGIN);
const orbiter = new Dot(RIGHT.scale(2));

await this.play(new Rotate(orbiter, {
  angle: Math.PI * 2,
  aboutPoint: ORIGIN,
  runTime: 3,
  rateFunc: linear,
}));
```

### Flip a mobject

```typescript
// Flip horizontally (rotate PI around vertical axis)
await this.play(new Rotate(mob, { angle: Math.PI, axis: UP }));

// Flip vertically (rotate PI around horizontal axis)
await this.play(new Rotate(mob, { angle: Math.PI, axis: RIGHT }));
```

### Combine rotation with other animations

```typescript
await this.play(
  new Rotate(square, { angle: Math.PI / 2 }),
  new FadeIn(circle, { shift: UP }),
);
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class RotateScene(Scene):
    def construct(self):
        square = Square(color=BLUE)
        self.add(square)

        self.play(Rotate(square, angle=PI / 2, run_time=1))
        self.play(Rotate(square, angle=PI, about_point=ORIGIN))
        self.play(Rotating(square, angle=TAU, run_time=3, rate_func=linear))
```

### TypeScript (manim-ts)

```typescript
class RotateScene extends Scene {
  async construct(): Promise<void> {
    const square = new Square({ color: BLUE });
    this.add(square);

    await this.play(new Rotate(square, { angle: Math.PI / 2, runTime: 1 }));
    await this.play(new Rotate(square, { angle: Math.PI, aboutPoint: ORIGIN }));
    await this.play(new Rotating(square, { angle: TAU, runTime: 3, rateFunc: linear }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `Rotate(mob, angle=PI/2)` | `new Rotate(mob, { angle: Math.PI / 2 })` |
| `about_point=ORIGIN` | `aboutPoint: ORIGIN` |
| `about_edge=LEFT` | `aboutEdge: LEFT` |
| `PI`, `TAU` | `Math.PI`, `TAU` (or `Math.PI * 2`) |
| `rate_func=linear` | `rateFunc: linear` |
| `Rotating(mob, angle=TAU)` | `new Rotating(mob, { angle: TAU })` |
