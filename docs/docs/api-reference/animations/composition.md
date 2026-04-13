---
title: "Composition"
sidebar_position: 9
---

# Composition

Animations that combine multiple animations together, controlling how they play relative to each other in time. These are essential for building complex, choreographed animation sequences.

## AnimationGroup

Plays multiple animations simultaneously. All animations in the group run at the same time, and the group finishes when the longest animation completes.

```typescript
import { AnimationGroup } from "manim-ts/animation/composition";

const circle = new Circle();
const square = new Square();

await this.play(new AnimationGroup(
  new FadeIn(circle, { shift: LEFT }),
  new FadeIn(square, { shift: RIGHT }),
));
```

### Constructor

```typescript
new AnimationGroup(...animations: Animation[], options?: AnimationGroupOptions)
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lagRatio` | `number` | `0` | Controls staggering between animations (0 = fully simultaneous, 1 = fully sequential) |
| `group` | `Group \| VGroup` | (auto) | The group of mobjects involved |

### Behavior

- With `lagRatio: 0` (default), all animations start and end together.
- With `lagRatio: 0.5`, each animation starts when the previous one is halfway done.
- With `lagRatio: 1`, animations play one after another (equivalent to `Succession`).
- The total `runTime` is distributed across all animations according to the lag ratio.

## Succession

Plays animations one after another in sequence. Each animation starts only after the previous one finishes.

```typescript
import { Succession } from "manim-ts/animation/composition";

await this.play(new Succession(
  new FadeIn(circle),
  new Rotate(circle, { angle: Math.PI }),
  new FadeOut(circle),
));
```

### Constructor

```typescript
new Succession(...animations: Animation[], options?: AnimationOptions)
```

### Behavior

- Animations play back-to-back with no overlap.
- The total run time equals the sum of all individual run times.
- Each animation's `begin()` is called only when the previous animation's `finish()` completes.

## LaggedStart

A convenience wrapper around `AnimationGroup` with a nonzero `lagRatio`. Creates a staggered start effect where each animation begins slightly after the previous one.

```typescript
import { LaggedStart } from "manim-ts/animation/composition";

const circles = Array.from({ length: 5 }, (_, i) =>
  new Circle().shift(RIGHT.scale(i - 2))
);

await this.play(new LaggedStart(
  ...circles.map(c => new FadeIn(c, { shift: UP })),
  { lagRatio: 0.3 }
));
```

### Constructor

```typescript
new LaggedStart(...animations: Animation[], options?: LaggedStartOptions)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lagRatio` | `number` | `DEFAULT_LAGGED_START_LAG_RATIO` | Stagger ratio (default: 0.05) |

### Behavior

- `lagRatio` controls the overlap between animations:
  - `0.0` = all start at the same time
  - `0.5` = each starts when the previous is half done
  - `1.0` = fully sequential (no overlap)
- The default `DEFAULT_LAGGED_START_LAG_RATIO` is `0.05`, which gives a subtle cascade effect.

## LaggedStartMap

Applies the same animation type to a list of mobjects with staggered starts. A convenience for the common pattern of mapping an animation constructor over mobjects.

```typescript
import { LaggedStartMap } from "manim-ts/animation/composition";

const letters = new VGroup(...text.submobjects);

// Fade in each letter with stagger
await this.play(new LaggedStartMap(FadeIn, letters, {
  shift: UP,
  lagRatio: 0.1,
}));
```

### Constructor

```typescript
new LaggedStartMap(
  AnimClass: AnimationConstructor,
  mobjects: VGroup | Mobject[],
  options?: LaggedStartMapOptions
)
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lagRatio` | `number` | `0.05` | Stagger ratio between each mobject's animation |
| `...animOptions` | (varies) | -- | Additional options passed to each animation instance |

### Behavior

- Creates one animation per submobject (or per item in the array).
- Passes all extra options to each individual animation constructor.
- Equivalent to `new LaggedStart(...mobs.map(m => new AnimClass(m, opts)))`.

