/**
 * Mobjects that are simple geometric shapes.
 *
 * TypeScript port of manim/mobject/geometry/polygram.py
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D, Points3D } from "../../../core/math/index.js";
import { TAU } from "../../../core/math/index.js";
import type { IColor } from "../../../core/types.js";
import { BLUE, WHITE } from "../../../core/color/index.js";
import { VMobject, VGroup } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import {
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  UR,
  UL,
  DL,
  DR,
} from "../../../constants/index.js";
import {
  angleBetweenVectors,
  normalize,
  regularVertices,
} from "../../../utils/space_ops/index.js";
import {
  adjacentNTuples,
  adjacentPairs,
} from "../../../utils/iterables/index.js";
// @ts-expect-error — no type declarations for convex-hull
import convexHull from "convex-hull";

// ── Helper: extract row from [n, 3] NDArray ─────────────────

function getRow(pts: NDArray, i: number): Point3D {
  return np.array([
    pts.get([i, 0]) as number,
    pts.get([i, 1]) as number,
    pts.get([i, 2]) as number,
  ]);
}

// ── Helper: point equality check ────────────────────────────

function pointsAreClose(p1: Point3D, p2: Point3D, tol = 1e-6): boolean {
  const dx = (p1.item(0) as number) - (p2.item(0) as number);
  const dy = (p1.item(1) as number) - (p2.item(1) as number);
  const dz = (p1.item(2) as number) - (p2.item(2) as number);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < tol;
}

// ── Helper: get start/end anchors from VMobject points ──────

/**
 * Gets the start anchor of each cubic segment, accounting for subpath boundaries.
 * Uses getSubpaths() to correctly handle multi-subpath VMobjects.
 */
function getStartAnchors(vmob: VMobject): Point3D[] {
  const subpaths = vmob.getSubpaths();
  if (subpaths.length === 0) return [];
  const result: Point3D[] = [];
  for (const sp of subpaths) {
    const n = sp.shape[0];
    for (let i = 0; i + 3 <= n; i += 3) {
      result.push(getRow(sp, i));
    }
  }
  return result;
}

/**
 * Gets the end anchor of each cubic segment, accounting for subpath boundaries.
 */
function getEndAnchors(vmob: VMobject): Point3D[] {
  const subpaths = vmob.getSubpaths();
  if (subpaths.length === 0) return [];
  const result: Point3D[] = [];
  for (const sp of subpaths) {
    const n = sp.shape[0];
    for (let i = 3; i < n; i += 3) {
      result.push(getRow(sp, i));
    }
    // Include the very last point if the subpath has at least one segment
    if (n >= 4) {
      // Last anchor is at index n-1 only if it wasn't already included
      // (it would be included if (n-1) is divisible by 3 and > 0)
      // Actually, the loop above covers indices 3, 6, 9, ... up to < n
      // The last segment's end anchor is at index 3*floor((n-1)/3)
      // which is the same as the last i < n divisible by 3
    }
  }
  return result;
}

// ── Helper: ArcBetweenPoints ────────────────────────────────

/**
 * Creates a VMobject arc between two points with a given sweep angle.
 */
