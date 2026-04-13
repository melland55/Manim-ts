/**
 * Logger and console utilities for manim-ts.
 * Mirrors manim/_config/logger_utils.py — provides structured logging
 * and rich-style console output using Node's built-in console.
 */

// ─── Log levels ───────────────────────────────────────────────

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

// ─── Logger ───────────────────────────────────────────────────

export class ManimLogger {
  private _level: LogLevel;

  constructor(level: LogLevel = "WARNING") {
    this._level = level;
  }

  get level(): LogLevel { return this._level; }
  set level(value: LogLevel) { this._level = value; }

  private _shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this._level];
  }

  private _format(level: LogLevel, message: string): string {
    const ts = new Date().toISOString();
    return `[${ts}] [manim] [${level}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this._shouldLog("DEBUG")) {
      console.debug(this._format("DEBUG", message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this._shouldLog("INFO")) {
      console.info(this._format("INFO", message), ...args);
    }
  }

  warning(message: string, ...args: unknown[]): void {
    if (this._shouldLog("WARNING")) {
      console.warn(this._format("WARNING", message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this._shouldLog("ERROR")) {
      console.error(this._format("ERROR", message), ...args);
    }
  }

  critical(message: string, ...args: unknown[]): void {
    if (this._shouldLog("CRITICAL")) {
      console.error(this._format("CRITICAL", message), ...args);
    }
  }

  /** Alias for warning — mirrors Python logger.warn(). */
  warn = this.warning.bind(this);
}

// ─── Console (rich-style print surface) ───────────────────────

export class ManimConsole {
  print(message: string = "", ...args: unknown[]): void {
    console.log(message, ...args);
  }

  log(message: string = "", ...args: unknown[]): void {
    console.log(message, ...args);
  }
}

// ─── Error console (stderr) ───────────────────────────────────

export class ManimErrorConsole {
  print(message: string = "", ...args: unknown[]): void {
    console.error(message, ...args);
  }

  log(message: string = "", ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

// ─── Factory ──────────────────────────────────────────────────

export interface LoggerSection {
  logging_keyword?: string;
  log_to_file?: string;
}

export function makeLogger(
  loggerSection: LoggerSection,
  verbosity: string = "WARNING"
): [ManimLogger, ManimConsole, ManimErrorConsole] {
  const level = (verbosity.toUpperCase() as LogLevel) in LOG_LEVEL_ORDER
    ? (verbosity.toUpperCase() as LogLevel)
    : "WARNING";

  const manimLogger = new ManimLogger(level);
  const manimConsole = new ManimConsole();
  const manimErrorConsole = new ManimErrorConsole();

  return [manimLogger, manimConsole, manimErrorConsole];
}
