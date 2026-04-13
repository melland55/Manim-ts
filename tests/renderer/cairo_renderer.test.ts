/**
 * Tests for renderer/cairo_renderer — CairoRenderer
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CairoRenderer } from "../../src/renderer/cairo_renderer/index.js";
import type {
  ICairoCamera,
  ICairoScene,
} from "../../src/renderer/cairo_renderer/index.js";
import { EndSceneEarlyException } from "../../src/utils/exceptions/index.js";
import type { IAnimation, IMobject, ICamera } from "../../src/core/types.js";
import type { PixelArray } from "../../src/scene/scene_file_writer/index.js";

// ─── Shared stubs ────────────────────────────────────────────────────────────

/** Minimal camera stub that satisfies ICairoCamera. */
function makeCamera(frameRate = 30): ICairoCamera {
  const pixelArray = new Uint8Array(1920 * 1080 * 4);
  return {
    pixelWidth: 1920,
    pixelHeight: 1080,
    frameWidth: 14.222,
    frameHeight: 8.0,
    backgroundColor: { r: 0, g: 0, b: 0, a: 1, toHex: () => "#000000", toArray: () => [0,0,0,1], interpolate: () => ({} as never), lighter: () => ({} as never), darker: () => ({} as never) },
    frameRate,
    pixelArray,
    getFrameCenter: () => ({ item: () => 0 } as never),
    setFrameCenter: vi.fn(),
    captureFrame: vi.fn(),
    setFrameToBackground: vi.fn(),
    reset: vi.fn(),
    captureMobjects: vi.fn(),
    getImage: vi.fn(() => pixelArray),
  };
}

/** Build a minimal file-writer stub. */
function makeFileWriterStub(sectionsSkip = false) {
  return {
    sections: [{ skipAnimations: sectionsSkip }],
    isAlreadyCached: vi.fn(() => false),
    addPartialMovieFile: vi.fn(),
    beginAnimation: vi.fn(),
    endAnimation: vi.fn(async () => {}),
    writeFrame: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
    saveImage: vi.fn(async () => {}),
  };
}

/** Minimal scene stub. */
function makeScene(
  opts: {
    duration?: number;
    animations?: IAnimation[] | null;
    staticMobjects?: IMobject[];
    movingMobjects?: IMobject[];
    foregroundMobjects?: IMobject[];
    frozenFrame?: boolean;
  } = {},
): ICairoScene {
  return {
    mobjects: [],
    time: 0,
    camera: {} as ICamera,
    animations: opts.animations ?? null,
    duration: opts.duration ?? 1.0,
    staticMobjects: opts.staticMobjects ?? [],
    movingMobjects: opts.movingMobjects ?? [],
    foregroundMobjects: opts.foregroundMobjects ?? [],
    compileAnimationData: vi.fn(),
    isCurrentAnimationFrozenFrame: vi.fn(() => opts.frozenFrame ?? false),
    beginAnimations: vi.fn(),
    playInternal: vi.fn(async () => {}),
    add: vi.fn(function (this: ICairoScene) { return this; }),
    remove: vi.fn(function (this: ICairoScene) { return this; }),
    play: vi.fn(async () => {}),
    wait: vi.fn(async () => {}),
    construct: vi.fn(async () => {}),
  } as unknown as ICairoScene;
}

