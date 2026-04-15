# manim-ts — Road to v1.0.0 / first npm publish

_Last revised: 2026-04-15. Branch: `main`._

---

## 1. Executive summary

The engine is in good shape — all 134 modules in `task-graph.json` are
converted, `tsc --noEmit` is **clean**, and the new 57-scene parity harness
(`scripts/parity/`) is **57 / 57 green** at a 0.1% threshold, 36 of those
byte-identical to Python Manim's Cairo output. Several of the original v1.0
blockers have been resolved in the 2026-04-15 batch:

- **`package.json#exports["."]` now points at the real top-level barrel**
  (`./src/__init__/index.ts`). Top-level `import … from "manim-ts"` resolves.
- **libcairo parity on Node** — swapped `@napi-rs/canvas` for `canvas`
  (node-canvas, libcairo bindings). Node-side rasterization now matches
  Python Manim's pycairo pipeline byte-for-byte.
- **Polygram color cascade, DashedLine open-curve dash formula, Cairo
  stroke cap/join defaults, 3D Cairo depth sort, and CairoBackend submobject
  family expansion** are all fixed. These are load-bearing for the parity
  harness's green state.

The project is **still not quite publishable today**, but the remaining
blockers are smaller than before:

1. **No `dist/` build pipeline.** `package.json` is still missing `main` /
   `types` / `files`; `npm run build` would need to actually emit to `dist/`
   and the `exports` map needs to be rewritten to point at compiled `.js`.
2. **Sub-barrel gaps.** `src/animation/index.ts` and `src/mobject/index.ts`
   still re-export very little — the top barrel wires them through, but the
   intermediate barrels need to fan out their sub-modules.
3. **Two color systems coexist.** `Color` (`src/core/color/`) vs. `ManimColor`
   (`src/utils/color/manim_colors.ts`) with the same palette names. Still
   unresolved; pick one before the first tagged release.
4. **45 pre-existing test failures.** Concentrated in `matrix`, `table`,
   `three_smoke`, `renderer_mode`, `vector_space_scene`. Not regressions
   from this batch.
5. **No LICENSE, no CI for tests/typecheck.** `.github/workflows/` only has
   the gallery deploy.

A "v0.1.0 public preview" is achievable in **1–2 days of focused work** —
add the build step, fan out the intermediate barrels, add a LICENSE, add CI.
Real **v1.0.0** is gated on (a) deciding the dual-color-system question,
(b) settling the `renderer: "cairo" | "opengl"` config name permanently
(now that Node-side libcairo makes "cairo" literally accurate), and (c)
broadening the parity corpus past the current 57 scenes.

The npm name `manim-ts` is **available** (registry returned 404).

---

## 2. Current state snapshot

### Conversion (from `task-graph.json` + `results.json`)

| Metric | Value |
|---|---|
| Total modules in graph | **134** across **27 layers** |
| Successful agent runs | **170** (re-runs included) |
| Failed agent runs | **2** (`mobject.graphing.coordinate_systems`, `threejs.demo.real_demo`) |
| All graph modules covered | yes — every layered module has at least one success entry |

### Quality gates

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS — clean** |
| `npm test` (`vitest run`) | **45 failed / 2802 passed / 22 skipped** across 7 failing test files |
| `npm run build` (`tsc`) | exists but never run; would need `outDir` wiring & `files` allowlist |
| `npm run docs:build` | not exercised in this audit (Docusaurus site under `docs/`) |
| Static site (`site/`) | `site/dist/` already built |

### Failing test files

