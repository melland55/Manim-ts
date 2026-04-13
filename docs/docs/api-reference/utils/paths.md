---
title: Path Functions
sidebar_position: 3
---

# Path Functions

Path functions define how points travel from a start position to an end position during animations. They are used by `Transform`, `MoveToTarget`, and other animations to control the spatial trajectory of movement.

```ts
import {
  straightPath,
  pathAlongArc,
  pathAlongCircles,
  clockwisePath,
  counterclockwisePath,
  spiralPath,
} from "manim-ts";
```

## PathFuncType

All path functions conform to this type signature:

```ts
type PathFuncType = (
  startPoints: Point3D,
  endPoints: Point3D,
  alpha: number
) => Point3D;
```

- **startPoints** -- The starting position.
- **endPoints** -- The target position.
- **alpha** -- Progress value from 0 to 1 (already processed by the rate function).
- **Returns** -- The interpolated position at the given alpha.

## Core Path Functions

### `straightPath(): PathFuncType`

Linear interpolation between start and end. Points travel in a straight line. This is the default path function for most animations.

```ts
const path = straightPath();
path(start, end, 0);    // => start
path(start, end, 0.5);  // => midpoint between start and end
path(start, end, 1);    // => end
```

```
start -------- midpoint -------- end
```

### `pathAlongArc(angle: number): PathFuncType`

Points travel along a circular arc from start to end. The `angle` parameter specifies the arc angle in radians. Positive angles produce counterclockwise arcs, negative angles produce clockwise arcs.

```ts
// 90-degree counterclockwise arc
const arcPath = pathAlongArc(PI / 2);

await this.play(new Transform(mobA, mobB, {
  pathFunc: arcPath,
}));
```

```
         * (midpoint, along arc)
       /   \
      /     \
start         end
```

If the angle is `PI`, the points travel in a semicircle. If 0, it degenerates to a straight line.

### `pathAlongCircles(angle: number): PathFuncType`

Similar to `pathAlongArc`, but each point follows its own circular path around a computed center. This produces more natural-looking rotation for groups of points.

```ts
const circularPath = pathAlongCircles(PI);

await this.play(new Transform(mobA, mobB, {
  pathFunc: circularPath,
}));
```

### `clockwisePath(): PathFuncType`

Shorthand for `pathAlongArc(-PI)`. Points travel along a clockwise semicircular arc.

```ts
await this.play(new Transform(mobA, mobB, {
  pathFunc: clockwisePath(),
}));
```

```
start         end
      \     /
       \   /
         * (midpoint, below)
```

### `counterclockwisePath(): PathFuncType`

Shorthand for `pathAlongArc(PI)`. Points travel along a counterclockwise semicircular arc.

```ts
await this.play(new Transform(mobA, mobB, {
  pathFunc: counterclockwisePath(),
}));
```

```
         * (midpoint, above)
       /   \
      /     \
start         end
```

### `spiralPath(): PathFuncType`

Points travel along a spiral from start to end. Combines radial interpolation with angular rotation to produce a spiral trajectory.

```ts
await this.play(new Transform(mobA, mobB, {
  pathFunc: spiralPath(),
}));
```

## Using Path Functions with Animations

Path functions are passed via the `pathFunc` option to animations that move mobjects:

```ts
// Transform with an arc path
await this.play(new Transform(circle, square, {
  pathFunc: pathAlongArc(PI / 2),
  runTime: 2,
}));

// Move along a clockwise semicircle
await this.play(new Transform(mobA, mobB, {
  pathFunc: clockwisePath(),
}));
```

## Custom Path Functions

You can write custom path functions for specialized trajectories:

```ts
// Parabolic path
const parabolicPath: PathFuncType = (start, end, alpha) => {
  // Linear interpolation for x and z
  const result = np.add(
    np.scale(start, 1 - alpha),
    np.scale(end, alpha)
  );
  // Add parabolic y offset
  const height = 2;
  const yOffset = height * 4 * alpha * (1 - alpha);
  return np.add(result, np.array([0, yOffset, 0]));
};

await this.play(new Transform(mobA, mobB, {
  pathFunc: parabolicPath,
}));
```

## Path Functions vs Rate Functions

Path functions and rate functions serve different purposes:

| Aspect | Rate Function | Path Function |
|---|---|---|
| Controls | **When** (timing) | **Where** (trajectory) |
| Input | Linear time t | Start, end, and alpha |
| Output | Warped time | Spatial position |
| Example | Ease in/out | Arc, spiral, straight |

They compose naturally: the rate function warps time, and the warped time is passed as `alpha` to the path function.

```ts
await this.play(new Transform(mobA, mobB, {
  rateFunc: smooth,              // Controls timing
  pathFunc: pathAlongArc(PI/2),  // Controls spatial path
}));
```
