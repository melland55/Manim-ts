/**
 * Public API barrel for renderer/cairo_renderer.
 *
 * Python equivalent: manim/renderer/cairo_renderer.py — __all__ = ["CairoRenderer"]
 *
 * @deprecated `CairoRenderer` is superseded by `ThreeRenderer` in
 * `src/renderer/three/`. Prefer `ThreeScene` for all new work. This module
 * remains available for server-side video export paths that still depend on
 * `@napi-rs/canvas`.
 */

export { CairoRenderer } from "./cairo_renderer.js";

export type {
  CairoRendererOptions,
  ICairoCamera,
  ICairoScene,
} from "./cairo_renderer.js";
