# Manim-TS Conversion Conventions

Every conversion agent MUST follow these conventions. Deviation will cause cross-module incompatibilities.

## 1. Math & Linear Algebra — numpy-ts

**We use `numpy-ts` as our math foundation.** It mirrors NumPy's API at 94% coverage,
so most Python numpy code translates almost 1:1. **Do NOT reinvent math utilities.**

```typescript
// Import the numpy-ts namespace — works like Python's `import numpy as np`
import { np, array, zeros, dot, cross, linalg, linspace } from "../core/math/index.js";

// Or import numpy-ts directly for full access
import { np } from "../core/math/index.js";
```

### Point Representation
```typescript
import type { NDArray } from "numpy-ts";

// A 3D point is an NDArray with shape [3]
type Point3D = NDArray; // np.array([x, y, z])

// Arrays of points are NDArray with shape [n, 3]
type Points3D = NDArray; // np.array([[x0,y0,z0], [x1,y1,z1], ...])

// Constants (from core/math)
import { ORIGIN, UP, DOWN, LEFT, RIGHT, OUT, IN } from "../core/math/index.js";
```

### Python → TypeScript: NumPy Translation

Since numpy-ts mirrors NumPy, **most numpy code translates directly**:

| Python (numpy)                        | TypeScript (numpy-ts)                                      |
|---------------------------------------|-----------------------------------------------------------|
| `import numpy as np`                  | `import { np } from "../core/math/index.js"`              |
| `np.array([x, y, z])`               | `np.array([x, y, z])`                                     |
| `np.zeros(3)`                        | `np.zeros([3])`                                            |
| `np.zeros((n, 3))`                   | `np.zeros([n, 3])`                                         |
| `np.ones((n, 3))`                    | `np.ones([n, 3])`                                          |
| `np.eye(n)`                          | `np.eye(n)`                                                |
| `np.linspace(a, b, n)`              | `np.linspace(a, b, n)`                                     |
| `np.arange(start, stop, step)`      | `np.arange(start, stop, step)`                              |
| `np.linalg.norm(v)`                 | `np.linalg.norm(v)` (cast to `number` if needed)           |
| `np.linalg.solve(A, b)`             | `np.linalg.solve(A, b)`                                    |
| `np.linalg.inv(A)`                  | `np.linalg.inv(A)`                                         |
| `np.linalg.det(A)`                  | `np.linalg.det(A)`                                         |
| `np.dot(a, b)`                       | `np.dot(a, b)` (cast to `number` for scalar result)        |
| `np.cross(a, b)`                     | `np.cross(a, b)`                                            |
| `np.vstack([a, b])`                 | `np.vstack([a, b])`                                         |
| `np.hstack([a, b])`                 | `np.hstack([a, b])`                                         |
| `np.concatenate([a, b], axis=0)`     | `np.concatenate([a, b], 0)`                                 |
| `np.reshape(a, (m, n))`             | `a.reshape(m, n)`                                           |
| `a.T`                                | `a.T`                                                       |
| `np.clip(x, lo, hi)`                | `np.clip(x, lo, hi)` or `x.clip(lo, hi)`                   |
| `a + b` (broadcasting)              | `a.add(b)`                                                  |
| `a - b`                              | `a.subtract(b)`                                             |
| `a * scalar`                         | `a.multiply(scalar)`                                        |
| `a / scalar`                         | `a.divide(scalar)`                                          |
| `a[0]`                               | `a.get([0])` or `a.item(0)` (for scalar)                   |
| `a[i, j]`                            | `a.get([i, j])`                                             |
| `a[i] = v`                           | `a.set([i], v)`                                             |
| `a.shape`                            | `a.shape`                                                   |
| `a.tolist()`                         | `a.toArray()`                                               |
| `a.copy()`                           | `a.copy()`                                                  |
| `a.flatten()`                        | `a.flatten()`                                               |
| `arr[::4]` (slicing)                | `arr.slice('::4')`                                          |
| `np.mean(a, axis=0)`                | `np.mean(a, 0)`                                             |
| `np.sum(a, axis=0)`                 | `np.sum(a, 0)`                                              |
| `np.allclose(a, b)`                 | `np.allclose(a, b)`                                         |
| `np.where(cond, x, y)`              | `np.where(cond, x, y)`                                      |

**IMPORTANT**: numpy-ts functions like `dot()`, `linalg.norm()` return union types
(`number | bigint | NDArrayCore | Complex`). When you need a plain `number`, cast:
```typescript
const d = np.dot(a, b) as number;
const n = np.linalg.norm(v) as number;
```

