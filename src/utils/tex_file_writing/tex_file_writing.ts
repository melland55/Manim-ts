/**
 * Interface for writing, compiling, and converting .tex files.
 * Port of manim/utils/tex_file_writing.py
 *
 * @see {@link module:mobject/svg/tex_mobject}
 */

import crypto from "crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import { TexTemplate } from "../tex/index.js";
import { logger } from "../../_config/index.js";

// ─── Config ──────────────────────────────────────────────────

/**
 * Configuration for tex file writing operations.
 * Mirrors the relevant fields from Python Manim's global config object.
 */
export interface TexFileWritingConfig {
  /** TeX template to use for rendering. Defaults to a new `TexTemplate()`. */
  texTemplate?: TexTemplate;
  /** Directory for storing generated tex/svg/dvi files. Defaults to `"./media/Tex"`. */
  texDir?: string;
  /** When true, intermediate (non-svg) files are kept after compilation. */
  noLatexCleanup?: boolean;
}

const DEFAULT_TEX_DIR = "./media/Tex";

function resolveTexDir(cfg?: TexFileWritingConfig): string {
  return cfg?.texDir ?? DEFAULT_TEX_DIR;
}

function resolveTexTemplate(cfg?: TexFileWritingConfig): TexTemplate {
  return cfg?.texTemplate ?? new TexTemplate();
}

// ─── Hash ────────────────────────────────────────────────────

/**
 * Computes a 16-character SHA-256 hex digest of the given expression.
 */
