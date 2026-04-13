/**
 * Module operations — dynamic scene discovery and selection.
 *
 * TypeScript port of manim/utils/module_ops.py.
 *
 * Handles loading a user-written animation module, discovering Scene subclasses
 * within it, and selecting which scenes to render based on CLI config.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import { config, logger, manimConsole } from "../../_config/index.js";
import {
  CHOOSE_NUMBER_MESSAGE,
  INVALID_NUMBER_MESSAGE,
  NO_SCENE_MESSAGE,
  SCENE_NOT_FOUND_MESSAGE,
} from "../../constants/index.js";
import { SceneFileWriter } from "../../scene/scene_file_writer/index.js";
import type { IScene } from "../../core/types.js";

// ─── Types ────────────────────────────────────────────────────

/**
 * A constructor for a Scene subclass.
 * Mirrors Python's `type[Scene]`.
 */
export type SceneClass = new (...args: unknown[]) => IScene;

/**
 * A dynamically-loaded module's export map.
 * Mirrors Python's `types.ModuleType.__dict__`.
 */
export type ModuleExports = Record<string, unknown>;

/**
 * Extended config interface for CLI-specific scene options.
 * These fields are not in core ManimConfig but are set by the CLI.
 */
interface ModuleOpsConfig {
  writeAll?: boolean;
  sceneNames?: string[];
}

/** Access CLI-specific config keys that extend the core config. */
function getCliConfig(): ModuleOpsConfig {
  return config as unknown as ModuleOpsConfig;
}

// ─── Module loading ───────────────────────────────────────────

/**
 * Load a module from a file path or from stdin (when path is "-").
 *
 * Mirrors Python `get_module()` from utils/module_ops.py.
 * - For "-", reads TypeScript/JS code from stdin (limited: eval not supported
 *   in ESM without a build step; this path logs a warning and returns {}).
 * - For file paths, uses dynamic `import()` with the file:// URL.
 *
 * Only `.ts` and `.js` files are valid; `.py` files raise an error.
 *
 * @throws {Error} If the file does not exist or has an invalid extension.
 */
