/**
 * Tests for VectorScene and LinearTransformationScene.
 *
 * These tests verify class structure, constructor defaults, method
 * existence, and basic transformation logic. Since many geometry/graphing
 * dependencies are stubbed, we focus on the API surface and the math
 * transformations rather than visual output.
 */

import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import { ORIGIN, UP, RIGHT, PI } from "../../src/constants/index.js";
import { GREEN_C, RED_C, BLUE_D, PURE_YELLOW, WHITE } from "../../src/core/color/index.js";
import {
  VectorScene,
  LinearTransformationScene,
  X_COLOR,
  Y_COLOR,
  Z_COLOR,
} from "../../src/scene/vector_space_scene/index.js";
import type {
  VectorSceneOptions,
  LinearTransformationSceneOptions,
} from "../../src/scene/vector_space_scene/index.js";

// ─── Barrel export ──────────────────────────────────────────

describe("vector_space_scene barrel export", () => {
  it("exports VectorScene class", () => {
    expect(VectorScene).toBeDefined();
    expect(typeof VectorScene).toBe("function");
  });

  it("exports LinearTransformationScene class", () => {
    expect(LinearTransformationScene).toBeDefined();
    expect(typeof LinearTransformationScene).toBe("function");
  });

  it("exports color constants", () => {
    expect(X_COLOR).toBe(GREEN_C);
    expect(Y_COLOR).toBe(RED_C);
    expect(Z_COLOR).toBe(BLUE_D);
  });
});

// ─── VectorScene ────────────────────────────────────────────

