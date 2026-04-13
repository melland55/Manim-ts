/**
 * QuickHull algorithm for constructing a convex hull from a set of points.
 *
 * TypeScript port of manim/utils/qhull.py
 *
 * Implementation note: numpy-ts does not expose np.delete, np.argmax, or
 * np.linalg.svd, so the internal geometry is implemented with plain
 * TypeScript number arrays.  The public API mirrors the Python API exactly.
 */

// ── Internal types ────────────────────────────────────────────────────────────

/** A point in N-dimensional space. */
export type PointND = number[];

/** An array of N-dimensional points (shape [n, dim]). */
export type PointNDArray = number[][];

// ── Internal math helpers ─────────────────────────────────────────────────────

function vecMean(arr: PointNDArray): PointND {
  if (arr.length === 0) return [];
  const dim = arr[0].length;
  const result = new Array<number>(dim).fill(0);
  for (const row of arr) {
    for (let j = 0; j < dim; j++) {
      result[j] += row[j];
    }
  }
  return result.map(x => x / arr.length);
}

function vecSubtract(a: PointND, b: PointND): PointND {
  return a.map((x, i) => x - b[i]);
}

function matSubtractVec(arr: PointNDArray, vec: PointND): PointNDArray {
  return arr.map(row => vecSubtract(row, vec));
}

function vecNorm(v: PointND): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function vecDot(a: PointND, b: PointND): number {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

function vecScale(v: PointND, s: number): PointND {
  return v.map(x => x * s);
}

function vecNormalize(v: PointND): PointND {
  const n = vecNorm(v);
  return n > 0 ? vecScale(v, 1 / n) : v.slice();
}

function cross3D(a: PointND, b: PointND): PointND {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Matrix–vector product: arr (shape [m, dim]) × vec (shape [dim]) → shape [m]. */
function matVecProduct(arr: PointNDArray, vec: PointND): number[] {
  return arr.map(row => vecDot(row, vec));
}

/** Remove row at index `i` from a 2-D array. */
function deleteRow(arr: PointNDArray, i: number): PointNDArray {
  return arr.filter((_, idx) => idx !== i);
}

/** Vertically stack two 2-D arrays. */
function vstackArrays(a: PointNDArray, b: PointNDArray): PointNDArray {
  return [...a, ...b];
}

/**
 * Compute the outward normal to the hyperplane spanned by `centered` rows.
 *
 * - 2-D:  perpendicular to the single edge vector.
 * - 3-D:  cross product of the first two edge vectors.
 * - N-D:  not yet implemented (throws).
 */
function computeHyperplaneNormal(centered: PointNDArray): PointND {
  const dim = centered[0].length;

  if (dim === 2) {
    const v = centered[0];
    return vecNormalize([-v[1], v[0]]);
  }

  if (dim === 3) {
    const v1 = centered[0];
    const v2 = centered[1];
    return cross3D(v1, v2);
  }

  // General n-D: would require SVD / null-space computation.
  // TODO: implement for dimensions > 3 if needed by Manim.
  throw new Error(
    `computeHyperplaneNormal: dimension ${dim} not yet implemented (need SVD).`,
  );
}

/**
 * Draw k unique indices from [0, n) without replacement.
 * Uses a partial Fisher–Yates shuffle.
 */
function randomSample(n: number, k: number): number[] {
  if (k > n) {
    throw new Error(
      `Cannot sample ${k} items without replacement from ${n} elements.`,
    );
  }
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (n - i));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, k);
}

/** Select rows from a 2-D array by an array of indices. */
function selectRows(arr: PointNDArray, indices: number[]): PointNDArray {
  return indices.map(i => arr[i]);
}

// ── Public classes ────────────────────────────────────────────────────────────

/**
 * A point wrapper that supports key-based equality (mirrors Python's
 * `__hash__` / `__eq__` based on `coordinates.tobytes()`).
 */
export class QuickHullPoint {
  coordinates: PointND;

