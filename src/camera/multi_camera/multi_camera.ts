/**
 * MultiCamera — a camera supporting multiple perspectives.
 *
 * Extends MovingCamera to composite sub-camera renders via
 * ImageMobjectFromCamera instances.
 *
 * TypeScript port of manim.camera.multi_camera.MultiCamera.
 */

import type { IMobject } from "../../core/types.js";
import { MovingCamera } from "../moving_camera/index.js";
import type { MovingCameraOptions } from "../moving_camera/index.js";
import { ImageMobjectFromCamera } from "../../scene/zoomed_scene/index.js";
import { listDifferenceUpdate } from "../../utils/iterables/index.js";

/**
 * Minimal duck-typed interface for the camera attached to an
 * ImageMobjectFromCamera. The zoomed_scene module defines its own
 * MovingCamera stub that is structurally different from
 * src/camera/moving_camera/MovingCamera. This interface captures the
 * shared surface area we actually need.
 */
interface SubCamera {
  pixelWidth: number;
  pixelHeight: number;
  frameWidth: number;
  frameHeight: number;
  frame: { width: number; height: number };
  resize(w: number, h: number): void;
  captureFrame(): void;
  captureMobjects?(mobjects: IMobject[], options?: Record<string, unknown>): void;
}

// ─── MultiCameraOptions ─────────────────────────────────────────────────────

export interface MultiCameraOptions extends MovingCameraOptions {
  /** Initial set of sub-camera image mobjects to register. */
  imageMobjectsFromCameras?: ImageMobjectFromCamera[];
  /**
   * When true, a sub-camera may capture its own display mobject.
   * Default: false.
   */
  allowCamerasToCaptureTheirOwnDisplay?: boolean;
}

// ─── MultiCamera ────────────────────────────────────────────────────────────

/**
 * Camera that allows for multiple perspectives.
 *
 * Each registered {@link ImageMobjectFromCamera} is driven by its own
 * MovingCamera.  When {@link captureMobjects} is called, every sub-camera
 * captures the scene mobjects (optionally excluding its own display), then
 * the parent camera captures last.
 *
 * Python: `manim.camera.multi_camera.MultiCamera`
 */
export class MultiCamera extends MovingCamera {
  /** Sub-camera image mobjects registered for compositing. */
  imageMobjectsFromCameras: ImageMobjectFromCamera[];

  /**
   * When false (default), each sub-camera's own display mobject and its
   * family are excluded from the mobjects it captures — preventing infinite
   * recursion.
   */
  allowCamerasToCaptureTheirOwnDisplay: boolean;

  constructor(options: MultiCameraOptions = {}) {
    const {
      imageMobjectsFromCameras,
      allowCamerasToCaptureTheirOwnDisplay,
      ...movingCameraOptions
    } = options;

    super(movingCameraOptions);

    this.imageMobjectsFromCameras = [];
    this.allowCamerasToCaptureTheirOwnDisplay =
      allowCamerasToCaptureTheirOwnDisplay ?? false;

    if (imageMobjectsFromCameras != null) {
      for (const imfc of imageMobjectsFromCameras) {
        this.addImageMobjectFromCamera(imfc);
      }
    }
  }

  /**
   * Register an {@link ImageMobjectFromCamera} for compositing.
   *
   * Python: `MultiCamera.add_image_mobject_from_camera`
   */
  addImageMobjectFromCamera(
    imageMobjectFromCamera: ImageMobjectFromCamera,
  ): void {
    this.imageMobjectsFromCameras.push(imageMobjectFromCamera);
  }

  /**
   * Reshape sub-camera pixel arrays to match their display proportions
   * relative to this camera's frame.
   *
   * Python: `MultiCamera.update_sub_cameras`
   *
   * TODO: Port from Cairo/OpenGL — needs manual rendering implementation.
   * The full implementation requires pixel_array and resetPixelShape which
   * are part of the rendering pipeline not yet ported.
   */
  updateSubCameras(): void {
    for (const imfc of this.imageMobjectsFromCameras) {
      const camera = imfc.camera as unknown as SubCamera;
      const newPixelHeight = Math.floor(
        this.pixelHeight * (imfc.getHeight() / this.frameHeight),
      );
      const newPixelWidth = Math.floor(
        this.pixelWidth * (imfc.getWidth() / this.frameWidth),
      );
      // TODO: call camera.resetPixelShape(newPixelHeight, newPixelWidth)
      // when the rendering pipeline is ported. For now, resize the camera.
      camera.resize(newPixelWidth, newPixelHeight);
    }
  }

  /**
   * Reset this camera and all sub-cameras.
   *
   * Python: `MultiCamera.reset`
   */
  reset(): this {
    for (const imfc of this.imageMobjectsFromCameras) {
      const camera = imfc.camera as unknown as SubCamera;
      camera.captureFrame();
    }
    this.captureFrame();
    return this;
  }

  /**
   * Capture mobjects into this camera and all sub-cameras.
   *
   * Each sub-camera captures the full mobject list, minus its own display
   * family (unless {@link allowCamerasToCaptureTheirOwnDisplay} is true).
   * Then the parent camera captures everything.
   *
   * Python: `MultiCamera.capture_mobjects`
   *
   * TODO: Port from Cairo/OpenGL — needs manual rendering implementation.
   */
  override captureMobjects(
    mobjects: IMobject[],
    options: Record<string, unknown> = {},
  ): void {
    this.updateSubCameras();
    for (const imfc of this.imageMobjectsFromCameras) {
      let toAdd = [...mobjects];
      if (!this.allowCamerasToCaptureTheirOwnDisplay) {
        toAdd = listDifferenceUpdate(toAdd, imfc.getFamily());
      }
      const camera = imfc.camera as unknown as SubCamera;
      if (camera.captureMobjects) {
        camera.captureMobjects(toAdd, options);
      }
    }
    super.captureMobjects(mobjects, options);
  }

  /**
   * Returns all mobjects whose movement implies that the camera
   * should treat all other on-screen mobjects as moving.
   *
   * Includes this camera's frame and the frames of all sub-cameras.
   *
   * Python: `MultiCamera.get_mobjects_indicating_movement`
   */
  override getMobjectsIndicatingMovement(): IMobject[] {
    const subFrames = this.imageMobjectsFromCameras.map((imfc) => {
      const camera = imfc.camera as unknown as SubCamera;
      return camera.frame as unknown as IMobject;
    });
    return [this.frame as unknown as IMobject, ...subFrames];
  }
}
