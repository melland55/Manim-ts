---
sidebar_position: 3
title: Browser Usage
---

# Browser Usage

manim-ts is designed to run natively in the browser. This guide covers setting up a project with Vite, configuring the build, and getting the best performance out of browser-based mathematical animations.

## Setting Up with Vite

[Vite](https://vitejs.dev/) is the recommended bundler for manim-ts projects. Create a new project:

```bash
npm create vite@latest my-manim-app -- --template vanilla-ts
cd my-manim-app
npm install manim-ts
```

### HTML Template

Create an HTML file with a canvas element that manim-ts will render into:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>manim-ts Demo</title>
    <style>
      body {
        margin: 0;
        background: #000;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      #manim-canvas {
        width: 100%;
        max-width: 1920px;
        aspect-ratio: 16 / 9;
      }
    </style>
  </head>
  <body>
    <canvas id="manim-canvas" width="1920" height="1080"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### Entry Point

```typescript
// src/main.ts
import { Scene, Circle, Square, Create, Transform, FadeOut, BLUE, RED } from "manim-ts";

class BrowserDemo extends Scene {
  async construct() {
    const circle = new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0.5 });
    await this.play(new Create(circle));

    const square = new Square({ sideLength: 2.5, color: RED, fillOpacity: 0.5 });
    await this.play(new Transform(circle, square));

    await this.wait(1);
    await this.play(new FadeOut(square));
  }
}

const canvas = document.getElementById("manim-canvas") as HTMLCanvasElement;
const scene = new BrowserDemo({ canvas });
scene.render();
```

### Vite Configuration

manim-ts depends on numpy-ts, which ships as ESM. Some internal modules reference patterns that Vite needs guidance on. Add the following to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    // Ensure numpy-ts is pre-bundled so its ESM exports resolve correctly
    include: ["numpy-ts", "manim-ts"],
  },
  resolve: {
    alias: {
      // If you encounter Node.js built-in imports in dependencies,
      // stub them out for the browser
      path: "path-browserify",
      fs: "rollup-plugin-node-builtins",
    },
  },
  build: {
    target: "esnext",
  },
});
```

If numpy-ts or any sub-dependency references Node.js built-ins like `fs` or `path`, install browser polyfills:

```bash
npm install path-browserify
```

Most manim-ts functionality works without any Node.js polyfills. The stubs above are only needed if your specific usage triggers those code paths (for example, file I/O related features that are server-only).

## Interactive Demo Example

One advantage of running in the browser is interactivity. You can respond to user input and update the scene in real time.

```typescript
import { Scene, Dot, Line, YELLOW, GREEN, np } from "manim-ts";

class InteractiveScene extends Scene {
  async construct() {
    const dot = new Dot({ point: np.array([0, 0, 0]), color: YELLOW, radius: 0.1 });
    this.add(dot);

    // Listen for mouse movement on the canvas
    this.canvas.addEventListener("mousemove", (event: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      // Convert pixel coordinates to scene coordinates
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      dot.moveTo(np.array([x * 7, y * 4, 0])); // Scale to scene dimensions
    });

    // Draw a tracking line from the origin to the dot
    const origin = np.array([0, 0, 0]);
    const line = new Line({
      start: origin,
      end: origin,
      color: GREEN,
    });
    this.add(line);

    // Update line end point each frame
    this.onUpdate(() => {
      line.putStartAndEndOn(origin, dot.getCenter());
    });

    // Keep the scene alive indefinitely for interaction
    await this.wait(Infinity);
  }
}

const canvas = document.getElementById("manim-canvas") as HTMLCanvasElement;
const scene = new InteractiveScene({ canvas });
scene.render();
```

## Animation Loop Pattern

For continuous animations (not just one-shot playback), use the animation loop pattern to drive the scene at a consistent frame rate:

```typescript
import { Scene, Circle, BLUE } from "manim-ts";

class LoopingScene extends Scene {
  async construct() {
    const circle = new Circle({ radius: 1, color: BLUE, fillOpacity: 0.8 });
    this.add(circle);

    // Animate a property continuously
    let time = 0;
    this.onUpdate((dt: number) => {
      time += dt;
      const scale = 1 + 0.3 * Math.sin(time * 2);
      circle.scaleTo(scale);
      circle.moveTo(
        np.array([2 * Math.cos(time), 2 * Math.sin(time), 0])
      );
    });

    await this.wait(Infinity);
  }
}
```

You can also drive the scene manually with `requestAnimationFrame` if you need tighter control:

```typescript
const scene = new MyScene({ canvas, autoplay: false });

function tick(timestamp: number) {
  scene.tick(timestamp);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

## Performance Tips

### Hybrid rendering: engine classes for construction, plain arrays for hot loops

manim-ts Mobject classes (Circle, Line, VMobject, etc.) carry metadata, style information, and update callbacks. This is ideal for constructing and animating scenes declaratively. However, if you have a tight per-frame render loop that manipulates thousands of points, operating on raw typed arrays can be significantly faster.

```typescript
// Construction phase: use Mobject classes for clarity
const dots: Dot[] = [];
for (let i = 0; i < 500; i++) {
  const dot = new Dot({
    point: np.array([Math.random() * 8 - 4, Math.random() * 6 - 3, 0]),
    radius: 0.03,
    color: WHITE,
  });
  dots.push(dot);
  this.add(dot);
}

// Hot loop: update positions using plain Float64Arrays for speed
const positions = new Float64Array(500 * 3);
this.onUpdate((dt: number) => {
  for (let i = 0; i < 500; i++) {
    const idx = i * 3;
    positions[idx] += (Math.random() - 0.5) * dt;     // x
    positions[idx + 1] += (Math.random() - 0.5) * dt; // y
    // positions[idx + 2] stays 0                       // z
    dots[i].moveTo(np.array([positions[idx], positions[idx + 1], 0]));
  }
});
```

### Minimize allocations in per-frame callbacks

Avoid creating new objects (arrays, points, Mobjects) inside `onUpdate` callbacks. Pre-allocate buffers and reuse them:

```typescript
// Pre-allocate a reusable point
const tempPoint: Point3D = np.array([0, 0, 0]);

this.onUpdate((dt: number) => {
  // Mutate in place instead of creating a new array each frame
  tempPoint.set([newX, newY, 0]);
  dot.moveTo(tempPoint);
});
```

### Canvas resolution and device pixel ratio

For sharp rendering on high-DPI displays, scale the canvas buffer size by the device pixel ratio:

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = 1920 * dpr;
canvas.height = 1080 * dpr;
canvas.style.width = "1920px";
canvas.style.height = "1080px";

const ctx = canvas.getContext("2d")!;
ctx.scale(dpr, dpr);
```

### Offscreen rendering for complex scenes

For scenes with many objects, consider rendering to an `OffscreenCanvas` in a Web Worker to keep the main thread responsive:

```typescript
// main.ts
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker(new URL("./render-worker.ts", import.meta.url), {
  type: "module",
});
worker.postMessage({ canvas: offscreen }, [offscreen]);
```

### Batch static geometry

If parts of your scene do not change between frames, render them once to a separate canvas and composite the result. This avoids re-drawing static elements every frame.
