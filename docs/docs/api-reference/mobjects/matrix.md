---
title: "Matrix"
sidebar_position: 10
---

# Matrix

The matrix module provides mobjects for displaying matrices with bracket notation. Useful for linear algebra visualizations.

## Matrix

Displays a matrix with brackets. Each element is rendered as a `MathTex` mobject by default.

```ts
import { Matrix } from "manim-ts/mobjects/matrix";
```

### MatrixOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `matrix` | `(string \| number)[][]` | (required) | 2D array of entries |
| `vBuff` | `number` | `0.8` | Vertical spacing between rows |
| `hBuff` | `number` | `1.3` | Horizontal spacing between columns |
| `bracketHBuff` | `number` | `0.25` | Horizontal gap between brackets and content |
| `bracketVBuff` | `number` | `0.25` | Vertical gap between brackets and content |
| `leftBracket` | `string` | `"["` | Left bracket character |
| `rightBracket` | `string` | `"]"` | Right bracket character |
| `elementToMobject` | `(element: any) => IMobject` | auto | Function to convert raw entries to mobjects |
| `elementToMobjectConfig` | `Record<string, any>` | `{}` | Options passed to the element-to-mobject function |
| `elementAlignment` | `Point3D` | `ORIGIN` | Alignment of elements within their cells |

```ts
const matrix = new Matrix({
  matrix: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
});
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getEntries()` | `() => VGroup` | Returns all entry mobjects as a VGroup |
| `getRows()` | `() => VGroup[]` | Returns entries grouped by row |
| `getColumns()` | `() => VGroup[]` | Returns entries grouped by column |
| `getBrackets()` | `() => VGroup` | Returns the left and right bracket mobjects |
| `getEntry()` | `(row: number, col: number) => IMobject` | Returns a specific entry (0-indexed) |
| `setColumnColors()` | `(...colors: ManimColor[]) => this` | Sets a different color for each column |
| `setRowColors()` | `(...colors: ManimColor[]) => this` | Sets a different color for each row |
| `addBackgroundToEntries()` | `(options?: BackgroundOptions) => this` | Adds background rectangles behind entries |

---

## DecimalMatrix

A `Matrix` where entries are displayed as `DecimalNumber` mobjects with configurable decimal places.

```ts
import { DecimalMatrix } from "manim-ts/mobjects/matrix";

const mat = new DecimalMatrix({
  matrix: [
    [1.234, 5.678],
    [9.012, 3.456],
  ],
  numDecimalPlaces: 2,
});
```

### Additional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `numDecimalPlaces` | `number` | `1` | Number of decimal places |

---

## IntegerMatrix

A `Matrix` where entries are displayed as `Integer` mobjects (no decimal places).

```ts
import { IntegerMatrix } from "manim-ts/mobjects/matrix";

const mat = new IntegerMatrix({
  matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
});
```

---

## MobjectMatrix

A `Matrix` where entries are arbitrary pre-built mobjects rather than numbers or strings.

```ts
import { MobjectMatrix } from "manim-ts/mobjects/matrix";

const mat = new MobjectMatrix({
  matrix: [
    [new Circle({ radius: 0.2, color: RED }), new Square({ sideLength: 0.3 })],
    [new Triangle({ color: GREEN }), new Dot()],
  ],
});
```

---

## Helper Functions

### matrixToTexString

Converts a 2D number/string array to a LaTeX matrix string.

```ts
import { matrixToTexString } from "manim-ts/mobjects/matrix";

const tex = matrixToTexString([[1, 2], [3, 4]]);
// Returns: "\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}"
```

### matrixToMobject

Converts a 2D array into a `Matrix` mobject directly.

```ts
import { matrixToMobject } from "manim-ts/mobjects/matrix";

const mob = matrixToMobject([[1, 0], [0, 1]]);
```

### getDetText

Creates a determinant notation mobject for a given matrix.

```ts
import { getDetText } from "manim-ts/mobjects/matrix";

const matrix = new Matrix({ matrix: [[1, 2], [3, 4]] });
const detText = getDetText(matrix, { determinant: -2 });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `determinant` | `number \| null` | `null` | If provided, displays `= <value>` after the determinant bars |
| `background` | `ManimColor \| null` | `null` | Background color for the determinant display |
| `initialScaleFactor` | `number` | `2` | Scale factor for the determinant text |

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class MatrixExample(Scene):
    def construct(self):
        matrix = Matrix(
            [[1, 2], [3, 4]],
            left_bracket="(",
            right_bracket=")",
        )
        matrix.set_column_colors(RED, BLUE)

        entries = matrix.get_entries()
        det = get_det_text(matrix, determinant=-2)

        int_matrix = IntegerMatrix(
            [[1, 0], [0, 1]],
            h_buff=1.5,
        )
```

```ts
// TypeScript manim-ts
import { Matrix, IntegerMatrix, getDetText } from "manim-ts/mobjects/matrix";
import { RED, BLUE } from "manim-ts/core";

class MatrixExample extends Scene {
  construct() {
    const matrix = new Matrix({
      matrix: [[1, 2], [3, 4]],
      leftBracket: "(",
      rightBracket: ")",
    });
    matrix.setColumnColors(RED, BLUE);

    const entries = matrix.getEntries();
    const det = getDetText(matrix, { determinant: -2 });

    const intMatrix = new IntegerMatrix({
      matrix: [[1, 0], [0, 1]],
      hBuff: 1.5,
    });
  }
}
```

### Key Differences

- **Positional to named args**: `Matrix([[1,2],[3,4]])` becomes `new Matrix({ matrix: [[1,2],[3,4]] })`.
- **`snake_case` to `camelCase`**: `left_bracket` becomes `leftBracket`, `h_buff` becomes `hBuff`, etc.
- **Helper functions**: `get_det_text(matrix, determinant=-2)` becomes `getDetText(matrix, { determinant: -2 })`.
- **0-indexed entries**: `getEntry(row, col)` uses 0-based indexing.
