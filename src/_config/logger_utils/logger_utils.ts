/**
 * Utilities to create and set the logger.
 *
 * Manim's logger can be accessed via `makeLogger()`, or by calling
 * `getLogger("manim")` after the library has been imported. Manim also exports
 * a second object, `console`, which should be used to print on-screen messages
 * that need not be logged.
 */

import * as fs from "fs";
import { Console } from "console";
import * as nodePath from "path";

export type LoggerConfigSection = Record<string, string>;

/** Style theme — maps style keys to value strings */
export type Theme = Record<string, string | null>;

/** Parsed theme including display dimensions */
export interface ParsedTheme {
  styles: Theme;
  logWidth: number | null;
  logHeight: number | null;
  logTimestamps: boolean;
}

export const HIGHLIGHTED_KEYWORDS: string[] = [
  "Played",
  "animations",
  "scene",
  "Reading",
  "Writing",
  "script",
  "arguments",
  "Invalid",
  "Aborting",
  "module",
  "File",
  "Rendering",
  "Rendered",
];

export const WRONG_COLOR_CONFIG_MSG =
  "Your colour configuration couldn't be parsed. Loading the default color configuration.";

// ─── Log level helpers ────────────────────────────────────────────────────────

export type LogLevelName = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const LEVEL_VALUES: Record<LogLevelName, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50,
};

function levelToInt(level: string): number {
  return LEVEL_VALUES[level.toUpperCase() as LogLevelName] ?? 20;
}

/**
 * Python %(key)s-style and positional %s substitution.
 */
function formatMessage(
  template: string,
  args: Record<string, unknown> | readonly unknown[],
): string {
  if (Array.isArray(args)) {
    let idx = 0;
    return template.replace(/%s/g, () => {
      const val = (args as readonly unknown[])[idx++];
      return val !== undefined ? String(val) : "";
    });
  }
  return template.replace(/%\((\w+)\)s/g, (match, key: string) => {
    const val = (args as Record<string, unknown>)[key];
    return val !== undefined ? String(val) : match;
  });
}

// ─── LogRecord ───────────────────────────────────────────────────────────────

/**
 * Mirrors Python's `logging.LogRecord`.
 * Stores the raw template and args separately so formatters can redact args.
 */
export interface LogRecord {
  levelname: string;
  module: string;
  /** Raw message template (before arg substitution) */
  rawMessage: string;
  /** Substituted message (template + args applied) */
  message: string;
  args: Record<string, unknown> | readonly unknown[] | null;
  created: number;
}

// ─── Formatter ───────────────────────────────────────────────────────────────

export abstract class Formatter {
  abstract format(record: LogRecord): string;
}

/** Default formatter — returns the pre-formatted message string */
export class DefaultFormatter extends Formatter {
  format(record: LogRecord): string {
    return record.message;
  }
}

// ─── Handler base ────────────────────────────────────────────────────────────

export abstract class Handler {
  level: number;
  protected formatter: Formatter;

  constructor(level = 0) {
    this.level = level;
    this.formatter = new DefaultFormatter();
  }

  setFormatter(formatter: Formatter): void {
    this.formatter = formatter;
  }

  abstract emit(record: LogRecord): void;
}

// ─── ConsoleHandler ──────────────────────────────────────────────────────────

export class ConsoleHandler extends Handler {
  private cons: Console;
  private showTime: boolean;
  private keywords: string[];

  constructor(
    cons: Console,
    showTime = false,
    keywords: string[] = [],
    level = 0,
  ) {
    super(level);
    this.cons = cons;
    this.showTime = showTime;
    this.keywords = keywords;
  }

  emit(record: LogRecord): void {
    if (levelToInt(record.levelname) < this.level) return;

    let prefix = "";
    if (this.showTime) {
      prefix = `[${new Date(record.created).toISOString()}] `;
    }
    prefix += `${record.levelname.padEnd(8)} `;

    const formatted = this.formatter.format(record);
    this.cons.log(`${prefix}${formatted}`);
  }
}

