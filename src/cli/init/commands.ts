/**
 * Manim's init subcommand.
 *
 * Provides `init project` and `init scene` commands for scaffolding new
 * Manim projects and inserting scenes into existing files.
 *
 * TypeScript port of manim/cli/init/commands.py
 */

import readline from "node:readline";
import * as fs from "node:fs";
import * as nodePath from "node:path";

import { manimConsole } from "../../_config/index.js";
import { EPILOG, QUALITIES } from "../../constants/index.js";
import {
  addImportStatement,
  copyTemplateFiles,
  getTemplateNames,
  getTemplatePath,
} from "../../utils/file_ops/index.js";

export { EPILOG };

// ─── Defaults ────────────────────────────────────────────────────────────────

/** Default values written to manim.cfg when --default is passed. */
export const CFG_DEFAULTS: Record<string, unknown> = {
  frame_rate: 30,
  background_color: "BLACK",
  background_opacity: 1,
  scene_names: "Default",
  resolution: [1920, 1080] as [number, number],
};

// ─── Readline helpers ─────────────────────────────────────────────────────────

/** Prompt the user for a line of text, with an optional default value. */
function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const suffix = defaultValue !== undefined ? ` [${defaultValue}]: ` : ": ";
  return new Promise((resolve) => {
    rl.question(question + suffix, (answer) => {
      rl.close();
      resolve(answer.trim() === "" && defaultValue !== undefined ? defaultValue : answer.trim());
    });
  });
}

/** Prompt the user to choose from a fixed set of options. */
async function choicePrompt(
  question: string,
  choices: string[],
  defaultValue: string,
): Promise<string> {
  const choiceStr = choices.join("|");
  while (true) {
    const answer = await prompt(`${question} (${choiceStr})`, defaultValue);
    if (choices.includes(answer)) {
      return answer;
    }
    process.stdout.write(`Invalid choice. Choose from: ${choiceStr}\n`);
  }
}

