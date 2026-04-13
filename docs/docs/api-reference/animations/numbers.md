---
title: "Number Animations"
sidebar_position: 12
---

# Number Animations

Animations for smoothly transitioning numerical values displayed by `DecimalNumber` and similar mobjects. These are essential for animated counters, trackers, and dynamic numerical displays.

## ChangingDecimal

Animates a `DecimalNumber` mobject by changing its displayed value over time according to a provided function. The function maps the animation alpha (0 to 1) to the desired numerical value.

```typescript
import { ChangingDecimal } from "manim-ts/animation/numbers";

const number = new DecimalNumber(0, { numDecimalPlaces: 2 });
this.add(number);

// Count from 0 to 100
await this.play(new ChangingDecimal(number, (alpha) => alpha * 100, { runTime: 3 }));
```

### Constructor

```typescript
new ChangingDecimal(
  decimalMob: DecimalNumber,
  numberUpdateFunc: (alpha: number) => number,
  options?: ChangingDecimalOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `decimalMob` | `DecimalNumber` | The decimal number mobject to animate |
| `numberUpdateFunc` | `(alpha: number) => number` | Function mapping alpha [0, 1] to the displayed value |
| `options` | `ChangingDecimalOptions` | Optional animation settings |

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `suspendMobjectUpdating` | `boolean` | `false` | If true, pause any updaters on the mobject during animation |

### Behavior

- At each frame, the `numberUpdateFunc` is called with the current alpha value (0 at start, 1 at end, eased by `rateFunc`).
- The returned value is set on the `DecimalNumber` mobject using `setValue()`.
- The number's appearance (font, color, position) is preserved; only the displayed value changes.
- Works with any easing function via the `rateFunc` option.

### Key Methods

| Method | Description |
|--------|-------------|
| `interpolateMobject(alpha)` | Updates the decimal value at each frame |

## ChangeDecimalToValue

A convenience wrapper around `ChangingDecimal` that animates a `DecimalNumber` from its current value to a specific target value via linear interpolation.

```typescript
import { ChangeDecimalToValue } from "manim-ts/animation/numbers";

const counter = new DecimalNumber(0, { numDecimalPlaces: 0 });
this.add(counter);

// Animate from 0 to 42
await this.play(new ChangeDecimalToValue(counter, 42, { runTime: 2 }));

// Animate from 42 to -10
await this.play(new ChangeDecimalToValue(counter, -10, { runTime: 1 }));
```

### Constructor

```typescript
new ChangeDecimalToValue(
  decimalMob: DecimalNumber,
  targetValue: number,
  options?: AnimationOptions
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `decimalMob` | `DecimalNumber` | The decimal number mobject to animate |
| `targetValue` | `number` | The final value to animate to |
| `options` | `AnimationOptions` | Optional animation settings |

### Behavior

- Linearly interpolates from the current value of the `DecimalNumber` to `targetValue`.
- Internally constructs a `ChangingDecimal` with the appropriate function.
- The start value is captured when the animation begins, so changes before `play()` are reflected.

## Common Patterns

### Animated counter

```typescript
const counter = new DecimalNumber(0, {
  numDecimalPlaces: 0,
  fontSize: 48,
  color: WHITE,
}).moveTo(ORIGIN);

this.add(counter);
await this.play(new ChangeDecimalToValue(counter, 100, {
  runTime: 3,
  rateFunc: linear,
}));
```

### Percentage display

```typescript
const percent = new DecimalNumber(0, {
  numDecimalPlaces: 1,
  unit: "%",
}).moveTo(ORIGIN);

this.add(percent);
await this.play(new ChangeDecimalToValue(percent, 99.9, { runTime: 2 }));
```

### Nonlinear value change

```typescript
const value = new DecimalNumber(0, { numDecimalPlaces: 2 });
this.add(value);

// Exponential growth: 0 -> e^5 ≈ 148.41
await this.play(new ChangingDecimal(
  value,
  (alpha) => Math.exp(alpha * 5),
  { runTime: 4, rateFunc: linear }
));
```

### Counter with dynamic position

```typescript
const tracker = new ValueTracker(0);
const number = alwaysRedraw(() => {
  const val = tracker.getValue();
  return new DecimalNumber(val, { numDecimalPlaces: 1 })
    .moveTo(np.array([val / 5, 0, 0]));
});

this.add(number);
await this.play(tracker.animate.setValue(10), { runTime: 3 });
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class NumberScene(Scene):
    def construct(self):
        number = DecimalNumber(0, num_decimal_places=2, font_size=48)
        self.add(number)

        self.play(ChangeDecimalToValue(number, 100), run_time=3)

        self.play(ChangingDecimal(
            number,
            lambda alpha: 100 * (1 - alpha),
            run_time=2,
        ))

        counter = Integer(0)
        self.add(counter)
        self.play(ChangeDecimalToValue(counter, 42), run_time=2, rate_func=linear)
```

### TypeScript (manim-ts)

```typescript
class NumberScene extends Scene {
  async construct(): Promise<void> {
    const number = new DecimalNumber(0, { numDecimalPlaces: 2, fontSize: 48 });
    this.add(number);

    await this.play(new ChangeDecimalToValue(number, 100, { runTime: 3 }));

    await this.play(new ChangingDecimal(
      number,
      (alpha) => 100 * (1 - alpha),
      { runTime: 2 },
    ));

    const counter = new Integer(0);
    this.add(counter);
    await this.play(new ChangeDecimalToValue(counter, 42, { runTime: 2, rateFunc: linear }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `ChangeDecimalToValue(mob, 42)` | `new ChangeDecimalToValue(mob, 42)` |
| `ChangingDecimal(mob, lambda a: ...)` | `new ChangingDecimal(mob, (a) => ...)` |
| `num_decimal_places=2` | `numDecimalPlaces: 2` |
| `font_size=48` | `fontSize: 48` |
| `rate_func=linear` | `rateFunc: linear` |
| `run_time=3` | `runTime: 3` |
| `DecimalNumber(0, ...)` | `new DecimalNumber(0, { ... })` |