## DEFAULT_LAGGED_START_LAG_RATIO

The default lag ratio used by `LaggedStart` and `LaggedStartMap`.

```typescript
import { DEFAULT_LAGGED_START_LAG_RATIO } from "manim-ts/animation/composition";

console.log(DEFAULT_LAGGED_START_LAG_RATIO); // 0.05
```

## Common Patterns

### Staggered creation of a group

```typescript
const shapes = new VGroup(
  new Circle({ color: RED }),
  new Square({ color: GREEN }),
  new Triangle({ color: BLUE }),
);

await this.play(new LaggedStartMap(Create, shapes, { lagRatio: 0.3 }));
```

### Multi-step sequence

```typescript
await this.play(new Succession(
  new Create(circle),
  new Wait({ runTime: 0.5 }),
  new Transform(circle, square),
  new Wait({ runTime: 0.5 }),
  new FadeOut(square),
));
```

### Simultaneous with different durations

```typescript
await this.play(new AnimationGroup(
  new FadeIn(title, { runTime: 1 }),
  new Create(underline, { runTime: 2 }),
  new FadeIn(subtitle, { runTime: 1.5 }),
));
```

### Cascading fade-in

```typescript
const dots = new VGroup(
  ...Array.from({ length: 20 }, (_, i) =>
    new Dot(np.array([Math.cos(i * 0.3) * 2, Math.sin(i * 0.3) * 2, 0]))
  )
);

await this.play(new LaggedStart(
  ...dots.submobjects.map(d => new FadeIn(d, { scale: 0.5 })),
  { lagRatio: 0.1, runTime: 3 }
));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class CompositionScene(Scene):
    def construct(self):
        circles = VGroup(*[Circle() for _ in range(5)])
        circles.arrange(RIGHT)

        self.play(LaggedStart(*[Create(c) for c in circles], lag_ratio=0.3))
        self.play(LaggedStartMap(FadeOut, circles, shift=DOWN))

        square = Square()
        self.play(Succession(
            FadeIn(square),
            Rotate(square, angle=PI),
            FadeOut(square),
        ))

        a, b = Circle(), Square()
        self.play(AnimationGroup(
            FadeIn(a, shift=LEFT),
            FadeIn(b, shift=RIGHT),
            lag_ratio=0.5,
        ))
```

### TypeScript (manim-ts)

```typescript
class CompositionScene extends Scene {
  async construct(): Promise<void> {
    const circles = new VGroup(
      ...Array.from({ length: 5 }, () => new Circle())
    );
    circles.arrange(RIGHT);

    await this.play(new LaggedStart(
      ...circles.submobjects.map(c => new Create(c)),
      { lagRatio: 0.3 }
    ));
    await this.play(new LaggedStartMap(FadeOut, circles, { shift: DOWN }));

    const square = new Square();
    await this.play(new Succession(
      new FadeIn(square),
      new Rotate(square, { angle: Math.PI }),
      new FadeOut(square),
    ));

    const [a, b] = [new Circle(), new Square()];
    await this.play(new AnimationGroup(
      new FadeIn(a, { shift: LEFT }),
      new FadeIn(b, { shift: RIGHT }),
      { lagRatio: 0.5 },
    ));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `AnimationGroup(*anims, lag_ratio=0.5)` | `new AnimationGroup(...anims, { lagRatio: 0.5 })` |
| `Succession(a, b, c)` | `new Succession(a, b, c)` |
| `LaggedStart(*anims, lag_ratio=0.3)` | `new LaggedStart(...anims, { lagRatio: 0.3 })` |
| `LaggedStartMap(FadeOut, group, shift=DOWN)` | `new LaggedStartMap(FadeOut, group, { shift: DOWN })` |
| `*[Create(c) for c in circles]` | `...circles.submobjects.map(c => new Create(c))` |