### Manim-Specific Math (NOT in numpy)

These are Manim utilities with no numpy equivalent. Import from `core/math`:

```typescript
import {
  // Scalar interpolation
  interpolate, inverseInterpolate, integerInterpolate, clamp, sigmoid,
  // Point/vector helpers
  angleOfVector, angleBetweenVectors, rotateVector, getUnitNormal,
  centerOfMass, pointNorm, normalizePoint, pointDistance,
  interpolatePoint, midPoint,
  // Complex numbers
  complexToR3, r3ToComplex, complexMultiply,
  // Coordinate transforms
  cartesianToSpherical, sphericalToCartesian,
  // Line operations
  findIntersection,
  // Bezier (Manim-specific implementation)
  bezier, partialBezierPoints,
  // Rate functions
  smooth, linear, rushInto, rushFrom, thereAndBack, doubleSmooth,
  squishRateFunc, lingering, exponentialDecay,
  // Quaternions
  quaternionFromAngleAxis, quaternionMultiply, quaternionConjugate,
  // Matrix helpers (gl-matrix based)
  rotationMatrix, applyMatrixToPoint, applyMatrixToPoints,
} from "../core/math/index.js";
```

### Rate Functions
```typescript
// Available in core/math — match Manim's rate_functions.py exactly
import {
  smooth,           // sigmoid-based (NOT smoothstep!)
  smoothstep,       // 3t²-2t³ (different from smooth)
  linear, rushInto, rushFrom, slowInto, doubleSmooth,
  thereAndBack, thereAndBackWithPause, wiggle,
  squishRateFunc, lingering, exponentialDecay,
  easeInSine, easeOutSine, easeInOutSine,
} from "../core/math/index.js";
```

## 2. Installed Libraries — Use These, Don't Reinvent

The following npm packages are installed and available. **Use them** instead of
writing custom implementations. This saves hundreds of lines and avoids bugs.

### Rendering & Video Output
```typescript
// Headless Canvas2D for offscreen rendering (replaces Python Cairo)
import { createCanvas, Canvas, CanvasRenderingContext2D } from "@napi-rs/canvas";

// Video encoding — replaces Python's subprocess calls to ffmpeg
import ffmpeg from "fluent-ffmpeg";

// Image I/O — replaces PIL/Pillow for frame manipulation
import sharp from "sharp";
```

| Python (Manim)                           | TypeScript                                     |
|------------------------------------------|-------------------------------------------------|
| `cairo.ImageSurface(FORMAT_ARGB32,w,h)` | `createCanvas(w, h)`                            |
| `cairo.Context(surface)`                 | `canvas.getContext('2d')`                        |
| `subprocess.run(["ffmpeg", ...])`        | `ffmpeg().input(src).output(dst).run()`          |
| `PIL.Image.open(path)`                   | `sharp(path)`                                    |
| `image.save("frame.png")`               | `sharp(buffer).toFile("frame.png")`              |
| `np.array(image)` (pixel access)        | `sharp(path).raw().toBuffer()`                   |

### SVG Parsing
```typescript
// Parse SVG path d="" attributes into Bezier segments
// Replaces Python's svgelements library
import SVGPathCommander from "svg-path-commander";

// Parse: "M 0 0 C 1 2 3 4 5 6" → segment array
const pathData = new SVGPathCommander("M 0 0 C 1 2 3 4 5 6");
// Normalize all commands to absolute, convert arcs to cubics:
const normalized = pathData.normalize();
```

| Python (svgelements)                   | TypeScript (svg-path-commander)              |
|----------------------------------------|----------------------------------------------|
| `Path(d_string)`                       | `new SVGPathCommander(d_string)`              |
| `path.segments()`                      | `pathData.segments` (parsed segment array)    |
| Arc → cubic conversion                 | `pathData.normalize()` (auto-converts arcs)   |

### LaTeX Rendering
```typescript
// Render LaTeX to SVG without external tools (no pdflatex/dvisvgm needed!)
// Replaces Manim's tex_file_writing.py (~900 lines of subprocess calls)
import katex from "katex";

// Render LaTeX to SVG string, then parse SVG paths into VMobject points
const svgHtml = katex.renderToString("\\frac{a}{b}", {
  output: "mathml",  // or "html" — use "mathml" + custom SVG extraction
  throwOnError: false,
});
```

### Bezier Curves
```typescript
// Comprehensive Bezier library — splitting, bounding, intersections, arc length
import { Bezier } from "bezier-js";

const curve = new Bezier([{x:0,y:0}, {x:1,y:2}, {x:2,y:0}]);
const split = curve.split(0.5);       // De Casteljau split
const length = curve.length();         // Arc length
const bbox = curve.bbox();             // Bounding box
const lut = curve.getLUT(100);         // Lookup table (100 points)
```

