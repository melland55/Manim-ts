/**
 * Coordinate systems and function graphing related mobjects.
 * TypeScript port of manim/mobject/graphing/__init__.py
 *
 * Re-exports from submodules:
 *   - coordinate_systems
 *   - functions
 *   - number_line
 *   - probability
 *   - scale
 */

export { _ScaleBase, LinearBase, LogBase } from "./scale/index.js";

export {
  CoordinateSystem,
  Axes,
  ThreeDAxes,
  NumberPlane,
  PolarPlane,
  ComplexPlane,
} from "./coordinate_systems/index.js";
export type {
  CoordinateSystemOptions,
  AxesOptions,
  ThreeDAxesOptions,
  NumberPlaneOptions,
  PolarPlaneOptions,
  ComplexPlaneOptions,
  ComplexNumber,
} from "./coordinate_systems/index.js";

export { NumberLine, UnitInterval } from "./number_line/index.js";
export type { NumberLineOptions, UnitIntervalOptions } from "./number_line/index.js";

export {
  ParametricFunction,
  FunctionGraph,
  ImplicitFunction,
} from "./functions/index.js";
export type {
  ParametricFunctionOptions,
  FunctionGraphOptions,
  ImplicitFunctionOptions,
} from "./functions/index.js";

export { SampleSpace, BarChart } from "./probability/index.js";
export type { SampleSpaceOptions, BarChartOptions } from "./probability/index.js";
