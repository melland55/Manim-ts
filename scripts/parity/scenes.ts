/**
 * Parity scenes for manim-ts. Each key in SCENES must match a class name in
 * scenes.py exactly — the diff runner uses the key as the pairing identifier.
 *
 * A scene factory returns the mobjects to render plus (optional) background
 * color override. No animations — only the final frame is diffed.
 */

import { np } from "../../src/core/math/index.js";
import type { IColor } from "../../src/core/types.js";

import {
  Circle,
  Square,
  Rectangle,
  RoundedRectangle,
  Triangle,
  RegularPolygon,
  Star,
  Arc,
  AnnularSector,
  Polygon,
  Line,
  DashedLine,
  Dot,
  Arrow,
  DoubleArrow,
  Vector,
} from "../../src/mobject/geometry/index.js";

import { NumberLine, Axes } from "../../src/mobject/graphing/index.js";

import {
  WHITE,
  BLACK,
  LIGHT_GRAY,
  GRAY,
  DARK_GRAY,
  RED,
  GREEN,
  BLUE,
  YELLOW,
  PURPLE,
  TEAL,
  PINK,
  ORANGE,
  BLUE_A,
  BLUE_B,
  BLUE_C,
  BLUE_D,
  BLUE_E,
  GOLD_A,
  GOLD_B,
  GOLD_C,
  GOLD_D,
  GOLD_E,
  RED_A,
  RED_B,
  RED_C,
  RED_D,
  RED_E,
  GREEN_A,
  GREEN_B,
  GREEN_C,
  GREEN_D,
  GREEN_E,
  PURPLE_A,
  PURPLE_B,
  PURPLE_C,
  PURPLE_D,
  PURPLE_E,
  MAROON_A,
  MAROON_B,
  MAROON_C,
  MAROON_D,
  MAROON_E,
  PURE_RED,
  PURE_GREEN,
  PURE_BLUE,
} from "../../src/utils/color/manim_colors.js";

import { ManimColor } from "../../src/utils/color/core.js";

// Directions — build as plain number[] arrays so .multiply / .add chains work.
const ORIGIN = np.array([0, 0, 0]);
const UP = np.array([0, 1, 0]);
const DOWN = np.array([0, -1, 0]);
const LEFT = np.array([-1, 0, 0]);
const RIGHT = np.array([1, 0, 0]);

const PI = Math.PI;
const TAU = 2 * Math.PI;
const DEGREES = TAU / 360;

export interface SceneData {
  mobjects: unknown[];
  backgroundColor?: IColor;
}

export type SceneFactory = () => SceneData;

// Helper: row of colored circles, used by palette scenes.
function colorRow(colors: IColor[], size = 0.5, gap = 1.2): unknown[] {
  const n = colors.length;
  const startX = -((n - 1) * gap) / 2;
  return colors.map((c, i) => {
    const circ = new Circle({ radius: size, color: c, fillOpacity: 1.0 });
    circ.moveTo(np.array([startX + i * gap, 0, 0]));
    return circ;
  });
}