describe("VectorScene", () => {
  it("constructs with default options", () => {
    const scene = new VectorScene();
    expect(scene.basisVectorStrokeWidth).toBe(6.0);
  });

  it("constructs with custom basisVectorStrokeWidth", () => {
    const scene = new VectorScene({ basisVectorStrokeWidth: 10 });
    expect(scene.basisVectorStrokeWidth).toBe(10);
  });

  it("VectorSceneOptions type allows empty object", () => {
    const opts: VectorSceneOptions = {};
    expect(opts).toEqual({});
  });

  it("has expected prototype methods", () => {
    const proto = VectorScene.prototype;
    expect(typeof proto.addPlane).toBe("function");
    expect(typeof proto.addAxes).toBe("function");
    expect(typeof proto.lockInFadedGrid).toBe("function");
    expect(typeof proto.getVector).toBe("function");
    expect(typeof proto.addVector).toBe("function");
    expect(typeof proto.writeVectorCoordinates).toBe("function");
    expect(typeof proto.getBasisVectors).toBe("function");
    expect(typeof proto.getBasisVectorLabels).toBe("function");
    expect(typeof proto.getVectorLabel).toBe("function");
    expect(typeof proto.labelVector).toBe("function");
    expect(typeof proto.positionXCoordinate).toBe("function");
    expect(typeof proto.positionYCoordinate).toBe("function");
    expect(typeof proto.coordsToVector).toBe("function");
    expect(typeof proto.vectorToCoords).toBe("function");
    expect(typeof proto.showGhostMovement).toBe("function");
  });

  it("extends Scene", () => {
    const scene = new VectorScene();
    // VectorScene should have Scene's mobjects array
    expect(Array.isArray(scene.mobjects)).toBe(true);
  });

  it("getBasisVectors returns a group with 2 submobjects", () => {
    const scene = new VectorScene();
    const bv = scene.getBasisVectors();
    expect(bv.submobjects.length).toBe(2);
  });

  it("addPlane returns a mobject and adds it to scene", () => {
    const scene = new VectorScene();
    const plane = scene.addPlane();
    expect(plane).toBeDefined();
    // Scene should have at least one mobject after addPlane
    expect(scene.mobjects.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── LinearTransformationScene ──────────────────────────────

describe("LinearTransformationScene", () => {
  it("constructs with default options", () => {
    const scene = new LinearTransformationScene();
    expect(scene.includeBackgroundPlane).toBe(true);
    expect(scene.includeForegroundPlane).toBe(true);
    expect(scene.showCoordinates).toBe(false);
    expect(scene.showBasisVectors).toBe(true);
    expect(scene.leaveGhostVectors).toBe(false);
    expect(scene.basisVectorStrokeWidth).toBe(6);
    expect(scene.hasAlreadySetup).toBe(false);
  });

  it("constructs with custom options", () => {
    const scene = new LinearTransformationScene({
      includeBackgroundPlane: false,
      showCoordinates: true,
      leaveGhostVectors: true,
      basisVectorStrokeWidth: 3,
    });
    expect(scene.includeBackgroundPlane).toBe(false);
    expect(scene.showCoordinates).toBe(true);
    expect(scene.leaveGhostVectors).toBe(true);
    expect(scene.basisVectorStrokeWidth).toBe(3);
  });

  it("LinearTransformationSceneOptions type allows empty object", () => {
    const opts: LinearTransformationSceneOptions = {};
    expect(opts).toEqual({});
  });

  it("extends VectorScene", () => {
    const scene = new LinearTransformationScene();
    expect(scene instanceof VectorScene).toBe(true);
  });

  it("has expected prototype methods", () => {
    const proto = LinearTransformationScene.prototype;
    expect(typeof proto.setup).toBe("function");
    expect(typeof proto.addSpecialMobjects).toBe("function");
    expect(typeof proto.addBackgroundMobject).toBe("function");
    expect(typeof proto.addForegroundMobject).toBe("function");
    expect(typeof proto.addTransformableMobject).toBe("function");
    expect(typeof proto.addMovingMobject).toBe("function");
    expect(typeof proto.getGhostVectors).toBe("function");
    expect(typeof proto.getUnitSquare).toBe("function");
    expect(typeof proto.addUnitSquare).toBe("function");
    expect(typeof proto.addTransformableLabel).toBe("function");
    expect(typeof proto.addTitle).toBe("function");
    expect(typeof proto.getMatrixTransformation).toBe("function");
    expect(typeof proto.getTransposedMatrixTransformation).toBe("function");
    expect(typeof proto.getPieceMovement).toBe("function");
    expect(typeof proto.getMovingMobjectMovement).toBe("function");
    expect(typeof proto.getVectorMovement).toBe("function");
    expect(typeof proto.getTransformableLabelMovement).toBe("function");
    expect(typeof proto.applyMatrix).toBe("function");
    expect(typeof proto.applyInverse).toBe("function");
    expect(typeof proto.applyTransposedMatrix).toBe("function");
    expect(typeof proto.applyInverseTranspose).toBe("function");
    expect(typeof proto.applyNonlinearTransformation).toBe("function");
    expect(typeof proto.applyFunctionAnim).toBe("function");
  });

  it("setup initializes tracking lists", () => {
    const scene = new LinearTransformationScene();
    scene.setup();
    expect(scene.hasAlreadySetup).toBe(true);
    expect(Array.isArray(scene.backgroundMobjectsList)).toBe(true);
    expect(Array.isArray(scene.foregroundMobjects)).toBe(true);
    expect(Array.isArray(scene.transformableMobjects)).toBe(true);
    expect(Array.isArray(scene.movingVectors)).toBe(true);
    expect(Array.isArray(scene.transformableLabels)).toBe(true);
    expect(Array.isArray(scene.movingMobjects)).toBe(true);
  });

  it("setup is idempotent", () => {
    const scene = new LinearTransformationScene();
    scene.setup();
    const firstVectors = scene.movingVectors.length;
    scene.setup();
    // Second setup should be a no-op
    expect(scene.movingVectors.length).toBe(firstVectors);
  });

  it("updateDefaultConfigs merges passed configs", () => {
    const defaults = [{ a: 1, nested: { b: 2 } }];
    const passed = [{ nested: { c: 3 } }];
    LinearTransformationScene.updateDefaultConfigs(
      defaults as Record<string, unknown>[],
      passed as Record<string, unknown>[],
    );
    expect((defaults[0].nested as Record<string, unknown>).b).toBe(2);
    expect((defaults[0].nested as Record<string, unknown>).c).toBe(3);
  });

  it("updateDefaultConfigs skips null configs", () => {
    const defaults = [{ a: 1 }];
    const passed = [null];
    LinearTransformationScene.updateDefaultConfigs(
      defaults as Record<string, unknown>[],
      passed,
    );
    expect(defaults[0].a).toBe(1);
  });
});

// ─── Matrix transformation math ─────────────────────────────

describe("LinearTransformationScene matrix transformations", () => {
  it("getTransposedMatrixTransformation with 2x2 identity", () => {
    const scene = new LinearTransformationScene();
    const func = scene.getTransposedMatrixTransformation([[1, 0], [0, 1]]);
    const result = np.array(func(RIGHT)).toArray() as number[];
    expect(result[0]).toBeCloseTo(1, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });

  it("getTransposedMatrixTransformation with 2x2 scale", () => {
    const scene = new LinearTransformationScene();
    const func = scene.getTransposedMatrixTransformation([[2, 0], [0, 3]]);
    const result = np.array(func(np.array([1, 1, 0]) as unknown as typeof RIGHT)).toArray() as number[];
    expect(result[0]).toBeCloseTo(2, 5);
    expect(result[1]).toBeCloseTo(3, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });

  it("getTransposedMatrixTransformation with 3x3 matrix", () => {
    const scene = new LinearTransformationScene();
    const func = scene.getTransposedMatrixTransformation([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    const result = np.array(func(RIGHT)).toArray() as number[];
    expect(result[0]).toBeCloseTo(1, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });

  it("getTransposedMatrixTransformation throws for bad dimensions", () => {
    const scene = new LinearTransformationScene();
    expect(() => {
      scene.getTransposedMatrixTransformation([[1, 0, 0, 0]]);
    }).toThrow("Matrix has bad dimensions");
  });

  it("getMatrixTransformation applies correct transformation", () => {
    const scene = new LinearTransformationScene();
    // [[0, -1], [1, 0]] is a 90-degree rotation
    const func = scene.getMatrixTransformation([[0, -1], [1, 0]]);
    const result = np.array(func(RIGHT)).toArray() as number[];
    // RIGHT [1,0,0] rotated 90 degrees should give approximately UP [0,1,0]
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(1, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });
});
