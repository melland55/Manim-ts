# Changes

## 2026-04-13 — Convert camera.camera

- `src/camera/camera/camera.ts`: Full `Camera` class implementing `ICamera` from `core/types.ts`; replaces the simplified stub at `src/camera/camera.ts` with the complete Python Manim `camera.camera` API surface
  - Constructor with all Python parameters (backgroundImage, frameCenter, imageMode, nChannels, useZIndex, etc.) defaulting from global config
  - Background management: `initBackground`, `setBackground`, `makeBackgroundFromFunc`, `setBackgroundFromFunc`, `reset`
  - Pixel array management: `setPixelArray`, `convertPixelArray`, `getImage`
  - Mobject display pipeline: `captureMobjects`, `getMobjectsToDisplay`, `typeOrRaise` with batch grouping by type
  - VMobject rendering via Canvas2D: `displayVectorized`, `setCanvasContextPath`, `applyFill`, `applyStroke`, `setCanvasContextColor` with line join/cap support
  - Coordinate conversion: `pointsToSubpixelCoords`, `pointsToPixelCoords`, `worldToPixel`, `pixelToWorld`, `getCoordsOfAllPixels`
  - Frame utilities: `resizeFrameShape`, `resetPixelShape`, `adjustedThickness`, `isInFrame`, `onScreenPixels`
  - Point manipulation: `adjustOutOfRangePoints`, `transformPointsPreDisplay`, `thickenedCoordinates`
  - `BackgroundColoredVMobjectDisplayer` class for VMobjects with background images
  - Cairo-specific rendering marked with TODO comments for Canvas2D/WebGL2 ports
- `src/camera/camera/index.ts`: barrel export
- Updated import paths in `mapping_camera`, `moving_camera`, `cairo_renderer`, `scene`, `moving_camera_scene` to resolve new directory structure
- All 31 pre-existing camera tests pass; no regressions in 2164 total tests

## 2026-04-12 — Convert renderer.vectorized_mobject_rendering

- `src/renderer/vectorized_mobject_rendering/types.ts`: `IOpenGLVMobject`, `IOpenGLRenderer`, `IOpenGLCamera`, `TriangulationVertex` interfaces
- `src/renderer/vectorized_mobject_rendering/vectorized_mobject_rendering.ts`: `buildMatrixLists` (DFS hierarchy traversal grouped by accumulated model matrix), `triangulateMobject` (cached fill-triangulation splitting Bézier region into concave/convex/interior triangles via earcut), `renderOpenGLVectorizedMobjectFill` and `renderOpenGLVectorizedMobjectStroke` (GPU draw calls stubbed with TODO — context is null in non-GPU environments)
- `src/renderer/vectorized_mobject_rendering/index.ts`: barrel export
- `tests/renderer/vectorized_mobject_rendering.test.ts`: 16 tests covering all public API

## 2026-04-12 — Convert renderer

- `src/renderer/renderer.ts`: `Renderer` class implementing `IRenderer` from `core/types.ts`; uses Canvas2D via `@napi-rs/canvas` (Node.js) or `HTMLCanvasElement`/`OffscreenCanvas` (browser) — replaces Python Manim's Cairo/OpenGL back-ends
- `initWithNodeCanvas(canvas)` for Node.js; `init(canvas)` for browser
- `render(scene)` clears background then renders all mobjects depth-first sorted by `zIndex`
- `renderMobject(mob, camera)` dispatches to `_renderVMobject` for VMobjects (cubic Bezier subpaths with fill and stroke); non-VMobjects silently skipped
- Coordinate transform (`worldToPixel`) inlined against `ICamera` — no concrete Camera import
- `src/renderer/index.ts`: barrel export
- `tests/renderer.test.ts`: 20 tests covering constructor defaults, `initWithNodeCanvas`, `clear`, `renderMobject`, `render`, and edge cases

## 2026-04-12 — Convert mobject/utils

- `src/mobject/utils/utils.ts`: TypeScript port of `manim/mobject/utils.py`
  - `RendererType` enum (`CAIRO` / `OPENGL`) mirroring `manim/constants.py`
  - `getActiveRenderer()` — reads `MANIM_RENDERER` env var; defaults to CAIRO
  - `getMobjectClass()` — returns `Mobject` constructor for active renderer
  - `getVectorizedMobjectClass()` — returns `VMobject` constructor for active renderer
  - `getPointMobjectClass()` — returns `PMobject` constructor for active renderer
  - All three factory functions throw descriptive `Error` on CAIRO until the
    corresponding class modules are converted; throw on OPENGL (future WebGL2)
  - Exported constructor types: `MobjectConstructor`, `VMobjectConstructor`, `PMobjectConstructor`
- `src/mobject/utils/index.ts`: barrel export
- `tests/mobject/utils.test.ts`: 13 tests — renderer detection, enum values, error messages

## 2026-04-12 — Convert cli

- `src/cli/index.ts`: barrel export for the CLI package; exposes `CLI_COMMANDS` tuple and `CliCommandName` union type mirroring Manim's `cli/__init__.py` public surface
- `GlobalCliOptions` interface: typed options shared by all CLI commands (`configFile`, `mediaDir`, `quiet`, `verbose`)
- `tests/cli.test.ts`: 9 tests covering command list, uniqueness, type contracts

