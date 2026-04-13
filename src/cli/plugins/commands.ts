/**
 * Manim's plugin subcommand.
 *
 * Mirrors manim/cli/plugins/commands.py — provides the `plugins` command
 * that manages Manim plugins from the command line.
 */

import { EPILOG } from "../../constants/index.js";
import { listPlugins } from "../../plugins/plugins_flags/index.js";

export { EPILOG };

export interface PluginsOptions {
  /** When true, print a list of all available plugins. */
  listAvailable: boolean;
}

/**
 * Manages Manim plugins.
 *
 * When `listAvailable` is true (i.e. `-l` / `--list` was passed), prints all
 * registered plugins to the console.
 *
 * @param options - Command options.
 */
export function plugins(options: PluginsOptions): void {
  if (options.listAvailable) {
    listPlugins();
  }
}
