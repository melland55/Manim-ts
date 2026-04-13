/**
 * Tests for src/_config/utils — ManimConfig and ManimFrame.
 */

import { describe, it, expect } from "vitest";
import {
  ManimConfig,
  ManimFrame,
  QUALITY_PRESETS,
  configFilePaths,
  makeConfigParser,
  _determineQuality,
} from "../../src/_config/utils.js";
import { RendererType } from "../../src/constants/index.js";

// ─── ManimConfig construction and defaults ────────────────────────────────────

describe("ManimConfig defaults", () => {
  it("constructs with sensible defaults", () => {
    const cfg = new ManimConfig();
    expect(cfg.pixelWidth).toBe(1920);
    expect(cfg.pixelHeight).toBe(1080);
    expect(cfg.frameRate).toBe(60);
    expect(cfg.frameHeight).toBeCloseTo(8.0);
    expect(cfg.frameWidth).toBeCloseTo(14.222);
    expect(cfg.backgroundOpacity).toBe(1.0);
    expect(cfg.mediaDir).toBe("./media");
    expect(cfg.renderer).toBe(RendererType.CAIRO);
  });

  it("has boolean defaults all false (except notify_outdated_version)", () => {
    const cfg = new ManimConfig();
    expect(cfg.preview).toBe(false);
    expect(cfg.writeToMovie).toBe(false);
    expect(cfg.saveLastFrame).toBe(false);
    expect(cfg.dryRun).toBe(false);
    expect(cfg.disableCaching).toBe(false);
    expect(cfg.notifyOutdatedVersion).toBe(true);
  });

  it("defaults plugins and sceneNames to empty arrays", () => {
    const cfg = new ManimConfig();
    expect(cfg.plugins).toEqual([]);
    expect(cfg.sceneNames).toEqual([]);
  });
});

// ─── Frame dimension accessors ────────────────────────────────────────────────

describe("ManimConfig frame dimensions", () => {
  it("frameYRadius is half of frameHeight", () => {
    const cfg = new ManimConfig();
    expect(cfg.frameYRadius).toBeCloseTo(cfg.frameHeight / 2);
  });

  it("frameXRadius is half of frameWidth", () => {
    const cfg = new ManimConfig();
    expect(cfg.frameXRadius).toBeCloseTo(cfg.frameWidth / 2);
  });

  it("setting frameYRadius updates frameHeight", () => {
    const cfg = new ManimConfig();
    cfg.frameYRadius = 5.0;
    expect(cfg.frameHeight).toBeCloseTo(10.0);
  });

  it("setting frameXRadius updates frameWidth", () => {
    const cfg = new ManimConfig();
    cfg.frameXRadius = 7.5;
    expect(cfg.frameWidth).toBeCloseTo(15.0);
  });

  it("frameSize tuple reads and writes pixelWidth/pixelHeight", () => {
    const cfg = new ManimConfig();
    cfg.frameSize = [1280, 720];
    expect(cfg.pixelWidth).toBe(1280);
    expect(cfg.pixelHeight).toBe(720);
    expect(cfg.frameSize).toEqual([1280, 720]);
  });

  it("top/bottom/leftSide/rightSide are derived from frame radius", () => {
    const cfg = new ManimConfig();
    const yr = cfg.frameYRadius;
    const xr = cfg.frameXRadius;
    expect(cfg.top.toArray()).toEqual([0, yr, 0]);
    expect(cfg.bottom.toArray()).toEqual([0, -yr, 0]);
    expect(cfg.leftSide.toArray()).toEqual([-xr, 0, 0]);
    expect(cfg.rightSide.toArray()).toEqual([xr, 0, 0]);
  });
});

// ─── Quality presets ──────────────────────────────────────────────────────────

