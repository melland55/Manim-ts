/**
 * Tests for animation/changing — AnimatedBoundary and TracedPath.
 */

import { describe, it, expect, vi } from "vitest";
import "../helpers/point-matchers.js";

import { AnimatedBoundary, TracedPath } from "../../src/animation/changing/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import { np } from "../../src/core/math/index.js";
import { smooth, linear } from "../../src/core/math/index.js";
import { ManimColor, BLUE_D, BLUE_B, BLUE_E, GREY_BROWN, WHITE, RED, GREEN, BLUE } from "../../src/utils/color/index.js";
import type { NDArray } from "numpy-ts";

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Creates a minimal VMobject-like Mobject with the methods
 * AnimatedBoundary requires (setStyle, setStroke, pointwiseBecomePartial,
 * familyMembersWithPoints, copy).
 */
function makeVMobjectLike(): Mobject {
  const mob = new Mobject();
  mob.points = np.array([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]);

  const proto = mob as unknown as Record<string, unknown>;
  proto.nPointsPerCurve = 4;
  proto.setStyle = function (this: Mobject, _opts: Record<string, unknown>) { return this; };
  proto.setStroke = function (this: Mobject, _color?: unknown, _width?: number, _opacity?: number) { return this; };
  proto.pointwiseBecomePartial = function (this: Mobject, _other: Mobject, _a: number, _b: number) { /* no-op */ };
  proto.familyMembersWithPoints = function (this: Mobject) {
    return this.getFamily().filter((m) => m.getNumPoints() > 0);
  };

  // Override copy to produce a VMobject-like copy
  const origCopy = mob.copy.bind(mob);
  proto.copy = function () {
    const c = origCopy() as Mobject;
    const cp = c as unknown as Record<string, unknown>;
    cp.nPointsPerCurve = 4;
    cp.setStyle = proto.setStyle;
    cp.setStroke = proto.setStroke;
    cp.pointwiseBecomePartial = proto.pointwiseBecomePartial;
    cp.familyMembersWithPoints = proto.familyMembersWithPoints;
    cp.copy = proto.copy;
    return c;
  };

  return mob;
}

// ─── AnimatedBoundary ──────────────────────────────────────────

describe("AnimatedBoundary", () => {
  it("constructs with default options", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob);

    expect(boundary.maxStrokeWidth).toBe(3);
    expect(boundary.cycleRate).toBe(0.5);
    expect(boundary.backAndForth).toBe(true);
    expect(boundary.totalTime).toBe(0);
    expect(boundary.colors).toHaveLength(4);
    expect(boundary.boundaryCopies).toHaveLength(2);
  });

  it("accepts custom colors", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob, {
      colors: [RED, GREEN, BLUE],
    });

    expect(boundary.colors).toHaveLength(3);
  });

  it("accepts custom options", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob, {
      maxStrokeWidth: 5,
      cycleRate: 1.0,
      backAndForth: false,
      drawRateFunc: linear,
      fadeRateFunc: linear,
    });

    expect(boundary.maxStrokeWidth).toBe(5);
    expect(boundary.cycleRate).toBe(1.0);
    expect(boundary.backAndForth).toBe(false);
    expect(boundary.drawRateFunc).toBe(linear);
    expect(boundary.fadeRateFunc).toBe(linear);
  });

  it("throws for non-VMobject input", () => {
    const plainMob = new Mobject();
    expect(() => new AnimatedBoundary(plainMob)).toThrow(TypeError);
  });

  it("adds boundary copies as submobjects", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob);

    // boundary copies should be in submobjects
    expect(boundary.submobjects).toContain(boundary.boundaryCopies[0]);
    expect(boundary.submobjects).toContain(boundary.boundaryCopies[1]);
  });

  it("registers an updater", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob);

    expect(boundary.updaters.length).toBeGreaterThanOrEqual(1);
  });

  it("updateBoundaryCopies advances totalTime", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob);

    expect(boundary.totalTime).toBe(0);
    boundary.updateBoundaryCopies(0.5);
    expect(boundary.totalTime).toBe(0.5);
    boundary.updateBoundaryCopies(0.3);
    expect(boundary.totalTime).toBeCloseTo(0.8);
  });

  it("fullFamilyBecomePartial calls pointwiseBecomePartial", () => {
    const vmob = makeVMobjectLike();
    const boundary = new AnimatedBoundary(vmob);

    const copy1 = boundary.boundaryCopies[0];
    const spy = vi.fn();
    (copy1 as unknown as Record<string, unknown>).pointwiseBecomePartial = spy;

    boundary.fullFamilyBecomePartial(copy1, vmob, 0, 0.5);

    expect(spy).toHaveBeenCalled();
  });
});

// ─── TracedPath ────────────────────────────────────────────────

describe("TracedPath", () => {
  it("constructs with default options", () => {
    const fn = () => np.array([1, 2, 3]);
    const traced = new TracedPath(fn);

    expect(traced.tracedPointFunc).toBe(fn);
    expect(traced.dissipatingTime).toBeNull();
    expect(traced.time).toBeNull();
  });

  it("constructs with dissipating time", () => {
    const fn = () => np.array([0, 0, 0]);
    const traced = new TracedPath(fn, { dissipatingTime: 0.5 });

    expect(traced.dissipatingTime).toBe(0.5);
    expect(traced.time).toBe(1.0);
  });

  it("registers an updater", () => {
    const fn = () => np.array([0, 0, 0]);
    const traced = new TracedPath(fn);

    expect(traced.updaters.length).toBeGreaterThanOrEqual(1);
  });

  it("updatePath adds points from traced function", () => {
    let pos = [0, 0, 0];
    const fn = () => np.array(pos);
    const traced = new TracedPath(fn);

    // Initially no points
    expect(traced.getNumPoints()).toBe(0);

    // First update should create initial point + line
    traced.updatePath(traced, 1 / 30);
    expect(traced.getNumPoints()).toBeGreaterThan(0);
  });

  it("updatePath accumulates points", () => {
    let callCount = 0;
    const positions = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];
    const fn = () => np.array(positions[Math.min(callCount++, positions.length - 1)]);
    const traced = new TracedPath(fn);

    traced.updatePath(traced, 1 / 30);
    const n1 = traced.getNumPoints();

    traced.updatePath(traced, 1 / 30);
    const n2 = traced.getNumPoints();

    expect(n2).toBeGreaterThan(n1);
  });

  it("dissipation removes old points over time", () => {
    let callCount = 0;
    const fn = () => np.array([callCount++, 0, 0]);
    const traced = new TracedPath(fn, { dissipatingTime: 0.1 });

    // Build up some points
    for (let i = 0; i < 20; i++) {
      traced.updatePath(traced, 0.1);
    }

    const pointsBefore = traced.getNumPoints();

    // Continue with large dt to trigger dissipation
    traced.updatePath(traced, 1.0);
    const pointsAfter = traced.getNumPoints();

    // Points should have been trimmed (or at least not grown unboundedly)
    // The exact behavior depends on whether nPointsPerCurve < total points
    expect(pointsAfter).toBeLessThanOrEqual(pointsBefore + 1);
  });

  it("accepts custom stroke color", () => {
    const fn = () => np.array([0, 0, 0]);
    const traced = new TracedPath(fn, {
      strokeColor: RED,
    });
    // Should construct without error
    expect(traced).toBeInstanceOf(TracedPath);
  });
});
