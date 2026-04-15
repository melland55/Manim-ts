---
title: "Python \u2192 TypeScript Conversion"
sidebar_position: 2
---

# Python to TypeScript Conversion

This guide documents all conversion patterns used when porting Python Manim code to manim-ts. It serves as a reference for contributors and for understanding the design decisions behind the TypeScript port.

## Constructor Pattern

Python's `__init__` becomes a TypeScript constructor with an options object.

:::info Why options objects?
Python uses `**kwargs` for flexible constructor arguments. TypeScript replaces this with typed options interfaces, providing autocomplete and compile-time checking.
:::

**Python:**
```python
class Circle(Arc):
    def __init__(self, radius=1.0, color=RED, fill_opacity=0.0, **kwargs):
        super().__init__(
            start_angle=0,
            angle=TAU,
            radius=radius,
            color=color,
            fill_opacity=fill_opacity,
            **kwargs,
        )
```

**TypeScript:**
```ts
interface CircleOptions extends ArcOptions {
  radius?: number;
  color?: Color;
  fillOpacity?: number;
}

class Circle extends Arc {
  constructor(options: CircleOptions = {}) {
    const { radius = 1.0, color = RED, fillOpacity = 0.0, ...rest } = options;
    super({
      startAngle: 0,
      angle: TAU,
      radius,
      color,
      fillOpacity,
      ...rest,
    });
  }
}
```

## Properties

Python `@property` decorators become TypeScript `get`/`set` accessors.

**Python:**
```python
class Mobject:
    @property
    def width(self):
        return self.length_over_dim(0)

    @width.setter
    def width(self, value):
        self.rescale_to_fit(value, 0, stretch=False)
```

**TypeScript:**
```ts
class Mobject {
  get width(): number {
    return this.lengthOverDim(0);
  }

  set width(value: number) {
    this.rescaleToFit(value, 0, false);
  }
}
```

## Arguments and Parameters

### `*args` and `**kwargs`

Replaced with explicit typed parameters or options objects.

**Python:**
```python
def play(self, *animations, **kwargs):
    for anim in animations:
        anim.run_time = kwargs.get("run_time", 1)
```

**TypeScript:**
```ts
async play(...animations: IAnimation[]): Promise<void>;
async play(options: PlayOptions, ...animations: IAnimation[]): Promise<void>;
async play(
  optionsOrAnim: PlayOptions | IAnimation,
  ...rest: IAnimation[]
): Promise<void> {
  // Implementation handles both overloads
}
```

### Default Mutable Arguments

Python's mutable default argument footgun is avoided by creating new instances in the function body.

**Python (buggy):**
```python
def __init__(self, points=[]):  # BUG: shared list
    self.points = points
```

**Python (fixed in Manim):**
```python
def __init__(self, points=None):
    self.points = points or []
```

**TypeScript:**
```ts
constructor(options: { points?: Point3D[] } = {}) {
  this.points = options.points ?? [];  // Always a new array
}
```

## Import Patterns

### `if TYPE_CHECKING:`

Python uses `if TYPE_CHECKING:` to import types without creating runtime circular dependencies. TypeScript uses `import type`.

**Python:**
```python
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from manimlib.animation.animation import Animation
    from manimlib.scene.scene import Scene

class Mobject:
    def animate(self) -> "Animation":
        ...
```

**TypeScript:**
```ts
import type { IAnimation } from "../core/types.js";
import type { IScene } from "../core/types.js";

class Mobject {
  animate(): IAnimation {
    // ...
  }
}
```

Note: manim-ts uses **interfaces** from `core/types.ts` (IMobject, IAnimation, IScene) rather than importing concrete classes, further reducing coupling.

## Async/Await

Python Manim's `construct()` method uses blocking calls. manim-ts uses `async/await` because JavaScript is single-threaded and non-blocking.

**Python:**
```python
class MyScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
        self.play(FadeOut(circle))
```

**TypeScript:**
```ts
class MyScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle();
    await this.play(new Create(circle));
    await this.wait(1);
    await this.play(new FadeOut(circle));
  }
}
```

Every method that involves time progression (`play`, `wait`, animation lifecycle methods) is async.

## NumPy to numpy-ts

numpy-ts mirrors NumPy's API. Most operations translate directly.

**Python:**
```python
import numpy as np

points = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
center = np.mean(points, axis=0)
rotated = np.dot(rotation_matrix, point)
distances = np.linalg.norm(points - center, axis=1)
mask = distances < threshold
filtered = points[mask]
```

**TypeScript:**
```ts
import { np } from "../core/math/index.js";

const points = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
const center = np.mean(points, 0);
const rotated = np.dot(rotationMatrix, point);
const distances = np.linalg.norm(np.subtract(points, center), 1);
const mask = np.less(distances, threshold);
const filtered = np.compress(mask, points, 0);
```

Key differences:
- Operator overloading (`points - center`) becomes function calls (`np.subtract(points, center)`)
- Boolean indexing (`points[mask]`) becomes `np.compress(mask, points, axis)`
- Broadcasting works the same way

## Dictionaries to Interfaces

Python dicts used as structured data become TypeScript interfaces.

**Python:**
```python
config = {
    "pixel_width": 1920,
    "pixel_height": 1080,
    "frame_rate": 60,
    "background_color": BLACK,
}
```

**TypeScript:**
```ts
interface RenderConfig {
  pixelWidth: number;
  pixelHeight: number;
  frameRate: number;
  backgroundColor: Color;
}

const config: RenderConfig = {
  pixelWidth: 1920,
  pixelHeight: 1080,
  frameRate: 60,
  backgroundColor: BLACK,
};
```

