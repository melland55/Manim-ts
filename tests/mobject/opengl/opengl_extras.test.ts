import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, ORIGIN, UP, RIGHT, PI } from "../../../src/core/math/index.js";
import { PURE_YELLOW, WHITE, BLACK } from "../../../src/utils/color/index.js";
import {
  OpenGLPMobject,
  OpenGLPGroup,
  OpenGLPMPoint,
  DotCloud,
  TrueDot,
  OpenGLSurface,
  OpenGLSurfaceGroup,
  OpenGLTexturedSurface,
  OpenGLSurfaceMesh,
} from "../../../src/mobject/opengl/opengl_extras/index.js";

// ─── OpenGLPMobject ──────────────────────────────────────────

describe("OpenGLPMobject", () => {
  it("constructs with defaults", () => {
    const pm = new OpenGLPMobject();
    expect(pm.strokeWidth).toBe(2.0);
    expect(pm.getNumPoints()).toBe(0);
    expect(pm.uniforms["point_radius"]).toBeCloseTo(
      2.0 * OpenGLPMobject.OPENGL_POINT_RADIUS_SCALE_FACTOR,
    );
  });

  it("constructs with custom stroke width", () => {
    const pm = new OpenGLPMobject({ strokeWidth: 5.0 });
    expect(pm.strokeWidth).toBe(5.0);
    expect(pm.uniforms["point_radius"]).toBeCloseTo(
      5.0 * OpenGLPMobject.OPENGL_POINT_RADIUS_SCALE_FACTOR,
    );
  });

  it("resetPoints clears points and rgbas", () => {
    const pm = new OpenGLPMobject();
    pm.setPoints(np.array([[1, 2, 3], [4, 5, 6]]));
    pm.resetPoints();
    expect(pm.getNumPoints()).toBe(0);
  });

  it("getArrayAttrs returns expected keys", () => {
    const pm = new OpenGLPMobject();
    expect(pm.getArrayAttrs()).toEqual(["points", "rgbas"]);
  });

  it("pointFromProportion returns correct point", () => {
    const pm = new OpenGLPMobject();
    const pts = np.array([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
    pm.setPoints(pts);
    const mid = pm.pointFromProportion(0.5);
    expect(mid).toBeCloseToPoint(np.array([1, 0, 0]));
  });
});

// ─── OpenGLPGroup ────────────────────────────────────────────

describe("OpenGLPGroup", () => {
  it("constructs from PMobjects", () => {
    const p1 = new OpenGLPMobject();
    const p2 = new OpenGLPMobject();
    const group = new OpenGLPGroup(p1, p2);
    expect(group.submobjects).toHaveLength(2);
  });

  it("rejects non-PMobject submobjects", () => {
    expect(() => {
      // @ts-expect-error — intentional invalid type for test
      new OpenGLPGroup("not a PMobject" as unknown);
    }).toThrow();
  });
});

// ─── OpenGLPMPoint ───────────────────────────────────────────

describe("OpenGLPMPoint", () => {
  it("constructs at origin by default", () => {
    const pt = new OpenGLPMPoint();
    expect(pt.getNumPoints()).toBe(1);
    expect(pt.points.get([0, 0])).toBeCloseTo(0);
    expect(pt.points.get([0, 1])).toBeCloseTo(0);
    expect(pt.points.get([0, 2])).toBeCloseTo(0);
  });

  it("constructs at custom location", () => {
    const pt = new OpenGLPMPoint({ location: [3, 4, 5] });
    expect(pt.points.get([0, 0])).toBeCloseTo(3);
    expect(pt.points.get([0, 1])).toBeCloseTo(4);
    expect(pt.points.get([0, 2])).toBeCloseTo(5);
  });

  it("uses custom stroke width", () => {
    const pt = new OpenGLPMPoint({ strokeWidth: 8.0 });
    expect(pt.strokeWidth).toBe(8.0);
  });
});

// ─── DotCloud ────────────────────────────────────────────────

describe("DotCloud", () => {
  it("constructs with default parameters", () => {
    const dc = new DotCloud();
    expect(dc.radius).toBe(2.0);
    expect(dc.epsilon).toBeCloseTo(0.1);
    expect(dc.getNumPoints()).toBeGreaterThan(0);
  });

  it("generates points in a disc pattern", () => {
    const dc = new DotCloud({ radius: 1.0, density: 5 });
    const pts = dc.points.toArray() as number[][];
    // All points should be within radius
    for (const pt of pts) {
      const dist = Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2]);
      expect(dist).toBeLessThanOrEqual(1.0 + 0.01);
    }
  });

  it("make3d sets gloss and shadow", () => {
    const dc = new DotCloud();
    dc.make3d(0.7, 0.3);
    expect(dc.getGloss()).toBeCloseTo(0.7);
    expect(dc.getShadow()).toBeCloseTo(0.3);
  });
});