function createArcBetweenPoints(
  start: Point3D,
  end: Point3D,
  angle: number,
  numComponents = 2,
): VMobject {
  const arc = new VMobject();

  if (Math.abs(angle) < 1e-10) {
    arc.startNewPath(start);
    arc.addLineTo(end);
    return arc;
  }

  const sx = start.item(0) as number;
  const sy = start.item(1) as number;
  const sz = start.item(2) as number;
  const ex = end.item(0) as number;
  const ey = end.item(1) as number;

  const dx = ex - sx;
  const dy = ey - sy;
  const chordLength = Math.sqrt(dx * dx + dy * dy);

  if (chordLength < 1e-10) {
    arc.startNewPath(start);
    return arc;
  }

  const radius = chordLength / (2 * Math.abs(Math.sin(angle / 2)));

  // Left perpendicular to chord direction (normalized)
  const perpX = -dy / chordLength;
  const perpY = dx / chordLength;

  // Center offset from midpoint
  const centerOffset = radius * Math.cos(Math.abs(angle) / 2);
  const sign = angle > 0 ? 1 : -1;

  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;

  const cx = mx + sign * perpX * centerOffset;
  const cy = my + sign * perpY * centerOffset;
  const cz = sz;

  // Start angle from center to start point
  const startAngle = Math.atan2(sy - cy, sx - cx);

  // Generate arc bezier approximation
  const nArcs = numComponents;
  const deltaAngle = angle / nArcs;

  for (let i = 0; i < nArcs; i++) {
    const theta = startAngle + i * deltaAngle;
    const thetaEnd = theta + deltaAngle;

    const alpha = (4 / 3) * Math.tan(deltaAngle / 4);

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosE = Math.cos(thetaEnd);
    const sinE = Math.sin(thetaEnd);

    const p0 = np.array([cx + radius * cosT, cy + radius * sinT, cz]);
    const p1 = np.array([
      cx + radius * (cosT - alpha * sinT),
      cy + radius * (sinT + alpha * cosT),
      cz,
    ]);
    const p2 = np.array([
      cx + radius * (cosE + alpha * sinE),
      cy + radius * (sinE - alpha * cosE),
      cz,
    ]);
    const p3 = np.array([cx + radius * cosE, cy + radius * sinE, cz]);

    if (i === 0) {
      arc.startNewPath(p0);
    }
    arc.addCubicBezierCurveTo(p1, p2, p3);
  }

  return arc;
}

// ── Helper: create line VMobject between two points ─────────

function createLine(start: Point3D, end: Point3D): VMobject {
  const line = new VMobject();
  line.startNewPath(start);
  line.addLineTo(end);
  return line;
}

/**
 * Insert n additional curves by subdividing each existing cubic segment.
 * This is a simplified version that adds equally-spaced line segments.
 */
function insertNCurves(vmob: VMobject, n: number): void {
  if (n <= 0) return;
  const nPts = vmob.getNumPoints();
  if (nPts === 0) return;
  const startPt = getRow(vmob.points, 0);
  const endPt = getRow(vmob.points, nPts - 1);
  const totalSegments = n + 1;

  vmob.clearPoints();
  vmob.startNewPath(startPt);
  for (let i = 1; i <= totalSegments; i++) {
    const t = i / totalSegments;
    const px = (startPt.item(0) as number) * (1 - t) + (endPt.item(0) as number) * t;
    const py = (startPt.item(1) as number) * (1 - t) + (endPt.item(1) as number) * t;
    const pz = (startPt.item(2) as number) * (1 - t) + (endPt.item(2) as number) * t;
    vmob.addLineTo(np.array([px, py, pz]));
  }
}

/** Compute arc length between points using Euclidean distance of anchors. */
function getLineLength(vmob: VMobject): number {
  return vmob.getArcLength();
}

// ── Helper: winding direction ───────────────────────────────

/** Compute the signed area of a polygon (using shoelace formula on anchors). */
function computeSignedArea(vmob: VMobject): number {
  const anchors = getStartAnchors(vmob);
  const n = anchors.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = anchors[i].item(0) as number;
    const yi = anchors[i].item(1) as number;
    const xj = anchors[j].item(0) as number;
    const yj = anchors[j].item(1) as number;
    area += xi * yj - xj * yi;
  }
  return area / 2;
}

/** Get winding direction: "CW" or "CCW". */
function getDirection(vmob: VMobject): "CW" | "CCW" {
  return computeSignedArea(vmob) < 0 ? "CW" : "CCW";
}

/** Reverse the points of a VMobject to flip direction. */
function reversePoints(vmob: VMobject): void {
  const n = vmob.getNumPoints();
  if (n === 0) return;
  const rows: number[][] = [];
  for (let i = n - 1; i >= 0; i--) {
    rows.push([
      vmob.points.get([i, 0]) as number,
      vmob.points.get([i, 1]) as number,
      vmob.points.get([i, 2]) as number,
    ]);
  }
  vmob.points = np.array(rows);
}

