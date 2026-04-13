/**
 * Plugin Managing Utility.
 * Mirrors manim/plugins/plugins_flags.py — discovers and lists registered
 * manim-ts plugins via the Node.js package ecosystem.
 *
 * Python's `importlib.metadata.entry_points(group="manim.plugins")` has no
 * direct Node.js equivalent. We emulate the pattern by looking for packages
 * in node_modules that declare a `manim.plugins` entry in their
 * `package.json#manimPlugins` field, or by consulting a registry object
 * exported from the host package's `package.json`.
 *
 * For compatibility with the Python plugin contract, plugins must export a
 * default export or named `plugin` export from their main entry point.
 */

import { manimConsole } from "../../_config/index.js";

// ─── Plugin descriptor ────────────────────────────────────────

/** Mirrors a Python `EntryPoint` object returned by `entry_points()`. */
export interface PluginEntryPoint {
  /** Plugin name (the key used to register the plugin). */
  name: string;
  /** The resolved plugin export (the loaded module value). */
  load(): unknown;
}

// ─── Plugin registry ──────────────────────────────────────────

/**
 * Internal registry of statically-registered plugins.
 * In Python, plugins register via `pyproject.toml` entry points at install
 * time.  In Node.js we use an explicit register-at-runtime pattern instead
 * (since there is no universal entry-points standard across npm packages).
 */
const _registry = new Map<string, () => unknown>();

/**
 * Register a plugin with manim-ts.
 *
 * Call this from your plugin's entry module:
 * ```typescript
 * import { registerPlugin } from "manim-ts/plugins";
 * registerPlugin("my-plugin", () => MyPluginClass);
 * ```
 *
 * @param name - Unique plugin identifier.
 * @param loader - Zero-argument factory that returns the plugin value.
 */
export function registerPlugin(name: string, loader: () => unknown): void {
  _registry.set(name, loader);
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Return a map of all registered plugins, keyed by plugin name.
 * Mirrors Python's `get_plugins()` — values are the loaded plugin exports.
 *
 * In Python this calls `entry_point.load()` for each entry point.
 * Here we call the registered loader function.
 */
export function getPlugins(): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [name, loader] of _registry) {
    result.set(name, loader());
  }
  return result;
}

/**
 * Print all registered plugin names to the manim console.
 * Mirrors Python's `list_plugins()`.
 */
export function listPlugins(): void {
  manimConsole.print("Plugins:");

  const plugins = getPlugins();
  if (plugins.size === 0) {
    manimConsole.print("  (no plugins registered)");
    return;
  }

  for (const pluginName of plugins.keys()) {
    manimConsole.print(` • ${pluginName}`);
  }
}