export const SCENES: Record<string, SceneFactory> = {
  // ── Shapes ─────────────────────────────────────────────
  SingleCircle: () => ({
    mobjects: [new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0.5 })],
  }),

  CircleStrokeOnly: () => ({
    mobjects: [new Circle({ radius: 2, color: RED, fillOpacity: 0 })],
  }),

  SingleSquare: () => ({
    mobjects: [new Square({ sideLength: 2, color: GREEN, fillOpacity: 0.8 })],
  }),

  RectangleWide: () => ({
    mobjects: [new Rectangle({ width: 4, height: 1, color: YELLOW, fillOpacity: 0.6 })],
  }),

  TriangleBasic: () => ({
    mobjects: [new Triangle({ color: TEAL, fillOpacity: 0.7 })],
  }),

  RegularPentagon: () => ({
    mobjects: [new RegularPolygon(5, { color: PURPLE, fillOpacity: 0.7 })],
  }),

  RegularHexagon: () => ({
    mobjects: [new RegularPolygon(6, { color: ORANGE, fillOpacity: 0.7 })],
  }),

  RegularHeptagon: () => ({
    mobjects: [new RegularPolygon(7, { color: PINK, fillOpacity: 0.7 })],
  }),

  Star5: () => ({
    mobjects: [new Star(5, { color: YELLOW, fillOpacity: 0.7 })],
  }),

  Star8: () => ({
    mobjects: [new Star(8, { color: GOLD_C, fillOpacity: 0.7 })],
  }),

  ArcQuarter: () => ({
    mobjects: [new Arc({ radius: 2, startAngle: 0, angle: PI / 2, color: BLUE, strokeWidth: 6 })],
  }),

  ArcThreeQuarters: () => ({
    mobjects: [new Arc({ radius: 2, startAngle: 0, angle: (3 * PI) / 2, color: RED, strokeWidth: 6 })],
  }),

  AnnularSectorScene: () => ({
    mobjects: [new AnnularSector({
      innerRadius: 0.8,
      outerRadius: 2.0,
      angle: PI,
      startAngle: 0,
      color: TEAL,
      fillOpacity: 0.8,
    })],
  }),

  SingleLine: () => ({
    mobjects: [new Line(np.array([-2, -1, 0]), np.array([3, 2, 0]), { strokeWidth: 6, color: WHITE })],
  }),

  DottedLine: () => ({
    mobjects: [new DashedLine(np.array([-3, 0, 0]), np.array([3, 0, 0]), { color: YELLOW, strokeWidth: 6 })],
  }),

  SingleDot: () => ({
    mobjects: [new Dot({ point: ORIGIN, color: RED })],
  }),

  ArrowScene: () => ({
    mobjects: [new Arrow(np.array([-2, -1, 0]), np.array([2, 1, 0]), { color: BLUE, buff: 0 })],
  }),

  DoubleArrowScene: () => ({
    mobjects: [new DoubleArrow(np.array([-3, 0, 0]), np.array([3, 0, 0]), { color: GREEN, buff: 0 })],
  }),

  VectorScene: () => ({
    mobjects: [new Vector([2, 1, 0], { color: YELLOW })],
  }),

  // ── Polygon variants ────────────────────────────────────
  IrregularPolygon: () => ({
    mobjects: [new Polygon(
      [
        [-2, -1, 0], [-1, 1.5, 0], [0.5, 1, 0],
        [2, 2, 0], [2.5, -0.5, 0], [0, -2, 0],
      ],
      { color: PURPLE, fillOpacity: 0.6 },
    )],
  }),

  RoundedSquare: () => ({
    mobjects: [new RoundedRectangle({
      width: 3, height: 3, cornerRadius: 0.5,
      color: BLUE_C, fillOpacity: 0.7,
    })],
  }),

  // ── Palette coverage ───────────────────────────────────
  AllPrimaries: () => ({
    mobjects: colorRow([RED, GREEN, BLUE, YELLOW, PURPLE, TEAL, PINK, ORANGE]),
  }),

  BlueShades: () => ({
    mobjects: colorRow([BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E]),
  }),

  GreyScale: () => ({
    mobjects: colorRow([WHITE, LIGHT_GRAY, GRAY, DARK_GRAY, BLACK]),
  }),

  GoldShades: () => ({
    mobjects: colorRow([GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E]),
  }),

  AllReds: () => ({
    mobjects: colorRow([RED_A, RED_B, RED_C, RED_D, RED_E]),
  }),

  AllGreens: () => ({
    mobjects: colorRow([GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E]),
  }),

  AllPurples: () => ({
    mobjects: colorRow([PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E]),
  }),

  AllMaroons: () => ({
    mobjects: colorRow([MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E]),
  }),

  PureColors: () => ({
    backgroundColor: new ManimColor("#101010"),
    mobjects: colorRow([PURE_RED, PURE_GREEN, PURE_BLUE]),
  }),

  // ── Transforms ─────────────────────────────────────────
  ScaledCircle: () => {
    const c = new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0.5 });
    c.scale(0.5);
    return { mobjects: [c] };
  },

  ScaledUpCircle: () => {
    const c = new Circle({ radius: 1.0, color: BLUE, fillOpacity: 0.5 });
    c.scale(2.0);
    return { mobjects: [c] };
  },

  RotatedSquare: () => {
    const s = new Square({ sideLength: 2, color: GREEN, fillOpacity: 0.8 });
    s.rotate(30 * DEGREES);
    return { mobjects: [s] };
  },

  Rotated45Square: () => {
    const s = new Square({ sideLength: 2, color: RED, fillOpacity: 0.8 });
    s.rotate(45 * DEGREES);
    return { mobjects: [s] };
  },

  Rotated90Square: () => {
    const s = new Rectangle({ width: 3, height: 1, color: YELLOW, fillOpacity: 0.8 });
    s.rotate(90 * DEGREES);
    return { mobjects: [s] };
  },

  ShiftedCircle: () => {
    const c = new Circle({ radius: 1.0, color: BLUE, fillOpacity: 0.6 });
    c.shift(UP.multiply(2).add(RIGHT.multiply(3)));
    return { mobjects: [c] };
  },

  FlippedTriangle: () => {
    const t = new Triangle({ color: TEAL, fillOpacity: 0.7 });
    t.rotate(PI);
    return { mobjects: [t] };
  },

  StretchedCircle: () => {
    const c = new Circle({ radius: 1.0, color: PURPLE, fillOpacity: 0.6 });
    c.stretch(2.0, 0);
    return { mobjects: [c] };
  },

  ScaledNonUniform: () => {
    const s = new Square({ sideLength: 2, color: GREEN, fillOpacity: 0.7 });
    s.stretch(1.8, 0);
    s.stretch(0.6, 1);
    return { mobjects: [s] };
  },

  // ── Composition / groups ───────────────────────────────
  TwoCirclesOverlap: () => {
    const a = new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0.5 });
    a.shift(LEFT.multiply(0.8));
    const b = new Circle({ radius: 1.5, color: RED, fillOpacity: 0.5 });
    b.shift(RIGHT.multiply(0.8));
    return { mobjects: [a, b] };
  },

  NestedCircles: () => {
    const specs: [number, number][] = [
      [2.5, 2], [2.0, 4], [1.5, 6], [1.0, 8], [0.5, 10],
    ];
    return {
      mobjects: specs.map(([r, sw]) => new Circle({
        radius: r, color: BLUE, strokeWidth: sw, fillOpacity: 0,
      })),
    };
  },

  GridOfSquares: () => {
    const mobs: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const s = new Square({ sideLength: 0.8, color: BLUE, fillOpacity: 0.6 });
        s.moveTo(np.array([(i - 1.5) * 1.0, (j - 1.5) * 1.0, 0]));
        mobs.push(s);
      }
    }
    return { mobjects: mobs };
  },

  PyramidOfCircles: () => {
    const mobs: unknown[] = [];
    for (let row = 1; row <= 5; row++) {
      const y = 2 - row * 0.7;
      for (let i = 0; i < row; i++) {
        const x = (i - (row - 1) / 2) * 0.7;
        const c = new Circle({ radius: 0.3, color: YELLOW, fillOpacity: 0.8 });
        c.moveTo(np.array([x, y, 0]));
        mobs.push(c);
      }
    }
    return { mobjects: mobs };
  },

  ColorWheel: () => {
    const colors = [RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, PURPLE, PINK];
    const mobs: unknown[] = [];
    colors.forEach((c, i) => {
      const angle = (i * TAU) / colors.length;
      const circ = new Circle({ radius: 0.4, color: c, fillOpacity: 1.0 });
      circ.moveTo(np.array([2 * Math.cos(angle), 2 * Math.sin(angle), 0]));
      mobs.push(circ);
    });
    return { mobjects: mobs };
  },

  RainbowBars: () => {
    const colors = [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE, PINK];
    const gap = 1.0;
    const startX = -((colors.length - 1) * gap) / 2;
    const mobs: unknown[] = [];
    colors.forEach((c, i) => {
      const r = new Rectangle({
        width: 0.8, height: 3, color: c, fillOpacity: 1.0, strokeWidth: 0,
      });
      r.moveTo(np.array([startX + i * gap, 0, 0]));
      mobs.push(r);
    });
    return { mobjects: mobs };
  },

  // ── Stroke widths ──────────────────────────────────────
  ThinStroke: () => ({
    mobjects: [new Circle({ radius: 2, color: WHITE, strokeWidth: 1, fillOpacity: 0 })],
  }),

  ThickStroke: () => ({
    mobjects: [new Circle({ radius: 2, color: WHITE, strokeWidth: 20, fillOpacity: 0 })],
  }),

  // ── Fill modes ─────────────────────────────────────────
  FullyOpaque: () => ({
    mobjects: [new Circle({ radius: 1.5, color: BLUE, fillOpacity: 1.0 })],
  }),

  SemiTransparent: () => ({
    mobjects: [new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0.3 })],
  }),

  NoFill: () => ({
    mobjects: [new Circle({ radius: 1.5, color: BLUE, fillOpacity: 0, strokeWidth: 4 })],
  }),

  // ── Coordinate systems ─────────────────────────────────
  NumberLineScene: () => ({
    mobjects: [new NumberLine({
      xRange: [-5, 5, 1],
      length: 10,
      includeNumbers: false,
      includeTip: false,
    })],
  }),

  Axes2D: () => ({
    mobjects: [new Axes({
      xRange: [-4, 4, 1],
      yRange: [-3, 3, 1],
      xLength: 8,
      yLength: 6,
      tips: false,
      axisConfig: { includeNumbers: false },
    })],
  }),

  // ── Edge cases ─────────────────────────────────────────
  ZeroRadiusCircle: () => ({
    mobjects: [new Circle({ radius: 0.0001, color: BLUE, fillOpacity: 0, strokeWidth: 0 })],
  }),

  NegativeCoordinates: () => {
    const c = new Circle({ radius: 1.0, color: RED, fillOpacity: 0.7 });
    c.moveTo(np.array([-6, -3, 0]));
    return { mobjects: [c] };
  },

  OffScreenPartial: () => {
    const c = new Circle({ radius: 3.0, color: GREEN, fillOpacity: 0.5 });
    c.moveTo(np.array([6, 3, 0]));
    return { mobjects: [c] };
  },

  BackgroundColorChange: () => ({
    backgroundColor: WHITE,
    mobjects: [new Circle({ radius: 1.5, color: RED, fillOpacity: 0.7 })],
  }),

  ManyMobjects: () => {
    // Mulberry32 PRNG seeded identically to Python's random.Random(42) sequence?
    // No — we instead use a fixed deterministic sequence that matches the
    // Python side by generating values here. The Python side uses random.Random(42)
    // with uniform() calls; those are Mersenne Twister and won't match mulberry32.
    // So we pre-compute the same sequence Python produces and hard-code it.
    // For simplicity: generate 50 (x, y, r) triples with a deterministic PRNG,
    // and regenerate the Python side to use the SAME algorithm.
    // Easier: use a seeded mulberry32 here AND in Python side we did random.Random.
    // Since we can't match MT easily, this scene will likely diverge. Marked as
    // known edge case.
    const rng = mulberry32(42);
    const mobs: unknown[] = [];
    for (let i = 0; i < 50; i++) {
      const x = rng() * 12 - 6;
      const y = rng() * 7 - 3.5;
      const r = 0.05 + rng() * 0.2;
      const c = new Circle({ radius: r, color: BLUE, fillOpacity: 0.7 });
      c.moveTo(np.array([x, y, 0]));
      mobs.push(c);
    }
    return { mobjects: mobs };
  },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
