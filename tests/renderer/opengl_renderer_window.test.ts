import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "../../src/renderer/opengl_renderer_window/index.js";
import type {
  MonitorInfo,
  IOpenGLRenderer,
  IWindowScene,
} from "../../src/renderer/opengl_renderer_window/index.js";
import { np } from "../../src/core/math/index.js";
import type { Point3D } from "../../src/core/types.js";

// ─── Test helpers ────────────────────────────────────────────────────────────

const monitor1080p: MonitorInfo = { x: 0, y: 0, width: 1920, height: 1080 };
const monitor4k: MonitorInfo = { x: 0, y: 0, width: 3840, height: 2160 };
const monitorOffset: MonitorInfo = { x: 1920, y: 0, width: 2560, height: 1440 };

/** Builds a minimal mock renderer. All scene callbacks are vi.fn(). */
function makeRenderer(): IOpenGLRenderer & { scene: Record<string, ReturnType<typeof vi.fn>> } {
  const scene: IWindowScene & Record<string, ReturnType<typeof vi.fn>> = {
    onMouseMotion: vi.fn(),
    onMouseScroll: vi.fn(),
    onKeyPress: vi.fn(),
    onKeyRelease: vi.fn(),
    onMouseDrag: vi.fn(),
    onMousePress: vi.fn(),
  };

  return {
    pressedKeys: new Set<number>(),
    scene,
    pixelCoordsToSpaceCoords: (x: number, y: number, _relative?: boolean): Point3D =>
      np.array([x * 0.01, y * 0.01, 0]),
  };
}

// ─── Window.computeSize ──────────────────────────────────────────────────────

describe("Window.computeSize", () => {
  it("accepts a [width, height] tuple", () => {
    const size = Window.computeSize([800, 600], monitor1080p, {
      fullscreen: false,
      frameHeight: 8,
      frameWidth: 14.222,
    });
    expect(size).toEqual([800, 600]);
  });

  it("throws for a tuple with wrong length", () => {
    expect(() =>
      Window.computeSize([800] as unknown as [number, number], monitor1080p, {
        fullscreen: false,
        frameHeight: 8,
        frameWidth: 14.222,
      }),
    ).toThrow();
  });

  it("'default' → half monitor width and proportional height (non-fullscreen)", () => {
    const [w, h] = Window.computeSize("default", monitor1080p, {
      fullscreen: false,
      frameHeight: 8,
      frameWidth: 14.222,
    });
    expect(w).toBe(960); // 1920 / 2
    // height = floor(960 * 8 / 14.222)
    expect(h).toBe(Math.floor((960 * 8) / 14.222));
  });

  it("'default' → full monitor width when fullscreen", () => {
    const [w] = Window.computeSize("default", monitor1080p, {
      fullscreen: true,
      frameHeight: 8,
      frameWidth: 14.222,
    });
    expect(w).toBe(1920);
  });

  it("'default' works with 4K monitor", () => {
    const [w] = Window.computeSize("default", monitor4k, {
      fullscreen: false,
      frameHeight: 8,
      frameWidth: 14.222,
    });
    expect(w).toBe(1920); // 3840 / 2
  });

  it("parses 'width,height' string form", () => {
    const size = Window.computeSize("1280,720", monitor1080p, {
      fullscreen: false,
      frameHeight: 8,
      frameWidth: 14.222,
    });
    expect(size).toEqual([1280, 720]);
  });

  it("throws for an invalid string", () => {
    expect(() =>
      Window.computeSize("bad-value", monitor1080p, {
        fullscreen: false,
        frameHeight: 8,
        frameWidth: 14.222,
      }),
    ).toThrow();
  });

  it("throws for a non-numeric 'width,height' string", () => {
    expect(() =>
      Window.computeSize("abc,def", monitor1080p, {
        fullscreen: false,
        frameHeight: 8,
        frameWidth: 14.222,
      }),
    ).toThrow();
  });
});

// ─── Window.findInitialPosition ─────────────────────────────────────────────

