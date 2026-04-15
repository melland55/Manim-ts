# Polygon Parity Investigation

## 1. Summary

**Root cause: `Polygram` constructor intercepts the `color` option and forwards
only `strokeColor` to its `VMobject` super-constructor, so `fillColor` silently
falls through to `DEFAULT_FILL_COLOR` (`WHITE`) for every `Polygon`,
`Rectangle`, `Square`, `RegularPolygon`, `Star`, `Triangle`, and
`RoundedRectangle`.** This is a pure option-plumbing bug in
`src/mobject/geometry/polygram/polygram.ts` lines 305–313. It is not a
rasterizer, path-closure, miter, stroke-width, or AA issue. Circles, arcs, and
lines are unaffected because `Circle`/`Arc`/`Line` do not go through
`Polygram`; they construct directly on top of `VMobject` whose constructor
correctly cascades `color` → both `fillColor` and `strokeColor`
(`vectorized_mobject.ts:86–89`).

## 2. Evidence

### 2.1 Diff images (what the red pixels look like)

Opened the diff PNGs in the viewer:

- `out/SingleSquare-diff.png` — ENTIRE interior of the square is red.
  The outline/edges are NOT red (stroke matches). Only the filled area differs.
- `out/RainbowBars-diff.png` — same pattern: every bar's interior is red.
- `out/GridOfSquares-diff.png` — all 16 square interiors red; outlines clean.
- `out/TriangleBasic-diff.png` — whole triangle interior red.
- `out/ArcQuarter-diff.png`, `CircleStrokeOnly-diff.png`, etc — pass (curved
  shapes).

Pattern is uniform solid-fill divergence, not a ring of red along edges.
This is incompatible with any edge-alignment, miter, stroke-width, or path-
closure hypothesis, all of which would produce a 1–3 px-wide ring of red
along the shape boundary.

### 2.2 Comparison of rendered fills (SingleSquare scene)

| Side   | Rendered fill color | Notes                                    |
| ------ | ------------------- | ---------------------------------------- |
| Python | green               | `Square(color=GREEN, fill_opacity=0.8)`  |
| TS     | light gray (~204)   | white rasterized at 0.8 on black bg      |

Light gray at ~204/255 is exactly `WHITE * 0.8` composited on black — the
signature of `fillColor = WHITE` with `fillOpacity = 0.8`.

For `RainbowBars` (fillOpacity = 1.0), TS renders every bar pure white —
again consistent with `fillColor = WHITE`.

### 2.3 Source trace — where `color` is dropped

`src/mobject/geometry/polygram/polygram.ts:301-313`:

```typescript
export class Polygram extends VMobject {
  constructor(vertexGroups, options: PolygramOptions = {}) {
    const resolvedColor = options.color ?? options.strokeColor ?? BLUE;
    // Strip `color` from options to avoid passing it to Mobject's constructor
    const { color: _c, ...restOpts } = options;
    super({
      ...restOpts,
      strokeColor: resolvedColor,   // ← only strokeColor, not fillColor
    });
    this.strokeColor = resolvedColor;
    ...
  }
}
```

This explicitly removes `color` from the options bag and then supplies *only*
`strokeColor` to `super(...)`. In the base VMobject constructor
(`src/mobject/types/vectorized_mobject.ts:81-89`):

```typescript
super({ color: options.color as ParsableManimColor | undefined });
const colorFallback = (options.color as IColor | undefined) ?? undefined;
this.fillColor   = options.fillColor   ?? colorFallback ?? DEFAULT_FILL_COLOR;
this.strokeColor = options.strokeColor ?? colorFallback ?? DEFAULT_STROKE_COLOR;
```

Because Polygram stripped `color`, `colorFallback` inside VMobject is
`undefined`, so `fillColor` resolves to `DEFAULT_FILL_COLOR` which is `WHITE`
(`vectorized_mobject.ts:50`). The stroke is set correctly because Polygram
explicitly passes `strokeColor: resolvedColor`.

### 2.4 Python Manim reference

In ManimCE (`manim/mobject/types/vectorized_mobject.py`, `VMobject.__init__`),
the `color` kwarg is used as the fallback for BOTH `fill_color` and
`stroke_color`. `Polygram.__init__` simply forwards `**kwargs` up the chain
with no special handling of `color`, so a `Polygon(color=GREEN)` ends up with
`fill_color = stroke_color = GREEN`. That matches the green-filled Python
output we observe.

