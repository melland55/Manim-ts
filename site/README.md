# manim-ts gallery

A side-by-side example gallery for **manim-ts**, modeled after the official
[Manim Community example gallery](https://docs.manim.community/en/stable/examples.html).
Each entry shows our TypeScript port on the left and the original Python
rendering (hot-linked from docs.manim.community) on the right.

The site is a standalone Vite + React app, intentionally separate from the
existing Docusaurus docs (`/docs`) — that one is preserved as-is.

## Develop

```bash
cd site
npm install
npm run dev    # http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

The build output goes to `site/dist/`. The Vite `base` defaults to
`/Manim-ts/` so the site works under `https://<user>.github.io/Manim-ts/`.
Override with `VITE_BASE=/ npm run build` for root-domain hosting.

## Adding examples

Each section has its own file under `src/examples/`. Add an entry of type
[`ExampleDef`](src/examples/registry.ts):

```ts
{
  id: "MyExample",                              // anchor + key
  className: "MyExample",                       // shown in the header
  description: "One-line summary.",
  referenceVideo: "https://docs.manim.community/en/stable/_videos/examples/MyExample-1.mp4",
  pythonSource: `class MyExample(Scene): ...`,  // verbatim from manim docs
  manimTsSource: `class MyExample extends Scene { ... }`,
  // Optional: live render. The component renders its own canvas + drives
  // the Scene lifecycle (start on mount, dispose on unmount).
  live: MyExampleLive,
  // Optional fallback when no live component exists yet:
  fallbackAsset: "/fallbacks/MyExample.mp4",
}
```

Live components live alongside the registry entry and import the engine
directly via relative paths, e.g.
`import { Circle } from "../../../src/mobject/geometry/index.js"`.

## Status

- ✅ Basic Concepts — 5 examples (Python source populated, TS sketches in place, no live yet)
- ⏳ Animations / Plotting / Special Camera / Advanced — section shells only

## Not affiliated with 3Blue1Brown or the Manim Community

Reference videos are hot-linked from the official Manim Community docs for
educational comparison. All Python source shown is verbatim from the public
Manim Community examples gallery (BSD-3 licensed).
