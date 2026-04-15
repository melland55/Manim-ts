---
title: Types & Interfaces
sidebar_position: 3
---

# Types & Interfaces

The types module (`src/core/types.ts`) defines the interface contracts between all manim-ts modules. These are **interfaces only** -- not runtime classes. Actual class implementations live in their respective module directories (e.g., `src/mobject/mobject/` for `Mobject`). Conversion agents implement classes that satisfy these interfaces.

```typescript
import type {
  IColor, IMobject, IVMobject, IAnimation, IScene, ICamera, IRenderer,
  ManimConfig, MobjectOptions, VMobjectOptions, AnimationOptions,
  ColorArray, Updater, RateFunc,
  NDArray, Point3D, Points3D,
} from "manim-ts/core/types";
```

:::warning
Do not add fields, rename properties, or change signatures on these interfaces. They are the contracts that all modules depend on.
:::

---

## Primitive Types

### `ColorArray`

RGBA color as 4 floats in `[0, 1]`.

```typescript
type ColorArray = [number, number, number, number];
```

### `Updater`

Updater function called each frame on a mobject.

```typescript
type Updater = (mob: IMobject, dt: number) => void;
```

### `RateFunc`

Rate function mapping `[0, 1]` to `[0, 1]`, controlling animation easing. Re-exported from `core/math`.

```typescript
type RateFunc = (t: number) => number;
```

### `NDArray`, `Point3D`, `Points3D`

Re-exported from `core/math` for convenience:

| Type | Description |
|------|-------------|
| `NDArray` | N-dimensional array from numpy-ts |
| `Point3D` | `NDArray` with shape `[3]` |
| `Points3D` | `NDArray` with shape `[n, 3]` |

---

## IColor

Interface for the color system. Implemented by the `Color` class in `core/color`.

```typescript
interface IColor {
  readonly r: number;  // Red   [0, 1]
  readonly g: number;  // Green [0, 1]
  readonly b: number;  // Blue  [0, 1]
  readonly a: number;  // Alpha [0, 1]

  toHex(): string;
  toArray(): ColorArray;
  interpolate(other: IColor, t: number): IColor;
  lighter(amount?: number): IColor;
  darker(amount?: number): IColor;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `r` | `number` | Red channel, readonly, `[0, 1]` |
| `g` | `number` | Green channel, readonly, `[0, 1]` |
| `b` | `number` | Blue channel, readonly, `[0, 1]` |
| `a` | `number` | Alpha channel, readonly, `[0, 1]` |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `toHex()` | `string` | Hex string `#RRGGBB` |
| `toArray()` | `ColorArray` | `[r, g, b, a]` tuple |
| `interpolate(other, t)` | `IColor` | Lerp between two colors |
| `lighter(amount?)` | `IColor` | Lighten by amount (default 0.2) |
| `darker(amount?)` | `IColor` | Darken by amount (default 0.2) |

---

## ManimConfig

Global configuration for the Manim engine.

```typescript
interface ManimConfig {
  pixelWidth: number;
  pixelHeight: number;
  frameRate: number;
  frameWidth: number;
  frameHeight: number;
  backgroundColor: IColor;
  mediaDir: string;
  quality: "low" | "medium" | "high" | "fourk";
  /** Renderer backend selection. Mirrors ManimCE's `config.renderer`. @default "cairo" */
  renderer?: "cairo" | "opengl";
}
```

| Property | Type | Description |
|----------|------|-------------|
| `pixelWidth` | `number` | Output width in pixels |
| `pixelHeight` | `number` | Output height in pixels |
| `frameRate` | `number` | Frames per second |
| `frameWidth` | `number` | Logical frame width in Manim units |
| `frameHeight` | `number` | Logical frame height in Manim units |
| `backgroundColor` | `IColor` | Scene background color |
| `mediaDir` | `string` | Output directory for rendered media |
| `quality` | `string` | One of `"low"`, `"medium"`, `"high"`, `"fourk"` |
| `renderer` | `"cairo" \| "opengl"` | Renderer backend. Defaults to `"cairo"`. Set to `"opengl"` to activate the three.js WebGL backend. |

---

## MobjectOptions

Options object for constructing a base `Mobject`.

```typescript
interface MobjectOptions {
  color?: IColor;
  name?: string;
  targetPosition?: Point3D;
  zIndex?: number;
  opacity?: number;
}
```

