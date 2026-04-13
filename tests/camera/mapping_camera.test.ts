import { describe, it, expect, vi } from "vitest";
import { np, ORIGIN } from "../../src/core/math/index.js";
import { Camera } from "../../src/camera/index.js";
import {
  MappingCamera,
  OldMultiCamera,
  SplitScreenCamera,
} from "../../src/camera/mapping_camera/index.js";
import "../helpers/point-matchers.js";
import type { Point3D } from "../../src/core/types.js";

// ─── MappingCamera ────────────────────────────────────────────────────────────

describe("MappingCamera", () => {
  describe("constructor defaults", () => {
    it("defaults mappingFunc to identity", () => {
      const cam = new MappingCamera();
      const p = np.array([1, 2, 3]) as unknown as Point3D;
      const mapped = cam.mappingFunc(p);
      // Identity — same reference or same values
      expect(mapped.get([0])).toBe(p.get([0]));
      expect(mapped.get([1])).toBe(p.get([1]));
      expect(mapped.get([2])).toBe(p.get([2]));
    });

    it("defaults minNumCurves to 50", () => {
      const cam = new MappingCamera();
      expect(cam.minNumCurves).toBe(50);
    });

    it("defaults allowObjectIntrusion to false", () => {
      const cam = new MappingCamera();
      expect(cam.allowObjectIntrusion).toBe(false);
    });

    it("inherits Camera pixel dimensions", () => {
      const cam = new MappingCamera();
      expect(cam.pixelWidth).toBe(1920);
      expect(cam.pixelHeight).toBe(1080);
    });
  });

  describe("constructor options", () => {
    it("accepts a custom mappingFunc", () => {
      const shift = (p: Point3D): Point3D =>
        np.array([
          (p.get([0]) as number) + 1,
          (p.get([1]) as number) + 2,
          (p.get([2]) as number) + 3,
        ]) as unknown as Point3D;
      const cam = new MappingCamera({ mappingFunc: shift });
      expect(cam.mappingFunc).toBe(shift);
    });

    it("accepts custom minNumCurves", () => {
      const cam = new MappingCamera({ minNumCurves: 100 });
      expect(cam.minNumCurves).toBe(100);
    });

    it("accepts allowObjectIntrusion = true", () => {
      const cam = new MappingCamera({ allowObjectIntrusion: true });
      expect(cam.allowObjectIntrusion).toBe(true);
    });

    it("forwards pixel dimensions to Camera", () => {
      const cam = new MappingCamera({ pixelWidth: 640, pixelHeight: 360 });
      expect(cam.pixelWidth).toBe(640);
      expect(cam.pixelHeight).toBe(360);
    });
  });

  describe("worldToPixel with identity mapping", () => {
    it("produces the same result as the base Camera", () => {
      const base = new Camera({ pixelWidth: 100, pixelHeight: 100, frameWidth: 10, frameHeight: 10 });
      const mapped = new MappingCamera({ pixelWidth: 100, pixelHeight: 100, frameWidth: 10, frameHeight: 10 });

      const point = np.array([0, 0, 0]) as unknown as Point3D;
      expect(mapped.worldToPixel(point)).toStrictEqual(base.worldToPixel(point));
    });
  });

  describe("worldToPixel with custom mapping", () => {
    it("applies mappingFunc before projection", () => {
      // Mapping shifts every point right by 5 world units.
      const shiftRight = (p: Point3D): Point3D =>
        np.array([
          (p.get([0]) as number) + 5,
          p.get([1]) as number,
          p.get([2]) as number,
        ]) as unknown as Point3D;

      const cam = new MappingCamera({
        pixelWidth: 100,
        pixelHeight: 100,
        frameWidth: 10,
        frameHeight: 10,
        mappingFunc: shiftRight,
      });

      // Origin in world → maps to (5, 0, 0) → which is 100px right of center
      const [px] = cam.worldToPixel(np.array([0, 0, 0]) as unknown as Point3D);
      expect(px).toBeCloseTo(100); // (5 + 5) / 10 * 100 = 100px
    });
  });

  describe("pointsToPixelCoords", () => {
    it("returns pixel coords for each point", () => {
      const cam = new MappingCamera({
        pixelWidth: 100,
        pixelHeight: 100,
        frameWidth: 10,
        frameHeight: 10,
      });

      const points = np.array([[0, 0, 0], [5, 0, 0]]) as unknown as import("../../src/core/types.js").Points3D;
      const coords = cam.pointsToPixelCoords(points);

      expect(coords).toHaveLength(2);
      // Origin → center pixel
      expect(coords[0][0]).toBeCloseTo(50);
      expect(coords[0][1]).toBeCloseTo(50);
      // (5, 0, 0) → right edge
      expect(coords[1][0]).toBeCloseTo(100);
      expect(coords[1][1]).toBeCloseTo(50);
    });

    it("applies mappingFunc to each row", () => {
      // Negate X for every point
      const negateX = (p: Point3D): Point3D =>
        np.array([
          -(p.get([0]) as number),
          p.get([1]) as number,
          p.get([2]) as number,
        ]) as unknown as Point3D;

      const cam = new MappingCamera({
        pixelWidth: 100,
        pixelHeight: 100,
        frameWidth: 10,
        frameHeight: 10,
        mappingFunc: negateX,
      });

      // (5, 0) in world → mapped to (-5, 0) → leftmost pixel
      const points = np.array([[5, 0, 0]]) as unknown as import("../../src/core/types.js").Points3D;
      const [coord] = cam.pointsToPixelCoords(points);
      expect(coord[0]).toBeCloseTo(0);
    });
  });

  describe("captureMobjects", () => {
    it("copies mobjects when allowObjectIntrusion is false", () => {
      const cam = new MappingCamera();
      const copySpy = vi.fn().mockReturnThis();
      const mob = { copy: copySpy } as unknown as import("../../src/core/types.js").IMobject;

      cam.captureMobjects([mob]);
      expect(copySpy).toHaveBeenCalledOnce();
    });

    it("does NOT copy mobjects when allowObjectIntrusion is true", () => {
      const cam = new MappingCamera({ allowObjectIntrusion: true });
      const copySpy = vi.fn().mockReturnThis();
      const mob = { copy: copySpy } as unknown as import("../../src/core/types.js").IMobject;

      cam.captureMobjects([mob]);
      expect(copySpy).not.toHaveBeenCalled();
    });

    it("calls insertNCurves when VMobject has too few curves", () => {
      const cam = new MappingCamera({ minNumCurves: 50 });
      const insertSpy = vi.fn();
      const vmob = {
        copy: vi.fn().mockReturnThis(),
        points: {},          // duck-typing: has 'points'
        getNumCurves: () => 10,
        insertNCurves: insertSpy,
      } as unknown as import("../../src/core/types.js").IMobject;

      cam.captureMobjects([vmob]);
      expect(insertSpy).toHaveBeenCalledWith(50);
    });

    it("does NOT call insertNCurves when curves already meet minimum", () => {
      const cam = new MappingCamera({ minNumCurves: 50 });
      const insertSpy = vi.fn();
      const vmob = {
        copy: vi.fn().mockReturnThis(),
        points: {},
        getNumCurves: () => 60,
        insertNCurves: insertSpy,
      } as unknown as import("../../src/core/types.js").IMobject;

      cam.captureMobjects([vmob]);
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("does NOT call insertNCurves when curve count is 0", () => {
      // Curve count 0 means no path yet — don't try to insert curves
      const cam = new MappingCamera({ minNumCurves: 50 });
      const insertSpy = vi.fn();
      const vmob = {
        copy: vi.fn().mockReturnThis(),
        points: {},
        getNumCurves: () => 0,
        insertNCurves: insertSpy,
      } as unknown as import("../../src/core/types.js").IMobject;

      cam.captureMobjects([vmob]);
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });
});

// ─── OldMultiCamera ───────────────────────────────────────────────────────────

describe("OldMultiCamera", () => {
  describe("constructor", () => {
    it("stores shifted cameras from pairs", () => {
      const cam1 = new Camera({ pixelWidth: 960, pixelHeight: 1080 });
      const cam2 = new Camera({ pixelWidth: 960, pixelHeight: 1080 });
      const multi = new OldMultiCamera(
        [[cam1, [0, 0]], [cam2, [0, 960]]],
      );
      // Access via captureMobjects or initBackground — just verify construction
      expect(multi).toBeInstanceOf(Camera);
    });

    it("inherits master camera dimensions from options", () => {
      const sub = new Camera({ pixelWidth: 100, pixelHeight: 100 });
      const multi = new OldMultiCamera(
        [[sub, [0, 0]]],
        { pixelWidth: 200, pixelHeight: 200 },
      );
      expect(multi.pixelWidth).toBe(200);
      expect(multi.pixelHeight).toBe(200);
    });
  });

  describe("initBackground", () => {
    it("calls captureFrame on master camera without throwing", () => {
      const sub = new Camera({ pixelWidth: 100, pixelHeight: 100 });
      const multi = new OldMultiCamera([[sub, [0, 0]]], { pixelWidth: 200, pixelHeight: 200 });
      expect(() => multi.initBackground()).not.toThrow();
    });
  });
});

// ─── SplitScreenCamera ────────────────────────────────────────────────────────

describe("SplitScreenCamera", () => {
  describe("constructor", () => {
    it("creates a valid SplitScreenCamera", () => {
      const left = new Camera();
      const right = new Camera();
      const split = new SplitScreenCamera(left, right);
      expect(split).toBeInstanceOf(OldMultiCamera);
    });

    it("resizes both cameras to half the master width", () => {
      const left = new Camera();
      const right = new Camera();
      // Master defaults to 1920 wide → half = ceil(1920/2) = 960
      const split = new SplitScreenCamera(left, right);
      expect(split.leftCamera.pixelWidth).toBe(960);
      expect(split.rightCamera.pixelWidth).toBe(960);
    });

    it("preserves master pixel height in sub-cameras", () => {
      const left = new Camera();
      const right = new Camera();
      new SplitScreenCamera(left, right, { pixelHeight: 540 });
      expect(left.pixelHeight).toBe(540);
      expect(right.pixelHeight).toBe(540);
    });

    it("handles odd master width with ceiling division", () => {
      const left = new Camera();
      const right = new Camera();
      new SplitScreenCamera(left, right, { pixelWidth: 101, pixelHeight: 100 });
      // ceil(101 / 2) = 51
      expect(left.pixelWidth).toBe(51);
      expect(right.pixelWidth).toBe(51);
    });

    it("exposes leftCamera and rightCamera", () => {
      const left = new Camera();
      const right = new Camera();
      const split = new SplitScreenCamera(left, right);
      expect(split.leftCamera).toBe(left);
      expect(split.rightCamera).toBe(right);
    });
  });
});
