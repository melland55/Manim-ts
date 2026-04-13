import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  makeLogger,
  parseTheme,
  setFileLogger,
  JSONFormatter,
  Logger,
  FileHandler,
  ConsoleHandler,
  getLogger,
  HIGHLIGHTED_KEYWORDS,
  WRONG_COLOR_CONFIG_MSG,
} from "../../src/_config/logger_utils/index.js";
import type { LogRecord, LoggerConfigSection } from "../../src/_config/logger_utils/index.js";
import { Console } from "console";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    levelname: "INFO",
    module: "test",
    rawMessage: "hello world",
    message: "hello world",
    args: null,
    created: Date.now(),
    ...overrides,
  };
}

// ─── HIGHLIGHTED_KEYWORDS ─────────────────────────────────────────────────────

describe("HIGHLIGHTED_KEYWORDS", () => {
  it("contains expected keywords", () => {
    expect(HIGHLIGHTED_KEYWORDS).toContain("Played");
    expect(HIGHLIGHTED_KEYWORDS).toContain("Rendering");
    expect(HIGHLIGHTED_KEYWORDS).toContain("Invalid");
  });
});

// ─── parseTheme ──────────────────────────────────────────────────────────────

describe("parseTheme", () => {
  it("converts underscore keys to dot-separated", () => {
    const parser: LoggerConfigSection = {
      log_width: "-1",
      log_height: "-1",
      logging_level_info: "bold green",
    };
    const result = parseTheme(parser);
    expect(result).not.toBeNull();
    expect(result!.styles["logging.level.info"]).toBe("bold green");
  });

  it("maps log_width=-1 to null", () => {
    const result = parseTheme({ log_width: "-1", log_height: "-1" });
    expect(result!.logWidth).toBeNull();
  });

  it("maps log_height to integer when not -1", () => {
    const result = parseTheme({ log_width: "-1", log_height: "600" });
    expect(result!.logHeight).toBe(600);
  });

  it("excludes log.width / log.height / log.timestamps from styles", () => {
    const result = parseTheme({ log_width: "-1", log_height: "-1", log_timestamps: "false" });
    expect(result!.styles).not.toHaveProperty("log.width");
    expect(result!.styles).not.toHaveProperty("log.height");
    expect(result!.styles).not.toHaveProperty("log.timestamps");
  });

  it("returns null and prints warning on bad hex color", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = parseTheme({ log_width: "-1", log_height: "-1", accent_color: "#ZZZZZZ" });
    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(WRONG_COLOR_CONFIG_MSG);
    errSpy.mockRestore();
  });

  it("accepts valid 6-digit hex colors", () => {
    const result = parseTheme({
      log_width: "-1",
      log_height: "-1",
      accent_color: "#FC6255",
    });
    expect(result).not.toBeNull();
    expect(result!.styles["accent.color"]).toBe("#FC6255");
  });
});

// ─── makeLogger ──────────────────────────────────────────────────────────────

describe("makeLogger", () => {
  it("returns [Logger, Console, Console]", () => {
    const [logger, cons, errCons] = makeLogger({ log_timestamps: "false" }, "DEBUG");
    expect(logger).toBeInstanceOf(Logger);
    expect(cons).toBeInstanceOf(Console);
    expect(errCons).toBeInstanceOf(Console);
  });

  it("sets the verbosity level on the logger", () => {
    const [logger] = makeLogger({}, "ERROR");
    // ERROR = 40; lower-level messages should be suppressed
    expect(logger.level).toBe(40);
  });

  it("logger.propagate is false", () => {
    const [logger] = makeLogger({}, "INFO");
    expect(logger.propagate).toBe(false);
  });
});

// ─── JSONFormatter ───────────────────────────────────────────────────────────

describe("JSONFormatter", () => {
  const fmt = new JSONFormatter();

  it("formats a basic record as JSON", () => {
    const record = makeRecord();
    const result = JSON.parse(fmt.format(record));
    expect(result).toMatchObject({
      levelname: "INFO",
      module: "test",
      message: "hello world",
    });
  });

  it("redacts dict args — all values become '<>'", () => {
    const record = makeRecord({
      rawMessage: "key=%(key)s",
      message: "key=secret",
      args: { key: "secret" },
    });
    const result = JSON.parse(fmt.format(record));
    expect(result.message).not.toContain("secret");
    expect(result.message).toContain("<>");
  });

  it("redacts positional args — all become '<>'", () => {
    const record = makeRecord({
      rawMessage: "value is %s",
      message: "value is 42",
      args: [42],
    });
    const result = JSON.parse(fmt.format(record));
    expect(result.message).not.toContain("42");
    expect(result.message).toContain("<>");
  });

  it("null args leaves message unchanged", () => {
    const record = makeRecord({ args: null });
    const result = JSON.parse(fmt.format(record));
    expect(result.message).toBe("hello world");
  });

  it("output is valid JSON", () => {
    const record = makeRecord({ args: { path: "/some/path" } });
    expect(() => JSON.parse(fmt.format(record))).not.toThrow();
  });
});

// ─── setFileLogger ───────────────────────────────────────────────────────────

describe("setFileLogger", () => {
  it("creates a log file and writes JSON to it", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manim-test-"));
    try {
      // Re-use the manim logger created in the makeLogger test
      makeLogger({}, "DEBUG");
      setFileLogger("TestScene", "test_module", tmpDir);

      const expectedFile = path.join(tmpDir, "test_module_TestScene.log");
      // Give the async stream a tick to flush
      await new Promise((r) => setTimeout(r, 50));
      expect(fs.existsSync(expectedFile)).toBe(true);

      const content = fs.readFileSync(expectedFile, "utf-8").trim();
      if (content.length > 0) {
        const line = JSON.parse(content.split("\n")[0]);
        expect(line).toHaveProperty("levelname");
        expect(line).toHaveProperty("module");
        expect(line).toHaveProperty("message");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
