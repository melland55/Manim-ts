---
title: "Creation"
sidebar_position: 2
---

# Creation

Animations for introducing mobjects into a scene. These animate the construction of a mobject, making it appear as though it is being drawn, written, or assembled.

## Create

The most commonly used creation animation. Draws the stroke of a VMobject, then fills it in. This is the go-to animation for making shapes appear.

```typescript
import { Create } from "manim-ts/animation/creation";

const circle = new Circle();
await this.play(new Create(circle));
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `runTime` | `number` | `2` | Duration of the creation |
| `lagRatio` | `number` | `1` | Submobjects draw one after another |

## Uncreate

The reverse of `Create`. Undraws the mobject stroke and removes fill.

```typescript
import { Uncreate } from "manim-ts/animation/creation";

await this.play(new Uncreate(circle));
```

## DrawBorderThenFill

Draws the border (stroke) of the mobject first, then fills it in. Similar to `Create` but with more explicit two-phase behavior.

```typescript
import { DrawBorderThenFill } from "manim-ts/animation/creation";

await this.play(new DrawBorderThenFill(square));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `runTime` | `number` | `2` | Duration |
| `strokeWidth` | `number` | `2` | Stroke width during draw phase |
| `strokeColor` | `Color` | `WHITE` | Stroke color during draw phase |

## Write

A handwriting-style creation animation. Similar to `Create` but designed for text mobjects (Tex, MathTex, Text). Animates each character or glyph as if being written.

```typescript
import { Write } from "manim-ts/animation/creation";

const text = new Text("Hello, World!");
await this.play(new Write(text));
```

## Unwrite

The reverse of `Write`. Erases text in reverse writing order.

```typescript
import { Unwrite } from "manim-ts/animation/creation";

await this.play(new Unwrite(text));
```

## SpiralIn

Spirals submobjects inward from outside the frame to their final positions.

```typescript
import { SpiralIn } from "manim-ts/animation/creation";

await this.play(new SpiralIn(mobject, { runTime: 2 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaleValue` | `number` | `2` | Initial scale factor |
| `fadeIn` | `boolean` | `true` | Whether to also fade in |

## ShowIncreasingSubsets

Reveals submobjects one by one, building up the complete mobject over time.

```typescript
import { ShowIncreasingSubsets } from "manim-ts/animation/creation";

const group = new VGroup(circle, square, triangle);
await this.play(new ShowIncreasingSubsets(group, { runTime: 3 }));
```

## ShowSubmobjectsOneByOne

Shows each submobject individually, hiding the previous one. Only one submobject is visible at a time.

```typescript
import { ShowSubmobjectsOneByOne } from "manim-ts/animation/creation";

await this.play(new ShowSubmobjectsOneByOne(group));
```

## AddTextLetterByLetter

Typewriter effect that adds text one letter at a time.

```typescript
import { AddTextLetterByLetter } from "manim-ts/animation/creation";

const text = new Text("Typing...");
await this.play(new AddTextLetterByLetter(text, { runTime: 2 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `runTime` | `number` | (computed) | Total duration |
| `timePerChar` | `number` | `0.1` | Seconds per character |

## RemoveTextLetterByLetter

Removes text one letter at a time, in reverse of `AddTextLetterByLetter`.

```typescript
import { RemoveTextLetterByLetter } from "manim-ts/animation/creation";

await this.play(new RemoveTextLetterByLetter(text));
```

## AddTextWordByWord

Adds text one word at a time rather than one character at a time.

```typescript
import { AddTextWordByWord } from "manim-ts/animation/creation";

const paragraph = new Text("Hello World Foo Bar");
await this.play(new AddTextWordByWord(paragraph, { runTime: 2 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timePerWord` | `number` | `0.2` | Seconds per word |

## TypeWithCursor

Typewriter effect that includes a blinking cursor following the text as it is typed.

```typescript
import { TypeWithCursor } from "manim-ts/animation/creation";

const text = new Text("Hello!");
await this.play(new TypeWithCursor(text, {
  cursor: new Rectangle({ width: 0.05, height: 0.3 }),
  blinkInterval: 0.5,
}));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cursor` | `VMobject` | (default cursor) | The cursor mobject |
| `blinkInterval` | `number` | `0.5` | Blink interval in seconds |
| `timePerChar` | `number` | `0.1` | Seconds per character |

## UntypeWithCursor

Reverse of `TypeWithCursor`. Deletes text one character at a time with a blinking cursor.

```typescript
import { UntypeWithCursor } from "manim-ts/animation/creation";

await this.play(new UntypeWithCursor(text, { cursor }));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class CreationScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        text = Text("Hello")
        
        self.play(Create(circle), run_time=2)
        self.play(Write(text))
        self.play(AddTextLetterByLetter(text, time_per_char=0.1))
        self.play(Uncreate(circle))
```

### TypeScript (manim-ts)

```typescript
class CreationScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ color: BLUE });
    const text = new Text("Hello");

    await this.play(new Create(circle, { runTime: 2 }));
    await this.play(new Write(text));
    await this.play(new AddTextLetterByLetter(text, { timePerChar: 0.1 }));
    await this.play(new Uncreate(circle));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `Create(mob)` | `new Create(mob)` |
| `Write(text)` | `new Write(text)` |
| `time_per_char=0.1` | `timePerChar: 0.1` |
| `DrawBorderThenFill(mob, stroke_width=3)` | `new DrawBorderThenFill(mob, { strokeWidth: 3 })` |
