import { describe, it, expect } from "vitest";
import {
  depth,
  matrixToShaderInput,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
  translationMatrix,
  xRotationMatrix,
  yRotationMatrix,
  zRotationMatrix,
  rotationMatrix,
  rotateInPlaceMatrix,
  scaleMatrix,
  viewMatrix,
} from "../../src/utils/opengl/index.js";
import { np } from "../../src/core/math/index.js";

// ─── Helpers ──────────────────────────────────────────────────

/** Flatten an NDArray of shape [4,4] into a plain number[] row-major. */
function flat(m: ReturnType<typeof translationMatrix>): number[] {
  return m.flatten().toArray() as number[];
}

/** Assert two number arrays are element-wise close. */
function expectClose(a: number[], b: number[], tol = 1e-9): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThan(tol);
  }
}

// ─── depth constant ───────────────────────────────────────────

describe("depth", () => {
  it("is 20", () => {
    expect(depth).toBe(20);
  });
});

// ─── translationMatrix ────────────────────────────────────────

describe("translationMatrix", () => {
  it("identity when all zeros", () => {
    const m = translationMatrix(0, 0, 0);
    const vals = flat(m);
    // row-major: 4x4 identity
    expect(vals[0]).toBe(1);
    expect(vals[5]).toBe(1);
    expect(vals[10]).toBe(1);
    expect(vals[15]).toBe(1);
    expect(vals[3]).toBe(0);
    expect(vals[7]).toBe(0);
    expect(vals[11]).toBe(0);
  });

  it("puts translation in last column", () => {
    const m = translationMatrix(1, 2, 3);
    const vals = flat(m);
    expect(vals[3]).toBeCloseTo(1);   // row 0, col 3
    expect(vals[7]).toBeCloseTo(2);   // row 1, col 3
    expect(vals[11]).toBeCloseTo(3);  // row 2, col 3
    expect(vals[15]).toBe(1);
  });
});

// ─── scaleMatrix ─────────────────────────────────────────────

describe("scaleMatrix", () => {
  it("identity when scale = 1", () => {
    const m = scaleMatrix(1);
    const vals = flat(m);
    expect(vals[0]).toBe(1);
    expect(vals[5]).toBe(1);
    expect(vals[10]).toBe(1);
    expect(vals[15]).toBe(1);
  });

  it("scales diagonal correctly", () => {
    const m = scaleMatrix(3);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(3);
    expect(vals[5]).toBeCloseTo(3);
    expect(vals[10]).toBeCloseTo(3);
    expect(vals[15]).toBe(1);
    // off-diagonal should be 0
    expect(vals[1]).toBe(0);
    expect(vals[4]).toBe(0);
  });
});

// ─── Rotation matrices ────────────────────────────────────────

describe("xRotationMatrix", () => {
  it("is identity at angle 0", () => {
    const m = xRotationMatrix(0);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(1);
    expect(vals[5]).toBeCloseTo(1);
    expect(vals[10]).toBeCloseTo(1);
  });

  it("rotates 90 degrees correctly", () => {
    const m = xRotationMatrix(Math.PI / 2);
    const vals = flat(m);
    // [1,0,0,0] [0,cos,-sin,0] [0,sin,cos,0] [0,0,0,1]
    expect(vals[5]).toBeCloseTo(0);   // cos(90°) = 0
    expect(vals[6]).toBeCloseTo(-1);  // -sin(90°) = -1
    expect(vals[9]).toBeCloseTo(1);   // sin(90°) = 1
    expect(vals[10]).toBeCloseTo(0);  // cos(90°) = 0
  });
});

describe("yRotationMatrix", () => {
  it("is identity at angle 0", () => {
    const m = yRotationMatrix(0);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(1);
    expect(vals[5]).toBeCloseTo(1);
    expect(vals[10]).toBeCloseTo(1);
  });
});

describe("zRotationMatrix", () => {
  it("is identity at angle 0", () => {
    const m = zRotationMatrix(0);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(1);
    expect(vals[5]).toBeCloseTo(1);
    expect(vals[10]).toBeCloseTo(1);
  });

  it("rotates 90 degrees correctly", () => {
    const m = zRotationMatrix(Math.PI / 2);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(0);   // cos(90°) = 0
    expect(vals[1]).toBeCloseTo(-1);  // -sin(90°) = -1
    expect(vals[4]).toBeCloseTo(1);   // sin(90°) = 1
    expect(vals[5]).toBeCloseTo(0);   // cos(90°) = 0
  });
});

