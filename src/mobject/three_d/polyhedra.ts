/**
 * General polyhedral class and platonic solids.
 *
 * TypeScript port of manim/mobject/three_d/polyhedra.py
 */

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { Mobject } from "../mobject/index.js";
import { Dot3D } from "./three_dimensions.js";
import { QuickHull } from "../../utils/qhull/index.js";

// ─── Stub types for unconverted dependencies ────────────────
// VGroup, Polygon, and Graph are not yet converted.
// We use Mobject-based stubs here.
// TODO: Replace with real imports once mobject.types, mobject.geometry,
// and mobject.graph are converted.

/**
 * Stub for VMobject with fill/stroke support.
 */
class VMobjectStub extends Mobject {
  fillOpacity: number = 0;
  shadeIn3d: boolean = false;

  setFill(color?: unknown, opacity?: number | null): this {
    if (opacity !== undefined && opacity !== null) {
      this.fillOpacity = opacity;
    }
    return this;
  }
}

/**
 * Stub for VGroup.
 */
class VGroupStub extends VMobjectStub {}

/**
 * Stub for Polygon — creates a Mobject from vertex coordinates.
 */
class PolygonStub extends VMobjectStub {
  constructor(
    ...vertices: Array<Point3D | number[]>
  ) {
    super();
    // Store points from the polygon corners
    if (vertices.length > 0) {
      const pts = vertices.map((v) =>
        Array.isArray(v) ? v : (v.toArray() as number[]),
      );
      this.points = np.array(pts);
    }
  }
}

/**
 * Stub for Graph — holds vertices and edges with layout.
 */
class GraphStub extends Mobject {
  vertices: number[];
  edges: Array<[number, number]>;
  layout: Map<number, number[]>;
  private _vertexMobjects: Map<number, Mobject>;

  constructor(
    vertices: number[],
    edges: Array<[number, number]>,
    options: {
      layout?: Record<number, number[]>;
      vertexType?: new (...args: unknown[]) => Mobject;
      edgeConfig?: Record<string, unknown>;
    } = {},
  ) {
    super();
    this.vertices = vertices;
    this.edges = edges;
    this.layout = new Map();
    this._vertexMobjects = new Map();

    const VertexClass = options.vertexType ?? Dot3D;

    if (options.layout) {
      for (const [key, val] of Object.entries(options.layout)) {
        const k = Number(key);
        this.layout.set(k, val);
        const mob = new (VertexClass as new (...args: unknown[]) => Mobject)(
          { point: np.array(val) },
        );
        this._vertexMobjects.set(k, mob);
        this.add(mob);
      }
    }
  }

  getVertex(index: number): Mobject {
    const mob = this._vertexMobjects.get(index);
    if (!mob) {
      throw new Error(`Vertex ${index} not found in graph`);
    }
    return mob;
  }
}

// ─── Polyhedron ─────────────────────────────────────────────

export interface PolyhedronOptions {
  facesConfig?: Record<string, unknown>;
  graphConfig?: Record<string, unknown>;
}

export class Polyhedron extends VGroupStub {
  facesConfig: Record<string, unknown>;
  graphConfig: Record<string, unknown>;
  vertexCoords: number[][];
  vertexIndices: number[];
  layout: Record<number, number[]>;
  facesList: number[][];
  faceCoords: number[][][];
  edges: Array<[number, number]>;
  faces: VGroupStub;
  graph: GraphStub;

  constructor(
    vertexCoords: number[][],
    facesList: number[][],
    options: PolyhedronOptions = {},
  ) {
    super();

    this.facesConfig = {
      fillOpacity: 0.5,
      shadeIn3d: true,
      ...options.facesConfig,
    };
    this.graphConfig = {
      vertexType: Dot3D,
      edgeConfig: { strokeOpacity: 0 },
      ...options.graphConfig,
    };

    this.vertexCoords = vertexCoords;
    this.vertexIndices = vertexCoords.map((_, i) => i);

    this.layout = {} as Record<number, number[]>;
    for (let i = 0; i < vertexCoords.length; i++) {
      this.layout[i] = vertexCoords[i];
    }

    this.facesList = facesList;
    this.faceCoords = facesList.map((face) =>
      face.map((j) => this.layout[j]),
    );

    this.edges = this.getEdges(facesList);
    this.faces = this.createFaces(this.faceCoords);
    this.graph = new GraphStub(
      this.vertexIndices,
      this.edges,
      {
        layout: this.layout,
        ...(this.graphConfig as Record<string, unknown>),
      },
    );

    this.add(this.faces, this.graph);
    this.addUpdater((_mob: Mobject) => this.updateFaces());
  }

