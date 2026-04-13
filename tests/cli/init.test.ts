import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as nodePath from "node:path";

// ─── readline mock ────────────────────────────────────────────────────────────
// Intercept readline.createInterface at the module level so tests can control
// what "the user typed" without a real TTY.

let _nextAnswer = "Default";

vi.mock("node:readline", () => ({
  default: {
    createInterface: () => ({
      question: (_q: unknown, cb: (ans: string) => void) => cb(_nextAnswer),
      close: () => {/* noop */},
    }),
  },
  createInterface: () => ({
    question: (_q: unknown, cb: (ans: string) => void) => cb(_nextAnswer),
    close: () => {/* noop */},
  }),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  CFG_DEFAULTS,
  selectResolution,
  updateCfg,
  project,
  scene,
  type ProjectOptions,
  type SceneOptions,
} from "../../src/cli/init/index.js";

// ─── updateCfg ───────────────────────────────────────────────────────────────

describe("updateCfg", () => {
  let tmpDir: string;
  let cfgPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "manim-init-test-"));
    cfgPath = nodePath.join(tmpDir, "manim.cfg");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a manim.cfg with [CLI] section when no file exists", () => {
    updateCfg({ frame_rate: 30 }, cfgPath);
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("[CLI]");
    expect(text).toContain("frame_rate = 30");
  });

  it("writes background_color and background_opacity into [CLI]", () => {
    updateCfg(
      { background_color: "WHITE", background_opacity: 0.5 },
      cfgPath,
    );
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("background_color = WHITE");
    expect(text).toContain("background_opacity = 0.5");
  });

  it("splits resolution tuple into pixel_height and pixel_width", () => {
    updateCfg({ resolution: [1080, 1920] as [number, number] }, cfgPath);
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("pixel_height = 1080");
    expect(text).toContain("pixel_width = 1920");
  });

  it("overwrites existing keys on repeated calls", () => {
    updateCfg({ frame_rate: 30 }, cfgPath);
    updateCfg({ frame_rate: 60 }, cfgPath);
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("frame_rate = 60");
    // Only one frame_rate entry should remain
    const lines = text.split("\n").filter((l) => l.includes("frame_rate"));
    expect(lines).toHaveLength(1);
  });

  it("preserves pre-existing sections alongside [CLI]", () => {
    fs.writeFileSync(cfgPath, "[OTHER]\nkey = val\n\n", "utf8");
    updateCfg({ frame_rate: 30 }, cfgPath);
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("[OTHER]");
    expect(text).toContain("key = val");
    expect(text).toContain("[CLI]");
    expect(text).toContain("frame_rate = 30");
  });
});

// ─── CFG_DEFAULTS ────────────────────────────────────────────────────────────

describe("CFG_DEFAULTS", () => {
  it("has the correct default frame_rate", () => {
    expect(CFG_DEFAULTS.frame_rate).toBe(30);
  });

  it("has background_color BLACK", () => {
    expect(CFG_DEFAULTS.background_color).toBe("BLACK");
  });

  it("has background_opacity 1", () => {
    expect(CFG_DEFAULTS.background_opacity).toBe(1);
  });

  it("has resolution as [1920, 1080]", () => {
    expect(CFG_DEFAULTS.resolution).toEqual([1920, 1080]);
  });

  it("has scene_names Default", () => {
    expect(CFG_DEFAULTS.scene_names).toBe("Default");
  });
});

// ─── selectResolution ────────────────────────────────────────────────────────

describe("selectResolution", () => {
  it("returns [480, 854] when user chooses 480p", async () => {
    _nextAnswer = "480p";
    const result = await selectResolution();
    expect(result).toEqual([480, 854]);
  });

  it("returns [1080, 1920] when user chooses 1080p", async () => {
    _nextAnswer = "1080p";
    const result = await selectResolution();
    expect(result).toEqual([1080, 1920]);
  });
});

// ─── project command ─────────────────────────────────────────────────────────

