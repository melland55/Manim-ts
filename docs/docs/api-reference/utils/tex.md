---
title: TeX Utilities
sidebar_position: 8
---

# TeX Utilities

Utilities for rendering mathematical notation using TeX. In Python Manim, this involves a pipeline of `pdflatex` and `dvisvgm` to convert LaTeX strings into SVG paths. manim-ts replaces this with **KaTeX**, a fast browser-compatible math typesetter that requires no external dependencies.

```ts
import { TexTemplate } from "manim-ts";
```

## KaTeX vs pdflatex

| Aspect | Python Manim | manim-ts |
|---|---|---|
| Engine | pdflatex + dvisvgm | KaTeX |
| Dependencies | Full TeX distribution | None (npm package) |
| Environment | Server only | Browser + Node.js |
| Output | SVG via DVI | SVG/HTML directly |
| Coverage | Full LaTeX | Most math notation |
| Speed | Slow (subprocess) | Fast (in-process) |

KaTeX supports the vast majority of mathematical notation used in Manim animations, including:

- Fractions, exponents, subscripts
- Greek letters and mathematical symbols
- Matrices and arrays
- Integrals, summations, products
- Set notation, logic symbols
- Alignment environments

For the rare cases where KaTeX does not support a specific LaTeX command, custom macros can be defined through the `TexTemplate` class.

## TexTemplate

The `TexTemplate` class manages LaTeX template configuration. In Python Manim, this controls the preamble, document class, and packages used by pdflatex. In manim-ts, it configures KaTeX rendering options and custom macros.

### Constructor

```ts
const template = new TexTemplate({
  texCompiler?: string;
  outputFormat?: string;
  preamble?: string;
  documentclass?: string;
  postDocCommands?: string;
});
```

### Key Properties

| Property | Type | Description |
|---|---|---|
| `texCompiler` | `string` | The TeX compiler name (for compatibility; KaTeX is always used) |
| `outputFormat` | `string` | Output format ("svg" or "html") |
| `preamble` | `string` | LaTeX preamble (custom macros are extracted for KaTeX) |
| `documentclass` | `string` | Document class (for compatibility) |

### Custom Macros

Define custom LaTeX macros through the preamble:

```ts
const template = new TexTemplate({
  preamble: String.raw`
    \newcommand{\R}{\mathbb{R}}
    \newcommand{\N}{\mathbb{N}}
    \newcommand{\vect}[1]{\mathbf{#1}}
  `,
});
```

These macros are parsed and passed to KaTeX's `macros` option.

## Internal Functions

### `_texcodeForEnvironment(environment: string, texString: string): string`

Generates TeX code wrapped in a specified environment. Used internally by `MathTex` and `Tex` mobjects.

```ts
_texcodeForEnvironment("align*", "x &= 1 \\\\ y &= 2");
// => "\\begin{align*}\nx &= 1 \\\\ y &= 2\n\\end{align*}"
```

### TeX Rendering Pipeline

When a `MathTex` or `Tex` mobject is created, the following pipeline executes:

1. **Template resolution** -- The TeX template is selected (default or custom).
2. **Environment wrapping** -- The TeX string is wrapped in the appropriate math environment.
3. **KaTeX rendering** -- KaTeX converts the TeX string to SVG markup.
4. **SVG parsing** -- The SVG output is parsed using cheerio.
5. **Path extraction** -- SVG `<path>` elements are converted to bezier control points.
6. **VMobject construction** -- The bezier points become the mobject's geometry.

```
TeX string → KaTeX → SVG → cheerio parse → bezier points → VMobject
```

## Usage with Mobjects

You typically do not use TeX utilities directly. Instead, use the `MathTex` and `Tex` mobject classes:

```ts
// Simple math expression
const formula = new MathTex("e^{i\\pi} + 1 = 0");

// With custom template
const template = new TexTemplate({
  preamble: "\\newcommand{\\R}{\\mathbb{R}}",
});
const formula = new MathTex("f: \\R \\to \\R", {
  texTemplate: template,
});

// Multi-part (for selective coloring)
const equation = new MathTex("a^2", "+", "b^2", "=", "c^2");
equation.parts[0].setColor(RED);   // a^2 in red
equation.parts[2].setColor(BLUE);  // b^2 in blue
```

## Supported Environments

| Environment | Description | Example |
|---|---|---|
| (default) | Inline math | `$x^2$` |
| `align*` | Aligned equations | Multi-line aligned |
| `gather*` | Gathered equations | Multi-line centered |
| `matrix` | Matrix | `\begin{matrix}...\end{matrix}` |
| `bmatrix` | Bracketed matrix | `[...]` |
| `pmatrix` | Parenthesized matrix | `(...)` |
| `cases` | Piecewise functions | `\begin{cases}...\end{cases}` |

## Limitations

KaTeX does not support everything that a full LaTeX distribution does. Notable limitations:

- **TikZ/PGF** -- Not supported. Use manim-ts drawing primitives instead.
- **Custom packages** -- Only KaTeX's built-in commands and user-defined macros.
- **Text-mode commands** -- Limited text-mode support. Use `Text` mobject for plain text.
- **Some advanced math** -- Very specialized notation (e.g., commutative diagrams) may not be available.

For these cases, consider using SVG mobjects with externally generated SVG files.
