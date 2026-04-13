/**
 * Pole of inaccessibility — TypeScript port of manim/utils/polylabel.py.
 *
 * Finds the point inside a polygon that is farthest from all edges using
 * an iterative grid-based approach (the "polylabel" algorithm).
 *
 * Math note: numpy-ts does not expose np.delete / np.diff / np.einsum /
 * np.meshgrid, so all 2D geometry here is implemented with plain
 * TypeScript arithmetic rather than numpy-ts array operations.
 */

/** A 2-element [x, y] tuple used throughout this module. */
export type Point2D = [number, number];

// ---------------------------------------------------------------------------
// Polygon
// ---------------------------------------------------------------------------

/**
 * Represents a polygon as a precomputed set of edge arrays for efficient
 * distance queries.
 *
 * Rings must be closed (first point === last point), which is the
 * standard representation used by Manim's SVG / geometry pipeline.
 * Multiple rings indicate holes in the polygon.
 */
export class Polygon {
  /** All points concatenated from every ring. */
  readonly allPoints: Point2D[];

  /** Start point of each edge. */
  private readonly startPts: Point2D[];
  /** End point of each edge. */
  private readonly stopPts: Point2D[];
  /** Direction vector (stop − start) of each edge. */
  private readonly diffPts: Point2D[];
  /** Squared length of each edge (denominator for scalar projection). */
  private readonly normDenoms: number[];

  /** Signed area of the outer ring (negative when clockwise). */
  readonly area: number;
  /** Centroid of the polygon. */
  readonly centroid: Point2D;

  /**
   * @param rings  Each ring is a sequence of 2-element points.
   *               Rings are expected to be closed (ring[0] === ring[n-1]).
   */
  constructor(rings: ReadonlyArray<ReadonlyArray<readonly number[]>>) {
    // ── Collect all points ────────────────────────────────────────────────
    this.allPoints = [];
    for (const ring of rings) {
      for (const p of ring) {
        this.allPoints.push([p[0], p[1]]);
      }
    }

    // ── Build edge arrays ─────────────────────────────────────────────────
    //
    // Python uses np.delete to strip the last point of each ring from
    // `start` and the first point from `stop`, which is equivalent to
    // iterating i = 0 … n-2 for a ring of length n.
    //
    const starts: Point2D[] = [];
    const stops: Point2D[] = [];
    const diffs: Point2D[] = [];

    for (const ring of rings) {
      const n = ring.length;
      for (let i = 0; i < n - 1; i++) {
        const s: Point2D = [ring[i][0], ring[i][1]];
        const e: Point2D = [ring[i + 1][0], ring[i + 1][1]];
        starts.push(s);
        stops.push(e);
        diffs.push([e[0] - s[0], e[1] - s[1]]);
      }
    }

    this.startPts = starts;
    this.stopPts = stops;
    this.diffPts = diffs;
    this.normDenoms = diffs.map(d => d[0] * d[0] + d[1] * d[1]);

    // ── Shoelace centroid ─────────────────────────────────────────────────
    let areaSum = 0;
    let cx = 0;
    let cy = 0;
    const edgeCount = starts.length;

    for (let i = 0; i < edgeCount; i++) {
      const [x, y] = starts[i];
      const [xr, yr] = stops[i];
      const factor = x * yr - xr * y;
      areaSum += factor;
      cx += (x + xr) * factor;
      cy += (y + yr) * factor;
    }

    this.area = areaSum / 2;

    if (this.area !== 0) {
      this.centroid = [cx / (6 * this.area), cy / (6 * this.area)];
    } else {
      // Degenerate polygon — fall back to average of all points.
      const total = this.allPoints.length;
      let sumX = 0;
      let sumY = 0;
      for (const [px, py] of this.allPoints) {
        sumX += px;
        sumY += py;
      }
      this.centroid = total > 0 ? [sumX / total, sumY / total] : [0, 0];
    }
  }