describe("project", () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "manim-project-test-"));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    _nextAnswer = "Default";
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("does not create manim.cfg when the directory already exists", async () => {
    const dirName = "existing_project";
    fs.mkdirSync(nodePath.join(tmpDir, dirName));

    const fileOps = await import("../../src/utils/file_ops/index.js");
    vi.spyOn(fileOps, "getTemplateNames").mockReturnValue(["Default"]);
    vi.spyOn(fileOps, "copyTemplateFiles").mockImplementation(() => {/* noop */});

    await project({ projectName: dirName, defaultSettings: true });

    const cfgPath = nodePath.join(tmpDir, dirName, "manim.cfg");
    expect(fs.existsSync(cfgPath)).toBe(false);
  });

  it("creates directory and manim.cfg with default settings", async () => {
    const dirName = "new_project";

    const fileOps = await import("../../src/utils/file_ops/index.js");
    vi.spyOn(fileOps, "getTemplateNames").mockReturnValue(["Default"]);
    vi.spyOn(fileOps, "copyTemplateFiles").mockImplementation(() => {/* noop */});

    await project({ projectName: dirName, defaultSettings: true });

    expect(fs.existsSync(nodePath.join(tmpDir, dirName))).toBe(true);
    const cfgPath = nodePath.join(tmpDir, dirName, "manim.cfg");
    expect(fs.existsSync(cfgPath)).toBe(true);
    const cfgText = fs.readFileSync(cfgPath, "utf8");
    expect(cfgText).toContain("[CLI]");
    expect(cfgText).toContain("frame_rate = 30");
  });
});

// ─── scene command ────────────────────────────────────────────────────────────

describe("scene", () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), "manim-scene-test-"));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    _nextAnswer = "Default";
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("appends to main.py when no fileName is given", async () => {
    const fileOps = await import("../../src/utils/file_ops/index.js");
    vi.spyOn(fileOps, "getTemplateNames").mockReturnValue(["Default"]);
    vi.spyOn(fileOps, "getTemplatePath").mockReturnValue(tmpDir);

    fs.writeFileSync(
      nodePath.join(tmpDir, "Default.mtp"),
      "class DefaultTemplate(Scene): pass",
      "utf8",
    );
    fs.writeFileSync(nodePath.join(tmpDir, "main.py"), "", "utf8");

    await scene({ sceneName: "MyScene" });

    const content = fs.readFileSync(nodePath.join(tmpDir, "main.py"), "utf8");
    expect(content).toContain("MyScene");
  });

  it("creates a new .py file and substitutes the scene name", async () => {
    const fileOps = await import("../../src/utils/file_ops/index.js");
    vi.spyOn(fileOps, "getTemplateNames").mockReturnValue(["Default"]);
    vi.spyOn(fileOps, "getTemplatePath").mockReturnValue(tmpDir);
    vi.spyOn(fileOps, "addImportStatement").mockImplementation(() => {/* noop */});

    fs.writeFileSync(
      nodePath.join(tmpDir, "Default.mtp"),
      "class DefaultTemplate(Scene): pass",
      "utf8",
    );

    const targetFile = nodePath.join(tmpDir, "my_scene.py");
    await scene({ sceneName: "MyScene", fileName: targetFile });

    expect(fs.existsSync(targetFile)).toBe(true);
    const content = fs.readFileSync(targetFile, "utf8");
    expect(content).toContain("MyScene");
    expect(content).not.toContain("DefaultTemplate");
  });

  it("appends to existing file rather than overwriting", async () => {
    const fileOps = await import("../../src/utils/file_ops/index.js");
    vi.spyOn(fileOps, "getTemplateNames").mockReturnValue(["Default"]);
    vi.spyOn(fileOps, "getTemplatePath").mockReturnValue(tmpDir);

    fs.writeFileSync(
      nodePath.join(tmpDir, "Default.mtp"),
      "class DefaultTemplate(Scene): pass",
      "utf8",
    );

    const targetFile = nodePath.join(tmpDir, "existing.py");
    fs.writeFileSync(targetFile, "# existing content\n", "utf8");

    await scene({ sceneName: "NewScene", fileName: targetFile });

    const content = fs.readFileSync(targetFile, "utf8");
    expect(content).toContain("# existing content");
    expect(content).toContain("NewScene");
  });
});