### 2.5 Cairo backend is fine

`src/renderer/cairo/cairo_backend.ts:277-294` reads `mob.fillColor` /
`mob.fillOpacity` directly and calls `ctx.fill("evenodd")`; stroke settings
(`lineJoin = "round"`, `lineCap = "round"`, `lineWidth = strokeWidth * 0.01 *
scaleX`) match Python Manim's `CAIRO_LINE_WIDTH_MULTIPLE` convention. The
backend renders whatever `fillColor` is on the mobject — and that value is
wrong before it ever reaches the backend.

## 3. Ruled out

1. **Half-pixel edge alignment** — diff is solid interior, not edge ring.
2. **Stroke join / miter** — outlines match exactly in the diffs.
3. **Path closure** — would show as a corner defect; not observed.
4. **Cubic Bezier straight-edge encoding** — would warp the edge, not
   change the interior solid fill.
5. **Stroke width units** — strokes match; confirmed by the Cairo backend
   already applying the `0.01` multiplier (`cairo_backend.ts:290`).
6. **Point precision / rounding** — no rounding in pipeline, and a rounding
   issue would not repaint the fill WHITE.
7. **Fill rule (evenodd vs nonzero)** — irrelevant for convex polygons; the
   entire fill is wrong color, not just self-intersection regions.
8. **Color space / alpha / background** — background matches; curved scenes
   with translucent fills match byte-for-byte.

## 4. Proposed fix

Change `Polygram` constructor to pass `color` through to the base constructor
so VMobject's existing cascade populates both fill and stroke. The simplest
patch:

```typescript
// src/mobject/geometry/polygram/polygram.ts, lines 301-313
export class Polygram extends VMobject {
  constructor(vertexGroups, options: PolygramOptions = {}) {
    const resolvedColor = options.color ?? options.strokeColor ?? BLUE;
    super({
      ...options,
      color: resolvedColor,   // let VMobject cascade to fill + stroke
    });
    // No need to re-assign this.strokeColor — VMobject already did it.

    for (const vertices of vertexGroups) { ... }
  }
}
```

The original "strip `color` to avoid ManimColor.parse rejection" comment is a
stale concern — the imported `BLUE`/`WHITE` here come from
`src/core/color/index.ts`, not `utils/color/manim_colors`, but VMobject at
line 81 casts `color` to `ParsableManimColor` and feeds it to Mobject which
calls `ManimColor.parse`. Per `CLAUDE.md` "Two color systems coexist",
`ManimColor.parse` rejects `Color` instances. That means *this* fix needs
one of:

**Option A (preferred):** switch the local imports in `polygram.ts` from
`../../../core/color/index.js` to
`../../../utils/color/manim_colors.js` so `BLUE` / `WHITE` become
`ManimColor` instances, and then pass `color` through to super.

**Option B:** keep the current defaults but explicitly forward both
`fillColor` and `strokeColor`:

```typescript
super({
  ...restOpts,
  fillColor:   options.fillColor   ?? resolvedColor,
  strokeColor: options.strokeColor ?? resolvedColor,
});
```

Option B is the minimal, lowest-risk edit — one change, does not touch the
color-system import situation.

## 5. Estimated recovery

Applying the fix should pass (or tighten to ≤ AA-noise levels):

- SingleSquare
- RectangleWide
- RoundedSquare
- TriangleBasic, FlippedTriangle
- RegularPentagon, RegularHexagon, RegularHeptagon
- Star5, Star8
- IrregularPolygon
- RotatedSquare, Rotated45Square, Rotated90Square
- ScaledNonUniform
- GridOfSquares
- RainbowBars
- Any composed scenes whose mobjects are polygon-derived (Axes2D partially —
  its tick/label mobjects include text that has independent issues, but the
  axis bodies are lines and should already pass).

Expected to still drift:

- `ManyMobjects` — documented RNG mismatch (Mersenne Twister vs mulberry32),
  unrelated to this bug.
- Text-bearing scenes, if any — separate MathJax/opentype pipeline.
- Scenes using `Polygon` where Python Manim applies an additional implicit
  shading (none in the current suite, but 3D polyhedra would need a
  separate check).

## 6. Open questions

1. Should the fix be Option A (migrate imports) or Option B (forward both
   colors)? Option B ships faster; Option A removes the latent
   `Color`-vs-`ManimColor` footgun flagged in `CLAUDE.md`. Recommend B now,
   A as a follow-up cleanup touching all of `geometry/*`.