export async function getModule(filePath: string): Promise<ModuleExports> {
  if (filePath === "-") {
    logger.info(
      "Enter the animation's code & end with an EOF (CTRL+D on Linux/Unix, CTRL+Z on Windows):",
    );
    const code = await readStdin();
    logger.info("Rendering animation from typed code...");
    // Dynamic eval of ESM TypeScript is not supported at runtime.
    // Warn the user; return empty module.
    logger.warning(
      "stdin code execution is not supported in the TypeScript runtime. " +
        "Please provide a file path instead.",
    );
    logger.info(`Received ${code.length} bytes (ignored).`);
    return {};
  }

  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`${filePath} not found`);
  }

  const ext = path.extname(resolved);
  if (ext !== ".ts" && ext !== ".js" && ext !== ".mjs" && ext !== ".cjs") {
    throw new Error(
      `${filePath} is not a valid Manim TypeScript/JavaScript script.`,
    );
  }

  const fileUrl = pathToFileURL(resolved).href;
  try {
    const mod = await import(fileUrl);
    return mod as ModuleExports;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Failed to load module ${filePath}: ${msg}`);
    throw e;
  }
}

// ─── Scene class discovery ────────────────────────────────────

/**
 * Return all Scene subclass constructors exported by a module.
 *
 * Mirrors Python `get_scene_classes_from_module()`.
 * Uses duck-typing: any exported class with a `construct` method
 * is treated as a Scene subclass. This matches the IScene interface.
 *
 * @param moduleExports - The exports object from a dynamically-loaded module.
 * @param moduleOrigin - Optional module identifier for filtering by origin.
 */
export function getSceneClassesFromModule(
  moduleExports: ModuleExports,
  moduleOrigin?: string,
): SceneClass[] {
  const results: SceneClass[] = [];

  for (const value of Object.values(moduleExports)) {
    if (isSceneClass(value, moduleOrigin)) {
      results.push(value as SceneClass);
    }
  }

  return results;
}

/**
 * Duck-type check: is `value` a constructor whose prototype has `construct`?
 * This matches the IScene interface shape without needing the real base class.
 */
function isSceneClass(value: unknown, _moduleOrigin?: string): boolean {
  if (typeof value !== "function") return false;
  // Must be a class (has a prototype with at least one own method)
  if (!value.prototype) return false;
  // Must have the `construct` method from IScene
  if (typeof value.prototype.construct !== "function") return false;
  return true;
}

// ─── Scene selection ──────────────────────────────────────────

/**
 * Select which scene classes to render, consulting CLI config.
 *
 * Mirrors Python `get_scenes_to_render()`.
 * - If `config.writeAll` is true, return all classes.
 * - If `config.sceneNames` lists specific names, return those.
 * - If exactly one class exists, return it automatically.
 * - Otherwise prompt the user interactively.
 */
export async function getScenestoRender(
  sceneClasses: SceneClass[],
): Promise<SceneClass[]> {
  if (sceneClasses.length === 0) {
    logger.error(NO_SCENE_MESSAGE);
    return [];
  }

  const cliConfig = getCliConfig();

  if (cliConfig.writeAll) {
    return sceneClasses;
  }

  const sceneNames: string[] = cliConfig.sceneNames ?? [];
  const result: SceneClass[] = [];

  for (const sceneName of sceneNames) {
    if (!sceneName) continue;
    const found = sceneClasses.find((sc) => sc.name === sceneName);
    if (found) {
      result.push(found);
    } else {
      logger.error(SCENE_NOT_FOUND_MESSAGE.replace("{}", sceneName));
    }
  }

  if (result.length > 0) {
    return result;
  }

  if (sceneClasses.length === 1) {
    const cliCfg = getCliConfig();
    cliCfg.sceneNames = [sceneClasses[0].name];
    return [sceneClasses[0]];
  }

  return promptUserForChoice(sceneClasses);
}

/**
 * Interactively prompt the user to pick one or more scenes by number.
 *
 * Mirrors Python `prompt_user_for_choice()`.
 * Sets `SceneFileWriter.force_output_as_scene_name = true` so that each
 * scene gets its own output file.
 *
 * @throws {process.exit} On invalid input or EOF (mirrors Python sys.exit).
 */
export async function promptUserForChoice(
  sceneClasses: SceneClass[],
): Promise<SceneClass[]> {
  SceneFileWriter.forceOutputAsSceneName = true;

  const numToClass = new Map<number, SceneClass>();

  for (let i = 0; i < sceneClasses.length; i++) {
    const count = i + 1;
    const name = sceneClasses[i].name;
    manimConsole.print(`${count}: ${name}`);
    numToClass.set(count, sceneClasses[i]);
  }

  let userInput: string;
  try {
    userInput = await promptInput(CHOOSE_NUMBER_MESSAGE);
  } catch {
    // EOF
    process.exit(1);
  }

  try {
    let selectedClasses: SceneClass[];

    if (userInput.trim() === "*") {
      selectedClasses = sceneClasses;
    } else {
      const parts = userInput
        .trim()
        .split(/\s*,\s*/)
        .filter((s) => s.length > 0);

      if (parts.length === 0) {
        logger.error("No scenes were selected. Exiting.");
        process.exit(1);
      }

      selectedClasses = parts.map((numStr) => {
        const n = parseInt(numStr, 10);
        if (isNaN(n)) {
          logger.error(INVALID_NUMBER_MESSAGE);
          process.exit(2);
        }
        const sc = numToClass.get(n);
        if (!sc) {
          logger.error(INVALID_NUMBER_MESSAGE);
          process.exit(2);
        }
        return sc;
      });
    }

    const cliCfg = getCliConfig();
    cliCfg.sceneNames = selectedClasses.map((sc) => sc.name);

    return selectedClasses;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ERR_PROCESS_EXIT") throw e;
    logger.error(INVALID_NUMBER_MESSAGE);
    process.exit(2);
  }
}

// ─── Main public API ──────────────────────────────────────────

/**
 * Load a file, discover its Scene subclasses, and return those to render.
 *
 * Mirrors Python `scene_classes_from_file()` with all three overloads:
 * - `full_list=True` → returns all discovered scene classes (ignores config)
 * - `require_single_scene=True` → asserts exactly one class was selected
 * - default → returns the list selected by config / user prompt
 */
export async function sceneClassesFromFile(
  filePath: string,
  requireSingleScene?: false,
  fullList?: false,
): Promise<SceneClass[]>;
export async function sceneClassesFromFile(
  filePath: string,
  requireSingleScene: true,
  fullList?: false,
): Promise<SceneClass>;
export async function sceneClassesFromFile(
  filePath: string,
  requireSingleScene: boolean,
  fullList: true,
): Promise<SceneClass[]>;
export async function sceneClassesFromFile(
  filePath: string,
  requireSingleScene = false,
  fullList = false,
): Promise<SceneClass | SceneClass[]> {
  const mod = await getModule(filePath);
  const allSceneClasses = getSceneClassesFromModule(mod);

  if (fullList) {
    return allSceneClasses;
  }

  const sceneClassesToRender = await getScenestoRender(allSceneClasses);

  if (requireSingleScene) {
    if (sceneClassesToRender.length !== 1) {
      throw new Error(
        `Expected exactly 1 scene but found ${sceneClassesToRender.length}.`,
      );
    }
    return sceneClassesToRender[0];
  }

  return sceneClassesToRender;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Read all of stdin until EOF, returning the full string. */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (line) => chunks.push(line));
    rl.on("close", () => resolve(chunks.join("\n")));
  });
}

/** Prompt the user for a single line of input and return it. */
function promptInput(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    rl.on("close", () => {
      // Triggered on EOF before the question was answered
    });
    rl.on("error", reject);
  });
}
