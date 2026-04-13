---
title: "Specialized"
sidebar_position: 13
---

# Specialized

Specialized animations that provide unique visual effects not covered by other animation categories.

## Broadcast

Creates an expanding ring broadcast effect emanating from a mobject or point. Multiple concentric rings expand outward and fade, resembling a radar pulse or ripple in water.

```typescript
import { Broadcast } from "manim-ts/animation/specialized";

const dot = new Dot(ORIGIN, { color: BLUE });
this.add(dot);

await this.play(new Broadcast(dot));
```

### Constructor

```typescript
new Broadcast(mobject: Mobject, options?: BroadcastOptions)
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `focalPoint` | `Point3D` | (mobject center) | Center point of the broadcast rings |
| `nRings` | `number` | `3` | Number of concentric expanding rings |
| `bigRadius` | `number` | `2` | Maximum radius the rings expand to |
| `smallRadius` | `number` | `0` | Starting radius of the rings |
| `color` | `Color` | `WHITE` | Color of the rings |
| `runTime` | `number` | `3` | Duration of the broadcast effect |
| `lagRatio` | `number` | `0.7` | Stagger between successive rings |
| `remover` | `boolean` | `true` | Remove the rings after animation completes |

### Behavior

- Creates `nRings` concentric circles that expand from `smallRadius` to `bigRadius`.
- Each ring expands outward and fades in opacity as it grows.
- Rings are staggered by `lagRatio`, so they appear one after another, creating a ripple effect.
- After the animation, the rings are automatically removed from the scene (since `remover` defaults to `true`).

### Key Methods

| Method | Description |
|--------|-------------|
| `begin()` | Creates the ring mobjects and adds them to the scene |
| `finish()` | Removes the ring mobjects if `remover` is true |

## Common Patterns

### Highlight a point of interest

```typescript
const importantPoint = new Dot(np.array([2, 1, 0]), { color: RED });
this.add(importantPoint);

await this.play(new Broadcast(importantPoint, {
  color: RED,
  bigRadius: 3,
  nRings: 5,
}));
```

### Signal emission effect

```typescript
const antenna = new Line(ORIGIN, UP.scale(1.5));
this.add(antenna);

// Broadcast from the top of the antenna
await this.play(new Broadcast(antenna, {
  focalPoint: antenna.getEnd(),
  nRings: 4,
  bigRadius: 2.5,
  runTime: 2,
}));
```

### Combined with other animations

```typescript
const dot = new Dot(ORIGIN);

await this.play(
  new FadeIn(dot, { scale: 0.5 }),
  new Broadcast(dot, { nRings: 3, bigRadius: 2 }),
);
```

### Repeated broadcasts

```typescript
const source = new Dot(ORIGIN, { color: YELLOW });
this.add(source);

for (let i = 0; i < 3; i++) {
  await this.play(new Broadcast(source, {
    runTime: 1.5,
    bigRadius: 2 + i * 0.5,
    color: interpolateColor(YELLOW, RED, i / 2),
  }));
}
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class BroadcastScene(Scene):
    def construct(self):
        dot = Dot(ORIGIN, color=BLUE)
        self.add(dot)

        self.play(Broadcast(dot, n_rings=4, big_radius=3, run_time=2))

        self.play(Broadcast(
            dot,
            focal_point=UP * 2,
            color=RED,
            small_radius=0.5,
            big_radius=2.5,
        ))
```

### TypeScript (manim-ts)

```typescript
class BroadcastScene extends Scene {
  async construct(): Promise<void> {
    const dot = new Dot(ORIGIN, { color: BLUE });
    this.add(dot);

    await this.play(new Broadcast(dot, { nRings: 4, bigRadius: 3, runTime: 2 }));

    await this.play(new Broadcast(dot, {
      focalPoint: UP.scale(2),
      color: RED,
      smallRadius: 0.5,
      bigRadius: 2.5,
    }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `Broadcast(mob)` | `new Broadcast(mob)` |
| `n_rings=4` | `nRings: 4` |
| `big_radius=3` | `bigRadius: 3` |
| `small_radius=0.5` | `smallRadius: 0.5` |
| `focal_point=UP * 2` | `focalPoint: UP.scale(2)` |
| `run_time=2` | `runTime: 2` |
| `lag_ratio=0.7` | `lagRatio: 0.7` |