/** Force a VMobject to have a specific winding direction. */
function forceDirection(vmob: VMobject, targetDirection: "CW" | "CCW"): VMobject {
  if (getDirection(vmob) !== targetDirection) {
    reversePoints(vmob);
  }
  return vmob;
}

// ── GCD helper ──────────────────────────────────────────────

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════
// Polygram
// ═══════════════════════════════════════════════════════════════

export interface PolygramOptions extends VMobjectOptions {
  color?: IColor;
}

/**
 * A generalized Polygon, allowing for disconnected sets of edges.
 *
 * The first vertex in each group is repeated to close the shape.
 */
export class Polygram extends VMobject {
  constructor(
    vertexGroups: (number[][] | NDArray)[],
    options: PolygramOptions = {},
  ) {
    const resolvedColor = options.color ?? options.strokeColor ?? BLUE;
    // Strip `color` from options to avoid passing it to Mobject's constructor
    // (Mobject uses ManimColor.parse which doesn't accept core/color Color objects).
    // Cascade `color` to BOTH fill and stroke so Polygram matches VMobject base
    // semantics (and Python Manim, where `color=` sets both). Without this the
    // fill falls through to DEFAULT_FILL_COLOR=WHITE.
    const { color: _c, ...restOpts } = options;
    super({
      ...restOpts,
      fillColor: options.fillColor ?? resolvedColor,
      strokeColor: options.strokeColor ?? resolvedColor,
    });
    this.strokeColor = options.strokeColor ?? resolvedColor;
    this.fillColor = options.fillColor ?? resolvedColor;

    for (const vertices of vertexGroups) {
      const verts = this._toPoint3DArray(vertices);
      if (verts.length === 0) continue;

      const firstVertex = verts[0];
      this.startNewPath(firstVertex);
      for (let i = 1; i < verts.length; i++) {
        this.addLineTo(verts[i]);
      }
      // Close by returning to first vertex
      this.addLineTo(firstVertex);
    }
  }

  private _toPoint3DArray(vertices: number[][] | NDArray): Point3D[] {
    if (Array.isArray(vertices)) {
      return vertices.map((v) => np.array(v.length === 3 ? v : [...v, 0]));
    }
    // NDArray with shape [n, 3]
    const n = vertices.shape[0];
    const result: Point3D[] = [];
    for (let i = 0; i < n; i++) {
      result.push(getRow(vertices, i));
    }
    return result;
  }

  getVertices(): Point3D[] {
    return getStartAnchors(this);
  }

  getVertexGroups(): Point3D[][] {
    const vertexGroups: Point3D[][] = [];
    const startAnchors = getStartAnchors(this);
    const endAnchors = getEndAnchors(this);

    let group: Point3D[] = [];
    for (let i = 0; i < startAnchors.length; i++) {
      group.push(startAnchors[i]);

      if (
        i < endAnchors.length &&
        group.length > 0 &&
        pointsAreClose(endAnchors[i], group[0])
      ) {
        vertexGroups.push(group);
        group = [];
      }
    }

    return vertexGroups;
  }

