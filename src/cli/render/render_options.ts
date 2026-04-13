/**
 * Render-specific CLI option definitions for the render command.
 *
 * TypeScript port of manim/cli/render/render_options.py.
 */

import { logger } from "../../_config/index.js";
import { QUALITIES, RendererType } from "../../constants/index.js";

export { logger };

/**
 * Parse a scene range string into a tuple of one or two integers.
 *
 * Accepts formats: "start", "start;end", "start,end", or "start-end".
 * Logs an error and exits if the format is invalid.
 *
 * @param value  The raw string to parse, or null/undefined.
 * @returns      `[start]` or `[start, end]` tuple, or `null` if absent.
 */
export function validateSceneRange(
  value: string | null | undefined,
): [number] | [number, number] | null {
  if (value == null) return null;

  // Single integer
  const single = parseInt(value, 10);
  if (!isNaN(single) && String(single) === value.trim()) {
    return [single];
  }

  // Two integers separated by ;, , or -
  const parts = value.split(/[;,\-]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !parts.some(isNaN)) {
    return [parts[0], parts[1]];
  }

  logger.error("Couldn't determine a range for -n option.");
  process.exit(1);
}

/**
 * Parse a resolution string into a (width, height) tuple.
 *
 * Accepts formats: "W;H", "W,H", or "W-H".
 * Logs an error and exits if the format is invalid.
 *
 * @param value  The raw string to parse, or null/undefined.
 * @returns      `[width, height]` tuple, or `null` if absent.
 */
export function validateResolution(
  value: string | null | undefined,
): [number, number] | null {
  if (value == null) return null;

  const parts = value.split(/[;,\-]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !parts.some(isNaN)) {
    return [parts[0], parts[1]];
  }

  logger.error("Resolution option is invalid.");
  process.exit(1);
}

// ─── Quality flag list (built from QUALITIES) ─────────────────────────────────

/** All quality flags from QUALITIES (excluding null flags), reversed for display. */
export const QUALITY_FLAGS: string[] = Object.values(QUALITIES)
  .filter((q) => q.flag !== null)
  .map((q) => q.flag as string)
  .reverse();

/** Human-readable quality descriptions, reversed for display. */
export const QUALITY_DESCRIPTIONS: string[] = Object.values(QUALITIES)
  .filter((q) => q.flag !== null)
  .map((q) => `${q.pixelWidth}x${q.pixelHeight} ${q.frameRate}FPS`)
  .reverse();

/** All renderer type values for the --renderer option. */
export const RENDERER_TYPES: string[] = Object.values(RendererType);

/**
 * Options controlling how scenes are rendered.
 */
export interface RenderOptions {
  /**
   * Start rendering from animation n_0 until n_1.
   * If n_1 is omitted, renders all animations after n_0.
   */
  fromAnimationNumber?: [number] | [number, number] | null;

  /** Render all scenes in the input file. */
  writeAll?: boolean | null;

  /**
   * Output format.
   * Valid values: "png" | "gif" | "mp4" | "webm" | "mov"
   */
  format?: "png" | "gif" | "mp4" | "webm" | "mov" | null;

  /** Render and save only the last frame of a scene as a PNG image. */
  saveLastFrame?: boolean | null;

  /** Render quality preset. */
  quality?: string | null;

  /**
   * Resolution in "W,H" for when 16:9 aspect ratio isn't possible.
   * Parsed from strings like "W;H", "W,H", or "W-H".
   */
  resolution?: [number, number] | null;

  /** Render at this frame rate. */
  frameRate?: number | null;

  /** Select a renderer for your Scene. */
  renderer?: string | null;

  /** @deprecated Use format="png" instead. Save each frame as png. */
  savePngs?: boolean | null;

  /** @deprecated Use format="gif" instead. Save as a gif. */
  saveAsGif?: boolean | null;

  /** Save section videos in addition to the movie file. */
  saveSections?: boolean | null;

  /** Render scenes with alpha channel. */
  transparent?: boolean | null;

  /**
   * Use shaders for OpenGLVMobject fill compatible with transformation
   * matrices.
   */
  useProjectionFillShaders?: boolean | null;

  /**
   * Use shaders for OpenGLVMobject stroke compatible with transformation
   * matrices.
   */
  useProjectionStrokeShaders?: boolean | null;
}

/**
 * Metadata describing each render option for CLI help text.
 */
export const RENDER_OPTION_DEFS = [
  {
    flags: ["-n", "--from_animation_number"],
    callback: "validateSceneRange",
    help:
      "Start rendering from n_0 until n_1. If n_1 is left unspecified, " +
      "renders all scenes after n_0.",
  },
  {
    flags: ["-a", "--write_all"],
    isFlag: true,
    help: "Render all scenes in the input file.",
  },
  {
    flags: ["--format"],
    choices: ["png", "gif", "mp4", "webm", "mov"] as const,
    caseSensitive: false,
  },
  {
    flags: ["-s", "--save_last_frame"],
    isFlag: true,
    help: "Render and save only the last frame of a scene as a PNG image.",
  },
  {
    flags: ["-q", "--quality"],
    choices: QUALITY_FLAGS,
    caseSensitive: false,
    help:
      "Render quality at the follow resolution framerates, respectively: " +
      QUALITY_DESCRIPTIONS.join(", "),
  },
  {
    flags: ["-r", "--resolution"],
    callback: "validateResolution",
    help: 'Resolution in "W,H" for when 16:9 aspect ratio isn\'t possible.',
  },
  {
    flags: ["--fps", "--frame_rate"],
    dest: "frame_rate",
    type: "float",
    help: "Render at this frame rate.",
  },
  {
    flags: ["--renderer"],
    choices: RENDERER_TYPES,
    caseSensitive: false,
    default: "cairo",
    help: "Select a renderer for your Scene.",
  },
  {
    flags: ["-g", "--save_pngs"],
    isFlag: true,
    help: "Save each frame as png (Deprecated).",
  },
  {
    flags: ["-i", "--save_as_gif"],
    isFlag: true,
    help: "Save as a gif (Deprecated).",
  },
  {
    flags: ["--save_sections"],
    isFlag: true,
    help: "Save section videos in addition to movie file.",
  },
  {
    flags: ["-t", "--transparent"],
    isFlag: true,
    help: "Render scenes with alpha channel.",
  },
  {
    flags: ["--use_projection_fill_shaders"],
    isFlag: true,
    help: "Use shaders for OpenGLVMobject fill which are compatible with transformation matrices.",
  },
  {
    flags: ["--use_projection_stroke_shaders"],
    isFlag: true,
    help: "Use shaders for OpenGLVMobject stroke which are compatible with transformation matrices.",
  },
] as const;
