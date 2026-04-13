---
title: "Growing"
sidebar_position: 4
---

# Growing

Animations that make mobjects grow into existence from a specific point, center, or edge. These create visually appealing introductions where the mobject expands from nothing to its full size.

## GrowFromPoint

Grows a mobject from a specific point in space. The mobject starts at zero scale at the given point and expands to its full size at its final position.

```typescript
import { GrowFromPoint } from "manim-ts/animation/growing";

const circle = new Circle();
await this.play(new GrowFromPoint(circle, np.array([0, -2, 0])));
```

### Constructor

```typescript
new GrowFromPoint(mobject: Mobject, point: Point3D, options?: AnimationOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to grow |
| `point` | `Point3D` | The point to grow from |
| `options` | `AnimationOptions` | Optional animation settings |

## GrowFromCenter

Grows a mobject from its own center. A convenience wrapper around `GrowFromPoint` that uses the mobject's center as the growth origin.

```typescript
import { GrowFromCenter } from "manim-ts/animation/growing";

const square = new Square({ color: BLUE });
await this.play(new GrowFromCenter(square));
```

### Constructor

```typescript
new GrowFromCenter(mobject: Mobject, options?: AnimationOptions)
```

## GrowFromEdge

Grows a mobject from one of its edges. The mobject expands from the specified edge direction to its full size.

```typescript
import { GrowFromEdge } from "manim-ts/animation/growing";

const rect = new Rectangle({ width: 3, height: 1 });

// Grow from the left edge
await this.play(new GrowFromEdge(rect, LEFT));

// Grow from the bottom edge
await this.play(new GrowFromEdge(rect, DOWN));
```

### Constructor

```typescript
new GrowFromEdge(mobject: Mobject, edge: Point3D, options?: AnimationOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to grow |
| `edge` | `Point3D` | Direction constant (LEFT, RIGHT, UP, DOWN, etc.) |
| `options` | `AnimationOptions` | Optional animation settings |

## GrowArrow

A specialized growing animation for `Arrow` mobjects. The arrow grows from its start point to its end point, giving the appearance of extending outward.

```typescript
import { GrowArrow } from "manim-ts/animation/growing";

const arrow = new Arrow(LEFT.scale(2), RIGHT.scale(2));
await this.play(new GrowArrow(arrow));
```

### Constructor

```typescript
new GrowArrow(arrow: Arrow, options?: AnimationOptions)
```

### Behavior

- The arrow starts at zero length at its tail and extends to its full length.
- Works with any `Arrow` subclass.

## SpinInFromNothing

Combines growing with rotation. The mobject starts at zero scale and spins (rotates a full turn) while growing to its full size.

```typescript
import { SpinInFromNothing } from "manim-ts/animation/growing";

const star = new Star({ color: YELLOW });
await this.play(new SpinInFromNothing(star));
```

### Constructor

```typescript
new SpinInFromNothing(mobject: Mobject, options?: SpinInOptions)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `angle` | `number` | `Math.PI * 2` | Total rotation angle during growth (default: full turn) |

## Common Patterns

### Growing arrows in a diagram

```typescript
const arrows = [
  new Arrow(a.getRight(), b.getLeft()),
  new Arrow(b.getRight(), c.getLeft()),
];

await this.play(
  ...arrows.map(a => new GrowArrow(a))
);
```

### Staggered growth

```typescript
const shapes = new VGroup(circle, square, triangle);
await this.play(
  new LaggedStart(
    ...shapes.submobjects.map(m => new GrowFromCenter(m)),
    { lagRatio: 0.3 }
  )
);
```

### Growing from a shared point

```typescript
const origin = ORIGIN;
const mobs = [circle, square, triangle];

await this.play(
  ...mobs.map(m => new GrowFromPoint(m, origin))
);
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class GrowScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        arrow = Arrow(LEFT * 2, RIGHT * 2)
        star = Star(color=YELLOW)

        self.play(GrowFromCenter(circle))
        self.play(GrowArrow(arrow))
        self.play(SpinInFromNothing(star))
        self.play(GrowFromEdge(circle, DOWN))
        self.play(GrowFromPoint(circle, ORIGIN))
```

### TypeScript (manim-ts)

```typescript
class GrowScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ color: BLUE });
    const arrow = new Arrow(LEFT.scale(2), RIGHT.scale(2));
    const star = new Star({ color: YELLOW });

    await this.play(new GrowFromCenter(circle));
    await this.play(new GrowArrow(arrow));
    await this.play(new SpinInFromNothing(star));
    await this.play(new GrowFromEdge(circle, DOWN));
    await this.play(new GrowFromPoint(circle, ORIGIN));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `GrowFromCenter(mob)` | `new GrowFromCenter(mob)` |
| `GrowFromEdge(mob, DOWN)` | `new GrowFromEdge(mob, DOWN)` |
| `GrowFromPoint(mob, ORIGIN)` | `new GrowFromPoint(mob, ORIGIN)` |
| `GrowArrow(arrow)` | `new GrowArrow(arrow)` |
| `SpinInFromNothing(mob)` | `new SpinInFromNothing(mob)` |
| `LEFT * 2` | `LEFT.scale(2)` |