| File | Likely cause |
|---|---|
| `tests/mobject/matrix.test.ts` (16 fails) | Matrix class likely not constructing its `mobMatrix`/bracket children — probably options-shape mismatch |
| `tests/mobject/table.test.ts` (~11 fails) | Same shape: `vBuff`/`hBuff` undefined, child VGroups not built |
| `tests/renderer/renderer_mode.test.ts` (5 fails) | ThreeBackend smoke under jsdom — needs WebGL mock or `// @vitest-environment node` |
| `tests/renderer/three_smoke.test.ts` (4 fails) | Same WebGL-in-jsdom story |
| `tests/scene/vector_space_scene.test.ts` (3 fails) | `getBasisVectors` / `LinearTransformationScene.setup` regression |
| `tests/mobject/graphing/coordinate_systems.test.ts` (≥2 fails) | `PolarPlane.getRadianLabel` — known agent failure module |
| `tests/mobject/graphing/probability.test.ts` (≥4 fails) | `SampleSpace` constructor not honoring `width`/`height`/`defaultLabelScaleVal` options |
| (Unhandled) `src/__main__/index.ts:21` | `process.exit(1)` is called during the `tests/utils/ipython_magic.test.ts` run — `__main__` module side-effect-imports during test collection |

### Public API surface (`src/__init__/index.ts`, 419 lines)

Wired exports:

- `core/math/*` (np, point/vector helpers, rate functions, bezier, quaternions)
- `core/color/*` (the `Color` class — **NOT** `ManimColor` — and all 80-odd palette names)
- `core/types` (interface contracts)

Unwired exports (TODO comments still in place):

- `animation/*` — entire animation namespace (Create, Transform, FadeIn/Out, AnimationGroup, …)
- `camera/*` — Camera, MovingCamera, ThreeDCamera (sub-barrel exists and is complete)
- `mobject/*` — every shape, text, graph, 3D primitive, value tracker, vector field
- `renderer/*` — Scene backend exports (sub-barrel exists for Cairo path)
- `scene/*` — **Scene class itself**, ThreeScene, Section, SceneFileWriter (sub-barrel exists and is complete)
- `utils/*` — file_ops, iterables, simple_functions, paths, tex (most have impls; barrel needs export *)
- `_config/*` — global `config` singleton, `tempconfig`, logger
- `plugins/*`

### Sub-barrel completeness

| Sub-barrel | State |
|---|---|
| `src/animation/index.ts` | **only re-exports `IAnimation` type** — every animation class is unreachable through the barrel |
| `src/mobject/index.ts` | **3 lines, no exports at all** (just the package marker comment) |
| `src/scene/index.ts` | complete (Scene, ThreeScene, Section, SceneFileWriter) |
| `src/renderer/index.ts` | partial (Cairo backend only; Three backend unwired) |
| `src/camera/index.ts` | complete (Camera, MovingCamera, ThreeDCamera) |
| `src/utils/index.ts` | partial (deprecation, iterables, images, unit) |
| `src/_config/index.ts` | self-contained (105 lines), but not re-exported from top barrel |

So even if the top barrel were turned on with `export * from "./animation"` etc., **`animation` and `mobject` would still export nothing** — those barrels need to be filled in first.

---

## 3. Blockers for first npm publish

Ordered. Effort: S = <½ day, M = ½–2 days, L = >2 days.

### RESOLVED in 2026-04-15 batch
- `package.json#exports["."]` now points at `./src/__init__/index.ts` (the
  real top-level barrel). Top-level imports resolve.
- Node Cairo renderer now wraps libcairo directly (via `canvas` /
  node-canvas) instead of `@napi-rs/canvas`. `scripts/parity/` proves
  byte-level parity with Python Manim's pycairo pipeline on 36 / 57 scenes
  and visual parity (< 0.1% pixel diff) on the remaining 21.
- Polygram fill color cascade bug, DashedLine open-curve dash formula, Cairo
  butt/miter defaults, CairoBackend submobject family expansion, and 3D
  Cairo depth sort via `ThreeDCamera.getMobjectsToDisplay` — all fixed. See
  `CHANGES.md` (2026-04-15).

