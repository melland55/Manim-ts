import { describe, it, expect } from "vitest";
import {
  Matrix,
  DecimalMatrix,
  IntegerMatrix,
  MobjectMatrix,
  matrixToTexString,
  matrixToMobject,
  getDetText,
} from "../../src/mobject/matrix/index.js";

describe("matrixToTexString", () => {
  it("converts a 2x2 number matrix to TeX", () => {
    const tex = matrixToTexString([[1, 2], [3, 4]]);
    expect(tex).toContain("\\left[");
    expect(tex).toContain("\\right]");
    expect(tex).toContain("1 & 2");
    expect(tex).toContain("3 & 4");
    expect(tex).toContain("\\begin{array}{cc}");
  });

  it("handles a 1-column matrix (column vector)", () => {
    const tex = matrixToTexString([[1], [2], [3]]);
    expect(tex).toContain("\\begin{array}{c}");
    expect(tex).toContain("1");
    expect(tex).toContain("2");
    expect(tex).toContain("3");
  });

  it("handles string entries", () => {
    const tex = matrixToTexString([["\\pi", "0"], ["-1", "1"]]);
    expect(tex).toContain("\\pi & 0");
    expect(tex).toContain("-1 & 1");
  });
});

describe("Matrix", () => {
  it("constructs with default options", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    expect(m).toBeInstanceOf(Matrix);
    expect(m.vBuff).toBe(0.8);
    expect(m.hBuff).toBe(1.3);
    expect(m.leftBracket).toBe("[");
    expect(m.rightBracket).toBe("]");
    expect(m.stretchBrackets).toBe(true);
  });

  it("stores the mob matrix with correct dimensions", () => {
    const m = new Matrix([[1, 2, 3], [4, 5, 6]]);
    const mobMatrix = m.getMobMatrix();
    expect(mobMatrix.length).toBe(2);
    expect(mobMatrix[0].length).toBe(3);
    expect(mobMatrix[1].length).toBe(3);
  });

  it("getEntries returns all elements", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const entries = m.getEntries();
    expect(entries.submobjects.length).toBe(4);
  });

  it("getRows returns VGroups for each row", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const rows = m.getRows();
    expect(rows.submobjects.length).toBe(2);
  });

  it("getColumns returns VGroups for each column", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const cols = m.getColumns();
    expect(cols.submobjects.length).toBe(2);
  });

  it("getBrackets returns two bracket mobjects", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const brackets = m.getBrackets();
    expect(brackets.submobjects.length).toBe(2);
  });

  it("supports custom bracket types", () => {
    const m = new Matrix([[1, 2], [3, 4]], {
      leftBracket: "(",
      rightBracket: ")",
    });
    expect(m.leftBracket).toBe("(");
    expect(m.rightBracket).toBe(")");
  });

  it("setColumnColors returns this for chaining", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const result = m.setColumnColors("#FF0000", "#00FF00");
    expect(result).toBe(m);
  });

  it("setRowColors returns this for chaining", () => {
    const m = new Matrix([[1, 2], [3, 4]]);
    const result = m.setRowColors("#FF0000", "#00FF00");
    expect(result).toBe(m);
  });

  it("handles single-element matrix", () => {
    const m = new Matrix([[42]]);
    const mobMatrix = m.getMobMatrix();
    expect(mobMatrix.length).toBe(1);
    expect(mobMatrix[0].length).toBe(1);
    expect(m.getEntries().submobjects.length).toBe(1);
  });
});

describe("DecimalMatrix", () => {
  it("constructs with decimal number entries", () => {
    const m = new DecimalMatrix([[3.456, 2.122], [33.2244, 12]]);
    expect(m).toBeInstanceOf(DecimalMatrix);
    expect(m).toBeInstanceOf(Matrix);
    expect(m.getEntries().submobjects.length).toBe(4);
  });
});

describe("IntegerMatrix", () => {
  it("constructs with integer entries", () => {
    const m = new IntegerMatrix([[1.5, 0], [12, -1.3]]);
    expect(m).toBeInstanceOf(IntegerMatrix);
    expect(m).toBeInstanceOf(Matrix);
    expect(m.getEntries().submobjects.length).toBe(4);
  });
});

describe("MobjectMatrix", () => {
  it("constructs with pre-built mobject entries", () => {
    // Use simple Mobject-derived stubs as entries
    const m = new Matrix([[1, 2]]);
    const entries = m.getMobMatrix();
    // Pass existing mobjects into MobjectMatrix
    const mm = new MobjectMatrix([entries[0]]);
    expect(mm).toBeInstanceOf(MobjectMatrix);
    expect(mm).toBeInstanceOf(Matrix);
  });
});

describe("getDetText", () => {
  it("creates a VGroup with parentheses and det label", () => {
    const m = new Matrix([[2, 0], [-1, 1]]);
    const detText = getDetText(m);
    // Should have at least 3 submobjects: det, (, )
    expect(detText.submobjects.length).toBeGreaterThanOrEqual(3);
  });

  it("includes determinant value when provided", () => {
    const m = new Matrix([[2, 0], [-1, 1]]);
    const detText = getDetText(m, { determinant: 3 });
    // Should have 5 submobjects: det, (, ), =, result
    expect(detText.submobjects.length).toBe(5);
  });

  it("accepts string determinant value", () => {
    const m = new Matrix([[2, 0], [-1, 1]]);
    const detText = getDetText(m, { determinant: "ad-bc" });
    expect(detText.submobjects.length).toBe(5);
  });
});
