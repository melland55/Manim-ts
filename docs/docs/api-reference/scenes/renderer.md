---
title: Renderer
sidebar_position: 3
---

# Renderer

manim-ts ships two renderer backends behind a common `SceneBackend` interface.
Scenes pick one via `ManimConfig.renderer` (`"cairo"` by default, `"opengl"` to
opt into three.js). All low-level rendering code lives under `src/renderer/`:

```
src/renderer/
  scene_backend.ts        # SceneBackend interface (the contract)
  renderer.ts             # legacy IRenderer wrapper
  cairo/
    cairo_backend.ts      # CairoBackend — Canvas2D
  three/
    three_backend.ts      # ThreeBackend — three.js WebGL
    three_renderer.ts     # wraps THREE.WebGLRenderer + SSAA pipeline
    family_syncer.ts      # diffs mobject set against the three.js group
    three_camera.ts       # ortho/perspective camera factories
    three_geometry.ts     # VMobject → Line2 / earcut fill geometry
    three_materials.ts    # stroke / fill material builders
    adapters/             # per-mobject three.js adapters
```

## SceneBackend interface

Every backend implements the same surface (`src/renderer/scene_backend.ts`):

```ts
import type { IMobject } from "../../src/core/types.js";

export interface SceneBackend {
  addMobject(m: IMobject): void;
  removeMobject(m: IMobject): void;
  sync(): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

### Family-handling contract

`addMobject` / `removeMobject` both take a single `IMobject`. The two backends
differ in how they expand hierarchy at draw time:

- **`ThreeBackend`** renders exactly the set the caller added — it never walks
  `getFamily()`. Callers that want hierarchy should flatten it themselves
  (e.g., via `mob.getFamily(true)` followed by filtering to renderables) and
  add each leaf individually. `FamilySyncer` relies on this invariant so it
  can diff the mobject set against the mounted `THREE.Group` by object
  identity.
- **`CairoBackend`** calls `getFamily(true)` on each registered mobject inside
  `_collectSortedFamily`, dedupes across siblings, then sorts the result by
  `zIndex`. This is required for `DashedLine` / `DottedLine` (each dash is a
  submobject), `DoubleArrow` (two tip children), and `Axes` (tick marks as
  children) — all of which would otherwise render nothing. When a
  `ThreeDCamera` is active, this path is bypassed in favour of
  `camera.getMobjectsToDisplay`.

## Selecting a backend

```ts
// Cairo (default) — no renderer field needed.
const scene = new MyScene({ canvas });

// three.js (opt-in).
const scene = new MyScene({ canvas, renderer: "opengl" });
```

`ManimConfig.renderer` accepts `"cairo" | "opengl"`. The scene constructor
instantiates the matching backend. Both backends target the same
`HTMLCanvasElement` (browser) or `canvas` / node-canvas — libcairo bindings —
(Cairo only, Node.js video export). The Node-side libcairo pipeline is
byte-for-byte identical to Python Manim's pycairo output; this is verified
by the 57-scene parity harness in `scripts/parity/` (36 / 57 byte-identical,
57 / 57 within a 0.1% pixel-diff threshold).

## CairoBackend

`src/renderer/cairo/cairo_backend.ts` — Canvas2D via `CanvasRenderingContext2D`.

```ts
import { CairoBackend } from "../../src/renderer/index.js";

