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

For video export and headless rendering:

```typescript
import { Scene, Square, FadeIn, Tex, RED } from "manim-ts";
import { createCanvas } from "@napi-rs/canvas";

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