// ─── rotationMatrix ───────────────────────────────────────────

describe("rotationMatrix", () => {
  it("is 4x4 identity when all angles are 0", () => {
    const m = rotationMatrix(0, 0, 0);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(1);
    expect(vals[5]).toBeCloseTo(1);
    expect(vals[10]).toBeCloseTo(1);
    expect(vals[15]).toBeCloseTo(1);
    expect(vals[1]).toBeCloseTo(0);
    expect(vals[4]).toBeCloseTo(0);
  });
});

// ─── matrixToShaderInput ──────────────────────────────────────

describe("matrixToShaderInput", () => {
  it("returns 16 elements", () => {
    const m = translationMatrix(1, 2, 3);
    const result = matrixToShaderInput(m);
    expect(result.length).toBe(16);
  });

  it("transposes column-major (translation ends up in elements 12-14)", () => {
    // column-major layout: translation is at indices 12, 13, 14
    const m = translationMatrix(5, 6, 7);
    const result = matrixToShaderInput(m);
    expect(result[12]).toBeCloseTo(5);
    expect(result[13]).toBeCloseTo(6);
    expect(result[14]).toBeCloseTo(7);
  });

  it("identity matrix stays identity after transpose+flatten", () => {
    const m = scaleMatrix(1);
    const result = matrixToShaderInput(m);
    // column-major identity: result[0,5,10,15] = 1, rest = 0
    expect(result[0]).toBeCloseTo(1);
    expect(result[5]).toBeCloseTo(1);
    expect(result[10]).toBeCloseTo(1);
    expect(result[15]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0);
    expect(result[4]).toBeCloseTo(0);
  });
});

// ─── orthographicProjectionMatrix ────────────────────────────

describe("orthographicProjectionMatrix", () => {
  it("returns 16 elements when format_=true", () => {
    const result = orthographicProjectionMatrix(10, 8, 1, 21, true);
    expect((result as number[]).length).toBe(16);
  });

  it("returns NDArray when format_=false", () => {
    const result = orthographicProjectionMatrix(10, 8, 1, 21, false) as ReturnType<typeof translationMatrix>;
    expect(result.shape).toEqual([4, 4]);
  });

  it("diagonal entries correct for explicit width/height", () => {
    const m = orthographicProjectionMatrix(10, 8, 1, 21, false) as ReturnType<typeof translationMatrix>;
    const vals = flat(m);
    // [0,0] = 2/width = 0.2
    expect(vals[0]).toBeCloseTo(2 / 10);
    // [1,1] = 2/height = 0.25
    expect(vals[5]).toBeCloseTo(2 / 8);
    // [3,3] = 1
    expect(vals[15]).toBeCloseTo(1);
  });
});

// ─── perspectiveProjectionMatrix ─────────────────────────────

describe("perspectiveProjectionMatrix", () => {
  it("returns 16 elements when format_=true", () => {
    const result = perspectiveProjectionMatrix(4, 3, 2, 50, true);
    expect((result as number[]).length).toBe(16);
  });

  it("[3,2] = -1 for perspective divide", () => {
    const m = perspectiveProjectionMatrix(4, 3, 2, 50, false) as ReturnType<typeof translationMatrix>;
    const vals = flat(m);
    // row 3, col 2 → index 14
    expect(vals[14]).toBeCloseTo(-1);
    // row 3, col 3 → index 15
    expect(vals[15]).toBeCloseTo(0);
  });
});

// ─── rotateInPlaceMatrix ──────────────────────────────────────

describe("rotateInPlaceMatrix", () => {
  it("is identity when all angles are 0", () => {
    const pos = np.array([1, 2, 3]);
    const m = rotateInPlaceMatrix(pos, 0, 0, 0);
    const vals = flat(m);
    expect(vals[0]).toBeCloseTo(1);
    expect(vals[5]).toBeCloseTo(1);
    expect(vals[10]).toBeCloseTo(1);
    expect(vals[15]).toBeCloseTo(1);
  });
});

// ─── viewMatrix ───────────────────────────────────────────────

describe("viewMatrix", () => {
  it("returns 16 elements", () => {
    const result = viewMatrix();
    expect(result.length).toBe(16);
  });

  it("accepts explicit translation", () => {
    const trans = np.array([0, 0, 11]);
    const result = viewMatrix(trans, 0, 0, 0);
    expect(result.length).toBe(16);
  });
});