---

## IMobject

Interface for the base Mobject class. Python equivalent: `manim.mobject.mobject.Mobject`.

```typescript
interface IMobject {
  name: string;
  color: IColor;
  submobjects: IMobject[];
  updaters: Updater[];
  zIndex: number;

  // Positioning
  getCenter(): Point3D;
  getLeft(): Point3D;
  getRight(): Point3D;
  getTop(): Point3D;
  getBottom(): Point3D;
  getWidth(): number;
  getHeight(): number;

  moveTo(point: Point3D, alignedEdge?: Point3D): this;
  shift(...vectors: Point3D[]): this;
  scale(factor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this;
  rotate(angle: number, axis?: Point3D, options?: { aboutPoint?: Point3D }): this;
  flip(axis?: Point3D, options?: { aboutPoint?: Point3D }): this;
  nextTo(target: IMobject | Point3D, direction?: Point3D,
         options?: { buff?: number; alignedEdge?: Point3D }): this;
  alignTo(target: IMobject | Point3D, direction: Point3D): this;

  // Hierarchy
  add(...mobjects: IMobject[]): this;
  remove(...mobjects: IMobject[]): this;
  getFamily(recurse?: boolean): IMobject[];

  // Style
  setColor(color: IColor | any): this;
  setOpacity(opacity: number): this;

  // Updaters
  addUpdater(updater: Updater, index?: number, callUpdater?: boolean): this;
  removeUpdater(updater: Updater): this;
  suspendUpdating?(recursive?: boolean): this;
  resumeUpdating?(recursive?: boolean): this;

  // Transform
  applyMatrix(matrix: mat4 | number[][]): this;
  applyFunction(fn: (point: Point3D) => Point3D): this;

  // Copy
  copy(): IMobject;

  // Internal
  getPointsDefiningBoundary?(): Points3D;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Display name of the mobject |
| `color` | `IColor` | Primary color |
| `submobjects` | `IMobject[]` | Child mobjects in the hierarchy |
| `updaters` | `Updater[]` | Frame-by-frame updater functions |
| `zIndex` | `number` | Drawing order (higher = on top) |

### Positioning Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCenter()` | `Point3D` | Center of bounding box |
| `getLeft()` | `Point3D` | Leftmost point of bounding box |
| `getRight()` | `Point3D` | Rightmost point of bounding box |
| `getTop()` | `Point3D` | Top point of bounding box |
| `getBottom()` | `Point3D` | Bottom point of bounding box |
| `getWidth()` | `number` | Width of bounding box |
| `getHeight()` | `number` | Height of bounding box |
| `moveTo(point, alignedEdge?)` | `this` | Move to absolute position |
| `shift(...vectors)` | `this` | Translate by sum of vectors |
| `scale(factor, options?)` | `this` | Scale by factor, optionally about a point or edge |
| `rotate(angle, axis?, options?)` | `this` | Rotate by angle around axis |
| `flip(axis?, options?)` | `this` | Mirror across axis |
| `nextTo(target, direction?, options?)` | `this` | Position next to target with buffer |
| `alignTo(target, direction)` | `this` | Align edge to target's edge |

### Hierarchy Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `add(...mobjects)` | `this` | Add children |
| `remove(...mobjects)` | `this` | Remove children |
| `getFamily(recurse?)` | `IMobject[]` | Get self + all descendants |

### Style Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `setColor(color)` | `this` | Set the primary color |
| `setOpacity(opacity)` | `this` | Set overall opacity |

### Updater Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `addUpdater(updater, index?, callUpdater?)` | `this` | Register a per-frame updater |
| `removeUpdater(updater)` | `this` | Unregister an updater |
| `suspendUpdating?(recursive?)` | `this` | Pause updater execution (optional) |
| `resumeUpdating?(recursive?)` | `this` | Resume updater execution (optional) |

### Transform Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `applyMatrix(matrix)` | `this` | Apply a 4x4 or nested array matrix |
| `applyFunction(fn)` | `this` | Apply a point-wise function to all points |

### Other Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `copy()` | `IMobject` | Deep copy |
| `getPointsDefiningBoundary?()` | `Points3D` | Points used for bounding box (optional) |

---

## VMobjectOptions

