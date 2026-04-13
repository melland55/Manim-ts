/**
 * Output CLI option definitions for the render command.
 *
 * TypeScript port of manim/cli/render/output_options.py.
 */

/**
 * Options controlling where and how render output is written.
 */
export interface OutputOptions {
  /** Specify the filename(s) of the rendered scene(s). */
  outputFile?: string | null;

  /**
   * Zero-padding width for PNG file names.
   * Valid range: 0–9.
   */
  zeroPad?: number | null;

  /** Write the video rendered with OpenGL to a file. */
  writeToMovie?: boolean | null;

  /** Path to store rendered videos and LaTeX files. */
  mediaDir?: string | null;

  /** Path to store render logs. */
  logDir?: string | null;

  /** Log terminal output to file. */
  logToFile?: boolean | null;
}

/**
 * Metadata describing each output option for CLI help text.
 */
export const OUTPUT_OPTION_DEFS = [
  {
    flags: ["-o", "--output_file"],
    type: "string",
    help: "Specify the filename(s) of the rendered scene(s).",
  },
  {
    flags: ["-0", "--zero_pad"],
    type: "intRange",
    min: 0,
    max: 9,
    help: "Zero padding for PNG file names.",
  },
  {
    flags: ["--write_to_movie"],
    isFlag: true,
    help: "Write the video rendered with opengl to a file.",
  },
  {
    flags: ["--media_dir"],
    type: "path",
    help: "Path to store rendered videos and latex.",
  },
  {
    flags: ["--log_dir"],
    type: "path",
    help: "Path to store render logs.",
  },
  {
    flags: ["--log_to_file"],
    isFlag: true,
    help: "Log terminal output to file.",
  },
] as const;
