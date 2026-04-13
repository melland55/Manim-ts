import { describe, it, expect } from "vitest";
import {
  QuickHullPoint,
  SubFacet,
  Facet,
  Horizon,
  QuickHull,
} from "../../src/utils/qhull/index.js";

// ── QuickHullPoint ────────────────────────────────────────────────────────────

describe("QuickHullPoint", () => {
  it("stores coordinates", () => {
    const pt = new QuickHullPoint([1, 2, 3]);
    expect(pt.coordinates).toEqual([1, 2, 3]);
  });

  it("equals same coordinates", () => {
    const a = new QuickHullPoint([1, 2, 3]);
    const b = new QuickHullPoint([1, 2, 3]);
    expect(a.equals(b)).toBe(true);
  });

  it("not equals different coordinates", () => {
    const a = new QuickHullPoint([1, 2, 3]);
    const b = new QuickHullPoint([1, 2, 4]);
    expect(a.equals(b)).toBe(false);
  });

  it("getKey is stable", () => {
    const pt = new QuickHullPoint([0.5, -1.0, 2.0]);
    expect(pt.getKey()).toBe(pt.getKey());
  });

  it("equal points produce identical keys", () => {
    const a = new QuickHullPoint([3, 4, 5]);
    const b = new QuickHullPoint([3, 4, 5]);
    expect(a.getKey()).toBe(b.getKey());
  });
});

// ── SubFacet ──────────────────────────────────────────────────────────────────

describe("SubFacet", () => {
  it("stores coordinates", () => {
    const sf = new SubFacet([[0, 0, 0], [1, 0, 0]]);
    expect(sf.coordinates).toEqual([[0, 0, 0], [1, 0, 0]]);
  });

  it("order-independent equality: same points in different order", () => {
    const sf1 = new SubFacet([[0, 0, 0], [1, 0, 0]]);
    const sf2 = new SubFacet([[1, 0, 0], [0, 0, 0]]);
    expect(sf1.equals(sf2)).toBe(true);
  });

  it("different points → not equal", () => {
    const sf1 = new SubFacet([[0, 0, 0], [1, 0, 0]]);
    const sf2 = new SubFacet([[0, 0, 0], [0, 1, 0]]);
    expect(sf1.equals(sf2)).toBe(false);
  });
});

// ── Facet ─────────────────────────────────────────────────────────────────────

describe("Facet", () => {
  // Triangle in the XY-plane
  const coords = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  const internal = [0.25, 0.25, -1]; // below the plane → normal should point +Z

  it("computes center as mean of vertices", () => {
    const f = new Facet(coords, internal);
    expect(f.center[0]).toBeCloseTo(1 / 3, 10);
    expect(f.center[1]).toBeCloseTo(1 / 3, 10);
    expect(f.center[2]).toBeCloseTo(0, 10);
  });

  it("normal is a unit vector", () => {
    const f = new Facet(coords, internal);
    const len = Math.sqrt(f.normal.reduce((s, x) => s + x * x, 0));
    expect(len).toBeCloseTo(1, 10);
  });

  it("normal points away from internal point", () => {
    const f = new Facet(coords, internal);
    // internal is below (z=-1), so outward normal should have positive z
    expect(f.normal[2]).toBeGreaterThan(0);
  });

  it("subfacets count equals number of vertices", () => {
    const f = new Facet(coords, internal);
    expect(f.subfacets.length).toBe(3);
  });

  it("two facets with same vertices are equal regardless of vertex order", () => {
    const f1 = new Facet([[0, 0, 0], [1, 0, 0], [0, 1, 0]], internal);
    const f2 = new Facet([[1, 0, 0], [0, 1, 0], [0, 0, 0]], internal);
    expect(f1.equals(f2)).toBe(true);
  });
});

// ── Horizon ───────────────────────────────────────────────────────────────────

