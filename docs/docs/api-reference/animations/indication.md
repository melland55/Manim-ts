---
title: "Indication"
sidebar_position: 8
---

# Indication

Animations that draw attention to specific mobjects without permanently changing them. These are used for emphasis, highlighting, and visual cues during explanations.

## FocusOn

Creates a shrinking circle (or dot) that converges on a point or mobject, drawing the viewer's attention to that location.

```typescript
import { FocusOn } from "manim-ts/animation/indication";

// Focus on a point
await this.play(new FocusOn(np.array([1, 1, 0])));

// Focus on a mobject
await this.play(new FocusOn(circle));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `Color` | `GREY` | Color of the focusing circle |
| `opacity` | `number` | `0.2` | Opacity of the circle |
| `runTime` | `number` | `2` | Duration |

## Indicate

Briefly highlights a mobject by scaling it up and changing its color, then returning to normal. Produces a quick "pulse" effect.

```typescript
import { Indicate } from "manim-ts/animation/indication";

await this.play(new Indicate(circle));
await this.play(new Indicate(equation, { color: YELLOW, scaleFactor: 1.5 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `Color` | `YELLOW` | Highlight color |
| `scaleFactor` | `number` | `1.2` | How much to scale during indication |
| `runTime` | `number` | `1` | Duration |

## Flash

Creates a burst of radial lines emanating from a point or mobject, like a camera flash or explosion.

```typescript
import { Flash } from "manim-ts/animation/indication";

await this.play(new Flash(ORIGIN));
await this.play(new Flash(circle, { color: YELLOW, lineLength: 0.5 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `Color` | `YELLOW` | Color of flash lines |
| `lineLength` | `number` | `0.2` | Length of each radial line |
| `numLines` | `number` | `12` | Number of radial lines |
| `flashRadius` | `number` | `0.3` | Radius of the flash burst |
| `lineStrokeWidth` | `number` | `3` | Stroke width of flash lines |

## ShowPassingFlash

A flash of light that travels along the stroke of a VMobject, like a spark running along a wire.

```typescript
import { ShowPassingFlash } from "manim-ts/animation/indication";

const line = new Line(LEFT.scale(3), RIGHT.scale(3));
await this.play(new ShowPassingFlash(line, { runTime: 1 }));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeWidth` | `number` | `0.3` | Fraction of the path illuminated at any moment |

## ShowPassingFlashWithThinningStrokeWidth

A variant of `ShowPassingFlash` where the stroke width tapers off as the flash passes, creating a more natural trailing effect.

```typescript
import { ShowPassingFlashWithThinningStrokeWidth } from "manim-ts/animation/indication";

await this.play(new ShowPassingFlashWithThinningStrokeWidth(curve, { runTime: 2 }));
```

## ApplyWave

Applies a transverse wave deformation to a mobject. Points are displaced perpendicular to a direction, creating a wave that propagates across the mobject.

```typescript
import { ApplyWave } from "manim-ts/animation/indication";

await this.play(new ApplyWave(text));
await this.play(new ApplyWave(mobject, {
  direction: UP,
  amplitude: 0.3,
}));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `Point3D` | `UP` | Direction of the wave displacement |
| `amplitude` | `number` | `0.2` | Height of the wave |
| `runTime` | `number` | `1` | Duration |

## Circumscribe

Draws a shape (rectangle or circle) around a mobject to highlight it, then removes the shape. Creates a "circling" or "boxing" emphasis effect.

```typescript
import { Circumscribe } from "manim-ts/animation/indication";

// Default rectangle circumscription
await this.play(new Circumscribe(equation));

// Circle circumscription
await this.play(new Circumscribe(term, {
  shape: "circle",
  color: RED,
}));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `shape` | `"rectangle" \| "circle"` | `"rectangle"` | Shape to draw around the mobject |
| `fadeIn` | `boolean` | `true` | Whether the shape fades in |
| `fadeOut` | `boolean` | `true` | Whether the shape fades out |
| `color` | `Color` | `YELLOW` | Color of the circumscription |
| `strokeWidth` | `number` | `4` | Stroke width of the shape |
| `bufferFactor` | `number` | `1.1` | Scale factor for padding around the mobject |

## Wiggle

Wiggles a mobject back and forth with slight rotations and scaling, creating a "jiggle" effect.

```typescript
import { Wiggle } from "manim-ts/animation/indication";

await this.play(new Wiggle(arrow));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaleValue` | `number` | `1.1` | Scale oscillation magnitude |
| `rotationAngle` | `number` | `0.01 * TAU` | Rotation oscillation magnitude |
| `nWiggles` | `number` | `6` | Number of wiggle cycles |

## Blink

A blink effect for a mobject -- briefly hides it and shows it again.

```typescript
import { Blink } from "manim-ts/animation/indication";

await this.play(new Blink(eye));
```

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `runTime` | `number` | `0.5` | Duration of the blink |

## Common Patterns

### Emphasize a term in an equation

```typescript
const equation = new MathTex("E", "=", "m", "c^2");
await this.play(new Write(equation));
await this.play(new Indicate(equation[2])); // highlight "m"
await this.play(new Circumscribe(equation[3], { color: RED }));
```

### Flash on creation

```typescript
const dot = new Dot(ORIGIN);
await this.play(new Create(dot));
await this.play(new Flash(dot, { color: WHITE }));
```

### Traveling spark along a curve

```typescript
const curve = new FunctionGraph((x) => Math.sin(x), { xRange: [-3, 3] });
this.add(curve);
await this.play(new ShowPassingFlash(
  curve.copy().setColor(YELLOW),
  { timeWidth: 0.2, runTime: 2 }
));
```

## Python to TypeScript Conversion

### Python (Manim)

```python
class IndicationScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE)
        self.add(circle)

        self.play(Indicate(circle, color=YELLOW))
        self.play(Flash(circle, color=RED, num_lines=16))
        self.play(Circumscribe(circle, shape=Rectangle))
        self.play(ApplyWave(circle, direction=UP, amplitude=0.3))
        self.play(Wiggle(circle, n_wiggles=8))
        self.play(FocusOn(circle))
```

### TypeScript (manim-ts)

```typescript
class IndicationScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ color: BLUE });
    this.add(circle);

    await this.play(new Indicate(circle, { color: YELLOW }));
    await this.play(new Flash(circle, { color: RED, numLines: 16 }));
    await this.play(new Circumscribe(circle, { shape: "rectangle" }));
    await this.play(new ApplyWave(circle, { direction: UP, amplitude: 0.3 }));
    await this.play(new Wiggle(circle, { nWiggles: 8 }));
    await this.play(new FocusOn(circle));
  }
}
```

### Key Differences

| Python | TypeScript |
|--------|-----------|
| `Indicate(mob, color=YELLOW)` | `new Indicate(mob, { color: YELLOW })` |
| `Flash(mob, num_lines=16)` | `new Flash(mob, { numLines: 16 })` |
| `Circumscribe(mob, shape=Rectangle)` | `new Circumscribe(mob, { shape: "rectangle" })` |
| `ApplyWave(mob, direction=UP)` | `new ApplyWave(mob, { direction: UP })` |
| `n_wiggles=8` | `nWiggles: 8` |
| `scale_value=1.2` | `scaleValue: 1.2` |
| `flash_radius=0.5` | `flashRadius: 0.5` |
| `line_length=0.3` | `lineLength: 0.3` |
