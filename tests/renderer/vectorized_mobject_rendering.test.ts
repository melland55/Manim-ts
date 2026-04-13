/**
 * Tests for renderer/vectorized_mobject_rendering.
 *
 * Focuses on the pure-math helpers (buildMatrixLists, triangulateMobject)
 * that can be exercised without a live WebGL2 context.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { np } from "../../src/core/math/index.js";
import type { NDArray } from "numpy-ts";
import {
  buildMatrixLists,
  triangulateMobject,
  type FillVertexAttributes,
  type IOpenGLVMobject,
} from "../../src/renderer/vectorized_mobject_rendering/index.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Identity 4×4 matrix as NDArray. */
function identity4(): NDArray {
  return np.array([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a minimal IOpenGLVMobject stub.
 *
 * @param points  Array of [x,y,z] rows (every 3 rows = one quadratic bezier).
 * @param options Overrides for orientation / toleranceForPointEquality.
 */
function makeMob(
  points: number[][],
  options: Partial<{
    orientation: 1 | -1;
    toleranceForPointEquality: number;
    submobjects: IOpenGLVMobject[];
  }> = {},
): IOpenGLVMobject {
  const mob: IOpenGLVMobject = {
    points: np.array(points.length > 0 ? points : [[0, 0, 0]]),
    submobjects: options.submobjects ?? [],
    hasPoints: () => points.length > 0,
    fillRgba: np.array([[1, 0, 0, 1]]),
    strokeRgba: np.array([[0, 1, 0, 1]]),
    strokeWidth: 2,
    needsNewTriangulation: true,
    triangulation: null,
    orientation: options.orientation ?? 1,
    toleranceForPointEquality: options.toleranceForPointEquality ?? 1e-6,
    unitNormal: np.array([[0, 0, 1]]),
    modelMatrix: identity4(),
    hierarchicalModelMatrix: () => identity4(),
  };
  return mob;
}

/**
 * One convex quadratic bezier triangle: anchor → handle → anchor.
 * Forms a single curve with three control points.
 */
function oneConvexCurve(): number[][] {
  return [
    [0, 0, 0], // b0 anchor
    [0.5, 1, 0], // b1 handle
    [1, 0, 0], // b2 anchor
  ];
}

// ─── buildMatrixLists ─────────────────────────────────────────────────────────

describe("buildMatrixLists", () => {
  it("returns a single entry for a root mob with no children", () => {
    const mob = makeMob(oneConvexCurve());
    const result = buildMatrixLists(mob);
    expect(result.size).toBe(1);
  });

  it("maps root mob to a list containing just itself", () => {
    const mob = makeMob(oneConvexCurve());
    const result = buildMatrixLists(mob);
    const [, mobList] = [...result.entries()][0];
    expect(mobList).toHaveLength(1);
    expect(mobList[0]).toBe(mob);
  });

  it("excludes mobs that have no points", () => {
    const child = makeMob([]); // no points
    const parent = makeMob(oneConvexCurve(), { submobjects: [child] });
    const result = buildMatrixLists(parent);
    // Only parent should appear
    const allMobs = [...result.values()].flat();
    expect(allMobs).not.toContain(child);
  });

  it("includes children with points as separate entries when they share the same identity matrix", () => {
    const child = makeMob(oneConvexCurve());
    const parent = makeMob(oneConvexCurve(), { submobjects: [child] });
    const result = buildMatrixLists(parent);
    const allMobs = [...result.values()].flat();
    // Both parent and child share the identity matrix, so they end up in the same list
    expect(allMobs).toContain(parent);
    expect(allMobs).toContain(child);
  });

  it("produces separate entries for children with different model matrices", () => {
    const child = makeMob(oneConvexCurve());
    // Give child a non-identity model matrix
    child.modelMatrix = np.array([
      [2, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 2, 0],
      [0, 0, 0, 1],
    ]);
    const parent = makeMob(oneConvexCurve(), { submobjects: [child] });
    const result = buildMatrixLists(parent);
    // Parent (identity) and child (scale 2) land in different buckets
    expect(result.size).toBe(2);
  });
});

// ─── triangulateMobject ───────────────────────────────────────────────────────

describe("triangulateMobject", () => {
  it("returns empty attributes for a mob with no curves", () => {
    const mob = makeMob([]);
    mob.hasPoints = () => false;
    // force points to empty 1-row stub that produces 0 curves
    mob.points = np.array([[0, 0, 0]]); // < 3 rows → 0 complete curves
    const attrs = triangulateMobject(mob);
    expect(attrs.vertexCount).toBe(0);
    expect(attrs.inVert.length).toBe(0);
  });

  it("caches result and sets needsNewTriangulation = false", () => {
    const mob = makeMob(oneConvexCurve());
    expect(mob.needsNewTriangulation).toBe(true);
    const attrs = triangulateMobject(mob);
    expect(mob.needsNewTriangulation).toBe(false);
    expect(mob.triangulation).toBe(attrs);
    // Second call returns cached result
    const attrs2 = triangulateMobject(mob);
    expect(attrs2).toBe(attrs);
  });

  it("produces typed arrays with consistent lengths", () => {
    const mob = makeMob(oneConvexCurve());
    const attrs = triangulateMobject(mob);
    const n = attrs.vertexCount;
    expect(attrs.inVert.length).toBe(n * 3);
    expect(attrs.inColor.length).toBe(n * 4);
    expect(attrs.textureCoords.length).toBe(n * 2);
    expect(attrs.textureMode.length).toBe(n);
  });

  it("vertex count is a multiple of 3 (whole triangles)", () => {
    const mob = makeMob(oneConvexCurve());
    const attrs = triangulateMobject(mob);
    expect(attrs.vertexCount % 3).toBe(0);
  });

  it("texture mode values are in {-1, 0, 1}", () => {
    // Two-curve closed path
    const points = [
      [0, 0, 0],
      [0.5, 1, 0],
      [1, 0, 0], // curve 1 end = curve 2 start → connected
      [1, 0, 0],
      [0.5, -1, 0],
      [0, 0, 0], // curve 2 end = curve 1 start → closed loop
    ];
    const mob = makeMob(points);
    const attrs = triangulateMobject(mob);
    const validModes = new Set([-1, 0, 1]);
    for (let i = 0; i < attrs.textureMode.length; i++) {
      expect(validModes.has(attrs.textureMode[i])).toBe(true);
    }
  });

  it("UV coordinates are in [0, 1] range", () => {
    const mob = makeMob(oneConvexCurve());
    const attrs = triangulateMobject(mob);
    for (let i = 0; i < attrs.textureCoords.length; i++) {
      expect(attrs.textureCoords[i]).toBeGreaterThanOrEqual(0);
      expect(attrs.textureCoords[i]).toBeLessThanOrEqual(1);
    }
  });

  it("respects orientation flag: orientation=-1 produces valid output", () => {
    const mob = makeMob(oneConvexCurve(), { orientation: -1 });
    const attrs = triangulateMobject(mob);
    expect(attrs.vertexCount % 3).toBe(0);
    expect(attrs.inVert.length).toBe(attrs.vertexCount * 3);
  });
});
