/**
 * Public API barrel for cli/render.
 * TypeScript port of manim/cli/render/__init__.py.
 */

export { ClickArgs, render, EPILOG } from "./commands.js";
export type { RenderKwargs } from "./commands.js";

export type { EaseOfAccessOptions } from "./ease_of_access_options.js";
export { EASE_OF_ACCESS_OPTION_DEFS } from "./ease_of_access_options.js";

export { validateGuiLocation } from "./global_options.js";
export type { GlobalRenderOptions } from "./global_options.js";
export { GLOBAL_OPTION_DEFS } from "./global_options.js";

export type { OutputOptions } from "./output_options.js";
export { OUTPUT_OPTION_DEFS } from "./output_options.js";

export { validateSceneRange, validateResolution, QUALITY_FLAGS, QUALITY_DESCRIPTIONS, RENDERER_TYPES } from "./render_options.js";
export type { RenderOptions } from "./render_options.js";
export { RENDER_OPTION_DEFS } from "./render_options.js";