  roundCorners(
    radius: number | number[] = 0.5,
    evenlyDistributeAnchors = false,
    componentsPerRoundedCorner = 2,
  ): this {
    if (radius === 0) return this;

    const newPoints: Point3D[] = [];

    for (const vertexGroup of this.getVertexGroups()) {
      const arcs: VMobject[] = [];

      // Build radius list for each vertex
      let radiusList: number[];
      if (typeof radius === "number") {
        radiusList = new Array(vertexGroup.length).fill(radius);
      } else {
        const repeatCount = Math.ceil(vertexGroup.length / radius.length);
        radiusList = [];
        for (let r = 0; r < repeatCount; r++) {
          radiusList.push(...radius);
        }
      }

      const tuples = adjacentNTuples(vertexGroup, 3);
      for (let idx = 0; idx < tuples.length; idx++) {
        const currentRadius = radiusList[idx];
        const [v1, v2, v3] = tuples[idx];

        const vect1 = v2.subtract(v1) as NDArray;
        const vect2 = v3.subtract(v2) as NDArray;
        const unitVect1 = normalize(vect1);
        const unitVect2 = normalize(vect2);

        let angle = angleBetweenVectors(vect1, vect2);
        // Negative radius gives concave curves
        angle *= Math.sign(currentRadius);

        // Distance between vertex and start of the arc
        const cutOffLength = currentRadius * Math.tan(angle / 2);

        // Determines counterclockwise vs. clockwise
        const crossZ = (vect1.item(0) as number) * (vect2.item(1) as number) -
          (vect1.item(1) as number) * (vect2.item(0) as number);
        const sign = Math.sign(crossZ);

        const arcStart = v2.subtract(unitVect1.multiply(cutOffLength)) as Point3D;
        const arcEnd = v2.add(unitVect2.multiply(cutOffLength)) as Point3D;

        const arc = createArcBetweenPoints(
          arcStart,
          arcEnd,
          sign * angle,
          componentsPerRoundedCorner,
        );
        arcs.push(arc);
      }

      let averageArcLength = 1.0;
      if (evenlyDistributeAnchors) {
        const nonzeroLengthArcs = arcs.filter(
          (arc) => arc.getNumPoints() > 4,
        );
        if (nonzeroLengthArcs.length > 0) {
          const totalArcLength = nonzeroLengthArcs.reduce(
            (sum, arc) => sum + arc.getArcLength(),
            0,
          );
          const numCurves = nonzeroLengthArcs.reduce(
            (sum, arc) => sum + arc.getNumPoints() / 4,
            0,
          );
          averageArcLength = totalArcLength / numCurves;
        }
      }

      // Rotate arcs so we start with the last one
      const rotatedArcs = [arcs[arcs.length - 1], ...arcs.slice(0, -1)];

      const arcPairs = adjacentPairs(rotatedArcs);
      for (let pairIdx = 0; pairIdx < arcPairs.length; pairIdx++) {
        const [arc1, arc2] = arcPairs[pairIdx];
        // Collect arc1 points. For every pair after the first, the arc's
        // first anchor duplicates the previous line's last anchor — skip it
        // so the 3k+1 bezier layout stays valid.
        const n1 = arc1.getNumPoints();
        const arcStartIdx = pairIdx === 0 ? 0 : 1;
        for (let i = arcStartIdx; i < n1; i++) {
          newPoints.push(getRow(arc1.points, i));
        }

        // Create line between arcs
        const n1pts = arc1.getNumPoints();
        const lineStart = n1pts > 0 ? getRow(arc1.points, n1pts - 1) : np.array([0, 0, 0]);
        const n2pts = arc2.getNumPoints();
        const lineEnd = n2pts > 0 ? getRow(arc2.points, 0) : np.array([0, 0, 0]);
        const line = createLine(lineStart, lineEnd);

        if (evenlyDistributeAnchors) {
          const lineLen = getLineLength(line);
          insertNCurves(line, Math.ceil(lineLen / averageArcLength));
        }

        // Line's first anchor duplicates arc1's last anchor — always skip it.
        const nLine = line.getNumPoints();
        for (let i = 1; i < nLine; i++) {
          newPoints.push(getRow(line.points, i));
        }
      }
    }

    if (newPoints.length > 0) {
      const rows = newPoints.map((p) => [
        p.item(0) as number,
        p.item(1) as number,
        p.item(2) as number,
      ]);
      this.points = np.array(rows);
    }

    return this;
  }
}

// ═══════════════════════════════════════════════════════════════
// Polygon
// ═══════════════════════════════════════════════════════════════

export interface PolygonOptions extends VMobjectOptions {
  color?: IColor;
}

/**
 * A shape consisting of one closed loop of vertices.
 */