### B1. Build pipeline emits no consumable artifact — **S**
- **Problem:** `package.json#exports` maps `.` → `./src/__init__/index.ts` (the real barrel — the path is now correct, but it still points at raw `.ts`). There is no `main`, `module`, `types`, or `files` field. `npm pack` would ship the entire repo (or nothing useful). Consumers cannot import `.ts`.
- **Fix:**
  - `npm run build` → `tsc` (already configured `outDir: ./dist` in `tsconfig.json`).
  - In `package.json`: set `"main": "./dist/__init__/index.js"`, `"types": "./dist/__init__/index.d.ts"`, `"files": ["dist", "README.md", "LICENSE", "CHANGES.md"]`, and remap every `exports` entry to `./dist/...js` with conditional `"types"` siblings.
  - Add `"prepublishOnly": "npm run typecheck && npm run build"`.
  - Verify `tsc` actually emits — `src/orchestrator.ts` and `src/prompt-builder.ts` import Node-only stuff (`child_process`, `fs/promises`); add them to `tsconfig.json#exclude` so the published `dist/` doesn't drag them in.
  - Decide on dual-publish (CJS+ESM) — current `"type": "module"` makes ESM-only the path of least resistance for v0.x.

### B2. Top-level barrel only exports `core/` — **M**
- **Problem:** `src/__init__/index.ts` lines 319–418 are all TODO. The README's quick-start (`import { Scene, Circle, Create, BLUE } from "manim-ts"`) would not resolve.
- **Fix:** Replace the seven TODO blocks with `export * from "../animation/index.js"` (etc.) and `export { config } from "../_config/index.js"`. Then **fix B3 first**, since the animation/mobject sub-barrels are themselves empty.

### B3. `src/animation/index.ts` and `src/mobject/index.ts` re-export nothing — **M**
- **Problem:** `src/animation/index.ts` is 11 lines that only re-export the `IAnimation` type from core. `src/mobject/index.ts` is 3 lines of comments. Every animation/mobject implementation that lives in `src/animation/<feature>/index.ts` and `src/mobject/<feature>/index.ts` is unreachable through the package boundary.
- **Fix:** Mechanical — add `export * from "./animation/index.js"`, `export * from "./changing/index.js"`, … (15 sub-modules under animation, ~12 under mobject). Each sub-barrel already exports its public surface. After this, also add `export type { ... }` re-exports for option types.

### B4. Two coexisting color systems — **M (decision) + S (impl)**
- **Problem:** Documented in `CLAUDE.md` and `MEMORY.md`. `core/color` exports `Color`, `utils/color/manim_colors` exports `ManimColor`, both with identical palette names. The top barrel exports the `Color` constants. Anything that reaches `Surface`, `Polyhedron`, or any `ManimColor.parse(...)` site with a `Color` instance throws a confusing type error.
- **Fix options:**
  - (a) Make `ManimColor` extend `Color` (or vice versa) so `parse` accepts both.
  - (b) Re-export the `manim_colors` palette from the top barrel and **remove** the `core/color` palette re-export — single source of truth.
  - (c) Internally, make `ManimColor.parse` fall back to `Color` instances.
- **Recommendation:** (b) + (c). Pick this **before 0.1.0** — it changes what colour constants users import, which is an API break if changed later.

### B5. `LICENSE` file is missing — **S**
- **Problem:** No license file in the repo. npm publish doesn't require it but it's near-malpractice to ship without one, and the upstream Manim is MIT-licensed (you must include their notice in `LICENSE` if you want to redistribute their docstrings/algorithms).
- **Fix:** Add MIT `LICENSE` (or whatever you want), and a `THIRD_PARTY_NOTICES.md` reproducing Manim's MIT notice plus the licenses of the 17 vendored deps (most are MIT/Apache-2.0).

### B6. 45 failing tests — **M**
- **Problem:** Most are concentrated. Three clusters:
  - `Matrix`/`Table` (~27 fails) — almost certainly options-shape regression after a recent refactor; the constructors aren't applying user-supplied dims.
  - `ThreeBackend` smoke tests (~9 fails) — WebGL not available in jsdom; switch the test file to `// @vitest-environment node` or mock `THREE.WebGLRenderer`.
  - `SampleSpace`, `PolarPlane.getRadianLabel`, `LinearTransformationScene` — small individual fixes.
