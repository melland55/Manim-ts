/**
 * The Manim CLI and the available commands for `manim`.
 *
 * Run `manim --help` in your terminal to find more information on the
 * following commands.
 *
 * Available commands:
 *   cfg         — Manage Manim configuration files.
 *   checkhealth — Check that Manim and its dependencies are correctly installed.
 *   init        — Initialise a new Manim project.
 *   plugins     — Manage Manim plugins.
 *   render      — Render SCENE(S) from the input FILE (default command).
 */

// ─── Command names ───────────────────────────────────────────────────────────

/**
 * Names of the top-level CLI commands registered with the `manim` entry point.
 * Mirrors the `__all__`-equivalent surface of Manim's `cli` package.
 */
export const CLI_COMMANDS = ["cfg", "checkhealth", "init", "plugins", "render"] as const;

/** Union type of all valid top-level CLI command names. */
export type CliCommandName = (typeof CLI_COMMANDS)[number];

// ─── Shared CLI option types ─────────────────────────────────────────────────

/** Options common to all CLI commands. */
export interface GlobalCliOptions {
  /** Path to a custom config file. */
  configFile?: string;
  /** Custom media output directory. */
  mediaDir?: string;
  /** Suppress all output except errors. */
  quiet?: boolean;
  /** Print verbose logging. */
  verbose?: boolean;
}
