---
title: "Text & LaTeX"
sidebar_position: 6
---

# Text & LaTeX

The text modules provide classes for rendering text, LaTeX mathematics, syntax-highlighted code, and animated numeric displays. These all produce VMobjects that can be positioned, animated, and styled like any other manim-ts object.

## Text

Renders plain text as a VMobject. Internally converts text to SVG path data for vector rendering.

```ts
import { Text } from "manim-ts/mobjects/text";
```

### TextOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `text` | `string` | (required) | The text content to render |
| `font` | `string` | `"sans-serif"` | Font family name |
| `fontSize` | `number` | `48` | Font size in points |
| `color` | `ManimColor` | `WHITE` | Text color |
| `weight` | `string` | `"normal"` | Font weight (`"normal"`, `"bold"`, etc.) |
| `slant` | `string` | `"normal"` | Font slant (`"normal"`, `"italic"`, `"oblique"`) |
| `lineSpacing` | `number` | `-1` | Line spacing (-1 = auto) |
| `tabWidth` | `number` | `4` | Number of spaces per tab |

```ts
const label = new Text({ text: "Hello, manim-ts!", fontSize: 72, color: YELLOW });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `charAt()` | `(index: number) => VMobject` | Returns the VMobject for a single character |

---

## Tex

Renders LaTeX strings as VMobjects using **KaTeX** (replaces Python Manim's pdflatex/dvisvgm pipeline).

```ts
import { Tex } from "manim-ts/mobjects/text";
```

### TexOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `texString` | `string` | (required) | LaTeX source string |
| `color` | `ManimColor` | `WHITE` | Text color |
| `fontSize` | `number` | `48` | Font size |

```ts
const formula = new Tex({ texString: "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}" });
```

---

## MathTex

A convenience wrapper around `Tex` that automatically wraps content in math mode. Supports multiple string parts for targeted sub-expression animation.

```ts
import { MathTex } from "manim-ts/mobjects/text";
```

### MathTexOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `texStrings` | `string[]` | (required) | Array of LaTeX strings (each becomes a submobject) |
| `color` | `ManimColor` | `WHITE` | Text color |

```ts
const equation = new MathTex({
  texStrings: ["a^2", "+", "b^2", "=", "c^2"],
  color: WHITE,
});
// Each part is a separate submobject for individual animation
equation.getSubmobject(0).setColor(RED);   // "a^2" in red
equation.getSubmobject(4).setColor(BLUE);  // "c^2" in blue
```

---

## Code

Renders syntax-highlighted code blocks using **highlight.js** (replaces Python Manim's Pygments).

```ts
import { Code } from "manim-ts/mobjects/text";
```

### CodeOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `code` | `string` | (required) | Source code string |
| `language` | `string` | `"typescript"` | Language for syntax highlighting |
| `tabWidth` | `number` | `4` | Tab width in spaces |
| `fontSize` | `number` | `24` | Font size |
| `lineNumbering` | `boolean` | `true` | Whether to display line numbers |
| `backgroundColor` | `ManimColor` | `"#1e1e1e"` | Background rectangle color |
| `style` | `string` | `"monokai"` | highlight.js theme name |

```ts
const codeBlock = new Code({
  code: `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
  language: "typescript",
  fontSize: 20,
});
```

---

## DecimalNumber

A numeric display that can be smoothly animated between values.

```ts
import { DecimalNumber } from "manim-ts/mobjects/text";
```

### DecimalNumberOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `number` | `number` | `0` | Initial numeric value |
| `numDecimalPlaces` | `number` | `2` | Number of decimal places to display |
| `showEllipsis` | `boolean` | `false` | Whether to show trailing "..." |
| `groupWithCommas` | `boolean` | `true` | Whether to use comma separators for thousands |
| `color` | `ManimColor` | `WHITE` | Text color |

```ts
const counter = new DecimalNumber({ number: 3.14159, numDecimalPlaces: 5, color: YELLOW });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setValue()` | `(value: number) => this` | Updates the displayed number |
| `getValue()` | `() => number` | Returns the current numeric value |
| `incrementValue()` | `(delta: number) => this` | Adds to the current value |

---

## Integer

A specialization of `DecimalNumber` with `numDecimalPlaces = 0`.

```ts
import { Integer } from "manim-ts/mobjects/text";

const count = new Integer({ number: 42, color: GREEN });
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class TextExample(Scene):
    def construct(self):
        title = Text("Hello World", font_size=72, color=YELLOW)
        formula = MathTex("e^{i\\pi}", "+", "1", "=", "0")
        formula[0].set_color(RED)

        code = Code(
            code="def hello():\n    print('hi')",
            language="python",
            tab_width=4,
            font_size=24,
        )

        counter = DecimalNumber(0, num_decimal_places=3)
        counter.set_value(3.14)
```

```ts
// TypeScript manim-ts
import { Text, MathTex, Code, DecimalNumber } from "manim-ts/mobjects/text";
import { YELLOW, RED } from "manim-ts/core";

class TextExample extends Scene {
  construct() {
    const title = new Text({ text: "Hello World", fontSize: 72, color: YELLOW });
    const formula = new MathTex({
      texStrings: ["e^{i\\pi}", "+", "1", "=", "0"],
    });
    formula.getSubmobject(0).setColor(RED);

    const codeBlock = new Code({
      code: "def hello():\n    print('hi')",
      language: "python",
      tabWidth: 4,
      fontSize: 24,
    });

    const counter = new DecimalNumber({ number: 0, numDecimalPlaces: 3 });
    counter.setValue(3.14);
  }
}
```

### Key Differences

- **KaTeX replaces pdflatex**: LaTeX rendering is handled entirely by KaTeX in JavaScript -- no system-level LaTeX installation required.
- **highlight.js replaces Pygments**: Syntax highlighting for `Code` uses highlight.js themes and language definitions.
- **Positional to named args**: `Text("Hello", font_size=72)` becomes `new Text({ text: "Hello", fontSize: 72 })`.
- **Index access to method**: `formula[0]` becomes `formula.getSubmobject(0)`.
- **`MathTex` parts**: Python uses `*args` for multiple LaTeX strings; TypeScript uses a `texStrings` array.