- **Plus:** the `process.exit(1)` from `src/__main__/index.ts` leaks into the test run — guard with `if (import.meta.url === \`file://${process.argv[1]}\`)` or similar.

### B7. Heavy Node-only deps are in `dependencies`, not `optionalDependencies` — **S**
- **Problem:** `canvas` (node-canvas), `sharp`, `fluent-ffmpeg`, `mathjax-full` are 100+ MB combined and are useless in browser-only consumers. They're currently hard `dependencies`.
- **Fix:** Move to `optionalDependencies` and add runtime guards (lazy `await import(...)`) at the call sites in `scene_file_writer/`, `cairo/`, `images/`. Mark `react`/`vue` as already-correct optional peer deps.

### B8. CI for tests/typecheck does not exist — **S**
- **Problem:** Only `.github/workflows/deploy-gallery.yml` exists.
- **Fix:** Add `.github/workflows/ci.yml` running `npm run typecheck && npm run test && npm run build` on push/PR, on Node 20 + 22, on `ubuntu-latest`. Block merges on red.

### B9. `README.md` examples reference non-existent / partly-existent exports — **S**
- **Problem:** README promises `https://cdn.jsdelivr.net/npm/manim-ts/dist/manim-ts.browser.js`. There is no browser bundle build; `vite build` against `demo/` produces something else. Also references `TimelineControls` and `<ManimScene>` React component — verify those are exported once B2/B3 are done.
- **Fix:** Either ship a Vite UMD/IIFE bundle as `dist/manim-ts.browser.js`, or update the README to use `import` from a CDN that supports ESM (`esm.sh/manim-ts`).

---

## 4. Nice-to-haves before 1.0 (track but defer)

- **Local stubs in `src/mobject/svg/brace.ts`** — file still has `// TODO: Replace these stubs with real imports` for Arc, Tex/MathTex/Text, animation classes, and an internal Line. The real implementations now exist; switch the imports. Same for any `vector_field.ts` / graph stubs noted in `MEMORY.md`.
- **`renderer.vectorized_mobject_rendering` and `scene.zoomed_scene` opus re-runs.** Both have `not implemented` markers — re-run with `--model=opus --timeout=900` per `CLAUDE.md`.
- **Replace `Color` type discriminator code** that uses `"shape" in ndarray` (numpy-ts proxy bug from `MEMORY.md`).
- **Add `engines.node`** (>=20).
- **`sideEffects: false`** in `package.json` if true (check `_config/index.ts` bootstrap — it likely *does* have side effects, so probably keep absent or list specific files).
- **Bundle size budget**: ensure the browser entry, after tree-shaking, stays under ~500 KB gzip without 3D / video codepaths.
- **Visual regression tests** against a frozen corpus of Python ManimCE PNG outputs (`tests/golden-data/` already has scaffolding). This is the only honest answer to "are we 1:1 with Python Manim?"
- **Docs**: `docs/` is a Docusaurus site; verify `npm run docs:build` is green and the sidebar paths in `docs/sidebars.ts` resolve.
- **CONTRIBUTING.md** with the conversion conventions that currently live in `CONVENTIONS.md`.
- **Demo bundle** for `demo/real-demo.ts` — verify it runs end-to-end under both Cairo and OpenGL backends; the failing `threejs.demo.real_demo` agent run suggests it does not yet.

---

## 5. Suggested phases

### Phase 0 — `0.1.0` "public preview" (target: this week)
Publishable, honest, clearly preview-quality. Scope = **B1, B2, B3, B5, B7, B8, B9**.
- Ship the build pipeline.
- Wire all sub-barrels.
- Add LICENSE + minimal CI.
- README's quick-start works on a clean machine: `npm i manim-ts && node -e "import('manim-ts').then(m => new m.Scene(...))"`.
- Mark in README that **Three / OpenGL backend is experimental** and that 3D under Cairo uses painter's-algorithm depth sort (no z-buffer).
- Pin `canvas` (node-canvas), `sharp`, etc. as optional.
- Leave the 45 failing tests as-is **only if** they don't represent runtime breakage in the public API; otherwise fix the matrix/table cluster (B6 partial).

