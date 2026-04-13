/**
 * Tests for ThreeDScene and SpecialThreeDScene.
 */

import { describe, it, expect } from "vitest";
import {
  ThreeDScene,
  SpecialThreeDScene,
} from "../../src/scene/three_d_scene/index.js";
import type {
  ThreeDSceneOptions,
  SpecialThreeDSceneOptions,
  CameraOrientationOptions,
} from "../../src/scene/three_d_scene/index.js";
import { ThreeDCamera } from "../../src/camera/three_d_camera/index.js";
import { DEGREES } from "../../src/core/math/index.js";
import { Sphere } from "../../src/mobject/three_d/index.js";

// ─── Module exports ──────────────────────────────────────────

describe("three_d_scene barrel export", () => {
  it("exports ThreeDScene class", () => {
    expect(ThreeDScene).toBeDefined();
    expect(typeof ThreeDScene).toBe("function");
  });

  it("exports SpecialThreeDScene class", () => {
    expect(SpecialThreeDScene).toBeDefined();
    expect(typeof SpecialThreeDScene).toBe("function");
  });
});

// ─── ThreeDScene ─────────────────────────────────────────────

describe("ThreeDScene", () => {
  it("constructs with default options", () => {
    const scene = new ThreeDScene();
    expect(scene).toBeInstanceOf(ThreeDScene);
    expect(scene.camera).toBeInstanceOf(ThreeDCamera);
    expect(scene.ambientCameraRotation).toBeNull();
  });

  it("sets default angled camera orientation kwargs", () => {
    const scene = new ThreeDScene();
    const kwargs = scene.defaultAngledCameraOrientationKwargs;
    expect(kwargs.phi).toBeCloseTo(70 * (DEGREES as number));
    expect(kwargs.theta).toBeCloseTo(-135 * (DEGREES as number));
  });

  it("accepts custom defaultAngledCameraOrientationKwargs", () => {
    const scene = new ThreeDScene({
      defaultAngledCameraOrientationKwargs: {
        phi: 0.5,
        theta: -1.0,
      },
    });
    expect(scene.defaultAngledCameraOrientationKwargs.phi).toBe(0.5);
    expect(scene.defaultAngledCameraOrientationKwargs.theta).toBe(-1.0);
  });

  it("has expected prototype methods", () => {
    expect(typeof ThreeDScene.prototype.setCameraOrientation).toBe("function");
    expect(typeof ThreeDScene.prototype.beginAmbientCameraRotation).toBe("function");
    expect(typeof ThreeDScene.prototype.stopAmbientCameraRotation).toBe("function");
    expect(typeof ThreeDScene.prototype.begin3dIllusionCameraRotation).toBe("function");
    expect(typeof ThreeDScene.prototype.stop3dIllusionCameraRotation).toBe("function");
    expect(typeof ThreeDScene.prototype.moveCamera).toBe("function");
    expect(typeof ThreeDScene.prototype.getMovingMobjects).toBe("function");
    expect(typeof ThreeDScene.prototype.addFixedOrientationMobjects).toBe("function");
    expect(typeof ThreeDScene.prototype.addFixedInFrameMobjects).toBe("function");
    expect(typeof ThreeDScene.prototype.removeFixedOrientationMobjects).toBe("function");
    expect(typeof ThreeDScene.prototype.removeFixedInFrameMobjects).toBe("function");
    expect(typeof ThreeDScene.prototype.setToDefaultAngledCameraOrientation).toBe("function");
  });
});

// ─── setCameraOrientation ────────────────────────────────────

describe("ThreeDScene.setCameraOrientation", () => {
  it("sets phi on camera", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({ phi: 1.0 });
    expect(scene.camera.getPhi()).toBeCloseTo(1.0);
  });

  it("sets theta on camera", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({ theta: -2.0 });
    expect(scene.camera.getTheta()).toBeCloseTo(-2.0);
  });

  it("sets gamma on camera", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({ gamma: 0.5 });
    expect(scene.camera.getGamma()).toBeCloseTo(0.5);
  });

  it("sets zoom on camera", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({ zoom: 2.0 });
    expect(scene.camera.getZoom()).toBeCloseTo(2.0);
  });

  it("sets focal distance on camera", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({ focalDistance: 15.0 });
    expect(scene.camera.getFocalDistance()).toBeCloseTo(15.0);
  });

  it("sets multiple values at once", () => {
    const scene = new ThreeDScene();
    scene.setCameraOrientation({
      phi: 1.2,
      theta: -0.5,
      zoom: 1.5,
    });
    expect(scene.camera.getPhi()).toBeCloseTo(1.2);
    expect(scene.camera.getTheta()).toBeCloseTo(-0.5);
    expect(scene.camera.getZoom()).toBeCloseTo(1.5);
  });

  it("does nothing with empty options", () => {
    const scene = new ThreeDScene();
    const phi = scene.camera.getPhi();
    const theta = scene.camera.getTheta();
    scene.setCameraOrientation({});
    expect(scene.camera.getPhi()).toBeCloseTo(phi);
    expect(scene.camera.getTheta()).toBeCloseTo(theta);
  });
});

// ─── Ambient camera rotation ──────────────────���──────────────