export class Polygon extends Polygram {
  constructor(vertices: (number[] | Point3D)[], options: PolygonOptions = {}) {
    const verts = vertices.map((v) =>
      Array.isArray(v) ? v : (v.toArray() as number[]),
    );
    super([verts], options);
  }
}

// ═══════════════════════════════════════════════════════════════
// RegularPolygram
// ═══════════════════════════════════════════════════════════════

export interface RegularPolygramOptions extends VMobjectOptions {
  color?: IColor;
  density?: number;
  radius?: number;
  startAngle?: number | null;
}

/**
 * A Polygram with regularly spaced vertices.
 */
export class RegularPolygram extends Polygram {
  startAngle: number;

  constructor(numVertices: number, options: RegularPolygramOptions = {}) {
    const density = options.density ?? 2;
    const radius = options.radius ?? 1;
    const inputStartAngle = options.startAngle ?? null;

    const numGons = gcd(numVertices, density);
    const adjustedNumVertices = Math.floor(numVertices / numGons);
    const adjustedDensity = Math.floor(density / numGons);

    function genPolygonVertices(
      startAngle: number | null,
    ): [Point3D[], number] {
      const [regVertices, resolvedAngle] = regularVertices(
        adjustedNumVertices,
        { radius, startAngle },
      );

      const vertices: Point3D[] = [];
      let i = 0;
      while (true) {
        vertices.push(getRow(regVertices, i));
        i += adjustedDensity;
        i %= adjustedNumVertices;
        if (i === 0) break;
      }

      return [vertices, resolvedAngle];
    }

    const [firstGroup, resolvedStartAngle] =
      genPolygonVertices(inputStartAngle);
    const vertexGroups: number[][][] = [
      firstGroup.map((p) => p.toArray() as number[]),
    ];

    for (let i = 1; i < numGons; i++) {
      const angle =
        resolvedStartAngle +
        (i / numGons) * (TAU / adjustedNumVertices);
      const [group] = genPolygonVertices(angle);
      vertexGroups.push(group.map((p) => p.toArray() as number[]));
    }

    const { density: _d, radius: _r, startAngle: _s, ...restOptions } = options;
    super(vertexGroups, restOptions);
    this.startAngle = resolvedStartAngle;
  }
}

// ═══════════════════════════════════════════════════════════════
// RegularPolygon
// ═══════════════════════════════════════════════════════════════

export interface RegularPolygonOptions extends VMobjectOptions {
  color?: IColor;
  radius?: number;
  startAngle?: number | null;
}

/**
 * An n-sided regular Polygon.
 */
export class RegularPolygon extends RegularPolygram {
  constructor(n = 6, options: RegularPolygonOptions = {}) {
    super(n, { ...options, density: 1 });
  }
}

// ═══════════════════════════════════════════════════════════════
// Star
// ═══════════════════════════════════════════════════════════════

export interface StarOptions extends VMobjectOptions {
  color?: IColor;
  outerRadius?: number;
  innerRadius?: number | null;
  density?: number;
  startAngle?: number | null;
}

/**
 * A regular polygram without the intersecting lines.
 */
export class Star extends Polygon {
  startAngle: number;

  constructor(n = 5, options: StarOptions = {}) {
    const outerRadius = options.outerRadius ?? 1;
    const density = options.density ?? 2;
    const inputStartAngle = options.startAngle !== undefined
      ? options.startAngle
      : TAU / 4;
    let innerRadius = options.innerRadius ?? null;

    const innerAngle = TAU / (2 * n);

    if (innerRadius === null) {
      if (density <= 0 || density >= n / 2) {
        throw new Error(
          `Incompatible density ${density} for number of points ${n}`,
        );
      }

      const outerAngle = (TAU * density) / n;
      const inverseX =
        1 -
        Math.tan(innerAngle) *
          ((Math.cos(outerAngle) - 1) / Math.sin(outerAngle));

      innerRadius = outerRadius / (Math.cos(innerAngle) * inverseX);
    }

    const [outerVertices, resolvedStartAngle] = regularVertices(n, {
      radius: outerRadius,
      startAngle: inputStartAngle,
    });
    const [innerVertices] = regularVertices(n, {
      radius: innerRadius,
      startAngle: resolvedStartAngle + innerAngle,
    });

    const vertices: (number[])[] = [];
    for (let i = 0; i < n; i++) {
      vertices.push(getRow(outerVertices, i).toArray() as number[]);
      vertices.push(getRow(innerVertices, i).toArray() as number[]);
    }

    const {
      outerRadius: _or,
      innerRadius: _ir,
      density: _d,
      startAngle: _sa,
      ...restOptions
    } = options;
    super(vertices, restOptions);
    this.startAngle = resolvedStartAngle;
  }
}