Options for constructing a `VMobject`. Extends `MobjectOptions`.

```typescript
interface VMobjectOptions extends MobjectOptions {
  fillColor?: IColor;
  fillOpacity?: number;
  strokeColor?: IColor;
  strokeOpacity?: number;
  strokeWidth?: number;
}
```

---

## IVMobject

Interface for vectorized Mobject -- all shapes drawn with Bezier curves. Extends `IMobject`. Python equivalent: `manim.mobject.types.vectorized_mobject.VMobject`.

```typescript
interface IVMobject extends IMobject {
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeOpacity: number;
  strokeWidth: number;
  points: Points3D;

  // Path construction
  startNewPath(point: Point3D): this;
  addLineTo(point: Point3D): this;
  addCubicBezierCurveTo(handle1: Point3D, handle2: Point3D, anchor: Point3D): this;
  addQuadraticBezierCurveTo(handle: Point3D, anchor: Point3D): this;
  closePath(): this;
  clearPoints(): this;

  // Bezier accessors
  getAnchors(): Points3D;
  getHandles(): Points3D;
  getSubpaths(): Points3D[];
  getArcLength(): number;
  pointFromProportion(alpha: number): Point3D;

  // Style
  setFill(color?: IColor, opacity?: number): this;
  setStroke(color?: IColor, width?: number, opacity?: number): this;

  // Subpath operations
  appendVectorizedMobject(vmob: IVMobject): this;
}
```

### Additional Properties (beyond IMobject)

| Property | Type | Description |
|----------|------|-------------|
| `fillColor` | `IColor` | Fill color |
| `fillOpacity` | `number` | Fill opacity `[0, 1]` |
| `strokeColor` | `IColor` | Stroke color |
| `strokeOpacity` | `number` | Stroke opacity `[0, 1]` |
| `strokeWidth` | `number` | Stroke width in pixels |
| `points` | `Points3D` | Bezier control points `[n, 3]` |

### Path Construction Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `startNewPath(point)` | `this` | Begin a new subpath at the given anchor |
| `addLineTo(point)` | `this` | Add a straight line segment to the path |
| `addCubicBezierCurveTo(h1, h2, anchor)` | `this` | Add a cubic bezier segment |
| `addQuadraticBezierCurveTo(handle, anchor)` | `this` | Add a quadratic bezier segment |
| `closePath()` | `this` | Close the current subpath |
| `clearPoints()` | `this` | Remove all points |

### Bezier Accessor Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getAnchors()` | `Points3D` | All anchor points (every 4th point for cubics) |
| `getHandles()` | `Points3D` | All handle/control points |
| `getSubpaths()` | `Points3D[]` | Array of subpath point arrays |
| `getArcLength()` | `number` | Total arc length of the path |
| `pointFromProportion(alpha)` | `Point3D` | Point at proportion along the path `[0, 1]` |

### Style Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `setFill(color?, opacity?)` | `this` | Set fill color and/or opacity |
| `setStroke(color?, width?, opacity?)` | `this` | Set stroke color, width, and/or opacity |

### Subpath Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `appendVectorizedMobject(vmob)` | `this` | Append another VMobject's path data |

---

## AnimationOptions

Options for constructing an `Animation`.

```typescript
interface AnimationOptions {
  runTime?: number;
  rateFunc?: RateFunc;
  lagRatio?: number;
  name?: string;
  remover?: boolean;
  introducer?: boolean;
  suspendMobjectUpdating?: boolean;
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `runTime` | `number` | `1.0` | Duration in seconds |
| `rateFunc` | `RateFunc` | `smooth` | Easing function |
| `lagRatio` | `number` | `0` | Stagger ratio for sub-animations |
| `name` | `string` | - | Animation display name |
| `remover` | `boolean` | `false` | Remove mobject from scene when done |
| `introducer` | `boolean` | `false` | Add mobject to scene when starting |
| `suspendMobjectUpdating` | `boolean` | - | Pause mobject updaters during animation |

---

## IAnimation

Interface for the base Animation class. Python equivalent: `manim.animation.animation.Animation`.

```typescript
interface IAnimation {
  mobject: IMobject;
  runTime: number;
  rateFunc: RateFunc;
  lagRatio: number;
  name: string;
  remover: boolean;
  introducer: boolean;

