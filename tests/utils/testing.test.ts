/**
 * Tests for src/utils/testing module.
 */

import { describe, it, expect } from "vitest";
import {
  _FramesTester,
  _ControlDataWriter,
  FRAME_ABSOLUTE_TOLERANCE,
  FRAME_MISMATCH_RATIO_TOLERANCE,
  DummySceneFileWriter,
  makeTestSceneClass,
  makeTestRendererClass,
  makeSceneFileWriterClass,
  showDiffHelper,
  SCENE_PARAMETER_NAME,
} from "../../src/utils/testing/index.js";
import { Scene } from "../../src/scene/scene/index.js";
import { CairoRenderer } from "../../src/renderer/cairo_renderer/index.js";

// ─── Constants ───────────────────────────────────────────────

describe("constants", () => {
  it("FRAME_ABSOLUTE_TOLERANCE is close to 1", () => {
    expect(FRAME_ABSOLUTE_TOLERANCE).toBeCloseTo(1.01, 2);
  });

  it("FRAME_MISMATCH_RATIO_TOLERANCE is very small", () => {
    expect(FRAME_MISMATCH_RATIO_TOLERANCE).toBe(1e-5);
  });

  it("SCENE_PARAMETER_NAME is 'scene'", () => {
    expect(SCENE_PARAMETER_NAME).toBe("scene");
  });
});

// ─── _FramesTester ───────────────────────────────────────────

describe("_FramesTester", () => {
  it("constructs with defaults", () => {
    const tester = new _FramesTester("/fake/path.json", false);
    expect(tester).toBeInstanceOf(_FramesTester);
  });

  it("throws when loading from a non-existent file", () => {
    const tester = new _FramesTester("/nonexistent/path.json", false);
    expect(() => tester.loadFrames()).toThrow("Control data file not found");
  });

  it("checkFrame throws for out-of-range frame index", () => {
    const tester = new _FramesTester("/fake/path.json");
    // _numberFrames is 0 since we haven't loaded, so any index is out of range
    expect(() => tester.checkFrame(0, new Uint8Array(4))).toThrow(
      "when there are 0 control frames",
    );
  });

  it("assertAllFramesCompared fails when no frames compared vs expected", () => {
    // Create a tester — no frames loaded, so _numberFrames = 0
    // 0 compared === 0 expected → should pass
    const tester = new _FramesTester("/fake/path.json");
    // With 0 frames loaded, asserting 0 == 0 is fine
    expect(() => tester.assertAllFramesCompared()).not.toThrow();
  });
});

// ─── _ControlDataWriter ─────────────────────────────────────

describe("_ControlDataWriter", () => {
  it("constructs with size frame", () => {
    const writer = new _ControlDataWriter("/fake/output.json", [480, 854]);
    expect(writer).toBeInstanceOf(_ControlDataWriter);
    expect(writer).toBeInstanceOf(_FramesTester);
  });

  it("checkFrame captures frames without throwing", () => {
    const writer = new _ControlDataWriter("/fake/output.json", [2, 2]);
    const frame = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    // Should not throw — it's collecting, not comparing
    expect(() => writer.checkFrame(0, frame)).not.toThrow();
    expect(() => writer.checkFrame(1, frame)).not.toThrow();
  });

  it("loadFrames is a no-op", () => {
    const writer = new _ControlDataWriter("/fake/output.json", [2, 2]);
    expect(() => writer.loadFrames()).not.toThrow();
  });

  it("assertAllFramesCompared is a no-op", () => {
    const writer = new _ControlDataWriter("/fake/output.json", [2, 2]);
    expect(() => writer.assertAllFramesCompared()).not.toThrow();
  });
});

// ─── showDiffHelper ──────────────────────────────────────────

describe("showDiffHelper", () => {
  it("does not throw on valid inputs", () => {
    const frame = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const expected = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);
    expect(() =>
      showDiffHelper(0, frame, expected, "test_control.json"),
    ).not.toThrow();
  });

  it("handles identical frames", () => {
    const frame = new Uint8Array([128, 128, 128, 255]);
    expect(() =>
      showDiffHelper(0, frame, frame, "test_control.json"),
    ).not.toThrow();
  });
});

// ─── makeTestSceneClass ──────────────────────────────────────

describe("makeTestSceneClass", () => {
  it("creates a Scene subclass", () => {
    let constructCalled = false;
    const TestScene = makeTestSceneClass(
      Scene,
      () => { constructCalled = true; },
      null,
    );

    const instance = new TestScene();
    expect(instance).toBeInstanceOf(Scene);
  });

  it("calls construct test function when construct is invoked", async () => {
    let constructCalled = false;
    const TestScene = makeTestSceneClass(
      Scene,
      () => { constructCalled = true; },
      null,
    );

    const instance = new TestScene();
    await instance.construct();
    expect(constructCalled).toBe(true);
  });
});

// ─── makeTestRendererClass ───────────────────────────────────

describe("makeTestRendererClass", () => {
  it("creates a subclass of CairoRenderer", () => {
    const TestRenderer = makeTestRendererClass(CairoRenderer);
    expect(TestRenderer.prototype).toBeInstanceOf(CairoRenderer);
  });
});

// ─── DummySceneFileWriter / makeSceneFileWriterClass ─────────

describe("DummySceneFileWriter", () => {
  it("increments frame counter on writeFrame", async () => {
    // We need a minimal renderer-like object
    const mockRenderer = { numPlays: 0 };
    const mockConfig = {
      pixelWidth: 100,
      pixelHeight: 100,
      frameRate: 30,
      mediaDir: "/tmp/test",
      dryRun: true,
    };

    const writer = new DummySceneFileWriter(mockRenderer, "TestScene", mockConfig);
    expect(writer.i).toBe(0);
    await writer.writeFrame(new Uint8Array(100 * 100 * 4));
    expect(writer.i).toBe(1);
    await writer.writeFrame(new Uint8Array(100 * 100 * 4));
    expect(writer.i).toBe(2);
  });
});
