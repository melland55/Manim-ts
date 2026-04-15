"""
Parity scenes for Python Manim. Each class has a construct() that only calls
self.add(...) — no animations, no .play. The final frame is compared pixel-
for-pixel against the manim-ts rendering of the same scene in scenes.ts.

Keep class names PascalCase and identical in scenes.ts — the diff runner
uses them as pairing keys.
"""

from __future__ import annotations

import math

from manim import (
    Scene,
    # shapes
    Circle,
    Square,
    Rectangle,
    RoundedRectangle,
    Triangle,
    RegularPolygon,
    Star,
    Arc,
    AnnularSector,
    Annulus,
    Polygon,
    Line,
    DashedLine,
    Dot,
    Arrow,
    DoubleArrow,
    Vector,
    # coordinate systems
    NumberLine,
    Axes,
    # color constants
    WHITE, BLACK, LIGHT_GRAY, GRAY, DARK_GRAY,
    RED, GREEN, BLUE, YELLOW, PURPLE, TEAL, PINK, ORANGE,
    BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E,
    GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E,
    RED_A, RED_B, RED_C, RED_D, RED_E,
    GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E,
    PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E,
    MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E,
    PURE_RED, PURE_GREEN, PURE_BLUE,
    # directions
    UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR,
    PI, TAU, DEGREES,
)


# ---------------------------------------------------------------------------
# Shapes
# ---------------------------------------------------------------------------

class SingleCircle(Scene):
    def construct(self):
        self.add(Circle(radius=1.5, color=BLUE, fill_opacity=0.5))


class CircleStrokeOnly(Scene):
    def construct(self):
        self.add(Circle(radius=2, color=RED, fill_opacity=0))


class SingleSquare(Scene):
    def construct(self):
        self.add(Square(side_length=2, color=GREEN, fill_opacity=0.8))


class RectangleWide(Scene):
    def construct(self):
        self.add(Rectangle(width=4, height=1, color=YELLOW, fill_opacity=0.6))


class TriangleBasic(Scene):
    def construct(self):
        self.add(Triangle(color=TEAL, fill_opacity=0.7))


class RegularPentagon(Scene):
    def construct(self):
        self.add(RegularPolygon(n=5, color=PURPLE, fill_opacity=0.7))


class RegularHexagon(Scene):
    def construct(self):
        self.add(RegularPolygon(n=6, color=ORANGE, fill_opacity=0.7))


class RegularHeptagon(Scene):
    def construct(self):
        self.add(RegularPolygon(n=7, color=PINK, fill_opacity=0.7))


class Star5(Scene):
    def construct(self):
        self.add(Star(n=5, color=YELLOW, fill_opacity=0.7))


class Star8(Scene):
    def construct(self):
        self.add(Star(n=8, color=GOLD_C, fill_opacity=0.7))


class ArcQuarter(Scene):
    def construct(self):
        self.add(Arc(radius=2, start_angle=0, angle=PI / 2, color=BLUE, stroke_width=6))


class ArcThreeQuarters(Scene):
    def construct(self):
        self.add(Arc(radius=2, start_angle=0, angle=3 * PI / 2, color=RED, stroke_width=6))


class AnnularSectorScene(Scene):
    def construct(self):
        self.add(AnnularSector(
            inner_radius=0.8,
            outer_radius=2.0,
            angle=PI,
            start_angle=0,
            color=TEAL,
            fill_opacity=0.8,
        ))


class SingleLine(Scene):
    def construct(self):
        self.add(Line(start=[-2, -1, 0], end=[3, 2, 0], stroke_width=6, color=WHITE))


class DottedLine(Scene):
    def construct(self):
        self.add(DashedLine(start=[-3, 0, 0], end=[3, 0, 0], color=YELLOW, stroke_width=6))


class SingleDot(Scene):
    def construct(self):
        self.add(Dot(point=ORIGIN, color=RED))


class ArrowScene(Scene):
    def construct(self):
        self.add(Arrow(start=[-2, -1, 0], end=[2, 1, 0], color=BLUE, buff=0))


class DoubleArrowScene(Scene):
    def construct(self):
        self.add(DoubleArrow(start=[-3, 0, 0], end=[3, 0, 0], color=GREEN, buff=0))


class VectorScene(Scene):
    def construct(self):
        self.add(Vector([2, 1, 0], color=YELLOW))


# ---------------------------------------------------------------------------
# Polygon variants
# ---------------------------------------------------------------------------

class IrregularPolygon(Scene):
    def construct(self):
        verts = [
            [-2, -1, 0], [-1, 1.5, 0], [0.5, 1, 0],
            [2, 2, 0], [2.5, -0.5, 0], [0, -2, 0],
        ]
        self.add(Polygon(*verts, color=PURPLE, fill_opacity=0.6))


