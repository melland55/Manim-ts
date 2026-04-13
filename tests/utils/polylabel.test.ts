import { describe, it, expect } from "vitest";
import { Polygon, Cell, polylabel } from "../../src/utils/polylabel/index.js";

// ---------------------------------------------------------------------------
// Polygon.inside
// ---------------------------------------------------------------------------

describe("Polygon.inside — simple square [[0,0],[4,0],[4,4],[0,4],[0,0]]", () => {
  const rings = [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]];
  const polygon = new Polygon(rings);

  const insidePoints = [
    [2, 2], [1, 1], [3.9, 3.9],
    // boundary points (treated as inside)
    [0, 0], [2, 0], [0, 2], [0, 4], [4, 0], [4, 2], [2, 4], [4, 4],
  ];
  const outsidePoints = [[-1, -1], [5, 5], [4.1, 2]];

  for (const pt of insidePoints) {
    it(`inside ${JSON.stringify(pt)}`, () => {
      expect(polygon.inside(pt)).toBe(true);
    });
  }
  for (const pt of outsidePoints) {
    it(`outside ${JSON.stringify(pt)}`, () => {
      expect(polygon.inside(pt)).toBe(false);
    });
  }
});

describe("Polygon.inside — square with hole (donut)", () => {
  const rings = [
    [[1, 1], [5, 1], [5, 5], [1, 5], [1, 1]],
    [[2, 2], [2, 4], [4, 4], [4, 2], [2, 2]],
  ];
  const polygon = new Polygon(rings);

  it("inside annular region [1.5, 1.5]", () => {
    expect(polygon.inside([1.5, 1.5])).toBe(true);
  });
  it("inside annular region [3, 1.5]", () => {
    expect(polygon.inside([3, 1.5])).toBe(true);
  });
  it("inside annular region [1.5, 3]", () => {
    expect(polygon.inside([1.5, 3])).toBe(true);
  });
  it("outside (in hole) [3, 3]", () => {
    expect(polygon.inside([3, 3])).toBe(false);
  });
  it("outside (exterior) [6, 6]", () => {
    expect(polygon.inside([6, 6])).toBe(false);
  });
  it("outside (exterior) [0, 0]", () => {
    expect(polygon.inside([0, 0])).toBe(false);
  });
});

