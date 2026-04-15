# Manim-ts

An accurate TypeScript port of [3Blue1Brown's Manim](https://github.com/3b1b/manim) — the mathematical animation engine behind some of the most popular math videos on the internet.

## Quick Start

### Browser

```html
<canvas id="manim"></canvas>
<script type="module">
  import {
    Scene,
    Circle,
    Create,
    BLUE,
  } from "https://cdn.jsdelivr.net/npm/manim-ts/dist/manim-ts.browser.js";

  const scene = new Scene(document.getElementById("manim"), {
    width: 800,
    height: 450,
  });
  const circle = new Circle({ radius: 1.5, color: BLUE });
  await scene.play(new Create(circle));
</script>
```

### Locally

```bash
npm install manim-ts
```

```typescript
import { Scene, Circle, Square, Create, Transform, FadeOut } from "manim-ts";

class SquareToCircle extends Scene {
  async construct() {
    const square = new Square({ sideLength: 3 });
    const circle = new Circle({ radius: 1.5 });

    await this.play(new Create(square));
    await this.play(new Transform(square, circle));
    await this.play(new FadeOut(circle));
  }
}
```

See the [examples](demo/) for more.

## What You Can Build

| | |
|---|---|
| **Function Graphs** — Axes, NumberPlane, FunctionGraph | **LaTeX Equations** — MathTex, Tex via KaTeX |
| **Text Animations** — Write, FadeIn, typed code blocks | **Geometry Transforms** — Rotate, Scale, Morph, Transform |

## Features

- **Geometry** — Circle, Rectangle, Polygon, Arrow, Arc, Star, Brace, Line, and more
- **Text & LaTeX** — Text, MathTex, Tex, Code via KaTeX
- **Graphing** — Axes, NumberPlane, FunctionGraph, ParametricFunction, VectorField, BarChart
- **3D** — Sphere, Cube, Cylinder, Torus, Surface, ThreeDAxes, Polyhedra
- **Animations** — FadeIn/Out, Create, Transform, Write, GrowFromCenter, AnimationGroup, LaggedStart
- **Composition** — AnimationGroup, Succession, LaggedStart, LaggedStartMap
- **Export** — Video export via ffmpeg, server-side rendering via Node.js
- **Graphs & Tables** — Network graphs, Matrix, Table
- **Interactive Playback** *(opt-in)* — Scrubbable timeline, play/pause/seek, speed control, loop
- **Pointer Events** *(opt-in)* — `mobject.on("click" | "hover" | "drag" | ...)` with canvas hit-testing
- **Framework Wrappers** — Drop-in `<ManimScene>` component for React and Vue

## Interactive Playback & Events

Any scene can opt in to a scrubbable timeline and pointer events — without changing its animation code.

```typescript
import { Scene, Circle, Create, BLUE, TimelineControls } from "manim-ts";

class Demo extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    circle.on("click", (e) => console.log("clicked at", e.sceneX, e.sceneY));
    await this.play(new Create(circle));
  }
}

const scene = new Demo({
  canvas: document.getElementById("c") as HTMLCanvasElement,
  playback: true,     // enable timeline recording + seek
  interactive: true,  // enable mobject.on(...) events
});
await scene.render();

// Drop-in play/pause/scrubber UI
new TimelineControls(scene.playback, document.getElementById("controls")!);

// Or programmatic control
scene.playback.seek(1.5);
scene.playback.setSpeed(2);
scene.playback.play();
```

All three flags are **opt-in** — regular scenes pay zero runtime cost. See [Interactive Playback Guide](docs/docs/guides/interactive-playback.md) and [Pointer Events Guide](docs/docs/guides/pointer-events.md).

### React

```tsx
import { ManimScene } from "manim-ts/react";

<ManimScene
  sceneClass={Demo}
  controls        // shows play/pause/scrubber
  playback
  interactive
  width={800}
  height={450}
/>
```

### Vue

```vue
<script setup>
import { ManimScene } from "manim-ts/vue";
import { Demo } from "./demo";
</script>

<template>
  <ManimScene :scene-class="Demo" controls playback interactive :width="800" :height="450" />
</template>
```

## Python to TypeScript

If you know Python Manim, you already know Manim-ts. The API mirrors the original — just with TypeScript syntax:

```python
# Python
class MyScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        self.play(Create(circle))
        self.play(circle.animate.shift(RIGHT * 2))
        self.play(FadeOut(circle))
```

```typescript
// TypeScript
class MyScene extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    await this.play(new Create(circle));
    await this.play(circle.animate.shift(RIGHT.scale(2)));
    await this.play(new FadeOut(circle));
  }
}
```

| Python | TypeScript |
|--------|-----------|
| `Circle(color=BLUE)` | `new Circle({ color: BLUE })` |
| `self.play(Create(c))` | `await this.play(new Create(c))` |
| `LEFT * 2` | `LEFT.scale(2)` |
| `self.wait(1)` | `await this.wait(1)` |
| `**kwargs` | Typed options objects |

## Node.js (Server-Side Rendering)

For video export and headless rendering, manim-ts uses `canvas` (node-canvas),
which binds libcairo directly — the same library Python Manim's pycairo wraps.
Node-side rasterization therefore matches ManimCE byte-for-byte (verified by a
57-scene parity harness in `scripts/parity/`).

```bash
npm install canvas
```

On Alpine / musl Docker images, `canvas` compiles from source (no prebuilt
binary ships for musl libc). Either switch to `node:slim` / `node:bookworm`, or
`apk add --no-cache build-base cairo-dev pango-dev jpeg-dev giflib-dev` first.

```typescript
import { Scene, Square, FadeIn, Tex, RED } from "manim-ts";
import { createCanvas } from "canvas";

class ExportScene extends Scene {
  async construct() {
    const square = new Square({ sideLength: 2, color: RED });
    const label = new Tex("x^2");
    label.moveTo(square.getCenter());

    await this.play(new FadeIn(square));
    await this.play(new Write(label));
    await this.wait(2);
  }
}

const canvas = createCanvas(1920, 1080);
const scene = new ExportScene({ canvas, fps: 60 });
await scene.exportVideo("output.mp4");
```

Requires `ffmpeg` on your PATH.

## Documentation

Full docs at [manim-ts docs](docs/) — including API reference, guides, and conversion examples.

```bash
cd docs && npm install && npm start
```

## Development

```bash
git clone https://github.com/melland55/Manim-ts.git
cd Manim-ts
npm install
npm run demo          # Launch browser demo
npm run test          # Run test suite
npm run typecheck     # Type-check with tsc
npm run docs          # Start docs dev server
```

## License

MIT
