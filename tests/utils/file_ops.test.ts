import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  MANIM_VERSION,
  addExtensionIfNotPresent,
  addVersionBeforeExtension,
  guaranteeExistence,
  guaranteeEmptyExistence,
  seekFullPathFromDefaults,
  modifyAtime,
  isMP4Format,
  isGIFFormat,
  isPNGFormat,
  isWebMFormat,
  isMOVFormat,
  writeToMovie,
  ensureExecutable,
} from "../../src/utils/file_ops/index.js";

// ─── addExtensionIfNotPresent ──────────────────────────────────

describe("addExtensionIfNotPresent", () => {
  it("appends extension when file has no extension", () => {
    expect(addExtensionIfNotPresent("output", ".mp4")).toBe("output.mp4");
  });

  it("returns unchanged path when extension already present", () => {
    expect(addExtensionIfNotPresent("output.mp4", ".mp4")).toBe("output.mp4");
  });

  it("concatenates new extension onto a different existing extension", () => {
    // Mirrors Python Path.with_suffix(existing + new) behaviour
    expect(addExtensionIfNotPresent("archive.tar", ".gz")).toBe("archive.tar.gz");
  });

  it("handles dotfile names (no extension)", () => {
    expect(addExtensionIfNotPresent(".hidden", ".mp4")).toBe(".hidden.mp4");
  });
});

// ─── addVersionBeforeExtension ────────────────────────────────

describe("addVersionBeforeExtension", () => {
  it("inserts version string before extension", () => {
    const result = addVersionBeforeExtension("output.mp4");
    expect(result).toBe(`output_ManimCE_v${MANIM_VERSION}.mp4`);
  });

  it("preserves directory path", () => {
    const result = addVersionBeforeExtension(
      path.join("media", "videos", "output.mp4")
    );
    expect(path.basename(result)).toBe(
      `output_ManimCE_v${MANIM_VERSION}.mp4`
    );
    expect(result).toContain("media");
    expect(result).toContain("videos");
  });

  it("works with png extension", () => {
    const result = addVersionBeforeExtension("frame.png");
    expect(result).toBe(`frame_ManimCE_v${MANIM_VERSION}.png`);
  });
});

// ─── guaranteeExistence ───────────────────────────────────────

describe("guaranteeExistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `manim-ts-gex-${Date.now()}`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a directory that does not yet exist", () => {
    const result = guaranteeExistence(tmpDir);
    expect(fs.existsSync(result)).toBe(true);
    expect(path.isAbsolute(result)).toBe(true);
  });

  it("succeeds when the directory already exists", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const result = guaranteeExistence(tmpDir);
    expect(fs.existsSync(result)).toBe(true);
  });

  it("creates deeply nested directories", () => {
    const nested = path.join(tmpDir, "a", "b", "c");
    const result = guaranteeExistence(nested);
    expect(fs.existsSync(result)).toBe(true);
  });
});

// ─── guaranteeEmptyExistence ──────────────────────────────────

describe("guaranteeEmptyExistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `manim-ts-gee-${Date.now()}`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates an empty directory when path does not exist", () => {
    const result = guaranteeEmptyExistence(tmpDir);
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readdirSync(result)).toHaveLength(0);
  });

  it("empties a directory that already contains files", () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "leftover.txt"), "data");
    fs.mkdirSync(path.join(tmpDir, "sub"), { recursive: true });

    const result = guaranteeEmptyExistence(tmpDir);
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readdirSync(result)).toHaveLength(0);
  });

  it("returns the resolved absolute path", () => {
    const result = guaranteeEmptyExistence(tmpDir);
    expect(path.isAbsolute(result)).toBe(true);
  });
});

// ─── seekFullPathFromDefaults ─────────────────────────────────