## 2026-04-12 — Initial scaffold

- Created project structure and build config
- Core math utilities (numpy replacement): Point3D, Points3D, Bezier, rate functions, matrix helpers
- Color module with full Manim palette
- Type stubs (src/core/types.ts): Mobject, VMobject, Animation, Scene, Camera, Renderer interfaces
- CONVENTIONS.md: shared conversion rules for all agents
- Dependency analyzer (scripts/analyze-deps.py): topological sort into layers

## 2026-04-12 — animation/rotation

- Converted `manim.animation.rotation` → `src/animation/rotation/`
- `Rotating`: resets mobject to start state each frame, applies `rateFunc(alpha) * angle` rotation (matching Python's internal rate-func application)
- `Rotate`: Transform-style animation; creates a rotated target in `begin()`, then arc-interpolates each point around `pathArcCenters` using `rotateVector` from core/math; falls back to direct rotate when `pathArc=0`
- Both classes implement `IAnimation`; extended `RotatableMobject` interface declares `become` and full `rotate` options locally
- Barrel `index.ts` exports `Rotating`, `Rotate`, `RotateOptions`
- 25 tests in `tests/animation/rotation.test.ts`; all 279 suite tests pass
- Orchestrator (src/orchestrator.ts): parallel agent spawning with layer gates
- Prompt builder (src/prompt-builder.ts): per-module brief generation

## 2026-04-12 — Convert `__init__` to TypeScript

- Created `src/__init__/` barrel export module (equivalent to Python `manim/__init__.py`)
- `version.ts`: exports `__version__` constant
- `index.ts`: re-exports all public API from core/math, core/color, and core/types
- TODO placeholders for submodules not yet converted (animation, camera, mobject, scene, etc.)
- Added `tests/__init__.test.ts` with 15 tests covering version, math, color, and type exports

## 2026-04-12 — Convert `_config` to TypeScript

- Created `src/_config/` module (port of Python `manim/_config/`)
- `utils.ts`: ManimConfig class (satisfies IManimConfig interface), ManimFrame read-only view, QUALITIES presets
  - All Python properties converted to TypeScript get/set accessors (frameYRadius, top, bottom, quality, transparent, etc.)
  - Dict-like get/set methods with snake_case→camelCase translation
  - copy() and update() for deep cloning and merging
- `logger.ts`: Logger and ManimConsole classes (replaces Python logging+rich with console-based logging)
- `index.ts`: barrel exports + global config/frame/logger instances + tempconfig/tempconfigAsync
- CLI-specific features (argparse, configparser, cloup) intentionally omitted — not applicable to TS/browser
- Added `tests/_config.test.ts` with 29 tests covering config defaults, computed properties, quality presets, tempconfig, copy/update, ManimFrame, and logger

## 2026-04-12 — Convert `_config.logger_utils` to TypeScript

- Created `src/_config/logger_utils/` module (port of Python `manim/_config/logger_utils.py`)
- `logger_utils.ts`: Full logger utilities with handler-based architecture
  - `Logger` class with level filtering, handler management, and named log methods (debug/info/warning/error/critical)
  - `JSONFormatter` class preserving Python's arg-sanitization behavior (replaces arg values with "<>")
  - `ConsoleHandler` (replaces rich.RichHandler) and `FileHandler` for file-based logging
  - Abstract `Handler` and `Formatter` base classes with `DefaultFormatter` implementation
  - `makeLogger()` function returning `[Logger, Console, Console]` tuple
  - `parseTheme()` function processing config section into `ParsedTheme` (styles + display dimensions)
  - `setFileLogger()` function adding a `JSONFormatter`-backed file handler to the manim logger
  - `getLogger(name)` registry mirroring Python's `logging.getLogger`
  - `HIGHLIGHTED_KEYWORDS` and `WRONG_COLOR_CONFIG_MSG` constants
  - `LogRecord` stores both raw template and formatted message so `JSONFormatter` can redact args
- `index.ts`: barrel export of all public API
- Added `tests/_config/logger_utils.test.ts` with 16 tests covering constants, parseTheme (key conversion, width/height, excludes, bad color, valid hex), makeLogger (return types, level, propagate), JSONFormatter (basic, dict/positional arg redaction, null args, valid JSON), and setFileLogger (file creation, JSON line format)

## 2026-04-12 — Convert `animation.speedmodifier` to TypeScript

- Created `src/animation/speedmodifier/` module (port of Python `manim.animation.speedmodifier`)
- `speedmodifier.ts`: `ChangeSpeed` class extending `Animation`
  - Piecewise speed modification via `speedinfo` node map (progress → speed factor)
  - Parabolic speed interpolation between nodes (matching Python's `speed_modifier` formula)
  - Static `dt` / `isChangingDt` state for coordinating speed-aware updaters
  - Static `addUpdater()` method for attaching speed-respecting updaters to mobjects
  - `numpy.piecewise` replaced with inline TypeScript implementation
  - `inspect.signature` dt-detection replaced with explicit `hasDt` option parameter
  - Duck-typed `AnimationGroupLike` interface for forward-compatible composition support
  - `getScaledTotalTime()` for computing effective animation duration
  - Delegates lifecycle methods (begin/finish/interpolate/cleanUpFromScene) to inner animation
- `index.ts`: barrel export of `ChangeSpeed`, `SpeedInfo`, `SpeedUpdater`, `SimpleUpdater`, `ChangeSpeedOptions`
- Updated `src/animation/index.ts` barrel to include speedmodifier exports
- Added `tests/animation/speedmodifier.test.ts` with 15 tests covering construction, speedinfo normalization, scaled time computation, lifecycle delegation, static updater system, and error cases

## 2026-04-12 — Convert `camera` to TypeScript

- Created `src/camera/` module (port of Python `manim/camera/`)
- `camera.ts`: `Camera` base class implementing `ICamera` interface
  - Frame geometry management (pixelHeight/Width, frameHeight/Width as virtual accessors)
  - Frame center get/set with defensive cloning
  - `resizeFrameShape()` with fixed dimension support, `resetPixelShape()`
  - `isInFrame()` AABB-based mobject visibility check
  - `getMobjectsToDisplay()` with z-index sorting and family extraction
  - `BackgroundColoredVMobjectDisplayer` placeholder class
  - Cairo/PIL rendering methods marked with TODO for manual porting
- `moving_camera.ts`: `MovingCamera` extending Camera
  - Frame-delegating dimension accessors (frameHeight/Width delegate to frame mobject)
  - `autoZoom()` for fitting mobjects in view with margin
  - `getMobjectsIndicatingMovement()` for tracking frame changes
- `three_d_camera.ts`: `ThreeDCamera` extending Camera
  - Euler angles (phi, theta, gamma) with value trackers
  - 3x3 rotation matrix generation and perspective projection
  - Exponential and standard projection modes
  - Fixed orientation/frame mobject management
  - `projectPoints()` and `projectPoint()` for 3D→2D projection
- `mapping_camera.ts`: `MappingCamera`, `OldMultiCamera`, `SplitScreenCamera`
  - Custom point mapping functions for distortion effects
  - Multi-viewport compositing via shifted cameras
  - Split-screen layout with automatic half-width calculation
- `multi_camera.ts`: `MultiCamera` extending MovingCamera
  - Multiple `ImageMobjectFromCamera` sub-camera management
  - Sub-camera pixel shape auto-updating
- `index.ts`: barrel export of all public API
- Added `tests/camera.test.ts` with 30 tests covering all camera classes
- Pre-existing `tests/camera/mapping_camera.test.ts` (11 tests) continues to pass

## 2026-04-12 — Convert `cli.checkhealth` to TypeScript

- Created `src/cli/checkhealth/` module (port of Python `manim/cli/checkhealth/`)
- `checks.ts`: Health check registration system
  - `HealthCheckFunction` interface and `HEALTH_CHECKS` registry
  - `healthcheck()` decorator-like factory attaching metadata and registering checks
  - `which()` helper (replaces `shutil.which`) using platform-aware executable lookup
  - Built-in checks: `isManimOnPath`, `isManimExecutableAssociatedToThisLibrary`, `isLatexAvailable`, `isDvisvgmAvailable`
  - `skipOnFailed` dependency resolution (functions or string names)
- `commands.ts`: `checkhealth()` command returning structured `CheckhealthResult`
  - ANSI-colored output (PASSED/FAILED/SKIPPED)
  - Demo scene rendering marked TODO (needs full Scene/Animation infrastructure)
- `index.ts`: barrel export of all public API
- Added `tests/cli/checkhealth.test.ts` with 12 tests covering check registration, metadata, decorator behavior, skipOnFailed resolution, and command execution

## 2026-04-12 — Convert `mobject` to TypeScript

- Created `src/mobject/` module (equivalent to Python `manim/mobject/__init__.py`)
- `index.ts`: barrel export with TODO placeholders for all submodules (mobject base class, VMobject, geometry, text, svg, 3D, coordinate systems, etc.)
- Added `tests/mobject.test.ts` with 2 tests verifying the barrel export imports without errors

## 2026-04-12 — Convert `mobject.utils` to TypeScript

- Created `src/mobject/utils/` module (port of Python `manim/mobject/utils.py`)
- `utils.ts`: Renderer-dispatch factory functions
  - `RendererType` const object with `CANVAS2D` and `WEBGL2` (replaces Python's `RendererType.CAIRO` / `RendererType.OPENGL`)
  - `getMobjectClass()`, `getVectorizedMobjectClass()`, `getPointMobjectClass()` — factory functions returning the appropriate class constructor based on `config.renderer`
  - Registry pattern (`registerMobjectClass`, `registerVMobjectClass`, `registerPMobjectClass`) — avoids hard imports of not-yet-converted mobject classes; sibling modules register their classes at load time
  - `MobjectClass`, `VMobjectClass`, `PMobjectClass` constructor type aliases
- `index.ts`: barrel export of all public API
- Added `tests/mobject/utils.test.ts` with 11 tests covering renderer dispatch, registry, error cases, and instantiation

## 2026-04-12 — Convert `renderer` to TypeScript

- Created `src/renderer/` module (port of Python `manim/renderer/__init__.py`)
- `renderer.ts`: `Renderer` class implementing `IRenderer` interface
  - Canvas2D initialization with optional WebGL2 mode flag
  - `init()` acquires 2D rendering context from HTMLCanvasElement or OffscreenCanvas
  - `render()` clears background and draws mobjects sorted by zIndex
  - `clear()` fills canvas with given IColor
  - `renderMobject()` recursively visits submobjects; actual drawing marked TODO for manual Canvas2D/WebGL2 implementation
  - `getCanvas()` and `isInitialized` accessors for introspection
- `index.ts`: barrel export of Renderer class and RendererOptions type
- Added `tests/renderer.test.ts` with 10 tests covering construction, init, clear, render ordering, submobject recursion, and error cases

## 2026-04-12 — Convert `renderer.vectorized_mobject_rendering` to TypeScript

- Created `src/renderer/vectorized_mobject_rendering/` module (port of Python `manim/renderer/vectorized_mobject_rendering.py`)
- `vectorized_mobject_rendering.ts`: Fill and stroke rendering pipeline for VMobjects
  - `IRenderableVMobject` interface extending `IVMobject` with rendering-specific properties (modelMatrix, fillRgba, strokeRgba, orientation, triangulation cache, etc.)
  - `buildMatrixLists()`: DFS traversal grouping mobjects by hierarchical model matrix
  - `triangulateMobject()`: Bezier curve triangulation with concave/convex classification and caching
  - `renderOpenglVectorizedMobjectFill()` / `renderOpenglVectorizedMobjectStroke()`: render entry points
  - WebGL shader/VAO/VBO creation marked with TODO for manual rendering implementation
  - Ear-clipping triangulation marked TODO (depends on unported `space_ops.earclip_triangulation`)
- `index.ts`: barrel export of all public API
- Updated `src/renderer/index.ts` barrel to include vectorized_mobject_rendering exports
- Added `tests/renderer/vectorized_mobject_rendering.test.ts` with 15 tests

## 2026-04-12 — Convert `scene` to TypeScript

- Created `src/scene/` module (port of Python `manim/scene/`)
- `scene.ts`: `Scene` class implementing `IScene` interface
  - Mobject management: `add()`, `remove()`, `clear()`, `replace()`, `bringToFront()`, `bringToBack()`
  - Animation playback: `play()` orchestrates animation lifecycle (begin → interpolate → finish → cleanup)
  - `wait()` delegates to `Wait` animation for timed pauses
  - Scene-level updaters via `addUpdater()` / `removeUpdater()`
  - `run()` lifecycle: `setup()` → `construct()` → `tearDown()` (all overridable)
  - `skipAnimations` mode for instant state jumps
  - `getMobjectFamilyMembers()` with deduplication
  - Uses Camera from `src/camera/` and Animation from `src/animation/`
- `index.ts`: barrel export of Scene class and SceneOptions type
- Added `tests/scene.test.ts` with 17 tests covering construction, mobject add/remove/clear/replace, ordering (bringToFront/bringToBack), animation playback, skipAnimations, scene updaters, subclass overrides (construct/setup/tearDown), and family deduplication

## 2026-04-12 — Convert `scene.scene_file_writer` to TypeScript

- Created `src/scene/scene_file_writer/` module (port of `manim.scene.scene_file_writer`)
- `scene_file_writer.ts`: SceneFileWriter class with full public API surface
  - Constructor initializes output directories, audio, sections (auto-creates first)
  - Section management: `finishLastSection()`, `nextSection()`, `addPartialMovieFile()`
  - Audio: `initAudio()`, `createAudioSegment()`, `addAudioSegment()`, `addSound()`
  - Writers: `beginAnimation()`, `endAnimation()`, `writeFrame()`, `saveImage()`
  - Combining: `combineToMovie()`, `combineToSectionVideos()`, `combineFiles()`
  - Cache: `cleanCache()`, `flushCacheDirectory()`
  - Helpers: `getResolutionDirectory()`, `isAlreadyCached()`, `writeSubcaptionFile()`
  - `toFrameRate()` utility for NTSC-safe frame rate conversion
- TypeScript-native types: `PixelArray`, `AudioSegment`, `Subtitle`, `FileWriterRenderer`
- File utility helpers: `guaranteeExistence`, `addExtensionIfNotPresent`, `addVersionBeforeExtension`
- Video encoding methods marked with TODO for platform-specific implementation (PyAV → ffmpeg/MediaRecorder)
- Audio loading marked with TODO (pydub → Web Audio API/node audio)
- Updated `src/scene/index.ts` barrel export
- Added `tests/scene/scene_file_writer.test.ts` with 24 tests covering toFrameRate, constructor defaults, sections, audio, caching, and static properties

## 2026-04-12 — Convert `scene.zoomed_scene` to TypeScript

- Created `src/scene/zoomed_scene/` module (port of `manim.scene.zoomed_scene`)
- `zoomed_scene.ts`: `ZoomedScene` class extending Scene (with inline MovingCameraScene base)
  - Constructor accepts typed `ZoomedSceneOptions` (display dimensions, zoom factor, camera config, etc.)
  - Fresh default config objects per instance (avoids Python mutable default argument bug)
  - `setup()` initializes zoomed MovingCamera and placeholder ImageMobjectFromCamera display
  - `activateZooming(animate?)` registers display with MultiCamera and adds foreground mobjects
  - `getZoomInAnimation()` / `getZoomedDisplayPopOutAnimation()` return placeholder IAnimation (TODO: needs ApplyMethod + save/restore)
  - `getZoomFactor()` computes frame height / display height ratio
  - CamelCase aliases (`zoomedCamera`, `zoomedDisplay`) alongside Python-compatible `zoomed_camera`, `zoomed_display`
  - Uses MultiCamera by default; constants (DEFAULT_MOBJECT_TO_EDGE_BUFFER) defined locally
- `index.ts`: barrel export of ZoomedScene, ZoomedSceneOptions, ZoomedCameraConfig
- Added `tests/scene/zoomed_scene.test.ts` with 14 tests covering defaults, custom options, camera type, display corner, mutable default isolation, setup lifecycle, zoom activation, zoom factor, aliases, and config overrides

## 2026-04-12 — Convert `utils.caching` to TypeScript

- Created `src/utils/caching/` module (port of Python `manim.utils.caching`)
- `caching.ts`: `handleCachingPlay` decorator function
  - Wraps play-like functions with animation hash caching logic
  - Skipped animations push `null` hash; uncached mode generates `uncached_NNNNN` hashes
  - Checks `fileWriter.isAlreadyCached()` to skip already-rendered animations
  - Dependencies (`config`, `logger`, `getHashFromPlayCall`) injected via options for testability
  - Structural interfaces (`ICachingRenderer`, `ICachingScene`) decouple from unported renderer/scene classes
  - NOTE: OpenGL renderer-specific; to be revisited when renderer is refactored
- `index.ts`: barrel export of `handleCachingPlay` and all public types
- Updated `src/utils/index.ts` barrel to include caching exports
- Added `tests/utils/caching.test.ts` with 10 tests covering wrapping, skip logic, uncached hashing, cache hits/misses, null hash fallback, and logging

## 2026-04-12 — Convert `utils.deprecation` to TypeScript

- Created `src/utils/deprecation/` module (port of Python `manim.utils.deprecation`)
- `deprecation.ts`: Deprecation decorator utilities
  - `deprecated()` — wraps functions/classes to emit a warning on each call/instantiation
    - Supports both direct wrapping `deprecated(fn)` and factory form `deprecated(options)(fn)`
    - Options: `since`, `until`, `replacement`, `message`
    - Preserves function name via `Object.defineProperty`
  - `deprecatedParams()` — wraps functions to warn when deprecated keyword arguments are used
    - Params can be specified as comma/space-separated string or string array
    - Tuple redirections `[oldName, newName]` for simple renames
    - Function redirections `{ params, map }` for computed value transformations (replaces Python's `inspect.signature`-based lambda approach)
    - Implicit param discovery from redirections, deduplication preserving order
    - Validates parameter names are valid identifiers
  - `setDeprecationLogger()` — injectable logger for testing (replaces Python's `logging.getLogger`)
  - Python `decorator` library replaced with manual function wrapping
  - Python `inspect.signature` replaced with explicit `params` arrays on `FunctionRedirection`
- `index.ts`: barrel export of all public API and types
- Updated `src/utils/index.ts` barrel to include deprecation exports
- Added `tests/utils/deprecation.test.ts` with 16 tests covering function/class wrapping, warning messages, since/until/replacement options, tuple and function redirections, singular/plural grammar, identifier validation, and deduplication

## 2026-04-12 — Convert `utils.docbuild` to TypeScript

- Created `src/utils/docbuild/` module (port of Python `manim.utils.docbuild`)
- `module_parsing.ts`: TypeScript source file parser for extracting documentation metadata
  - `parseModuleAttributes()` scans TypeScript files for type aliases, exported constants, and TypeVar-like declarations
  - Regex-based parser extracts JSDoc comments, `[CATEGORY]` markers, and `export type` definitions
  - Results cached after first call; `resetCache()` for testing
  - Type aliases: `AliasInfo`, `AliasCategoryDict`, `ModuleLevelAliasDict`, `AliasDocsDict`, `DataDict`, `TypeVarDict`
- `autoaliasattr_directive.ts`: Type alias documentation generator
  - `AliasAttrDocumenter` class generates structured `DocElement` trees for type aliases, TypeVars, and module attributes
  - `smartReplace()` for word-boundary-aware alias substitution (preserves Python logic exactly)
  - Cross-references aliases with `{@link}` syntax (replaces Sphinx `:class:` roles)
  - `setup()` returns directive class for documentation tooling integration
- `autocolor_directive.ts`: Color documentation generator
  - `ManimColorModuleDocumenter` generates structured table data from `IColor` records
  - Luminance-based font color selection (black text on light backgrounds, white on dark)
  - `renderHtml()` for direct HTML table output
- `manim_directive.ts`: Scene embedding directive
  - `ManimDirective` generates HTML templates for embedding rendered scenes (video/gif/image)
  - `processNameList()` formats space-separated names into documentation references
  - Quality presets matching Manim's QUALITIES dict (low/medium/high/fourk/example)
  - Doctest format detection and stripping (`>>> ` / `... ` prefixes)
  - `writeRenderingStats()`, `logRenderingTimes()`, `deleteRenderingTimes()` for build statistics
- `index.ts`: barrel export of all public API
- Updated `src/utils/index.ts` barrel to include docbuild exports
- Added `tests/utils/docbuild.test.ts` with 28 tests covering smartReplace word boundaries, processNameList formatting, ManimDirective rendering (video/gif/image/hidden source/quality/doctest), ManimColorModuleDocumenter (table generation/luminance/HTML), AliasAttrDocumenter construction, and parseModuleAttributes caching

## 2026-04-12 — Convert `utils.family` to TypeScript

- Created `src/utils/family/` module (port of Python `manim.utils.family`)
- `family.ts`: `extractMobjectFamilyMembers()` function
  - Recursively extracts mobject family trees via `IMobject.getFamily()`
  - Optional `onlyThoseWithPoints` filtering via `getPointsDefiningBoundary()`
  - Optional `useZIndex` sorting by z-index
  - Local `removeListRedundancies()` helper (preserves last occurrence, maintains order) — inlined since `utils.iterables` not yet converted
- `index.ts`: barrel export
- Updated `src/utils/index.ts` barrel to include family export
- Added `tests/utils/family.test.ts` with 10 tests covering empty input, single/recursive family extraction, deduplication, z-index sorting, point filtering, combined options, and iterable input

## 2026-04-12 — Convert `utils.file_ops` to TypeScript

- Created `src/utils/file_ops/` module (port of Python `manim.utils.file_ops`)
- `file_ops.ts`: File system utility functions
  - Format checkers: `isMp4Format()`, `isGifFormat()`, `isPngFormat()`, `isWebmFormat()`, `isMovFormat()`
  - `writeToMovie()` — determines if output should be a video format (png takes precedence)
  - `addExtensionIfNotPresent()` — appends extension if file doesn't already have it
  - `addVersionBeforeExtension()` — inserts `_ManimCE_v{version}` before extension
  - `guaranteeExistence()` — recursive mkdir + resolve
  - `guaranteeEmptyExistence()` — rm + mkdir + resolve
  - `seekFullPathFromDefaults()` — searches candidate paths with extension fallbacks
  - `modifyAtime()` — updates file access time preserving mtime
  - `ensureExecutable()` — checks executable existence via PATH lookup or direct access
  - `openFile()` — cross-platform file opening (Windows start, Linux xdg-open, macOS open, Cygwin cygstart)
  - `FileOpsConfig` interface for dependency-injected config (replaces Python global `config` dict)
  - Python `pathlib.Path` replaced with Node.js `path` + `fs` modules
  - Python `subprocess`/`shutil.which` replaced with `child_process.execSync`
  - Template management functions (`get_template_names`, `copy_template_files`, `add_import_statement`) omitted — Python-specific CLI scaffolding not applicable to TS
  - `open_media_file` omitted — depends on `SceneFileWriter` (convert when that module is ported)
- `index.ts`: barrel export of all public API and types
- Updated `src/utils/index.ts` barrel to include file_ops exports
- Added `tests/utils/file_ops.test.ts` with 20 tests covering format checkers, writeToMovie logic, extension handling, version insertion, directory creation/clearing, path searching, atime modification, and executable detection

## 2026-04-12 — Convert `utils.polylabel` to TypeScript

- Created `src/utils/polylabel/` module (port of Python `manim.utils.polylabel`)
- `polylabel.ts`: Pole of inaccessibility algorithm for polygons
  - `Polygon` class: computes edge segments, signed area, centroid, signed distance, and inside/outside tests
  - `Cell` class: grid cell with center, half-size, signed distance, and maximum potential
  - `polylabel()` function: iterative grid subdivision finding the point farthest from polygon edges
  - All numpy operations replaced with typed Float64Array arithmetic (no numpy, no core/math dependency needed)
  - `Point2D` / `Point2DArray` types based on Float64Array
  - Min-heap implementation for priority queue (replaces Python's `queue.PriorityQueue`)
  - Accepts 3D input points (ignores z coordinate, matching Python behavior)
  - Supports polygons with holes via multiple rings
- `index.ts`: barrel export of Polygon, Cell, polylabel, Point2D, Point2DArray
- Updated `src/utils/index.ts` barrel to include polylabel exports
- Added `tests/utils/polylabel.test.ts` with 14 tests covering polygon area/centroid, inside/outside detection, boundary points, signed distance, Cell properties, square/L-shape/holed polygon pole-finding, 3D input, precision, and return type

## 2026-04-12 — Convert `utils.sounds` to TypeScript

- Created `src/utils/sounds/` module (Layer 0 — no dependencies beyond file_ops and config)
- `sounds.ts`: `getFullSoundFilePath()` — searches assets directory for .wav/.mp3 files
- `index.ts`: barrel export
- Updated `src/utils/index.ts` barrel to include sounds export
- Added `tests/utils/sounds.test.ts` with 8 tests covering .wav/.mp3 discovery, explicit extensions, absolute paths, missing file errors, and extension priority

## 2026-04-12 — Convert `utils.commands` to TypeScript

- Created `src/utils/commands/` module (port of Python `manim.utils.commands`)
- `commands.ts`: Subprocess capture, video metadata, and directory layout utilities
  - `capture()` — runs a command via `child_process.spawnSync`, returns [stdout, stderr, exitCode] tuple
    - Accepts string (shell mode) or string[] (direct exec) commands
    - Optional `cwd` and `commandInput` (stdin) parameters
  - `getVideoMetadata()` — extracts video metadata via `fluent-ffmpeg` ffprobe (replaces Python PyAV)
    - Returns `VideoMetadata` interface matching Python's `TypedDict` shape (width, height, nb_frames, duration, avg_frame_rate, codec_name, pix_fmt)
    - Async (Promise-based) since ffprobe is callback-based
  - `getDirLayout()` — recursive directory listing as a Generator yielding relative paths
    - Uses Node.js `fs.readdirSync` with `withFileTypes` for efficient traversal
    - Normalizes path separators to forward slashes for cross-platform consistency
  - Python-compatible snake_case aliases: `get_video_metadata`, `get_dir_layout`
- `index.ts`: barrel export of all public API and VideoMetadata type
- Added `tests/utils/commands.test.ts` with 10 tests covering capture stdout/stderr/exit code, shell mode, cwd, stdin input, empty output, recursive dir layout, empty dirs, and aliases

## 2026-04-12 — Convert `utils.color` to TypeScript

- Created `src/utils/color/` module (port of Python `manim.utils.color`)
- `core.ts`: ManimColor class extending core Color with full Python ManimColor API
  - Flexible constructor: hex strings, integers (0xRRGGBB), float/int RGB(A) arrays, Color/ManimColor instances, null
  - Conversion methods: toInteger, toRgb, toIntRgb, toRgba, toIntRgba, toHex (with optional alpha), toHsv, toHsl
  - Manipulation: invert, interpolate, darker (interpolates toward BLACK), lighter (interpolates toward WHITE), contrasting (luminance-based), opacity
  - Static factories: fromHex, fromRgb, fromRgba, fromHsv, fromHsl, parse (single or array)
  - HSV class for HSV color space with h/s/v properties and fromInternal factory
  - RGBA alias for ManimColor
  - Functional helpers: colorToRgb, colorToRgba, colorToIntRgb, colorToIntRgba, rgbToColor, rgbaToColor, rgbToHex, hexToRgb, invertColor, colorGradient, interpolateColor, averageColor, randomBrightColor, randomColor
  - RandomColorGenerator with optional seeded PRNG for deterministic sequences
  - getShadedRgb for surface lighting calculations
  - Color space conversion helpers (rgbToHsv, hsvToRgb, rgbToHsl, hslToRgb) implemented natively
  - Type aliases: FloatRGB, FloatRGBA, IntRGB, IntRGBA, FloatHSV, FloatHSL, ParsableManimColor
- `manim_colors.ts`: Full Manim default palette as ManimColor instances (matching core/color hex values)
- `AS2700.ts`: 195 Australian Standard AS 2700 color constants
- `BS381.ts`: British Standard BS381C color constants with numbered and named aliases
- `DVIPSNAMES.ts`: 68 dvips driver color constants
- `SVGNAMES.ts`: 148 SVG 1.1 specification color constants
- `X11.ts`: 504 X11 color constants
- `XKCD.ts`: 922 XKCD Color Name Survey color constants
- `index.ts`: barrel export of all classes, functions, types, palette colors, and namespaced color standard modules
- Added `tests/utils/color.test.ts` with 65 tests covering construction (hex/int/array/copy/null/alpha), conversions (toInteger/toRgb/toIntRgb/toRgba/toHex/toHsv/toHsl round-trips), manipulation (invert/interpolate/darker/lighter/contrasting/opacity), static factories, equals, toString, HSV class, RGBA alias, utility functions, colorGradient, RandomColorGenerator (deterministic/custom palette), and palette correctness

## 2026-04-12 — Convert `utils.opengl` to TypeScript

- Created `src/utils/opengl/` module (port of Python `manim/utils/opengl.py`)
- `opengl.ts`: OpenGL matrix utility functions for shader/camera support
  - `matrixToShaderInput`: transpose + flatten 4x4 matrix to 16-element tuple (column-major)
  - `orthographicProjectionMatrix` / `perspectiveProjectionMatrix`: configurable projection matrices with format option
  - `translationMatrix`, `xRotationMatrix`, `yRotationMatrix`, `zRotationMatrix`: individual transform matrices
  - `rotationMatrix`: combined Euler-angle rotation (X * Y * Z)
  - `rotateInPlaceMatrix`: rotate around an arbitrary point
  - `scaleMatrix`: uniform scaling
  - `viewMatrix`: inverse model-view matrix for camera, returns flattened tuple
  - Python `**kwargs` / `config[]` access → typed options objects with defaults
  - `FlattenedMatrix4x4` type alias for 16-element tuple
- `index.ts`: barrel export of all public functions, types, and `depth` constant
- Added `tests/utils/opengl.test.ts` with 17 tests covering identity matrices, translation, rotation (X/Y/Z/combined), scaling, orthographic/perspective projections, rotate-in-place, view matrix, and matrixToShaderInput transpose behavior

## animation/animation (new)
- `Animation` class implementing `IAnimation` from `src/core/types.ts`
  - Constructor accepts `IMobject` + `AnimationOptions` (runTime, rateFunc, lagRatio, name, remover, introducer, suspendMobjectUpdating)
  - Default `rateFunc` is `smooth`; applies rate function in `interpolate()` before delegating to `interpolateMobject()`
  - `begin()` / `finish()` lifecycle hooks; `startingMobject` stored for per-submobject interpolation
  - `getAllFamiliesZipped()` + `getSubAlpha()` helpers for lag-ratio support
  - `copy()` via `Object.create` + `Object.assign` shallow clone
- `index.ts`: barrel re-export of `Animation` and type contracts

## 2026-04-12 — Convert `scene` (base) to TypeScript

- `src/scene/scene.ts`: `Scene` class implementing `IScene` from `src/core/types.ts`
  - Constructor accepts `SceneOptions` (optional `camera`, `cameraOptions`, `frameRate`)
  - Defaults to a new `Camera` with 1920×1080 px, 30 fps
  - `add(...mobjects)` / `remove(...mobjects)` — manage top-level mobjects with duplicate/missing-entry safety, method chaining
  - `play(...animations)` — runs all animations in parallel: `setupScene → introducer add → begin → per-frame interpolate+updaters → finish → cleanUpFromScene → remover remove`; advances `scene.time` by `max(runTimes)`
  - `wait(duration?, stopCondition?)` — ticks updaters each frame for the given duration; stops early if `stopCondition()` returns `true`; advances `scene.time`
  - `construct()` — no-op base; subclasses override to define the scene
  - `getMobjectFamily()` — depth-first flattened list of all mobjects + submobjects
  - Private `_tickUpdaters(dt)` — calls every updater on every family member per frame
- `src/scene/index.ts`: barrel export of `Scene`, `SceneOptions`, and re-exports from `section/`
- `tests/scene.test.ts`: 21 tests covering construction defaults/custom camera/frame rate, add/remove/chaining/duplicates, play lifecycle (begin/finish/setupScene/introducer/remover/time advance/no-op), wait (time advance/zero duration/stopCondition/updater ticks), construct subclass override, and getMobjectFamily

## animation/movement (new)
- `Homotopy`: transforms mobject points via `(x,y,z,t) → (x',y',z')` function
  - `functionAtTimeT(t)` returns a `(Point3D) → Point3D` closure; `applyFunctionKwargs` stored (not forwarded — IMobject interface has no extra options)
  - `interpolateSubmobject` resets points from starting submobject then applies homotopy
- `SmoothedVectorizedHomotopy`: extends Homotopy; calls `makeSmooth()` post-interpolation (guarded by duck-type check)
- `ComplexHomotopy`: wraps `(ComplexNumber, t) → ComplexNumber` into real-valued homotopy; z-coordinate preserved
- `PhaseFlow`: delta-based vector-field flow using `lastAlpha` tracking; default `rateFunc` is `linear`
- `MoveAlongPath`: moves mobject along `IVMobject.pointFromProportion()` path
- `index.ts`: barrel export of all five classes + option types
- Added `tests/animation/movement.test.ts` with 24 tests covering construction, functionAtTimeT, interpolation, PhaseFlow delta dt, MoveAlongPath path proportion, and edge cases


## scene/scene_file_writer (2026-04-12)
- `toFfmpegFrameRate(fps)`: converts FPS to rational `{ num, denom }` (mirrors Python's `to_av_frame_rate`)
- `convertAudio(input, output, codec)`: sync audio format conversion via ffmpeg child process
- `AudioSegment`: pydub.AudioSegment replacement — tracks clips with position/gain, exports via ffmpeg filters; supports `silent()`, `fromFile()`, `append()`, `overlay()`, `applyGain()`, `export()`
- `Subtitle` / `composeSrt()`: srt.Subtitle + srt.compose() replacement for SRT subtitle generation
- `SceneFileWriter`: main class wiring directory setup, section management, audio mixing, frame-by-frame ffmpeg encoding (rawvideo stdin), partial file concatenation, cache management, and subcaption writing
- `SceneFileWriterConfig`: extended config interface with all Manim config fields (dryRun, writeToMovie, movieFileExtension, transparent, saveSections, etc.)
- `SceneFileWriterRenderer`: minimal renderer interface (numPlays + optional getFrame/getImage)
- `index.ts`: barrel export of all public API
- Updated `src/scene/index.ts` to re-export the new module
- Added `tests/scene/scene_file_writer/scene_file_writer.test.ts` with 32 tests covering FrameRate conversion, SRT composition, AudioSegment operations, constructor defaults, section management, cache checks, and audio segment timing

## utils/tex (2026-04-12)
- Converted `utils/tex.py` to TypeScript at `src/utils/tex/`
- `TexTemplate`: class with typed options, body getter/setter, `fromFile`, `addToPreamble`, `addToDocument`, `getTexcodeForExpression`, `getTexcodeForExpressionInEnv`, `copy`
- `_texcodeForEnvironment`: helper parsing environment strings into \begin/\end pairs
- `index.ts`: barrel export of all public API
- Added `tests/utils/tex.test.ts` with 18 tests covering constructor defaults, options, body generation, preamble/document modification, expression rendering, environment wrapping, and copy semantics