### Phase 1 — `0.2.x` "stabilize" (target: 2–4 weeks)
Scope = **B4 (color decision), B6 (all tests green), brace.ts/graph.ts stub removal**.
- Single color system. Migrate every internal `Color` instance to `ManimColor` or vice versa. Document in CHANGES.md as a breaking change (justifies 0.1 → 0.2 bump).
- Tests at 100% green; no `process.exit` leak.
- Fill in the painter's-algorithm gaps and add a `requires3DScene()` guard with a clear error if a user puts a `Sphere` in a plain `Scene` without `ThreeDCamera`.

### Phase 2 — `0.5.x` "feature parity" (target: 2–3 months)
- Visual regression suite vs Python ManimCE on ≥30 canonical scenes.
- Browser bundle (`vite build --lib`) shipped as `./dist/manim-ts.browser.js`, referenced from README and `<script type="module">` examples.
- All `vector_field`, `coordinate_systems`, `code_mobject`, `text_mobject` interactions verified against Python output.
- Plugin API documented (`src/plugins/`).

### Phase 3 — `1.0.0` "stable API" (target: when there's external use)
- API frozen. Any change requires a major bump.
- Renderer config naming (`"cairo" | "opengl"`) decided permanently — see Risks below.
- React + Vue wrappers covered by their own integration tests.
- TypeScript declarations land cleanly in editor IntelliSense for every public symbol.
- LTS Node matrix (20, 22, next-current) green in CI.

---

## 6. Risks (things that could force a major version later)

1. **`renderer: "cairo" | "opengl"` naming.** On Node the name is now literally accurate — `CairoBackend` calls into libcairo through `canvas` (node-canvas). In the browser, `"cairo"` still means native Canvas2D and `"opengl"` still means three.js/WebGL. We chose those names to mirror Python ManimCE's `config.renderer`. Changing the name post-1.0 is a breaking change. **Decide before 0.1.0** whether to keep ManimCE's names (recommended for portability, and now literally accurate on Node) or switch to `"canvas2d" | "webgl"`.

2. **Two color systems unresolved (B4) is the single biggest API-shape risk.** If `Color` ships in the top-level barrel for 0.1.0 and we then switch to `ManimColor`, every user import breaks.

3. **`MobjectOptions` shape vs Python's `**kwargs`.** Some classes (per the failing matrix/table tests) appear to have inconsistent option-shape conventions. A second pass to standardize on `{ width, height, ...rest }`-style options across all mobjects is worth doing before users write code against them.

4. **Numpy-ts Proxy `in` operator** (per `MEMORY.md`) is a latent foot-gun. Any future contributor will rediscover it; codify a lint rule or replace `"prop" in ndarray` checks with `value.prop !== undefined` everywhere now.

5. **`.ts` imports in `exports` field today** suggest a culture of "consumers will run our TS directly." That works for local demo but breaks Bun / Node / Webpack 4 / older bundlers. Commit to the dist/ pattern in 0.1.0 and don't waver.

6. **Painter's-algorithm 3D under Cairo has no z-buffer.** Self-intersecting surfaces will render with visible sort artifacts. Document this as a known limitation in the README and the `renderer-modes.md` doc, **before** users build content that depends on it looking right.

7. **`_config` global singleton** — Python Manim relies on a process-wide singleton. In a browser/SSR/multiple-scene-per-page world that doesn't fly. Decide whether to keep the singleton or pass `config` per-Scene before users write plugins against it.

8. **No `manim` CLI yet** in `src/cli/` despite the dir existing. Decide: is `manim-ts` library-only, or does it need a `bin` entry too? If yes, the `bin` field plus a shebang on the entry script must land before 0.1.0 (changing it later is a breaking change for any script that does `npx manim-ts`).

---

_Audit produced without modifying any source files. All file paths are absolute under `c:\Users\andre\OneDrive\Desktop\Tanim\`._
