/**
 * Utility functions for interacting with the file system.
 *
 * TypeScript port of Python Manim's manim/utils/file_ops.py
 */

import * as fs from "fs";
import * as nodePath from "path";
import * as nodeOs from "os";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);

// ─── Version ──────────────────────────────────────────────────

/** Manim Community version string inserted by addVersionBeforeExtension. */
export const MANIM_VERSION = "0.18.0";

// ─── Config Types ─────────────────────────────────────────────

/**
 * File-output configuration.
 * Mirrors the relevant fields from Python Manim's global config object.
 */
export interface FileOpsConfig {
  /** Output format: "mp4" | "gif" | "webm" | "mov" | "png" */
  format: string;
  /** Whether the animation output should be written to a movie file. */
  writeToMovie: boolean;
  /** Save the last rendered frame as a still image. */
  saveLastFrame?: boolean;
  /** Show the output file in the OS file browser. */
  showInFileBrowser?: boolean;
  /** Open a preview of the output after rendering. */
  preview?: boolean;
  /** Custom preview command (overrides the default OS open command). */
  previewCommand?: string;
}

/**
 * Minimal interface for the path properties of a SceneFileWriter.
 * The full implementation lives in src/scene/scene_file_writer/.
 */
export interface ISceneFileWriterPaths {
  imageFilePath: string;
  movieFilePath: string;
  gifFilePath: string;
}

// ─── Format Predicates ────────────────────────────────────────

/** Returns true when the configured output format is "mp4". */
export function isMP4Format(config: Pick<FileOpsConfig, "format">): boolean {
  return config.format === "mp4";
}

/** Returns true when the configured output format is "gif". */
export function isGIFFormat(config: Pick<FileOpsConfig, "format">): boolean {
  return config.format === "gif";
}

/** Returns true when the configured output format is "webm". */
export function isWebMFormat(config: Pick<FileOpsConfig, "format">): boolean {
  return config.format === "webm";
}

/** Returns true when the configured output format is "mov". */
export function isMOVFormat(config: Pick<FileOpsConfig, "format">): boolean {
  return config.format === "mov";
}

/** Returns true when the configured output format is "png". */
export function isPNGFormat(config: Pick<FileOpsConfig, "format">): boolean {
  return config.format === "png";
}

/**
 * Returns true if the animation output should be written as a movie file.
 * PNG format takes precedence — always returns false when format is "png"
 * regardless of the writeToMovie flag.
 */
export function writeToMovie(config: FileOpsConfig): boolean {
  if (isPNGFormat(config)) {
    return false;
  }
  return (
    config.writeToMovie ||
    isMP4Format(config) ||
    isGIFFormat(config) ||
    isWebMFormat(config) ||
    isMOVFormat(config)
  );
}

// ─── Executable Lookup ────────────────────────────────────────

/**
 * Returns true if the given path refers to an accessible executable.
 * When pathToExe has no directory component (just a bare name), the
 * system PATH is searched via `which` / `where`.
 */
