import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DefaultGroup,
  type Command,
  type Context,
} from "../../src/cli/default_group/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCmd(name: string): Command {
  return { name, callback: vi.fn() };
}

function makeCtx(): Context {
  return { meta: {} };
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe("DefaultGroup constructor", () => {
  it("creates with defaults when no options supplied", () => {
    const g = new DefaultGroup();
    expect(g.defaultCmdName).toBeNull();
    expect(g.defaultIfNoArgs).toBe(false);
    expect(g.ignoreUnknownOptions).toBe(true);
    expect(g.commands.size).toBe(0);
  });

  it("accepts 'default' option", () => {
    const g = new DefaultGroup({ default: "render" });
    expect(g.defaultCmdName).toBe("render");
  });

  it("accepts 'defaultIfNoArgs' option", () => {
    const g = new DefaultGroup({ defaultIfNoArgs: true });
    expect(g.defaultIfNoArgs).toBe(true);
  });

  it("throws when ignoreUnknownOptions is explicitly false", () => {
    expect(() => new DefaultGroup({ ignoreUnknownOptions: false })).toThrow(
      "Default group accepts unknown options",
    );
  });

  it("ignoreUnknownOptions is always true regardless of option value", () => {
    const g = new DefaultGroup({ ignoreUnknownOptions: true });
    expect(g.ignoreUnknownOptions).toBe(true);
  });
});

// ─── addCommand / setDefaultCommand ──────────────────────────────────────────

describe("addCommand", () => {
  it("registers a command by name", () => {
    const g = new DefaultGroup();
    const cmd = makeCmd("render");
    g.addCommand(cmd);
    expect(g.commands.get("render")).toBe(cmd);
  });

  it("ignores commands with null name", () => {
    const g = new DefaultGroup();
    g.addCommand({ name: null });
    expect(g.commands.size).toBe(0);
  });

  it("overwrites a command with the same name", () => {
    const g = new DefaultGroup();
    const first = makeCmd("render");
    const second = makeCmd("render");
    g.addCommand(first);
    g.addCommand(second);
    expect(g.commands.get("render")).toBe(second);
  });
});

describe("setDefaultCommand", () => {
  it("registers the command and sets defaultCmdName", () => {
    const g = new DefaultGroup();
    const cmd = makeCmd("render");
    g.setDefaultCommand(cmd);
    expect(g.commands.get("render")).toBe(cmd);
    expect(g.defaultCmdName).toBe("render");
  });

  it("overrides a previously set default", () => {
    const g = new DefaultGroup({ default: "cfg" });
    const cmd = makeCmd("render");
    g.setDefaultCommand(cmd);
    expect(g.defaultCmdName).toBe("render");
  });
});

// ─── parseArgs ───────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("returns args unchanged when non-empty", () => {
    const g = new DefaultGroup({ default: "render", defaultIfNoArgs: true });
    const ctx = makeCtx();
    const result = g.parseArgs(ctx, ["my-scene.py"]);
    expect(result).toEqual(["my-scene.py"]);
  });

  it("prepends default command when args is empty and defaultIfNoArgs is true", () => {
    const g = new DefaultGroup({ default: "render", defaultIfNoArgs: true });
    const ctx = makeCtx();
    const args: string[] = [];
    const result = g.parseArgs(ctx, args);
    expect(result).toEqual(["render"]);
    // mutates in-place
    expect(args).toEqual(["render"]);
  });

  it("does not prepend when defaultIfNoArgs is false", () => {
    const g = new DefaultGroup({ default: "render", defaultIfNoArgs: false });
    const ctx = makeCtx();
    const result = g.parseArgs(ctx, []);
    expect(result).toEqual([]);
  });

  it("does not prepend when no default command is set", () => {
    const g = new DefaultGroup({ defaultIfNoArgs: true });
    const ctx = makeCtx();
    const result = g.parseArgs(ctx, []);
    expect(result).toEqual([]);
  });
});

// ─── getCommand ──────────────────────────────────────────────────────────────

describe("getCommand", () => {
  let g: DefaultGroup;
  let renderCmd: Command;
  let cfgCmd: Command;

  beforeEach(() => {
    g = new DefaultGroup({ default: "render" });
    renderCmd = makeCmd("render");
    cfgCmd = makeCmd("cfg");
    g.addCommand(renderCmd);
    g.addCommand(cfgCmd);
  });

  it("returns a known command by name", () => {
    const ctx = makeCtx();
    expect(g.getCommand(ctx, "cfg")).toBe(cfgCmd);
  });

  it("falls back to the default command for an unknown name", () => {
    const ctx = makeCtx();
    const result = g.getCommand(ctx, "my-scene.py");
    expect(result).toBe(renderCmd);
  });

  it("sets ctx.meta.arg0 to the unrecognised token", () => {
    const ctx = makeCtx();
    g.getCommand(ctx, "my-scene.py");
    expect(ctx.meta["arg0"]).toBe("my-scene.py");
  });

  it("returns null when no default is configured and name is unknown", () => {
    const g2 = new DefaultGroup();
    g2.addCommand(makeCmd("render"));
    const ctx = makeCtx();
    expect(g2.getCommand(ctx, "unknown")).toBeNull();
  });

  it("does not set arg0 when the name matches a known command", () => {
    const ctx = makeCtx();
    g.getCommand(ctx, "render");
    expect("arg0" in ctx.meta).toBe(false);
  });
});