  // ── Distance ─────────────────────────────────────────────────────────────

  /**
   * Signed distance from `point` to the nearest polygon edge.
   * Positive when inside, negative when outside.
   */
  computeDistance(point: readonly number[]): number {
    const px = point[0];
    const py = point[1];
    let minDist = Infinity;

    for (let i = 0; i < this.startPts.length; i++) {
      const [sx, sy] = this.startPts[i];
      const [dx, dy] = this.diffPts[i];
      const denom = this.normDenoms[i];

      // Scalar projection of (point − start) onto the edge direction,
      // normalised by the squared edge length → t ∈ [0, 1].
      let t = 0;
      if (denom > 0) {
        t = (dx * (px - sx) + dy * (py - sy)) / denom;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
      }

      const closestX = sx + dx * t - px;
      const closestY = sy + dy * t - py;
      const dist = Math.sqrt(closestX * closestX + closestY * closestY);
      if (dist < minDist) minDist = dist;
    }

    return this.inside(point) ? minDist : -minDist;
  }

  // ── Point-on-segment / ray-crossing helpers ───────────────────────────

  private _isPointOnSegment(
    xPoint: number,
    yPoint: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): boolean {
    if (
      Math.min(x0, x1) <= xPoint &&
      xPoint <= Math.max(x0, x1) &&
      Math.min(y0, y1) <= yPoint &&
      yPoint <= Math.max(y0, y1)
    ) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const crossVal = dx * (yPoint - y0) - dy * (xPoint - x0);
      // Matches numpy's np.isclose(cross, 0.0) default tolerances
      // (atol=1e-8, rtol=1e-5; with b=0 this reduces to |cross| <= 1e-8).
      return Math.abs(crossVal) <= 1e-8;
    }
    return false;
  }

  private _rayCrossesSegment(
    xPoint: number,
    yPoint: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): boolean {
    if ((y0 > yPoint) !== (y1 > yPoint)) {
      const slope = (x1 - x0) / (y1 - y0);
      const xIntersect = slope * (yPoint - y0) + x0;
      return xPoint < xIntersect;
    }
    return false;
  }

  /**
   * Returns `true` when `point` is inside the polygon (or on its boundary).
   * Uses the ray-casting algorithm with an explicit boundary check.
   */
  inside(point: readonly number[]): boolean {
    const pointX = point[0];
    const pointY = point[1];
    const n = this.startPts.length;

    // Boundary check — a point exactly on an edge is considered inside.
    for (let i = 0; i < n; i++) {
      const [x0, y0] = this.startPts[i];
      const [x1, y1] = this.stopPts[i];
      if (this._isPointOnSegment(pointX, pointY, x0, y0, x1, y1)) {
        return true;
      }
    }

    // Ray-casting — count rightward crossings.
    let crossings = 0;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = this.startPts[i];
      const [x1, y1] = this.stopPts[i];
      if (this._rayCrossesSegment(pointX, pointY, x0, y0, x1, y1)) {
        crossings++;
      }
    }

    return crossings % 2 === 1;
  }
}

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/**
 * A square cell in the grid search covering the polygon's bounding box.
 *
 * - `c`  — centre coordinates
 * - `h`  — half-size (cell covers [c−h, c+h] × [c−h, c+h])
 * - `d`  — signed distance from centre to the polygon boundary
 * - `p`  — upper bound on the best possible distance within this cell
 *           (p = d + h·√2)
 */
export class Cell {
  readonly c: Point2D;
  readonly h: number;
  readonly d: number;
  readonly p: number;

  constructor(c: readonly number[], h: number, polygon: Polygon) {
    this.c = [c[0], c[1]];
    this.h = h;
    this.d = polygon.computeDistance(this.c);
    this.p = this.d + h * Math.SQRT2;
  }

  /** Mirrors Python `Cell.__lt__` — compares on `d`. */
  lessThan(other: Cell): boolean {
    return this.d < other.d;
  }