/** Ask the user a yes/no question; returns true for "y"/"yes". */
function confirm(question: string, defaultValue = true): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = defaultValue ? "[Y/n]" : "[y/N]";
  return new Promise((resolve) => {
    rl.question(`${question} ${hint} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") {
        resolve(defaultValue);
      } else {
        resolve(trimmed === "y" || trimmed === "yes");
      }
    });
  });
}

// ─── INI helpers (configparser equivalent) ───────────────────────────────────

/** Minimal INI parser — returns a map of section → key → value. */
function parseIni(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let current: Map<string, string> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1];
      if (!sections.has(name)) {
        sections.set(name, new Map());
      }
      current = sections.get(name)!;
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1 && current) {
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      current.set(key, value);
    }
  }

  return sections;
}

/** Serialise an INI map back to string. */
function writeIni(sections: Map<string, Map<string, string>>): string {
  const parts: string[] = [];
  for (const [section, entries] of sections) {
    parts.push(`[${section}]`);
    for (const [key, value] of entries) {
      parts.push(`${key} = ${value}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prompt the user to select a rendering resolution.
 *
 * Presents the pixel heights from `QUALITIES` (excluding the last entry,
 * which is `example_quality`) as choices.
 *
 * Returns a `[pixelHeight, pixelWidth]` tuple.
 */
export async function selectResolution(): Promise<[number, number]> {
  const resolutionOptions: Array<[number, number]> = Object.values(QUALITIES).map(
    (q) => [q.pixelHeight, q.pixelWidth],
  );
  // Mirror Python's resolution_options.pop() — remove example_quality (last entry)
  resolutionOptions.pop();

  const choices = resolutionOptions.map(([h]) => `${h}p`);
  const choice = await choicePrompt("\nSelect resolution:\n", choices, "480p");
  const match = resolutionOptions.find(([h]) => `${h}p` === choice);
  return match!;
}

/**
 * Update the `manim.cfg` file at `projectCfgPath` with the values in
 * `cfgDict`.
 *
 * Mirrors Python's `update_cfg()`. The `resolution` key is special-cased
 * to split into `pixel_height` and `pixel_width`.
 */
export function updateCfg(
  cfgDict: Record<string, unknown>,
  projectCfgPath: string,
): void {
  let text = "";
  if (fs.existsSync(projectCfgPath)) {
    text = fs.readFileSync(projectCfgPath, "utf8");
  }

  const sections = parseIni(text);

  if (!sections.has("CLI")) {
    sections.set("CLI", new Map());
  }
  const cliSection = sections.get("CLI")!;

  for (const [key, value] of Object.entries(cfgDict)) {
    if (key === "resolution") {
      const [h, w] = value as [number, number];
      cliSection.set("pixel_height", String(h));
      cliSection.set("pixel_width", String(w));
    } else {
      cliSection.set(key, String(value));
    }
  }

  fs.writeFileSync(projectCfgPath, writeIni(sections), "utf8");
}

// ─── Options types ────────────────────────────────────────────────────────────

/** Options for the `project` command. */
export interface ProjectOptions {
  /** Name of the project directory to create. */
  projectName?: string;
  /** Use default settings without prompting. */
  defaultSettings?: boolean;
}

/** Options for the `scene` command. */
export interface SceneOptions {
  /** Name of the scene class to insert. */
  sceneName: string;
  /** File to insert the scene into (defaults to main.py). */
  fileName?: string;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * Create a new Manim project.
 *
 * Mirrors the `manim init project` CLI command.  Creates a directory,
 * copies template files, and writes a `manim.cfg` config file.
 *
 * @param options.projectName  Name of the project directory.
 * @param options.defaultSettings  Skip all prompts and use defaults.
 */
export async function project(options: ProjectOptions = {}): Promise<void> {
  let projectName = options.projectName;
  if (!projectName) {
    projectName = await prompt("Project Name");
  }

  const templateNames = getTemplateNames();
  const templateName = await choicePrompt("Template", templateNames, "Default");

  if (fs.existsSync(projectName) && fs.statSync(projectName).isDirectory()) {
    manimConsole.print(
      `\nFolder [red]${projectName}[/red] exists. Please type another name\n`,
    );
    return;
  }

  fs.mkdirSync(projectName);
  const newCfg: Record<string, unknown> = {};
  const newCfgPath = nodePath.resolve(nodePath.join(projectName, "manim.cfg"));

  if (!options.defaultSettings) {
    for (const [key, defaultValue] of Object.entries(CFG_DEFAULTS)) {
      if (key === "scene_names") {
        newCfg[key] = templateName + "Template";
      } else if (key === "resolution") {
        newCfg[key] = await selectResolution();
      } else {
        const answer = await prompt(`\n${key}`, String(defaultValue));
        // Preserve numeric types
        const num = Number(answer);
        newCfg[key] = answer !== "" && !isNaN(num) ? num : answer;
      }
    }

    manimConsole.print("\n", newCfg);
    const proceed = await confirm("Do you want to continue?", true);
    if (!proceed) {
      return;
    }

    copyTemplateFiles(projectName, templateName);
    updateCfg(newCfg, newCfgPath);
  } else {
    copyTemplateFiles(projectName, templateName);
    updateCfg(CFG_DEFAULTS, newCfgPath);
  }
}

/**
 * Insert a scene into a file (or create the file).
 *
 * Mirrors the `manim init scene` CLI command.  Reads the requested template,
 * substitutes the scene name, and appends the result to the target file.
 *
 * @param options.sceneName  Name of the scene class to insert.
 * @param options.fileName   Target file (defaults to `main.py`).
 */
export async function scene(options: SceneOptions): Promise<void> {
  const templateNames = getTemplateNames();
  const templateName = await choicePrompt("template", templateNames, "Default");

  const templateFilePath = nodePath.join(
    getTemplatePath(),
    `${templateName}.mtp`,
  );
  let sceneText = fs.readFileSync(templateFilePath, "utf8");
  sceneText = sceneText.replace(templateName + "Template", options.sceneName);

  if (options.fileName) {
    let fileName = options.fileName;
    if (!fileName.endsWith(".py")) {
      // Mirror Python: add .py suffix, preserving any existing extension
      fileName = fileName + ".py";
    }

    if (fs.existsSync(fileName) && fs.statSync(fileName).isFile()) {
      // File exists — append new scene
      fs.appendFileSync(fileName, "\n\n\n" + sceneText, "utf8");
    } else {
      // New file — write scene then prepend import statement
      fs.writeFileSync(fileName, "\n\n\n" + sceneText, "utf8");
      addImportStatement(fileName);
    }
  } else {
    // No filename given — append to main.py
    fs.appendFileSync("main.py", "\n\n\n" + sceneText, "utf8");
  }
}

/**
 * Entry point for `manim init`.
 *
 * Dispatches to `project` or `scene` sub-commands depending on `subcommand`.
 *
 * @param subcommand  "project" | "scene"
 * @param args        Forwarded to the subcommand.
 */
export async function init(
  subcommand: "project" | "scene",
  args: ProjectOptions | SceneOptions,
): Promise<void> {
  if (subcommand === "project") {
    await project(args as ProjectOptions);
  } else {
    await scene(args as SceneOptions);
  }
}
