---
title: "SVG"
sidebar_position: 4
---

# SVG

The SVG module provides classes for loading, parsing, and displaying SVG files and path data as manim-ts VMobjects. Internally it uses **cheerio** for HTML/SVG DOM parsing and **svg-path-commander** for interpreting SVG path `d` attributes.

## SVGMobject

Loads an SVG file and converts it into a hierarchy of VMobjects.

```ts
import { SVGMobject } from "manim-ts/mobjects/svg";
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filePath` | `string` | (required) | Path to the SVG file |
| `width` | `number \| null` | `2` | Desired width (scales proportionally); `null` to keep original size |
| `height` | `number \| null` | `null` | Desired height; overrides width if both are set |
| `fillColor` | `ManimColor` | from SVG | Override fill color for all paths |
| `strokeColor` | `ManimColor` | from SVG | Override stroke color for all paths |
| `strokeWidth` | `number` | from SVG | Override stroke width for all paths |
| `shouldCenter` | `boolean` | `true` | Whether to center the result at the origin |

```ts
const logo = new SVGMobject({ filePath: "./assets/logo.svg", width: 4 });
```

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSubMobjects()` | `() => VMobject[]` | Returns the individual VMobject paths parsed from the SVG |

---

## VMobjectFromSVGPath

Creates a single VMobject from an SVG path data string (`d` attribute).

```ts
import { VMobjectFromSVGPath } from "manim-ts/mobjects/svg";

const heart = new VMobjectFromSVGPath({
  pathString: "M 10 30 A 20 20 0 0 1 50 30 A 20 20 0 0 1 90 30 Q 90 60 50 90 Q 10 60 10 30 Z",
  fillColor: RED,
  fillOpacity: 1,
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pathString` | `string` | (required) | SVG path `d` attribute string |
| `fillColor` | `ManimColor` | `WHITE` | Fill color |
| `fillOpacity` | `number` | `0` | Fill opacity |
| `strokeColor` | `ManimColor` | `WHITE` | Stroke color |
| `strokeWidth` | `number` | `4` | Stroke width |

---

## Brace

A curly brace that stretches to fit around a mobject or span between two points.

```ts
import { Brace } from "manim-ts/mobjects/svg";

const square = new Square({ sideLength: 2 });
const brace = new Brace({ mobject: square, direction: DOWN });
```

### BraceOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mobject` | `IMobject` | (required) | The mobject to place the brace around |
| `direction` | `Point3D` | `DOWN` | Direction the brace opens toward |
| `buffLength` | `number` | `0.2` | Gap between the brace and the mobject |

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getTip()` | `() => Point3D` | Returns the tip (peak) of the curly brace |
| `getDirection()` | `() => Point3D` | Returns the direction the brace is facing |

---

## BraceLabel

A `Brace` paired with a label (text or LaTeX).

```ts
import { BraceLabel } from "manim-ts/mobjects/svg";

const braceLabel = new BraceLabel({
  mobject: square,
  text: "width",
  direction: DOWN,
});
```

---

## BraceText

An alias for `BraceLabel` that uses plain `Text` for the label rather than LaTeX.

---

## BraceBetweenPoints

A curly brace drawn between two explicit points.

```ts
import { BraceBetweenPoints } from "manim-ts/mobjects/svg";

const brace = new BraceBetweenPoints({
  pointA: np.array([-2, 0, 0]),
  pointB: np.array([2, 0, 0]),
  direction: UP,
});
```

---

## ArcBrace

A curly brace that follows an arc, useful for labeling angles.

```ts
import { ArcBrace } from "manim-ts/mobjects/svg";

const arc = new Arc({ angle: PI / 2 });
const brace = new ArcBrace({ arc });
```

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class SVGExample(Scene):
    def construct(self):
        logo = SVGMobject("logo.svg").scale(2)

        square = Square(side_length=2)
        brace = Brace(square, DOWN)
        label = brace.get_tex("x^2")

        brace_pts = BraceBetweenPoints(
            LEFT * 2, RIGHT * 2, direction=UP
        )
```

```ts
// TypeScript manim-ts
import { SVGMobject, Brace, BraceBetweenPoints } from "manim-ts/mobjects/svg";
import { Square } from "manim-ts/mobjects/geometry";
import { DOWN, UP, LEFT, RIGHT } from "manim-ts/core";

class SVGExample extends Scene {
  construct() {
    const logo = new SVGMobject({ filePath: "logo.svg" }).scale(2);

    const square = new Square({ sideLength: 2 });
    const brace = new Brace({ mobject: square, direction: DOWN });
    const label = brace.getTex("x^2");

    const bracePts = new BraceBetweenPoints({
      pointA: LEFT.scale(2),
      pointB: RIGHT.scale(2),
      direction: UP,
    });
  }
}
```

### Key Differences

- **File path as option**: Python passes the file path as a positional arg; TypeScript uses the `filePath` named option.
- **cheerio replaces BeautifulSoup**: SVG DOM parsing uses cheerio internally (no API change for the user).
- **svg-path-commander replaces svgelements**: Path data parsing is handled by svg-path-commander behind the scenes.
- **Brace constructor**: Python uses `Brace(mobject, direction)`; TypeScript uses `new Brace({ mobject, direction })`.