  constructor(coordinates: PointND) {
    this.coordinates = coordinates;
  }

  /** Stable string key — used in place of Python's `hash(coordinates.tobytes())`. */
  getKey(): string {
    return this.coordinates.map(x => x.toFixed(14)).join(",");
  }

  equals(other: QuickHullPoint): boolean {
    if (this.coordinates.length !== other.coordinates.length) return false;
    return this.coordinates.every(
      (x, i) => Math.abs(x - other.coordinates[i]) < 1e-12,
    );
  }
}

/**
 * An (n-1)-dimensional face of an n-dimensional polytope.
 *
 * Equality is determined by the *set* of constituent points, not by their
 * order — mirroring Python's `frozenset(QuickHullPoint(c) for c in coordinates)`.
 */
export class SubFacet {
  coordinates: PointNDArray;
  /** Sorted, joined point keys — canonical identifier for this subfacet. */
  readonly key: string;

  constructor(coordinates: PointNDArray) {
    this.coordinates = coordinates;
    const pointKeys = coordinates.map(
      row => new QuickHullPoint(row).getKey(),
    );
    this.key = pointKeys.sort().join("|");
  }

  equals(other: SubFacet): boolean {
    return this.key === other.key;
  }
}

/**
 * An n-dimensional face of the convex hull.
 *
 * Equality is determined by the *set* of constituent subfacets — mirroring
 * Python's `frozenset(SubFacet(...) for i in range(...))`.
 */
export class Facet {
  coordinates: PointNDArray;
  center: PointND;
  normal: PointND;
  subfacets: SubFacet[];
  /** Sorted, joined subfacet keys — canonical identifier for this facet. */
  readonly key: string;

  constructor(coordinates: PointNDArray, internal: PointND) {
    this.coordinates = coordinates;
    this.center = vecMean(coordinates);

    this.subfacets = coordinates.map(
      (_, i) => new SubFacet(deleteRow(coordinates, i)),
    );

    this.normal = this._computeNormal(internal);
    this.key = this.subfacets
      .map(sf => sf.key)
      .sort()
      .join("||");
  }

  private _computeNormal(internal: PointND): PointND {
    const centered = matSubtractVec(this.coordinates, this.center);
    let normal = computeHyperplaneNormal(centered);

    const n = vecNorm(normal);
    if (n > 0) normal = vecScale(normal, 1 / n);

    // If the normal points *toward* the internal point, flip it.
    const diff = vecSubtract(this.center, internal);
    if (vecDot(normal, diff) < 0) {
      normal = vecScale(normal, -1);
    }

    return normal;
  }

  equals(other: Facet): boolean {
    return this.key === other.key;
  }
}

/**
 * The set of visible facets and boundary subfacets used during horizon
 * computation in the QuickHull algorithm.
 */
export class Horizon {
  /** Visible facets, keyed by `facet.key` for O(1) membership testing. */
  private _facetMap: Map<string, Facet> = new Map();
  /** Boundary subfacets (edges between visible and invisible regions). */
  boundary: SubFacet[] = [];

  addFacet(facet: Facet): void {
    this._facetMap.set(facet.key, facet);
  }

  hasFacet(facet: Facet): boolean {
    return this._facetMap.has(facet.key);
  }

  /** Returns all visible facets (mirrors iteration over Python's `set[Facet]`). */
  getFacets(): Facet[] {
    return Array.from(this._facetMap.values());
  }
}

/**
 * QuickHull algorithm for constructing a convex hull from a set of points.
 *
 * @param tolerance
 *   A tolerance threshold for determining when points lie on the convex hull.
 *   Defaults to `1e-5`.
 *
 * ### Usage
 * ```ts
 * const hull = new QuickHull();
 * hull.build([[0,0,0],[1,0,0],[0,1,0],[0,0,1],[0.5,0.5,0.5]]);
 * const faces = hull.facets.filter(f => !hull.removed.has(f.key));
 * ```
 */
