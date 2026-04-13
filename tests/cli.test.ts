import { describe, it, expect } from "vitest";
import {
  CLI_COMMANDS,
  type CliCommandName,
  type GlobalCliOptions,
} from "../src/cli/index.js";

describe("CLI_COMMANDS", () => {
  it("contains the five expected command names", () => {
    expect(CLI_COMMANDS).toEqual(["cfg", "checkhealth", "init", "plugins", "render"]);
  });

  it("is a readonly tuple with exactly 5 entries", () => {
    expect(CLI_COMMANDS).toHaveLength(5);
  });

  it("includes the render command (default action)", () => {
    expect(CLI_COMMANDS).toContain("render");
  });

  it("includes cfg, checkhealth, init, and plugins", () => {
    const expected: CliCommandName[] = ["cfg", "checkhealth", "init", "plugins"];
    for (const cmd of expected) {
      expect(CLI_COMMANDS).toContain(cmd);
    }
  });

  it("contains only string values", () => {
    for (const cmd of CLI_COMMANDS) {
      expect(typeof cmd).toBe("string");
    }
  });

  it("has no duplicate command names", () => {
    const unique = new Set(CLI_COMMANDS);
    expect(unique.size).toBe(CLI_COMMANDS.length);
  });
});

describe("GlobalCliOptions type", () => {
  it("accepts an empty options object", () => {
    const opts: GlobalCliOptions = {};
    expect(opts).toBeDefined();
  });

  it("accepts all optional fields", () => {
    const opts: GlobalCliOptions = {
      configFile: "/path/to/manim.cfg",
      mediaDir: "./media",
      quiet: true,
      verbose: false,
    };
    expect(opts.configFile).toBe("/path/to/manim.cfg");
    expect(opts.mediaDir).toBe("./media");
    expect(opts.quiet).toBe(true);
    expect(opts.verbose).toBe(false);
  });

  it("quiet and verbose are independent boolean flags", () => {
    const quietOnly: GlobalCliOptions = { quiet: true };
    const verboseOnly: GlobalCliOptions = { verbose: true };
    expect(quietOnly.quiet).toBe(true);
    expect(quietOnly.verbose).toBeUndefined();
    expect(verboseOnly.verbose).toBe(true);
    expect(verboseOnly.quiet).toBeUndefined();
  });
});
