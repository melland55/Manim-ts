/**
 * Tests for src/mobject/svg/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np } from "../../src/core/math/index.js";
import { VMobjectFromSVGPath } from "../../src/mobject/svg/index.js";

describe("VMobjectFromSVGPath", () => {
  describe("constructor defaults", () => {
    it("creates with empty path string by default", () => {
      const mob = new VMobjectFromSVGPath();
      expect(mob.pathString).toBe("");
      expect(mob.longLines).toBe(false);
      expect(mob.shouldSubdivideSharpCurves).toBe(false);
      expect(mob.shouldRemoveNullCurves).toBe(false);
    });

    it("creates with no points from empty path", () => {
      const mob = new VMobjectFromSVGPath();
      expect(mob.points.shape[0]).toBe(0);
      expect(mob.points.shape[1]).toBe(3);
    });
  });

  describe("path parsing", () => {
    it("parses a simple move-line-close path (M L Z)", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 10 0 L 10 10 Z",
      });
      // Should have generated cubic bezier points (4 per segment)
      expect(mob.points.shape[0]).toBeGreaterThan(0);
      // 3 segments (3 lines including closing), 4 points each = 12
      expect(mob.points.shape[0]).toBe(12);
      expect(mob.points.shape[1]).toBe(3);
    });

    it("parses a cubic bezier path (M C)", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 C 1 2 3 4 5 6",
      });
      // 1 cubic = 4 points
      expect(mob.points.shape[0]).toBe(4);
      expect(mob.points.shape[1]).toBe(3);
    });

    it("parses a quadratic bezier path (M Q)", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 Q 5 5 10 0",
      });
      // Quadratic elevated to cubic = 4 points
      expect(mob.points.shape[0]).toBe(4);
    });

    it("handles empty path string gracefully", () => {
      const mob = new VMobjectFromSVGPath({ pathString: "" });
      expect(mob.points.shape[0]).toBe(0);
    });

    it("handles whitespace-only path string", () => {
      const mob = new VMobjectFromSVGPath({ pathString: "   " });
      expect(mob.points.shape[0]).toBe(0);
    });

    it("generates correct start/end points for a line", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 10 0",
      });
      // First point (row 0) should be at origin
      const pts = mob.points.toArray() as number[][];
      expect(np.array(pts[0])).toBeCloseToPoint(np.array([0, 0, 0]));
      // Last point (row 3) should be at (10, 0, 0)
      expect(np.array(pts[3])).toBeCloseToPoint(np.array([10, 0, 0]));
    });

    it("handles multiple move commands", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 5 0 M 10 10 L 15 10",
      });
      // Two line segments, each 4 points = 8
      expect(mob.points.shape[0]).toBe(8);
    });
  });

  describe("close path behavior", () => {
    it("adds closing segment when endpoint differs from start", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 10 0 L 10 10 Z",
      });
      // 3 line segments (2 explicit + 1 close) × 4 points = 12
      expect(mob.points.shape[0]).toBe(12);
    });

    it("does not add closing segment when already at start", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 10 0 L 0 0 Z",
      });
      // 2 explicit lines × 4 = 8 (close adds nothing since we're at start)
      expect(mob.points.shape[0]).toBe(8);
    });
  });

  describe("options", () => {
    it("accepts custom path string config", () => {
      const mob = new VMobjectFromSVGPath({
        pathString: "M 0 0 L 5 5",
        longLines: true,
        shouldSubdivideSharpCurves: true,
        shouldRemoveNullCurves: true,
      });
      expect(mob.longLines).toBe(true);
      expect(mob.shouldSubdivideSharpCurves).toBe(true);
      expect(mob.shouldRemoveNullCurves).toBe(true);
    });
  });
});