  getEdges(facesList: number[][]): Array<[number, number]> {
    const edges: Array<[number, number]> = [];
    for (const face of facesList) {
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        edges.push([a, b]);
      }
    }
    return edges;
  }

  createFaces(faceCoords: number[][][]): VGroupStub {
    const faceGroup = new VGroupStub();
    for (const face of faceCoords) {
      const polygon = new PolygonStub(
        ...face.map((coord) => np.array(coord)),
      );
      // Apply faces config
      if (typeof this.facesConfig.fillOpacity === "number") {
        polygon.fillOpacity = this.facesConfig.fillOpacity;
      }
      if (typeof this.facesConfig.shadeIn3d === "boolean") {
        polygon.shadeIn3d = this.facesConfig.shadeIn3d;
      }
      faceGroup.add(polygon);
    }
    return faceGroup;
  }

  updateFaces(): void {
    const faceCoords = this.extractFaceCoords();
    const newFaces = this.createFaces(faceCoords);
    this.faces.matchPoints(newFaces);
  }

  extractFaceCoords(): number[][][] {
    const newVertexCoords: number[][] = [];
    for (const v of this.graph.vertices) {
      const mob = this.graph.getVertex(v);
      const center = mob.getCenter();
      newVertexCoords.push(center.toArray() as number[]);
    }
    const layout: Record<number, number[]> = {};
    for (let i = 0; i < newVertexCoords.length; i++) {
      layout[i] = newVertexCoords[i];
    }
    return this.facesList.map((face) =>
      face.map((j) => layout[j]),
    );
  }
}

// ─── Platonic Solids ────────────────────────────────────────

export interface PlatonicSolidOptions extends PolyhedronOptions {
  edgeLength?: number;
}

export class Tetrahedron extends Polyhedron {
  constructor(options: PlatonicSolidOptions = {}) {
    const edgeLength = options.edgeLength ?? 1;
    const unit = edgeLength * Math.SQRT2 / 4;
    super(
      [
        [unit, unit, unit],
        [unit, -unit, -unit],
        [-unit, unit, -unit],
        [-unit, -unit, unit],
      ],
      [[0, 1, 2], [3, 0, 2], [0, 1, 3], [3, 1, 2]],
      options,
    );
  }
}

export class Octahedron extends Polyhedron {
  constructor(options: PlatonicSolidOptions = {}) {
    const edgeLength = options.edgeLength ?? 1;
    const unit = edgeLength * Math.SQRT2 / 2;
    super(
      [
        [unit, 0, 0],
        [-unit, 0, 0],
        [0, unit, 0],
        [0, -unit, 0],
        [0, 0, unit],
        [0, 0, -unit],
      ],
      [
        [2, 4, 1],
        [0, 4, 2],
        [4, 3, 0],
        [1, 3, 4],
        [3, 5, 0],
        [1, 5, 3],
        [2, 5, 1],
        [0, 5, 2],
      ],
      options,
    );
  }
}

