---
title: Constants
sidebar_position: 4
---

# Constants

The constants module (`src/constants/`) is the TypeScript port of `manim/constants.py`. Direction vectors and math constants are re-exported from `core/math` (the single source of truth). This module adds buffer sizes, default values, video quality presets, and enumerations.

```typescript
import {
  ORIGIN, UP, DOWN, LEFT, RIGHT, OUT, IN,
  UL, UR, DL, DR,
  X_AXIS, Y_AXIS, Z_AXIS,
  SMALL_BUFF, MED_SMALL_BUFF, MED_LARGE_BUFF, LARGE_BUFF,
  DEFAULT_STROKE_WIDTH, DEFAULT_FONT_SIZE,
  QUALITIES,
  RendererType, LineJointType, CapStyleType,
} from "manim-ts/constants";
```

---

## Direction & Axis Constants

All direction constants are `Point3D` (NDArray of shape `[3]`).

### Cardinal Directions

These are re-exported from `core/math`.

| Constant | Value | Description |
|----------|-------|-------------|
| `ORIGIN` | `[0, 0, 0]` | The origin |
| `UP` | `[0, 1, 0]` | Positive y |
| `DOWN` | `[0, -1, 0]` | Negative y |
| `LEFT` | `[-1, 0, 0]` | Negative x |
| `RIGHT` | `[1, 0, 0]` | Positive x |
| `OUT` | `[0, 0, 1]` | Positive z (toward viewer) |
| `IN` | `[0, 0, -1]` | Negative z (away from viewer) |

### Diagonal Directions

| Constant | Value | Description |
|----------|-------|-------------|
| `UL` | `[-1, 1, 0]` | Up + Left |
| `UR` | `[1, 1, 0]` | Up + Right |
| `DL` | `[-1, -1, 0]` | Down + Left |
| `DR` | `[1, -1, 0]` | Down + Right |

### Axis Vectors

| Constant | Value | Description |
|----------|-------|-------------|
| `X_AXIS` | `[1, 0, 0]` | Unit vector along x-axis |
| `Y_AXIS` | `[0, 1, 0]` | Unit vector along y-axis |
| `Z_AXIS` | `[0, 0, 1]` | Unit vector along z-axis |

---

## Math Constants

Re-exported from `core/math`.

| Constant | Value | Description |
|----------|-------|-------------|
| `PI` | `3.141592653589793` | Pi |
| `TAU` | `6.283185307179586` | 2 * Pi (full circle) |
| `DEGREES` | `0.017453292519943295` | Radians per degree (`TAU / 360`) |

---

## Buffer Constants

Spacing constants used for padding and layout throughout Manim.

| Constant | Value | Description |
|----------|-------|-------------|
| `SMALL_BUFF` | `0.1` | Small padding |
| `MED_SMALL_BUFF` | `0.25` | Medium-small padding |
| `MED_LARGE_BUFF` | `0.5` | Medium-large padding |
| `LARGE_BUFF` | `1.0` | Large padding |
| `DEFAULT_MOBJECT_TO_EDGE_BUFFER` | `0.5` | Default gap between mobject and frame edge (equals `MED_LARGE_BUFF`) |
| `DEFAULT_MOBJECT_TO_MOBJECT_BUFFER` | `0.25` | Default gap between two mobjects (equals `MED_SMALL_BUFF`) |

---

## Default Values

### Geometry

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_DOT_RADIUS` | `0.08` | Default radius for `Dot` |
| `DEFAULT_SMALL_DOT_RADIUS` | `0.04` | Default radius for small dots |
| `DEFAULT_DASH_LENGTH` | `0.05` | Default dash length for dashed lines |
| `DEFAULT_ARROW_TIP_LENGTH` | `0.35` | Default arrow tip length |
| `START_X` | `30` | Starting x coordinate for certain constructions |
| `START_Y` | `20` | Starting y coordinate for certain constructions |

### Appearance

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_STROKE_WIDTH` | `4` | Default stroke width for VMobjects |
| `DEFAULT_FONT_SIZE` | `48` | Default font size for text mobjects |
| `SCALE_FACTOR_PER_FONT_POINT` | `1 / 960` | Conversion factor from font points to Manim units |

### Point Density

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_POINT_DENSITY_2D` | `25` | Default point density for 2D surfaces |
| `DEFAULT_POINT_DENSITY_1D` | `10` | Default point density for 1D curves |

### Timing

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_POINTWISE_FUNCTION_RUN_TIME` | `3.0` | Default duration for pointwise function animations |
| `DEFAULT_WAIT_TIME` | `1.0` | Default wait duration in seconds |

---

## Video Quality Presets

The `QUALITIES` dictionary maps quality names to resolution and frame rate settings.

