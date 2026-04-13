---
title: Renderer
sidebar_position: 3
---

# Renderer

The `Renderer` class implements `IRenderer` and handles all drawing operations for manim-ts. It supports both browser Canvas2D rendering and Node.js server-side rendering via `@napi-rs/canvas`.

## Overview

The renderer sits between the scene and the output surface. It translates mobject geometry into draw calls, manages the rendering pipeline, and supports both 2D and (stubbed) OpenGL rendering paths.

```
Scene
  |
  v
Renderer
  |
  +-- Canvas2D (browser)
  +-- @napi-rs/canvas (Node.js)
  +-- OpenGL stubs (future)
```

## Initialization

### Browser Canvas

Use `init()` to attach the renderer to an HTML `<canvas>` element for browser rendering.

```ts
import { Renderer } from "manim-ts";

const renderer = new Renderer();
const canvas = document.getElementById("my-canvas") as HTMLCanvasElement;
renderer.init(canvas);
```

### Node.js Canvas

Use `initWithNodeCanvas()` to render server-side using `@napi-rs/canvas`. This is used for generating video files and PNG sequences.

```ts
import { Renderer } from "manim-ts";
import { createCanvas } from "@napi-rs/canvas";

const renderer = new Renderer();
const canvas = createCanvas(1920, 1080);
renderer.initWithNodeCanvas(canvas);
```

## Key Methods

### `render(scene: IScene): void`

Performs a full render of the scene. This clears the canvas, draws the background, and renders all mobjects in order.

```ts
renderer.render(scene);
```

### `clear(color?: Color): void`

Fills the entire canvas with a solid color. If no color is provided, uses the camera's background color.

```ts
renderer.clear(BLACK);
```

### `renderMobject(mobject: IMobject, camera: ICamera): void`

Renders a single mobject using the given camera's coordinate transformation. This is the core rendering method that dispatches to type-specific rendering logic.

```ts
renderer.renderMobject(circle, camera);
```

For `VMobject` instances (vector mobjects), this draws strokes and fills using bezier path data. For `ImageMobject` and other types, it uses their specific rendering paths.

### `getPixelArray(): Uint8ClampedArray`

Returns the raw RGBA pixel data from the current canvas state. Useful for testing and image export.

### `saveFrame(path: string): Promise<void>`

Saves the current canvas contents to an image file (Node.js only).

## Rendering Pipeline

When `render(scene)` is called, the following steps occur:

1. **Clear** -- The canvas is filled with the camera's background color.
2. **Sort** -- Mobjects are sorted by z-index (and depth for 3D scenes).
3. **Transform** -- Each mobject's points are projected through the camera.
4. **Draw** -- Each mobject is drawn to the canvas:
   - **VMobjects** -- Bezier curves are drawn as Canvas2D paths with fill and stroke.
   - **ImageMobjects** -- Raster images are composited onto the canvas.
   - **Groups** -- Children are drawn recursively in order.
5. **Composite** -- Any post-processing effects are applied.

## VMobject Rendering

Vector mobjects are the most common type. Their rendering involves:

- **Fill** -- Closed bezier paths are filled using the mobject's fill color and opacity.
- **Stroke** -- Bezier paths are stroked using the mobject's stroke color, width, and opacity.
- **Gradient** -- Linear and radial gradients are supported for both fill and stroke.
- **Opacity** -- Per-point opacity interpolation for gradient effects.

```ts
const circle = new Circle({
  fillColor: BLUE,
  fillOpacity: 0.5,
  strokeColor: WHITE,
  strokeWidth: 4,
});
// Renderer draws: filled blue circle with white outline
```

## OpenGL Rendering

manim-ts includes stubs for an OpenGL rendering path, mirroring Python Manim's OpenGL renderer architecture.

### OpenGLRenderer

`OpenGLRenderer` is the OpenGL-based renderer class. In the current implementation, it provides the interface structure but delegates to Canvas2D internally.

```ts
import { OpenGLRenderer } from "manim-ts";

const renderer = new OpenGLRenderer();
```

### OpenGLCamera

`OpenGLCamera` pairs with `OpenGLRenderer` and provides WebGL-compatible camera transformations.

```ts
import { OpenGLCamera } from "manim-ts";

const camera = new OpenGLCamera({
  pixelWidth: 1920,
  pixelHeight: 1080,
});
```

These classes exist to maintain API compatibility with Python Manim's OpenGL path and to provide a foundation for future WebGL/WebGPU rendering.

## Hybrid Rendering Strategy

manim-ts uses a hybrid approach:

| Rendering Target | Technology | Status |
|---|---|---|
| Browser 2D | Canvas2D | Fully implemented |
| Node.js 2D | @napi-rs/canvas (Canvas2D) | Fully implemented |
| Browser 3D | WebGL stubs | Interface only |
| Node.js 3D | OpenGL stubs | Interface only |

The Canvas2D path handles all current rendering needs including 3D scenes (via software projection in `ThreeDCamera`). The OpenGL path is structured for future hardware-accelerated rendering.

## Usage with Scene

In typical use, you don't interact with the renderer directly. The `Scene` class manages it:

```ts
class MyScene extends Scene {
  async construct(): Promise<void> {
    // Scene handles all renderer calls internally
    const circle = new Circle();
    this.add(circle);        // Mobject registered for rendering
    await this.play(new Create(circle)); // Renderer called each frame
  }
}

// For browser embedding:
const scene = new MyScene();
scene.renderer.init(canvas);
await scene.render();
```

For advanced use cases (custom render loops, off-screen rendering, frame export), you can access the renderer directly through `scene.renderer`.
