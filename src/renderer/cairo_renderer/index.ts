/**
 * Public API barrel for renderer/cairo_renderer.
 *
 * Python equivalent: manim/renderer/cairo_renderer.py — __all__ = ["CairoRenderer"]
 */

export { CairoRenderer } from "./cairo_renderer.js";

export type {
  CairoRendererOptions,
  ICairoCamera,
  ICairoScene,
} from "./cairo_renderer.js";
