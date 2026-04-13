---
title: "Animation (Base)"
sidebar_position: 1
---

# Animation (Base)

The foundation of all animations in manim-ts. Every animation class extends `Animation`, which defines the lifecycle and timing model for interpolating mobject state over time.

## Animation

The base class for all animations. An `Animation` takes a mobject and transforms it over a duration by interpolating between states.

### Constructor Options

```typescript
import { Animation } from "manim-ts/animation/animation";

const anim = new Animation(mobject, {
  runTime: 1,          // Duration in seconds (default: 1)
  rateFunc: smooth,    // Easing function (default: smooth)
  lagRatio: 0,         // Stagger ratio for submobject animations (default: 0)
  name: undefined,     // Optional name for debugging
  remover: false,      // Remove mobject from scene when animation finishes
  introducer: false,   // Add mobject to scene when animation starts
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `runTime` | `number` | `1` | Duration of the animation in seconds |
| `rateFunc` | `(t: number) => number` | `smooth` | Rate function controlling easing |
| `lagRatio` | `number` | `0` | Controls staggering across submobjects (0 = all together, 1 = one after another) |
| `name` | `string \| undefined` | `undefined` | Optional name for identification |
| `remover` | `boolean` | `false` | If true, the mobject is removed from the scene after the animation finishes |
| `introducer` | `boolean` | `false` | If true, the mobject is added to the scene when the animation begins |

### Lifecycle Methods

Every animation follows a three-phase lifecycle:

```typescript
// Phase 1: Setup — called once before interpolation begins
anim.begin();

// Phase 2: Interpolation — called each frame with alpha in [0, 1]
anim.interpolate(alpha);

// Phase 3: Teardown — called once after interpolation ends
anim.finish();
```

#### `begin()`

Initializes the animation. Creates a copy of the starting mobject state. Called automatically by `scene.play()`.

#### `interpolate(alpha: number)`

Called every frame with `alpha` in the range `[0, 1]`. The `alpha` value has already been passed through `rateFunc`. Subclasses override `interpolateMobject(alpha)` to define custom behavior.

#### `finish()`

Cleans up after the animation completes. If `remover` is true, the mobject is removed from the scene.

### Key Methods

| Method | Description |
|--------|-------------|
| `getMobjectsToBeginAnimation()` | Returns the mobjects that need setup |
| `getAllMobjects()` | Returns all mobjects involved in the animation |
| `isIntroducer()` | Whether this animation introduces its mobject |
| `isRemover()` | Whether this animation removes its mobject |
| `copy()` | Returns a deep copy of the animation |
| `getRunTime()` | Returns the total run time |
| `getRateFunc()` | Returns the rate function |

## Wait

A special animation that does nothing for a specified duration. Useful for adding pauses between animations.

```typescript
import { Wait } from "manim-ts/animation/animation";

await this.play(new Wait({ runTime: 2 }));
```

## Add

Instantly adds a mobject to the scene without any animation. Equivalent to calling `scene.add()` but usable within `scene.play()` chains.

```typescript
import { Add } from "manim-ts/animation/animation";

await this.play(new Add(mobject));
```

## Utility Functions

### `prepareAnimation(anim)`

Preprocesses an animation before playing. Validates the animation and prepares it for the scene.

```typescript
import { prepareAnimation } from "manim-ts/animation/animation";

const prepared = prepareAnimation(anim);
```

### `overrideAnimation(animClass, overrideFunc)`

Registers an override for a specific animation class, allowing custom behavior replacement.

```typescript
import { overrideAnimation } from "manim-ts/animation/animation";

overrideAnimation(FadeIn, (mobject, opts) => {
  return new CustomFadeIn(mobject, opts);
});
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class MyScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle), run_time=2)
        self.play(circle.animate.shift(RIGHT), run_time=1.5)
        self.wait(1)
        self.play(FadeOut(circle))
```

### TypeScript (manim-ts)

```typescript
class MyScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle();
    await this.play(new Create(circle, { runTime: 2 }));
    await this.play(circle.animate.shift(RIGHT), { runTime: 1.5 });
    await this.play(new Wait({ runTime: 1 }));
    await this.play(new FadeOut(circle));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `self.play(anim, run_time=2)` | `await this.play(new Animation(mob, { runTime: 2 }))` |
| `self.wait(1)` | `await this.play(new Wait({ runTime: 1 }))` |
| `run_time` (snake_case) | `runTime` (camelCase) |
| `rate_func=linear` | `rateFunc: linear` |
| `lag_ratio=0.5` | `lagRatio: 0.5` |
| Synchronous `construct` | `async construct(): Promise<void>` |
