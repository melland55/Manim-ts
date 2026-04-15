---
sidebar_position: 4
title: Renderer Modes
---

# Renderer Modes

manim-ts ships two renderer backends behind a common `SceneBackend` interface,
mirroring ManimCE's `config.renderer` setting. Cairo (Canvas2D) is the default;
three.js WebGL is opt-in.

## Overview

| Backend         | Implementation               | Default | Best for                                  |
|-----------------|------------------------------|---------|-------------------------------------------|
| `CairoBackend`  | Canvas2D (`canvas` / node-canvas — libcairo — on Node, native `<canvas>` in browser) | yes     | Byte-for-byte parity with ManimCE's pycairo output, Node video export, crisp analytical AA |
| `ThreeBackend`  | three.js WebGL (`Line2` strokes, `earcut` fills)                   | no      | GPU-accelerated strokes, 3D scenes, large scene counts |

Both backends implement `SceneBackend` (`src/renderer/scene_backend.ts`):

```typescript
export interface SceneBackend {
  addMobject(m: IMobject): void;
  removeMobject(m: IMobject): void;
  sync(): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

## Choosing a Backend

Use **Cairo** (the default) when you want:

- Byte-for-byte visual parity with Python Manim's default Cairo renderer.
  On Node, `CairoBackend` runs through `canvas` (node-canvas), which binds
  libcairo directly — the exact same library pycairo wraps. The Node output
  therefore matches Python Manim's pycairo pipeline byte-for-byte.
- Server-side Node.js rendering and video export via `fluent-ffmpeg`.
- Analytical coverage anti-aliasing (no SSAA machinery).

### Installing node-canvas

On Node, install the `canvas` package:

```bash
npm install canvas
```

:::note Alpine / musl Docker images
`canvas` compiles from source on Alpine/musl because no prebuilt binary ships
for musl libc. Either switch to a glibc-based image (`node:slim` /
`node:bookworm`) or install libcairo and friends first:

```dockerfile
RUN apk add --no-cache build-base cairo-dev pango-dev jpeg-dev giflib-dev
```
:::

Use **three.js** when you want:

- GPU-width strokes that stay crisp at any zoom (`Line2` / `LineMaterial`).
- Better performance with hundreds of mobjects.
- Integration with existing three.js lighting, materials, or post-processing.

## `ManimConfig.renderer`

The renderer is configured through `ManimConfig.renderer`
(`src/core/types.ts`):

```typescript
interface ManimConfig {
  // ...
  /**
   * Renderer backend selection. Mirrors ManimCE's `config.renderer`.
   * @default "cairo"
   */
  renderer?: "cairo" | "opengl";
}
```

Pass it through the `Scene` constructor:

```typescript
import { Scene } from "manim-ts";

// Cairo (default) — no option needed
const a = new Scene({ canvas });

// three.js WebGL
const b = new Scene({ canvas, renderer: "opengl" });
```

A single `<canvas>` can only hold one context kind at a time (2D and WebGL
are mutually exclusive). To switch backends at runtime, replace the canvas
element. `demo/index.html` demonstrates this with its Cairo / OpenGL toggle
button.

## `SceneBackend` Interface

Backends render **exactly** the mobjects the caller passed to `addMobject` —
they never walk `getFamily()` themselves. Callers that want hierarchy should
flatten the family and add each leaf individually. This keeps the backend
contract small and is what `FamilySyncer` (inside `ThreeBackend`) expects.

A typical flatten helper:

```typescript
import type { IMobject, IVMobject } from "manim-ts";

function extractFamily(mob: IVMobject): IMobject[] {
  const out: IMobject[] = [];
  const walk = (m: IVMobject) => {
    if (m.points && m.points.shape[0] > 0) out.push(m);
    for (const sub of m.submobjects) walk(sub as IVMobject);
  };
  walk(mob);
  return out;
}

for (const leaf of extractFamily(root)) backend.addMobject(leaf);
```

The six methods:

- `addMobject(m)` / `removeMobject(m)` — register or unregister a leaf mobject
  for rendering.
- `sync()` — give the backend a chance to reconcile its internal state with
  the registered mobjects. No-op for Cairo (immediate-mode); for three.js,
  this is where `FamilySyncer` builds/updates `Line2` meshes.
- `render()` — draw one frame.
- `resize(w, h)` — update output buffer dimensions.
- `dispose()` — release GPU/CPU resources.

## 3D with Cairo (ThreeDCamera depth sort)

3D mobjects work under `CairoBackend`. Install a `ThreeDCamera` and the
backend delegates visible-mobject ordering to the camera:

```typescript
import { CairoBackend } from "manim-ts/renderer/cairo";
import { ThreeDCamera } from "manim-ts/camera/three_d_camera";

const backend = new CairoBackend({ canvas });
const camera = new ThreeDCamera({ /* ... */ });
backend.setCamera(camera);
```

When a `ThreeDCamera` is active, `CairoBackend.render` calls
`camera.getMobjectsToDisplay(mobjects, false)`. The camera returns the
mobjects sorted back-to-front by view-space z (painter's algorithm), matching
Python Manim's Cairo + `ThreeDCamera` pipeline. `ThreeDCamera.projectPoints`
then maps world points into 2D screen space before the backend strokes or
fills the path.

Without a `ThreeDCamera`, `CairoBackend` falls back to sorting by `zIndex`
only.

## three.js color and anti-aliasing notes

`ThreeBackend` goes out of its way to match Cairo's output pixel-for-pixel,
which requires disabling several of three.js's default color-management and
tone-mapping behaviors in `src/renderer/three/three_renderer.ts`:

```typescript
THREE.ColorManagement.enabled = false;           // blend alpha in sRGB, like Cairo
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // pass-through, no convert
renderer.toneMapping = THREE.NoToneMapping;
```

- `ColorManagement.enabled = false` — three.js would otherwise blend in linear
  space; Cairo blends in sRGB. Disabling this keeps alpha compositing identical.
- `outputColorSpace = LinearSRGBColorSpace` on both the renderer and its render
  target — pass-through, no sRGB/linear conversion.
- `toneMapping = NoToneMapping` — we want raw colors, not filmic tonemapping.

### Edge softness via SSAA + 3×3 tent filter

Cairo's analytical coverage AA produces soft, faithful edges. three.js's
default MSAA does not match it. `ThreeRenderer` therefore uses supersampling:

1. The scene is rendered into a `WebGLRenderTarget` at `SSAA_SCALE²` the
   display resolution (currently `SSAA_SCALE = 2`, so 4× the pixels).
2. A fullscreen quad downsamples the render target to the real framebuffer.
   Its fragment shader applies a 3×3 tent (Bartlett) filter with weights
   `1 2 1 / 2 4 2 / 1 2 1` (sum 16).

This approximates Cairo's analytical coverage closely enough that the two
backends are visually interchangeable for most scenes.
