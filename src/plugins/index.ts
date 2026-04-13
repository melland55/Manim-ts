/**
 * Manim-ts plugin system.
 * Mirrors manim/plugins/__init__.py — re-exports plugin utilities and warns
 * about any plugins listed in config that are not registered.
 */

import { config, logger } from "../_config/index.js";
import { getPlugins, listPlugins } from "./plugins_flags/index.js";

export { getPlugins, listPlugins };
export type { PluginEntryPoint } from "./plugins_flags/index.js";
export { registerPlugin } from "./plugins_flags/index.js";

export const __all__ = ["getPlugins", "listPlugins"];

// ─── Missing-plugin check (mirrors __init__.py module-level code) ─────────────

/**
 * Plugin names requested via config.  Python reads `config["plugins"]` as a
 * list; ManimConfig does not expose a `plugins` field, so we default to an
 * empty set (no plugins requested unless explicitly registered at runtime).
 */
const requestedPlugins: Set<string> = new Set<string>();

const missingPlugins = new Set(
  [...requestedPlugins].filter((p) => !getPlugins().has(p)),
);

if (missingPlugins.size > 0) {
  logger.warning("Missing Plugins: %s", [...missingPlugins].join(", "));
}
