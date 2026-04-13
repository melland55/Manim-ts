---
title: Rate Functions
sidebar_position: 1
---

# Rate Functions

Rate functions control the timing and pacing of animations. They map a linear input `t` in `[0, 1]` to an output value, determining how an animation accelerates, decelerates, or oscillates over its duration.

```ts
import { smooth, linear, thereAndBack, rushInto } from "manim-ts";
```

## How Rate Functions Work

Every animation in manim-ts uses a rate function to control its pacing. The animation system calls the rate function with a linear progress value `t` from 0 to 1, and the function returns the "effective" progress.

```ts
// Linear: constant speed
linear(0.5)  // => 0.5

// Smooth: slow start and end, fast middle
smooth(0.5)  // => 0.5 (but 0.25 => ~0.1, 0.75 => ~0.9)

// There and back: goes forward then reverses
thereAndBack(0.5)  // => 1.0 (peak)
thereAndBack(1.0)  // => 0.0 (back to start)
```

### Using with Animations

```ts
await this.play(new FadeIn(circle, { rateFunc: smooth }));
await this.play(new Transform(square, target, { rateFunc: thereAndBack }));
await this.play(new Rotate(arrow, { angle: PI, rateFunc: rushInto }));
```

## Core Functions

### `linear(t: number): number`

No easing. Output equals input. Constant velocity.

```
1 |        /
  |      /
  |    /
  |  /
0 |/________
  0        1
```

### `smooth(t: number): number`

The default rate function for most animations. Based on a degree-10 polynomial that is smooth at both endpoints (all derivatives zero at t=0 and t=1).

```
1 |      ___
  |    /
  |   |
  |  /
0 |___/______
  0        1
```

### `smoothstep(t: number): number`

Hermite interpolation: `3t^2 - 2t^3`. Smooth at endpoints but with fewer zero derivatives than `smooth`.

### `smootherstep(t: number): number`

Ken Perlin's improved smoothstep: `6t^5 - 15t^4 + 10t^3`. Smoother than `smoothstep` with zero first and second derivatives at endpoints.

### `smoothererstep(t: number): number`

Even higher-order smooth interpolation with zero derivatives up to third order at endpoints.

## Rush and Slow Functions

### `rushInto(t: number): number`

Fast start, smooth stop. Useful for animations that should "rush into" their final state.

### `rushFrom(t: number): number`

Smooth start, fast finish. The reverse of `rushInto`.

### `slowInto(t: number): number`

Starts at normal speed and decelerates smoothly to a stop.

## Special Functions

### `doubleSmooth(t: number): number`

Applies `smooth` to the first half and `1 - smooth` to the second half. Creates a smooth acceleration then deceleration.

### `thereAndBack(t: number): number`

Animates forward to the midpoint, then reverses back to the start. The mobject ends where it began.

```
1 |    /\
  |   /  \
  |  /    \
  | /      \
0 |/________\
  0   0.5   1
```

```ts
// Circle grows then shrinks back
await this.play(new GrowFromCenter(circle, { rateFunc: thereAndBack }));
```

### `thereAndBackWithPause(t: number, pauseRatio?: number): number`

Like `thereAndBack`, but holds at the peak for a portion of the animation. The `pauseRatio` (default 1/3) controls how long the pause lasts.

```
1 |   /---\
  |  /     \
  | /       \
0 |/_________\
  0          1
```

### `runningStart(t: number, pullFactor?: number): number`

Pulls back slightly before animating forward, like winding up before a throw. The `pullFactor` controls how far back it goes.

```
1 |          /
  |        /
  |      /
0 |--\  /
  |   \/
  0          1
```

### `wiggle(t: number): number`

Oscillates back and forth, returning to the starting position. Creates a shaking or wiggling effect.

### `lingering(t: number): number`

Reaches the target quickly then slowly drifts, spending most of the time near the final value.

### `exponentialDecay(t: number, halfLife?: number): number`

