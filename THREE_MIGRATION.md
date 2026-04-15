# Three.js Migration Guide

## Status (2026-04-15)

three.js is **not** the default. The default backend is now `CairoBackend`
(Canvas2D), which on Node wraps libcairo via `canvas` (node-canvas) and
matches Python Manim's pycairo output **byte-for-byte** for 2D geometry.
This is verified by the 57-scene parity harness in `scripts/parity/`. three.js
remains the opt-in `"opengl"` backend, reached via
`new Scene({ canvas, renderer: "opengl" })` or `ManimConfig.renderer = "opengl"`.

This guide documents the three.js path; it is no longer the recommended
default for 2D work. Use it when you want GPU-width strokes, 3D lighting /
materials, or raw WebGL throughput.

## Why three.js?

Python Manim Community ships an OpenGL-based renderer alongside its Cairo
default. For manim-ts, the analogous choice is **three.js**: it targets
WebGL2, runs in any modern browser, and produces the same camera model
(orthographic for 2D scenes, perspective for 3D) that Python Manim's OpenGL
renderer uses.

Three.js gives us:

- Browser-native rendering with hardware acceleration.
- A real 3D scene graph — 3D mobjects (Sphere, Torus, Surface) render correctly.
- `requestAnimationFrame`-driven loops that keep the browser alive during
  `play()` and `wait()` calls, enabling interactive playback and scrubbing.
- A path to WebGPU when browser support matures.

---

## What Changed

### Renderer

| Cairo path (default) | three.js path (opt-in) |
|---|---|
| `canvas` (node-canvas, libcairo) Canvas2D | `three` WebGL2 |
| `Scene` — Node video export, browser 2D | `ThreeScene` (browser, `HTMLCanvasElement`) |
| Byte-for-byte parity with Python Manim Cairo | Visual parity via SSAA + tent filter |
| Painter's-algorithm 3D via `ThreeDCamera` | Real 3D scene graph, z-buffered |

`ThreeScene` lives in `src/scene/three_scene.ts`. It extends the existing
`Scene` class and overrides `play()` and `wait()` to drive an rAF loop instead
of a blocking while-loop. The rest of the `Scene` API — `add`, `remove`,
`construct`, updaters, timeline, pointer events — is unchanged.

Under the hood, `ThreeScene` uses:

- `ThreeRenderer` (`src/renderer/three/three_renderer.ts`) — owns the
  `WebGLRenderer`, calls `renderer.render(scene, camera)` each tick.
- `FamilySyncer` (`src/renderer/three/family_syncer.ts`) — walks the manim-ts
  mobject family each frame and creates or updates three.js `Mesh`/`Line2`
  objects, disposing stale ones automatically.
- Adapter classes in `src/renderer/three/adapters/` — convert each mobject type
  (`VMobject`, `Surface`, `Polyhedron`) into three.js geometry + material pairs.

### Text and Math Backend

| Before | After |
|---|---|
| `Text` backed by `canvas` (node-canvas) measureText | `GlyphText` backed by opentype.js |
| `MathTex` backed by KaTeX HTML output | `MathTex` backed by MathJax SVG output |
| Glyphs rasterized at fixed resolution | Glyphs as VMobject bezier curves (vector) |

`GlyphText` (`src/mobject/text/glyph_vmobject.ts`) loads a TTF/OTF font via
opentype.js, extracts each character's `d` path, and converts it to a
`VMobject` using `svgPathToSubpaths`. The result is a `VGroup` of per-character
`VMobject`s that scale and animate identically to any other shape.

`MathTexBrowser` (`src/mobject/text/mathtex_browser.ts`) calls
`texToSvg()` (`src/mobject/text/mathjax_renderer.ts`), which renders TeX to an
SVG string via MathJax's `liteAdaptor` (no DOM required), then parses the
`<path>` elements into `VMobject` bezier curves. Each glyph becomes a
`VMobject`; the full expression is a `VGroup`.

### What Did Not Change

Everything else is unaffected by the renderer migration:

