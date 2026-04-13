---
title: Color
sidebar_position: 2
---

# Color

The color module (`src/core/color/index.ts`) provides the `Color` class implementing `IColor` from `core/types.ts`, along with Manim's complete named color palette. All hex values are verified against ManimCommunity/manim's `manim_colors.py`.

```typescript
import { Color, BLUE, RED, WHITE, BLACK } from "manim-ts/core/color";
```

---

## Color Class

### Constructor

```typescript
new Color(r: number, g: number, b: number, a?: number)
```

Creates a color from RGBA components in the `[0, 1]` range. Values are clamped automatically. Alpha defaults to `1.0` (fully opaque).

```typescript
const red = new Color(1, 0, 0);
const semiTransparent = new Color(0, 0.5, 1, 0.5);
```

### Static Factory Methods

#### `Color.fromHex(hex: string)`

Create a color from a hex string. Supports 6-character (`#RRGGBB`) and 8-character (`#RRGGBBAA`) formats. The `#` prefix is optional.

```typescript
const blue = Color.fromHex("#58C4DD");
const withAlpha = Color.fromHex("#58C4DD80");
```

#### `Color.fromHSL(h: number, s: number, l: number, a?: number)`

Create a color from HSL values. `h` is in degrees `[0, 360)`, `s` and `l` are in `[0, 1]`.

```typescript
const pure_red = Color.fromHSL(0, 1, 0.5);
const pastel_blue = Color.fromHSL(210, 0.8, 0.7);
```

#### `Color.fromRGB(r: number, g: number, b: number, a?: number)`

Create a color from RGB values in the `[0, 255]` range. Internally converted to `[0, 1]`.

```typescript
const green = Color.fromRGB(0, 255, 0);
```

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `r` | `number` | Red component `[0, 1]` (readonly) |
| `g` | `number` | Green component `[0, 1]` (readonly) |
| `b` | `number` | Blue component `[0, 1]` (readonly) |
| `a` | `number` | Alpha component `[0, 1]` (readonly) |

### Instance Methods

#### `toHex(): string`

Returns the color as a `#RRGGBB` hex string (alpha is not included).

```typescript
BLUE.toHex(); // "#58c4dd"
```

#### `toArray(): ColorArray`

Returns `[r, g, b, a]` as a 4-element tuple of numbers in `[0, 1]`.

```typescript
WHITE.toArray(); // [1, 1, 1, 1]
```

#### `interpolate(other: IColor, t: number): Color`

Linearly interpolate between this color and another. `t = 0` returns this color, `t = 1` returns the other.

```typescript
const mid = RED.interpolate(BLUE, 0.5); // purple-ish
```

#### `lighter(amount?: number): Color`

Return a lighter version of the color. Default amount is `0.2`. Each RGB channel is increased by `amount` and clamped to `[0, 1]`.

```typescript
const light = BLUE.lighter();      // 0.2 lighter
const veryLight = BLUE.lighter(0.4);
```

#### `darker(amount?: number): Color`

Return a darker version of the color. Default amount is `0.2`. Internally calls `lighter(-amount)`.

```typescript
const dark = RED.darker();
```

#### `withOpacity(opacity: number): Color`

Return a new color with the given alpha value, preserving RGB.

```typescript
const ghost = BLUE.withOpacity(0.3);
```

---

## Color Palette

### Grayscale

| Constant | Hex | Aliases |
|----------|-----|---------|
| `WHITE` | `#FFFFFF` | |
| `GRAY_A` | `#DDDDDD` | `GREY_A`, `LIGHTER_GRAY`, `LIGHTER_GREY` |
| `GRAY_B` | `#BBBBBB` | `GREY_B`, `LIGHT_GRAY`, `LIGHT_GREY` |
| `GRAY_C` | `#888888` | `GREY_C`, `GRAY`, `GREY` |
| `GRAY_D` | `#444444` | `GREY_D`, `DARK_GRAY`, `DARK_GREY` |
| `GRAY_E` | `#222222` | `GREY_E`, `DARKER_GRAY`, `DARKER_GREY` |
| `BLACK` | `#000000` | |

:::note
Both American (`GRAY`) and British (`GREY`) spellings are exported for every grayscale constant.
:::

### Pure Colors

| Constant | Hex |
|----------|-----|
| `PURE_RED` | `#FF0000` |
| `PURE_GREEN` | `#00FF00` |
| `PURE_BLUE` | `#0000FF` |
| `PURE_CYAN` | `#00FFFF` |
| `PURE_MAGENTA` | `#FF00FF` |
| `PURE_YELLOW` | `#FFFF00` |

### Blues

| Constant | Hex |
|----------|-----|
| `BLUE_A` | `#C7E9F1` |
| `BLUE_B` | `#9CDCEB` |
| `BLUE_C` | `#58C4DD` |
| `BLUE_D` | `#29ABCA` |
| `BLUE_E` | `#236B8E` |
| `BLUE` | `#58C4DD` (alias for `BLUE_C`) |
| `DARK_BLUE` | `#236B8E` (alias for `BLUE_E`) |