// ─── FileHandler ─────────────────────────────────────────────────────────────

export class FileHandler extends Handler {
  private stream: fs.WriteStream;

  constructor(filePath: string, mode: "w" | "a" = "a", level = 0) {
    super(level);
    this.stream = fs.createWriteStream(filePath, {
      flags: mode === "w" ? "w" : "a",
      encoding: "utf-8",
    });
  }

  emit(record: LogRecord): void {
    if (levelToInt(record.levelname) < this.level) return;
    this.stream.write(this.formatter.format(record) + "\n");
  }

  close(): void {
    this.stream.end();
  }
}

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * Minimal logger mirroring Python's `logging.Logger` interface.
 */
export class Logger {
  name: string;
  level: number;
  propagate: boolean;
  private handlers: Handler[];

  constructor(name: string) {
    this.name = name;
    this.level = LEVEL_VALUES.WARNING;
    this.handlers = [];
    this.propagate = true;
  }

  addHandler(handler: Handler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: Handler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx !== -1) this.handlers.splice(idx, 1);
  }

  setLevel(level: string | number): void {
    this.level = typeof level === "number" ? level : levelToInt(level);
  }

  hasHandlers(): boolean {
    return this.handlers.length > 0;
  }

  private _log(
    levelname: LogLevelName,
    rawMessage: string,
    args?: Record<string, unknown> | readonly unknown[],
  ): void {
    if (LEVEL_VALUES[levelname] < this.level) return;

    const message = args ? formatMessage(rawMessage, args) : rawMessage;

    const record: LogRecord = {
      levelname,
      module: this.name,
      rawMessage,
      message,
      args: args ?? null,
      created: Date.now(),
    };

    for (const h of this.handlers) {
      h.emit(record);
    }
  }

  debug(msg: string, args?: Record<string, unknown>): void {
    this._log("DEBUG", msg, args);
  }

  info(msg: string, args?: Record<string, unknown>): void {
    this._log("INFO", msg, args);
  }

  warning(msg: string, args?: Record<string, unknown>): void {
    this._log("WARNING", msg, args);
  }

  error(msg: string, args?: Record<string, unknown>): void {
    this._log("ERROR", msg, args);
  }

  critical(msg: string, args?: Record<string, unknown>): void {
    this._log("CRITICAL", msg, args);
  }
}

// ─── Global logger registry ──────────────────────────────────────────────────

const _loggerRegistry = new Map<string, Logger>();