describe("seekFullPathFromDefaults", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `manim-ts-seek-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds a file by exact path", () => {
    const filePath = path.join(tmpDir, "exact.svg");
    fs.writeFileSync(filePath, "");
    const result = seekFullPathFromDefaults(filePath, tmpDir, []);
    expect(result).toBe(filePath);
  });

  it("finds a file in defaultDir with a matching extension", () => {
    fs.writeFileSync(path.join(tmpDir, "scene.svg"), "");
    const result = seekFullPathFromDefaults("scene", tmpDir, [".svg", ".png"]);
    expect(result).toBe(path.join(tmpDir, "scene.svg"));
  });

  it("finds a file in defaultDir with no extra extension", () => {
    fs.writeFileSync(path.join(tmpDir, "readme"), "");
    const result = seekFullPathFromDefaults("readme", tmpDir, [".md"]);
    expect(result).toBe(path.join(tmpDir, "readme"));
  });

  it("throws an error when file is not found anywhere", () => {
    expect(() =>
      seekFullPathFromDefaults("nonexistent", tmpDir, [".mp4", ".svg"])
    ).toThrow(/could not find nonexistent/);
  });
});

// ─── modifyAtime ──────────────────────────────────────────────

describe("modifyAtime", () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `manim-ts-atime-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "content");
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it("completes without throwing", () => {
    expect(() => modifyAtime(tmpFile)).not.toThrow();
  });

  it("updates atime to approximately now", () => {
    modifyAtime(tmpFile);
    const stat = fs.statSync(tmpFile);
    expect(Math.abs(stat.atimeMs - Date.now())).toBeLessThan(5_000);
  });

  it("preserves mtime unchanged", () => {
    const before = fs.statSync(tmpFile).mtimeMs;
    modifyAtime(tmpFile);
    const after = fs.statSync(tmpFile).mtimeMs;
    expect(Math.abs(after - before)).toBeLessThan(1_000);
  });
});

// ─── format predicates ────────────────────────────────────────

describe("format predicates", () => {
  it("isMP4Format: true for mp4, false for others", () => {
    expect(isMP4Format({ format: "mp4" })).toBe(true);
    expect(isMP4Format({ format: "gif" })).toBe(false);
    expect(isMP4Format({ format: "png" })).toBe(false);
  });

  it("isGIFFormat: true for gif only", () => {
    expect(isGIFFormat({ format: "gif" })).toBe(true);
    expect(isGIFFormat({ format: "mp4" })).toBe(false);
  });

  it("isPNGFormat: true for png only", () => {
    expect(isPNGFormat({ format: "png" })).toBe(true);
    expect(isPNGFormat({ format: "mp4" })).toBe(false);
  });

  it("isWebMFormat: true for webm only", () => {
    expect(isWebMFormat({ format: "webm" })).toBe(true);
    expect(isWebMFormat({ format: "mp4" })).toBe(false);
  });

  it("isMOVFormat: true for mov only", () => {
    expect(isMOVFormat({ format: "mov" })).toBe(true);
    expect(isMOVFormat({ format: "mp4" })).toBe(false);
  });
});

// ─── writeToMovie ─────────────────────────────────────────────

describe("writeToMovie", () => {
  it("returns false for png regardless of writeToMovie flag", () => {
    expect(writeToMovie({ format: "png", writeToMovie: true })).toBe(false);
    expect(writeToMovie({ format: "png", writeToMovie: false })).toBe(false);
  });

  it("returns true for mp4 even when flag is false", () => {
    expect(writeToMovie({ format: "mp4", writeToMovie: false })).toBe(true);
  });

  it("returns true for gif", () => {
    expect(writeToMovie({ format: "gif", writeToMovie: false })).toBe(true);
  });

  it("returns true for webm", () => {
    expect(writeToMovie({ format: "webm", writeToMovie: false })).toBe(true);
  });

  it("returns true for mov", () => {
    expect(writeToMovie({ format: "mov", writeToMovie: false })).toBe(true);
  });

  it("returns true for unknown format when flag is set", () => {
    expect(writeToMovie({ format: "avi", writeToMovie: true })).toBe(true);
  });

  it("returns false for unknown format when flag is not set", () => {
    expect(writeToMovie({ format: "avi", writeToMovie: false })).toBe(false);
  });
});

// ─── ensureExecutable ─────────────────────────────────────────

describe("ensureExecutable", () => {
  it("returns true for node (always in PATH during test run)", () => {
    expect(ensureExecutable("node")).toBe(true);
  });

  it("returns false for a non-existent executable name", () => {
    expect(ensureExecutable("definitely-not-a-real-exe-xyz-99999")).toBe(false);
  });
});
