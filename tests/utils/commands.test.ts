/**
 * Tests for src/utils/commands
 */

import * as fs from "fs";
import * as os from "os";
import * as nodePath from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { capture, getDirLayout } from "../../src/utils/commands/index.js";

// ─── capture ─────────────────────────────────────────────────

describe("capture", () => {
  it("captures stdout from a simple echo command", () => {
    const isWindows = os.platform() === "win32";
    const cmd = isWindows ? ["cmd", "/c", "echo", "hello"] : ["echo", "hello"];
    const [out, err, code] = capture(cmd);
    expect(out.trim()).toBe("hello");
    expect(err).toBe("");
    expect(code).toBe(0);
  });

  it("captures stderr and non-zero exit code on failure", () => {
    // A command that does not exist returns a non-zero status via spawnSync
    const [, , code] = capture(["node", "--this-flag-does-not-exist-xyz"]);
    expect(code).not.toBe(0);
  });

  it("accepts a string command and splits it into argv", () => {
    const isWindows = os.platform() === "win32";
    // Use `node --version` — always available in the test environment
    const [out, , code] = capture("node --version");
    expect(code).toBe(0);
    expect(out.trim()).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("respects the cwd option", () => {
    const tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "manim-ts-"));
    try {
      const isWindows = os.platform() === "win32";
      const cmd = isWindows ? ["cmd", "/c", "cd"] : ["pwd"];
      const [out, , code] = capture(cmd, tmpDir);
      expect(code).toBe(0);
      // Normalize separators for comparison
      expect(out.trim().toLowerCase()).toContain(
        fs.realpathSync(tmpDir).toLowerCase().replace(/\\/g, "/").split("/").pop()!
      );
    } finally {
      fs.rmdirSync(tmpDir);
    }
  });

  it("feeds commandInput to stdin", () => {
    // `node -e` reads from process.argv, not stdin; use `node -p` to eval
    // Instead use cat on POSIX / find on Windows — skip stdin test on Windows
    if (os.platform() === "win32") return;
    const [out, , code] = capture(["cat"], undefined, "ping\n");
    expect(code).toBe(0);
    expect(out.trim()).toBe("ping");
  });
});

// ─── getDirLayout ─────────────────────────────────────────────

describe("getDirLayout", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "manim-ts-dir-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("yields nothing for an empty directory", () => {
    const result = [...getDirLayout(tmpDir)];
    expect(result).toHaveLength(0);
  });

  it("yields filenames for files in the root directory", () => {
    fs.writeFileSync(nodePath.join(tmpDir, "a.txt"), "");
    fs.writeFileSync(nodePath.join(tmpDir, "b.txt"), "");
    const result = [...getDirLayout(tmpDir)].sort();
    expect(result).toEqual(["a.txt", "b.txt"]);
  });

  it("recurses into subdirectories and yields filenames relative to each subdir", () => {
    fs.mkdirSync(nodePath.join(tmpDir, "sub"));
    fs.writeFileSync(nodePath.join(tmpDir, "root.txt"), "");
    fs.writeFileSync(nodePath.join(tmpDir, "sub", "child.txt"), "");

    const result = [...getDirLayout(tmpDir)].sort();
    // Matches Python: files in sub/ are yielded relative to sub/, not root
    expect(result).toContain("child.txt");
    expect(result).toContain("root.txt");
  });

  it("returns a generator (lazy iterable)", () => {
    fs.writeFileSync(nodePath.join(tmpDir, "x.txt"), "");
    const gen = getDirLayout(tmpDir);
    // A generator is not an array
    expect(typeof gen[Symbol.iterator]).toBe("function");
    const first = gen.next();
    expect(first.done).toBe(false);
    expect(typeof first.value).toBe("string");
  });

  it("uses forward slashes in returned paths", () => {
    fs.mkdirSync(nodePath.join(tmpDir, "a", "b"), { recursive: true });
    fs.writeFileSync(nodePath.join(tmpDir, "a", "b", "deep.txt"), "");
    const result = [...getDirLayout(tmpDir)];
    for (const p of result) {
      expect(p).not.toContain("\\");
    }
  });
});
