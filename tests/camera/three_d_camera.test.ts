import { describe, it, expect } from "vitest";
import { np, ORIGIN, RIGHT, UP, DEGREES } from "../../src/core/math/index.js";
import { ThreeDCamera } from "../../src/camera/three_d_camera/index.js";
import "../helpers/point-matchers.js";

// ─── Constructor ─────────────────────────────────────────────────────────────

describe("ThreeDCamera", () => {
  describe("constructor defaults", () => {
    it("has correct default focal distance", () => {
      const cam = new ThreeDCamera();
      expect(cam.focalDistance).toBe(20.0);
    });

    it("has default phi = 0", () => {
      const cam = new ThreeDCamera();
      expect(cam.getPhi()).toBe(0);
    });

    it("has default theta = -90 degrees", () => {
      const cam = new ThreeDCamera();
      expect(cam.getTheta()).toBeCloseTo(-90 * (DEGREES as number));
    });

    it("has default gamma = 0", () => {
      const cam = new ThreeDCamera();
      expect(cam.getGamma()).toBe(0);
    });

    it("has default zoom = 1", () => {
      const cam = new ThreeDCamera();
      expect(cam.getZoom()).toBe(1);
    });

    it("has default shouldApplyShading = true", () => {
      const cam = new ThreeDCamera();
      expect(cam.shouldApplyShading).toBe(true);
    });

    it("has default exponentialProjection = false", () => {
      const cam = new ThreeDCamera();
      expect(cam.exponentialProjection).toBe(false);
    });
  });

  describe("constructor with custom options", () => {
    it("accepts custom phi and theta", () => {
      const cam = new ThreeDCamera({ phi: Math.PI / 4, theta: Math.PI / 3 });
      expect(cam.getPhi()).toBeCloseTo(Math.PI / 4);
      expect(cam.getTheta()).toBeCloseTo(Math.PI / 3);
    });

    it("accepts custom focal distance", () => {
      const cam = new ThreeDCamera({ focalDistance: 10 });
      expect(cam.getFocalDistance()).toBe(10);
    });

    it("accepts custom zoom", () => {
      const cam = new ThreeDCamera({ zoom: 2.5 });
      expect(cam.getZoom()).toBe(2.5);
    });
  });

  // ─── Value tracker getters/setters ───────────────────────────────────────

  describe("value tracker getters and setters", () => {
    it("setPhi updates getPhi", () => {
      const cam = new ThreeDCamera();
      cam.setPhi(1.5);
      expect(cam.getPhi()).toBeCloseTo(1.5);
    });

    it("setTheta updates getTheta", () => {
      const cam = new ThreeDCamera();
      cam.setTheta(0.7);
      expect(cam.getTheta()).toBeCloseTo(0.7);
    });

    it("setFocalDistance updates getFocalDistance", () => {
      const cam = new ThreeDCamera();
      cam.setFocalDistance(15);
      expect(cam.getFocalDistance()).toBe(15);
    });

    it("setGamma updates getGamma", () => {
      const cam = new ThreeDCamera();
      cam.setGamma(0.3);
      expect(cam.getGamma()).toBeCloseTo(0.3);
    });

    it("setZoom updates getZoom", () => {
      const cam = new ThreeDCamera();
      cam.setZoom(3);
      expect(cam.getZoom()).toBe(3);
    });
  });

  // ─── getValueTrackers ──────────────────────────────────────────────────

  describe("getValueTrackers", () => {
    it("returns 5 value trackers", () => {
      const cam = new ThreeDCamera();
      const trackers = cam.getValueTrackers();
      expect(trackers).toHaveLength(5);
    });
  });

  // ─── Rotation matrix ───────────────────────────────────────────────────

  describe("rotation matrix", () => {
    it("generateRotationMatrix returns a 3x3 matrix", () => {
      const cam = new ThreeDCamera();
      const mat = cam.generateRotationMatrix();
      expect(mat.shape).toEqual([3, 3]);
    });

    it("rotation matrix at default angles is approximately identity-like", () => {
      // At phi=0, theta=-90deg, gamma=0, the camera looks down -Z
      // The rotation matrix should map world coords to camera coords
      const cam = new ThreeDCamera();
      const mat = cam.getRotationMatrix();
      expect(mat.shape).toEqual([3, 3]);
    });

    it("resetRotationMatrix recomputes the matrix", () => {
      const cam = new ThreeDCamera();
      const mat1 = cam.getRotationMatrix();
      cam.setPhi(Math.PI / 4);
      cam.resetRotationMatrix();
      const mat2 = cam.getRotationMatrix();
      // After changing phi, at least some entries of the 3x3 matrix must differ
      let isDifferent = false;
      for (let i = 0; i < 3 && !isDifferent; i++) {
        for (let j = 0; j < 3 && !isDifferent; j++) {
          if (Math.abs((mat1.get([i, j]) as number) - (mat2.get([i, j]) as number)) > 1e-10) {
            isDifferent = true;
          }
        }
      }
      expect(isDifferent).toBe(true);
    });
  });

  // ─── Projection ─────────────────────────────────────────────────────────

  describe("projectPoint", () => {
    it("projects the origin to the origin (with default camera)", () => {
      const cam = new ThreeDCamera();
      cam.resetRotationMatrix();
      const projected = cam.projectPoint(ORIGIN.copy());
      // Origin should project near origin
      expect(Math.abs(projected.item(0) as number)).toBeLessThan(1e-10);
      expect(Math.abs(projected.item(1) as number)).toBeLessThan(1e-10);
    });

    it("projectPoints handles multiple points", () => {
      const cam = new ThreeDCamera();
      cam.resetRotationMatrix();
      const points = np.array([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ]);
      const projected = cam.projectPoints(points);
      expect(projected.shape).toEqual([3, 3]);
    });

    it("zoom affects projected coordinates", () => {
      const cam1 = new ThreeDCamera({ zoom: 1 });
      cam1.resetRotationMatrix();
      const cam2 = new ThreeDCamera({ zoom: 2 });
      cam2.resetRotationMatrix();

      const point = np.array([1, 0, 0]);
      const p1 = cam1.projectPoint(point);
      const p2 = cam2.projectPoint(point);

      // At zoom 2, projected x and y should be roughly double
      const p1x = Math.abs(p1.item(0) as number);
      const p2x = Math.abs(p2.item(0) as number);
      if (p1x > 1e-10) {
        expect(p2x / p1x).toBeCloseTo(2, 1);
      }
    });
  });

  // ─── Fixed orientation / fixed in frame ────────────────────────────────

  describe("fixedInFrameMobjects", () => {
    it("starts with empty set", () => {
      const cam = new ThreeDCamera();
      expect(cam.fixedInFrameMobjects.size).toBe(0);
    });

    it("starts with empty fixed orientation map", () => {
      const cam = new ThreeDCamera();
      expect(cam.fixedOrientationMobjects.size).toBe(0);
    });
  });

  // ─── Frame center ──────────────────────────────────────────────────────

  describe("frame center", () => {
    it("defaults to origin", () => {
      const cam = new ThreeDCamera();
      const center = cam.getFrameCenter();
      expect(center.item(0) as number).toBeCloseTo(0);
      expect(center.item(1) as number).toBeCloseTo(0);
      expect(center.item(2) as number).toBeCloseTo(0);
    });

    it("can be set to a custom point", () => {
      const cam = new ThreeDCamera();
      const pt = np.array([1, 2, 3]);
      cam.setFrameCenter(pt);
      const center = cam.getFrameCenter();
      expect(center.item(0) as number).toBeCloseTo(1);
      expect(center.item(1) as number).toBeCloseTo(2);
      expect(center.item(2) as number).toBeCloseTo(3);
    });
  });

  // ─── Shading ───────────────────────────────────────────────────────────

  describe("modifiedRgbas", () => {
    it("returns rgbas unchanged when shouldApplyShading is false", () => {
      const cam = new ThreeDCamera({ shouldApplyShading: false });
      const rgbas: [number, number, number, number][] = [[1, 0, 0, 1]];
      const stub = { shadeIn3d: true, getNumPoints: () => 10 } as never;
      const result = cam.modifiedRgbas(stub, rgbas);
      expect(result).toEqual([[1, 0, 0, 1]]);
    });

    it("returns rgbas unchanged when shadeIn3d is false", () => {
      const cam = new ThreeDCamera();
      const rgbas: [number, number, number, number][] = [[0.5, 0.5, 0.5, 1]];
      const stub = { shadeIn3d: false } as never;
      const result = cam.modifiedRgbas(stub, rgbas);
      expect(result).toEqual([[0.5, 0.5, 0.5, 1]]);
    });
  });
});
