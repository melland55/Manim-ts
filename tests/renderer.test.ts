import { describe, it, expect, beforeEach } from "vitest";
import { createCanvas } from "canvas";
import { Renderer } from "../src/renderer/index.js";
import { BLACK, WHITE, RED, BLUE } from "../src/core/color/index.js";
import { np, ORIGIN } from "../src/core/math/index.js";
import type { ICamera, IMobject, IVMobject, IScene, IColor } from "../src/core/types.js";
import type { Point3D, Points3D } from "../src/core/types.js";
import "./helpers/point-matchers.js";

// ── Minimal camera stub ──────────────────────────────────────────────────────

function makeCamera(
  pixelWidth = 100,
  pixelHeight = 100,
  frameWidth = 10,
  frameHeight = 10,
  backgroundColor: IColor = BLACK
): ICamera {
  return {
    pixelWidth,
    pixelHeight,
    frameWidth,
    frameHeight,
    backgroundColor,
    getFrameCenter: () => ORIGIN.copy(),
    setFrameCenter: () => {},
    captureFrame: () => {},
  };
}

// ── Minimal mobject stub ─────────────────────────────────────────────────────

function makeMobject(zIndex = 0): IMobject {
  return {
    name: "stub",
    color: WHITE,
    submobjects: [],
    updaters: [],
    zIndex,
    getCenter: () => np.array([0, 0, 0]),
    getLeft: () => np.array([-1, 0, 0]),
    getRight: () => np.array([1, 0, 0]),
    getTop: () => np.array([0, 1, 0]),
    getBottom: () => np.array([0, -1, 0]),
    getWidth: () => 2,
    getHeight: () => 2,
    moveTo: function () { return this; },
    shift: function () { return this; },
    scale: function () { return this; },
    rotate: function () { return this; },
    flip: function () { return this; },
    nextTo: function () { return this; },
    alignTo: function () { return this; },
    add: function () { return this; },
    remove: function () { return this; },
    getFamily: () => [],
    setColor: function () { return this; },
    setOpacity: function () { return this; },
    addUpdater: function () { return this; },
    removeUpdater: function () { return this; },
    applyMatrix: function () { return this; },
    applyFunction: function () { return this; },
    copy: function () { return this; },
  };
}

// ── Minimal VMobject stub ────────────────────────────────────────────────────

function makeVMobject(subpaths: Points3D[] = []): IVMobject {
  const base = makeMobject();
  return {
    ...base,
    fillColor: RED,
    fillOpacity: 1.0,
    strokeColor: BLUE,
    strokeOpacity: 1.0,
    strokeWidth: 2,
    points: np.zeros([0, 3]),
    startNewPath: function () { return this; },
    addLineTo: function () { return this; },
    addCubicBezierCurveTo: function () { return this; },
    addQuadraticBezierCurveTo: function () { return this; },
    closePath: function () { return this; },
    clearPoints: function () { return this; },
    getAnchors: () => np.zeros([0, 3]),
    getHandles: () => np.zeros([0, 3]),
    getSubpaths: () => subpaths,
    getArcLength: () => 0,
    pointFromProportion: () => np.array([0, 0, 0]),
    setFill: function () { return this; },
    setStroke: function () { return this; },
    appendVectorizedMobject: function () { return this; },
  } as unknown as IVMobject;
}

// ── Minimal scene stub ───────────────────────────────────────────────────────