export class QuickHull {
  /** All facets created during construction (including removed ones). */
  facets: Facet[];
  /** Keys of facets that have been removed (replaced by newer facets). */
  removed: Set<string>;
  /**
   * Maps a facet key to its outside point set and eye point.
   * `[outside, eye]` — either may be `null` if no outside points exist.
   */
  outside: Map<string, [PointNDArray | null, PointND | null]>;
  /**
   * Maps a subfacet key to the set of neighboring facet keys.
   * Each subfacet borders exactly two facets while the hull is being built.
   */
  private _neighborKeys: Map<string, Set<string>>;
  /** Reverse lookup: facet key → Facet object. */
  private _facetByKey: Map<string, Facet>;

  /** Points not yet assigned to any facet's outside set. */
  unclaimed: PointNDArray | null;
  /** The centroid of the initial simplex — used to orient face normals. */
  internal: PointND | null;
  /** Tolerance for classifying points as outside the hull. */
  tolerance: number;

  constructor(tolerance = 1e-5) {
    this.facets = [];
    this.removed = new Set();
    this.outside = new Map();
    this._neighborKeys = new Map();
    this._facetByKey = new Map();
    this.unclaimed = null;
    this.internal = null;
    this.tolerance = tolerance;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _registerFacet(facet: Facet): void {
    this._facetByKey.set(facet.key, facet);
  }

  private _addNeighbor(subfacet: SubFacet, facet: Facet): void {
    if (!this._neighborKeys.has(subfacet.key)) {
      this._neighborKeys.set(subfacet.key, new Set());
    }
    this._neighborKeys.get(subfacet.key)!.add(facet.key);
  }

  private _discardNeighbor(subfacet: SubFacet, facet: Facet): void {
    const keys = this._neighborKeys.get(subfacet.key);
    if (!keys) return;
    keys.delete(facet.key);
    if (keys.size === 0) {
      this._neighborKeys.delete(subfacet.key);
    }
  }

  private _getNeighborFacets(subfacet: SubFacet): Facet[] {
    const keys = this._neighborKeys.get(subfacet.key);
    if (!keys) return [];
    const result: Facet[] = [];
    for (const k of keys) {
      const f = this._facetByKey.get(k);
      if (f) result.push(f);
    }
    return result;
  }

  // ── Public algorithm methods ────────────────────────────────────────────────

  /**
   * Initialise the hull from the given point set by building an initial
   * simplex and classifying all points against its facets.
   */
  initialize(points: PointNDArray): void {
    const num = points.length;
    const dim = points[0].length;

    // Sample a random (dim+1)-point simplex.
    const chosenIdx = randomSample(num, dim + 1);
    const simplex = selectRows(points, chosenIdx);

    this.unclaimed = points;
    const newInternal = vecMean(simplex);
    this.internal = newInternal;

    // Build the dim+1 facets of the simplex (each omits one vertex).
    for (let c = 0; c < simplex.length; c++) {
      const facet = new Facet(deleteRow(simplex, c), newInternal);
      this._registerFacet(facet);
      this.classify(facet);
      this.facets.push(facet);
    }

    // Register neighbour relationships.
    for (const facet of this.facets) {
      for (const sf of facet.subfacets) {
        this._addNeighbor(sf, facet);
      }
    }
  }

  /**
   * Partition the current unclaimed points against `facet`:
   * - points with projection > `tolerance` → assigned to `facet.outside`
   * - remaining points stay in `unclaimed`
   *
   * The "eye" is the farthest outside point (candidate for expansion).
   */
  classify(facet: Facet): void {
    if (this.unclaimed === null) {
      throw new Error("Call .initialize() before using .classify().");
    }

    if (this.unclaimed.length === 0) {
      this.outside.set(facet.key, [null, null]);
      return;
    }

    // Compute signed projection of each unclaimed point onto facet's normal.
    const diff = matSubtractVec(this.unclaimed, facet.center);
    const projections = matVecProduct(diff, facet.normal);

    // Eye = point with maximum projection (if it's > tolerance).
    let argMax = 0;
    for (let i = 1; i < projections.length; i++) {
      if (projections[i] > projections[argMax]) argMax = i;
    }
    const maxProj = projections[argMax];
    const eye = maxProj > this.tolerance ? this.unclaimed[argMax] : null;

    // Split unclaimed into outside (proj > tol) and inside.
    const outsideRows: PointNDArray = [];
    const insideRows: PointNDArray = [];
    for (let i = 0; i < this.unclaimed.length; i++) {
      if (projections[i] > this.tolerance) {
        outsideRows.push(this.unclaimed[i]);
      } else {
        insideRows.push(this.unclaimed[i]);
      }
    }

    this.outside.set(facet.key, [
      outsideRows.length > 0 ? outsideRows : null,
      eye,
    ]);
    this.unclaimed = insideRows;
  }

  /**
   * Compute the horizon — the boundary between facets visible and invisible
   * from `eye` — starting from `startFacet`.
   */
  computeHorizon(eye: PointND, startFacet: Facet): Horizon {
    const horizon = new Horizon();
    this._recursiveHorizon(eye, startFacet, horizon);
    return horizon;
  }

  private _recursiveHorizon(
    eye: PointND,
    facet: Facet,
    horizon: Horizon,
  ): boolean {
    const visible = vecDot(facet.normal, vecSubtract(eye, facet.center)) > 0;
    if (!visible) return false;

    horizon.addFacet(facet);

    for (const subfacet of facet.subfacets) {
      const neighbors = this._getNeighborFacets(subfacet).filter(
        f => !f.equals(facet),
      );
      if (neighbors.length === 0) continue;
      const neighbor = neighbors[0];

      if (
        !horizon.hasFacet(neighbor) &&
        !this._recursiveHorizon(eye, neighbor, horizon)
      ) {
        horizon.boundary.push(subfacet);
      }
    }
    return true;
  }

  /**
   * Build the convex hull of `points`.
   *
   * @throws if there are too few points or if the dimensionality is 1-D.
   */
  build(points: PointNDArray): void {
    if (points.length === 0) {
      throw new Error("Not enough points supplied to build Convex Hull!");
    }
    const num = points.length;
    const dim = points[0].length;

    if (dim === 0 || num < dim + 1) {
      throw new Error("Not enough points supplied to build Convex Hull!");
    }
    if (dim === 1) {
      throw new Error("The Convex Hull of 1D data is its min-max!");
    }

    this.initialize(points);

    // Iteratively expand the hull by processing outside points.
    for (;;) {
      let updated = false;

      for (const facet of this.facets) {
        if (this.removed.has(facet.key)) continue;

        const entry = this.outside.get(facet.key);
        if (!entry) continue;
        const [, eye] = entry;

        if (eye !== null) {
          updated = true;
          const horizon = this.computeHorizon(eye, facet);

          // Retire all visible facets and reclaim their outside points.
          for (const f of horizon.getFacets()) {
            const pts = this.outside.get(f.key)?.[0];
            if (pts !== null && pts !== undefined) {
              this.unclaimed = this.unclaimed!.length > 0
                ? vstackArrays(this.unclaimed!, pts)
                : pts;
            }
            this.removed.add(f.key);
            for (const sf of f.subfacets) {
              this._discardNeighbor(sf, f);
            }
          }

          // Build new facets connecting the eye to each boundary subfacet.
          for (const sf of horizon.boundary) {
            const nf = new Facet(
              [...sf.coordinates, eye],
              this.internal!,
            );
            this._registerFacet(nf);
            this.classify(nf);
            this.facets.push(nf);
            for (const nsf of nf.subfacets) {
              this._addNeighbor(nsf, nf);
            }
          }
        }
      }

      if (!updated) break;
    }
  }
}
