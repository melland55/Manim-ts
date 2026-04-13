/**
 * Tests for the mobject.three_d module.
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";
import { np, ORIGIN, PI, TAU, UP, LEFT, RIGHT, OUT } from "../../src/core/math/index.js";
import {
  ThreeDVMobject,
  Surface,
  Sphere,
  Dot3D,
  Cube,
  Prism,
  Cone,
  Cylinder,
  Line3D,
  Arrow3D,
  Torus,
  Polyhedron,
  Tetrahedron,
  Octahedron,
  Icosahedron,
  Dodecahedron,
  ConvexHull3D,
  get3dVmobStartCornerIndex,
  get3dVmobEndCornerIndex,
} from "../../src/mobject/three_d/index.js";

// ─── ThreeDVMobject ─────────────────────────────────────────

describe("ThreeDVMobject", () => {
  it("constructs with default shadeIn3d=true", () => {
    const mob = new ThreeDVMobject();
    expect(mob.shadeIn3d).toBe(true);
  });

  it("can override shadeIn3d", () => {
    const mob = new ThreeDVMobject({ shadeIn3d: false });
    expect(mob.shadeIn3d).toBe(false);
  });
});

// ─── Surface ────────────────────────────────────────────────

describe("Surface", () => {
  it("creates a flat surface with correct face count", () => {
    const surface = new Surface(
      (u, v) => [u, v, 0],
      { resolution: 4 },
    );
    // 4x4 grid → 16 faces
    expect(surface.listOfFaces.length).toBe(16);
  });

  it("creates a surface with tuple resolution", () => {
    const surface = new Surface(
      (u, v) => [u, v, 0],
      { resolution: [3, 5] },
    );
    // 3x5 → 15 faces
    expect(surface.listOfFaces.length).toBe(15);
  });

  it("respects custom u/v ranges", () => {
    const surface = new Surface(
      (u, v) => [u, v, 0],
      { uRange: [-1, 1], vRange: [-2, 2], resolution: 2 },
    );
    // 2x2 → 4 faces
    expect(surface.listOfFaces.length).toBe(4);
  });

  it("disables checkerboard when false", () => {
    const surface = new Surface(
      (u, v) => [u, v, 0],
      { resolution: 2, checkerboardColors: false },
    );
    expect(surface.checkerboardColors).toBe(false);
  });
});

// ─── Sphere ─────────────────────────────────────────────────

describe("Sphere", () => {
  it("constructs with default radius 1", () => {
    const sphere = new Sphere({ resolution: [4, 4] });
    expect(sphere.radius).toBe(1);
  });

  it("uses custom radius", () => {
    const sphere = new Sphere({ radius: 2.5, resolution: [4, 4] });
    expect(sphere.radius).toBe(2.5);
  });

  it("func returns point on sphere surface", () => {
    const sphere = new Sphere({ radius: 3, resolution: [4, 4] });
    const point = sphere.func(0, PI / 2);
    // At u=0, v=PI/2: [3*cos(0)*sin(PI/2), 3*sin(0)*sin(PI/2), 3*(-cos(PI/2))]
    // = [3, 0, 0]
    expect(point[0]).toBeCloseTo(3, 5);
    expect(point[1]).toBeCloseTo(0, 5);
    expect(point[2]).toBeCloseTo(0, 5);
  });
});

// ─── Dot3D ──────────────────────────────────────────────────

describe("Dot3D", () => {
  it("constructs at origin by default", () => {
    const dot = new Dot3D();
    // Dot3D inherits from Sphere, default radius is DEFAULT_DOT_RADIUS (0.08)
    expect(dot.radius).toBe(0.08);
  });

  it("respects custom point and radius", () => {
    const dot = new Dot3D({ point: [1, 2, 3], radius: 0.2 });
    expect(dot.radius).toBe(0.2);
  });
});

// ─── Cube ───────────────────────────────────────────────────

describe("Cube", () => {
  it("creates 6 faces", () => {
    const cube = new Cube();
    expect(cube.submobjects.length).toBe(6);
  });

  it("uses custom side length", () => {
    const cube = new Cube({ sideLength: 3 });
    expect(cube.sideLength).toBe(3);
  });

  it("defaults to side length 2", () => {
    const cube = new Cube();
    expect(cube.sideLength).toBe(2);
  });
});

// ─── Prism ──────────────────────────────────────────────────

describe("Prism", () => {
  it("constructs with custom dimensions", () => {
    const prism = new Prism({ dimensions: [1, 2, 3] });
    expect(prism.dimensions).toEqual([1, 2, 3]);
  });

  it("creates 6 faces", () => {
    const prism = new Prism();
    expect(prism.submobjects.length).toBe(6);
  });
});

// ─── Cylinder ───────────────────────────────────────────────

describe("Cylinder", () => {
  it("constructs with default radius and height", () => {
    const cyl = new Cylinder({ resolution: [4, 4] });
    expect(cyl.radius).toBe(1);
    expect(cyl._height).toBe(2);
  });

  it("func returns point on cylinder surface", () => {
    const cyl = new Cylinder({ radius: 2, height: 4, resolution: [4, 4] });
    const point = cyl.func(1, 0);
    // u=1 (height), v=0 (angle)
    // [2*cos(0), 2*sin(0), 1] = [2, 0, 1]
    expect(point[0]).toBeCloseTo(2, 5);
    expect(point[1]).toBeCloseTo(0, 5);
    expect(point[2]).toBeCloseTo(1, 5);
  });
});

// ─── Torus ──────────────────────────────────────────────────

describe("Torus", () => {
  it("constructs with default major/minor radius", () => {
    const torus = new Torus({ resolution: [4, 4] });
    expect(torus.R).toBe(3);
    expect(torus.r).toBe(1);
  });

  it("uses custom radii", () => {
    const torus = new Torus({ majorRadius: 5, minorRadius: 2, resolution: [4, 4] });
    expect(torus.R).toBe(5);
    expect(torus.r).toBe(2);
  });
});

// ─── Polyhedron / Platonic Solids ───────────────────────────

describe("Tetrahedron", () => {
  it("has 4 faces", () => {
    const tet = new Tetrahedron();
    expect(tet.facesList.length).toBe(4);
  });

  it("has 4 vertices", () => {
    const tet = new Tetrahedron();
    expect(tet.vertexCoords.length).toBe(4);
  });
});

describe("Octahedron", () => {
  it("has 8 faces and 6 vertices", () => {
    const oct = new Octahedron();
    expect(oct.facesList.length).toBe(8);
    expect(oct.vertexCoords.length).toBe(6);
  });
});

describe("Icosahedron", () => {
  it("has 20 faces and 12 vertices", () => {
    const ico = new Icosahedron();
    expect(ico.facesList.length).toBe(20);
    expect(ico.vertexCoords.length).toBe(12);
  });
});

describe("Dodecahedron", () => {
  it("has 12 faces and 20 vertices", () => {
    const dod = new Dodecahedron();
    expect(dod.facesList.length).toBe(12);
    expect(dod.vertexCoords.length).toBe(20);
  });
});

// ─── three_d_utils ──────────────────────────────────────────

describe("three_d_utils", () => {
  it("get3dVmobStartCornerIndex always returns 0", () => {
    expect(get3dVmobStartCornerIndex({} as never)).toBe(0);
  });

  it("get3dVmobEndCornerIndex computes correctly", () => {
    // For nPoints=7: floor((7-1)/6)*3 = floor(1)*3 = 3
    const mock = { getNumPoints: () => 7 } as never;
    expect(get3dVmobEndCornerIndex(mock)).toBe(3);
  });
});
