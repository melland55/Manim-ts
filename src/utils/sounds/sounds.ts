/**
 * Sound-related utility functions.
 *
 * TypeScript port of Python Manim's manim/utils/sounds.py
 */

import * as nodePath from "path";
import { seekFullPathFromDefaults } from "../file_ops/index.js";

// ─── Public API ───────────────────────────────────────────────

/**
 * Resolves a sound file name to its full path by searching the assets
 * directory and known audio extensions.
 *
 * Mirrors Python: `get_full_sound_file_path(sound_file_name)`
 *
 * @param soundFileName - Bare file name or relative path to a sound asset.
 * @param assetsDir     - Directory to search; defaults to `"assets"`.
 * @returns The resolved absolute path string.
 * @throws Error if the file cannot be found at any candidate location.
 */
export function getFullSoundFilePath(
  soundFileName: string,
  assetsDir = "assets"
): string {
  return seekFullPathFromDefaults(soundFileName, assetsDir, [".wav", ".mp3"]);
}
