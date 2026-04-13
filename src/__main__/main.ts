/**
 * Manim CLI entry point.
 *
 * TypeScript port of manim/__main__.py.
 *
 * Mirrors the Click/Cloup `main` group that routes CLI invocations to the
 * correct subcommand.  Uses the custom {@link DefaultGroup} with `render` as
 * the default subcommand (i.e. `manim myfile.py` ≡ `manim render myfile.py`).
 */

import { VERSION } from "../__init__/index.js";
import { manimConsole } from "../_config/index.js";
import { cfg } from "../cli/cfg/index.js";
import { checkhealth } from "../cli/checkhealth/index.js";
import { DefaultGroup } from "../cli/default_group/index.js";
import type { Command, Context } from "../cli/default_group/index.js";
import { init } from "../cli/init/index.js";
import { plugins } from "../cli/plugins/index.js";
import { render } from "../cli/render/index.js";
import { EPILOG } from "../constants/index.js";

// ─── Splash / version callbacks ───────────────────────────────────────────────

/**
 * Print an initial splash message showing the Manim version.
 *
 * Mirrors Python's `show_splash` Click callback — only prints when `value` is
 * truthy (i.e. the flag was provided on the CLI).
 *
 * @param value - String value provided via the CLI option, or null/undefined.
 */
export function showSplash(value?: string | null): void {
  if (value != null && value !== "") {
    manimConsole.print(`Manim Community v${VERSION}\n`);
  }
}

/**
 * Print the Manim version and exit the process.
 *
 * Mirrors Python's `print_version_and_exit` Click callback — calls
 * {@link showSplash} and then exits when `value` is truthy.
 *
 * @param value - String value provided via the CLI option, or null/undefined.
 */
export function printVersionAndExit(value?: string | null): void {
  showSplash(value);
  if (value != null && value !== "") {
    process.exit(0);
  }
}

// ─── Command group ────────────────────────────────────────────────────────────

const HELP_TEXT = [
  "Animation engine for explanatory math videos.",
  "",
  "See 'manim <command>' to read about a specific subcommand.",
  "",
  "Note: the subcommand 'manim render' is called if no other subcommand",
  "is specified. Run 'manim render --help' if you would like to know what the",
  "'-ql' or '-p' flags do, for example.",
  "",
  EPILOG,
].join("\n");

/**
 * The main CLI {@link DefaultGroup} — mirrors the `@cloup.group` decorated
 * `main` function in Python.
 *
 * Configured with `render` as the default subcommand so that
 * `manim myfile.py` is equivalent to `manim render myfile.py`.
 */
export const mainGroup = new DefaultGroup({
  default: "render",
  defaultIfNoArgs: false,
});

// Register subcommands — mirrors the `main.add_command(...)` calls in Python.
// Cast each strongly-typed command function to the generic callback signature
// required by the Command interface so DefaultGroup can invoke them uniformly.
type AnyCallback = (...args: unknown[]) => unknown;

const checkhealthCmd: Command = { name: "checkhealth", callback: checkhealth as AnyCallback };
const cfgCmd: Command = { name: "cfg", callback: cfg as AnyCallback };
const pluginsCmd: Command = { name: "plugins", callback: plugins as AnyCallback };
const initCmd: Command = { name: "init", callback: init as AnyCallback };
const renderCmd: Command = { name: "render", callback: render as AnyCallback };

mainGroup.addCommand(checkhealthCmd);
mainGroup.addCommand(cfgCmd);
mainGroup.addCommand(pluginsCmd);
mainGroup.addCommand(initCmd);
mainGroup.addCommand(renderCmd);

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parse top-level CLI flags and route to the appropriate subcommand.
 *
 * Mirrors the Python `main()` Click group entry point.  Handles the global
 * `--version` and `--show-splash/--hide-splash` flags, then delegates to the
 * resolved subcommand.
 *
 * @param argv - CLI argument list (defaults to `process.argv.slice(2)`).
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  // ── Parse global flags ────────────────────────────────────────────────────
  let showSplashFlag = true; // mirrors `--show-splash/--hide-splash default=True`
  const filtered: string[] = [];

  for (const arg of argv) {
    if (arg === "--version") {
      // mirrors print_version_and_exit: show splash then exit
      printVersionAndExit("version");
      return; // unreachable — printVersionAndExit calls process.exit(0)
    } else if (arg === "--show-splash") {
      showSplashFlag = true;
    } else if (arg === "--hide-splash") {
      showSplashFlag = false;
    } else if (arg === "--help" || arg === "-h") {
      // no_args_is_help=True equivalent for the group itself
      manimConsole.print(HELP_TEXT);
      manimConsole.print("\nCommands:");
      manimConsole.print("  checkhealth  Check your Manim installation.");
      manimConsole.print("  cfg          Manage configuration files.");
      manimConsole.print("  plugins      Manage Manim plugins.");
      manimConsole.print("  init         Scaffold a new project or scene.");
      manimConsole.print("  render       Render a scene (default).");
      process.exit(0);
    } else {
      filtered.push(arg);
    }
  }

  // ── Show splash ───────────────────────────────────────────────────────────
  if (showSplashFlag) {
    showSplash("show");
  }

  // ── no_args_is_help — exit with help when no subcommand is given ──────────
  if (filtered.length === 0) {
    manimConsole.print(HELP_TEXT);
    process.exit(0);
  }

  // ── Route to subcommand via DefaultGroup ──────────────────────────────────
  const ctx: Context = { meta: {} };
  mainGroup.parseArgs(ctx, filtered);

  const [, cmd, rest] = mainGroup.resolveCommand(ctx, filtered);

  if (cmd === null || cmd.callback === undefined) {
    process.stderr.write(`Error: No such command '${filtered[0]}'.\n`);
    process.exit(2);
  }

  // Invoke the resolved command with the remaining arguments.
  // Each subcommand callback receives the unparsed remaining args as a string
  // array; subcommand implementations parse their own options from this list.
  await (cmd.callback as (...args: unknown[]) => Promise<void>)(rest);
}
