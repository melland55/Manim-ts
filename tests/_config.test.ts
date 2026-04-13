import { describe, it, expect, beforeEach } from "vitest";
import {
  ManimConfig,
  ManimFrame,
  makeConfigParser,
  config,
  frame,
  tempconfig,
  cliCtxSettings,
} from "../src/_config/index.js";
import { Color } from "../src/core/color/index.js";

describe("ManimConfig", () => {
  it("constructs with default values", () => {
    const cfg = new ManimConfig();
    expect(cfg.pixelWidth).toBe(1920);
    expect(cfg.pixelHeight).toBe(1080);
    expect(cfg.frameRate).toBe(60);
    expect(cfg.frameWidth).toBeCloseTo(14.222, 2);
    expect(cfg.frameHeight).toBe(8.0);
    expect(cfg.mediaDir).toBe("./media");
    expect(cfg.quality).toBe("high");
  });

  it("digestParser applies CLI section values", () => {
    const parser = makeConfigParser();
    parser["CLI"]["quality"] = "low";
    const cfg = new ManimConfig().digestParser(parser);
    expect(cfg.quality).toBe("low");
    expect(cfg.pixelWidth).toBe(854);
    expect(cfg.pixelHeight).toBe(480);
    expect(cfg.frameRate).toBe(15);
  });

  it("copy() returns an independent copy", () => {
    const cfg = new ManimConfig();
    const copy = cfg.copy();
    copy.pixelWidth = 999;
    expect(cfg.pixelWidth).toBe(1920);
    expect(copy.pixelWidth).toBe(999);
  });

  it("update() mutates only provided keys", () => {
    const cfg = new ManimConfig();
    cfg.update({ pixelWidth: 1280, frameRate: 30 });
    expect(cfg.pixelWidth).toBe(1280);
    expect(cfg.frameRate).toBe(30);
    expect(cfg.pixelHeight).toBe(1080); // untouched
  });

  it("items() returns all key-value pairs", () => {
    const cfg = new ManimConfig();
    const pairs = cfg.items();
    const keys = pairs.map(([k]) => k);
    expect(keys).toContain("pixelWidth");
    expect(keys).toContain("frameHeight");
    expect(keys).toContain("quality");
    expect(keys).toContain("backgroundColor");
  });

  it("get/set subscript accessors work", () => {
    const cfg = new ManimConfig();
    expect(cfg.get("pixelWidth")).toBe(1920);
    cfg.set("pixelWidth", 800);
    expect(cfg.get("pixelWidth")).toBe(800);
  });
});

describe("ManimFrame", () => {
  it("reflects config frame dimensions", () => {
    const cfg = new ManimConfig();
    const f = new ManimFrame(cfg);
    expect(f.width).toBeCloseTo(14.222, 2);
    expect(f.height).toBe(8.0);
    expect(f.pixelWidth).toBe(1920);
    expect(f.pixelHeight).toBe(1080);
    expect(f.frameRate).toBe(60);
  });

  it("aspectRatio is width/height", () => {
    const cfg = new ManimConfig();
    const f = new ManimFrame(cfg);
    expect(f.aspectRatio).toBeCloseTo(cfg.frameWidth / cfg.frameHeight, 5);
  });

  it("live-reflects config changes", () => {
    const cfg = new ManimConfig();
    const f = new ManimFrame(cfg);
    cfg.frameWidth = 20.0;
    expect(f.width).toBe(20.0);
  });
});

describe("global config singleton", () => {
  it("config is a ManimConfig instance", () => {
    expect(config).toBeInstanceOf(ManimConfig);
  });

  it("frame is a ManimFrame instance", () => {
    expect(frame).toBeInstanceOf(ManimFrame);
  });

  it("cliCtxSettings has expected shape", () => {
    expect(typeof cliCtxSettings.noColor).toBe("boolean");
    expect(typeof cliCtxSettings.forceColor).toBe("boolean");
    expect(typeof cliCtxSettings.isTTY).toBe("boolean");
  });
});

describe("tempconfig", () => {
  it("overrides config values inside callback", async () => {
    const original = config.frameHeight;
    let inside = 0;
    await tempconfig({ frameHeight: 100.0 }, () => {
      inside = config.frameHeight;
    });
    expect(inside).toBe(100.0);
    expect(config.frameHeight).toBe(original);
  });

  it("restores original values after callback", async () => {
    const before = config.pixelWidth;
    await tempconfig({ pixelWidth: 640 }, () => {
      // nothing
    });
    expect(config.pixelWidth).toBe(before);
  });

  it("restores values even when callback throws", async () => {
    const before = config.mediaDir;
    await expect(
      tempconfig({ mediaDir: "/tmp/test" }, () => {
        throw new Error("intentional");
      }),
    ).rejects.toThrow("intentional");
    expect(config.mediaDir).toBe(before);
  });

  it("ignores keys not present in config", async () => {
    const before = config.pixelWidth;
    // @ts-expect-error intentionally passing unknown key
    await tempconfig({ unknownKey: 42 }, () => {});
    expect(config.pixelWidth).toBe(before);
  });

  it("supports async callbacks", async () => {
    const result = await tempconfig({ frameRate: 24 }, async () => {
      await Promise.resolve();
      return config.frameRate;
    });
    expect(result).toBe(24);
  });
});