export function texHash(expression: unknown): string {
  const idStr = String(expression);
  return crypto.createHash("sha256").update(idStr, "utf8").digest("hex").slice(0, 16);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Takes a tex expression and returns the path to the compiled SVG file.
 *
 * @param expression - TeX expression to render, e.g. `\\sqrt{2}` or `foo`
 * @param environment - Optional environment, e.g. `align*`
 * @param texTemplate - Template for typesetting. Falls back to config default.
 * @param cfg - Optional config overrides.
 * @returns Absolute path to the generated SVG file.
 */
export function texToSvgFile(
  expression: string,
  environment: string | null = null,
  texTemplate: TexTemplate | null = null,
  cfg?: TexFileWritingConfig,
): string {
  const template = texTemplate ?? resolveTexTemplate(cfg);
  const texFile = generateTexFile(expression, environment, template, cfg);

  const svgFile = texFile.replace(/\.tex$/, ".svg");
  if (existsSync(svgFile)) {
    return svgFile;
  }

  const dviFile = compileTex(texFile, template.texCompiler, template.outputFormat, cfg);
  const resultSvg = convertToSvg(dviFile, template.outputFormat);

  if (!(cfg?.noLatexCleanup ?? false)) {
    deleteNonsvgFiles([], cfg);
  }

  return resultSvg;
}

// ─── Generate TeX file ───────────────────────────────────────

/**
 * Generates a fully-formed `.tex` file ready for compilation.
 *
 * @param expression - TeX expression to render.
 * @param environment - Optional environment to wrap the expression in.
 * @param texTemplate - Template for typesetting.
 * @param cfg - Optional config overrides.
 * @returns Absolute path to the generated `.tex` file.
 */
export function generateTexFile(
  expression: string,
  environment: string | null = null,
  texTemplate: TexTemplate | null = null,
  cfg?: TexFileWritingConfig,
): string {
  const template = texTemplate ?? resolveTexTemplate(cfg);

  let output: string;
  if (environment !== null) {
    output = template.getTexcodeForExpressionInEnv(expression, environment);
  } else {
    output = template.getTexcodeForExpression(expression);
  }

  const texDir = resolveTexDir(cfg);
  mkdirSync(texDir, { recursive: true });

  const result = join(texDir, texHash(output) + ".tex");
  if (!existsSync(result)) {
    logger.info(
      "Writing %(expression)s to %(path)s",
      { expression, path: result } as unknown as string,
    );
    writeFileSync(result, output, "utf-8");
  }
  return result;
}

// ─── Compilation command ─────────────────────────────────────

/**
 * Prepares the TeX compilation command (compiler name + all necessary flags).
 *
 * @param texCompiler - Compiler to use, e.g. `pdflatex` or `lualatex`
 * @param outputFormat - Output format extension, e.g. `.dvi` or `.pdf`
 * @param texFile - Absolute path to the `.tex` file.
 * @param texDir - Directory where compiler output will be stored.
 * @returns Argv array ready to pass to `spawnSync`.
 */
export function makeTexCompilationCommand(
  texCompiler: string,
  outputFormat: string,
  texFile: string,
  texDir: string,
): string[] {
  const texDirPosix = texDir.replace(/\\/g, "/");
  const texFilePosix = texFile.replace(/\\/g, "/");

  if (["latex", "pdflatex", "luatex", "lualatex"].includes(texCompiler)) {
    return [
      texCompiler,
      "-interaction=batchmode",
      `-output-format=${outputFormat.slice(1)}`,
      "-halt-on-error",
      `-output-directory=${texDirPosix}`,
      texFilePosix,
    ];
  }

  if (texCompiler === "xelatex") {
    const outFlag: string[] =
      outputFormat === ".xdv"
        ? ["-no-pdf"]
        : outputFormat === ".pdf"
        ? []
        : (() => {
            throw new Error("xelatex output is either pdf or xdv");
          })();

    return [
      "xelatex",
      ...outFlag,
      "-interaction=batchmode",
      "-halt-on-error",
      `-output-directory=${texDirPosix}`,
      texFilePosix,
    ];
  }

  throw new Error(`Tex compiler ${texCompiler} unknown.`);
}

// ─── Error insight generators ────────────────────────────────

/**
 * Yields user-facing hints for an `inputenc` Unicode error.
 */
export function* insightInputencError(
  matching: RegExpMatchArray,
): Generator<string, void, unknown> {
  const codePoint = parseInt(matching[1], 16);
  // JavaScript has no built-in Unicode name lookup; use the code point directly.
  const charDisplay = `U+${matching[1].toUpperCase()}`;
  yield `TexTemplate does not support character ${charDisplay} (code point 0x${matching[1]}).`;
  yield "See the documentation for manim.mobject.svg.tex_mobject for details on using a custom TexTemplate.";
}

/**
 * Yields user-facing hints for a missing LaTeX package error.
 */
export function* insightPackageNotFoundError(
  matching: RegExpMatchArray,
): Generator<string, void, unknown> {
  yield `You do not have package ${matching[1]} installed.`;
  yield `Install ${matching[1]} using your LaTeX package manager, or check for typos.`;
}

// ─── Compile ─────────────────────────────────────────────────

/**
 * Compiles a `.tex` file into `.dvi`, `.xdv`, or `.pdf`.
 *
 * @param texFile - Absolute path to the `.tex` file.
 * @param texCompiler - Compiler to use, e.g. `pdflatex` or `lualatex`
 * @param outputFormat - Desired output format, e.g. `.dvi` or `.pdf`
 * @param cfg - Optional config overrides.
 * @returns Absolute path to the compiled output file.
 */
export function compileTex(
  texFile: string,
  texCompiler: string,
  outputFormat: string,
  cfg?: TexFileWritingConfig,
): string {
  const result = texFile.replace(/\.tex$/, outputFormat);
  const texDir = resolveTexDir(cfg);

  if (!existsSync(result)) {
    const command = makeTexCompilationCommand(texCompiler, outputFormat, texFile, texDir);
    const cp = spawnSync(command[0], command.slice(1), { stdio: ["ignore", "ignore", "pipe"] });

    if (cp.status !== 0) {
      const logFile = texFile.replace(/\.tex$/, ".log");
      printAllTexErrors(logFile, texCompiler, texFile);
      throw new Error(
        `${texCompiler} error converting to ${outputFormat.slice(1)}.` +
          ` See log output above or the log file: ${logFile}`,
      );
    }
  }
  return result;
}

// ─── Convert to SVG ──────────────────────────────────────────

/**
 * Converts a `.dvi`, `.xdv`, or `.pdf` file to SVG using `dvisvgm`.
 *
 * @param dviFile - Absolute path to the input file.
 * @param extension - File extension indicating format, e.g. `.dvi` or `.pdf`
 * @param page - Page to convert (for multi-page inputs). Defaults to 1.
 * @returns Absolute path to the generated SVG file.
 */
export function convertToSvg(dviFile: string, extension: string, page: number = 1): string {
  const result = dviFile.replace(/\.[^/.]+$/, ".svg");

  if (!existsSync(result)) {
    const pdfFlag = extension === ".pdf" ? ["--pdf"] : [];
    const command = [
      "dvisvgm",
      ...pdfFlag,
      `--page=${page}`,
      "--no-fonts",
      "--verbosity=0",
      `--output=${result.replace(/\\/g, "/")}`,
      dviFile.replace(/\\/g, "/"),
    ];
    spawnSync(command[0], command.slice(1), { stdio: ["ignore", "ignore", "pipe"] });
  }

  if (!existsSync(result)) {
    throw new Error(
      `Your installation does not support converting ${extension} files to SVG.` +
        " Consider updating dvisvgm to at least version 2.4." +
        " If this does not solve the problem, please refer to our troubleshooting guide at:" +
        " https://docs.manim.community/en/stable/faq/general.html#my-installation-" +
        "does-not-support-converting-pdf-to-svg-help",
    );
  }

  return result;
}

// ─── Cleanup ─────────────────────────────────────────────────

/**
 * Deletes every file in the tex directory that does not have a whitelisted suffix.
 *
 * Whitelisted suffixes: `.svg`, `.tex`, plus any in `additionalEndings`.
 *
 * @param additionalEndings - Extra file extensions to keep.
 * @param cfg - Optional config overrides.
 */
export function deleteNonsvgFiles(
  additionalEndings: Iterable<string> = [],
  cfg?: TexFileWritingConfig,
): void {
  const texDir = resolveTexDir(cfg);
  const whitelist = new Set([".svg", ".tex", ...additionalEndings]);

  if (!existsSync(texDir)) return;

  for (const entry of readdirSync(texDir)) {
    const dotIdx = entry.lastIndexOf(".");
    const suffix = dotIdx >= 0 ? entry.slice(dotIdx) : "";
    if (!whitelist.has(suffix)) {
      try {
        unlinkSync(join(texDir, entry));
      } catch {
        // Ignore errors on individual file deletions
      }
    }
  }
}

// ─── Error reporting ─────────────────────────────────────────

/**
 * Pattern → insight-function pairs used to provide hints for known LaTeX errors.
 */
type InsightFn = (matching: RegExpMatchArray) => Generator<string, void, unknown>;

export const LATEX_ERROR_INSIGHTS: Array<[string, InsightFn]> = [
  [
    String.raw`inputenc Error: Unicode character (?:.*) \(U\+([0-9a-fA-F]+)\)`,
    insightInputencError,
  ],
  [
    String.raw`LaTeX Error: File \`(.*?[clsty])' not found`,
    insightPackageNotFoundError,
  ],
];

/**
 * Reads the `.log` file produced by TeX and prints all error blocks.
 *
 * @param logFile - Absolute path to the `.log` file.
 * @param texCompiler - Name of the compiler (for error messages).
 * @param texFile - Absolute path to the `.tex` file (for context lines).
 */
export function printAllTexErrors(
  logFile: string,
  texCompiler: string,
  texFile: string,
): void {
  if (!existsSync(logFile)) {
    throw new Error(
      `${texCompiler} failed but did not produce a log file. ` +
        "Check your LaTeX installation.",
    );
  }

  const texCompilationLog = readFileSync(logFile, "utf-8").split("\n");
  const errorIndices = texCompilationLog
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => line.startsWith("!"))
    .map(({ idx }) => idx);

  if (errorIndices.length > 0) {
    const tex = readFileSync(texFile, "utf-8").split("\n");
    for (const errorIndex of errorIndices) {
      printTexError(texCompilationLog, errorIndex, tex);
    }
  }
}

