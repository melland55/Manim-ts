/**
 * ipython_magic — Utilities for using Manim with IPython (Jupyter notebooks).
 *
 * TypeScript port of manim/utils/ipython_magic.py.
 *
 * Key differences from Python:
 * - IPython decorators (@magics_class, @line_cell_magic, @needs_local_scope)
 *   have no runtime equivalent; the class is plain TypeScript.
 * - `exec(cell, local_ns)` cannot be replicated; callers must pre-register
 *   scene classes in `localNs` before calling `manim()`.
 * - Display (Image / Video) output returns a {@link ManimDisplayResult} record
 *   rather than calling `IPython.display.display()` directly — callers handle
 *   the actual display step.
 * - `get_ipython()` detection for Google Colab auto-embed is replaced with an
 *   explicit `isColab` option on the class.
 */

import * as fs from "fs";
import * as path from "path";

import { config, logger, tempconfig } from "../../_config/index.js";
import { main } from "../../__main__/index.js";
import { shaderProgramCache } from "../../renderer/shader/index.js";
import { RendererType } from "../../constants/index.js";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Minimal stub for an IPython InteractiveShell, used as the constructor param. */
export interface IInteractiveShell {
  /** The shell's user namespace (like Python's `ip.user_ns`). */
  userNs?: Record<string, unknown>;
}

/** Result record returned from {@link ManimMagic.manim} after a successful render. */
export interface ManimDisplayResult {
  /** Absolute path to the rendered output file. */
  outputFile: string;
  /** Temporary copy kept in `<media_dir>/jupyter/`. */
  tmpFile: string;
  /** MIME type of the output (e.g. `"video/mp4"` or `"image/png"`). */
  mimeType: string;
  /** Whether the content should be embedded (base64). */
  embed: boolean;
}

// ─── ManimMagic ───────────────────────────────────────────────────────────────

/**
 * Programmatic equivalent of the Python `ManimMagic` IPython magic class.
 *
 * Usage mirrors Python's `%%manim` cell magic:
 *
 * ```typescript
 * const magic = new ManimMagic();
 *
 * // Register the scene class in the namespace, then run:
 * const result = await magic.manim("-qm MyScene", undefined, { MyScene });
 * ```
 *
 * Python: `manim.utils.ipython_magic.ManimMagic`
 */
export class ManimMagic {
  /** Shell reference (informational only — not used at runtime). */
  readonly shell: IInteractiveShell | null;

  /**
   * Map from canonical output path → temporary jupyter copy.
   * Mirrors Python's `self.rendered_files: dict[Path, Path]`.
   */
  readonly renderedFiles: Map<string, string> = new Map();

  /**
   * When `true`, videos are embedded even if `config.mediaEmbed` is `false`.
   * Set automatically when running inside Google Colab (Python detects this
   * via `get_ipython()`; here callers must pass it explicitly).
   */
  isColab: boolean;

  constructor(shell: IInteractiveShell | null = null, isColab = false) {
    this.shell = shell;
    this.isColab = isColab;
  }

