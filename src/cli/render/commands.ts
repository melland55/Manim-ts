/**
 * Manim's default subcommand: render.
 *
 * Accessible via `manim` or `manim render`. Accepts options and arguments
 * for the render command, then dispatches to Cairo or OpenGL renderers.
 *
 * TypeScript port of manim/cli/render/commands.py.
 */

import https from "node:https";
import * as nodePath from "node:path";

import { VERSION } from "../../__init__/index.js";
import {
  config,
  manimConsole,
  errorConsole,
  logger,
  tempconfig,
} from "../../_config/index.js";
import { EPILOG, RendererType } from "../../constants/index.js";
import { sceneClassesFromFile } from "../../utils/module_ops/index.js";

import type { EaseOfAccessOptions } from "./ease_of_access_options.js";
import type { GlobalRenderOptions } from "./global_options.js";
import type { OutputOptions } from "./output_options.js";
import type { RenderOptions } from "./render_options.js";

export { EPILOG };

// ─── ClickArgs ───────────────────────────────────────────────────────────────

/**
 * Argument container — mirrors Python's `argparse.Namespace`.
 *
 * Stores the parsed CLI kwargs as a flat key-value record and exposes
 * the same interface that `config.digestArgs()` expects.
 */
export class ClickArgs {
  private readonly _data: Record<string, unknown>;

  constructor(args: Record<string, unknown>) {
    this._data = { ...args };
  }

  /** Read a value by key. */
  get<T = unknown>(key: string): T {
    return this._data[key] as T;
  }

  /** Write a value by key. */
  set(key: string, value: unknown): void {
    this._data[key] = value;
  }

  /** Check if a key is present. */
  has(key: string): boolean {
    return key in this._data;
  }

  /** Return all key-value pairs (mirrors Python's `_get_kwargs()`). */
  _getKwargs(): Array<[string, unknown]> {
    return Object.entries(this._data);
  }

  /** Return the data as a plain record (for `config.digestArgs()`). */
  toRecord(): Record<string, unknown> {
    return { ...this._data };
  }

  /** Equality check (mirrors Python's `__eq__`). */
  equals(other: unknown): boolean {
    if (!(other instanceof ClickArgs)) return false;
    const a = JSON.stringify(this._data);
    const b = JSON.stringify(other._data);
    return a === b;
  }

  /** String representation (mirrors Python's `__repr__`). */
  toString(): string {
    return JSON.stringify(this._data);
  }
}

// ─── Combined kwargs type ────────────────────────────────────────────────────

/**
 * All options accepted by the render command, combining every option group.
 */
export interface RenderKwargs
  extends EaseOfAccessOptions,
    GlobalRenderOptions,
    OutputOptions,
    RenderOptions {
  /** The script file (or config file) to render. */
  file: string;

  /** Optional list of scene class names to render. */
  sceneNames?: string[];
}

// ─── Version check ───────────────────────────────────────────────────────────

/** Fetch the latest manim version from PyPI and warn if outdated. */
async function checkOutdatedVersion(): Promise<void> {
  const manim_info_url = "https://pypi.org/pypi/manim/json";
  const warnPrompt = "Cannot check if latest release of manim is installed";

  return new Promise<void>((resolve) => {
    const req = https.get(manim_info_url, { timeout: 10_000 }, (res) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => {
        raw += chunk.toString();
      });
      res.on("end", () => {
        try {
          const jsonData = JSON.parse(raw) as { info?: { version?: string } };
          const stable = jsonData?.info?.version;
          if (stable && stable !== VERSION) {
            manimConsole.print(
              `You are using manim version v${VERSION}, but version v${stable} is available.`,
            );
            manimConsole.print(
              "You should consider upgrading via: npm install -g manim-ts",
            );
          }
        } catch {
          logger.debug("Error while decoding JSON from %s: %s", manim_info_url, warnPrompt);
        }
        resolve();
      });
    });

    req.on("timeout", () => {
      logger.debug("URL Error: %s", warnPrompt);
      req.destroy();
      resolve();
    });

    req.on("error", (err: Error) => {
      if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
        logger.debug("HTTP Error: %s", warnPrompt);
      } else {
        logger.debug("Something went wrong: %s", warnPrompt);
      }
      resolve();
    });
  });
}

// ─── render command ──────────────────────────────────────────────────────────

/**
 * Render SCENE(S) from the input FILE.
 *
 * FILE is the file path of the script or a config file.
 * SCENES is an optional list of scenes in the file.
 *
 * Mirrors the `@cloup.command` decorated `render` function in Python.
 * Instead of click/cloup decorators, options are passed as a typed record.
 *
 * @param kwargs  All CLI options combined into a single object.
 * @returns       The `ClickArgs` container (when jupyter=true) or the raw
 *                kwargs record after rendering completes.
 */
