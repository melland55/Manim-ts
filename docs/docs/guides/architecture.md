---
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

manim-ts is a TypeScript port of [3Blue1Brown's Manim](https://github.com/3b1b/manim) (Mathematical Animation Engine). It mirrors the Python codebase's module structure while taking advantage of TypeScript's type system. The default rendering path runs through libcairo (via `canvas` / node-canvas on Node, native `<canvas>` in the browser) for byte-level parity with Python Manim's pycairo pipeline; a three.js / WebGL backend is available opt-in.

## High-Level Structure

```
src/
  __init__/           Top-level namespace barrel (mirrors manim/__init__.py)
  __main__/           CLI entry points
  _config/            Config loading
  cli/                Command-line tool scaffolding
  constants/          Shared numeric/color constants
  core/               Foundation
    math/             numpy-ts wrapper, bezier, rate functions, quaternions
    color/            Color class + full Manim palette
    types.ts          IMobject, IVMobject, IAnimation, IScene, etc.
    canvas-factory.ts Browser/Node canvas creation
  data_structures/    Internal data structures
  integrations/       react.tsx, vue.ts adapters
  mobject/            Visual objects (singular "mobject")
    mobject/          Base Mobject class
    types/            VMobject, VGroup, point_cloud
    geometry/         Line, Arrow, Circle, Square, Polygon, Arc, ...
    text/             Text, MathTex, Tex, MarkupText
    svg/              SVGMobject, Brace, BraceLabel
    three_d/          Surface, ThreeDVMobject, Sphere, Cylinder, Polyhedra
    graphing/         NumberLine, Axes, NumberPlane, ComplexPlane, functions
    graph/            Graph, DiGraph (via graphology)
    matrix/           Matrix mobject
    table/            Table mobject
    value_tracker/    ValueTracker
    vector_field/     VectorField, ArrowVectorField, StreamLines
    frame/            ScreenRectangle / frame helpers
    logo/             Manim logo mobject
    opengl/           OpenGL-specific mobject shims
    utils/            Shared mobject helpers
  opengl/             Legacy OpenGL shader/renderer scaffolding
  renderer/           Drawing backends
    scene_backend.ts  SceneBackend interface (the contract)
    renderer.ts       Legacy IRenderer wrapper
    cairo/            CairoBackend (Canvas2D — default)
    three/            ThreeBackend (three.js WebGL — opt-in)
    cairo_renderer/   Legacy cairo renderer scaffolding
    opengl_renderer/  Legacy OpenGL renderer scaffolding
    opengl_renderer_window/
    shader/           Shader helpers
    shader_wrapper/
    vectorized_mobject_rendering/
  scene/              Orchestration and output
    scene/            Scene base class
    three_scene.ts    Scene preconfigured for the three.js backend
    three_d_scene/    ThreeDScene (Cairo + ThreeDCamera 3D)
    moving_camera_scene/  MovingCameraScene
    zoomed_scene/     ZoomedScene
    vector_space_scene/   VectorScene, LinearTransformationScene
    section/          Section / video metadata
    scene_file_writer/    MP4/WebM/PNG export
    timeline/         Timeline + TimelineControls (additive)
    interaction/      PointerDispatcher, hit_test, EventEmitter (additive)
  camera/             Viewing and projection
    camera/           Base Camera
    moving_camera/    MovingCamera + CameraFrame
    three_d_camera/   ThreeDCamera (software 3D for Cairo)
    mapping_camera/   MappingCamera, SplitScreenCamera, OldMultiCamera
    multi_camera/     MultiCamera
  typing/             Shared TS type aliases
  utils/              Shared utilities (bezier, rate_functions, space_ops,
                      iterables, config_ops, file_ops, tex, color, ...)
  orchestrator.ts     Conversion agent swarm
  prompt-builder.ts   Prompt construction for agents
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

manim-ts ships two renderer backends behind a common `SceneBackend` interface
(`src/renderer/scene_backend.ts`). Both implement the same six methods:
`addMobject`, `removeMobject`, `sync`, `render`, `resize`, `dispose`.

- **`CairoBackend`** (default) — Canvas2D. Uses `canvas` (node-canvas, which
  binds libcairo — matching Python Manim's pycairo byte-for-byte) on Node.js
  and the native `<canvas>` element in the browser. Translates VMobject bezier
  data into `moveTo` / `bezierCurveTo` / `fill` / `stroke` calls.
- **`ThreeBackend`** (opt-in) — three.js WebGL. Uses `Line2` for GPU-width
  strokes and `earcut` triangulation for fills.

Select a backend via `ManimConfig.renderer` (`"cairo"` | `"opengl"`) or the
scene constructor:

```typescript
const scene = new Scene({ canvas });                        // Cairo (default)
const scene = new Scene({ canvas, renderer: "opengl" });    // three.js WebGL
```

### Backend contract

`ThreeBackend` renders exactly the mobjects the caller passed to `addMobject`
— it never walks `getFamily()`. Callers that want hierarchy should flatten the
family themselves (see `extractFamily` in `demo/real-demo.ts`) and add each
leaf. This matches the `FamilySyncer` expectation inside `ThreeBackend`.

`CairoBackend` is slightly more forgiving: when composing its draw order
(`_collectSortedFamily`) it calls `getFamily(true)` on each registered mobject,
dedupes, then sorts by `zIndex`. This is required for mobjects whose visible
geometry lives on submobjects — `DashedLine` / `DottedLine` (each dash is a
child), `DoubleArrow` (two tip children), `Axes` (tick marks). Without the
family expansion, those classes rendered nothing under the flat-list
contract.

### 3D under Cairo

3D mobjects still work under `CairoBackend`: install a `ThreeDCamera` via
`backend.setCamera(camera)` and the backend calls `camera.getMobjectsToDisplay`
for view-space depth sorting (back-to-front painter's algorithm), matching
Python Manim's Cairo + `ThreeDCamera` pipeline. Without a `ThreeDCamera`, Cairo
simply sorts by `zIndex`.

For video output in Node.js, frames are piped to **fluent-ffmpeg** for encoding
into MP4, WebM, GIF, or MOV containers.

See the [Renderer Modes guide](/docs/guides/renderer-modes) for full details.

## Library Replacements

Every external dependency used by Python Manim has a TypeScript equivalent:

| Python | TypeScript | Purpose |
|---|---|---|
| numpy | numpy-ts | N-dimensional arrays, linear algebra |
| numpy (4x4 matrices) | gl-matrix | Transformation matrices |
| cairo | Canvas2D / `canvas` (node-canvas, libcairo) | 2D rendering |
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