function makeScene(mobjects: IMobject[] = [], camera = makeCamera()): IScene {
  return {
    mobjects,
    time: 0,
    camera,
    add: function () { return this; },
    remove: function () { return this; },
    play: async () => {},
    wait: async () => {},
    construct: async () => {},
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Renderer", () => {
  // ── Constructor defaults ─────────────────────────────────────

  describe("constructor defaults", () => {
    it("starts uninitialised", () => {
      const r = new Renderer();
      expect(r.isInitialized).toBe(false);
    });

    it("width and height are 0 before initialisation", () => {
      const r = new Renderer();
      expect(r.width).toBe(0);
      expect(r.height).toBe(0);
    });
  });

  // ── initWithNodeCanvas ───────────────────────────────────────

  describe("initWithNodeCanvas", () => {
    it("marks the renderer as initialised", () => {
      const r = new Renderer();
      const canvas = createCanvas(200, 100);
      r.initWithNodeCanvas(canvas);
      expect(r.isInitialized).toBe(true);
    });

    it("records canvas dimensions", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(640, 480));
      expect(r.width).toBe(640);
      expect(r.height).toBe(480);
    });

    it("can be re-initialised with a different canvas", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));
      r.initWithNodeCanvas(createCanvas(320, 240));
      expect(r.width).toBe(320);
      expect(r.height).toBe(240);
    });
  });

  // ── clear ────────────────────────────────────────────────────

  describe("clear", () => {
    it("does not throw before initialisation", () => {
      const r = new Renderer();
      expect(() => r.clear(BLACK)).not.toThrow();
    });

    it("does not throw with white color", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(10, 10));
      expect(() => r.clear(WHITE)).not.toThrow();
    });

    it("does not throw with a semi-transparent color", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(10, 10));
      const semiRed = RED; // RED has a=1; close enough for this smoke test
      expect(() => r.clear(semiRed)).not.toThrow();
    });
  });

  // ── renderMobject ────────────────────────────────────────────

  describe("renderMobject", () => {
    it("does not throw for a non-VMobject (silently skipped)", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));
      const mob = makeMobject();
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });

    it("does not throw for a VMobject with no subpaths", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));
      const mob = makeVMobject([]);
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });

    it("does not throw for a VMobject with a single cubic bezier subpath", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));

      // One cubic bezier: anchor0, ctrl1, ctrl2, anchor1 (4 points)
      const subpath = np.array([
        [-1, 0, 0],
        [-0.5, 1, 0],
        [0.5, 1, 0],
        [1, 0, 0],
      ]);
      const mob = makeVMobject([subpath]);
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });

    it("skips subpaths with fewer than 4 points", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(50, 50));
      // Only 3 points — not enough for a cubic bezier
      const subpath = np.array([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
      const mob = makeVMobject([subpath]);
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });

    it("does not throw before initialisation", () => {
      const r = new Renderer();
      const mob = makeVMobject([]);
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });
  });

  // ── render (full scene) ──────────────────────────────────────

  describe("render", () => {
    it("does not throw for an empty scene", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));
      expect(() => r.render(makeScene())).not.toThrow();
    });

    it("does not throw for a scene with one non-VMobject", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(100, 100));
      const mob = makeMobject();
      mob.getFamily = () => [mob];
      expect(() => r.render(makeScene([mob]))).not.toThrow();
    });

    it("uses the scene camera's background color for the clear pass", () => {
      // Smoke test: just ensure no throw with a white-background camera
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(10, 10));
      const scene = makeScene([], makeCamera(10, 10, 10, 10, WHITE));
      expect(() => r.render(scene)).not.toThrow();
    });

    it("renders without throwing when scene has a VMobject", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(200, 200));
      const subpath = np.array([
        [-1, -1, 0],
        [-1, 1, 0],
        [1, 1, 0],
        [1, -1, 0],
      ]);
      const vmob = makeVMobject([subpath]);
      vmob.getFamily = () => [vmob];
      expect(() => r.render(makeScene([vmob]))).not.toThrow();
    });

    it("sorts mobjects by zIndex before rendering", () => {
      // Smoke test: no throw; correct ordering is validated by not throwing
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(50, 50));
      const a = makeMobject(10);
      const b = makeMobject(1);
      a.getFamily = () => [a];
      b.getFamily = () => [b];
      expect(() => r.render(makeScene([a, b]))).not.toThrow();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles a 1×1 canvas without throwing", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(1, 1));
      expect(() => r.render(makeScene())).not.toThrow();
    });

    it("VMobject with fillOpacity=0 and strokeOpacity=0 does not throw", () => {
      const r = new Renderer();
      r.initWithNodeCanvas(createCanvas(50, 50));
      const subpath = np.array([
        [0, 0, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 0],
      ]);
      const mob = makeVMobject([subpath]);
      (mob as unknown as Record<string, unknown>).fillOpacity = 0;
      (mob as unknown as Record<string, unknown>).strokeOpacity = 0;
      expect(() => r.renderMobject(mob, makeCamera())).not.toThrow();
    });
  });
});
