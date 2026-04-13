/**
 * Global manim-ts config, logger, and tempconfig.
 * Mirrors manim/_config/__init__.py — sets up the singleton config object,
 * loggers, and the tempconfig helper for temporarily overriding config values.
 */

import type { ManimConfig as IManimConfig } from "../core/types.js";
import { parseCliCtx, type CliCtxSettings } from "./cli_colors.js";
import { makeLogger, type ManimLogger, type ManimConsole, type ManimErrorConsole } from "./logger_utils.js";
import { ManimConfig, ManimFrame, makeConfigParser } from "./utils.js";

export type { ManimLogger, ManimConsole, ManimErrorConsole, CliCtxSettings };
export { ManimConfig, ManimFrame };
export { makeConfigParser } from "./utils.js";
export { makeLogger } from "./logger_utils.js";
export { parseCliCtx } from "./cli_colors.js";

// ─── Bootstrap ───────────────────────────────────────────────

const parser = makeConfigParser();

/**
 * Global logger — mirrors Python `manim.logger`.
 * Use `logger.info()`, `logger.warning()`, `logger.error()` etc.
 */
export let logger: ManimLogger;

/**
 * Rich-style console for standard output — mirrors Python `manim.console`.
 * Use `console.print(...)` instead of `console.log(...)` for Manim output.
 */
export let manimConsole: ManimConsole;

/**
 * Error console — prints to stderr.  Mirrors Python `manim.error_console`.
 */
export let errorConsole: ManimErrorConsole;

[logger, manimConsole, errorConsole] = makeLogger(
  parser["logger"],
  parser["CLI"]["verbosity"],
);

/**
 * CLI context settings — mirrors Python `manim.cli_ctx_settings`.
 * Controls terminal color capabilities.
 */
export const cliCtxSettings: CliCtxSettings = parseCliCtx(parser["CLI_CTX"]);

/**
 * Global config singleton — mirrors Python `manim.config`.
 *
 * All modules share a reference to this object.  Mutate via `config.update()`
 * or use `tempconfig()` for scoped changes.
 */
export const config: ManimConfig = new ManimConfig().digestParser(parser);

/**
 * Frame dimensions view — mirrors Python `manim.frame`.
 * Read-only derived view of the active config's frame settings.
 */
export const frame: ManimFrame = new ManimFrame(config);

// ─── tempconfig ───────────────────────────────────────────────

/**
 * Temporarily override global config values for the duration of a callback.
 *
 * Mirrors Python's `tempconfig` context manager.  Inside the callback the
 * global `config` object reflects the overridden values; after the callback
 * (or if it throws) the original values are restored.
 *
 * @example
 * ```typescript
 * config.frameHeight; // 8.0
 * await tempconfig({ frameHeight: 100.0 }, async () => {
 *   config.frameHeight; // 100.0
 * });
 * config.frameHeight; // 8.0
 * ```
 */
export async function tempconfig<T>(
  temp: Partial<IManimConfig>,
  callback: () => T | Promise<T>,
): Promise<T> {
  const original = config.copy();

  // Only update keys that are present in the current config
  const currentKeys = new Set<string>(
    config.items().map(([k]) => k as string),
  );
  const filtered: Partial<IManimConfig> = {};
  for (const [k, v] of Object.entries(temp)) {
    if (currentKeys.has(k)) {
      (filtered as Record<string, unknown>)[k] = v;
    }
  }

  config.update(filtered);
  try {
    return await Promise.resolve(callback());
  } finally {
    config.update(original);
  }
}