/** Mirrors Python's `logging.getLogger(name)`. */
export function getLogger(name: string): Logger {
  if (!_loggerRegistry.has(name)) {
    _loggerRegistry.set(name, new Logger(name));
  }
  return _loggerRegistry.get(name)!;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Make the manim logger and consoles.
 *
 * @param parser      A config section containing logger settings.
 * @param verbosity   The verbosity level (e.g. "DEBUG", "INFO").
 * @returns           `[logger, stdoutConsole, stderrConsole]`
 */
export function makeLogger(
  parser: LoggerConfigSection,
  verbosity: string,
): [Logger, Console, Console] {
  const cons = new Console({
    stdout: process.stdout,
    stderr: process.stderr,
    colorMode: false,
  });

  const errorConsole = new Console({
    stdout: process.stderr,
    stderr: process.stderr,
    colorMode: false,
  });

  const showTimestamps =
    (parser["log_timestamps"] ?? "false").toLowerCase() === "true";

  const consoleHandler = new ConsoleHandler(
    cons,
    showTimestamps,
    HIGHLIGHTED_KEYWORDS,
  );

  const logger = getLogger("manim");
  logger.addHandler(consoleHandler);
  logger.setLevel(verbosity);
  logger.propagate = false;

  // Mirror Python: if root logger has no handlers, attach ours
  const rootLogger = getLogger("root");
  if (!rootLogger.hasHandlers()) {
    rootLogger.addHandler(consoleHandler);
    rootLogger.setLevel(verbosity);
  }

  return [logger, cons, errorConsole];
}

/**
 * Configure the theme from parser config.
 *
 * @param parser  A config section.
 * @returns       A `ParsedTheme`, or `null` if the config couldn't be parsed.
 */
export function parseTheme(
  parser: LoggerConfigSection,
): ParsedTheme | null {
  try {
    return _parseThemeInternal(parser);
  } catch {
    console.error(WRONG_COLOR_CONFIG_MSG);
    return null;
  }
}

function _parseThemeInternal(parser: LoggerConfigSection): ParsedTheme {
  // Convert underscore-separated keys to dot-separated (mirrors Python replace)
  const rawTheme: Record<string, string> = {};
  for (const key of Object.keys(parser)) {
    rawTheme[key.replace(/_/g, ".")] = parser[key];
  }

  const logWidthRaw = rawTheme["log.width"] ?? "-1";
  const logHeightRaw = rawTheme["log.height"] ?? "-1";

  const logWidth = logWidthRaw === "-1" ? null : parseInt(logWidthRaw, 10);
  const logHeight = logHeightRaw === "-1" ? null : parseInt(logHeightRaw, 10);

  const styleExcludes = new Set(["log.width", "log.height", "log.timestamps"]);
  const styles: Theme = {};
  for (const [k, v] of Object.entries(rawTheme)) {
    if (!styleExcludes.has(k)) {
      styles[k] = v;
    }
  }

  // Validate hex color values — throw on bad input so caller can catch
  for (const v of Object.values(styles)) {
    if (typeof v === "string" && v.startsWith("#")) {
      if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
        throw new Error(`Invalid color value: ${v}`);
      }
    }
  }

  return { styles, logWidth, logHeight, logTimestamps: false };
}

/**
 * Add a file handler to the manim logger.
 *
 * The log file is named `<moduleName>_<sceneName>.log` and written to `logDir`.
 *
 * @param sceneName   Scene name, used in the log file name.
 * @param moduleName  Module name, used in the log file name.
 * @param logDir      Path to the folder where log files are stored.
 */
export function setFileLogger(
  sceneName: string,
  moduleName: string,
  logDir: string,
): void {
  const logFileName = `${moduleName}_${sceneName}.log`;
  const logFilePath = nodePath.join(logDir, logFileName);

  fs.mkdirSync(logDir, { recursive: true });

  const fileHandler = new FileHandler(logFilePath, "w");
  fileHandler.setFormatter(new JSONFormatter());

  const logger = getLogger("manim");
  logger.addHandler(fileHandler);
  logger.info("Log file will be saved in %(logpath)s", {
    logpath: logFilePath,
  });
}

// ─── JSONFormatter ───────────────────────────────────────────────────────────

/**
 * A formatter that outputs logs in a custom JSON format.
 *
 * This class is used internally for testing purposes.
 */
export class JSONFormatter extends Formatter {
  /**
   * Format the record in a custom JSON format.
   *
   * Args are deep-copied and all values replaced with `"<>"` before
   * formatting, so sensitive values are not written to the log file.
   */
  format(record: LogRecord): string {
    let redactedArgs: Record<string, string> | readonly string[] | null = null;

    if (record.args !== null) {
      if (Array.isArray(record.args)) {
        redactedArgs = (record.args as readonly unknown[]).map(() => "<>");
      } else {
        redactedArgs = Object.fromEntries(
          Object.keys(record.args as Record<string, unknown>).map((k) => [
            k,
            "<>",
          ]),
        );
      }
    }

    const message =
      redactedArgs !== null
        ? formatMessage(record.rawMessage, redactedArgs as Record<string, unknown>)
        : record.message;

    return JSON.stringify({
      levelname: record.levelname,
      module: record.module,
      message,
    });
  }
}
