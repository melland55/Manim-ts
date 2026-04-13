/**
 * Parses CLI context settings from a configuration section and returns a
 * CliContextSettings object mirroring Manim's cloup-based CLI formatting.
 *
 * This module reads configuration values for help formatting, theme styles,
 * and alignment options used when rendering command-line interfaces in Manim.
 */

/** Terminal style string (ANSI escape codes or named style). */
export type Style = string;

/** The set of keys recognized as theme style entries in a config section. */
export const THEME_KEYS = new Set<string>([
  "command_help",
  "invoked_command",
  "heading",
  "constraint",
  "section_help",
  "col1",
  "col2",
  "epilog",
]);

/** Per-element style overrides for the help output theme. */
export interface HelpThemeSettings {
  command_help?: Style;
  invoked_command?: Style;
  heading?: Style;
  constraint?: Style;
  section_help?: Style;
  col1?: Style;
  col2?: Style;
  epilog?: Style;
}

/** Known built-in theme presets (mirrors cloup's HelpTheme.dark / .light). */
export type ThemePreset = "dark" | "light";

/** Settings passed to HelpFormatter (mirrors cloup's HelpFormatter.settings()). */
export interface FormatterConfig {
  indent_increment: number;
  width: number;
  col1_max_width: number;
  col2_min_width: number;
  col_spacing: number;
  row_sep: string | null;
  theme: HelpThemeSettings;
  theme_preset: ThemePreset | null;
}

/** Top-level CLI context settings (mirrors cloup's Context.settings()). */
export interface CliContextSettings {
  align_option_groups: boolean;
  align_sections: boolean;
  show_constraints: boolean;
  formatter_settings: FormatterConfig;
}

/**
 * Parses a flat configuration section (key → string) and returns a
 * {@link CliContextSettings} object suitable for initialising a Manim CLI.
 *
 * Mirrors `_config/cli_colors.py::parse_cli_ctx`.
 *
 * @param parser - A flat `Record<string, string>` representing one section of
 *   a parsed INI-style configuration file (equivalent to a Python
 *   `configparser.SectionProxy`).
 */
export function parseCliCtx(parser: Record<string, string>): CliContextSettings {
  const formatterSettings: Omit<FormatterConfig, "theme" | "theme_preset"> = {
    indent_increment: parseInt(parser["indent_increment"], 10),
    width: parseInt(parser["width"], 10),
    col1_max_width: parseInt(parser["col1_max_width"], 10),
    col2_min_width: parseInt(parser["col2_min_width"], 10),
    col_spacing: parseInt(parser["col_spacing"], 10),
    row_sep: parser["row_sep"] ? parser["row_sep"] : null,
  };

  const themeSettings: HelpThemeSettings = {};
  for (const [k, v] of Object.entries(parser)) {
    if (THEME_KEYS.has(k) && v) {
      (themeSettings as Record<string, Style>)[k] = v as Style;
    }
  }

  const themeValue = parser["theme"] ? parser["theme"] : null;
  let themePreset: ThemePreset | null = null;
  if (themeValue !== null) {
    const lower = themeValue.toLowerCase();
    if (lower === "dark" || lower === "light") {
      themePreset = lower;
    }
  }

  const formatterConfig: FormatterConfig = {
    ...formatterSettings,
    theme: themeSettings,
    theme_preset: themePreset,
  };

  return {
    align_option_groups: parser["align_option_groups"].toLowerCase() === "true",
    align_sections: parser["align_sections"].toLowerCase() === "true",
    show_constraints: true,
    formatter_settings: formatterConfig,
  };
}
