import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import { WHITE } from "../../src/core/color/index.js";
import {
  MovingCamera,
  CameraFrame,
  CameraFrameAnimateProxy,
} from "../../src/camera/moving_camera/index.js";
import "../helpers/point-matchers.js";
import type { Point3D, IMobject } from "../../src/core/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal IMobject stub with a given AABB. */
function makeMob(
  left: number,
  right: number,
  bottom: number,
  top: number,
): IMobject {
  return {
    getLeft: () => np.array([left, 0, 0]) as unknown as Point3D,
    getRight: () => np.array([right, 0, 0]) as unknown as Point3D,
    getBottom: () => np.array([0, bottom, 0]) as unknown as Point3D,
    getTop: () => np.array([0, top, 0]) as unknown as Point3D,
    getCenter: () => np.array([(left + right) / 2, (bottom + top) / 2, 0]) as unknown as Point3D,
    getWidth: () => right - left,
    getHeight: () => top - bottom,
  } as unknown as IMobject;
}

// ─── CameraFrame ─────────────────────────────────────────────────────────────

describe("CameraFrame", () => {
  describe("constructor defaults", () => {
    it("defaults to frame dimensions 14.222 × 8", () => {
      const f = new CameraFrame();
      expect(f.width).toBeCloseTo(14.222);
      expect(f.height).toBe(8);
    });

    it("defaults center to ORIGIN", () => {
      const f = new CameraFrame();
      const c = f.getCenter();
      expect(c.item(0)).toBe(0);
      expect(c.item(1)).toBe(0);
      expect(c.item(2)).toBe(0);
    });

    it("accepts custom width and height", () => {
      const f = new CameraFrame(10, 5);
      expect(f.width).toBe(10);
      expect(f.height).toBe(5);
    });
  });

  describe("moveTo", () => {
    it("moves center to a Point3D", () => {
      const f = new CameraFrame();
      const p = np.array([3, 4, 0]) as unknown as Point3D;
      f.moveTo(p);
      expect(f.getCenter().item(0)).toBe(3);
      expect(f.getCenter().item(1)).toBe(4);
    });

    it("moves center to the center of an object", () => {
      const f = new CameraFrame();
      const mob = { getCenter: () => np.array([5, -2, 0]) as unknown as Point3D };
      f.moveTo(mob);
      expect(f.getCenter().item(0)).toBe(5);
      expect(f.getCenter().item(1)).toBe(-2);
    });
  });

  describe("stretchToFitHeight / stretchToFitWidth", () => {
    it("updates height", () => {
      const f = new CameraFrame(10, 5);
      f.stretchToFitHeight(12);
      expect(f.height).toBe(12);
    });

    it("updates width", () => {
      const f = new CameraFrame(10, 5);
      f.stretchToFitWidth(20);
      expect(f.width).toBe(20);
    });
  });

  describe("getCriticalPoint", () => {
    it("left edge center", () => {
      const f = new CameraFrame(10, 4);  // center at origin, hw=5, hh=2
      const left = np.array([-1, 0, 0]) as unknown as Point3D;
      const pt = f.getCriticalPoint(left);
      expect(pt.item(0)).toBeCloseTo(-5);
      expect(pt.item(1)).toBeCloseTo(0);
    });

    it("top edge center", () => {
      const f = new CameraFrame(10, 4);
      const up = np.array([0, 1, 0]) as unknown as Point3D;
      const pt = f.getCriticalPoint(up);
      expect(pt.item(0)).toBeCloseTo(0);
      expect(pt.item(1)).toBeCloseTo(2);
    });

    it("bottom-right corner", () => {
      const f = new CameraFrame(10, 4);
      const dir = np.array([1, -1, 0]) as unknown as Point3D;
      const pt = f.getCriticalPoint(dir);
      expect(pt.item(0)).toBeCloseTo(5);
      expect(pt.item(1)).toBeCloseTo(-2);
    });
  });

  describe("setX / setY / set", () => {
    it("setX updates only x", () => {
      const f = new CameraFrame();
      f.setX(7);
      expect(f.getCenter().item(0)).toBe(7);
      expect(f.getCenter().item(1)).toBe(0);
    });

    it("setY updates only y", () => {
      const f = new CameraFrame();
      f.setY(-3);
      expect(f.getCenter().item(0)).toBe(0);
      expect(f.getCenter().item(1)).toBe(-3);
    });

    it("set updates width", () => {
      const f = new CameraFrame(10, 5);
      f.set({ width: 20 });
      expect(f.width).toBe(20);
      expect(f.height).toBe(5);
    });

    it("set updates height", () => {
      const f = new CameraFrame(10, 5);
      f.set({ height: 15 });
      expect(f.height).toBe(15);
      expect(f.width).toBe(10);
    });
  });

  describe("method chaining", () => {
    it("all mutating methods return this", () => {
      const f = new CameraFrame(10, 5);
      const p = np.array([1, 2, 0]) as unknown as Point3D;
      const result = f.moveTo(p).stretchToFitWidth(20).stretchToFitHeight(10).setX(0).setY(0).set({ width: 14 });
      expect(result).toBe(f);
    });
  });

  describe("animate proxy", () => {
    it("returns a CameraFrameAnimateProxy", () => {
      const f = new CameraFrame();
      expect(f.animate).toBeInstanceOf(CameraFrameAnimateProxy);
    });

    it("proxy applyImmediately mutates the frame", () => {
      const f = new CameraFrame(10, 5);
      const proxy = f.animate.setX(3).setY(4).set({ width: 20 });
      proxy.applyImmediately();
      expect(f.getCenter().item(0)).toBe(3);
      expect(f.getCenter().item(1)).toBe(4);
      expect(f.width).toBe(20);
    });

    it("getTargetState returns recorded values", () => {
      const f = new CameraFrame(10, 5);
      const proxy = f.animate.setX(1).setY(2).set({ height: 8 });
      const state = proxy.getTargetState();
      expect(state.x).toBe(1);
      expect(state.y).toBe(2);
      expect(state.height).toBe(8);
      expect(state.width).toBeUndefined();
    });
  });
});