describe("ThreeDScene ambient camera rotation", () => {
  it("beginAmbientCameraRotation adds updater to tracker", () => {
    const scene = new ThreeDScene();
    const before = scene.camera.thetaTracker.updaters.length;
    scene.beginAmbientCameraRotation(0.02, "theta");
    expect(scene.camera.thetaTracker.updaters.length).toBe(before + 1);
  });

  it("stopAmbientCameraRotation clears updaters", () => {
    const scene = new ThreeDScene();
    scene.beginAmbientCameraRotation(0.02, "theta");
    scene.stopAmbientCameraRotation("theta");
    expect(scene.camera.thetaTracker.updaters.length).toBe(0);
  });

  it("throws on invalid angle", () => {
    const scene = new ThreeDScene();
    expect(() => scene.beginAmbientCameraRotation(0.02, "invalid")).toThrow(
      "Invalid ambient rotation angle",
    );
    expect(() => scene.stopAmbientCameraRotation("invalid")).toThrow(
      "Invalid ambient rotation angle",
    );
  });

  it("supports phi rotation", () => {
    const scene = new ThreeDScene();
    scene.beginAmbientCameraRotation(0.05, "phi");
    expect(scene.camera.phiTracker.updaters.length).toBeGreaterThan(0);
    scene.stopAmbientCameraRotation("phi");
    expect(scene.camera.phiTracker.updaters.length).toBe(0);
  });

  it("supports gamma rotation", () => {
    const scene = new ThreeDScene();
    scene.beginAmbientCameraRotation(0.05, "gamma");
    expect(scene.camera.gammaTracker.updaters.length).toBeGreaterThan(0);
    scene.stopAmbientCameraRotation("gamma");
    expect(scene.camera.gammaTracker.updaters.length).toBe(0);
  });
});

// ─── 3D illusion camera rotation ─────────────────────────────

describe("ThreeDScene 3d illusion camera rotation", () => {
  it("begin3dIllusionCameraRotation adds updaters to theta and phi trackers", () => {
    const scene = new ThreeDScene();
    scene.begin3dIllusionCameraRotation(1);
    expect(scene.camera.thetaTracker.updaters.length).toBeGreaterThan(0);
    expect(scene.camera.phiTracker.updaters.length).toBeGreaterThan(0);
  });

  it("stop3dIllusionCameraRotation clears both updaters", () => {
    const scene = new ThreeDScene();
    scene.begin3dIllusionCameraRotation(1);
    scene.stop3dIllusionCameraRotation();
    expect(scene.camera.thetaTracker.updaters.length).toBe(0);
    expect(scene.camera.phiTracker.updaters.length).toBe(0);
  });
});

// ─── getMovingMobjects ───────────────────────────────────────

describe("ThreeDScene.getMovingMobjects", () => {
  it("returns empty array for no animations", () => {
    const scene = new ThreeDScene();
    const result = scene.getMovingMobjects();
    expect(result).toEqual([]);
  });
});

// ─── SpecialThreeDScene ──────────────────────────────────────

describe("SpecialThreeDScene", () => {
  it("constructs with default options", () => {
    const scene = new SpecialThreeDScene();
    expect(scene).toBeInstanceOf(SpecialThreeDScene);
    expect(scene).toBeInstanceOf(ThreeDScene);
    expect(scene.cutAxesAtRadius).toBe(true);
  });

  it("camera has shading enabled by default", () => {
    const scene = new SpecialThreeDScene();
    expect(scene.camera.shouldApplyShading).toBe(true);
    expect(scene.camera.exponentialProjection).toBe(true);
  });

  it("stores sphere config defaults", () => {
    const scene = new SpecialThreeDScene();
    expect(scene.sphereConfig.radius).toBe(2);
  });

  it("stores three_d_axes_config defaults", () => {
    const scene = new SpecialThreeDScene();
    expect(scene.threeDAxesConfig).toBeDefined();
    expect((scene.threeDAxesConfig as Record<string, unknown>).numAxisPieces).toBe(1);
  });

  it("getSphere returns a Sphere with merged config", () => {
    const scene = new SpecialThreeDScene();
    const sphere = scene.getSphere({ radius: 5 });
    expect(sphere).toBeInstanceOf(Sphere);
  });

  it("getDefaultCameraPosition returns position object", () => {
    const scene = new SpecialThreeDScene();
    const pos = scene.getDefaultCameraPosition();
    expect(pos.phi).toBeCloseTo(70 * (DEGREES as number));
    expect(pos.theta).toBeCloseTo(-110 * (DEGREES as number));
  });

  it("setCameraToDefaultPosition sets camera orientation", () => {
    const scene = new SpecialThreeDScene();
    scene.setCameraOrientation({ phi: 0, theta: 0 });
    scene.setCameraToDefaultPosition();
    const pos = scene.getDefaultCameraPosition();
    expect(scene.camera.getPhi()).toBeCloseTo(pos.phi!);
    expect(scene.camera.getTheta()).toBeCloseTo(pos.theta!);
  });

  it("getAxes throws (dependencies not yet integrated)", () => {
    const scene = new SpecialThreeDScene();
    expect(() => scene.getAxes()).toThrow("requires ThreeDAxes");
  });

  it("accepts custom options", () => {
    const scene = new SpecialThreeDScene({
      cutAxesAtRadius: false,
      sphereConfig: { radius: 3 },
    });
    expect(scene.cutAxesAtRadius).toBe(false);
    expect(scene.sphereConfig.radius).toBe(3);
  });
});