```typescript
interface QualityDict {
  flag: string | null;  // CLI flag character
  pixelHeight: number;
  pixelWidth: number;
  frameRate: number;
}
```

| Quality | Flag | Resolution | Frame Rate |
|---------|------|------------|------------|
| `fourk_quality` | `"k"` | 3840 x 2160 | 60 fps |
| `production_quality` | `"p"` | 2560 x 1440 | 60 fps |
| `high_quality` | `"h"` | 1920 x 1080 | 60 fps |
| `medium_quality` | `"m"` | 1280 x 720 | 30 fps |
| `low_quality` | `"l"` | 854 x 480 | 15 fps |
| `example_quality` | `null` | 854 x 480 | 30 fps |

The default quality is `"high_quality"` (exported as `DEFAULT_QUALITY`).

### Usage

```typescript
import { QUALITIES, DEFAULT_QUALITY } from "manim-ts/constants";

const q = QUALITIES[DEFAULT_QUALITY];
console.log(q.pixelWidth);  // 1920
console.log(q.pixelHeight); // 1080
console.log(q.frameRate);   // 60
```

---

## Enums

### `RendererType`

All renderer backends that can be assigned to `config.renderer`.

```typescript
enum RendererType {
  CAIRO = "cairo",
  OPENGL = "opengl",
}
```

| Value | String | Description |
|-------|--------|-------------|
| `RendererType.CAIRO` | `"cairo"` | Cairo-based renderer (default for file output) |
| `RendererType.OPENGL` | `"opengl"` | OpenGL-based renderer (interactive preview) |

### `LineJointType`

Available line joint styles for stroke rendering.

```typescript
enum LineJointType {
  AUTO = 0,
  ROUND = 1,
  BEVEL = 2,
  MITER = 3,
}
```

| Value | Number | Description |
|-------|--------|-------------|
| `LineJointType.AUTO` | `0` | Automatically choose joint type |
| `LineJointType.ROUND` | `1` | Rounded joints |
| `LineJointType.BEVEL` | `2` | Beveled (flat) joints |
| `LineJointType.MITER` | `3` | Sharp mitered joints |

### `CapStyleType`

Available cap styles for stroke endpoints.

```typescript
enum CapStyleType {
  AUTO = 0,
  ROUND = 1,
  BUTT = 2,
  SQUARE = 3,
}
```

| Value | Number | Description |
|-------|--------|-------------|
| `CapStyleType.AUTO` | `0` | Automatically choose cap style |
| `CapStyleType.ROUND` | `1` | Rounded caps |
| `CapStyleType.BUTT` | `2` | Flat caps flush with endpoint |
| `CapStyleType.SQUARE` | `3` | Square caps extending past endpoint |

---

## Font Style Constants

Constants for Pango font styling.

### Weight Constants

| Constant | Value |
|----------|-------|
| `NORMAL` | `"NORMAL"` |
| `ITALIC` | `"ITALIC"` |
| `OBLIQUE` | `"OBLIQUE"` |
| `BOLD` | `"BOLD"` |
| `THIN` | `"THIN"` |
| `ULTRALIGHT` | `"ULTRALIGHT"` |
| `LIGHT` | `"LIGHT"` |
| `SEMILIGHT` | `"SEMILIGHT"` |
| `BOOK` | `"BOOK"` |
| `MEDIUM` | `"MEDIUM"` |
| `SEMIBOLD` | `"SEMIBOLD"` |
| `ULTRABOLD` | `"ULTRABOLD"` |
| `HEAVY` | `"HEAVY"` |
| `ULTRAHEAVY` | `"ULTRAHEAVY"` |

---

## Resampling Algorithms

Map of resampling algorithm names to canonical identifiers. Used for image processing operations.

```typescript
const RESAMPLING_ALGORITHMS: Record<string, string> = {
  nearest: "nearest",
  none: "nearest",
  bilinear: "bilinear",
  linear: "bilinear",
  bicubic: "bicubic",
  cubic: "bicubic",
};
```

Multiple aliases map to the same canonical name (e.g., both `"none"` and `"nearest"` resolve to `"nearest"`).

---

## CLI Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `EPILOG` | `"Made with <3 by Manim Community developers."` | CLI help epilog |
| `SHIFT_VALUE` | `65505` | Key code for Shift |
| `CTRL_VALUE` | `65507` | Key code for Ctrl |

---

## Message Constants

String templates used in CLI output and error messages.

| Constant | Description |
|----------|-------------|
| `SCENE_NOT_FOUND_MESSAGE` | Displayed when a scene name is not found in the script |
| `CHOOSE_NUMBER_MESSAGE` | Prompt for selecting scenes by number |
| `INVALID_NUMBER_MESSAGE` | Error for invalid scene number input |
| `NO_SCENE_MESSAGE` | Displayed when no scenes exist in a module |