export async function render(
  kwargs: RenderKwargs,
): Promise<ClickArgs | RenderKwargs> {
  // ── Deprecated flag handling ─────────────────────────────────────────────

  if (kwargs.saveAsGif) {
    logger.warning(
      "--save_as_gif is deprecated, please use --format=gif instead!",
    );
    kwargs = { ...kwargs, format: "gif" };
  }

  if (kwargs.savePngs) {
    logger.warning(
      "--save_pngs is deprecated, please use --format=png instead!",
    );
    kwargs = { ...kwargs, format: "png" };
  }

  if (kwargs.showInFileBrowser) {
    logger.warning(
      "The short form of show_in_file_browser is deprecated and will be moved to support --format.",
    );
  }

  // ── Build ClickArgs ──────────────────────────────────────────────────────

  // Map the typed kwargs to the flat record digestArgs expects.
  const argsRecord: Record<string, unknown> = {
    file: kwargs.file,
    scene_names: kwargs.sceneNames ?? [],
    config_file: kwargs.configFile ?? null,
    custom_folders: kwargs.customFolders ?? null,
    disable_caching: kwargs.disableCaching ?? null,
    flush_cache: kwargs.flushCache ?? null,
    tex_template: kwargs.texTemplate ?? null,
    verbosity: kwargs.verbosity ?? null,
    notifyOutdatedVersion: kwargs.notifyOutdatedVersion ?? null,
    enableGui: kwargs.enableGui ?? null,
    guiLocation: kwargs.guiLocation ?? null,
    fullscreen: kwargs.fullscreen ?? null,
    enableWireframe: kwargs.enableWireframe ?? null,
    forceWindow: kwargs.forceWindow ?? null,
    dryRun: kwargs.dryRun ?? null,
    noLatexCleanup: kwargs.noLatexCleanup ?? null,
    previewCommand: kwargs.previewCommand ?? null,
    seed: kwargs.seed ?? null,
    outputFile: kwargs.outputFile ?? null,
    zeroPad: kwargs.zeroPad ?? null,
    writeToMovie: kwargs.writeToMovie ?? null,
    mediaDir: kwargs.mediaDir ?? null,
    logDir: kwargs.logDir ?? null,
    logToFile: kwargs.logToFile ?? null,
    fromAnimationNumber:
      kwargs.fromAnimationNumber != null
        ? kwargs.fromAnimationNumber[0]
        : null,
    uptoAnimationNumber:
      kwargs.fromAnimationNumber != null && kwargs.fromAnimationNumber.length === 2
        ? kwargs.fromAnimationNumber[1]
        : null,
    writeAll: kwargs.writeAll ?? null,
    format: kwargs.format ?? null,
    saveLastFrame: kwargs.saveLastFrame ?? null,
    quality: kwargs.quality ?? null,
    pixelWidth:
      kwargs.resolution != null ? kwargs.resolution[0] : null,
    pixelHeight:
      kwargs.resolution != null ? kwargs.resolution[1] : null,
    frameRate: kwargs.frameRate ?? null,
    renderer: kwargs.renderer ?? "cairo",
    savePngs: kwargs.savePngs ?? null,
    saveAsGif: kwargs.saveAsGif ?? null,
    saveSections: kwargs.saveSections ?? null,
    transparent: kwargs.transparent ?? null,
    useProjectionFillShaders: kwargs.useProjectionFillShaders ?? null,
    useProjectionStrokeShaders: kwargs.useProjectionStrokeShaders ?? null,
    progressBar: kwargs.progressBar ?? null,
    preview: kwargs.preview ?? null,
    showInFileBrowser: kwargs.showInFileBrowser ?? null,
    jupyter: kwargs.jupyter ?? null,
  };

  const clickArgs = new ClickArgs(argsRecord);

  // ── Jupyter short-circuit ────────────────────────────────────────────────

  if (kwargs.jupyter) {
    return clickArgs;
  }

  // ── Digest CLI args into global config ──────────────────────────────────

  config.digestArgs(clickArgs.toRecord());

  const file = nodePath.resolve(config.inputFile);

  // ── Render ───────────────────────────────────────────────────────────────

  if (config.renderer === RendererType.OPENGL) {
    // TODO: Port OpenGL renderer — needs manual rendering implementation
    // The OpenGLRenderer class is not yet fully converted. When available,
    // import from "../../renderer/opengl_renderer/index.js".
    try {
      throw new Error(
        "OpenGL renderer is not yet implemented in manim-ts. " +
          "Use the default Cairo renderer instead.",
      );
    } catch (err) {
      errorConsole.print(
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
      process.exit(1);
    }
  } else {
    // Cairo (default) renderer
    const sceneClasses = await sceneClassesFromFile(file, false, true) as Array<new (...args: unknown[]) => unknown>;
    for (const SceneClass of sceneClasses) {
      try {
        await tempconfig({}, async () => {
          const scene = new SceneClass();
          await (scene as { render(): Promise<void> }).render();
        });
      } catch (err) {
        errorConsole.print(
          err instanceof Error ? err.stack ?? err.message : String(err),
        );
        process.exit(1);
      }
    }
  }

  // ── Outdated version check ───────────────────────────────────────────────

  if (config.notifyOutdatedVersion) {
    await checkOutdatedVersion();
  }

  return kwargs;
}
