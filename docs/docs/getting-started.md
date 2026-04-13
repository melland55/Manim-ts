---
sidebar_position: 1
title: Getting Started
---

# Getting Started

manim-ts is a TypeScript port of [3Blue1Brown's Manim](https://github.com/3b1b/manim) — the mathematical animation engine behind some of the most popular math videos on the internet. Unlike the original Python library, manim-ts runs natively in the browser using Canvas2D rendering, and also supports server-side rendering via Node.js.

## Installation

Install from npm:

```bash
npm install manim-ts
```

Or clone the repository and build from source:

```bash
git clone https://github.com/user/manim-ts.git
cd manim-ts
npm install
npm run build
```

## Quick Start — Browser

Create a scene by extending the `Scene` class. Animations use `async`/`await` instead of Python's generator-based `yield` pattern.

```typescript
import { Scene, Circle, Create, FadeOut, BLUE } from "manim-ts";

class MyScene extends Scene {
  async construct() {
    const circle = new Circle({ radius: 1, color: BLUE });
    await this.play(new Create(circle));
    await this.wait(1);
    await this.play(new FadeOut(circle));
  }
}

// Mount to a canvas element and run
const canvas = document.getElementById("manim-canvas") as HTMLCanvasElement;
const scene = new MyScene({ canvas });
scene.render();
```

This renders a blue circle that draws itself onto the screen, pauses for one second, then fades out — all inside a `<canvas>` element in your page.

## Quick Start — Node.js (Server-Side Rendering)

For server-side rendering or video export, manim-ts uses `@napi-rs/canvas` as a drop-in Canvas2D backend and `fluent-ffmpeg` for video encoding.

```typescript
import { Scene, Square, FadeIn, Write, Tex, RED } from "manim-ts";
import { createCanvas } from "@napi-rs/canvas";

class ExportScene extends Scene {
  async construct() {
    const square = new Square({ sideLength: 2, color: RED });
    const label = new Tex("x^2", { fontSize: 48 });
    label.moveTo(square.getCenter());

    await this.play(new FadeIn(square));
    await this.play(new Write(label));
    await this.wait(2);
  }
}

const canvas = createCanvas(1920, 1080);
const scene = new ExportScene({ canvas, fps: 60 });

// Export frames to video
await scene.exportVideo("output.mp4");
```

Make sure you have `ffmpeg` installed and available on your PATH for video export.

## Key Differences from Python Manim

If you are coming from the Python version of Manim, here are the main differences:

### async/await instead of yield

Python Manim uses generator functions with `yield`:

```python
# Python Manim
def construct(self):
    circle = Circle()
    self.play(Create(circle))
    self.wait(1)
```

manim-ts uses async/await:

```typescript
// manim-ts
async construct() {
  const circle = new Circle();
  await this.play(new Create(circle));
  await this.wait(1);
}
```

### TypeScript types

All Mobjects, animations, and scene methods are fully typed. Points are represented as `Point3D` (an NDArray of shape [3]) and point arrays as `Points3D` (NDArray of shape [n, 3]), powered by **numpy-ts**.

```typescript
import { Point3D, Points3D } from "manim-ts";

const origin: Point3D = np.array([0, 0, 0]);
const vertices: Points3D = np.array([
  [0, 0, 0],
  [1, 0, 0],
  [0.5, 1, 0],
]);
```

### Browser-native Canvas2D rendering

Instead of Cairo (the Python rendering backend), manim-ts renders directly to an HTML Canvas2D context in the browser. This means no binary dependencies for browser usage — just import and go.

### Mathematical fidelity with numpy-ts

Under the hood, manim-ts uses [numpy-ts](https://www.npmjs.com/package/numpy-ts) as its math foundation. The numpy-ts API mirrors Python NumPy — `np.array()`, `np.dot()`, `np.linalg.solve()`, and so on — ensuring that geometric calculations, Bezier interpolations, and matrix transforms produce results numerically consistent with Python Manim.

### Options objects instead of **kwargs

Python's `**kwargs` patterns are replaced with explicit typed options objects:

```typescript
// Python: Circle(radius=2, color=BLUE, fill_opacity=0.5)
const circle = new Circle({
  radius: 2,
  color: BLUE,
  fillOpacity: 0.5,
});
```

## What's Next

- **[Browser Usage Guide](/docs/guides/browser-usage)** — Set up manim-ts with Vite, interactive demos, and performance tips.
- **[Guides](/docs/category/guides)** — In-depth tutorials on animations, custom Mobjects, and more.
- **[API Reference](/docs/category/api-reference)** — Full class and method documentation.