// ─── MovingCamera ─────────────────────────────────────────────────────────────

describe("MovingCamera", () => {
  describe("constructor defaults", () => {
    it("creates a default CameraFrame", () => {
      const cam = new MovingCamera();
      expect(cam.frame).toBeInstanceOf(CameraFrame);
    });

    it("frame matches camera frame dimensions", () => {
      const cam = new MovingCamera();
      expect(cam.frame.width).toBeCloseTo(cam.frameWidth);
      expect(cam.frame.height).toBeCloseTo(cam.frameHeight);
    });

    it("inherits Camera pixel dimensions", () => {
      const cam = new MovingCamera();
      expect(cam.pixelWidth).toBe(1920);
      expect(cam.pixelHeight).toBe(1080);
    });

    it("fixedDimension defaults to 0", () => {
      const cam = new MovingCamera();
      expect(cam.fixedDimension).toBe(0);
    });

    it("defaultFrameStrokeColor defaults to WHITE", () => {
      const cam = new MovingCamera();
      expect(cam.defaultFrameStrokeColor).toBe(WHITE);
    });

    it("defaultFrameStrokeWidth defaults to 0", () => {
      const cam = new MovingCamera();
      expect(cam.defaultFrameStrokeWidth).toBe(0);
    });
  });

  describe("constructor options", () => {
    it("accepts custom frame dimensions", () => {
      const cam = new MovingCamera({ frameWidth: 20, frameHeight: 10 });
      expect(cam.frame.width).toBe(20);
      expect(cam.frame.height).toBe(10);
    });

    it("accepts a pre-built frame", () => {
      const f = new CameraFrame(8, 4);
      const cam = new MovingCamera({ frame: f });
      expect(cam.frame).toBe(f);
    });

    it("accepts fixedDimension", () => {
      const cam = new MovingCamera({ fixedDimension: 1 });
      expect(cam.fixedDimension).toBe(1);
    });
  });

  describe("frameHeight / frameWidth delegation", () => {
    it("frameHeight getter reads from frame", () => {
      const cam = new MovingCamera({ frameHeight: 6 });
      expect(cam.frameHeight).toBe(cam.frame.height);
    });

    it("frameHeight setter resizes the frame", () => {
      const cam = new MovingCamera();
      cam.frameHeight = 4;
      expect(cam.frame.height).toBe(4);
      expect(cam.frameHeight).toBe(4);
    });

    it("frameWidth setter resizes the frame", () => {
      const cam = new MovingCamera();
      cam.frameWidth = 20;
      expect(cam.frame.width).toBe(20);
      expect(cam.frameWidth).toBe(20);
    });
  });

  describe("frameCenter", () => {
    it("getFrameCenter returns frame center", () => {
      const cam = new MovingCamera();
      const center = cam.getFrameCenter();
      expect(center.item(0)).toBe(0);
      expect(center.item(1)).toBe(0);
    });

    it("setFrameCenter moves the frame", () => {
      const cam = new MovingCamera();
      const p = np.array([3, 4, 0]) as unknown as Point3D;
      cam.setFrameCenter(p);
      expect(cam.frame.getCenter().item(0)).toBe(3);
      expect(cam.frame.getCenter().item(1)).toBe(4);
      expect(cam.getFrameCenter().item(0)).toBe(3);
    });
  });

  describe("worldToPixel uses live frame state", () => {
    it("center maps to canvas center after frame moves", () => {
      const cam = new MovingCamera({
        pixelWidth: 100,
        pixelHeight: 100,
        frameWidth: 10,
        frameHeight: 10,
      });
      cam.setFrameCenter(np.array([5, 5, 0]) as unknown as Point3D);
      // World point (5, 5, 0) is now the frame center → maps to pixel (50, 50)
      const [px, py] = cam.worldToPixel(np.array([5, 5, 0]) as unknown as Point3D);
      expect(px).toBeCloseTo(50);
      expect(py).toBeCloseTo(50);
    });
  });

  describe("getMobjectsIndicatingMovement", () => {
    it("returns array containing the frame", () => {
      const cam = new MovingCamera();
      const result = cam.getMobjectsIndicatingMovement();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(cam.frame as unknown as IMobject);
    });
  });

  describe("isInFrame", () => {
    it("returns true for mob fully inside frame", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(-2, 2, -2, 2);
      expect(cam.isInFrame(mob)).toBe(true);
    });

    it("returns false for mob fully outside frame", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(10, 20, 10, 20);  // far outside
      expect(cam.isInFrame(mob)).toBe(false);
    });

    it("returns true for mob overlapping frame edge", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      // Frame spans [-5, 5] × [-5, 5]; mob partially overlaps right edge
      const mob = makeMob(4, 8, -1, 1);
      expect(cam.isInFrame(mob)).toBe(true);
    });
  });

  describe("autoZoom (animate=false)", () => {
    it("moves frame center to bounding box center", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(0, 4, 0, 4);
      cam.autoZoom([mob], 0, false, false);
      expect(cam.frame.getCenter().item(0)).toBeCloseTo(2);
      expect(cam.frame.getCenter().item(1)).toBeCloseTo(2);
    });

    it("zooms by width when bounding box is wider", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      // bounding box 8 wide × 2 tall → should zoom by width
      const mob = makeMob(-4, 4, -1, 1);
      cam.autoZoom([mob], 0, false, false);
      expect(cam.frame.width).toBeCloseTo(8);
    });

    it("zooms by height when bounding box is taller", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      // bounding box 2 wide × 8 tall → should zoom by height
      const mob = makeMob(-1, 1, -4, 4);
      cam.autoZoom([mob], 0, false, false);
      expect(cam.frame.height).toBeCloseTo(8);
    });

    it("applies margin to zoomed dimension", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(-4, 4, -1, 1);  // 8 wide
      cam.autoZoom([mob], 2, false, false);
      expect(cam.frame.width).toBeCloseTo(10); // 8 + 2 = 10
    });

    it("skips frame itself in bounding box calculation", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(-2, 2, -2, 2);
      // Pass the frame as one of the mobjects — it should be ignored
      const frameMob = cam.frame as unknown as IMobject;
      cam.autoZoom([frameMob, mob], 0, false, false);
      expect(cam.frame.getCenter().item(0)).toBeCloseTo(0);
    });
  });

  describe("autoZoom (animate=true)", () => {
    it("returns a CameraFrameAnimateProxy", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(-2, 2, -2, 2);
      const result = cam.autoZoom([mob], 0, false, true);
      expect(result).toBeInstanceOf(CameraFrameAnimateProxy);
    });

    it("proxy target state has correct center", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(0, 4, 0, 4);
      const proxy = cam.autoZoom([mob], 0, false, true);
      const state = proxy.getTargetState();
      expect(state.x).toBeCloseTo(2);
      expect(state.y).toBeCloseTo(2);
    });
  });

  describe("autoZoom errors", () => {
    it("throws when no valid mobjects are provided", () => {
      const cam = new MovingCamera();
      expect(() => cam.autoZoom([], 0, false, false)).toThrow(
        "Could not determine bounding box",
      );
    });

    it("throws when all mobjects are the frame", () => {
      const cam = new MovingCamera();
      const frameMob = cam.frame as unknown as IMobject;
      expect(() => cam.autoZoom([frameMob], 0, false, false)).toThrow(
        "Could not determine bounding box",
      );
    });

    it("throws when onlyMobjectsInFrame=true and no mob is in frame", () => {
      const cam = new MovingCamera({ frameWidth: 10, frameHeight: 10 });
      const mob = makeMob(100, 200, 100, 200); // far outside
      expect(() => cam.autoZoom([mob], 0, true, false)).toThrow(
        "Could not determine bounding box",
      );
    });
  });

  describe("Cairo stubs", () => {
    it("getCachedCairoContext always returns null", () => {
      const cam = new MovingCamera();
      expect(cam.getCachedCairoContext(null)).toBeNull();
    });

    it("cacheCairoContext is a no-op (does not throw)", () => {
      const cam = new MovingCamera();
      expect(() => cam.cacheCairoContext(null, null)).not.toThrow();
    });
  });
});
