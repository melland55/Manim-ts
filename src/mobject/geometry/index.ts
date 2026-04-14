/**
 * Barrel export for mobject.geometry module.
 * Python: manim.mobject.geometry
 *
 * All re-exports now point at the FULL implementations in ./arc/, ./polygram/,
 * and ./line/ rather than the minimal stubs in ./geometry.ts. The stub file
 * remains in place because a handful of intra-module files still import from
 * it directly (e.g. boolean_ops) — those can be migrated separately. The stubs
 * only accepted options-object constructors and silently defaulted positional
 * args, which masked bugs in every downstream call site that passed points.
 */

// Arc + circle + dot + ellipse + sector family — full implementations live in ./arc/
export {
  TipableVMobject,
  Arc,
  ArcBetweenPoints,
  TangentialArc,
  CurvedArrow,
  CurvedDoubleArrow,
  Circle,
  Dot,
  AnnotationDot,
  LabeledDot,
  Ellipse,
  AnnularSector,
  Sector,
  Annulus,
  CubicBezier,
  ArcPolygon,
  ArcPolygonFromArcs,
} from "./arc/index.js";

export type {
  TipableVMobjectOptions,
  ArcOptions,
  ArcBetweenPointsOptions,
  TangentialArcOptions,
  CurvedArrowOptions,
  CurvedDoubleArrowOptions,
  CircleOptions,
  DotOptions,
  AnnotationDotOptions,
  LabeledDotOptions,
  EllipseOptions,
  AnnularSectorOptions,
  SectorOptions,
  AnnulusOptions,
  CubicBezierOptions,
  ArcPolygonOptions,
} from "./arc/index.js";

// Polygon family — full implementations live in ./polygram/
export {
  Polygram,
  Polygon,
  RegularPolygram,
  RegularPolygon,
  Star,
  Triangle,
  Rectangle,
  Square,
  RoundedRectangle,
  Cutout,
  ConvexHull,
} from "./polygram/index.js";

export type {
  PolygramOptions,
  PolygonOptions,
  RegularPolygramOptions,
  RegularPolygonOptions,
  StarOptions,
  RectangleOptions,
  SquareOptions,
  RoundedRectangleOptions,
  CutoutOptions,
  ConvexHullOptions,
} from "./polygram/index.js";

// Line family — full implementations live in ./line/ (Line plus DashedLine,
// Arrow, Vector, DoubleArrow, Angle, etc.). The previous stub Line at
// ./geometry.ts only accepted options objects and silently defaulted
// positional (start, end) args to LEFT/RIGHT.
export {
  Line,
  DashedLine,
  TangentLine,
  Elbow,
  Arrow,
  Vector,
  DoubleArrow,
  Angle,
  RightAngle,
} from "./line/index.js";

export type {
  LineOptions,
  DashedLineOptions,
  TangentLineOptions,
  ElbowOptions,
  ArrowOptions,
  VectorOptions,
  DoubleArrowOptions,
  AngleOptions,
  RightAngleOptions,
} from "./line/index.js";
