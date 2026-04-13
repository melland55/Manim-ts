import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import {
  straightPath,
  pathAlongArc,
  clockwisePath,
  counterclockwisePath,
  spiralPath,
  pathAlongCircles,
} from "../../src/utils/paths/index.js";
import type { Points3D } from "../../src/core/math/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Points3D [n,3] from a plain array of [x,y,z] triples. */
function pts(...rows: [number, number, number][]): Points3D {
  return np.array(rows) as Points3D;
}

/** Check that two Points3D arrays are approximately equal element-wise. */
function expectPointsClose(actual: Points3D, expected: Points3D, eps = 1e-6): void {
  expect(np.allclose(actual, expected, undefined, eps)).toBe(true);
}

// ─── straightPath ─────────────────────────────────────────────────────────────

describe("straightPath", () => {
  it("at alpha=0 returns start points", () => {
    const fn = straightPath();
    const start = pts([0, 0, 0], [1, 0, 0]);
    const end = pts([2, 3, 0], [4, 5, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const fn = straightPath();
    const start = pts([0, 0, 0], [1, 0, 0]);
    const end = pts([2, 3, 0], [4, 5, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });

  it("at alpha=0.5 returns midpoints", () => {
    const fn = straightPath();
    const start = pts([0, 0, 0]);
    const end = pts([2, 4, 6]);
    const mid = fn(start, end, 0.5);
    expectPointsClose(mid, pts([1, 2, 3]));
  });

  it("handles single-point arrays", () => {
    const fn = straightPath();
    const start = pts([1, 2, 3]);
    const end = pts([3, 4, 5]);
    const result = fn(start, end, 0.25);
    expectPointsClose(result, pts([1.5, 2.5, 3.5]));
  });
});

// ─── pathAlongArc ─────────────────────────────────────────────────────────────

describe("pathAlongArc", () => {
  it("falls back to straight path for near-zero angle", () => {
    const arcFn = pathAlongArc(0.001);
    const straightFn = straightPath();
    const start = pts([0, 0, 0]);
    const end = pts([1, 0, 0]);
    expectPointsClose(arcFn(start, end, 0.5), straightFn(start, end, 0.5));
  });

  it("at alpha=0 returns start points", () => {
    const fn = pathAlongArc(Math.PI / 2);
    const start = pts([0, 0, 0]);
    const end = pts([2, 0, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const fn = pathAlongArc(Math.PI / 2);
    const start = pts([0, 0, 0]);
    const end = pts([2, 0, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });

  it("midpoint of arc is off the straight line (true arc motion)", () => {
    const fn = pathAlongArc(Math.PI);
    const start = pts([-1, 0, 0]);
    const end = pts([1, 0, 0]);
    const mid = fn(start, end, 0.5);
    // With arc_angle=PI the midpoint should be on the arc, not at origin
    const midArr = mid.row(0).toArray() as number[];
    // The midpoint x should be close to 0, y should be non-zero
    expect(Math.abs(midArr[0])).toBeLessThan(1e-5);
    expect(Math.abs(midArr[1])).toBeGreaterThan(0.5);
  });
});

// ─── clockwisePath / counterclockwisePath ─────────────────────────────────────

describe("clockwisePath", () => {
  it("at alpha=0 returns start points", () => {
    const fn = clockwisePath();
    const start = pts([0, 1, 0]);
    const end = pts([0, -1, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const fn = clockwisePath();
    const start = pts([0, 1, 0]);
    const end = pts([0, -1, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });
});

describe("counterclockwisePath", () => {
  it("at alpha=0 returns start points", () => {
    const fn = counterclockwisePath();
    const start = pts([0, 1, 0]);
    const end = pts([0, -1, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const fn = counterclockwisePath();
    const start = pts([0, 1, 0]);
    const end = pts([0, -1, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });

  it("clockwise and counterclockwise take opposite routes at alpha=0.5", () => {
    const cwFn = clockwisePath();
    const ccwFn = counterclockwisePath();
    const start = pts([-1, 0, 0]);
    const end = pts([1, 0, 0]);
    const cwMid = cwFn(start, end, 0.5);
    const ccwMid = ccwFn(start, end, 0.5);
    const cwArr = cwMid.row(0).toArray() as number[];
    const ccwArr = ccwMid.row(0).toArray() as number[];
    // They should be mirror images (opposite y)
    expect(cwArr[0]).toBeCloseTo(ccwArr[0], 5);
    expect(cwArr[1]).toBeCloseTo(-ccwArr[1], 5);
  });
});

// ─── spiralPath ───────────────────────────────────────────────────────────────

describe("spiralPath", () => {
  it("falls back to straight path for near-zero angle", () => {
    const spiralFn = spiralPath(0.001);
    const straightFn = straightPath();
    const start = pts([0, 0, 0]);
    const end = pts([1, 0, 0]);
    expectPointsClose(spiralFn(start, end, 0.5), straightFn(start, end, 0.5));
  });

  it("at alpha=0 returns start points", () => {
    const fn = spiralPath(Math.PI * 2);
    const start = pts([1, 0, 0]);
    const end = pts([0, 1, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const fn = spiralPath(Math.PI * 2);
    const start = pts([1, 0, 0]);
    const end = pts([0, 1, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });
});

// ─── pathAlongCircles ─────────────────────────────────────────────────────────

describe("pathAlongCircles", () => {
  it("at alpha=0 returns start points", () => {
    const center = np.array([0, 0, 0]);
    const fn = pathAlongCircles(Math.PI, center);
    const start = pts([1, 0, 0]);
    const end = pts([-1, 0, 0]);
    expectPointsClose(fn(start, end, 0), start);
  });

  it("at alpha=1 returns end points", () => {
    const center = np.array([0, 0, 0]);
    const fn = pathAlongCircles(Math.PI, center);
    const start = pts([1, 0, 0]);
    const end = pts([-1, 0, 0]);
    expectPointsClose(fn(start, end, 1), end);
  });
});
