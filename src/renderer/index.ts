/**
 * renderer — Canvas2D rendering back-end for manim-ts.
 *
 * Replaces Python Manim's Cairo and OpenGL renderers.
 * Use @napi-rs/canvas in Node.js; HTMLCanvasElement in the browser.
 *
 * @deprecated The Canvas2D renderer exported from this barrel is superseded by
 * `ThreeRenderer` in `src/renderer/three/`. Prefer `ThreeScene` for all new
 * work. This module remains available for server-side video export paths that
 * still depend on `@napi-rs/canvas`.
 */

export { Renderer } from "./renderer.js";
export type { SceneBackend } from "./scene_backend.js";
export { CairoBackend } from "./cairo/index.js";
export type { CairoBackendOptions } from "./cairo/index.js";
