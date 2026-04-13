---
title: "Speed Modifier"
sidebar_position: 14
---

# Speed Modifier

Animation wrapper that dynamically modifies the playback speed of another animation. This allows acceleration, deceleration, pauses, and arbitrary speed curves applied to any existing animation.

## ChangeSpeed

Wraps an existing animation and remaps its time progression using a speed modifier function. The wrapped animation plays at a variable speed defined by the modifier.

```typescript
import { ChangeSpeed } from "manim-ts/animation/speed_modifier";

const circle = new Circle();

// Play Create at double speed
await this.play(new ChangeSpeed(
  new Create(circle),
  { speedFactor: 2 }
));
```

### Constructor

```typescript
new ChangeSpeed(animation: Animation, options?: ChangeSpeedOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `animation` | `Animation` | The animation to modify the speed of |
| `options` | `ChangeSpeedOptions` | Speed modification options |

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `speedFactor` | `number \| ((t: number) => number)` | `1` | Constant speed multiplier or function mapping time to speed |
| `affectPlayRunTime` | `boolean` | `true` | Whether to adjust the total run time to account for speed changes |

### Behavior with Constant Speed

When `speedFactor` is a number:

- `speedFactor: 2` -- animation plays at double speed (half the duration)
- `speedFactor: 0.5` -- animation plays at half speed (double the duration)
- `speedFactor: 1` -- no change (default)

```typescript
// Slow-motion fade out
await this.play(new ChangeSpeed(
  new FadeOut(mob),
  { speedFactor: 0.25, affectPlayRunTime: true }
));
```

### Behavior with Speed Function

When `speedFactor` is a function, it receives the current time fraction `t` (0 to 1) and returns the instantaneous speed multiplier:

```typescript
// Start slow, end fast (accelerating)
await this.play(new ChangeSpeed(
  new Transform(a, b),
  { speedFactor: (t) => 0.5 + 2 * t }
));

// Pause in the middle
await this.play(new ChangeSpeed(
  new Rotate(mob, { angle: Math.PI }),
  {
    speedFactor: (t) => {
      if (t > 0.4 && t < 0.6) return 0; // pause
      return 1; // normal speed
    },
  }
));
```

### affectPlayRunTime

When `affectPlayRunTime` is `true` (default), the total run time of the animation is adjusted so that the full animation content plays through despite the speed change:

- A `speedFactor: 2` animation with `runTime: 2` would complete in 1 second.
- A `speedFactor: 0.5` animation with `runTime: 1` would take 2 seconds.

When `affectPlayRunTime` is `false`, the animation runs for the original `runTime` regardless of speed. If the speed is too slow, the animation may not complete; if too fast, it may finish early and hold.

### Key Methods

| Method | Description |
|--------|-------------|
| `interpolateMobject(alpha)` | Remaps alpha through the speed function before delegating to the wrapped animation |
| `getRunTime()` | Returns adjusted run time if `affectPlayRunTime` is true |

## Common Patterns

### Dramatic slow motion

```typescript
const explosion = new AnimationGroup(
  new FadeOut(mob, { scale: 3 }),
  new Flash(mob.getCenter(), { numLines: 20 }),
);

await this.play(new ChangeSpeed(explosion, { speedFactor: 0.3, affectPlayRunTime: true }));
```

### Speed ramp (slow-fast-slow)

```typescript
await this.play(new ChangeSpeed(
  new MoveAlongPath(dot, path),
  {
    speedFactor: (t) => {
      // Ease-in-out speed curve
      return 0.5 + 2.0 * Math.sin(t * Math.PI);
    },
  }
));
```

### Fast-forward through a long animation

```typescript
await this.play(new ChangeSpeed(
  new Succession(
    new Create(a),
    new Create(b),
    new Create(c),
    new Create(d),
  ),
  { speedFactor: 4 }
));
```

### Freeze frame effect

```typescript
await this.play(new ChangeSpeed(
  new Rotate(mob, { angle: TAU }),
  {
    speedFactor: (t) => {
      // Normal speed, freeze at t=0.5 for a beat, then resume
      if (t > 0.45 && t < 0.55) return 0;
      return 1.2; // slightly faster to compensate for pause
    },
  }
));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class SpeedScene(Scene):
    def construct(self):
        circle = Circle()
        
        self.play(ChangeSpeed(
            Create(circle),
            speedup=2,
            run_time=1,
        ))

        self.play(ChangeSpeed(
            Rotate(circle, angle=TAU),
            speed_factor=lambda t: 0.5 + 2 * t,
        ))

        self.play(ChangeSpeed(
            FadeOut(circle),
            speedup=0.5,
            affect_play_run_time=True,
        ))
```

### TypeScript (manim-ts)

```typescript
class SpeedScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle();

    await this.play(new ChangeSpeed(
      new Create(circle),
      { speedFactor: 2, runTime: 1 },
    ));

    await this.play(new ChangeSpeed(
      new Rotate(circle, { angle: TAU }),
      { speedFactor: (t) => 0.5 + 2 * t },
    ));

    await this.play(new ChangeSpeed(
      new FadeOut(circle),
      { speedFactor: 0.5, affectPlayRunTime: true },
    ));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `ChangeSpeed(anim, speedup=2)` | `new ChangeSpeed(anim, { speedFactor: 2 })` |
| `speed_factor=lambda t: ...` | `speedFactor: (t) => ...` |
| `affect_play_run_time=True` | `affectPlayRunTime: true` |
| `run_time=1` | `runTime: 1` |