describe("ManimConfig quality", () => {
  it("setting quality=high updates pixel dimensions and frame rate", () => {
    const cfg = new ManimConfig();
    cfg.quality = "high";
    expect(cfg.pixelWidth).toBe(QUALITY_PRESETS.high.pixelWidth);
    expect(cfg.pixelHeight).toBe(QUALITY_PRESETS.high.pixelHeight);
    expect(cfg.frameRate).toBe(QUALITY_PRESETS.high.frameRate);
  });

  it("setting quality=low updates pixel dimensions and frame rate", () => {
    const cfg = new ManimConfig();
    cfg.quality = "low";
    expect(cfg.pixelWidth).toBe(QUALITY_PRESETS.low.pixelWidth);
    expect(cfg.pixelHeight).toBe(QUALITY_PRESETS.low.pixelHeight);
    expect(cfg.frameRate).toBe(QUALITY_PRESETS.low.frameRate);
  });

  it("throws for unknown quality value", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.quality = "ultra"; }).toThrow();
  });

  it("accepts full Python quality name via QUALITY_NAME_MAP", () => {
    const cfg = new ManimConfig();
    cfg.quality = "high_quality";
    expect(cfg.pixelWidth).toBe(QUALITY_PRESETS.high.pixelWidth);
  });
});

// ─── Validation helpers ───────────────────────────────────────────────────────

describe("ManimConfig validation", () => {
  it("verbosity rejects invalid values", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.verbosity = "VERBOSE"; }).toThrow();
  });

  it("verbosity accepts valid log levels", () => {
    const cfg = new ManimConfig();
    cfg.verbosity = "DEBUG";
    expect(cfg.verbosity).toBe("DEBUG");
    cfg.verbosity = "CRITICAL";
    expect(cfg.verbosity).toBe("CRITICAL");
  });

  it("zeroPad rejects values outside [0, 9]", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.zeroPad = -1; }).toThrow();
    expect(() => { cfg.zeroPad = 10; }).toThrow();
  });

  it("backgroundOpacity rejects values outside [0, 1]", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.backgroundOpacity = -0.1; }).toThrow();
    expect(() => { cfg.backgroundOpacity = 1.1; }).toThrow();
  });

  it("pixelWidth/pixelHeight reject negative values", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.pixelWidth = -1; }).toThrow();
    expect(() => { cfg.pixelHeight = -10; }).toThrow();
  });

  it("movieFileExtension rejects invalid values", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.movieFileExtension = ".avi"; }).toThrow();
  });

  it("progressBar rejects invalid values", () => {
    const cfg = new ManimConfig();
    expect(() => { cfg.progressBar = "always"; }).toThrow();
  });
});

// ─── transparent / backgroundOpacity ──────────────────────────────────────────

describe("ManimConfig transparent", () => {
  it("transparent is false when backgroundOpacity is 1.0", () => {
    const cfg = new ManimConfig();
    expect(cfg.transparent).toBe(false);
  });

  it("setting transparent=true sets backgroundOpacity to 0", () => {
    const cfg = new ManimConfig();
    cfg.transparent = true;
    expect(cfg.backgroundOpacity).toBe(0.0);
    expect(cfg.transparent).toBe(true);
  });
});

// ─── dryRun cascade ───────────────────────────────────────────────────────────

describe("ManimConfig dryRun", () => {
  it("enabling dry_run disables write_to_movie, write_all, save_last_frame and nulls format", () => {
    const cfg = new ManimConfig();
    cfg.writeToMovie = true;
    cfg.writeAll = true;
    cfg.saveLastFrame = true;
    cfg.dryRun = true;
    expect(cfg.writeToMovie).toBe(false);
    expect(cfg.writeAll).toBe(false);
    expect(cfg.saveLastFrame).toBe(false);
    expect(cfg.format).toBeNull();
  });
});

// ─── preview / enableGui coupling ────────────────────────────────────────────

describe("ManimConfig preview / enableGui", () => {
  it("preview is true when enableGui is true", () => {
    const cfg = new ManimConfig();
    cfg.enableGui = true;
    expect(cfg.preview).toBe(true);
  });
});

// ─── copy ────────────────────────────────────────────────────────────────────