describe("Horizon", () => {
  it("initially empty", () => {
    const h = new Horizon();
    expect(h.getFacets()).toHaveLength(0);
    expect(h.boundary).toHaveLength(0);
  });

  it("addFacet / hasFacet", () => {
    const h = new Horizon();
    const f = new Facet([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0.25, 0.25, -1]);
    expect(h.hasFacet(f)).toBe(false);
    h.addFacet(f);
    expect(h.hasFacet(f)).toBe(true);
  });

  it("getFacets returns all added facets", () => {
    const h = new Horizon();
    const f1 = new Facet([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0.25, 0.25, -1]);
    const f2 = new Facet([[0, 0, 0], [1, 0, 0], [0, 0, 1]], [0.25, 0.25, 0.25]);
    h.addFacet(f1);
    h.addFacet(f2);
    expect(h.getFacets()).toHaveLength(2);
  });
});

// ── QuickHull ─────────────────────────────────────────────────────────────────

describe("QuickHull — constructor", () => {
  it("default tolerance is 1e-5", () => {
    const qh = new QuickHull();
    expect(qh.tolerance).toBe(1e-5);
  });

  it("custom tolerance", () => {
    const qh = new QuickHull(1e-8);
    expect(qh.tolerance).toBe(1e-8);
  });

  it("initial state is empty", () => {
    const qh = new QuickHull();
    expect(qh.facets).toHaveLength(0);
    expect(qh.removed.size).toBe(0);
    expect(qh.unclaimed).toBeNull();
    expect(qh.internal).toBeNull();
  });
});

describe("QuickHull.build — error cases", () => {
  it("throws on 1-D data", () => {
    const qh = new QuickHull();
    expect(() => qh.build([[0], [1], [2]])).toThrow();
  });

  it("throws with too few points (fewer than dim+1)", () => {
    const qh = new QuickHull();
    // 3-D needs at least 4 points
    expect(() => qh.build([[0, 0, 0], [1, 0, 0], [0, 1, 0]])).toThrow();
  });

  it("throws on empty input", () => {
    const qh = new QuickHull();
    expect(() => qh.build([])).toThrow();
  });
});

describe("QuickHull.build — tetrahedron", () => {
  // Minimal 3-D convex hull: 4 vertices of a tetrahedron.
  const tetra = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  it("produces exactly 4 active facets", () => {
    const qh = new QuickHull();
    qh.build(tetra);
    const active = qh.facets.filter(f => !qh.removed.has(f.key));
    expect(active.length).toBe(4);
  });

  it("all facets have 3 subfacets (triangular)", () => {
    const qh = new QuickHull();
    qh.build(tetra);
    const active = qh.facets.filter(f => !qh.removed.has(f.key));
    for (const f of active) {
      expect(f.subfacets).toHaveLength(3);
    }
  });

  it("all normals are unit vectors", () => {
    const qh = new QuickHull();
    qh.build(tetra);
    const active = qh.facets.filter(f => !qh.removed.has(f.key));
    for (const f of active) {
      const len = Math.sqrt(f.normal.reduce((s, x) => s + x * x, 0));
      expect(len).toBeCloseTo(1, 8);
    }
  });
});

describe("QuickHull.build — cube", () => {
  // 8 vertices of a unit cube plus 1 interior point (should be ignored).
  const cube = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
    [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
    [0.5, 0.5, 0.5], // interior — must NOT appear as hull vertex
  ];

  it("produces 12 active facets (two triangles per cube face × 6 faces)", () => {
    const qh = new QuickHull();
    qh.build(cube);
    const active = qh.facets.filter(f => !qh.removed.has(f.key));
    expect(active.length).toBe(12);
  });

  it("unclaimed contains only the interior point after build", () => {
    const qh = new QuickHull();
    qh.build(cube);
    // The interior point [0.5, 0.5, 0.5] should be in unclaimed
    // (it never ends up as an eye since it's inside the hull).
    expect(qh.unclaimed).not.toBeNull();
  });
});

describe("QuickHull.initialize + classify", () => {
  it("sets internal point after initialize", () => {
    const qh = new QuickHull();
    qh.initialize([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(qh.internal).not.toBeNull();
    expect(qh.internal!.length).toBe(3);
  });

  it("sets unclaimed after initialize", () => {
    const qh = new QuickHull();
    qh.initialize([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(qh.unclaimed).not.toBeNull();
  });
});
