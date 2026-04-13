/**
 * Barrel export for cli/cfg.
 *
 * Mirrors manim/cli/cfg/__init__.py public surface:
 *   valueFromString, isValidStyle, replaceKeys,
 *   cfg, cfgWrite, cfgShow, cfgExport
 */

export {
  // Constants
  RICH_COLOUR_INSTRUCTIONS,
  RICH_NON_STYLE_ENTRIES,
  // Helpers
  valueFromString,
  isValidStyle,
  replaceKeys,
  // CLI group + subcommands
  cfg,
  cfgWrite,
  cfgShow,
  cfgExport,
} from "./group.js";

export type { CfgOptions, WriteOptions, ExportOptions } from "./group.js";