2. Does the same pattern exist in other `VMobject` subclasses that accept a
   `color` option and strip it? Quick grep candidates: `Arc`, `Line`,
   `Arrow`, `Dot`. Diffs for those scenes pass, so probably not — but worth
   a 5-minute audit when applying the fix.
3. Do `RegularPolygram` (`density > 1`) and `Star` need any additional
   treatment? Both currently flow through `Polygram` super, so the same
   single fix covers them.

## Phase 2 — dash/arrow follow-ups

After the Polygram fix, three scenes still failed: `DottedLine` (0.21%),
`DoubleArrowScene` (0.12%), `Axes2D` (0.48%). A `pngjs`-based diff-region
analyser (`scripts/parity/debug/analyze_diff.mjs`) was the key step — it
showed all three failures shared a single upstream cause, not three
independent ones.

### 1. CairoBackend did not walk submobject families

**Root cause.** `CairoBackend._collectSortedFamily`
(`src/renderer/cairo/cairo_backend.ts:197-212`) intentionally rendered *only*
the mobjects added via `addMobject` — the comment claimed callers had to
pre-flatten. That contract held for the three.js `FamilySyncer` path, but
**Python Manim renders the full family**, and our parity harness
(and scene code generally) doesn't pre-flatten. The consequence:

* `DashedLine` keeps its 60 dashes in `submobjects` and clears its own
  points, so the Line rendered nothing.
* `Arrow` / `DoubleArrow` keep their tip(s) as submobjects — the shaft was
  drawn, the arrowheads weren't.
* `Axes` keeps tick marks as submobjects of each `NumberLine` — ticks didn't
  render.

`ArrowScene` was incidentally passing because a single missing tip (~200
px) is under the 0.1% (≈410 px) threshold; `DoubleArrowScene` doubled that
and `DottedLine` was entirely missing.

**Edit.** `src/renderer/cairo/cairo_backend.ts:197` — `_collectSortedFamily`
now expands each stored mobject via `getFamily(true)` (deduplicating),
then sorts by zIndex. The 3D path (`ThreeDCamera.getMobjectsToDisplay`) is
left alone — it already handles family traversal itself.

### 2. DashedLine used the wrong void-length formula

**Root cause.** `createDashedVMobject`
(`src/mobject/geometry/line/line.ts:88-115`) computed dashes as
`fullDAlpha = 1/n`, `partialDAlpha = (1/n) * r`, which is equivalent to
`dash_len = r/n`, `void_len = (1-r)/n`. That's Python Manim's **closed-curve**
formula. For open curves (like `Line`), Python uses
`void_len = (1-r)/(n-1)` so the first dash starts at 0 and the last ends
at 1. Our old formula left a `(1-r)/n` gap at the end of the line and
shifted every dash phase by a small amount relative to Python.

**Edit.** Rewrote `createDashedVMobject` to use the open-curve spacing
(`dash_len = r/n`, `void_len = (1-r)/(n-1)`) and build dashes at
`i * period`. Matches `mobject/types/vectorized_mobject.py`
`DashedVMobject` lines 2879-2900 in the Python source.

### 3. Round line caps inflated dashes past their gaps

**Root cause.** `_renderVMobject` unconditionally set
`ctx.lineCap = "round"` and `ctx.lineJoin = "round"`. Python Manim's Cairo
camera only overrides cap/join when the mobject sets them to a non-AUTO
value (`camera/camera.py:818-821`), so by default it gets Cairo's native
**BUTT / MITER** caps. With round caps on a 3-px dash at a 3.6-px stroke,
every dash extended by ~1.8 px on each end, swallowing the gaps — the 60
dashes rendered as one continuous bar.

**Edit.** `src/renderer/cairo/cairo_backend.ts:291-296` — line cap/join
forced to `"butt"` / `"miter"` to match Python Manim's Cairo defaults.
(The defaults are also Canvas2D's native defaults, but being explicit
guards against leaked prior state.)

### Final results

All 57 parity scenes pass.

| Scene | Before | After |
|---|---|---|
| DottedLine | 0.2147% FAIL | 0.0000% PASS |
| DoubleArrowScene | 0.1171% FAIL | 0.0000% PASS |
| Axes2D | 0.4791% FAIL | 0.0107% PASS |

Total: 57 / 57 pass, 36 of them byte-identical. `npm run typecheck`
clean.