// ─── TrueDot ─────────────────────────────────────────────────

describe("TrueDot", () => {
  it("constructs with single point at origin", () => {
    const td = new TrueDot();
    // TrueDot should have exactly 1 point (from constructor)
    expect(td.getNumPoints()).toBe(1);
  });

  it("constructs at custom center", () => {
    const td = new TrueDot({ center: [5, 6, 7] });
    expect(td.getNumPoints()).toBe(1);
    const pts = td.points.toArray() as number[][];
    expect(pts[0][0]).toBeCloseTo(5);
    expect(pts[0][1]).toBeCloseTo(6);
    expect(pts[0][2]).toBeCloseTo(7);
  });
});

// ─── OpenGLSurface ───────────────────────────────────────────

describe("OpenGLSurface", () => {
  it("constructs a flat surface with defaults", () => {
    const surface = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      uRange: [0, 1],
      vRange: [0, 1],
      resolution: [5, 5],
    });
    // 3 sets of points (base, du-nudged, dv-nudged), each 5x5 = 25
    expect(surface.getNumPoints()).toBe(75);
  });

  it("computes triangle indices", () => {
    const surface = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      resolution: [3, 3],
    });
    const triIndices = surface.getTriangleIndices();
    expect(triIndices).not.toBeNull();
    // (3-1)*(3-1) = 4 quads, 6 indices each = 24
    const arr = triIndices!.toArray() as number[];
    expect(arr.length).toBe(24);
  });

  it("getSurfacePointsAndNudgedPoints returns three arrays", () => {
    const surface = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      resolution: [3, 3],
    });
    const [s, du, dv] = surface.getSurfacePointsAndNudgedPoints();
    expect(s.shape[0]).toBe(9);
    expect(du.shape[0]).toBe(9);
    expect(dv.shape[0]).toBe(9);
  });

  it("getUnitNormals returns normalized vectors", () => {
    const surface = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      resolution: [3, 3],
    });
    const normals = surface.getUnitNormals();
    const normArr = normals.toArray() as number[][];
    for (const n of normArr) {
      const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      expect(len).toBeCloseTo(1.0, 3);
    }
  });

  it("handles zero resolution gracefully", () => {
    const surface = new OpenGLSurface({
      resolution: [0, 0],
    });
    const triIndices = surface.getTriangleIndices();
    expect(triIndices).not.toBeNull();
    expect((triIndices!.toArray() as number[]).length).toBe(0);
  });
});

// ─── OpenGLSurfaceGroup ─────────────────────────────────────

describe("OpenGLSurfaceGroup", () => {
  it("constructs empty group", () => {
    const group = new OpenGLSurfaceGroup();
    expect(group.getNumPoints()).toBe(0);
  });

  it("accepts child surfaces", () => {
    const s1 = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      resolution: [3, 3],
    });
    const group = new OpenGLSurfaceGroup([s1]);
    expect(group.submobjects).toHaveLength(1);
  });
});

// ─── OpenGLSurfaceMesh ──────────────────────────────────────

describe("OpenGLSurfaceMesh", () => {
  it("creates mesh lines on a surface", () => {
    const surface = new OpenGLSurface({
      uvFunc: (u, v) => [u, v, 0],
      uRange: [0, 1],
      vRange: [0, 1],
      resolution: [11, 11],
    });
    const mesh = new OpenGLSurfaceMesh(surface, {
      resolution: [3, 3],
    });
    // Should have u-lines + v-lines as submobjects
    expect(mesh.submobjects.length).toBeGreaterThan(0);
  });

  it("rejects non-surface input", () => {
    expect(() => {
      // @ts-expect-error — intentional invalid type for test
      new OpenGLSurfaceMesh("not a surface");
    }).toThrow("uvSurface must be of type OpenGLSurface");
  });
});