### Teals

| Constant | Hex |
|----------|-----|
| `TEAL_A` | `#ACEAD7` |
| `TEAL_B` | `#76DDC0` |
| `TEAL_C` | `#5CD0B3` |
| `TEAL_D` | `#55C1A7` |
| `TEAL_E` | `#49A88F` |
| `TEAL` | `#5CD0B3` (alias for `TEAL_C`) |

### Greens

| Constant | Hex |
|----------|-----|
| `GREEN_A` | `#C9E2AE` |
| `GREEN_B` | `#A6CF8C` |
| `GREEN_C` | `#83C167` |
| `GREEN_D` | `#77B05D` |
| `GREEN_E` | `#699C52` |
| `GREEN` | `#83C167` (alias for `GREEN_C`) |

### Yellows

| Constant | Hex |
|----------|-----|
| `YELLOW_A` | `#FFF1B6` |
| `YELLOW_B` | `#FFEA94` |
| `YELLOW_C` | `#F7D96F` |
| `YELLOW_D` | `#F4D345` |
| `YELLOW_E` | `#E8C11C` |
| `YELLOW` | `#F7D96F` (alias for `YELLOW_C`) |

:::caution
`YELLOW` is `#F7D96F` (a warm gold-yellow), not `#FFFF00`. For pure yellow, use `PURE_YELLOW`.
:::

### Golds

| Constant | Hex |
|----------|-----|
| `GOLD_A` | `#F7C797` |
| `GOLD_B` | `#F9B775` |
| `GOLD_C` | `#F0AC5F` |
| `GOLD_D` | `#E1A158` |
| `GOLD_E` | `#C78D46` |
| `GOLD` | `#F0AC5F` (alias for `GOLD_C`) |

### Reds

| Constant | Hex |
|----------|-----|
| `RED_A` | `#F7A1A3` |
| `RED_B` | `#FF8080` |
| `RED_C` | `#FC6255` |
| `RED_D` | `#E65A4C` |
| `RED_E` | `#CF5044` |
| `RED` | `#FC6255` (alias for `RED_C`) |

### Maroons

| Constant | Hex |
|----------|-----|
| `MAROON_A` | `#ECABC1` |
| `MAROON_B` | `#EC92AB` |
| `MAROON_C` | `#C55F73` |
| `MAROON_D` | `#A24D61` |
| `MAROON_E` | `#94424F` |
| `MAROON` | `#C55F73` (alias for `MAROON_C`) |

### Purples

| Constant | Hex |
|----------|-----|
| `PURPLE_A` | `#CAA3E8` |
| `PURPLE_B` | `#B189C6` |
| `PURPLE_C` | `#9A72AC` |
| `PURPLE_D` | `#715582` |
| `PURPLE_E` | `#644172` |
| `PURPLE` | `#9A72AC` (alias for `PURPLE_C`) |

### Special Colors

| Constant | Hex | Description |
|----------|-----|-------------|
| `PINK` | `#D147BD` | |
| `LIGHT_PINK` | `#DC75CD` | |
| `ORANGE` | `#FF862F` | |
| `LIGHT_BROWN` | `#CD853F` | |
| `DARK_BROWN` | `#8B4513` | |
| `GRAY_BROWN` | `#736357` | Also exported as `GREY_BROWN` |

### Logo Colors

The official Manim logo color palette.

| Constant | Hex |
|----------|-----|
| `LOGO_WHITE` | `#ECE7E2` |
| `LOGO_GREEN` | `#87C2A5` |
| `LOGO_BLUE` | `#525893` |
| `LOGO_RED` | `#E07A5F` |
| `LOGO_BLACK` | `#343434` |

---

## Python to TypeScript

### Using named colors

```python
# Python
from manim import BLUE, RED, WHITE
circle = Circle(color=BLUE)
circle.set_fill(RED, opacity=0.5)
```

```typescript
// TypeScript
import { BLUE, RED } from "manim-ts/core/color";
const circle = new Circle({ color: BLUE });
circle.setFill(RED, 0.5);
```

### Creating custom colors

```python
# Python
from manim import ManimColor
custom = ManimColor("#AB12CD")
lighter = custom.lighter()
```

```typescript
// TypeScript
import { Color } from "manim-ts/core/color";
const custom = Color.fromHex("#AB12CD");
const lighter = custom.lighter();
```

### Color interpolation

```python
# Python
from manim.utils.color import interpolate_color
mid = interpolate_color(RED, BLUE, 0.5)
```

```typescript
// TypeScript
import { RED, BLUE } from "manim-ts/core/color";
const mid = RED.interpolate(BLUE, 0.5);
```
