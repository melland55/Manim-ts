/**
 * Tests for MovingCameraScene.
 *
 * Since the Scene base class is not yet converted, these tests focus on
 * the class structure, exports, and the MovingCameraScene-specific
 * getMovingMobjects logic using a lightweight mock of Scene.
 */

import { describe, it, expect, vi } from "vitest";
import {
  MovingCameraScene,
} from "../../src/scene/moving_camera_scene/index.js";
import type { MovingCameraSceneOptions } from "../../src/scene/moving_camera_scene/index.js";
import { MovingCamera } from "../../src/camera/moving_camera/moving_camera.js";

// ─── Module exports ──────────────────────────────────────────────────────────

describe("moving_camera_scene barrel export", () => {
  it("exports MovingCameraScene class", () => {
    expect(MovingCameraScene).toBeDefined();
    expect(typeof MovingCameraScene).toBe("function");
  });

  it("MovingCameraScene has expected prototype methods", () => {
    expect(typeof MovingCameraScene.prototype.getMovingMobjects).toBe(
      "function",
    );
  });
});

// ─── MovingCameraScene class structure ───────────────────────────────────────

describe("MovingCameraScene", () => {
  it("is a constructor function", () => {
    expect(typeof MovingCameraScene).toBe("function");
  });

  it("getMovingMobjects is defined on the prototype", () => {
    // Verifies the override exists
    expect(
      MovingCameraScene.prototype.hasOwnProperty("getMovingMobjects"),
    ).toBe(true);
  });

  it("MovingCameraSceneOptions type allows cameraClass", () => {
    // Type-level test — validates that the options interface accepts cameraClass.
    // If this compiles, the type is correct.
    const _opts: MovingCameraSceneOptions = {
      cameraClass: MovingCamera,
    };
    expect(_opts.cameraClass).toBe(MovingCamera);
  });

  it("MovingCameraSceneOptions type allows empty object", () => {
    const _opts: MovingCameraSceneOptions = {};
    expect(_opts).toEqual({});
  });
});

// ─── getMovingMobjects logic ─────────────────────────────────────────────────
// These tests exercise the override logic by directly calling the method
// on a manually constructed instance with mocked super/camera.

describe("MovingCameraScene.getMovingMobjects", () => {
  /**
   * Creates a minimal mock that exercises the getMovingMobjects logic
   * without needing the full Scene base class.
   */
  function createTestInstance(opts: {
    superMovingMobjects: unknown[];
    sceneMobjects: unknown[];
    movementIndicators: unknown[];
    familyMembers?: unknown[];
  }) {
    // Build a fake instance with the getMovingMobjects method bound
    const instance = Object.create(MovingCameraScene.prototype);

    // Mock this.mobjects
    instance.mobjects = opts.sceneMobjects;

    // Mock this.camera.getMobjectsIndicatingMovement()
    instance.camera = {
      getMobjectsIndicatingMovement: () => opts.movementIndicators,
    };

    // Mock super.getMovingMobjects() — return the pre-defined list
    // We do this by setting a _superGetMovingMobjects on the prototype chain
    const superResult = opts.superMovingMobjects;

    // Patch: call the real method but intercept super call
    const originalMethod = MovingCameraScene.prototype.getMovingMobjects;

    // We'll use a wrapper that replaces super.getMovingMobjects
    const boundMethod = function (this: typeof instance, ...animations: unknown[]) {
      // Temporarily override the prototype chain
      const parentProto = Object.getPrototypeOf(MovingCameraScene.prototype);
      const origSuper = parentProto.getMovingMobjects;
      parentProto.getMovingMobjects = () => superResult;

      try {
        return originalMethod.call(this, ...animations);
      } finally {
        if (origSuper) {
          parentProto.getMovingMobjects = origSuper;
        } else {
          delete parentProto.getMovingMobjects;
        }
      }
    };

    return { instance, callGetMovingMobjects: boundMethod };
  }

  it("returns super result when no movement indicators match", () => {
    const mobA = { name: "A", getFamily: () => [mobA] };
    const mobB = { name: "B", getFamily: () => [mobB] };
    const indicator = { name: "frame", getFamily: () => [indicator] };

    const { instance, callGetMovingMobjects } = createTestInstance({
      superMovingMobjects: [mobA],
      sceneMobjects: [mobA, mobB],
      movementIndicators: [indicator],
    });

    const result = callGetMovingMobjects.call(instance);
    // indicator is NOT among the moving mobjects, so just return super's result
    expect(result).toEqual([mobA]);
  });

  it("returns all scene mobjects when movement indicator is moving", () => {
    const indicator = { name: "frame", getFamily: () => [indicator] };
    const mobA = { name: "A", getFamily: () => [mobA] };
    const mobB = { name: "B", getFamily: () => [mobB] };

    const { instance, callGetMovingMobjects } = createTestInstance({
      superMovingMobjects: [indicator], // indicator is among moving mobjects
      sceneMobjects: [mobA, mobB],
      movementIndicators: [indicator],
    });

    const result = callGetMovingMobjects.call(instance);
    // Since indicator is moving, ALL mobjects should be returned via listUpdate
    // listUpdate(sceneMobjects, movingMobjects) = sceneMobjects filtered + movingMobjects
    expect(result.length).toBeGreaterThanOrEqual(2);
    // Should contain both scene mobjects
    expect(result).toContain(mobA);
    expect(result).toContain(mobB);
  });

  it("returns all scene mobjects when indicator is in family of moving", () => {
    const indicator = { name: "frame", getFamily: () => [indicator] };
    const parent = { name: "parent", getFamily: () => [parent, indicator] };
    const mobB = { name: "B", getFamily: () => [mobB] };

    const { instance, callGetMovingMobjects } = createTestInstance({
      superMovingMobjects: [parent], // parent has indicator in its family
      sceneMobjects: [parent, mobB],
      movementIndicators: [indicator],
    });

    const result = callGetMovingMobjects.call(instance);
    // indicator is in allMovingMobjects (via parent's family), so all mobjects returned
    expect(result).toContain(parent);
    expect(result).toContain(mobB);
  });

  it("handles empty animations list", () => {
    const mobA = { name: "A", getFamily: () => [mobA] };

    const { instance, callGetMovingMobjects } = createTestInstance({
      superMovingMobjects: [],
      sceneMobjects: [mobA],
      movementIndicators: [],
    });

    const result = callGetMovingMobjects.call(instance);
    expect(result).toEqual([]);
  });

  it("handles empty scene mobjects", () => {
    const indicator = { name: "frame", getFamily: () => [indicator] };

    const { instance, callGetMovingMobjects } = createTestInstance({
      superMovingMobjects: [indicator],
      sceneMobjects: [],
      movementIndicators: [indicator],
    });

    const result = callGetMovingMobjects.call(instance);
    // listUpdate([], [indicator]) = [indicator]
    expect(result).toContain(indicator);
  });
});
