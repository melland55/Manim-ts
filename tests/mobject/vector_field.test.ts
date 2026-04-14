/**
 * Tests for src/mobject/vector_field/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np, RIGHT, UP, OUT, sigmoid } from "../../src/core/math/index.js";
import type { Point3D } from "../../src/core/math/index.js";
import { BLUE_E, GREEN, YELLOW, RED } from "../../src/utils/color/manim_colors.js";
import { ManimColor } from "../../src/utils/color/core.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import {
  VectorField,
  ArrowVectorField,
  StreamLines,
  DEFAULT_SCALAR_FIELD_COLORS,
} from "../../src/mobject/vector_field/index.js";

// Simple vector field function for testing
const constantField = (_pos: Point3D): Point3D => np.array([1, 0, 0]);
const radialField = (pos: Point3D): Point3D => pos;

describe("VectorField", () => {
  describe("constructor", () => {
    it("creates with default color scheme (no color)", () => {
      const vf = new VectorField(constantField);
      expect(vf.singleColor).toBe(false);
      expect(vf.func).toBe(constantField);
      expect(vf.submobMovementUpdater).toBeNull();
    });

    it("creates with a single color", () => {
      const vf = new VectorField(constantField, { color: RED });
      expect(vf.singleColor).toBe(true);
    });

    it("stores custom color scheme function", () => {
      const scheme = (vec: Point3D) => (vec.toArray() as number[])[0];
      const vf = new VectorField(constantField, { colorScheme: scheme });
      expect(vf.colorScheme).toBe(scheme);
    });
  });

  describe("DEFAULT_SCALAR_FIELD_COLORS", () => {
    it("contains four colors: BLUE_E, GREEN, YELLOW, RED", () => {
      expect(DEFAULT_SCALAR_FIELD_COLORS).toHaveLength(4);
      expect(DEFAULT_SCALAR_FIELD_COLORS[0]).toBe(BLUE_E);
      expect(DEFAULT_SCALAR_FIELD_COLORS[1]).toBe(GREEN);
      expect(DEFAULT_SCALAR_FIELD_COLORS[2]).toBe(YELLOW);
      expect(DEFAULT_SCALAR_FIELD_COLORS[3]).toBe(RED);
    });
  });

  describe("static methods", () => {
    it("shiftFunc shifts the input position", () => {
      const shifted = VectorField.shiftFunc(
        (p: Point3D) => p,
        np.array([1, 0, 0]),
      );
      const result = shifted(np.array([3, 0, 0]));
      const arr = result.toArray() as number[];
      expect(arr[0]).toBeCloseTo(2, 5);
      expect(arr[1]).toBeCloseTo(0, 5);
      expect(arr[2]).toBeCloseTo(0, 5);
    });

    it("scaleFunc scales the input position", () => {
      const scaled = VectorField.scaleFunc(
        (p: Point3D) => p,
        2,
      );
      const result = scaled(np.array([1, 1, 0]));
      const arr = result.toArray() as number[];
      expect(arr[0]).toBeCloseTo(2, 5);
      expect(arr[1]).toBeCloseTo(2, 5);
    });
  });

  describe("posToRgb", () => {
    it("returns RGB values between 0 and 1", () => {
      const vf = new VectorField(constantField);
      const rgb = vf.posToRgb(np.array([0, 0, 0]));
      expect(rgb).toHaveLength(3);
      for (const channel of rgb) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    });

    it("maps zero-length vectors to min color", () => {
      const zeroField = (_pos: Point3D): Point3D => np.array([0, 0, 0]);
      const vf = new VectorField(zeroField);
      const rgb = vf.posToRgb(np.array([0, 0, 0]));
      // At value=0 (min), should map to first color (BLUE_E)
      expect(rgb).toHaveLength(3);
    });
  });

  describe("nudge", () => {
    it("moves a mobject in the direction of the field", () => {
      const vf = new VectorField(constantField);
      const mob = new Mobject();
      mob.points = np.array([[0, 0, 0]]);

      vf.nudge(mob, 1.0, 10);
      const center = mob.getCenter();
      const arr = center.toArray() as number[];
      // Field is [1, 0, 0], so after nudging with dt=1, x should increase
      expect(arr[0]).toBeGreaterThan(0);
    });

    it("returns self for chaining", () => {
      const vf = new VectorField(constantField);
      const mob = new Mobject();
      mob.points = np.array([[0, 0, 0]]);
      const result = vf.nudge(mob);
      expect(result).toBe(vf);
    });
  });

  describe("getNudgeUpdater", () => {
    it("returns a function", () => {
      const vf = new VectorField(constantField);
      const updater = vf.getNudgeUpdater();
      expect(typeof updater).toBe("function");
    });

    it("accepts speed parameter", () => {
      const vf = new VectorField(constantField);
      const updater = vf.getNudgeUpdater(2.0);
      expect(typeof updater).toBe("function");
    });
  });

  describe("getVectorizedRgbaGradientFunction", () => {
    it("returns a function that maps values to RGBA arrays", () => {
      const vf = new VectorField(constantField);
      const gradientFn = vf.getVectorizedRgbaGradientFunction(
        0, 2, [BLUE_E, RED],
      );
      const result = gradientFn([0, 1, 2]);
      expect(result).toHaveLength(3);
      for (const rgba of result) {
        expect(rgba).toHaveLength(4);
        expect(rgba[3]).toBe(1.0); // default opacity
      }
    });

    it("respects custom opacity", () => {
      const vf = new VectorField(constantField);
      const gradientFn = vf.getVectorizedRgbaGradientFunction(
        0, 2, [BLUE_E, RED],
      );
      const result = gradientFn([1], 0.5);
      expect(result[0][3]).toBe(0.5);
    });
  });

  describe("getColoredBackgroundImage", () => {
    it("throws for single-color fields", () => {
      const vf = new VectorField(constantField, { color: RED });
      expect(() => vf.getColoredBackgroundImage()).toThrow();
    });
  });
});

describe("ArrowVectorField", () => {
  it("creates arrows at grid positions", () => {
    const vf = new ArrowVectorField(constantField, {
      xRange: [-1, 1, 1],
      yRange: [-1, 1, 1],
    });
    // With x in [-1, 0, 1] and y in [-1, 0, 1] (step=1, range expanded by step)
    // and z in [0] => should have multiple vectors
    expect(vf.submobjects.length).toBeGreaterThan(0);
  });

  it("uses default length function with sigmoid", () => {
    const vf = new ArrowVectorField(radialField, {
      xRange: [0, 1, 1],
      yRange: [0, 1, 1],
    });
    expect(vf.lengthFunc(1)).toBeCloseTo(0.45 * sigmoid(1), 5);
  });

  it("accepts custom length function", () => {
    const customLength = (n: number) => n / 3;
    const vf = new ArrowVectorField(constantField, {
      xRange: [0, 1, 1],
      yRange: [0, 1, 1],
      lengthFunc: customLength,
    });
    expect(vf.lengthFunc).toBe(customLength);
  });
});

describe("StreamLines", () => {
  it("creates stream lines from a vector field function", () => {
    const vf = new StreamLines(constantField, {
      xRange: [-1, 1, 1],
      yRange: [-1, 1, 1],
      virtualTime: 0.5,
      dt: 0.1,
    });
    expect(vf.streamLines.length).toBeGreaterThan(0);
  });

  it("stores configuration properties", () => {
    const vf = new StreamLines(constantField, {
      xRange: [-1, 1, 1],
      yRange: [-1, 1, 1],
      virtualTime: 2,
      maxAnchorsPerLine: 50,
      padding: 5,
      strokeWidth: 2,
    });
    expect(vf.virtualTime).toBe(2);
    expect(vf.maxAnchorsPerLine).toBe(50);
    expect(vf.padding).toBe(5);
    expect(vf.strokeWidth).toBe(2);
  });

  it("create() returns an AnimationGroup over the stream lines", () => {
    const vf = new StreamLines(constantField, {
      xRange: [-1, 1, 1],
      yRange: [-1, 1, 1],
      virtualTime: 0.5,
      dt: 0.1,
    });
    const anim = vf.create();
    expect(anim).toBeDefined();
    expect((anim as unknown as { runTime: number }).runTime).toBeGreaterThan(0);
  });

  it("endAnimation throws if not started", () => {
    const vf = new StreamLines(constantField, {
      xRange: [-1, 1, 1],
      yRange: [-1, 1, 1],
      virtualTime: 0.5,
      dt: 0.1,
    });
    expect(() => vf.endAnimation()).toThrow(
      "You have to start the animation before fading it out.",
    );
  });
});