- All mobject classes (`VMobject`, `Circle`, `Arrow`, `Polygon`, `Tex`, etc.)
- All animation classes (`Create`, `FadeIn`, `Transform`, etc.)
- Math foundation (`numpy-ts`, `core/math/`, rate functions, bezier helpers)
- Scene API (`add`, `remove`, `play`, `wait`, updaters, `construct`)
- Timeline and interactive playback
- React / Vue integration wrappers
- Test suite — mobject geometry tests do not touch the renderer

---

## How to Port a Script

### Python Manim (before)

```python
from manim import *

class Demo(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        label  = MathTex(r"\pi r^2")
        label.next_to(circle, DOWN)

        self.play(Create(circle))
        self.play(Write(label))
        self.wait(1)
```

### manim-ts with ThreeScene (after)

```typescript
import { Circle, MathTex } from "./src/mobject/index.js";
import { Create, Write } from "./src/animation/index.js";
import { BLUE, DOWN } from "./src/core/math/index.js";
import { ThreeScene } from "./src/scene/three_scene.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

class Demo extends ThreeScene {
  constructor() {
    super({ canvas });
  }

  async construct(): Promise<void> {
    const circle = new Circle({ radius: 1, strokeColor: BLUE });
    const label  = new MathTex("\\pi r^2");
    label.nextTo(circle, DOWN);

    await this.play(new Create(circle));
    await this.play(new Write(label));
    await this.wait(1);
  }
}

const scene = new Demo();
await scene.construct();
```

Key differences:

1. `ThreeScene` instead of `Scene`; pass `{ canvas }` in options.
2. `await` before every `play()` and `wait()` — these return `Promise<void>`
   in both `Scene` and `ThreeScene`, but the rAF loop only yields correctly
   when awaited.
3. Color constants import from `src/core/math/index.js` or
   `src/utils/color/manim_colors.js` (same names as Python).
4. No `self.` — use `this.` for scene methods.

---

## Known Differences vs Python Manim

### GPU Stroke Widths

Python Manim's OpenGL renderer measures stroke widths in screen pixels via a
custom GLSL shader that expands geometry along the screen-space normal. Three.js
`LineMaterial` (from `three/addons/lines/LineMaterial.js`) also supports
pixel-space widths, but the exact rounding and anti-aliasing differs from
Manim's shader. Strokes thinner than 1 px may appear slightly crisper or
slightly blurrier depending on the device pixel ratio.

### No Headless Video Export (Yet)

`ThreeScene` requires an `HTMLCanvasElement` — it cannot run in Node.js without
a virtual DOM. Headless frame export (via `canvas` / node-canvas, libcairo, +
fluent-ffmpeg) is the job of the default Cairo backend, not three.js. An
`OffscreenCanvas` path for Web Workers is planned but not yet implemented.

### MathJax vs pdflatex/dvisvgm

Python Manim shells out to `pdflatex` and `dvisvgm` to convert TeX to SVG,
which supports the full LaTeX package ecosystem. `MathTexBrowser` uses MathJax
with the `base` and `ams` packages only. Packages like `tikz`, `pgfplots`, or
custom `.sty` files are not available. For most mathematical notation this is
sufficient; for layout-heavy custom macros it may not be.

### Font Resolution

`GlyphText` resolves fonts from the local filesystem (TTF/OTF). In a browser
context without filesystem access, pass the font as an `ArrayBuffer` or a
URL that your bundler resolves. The default fallback chain tries Calibri, Arial,
and DejaVu Sans.

---

## New Dependencies

Three packages were added to support this migration:

| Package | Version | Role |
|---|---|---|
| `three` | ^0.169.0 | WebGL2 scene graph, renderer, camera, materials |
| `mathjax-full` | ^3.2.2 | TeX to SVG conversion (headless, no DOM) |
| `opentype.js` | ^1.3.4 | TTF/OTF glyph path extraction for text mobjects |

Type definitions are provided by `@types/three` and `@types/opentype.js`
(both already in `devDependencies`). `mathjax-full` ships its own types.

Install (if setting up a fresh clone):

```bash
npm install
```

All three packages are listed in `dependencies` in `package.json` and are
installed by the standard `npm install` step — no separate install required.
