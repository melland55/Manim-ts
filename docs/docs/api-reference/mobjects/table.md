---
title: "Table"
sidebar_position: 9
---

# Table

The table module provides grid-based layouts for displaying structured data as mobjects. Tables support custom entries, row/column highlighting, and animated cell access.

## Table

The base table class. Arranges a 2D grid of mobjects with optional row labels, column labels, and surrounding lines.

```ts
import { Table } from "manim-ts/mobjects/table";
```

### TableOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `table` | `IMobject[][]` | (required) | 2D array of mobjects arranged as `[row][col]` |
| `rowLabels` | `IMobject[]` | `undefined` | Optional labels for each row |
| `colLabels` | `IMobject[]` | `undefined` | Optional labels for each column |
| `topLeftEntry` | `IMobject` | `undefined` | Mobject placed in the top-left corner (when both row and column labels are present) |
| `includeOuterLines` | `boolean` | `false` | Whether to draw border lines around the entire table |
| `vBuff` | `number` | `0.8` | Vertical spacing between cells |
| `hBuff` | `number` | `1.3` | Horizontal spacing between cells |
| `lineConfig` | `Partial<LineOptions>` | `{}` | Style options for the grid lines |
| `elementToMobject` | `(element: any) => IMobject` | `identity` | Function to convert raw entries to mobjects |

```ts
const table = new Table({
  table: [
    [new MathTex({ texStrings: ["x"] }), new MathTex({ texStrings: ["x^2"] })],
    [new MathTex({ texStrings: ["1"] }), new MathTex({ texStrings: ["1"] })],
    [new MathTex({ texStrings: ["2"] }), new MathTex({ texStrings: ["4"] })],
    [new MathTex({ texStrings: ["3"] }), new MathTex({ texStrings: ["9"] })],
  ],
  colLabels: [
    new Text({ text: "Input" }),
    new Text({ text: "Output" }),
  ],
  includeOuterLines: true,
});
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getEntries()` | `(pos?: [number, number]) => VGroup \| IMobject` | Returns all entries or a specific entry at `[row, col]` (1-indexed) |
| `getRows()` | `() => VGroup[]` | Returns entries grouped by row |
| `getColumns()` | `() => VGroup[]` | Returns entries grouped by column |
| `getCell()` | `(pos: [number, number]) => VMobject` | Returns the background cell rectangle at `[row, col]` |
| `getHorizontalLines()` | `() => VGroup` | Returns all horizontal grid lines |
| `getVerticalLines()` | `() => VGroup` | Returns all vertical grid lines |
| `addHighlightedCell()` | `(pos: [number, number], options?: HighlightOptions) => this` | Highlights a cell with a colored background |
| `getRowLabels()` | `() => VGroup` | Returns the row label mobjects |
| `getColLabels()` | `() => VGroup` | Returns the column label mobjects |
| `getLabels()` | `() => VGroup` | Returns all labels (row + column) |

---

## MathTable

A `Table` where entries are automatically wrapped in `MathTex`.

```ts
import { MathTable } from "manim-ts/mobjects/table";

const mathTable = new MathTable({
  table: [
    ["x", "f(x)"],
    ["0", "1"],
    ["\\pi", "-1"],
    ["2\\pi", "1"],
  ],
  includeOuterLines: true,
});
```

Entries are strings that get converted via `new MathTex({ texStrings: [entry] })`.

---

## MobjectTable

A table with arbitrary mobjects. Functionally identical to `Table` but makes the intent clearer in code.

```ts
import { MobjectTable } from "manim-ts/mobjects/table";

const mobTable = new MobjectTable({
  table: [
    [new Circle({ radius: 0.3, color: RED }), new Square({ sideLength: 0.5, color: BLUE })],
    [new Triangle({ color: GREEN }), new Dot({ color: YELLOW })],
  ],
});
```

---

## IntegerTable

A table where all entries are integers, automatically wrapped in `Integer` mobjects.

```ts
import { IntegerTable } from "manim-ts/mobjects/table";

const intTable = new IntegerTable({
  table: [
    [1, 4, 9],
    [16, 25, 36],
    [49, 64, 81],
  ],
  colLabels: [
    new MathTex({ texStrings: ["n=1"] }),
    new MathTex({ texStrings: ["n=2"] }),
    new MathTex({ texStrings: ["n=3"] }),
  ],
});
```

---

## DecimalTable

A table where all entries are decimal numbers, automatically wrapped in `DecimalNumber` mobjects.

```ts
import { DecimalTable } from "manim-ts/mobjects/table";

const decTable = new DecimalTable({
  table: [
    [3.14, 2.72, 1.62],
    [1.41, 1.73, 2.24],
  ],
  numDecimalPlaces: 2,
});
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class TableExample(Scene):
    def construct(self):
        table = MathTable(
            [["x", "f(x)"],
             ["0", "1"],
             ["\\pi", "-1"]],
            include_outer_lines=True,
        )
        table.add_highlighted_cell((2, 1), color=GREEN)

        entry = table.get_entries((2, 2))
        rows = table.get_rows()

        int_table = IntegerTable(
            [[1, 2, 3],
             [4, 5, 6]],
            col_labels=[Text("A"), Text("B"), Text("C")],
        )
```

```ts
// TypeScript manim-ts
import { MathTable, IntegerTable } from "manim-ts/mobjects/table";
import { Text } from "manim-ts/mobjects/text";
import { GREEN } from "manim-ts/core";

class TableExample extends Scene {
  construct() {
    const table = new MathTable({
      table: [
        ["x", "f(x)"],
        ["0", "1"],
        ["\\pi", "-1"],
      ],
      includeOuterLines: true,
    });
    table.addHighlightedCell([2, 1], { color: GREEN });

    const entry = table.getEntries([2, 2]);
    const rows = table.getRows();

    const intTable = new IntegerTable({
      table: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      colLabels: [
        new Text({ text: "A" }),
        new Text({ text: "B" }),
        new Text({ text: "C" }),
      ],
    });
  }
}
```

### Key Differences

- **Tuple to array**: Cell positions `(2, 1)` become `[2, 1]`.
- **`snake_case` to `camelCase`**: `include_outer_lines` becomes `includeOuterLines`, `col_labels` becomes `colLabels`.
- **String entries**: `MathTable` accepts raw string arrays in both Python and TypeScript; conversion to `MathTex` is automatic.
- **1-indexed positions**: Cell positions remain 1-indexed as in Python Manim.
