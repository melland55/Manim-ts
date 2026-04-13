import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import { MultiCamera } from "../../src/camera/multi_camera/index.js";
import {
  MovingCamera as ZoomedMovingCamera,
  ImageMobjectFromCamera,
} from "../../src/scene/zoomed_scene/index.js";
import type { IMobject, Point3D } from "../../src/core/types.js";
import "../helpers/point-matchers.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    getCenter: () =>
      np.array([(left + right) / 2, (bottom + top) / 2, 0]) as unknown as Point3D,
    getWidth: () => right - left,
    getHeight: () => top - bottom,
    getFamily: () => [],
  } as unknown as IMobject;
}

/** Create a sub-camera with its ImageMobjectFromCamera. */
function makeSubCamera(): ImageMobjectFromCamera {
  const subCam = new ZoomedMovingCamera();
  return new ImageMobjectFromCamera(subCam);
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe("MultiCamera", () => {
  describe("constructor defaults", () => {
    it("creates with empty imageMobjectsFromCameras", () => {
      const cam = new MultiCamera();
      expect(cam.imageMobjectsFromCameras).toEqual([]);
    });

    it("defaults allowCamerasToCaptureTheirOwnDisplay to false", () => {
      const cam = new MultiCamera();
      expect(cam.allowCamerasToCaptureTheirOwnDisplay).toBe(false);
    });

    it("inherits MovingCamera defaults (pixel dimensions)", () => {
      const cam = new MultiCamera();
      expect(cam.pixelWidth).toBe(1920);
      expect(cam.pixelHeight).toBe(1080);
    });
  });

  describe("constructor with options", () => {
    it("accepts allowCamerasToCaptureTheirOwnDisplay", () => {
      const cam = new MultiCamera({
        allowCamerasToCaptureTheirOwnDisplay: true,
      });
      expect(cam.allowCamerasToCaptureTheirOwnDisplay).toBe(true);
    });

    it("registers initial imageMobjectsFromCameras", () => {
      const imfc1 = makeSubCamera();
      const imfc2 = makeSubCamera();
      const cam = new MultiCamera({
        imageMobjectsFromCameras: [imfc1, imfc2],
      });
      expect(cam.imageMobjectsFromCameras).toHaveLength(2);
      expect(cam.imageMobjectsFromCameras[0]).toBe(imfc1);
      expect(cam.imageMobjectsFromCameras[1]).toBe(imfc2);
    });
  });

  // ─── addImageMobjectFromCamera ─────────────────────────────────────────────

  describe("addImageMobjectFromCamera", () => {
    it("adds an ImageMobjectFromCamera to the list", () => {
      const cam = new MultiCamera();
      const imfc = makeSubCamera();
      cam.addImageMobjectFromCamera(imfc);
      expect(cam.imageMobjectsFromCameras).toHaveLength(1);
      expect(cam.imageMobjectsFromCameras[0]).toBe(imfc);
    });

    it("allows adding multiple ImageMobjects", () => {
      const cam = new MultiCamera();
      cam.addImageMobjectFromCamera(makeSubCamera());
      cam.addImageMobjectFromCamera(makeSubCamera());
      cam.addImageMobjectFromCamera(makeSubCamera());
      expect(cam.imageMobjectsFromCameras).toHaveLength(3);
    });
  });

  // ─── updateSubCameras ─────────────────────────────────────────────────────

  describe("updateSubCameras", () => {
    it("resizes sub-camera proportional to display size", () => {
      const cam = new MultiCamera();
      const imfc = makeSubCamera();
      cam.addImageMobjectFromCamera(imfc);

      // imfc defaults to the sub-camera's frame dimensions
      cam.updateSubCameras();

      // The sub-camera should have been resized
      const subCam = imfc.camera;
      expect(subCam.pixelWidth).toBeGreaterThan(0);
      expect(subCam.pixelHeight).toBeGreaterThan(0);
    });

    it("handles no sub-cameras without error", () => {
      const cam = new MultiCamera();
      expect(() => cam.updateSubCameras()).not.toThrow();
    });
  });

  // ─── reset ────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("returns this for chaining", () => {
      const cam = new MultiCamera();
      expect(cam.reset()).toBe(cam);
    });

    it("does not throw with sub-cameras", () => {
      const cam = new MultiCamera();
      cam.addImageMobjectFromCamera(makeSubCamera());
      expect(() => cam.reset()).not.toThrow();
    });
  });

  // ─── captureMobjects ─────────────────────────────────────────────────────

  describe("captureMobjects", () => {
    it("does not throw with empty mobject list", () => {
      const cam = new MultiCamera();
      cam.addImageMobjectFromCamera(makeSubCamera());
      expect(() => cam.captureMobjects([])).not.toThrow();
    });

    it("captures mobjects without error", () => {
      const cam = new MultiCamera();
      cam.addImageMobjectFromCamera(makeSubCamera());
      const mob = makeMob(-1, 1, -1, 1);
      expect(() => cam.captureMobjects([mob])).not.toThrow();
    });
  });

  // ─── getMobjectsIndicatingMovement ────────────────────────────────────────

  describe("getMobjectsIndicatingMovement", () => {
    it("returns at least the main frame when no sub-cameras", () => {
      const cam = new MultiCamera();
      const result = cam.getMobjectsIndicatingMovement();
      expect(result).toHaveLength(1);
    });

    it("includes sub-camera frames", () => {
      const cam = new MultiCamera();
      cam.addImageMobjectFromCamera(makeSubCamera());
      cam.addImageMobjectFromCamera(makeSubCamera());
      const result = cam.getMobjectsIndicatingMovement();
      // 1 main frame + 2 sub-camera frames
      expect(result).toHaveLength(3);
    });
  });
});