## List Comprehensions

Python list comprehensions become `.map()`, `.filter()`, and `.flatMap()`.

**Python:**
```python
# Map
doubled = [x * 2 for x in numbers]

# Filter
positives = [x for x in numbers if x > 0]

# Map + Filter
big_lengths = [mob.get_length() for mob in mobjects if mob.has_points()]

# Nested (flatten)
all_points = [p for mob in mobjects for p in mob.get_points()]
```

**TypeScript:**
```ts
// Map
const doubled = numbers.map(x => x * 2);

// Filter
const positives = numbers.filter(x => x > 0);

// Map + Filter
const bigLengths = mobjects
  .filter(mob => mob.hasPoints())
  .map(mob => mob.getLength());

// Nested (flatten)
const allPoints = mobjects.flatMap(mob => mob.getPoints());
```

## Type Checking

`isinstance()` becomes `instanceof`.

**Python:**
```python
if isinstance(mobject, VMobject):
    mobject.set_fill(color=RED)
elif isinstance(mobject, ImageMobject):
    mobject.set_opacity(0.5)
```

**TypeScript:**
```ts
if (mobject instanceof VMobject) {
  mobject.setFill({ color: RED });
} else if (mobject instanceof ImageMobject) {
  mobject.setOpacity(0.5);
}
```

## Decorators

Python decorators are replaced with manual wrapping, class metadata, or TypeScript's experimental decorator support where appropriate.

**Python:**
```python
class Mobject:
    @staticmethod
    def get_all_families(mobjects):
        return list(set(chain(*[m.get_family() for m in mobjects])))

    @classmethod
    def create(cls, **kwargs):
        return cls(**kwargs)
```

**TypeScript:**
```ts
class Mobject {
  static getAllFamilies(mobjects: IMobject[]): IMobject[] {
    const families = mobjects.flatMap(m => m.getFamily());
    return [...new Set(families)];
  }

  // No direct @classmethod equivalent — use static methods
  // or factory functions
  static create(options?: MobjectOptions): Mobject {
    return new Mobject(options);
  }
}
```

## Multiple Inheritance

Python uses multiple inheritance extensively (e.g., `class ThreeDScene(Scene, ThreeDMixin)`). TypeScript uses mixins or composition.

**Python:**
```python
class ThreeDScene(SpecialThreeDScene, Scene):
    pass
```

**TypeScript (mixin pattern):**
```ts
function ThreeDMixin<T extends Constructor<Scene>>(Base: T) {
  return class extends Base {
    camera: ThreeDCamera;

    setCamera(options: { phi?: number; theta?: number }): void {
      // 3D camera setup
    }
  };
}

class ThreeDScene extends ThreeDMixin(Scene) {
  // Inherits from Scene with 3D capabilities mixed in
}
```

## Context Managers

Python `with` blocks become `try/finally` or utility methods.

**Python:**
```python
with self.temp_config(background_color=WHITE):
    self.play(Create(circle))
```

**TypeScript:**
```ts
const prevColor = this.camera.backgroundColor;
try {
  this.camera.backgroundColor = WHITE;
  await this.play(new Create(circle));
} finally {
  this.camera.backgroundColor = prevColor;
}

// Or using a utility method:
await this.withTempConfig({ backgroundColor: WHITE }, async () => {
  await this.play(new Create(circle));
});
```

## Naming Conventions

| Python | TypeScript |
|---|---|
| `snake_case` methods | `camelCase` methods |
| `snake_case` variables | `camelCase` variables |
| `PascalCase` classes | `PascalCase` classes |
| `UPPER_SNAKE` constants | `UPPER_SNAKE` constants |
| `__private` | `private` keyword |
| `_protected` | `protected` keyword |

Public API names (class names) are preserved exactly:
- `Circle` stays `Circle`
- `FadeIn` stays `FadeIn`
- `VMobject` stays `VMobject`

Method names are converted to camelCase:
- `get_center()` becomes `getCenter()`
- `set_fill()` becomes `setFill()`
- `move_to()` becomes `moveTo()`

## Orchestrator CLI

The conversion is driven by an agent swarm orchestrator in
`src/orchestrator.ts`. It spawns Claude Code CLI agents (`npx
@anthropic-ai/claude-code -p`) headlessly and converts modules layer-by-layer
respecting the dependency graph in `task-graph.json`.

```bash
npx tsx src/orchestrator.ts [flags]
```

| Flag | Purpose |
|------|---------|
| `--max-parallel=N` | Maximum concurrent agents. Default `5`. |
| `--start-layer=N` | Resume from a specific dependency layer. Default `0`. |
| `--only=module.name` | Convert only the named module (and its dependencies already on disk). |
| `--dry-run` | Print the plan without spawning any agents. |
| `--skip-typecheck` | Skip the `tsc --noEmit` gate between layers. |
| `--timeout=N` | Per-agent timeout in seconds. Default `600`. |
| `--model=MODEL` | Base model (default `sonnet`; large modules auto-upgrade to opus). |
| `--gaps` | Run the `GAP_TASKS` queue (missing classes / modules) instead of the main conversion. |
| `--three-js` | Run the three.js migration swarm (renderer + text/math backend, 8 phases). |
| `--renderer-mode` | Run the renderer-mode swarm (Cairo/three.js backend parity). |

Progress is saved to `results.json` after each layer so runs can be resumed.
`Ctrl+C` kills all child agents cleanly (uses `taskkill` on Windows).
