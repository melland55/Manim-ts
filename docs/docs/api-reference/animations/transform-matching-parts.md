---
title: "Transform Matching Parts"
sidebar_position: 15
---

# Transform Matching Parts

Animations that intelligently match and morph corresponding parts between two mobjects. Unlike plain `Transform`, which interpolates all points uniformly, these animations identify which sub-parts correspond to each other and animate them individually, producing cleaner and more meaningful transitions.

## TransformMatchingAbstractBase

The abstract base class for all part-matching transform animations. Not used directly; subclass it or use `TransformMatchingShapes` or `TransformMatchingTex`.

```typescript
// This is a base class — use the concrete subclasses below
```

### Constructor Options

Inherits all options from `Animation` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fadeTransformMismatches` | `boolean` | `false` | If true, unmatched parts cross-fade. If false, they use regular Transform. |
| `transformMismatches` | `boolean` | `false` | If true, unmatched parts are transformed (morphed). If false, they fade out/in. |
| `keyMap` | `Record<string, string>` | `{}` | Manual mapping of part keys between source and target |

### Matching Logic

1. Each submobject in both source and target is assigned a **key** (how the key is computed depends on the subclass).
2. Submobjects with matching keys are paired and transformed into each other.
3. Unmatched source parts are faded out (or transformed, depending on options).
4. Unmatched target parts are faded in (or transformed from mismatched source parts).
5. The `keyMap` option allows manual overrides, mapping source keys to target keys.

## TransformMatchingShapes

Matches submobjects by their geometric shape (point data). Two submobjects are considered matching if their point arrays are similar, regardless of position, color, or other style properties.

```typescript
import { TransformMatchingShapes } from "manim-ts/animation/transform_matching_parts";

const source = new VGroup(
  new Circle({ color: RED }).shift(LEFT),
  new Square({ color: BLUE }).shift(RIGHT),
);

const target = new VGroup(
  new Circle({ color: GREEN }).shift(RIGHT),  // matches source circle
  new Triangle({ color: YELLOW }).shift(LEFT), // no match — fades in
);

await this.play(new TransformMatchingShapes(source, target));
```

### Constructor

```typescript
new TransformMatchingShapes(
  source: VGroup,
  target: VGroup,
  options?: TransformMatchingOptions
)
```

### Behavior

- Submobjects are matched by comparing their normalized point arrays.
- Matched shapes animate smoothly from source position/style to target position/style.
- Unmatched source shapes fade out; unmatched target shapes fade in.
- Useful for animating rearrangements of geometric shapes.

### Key Methods

| Method | Description |
|--------|-------------|
| `getShapeKey(mob)` | Computes the shape-based key for a submobject |

## TransformMatchingTex

Matches submobjects by their TeX string content. Designed for animating changes in mathematical equations where some terms persist, some are added, and some are removed.

```typescript
import { TransformMatchingTex } from "manim-ts/animation/transform_matching_parts";

const eq1 = new MathTex("a", "x", "+", "b");
const eq2 = new MathTex("a", "x^2", "+", "b", "x", "+", "c");

await this.play(new TransformMatchingTex(eq1, eq2));
```

### Constructor

```typescript
new TransformMatchingTex(
  source: MathTex,
  target: MathTex,
  options?: TransformMatchingTexOptions
)
```

### Constructor Options

Inherits all options from `TransformMatchingAbstractBase` plus:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `keyMap` | `Record<string, string>` | `{}` | Manual TeX string mapping (e.g., `{ "x": "x^2" }`) |

### Behavior

- Each submobject in the `MathTex` is keyed by its TeX string content.
- Submobjects with identical TeX strings are matched and animated together.
- The `keyMap` option lets you manually specify which TeX parts should morph into which. This is crucial when the same symbol appears multiple times or when you want a specific term to transform into another.

### Key Methods

| Method | Description |
|--------|-------------|
| `getTexKey(mob)` | Returns the TeX string key for a submobject |

## Common Patterns

### Equation transformation with keyMap

```typescript
const eq1 = new MathTex("a^2", "+", "b^2", "=", "c^2");
const eq2 = new MathTex("a^2", "=", "c^2", "-", "b^2");

await this.play(new TransformMatchingTex(eq1, eq2, {
  keyMap: { "+": "-" },  // map the "+" to the "-"
}));
```

### Step-by-step derivation

```typescript
const step1 = new MathTex("x", "=", "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}");
const step2 = new MathTex("2a", "x", "=", "-b \\pm \\sqrt{b^2-4ac}");

await this.play(new TransformMatchingTex(step1, step2, {
  keyMap: { "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}": "-b \\pm \\sqrt{b^2-4ac}" },
}));
```

### Fade mismatches for cleaner transitions

```typescript
await this.play(new TransformMatchingTex(eq1, eq2, {
  fadeTransformMismatches: true,
}));
```

### Shape rearrangement

```typescript
const before = new VGroup(
  new Circle().moveTo(LEFT),
  new Square().moveTo(ORIGIN),
  new Triangle().moveTo(RIGHT),
);

const after = new VGroup(
  new Triangle().moveTo(LEFT),   // matches triangle above
  new Circle().moveTo(ORIGIN),   // matches circle above
  new Square().moveTo(RIGHT),    // matches square above
);

await this.play(new TransformMatchingShapes(before, after));
```

### Handling duplicates with keyMap

When the same TeX string appears multiple times, the automatic matching may not pair them correctly. Use `keyMap` to disambiguate:

```typescript
const eq1 = new MathTex("x", "+", "x", "=", "2x");
const eq2 = new MathTex("2", "x", "=", "2x");

await this.play(new TransformMatchingTex(eq1, eq2, {
  keyMap: { "x": "2" },  // first "x" transforms to "2"
}));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class MatchingScene(Scene):
    def construct(self):
        eq1 = MathTex("a", "x", "+", "b")
        eq2 = MathTex("a", "x^2", "+", "b", "x", "+", "c")
        
        self.add(eq1)
        self.play(TransformMatchingTex(eq1, eq2, key_map={"x": "x^2"}))

        shapes1 = VGroup(Circle(), Square()).arrange(RIGHT)
        shapes2 = VGroup(Square(), Circle()).arrange(RIGHT)
        
        self.play(TransformMatchingShapes(
            shapes1, shapes2,
            fade_transform_mismatches=True,
        ))
```

### TypeScript (manim-ts)

```typescript
class MatchingScene extends Scene {
  async construct(): Promise<void> {
    const eq1 = new MathTex("a", "x", "+", "b");
    const eq2 = new MathTex("a", "x^2", "+", "b", "x", "+", "c");

    this.add(eq1);
    await this.play(new TransformMatchingTex(eq1, eq2, { keyMap: { "x": "x^2" } }));

    const shapes1 = new VGroup(new Circle(), new Square()).arrange(RIGHT);
    const shapes2 = new VGroup(new Square(), new Circle()).arrange(RIGHT);

    await this.play(new TransformMatchingShapes(shapes1, shapes2, {
      fadeTransformMismatches: true,
    }));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `TransformMatchingTex(a, b)` | `new TransformMatchingTex(a, b)` |
| `TransformMatchingShapes(a, b)` | `new TransformMatchingShapes(a, b)` |
| `key_map={"x": "x^2"}` | `keyMap: { "x": "x^2" }` |
| `fade_transform_mismatches=True` | `fadeTransformMismatches: true` |
| `transform_mismatches=True` | `transformMismatches: true` |
| `MathTex("a", "x", "+", "b")` | `new MathTex("a", "x", "+", "b")` |