// ═══════════════════════════════════════════════════════════════
// Triangle
// ═══════════════════════════════════════════════════════════════

/**
 * An equilateral triangle.
 */
export class Triangle extends RegularPolygon {
  constructor(options: RegularPolygonOptions = {}) {
    super(3, options);
  }
}

// ═══════════════════════════════════════════════════════════════
// Rectangle
// ═══════════════════════════════════════════════════════════════

export interface RectangleOptions extends VMobjectOptions {
  color?: IColor;
  height?: number;
  width?: number;
  gridXstep?: number | null;
  gridYstep?: number | null;
}

/**
 * A quadrilateral with two sets of parallel sides.
 */
export class Rectangle extends Polygon {
  gridLines: VGroup;

  constructor(options: RectangleOptions = {}) {
    const color = options.color ?? WHITE;
    const height = options.height ?? 2.0;
    const width = options.width ?? 4.0;
    const gridXstep = options.gridXstep ?? null;
    const gridYstep = options.gridYstep ?? null;

    const {
      height: _h,
      width: _w,
      gridXstep: _gx,
      gridYstep: _gy,
      ...restOptions
    } = options;

    // UR, UL, DL, DR corners
    const urArr = UR.toArray() as number[];
    const ulArr = UL.toArray() as number[];
    const dlArr = DL.toArray() as number[];
    const drArr = DR.toArray() as number[];

    super([urArr, ulArr, dlArr, drArr], { ...restOptions, color });

    this.stretchToFitWidth(width);
    this.stretchToFitHeight(height);

    this.gridLines = new VGroup();

    if (gridXstep || gridYstep) {
      const v = this.getVertices();

      if (gridXstep) {
        const step = Math.abs(gridXstep);
        const count = Math.floor(width / step);
        const lines: VMobject[] = [];
        for (let i = 1; i < count; i++) {
          const xOffset = RIGHT.multiply(i * step) as Point3D;
          const lineStart = v[1].add(xOffset) as Point3D;
          const lineEnd = (v[1].add(xOffset) as NDArray).add(
            DOWN.multiply(height),
          ) as Point3D;
          const line = createLine(lineStart, lineEnd);
          line.strokeColor = typeof color === "object" && "r" in color
            ? color
            : this.strokeColor;
          lines.push(line);
        }
        if (lines.length > 0) {
          const grid = new VGroup(...lines);
          this.gridLines.add(grid);
        }
      }

      if (gridYstep) {
        const step = Math.abs(gridYstep);
        const count = Math.floor(height / step);
        const v = this.getVertices();
        const lines: VMobject[] = [];
        for (let i = 1; i < count; i++) {
          const yOffset = DOWN.multiply(i * step) as Point3D;
          const lineStart = v[1].add(yOffset) as Point3D;
          const lineEnd = (v[1].add(yOffset) as NDArray).add(
            RIGHT.multiply(width),
          ) as Point3D;
          const line = createLine(lineStart, lineEnd);
          line.strokeColor = typeof color === "object" && "r" in color
            ? color
            : this.strokeColor;
          lines.push(line);
        }
        if (lines.length > 0) {
          const grid = new VGroup(...lines);
          this.gridLines.add(grid);
        }
      }

      if (this.gridLines.submobjects.length > 0) {
        this.add(this.gridLines);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Square
// ═══════════════════════════════════════════════════════════════

export interface SquareOptions extends RectangleOptions {
  sideLength?: number;
}

/**
 * A rectangle with equal side lengths.
 */
export class Square extends Rectangle {
  constructor(options: SquareOptions = {}) {
    const sideLength = options.sideLength ?? 2.0;
    const { sideLength: _sl, ...restOptions } = options;
    super({ ...restOptions, height: sideLength, width: sideLength });
  }

  get sideLength(): number {
    const verts = this.getVertices();
    if (verts.length < 2) return 0;
    const diff = verts[0].subtract(verts[1]) as NDArray;
    return np.linalg.norm(diff) as number;
  }

  set sideLength(value: number) {
    const current = this.sideLength;
    if (current > 0) {
      this.scale(value / current);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// RoundedRectangle
// ═══════════════════════════════════════════════════════════════

export interface RoundedRectangleOptions extends RectangleOptions {
  cornerRadius?: number | number[];
}

/**
 * A rectangle with rounded corners.
 */
export class RoundedRectangle extends Rectangle {
  cornerRadius: number | number[];

  constructor(options: RoundedRectangleOptions = {}) {
    const cornerRadius = options.cornerRadius ?? 0.5;
    const { cornerRadius: _cr, ...restOptions } = options;
    super(restOptions);
    this.cornerRadius = cornerRadius;
    this.roundCorners(this.cornerRadius);
  }
}

// ═══════════════════════════════════════════════════════════════
// Cutout
// ═══════════════════════════════════════════════════════════════

export interface CutoutOptions extends VMobjectOptions {}

/**
 * A shape with smaller cutouts.
 *
 * Technically behaves similar to a symmetric difference: if parts of the
 * cutout mobjects are not located within the main_shape, those parts
 * will be added to the resulting VMobject.
 */
export class Cutout extends VMobject {
  constructor(
    mainShape: VMobject,
    mobjects: VMobject[],
    options: CutoutOptions = {},
  ) {
    super(options);

    // Append main shape's points
    if (mainShape.getNumPoints() > 0) {
      if (this.getNumPoints() === 0) {
        this.points = mainShape.points.copy();
      } else {
        this.points = np.concatenate([this.points, mainShape.points], 0);
      }
    }

    // Determine opposite direction to main shape
    const mainDir = getDirection(mainShape);
    const subDirection: "CW" | "CCW" = mainDir === "CW" ? "CCW" : "CW";

    for (const mobject of mobjects) {
      const forced = forceDirection(mobject, subDirection);
      if (forced.getNumPoints() > 0) {
        if (this.getNumPoints() === 0) {
          this.points = forced.points.copy();
        } else {
          this.points = np.concatenate([this.points, forced.points], 0);
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ConvexHull
// ═══════════════════════════════════════════════════════════════

export interface ConvexHullOptions extends VMobjectOptions {
  color?: IColor;
  tolerance?: number;
}

/**
 * Constructs a convex hull for a set of points.
 */
export class ConvexHull extends Polygram {
  constructor(points: (number[] | Point3D)[], options: ConvexHullOptions = {}) {
    const { tolerance: _tol, ...restOptions } = options;

    // Convert to 2D array for convex-hull
    const points2D: number[][] = points.map((p) => {
      if (Array.isArray(p)) return [p[0], p[1]];
      return [p.item(0) as number, p.item(1) as number];
    });

    // Compute convex hull — returns edges [[i0, i1], [i1, i2], ...]
    const edges = convexHull(points2D) as number[][];

    // Extract ordered vertices from edges
    const hullIndices: number[] = [];
    if (edges.length > 0) {
      for (const edge of edges) {
        hullIndices.push(edge[0]);
      }
    }

    // Build 3D vertices
    const vertices: number[][] = hullIndices.map((idx) => {
      const p = points[idx];
      if (Array.isArray(p)) {
        return p.length >= 3 ? p : [...p, 0];
      }
      return p.toArray() as number[];
    });

    super(vertices.length > 0 ? [vertices] : [], restOptions);
  }
}
