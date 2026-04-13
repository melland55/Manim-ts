/**
 * Ease-of-access CLI option definitions for the render command.
 *
 * TypeScript port of manim/cli/render/ease_of_access_options.py.
 */

/**
 * Options that improve ease of access when running the render command.
 */
export interface EaseOfAccessOptions {
  /**
   * Display/control progress bars.
   * Valid values: "display" | "leave" | "none"
   */
  progressBar?: "display" | "leave" | "none" | null;

  /**
   * Preview the Scene's animation after rendering.
   * OpenGL shows a live popup window; Cairo opens the rendered file in the
   * system default media player.
   */
  preview?: boolean | null;

  /**
   * Show the output file in the file browser after rendering.
   */
  showInFileBrowser?: boolean | null;

  /**
   * Enable Jupyter notebook magic integration.
   */
  jupyter?: boolean | null;
}

/**
 * Metadata describing each ease-of-access option for CLI help text.
 */
export const EASE_OF_ACCESS_OPTION_DEFS = [
  {
    flags: ["--progress_bar"],
    choices: ["display", "leave", "none"] as const,
    caseSensitive: false,
    help: "Display progress bars and/or keep them displayed.",
  },
  {
    flags: ["-p", "--preview"],
    isFlag: true,
    help:
      "Preview the Scene's animation. OpenGL does a live preview in a " +
      "popup window. Cairo opens the rendered video file in the system " +
      "default media player.",
  },
  {
    flags: ["-f", "--show_in_file_browser"],
    isFlag: true,
    help: "Show the output file in the file browser.",
  },
  {
    flags: ["--jupyter"],
    isFlag: true,
    help: "Using jupyter notebook magic.",
  },
] as const;
