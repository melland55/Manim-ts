---
title: "Fading"
sidebar_position: 3
---

# Fading

Animations for fading mobjects in and out of a scene. These control opacity transitions and can optionally include spatial movement (shift) or scaling.

## FadeIn

Fades a mobject into the scene by animating its opacity from 0 to its target value. Optionally applies a spatial shift or scale during the fade.

```typescript
import { FadeIn } from "manim-ts/animation/fading";

// Simple fade in
await this.play(new FadeIn(circle));

// Fade in from a direction
await this.play(new FadeIn(circle, { shift: DOWN }));

// Fade in with scale
await this.play(new FadeIn(circle, { scale: 0.5 }));

// Fade in toward a target position
await this.play(new FadeIn(circle, { targetPosition: np.array([2, 1, 0]) }));
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shift` | `Point3D` | `undefined` | Direction to fade in from. The mobject starts offset by this vector and slides to its final position. |
| `scale` | `number` | `undefined` | Starting scale factor. The mobject grows from this scale to its final size. |
| `targetPosition` | `Point3D` | `undefined` | The mobject fades in while moving toward this position. |

### Behavior

- When `shift` is provided (e.g., `DOWN`), the mobject starts displaced by the shift vector and moves to its final position while fading in.
- When `scale` is provided, the mobject starts at that scale factor and grows to full size. A value less than 1 means it grows; greater than 1 means it shrinks into place.
- When `targetPosition` is provided, the mobject slides from its initial position toward the target while fading in.
- These options can be combined.

## FadeOut

Fades a mobject out of the scene by animating its opacity to 0. Supports the same spatial options as `FadeIn` but in reverse.

```typescript
import { FadeOut } from "manim-ts/animation/fading";

// Simple fade out
await this.play(new FadeOut(circle));

// Fade out in a direction
await this.play(new FadeOut(circle, { shift: UP }));

// Fade out with shrink
await this.play(new FadeOut(circle, { scale: 0.5 }));
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shift` | `Point3D` | `undefined` | Direction to fade out toward. The mobject slides in this direction while disappearing. |
| `scale` | `number` | `undefined` | Final scale factor. The mobject shrinks/grows to this scale while fading out. |
| `targetPosition` | `Point3D` | `undefined` | The mobject slides toward this position while fading out. |

### Behavior

- `FadeOut` automatically sets `remover: true`, so the mobject is removed from the scene when the animation completes.
- When `shift` is provided, the mobject drifts in that direction as it disappears.
- When `scale` is provided, the mobject resizes to that scale factor while fading. Use `scale: 0.5` to shrink or `scale: 2` to grow while fading out.

## FadeOptions

The shared options type used by both `FadeIn` and `FadeOut`:

```typescript
interface FadeOptions extends AnimationOptions {
  shift?: Point3D;
  scale?: number;
  targetPosition?: Point3D;
}
```

## Common Patterns

### Slide transitions

```typescript
// Fade in from left
await this.play(new FadeIn(mob, { shift: LEFT.scale(2) }));

// Fade out to right
await this.play(new FadeOut(mob, { shift: RIGHT.scale(2) }));
```

### Zoom transitions

```typescript
// Zoom in from small
await this.play(new FadeIn(mob, { scale: 0.1 }));

// Zoom out growing
await this.play(new FadeOut(mob, { scale: 3 }));
```

### Staggered group fading

```typescript
const group = new VGroup(circle, square, triangle);
await this.play(new FadeIn(group, { shift: UP, lagRatio: 0.3 }));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class FadeScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        square = Square(color=RED)
        
        self.play(FadeIn(circle, shift=DOWN))
        self.play(FadeIn(square, scale=0.5))
        self.wait(1)
        self.play(FadeOut(circle, shift=UP * 2))
        self.play(FadeOut(square, target_position=ORIGIN))
```

### TypeScript (manim-ts)

```typescript
class FadeScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ color: BLUE });
    const square = new Square({ color: RED });

    await this.play(new FadeIn(circle, { shift: DOWN }));
    await this.play(new FadeIn(square, { scale: 0.5 }));
    await this.play(new Wait({ runTime: 1 }));
    await this.play(new FadeOut(circle, { shift: UP.scale(2) }));
    await this.play(new FadeOut(square, { targetPosition: ORIGIN }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `FadeIn(mob, shift=DOWN)` | `new FadeIn(mob, { shift: DOWN })` |
| `FadeOut(mob, scale=0.5)` | `new FadeOut(mob, { scale: 0.5 })` |
| `target_position=ORIGIN` | `targetPosition: ORIGIN` |
| `UP * 2` | `UP.scale(2)` |