describe("Window.prototype.findInitialPosition", () => {
  let renderer: IOpenGLRenderer;

  beforeEach(() => {
    renderer = makeRenderer();
  });

  function makeWin(pos = "OO"): Window {
    return new Window(renderer, [960, 540], {
      windowPosition: pos,
      windowMonitor: 0,
    });
  }

  it("'OO' → centered on monitor", () => {
    const win = makeWin("OO");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "OO");
    // widthDiff = 1920 - 960 = 960; charToN['O'] = 1; x = 0 + floor(1 * 960 / 2) = 480
    // heightDiff = 1080 - 540 = 540; y = -0 + floor(1 * 540 / 2) = 270
    expect(pos).toEqual([480, 270]);
  });

  it("'UL' → top-left corner of monitor", () => {
    const win = makeWin("UL");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "UL");
    // charToN['L'] = 0, charToN['U'] = 0 → x = 0, y = 0
    expect(pos).toEqual([0, 0]);
  });

  it("'DR' → bottom-right corner of monitor", () => {
    const win = makeWin("DR");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "DR");
    // charToN['R'] = 2, charToN['D'] = 2
    // x = 0 + floor(2 * 960 / 2) = 960
    // y = -0 + floor(2 * 540 / 2) = 540
    expect(pos).toEqual([960, 540]);
  });

  it("'LEFT' alias → 'OL'", () => {
    const win = makeWin("LEFT");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "LEFT");
    // 'LEFT' → 'OL': charToN['L'] = 0, charToN['O'] = 1 → x = 0, y = 270
    expect(pos).toEqual([0, 270]);
  });

  it("'RIGHT' alias → 'OR'", () => {
    const win = makeWin("RIGHT");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "RIGHT");
    // 'OR': charToN['R'] = 2, charToN['O'] = 1 → x = 960, y = 270
    expect(pos).toEqual([960, 270]);
  });

  it("'UP' alias → 'UO'", () => {
    const win = makeWin("UP");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "UP");
    // 'UO': charToN['O'] = 1 (x), charToN['U'] = 0 (y) → x = 480, y = 0
    expect(pos).toEqual([480, 0]);
  });

  it("'DOWN' alias → 'DO'", () => {
    const win = makeWin("DOWN");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "DOWN");
    // 'DO': x = 480, y = 540
    expect(pos).toEqual([480, 540]);
  });

  it("'ORIGIN' alias → 'OO'", () => {
    const win = makeWin("ORIGIN");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "ORIGIN");
    expect(pos).toEqual([480, 270]);
  });

  it("'y,x' explicit coordinates are returned as [x, y]", () => {
    const win = makeWin("100,200");
    const pos = win.findInitialPosition([960, 540], monitor1080p, "100,200");
    expect(pos).toEqual([200, 100]);
  });

  it("single-char position throws", () => {
    const win = makeWin("OO");
    expect(() => win.findInitialPosition([960, 540], monitor1080p, "U")).toThrow();
  });

  it("respects monitor offset", () => {
    const win = makeWin("UL");
    const pos = win.findInitialPosition([960, 540], monitorOffset, "UL");
    // charToN['L'] = 0, charToN['U'] = 0 → x = 1920 + 0 = 1920, y = -0 + 0 = 0
    expect(pos).toEqual([1920, 0]);
  });
});

// ─── Constructor ─────────────────────────────────────────────────────────────

describe("Window constructor", () => {
  it("sets title to include version string", () => {
    const renderer = makeRenderer();
    const win = new Window(renderer, [800, 600]);
    expect(win.title).toMatch(/Manim Community/);
  });

  it("stores size from tuple", () => {
    const renderer = makeRenderer();
    const win = new Window(renderer, [1280, 720]);
    expect(win.size).toEqual([1280, 720]);
  });

  it("stores size from 'width,height' string", () => {
    const renderer = makeRenderer();
    const win = new Window(renderer, "640,480");
    expect(win.size).toEqual([640, 480]);
  });

  it("throws for invalid window size", () => {
    const renderer = makeRenderer();
    expect(() => new Window(renderer, "badsize")).toThrow();
  });

  it("stores the renderer reference", () => {
    const renderer = makeRenderer();
    const win = new Window(renderer, [800, 600]);
    expect(win.renderer).toBe(renderer);
  });

  it("computes initial position on construction", () => {
    const renderer = makeRenderer();
    const win = new Window(renderer, [960, 540], { windowPosition: "OO" });
    // position is set — just verify it is an [x, y] pair
    expect(Array.isArray(win.position)).toBe(true);
    expect(win.position).toHaveLength(2);
  });
});

