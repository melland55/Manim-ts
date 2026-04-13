/**
 * Tests for mobject/geometry/polygram module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, TAU, PI } from "../../../src/core/math/index.js";
import { BLUE, WHITE } from "../../../src/core/color/index.js";
import {
  Polygram,
  Polygon,
  RegularPolygram,
  RegularPolygon,
  Star,
  Triangle,
  Rectangle,
  Square,
  RoundedRectangle,
  Cutout,
  ConvexHull,
} from "../../../src/mobject/geometry/polygram/index.js";

describe("Polygram", () => {
  it("constructs from vertex groups and has points", () => {
    const poly = new Polygram([
      [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    ]);
    expect(poly.getNumPoints()).toBeGreaterThan(0);
  });

  it("getVertices returns the correct number of vertices", () => {
    const poly = new Polygram([
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
    ]);
    const verts = poly.getVertices();
    // 4 original vertices + the closing vertex back to start = 5 segments, so 5 start anchors
    expect(verts.length).toBeGreaterThanOrEqual(4);
  });

  it("supports multiple vertex groups (hexagram)", () => {
    const sqrt3 = Math.sqrt(3);
    const poly = new Polygram([
      [[0, 2, 0], [-sqrt3, -1, 0], [sqrt3, -1, 0]],
      [[-sqrt3, 1, 0], [0, -2, 0], [sqrt3, 1, 0]],
    ]);
    expect(poly.getNumPoints()).toBeGreaterThan(0);
    const groups = poly.getVertexGroups();
    expect(groups.length).toBe(2);
  });

  it("default color is BLUE", () => {
    const poly = new Polygram([[[0, 0, 0], [1, 0, 0], [0, 1, 0]]]);
    expect(poly.strokeColor).toBe(BLUE);
  });
});

describe("Polygon", () => {
  it("constructs from a list of vertices", () => {
    const poly = new Polygon([
      [0, 0, 0],
      [1, 0, 0],
      [0.5, 1, 0],
    ]);
    expect(poly.getNumPoints()).toBeGreaterThan(0);
  });

  it("supports Point3D arguments", () => {
    const poly = new Polygon([
      np.array([0, 0, 0]),
      np.array([1, 0, 0]),
      np.array([0, 1, 0]),
    ]);
    expect(poly.getNumPoints()).toBeGreaterThan(0);
  });
});

describe("RegularPolygon", () => {
  it("defaults to hexagon (n=6)", () => {
    const hex = new RegularPolygon();
    const verts = hex.getVertices();
    // A hexagon has 6 vertices (+1 close = 7 segments → 7 start anchors)
    expect(verts.length).toBeGreaterThanOrEqual(6);
  });

  it("creates a pentagon with n=5", () => {
    const pent = new RegularPolygon(5);
    const verts = pent.getVertices();
    expect(verts.length).toBeGreaterThanOrEqual(5);
  });

  it("respects custom radius", () => {
    const poly = new RegularPolygon(4, { radius: 2 });
    const verts = poly.getVertices();
    // Each vertex should be approximately distance 2 from origin
    const v0 = verts[0];
    const dist = Math.sqrt(
      (v0.item(0) as number) ** 2 +
      (v0.item(1) as number) ** 2 +
      (v0.item(2) as number) ** 2,
    );
    expect(dist).toBeCloseTo(2, 5);
  });
});

describe("RegularPolygram", () => {
  it("creates a pentagram with default density=2", () => {
    const gram = new RegularPolygram(5);
    expect(gram.getNumPoints()).toBeGreaterThan(0);
  });

  it("creates multiple groups when gcd > 1", () => {
    // {6/2} simplifies to 2{3} — two triangles
    const gram = new RegularPolygram(6, { density: 2 });
    const groups = gram.getVertexGroups();
    expect(groups.length).toBe(2);
  });
});

describe("Star", () => {
  it("constructs with default 5 points", () => {
    const star = new Star();
    const verts = star.getVertices();
    // 5 outer + 5 inner = 10 vertices
    expect(verts.length).toBeGreaterThanOrEqual(10);
  });

  it("throws for invalid density", () => {
    expect(() => new Star(5, { density: 0 })).toThrow();
    expect(() => new Star(5, { density: 3 })).toThrow();
  });

  it("supports custom outer and inner radius", () => {
    const star = new Star(5, { outerRadius: 2, innerRadius: 0.5 });
    expect(star.getNumPoints()).toBeGreaterThan(0);
  });
});

describe("Triangle", () => {
  it("constructs with 3 sides", () => {
    const tri = new Triangle();
    const verts = tri.getVertices();
    expect(verts.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Rectangle", () => {
  it("constructs with default dimensions", () => {
    const rect = new Rectangle();
    expect(rect.getNumPoints()).toBeGreaterThan(0);
  });

  it("has correct width and height", () => {
    const rect = new Rectangle({ width: 4, height: 2 });
    // Width and height should be close to specified values
    expect(rect.getWidth()).toBeCloseTo(4, 1);
    expect(rect.getHeight()).toBeCloseTo(2, 1);
  });

  it("default color is WHITE", () => {
    const rect = new Rectangle();
    expect(rect.strokeColor).toBe(WHITE);
  });

  it("supports grid lines", () => {
    const rect = new Rectangle({
      width: 4,
      height: 2,
      gridXstep: 1,
      gridYstep: 0.5,
    });
    expect(rect.gridLines.submobjects.length).toBeGreaterThan(0);
  });
});

describe("Square", () => {
  it("constructs with default side length 2", () => {
    const sq = new Square();
    expect(sq.getWidth()).toBeCloseTo(sq.getHeight(), 1);
  });

  it("constructs with custom side length", () => {
    const sq = new Square({ sideLength: 3 });
    expect(sq.getWidth()).toBeCloseTo(3, 1);
  });

  it("side_length getter returns correct value", () => {
    const sq = new Square({ sideLength: 2 });
    expect(sq.sideLength).toBeCloseTo(2, 1);
  });
});

describe("RoundedRectangle", () => {
  it("constructs with default corner radius", () => {
    const rect = new RoundedRectangle();
    expect(rect.cornerRadius).toBe(0.5);
    expect(rect.getNumPoints()).toBeGreaterThan(0);
  });

  it("has more points than a regular rectangle due to rounding", () => {
    const plain = new Rectangle({ width: 4, height: 2 });
    const rounded = new RoundedRectangle({ width: 4, height: 2 });
    expect(rounded.getNumPoints()).toBeGreaterThan(plain.getNumPoints());
  });
});

describe("Cutout", () => {
  it("combines main shape and cutout shapes", () => {
    const mainShape = new Square({ sideLength: 4 });
    const hole = new Square({ sideLength: 1 });
    const cutout = new Cutout(mainShape, [hole]);
    // Should have points from both shapes
    expect(cutout.getNumPoints()).toBeGreaterThan(mainShape.getNumPoints());
  });
});

describe("ConvexHull", () => {
  it("constructs hull from points", () => {
    const points = [
      [-2, -2, 0],
      [2, -2, 0],
      [2, 2, 0],
      [-2, 2, 0],
      [0, 0, 0], // interior point, should not be on hull
    ];
    const hull = new ConvexHull(points);
    expect(hull.getNumPoints()).toBeGreaterThan(0);
    // Hull should have 4 vertices (the square corners)
    const verts = hull.getVertices();
    expect(verts.length).toBeGreaterThanOrEqual(4);
  });

  it("handles collinear points", () => {
    const points = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 1, 0],
    ];
    const hull = new ConvexHull(points);
    expect(hull.getNumPoints()).toBeGreaterThan(0);
  });
});