  /** Mirrors Python `Cell.__gt__`. */
  greaterThan(other: Cell): boolean {
    return this.d > other.d;
  }

  /** Mirrors Python `Cell.__le__`. */
  lessThanOrEqual(other: Cell): boolean {
    return this.d <= other.d;
  }

  /** Mirrors Python `Cell.__ge__`. */
  greaterThanOrEqual(other: Cell): boolean {
    return this.d >= other.d;
  }
}

// ---------------------------------------------------------------------------
// Internal min-heap (priority queue keyed on Cell.d)
// ---------------------------------------------------------------------------

/** Min-heap ordered by `Cell.d` — mirrors Python's PriorityQueue behaviour. */
class CellMinHeap {
  private readonly heap: Cell[] = [];

  put(cell: Cell): void {
    this.heap.push(cell);
    this._bubbleUp(this.heap.length - 1);
  }

  get(): Cell {
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  empty(): boolean {
    return this.heap.length === 0;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].d <= this.heap[i].d) break;
      const tmp = this.heap[parent];
      this.heap[parent] = this.heap[i];
      this.heap[i] = tmp;
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].d < this.heap[smallest].d) smallest = l;
      if (r < n && this.heap[r].d < this.heap[smallest].d) smallest = r;
      if (smallest === i) break;
      const tmp = this.heap[smallest];
      this.heap[smallest] = this.heap[i];
      this.heap[i] = tmp;
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// polylabel
// ---------------------------------------------------------------------------

/**
 * Finds the pole of inaccessibility — the point farthest from the polygon
 * boundary — using an iterative grid-based approach.
 *
 * @param rings      List of rings; each ring is an array of 2-D or 3-D
 *                   points (z is ignored).  Rings should be closed
 *                   (first point === last point).
 * @param precision  Stopping criterion: subdivide until no remaining cell
 *                   can improve the best distance by more than this value.
 *                   Defaults to 0.01.
 * @returns          The `Cell` centred on the pole of inaccessibility.
 */
export function polylabel(
  rings: ReadonlyArray<ReadonlyArray<readonly number[]>>,
  precision = 0.01,
): Cell {
  // Strip to 2-D (drop z when present).
  const rings2d: [number, number][][] = rings.map(ring =>
    ring.map(p => [p[0], p[1]] as [number, number]),
  );

  const polygon = new Polygon(rings2d);

  // ── Bounding box ─────────────────────────────────────────────────────────
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of polygon.allPoints) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const s = Math.min(width, height);
  const h = s / 2;

  // ── Initial grid (mirrors np.meshgrid + np.arange) ───────────────────────
  const queue = new CellMinHeap();

  for (let y = minY; y < maxY; y += s) {
    for (let x = minX; x < maxX; x += s) {
      queue.put(new Cell([x + h, y + h], h, polygon));
    }
  }

  // ── Initial best guess ────────────────────────────────────────────────────
  let best = new Cell(polygon.centroid, 0, polygon);
  const bboxCenter = new Cell(
    [minX + width / 2, minY + height / 2],
    0,
    polygon,
  );
  if (bboxCenter.greaterThan(best)) {
    best = bboxCenter;
  }

  // ── Iterative subdivision ─────────────────────────────────────────────────
  // Offsets for the four child cells (mirrors `directions` ndarray).
  const dx = [-1, 1, -1, 1];
  const dy = [-1, -1, 1, 1];

  while (!queue.empty()) {
    const cell = queue.get();

    if (cell.greaterThan(best)) {
      best = cell;
    }

    if (cell.p - best.d > precision) {
      const newH = cell.h / 2;
      for (let k = 0; k < 4; k++) {
        queue.put(
          new Cell(
            [cell.c[0] + dx[k] * newH, cell.c[1] + dy[k] * newH],
            newH,
            polygon,
          ),
        );
      }
    }
  }

  return best;
}