  begin(): void;
  finish(): void;
  interpolate(alpha: number): void;
  interpolateMobject(alpha: number): void;
  interpolateSubmobject(submob: IMobject, startSubmob: IMobject, alpha: number): void;

  setupScene(scene: IScene): void;
  cleanUpFromScene(scene: IScene): void;
  getAllMobjects(): IMobject[];
  copy(): IAnimation;

  isFinished(alpha: number): boolean;
  getRunTime(): number;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `mobject` | `IMobject` | The mobject being animated |
| `runTime` | `number` | Duration in seconds |
| `rateFunc` | `RateFunc` | Easing function |
| `lagRatio` | `number` | Stagger ratio for sub-animations |
| `name` | `string` | Display name |
| `remover` | `boolean` | If true, remove mobject after animation |
| `introducer` | `boolean` | If true, add mobject at animation start |

### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `begin()` | Called once when the animation starts. Sets up starting state. |
| `finish()` | Called once when the animation ends. Finalizes state. |
| `interpolate(alpha)` | Called each frame with progress `alpha` in `[0, 1]`. |
| `interpolateMobject(alpha)` | Interpolates the mobject to the given progress. |
| `interpolateSubmobject(submob, startSubmob, alpha)` | Interpolates a single submobject. |

### Scene Integration Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `setupScene(scene)` | `void` | Prepare the scene before animation |
| `cleanUpFromScene(scene)` | `void` | Clean up the scene after animation |
| `getAllMobjects()` | `IMobject[]` | All mobjects involved in this animation |
| `copy()` | `IAnimation` | Deep copy of the animation |

### Query Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isFinished(alpha)` | `boolean` | Whether the animation has completed |
| `getRunTime()` | `number` | The run time in seconds |

---

## IScene

Interface for the Scene class. Python equivalent: `manim.scene.scene.Scene`.

```typescript
interface IScene {
  mobjects: IMobject[];
  time: number;
  camera: ICamera;

  add(...mobjects: IMobject[]): this;
  remove(...mobjects: IMobject[]): this;
  play(...animations: IAnimation[]): Promise<void>;
  wait(duration?: number, stopCondition?: () => boolean): Promise<void>;

  construct(): Promise<void>;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `mobjects` | `IMobject[]` | All mobjects currently in the scene |
| `time` | `number` | Current scene time in seconds |
| `camera` | `ICamera` | The scene's camera |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `add(...mobjects)` | `this` | Add mobjects to the scene |
| `remove(...mobjects)` | `this` | Remove mobjects from the scene |
| `play(...animations)` | `Promise<void>` | Play one or more animations |
| `wait(duration?, stopCondition?)` | `Promise<void>` | Pause the scene |
| `construct()` | `Promise<void>` | User-defined scene construction logic |

---

## ICamera

Interface for the Camera class. Python equivalent: `manim.camera.camera.Camera`.

```typescript
interface ICamera {
  pixelWidth: number;
  pixelHeight: number;
  frameWidth: number;
  frameHeight: number;
  backgroundColor: IColor;

  getFrameCenter(): Point3D;
  setFrameCenter(point: Point3D): void;
  captureFrame(): void;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `pixelWidth` | `number` | Output width in pixels |
| `pixelHeight` | `number` | Output height in pixels |
| `frameWidth` | `number` | Logical frame width in Manim units |
| `frameHeight` | `number` | Logical frame height in Manim units |
| `backgroundColor` | `IColor` | Background fill color |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getFrameCenter()` | `Point3D` | Current center of the camera frame |
| `setFrameCenter(point)` | `void` | Move the camera to a new center |
| `captureFrame()` | `void` | Capture the current frame for rendering |

---

## IRenderer

Interface for renderer backends. Python equivalent: `manim.renderer.renderer.Renderer`.

```typescript
interface IRenderer {
  init(canvas: HTMLCanvasElement | OffscreenCanvas): void;
  render(scene: IScene): void;
  clear(color: IColor): void;
  renderMobject(mob: IMobject, camera: ICamera): void;
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `init(canvas)` | `void` | Initialize the renderer with a canvas target |
| `render(scene)` | `void` | Render the entire scene |
| `clear(color)` | `void` | Clear the canvas with a solid color |
| `renderMobject(mob, camera)` | `void` | Render a single mobject through the camera |