/** Build a CairoRenderer with a pre-attached file-writer stub. */
function makeRenderer(
  opts: {
    skipAnimations?: boolean;
    frameRate?: number;
    sectionsSkip?: boolean;
  } = {},
) {
  const camera = makeCamera(opts.frameRate ?? 30);
  const renderer = new CairoRenderer({ skipAnimations: opts.skipAnimations ?? false });
  // Inject our camera and a file-writer stub directly.
  (renderer as unknown as { camera: ICairoCamera }).camera = camera;
  const fw = makeFileWriterStub(opts.sectionsSkip ?? false);
  (renderer as unknown as { fileWriter: unknown }).fileWriter = fw;
  return { renderer, camera, fw };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe("CairoRenderer constructor", () => {
  it("initialises numPlays and time to zero", () => {
    const r = new CairoRenderer();
    expect(r.numPlays).toBe(0);
    expect(r.time).toBe(0.0);
  });

  it("initialises skipAnimations from option", () => {
    const r = new CairoRenderer({ skipAnimations: true });
    expect(r.skipAnimations).toBe(true);
  });

  it("initialises animationsHashes as empty array", () => {
    const r = new CairoRenderer();
    expect(r.animationsHashes).toEqual([]);
  });

  it("initialises staticImage as null", () => {
    const r = new CairoRenderer();
    expect(r.staticImage).toBeNull();
  });

  it("creates a camera by default", () => {
    const r = new CairoRenderer();
    expect(r.camera).toBeDefined();
  });
});

// ─── getFrame ─────────────────────────────────────────────────────────────────

describe("CairoRenderer.getFrame", () => {
  it("returns the camera pixelArray", () => {
    const { renderer, camera } = makeRenderer();
    const frame = renderer.getFrame();
    expect(frame).toBe(camera.pixelArray);
  });
});

// ─── getImage ─────────────────────────────────────────────────────────────────

describe("CairoRenderer.getImage", () => {
  it("delegates to camera.getImage()", () => {
    const { renderer, camera } = makeRenderer();
    const result = renderer.getImage();
    expect(camera.getImage).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ─── addFrame ────────────────────────────────────────────────────────────────

describe("CairoRenderer.addFrame", () => {
  it("skips writing when skipAnimations is true", async () => {
    const { renderer, fw } = makeRenderer({ skipAnimations: true });
    await renderer.addFrame(new Uint8Array(4));
    expect(fw.writeFrame).not.toHaveBeenCalled();
  });

  it("advances time by 1/frameRate per frame", async () => {
    const { renderer } = makeRenderer({ frameRate: 10 });
    expect(renderer.time).toBe(0);
    await renderer.addFrame(new Uint8Array(4));
    expect(renderer.time).toBeCloseTo(1 / 10);
  });

  it("advances time by numFrames / frameRate", async () => {
    const { renderer } = makeRenderer({ frameRate: 10 });
    await renderer.addFrame(new Uint8Array(4), 5);
    expect(renderer.time).toBeCloseTo(5 / 10);
  });

  it("calls fileWriter.writeFrame with the frame and numFrames", async () => {
    const { renderer, fw } = makeRenderer();
    const frame = new Uint8Array(4);
    await renderer.addFrame(frame, 3);
    expect(fw.writeFrame).toHaveBeenCalledWith(frame, 3);
  });
});

// ─── freezeCurrentFrame ───────────────────────────────────────────────────────

describe("CairoRenderer.freezeCurrentFrame", () => {
  it("adds round(duration / dt) copies of the current frame", async () => {
    const { renderer, fw } = makeRenderer({ frameRate: 10 });
    // duration = 0.5 s → 5 frames at 10 fps
    await renderer.freezeCurrentFrame(0.5);
    expect(fw.writeFrame).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      5,
    );
  });
});

// ─── saveStaticFrameData ──────────────────────────────────────────────────────

describe("CairoRenderer.saveStaticFrameData", () => {
  it("returns null and leaves staticImage null when no static mobjects", () => {
    const { renderer } = makeRenderer();
    const scene = makeScene();
    const result = renderer.saveStaticFrameData(scene, []);
    expect(result).toBeNull();
    expect(renderer.staticImage).toBeNull();
  });

  it("caches a frame and returns it when static mobjects exist", () => {
    const { renderer } = makeRenderer();
    const scene = makeScene();
    const fakeMob = {} as IMobject;
    const result = renderer.saveStaticFrameData(scene, [fakeMob]);
    expect(result).not.toBeNull();
    expect(renderer.staticImage).toBe(result);
  });
});

// ─── updateFrame ─────────────────────────────────────────────────────────────

describe("CairoRenderer.updateFrame", () => {
  it("calls camera.reset() when staticImage is null", () => {
    const { renderer, camera } = makeRenderer();
    renderer.staticImage = null;
    const scene = makeScene();
    renderer.updateFrame(scene);
    expect(camera.reset).toHaveBeenCalled();
  });

  it("calls camera.setFrameToBackground() when staticImage is set", () => {
    const { renderer, camera } = makeRenderer();
    const img = new Uint8Array(4);
    renderer.staticImage = img;
    const scene = makeScene();
    renderer.updateFrame(scene);
    expect(camera.setFrameToBackground).toHaveBeenCalledWith(img);
  });

  it("skips rendering when skipAnimations=true and ignoreSkipping=false", () => {
    const { renderer, camera } = makeRenderer({ skipAnimations: true });
    const scene = makeScene();
    renderer.updateFrame(scene, { ignoreSkipping: false });
    expect(camera.captureMobjects).not.toHaveBeenCalled();
  });

  it("renders even when skipAnimations=true if ignoreSkipping=true (default)", () => {
    const { renderer, camera } = makeRenderer({ skipAnimations: true });
    const scene = makeScene();
    renderer.updateFrame(scene);
    expect(camera.captureMobjects).toHaveBeenCalled();
  });
});

// ─── updateSkippingStatus ────────────────────────────────────────────────────

describe("CairoRenderer.updateSkippingStatus", () => {
  it("sets skipAnimations when section has skipAnimations=true", () => {
    const { renderer } = makeRenderer({ sectionsSkip: true });
    renderer.skipAnimations = false;
    renderer.updateSkippingStatus();
    expect(renderer.skipAnimations).toBe(true);
  });

  it("does not change skipAnimations when section flag is false", () => {
    const { renderer } = makeRenderer({ sectionsSkip: false });
    renderer.skipAnimations = false;
    renderer.updateSkippingStatus();
    expect(renderer.skipAnimations).toBe(false);
  });
});

// ─── play ─────────────────────────────────────────────────────────────────────

describe("CairoRenderer.play", () => {
  it("increments numPlays after each call", async () => {
    const { renderer } = makeRenderer();
    const scene = makeScene();
    expect(renderer.numPlays).toBe(0);
    await renderer.play(scene);
    expect(renderer.numPlays).toBe(1);
    await renderer.play(scene);
    expect(renderer.numPlays).toBe(2);
  });

  it("appends a hash to animationsHashes for each play call", async () => {
    const { renderer } = makeRenderer();
    const scene = makeScene();
    await renderer.play(scene);
    expect(renderer.animationsHashes).toHaveLength(1);
    await renderer.play(scene);
    expect(renderer.animationsHashes).toHaveLength(2);
  });

  it("appends null to animationsHashes when skipping", async () => {
    const { renderer } = makeRenderer({ skipAnimations: true });
    const scene = makeScene();
    await renderer.play(scene);
    expect(renderer.animationsHashes[0]).toBeNull();
  });

  it("calls scene.compileAnimationData with forwarded args", async () => {
    const { renderer } = makeRenderer();
    const scene = makeScene();
    await renderer.play(scene, "arg1", 42);
    expect(scene.compileAnimationData).toHaveBeenCalledWith("arg1", 42);
  });

  it("calls fileWriter.endAnimation after rendering", async () => {
    const { renderer, fw } = makeRenderer();
    const scene = makeScene();
    await renderer.play(scene);
    expect(fw.endAnimation).toHaveBeenCalled();
  });
});