  /**
   * Render a Manim scene from an IPython cell.
   *
   * Mirrors Python's `ManimMagic.manim()` line/cell magic.
   *
   * @param line    - CLI arguments string, e.g. `"-qm MyScene"`.
   * @param cell    - Optional cell body (TypeScript source is ignored; scene
   *                  classes must be pre-registered in `localNs`).
   * @param localNs - Namespace map that must contain the target scene class
   *                  keyed by name (e.g. `{ MyScene: class MyScene ... }`).
   * @returns A {@link ManimDisplayResult} when a file is produced, or `null`
   *          when the invocation only prints help/version text.
   */
  async manim(
    line: string,
    cell?: string,
    localNs?: Record<string, unknown>,
  ): Promise<ManimDisplayResult | null> {
    // In Python, `exec(cell, local_ns)` runs the cell source to define classes.
    // In TypeScript we cannot eval source; callers pre-register scene classes.
    if (cell) {
      logger.debug(
        "ManimMagic: cell body is not evaluated in TypeScript — " +
          "register scene classes in localNs before calling manim().",
      );
    }

    const args = line.trim().split(/\s+/).filter(Boolean);

    // Help / version flags — delegate to main() and return without rendering.
    if (
      args.length === 0 ||
      args.includes("-h") ||
      args.includes("--help") ||
      args.includes("--version")
    ) {
      await main(args);
      return null;
    }

    const modifiedArgs = this.addAdditionalArgs(args);
    await main(modifiedArgs);

    const ns = localNs ?? {};
    const overrides = (ns["config"] ?? {}) as Record<string, unknown>;

    return tempconfig(overrides as never, async () => {
      config.digestArgs({ jupyter: true });

      let renderer = null;
      if (config.renderer === RendererType.OPENGL) {
        // TODO: Port OpenGL renderer instantiation — needs manual implementation
        logger.warning(
          "ManimMagic: OpenGL renderer is not yet supported in manim-ts.",
        );
      }

      try {
        const sceneClassName = config.sceneNames[0];
        if (!sceneClassName) {
          logger.info("No scene name specified.");
          return null;
        }

        const SceneClass = ns[sceneClassName] as
          | (new (opts?: { renderer: unknown }) => { render(): void | Promise<void> })
          | undefined;

        if (!SceneClass) {
          logger.warning(
            `ManimMagic: Scene class "${sceneClassName}" not found in localNs.`,
          );
          return null;
        }

        const scene = new SceneClass({ renderer });
        await scene.render();
      } finally {
        // Shader cache becomes invalid when the GL context is destroyed.
        shaderProgramCache.clear();

        // renderer?.window?.close() — no-op until OpenGL renderer is ported.
        if (renderer !== null) {
          logger.debug("ManimMagic: renderer cleanup skipped (not yet ported).");
        }
      }

      if (!config.outputFile) {
        logger.info("No output file produced");
        return null;
      }

      const localPath = config.outputFile;
      const suffix = path.extname(localPath);
      const tmpFile = path.join(
        config.mediaDir,
        "jupyter",
        `${_generateFileName()}${suffix}`,
      );

      // Clean up previous tmp copy for this output path.
      const prev = this.renderedFiles.get(localPath);
      if (prev) {
        try {
          fs.unlinkSync(prev);
        } catch {
          // Ignore — file may have been removed already.
        }
      }
      this.renderedFiles.set(localPath, tmpFile);

      fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
      fs.copyFileSync(localPath, tmpFile);

      // Determine MIME type (mirrors Python's mimetypes.guess_type).
      const mimeType = guessMimeType(localPath);

      // Embed when explicitly configured, or when running in Colab.
      const embed = config.mediaEmbed ?? this.isColab;

      return {
        outputFile: localPath,
        tmpFile,
        mimeType,
        embed,
      };
    });
  }

  /**
   * Prepend `--jupyter` and (optionally) `--format webm` to the arg list.
   *
   * Mirrors Python's `ManimMagic.add_additional_args()`.
   *
   * @param args - Raw CLI argument list (last element is the scene name).
   * @returns Modified argument list with extra flags injected.
   */
  addAdditionalArgs(args: string[]): string[] {
    const additional: string[] = ["--jupyter"];

    // Use webm to support transparency when `-t` (transparent) is set.
    if (args.includes("-t") && !args.includes("--format")) {
      additional.push("--format", "webm");
    }

    // Re-assemble: [additional..., ...args except last, "", last]
    // The empty string mirrors Python's `args[:-1] + [""] + [args[-1]]`
    // which inserts a blank positional between the flags and scene name.
    const sceneName = args[args.length - 1];
    const flagArgs = args.slice(0, -1);
    return [...additional, ...flagArgs, "", sceneName];
  }
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

/**
 * Generate a timestamped filename for jupyter output copies.
 *
 * Mirrors Python's `_generate_file_name()`.
 *
 * @returns `"SceneName@YYYY-MM-DD@HH-MM-SS"`
 */
export function _generateFileName(): string {
  const sceneName = config.sceneNames[0] ?? "scene";
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-") +
    "@" +
    [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("-");
  return `${sceneName}@${stamp}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Very small MIME-type lookup (avoids a Node.js `mime` dependency).
 * Covers the file types Manim produces.
 */
function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".gif": "image/gif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}
