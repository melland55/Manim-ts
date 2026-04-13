---
title: "Changing"
sidebar_position: 11
---

# Changing

Animations that create dynamic, continuously changing visual effects attached to mobjects. These produce persistent visual trails and animated boundaries.

## AnimatedBoundary

Creates an animated border that traces around a mobject continuously. The boundary cycles through colors as it draws, producing a colorful animated outline.

```typescript
import { AnimatedBoundary } from "manim-ts/animation/changing";

const square = new Square({ sideLength: 2 });
const boundary = new AnimatedBoundary(square);

this.add(square, boundary);
await this.play(new Wait({ runTime: 4 }));
```

### Constructor

```typescript
new AnimatedBoundary(mobject: VMobject, options?: AnimatedBoundaryOptions)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `colors` | `Color[]` | `[RED, GREEN, BLUE]` | Colors to cycle through |
| `maxStrokeWidth` | `number` | `3` | Maximum stroke width of the boundary |
| `cycleRate` | `number` | `0.5` | How fast the boundary cycles (in cycles per second) |
| `backAndForth` | `boolean` | `true` | Whether the tracing goes back and forth or loops |

### Behavior

- The boundary is a VMobject that traces the outline of the target mobject.
- It continuously animates as long as it is in the scene.
- The colors cycle smoothly along the boundary path.
- Use `this.add(boundary)` to make it appear; it updates automatically via an internal updater.
- If the target mobject moves or changes shape, the boundary follows.

### Key Methods

| Method | Description |
|--------|-------------|
| `getMobject()` | Returns the mobject being traced |

## TracedPath

Creates a trail that follows a moving mobject, recording its path over time. The trail is a VMobject that grows as the tracked mobject moves.

```typescript
import { TracedPath } from "manim-ts/animation/changing";

const dot = new Dot(LEFT.scale(2), { color: RED });
const trace = new TracedPath(dot.getCenter.bind(dot), {
  strokeColor: YELLOW,
  strokeWidth: 2,
});

this.add(dot, trace);
await this.play(
  new MoveAlongPath(dot, new Circle({ radius: 2 }), { runTime: 4 }),
);
```

### Constructor

```typescript
new TracedPath(tracedPointFunc: () => Point3D, options?: TracedPathOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `tracedPointFunc` | `() => Point3D` | Function returning the current position to trace |

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strokeColor` | `Color` | `WHITE` | Color of the trail |
| `strokeWidth` | `number` | `2` | Width of the trail stroke |
| `dissipatingTime` | `number \| undefined` | `undefined` | If set, the trail fades out after this many seconds |
| `minDistanceToNewPoint` | `number` | `0.1` | Minimum distance before adding a new point to the trail |

### Behavior

- The `tracedPointFunc` is called every frame. Typically, this is a bound method like `dot.getCenter.bind(dot)`.
- New points are only added when the tracked position moves at least `minDistanceToNewPoint` away from the last recorded point.
- When `dissipatingTime` is set, the trail gradually fades away behind the current position, creating a comet-like effect.
- The traced path is a VMobject, so it can be styled with any VMobject properties.

### Key Methods

| Method | Description |
|--------|-------------|
| `clearTrace()` | Removes all points from the trail |

## Common Patterns

### Tracing an orbit

```typescript
const sun = new Dot(ORIGIN, { color: YELLOW });
const planet = new Dot(RIGHT.scale(2), { color: BLUE });
const orbit = new TracedPath(planet.getCenter.bind(planet), {
  strokeColor: BLUE_B,
  strokeWidth: 1,
});

this.add(sun, planet, orbit);
alwaysRotate(planet, Math.PI / 2, { aboutPoint: ORIGIN });
await this.play(new Wait({ runTime: 8 }));
```

### Dissipating trail (comet effect)

```typescript
const dot = new Dot(ORIGIN, { color: WHITE });
const trail = new TracedPath(dot.getCenter.bind(dot), {
  strokeColor: YELLOW,
  dissipatingTime: 0.5,
});

this.add(dot, trail);
await this.play(new MoveAlongPath(dot, complexCurve, { runTime: 5 }));
```

### Animated boundary on text

```typescript
const title = new Text("Important!", { fontSize: 48, color: WHITE });
const border = new AnimatedBoundary(title, {
  colors: [RED, YELLOW, ORANGE],
  cycleRate: 1,
});

this.add(title, border);
await this.play(new Wait({ runTime: 5 }));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class TracingScene(Scene):
    def construct(self):
        dot = Dot(LEFT * 2, color=RED)
        trace = TracedPath(dot.get_center, stroke_color=YELLOW, dissipating_time=0.5)
        
        self.add(dot, trace)
        self.play(MoveAlongPath(dot, Circle(radius=2)), run_time=4)
        
        square = Square(side_length=2)
        boundary = AnimatedBoundary(square, colors=[RED, GREEN, BLUE], cycle_rate=0.5)
        
        self.add(square, boundary)
        self.wait(3)
```

### TypeScript (manim-ts)

```typescript
class TracingScene extends Scene {
  async construct(): Promise<void> {
    const dot = new Dot(LEFT.scale(2), { color: RED });
    const trace = new TracedPath(dot.getCenter.bind(dot), {
      strokeColor: YELLOW,
      dissipatingTime: 0.5,
    });

    this.add(dot, trace);
    await this.play(new MoveAlongPath(dot, new Circle({ radius: 2 }), { runTime: 4 }));

    const square = new Square({ sideLength: 2 });
    const boundary = new AnimatedBoundary(square, {
      colors: [RED, GREEN, BLUE],
      cycleRate: 0.5,
    });

    this.add(square, boundary);
    await this.play(new Wait({ runTime: 3 }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `TracedPath(dot.get_center)` | `new TracedPath(dot.getCenter.bind(dot))` |
| `stroke_color=YELLOW` | `strokeColor: YELLOW` |
| `dissipating_time=0.5` | `dissipatingTime: 0.5` |
| `AnimatedBoundary(mob, colors=[...])` | `new AnimatedBoundary(mob, { colors: [...] })` |
| `cycle_rate=0.5` | `cycleRate: 0.5` |
| `side_length=2` | `sideLength: 2` |
| Bound method reference (implicit) | Explicit `.bind(dot)` for method reference |
