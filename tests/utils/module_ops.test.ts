/**
 * Tests for src/utils/module_ops
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as nodePath from "node:path";
import { describe, it, expect, afterEach } from "vitest";

import {
  getModule,
  getSceneClassesFromModule,
  getScenestoRender,
  sceneClassesFromFile,
  type SceneClass,
  type ModuleExports,
} from "../../src/utils/module_ops/index.js";

// ─── Helpers ──────────────────────────────────────────────────

/** Build a fake module export map containing the given classes. */
function makeModule(...classes: SceneClass[]): ModuleExports {
  const exports: ModuleExports = {};
  for (const cls of classes) {
    exports[cls.name] = cls;
  }
  return exports;
}

/** Minimal duck-typed IScene stand-in for tests. */
function makeSceneClass(name: string): SceneClass {
  const cls = class {
    construct() { /* IScene stub */ }
    mobjects = [];
    time = 0;
    camera = {} as never;
    add() { return this; }
    remove() { return this; }
    async play() { /* no-op */ }
    async wait() { /* no-op */ }
  };
  Object.defineProperty(cls, "name", { value: name });
  return cls as unknown as SceneClass;
}

// ─── getSceneClassesFromModule ────────────────────────────────

describe("getSceneClassesFromModule", () => {
  it("returns classes whose prototype has a construct method", () => {
    const SceneA = makeSceneClass("SceneA");
    const SceneB = makeSceneClass("SceneB");
    const mod = makeModule(SceneA, SceneB);

    const result = getSceneClassesFromModule(mod);
    expect(result).toHaveLength(2);
    expect(result).toContain(SceneA);
    expect(result).toContain(SceneB);
  });

  it("ignores plain objects and non-class values", () => {
    const SceneA = makeSceneClass("SceneA");
    const mod: ModuleExports = {
      ...makeModule(SceneA),
      someNumber: 42,
      someString: "hello",
      someObject: { construct: "not a method" },
      someFn: () => { /* not a class */ },
    };

    const result = getSceneClassesFromModule(mod);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(SceneA);
  });

  it("returns empty array for an empty module", () => {
    const result = getSceneClassesFromModule({});
    expect(result).toHaveLength(0);
  });

  it("ignores classes that do not have a construct method", () => {
    class NotAScene { render() { /* not a scene */ } }
    const mod: ModuleExports = { NotAScene };
    const result = getSceneClassesFromModule(mod);
    expect(result).toHaveLength(0);
  });

  it("handles modules with many exports, only picking scene-like ones", () => {
    const S1 = makeSceneClass("S1");
    const S2 = makeSceneClass("S2");
    const mod: ModuleExports = {
      S1,
      S2,
      PI: 3.14159,
      version: "1.0.0",
      helper: function helper() { /* not a scene */ },
    };

    const result = getSceneClassesFromModule(mod);
    expect(result).toHaveLength(2);
  });
});

// ─── getScenestoRender ────────────────────────────────────────

describe("getScenestoRender", () => {
  it("returns empty array and logs error when no scenes provided", async () => {
    const result = await getScenestoRender([]);
    expect(result).toHaveLength(0);
  });

  it("auto-selects the only scene when there is exactly one", async () => {
    const OnlyScene = makeSceneClass("OnlyScene");
    // Ensure sceneNames is empty so auto-select kicks in
    const cfg = (await import("../../src/_config/index.js")).config as unknown as {
      sceneNames?: string[];
      writeAll?: boolean;
    };
    const savedNames = cfg.sceneNames;
    const savedWriteAll = cfg.writeAll;
    cfg.sceneNames = [];
    cfg.writeAll = false;

    const result = await getScenestoRender([OnlyScene]);

    cfg.sceneNames = savedNames;
    cfg.writeAll = savedWriteAll;

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(OnlyScene);
  });
});

// ─── getModule ────────────────────────────────────────────────

describe("getModule", () => {
  let tmpFile: string | undefined;

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
    tmpFile = undefined;
  });

  it("throws when the file does not exist", async () => {
    await expect(getModule("/nonexistent/path/scene.ts")).rejects.toThrow(
      /not found/i,
    );
  });

  it("throws for a .py file extension", async () => {
    // Create a temp file with .py extension
    tmpFile = nodePath.join(os.tmpdir(), `manim_test_${Date.now()}.py`);
    fs.writeFileSync(tmpFile, "# python scene");
    await expect(getModule(tmpFile)).rejects.toThrow(
      /not a valid Manim/i,
    );
  });

  it("loads a simple .js module and returns its exports", async () => {
    // Write a minimal CJS-compatible file
    tmpFile = nodePath.join(os.tmpdir(), `manim_test_${Date.now()}.mjs`);
    fs.writeFileSync(tmpFile, `export const greeting = "hello";\n`);
    const mod = await getModule(tmpFile);
    expect(mod.greeting).toBe("hello");
  });
});

// ─── sceneClassesFromFile ─────────────────────────────────────

describe("sceneClassesFromFile", () => {
  let tmpFile: string | undefined;

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
    tmpFile = undefined;
  });

  it("returns full list of scene classes when fullList=true", async () => {
    tmpFile = nodePath.join(os.tmpdir(), `manim_test_${Date.now()}.mjs`);
    // Export a scene-like class
    fs.writeFileSync(
      tmpFile,
      `export class MyScene {
  construct() {}
  get mobjects() { return []; }
  get time() { return 0; }
  get camera() { return {}; }
  add() { return this; }
  remove() { return this; }
  async play() {}
  async wait() {}
}\n`,
    );

    const result = await sceneClassesFromFile(tmpFile, false, true);
    expect(Array.isArray(result)).toBe(true);
    expect((result as SceneClass[]).some((c) => c.name === "MyScene")).toBe(true);
  });

  it("throws for a non-existent file", async () => {
    await expect(
      sceneClassesFromFile("/does/not/exist.ts"),
    ).rejects.toThrow(/not found/i);
  });
});