describe("ManimConfig.copy()", () => {
  it("copy produces an independent clone", () => {
    const cfg = new ManimConfig();
    cfg.pixelWidth = 1280;
    const c2 = cfg.copy();
    expect(c2.pixelWidth).toBe(1280);
    c2.pixelWidth = 640;
    expect(cfg.pixelWidth).toBe(1280); // original unchanged
  });

  it("arrays in copy are independent", () => {
    const cfg = new ManimConfig();
    cfg.plugins = ["a", "b"];
    const c2 = cfg.copy();
    c2.plugins.push("c");
    expect(cfg.plugins).toEqual(["a", "b"]);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("ManimConfig.update()", () => {
  it("update from another ManimConfig copies values", () => {
    const a = new ManimConfig();
    const b = new ManimConfig();
    b.pixelWidth = 1280;
    b.frameRate = 30;
    a.update(b);
    expect(a.pixelWidth).toBe(1280);
    expect(a.frameRate).toBe(30);
  });

  it("update from plain object sets matching keys via setters", () => {
    const cfg = new ManimConfig();
    cfg.update({ verbosity: "DEBUG" });
    expect(cfg.verbosity).toBe("DEBUG");
  });
});

// ─── getDir ───────────────────────────────────────────────────────────────────

describe("ManimConfig.getDir()", () => {
  it("getDir('mediaDir') resolves without placeholders", () => {
    const cfg = new ManimConfig();
    cfg.mediaDir = "./media";
    expect(cfg.getDir("mediaDir")).toBe("./media");
  });

  it("getDir throws for unknown keys", () => {
    const cfg = new ManimConfig();
    expect(() => cfg.getDir("unknown")).toThrow();
  });

  it("getDir resolves nested placeholders with kwargs", () => {
    const cfg = new ManimConfig();
    const result = cfg.getDir("videoDir", {
      module_name: "myfile",
    });
    expect(result).toContain("myfile");
    expect(result).toContain("media");
  });
});

// ─── digestParser ────────────────────────────────────────────────────────────

describe("ManimConfig.digestParser()", () => {
  it("digestParser reads boolean and int values from INI sections", () => {
    const cfg = new ManimConfig();
    cfg.digestParser({
      CLI: {
        notify_outdated_version: "false",
        pixel_width: "1280",
        pixel_height: "720",
        frame_rate: "30",
        frame_height: "8.0",
        background_opacity: "1.0",
        gui_location: "0,0",
        window_size: "default",
        plugins: "",
        verbosity: "WARNING",
        from_animation_number: "0",
        upto_animation_number: "-1",
        max_files_cached: "100",
        window_monitor: "0",
        zero_pad: "4",
        seed: "0",
        write_to_movie: "false",
        save_last_frame: "false",
        write_all: "false",
        save_pngs: "false",
        save_as_gif: "false",
        save_sections: "false",
        preview: "false",
        show_in_file_browser: "false",
        log_to_file: "false",
        disable_caching: "false",
        disable_caching_warning: "false",
        flush_cache: "false",
        custom_folders: "false",
        enable_gui: "false",
        fullscreen: "false",
        use_projection_fill_shaders: "false",
        use_projection_stroke_shaders: "false",
        enable_wireframe: "false",
        force_window: "false",
        no_latex_cleanup: "false",
        dry_run: "false",
      },
      ffmpeg: { loglevel: "ERROR" },
      jupyter: { media_embed: "False", media_width: "100%" },
    });
    expect(cfg.pixelWidth).toBe(1280);
    expect(cfg.pixelHeight).toBe(720);
    expect(cfg.frameRate).toBe(30);
    expect(cfg.notifyOutdatedVersion).toBe(false);
  });
});

// ─── ManimFrame ───────────────────────────────────────────────────────────────

describe("ManimFrame", () => {
  it("constructs from a ManimConfig", () => {
    const cfg = new ManimConfig();
    const frame = new ManimFrame(cfg);
    expect(frame.pixelWidth).toBe(cfg.pixelWidth);
    expect(frame.frameHeight).toBe(cfg.frameHeight);
  });

  it("throws if constructed with a non-ManimConfig argument", () => {
    expect(() => new ManimFrame({} as ManimConfig)).toThrow(TypeError);
  });

  it("frame dimensions reflect config changes", () => {
    const cfg = new ManimConfig();
    const frame = new ManimFrame(cfg);
    cfg.frameHeight = 10.0;
    expect(frame.frameHeight).toBe(10.0);
    expect(frame.frameYRadius).toBe(5.0);
  });

  it("setting frame properties throws TypeError", () => {
    const cfg = new ManimConfig();
    const frame = new ManimFrame(cfg);
    expect(() => { (frame as unknown as Record<string, unknown>).pixelWidth = 100; }).toThrow(TypeError);
  });

  it("exposes direction constants (UP, DOWN, LEFT, RIGHT, ORIGIN, etc.)", () => {
    const cfg = new ManimConfig();
    const frame = new ManimFrame(cfg);
    expect(frame.UP.toArray()).toEqual([0, 1, 0]);
    expect(frame.DOWN.toArray()).toEqual([0, -1, 0]);
    expect(frame.LEFT.toArray()).toEqual([-1, 0, 0]);
    expect(frame.RIGHT.toArray()).toEqual([1, 0, 0]);
    expect(frame.ORIGIN.toArray()).toEqual([0, 0, 0]);
  });

  it("width and height are aliases for frameWidth/frameHeight", () => {
    const cfg = new ManimConfig();
    const frame = new ManimFrame(cfg);
    expect(frame.width).toBe(frame.frameWidth);
    expect(frame.height).toBe(frame.frameHeight);
  });
});

// ─── _determineQuality ────────────────────────────────────────────────────────

describe("_determineQuality()", () => {
  it("returns null for null input", () => {
    expect(_determineQuality(null)).toBeNull();
  });

  it("resolves flag 'h' → 'high_quality'", () => {
    expect(_determineQuality("h")).toBe("high_quality");
  });

  it("resolves flag 'l' → 'low_quality'", () => {
    expect(_determineQuality("l")).toBe("low_quality");
  });

  it("passes through unknown strings unchanged", () => {
    expect(_determineQuality("custom_quality")).toBe("custom_quality");
  });
});

// ─── configFilePaths ─────────────────────────────────────────────────────────

describe("configFilePaths()", () => {
  it("returns an array of 3 paths", () => {
    const paths = configFilePaths();
    expect(paths).toHaveLength(3);
  });

  it("paths are strings", () => {
    const paths = configFilePaths();
    for (const p of paths) {
      expect(typeof p).toBe("string");
    }
  });

  it("last path ends with manim.cfg", () => {
    const paths = configFilePaths();
    expect(paths[2]).toMatch(/manim\.cfg$/);
  });
});

// ─── makeConfigParser ────────────────────────────────────────────────────────

describe("makeConfigParser()", () => {
  it("returns an object with CLI section", () => {
    const parser = makeConfigParser();
    expect(parser).toHaveProperty("CLI");
    expect(typeof parser["CLI"]).toBe("object");
  });

  it("CLI section has pixel_width and pixel_height", () => {
    const parser = makeConfigParser();
    expect(parser["CLI"]).toHaveProperty("pixel_width");
    expect(parser["CLI"]).toHaveProperty("pixel_height");
  });

  it("CLI section has ffmpeg section", () => {
    const parser = makeConfigParser();
    expect(parser).toHaveProperty("ffmpeg");
  });
});

// ─── QUALITY_PRESETS ─────────────────────────────────────────────────────────

describe("QUALITY_PRESETS", () => {
  it("contains high, medium, low, fourk presets", () => {
    expect(QUALITY_PRESETS).toHaveProperty("high");
    expect(QUALITY_PRESETS).toHaveProperty("medium");
    expect(QUALITY_PRESETS).toHaveProperty("low");
    expect(QUALITY_PRESETS).toHaveProperty("fourk");
  });

  it("high preset is 1920x1080@60fps", () => {
    expect(QUALITY_PRESETS.high.pixelWidth).toBe(1920);
    expect(QUALITY_PRESETS.high.pixelHeight).toBe(1080);
    expect(QUALITY_PRESETS.high.frameRate).toBe(60);
  });
});