// ─── resolveCommand ───────────────────────────────────────────────────────────

describe("resolveCommand", () => {
  let g: DefaultGroup;
  let renderCmd: Command;

  beforeEach(() => {
    g = new DefaultGroup({ default: "render" });
    renderCmd = makeCmd("render");
    g.addCommand(renderCmd);
    g.addCommand(makeCmd("cfg"));
  });

  it("resolves a known command and strips it from remaining args", () => {
    const ctx = makeCtx();
    const [name, cmd, rest] = g.resolveCommand(ctx, ["cfg", "--verbose"]);
    expect(name).toBe("cfg");
    expect(cmd?.name).toBe("cfg");
    expect(rest).toEqual(["--verbose"]);
  });

  it("routes unknown token to default and re-inserts token as first arg", () => {
    const ctx = makeCtx();
    const [name, cmd, rest] = g.resolveCommand(ctx, ["my-scene.py", "--quality", "h"]);
    expect(name).toBe("render");
    expect(cmd).toBe(renderCmd);
    // original token prepended to remaining args
    expect(rest[0]).toBe("my-scene.py");
    expect(rest).toEqual(["my-scene.py", "--quality", "h"]);
  });

  it("returns [null, null, []] for empty args", () => {
    const ctx = makeCtx();
    const [name, cmd, rest] = g.resolveCommand(ctx, []);
    expect(name).toBeNull();
    expect(cmd).toBeNull();
    expect(rest).toEqual([]);
  });

  it("returns cmd.name (not the original token) when redirected", () => {
    const ctx = makeCtx();
    const [name] = g.resolveCommand(ctx, ["unknown-file.py"]);
    expect(name).toBe("render");
  });
});

// ─── command() (deprecated) ───────────────────────────────────────────────────

describe("DefaultGroup.command (deprecated)", () => {
  it("registers a function as a command", () => {
    const g = new DefaultGroup();
    const decorator = g.command();
    function renderFn() { return "rendered"; }
    const cmd = decorator(renderFn);
    expect(cmd.name).toBe("renderFn");
    expect(g.commands.has("renderFn")).toBe(true);
  });

  it("registers as default when options.default is true", () => {
    const g = new DefaultGroup();
    const decorator = g.command({ default: true });
    function renderFn() { return "rendered"; }
    decorator(renderFn);
    expect(g.defaultCmdName).toBe("renderFn");
  });

  it("does not set as default when options.default is false or absent", () => {
    const g = new DefaultGroup();
    const decorator = g.command({ default: false });
    function cfgFn() { return "config"; }
    decorator(cfgFn);
    expect(g.defaultCmdName).toBeNull();
  });

  it("returned command has the correct callback", () => {
    const g = new DefaultGroup();
    const decorator = g.command();
    function myCmd() { return "result"; }
    const cmd = decorator(myCmd);
    expect(cmd.callback).toBe(myCmd);
  });
});

// ─── Integration: full routing flow ───────────────────────────────────────────

describe("full routing flow", () => {
  it("manim <file> routes to render with file as first positional", () => {
    const g = new DefaultGroup({ default: "render", defaultIfNoArgs: true });
    g.addCommand(makeCmd("render"));
    g.addCommand(makeCmd("cfg"));

    const ctx = makeCtx();
    // Simulate: user types `manim scene.py --quality h`
    const args = g.parseArgs(ctx, ["scene.py", "--quality", "h"]);
    const [name, cmd, rest] = g.resolveCommand(ctx, args);

    expect(name).toBe("render");
    expect(cmd?.name).toBe("render");
    expect(rest).toEqual(["scene.py", "--quality", "h"]);
  });

  it("manim render <file> routes to render directly", () => {
    const g = new DefaultGroup({ default: "render" });
    g.addCommand(makeCmd("render"));

    const ctx = makeCtx();
    const args = g.parseArgs(ctx, ["render", "scene.py"]);
    const [name, cmd, rest] = g.resolveCommand(ctx, args);

    expect(name).toBe("render");
    expect(cmd?.name).toBe("render");
    expect(rest).toEqual(["scene.py"]);
  });

  it("manim with no args routes to render when defaultIfNoArgs is true", () => {
    const g = new DefaultGroup({ default: "render", defaultIfNoArgs: true });
    g.addCommand(makeCmd("render"));

    const ctx = makeCtx();
    const args = g.parseArgs(ctx, []);
    expect(args).toEqual(["render"]);

    const [name, cmd] = g.resolveCommand(ctx, args);
    expect(name).toBe("render");
    expect(cmd?.name).toBe("render");
  });
});