describe("Polygon.inside — non-convex polygon", () => {
  const rings = [[[0, 0], [2, 2], [4, 0], [4, 4], [0, 4], [0, 0]]];
  const polygon = new Polygon(rings);

  for (const pt of [[1, 3], [3.9, 3.9], [2, 3.5]] as number[][]) {
    it(`inside ${JSON.stringify(pt)}`, () => {
      expect(polygon.inside(pt)).toBe(true);
    });
  }
  for (const pt of [[0.1, 0], [1, 0], [2, 0], [2, 1], [2, 1.9], [3, 0], [3.9, 0]] as number[][]) {
    it(`outside ${JSON.stringify(pt)}`, () => {
      expect(polygon.inside(pt)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Polygon.computeDistance
// ---------------------------------------------------------------------------

describe("Polygon.computeDistance", () => {
  const squareRings = [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]];

  it("center of square → 2.0", () => {
    const polygon = new Polygon(squareRings);
    expect(polygon.computeDistance([2, 2])).toBeCloseTo(2.0, 5);
  });

  it("points on boundary → 0.0", () => {
    const polygon = new Polygon(squareRings);
    for (const pt of [[0, 0], [2, 0], [4, 2], [2, 4], [0, 2]] as number[][]) {
      expect(polygon.computeDistance(pt)).toBeCloseTo(0.0, 5);
    }
  });

  it("point outside [5,5] → negative distance", () => {
    const polygon = new Polygon(squareRings);
    const d = polygon.computeDistance([5, 5]);
    expect(d).toBeCloseTo(-Math.sqrt(2), 3);
  });
});

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

describe("Cell", () => {
  it("constructs from square polygon", () => {
    const polygon = new Polygon([[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]);
    const cell = new Cell([2, 2], 1.0, polygon);
    expect(typeof cell.d).toBe("number");
    expect(typeof cell.p).toBe("number");
    expect(cell.c[0]).toBeCloseTo(2, 10);
    expect(cell.c[1]).toBeCloseTo(2, 10);
    expect(cell.h).toBe(1.0);
    // p = d + h * sqrt(2)
    expect(cell.p).toBeCloseTo(cell.d + cell.h * Math.SQRT2, 10);
  });

  it("comparison operators mirror Python's Cell comparisons", () => {
    const polygon = new Polygon([[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]);
    const center = [2, 2];
    const offset = [2.1, 2.1];
    const cell = new Cell(center, 1.0, polygon);
    const other = new Cell(offset, 1.0, polygon);

    expect(cell.lessThan(other)).toBe(cell.d < other.d);
    expect(cell.greaterThan(other)).toBe(cell.d > other.d);
    expect(cell.lessThanOrEqual(other)).toBe(cell.d <= other.d);
    expect(cell.greaterThanOrEqual(other)).toBe(cell.d >= other.d);
  });

  it("constructs with donut polygon", () => {
    const polygon = new Polygon([
      [[1, 1], [5, 1], [5, 5], [1, 5], [1, 1]],
      [[2, 2], [2, 4], [4, 4], [4, 2], [2, 2]],
    ]);
    const cell = new Cell([3, 1.5], 0.5, polygon);
    expect(typeof cell.d).toBe("number");
    expect(cell.c).toEqual([3, 1.5]);
    expect(cell.h).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// polylabel
// ---------------------------------------------------------------------------

describe("polylabel", () => {
  it("returns Cell instance", () => {
    const rings = [[[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0], [0, 0, 0]]];
    const result = polylabel(rings, 0.01);
    expect(result).toBeInstanceOf(Cell);
  });

  it("simple square → pole at [2, 2]", () => {
    const rings = [[[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0], [0, 0, 0]]];
    const result = polylabel(rings, 0.01);

    expect(result.h).toBeLessThanOrEqual(0.01);
    expect(result.d).toBeGreaterThanOrEqual(0);
    expect(result.c[0]).toBeCloseTo(2.0, 1);
    expect(result.c[1]).toBeCloseTo(2.0, 1);
  });

  it("donut polygon → pole in one of four corners of the annulus", () => {
    const rings = [
      [[1, 1, 0], [5, 1, 0], [5, 5, 0], [1, 5, 0], [1, 1, 0]],
      [[2, 2, 0], [2, 4, 0], [4, 4, 0], [4, 2, 0], [2, 2, 0]],
    ];
    const result = polylabel(rings, 0.01);

    expect(result.h).toBeLessThanOrEqual(0.01);
    expect(result.d).toBeGreaterThanOrEqual(0);

    const expectedCenters = [[1.5, 1.5], [1.5, 4.5], [4.5, 1.5], [4.5, 4.5]];
    const matchFound = expectedCenters.some(
      ec =>
        Math.abs(result.c[0] - ec[0]) <= 0.1 &&
        Math.abs(result.c[1] - ec[1]) <= 0.1,
    );
    expect(matchFound).toBe(true);
  });

  it("accepts 2-D rings (no z coordinate)", () => {
    const rings = [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]];
    const result = polylabel(rings, 0.01);
    expect(result.c[0]).toBeCloseTo(2.0, 1);
    expect(result.c[1]).toBeCloseTo(2.0, 1);
  });

  it("default precision is 0.01", () => {
    const rings = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
    const defaultResult = polylabel(rings);
    const explicitResult = polylabel(rings, 0.01);
    expect(defaultResult.h).toBeLessThanOrEqual(0.01);
    expect(explicitResult.h).toBeLessThanOrEqual(0.01);
  });
});
