/**
 * Auxiliary module for the checkhealth subcommand.
 * Contains the actual check implementations.
 */

import { execSync } from "node:child_process";
import { readFileSync, accessSync, constants } from "node:fs";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A registered health-check function, enriched with display metadata. */
export type HealthCheckFunction = (() => boolean) & {
  description: string;
  recommendation: string;
  /**
   * Names of checks (via `Function.prototype.name`) that, if failed, cause
   * this check to be skipped.
   */
  skipOnFailed: string[];
  postFailFixHook: (() => unknown) | null;
};

// ─── Registry ────────────────────────────────────────────────────────────────

/** All registered health checks, in declaration order. */
export const HEALTH_CHECKS: HealthCheckFunction[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Locate a command on the system PATH (cross-platform).
 * Returns the full path, or null if not found.
 */
function which(cmd: string): string | null {
  try {
    const shellCmd =
      process.platform === "win32" ? `where "${cmd}"` : `which "${cmd}"`;
    const output = execSync(shellCmd, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
    const firstLine = output.split(/\r?\n/)[0].trim();
    return firstLine || null;
  } catch {
    return null;
  }
}

/**
 * Check whether a file is executable.
 * On Windows every existing file is treated as executable.
 */
function isExecutable(filePath: string): boolean {
  if (process.platform === "win32") return true;
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// ─── Decorator ───────────────────────────────────────────────────────────────

/**
 * Register a function as a health check, attaching display metadata.
 *
 * @param description   Brief description shown while running.
 * @param recommendation Help text shown when the check fails.
 * @param skipOnFailed  Checks that, if failed, cause this check to be skipped.
 *                      Pass the already-decorated `HealthCheckFunction` reference
 *                      or a plain string matching `fn.name`.
 * @param postFailFixHook Optional interactive fixer called on user confirmation.
 */
export function healthcheck(options: {
  description: string;
  recommendation: string;
  skipOnFailed?: Array<HealthCheckFunction | string> | null;
  postFailFixHook?: (() => unknown) | null;
}): (fn: () => boolean) => HealthCheckFunction {
  const skipOnFailed = (options.skipOnFailed ?? []).map((s) =>
    typeof s === "string" ? s : s.name
  );

  return function wrapper(fn: () => boolean): HealthCheckFunction {
    Object.assign(fn, {
      description: options.description,
      recommendation: options.recommendation,
      skipOnFailed,
      postFailFixHook: options.postFailFixHook ?? null,
    });
    const healthFunc = fn as HealthCheckFunction;
    HEALTH_CHECKS.push(healthFunc);
    return healthFunc;
  };
}

// ─── Checks ──────────────────────────────────────────────────────────────────
//
// Inner functions use a `Check` suffix so their `.name` doesn't collide with
// the exported `const` binding (which would cause bundlers to append a `2`
// suffix and break skip-dependency resolution).

function isManimOnPathCheck(): boolean {
  return which("manim") !== null;
}

/** Check whether `manim` is in PATH. */
export const isManimOnPath = healthcheck({
  description: "Checking whether manim is on your PATH",
  recommendation:
    "The command <manim> is currently not on your system's PATH.\n\n" +
    "You can work around this by calling the module directly " +
    "via <npx manim-ts> instead of just <manim>.\n\n" +
    "To fix the PATH issue properly: consider reinstalling manim-ts globally " +
    "via <npm install -g manim-ts>.",
})(isManimOnPathCheck);

function isManimExecutableAssociatedToThisLibraryCheck(): boolean {
  const pathToManim = which("manim");
  if (pathToManim === null) return false;
  const manimExec = readFileSync(pathToManim);
  // Check for our Node.js entry-point, legacy Python marker, or Windows batch wrapper
  return (
    manimExec.includes(Buffer.from("manim-ts")) ||
    manimExec.includes(Buffer.from("manim.__main__")) ||
    manimExec.includes(Buffer.from('"%~dp0\\manim"'))
  );
}

/**
 * Check whether the `manim` executable in PATH belongs to this library
 * (rather than manimgl / manimlib).
 */
export const isManimExecutableAssociatedToThisLibrary = healthcheck({
  description: "Checking whether the executable belongs to manim",
  recommendation:
    "The command <manim> does not belong to your installed version " +
    "of this library — it likely belongs to manimgl / manimlib.\n\n" +
    "Run manim via <npx manim-ts> or reinstall via " +
    "<npm install -g manim-ts> to fix this.",
  skipOnFailed: [isManimOnPath],
})(isManimExecutableAssociatedToThisLibraryCheck);

function isLatexAvailableCheck(): boolean {
  const pathToLatex = which("latex");
  return pathToLatex !== null && isExecutable(pathToLatex);
}

/** Check whether `latex` is in PATH and executable. */
export const isLatexAvailable = healthcheck({
  description: "Checking whether latex is available",
  recommendation:
    "Manim cannot find <latex> on your system's PATH. " +
    "You will not be able to use Tex and MathTex mobjects " +
    "in your scenes.\n\n" +
    "Consult our installation instructions " +
    "at https://docs.manim.community/en/stable/installation.html " +
    "or search the web for instructions on how to install a " +
    "LaTeX distribution on your operating system.",
})(isLatexAvailableCheck);

function isDvisvgmAvailableCheck(): boolean {
  const pathToDvisvgm = which("dvisvgm");
  return pathToDvisvgm !== null && isExecutable(pathToDvisvgm);
}

/** Check whether `dvisvgm` is in PATH and executable. */
export const isDvisvgmAvailable = healthcheck({
  description: "Checking whether dvisvgm is available",
  recommendation:
    "Manim could find <latex>, but not <dvisvgm> on your system's " +
    "PATH. Make sure your installed LaTeX distribution comes with " +
    "dvisvgm and consider installing a larger distribution if it " +
    "does not.",
  skipOnFailed: [isLatexAvailable],
})(isDvisvgmAvailableCheck);
