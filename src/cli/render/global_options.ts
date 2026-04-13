/**
 * Global CLI option definitions for the render command.
 *
 * TypeScript port of manim/cli/render/global_options.py.
 */

import { logger } from "../../_config/index.js";

export { logger };

/**
 * Parse a GUI location string into an (x, y) coordinate pair.
 *
 * Accepts formats: "x;y", "x,y", or "x-y".
 * Logs an error and exits the process if the format is invalid.
 *
 * @param value  The raw string to parse, or null/undefined.
 * @returns      `[x, y]` tuple, or `null` if value is absent.
 */
export function validateGuiLocation(
  value: string | null | undefined,
): [number, number] | null {
  if (value == null) return null;

  const parts = value.split(/[;,\-]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !parts.some(isNaN)) {
    return [parts[0], parts[1]];
  }

  logger.error("GUI location option is invalid.");
  process.exit(1);
}

/**
 * Global options shared across all render invocations.
 */
export interface GlobalRenderOptions {
  /** Path to a custom config file. */
  configFile?: string | null;

  /** Use folder paths from the [custom_folders] config section. */
  customFolders?: boolean | null;

  /** Disable the render cache (still generates cache files). */
  disableCaching?: boolean | null;

  /** Remove cached partial movie files. */
  flushCache?: boolean | null;

  /** Path to a custom TeX template file. */
  texTemplate?: string | null;

  /** Verbosity of CLI output. Changes ffmpeg log level unless 5+. */
  verbosity?: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL" | null;

  /** Display warnings for outdated installation. */
  notifyOutdatedVersion?: boolean | null;

  /** Enable GUI interaction. */
  enableGui?: boolean | null;

  /**
   * Starting location for the GUI window.
   * Parsed from strings like "x;y", "x,y", or "x-y".
   */
  guiLocation?: [number, number] | null;

  /** Expand the window to its maximum possible size. */
  fullscreen?: boolean | null;

  /** Enable wireframe debugging mode in OpenGL. */
  enableWireframe?: boolean | null;

  /**
   * Force window to open when using the OpenGL renderer.
   * Intended for debugging as it may impact performance.
   */
  forceWindow?: boolean | null;

  /** Render animations without outputting image or video files. */
  dryRun?: boolean | null;

  /** Prevent deletion of .aux, .dvi, and .log files from TeX/MathTex. */
  noLatexCleanup?: boolean | null;

  /** Command used to preview the output file (e.g. "vlc" for videos). */
  previewCommand?: string | null;

  /** Random seed for reproducible animations. */
  seed?: number | null;
}

/**
 * Metadata describing each global option for CLI help text.
 */
export const GLOBAL_OPTION_DEFS = [
  {
    flags: ["-c", "--config_file"],
    help: "Specify the configuration file to use for render settings.",
  },
  {
    flags: ["--custom_folders"],
    isFlag: true,
    help:
      "Use the folders defined in the [custom_folders] section of the " +
      "config file to define the output folder structure.",
  },
  {
    flags: ["--disable_caching"],
    isFlag: true,
    help: "Disable the use of the cache (still generates cache files).",
  },
  {
    flags: ["--flush_cache"],
    isFlag: true,
    help: "Remove cached partial movie files.",
  },
  {
    flags: ["--tex_template"],
    help: "Specify a custom TeX template file.",
  },
  {
    flags: ["-v", "--verbosity"],
    choices: ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const,
    caseSensitive: false,
    help: "Verbosity of CLI output. Changes ffmpeg log level unless 5+.",
  },
  {
    flags: ["--notify_outdated_version", "--silent"],
    isFlag: true,
    help: "Display warnings for outdated installation.",
  },
  {
    flags: ["--enable_gui"],
    isFlag: true,
    help: "Enable GUI interaction.",
  },
  {
    flags: ["--gui_location"],
    callback: "validateGuiLocation",
    help: "Starting location for the GUI.",
  },
  {
    flags: ["--fullscreen"],
    isFlag: true,
    help: "Expand the window to its maximum possible size.",
  },
  {
    flags: ["--enable_wireframe"],
    isFlag: true,
    help: "Enable wireframe debugging mode in opengl.",
  },
  {
    flags: ["--force_window"],
    isFlag: true,
    help: "Force window to open when using the opengl renderer, intended for debugging as it may impact performance",
  },
  {
    flags: ["--dry_run"],
    isFlag: true,
    help: "Renders animations without outputting image or video files and disables the window",
  },
  {
    flags: ["--no_latex_cleanup"],
    isFlag: true,
    help: "Prevents deletion of .aux, .dvi, and .log files produced by Tex and MathTex.",
  },
  {
    flags: ["--preview_command"],
    help: "The command used to preview the output file (for example vlc for video files)",
  },
  {
    flags: ["--seed"],
    type: "int",
    help: "Set the random seed to allow reproducibility.",
  },
] as const;
