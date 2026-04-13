---
title: "Movement"
sidebar_position: 7
---

# Movement

Animations for moving mobjects through continuous deformations (homotopies), along vector fields, or along defined paths. These provide fine-grained control over spatial transformations over time.

## Homotopy

A continuous deformation that maps every point as a function of both position and time. The homotopy function receives `(x, y, z, t)` and returns a new `(x', y', z')` position.

```typescript
import { Homotopy } from "manim-ts/animation/movement";

// Wave deformation
await this.play(new Homotopy(
  (x, y, z, t) => [
    x + 0.5 * Math.sin(y + t * Math.PI * 2),
    y,
    z,
  ],
  mobject,
  { runTime: 3 }
));
```

### Constructor

```typescript
new Homotopy(
  homotopy: (x: number, y: number, z: number, t: number) => [number, number, number],
  mobject: Mobject,
  options?: AnimationOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `homotopy` | `(x, y, z, t) => [x', y', z']` | The deformation function. `t` goes from 0 to 1 over the animation duration. |
| `mobject` | `Mobject` | The mobject to deform |
| `options` | `AnimationOptions` | Optional animation settings |

### Behavior

- At `t = 0`, points should map to themselves (identity).
- At `t = 1`, points are at their final positions.
- The function is called for every point on every frame, so keep it efficient.

## SmoothedVectorizedHomotopy

A variant of `Homotopy` specifically for VMobjects that keeps Bezier curves smooth during the deformation. Standard `Homotopy` moves control points independently, which can cause curves to become jagged. This version recomputes smooth handles.

```typescript
import { SmoothedVectorizedHomotopy } from "manim-ts/animation/movement";

await this.play(new SmoothedVectorizedHomotopy(
  (x, y, z, t) => [x * (1 + t), y * (1 + t), z],
  vmobject,
  { runTime: 2 }
));
```

### Constructor

Same as `Homotopy`, but the mobject must be a `VMobject`.

## ComplexHomotopy

A homotopy defined in the complex plane. The function receives and returns complex numbers, making it natural for conformal mappings and complex analysis animations.

```typescript
import { ComplexHomotopy } from "manim-ts/animation/movement";

// z -> z * e^(i*t*pi), rotation in complex plane
await this.play(new ComplexHomotopy(
  (z, t) => {
    const angle = t * Math.PI;
    return [
      z[0] * Math.cos(angle) - z[1] * Math.sin(angle),
      z[0] * Math.sin(angle) + z[1] * Math.cos(angle),
    ];
  },
  mobject
));
```

### Constructor

```typescript
new ComplexHomotopy(
  complexHomotopy: (z: [number, number], t: number) => [number, number],
  mobject: Mobject,
  options?: AnimationOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `complexHomotopy` | `(z, t) => [re, im]` | Complex deformation function |

## PhaseFlow

Moves points along a vector field. Each point follows the flow defined by the given vector function, simulating particle motion through a field.

```typescript
import { PhaseFlow } from "manim-ts/animation/movement";

// Rotate all points around the origin
await this.play(new PhaseFlow(
  (point: Point3D) => np.array([-point[1], point[0], 0]),
  mobject,
  { runTime: 2 }
));
```

### Constructor

```typescript
new PhaseFlow(
  vectorFunc: (point: Point3D) => Point3D,
  mobject: Mobject,
  options?: PhaseFlowOptions
)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `virtualTime` | `number` | `1` | How much "virtual time" to simulate in the flow |
| `suspendMobjectUpdating` | `boolean` | `false` | Whether to suspend updaters during animation |

## MoveAlongPath

Moves a mobject along a VMobject path curve. The mobject's center follows the path from start to end.

```typescript
import { MoveAlongPath } from "manim-ts/animation/movement";

const dot = new Dot();
const path = new Arc({ angle: Math.PI, radius: 2 });

await this.play(new MoveAlongPath(dot, path, { runTime: 2 }));
```

### Constructor

```typescript
new MoveAlongPath(
  mobject: Mobject,
  path: VMobject,
  options?: AnimationOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `mobject` | `Mobject` | The mobject to move |
| `path` | `VMobject` | The path curve to follow |
| `options` | `AnimationOptions` | Optional animation settings |

### Behavior

- The mobject's center is placed at `path.pointFromProportion(alpha)` for each frame.
- The path is not rendered; it is used only as a guide. Add it to the scene separately if you want it visible.
- Works with any VMobject that defines a continuous curve (Line, Arc, Circle, CubicBezier, etc.).

## Common Patterns

### Orbit along a circle

```typescript
const dot = new Dot(RIGHT.scale(2));
const orbit = new Circle({ radius: 2 });

await this.play(new MoveAlongPath(dot, orbit, { runTime: 3, rateFunc: linear }));
```

### Complex plane transformation

```typescript
const grid = new NumberPlane();

// z -> z^2
await this.play(new ComplexHomotopy(
  (z, t) => {
    const re = z[0] * z[0] - z[1] * z[1];
    const im = 2 * z[0] * z[1];
    return [
      z[0] + t * (re - z[0]),
      z[1] + t * (im - z[1]),
    ];
  },
  grid,
  { runTime: 3 }
));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class MovementScene(Scene):
    def construct(self):
        dot = Dot()
        path = Arc(angle=PI, radius=2)

        self.play(MoveAlongPath(dot, path, run_time=2))

        grid = NumberPlane()
        self.add(grid)
        self.play(Homotopy(
            lambda x, y, z, t: (x + 0.5 * np.sin(y + t * TAU), y, z),
            grid,
            run_time=3
        ))

        self.play(PhaseFlow(
            lambda p: np.array([-p[1], p[0], 0]),
            grid,
            run_time=2
        ))
```

### TypeScript (manim-ts)

```typescript
class MovementScene extends Scene {
  async construct(): Promise<void> {
    const dot = new Dot();
    const path = new Arc({ angle: Math.PI, radius: 2 });

    await this.play(new MoveAlongPath(dot, path, { runTime: 2 }));

    const grid = new NumberPlane();
    this.add(grid);
    await this.play(new Homotopy(
      (x, y, z, t) => [x + 0.5 * Math.sin(y + t * TAU), y, z],
      grid,
      { runTime: 3 }
    ));

    await this.play(new PhaseFlow(
      (p: Point3D) => np.array([-p[1], p[0], 0]),
      grid,
      { runTime: 2 }
    ));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `MoveAlongPath(dot, path)` | `new MoveAlongPath(dot, path)` |
| `lambda x, y, z, t: (...)` | `(x, y, z, t) => [...]` |
| Returns tuple `(x, y, z)` | Returns array `[x, y, z]` |
| `lambda p: np.array([...])` | `(p: Point3D) => np.array([...])` |
| `PhaseFlow(func, mob, virtual_time=2)` | `new PhaseFlow(func, mob, { virtualTime: 2 })` |
