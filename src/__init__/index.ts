/**
 * manim-ts — top-level namespace barrel.
 *
 * Python: manim/__init__.py
 *
 * This file mirrors Manim's top-level __init__.py, which re-exports the
 * entire public API from all submodules into a flat namespace.
 *
 * Currently only the core/ layer has been converted. Every other section
 * carries a TODO that tracks the corresponding Python import so the exports
 * can be wired in once each submodule is converted.
 */

// ─── Package version ─────────────────────────────────────────────────────────
// Python: importlib.metadata.version(__name__), falls back to "0.0.0+unknown"

export const VERSION = "0.0.0+unknown";

// ─── Core: math ──────────────────────────────────────────────────────────────
// Python: import numpy as np  (re-exported for consumer convenience)
// Python: from .utils.rate_functions import *
// Python: from .utils.bezier import *
// Python: from .utils.space_ops import *

export {
  // numpy-ts namespace — mirrors `import numpy as np`
  np,

  // numpy-ts direct imports
  array,
  zeros,
  ones,
  full,
  empty,
  arange,
  linspace,
  logspace,
  eye,
  identity,
  diag,
  dot,
  cross,
  matmul,
  vstack,
  hstack,
  concatenate,
  stack,
  reshape,
  transpose,
  clip,
  maximum,
  minimum,
  sum,
  mean,
  prod,
  sort,
  argsort,
  where,
  allclose,
  isclose,
  linalg,
  random,

  // 3-D constants
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  OUT,
  IN,
  PI,
  TAU,
  DEGREES,

  // Scalar helpers
  interpolate,
  inverseInterpolate,
  integerInterpolate,
  mid,
  clamp,
  approxEqual,
  sigmoid,

  // Point / vector helpers
  point3D,
  pointNorm,
  normalizePoint,
  dotProduct,
  crossProduct,
  pointDistance,
  interpolatePoint,
  midPoint,

  // Angle operations
  angleOfVector,
  angleBetweenVectors,
  rotateVector,
  getUnitNormal,
  centerOfMass,

  // Complex numbers
  complexToR3,
  r3ToComplex,
  complexMultiply,

  // Line / intersection
  findIntersection,

  // Coordinate transforms
  cartesianToSpherical,
  sphericalToCartesian,

  // Bezier
  bezier,
  partialBezierPoints,

  // Rate functions
  linear,
  smooth,
  smoothWithInflection,
  smoothstep,
  smootherstep,
  smoothererstep,
  rushInto,
  rushFrom,
  slowInto,
  doubleSmooth,
  thereAndBack,
  thereAndBackWithPause,
  runningStart,
  notQuiteThereRatio,
  wiggle,
  squishRateFunc,
  lingering,
  exponentialDecay,
  easeInSine,
  easeOutSine,
  easeInOutSine,

  // Matrix helpers (gl-matrix)
  rotationMatrix,
  applyMatrixToPoint,
  applyMatrixToPoints,

  // Quaternions
  quaternionFromAngleAxis,
  angleAxisFromQuaternion,
  quaternionMultiply,
  quaternionConjugate,

  // Points3D helpers
  addPoints,
  subtractPoints,
  scalePoint,
  clonePoint,
  pointFromVec3,
  pointsFromArray,
  emptyPoints,
  pointCount,
  getPoint,
  setPoint,
  concatPoints,
  translatePoints,
  scalePoints,
  pointsBoundingBox,
  pointsCenter,
} from "../core/math/index.js";

export type {
  NDArray,
  Point3D,
  Points3D,
  RateFunc,
  Complex,
  Quaternion,
} from "../core/math/index.js";

// ─── Core: color ─────────────────────────────────────────────────────────────
// Python: from .utils.color import *
// Python: from .constants import *  (color constants)

export {
  Color,

  // Grayscale
  WHITE,
  GRAY_A,
  GREY_A,
  GRAY_B,
  GREY_B,
  GRAY_C,
  GREY_C,
  GRAY_D,
  GREY_D,
  GRAY_E,
  GREY_E,
  BLACK,
  LIGHTER_GRAY,
  LIGHTER_GREY,
  LIGHT_GRAY,
  LIGHT_GREY,
  GRAY,
  GREY,
  DARK_GRAY,
  DARK_GREY,
  DARKER_GRAY,
  DARKER_GREY,

  // Pure colors
  PURE_RED,
  PURE_GREEN,
  PURE_BLUE,
  PURE_CYAN,
  PURE_MAGENTA,
  PURE_YELLOW,

  // Blue
  BLUE_A,
  BLUE_B,
  BLUE_C,
  BLUE_D,
  BLUE_E,
  BLUE,
  DARK_BLUE,

  // Teal
  TEAL_A,
  TEAL_B,
  TEAL_C,
  TEAL_D,
  TEAL_E,
  TEAL,

  // Green
  GREEN_A,
  GREEN_B,
  GREEN_C,
  GREEN_D,
  GREEN_E,
  GREEN,

  // Yellow (YELLOW = #F7D96F, not #FFFF00)
  YELLOW_A,
  YELLOW_B,
  YELLOW_C,
  YELLOW_D,
  YELLOW_E,
  YELLOW,

  // Gold
  GOLD_A,
  GOLD_B,
  GOLD_C,
  GOLD_D,
  GOLD_E,
  GOLD,

  // Red
  RED_A,
  RED_B,
  RED_C,
  RED_D,
  RED_E,
  RED,

  // Maroon
  MAROON_A,
  MAROON_B,
  MAROON_C,
  MAROON_D,
  MAROON_E,
  MAROON,

  // Purple
  PURPLE_A,
  PURPLE_B,
  PURPLE_C,
  PURPLE_D,
  PURPLE_E,
  PURPLE,

  // Other
  PINK,
  LIGHT_PINK,
  ORANGE,
  LIGHT_BROWN,
  DARK_BROWN,
  GRAY_BROWN,
  GREY_BROWN,

  // Logo colors
  LOGO_WHITE,
  LOGO_GREEN,
  LOGO_BLUE,
  LOGO_RED,
  LOGO_BLACK,
} from "../core/color/index.js";