Exponential approach to 1. The `halfLife` parameter controls the decay rate. Useful for physics-like damping.

## CSS Easing Equivalents

manim-ts includes all standard CSS easing functions, matching the cubic-bezier curves defined in the CSS specification.

### Sine

| Function | Description |
|---|---|
| `easeInSine(t)` | Gentle ease in using sine curve |
| `easeOutSine(t)` | Gentle ease out using sine curve |
| `easeInOutSine(t)` | Gentle ease in and out |

### Quadratic

| Function | Description |
|---|---|
| `easeInQuad(t)` | Quadratic ease in (t^2) |
| `easeOutQuad(t)` | Quadratic ease out |
| `easeInOutQuad(t)` | Quadratic ease in and out |

### Cubic

| Function | Description |
|---|---|
| `easeInCubic(t)` | Cubic ease in (t^3) |
| `easeOutCubic(t)` | Cubic ease out |
| `easeInOutCubic(t)` | Cubic ease in and out |

### Quartic

| Function | Description |
|---|---|
| `easeInQuart(t)` | Quartic ease in (t^4) |
| `easeOutQuart(t)` | Quartic ease out |
| `easeInOutQuart(t)` | Quartic ease in and out |

### Quintic

| Function | Description |
|---|---|
| `easeInQuint(t)` | Quintic ease in (t^5) |
| `easeOutQuint(t)` | Quintic ease out |
| `easeInOutQuint(t)` | Quintic ease in and out |

### Exponential

| Function | Description |
|---|---|
| `easeInExpo(t)` | Exponential ease in |
| `easeOutExpo(t)` | Exponential ease out |
| `easeInOutExpo(t)` | Exponential ease in and out |

### Circular

| Function | Description |
|---|---|
| `easeInCirc(t)` | Circular ease in |
| `easeOutCirc(t)` | Circular ease out |
| `easeInOutCirc(t)` | Circular ease in and out |

### Back

| Function | Description |
|---|---|
| `easeInBack(t)` | Overshoots then returns (ease in) |
| `easeOutBack(t)` | Overshoots then returns (ease out) |
| `easeInOutBack(t)` | Overshoots both directions |

### Elastic

| Function | Description |
|---|---|
| `easeInElastic(t)` | Springy elastic ease in |
| `easeOutElastic(t)` | Springy elastic ease out |
| `easeInOutElastic(t)` | Springy elastic both directions |

### Bounce

| Function | Description |
|---|---|
| `easeInBounce(t)` | Bouncing ease in |
| `easeOutBounce(t)` | Bouncing ease out |
| `easeInOutBounce(t)` | Bouncing both directions |

## Utility Functions

### `squishRateFunc(func: RateFunc, a: number, b: number): RateFunc`

Squishes a rate function so that it operates only within the interval `[a, b]` of the original `[0, 1]` range. Outside this interval, the function returns 0 (before `a`) or 1 (after `b`).

```ts
// The smooth function only activates between t=0.2 and t=0.8
const squished = squishRateFunc(smooth, 0.2, 0.8);

squished(0.0)  // => 0 (before range)
squished(0.2)  // => 0 (start of range)
squished(0.5)  // => 0.5 (middle)
squished(0.8)  // => 1 (end of range)
squished(1.0)  // => 1 (after range)
```

This is especially useful for composing animations where different elements should animate at different times within a single `play()` call.

```ts
await this.play(
  new FadeIn(circle, { rateFunc: squishRateFunc(smooth, 0, 0.5) }),
  new FadeIn(square, { rateFunc: squishRateFunc(smooth, 0.5, 1) }),
);
// circle fades in during first half, square during second half
```

## Type Definition

```ts
type RateFunc = (t: number) => number;
```

All rate functions conform to this signature: they take a number in `[0, 1]` and return a number (usually also in `[0, 1]`, but some functions like `runningStart` and `easeInBack` may temporarily go outside this range).
