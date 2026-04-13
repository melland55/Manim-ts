import { describe, it, expect, beforeEach } from "vitest";
import { Camera } from "../src/camera/index.js";
import { BLACK, WHITE } from "../src/core/color/index.js";
import { np, ORIGIN, LEFT, RIGHT, UP, DOWN } from "../src/core/math/index.js";
import "./helpers/point-matchers.js";

describe("Camera", () => {
  // ── Constructor defaults ─────────────────────────────────────

  describe("constructor defaults", () => {
    it("uses standard Manim pixel dimensions", () => {
      const cam = new Camera();
      expect(cam.pixelWidth).toBe(1920);
      expect(cam.pixelHeight).toBe(1080);
    });

    it("uses standard Manim frame dimensions", () => {
      const cam = new Camera();
      expect(cam.frameWidth).toBeCloseTo(14.222, 2);
      expect(cam.frameHeight).toBe(8.0);
    });

    it("defaults background color to black", () => {
      const cam = new Camera();
      expect(cam.backgroundColor.r).toBe(0);
      expect(cam.backgroundColor.g).toBe(0);
      expect(cam.backgroundColor.b).toBe(0);
    });

    it("defaults frame center to ORIGIN", () => {
      const cam = new Camera();
      expect(cam.getFrameCenter()).toBeCloseToPoint(ORIGIN);
    });
  });

  // ── Constructor options ──────────────────────────────────────

  describe("constructor options", () => {
    it("accepts custom pixel dimensions", () => {
      const cam = new Camera({ pixelWidth: 1280, pixelHeight: 720 });
      expect(cam.pixelWidth).toBe(1280);
      expect(cam.pixelHeight).toBe(720);
    });

    it("accepts custom frame dimensions", () => {
      const cam = new Camera({ frameWidth: 10.0, frameHeight: 5.0 });
      expect(cam.frameWidth).toBe(10.0);
      expect(cam.frameHeight).toBe(5.0);
    });

    it("accepts custom background color", () => {
      const cam = new Camera({ backgroundColor: WHITE });
      expect(cam.backgroundColor.r).toBeCloseTo(1);
      expect(cam.backgroundColor.g).toBeCloseTo(1);
      expect(cam.backgroundColor.b).toBeCloseTo(1);
    });
  });

  // ── Frame center ─────────────────────────────────────────────

  describe("frame center", () => {
    it("setFrameCenter updates the frame center", () => {
      const cam = new Camera();
      const newCenter = np.array([1, 2, 0]);
      cam.setFrameCenter(newCenter);
      expect(cam.getFrameCenter()).toBeCloseToPoint(newCenter);
    });

    it("getFrameCenter returns a copy — mutation does not affect camera", () => {
      const cam = new Camera();
      const center = cam.getFrameCenter();
      center.set([0], 99);
      expect(cam.getFrameCenter()).toBeCloseToPoint(ORIGIN);
    });

    it("setFrameCenter stores a copy — mutation of original does not affect camera", () => {
      const cam = new Camera();
      const point = np.array([3, 4, 0]);
      cam.setFrameCenter(point);
      point.set([0], 99);
      const stored = cam.getFrameCenter();
      expect(stored.item(0) as number).toBeCloseTo(3);
    });
  });

  // ── Frame boundary helpers ───────────────────────────────────

  describe("frame boundaries (centered at origin)", () => {
    let cam: Camera;
    beforeEach(() => {
      cam = new Camera({ frameWidth: 10, frameHeight: 8 });
    });

    it("getFrameLeft", () => expect(cam.getFrameLeft()).toBeCloseTo(-5));
    it("getFrameRight", () => expect(cam.getFrameRight()).toBeCloseTo(5));
    it("getFrameTop", () => expect(cam.getFrameTop()).toBeCloseTo(4));
    it("getFrameBottom", () => expect(cam.getFrameBottom()).toBeCloseTo(-4));

    it("boundaries shift when frame center moves", () => {
      cam.setFrameCenter(np.array([2, 1, 0]));
      expect(cam.getFrameLeft()).toBeCloseTo(-3);
      expect(cam.getFrameRight()).toBeCloseTo(7);
      expect(cam.getFrameTop()).toBeCloseTo(5);
      expect(cam.getFrameBottom()).toBeCloseTo(-3);
    });
  });

  // ── Coordinate conversion ────────────────────────────────────

  describe("worldToPixel", () => {
    let cam: Camera;
    beforeEach(() => {
      // Simple 10×8 frame mapped to 1000×800 pixels for easy math
      cam = new Camera({ pixelWidth: 1000, pixelHeight: 800, frameWidth: 10, frameHeight: 8 });
    });

    it("maps ORIGIN to the pixel center", () => {
      const [px, py] = cam.worldToPixel(np.array([0, 0, 0]));
      expect(px).toBeCloseTo(500);
      expect(py).toBeCloseTo(400);
    });

    it("maps the top-left world corner to pixel (0, 0)", () => {
      const [px, py] = cam.worldToPixel(np.array([-5, 4, 0]));
      expect(px).toBeCloseTo(0);
      expect(py).toBeCloseTo(0);
    });

    it("maps the bottom-right world corner to pixel (1000, 800)", () => {
      const [px, py] = cam.worldToPixel(np.array([5, -4, 0]));
      expect(px).toBeCloseTo(1000);
      expect(py).toBeCloseTo(800);
    });

    it("Z coordinate is ignored", () => {
      const [px1] = cam.worldToPixel(np.array([1, 0, 0]));
      const [px2] = cam.worldToPixel(np.array([1, 0, 99]));
      expect(px1).toBeCloseTo(px2);
    });
  });

  describe("pixelToWorld", () => {
    let cam: Camera;
    beforeEach(() => {
      cam = new Camera({ pixelWidth: 1000, pixelHeight: 800, frameWidth: 10, frameHeight: 8 });
    });

    it("maps the pixel center to ORIGIN", () => {
      const pt = cam.pixelToWorld(500, 400);
      expect(pt).toBeCloseToPoint(np.array([0, 0, 0]));
    });

    it("maps pixel (0, 0) to the top-left world corner", () => {
      const pt = cam.pixelToWorld(0, 0);
      expect(pt).toBeCloseToPoint(np.array([-5, 4, 0]));
    });

    it("is the inverse of worldToPixel", () => {
      const world = np.array([2.5, -1.5, 0]);
      const [px, py] = cam.worldToPixel(world);
      const recovered = cam.pixelToWorld(px, py);
      expect(recovered).toBeCloseToPoint(world);
    });
  });

  // ── Utility helpers ──────────────────────────────────────────

  describe("getPixelsPerUnit", () => {
    it("equals pixelWidth / frameWidth", () => {
      const cam = new Camera({ pixelWidth: 1920, frameWidth: 14.222 });
      expect(cam.getPixelsPerUnit()).toBeCloseTo(1920 / 14.222, 5);
    });
  });

  describe("getAspectRatio", () => {
    it("returns pixelWidth / pixelHeight", () => {
      const cam = new Camera({ pixelWidth: 1920, pixelHeight: 1080 });
      expect(cam.getAspectRatio()).toBeCloseTo(16 / 9, 5);
    });
  });

  // ── captureFrame ─────────────────────────────────────────────

  describe("captureFrame", () => {
    it("does not throw", () => {
      const cam = new Camera();
      expect(() => cam.captureFrame()).not.toThrow();
    });

    it("produces a non-empty PNG buffer after capture", () => {
      const cam = new Camera({ pixelWidth: 4, pixelHeight: 4 });
      cam.captureFrame();
      const buf = cam.toBuffer("image/png");
      expect(buf.length).toBeGreaterThan(0);
    });
  });

  // ── resize ───────────────────────────────────────────────────

  describe("resize", () => {
    it("updates pixel dimensions", () => {
      const cam = new Camera();
      cam.resize(640, 480);
      expect(cam.pixelWidth).toBe(640);
      expect(cam.pixelHeight).toBe(480);
    });

    it("canvas dimensions match after resize", () => {
      const cam = new Camera();
      cam.resize(320, 240);
      expect(cam.canvas.width).toBe(320);
      expect(cam.canvas.height).toBe(240);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles 1×1 pixel camera", () => {
      const cam = new Camera({ pixelWidth: 1, pixelHeight: 1 });
      expect(() => cam.captureFrame()).not.toThrow();
    });

    it("frame center at non-origin position shifts all boundaries", () => {
      const cam = new Camera({ frameWidth: 4, frameHeight: 2 });
      cam.setFrameCenter(np.array([10, 10, 0]));
      expect(cam.getFrameLeft()).toBeCloseTo(8);
      expect(cam.getFrameRight()).toBeCloseTo(12);
      expect(cam.getFrameTop()).toBeCloseTo(11);
      expect(cam.getFrameBottom()).toBeCloseTo(9);
    });

    it("worldToPixel and pixelToWorld are consistent after setFrameCenter", () => {
      const cam = new Camera({ pixelWidth: 500, pixelHeight: 500, frameWidth: 10, frameHeight: 10 });
      cam.setFrameCenter(np.array([5, 5, 0]));
      const world = np.array([5, 5, 0]);
      const [px, py] = cam.worldToPixel(world);
      expect(px).toBeCloseTo(250);
      expect(py).toBeCloseTo(250);
      const recovered = cam.pixelToWorld(px, py);
      expect(recovered).toBeCloseToPoint(world);
    });
  });
});
