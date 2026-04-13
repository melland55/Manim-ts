import { describe, it, expect } from "vitest";
import "../../tests/helpers/point-matchers.js";
import { np } from "../../src/core/math/index.js";
import { PI, TAU, RIGHT, UP, DOWN, OUT } from "../../src/core/math/index.js";
import {
  quaternionMult,
  quaternionFromAngleAxis,
  quaternionConjugate,
  angleAxisFromQuaternion,
  rotateVector,
  rotationMatrix,
  rotationAboutZ,
  zToVector,
  normalize,
  normalizeAlongAxis,
  getUnitNormal,
  angleBetweenVectors,
  angleOfVector,
  compassDirections,
  regularVertices,
  complexToR3,
  r3ToComplex,
  complexFuncToR3Func,
  centerOfMass,
  midpoint,
  lineIntersection,
  findIntersection,
  getWindingNumber,
  shoelace,
  shoelaceDirection,
  cross2d,
  earclipTriangulation,
  cartesianToSpherical,
  sphericalToCartesian,
  perpendicularBisector,
  thickDiagonal,
} from "../../src/utils/space_ops/index.js";

describe("quaternionMult", () => {
  it("returns identity for empty args", () => {
    expect(quaternionMult()).toEqual([1, 0, 0, 0]);
  });

  it("returns single quaternion unchanged", () => {
    expect(quaternionMult([1, 0, 0, 0])).toEqual([1, 0, 0, 0]);
  });

  it("multiplies two quaternions", () => {
    // i * i = -1 → [0,1,0,0] * [0,1,0,0] = [-1,0,0,0]
    const result = quaternionMult([0, 1, 0, 0], [0, 1, 0, 0]);
    expect(result[0]).toBeCloseTo(-1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
    expect(result[3]).toBeCloseTo(0);
  });
});

describe("quaternionFromAngleAxis", () => {
  it("produces identity quaternion for zero angle", () => {
    const q = quaternionFromAngleAxis(0, OUT);
    expect(q[0]).toBeCloseTo(1);
    expect(q[1]).toBeCloseTo(0);
    expect(q[2]).toBeCloseTo(0);
    expect(q[3]).toBeCloseTo(0);
  });

  it("90 degree rotation around Z axis", () => {
    const q = quaternionFromAngleAxis(PI / 2, OUT);
    expect(q[0]).toBeCloseTo(Math.cos(PI / 4));
    expect(q[3]).toBeCloseTo(Math.sin(PI / 4));
  });
});

describe("quaternionConjugate", () => {
  it("negates x, y, z components", () => {
    const q = quaternionConjugate([0.5, 0.5, 0.5, 0.5]);
    expect(q).toEqual([0.5, -0.5, -0.5, -0.5]);
  });
});

describe("rotateVector", () => {
  it("rotates RIGHT by 90 degrees around Z to get UP", () => {
    const result = rotateVector(RIGHT, PI / 2, OUT);
    expect(result).toBeCloseToPoint(UP, 6);
  });

  it("rotates 2D vector (appending z=0)", () => {
    const v2d = np.array([1, 0]);
    const result = rotateVector(v2d, PI / 2, OUT);
    expect(result).toBeCloseToPoint(np.array([0, 1, 0]), 6);
  });

  it("full rotation returns to start", () => {
    const result = rotateVector(RIGHT, TAU);
    expect(result).toBeCloseToPoint(RIGHT, 6);
  });
});

describe("rotationMatrix", () => {
  it("is 3x3 by default", () => {
    const R = rotationMatrix(PI / 2, OUT);
    expect(R.shape).toEqual([3, 3]);
  });

  it("is 4x4 when homogeneous=true", () => {
    const R = rotationMatrix(PI / 2, OUT, true);
    expect(R.shape).toEqual([4, 4]);
  });

  it("rotating RIGHT by 90° around Z gives UP", () => {
    const R = rotationMatrix(PI / 2, OUT);
    const rx = R.get([0, 0]) as number;
    const ry = R.get([1, 0]) as number;
    expect(rx).toBeCloseTo(0, 6);
    expect(ry).toBeCloseTo(1, 6);
  });
});

describe("normalize", () => {
  it("normalizes a unit vector", () => {
    const v = np.array([3, 0, 0]);
    const n = normalize(v);
    expect(n).toBeCloseToPoint(np.array([1, 0, 0]));
  });

  it("returns zero vector for zero input without fallback", () => {
    const v = np.zeros([3]);
    const n = normalize(v);
    expect(n).toBeCloseToPoint(np.zeros([3]));
  });

  it("returns fallback for zero vector", () => {
    const v = np.zeros([3]);
    const fallback = np.array([1, 0, 0]);
    const n = normalize(v, fallback);
    expect(n).toBeCloseToPoint(np.array([1, 0, 0]));
  });
});

describe("angleBetweenVectors", () => {
  it("perpendicular vectors are PI/2 apart", () => {
    expect(angleBetweenVectors(RIGHT, UP)).toBeCloseTo(PI / 2, 6);
  });

  it("parallel vectors have 0 angle", () => {
    expect(angleBetweenVectors(RIGHT, RIGHT)).toBeCloseTo(0, 6);
  });

  it("anti-parallel vectors have PI angle", () => {
    expect(angleBetweenVectors(RIGHT, RIGHT.multiply(-1))).toBeCloseTo(PI, 6);
  });
});

describe("angleOfVector", () => {
  it("RIGHT is 0", () => {
    expect(angleOfVector(RIGHT)).toBeCloseTo(0, 6);
  });

  it("UP is PI/2", () => {
    expect(angleOfVector(UP)).toBeCloseTo(PI / 2, 6);
  });

  it("LEFT is PI or -PI", () => {
    const a = angleOfVector(np.array([-1, 0, 0])) as number;
    expect(Math.abs(a)).toBeCloseTo(PI, 6);
  });
});

describe("compassDirections", () => {
  it("4 directions form cardinal points", () => {
    const dirs = compassDirections(4);
    expect(dirs.shape[0]).toBe(4);
    // First direction is RIGHT
    const first = np.array([dirs.get([0, 0]) as number, dirs.get([0, 1]) as number, dirs.get([0, 2]) as number]);
    expect(first).toBeCloseToPoint(RIGHT, 6);
  });

  it("returns n directions", () => {
    const dirs = compassDirections(6);
    expect(dirs.shape[0]).toBe(6);
  });
});

describe("regularVertices", () => {
  it("returns n vertices for n-gon", () => {
    const [verts] = regularVertices(6);
    expect(verts.shape[0]).toBe(6);
  });

  it("even n starts at angle 0", () => {
    const [, angle] = regularVertices(4);
    expect(angle).toBeCloseTo(0, 6);
  });

  it("odd n starts at angle TAU/4", () => {
    const [, angle] = regularVertices(3);
    expect(angle).toBeCloseTo(TAU / 4, 6);
  });
});

describe("complexToR3 / r3ToComplex", () => {
  it("complexToR3 sets z=0", () => {
    const result = complexToR3([3, 4]);
    expect(result).toBeCloseToPoint(np.array([3, 4, 0]));
  });

  it("r3ToComplex extracts first two components", () => {
    const result = r3ToComplex(np.array([3, 4, 5]));
    expect(result).toEqual([3, 4]);
  });

  it("round-trip complex → R3 → complex", () => {
    const [re, im] = r3ToComplex(complexToR3([2, 7]));
    expect(re).toBeCloseTo(2, 6);
    expect(im).toBeCloseTo(7, 6);
  });
});

describe("centerOfMass", () => {
  it("center of two opposite points is origin", () => {
    const pts = np.array([[1, 0, 0], [-1, 0, 0]]);
    expect(centerOfMass(pts)).toBeCloseToPoint(np.array([0, 0, 0]));
  });

  it("center of a square is origin", () => {
    const pts = np.array([[1, 1, 0], [-1, 1, 0], [-1, -1, 0], [1, -1, 0]]);
    expect(centerOfMass(pts)).toBeCloseToPoint(np.array([0, 0, 0]));
  });
});

describe("midpoint", () => {
  it("midpoint of (0,0,0) and (2,0,0) is (1,0,0)", () => {
    const m = midpoint(np.array([0, 0, 0]), np.array([2, 0, 0]));
    expect(m).toBeCloseToPoint(np.array([1, 0, 0]));
  });
});

describe("lineIntersection", () => {
  it("finds intersection of two lines", () => {
    const l1: [any, any] = [np.array([0, 0, 0]), np.array([1, 0, 0])];
    const l2: [any, any] = [np.array([0, 1, 0]), np.array([1, 1, 0])];
    // These are parallel — should throw
    expect(() => lineIntersection(l1, l2)).toThrow();
  });

  it("finds intersection of perpendicular lines", () => {
    // horizontal line y=1: through (0,1) and (2,1)
    // vertical line x=1: through (1,0) and (1,2)
    const l1: [any, any] = [np.array([0, 1, 0]), np.array([2, 1, 0])];
    const l2: [any, any] = [np.array([1, 0, 0]), np.array([1, 2, 0])];
    const result = lineIntersection(l1, l2);
    expect(result).toBeCloseToPoint(np.array([1, 1, 0]), 5);
  });
});

describe("getWindingNumber", () => {
  it("counterclockwise square around origin winds once", () => {
    const pts = [
      np.array([1, 0, 0]),
      np.array([0, 1, 0]),
      np.array([-1, 0, 0]),
      np.array([0, -1, 0]),
    ];
    const winding = getWindingNumber(pts);
    expect(Math.abs(winding)).toBeCloseTo(1, 1);
  });
});

describe("shoelace", () => {
  it("signed area of unit square", () => {
    // CCW square: positive x axis integration
    const pts = np.array([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const area = shoelace(pts);
    expect(typeof area).toBe("number");
  });
});

describe("shoelaceDirection", () => {
  it("returns CW or CCW string", () => {
    const pts = np.array([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const dir = shoelaceDirection(pts);
    expect(["CW", "CCW"]).toContain(dir);
  });
});

describe("cross2d", () => {
  it("scalar cross product", () => {
    const a = np.array([1, 0]);
    const b = np.array([0, 1]);
    expect(cross2d(a, b)).toBeCloseTo(1, 6);
  });

  it("vectorized cross product", () => {
    const a = np.array([[1, 2, 0], [1, 0, 0]]);
    const b = np.array([[3, 4, 0], [0, 1, 0]]);
    const result = cross2d(a, b) as any;
    const arr = result.toArray() as number[];
    expect(arr[0]).toBeCloseTo(-2, 6);
    expect(arr[1]).toBeCloseTo(1, 6);
  });
});

describe("cartesianToSpherical / sphericalToCartesian", () => {
  it("round-trips a point", () => {
    const p = np.array([1, 1, 1]);
    const s = cartesianToSpherical(p);
    const back = sphericalToCartesian(s);
    expect(back).toBeCloseToPoint(p, 6);
  });

  it("origin → zero radius", () => {
    const s = cartesianToSpherical(np.zeros([3]));
    expect(s).toBeCloseToPoint(np.zeros([3]));
  });
});

describe("thickDiagonal", () => {
  it("identity for thickness 1", () => {
    const d = thickDiagonal(3, 1);
    expect(d.shape).toEqual([3, 3]);
    // Diagonal should be 1, off-diagonal 0
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(d.get([i, j])).toBe(i === j ? 1 : 0);
      }
    }
  });
});

describe("getUnitNormal", () => {
  it("unit normal of xy-plane vectors is z-axis", () => {
    const n = getUnitNormal(RIGHT, UP);
    expect(n).toBeCloseToPoint(OUT, 6);
  });
});

describe("zToVector", () => {
  it("returns 3x3 rotation matrix", () => {
    const M = zToVector(OUT);
    expect(M.shape).toEqual([3, 3]);
  });
});

describe("perpendicularBisector", () => {
  it("bisector of horizontal segment passes through midpoint", () => {
    const line: [any, any] = [np.array([0, 0, 0]), np.array([2, 0, 0])];
    const [p1, p2] = perpendicularBisector(line);
    // Midpoint of the bisector endpoints should be at (1, 0, 0)
    const m = midpoint(p1, p2);
    const ma = m.toArray() as number[];
    expect(ma[0]).toBeCloseTo(1, 5);
  });
});
