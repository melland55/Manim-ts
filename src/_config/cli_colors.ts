/**
 * CLI color/context settings for manim-ts.
 * Mirrors manim/_config/cli_colors.py — parses CLI context settings
 * such as theme, color mode, and terminal detection.
 */

// ─── CLI context settings ─────────────────────────────────────

export interface CliCtxSettings {
  /** Whether the terminal supports ANSI color codes. */
  noColor: boolean;
  /** Whether to force color output regardless of terminal detection. */
  forceColor: boolean;
  /** Whether output is going to a terminal (vs piped). */
  isTTY: boolean;
}

const DEFAULT_CLI_CTX: CliCtxSettings = {
  noColor: false,
  forceColor: false,
  isTTY: process.stdout.isTTY ?? false,
};

/**
 * Parse CLI context settings from the [CLI_CTX] section of the config parser.
 * Mirrors Python's parse_cli_ctx().
 */
export function parseCliCtx(
  cliCtxSection: Record<string, string> = {}
): CliCtxSettings {
  return {
    noColor: cliCtxSection["no_color"]?.toLowerCase() === "true"
      || process.env["NO_COLOR"] !== undefined,
    forceColor: cliCtxSection["force_color"]?.toLowerCase() === "true"
      || process.env["FORCE_COLOR"] !== undefined,
    isTTY: process.stdout.isTTY ?? false,
  };
}
