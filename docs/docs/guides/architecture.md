---
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

manim-ts is a TypeScript port of [3Blue1Brown's Manim](https://github.com/3b1b/manim) (Mathematical Animation Engine). It mirrors the Python codebase's module structure while taking advantage of TypeScript's type system and the browser's Canvas2D API.

## High-Level Structure

```
manim-ts
  |
  +-- core/           Foundation: math, color, type interfaces
  |     +-- math/     numpy-ts, bezier, rate functions, quaternions
  |     +-- color/    Color class + full Manim palette
  |     +-- types.ts  IMobject, IVMobject, IAnimation, IScene, etc.
  |
  +-- mobjects/       Visual objects
  |     +-- mobject.ts          Base Mobject class
  |     +-- types/              VMobject, Group, VGroup
  |     +-- geometry/           Line, Arrow, Circle, Square, Polygon, Arc
  |     +-- text/               Text, MathTex, Tex, MarkupText
  |     +-- svg/                SVGMobject, SVGPath
  |     +-- three_d/            Surface, ThreeDVMobject, Sphere, Cylinder
  |     +-- coordinate_systems/ NumberLine, Axes, NumberPlane, ComplexPlane
  |     +-- graph/              Graph, DiGraph (via graphology)
  |     +-- matrix.ts           Matrix mobject
  |     +-- table.ts            Table mobject
  |     +-- image.ts            ImageMobject
  |     +-- boolean_ops.ts      Union, Intersection, Difference (via polygon-clipping)
  |
  +-- animations/     Transformations over time
  |     +-- animation.ts        Base Animation class
  |     +-- creation.ts         Create, Uncreate, DrawBorderThenFill, Write
  |     +-- fading.ts           FadeIn, FadeOut, FadeTransform
  |     +-- transform.ts        Transform, ReplacementTransform, MoveToTarget
  |     +-- growing.ts          GrowFromCenter, GrowFromPoint, GrowArrow
  |     +-- indication.ts       Indicate, Flash, Circumscribe, Wiggle
  |     +-- movement.ts         MoveAlongPath, Homotopy
  |     +-- rotation.ts         Rotate, Rotating
  |     +-- composition.ts      AnimationGroup, Succession, LaggedStart
  |     +-- changing.ts         TracedPath, always_redraw equivalent
  |
  +-- scenes/         Orchestration and output
  |     +-- scene.ts            Scene base class
  |     +-- moving_camera.ts    MovingCameraScene
  |     +-- three_d_scene.ts    ThreeDScene
  |     +-- zoomed_scene.ts     ZoomedScene
  |
  +-- cameras/        Viewing and projection
  |     +-- camera.ts           Base Camera
  |     +-- moving_camera.ts    MovingCamera + CameraFrame
  |     +-- three_d_camera.ts   ThreeDCamera (perspective)
  |
  +-- renderer/       Drawing to canvas
  |     +-- renderer.ts         Canvas2D renderer
  |     +-- opengl_renderer.ts  OpenGL stubs
  |
  +-- utils/          Shared utilities
        +-- rate_functions.ts   Easing functions
        +-- bezier.ts           Bezier curve math
        +-- paths.ts            Path interpolation functions
        +-- space_ops.ts        Vector/spatial math
        +-- iterables.ts        Array utilities
        +-- config_ops.ts       Config merging
        +-- file_ops.ts         File system utilities
        +-- tex.ts              TeX/KaTeX utilities
```

## Core Foundation

The core foundation modules are the bedrock of manim-ts. They are converted first and do not depend on any other manim-ts modules.

### Math (`core/math/`)

The math layer is built on **numpy-ts**, which mirrors NumPy's API in TypeScript:

```ts
import { np } from "../core/math/index.js";

const v = np.array([1, 2, 3]);
const m = np.dot(matA, matB);
const solved = np.linalg.solve(A, b);
```

Key types:
- `Point3D` -- NDArray of shape [3], a single 3D point
- `Points3D` -- NDArray of shape [n, 3], an array of 3D points
- `Matrix3x3` -- NDArray of shape [3, 3]

Additional math utilities:
- **Bezier** -- Curve evaluation, splitting, partial extraction
- **Rate functions** -- 40+ easing functions for animation timing
- **Quaternions** -- 3D rotations without gimbal lock

For 4x4 transformation matrices (used by the camera and 3D system), **gl-matrix** is used with Float64 precision.

### Color (`core/color/`)

The `Color` class and the full Manim color palette (BLUE, RED, GREEN, YELLOW, etc. with weight variants like BLUE_A through BLUE_E).

### Types (`core/types.ts`)

TypeScript interfaces that define the contracts for all major classes:

```ts
interface IMobject { /* ... */ }
interface IVMobject extends IMobject { /* ... */ }
interface IAnimation { /* ... */ }
interface IScene { /* ... */ }
interface ICamera { /* ... */ }
interface IRenderer { /* ... */ }
```

These interfaces are used for type checking and to break circular dependencies between modules. Runtime code depends on interfaces via `import type`, not on concrete class imports.

## Mobject Hierarchy

Mobjects (mathematical objects) form a class hierarchy:

```
Mobject                         Base: points, transforms, submobjects
  |
  +-- VMobject                  Vector graphics: bezier curves, fill, stroke
  |     +-- VGroup              Group of VMobjects
  |     +-- Arc                 Circular arcs
  |     |     +-- Circle
  |     |     +-- Dot
  |     |     +-- Annulus
  |     +-- Line
  |     |     +-- Arrow
  |     |     +-- DoubleArrow
  |     |     +-- DashedLine
  |     +-- Polygon
  |     |     +-- Rectangle
  |     |     |     +-- Square
  |     |     +-- Triangle
  |     |     +-- RegularPolygon
  |     +-- Text / MathTex / Tex
  |     +-- SVGMobject
  |     +-- NumberLine / Axes / NumberPlane
  |
  +-- Group                     Group of Mobjects (not necessarily VMobjects)
  +-- ImageMobject              Raster images
  +-- PMobject                  Point-cloud mobjects
```

Every mobject stores its geometry as an array of `Point3D` values. For `VMobject`, these are cubic bezier control points (groups of 4: anchor, handle, handle, anchor).

## Animation System

Animations transform mobjects over time. Each animation has a lifecycle:

```
begin() → interpolate(alpha) × N frames → finish()
```

1. **begin()** -- Set up initial state. Called once before the first frame.
2. **interpolate(alpha)** -- Apply the animation at progress `alpha` (0 to 1). Called every frame. The `alpha` is processed through the animation's rate function.
3. **finish()** -- Finalize state. Called once after the last frame.

```ts
class FadeIn extends Animation {
  begin(): void {
    this.mobject.setOpacity(0);
  }

  interpolate(alpha: number): void {
    this.mobject.setOpacity(alpha);
  }

  finish(): void {
    this.mobject.setOpacity(1);
  }
}
```

Animations compose via `AnimationGroup` (parallel), `Succession` (sequential), and `LaggedStart` (staggered).

## Scene System

The `Scene` class is the top-level orchestrator. It:

1. Maintains a list of mobjects to render
2. Runs the `construct()` method (user code)
3. For each `play()` call, executes the animation lifecycle across frames
4. Passes each frame to the renderer

```ts
class MyScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle();
    this.add(circle);
    await this.play(new Create(circle));
    await this.wait();
  }
}
```

Scene variants:
- **MovingCameraScene** -- Provides a MovingCamera that can pan and zoom
- **ThreeDScene** -- Uses ThreeDCamera for 3D perspective
- **ZoomedScene** -- Shows an inset zoomed view of part of the scene

## Rendering

manim-ts uses a dual rendering strategy:

- **Browser**: Native Canvas2D API on an HTML `<canvas>` element
- **Node.js**: `@napi-rs/canvas` (Canvas2D implementation for server-side rendering)

Both paths use the same Canvas2D drawing code. The renderer translates mobject bezier data into canvas path operations (moveTo, bezierCurveTo, fill, stroke).

For video output in Node.js, frames are piped to **fluent-ffmpeg** for encoding into MP4, WebM, GIF, or MOV containers.

OpenGL renderer stubs exist for future WebGL/WebGPU hardware-accelerated rendering.

## Library Replacements

Every external dependency used by Python Manim has a TypeScript equivalent:

| Python | TypeScript | Purpose |
|---|---|---|
| numpy | numpy-ts | N-dimensional arrays, linear algebra |
| numpy (4x4 matrices) | gl-matrix | Transformation matrices |
| cairo | Canvas2D / @napi-rs/canvas | 2D rendering |
| subprocess + ffmpeg | fluent-ffmpeg | Video encoding |
| PIL/Pillow | sharp | Image I/O |
| svgelements | svg-path-commander | SVG path parsing |
| pdflatex + dvisvgm | katex | LaTeX math rendering |
| custom bezier code | bezier-js | Bezier curve operations |
| custom polylabel | @mapbox/polylabel | Pole of inaccessibility |
| custom qhull | convex-hull | Convex hull computation |
| mapbox-earcut | earcut | Polygon triangulation |
| networkx | graphology | Graph data structures |
| pygments | highlight.js | Syntax highlighting |
| beautifulsoup4 | cheerio | HTML/SVG DOM parsing |
| watchdog | chokidar | File system watching |
| isosurfaces | isosurface | Isosurface extraction |
| skia-pathops | polygon-clipping | Boolean path operations |

## Dependency Layers

The codebase is organized into 11 dependency layers (27 sub-layers), determined by topological sort of Python import relationships. Each layer only depends on layers below it:

```
Layer 0:  Core math, color, types (foundation)
Layer 1:  Utils (rate functions, bezier, iterables, space ops)
Layer 2:  Base Mobject, base Animation
Layer 3:  VMobject, Group
Layer 4:  Geometry (Line, Circle, Polygon, Arc)
Layer 5:  Text, SVG, coordinate systems
Layer 6:  Animations (creation, fading, transform, growing)
Layer 7:  Advanced animations, Camera
Layer 8:  Scene, Renderer
Layer 9:  3D (Surface, ThreeDCamera, ThreeDScene)
Layer 10: Specialized (ZoomedScene, boolean ops, advanced features)
```

This layering ensures that modules can be converted and tested incrementally, with each layer building on verified foundations.

## Circular Dependency Resolution

Some modules in Layers 6-7 have circular dependencies (e.g., animations reference mobjects that reference animations). These are resolved using:

1. **`import type`** -- Type-only imports are erased at runtime, breaking the cycle.
2. **Interface contracts** -- Runtime code depends on `IMobject`, `IAnimation`, etc. from `core/types.ts` rather than concrete classes.
3. **Late binding** -- Some references are resolved at runtime through registry patterns.