class RoundedSquare(Scene):
    def construct(self):
        self.add(RoundedRectangle(
            width=3, height=3, corner_radius=0.5,
            color=BLUE_C, fill_opacity=0.7,
        ))


# ---------------------------------------------------------------------------
# Color palette coverage
# ---------------------------------------------------------------------------

def _row(colors, cls=Circle, size=0.5, gap=1.2, **kwargs):
    items = []
    n = len(colors)
    start_x = -((n - 1) * gap) / 2
    for i, c in enumerate(colors):
        if cls is Circle:
            m = Circle(radius=size, color=c, fill_opacity=1.0, **kwargs)
        else:
            m = Square(side_length=size * 2, color=c, fill_opacity=1.0, **kwargs)
        m.move_to([start_x + i * gap, 0, 0])
        items.append(m)
    return items


class AllPrimaries(Scene):
    def construct(self):
        for m in _row([RED, GREEN, BLUE, YELLOW, PURPLE, TEAL, PINK, ORANGE]):
            self.add(m)


class BlueShades(Scene):
    def construct(self):
        for m in _row([BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E]):
            self.add(m)


class GreyScale(Scene):
    def construct(self):
        for m in _row([WHITE, LIGHT_GRAY, GRAY, DARK_GRAY, BLACK]):
            self.add(m)


class GoldShades(Scene):
    def construct(self):
        for m in _row([GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E]):
            self.add(m)


class AllReds(Scene):
    def construct(self):
        for m in _row([RED_A, RED_B, RED_C, RED_D, RED_E]):
            self.add(m)


class AllGreens(Scene):
    def construct(self):
        for m in _row([GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E]):
            self.add(m)


class AllPurples(Scene):
    def construct(self):
        for m in _row([PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E]):
            self.add(m)


class AllMaroons(Scene):
    def construct(self):
        for m in _row([MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E]):
            self.add(m)


class PureColors(Scene):
    def construct(self):
        self.camera.background_color = "#101010"
        for m in _row([PURE_RED, PURE_GREEN, PURE_BLUE]):
            self.add(m)


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------

class ScaledCircle(Scene):
    def construct(self):
        c = Circle(radius=1.5, color=BLUE, fill_opacity=0.5)
        c.scale(0.5)
        self.add(c)


class ScaledUpCircle(Scene):
    def construct(self):
        c = Circle(radius=1.0, color=BLUE, fill_opacity=0.5)
        c.scale(2.0)
        self.add(c)


class RotatedSquare(Scene):
    def construct(self):
        s = Square(side_length=2, color=GREEN, fill_opacity=0.8)
        s.rotate(30 * DEGREES)
        self.add(s)


class Rotated45Square(Scene):
    def construct(self):
        s = Square(side_length=2, color=RED, fill_opacity=0.8)
        s.rotate(45 * DEGREES)
        self.add(s)


class Rotated90Square(Scene):
    def construct(self):
        s = Rectangle(width=3, height=1, color=YELLOW, fill_opacity=0.8)
        s.rotate(90 * DEGREES)
        self.add(s)


class ShiftedCircle(Scene):
    def construct(self):
        c = Circle(radius=1.0, color=BLUE, fill_opacity=0.6)
        c.shift(UP * 2 + RIGHT * 3)
        self.add(c)


class FlippedTriangle(Scene):
    def construct(self):
        t = Triangle(color=TEAL, fill_opacity=0.7)
        t.rotate(PI)
        self.add(t)


class StretchedCircle(Scene):
    def construct(self):
        c = Circle(radius=1.0, color=PURPLE, fill_opacity=0.6)
        c.stretch(2.0, 0)
        self.add(c)


class ScaledNonUniform(Scene):
    def construct(self):
        s = Square(side_length=2, color=GREEN, fill_opacity=0.7)
        s.stretch(1.8, 0)
        s.stretch(0.6, 1)
        self.add(s)


# ---------------------------------------------------------------------------
# Composition / groups
# ---------------------------------------------------------------------------

class TwoCirclesOverlap(Scene):
    def construct(self):
        a = Circle(radius=1.5, color=BLUE, fill_opacity=0.5).shift(LEFT * 0.8)
        b = Circle(radius=1.5, color=RED, fill_opacity=0.5).shift(RIGHT * 0.8)
        self.add(a, b)


class NestedCircles(Scene):
    def construct(self):
        for i, (r, sw) in enumerate([(2.5, 2), (2.0, 4), (1.5, 6), (1.0, 8), (0.5, 10)]):
            self.add(Circle(radius=r, color=BLUE, stroke_width=sw, fill_opacity=0))


