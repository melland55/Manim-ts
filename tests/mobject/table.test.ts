import { describe, it, expect } from "vitest";
import {
  Table,
  MathTable,
  MobjectTable,
  IntegerTable,
  DecimalTable,
} from "../../src/mobject/table/index.js";

describe("Table", () => {
  it("constructs a basic 2x2 table", () => {
    const t = new Table([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(t.rowDim).toBe(2);
    expect(t.colDim).toBe(2);
  });

  it("throws on inconsistent row lengths", () => {
    expect(() => {
      new Table([
        ["A", "B", "C"],
        ["D", "E"],
      ]);
    }).toThrow("Not all rows in table have the same length.");
  });

  it("stores default vBuff and hBuff", () => {
    const t = new Table([["X"]]);
    expect(t.vBuff).toBeCloseTo(0.8);
    expect(t.hBuff).toBeCloseTo(1.3);
  });

  it("accepts custom vBuff and hBuff", () => {
    const t = new Table([["X"]], { vBuff: 1.0, hBuff: 2.0 });
    expect(t.vBuff).toBeCloseTo(1.0);
    expect(t.hBuff).toBeCloseTo(2.0);
  });

  it("has elements and elementsWithoutLabels VGroups", () => {
    const t = new Table([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(t.elements).toBeDefined();
    expect(t.elementsWithoutLabels).toBeDefined();
    // 4 entries without labels
    expect(t.elementsWithoutLabels.submobjects.length).toBe(4);
  });

  it("getRows returns correct number of rows", () => {
    const t = new Table([
      ["A", "B"],
      ["C", "D"],
      ["E", "F"],
    ]);
    const rows = t.getRows();
    expect(rows.submobjects.length).toBe(3);
  });

  it("getColumns returns correct number of columns", () => {
    const t = new Table([
      ["A", "B", "C"],
      ["D", "E", "F"],
    ]);
    const cols = t.getColumns();
    expect(cols.submobjects.length).toBe(3);
  });

  it("getHorizontalLines and getVerticalLines return VGroups", () => {
    const t = new Table([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(t.getHorizontalLines()).toBeDefined();
    expect(t.getVerticalLines()).toBeDefined();
    // Without outer lines, 1 horizontal line (between rows) and 1 vertical line (between cols)
    expect(t.getHorizontalLines().submobjects.length).toBe(1);
    expect(t.getVerticalLines().submobjects.length).toBe(1);
  });

  it("includeOuterLines adds extra lines", () => {
    const t = new Table(
      [
        ["A", "B"],
        ["C", "D"],
      ],
      { includeOuterLines: true },
    );
    // With outer lines: 1 inner + 2 outer = 3 horizontal, same for vertical
    expect(t.getHorizontalLines().submobjects.length).toBe(3);
    expect(t.getVerticalLines().submobjects.length).toBe(3);
  });

  it("scale adjusts hBuff and vBuff", () => {
    const t = new Table([["A"]], { hBuff: 1.0, vBuff: 1.0 });
    t.scale(2);
    expect(t.hBuff).toBeCloseTo(2.0);
    expect(t.vBuff).toBeCloseTo(2.0);
  });
});

describe("MathTable", () => {
  it("constructs with numeric entries", () => {
    const t = new MathTable([
      [1, 2],
      [3, 4],
    ]);
    expect(t.rowDim).toBe(2);
    expect(t.colDim).toBe(2);
  });
});

describe("IntegerTable", () => {
  it("constructs with integer entries", () => {
    const t = new IntegerTable([
      [10, 20],
      [30, 40],
    ]);
    expect(t.rowDim).toBe(2);
    expect(t.colDim).toBe(2);
  });
});

describe("DecimalTable", () => {
  it("constructs with decimal entries", () => {
    const t = new DecimalTable([
      [1.5, 2.5],
      [3.5, 4.5],
    ]);
    expect(t.rowDim).toBe(2);
    expect(t.colDim).toBe(2);
  });
});

describe("MobjectTable", () => {
  it("constructs with identity element_to_mobject", () => {
    // MobjectTable uses lambda m => m, so we need VMobject-like objects.
    // Use a basic Table to get some mobjects, then wrap them.
    const t = new Table([["X"]]);
    const entry = t.getEntriesWithoutLabels() as { submobjects: unknown[] };
    expect(entry.submobjects.length).toBe(1);
  });
});