export class Icosahedron extends Polyhedron {
  constructor(options: PlatonicSolidOptions = {}) {
    const edgeLength = options.edgeLength ?? 1;
    const unitA = edgeLength * ((1 + Math.sqrt(5)) / 4);
    const unitB = edgeLength * (1 / 2);
    super(
      [
        [0, unitB, unitA],
        [0, -unitB, unitA],
        [0, unitB, -unitA],
        [0, -unitB, -unitA],
        [unitB, unitA, 0],
        [unitB, -unitA, 0],
        [-unitB, unitA, 0],
        [-unitB, -unitA, 0],
        [unitA, 0, unitB],
        [unitA, 0, -unitB],
        [-unitA, 0, unitB],
        [-unitA, 0, -unitB],
      ],
      [
        [1, 8, 0],
        [1, 5, 7],
        [8, 5, 1],
        [7, 3, 5],
        [5, 9, 3],
        [8, 9, 5],
        [3, 2, 9],
        [9, 4, 2],
        [8, 4, 9],
        [0, 4, 8],
        [6, 4, 0],
        [6, 2, 4],
        [11, 2, 6],
        [3, 11, 2],
        [0, 6, 10],
        [10, 1, 0],
        [10, 7, 1],
        [11, 7, 3],
        [10, 11, 7],
        [10, 11, 6],
      ],
      options,
    );
  }
}

export class Dodecahedron extends Polyhedron {
  constructor(options: PlatonicSolidOptions = {}) {
    const edgeLength = options.edgeLength ?? 1;
    const unitA = edgeLength * ((1 + Math.sqrt(5)) / 4);
    const unitB = edgeLength * ((3 + Math.sqrt(5)) / 4);
    const unitC = edgeLength * (1 / 2);
    super(
      [
        [unitA, unitA, unitA],
        [unitA, unitA, -unitA],
        [unitA, -unitA, unitA],
        [unitA, -unitA, -unitA],
        [-unitA, unitA, unitA],
        [-unitA, unitA, -unitA],
        [-unitA, -unitA, unitA],
        [-unitA, -unitA, -unitA],
        [0, unitC, unitB],
        [0, unitC, -unitB],
        [0, -unitC, -unitB],
        [0, -unitC, unitB],
        [unitC, unitB, 0],
        [-unitC, unitB, 0],
        [unitC, -unitB, 0],
        [-unitC, -unitB, 0],
        [unitB, 0, unitC],
        [-unitB, 0, unitC],
        [unitB, 0, -unitC],
        [-unitB, 0, -unitC],
      ],
      [
        [18, 16, 0, 12, 1],
        [3, 18, 16, 2, 14],
        [3, 10, 9, 1, 18],
        [1, 9, 5, 13, 12],
        [0, 8, 4, 13, 12],
        [2, 16, 0, 8, 11],
        [4, 17, 6, 11, 8],
        [17, 19, 5, 13, 4],
        [19, 7, 15, 6, 17],
        [6, 15, 14, 2, 11],
        [19, 5, 9, 10, 7],
        [7, 10, 3, 14, 15],
      ],
      options,
    );
  }
}

// ─── ConvexHull3D ───────────────────────────────────────────

export interface ConvexHull3DOptions extends PolyhedronOptions {
  tolerance?: number;
}

export class ConvexHull3D extends Polyhedron {
  constructor(
    points: number[][],
    options: ConvexHull3DOptions = {},
  ) {
    const tolerance = options.tolerance ?? 1e-5;

    // Build Convex Hull
    const hull = new QuickHull(tolerance);
    hull.build(points);

    // Extract faces — collect unique vertices from each facet's subfacets
    const vertices: number[][] = [];
    const faces: number[][] = [];
    let c = 0;
    // Map coordinate-key → vertex index to de-duplicate
    const d = new Map<string, number>();

    const activeFacets = hull.facets.filter(
      (f) => !hull.removed.has(f.key),
    );

    for (const facet of activeFacets) {
      const faceIndices: number[] = [];
      const seen = new Set<string>();
      // Gather unique points from all subfacets of this facet
      for (const subfacet of facet.subfacets) {
        for (const coord of subfacet.coordinates) {
          const key = coord.join(",");
          if (!seen.has(key)) {
            seen.add(key);
            if (!d.has(key)) {
              vertices.push(coord);
              d.set(key, c);
              c += 1;
            }
            faceIndices.push(d.get(key)!);
          }
        }
      }
      faces.push(faceIndices);
    }

    super(vertices, faces, options);
  }
}
