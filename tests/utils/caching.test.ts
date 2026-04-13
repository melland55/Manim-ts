/**
 * Tests for src/utils/caching/caching.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleCachingPlay,
  type IFileWriter,
  type IOpenGLRenderer,
  type IOpenGLScene,
  type PlayFunction,
} from "../../src/utils/caching/index.js";
import { config } from "../../src/_config/index.js";
import type { IAnimation, ICamera, IMobject } from "../../src/core/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileWriter(overrides: Partial<IFileWriter> = {}): IFileWriter {
  return {
    isAlreadyCached: vi.fn(() => false),
    addPartialMovieFile: vi.fn(),
    ...overrides,
  };
}

function makeRenderer(overrides: Partial<IOpenGLRenderer> = {}): IOpenGLRenderer {
  return {
    skipAnimations: false,
    _originalSkippingStatus: false,
    numPlays: 0,
    animationsHashes: [],
    camera: {} as ICamera,
    fileWriter: makeFileWriter(),
    updateSkippingStatus: vi.fn(),
    ...overrides,
  };
}

function makeScene(
  animations: IAnimation[] = [],
  overrides: Partial<IOpenGLScene> = {},
): IOpenGLScene {
  return {
    mobjects: [] as IMobject[],
    time: 0,
    camera: {} as ICamera,
    add: vi.fn(),
    remove: vi.fn(),
    play: vi.fn(),
    wait: vi.fn(),
    construct: vi.fn(),
    compileAnimations: vi.fn(() => animations),
    addMobjectsFromAnimations: vi.fn(),
    ...overrides,
  } as unknown as IOpenGLScene;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleCachingPlay", () => {
  it("returns a function", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);
    expect(typeof wrapped).toBe("function");
  });

  it("calls the original function when skipAnimations stays false", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;
    try {
      const renderer = makeRenderer({ _originalSkippingStatus: false });
      const scene = makeScene();
      wrapped.call(renderer, scene);
      expect(original).toHaveBeenCalledOnce();
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("skips animation: pushes null hash and calls original (for state advance)", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    // updateSkippingStatus sets skipAnimations=true to exercise the skip path
    const renderer = makeRenderer({
      _originalSkippingStatus: true,
      updateSkippingStatus: vi.fn(function (this: IOpenGLRenderer) {
        this.skipAnimations = true;
      }),
    });
    const scene = makeScene();

    wrapped.call(renderer, scene);

    expect(original).toHaveBeenCalledOnce();
    expect(renderer.animationsHashes).toEqual([null]);
    expect(renderer.fileWriter.addPartialMovieFile).toHaveBeenCalledWith(null);
  });

  it("calls compileAnimations and addMobjectsFromAnimations with forwarded args", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;
    try {
      const renderer = makeRenderer();
      const scene = makeScene();
      wrapped.call(renderer, scene, "arg1", "arg2");
      expect(scene.compileAnimations).toHaveBeenCalledWith("arg1", "arg2");
      expect(scene.addMobjectsFromAnimations).toHaveBeenCalledWith([]);
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("uses uncached hash pattern when disable_caching is enabled", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;

    try {
      const renderer = makeRenderer({ numPlays: 3 });
      const scene = makeScene();

      wrapped.call(renderer, scene);

      expect(renderer.animationsHashes).toEqual(["uncached_00003"]);
      expect(renderer.fileWriter.addPartialMovieFile).toHaveBeenCalledWith(
        "uncached_00003",
      );
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("uncached hash is zero-padded to 5 digits", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;

    try {
      const renderer = makeRenderer({ numPlays: 0 });
      const scene = makeScene();

      wrapped.call(renderer, scene);

      expect(renderer.animationsHashes[0]).toBe("uncached_00000");
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("calls updateSkippingStatus once per invocation", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;
    try {
      const renderer = makeRenderer();
      const scene = makeScene();
      wrapped.call(renderer, scene);
      expect(renderer.updateSkippingStatus).toHaveBeenCalledOnce();
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("resets skipAnimations to _originalSkippingStatus before calling updateSkippingStatus", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    // skipAnimations starts true but _originalSkippingStatus is false → should reset
    const renderer = makeRenderer({
      skipAnimations: true,
      _originalSkippingStatus: false,
    });

    let capturedAfterReset: boolean | undefined;
    (renderer.updateSkippingStatus as ReturnType<typeof vi.fn>).mockImplementation(
      function (this: IOpenGLRenderer) {
        capturedAfterReset = this.skipAnimations;
      },
    );

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;
    try {
      const scene = makeScene();
      wrapped.call(renderer, scene);
      expect(capturedAfterReset).toBe(false);
    } finally {
      delete configRec["disable_caching"];
    }
  });

  it("appends hash to animationsHashes when not skipping and caching is disabled", () => {
    const original: PlayFunction = vi.fn();
    const wrapped = handleCachingPlay(original);

    const configRec = config as unknown as Record<string, unknown>;
    configRec["disable_caching"] = true;

    try {
      const renderer = makeRenderer({ numPlays: 7 });
      const scene = makeScene();

      wrapped.call(renderer, scene);

      expect(renderer.animationsHashes).toHaveLength(1);
      expect(renderer.animationsHashes[0]).toBe("uncached_00007");
    } finally {
      delete configRec["disable_caching"];
    }
  });
});
