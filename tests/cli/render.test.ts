import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  ClickArgs,
  validateGuiLocation,
  validateSceneRange,
  validateResolution,
  QUALITY_FLAGS,
  QUALITY_DESCRIPTIONS,
  RENDERER_TYPES,
  EASE_OF_ACCESS_OPTION_DEFS,
  OUTPUT_OPTION_DEFS,
  RENDER_OPTION_DEFS,
  GLOBAL_OPTION_DEFS,
  EPILOG,
} from "../../src/cli/render/index.js";

// ─── ClickArgs ────────────────────────────────────────────────────────────────

describe("ClickArgs", () => {
  it("stores and retrieves values", () => {
    const args = new ClickArgs({ file: "scene.ts", renderer: "cairo" });
    expect(args.get("file")).toBe("scene.ts");
    expect(args.get("renderer")).toBe("cairo");
  });

  it("has() returns true for present keys", () => {
    const args = new ClickArgs({ foo: 42 });
    expect(args.has("foo")).toBe(true);
    expect(args.has("bar")).toBe(false);
  });

  it("set() updates a value", () => {
    const args = new ClickArgs({ format: null });
    args.set("format", "gif");
    expect(args.get("format")).toBe("gif");
  });

  it("_getKwargs() returns all entries as tuples", () => {
    const args = new ClickArgs({ a: 1, b: "two" });
    const entries = args._getKwargs();
    expect(entries).toContainEqual(["a", 1]);
    expect(entries).toContainEqual(["b", "two"]);
    expect(entries).toHaveLength(2);
  });

  it("toRecord() returns a plain object copy", () => {
    const data = { x: 10, y: 20 };
    const args = new ClickArgs(data);
    const record = args.toRecord();
    expect(record).toEqual(data);
    // Verify it's a copy, not the same reference
    record["z"] = 30;
    expect(args.has("z")).toBe(false);
  });

  it("equals() returns true for equivalent ClickArgs", () => {
    const a = new ClickArgs({ foo: 1 });
    const b = new ClickArgs({ foo: 1 });
    expect(a.equals(b)).toBe(true);
  });

  it("equals() returns false for differing ClickArgs", () => {
    const a = new ClickArgs({ foo: 1 });
    const b = new ClickArgs({ foo: 2 });
    expect(a.equals(b)).toBe(false);
  });

  it("equals() returns false for non-ClickArgs values", () => {
    const a = new ClickArgs({ foo: 1 });
    expect(a.equals({ foo: 1 })).toBe(false);
    expect(a.equals(null)).toBe(false);
  });

  it("toString() returns JSON representation", () => {
    const args = new ClickArgs({ key: "value" });
    expect(args.toString()).toBe('{"key":"value"}');
  });
});

// ─── validateGuiLocation ──────────────────────────────────────────────────────

describe("validateGuiLocation", () => {
  it("returns null for null/undefined input", () => {
    expect(validateGuiLocation(null)).toBeNull();
    expect(validateGuiLocation(undefined)).toBeNull();
  });

  it("parses semicolon-separated coordinates", () => {
    expect(validateGuiLocation("100;200")).toEqual([100, 200]);
  });

  it("parses comma-separated coordinates", () => {
    expect(validateGuiLocation("300,400")).toEqual([300, 400]);
  });

  it("parses hyphen-separated coordinates", () => {
    expect(validateGuiLocation("50-75")).toEqual([50, 75]);
  });

  it("exits the process for invalid input", () => {
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as typeof process.exit);

    expect(() => validateGuiLocation("not-valid-format-xyz")).toThrow();
    spy.mockRestore();
  });
});

// ─── validateSceneRange ───────────────────────────────────────────────────────

describe("validateSceneRange", () => {
  it("returns null for null/undefined input", () => {
    expect(validateSceneRange(null)).toBeNull();
    expect(validateSceneRange(undefined)).toBeNull();
  });

  it("parses a single integer", () => {
    expect(validateSceneRange("3")).toEqual([3]);
  });

  it("parses a range with semicolon", () => {
    expect(validateSceneRange("2;5")).toEqual([2, 5]);
  });

  it("parses a range with comma", () => {
    expect(validateSceneRange("1,4")).toEqual([1, 4]);
  });

  it("parses a range with hyphen", () => {
    expect(validateSceneRange("0-10")).toEqual([0, 10]);
  });

  it("exits for invalid input", () => {
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as typeof process.exit);

    expect(() => validateSceneRange("abc")).toThrow();
    spy.mockRestore();
  });
});

// ─── validateResolution ───────────────────────────────────────────────────────

describe("validateResolution", () => {
  it("returns null for null/undefined input", () => {
    expect(validateResolution(null)).toBeNull();
    expect(validateResolution(undefined)).toBeNull();
  });

  it("parses semicolon-separated resolution", () => {
    expect(validateResolution("1920;1080")).toEqual([1920, 1080]);
  });

  it("parses comma-separated resolution", () => {
    expect(validateResolution("1280,720")).toEqual([1280, 720]);
  });

  it("parses hyphen-separated resolution", () => {
    expect(validateResolution("854-480")).toEqual([854, 480]);
  });

  it("exits for invalid input", () => {
    const spy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as typeof process.exit);

    expect(() => validateResolution("bad_resolution")).toThrow();
    spy.mockRestore();
  });
});

// ─── Option metadata completeness ─────────────────────────────────────────────

describe("option metadata", () => {
  it("QUALITY_FLAGS is a non-empty array of strings", () => {
    expect(Array.isArray(QUALITY_FLAGS)).toBe(true);
    expect(QUALITY_FLAGS.length).toBeGreaterThan(0);
    for (const flag of QUALITY_FLAGS) {
      expect(typeof flag).toBe("string");
    }
  });

  it("QUALITY_DESCRIPTIONS matches QUALITY_FLAGS in length", () => {
    expect(QUALITY_DESCRIPTIONS.length).toBe(QUALITY_FLAGS.length);
  });

  it("RENDERER_TYPES includes cairo and opengl", () => {
    expect(RENDERER_TYPES).toContain("cairo");
    expect(RENDERER_TYPES).toContain("opengl");
  });

  it("EASE_OF_ACCESS_OPTION_DEFS has the expected options", () => {
    const flags = EASE_OF_ACCESS_OPTION_DEFS.flatMap((d) => d.flags);
    expect(flags).toContain("--progress_bar");
    expect(flags).toContain("--preview");
    expect(flags).toContain("--show_in_file_browser");
    expect(flags).toContain("--jupyter");
  });

  it("OUTPUT_OPTION_DEFS has the expected options", () => {
    const flags = OUTPUT_OPTION_DEFS.flatMap((d) => d.flags);
    expect(flags).toContain("--output_file");
    expect(flags).toContain("--media_dir");
    expect(flags).toContain("--log_dir");
  });

  it("RENDER_OPTION_DEFS covers quality and format options", () => {
    const flags = RENDER_OPTION_DEFS.flatMap((d) => d.flags);
    expect(flags).toContain("--quality");
    expect(flags).toContain("--format");
    expect(flags).toContain("--renderer");
    expect(flags).toContain("--transparent");
  });

  it("GLOBAL_OPTION_DEFS covers verbosity and caching options", () => {
    const flags = GLOBAL_OPTION_DEFS.flatMap((d) => d.flags);
    expect(flags).toContain("--verbosity");
    expect(flags).toContain("--disable_caching");
    expect(flags).toContain("--flush_cache");
  });

  it("EPILOG is a non-empty string", () => {
    expect(typeof EPILOG).toBe("string");
    expect(EPILOG.length).toBeGreaterThan(0);
  });
});
