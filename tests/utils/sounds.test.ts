import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { getFullSoundFilePath } from "../../src/utils/sounds/index.js";

// ─── helpers ──────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "manim-sounds-test-"));
}

function touch(filePath: string): void {
  fs.writeFileSync(filePath, "");
}

// ─── getFullSoundFilePath ──────────────────────────────────────

describe("getFullSoundFilePath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds a .wav file in the assets directory", () => {
    touch(path.join(tmpDir, "beep.wav"));
    const result = getFullSoundFilePath("beep", tmpDir);
    expect(result).toBe(path.join(tmpDir, "beep.wav"));
  });

  it("finds a .mp3 file in the assets directory", () => {
    touch(path.join(tmpDir, "music.mp3"));
    const result = getFullSoundFilePath("music", tmpDir);
    expect(result).toBe(path.join(tmpDir, "music.mp3"));
  });

  it("returns path as-is when sound file already has the full path", () => {
    const fullPath = path.join(tmpDir, "alert.wav");
    touch(fullPath);
    const result = getFullSoundFilePath(fullPath, tmpDir);
    expect(result).toBe(fullPath);
  });

  it("throws when the sound file cannot be found", () => {
    expect(() => getFullSoundFilePath("nonexistent", tmpDir)).toThrow();
  });

  it("finds file given bare name with explicit extension", () => {
    touch(path.join(tmpDir, "chime.wav"));
    const result = getFullSoundFilePath("chime.wav", tmpDir);
    expect(result).toBe(path.join(tmpDir, "chime.wav"));
  });

  it("prefers .wav over .mp3 when both exist (wav searched first)", () => {
    touch(path.join(tmpDir, "sound.wav"));
    touch(path.join(tmpDir, "sound.mp3"));
    const result = getFullSoundFilePath("sound", tmpDir);
    // seekFullPathFromDefaults checks extensions in order: "" then .wav then .mp3
    expect(result).toBe(path.join(tmpDir, "sound.wav"));
  });

  it("error message includes attempted file name", () => {
    expect(() => getFullSoundFilePath("missing_sound", tmpDir)).toThrow(
      /missing_sound/
    );
  });
});