### Geometry Algorithms
```typescript
// Pole of inaccessibility — replaces custom polylabel.ts (~480 lines)
import polylabel from "@mapbox/polylabel";
const [x, y] = polylabel([[[0,0],[10,0],[10,10],[0,10],[0,0]]], 1.0);

// Convex hull — replaces custom qhull.ts (~433 lines)
import convexHull from "convex-hull";
const faces = convexHull([[0,0,0],[1,0,0],[0,1,0],[0,0,1]]);
```

### Quaternions (gl-matrix — already installed)
```typescript
// gl-matrix has a full quat module — use it instead of hand-rolling
import { quat, vec3, mat4 } from "gl-matrix";

const q = quat.create();
quat.setAxisAngle(q, [0, 0, 1], Math.PI / 2);  // 90° around Z
const q2 = quat.create();
quat.multiply(q2, q1, q);                        // compose rotations
quat.conjugate(qConj, q);                        // inverse rotation
```

### Polygon Triangulation
```typescript
// Converts 2D/3D polygons to triangles — replaces Python mapbox-earcut
import earcut from "earcut";

// Flat coordinate array + hole indices → triangle index array
const coords = [0,0, 10,0, 10,10, 0,10];  // 2D polygon (x,y pairs)
const triangles = earcut(coords);            // [0,3,1, 1,3,2] — triangle indices

// With holes:
const outer = [0,0, 10,0, 10,10, 0,10];
const hole = [2,2, 8,2, 8,8, 2,8];
const allCoords = [...outer, ...hole];
const holeIndices = [outer.length / 2];      // where hole vertices start
const tris = earcut(allCoords, holeIndices);

// 3D coordinates (set dim=3):
const coords3D = [0,0,0, 10,0,0, 10,10,0, 0,10,0];
const tris3D = earcut(coords3D, null, 3);
```

| Python (mapbox-earcut)                       | TypeScript (earcut)                            |
|----------------------------------------------|------------------------------------------------|
| `earcut.triangulate_float64(coords, holes)`  | `earcut(coords, holeIndices, dim)`             |

### Graph Data Structures
```typescript
// Graph library — replaces Python networkx (used by Manim's Graph mobject)
import Graph from "graphology";

const graph = new Graph();
graph.addNode("a", { label: "Node A" });
graph.addNode("b", { label: "Node B" });
graph.addEdge("a", "b", { weight: 1.0 });

graph.forEachNode((node, attrs) => { /* ... */ });
graph.forEachEdge((edge, attrs, source, target) => { /* ... */ });
graph.degree("a");  // number of edges
```

| Python (networkx)                         | TypeScript (graphology)                        |
|-------------------------------------------|------------------------------------------------|
| `G = nx.Graph()`                          | `new Graph()`                                  |
| `G.add_node("a", label="A")`             | `graph.addNode("a", { label: "A" })`          |
| `G.add_edge("a", "b")`                   | `graph.addEdge("a", "b")`                     |
| `G.nodes`, `G.edges`                      | `graph.forEachNode(...)`, `graph.forEachEdge(...)`|
| `G.degree("a")`                           | `graph.degree("a")`                            |
| `nx.DiGraph()`                            | `new Graph({ type: "directed" })`              |

### Syntax Highlighting
```typescript
// Code syntax highlighting — replaces Python pygments
// Used by Manim's Code mobject to colorize source code
import hljs from "highlight.js";

const result = hljs.highlight("const x = 42;", { language: "typescript" });
// result.value contains HTML with <span class="hljs-..."> tokens
// Parse these spans to extract styled text ranges for Code mobject

// Auto-detect language:
const detected = hljs.highlightAuto("print('hello')");
console.log(detected.language);  // "python"
```

| Python (pygments)                              | TypeScript (highlight.js)                      |
|------------------------------------------------|------------------------------------------------|
| `pygments.highlight(code, lexer, formatter)`   | `hljs.highlight(code, { language })`           |
| `pygments.lexers.get_lexer_by_name("python")`  | `hljs.highlight(code, { language: "python" })` |
| `pygments.lexers.guess_lexer(code)`            | `hljs.highlightAuto(code)`                     |

### HTML/XML/SVG Parsing
```typescript
// jQuery-like HTML/XML parser — replaces Python beautifulsoup4
// Used for parsing SVG documents (SVGMobject) and HTML output from KaTeX
import { load } from "cheerio";

const $ = load('<svg><path d="M 0 0 L 10 10"/></svg>');
$("path").each((i, el) => {
  const d = $(el).attr("d");  // "M 0 0 L 10 10"
});
```