class GridOfSquares(Scene):
    def construct(self):
        for i in range(4):
            for j in range(4):
                s = Square(side_length=0.8, color=BLUE, fill_opacity=0.6)
                s.move_to([(i - 1.5) * 1.0, (j - 1.5) * 1.0, 0])
                self.add(s)


class PyramidOfCircles(Scene):
    def construct(self):
        for row in range(1, 6):
            y = 2 - row * 0.7
            for i in range(row):
                x = (i - (row - 1) / 2) * 0.7
                c = Circle(radius=0.3, color=YELLOW, fill_opacity=0.8)
                c.move_to([x, y, 0])
                self.add(c)


class ColorWheel(Scene):
    def construct(self):
        colors = [RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, PURPLE, PINK]
        for i, c in enumerate(colors):
            angle = i * TAU / len(colors)
            circ = Circle(radius=0.4, color=c, fill_opacity=1.0)
            circ.move_to([2 * math.cos(angle), 2 * math.sin(angle), 0])
            self.add(circ)


class RainbowBars(Scene):
    def construct(self):
        colors = [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE, PINK]
        gap = 1.0
        start_x = -((len(colors) - 1) * gap) / 2
        for i, c in enumerate(colors):
            r = Rectangle(width=0.8, height=3, color=c, fill_opacity=1.0, stroke_width=0)
            r.move_to([start_x + i * gap, 0, 0])
            self.add(r)


# ---------------------------------------------------------------------------
# Stroke widths
# ---------------------------------------------------------------------------

class ThinStroke(Scene):
    def construct(self):
        self.add(Circle(radius=2, color=WHITE, stroke_width=1, fill_opacity=0))


class ThickStroke(Scene):
    def construct(self):
        self.add(Circle(radius=2, color=WHITE, stroke_width=20, fill_opacity=0))


# ---------------------------------------------------------------------------
# Fill modes
# ---------------------------------------------------------------------------

class FullyOpaque(Scene):
    def construct(self):
        self.add(Circle(radius=1.5, color=BLUE, fill_opacity=1.0))


class SemiTransparent(Scene):
    def construct(self):
        self.add(Circle(radius=1.5, color=BLUE, fill_opacity=0.3))


class NoFill(Scene):
    def construct(self):
        self.add(Circle(radius=1.5, color=BLUE, fill_opacity=0, stroke_width=4))


# ---------------------------------------------------------------------------
# Coordinate systems
# ---------------------------------------------------------------------------

class NumberLineScene(Scene):
    def construct(self):
        self.add(NumberLine(
            x_range=[-5, 5, 1],
            length=10,
            include_numbers=False,
            include_tip=False,
        ))


class Axes2D(Scene):
    def construct(self):
        self.add(Axes(
            x_range=[-4, 4, 1],
            y_range=[-3, 3, 1],
            x_length=8,
            y_length=6,
            tips=False,
            axis_config={"include_numbers": False},
        ))


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class ZeroRadiusCircle(Scene):
    def construct(self):
        # Should render nothing, not crash. Add an anchor so manim creates a frame.
        self.add(Circle(radius=0.0001, color=BLUE, fill_opacity=0, stroke_width=0))


class NegativeCoordinates(Scene):
    def construct(self):
        c = Circle(radius=1.0, color=RED, fill_opacity=0.7)
        c.move_to([-6, -3, 0])
        self.add(c)


class OffScreenPartial(Scene):
    def construct(self):
        c = Circle(radius=3.0, color=GREEN, fill_opacity=0.5)
        c.move_to([6, 3, 0])
        self.add(c)


class BackgroundColorChange(Scene):
    def construct(self):
        self.camera.background_color = WHITE
        self.add(Circle(radius=1.5, color=RED, fill_opacity=0.7))


def _imul(a: int, b: int) -> int:
    """Emulate JavaScript's Math.imul (32-bit signed multiplication).

    The result is interpreted as a signed 32-bit int, matching the TS side.
    """
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    # full unsigned 64-bit product, truncated to 32 bits:
    prod = (a * b) & 0xFFFFFFFF
    # interpret as signed 32-bit:
    if prod >= 0x80000000:
        prod -= 0x100000000
    return prod


def _mulberry32(seed: int):
    """Deterministic PRNG exactly matching the TS mulberry32 below:

        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;

    Both sides must produce the same float sequence so ManyMobjects is diffable.
    """
    a = seed & 0xFFFFFFFF

    def next_float() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = _imul(t ^ (t >> 15), t | 1) & 0xFFFFFFFF
        t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return next_float


class ManyMobjects(Scene):
    def construct(self):
        rng = _mulberry32(42)
        for _ in range(50):
            x = rng() * 12 - 6
            y = rng() * 7 - 3.5
            r = 0.05 + rng() * 0.2
            c = Circle(radius=r, color=BLUE, fill_opacity=0.7)
            c.move_to([x, y, 0])
            self.add(c)