// ─── Event handlers ──────────────────────────────────────────────────────────

describe("Window event delegation", () => {
  let renderer: ReturnType<typeof makeRenderer>;
  let win: Window;

  beforeEach(() => {
    renderer = makeRenderer();
    win = new Window(renderer, [960, 540]);
  });

  it("onMouseMotion delegates to scene", () => {
    win.onMouseMotion(100, 200, 5, -3);
    expect(renderer.scene.onMouseMotion).toHaveBeenCalledOnce();
  });

  it("onMouseScroll delegates to scene", () => {
    win.onMouseScroll(100, 200, 0, 1);
    expect(renderer.scene.onMouseScroll).toHaveBeenCalledOnce();
  });

  it("onKeyPress adds symbol to pressedKeys and delegates to scene", () => {
    win.onKeyPress(65, 0); // 'A'
    expect(renderer.pressedKeys.has(65)).toBe(true);
    expect(renderer.scene.onKeyPress).toHaveBeenCalledWith(65, 0);
  });

  it("onKeyPress returns true", () => {
    const result = win.onKeyPress(65, 0);
    expect(result).toBe(true);
  });

  it("onKeyRelease removes symbol from pressedKeys and delegates to scene", () => {
    renderer.pressedKeys.add(65);
    win.onKeyRelease(65, 0);
    expect(renderer.pressedKeys.has(65)).toBe(false);
    expect(renderer.scene.onKeyRelease).toHaveBeenCalledWith(65, 0);
  });

  it("onKeyRelease is safe when key was not in pressedKeys", () => {
    expect(() => win.onKeyRelease(99, 0)).not.toThrow();
  });

  it("onMouseDrag delegates to scene", () => {
    win.onMouseDrag(100, 200, 5, -3, 1, 0);
    expect(renderer.scene.onMouseDrag).toHaveBeenCalledOnce();
  });

  it("onMousePress maps button 1 → 'LEFT'", () => {
    win.onMousePress(100, 200, 1, 0);
    const [, buttonArg] = (renderer.scene.onMousePress as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(buttonArg).toBe("LEFT");
  });

  it("onMousePress maps button 4 → 'RIGHT'", () => {
    win.onMousePress(100, 200, 4, 0);
    const [, buttonArg] = (renderer.scene.onMousePress as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(buttonArg).toBe("RIGHT");
  });

  it("onMousePress maps button 2 → 'MOUSE'", () => {
    win.onMousePress(100, 200, 2, 0);
    const [, buttonArg] = (renderer.scene.onMousePress as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(buttonArg).toBe("MOUSE");
  });

  it("onMousePress maps unknown button → 'UNKNOWN'", () => {
    win.onMousePress(100, 200, 99, 0);
    const [, buttonArg] = (renderer.scene.onMousePress as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(buttonArg).toBe("UNKNOWN");
  });
});

// ─── Static class properties ─────────────────────────────────────────────────

describe("Window static properties", () => {
  it("fullscreen defaults to false", () => {
    expect(Window.fullscreen).toBe(false);
  });

  it("resizable is true", () => {
    expect(Window.resizable).toBe(true);
  });

  it("glVersion is [3, 3]", () => {
    expect(Window.glVersion).toEqual([3, 3]);
  });

  it("vsync is true", () => {
    expect(Window.vsync).toBe(true);
  });

  it("cursor is true", () => {
    expect(Window.cursor).toBe(true);
  });
});