| Python (beautifulsoup4)                    | TypeScript (cheerio)                           |
|--------------------------------------------|------------------------------------------------|
| `BeautifulSoup(html, "html.parser")`       | `load(html)`                                   |
| `soup.find_all("path")`                    | `$("path")`                                    |
| `element.get("d")`                         | `$(el).attr("d")`                              |
| `element.text`                             | `$(el).text()`                                 |
| `element.find("g")`                        | `$(el).find("g")`                              |

### File Watching
```typescript
// File system watcher — replaces Python watchdog
// Used for live-reloading scenes during development
import { watch } from "chokidar";

const watcher = watch("src/**/*.ts", { ignoreInitial: true });
watcher.on("change", (path) => { /* file changed */ });
watcher.on("add", (path) => { /* file added */ });
```

| Python (watchdog)                          | TypeScript (chokidar)                          |
|--------------------------------------------|------------------------------------------------|
| `Observer()` + `FileSystemEventHandler`    | `watch(glob, options)`                         |
| `handler.on_modified`                      | `watcher.on("change", callback)`               |
| `observer.schedule(handler, path)`         | Glob pattern in `watch()` call                 |

### 3D Surface Generation
```typescript
// Marching cubes / isosurface extraction — replaces Python isosurfaces
// Used by Manim's Surface and ThreeDScene for implicit surface rendering
import { marchingCubes } from "isosurface";

const mesh = marchingCubes(
  [64, 64, 64],                           // grid resolution
  (x: number, y: number, z: number) =>    // signed distance function
    x * x + y * y + z * z - 1.0,          // sphere of radius 1
  [[-2, -2, -2], [2, 2, 2]]               // bounding box
);
// mesh.positions: number[][] — vertex positions
// mesh.cells: number[][] — triangle indices
```

### Path Boolean Operations
```typescript
// Polygon clipping / boolean ops — replaces Python skia-pathops
// Used for union, intersection, difference of filled shapes
import polygonClipping from "polygon-clipping";

const polyA = [[[0,0],[10,0],[10,10],[0,10],[0,0]]];
const polyB = [[[5,5],[15,5],[15,15],[5,15],[5,5]]];

const union = polygonClipping.union(polyA, polyB);
const intersection = polygonClipping.intersection(polyA, polyB);
const difference = polygonClipping.difference(polyA, polyB);
const xor = polygonClipping.xor(polyA, polyB);
```

| Python (skia-pathops)                      | TypeScript (polygon-clipping)                  |
|--------------------------------------------|------------------------------------------------|
| `pathops.op(path1, path2, "union")`        | `polygonClipping.union(polyA, polyB)`          |
| `pathops.op(path1, path2, "intersect")`    | `polygonClipping.intersection(polyA, polyB)`   |
| `pathops.op(path1, path2, "difference")`   | `polygonClipping.difference(polyA, polyB)`     |
| `pathops.op(path1, path2, "xor")`          | `polygonClipping.xor(polyA, polyB)`            |

## 3. Color

```typescript
// Import from src/core/color/index.ts
import { Color, RED, BLUE, GREEN, YELLOW, WHITE, BLACK } from "../core/color/index.js";

// Color class implements IColor from types.ts
// Color.fromHex("#FC6255"), Color.fromHSL(h, s, l), Color.fromRGB(r, g, b)
// .interpolate(other, t), .toHex(), .toArray(), .lighter(), .darker()

// IMPORTANT: YELLOW is #F7D96F (warm gold), NOT #FFFF00 (pure yellow)
// Use PURE_YELLOW for #FFFF00
```

## 4. Type Contracts

The interfaces in `src/core/types.ts` are the contracts between modules.

```typescript
// These are INTERFACES, not runtime classes:
import type {
  IMobject, IVMobject, IAnimation, IScene, ICamera, IRenderer,
  IColor, MobjectOptions, VMobjectOptions, AnimationOptions,
  ManimConfig, NDArray, Point3D, Points3D, RateFunc, Updater, ColorArray,
} from "../core/types.js";

// Your class IMPLEMENTS the interface:
class MyMobject implements IMobject { ... }

// Do NOT try to extend or import IMobject as a runtime class.
// The real base class is in src/mobject/mobject/ (when converted).
```

## 5. Configuration

Manim uses a global `config` object. We use a scoped config with defaults:

```typescript
// src/core/config.ts
interface ManimConfig {
  pixelWidth: number;       // default 1920
  pixelHeight: number;      // default 1080
  frameRate: number;        // default 30
  frameWidth: number;       // default 14.222 (logical units)
  frameHeight: number;      // default 8.0
  backgroundColor: Color;   // default BLACK
  mediaDir: string;         // default "./media"
  quality: "low" | "medium" | "high" | "fourk";
}
```

## 6. Python → TypeScript Patterns

### Classes
```python
# Python
class VMobject(Mobject):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.fill_opacity = 0.0
```
```typescript
// TypeScript — use typed options, not **kwargs
interface VMobjectOptions extends MobjectOptions {
  fillOpacity?: number;
}

class VMobject extends Mobject {
  fillOpacity: number;

  constructor(options: VMobjectOptions = {}) {
    super(options);
    this.fillOpacity = options.fillOpacity ?? 0.0;
  }
}
```

### Properties
```python
@property
def width(self) -> float:
    return self.get_width()
```
```typescript
get width(): number {
  return this.getWidth();
}
set width(value: number) {
  this.setWidth(value);
}
```

### Method Chaining
Manim methods often return `self` for chaining. Preserve this:
```typescript
setColor(color: IColor): this {
  this._color = color;
  return this;
}
```

### Python `*args` / `**kwargs`
- `*args` of a known type → rest params: `...items: IMobject[]`
- `**kwargs` for config → options object: `options: Partial<Config>`
- Mixed → explicit required params + options object

### Default Mutable Arguments
```python
# PYTHON BUG PATTERN — mutable default
def f(self, points=[]):  # shared across calls!
```
```typescript
// ALWAYS create new in body
method(points?: NDArray): void {
  const pts = points ?? np.zeros([0, 3]);
}
```

### TYPE_CHECKING imports
```python
if TYPE_CHECKING:
    from manim.scene.scene import Scene
```
```typescript
// Convert to import type (compile-time only, no runtime dep)
import type { IScene } from "../core/types.js";
```

### Lazy imports (inside function bodies)
```python
def some_method(self):
    from manim.mobject.geometry import Line  # lazy to break cycle
```
```typescript
// Convert to top-level import — TS modules handle cycles differently
import { Line } from "../geometry/index.js";
```

## 7. Module Structure

Each converted module must include:
- Implementation files mirroring the Python structure
- `index.ts` barrel export with all public API
- No circular imports (restructure if the Python has them)

## 8. Error Handling

Python Manim uses exceptions liberally. Convert to:
- `throw new Error(...)` for logic errors
- Return `null | undefined` for "not found" cases
- Custom error classes only for frequently-caught categories

## 9. Testing

**Pre-existing tests take priority.** If `tests/<module>.test.ts` exists, your
code must make it pass. If not, write tests:

```typescript
import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js"; // for toBeCloseToPoint

describe("MyClass", () => {
  it("constructs with defaults", () => { ... });
  it("core method works", () => { ... });
  it("handles edge cases", () => { ... });
});
```

Run `npm run test` after conversion to verify.

## 10. Rendering

Rendering is the ONE area where we rewrite rather than translate:
- Python Manim Cairo → **@napi-rs/canvas** (headless Canvas2D for Node.js)
- Python Manim OpenGL → **WebGL2** (3D scenes, browser)
- Video output → **fluent-ffmpeg** (replaces subprocess calls to ffmpeg)
- Image I/O → **sharp** (replaces PIL/Pillow)

```typescript
// Frame rendering
import { createCanvas } from "@napi-rs/canvas";
const canvas = createCanvas(1920, 1080);
const ctx = canvas.getContext("2d");
// ... draw with standard Canvas2D API ...
const buffer = canvas.toBuffer("image/png");

// Video encoding
import ffmpeg from "fluent-ffmpeg";
ffmpeg()
  .input(framePattern)
  .inputFPS(30)
  .output("scene.mp4")
  .videoCodec("libx264")
  .run();

// Image manipulation
import sharp from "sharp";
await sharp(buffer).resize(960, 540).toFile("thumbnail.png");
```

Do NOT translate Cairo API calls line-by-line — use the Canvas2D API equivalents.
Do NOT translate OpenGL calls line-by-line — flag with TODO for WebGL2 implementation.

## 11. Module Boundaries

**CRITICAL: Do NOT modify files outside your assigned module directory.**
- Never edit `src/core/*` — these are shared foundations
- Never edit another module's files
- Never edit `CONVENTIONS.md`, `CLAUDE.md`, or `package.json`
- If you need something from core that doesn't exist, use a TODO comment
