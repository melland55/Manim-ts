/**
 * Tests for ZoomedScene and its supporting classes.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { np } from "../../src/core/math/index.js";
import {
  ZoomedScene,
  MovingCamera,
  MultiCamera,
  CameraFrame,
  ImageMobjectFromCamera,
} from "../../src/scene/zoomed_scene/index.js";

// ─── CameraFrame ──────────────────────────────────────────────────────────────

describe("CameraFrame", () => {
  it("constructs with default dimensions", () => {
    const frame = new CameraFrame();
    expect(frame.getWidth()).toBeCloseTo(14.222, 2);
    expect(frame.getHeight()).toBeCloseTo(8.0, 2);
    expect(frame.strokeWidth).toBe(0);
  });

  it("constructs with custom dimensions", () => {
    const frame = new CameraFrame({ width: 5, height: 3, strokeWidth: 2 });
    expect(frame.getWidth()).toBe(5);
    expect(frame.getHeight()).toBe(3);
    expect(frame.strokeWidth).toBe(2);
  });

  it("stretchToFitWidth / stretchToFitHeight", () => {
    const frame = new CameraFrame({ width: 4, height: 4 });
    frame.stretchToFitWidth(10);
    frame.stretchToFitHeight(6);
    expect(frame.getWidth()).toBe(10);
    expect(frame.getHeight()).toBe(6);
  });

  it("scale multiplies both dimensions", () => {
    const frame = new CameraFrame({ width: 4, height: 2 });
    frame.scale(0.5);
    expect(frame.getWidth()).toBeCloseTo(2);
    expect(frame.getHeight()).toBeCloseTo(1);
  });

  it("moveTo sets center position", () => {
    const frame = new CameraFrame();
    const target = np.array([3, -1, 0]);
    frame.moveTo(target);
    const c = frame.getCenter();
    expect(c.item(0)).toBeCloseTo(3);
    expect(c.item(1)).toBeCloseTo(-1);
  });

  it("center() resets to origin", () => {
    const frame = new CameraFrame();
    frame.moveTo(np.array([5, 5, 0]));
    frame.center();
    const c = frame.getCenter();
    expect(c.item(0)).toBeCloseTo(0);
    expect(c.item(1)).toBeCloseTo(0);
  });

  it("setStroke updates strokeWidth", () => {
    const frame = new CameraFrame();
    frame.setStroke({ width: 4 });
    expect(frame.strokeWidth).toBe(4);
  });

  it("saveState / restore round-trips", () => {
    const frame = new CameraFrame({ width: 3, height: 3 });
    frame.moveTo(np.array([1, 2, 0]));
    frame.saveState();

    frame.stretchToFitWidth(10);
    frame.stretchToFitHeight(10);
    frame.center();

    frame.restore();
    expect(frame.getWidth()).toBe(3);
    expect(frame.getHeight()).toBe(3);
    expect(frame.getCenter().item(0) as number).toBeCloseTo(1);
    expect(frame.getCenter().item(1) as number).toBeCloseTo(2);
  });

  it("restore without saveState is a no-op", () => {
    const frame = new CameraFrame({ width: 5, height: 5 });
    frame.restore(); // should not throw
    expect(frame.getWidth()).toBe(5);
  });
});

// ─── MovingCamera ─────────────────────────────────────────────────────────────

describe("MovingCamera", () => {
  it("constructs with default options", () => {
    const cam = new MovingCamera();
    expect(cam.frame).toBeInstanceOf(CameraFrame);
    expect(cam.defaultFrameStrokeWidth).toBe(0);
    expect(cam.backgroundOpacity).toBe(1);
  });

  it("passes custom options to Camera and CameraFrame", () => {
    const cam = new MovingCamera({
      defaultFrameStrokeWidth: 3,
      backgroundOpacity: 0.8,
      frameWidth: 6,
      frameHeight: 4,
    });
    expect(cam.defaultFrameStrokeWidth).toBe(3);
    expect(cam.backgroundOpacity).toBeCloseTo(0.8);
    expect(cam.frame.strokeWidth).toBe(3);
    expect(cam.frame.getWidth()).toBe(6);
    expect(cam.frame.getHeight()).toBe(4);
  });

  it("resetFrameContext syncs camera to frame", () => {
    const cam = new MovingCamera({ frameWidth: 10, frameHeight: 5 });
    cam.frame.stretchToFitWidth(4);
    cam.frame.stretchToFitHeight(2);
    cam.frame.moveTo(np.array([1, 0, 0]));
    cam.resetFrameContext();
    expect(cam.frameWidth).toBe(4);
    expect(cam.frameHeight).toBe(2);
    const center = cam.getFrameCenter();
    expect(center.item(0) as number).toBeCloseTo(1);
  });
});

// ─── MultiCamera ─────────────────────────────────────────────────────────────

describe("MultiCamera", () => {
  it("starts with empty imageMobjectsFromCameras", () => {
    const cam = new MultiCamera();
    expect(cam.imageMobjectsFromCameras).toHaveLength(0);
  });

  it("addImageMobjectFromCamera registers a display", () => {
    const cam = new MultiCamera();
    const sub = new MovingCamera();
    const display = new ImageMobjectFromCamera(sub);
    cam.addImageMobjectFromCamera(display);
    expect(cam.imageMobjectsFromCameras).toHaveLength(1);
    expect(cam.imageMobjectsFromCameras[0]).toBe(display);
  });

  it("addImageMobjectFromCamera ignores duplicates", () => {
    const cam = new MultiCamera();
    const sub = new MovingCamera();
    const display = new ImageMobjectFromCamera(sub);
    cam.addImageMobjectFromCamera(display);
    cam.addImageMobjectFromCamera(display);
    expect(cam.imageMobjectsFromCameras).toHaveLength(1);
  });

  it("removeImageMobjectFromCamera removes a display", () => {
    const cam = new MultiCamera();
    const sub = new MovingCamera();
    const display = new ImageMobjectFromCamera(sub);
    cam.addImageMobjectFromCamera(display);
    cam.removeImageMobjectFromCamera(display);
    expect(cam.imageMobjectsFromCameras).toHaveLength(0);
  });
});

// ─── ImageMobjectFromCamera ───────────────────────────────────────────────────

describe("ImageMobjectFromCamera", () => {
  let cam: MovingCamera;

  beforeEach(() => {
    cam = new MovingCamera({ frameWidth: 4, frameHeight: 3 });
  });

  it("inherits camera frame dimensions by default", () => {
    const display = new ImageMobjectFromCamera(cam);
    expect(display.getWidth()).toBe(4);
    expect(display.getHeight()).toBe(3);
  });

  it("stretchToFitWidth / stretchToFitHeight", () => {
    const display = new ImageMobjectFromCamera(cam);
    display.stretchToFitWidth(6);
    display.stretchToFitHeight(2);
    expect(display.getWidth()).toBe(6);
    expect(display.getHeight()).toBe(2);
  });

  it("addDisplayFrame sets hasDisplayFrame", () => {
    const display = new ImageMobjectFromCamera(cam);
    expect(display.hasDisplayFrame).toBe(false);
    display.addDisplayFrame();
    expect(display.hasDisplayFrame).toBe(true);
  });

  it("toCorner positions to upper-right by default", () => {
    const display = new ImageMobjectFromCamera(cam);
    display.stretchToFitWidth(3);
    display.stretchToFitHeight(3);
    const corner = np.array([1, 1, 0]);
    display.toCorner(corner);
    // Should be in positive x, positive y quadrant
    expect(display.getCenter().item(0) as number).toBeGreaterThan(0);
    expect(display.getCenter().item(1) as number).toBeGreaterThan(0);
  });

  it("saveState / restore round-trips", () => {
    const display = new ImageMobjectFromCamera(cam);
    display.stretchToFitWidth(5);
    display.moveTo(np.array([2, 1, 0]));
    display.saveState();

    display.stretchToFitWidth(1);
    display.moveTo(np.array([0, 0, 0]));
    display.restore();

    expect(display.getWidth()).toBe(5);
    expect(display.getCenter().item(0) as number).toBeCloseTo(2);
  });

  it("replace copies dimensions and position from a CameraFrame", () => {
    const display = new ImageMobjectFromCamera(cam);
    const frame = new CameraFrame({ width: 2, height: 1 });
    frame.moveTo(np.array([3, 3, 0]));
    display.replace(frame);
    expect(display.getWidth()).toBe(2);
    expect(display.getHeight()).toBe(1);
    expect(display.getCenter().item(0) as number).toBeCloseTo(3);
  });
});

// ─── ZoomedScene ─────────────────────────────────────────────────────────────

describe("ZoomedScene", () => {
  it("constructs with default options", () => {
    const scene = new ZoomedScene();
    expect(scene.zoomedDisplayHeight).toBe(3);
    expect(scene.zoomedDisplayWidth).toBe(3);
    expect(scene.zoomFactor).toBeCloseTo(0.15);
    expect(scene.imageFrameStrokeWidth).toBe(3);
    expect(scene.zoomActivated).toBe(false);
    expect(scene.zoomedDisplayCenter).toBeNull();
  });

  it("setup() initialises zoomedCamera and zoomedDisplay", () => {
    const scene = new ZoomedScene();
    expect(scene.zoomedCamera).toBeInstanceOf(MovingCamera);
    expect(scene.zoomedDisplay).toBeInstanceOf(ImageMobjectFromCamera);
  });

  it("zoomedCamera.frame is scaled by zoomFactor", () => {
    const scene = new ZoomedScene({
      zoomedDisplayHeight: 4,
      zoomedDisplayWidth: 4,
      zoomFactor: 0.5,
    });
    // After setup: frame was stretched to (4×4) then scaled ×0.5 → 2×2
    expect(scene.zoomedCamera.frame.getWidth()).toBeCloseTo(2);
    expect(scene.zoomedCamera.frame.getHeight()).toBeCloseTo(2);
  });

  it("zoomedDisplay has display frame added", () => {
    const scene = new ZoomedScene();
    expect(scene.zoomedDisplay.hasDisplayFrame).toBe(true);
  });

  it("zoomedDisplay is placed at custom center when provided", () => {
    const center = np.array([1, 2, 0]);
    const scene = new ZoomedScene({ zoomedDisplayCenter: center });
    const c = scene.zoomedDisplay.getCenter();
    expect(c.item(0) as number).toBeCloseTo(1);
    expect(c.item(1) as number).toBeCloseTo(2);
  });

  it("activateZooming sets zoomActivated and adds foreground mobjects", () => {
    const scene = new ZoomedScene();
    expect(scene.zoomActivated).toBe(false);
    scene.activateZooming(false);
    expect(scene.zoomActivated).toBe(true);
    // Frame and display should be in foreground mobject list
    expect(scene.foregroundMobjects.length).toBeGreaterThanOrEqual(2);
  });

  it("getZoomFactor returns frame-height / display-height ratio", () => {
    const scene = new ZoomedScene({
      zoomedDisplayHeight: 4,
      zoomFactor: 0.5,
    });
    // Frame height = 4 * 0.5 = 2, display height = 4 → ratio = 0.5
    expect(scene.getZoomFactor()).toBeCloseTo(0.5);
  });

  it("getZoomInAnimation returns an IAnimation", () => {
    const scene = new ZoomedScene();
    const anim = scene.getZoomInAnimation(2);
    expect(anim).toBeDefined();
    expect(typeof anim.getRunTime).toBe("function");
    expect(anim.getRunTime()).toBeCloseTo(2);
  });

  it("getZoomedDisplayPopOutAnimation returns an IAnimation", () => {
    const scene = new ZoomedScene();
    const anim = scene.getZoomedDisplayPopOutAnimation({ runTime: 1.5 });
    expect(anim).toBeDefined();
    expect(anim.getRunTime()).toBeCloseTo(1.5);
  });

  it("Python aliases are present and work", () => {
    const scene = new ZoomedScene();
    expect(typeof scene.activate_zooming).toBe("function");
    expect(typeof scene.get_zoom_in_animation).toBe("function");
    expect(typeof scene.get_zoomed_display_pop_out_animation).toBe("function");
    expect(typeof scene.get_zoom_factor).toBe("function");
    expect(scene.get_zoom_factor()).toBeCloseTo(scene.getZoomFactor());
  });

  it("custom zoomedCameraConfig is forwarded to MovingCamera", () => {
    const scene = new ZoomedScene({
      zoomedCameraConfig: { defaultFrameStrokeWidth: 5, backgroundOpacity: 0.5 },
    });
    expect(scene.zoomedCamera.defaultFrameStrokeWidth).toBe(5);
    expect(scene.zoomedCamera.backgroundOpacity).toBeCloseTo(0.5);
  });

  it("zoomFactor=1 means frame fills the display exactly", () => {
    const scene = new ZoomedScene({
      zoomedDisplayHeight: 3,
      zoomedDisplayWidth: 3,
      zoomFactor: 1,
    });
    expect(scene.getZoomFactor()).toBeCloseTo(1);
  });
});