export function ensureExecutable(pathToExe: string): boolean {
  const parsed = nodePath.parse(pathToExe);

  if (parsed.dir === "" || parsed.dir === ".") {
    // Bare name — search PATH
    const isWindows = nodeOs.platform() === "win32";
    const result = isWindows
      ? spawnSync("where", [parsed.name], { encoding: "utf8" })
      : spawnSync("which", [parsed.name], { encoding: "utf8" });

    if (result.status !== 0 || !result.stdout?.trim()) {
      return false;
    }

    const found = result.stdout.trim().split("\n")[0].trim();
    try {
      fs.accessSync(found, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  try {
    fs.accessSync(pathToExe, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// ─── Path Helpers ─────────────────────────────────────────────

/**
 * Returns fileName with extension appended if it does not already end
 * with that extension.  Mirrors Python's Path.with_suffix behaviour of
 * keeping the existing suffix and concatenating the new one.
 */
export function addExtensionIfNotPresent(
  fileName: string,
  extension: string
): string {
  const currentExt = nodePath.extname(fileName);
  if (currentExt !== extension) {
    return fileName + extension;
  }
  return fileName;
}

/**
 * Inserts the Manim version string before the file extension.
 *
 * @example
 * addVersionBeforeExtension("output.mp4")
 * // → "output_ManimCE_v0.18.0.mp4"
 */
export function addVersionBeforeExtension(fileName: string): string {
  const dir = nodePath.dirname(fileName);
  const ext = nodePath.extname(fileName);
  const stem = nodePath.basename(fileName, ext);
  const newBasename = `${stem}_ManimCE_v${MANIM_VERSION}${ext}`;
  return dir === "." ? newBasename : nodePath.join(dir, newBasename);
}

/**
 * Ensures the given directory exists, creating it (and all parents) if needed.
 * Returns the resolved absolute path.
 */
export function guaranteeExistence(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return nodePath.resolve(dirPath);
}

/**
 * Ensures the given directory exists and is completely empty.
 * If the directory already exists its contents are removed before
 * recreating it.  Returns the resolved absolute path.
 */
export function guaranteeEmptyExistence(dirPath: string): string {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
  return nodePath.resolve(dirPath);
}

/**
 * Searches several candidate locations for a file and returns the first
 * that exists.
 *
 * Candidates tried (in order):
 *   1. fileName itself (with `~` expanded)
 *   2. `defaultDir/fileName` (no extra extension)
 *   3. `defaultDir/fileName<ext>` for each ext in extensions
 *
 * Throws an Error if the file cannot be found at any location.
 */
export function seekFullPathFromDefaults(
  fileName: string,
  defaultDir: string,
  extensions: string[]
): string {
  const expanded = fileName.replace(/^~(?=\/|\\|$)/, nodeOs.homedir());
  const candidates: string[] = [expanded];

  for (const ext of ["", ...extensions]) {
    candidates.push(nodePath.join(defaultDir, `${fileName}${ext}`));
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    `From: ${process.cwd()}, could not find ${fileName} at either of these ` +
      `locations: ${JSON.stringify(candidates)}`
  );
}

/**
 * Manually refreshes the access time (atime) of a file.
 * Useful on systems where atime refresh is disabled by default.
 */
export function modifyAtime(filePath: string): void {
  const now = new Date();
  const stat = fs.statSync(filePath);
  fs.utimesSync(filePath, now, stat.mtime);
}

// ─── File Opening ─────────────────────────────────────────────

/**
 * Opens a file (or its parent folder when inBrowser is true) using the
 * default application for the current operating system.
 *
 * An optional previewCommand overrides the OS default (mirrors
 * Python's `config.preview_command`).
 */
export function openFile(
  filePath: string,
  inBrowser = false,
  previewCommand?: string
): void {
  const platform = nodeOs.platform();
  const targetPath = inBrowser ? nodePath.dirname(filePath) : filePath;

  if (platform === "win32") {
    spawnSync("cmd", ["/c", "start", "", targetPath], { stdio: "inherit" });
    return;
  }

  let command: string;
  let args: string[];

  const ostype = process.env["OSTYPE"] ?? "";

  if (platform === "linux") {
    command = "xdg-open";
    args = [targetPath];
  } else if (platform === "darwin") {
    if (inBrowser) {
      command = "open";
      args = ["-R", filePath];
    } else {
      command = "open";
      args = [filePath];
    }
  } else if (ostype.startsWith("cygwin")) {
    command = "cygstart";
    args = [targetPath];
  } else {
    throw new Error("Unable to identify your operating system...");
  }

  if (previewCommand) {
    command = previewCommand;
    args = [targetPath];
  }

  spawnSync(command, args, { stdio: "inherit" });
}

/**
 * Opens the rendered output files according to the provided configuration.
 * Mirrors Python's `open_media_file()`.
 */
export function openMediaFile(
  fileWriter: ISceneFileWriterPaths,
  config: FileOpsConfig
): void {
  const filePaths: string[] = [];

  if (config.saveLastFrame) {
    filePaths.push(fileWriter.imageFilePath);
  }
  if (writeToMovie(config) && !isGIFFormat(config)) {
    filePaths.push(fileWriter.movieFilePath);
  }
  if (writeToMovie(config) && isGIFFormat(config)) {
    filePaths.push(fileWriter.gifFilePath);
  }

  for (const fp of filePaths) {
    if (config.showInFileBrowser) {
      openFile(fp, true, config.previewCommand);
    }
    if (config.preview) {
      openFile(fp, false, config.previewCommand);
    }
  }
}

// ─── Template Utilities ───────────────────────────────────────

/**
 * Returns the absolute path to the templates directory.
 * Mirrors Python: `Path(__file__).parent.parent / "templates"`
 */
export function getTemplatePath(): string {
  // __dirname = src/utils/file_ops  →  ../../  →  src/  →  ../templates/
  return nodePath.resolve(nodePath.join(__dirname, "..", "..", "templates"));
}

/**
 * Returns the stem names of all available template files (.mtp) in the
 * templates directory.
 */
export function getTemplateNames(): string[] {
  const templateDir = getTemplatePath();

  if (!fs.existsSync(templateDir)) {
    return [];
  }

  return fs
    .readdirSync(templateDir)
    .filter((f) => f.endsWith(".mtp"))
    .map((f) => nodePath.basename(f, ".mtp"));
}

/**
 * Prepends a TypeScript import statement to the given file.
 */
export function addImportStatement(filePath: string): void {
  const importLine = `import { manim } from "manim-ts";`;
  const content = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, `${importLine}\n${content}`, "utf8");
}

/**
 * Copies template config and scene files into the given project directory,
 * then prepends an import statement to the copied scene file.
 */
export function copyTemplateFiles(
  projectDir = ".",
  templateName = "Default"
): void {
  const templateDir = getTemplatePath();
  const templateCfgPath = nodePath.resolve(
    nodePath.join(templateDir, "template.cfg")
  );
  const templateScenePath = nodePath.resolve(
    nodePath.join(templateDir, `${templateName}.mtp`)
  );

  if (!fs.existsSync(templateCfgPath)) {
    throw new Error(`${templateCfgPath} : file does not exist`);
  }
  if (!fs.existsSync(templateScenePath)) {
    throw new Error(`${templateScenePath} : file does not exist`);
  }

  const destCfg = nodePath.resolve(nodePath.join(projectDir, "manim.cfg"));
  const destScene = nodePath.resolve(nodePath.join(projectDir, "main.ts"));

  fs.copyFileSync(templateCfgPath, destCfg);
  fs.copyFileSync(templateScenePath, destScene);
  addImportStatement(destScene);
}
