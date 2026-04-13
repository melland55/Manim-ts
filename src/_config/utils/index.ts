/**
 * Barrel export for _config/utils module.
 * TypeScript port of manim/_config/utils.py.
 *
 * Re-exports from the flat implementation file at src/_config/utils.ts.
 */

export {
  ManimConfig,
  ManimFrame,
  QUALITY_PRESETS,
  configFilePaths,
  makeConfigParser,
  _determineQuality,
} from "../utils.js";

export type { ConfigParser } from "../utils.js";
