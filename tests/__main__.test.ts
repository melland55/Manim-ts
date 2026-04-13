/**
 * Tests for src/__main__/main.ts
 *
 * Covers: showSplash, printVersionAndExit, mainGroup structure, main() routing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showSplash, printVersionAndExit, mainGroup, main } from "../src/__main__/main.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Capture manimConsole.print calls without importing the live console. */
let printedLines: string[];
let procesExitCode: number | undefined;

beforeEach(() => {
  printedLines = [];
  procesExitCode = undefined;

  // Stub manimConsole at the module level via global spy on process.stdout
  vi.spyOn(process, "exit").mockImplementation((code?: number | string) => {
    procesExitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit(${code})`);
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── showSplash ───────────────────────────────────────────────────────────────

describe("showSplash", () => {
  it("does nothing when value is null", () => {
    // manimConsole.print should not be called
    // We check indirectly: no side-effects visible via process.exit
    expect(() => showSplash(null)).not.toThrow();
  });

  it("does nothing when value is undefined", () => {
    expect(() => showSplash(undefined)).not.toThrow();
  });

  it("does nothing when value is empty string", () => {
    expect(() => showSplash("")).not.toThrow();
  });

  it("does not throw when a non-empty value is given", () => {
    // showSplash calls manimConsole.print — just verify it doesn't throw
    expect(() => showSplash("show")).not.toThrow();
  });
});

// ─── printVersionAndExit ──────────────────────────────────────────────────────

describe("printVersionAndExit", () => {
  it("does nothing when value is null", () => {
    expect(() => printVersionAndExit(null)).not.toThrow();
    expect(procesExitCode).toBeUndefined();
  });

  it("calls process.exit(0) when a non-empty value is given", () => {
    expect(() => printVersionAndExit("version")).toThrow("process.exit(0)");
    expect(procesExitCode).toBe(0);
  });

  it("does not exit for empty string", () => {
    expect(() => printVersionAndExit("")).not.toThrow();
    expect(procesExitCode).toBeUndefined();
  });
});

// ─── mainGroup ────────────────────────────────────────────────────────────────

describe("mainGroup", () => {
  it("has 'render' as the default command", () => {
    expect(mainGroup.defaultCmdName).toBe("render");
  });

  it("has all five subcommands registered", () => {
    expect(mainGroup.commands.has("checkhealth")).toBe(true);
    expect(mainGroup.commands.has("cfg")).toBe(true);
    expect(mainGroup.commands.has("plugins")).toBe(true);
    expect(mainGroup.commands.has("init")).toBe(true);
    expect(mainGroup.commands.has("render")).toBe(true);
  });

  it("routes unknown tokens to render via DefaultGroup", () => {
    const ctx = { meta: {} };
    const [, cmd] = mainGroup.resolveCommand(ctx, ["myfile.py"]);
    expect(cmd?.name).toBe("render");
  });

  it("resolves 'checkhealth' directly", () => {
    const ctx = { meta: {} };
    const [, cmd] = mainGroup.resolveCommand(ctx, ["checkhealth"]);
    expect(cmd?.name).toBe("checkhealth");
  });

  it("resolves 'cfg' directly", () => {
    const ctx = { meta: {} };
    const [, cmd] = mainGroup.resolveCommand(ctx, ["cfg"]);
    expect(cmd?.name).toBe("cfg");
  });
});

// ─── main() ───────────────────────────────────────────────────────────────────

describe("main", () => {
  it("exits with 0 when --version is passed", async () => {
    await expect(main(["--version"])).rejects.toThrow("process.exit(0)");
    expect(procesExitCode).toBe(0);
  });

  it("exits with 0 when --help is passed", async () => {
    await expect(main(["--help"])).rejects.toThrow("process.exit(0)");
    expect(procesExitCode).toBe(0);
  });

  it("exits with 0 when -h is passed", async () => {
    await expect(main(["-h"])).rejects.toThrow("process.exit(0)");
    expect(procesExitCode).toBe(0);
  });

  it("exits with 0 when no arguments are given (no_args_is_help)", async () => {
    await expect(main([])).rejects.toThrow("process.exit(0)");
    expect(procesExitCode).toBe(0);
  });
});