/**
 * Prints a single TeX error with surrounding context lines.
 *
 * @param texCompilationLog - Lines from the `.log` file.
 * @param errorStartIndex - Index of the error line (starts with `!`).
 * @param texSource - Lines from the `.tex` source file.
 */
export function printTexError(
  texCompilationLog: readonly string[],
  errorStartIndex: number,
  texSource: readonly string[],
): void {
  logger.error(`LaTeX compilation error: ${texCompilationLog[errorStartIndex].slice(2)}`);

  // Find the next line starting with "l." after the error — it gives the line number.
  const lLineMatch = texCompilationLog
    .slice(errorStartIndex)
    .find((line) => line.startsWith("l."));

  if (lLineMatch === undefined) return;

  const lineOfTexError = parseInt(lLineMatch.split(" ")[0].split(".")[1], 10) - 1;

  if (lineOfTexError >= texSource.length) return;

  const context: string[] = ["Context of error: \n"];

  if (lineOfTexError < 3) {
    const slice = texSource.slice(0, lineOfTexError + 3) as string[];
    slice[slice.length - 4] = "-> " + slice[slice.length - 4];
    context.push(...slice);
  } else if (lineOfTexError > texSource.length - 3) {
    const slice = texSource.slice(lineOfTexError - 1) as string[];
    slice[1] = "-> " + slice[1];
    context.push(...slice);
  } else {
    const slice = texSource.slice(lineOfTexError - 3, lineOfTexError + 3) as string[];
    slice[slice.length - 4] = "-> " + slice[slice.length - 4];
    context.push(...slice);
  }

  logger.error(context.join(""));

  const errorLine = texCompilationLog[errorStartIndex].slice(2);
  for (const [pattern, getInsight] of LATEX_ERROR_INSIGHTS) {
    const matching = errorLine.match(new RegExp(pattern));
    if (matching !== null) {
      for (const insight of getInsight(matching)) {
        logger.info(insight);
      }
    }
  }
}