const backend = new CairoBackend({
  canvas,
  frameWidth: 14.222,
  frameHeight: 8.0,
  config: { backgroundColor: BLACK },
});
```

### CairoBackendOptions

| Field | Type | Description |
|-------|------|-------------|
| `canvas` | `HTMLCanvasElement` | Required. Target canvas. |
| `frameWidth` | `number?` | Logical width in Manim units. Default `14.222`. |
| `frameHeight` | `number?` | Logical height in Manim units. Default `8.0`. |
| `config` | `Partial<ManimConfig>?` | Optional config overrides (currently `backgroundColor`, `frameWidth`, `frameHeight`). |

### Extended methods

Beyond the `SceneBackend` contract, `CairoBackend` exposes:

| Method | Description |
|--------|-------------|
| `setCamera(camera)` | Bind an `ICamera` for world-to-pixel transform. If the camera is a `ThreeDCamera`, back-to-front sorting is delegated to `camera.getMobjectsToDisplay`. |
| `setBackgroundColor(color)` | Override the clear color. |

### 3D under Cairo

When a `ThreeDCamera` is bound (see `src/camera/three_d_camera/`), the backend:

1. Calls `camera.getMobjectsToDisplay(mobjects)` to receive a list sorted
   back-to-front by view-space z. This matches Python Manim's Cairo + 3D
   pipeline exactly.
2. Projects each VMobject's subpaths through `camera.projectPoints(points)`
   before rasterizing them as 2D bezier paths.

When no 3D camera is bound, the backend expands each registered mobject's
family (see "Family-handling contract" above) and sorts the result by
`zIndex`.

### Stroke defaults

`CairoBackend._renderVMobject` sets `lineCap = "butt"` and
`lineJoin = "miter"` on the 2D context, matching Python Manim's pycairo
defaults. These are the values load-bearing for the parity harness's dash
tests — a round cap would bleed into void gaps, and a round join would soften
sharp corners.

## ThreeBackend

`src/renderer/three/three_backend.ts` — WebGL via three.js.

```ts
import { ThreeBackend } from "../../src/renderer/three/index.js";

const backend = new ThreeBackend({
  canvas,
  frameWidth: 14.222,
  frameHeight: 8.0,
  perspective: false,
});
```

### ThreeBackendOptions

| Field | Type | Description |
|-------|------|-------------|
| `canvas` | `HTMLCanvasElement` | Required. |
| `frameWidth` | `number?` | Default `14.222`. |
| `frameHeight` | `number?` | Default `8.0`. |
| `perspective` | `boolean?` | If true, build a perspective camera instead of an ortho one. |
| `camera3` | `THREE.PerspectiveCamera \| THREE.OrthographicCamera` | Supply your own three.js camera. |
| `config` | `Partial<ManimConfig>?` | Forwarded to `ThreeRenderer`. |

### Exposed internals

| Field | Type | Description |
|-------|------|-------------|
| `threeRenderer` | `ThreeRenderer` | Wraps `THREE.WebGLRenderer`. |
| `threeScene` | `THREE.Scene` | The mounted scene graph. |
| `familySyncer` | `FamilySyncer` | Per-frame mobject → `Object3D` diffing. |

### SSAA and color parity

`ThreeRenderer` renders into an offscreen `WebGLRenderTarget` at **2× scale**,
then resolves to the canvas with a tent filter in a blit pass. This mimics
Python Manim's OpenGL super-sampling so edge quality is close to Cairo's
analytic coverage AA.

To match Cairo's composite hues, `ThreeRenderer` disables three.js's default
color management (`THREE.ColorManagement.enabled = false`, `outputColorSpace =
LinearSRGBColorSpace`, `toneMapping = NoToneMapping`). The result is that alpha
is blended in **sRGB space**, not linear space — identical to Cairo / Python
Manim. Colors you pass in are treated as already-sRGB and written through.

### FamilySyncer

`FamilySyncer` keeps a `Map<IMobject, Adapter>` between mobjects and their
mounted three.js objects. Each `sync()`:

- creates adapters for newly-added mobjects,
- disposes adapters for removed mobjects,
- calls `adapter.update()` on every surviving mobject (treated as dirty).

Adapter implementations live in `src/renderer/three/adapters/`.

## Legacy `Renderer` / `IRenderer`

`src/renderer/renderer.ts` exports a legacy `Renderer` class implementing the
`IRenderer` contract from `src/core/types.ts`. It predates `SceneBackend` and
is retained for Node-side video export paths that depend on `canvas` (node-canvas, libcairo).
**Prefer `CairoBackend` or `ThreeBackend` for new work.**

```ts
export interface IRenderer {
  init(canvas: HTMLCanvasElement | OffscreenCanvas): void;
  render(scene: IScene): void;
  clear(color: IColor): void;
  renderMobject(mob: IMobject, camera: ICamera): void;
}
```

## Usage in a Scene

```ts
class MyScene extends Scene {
  async construct() {
    const c = new Circle({ radius: 1, color: BLUE });
    this.add(c);
    await this.play(new Create(c));
  }
}

// Cairo — default
new MyScene({ canvas }).render();

// three.js — opt in
new MyScene({ canvas, renderer: "opengl" }).render();
```

See the [Renderer Modes guide](/docs/guides/renderer-modes) for trade-offs
between the two backends.
