/**
 * Three-dimensional mobjects.
 *
 * Barrel export for the mobject.three_d module.
 * TypeScript port of manim/mobject/three_d/__init__.py
 */

// three_d_utils
export {
  get3dVmobGradientStartAndEndPoints,
  get3dVmobStartCornerIndex,
  get3dVmobEndCornerIndex,
  get3dVmobStartCorner,
  get3dVmobEndCorner,
  get3dVmobUnitNormal,
  get3dVmobStartCornerUnitNormal,
  get3dVmobEndCornerUnitNormal,
} from "./three_d_utils.js";

// three_dimensions
export {
  ThreeDVMobject,
  Surface,
  ParametricSurface,
  Sphere,
  Dot3D,
  Cube,
  Prism,
  Cone,
  Arrow3D,
  Cylinder,
  Line3D,
  Torus,
} from "./three_dimensions.js";

export type {
  ThreeDVMobjectOptions,
  SurfaceOptions,
  ParametricSurfaceOptions,
  SphereOptions,
  Dot3DOptions,
  CubeOptions,
  PrismOptions,
  ConeOptions,
  CylinderOptions,
  Line3DOptions,
  Arrow3DOptions,
  TorusOptions,
} from "./three_dimensions.js";

// polyhedra
export {
  Polyhedron,
  Tetrahedron,
  Octahedron,
  Icosahedron,
  Dodecahedron,
  ConvexHull3D,
} from "./polyhedra.js";

export type {
  PolyhedronOptions,
  PlatonicSolidOptions,
  ConvexHull3DOptions,
} from "./polyhedra.js";