// ─── Core: type contracts ─────────────────────────────────────────────────────
// Python: (implicit — TypeScript-only layer, no direct Python equivalent)

export type {
  ColorArray,
  Updater,
  IColor,
  ManimConfig,
  MobjectOptions,
  IMobject,
  VMobjectOptions,
  IVMobject,
  AnimationOptions,
  IAnimation,
  IScene,
  ICamera,
  IRenderer,
} from "../core/types.js";

// ─── TODO: animation ─────────────────────────────────────────────────────────
// Python: from .animation.animation import *
// Python: from .animation.changing import *
// Python: from .animation.composition import *
// Python: from .animation.creation import *
// Python: from .animation.fading import *
// Python: from .animation.growing import *
// Python: from .animation.indication import *
// Python: from .animation.movement import *
// Python: from .animation.numbers import *
// Python: from .animation.rotation import *
// Python: from .animation.specialized import *
// Python: from .animation.speedmodifier import *
// Python: from .animation.transform import *
// Python: from .animation.transform_matching_parts import *
// Python: from .animation.updaters.mobject_update_utils import *
// Python: from .animation.updaters.update import *
// TODO: export * from "../animation/index.js";  (wire in once animation/ is converted)

// ─── TODO: camera ────────────────────────────────────────────────────────────
// Python: from .camera.camera import *
// Python: from .camera.mapping_camera import *
// Python: from .camera.moving_camera import *
// Python: from .camera.multi_camera import *
// Python: from .camera.three_d_camera import *
// TODO: export * from "../camera/index.js";

// ─── TODO: mobject ───────────────────────────────────────────────────────────
// Python: from .mobject.frame import *
// Python: from .mobject.geometry.arc import *
// Python: from .mobject.geometry.boolean_ops import *
// Python: from .mobject.geometry.labeled import *
// Python: from .mobject.geometry.line import *
// Python: from .mobject.geometry.polygram import *
// Python: from .mobject.geometry.shape_matchers import *
// Python: from .mobject.geometry.tips import *
// Python: from .mobject.graph import *
// Python: from .mobject.graphing.coordinate_systems import *
// Python: from .mobject.graphing.functions import *
// Python: from .mobject.graphing.number_line import *
// Python: from .mobject.graphing.probability import *
// Python: from .mobject.graphing.scale import *
// Python: from .mobject.logo import *
// Python: from .mobject.matrix import *
// Python: from .mobject.mobject import *
// Python: from .mobject.opengl.dot_cloud import *
// Python: from .mobject.opengl.opengl_point_cloud_mobject import *
// Python: from .mobject.svg.brace import *
// Python: from .mobject.svg.svg_mobject import *
// Python: from .mobject.table import *
// Python: from .mobject.text.code_mobject import *
// Python: from .mobject.text.numbers import *
// Python: from .mobject.text.tex_mobject import *
// Python: from .mobject.text.text_mobject import *
// Python: from .mobject.three_d.polyhedra import *
// Python: from .mobject.three_d.three_d_utils import *
// Python: from .mobject.three_d.three_dimensions import *
// Python: from .mobject.types.image_mobject import *
// Python: from .mobject.types.point_cloud_mobject import *
// Python: from .mobject.types.vectorized_mobject import *
// Python: from .mobject.value_tracker import *
// Python: from .mobject.vector_field import *
// TODO: export * from "../mobject/index.js";

// ─── TODO: renderer ──────────────────────────────────────────────────────────
// Python: from .renderer.cairo_renderer import *
//   → NOTE: Cairo renderer should be ported to @napi-rs/canvas (NOT translated 1:1)
// TODO: export * from "../renderer/index.js";

// ─── TODO: scene ─────────────────────────────────────────────────────────────
// Python: from .scene.moving_camera_scene import *
// Python: from .scene.scene import *
// Python: from .scene.scene_file_writer import *
// Python: from .scene.section import *
// Python: from .scene.three_d_scene import *
// Python: from .scene.vector_space_scene import *
// Python: from .scene.zoomed_scene import *
// TODO: export * from "../scene/index.js";

// ─── TODO: utils (remaining) ─────────────────────────────────────────────────
// Python: from .utils.commands import *
// Python: from .utils.config_ops import *
// Python: from .utils.debug import *
// Python: from .utils.file_ops import *
// Python: from .utils.images import *
// Python: from .utils.iterables import *
// Python: from .utils.paths import *
// Python: from .utils.simple_functions import *
// Python: from .utils.sounds import *
// Python: from .utils.tex import *
// Python: from .utils.tex_templates import *
// TODO: export * from "../utils/index.js";

// ─── TODO: config ────────────────────────────────────────────────────────────
// Python: from ._config import *
// TODO: export { config } from "../config/index.js";

// ─── TODO: plugins ───────────────────────────────────────────────────────────
// Python: from .plugins import *
// TODO: export * from "../plugins/index.js";
