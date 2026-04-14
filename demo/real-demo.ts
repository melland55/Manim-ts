/**
 * Browser demo — COMPREHENSIVE engine test.
 *
 * Uses the REAL manim-ts engine classes to construct geometry,
 * then extracts bezier points into plain arrays for fast Canvas2D rendering.
 * No numpy-ts in the hot render/animation loop.
 *
 * Tests: all geometry, transforms, animations, colors, and stress.
 */

import { Circle, Square, Triangle, RegularPolygon, Line, Arc, Polygon } from "../src/mobject/geometry/index.js";
import { np, TAU, PI, UP, DOWN, LEFT, RIGHT, ORIGIN, DEGREES } from "../src/core/math/index.js";
import {
  RED, RED_A, RED_B, RED_C, RED_D, RED_E,
  BLUE, BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E,
  GREEN, GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E,
  YELLOW, YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E,
  GOLD, GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E,
  PURPLE, PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E,
  TEAL, TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E,
  MAROON, MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E,
  WHITE, GRAY_A, GRAY_B, GRAY_C, GRAY_D, GRAY_E, BLACK,
  PINK, ORANGE, LIGHT_BROWN, DARK_BROWN,
} from "../src/core/color/index.js";
import type { IColor } from "../src/core/types.js";
import { VMobject } from "../src/mobject/types/index.js";

// Arrows & Lines
import { Arrow, DoubleArrow, DashedLine, Vector, Elbow } from "../src/mobject/geometry/line/index.js";

// Arc variants
import { Dot, Ellipse, ArcBetweenPoints, Sector, AnnularSector, Annulus, CurvedArrow } from "../src/mobject/geometry/arc/index.js";

// Polygram extras
import { Star, Rectangle, RoundedRectangle } from "../src/mobject/geometry/polygram/index.js";

// Arrow tips
import { ArrowTriangleFilledTip, ArrowCircleFilledTip, ArrowSquareFilledTip, StealthTip } from "../src/mobject/geometry/tips/index.js";

// Boolean ops
import { Union, Intersection, Difference, Exclusion } from "../src/mobject/geometry/boolean_ops/index.js";

// Shape matchers
import { SurroundingRectangle, BackgroundRectangle, Cross, Underline } from "../src/mobject/geometry/shape_matchers/index.js";

// Braces
import { Brace, BraceBetweenPoints } from "../src/mobject/svg/index.js";

// Graphing
import { Axes, NumberLine, ParametricFunction, FunctionGraph, NumberPlane, BarChart } from "../src/mobject/graphing/index.js";

// 3D shapes
import { Sphere, Cube, Cone, Cylinder, Torus, Dot3D } from "../src/mobject/three_d/index.js";
import { Tetrahedron, Octahedron, Icosahedron, Dodecahedron } from "../src/mobject/three_d/index.js";

// Graph theory
import { Graph, DiGraph } from "../src/mobject/graph/index.js";

// Vector fields
import { ArrowVectorField, StreamLines } from "../src/mobject/vector_field/index.js";

// Value tracker
import { ValueTracker } from "../src/mobject/value_tracker/index.js";

// ── Logging ─────────────────────────────────────────────────

const logEl = document.getElementById("log")!;
function log(msg: string): void {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

// ── Plain-array types (zero overhead in the render loop) ─────

type Point3 = [number, number, number];

interface RenderMobject {
  points: Point3[];
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeOpacity: number;
  strokeWidth: number;
  center: Point3;
  label?: string;
  showDot?: boolean;
  dotPosition?: Point3;  // fixed dot position (doesn't move with points)
  forceClose?: boolean;  // force closePath even if path endpoints don't match
}

// ── Extract real-engine VMobject → plain RenderMobject ───────

function extractRenderMobject(mob: VMobject, label?: string): RenderMobject {
  const pts = mob.points;
  const n = pts.shape[0];
  const points: Point3[] = [];
  for (let i = 0; i < n; i++) {
    points.push([
      pts.get([i, 0]) as number,
      pts.get([i, 1]) as number,
      pts.get([i, 2]) as number,
    ]);
  }
  const c = mob.getCenter();
  return {
    points,
    fillColor: mob.fillColor,
    fillOpacity: mob.fillOpacity,
    strokeColor: mob.strokeColor,
    strokeOpacity: mob.strokeOpacity,
    strokeWidth: mob.strokeWidth,
    center: [Number(c.item(0)), Number(c.item(1)), Number(c.item(2))],
    label,
  };
}

/**
 * Recursively extract all VMobject family members from a composite mobject.
 * Composite objects (Axes, NumberPlane, Graph, etc.) contain sub-VMobjects;
 * this walks the tree and extracts each one with points as a RenderMobject.
 *
 * If a VMobject contains multiple subpaths (e.g. a boolean op that returns
 * multiple disjoint polygons, or a Brace-style compound shape), we emit one
 * RenderMobject per subpath — otherwise the renderer draws a continuous
 * bezier curve between subpaths, which shows up as an unwanted connecting
 * line/hook.
 */
function extractFamily(mob: VMobject, label?: string): RenderMobject[] {
  const results: RenderMobject[] = [];
  const pts = mob.points;
  if (pts.shape[0] > 0) {
    // Split into subpaths so each disconnected region renders independently.
    // Some VMobject stubs (e.g. the SVG-module brace stub) don't implement
    // getSubpaths — fall back to flat extraction in that case.
    const subpaths =
      typeof (mob as { getSubpaths?: unknown }).getSubpaths === "function"
        ? mob.getSubpaths()
        : [];
    if (subpaths.length <= 1) {
      results.push(extractRenderMobject(mob, label));
    } else {
      const c = mob.getCenter();
      const center: Point3 = [
        Number(c.item(0)),
        Number(c.item(1)),
        Number(c.item(2)),
      ];
      for (const sp of subpaths) {
        const spPoints: Point3[] = [];
        const m = sp.shape[0];
        for (let i = 0; i < m; i++) {
          spPoints.push([
            sp.get([i, 0]) as number,
            sp.get([i, 1]) as number,
            sp.get([i, 2]) as number,
          ]);
        }
        results.push({
          points: spPoints,
          fillColor: mob.fillColor,
          fillOpacity: mob.fillOpacity,
          strokeColor: mob.strokeColor,
          strokeOpacity: mob.strokeOpacity,
          strokeWidth: mob.strokeWidth,
          center,
          label,
        });
      }
    }
  }
  // Recurse into submobjects (if this mobject exposes them)
  const subs = (mob as { submobjects?: unknown }).submobjects;
  if (Array.isArray(subs)) {
    for (const sub of subs) {
      // Duck-type: any object with a `.points` NDArray is treatable as a VMobject here.
      if (sub && typeof sub === "object" && "points" in sub) {
        results.push(...extractFamily(sub as VMobject));
      }
    }
  }
  return results;
}

/** Bounding box center — midpoint of min/max across all points. Matches Manim's getCenter(). */
function boundingBoxCenter(points: Point3[]): Point3 {
  if (points.length === 0) return [0, 0, 0];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

/** Geometric centroid of unique anchor vertices (every 3rd point, excluding closing duplicate).
 *  For regular polygons this gives the true visual center (the construction origin),
 *  unlike bounding box center which is offset for asymmetric shapes like triangles.
 *  Used for demo display only — not engine code. */
function geometricCentroid(points: Point3[]): Point3 {
  if (points.length === 0) return [0, 0, 0];
  // Extract anchors: indices 0, 3, 6, 9, ...
  const anchors: Point3[] = [];
  for (let i = 0; i < points.length; i += 3) {
    anchors.push(points[i]);
  }
  // Remove closing duplicate (last anchor == first anchor for closed shapes)
  if (anchors.length > 1) {
    const first = anchors[0], last = anchors[anchors.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      anchors.pop();
    }
  }
  if (anchors.length === 0) return boundingBoxCenter(points);
  let sx = 0, sy = 0, sz = 0;
  for (const [x, y, z] of anchors) { sx += x; sy += y; sz += z; }
  return [sx / anchors.length, sy / anchors.length, sz / anchors.length];
}

// ── Color helper ─────────────────────────────────────────────

function colorCSS(c: IColor, opacity: number): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${opacity})`;
}

// ── Point math (plain tuples — no objects, no allocations) ───

function lerpP3(a: Point3, b: Point3, t: number): Point3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rotateP3(p: Point3, center: Point3, angle: number): Point3 {
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos, p[2]];
}

// ── Rate functions ───────────────────────────────────────────

function smooth(t: number): number {
  return 3 * t * t - 2 * t * t * t;
}

function linear(t: number): number {
  return t;
}

// ── Fast Canvas2D rendering ──────────────────────────────────

const FRAME_WIDTH = 14.222222222222221;
const FRAME_HEIGHT = 8;

function setupTransform(ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
  ctx.setTransform(
    pw / FRAME_WIDTH, 0, 0,
    -(ph / FRAME_HEIGHT),
    pw / 2, ph / 2,
  );
}

function drawPath(ctx: CanvasRenderingContext2D, points: Point3[], forceClose = false): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i + 2 <= points.length; i += 3) {
    ctx.bezierCurveTo(
      points[i][0], points[i][1],
      points[i + 1][0], points[i + 1][1],
      points[i + 2][0], points[i + 2][1],
    );
  }
  // Only close the path if the shape is closed (last anchor ≈ first anchor)
  // This matches Manim: Arc is open, Circle/Polygon are closed
  const last = points[points.length - 1];
  const first = points[0];
  const isClosed = Math.abs(last[0] - first[0]) < 1e-4 && Math.abs(last[1] - first[1]) < 1e-4;
  if (isClosed || forceClose) ctx.closePath();
}

function renderMob(ctx: CanvasRenderingContext2D, mob: RenderMobject, pw: number, ph: number): void {
  if (mob.points.length === 0) return;
  ctx.save();
  setupTransform(ctx, pw, ph);
  drawPath(ctx, mob.points, mob.forceClose);

  if (mob.fillOpacity > 0) {
    ctx.fillStyle = colorCSS(mob.fillColor, mob.fillOpacity);
    ctx.fill();
  }
  if (mob.strokeOpacity > 0 && mob.strokeWidth > 0) {
    ctx.strokeStyle = colorCSS(mob.strokeColor, mob.strokeOpacity);
    ctx.lineWidth = mob.strokeWidth * 0.01;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Draw fixed center dot if requested
  if (mob.showDot && mob.dotPosition) {
    const cx = mob.dotPosition[0];
    const cy = mob.dotPosition[1];
    ctx.beginPath();
    ctx.arc(cx, cy, 0.06, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.015;
    ctx.stroke();
  }

  ctx.restore();
}

// ── Animation helpers (pure array math) ──────────────────────

function partialPoints(allPoints: Point3[], alpha: number): Point3[] {
  if (alpha >= 1) return allPoints;
  if (alpha <= 0) return [];
  const nSegs = (allPoints.length - 1) / 3;
  const targetSegs = alpha * nSegs;
  const fullSegs = Math.floor(targetSegs);
  const partial = targetSegs - fullSegs;
  const result: Point3[] = [];
  for (let i = 0; i <= fullSegs * 3 && i < allPoints.length; i++) {
    result.push(allPoints[i]);
  }
  if (partial > 0 && fullSegs * 3 + 3 < allPoints.length) {
    const b = fullSegs * 3;
    const p0 = allPoints[b], p1 = allPoints[b + 1], p2 = allPoints[b + 2], p3 = allPoints[b + 3];
    const q0 = lerpP3(p0, p1, partial);
    const q1 = lerpP3(p1, p2, partial);
    const q2 = lerpP3(p2, p3, partial);
    const r0 = lerpP3(q0, q1, partial);
    const r1 = lerpP3(q1, q2, partial);
    const s0 = lerpP3(r0, r1, partial);
    result.push(q0, r0, s0);
  }
  return result;
}

function scaleFromCenter(points: Point3[], center: Point3, factor: number): Point3[] {
  const [cx, cy, cz] = center;
  return points.map(([x, y, z]) => [cx + (x - cx) * factor, cy + (y - cy) * factor, cz + (z - cz) * factor]);
}

function rotatePoints(points: Point3[], center: Point3, angle: number): Point3[] {
  return points.map(p => rotateP3(p, center, angle));
}

// ── Bezier subdivision for point alignment ──────────────────

/** Split a single cubic bezier [p0, p1, p2, p3] at parameter t into two cubics. */
function subdivideCubic(p0: Point3, p1: Point3, p2: Point3, p3: Point3, t: number): [Point3[], Point3[]] {
  const lerp = (a: Point3, b: Point3, u: number): Point3 => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return [[p0, a, d, f], [f, e, c, p3]];
}

/** Extract cubic bezier segments from a flat point array (groups of 4, overlapping anchors). */
function extractCurves(pts: Point3[]): Point3[][] {
  const curves: Point3[][] = [];
  for (let i = 0; i + 3 < pts.length; i += 3) {
    curves.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]]);
  }
  return curves;
}

/** Flatten curves back to a point array (avoid duplicating shared anchors). */
function flattenCurves(curves: Point3[][]): Point3[] {
  if (curves.length === 0) return [];
  const pts: Point3[] = [curves[0][0]];
  for (const c of curves) {
    pts.push(c[1], c[2], c[3]);
  }
  return pts;
}

/**
 * Subdivide curves evenly so a shape with `currentN` curves becomes `targetN` curves.
 * This is how Manim's bezierRemap works — distribute new curves proportionally across old ones.
 */
function subdivideCurvesToMatch(curves: Point3[][], targetN: number): Point3[][] {
  const currentN = curves.length;
  if (currentN === 0) return curves;
  if (currentN >= targetN) return curves;

  const result: Point3[][] = [];
  for (let i = 0; i < currentN; i++) {
    // How many output curves should this input curve produce?
    const startIdx = Math.round((i * targetN) / currentN);
    const endIdx = Math.round(((i + 1) * targetN) / currentN);
    const nSplits = endIdx - startIdx;

    if (nSplits <= 1) {
      result.push(curves[i]);
    } else {
      // Subdivide this curve into nSplits equal parts
      let remaining: Point3[] = curves[i];
      for (let j = 0; j < nSplits; j++) {
        const tLocal = 1 / (nSplits - j);
        if (j === nSplits - 1) {
          result.push(remaining);
        } else {
          const [left, right] = subdivideCubic(remaining[0], remaining[1], remaining[2], remaining[3], tLocal);
          result.push(left);
          remaining = right;
        }
      }
    }
  }
  return result;
}

/**
 * Find the rotation offset for `to` points that minimizes total squared distance to `from`.
 * Only tests anchor positions (every 3rd point) for efficiency.
 * This prevents the "unwinding" artifact Manim solves with winding alignment.
 */
function findBestRotation(from: Point3[], to: Point3[]): number {
  const n = to.length;
  if (n === 0 || n !== from.length) return 0;

  // Number of curves = (n - 1) / 3
  const nCurves = Math.floor((n - 1) / 3);
  if (nCurves <= 1) return 0;

  let bestOffset = 0;
  let bestDist = Infinity;

  for (let offset = 0; offset < nCurves; offset++) {
    let totalDist = 0;
    for (let c = 0; c < nCurves; c++) {
      const fi = c * 3;
      const ti = ((c + offset) % nCurves) * 3;
      const dx = from[fi][0] - to[ti][0];
      const dy = from[fi][1] - to[ti][1];
      totalDist += dx * dx + dy * dy;
    }
    if (totalDist < bestDist) {
      bestDist = totalDist;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/** Rotate a point array by `offset` curves (each curve = 3 points, sharing anchors). */
function rotatePointsByCurveOffset(pts: Point3[], offset: number): Point3[] {
  if (offset === 0) return pts;
  const curves = extractCurves(pts);
  const n = curves.length;
  const rotated: Point3[][] = [];
  for (let i = 0; i < n; i++) {
    rotated.push(curves[(i + offset) % n]);
  }
  return flattenCurves(rotated);
}

/**
 * Align two point arrays for smooth transform interpolation.
 * 1. Subdivide shorter shape's curves to match the longer shape's curve count.
 * 2. Rotate target points to minimize travel distance (best winding alignment).
 * Returns [alignedFrom, alignedTo] with equal lengths.
 */
function alignPointsForTransform(from: Point3[], to: Point3[]): [Point3[], Point3[]] {
  let fromCurves = extractCurves(from);
  let toCurves = extractCurves(to);

  const maxCurves = Math.max(fromCurves.length, toCurves.length);
  if (fromCurves.length < maxCurves) {
    fromCurves = subdivideCurvesToMatch(fromCurves, maxCurves);
  }
  if (toCurves.length < maxCurves) {
    toCurves = subdivideCurvesToMatch(toCurves, maxCurves);
  }

  const alignedFrom = flattenCurves(fromCurves);
  let alignedTo = flattenCurves(toCurves);

  // Find best rotation to minimize point travel
  const bestOffset = findBestRotation(alignedFrom, alignedTo);
  alignedTo = rotatePointsByCurveOffset(alignedTo, bestOffset);

  return [alignedFrom, alignedTo];
}

function interpolatePoints(from: Point3[], to: Point3[], t: number): Point3[] {
  const len = Math.min(from.length, to.length);
  const result: Point3[] = [];
  for (let i = 0; i < len; i++) {
    result.push(lerpP3(from[i], to[i], t));
  }
  return result;
}

function shiftPoints(points: Point3[], dx: number, dy: number): Point3[] {
  return points.map(([x, y, z]) => [x + dx, y + dy, z]);
}

// ── Scene with animation queue ───────────────────────────────

type AnimType = "create" | "grow" | "fadeIn" | "fadeOut" | "rotate" | "transform" | "shift" | "spinIn" | "indicate";

interface AnimState {
  type: AnimType;
  mob: RenderMobject;
  fullPoints: Point3[];
  startTime: number;
  duration: number;
  done: boolean;
  // Extra data for specific anims
  targetPoints?: Point3[];
  targetMob?: RenderMobject;
  origFillOpacity?: number;
  origStrokeOpacity?: number;
  totalAngle?: number;
  shiftDx?: number;
  shiftDy?: number;
  origCenter?: Point3;
  origFillColor?: { r: number; g: number; b: number; a: number };
  origStrokeColor?: { r: number; g: number; b: number; a: number };
  rotateCenter?: Point3;
  growCenter?: Point3;
}

class DemoScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pw: number;
  private ph: number;
  private bgColor: IColor = { r: 0.114, g: 0.122, b: 0.176, a: 1.0 };

  private mobjects: RenderMobject[] = [];
  private animQueue: (() => AnimState)[] = [];
  private activeAnim: AnimState | null = null;
  private running = false;
  onComplete: (() => void) | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.pw = this.canvas.width;
    this.ph = this.canvas.height;
    this.renderFrame();
  }

  add(mob: RenderMobject): void {
    if (!this.mobjects.includes(mob)) this.mobjects.push(mob);
  }

  remove(mob: RenderMobject): void {
    const idx = this.mobjects.indexOf(mob);
    if (idx >= 0) this.mobjects.splice(idx, 1);
  }

  clearAll(): void {
    this.mobjects = [];
    this.animQueue = [];
    this.activeAnim = null;
    this.running = false;
    this.onComplete = null;
    this.renderFrame();
  }

  queueCreate(mob: RenderMobject, duration = 1.5): void {
    const fullPts = [...mob.points];
    this.animQueue.push(() => {
      mob.points = [];
      this.add(mob);
      return { type: "create", mob, fullPoints: fullPts, startTime: performance.now(), duration, done: false };
    });
  }

  queueGrow(mob: RenderMobject, duration = 1.0, growCenter?: Point3): void {
    const fullPts = [...mob.points];
    this.animQueue.push(() => {
      const center = growCenter ?? mob.center;
      mob.points = scaleFromCenter(fullPts, center, 0);
      this.add(mob);
      return { type: "grow", mob, fullPoints: fullPts, startTime: performance.now(), duration, done: false, growCenter: center };
    });
  }

  queueFadeIn(mob: RenderMobject, duration = 1.0): void {
    const fullPts = [...mob.points];
    const origFill = mob.fillOpacity;
    const origStroke = mob.strokeOpacity;
    this.animQueue.push(() => {
      mob.fillOpacity = 0;
      mob.strokeOpacity = 0;
      mob.points = fullPts;
      this.add(mob);
      return { type: "fadeIn", mob, fullPoints: fullPts, startTime: performance.now(), duration, done: false, origFillOpacity: origFill, origStrokeOpacity: origStroke };
    });
  }

  queueFadeOut(mob: RenderMobject, duration = 1.0): void {
    const origFill = mob.fillOpacity;
    const origStroke = mob.strokeOpacity;
    this.animQueue.push(() => {
      return { type: "fadeOut", mob, fullPoints: [...mob.points], startTime: performance.now(), duration, done: false, origFillOpacity: origFill, origStrokeOpacity: origStroke };
    });
  }

  queueRotate(mob: RenderMobject, angle: number, duration = 1.0): void {
    this.animQueue.push(() => {
      return { type: "rotate", mob, fullPoints: [...mob.points], startTime: performance.now(), duration, done: false, totalAngle: angle };
    });
  }

  /** Rotate about bounding box center — matches Manim's getCenter(). */
  queueRotateCOM(mob: RenderMobject, angle: number, duration = 1.0): void {
    this.animQueue.push(() => {
      const pts = mob.points;
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const [x, y, z] of pts) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const com: Point3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
      return { type: "rotate", mob, fullPoints: [...pts], startTime: performance.now(), duration, done: false, totalAngle: angle, rotateCenter: com };
    });
  }

  queueTransform(from: RenderMobject, to: RenderMobject, duration = 1.5): void {
    this.animQueue.push(() => {
      this.add(from);
      // Align at START time so we capture the mob's current points (not the original ones)
      const [alignedFrom, alignedTo] = alignPointsForTransform([...from.points], [...to.points]);
      const origFill = { ...from.fillColor };
      const origStroke = { ...from.strokeColor };
      from.points = alignedFrom;
      return {
        type: "transform", mob: from, fullPoints: alignedFrom, targetPoints: alignedTo,
        targetMob: to, startTime: performance.now(), duration, done: false,
        origFillColor: origFill, origStrokeColor: origStroke,
      };
    });
  }

  queueShift(mob: RenderMobject, dx: number, dy: number, duration = 1.0): void {
    this.animQueue.push(() => {
      const origCenter: Point3 = [...mob.center];
      return { type: "shift", mob, fullPoints: [...mob.points], startTime: performance.now(), duration, done: false, shiftDx: dx, shiftDy: dy, origCenter };
    });
  }

  /** SpinInFromNothing — scale + rotate simultaneously from center */
  queueSpinIn(mob: RenderMobject, duration = 1.0, growCenter?: Point3): void {
    const fullPts = [...mob.points];
    this.animQueue.push(() => {
      const center = growCenter ?? mob.center;
      mob.points = scaleFromCenter(fullPts, center, 0);
      this.add(mob);
      return { type: "spinIn", mob, fullPoints: fullPts, startTime: performance.now(), duration, done: false, growCenter: center, totalAngle: TAU };
    });
  }

  /** Indicate — briefly scale up then back to original */
  queueIndicate(mob: RenderMobject, duration = 0.8, scaleFactor = 1.3): void {
    this.animQueue.push(() => {
      return { type: "indicate", mob, fullPoints: [...mob.points], startTime: performance.now(), duration, done: false, totalAngle: scaleFactor };
    });
  }

  queueWait(duration = 0.5): void {
    this.animQueue.push(() => {
      return { type: "create", mob: { points: [], fillColor: WHITE, fillOpacity: 0, strokeColor: WHITE, strokeOpacity: 0, strokeWidth: 0, center: [0, 0, 0] }, fullPoints: [], startTime: performance.now(), duration, done: false };
    });
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this.startNext();
    this.loop();
  }

  private startNext(): void {
    if (this.animQueue.length === 0) { this.activeAnim = null; return; }
    this.activeAnim = this.animQueue.shift()!();
  }

  private loop = (): void => {
    if (!this.running) return;

    if (this.activeAnim && !this.activeAnim.done) {
      this.tickAnim(this.activeAnim);
    }

    if (this.activeAnim?.done) {
      if (this.animQueue.length > 0) {
        this.startNext();
      } else {
        this.renderFrame();
        this.running = false;
        if (this.onComplete) this.onComplete();
        return;
      }
    }

    this.renderFrame();
    requestAnimationFrame(this.loop);
  };

  private tickAnim(a: AnimState): void {
    const elapsed = (performance.now() - a.startTime) / 1000;
    const rawT = Math.min(1, elapsed / a.duration);
    const t = smooth(rawT);

    switch (a.type) {
      case "create":
        a.mob.points = partialPoints(a.fullPoints, t);
        break;
      case "grow":
        a.mob.points = scaleFromCenter(a.fullPoints, a.growCenter ?? a.mob.center, t);
        break;
      case "fadeIn":
        a.mob.fillOpacity = t * (a.origFillOpacity ?? 0.5);
        a.mob.strokeOpacity = t * (a.origStrokeOpacity ?? 1);
        break;
      case "fadeOut":
        a.mob.fillOpacity = (1 - t) * (a.origFillOpacity ?? 0.5);
        a.mob.strokeOpacity = (1 - t) * (a.origStrokeOpacity ?? 1);
        break;
      case "rotate":
        a.mob.points = rotatePoints(a.fullPoints, a.rotateCenter ?? a.mob.center, t * (a.totalAngle ?? TAU));
        break;
      case "transform":
        if (a.targetPoints) {
          a.mob.points = interpolatePoints(a.fullPoints, a.targetPoints, t);
          // Also interpolate colors during morph (like Manim)
          if (a.targetMob) {
            const tm = a.targetMob;
            const lc = (a: number, b: number, u: number) => a + (b - a) * u;
            a.mob.fillColor = {
              r: lc(a.origFillColor?.r ?? a.mob.fillColor.r, tm.fillColor.r, t),
              g: lc(a.origFillColor?.g ?? a.mob.fillColor.g, tm.fillColor.g, t),
              b: lc(a.origFillColor?.b ?? a.mob.fillColor.b, tm.fillColor.b, t),
              a: 1,
            };
            a.mob.strokeColor = {
              r: lc(a.origStrokeColor?.r ?? a.mob.strokeColor.r, tm.strokeColor.r, t),
              g: lc(a.origStrokeColor?.g ?? a.mob.strokeColor.g, tm.strokeColor.g, t),
              b: lc(a.origStrokeColor?.b ?? a.mob.strokeColor.b, tm.strokeColor.b, t),
              a: 1,
            };
          }
        }
        break;
      case "shift": {
        const dx = t * (a.shiftDx ?? 0);
        const dy = t * (a.shiftDy ?? 0);
        a.mob.points = shiftPoints(a.fullPoints, dx, dy);
        const oc = a.origCenter!;
        a.mob.center = [oc[0] + dx, oc[1] + dy, oc[2]];
        break;
      }
      case "spinIn": {
        // Scale up from 0 to 1 AND rotate simultaneously
        const center = a.growCenter ?? a.mob.center;
        const angle = t * (a.totalAngle ?? TAU);
        const scaled = scaleFromCenter(a.fullPoints, center, t);
        a.mob.points = rotatePoints(scaled, center, angle);
        break;
      }
      case "indicate": {
        // Scale up to scaleFactor then back down (pulse effect)
        const factor = a.totalAngle ?? 1.3; // reuse totalAngle for scaleFactor
        const pulse = t < 0.5 ? 1 + (factor - 1) * (t * 2) : 1 + (factor - 1) * (2 - t * 2);
        a.mob.points = scaleFromCenter(a.fullPoints, a.mob.center, pulse);
        break;
      }
    }

    if (rawT >= 1) {
      a.done = true;
      if (a.type === "transform" && a.targetPoints) {
        a.mob.points = a.targetPoints;
        if (a.targetMob) {
          a.mob.fillColor = { ...a.targetMob.fillColor };
          a.mob.strokeColor = { ...a.targetMob.strokeColor };
        }
      } else if (a.type === "fadeOut") {
        this.remove(a.mob);
      } else if (a.type === "shift") {
        a.mob.points = shiftPoints(a.fullPoints, a.shiftDx ?? 0, a.shiftDy ?? 0);
        const oc = a.origCenter!;
        a.mob.center = [oc[0] + (a.shiftDx ?? 0), oc[1] + (a.shiftDy ?? 0), oc[2]];
      } else if (a.type !== "fadeIn") {
        a.mob.points = a.fullPoints;
      }
    }
  }

  private renderFrame(): void {
    this.ctx.resetTransform();
    this.ctx.fillStyle = colorCSS(this.bgColor, 1);
    this.ctx.fillRect(0, 0, this.pw, this.ph);

    for (const mob of this.mobjects) {
      renderMob(this.ctx, mob, this.pw, this.ph);
    }
  }
}

// ── Build shapes using the REAL engine, then extract ─────────

function buildShape(EngineClass: any, opts: any, label?: string): RenderMobject {
  // Some engine classes (e.g. RegularPolygon, Star) take `n` as the first
  // positional arg. Extract it from opts so the demo can use a single
  // options-bag convention.
  const { n, ...rest } = opts;
  const mob = (n !== undefined
    ? new EngineClass(n, rest)
    : new EngineClass(rest)) as VMobject;
  if (opts._shift) mob.shift(np.array(opts._shift));
  if (opts._scale) mob.scale(opts._scale);
  if (opts._rotate) mob.rotate(opts._rotate);
  return extractRenderMobject(mob, label);
}

function buildPolygon(vertices: number[][], opts: any, label?: string): RenderMobject {
  const verts = vertices.map(v => np.array(v));
  const mob = new Polygon(verts, opts) as VMobject;
  if (opts._shift) mob.shift(np.array(opts._shift));
  return extractRenderMobject(mob, label);
}

function buildLine(opts: any, label?: string): RenderMobject {
  const mob = new Line(opts) as VMobject;
  return extractRenderMobject(mob, label);
}

// ── Scene instance ───────────────────────────────────────────

const scene = new DemoScene("manim-canvas");

// ── GEOMETRY TESTS ───────────────────────────────────────────

(window as any).testCircle = () => {
  scene.clearAll();
  log("Geometry: Circle (radius=1.5)");
  const c = buildShape(Circle, { radius: 1.5, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1 }, "Circle");
  scene.queueCreate(c, 1.2);
  scene.play();
};

(window as any).testSquare = () => {
  scene.clearAll();
  log("Geometry: Square (sideLength=2.5)");
  const s = buildShape(Square, { sideLength: 2.5, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1 }, "Square");
  scene.queueCreate(s, 1.2);
  scene.play();
};

(window as any).testTriangle = () => {
  scene.clearAll();
  log("Geometry: Triangle (radius=1.5)");
  const t = buildShape(Triangle, { radius: 1.5, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1 }, "Triangle");
  scene.queueCreate(t, 1.2);
  scene.play();
};

(window as any).testLine = () => {
  scene.clearAll();
  log("Geometry: Line ([-4,0,0] to [4,0,0])");
  const l = buildLine({
    start: np.array([-4, 0, 0]),
    end: np.array([4, 0, 0]),
    strokeColor: WHITE,
    strokeOpacity: 1,
    strokeWidth: 4,
  }, "Line");
  scene.queueCreate(l, 1.0);
  scene.play();
};

(window as any).testArc = () => {
  scene.clearAll();
  log("Geometry: Arc (angle=270deg, radius=2)");
  const a = buildShape(Arc, {
    radius: 2,
    angle: TAU * 0.75,
    startAngle: 0,
    strokeColor: TEAL,
    strokeOpacity: 1,
    fillOpacity: 0,
    strokeWidth: 4,
  }, "Arc");
  scene.queueCreate(a, 1.5);
  scene.play();
};

(window as any).testPolygon = () => {
  scene.clearAll();
  log("Geometry: Custom Polygons showcase");

  // Helper to shift polygon verts to a position
  function shiftVerts(verts: number[][], dx: number, dy: number): number[][] {
    return verts.map(([x, y, z]) => [x + dx, y + dy, z]);
  }

  // Row 1
  // 5-point star
  const starVerts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - PI / 2;
    const r = i % 2 === 0 ? 0.9 : 0.4;
    starVerts.push([r * Math.cos(angle), r * Math.sin(angle), 0]);
  }
  scene.queueCreate(buildPolygon(shiftVerts(starVerts, -5, 1.5), { fillColor: GOLD, fillOpacity: 0.5, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }, "Star"), 0.6);

  // Diamond / rhombus
  const diamondVerts = [[-0.7, 0, 0], [0, 1.0, 0], [0.7, 0, 0], [0, -1.0, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(diamondVerts, -2.5, 1.5), { fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }, "Diamond"), 0.6);

  // Arrow / chevron
  const arrowVerts = [[-0.6, 0.4, 0], [0.2, 0.4, 0], [0.2, 0.8, 0], [0.8, 0, 0], [0.2, -0.8, 0], [0.2, -0.4, 0], [-0.6, -0.4, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(arrowVerts, 0, 1.5), { fillColor: RED, fillOpacity: 0.5, strokeColor: RED, strokeOpacity: 1, strokeWidth: 3 }, "Arrow"), 0.6);

  // Cross / plus
  const d = 0.3, w = 0.8;
  const crossVerts = [[-d, w, 0], [d, w, 0], [d, d, 0], [w, d, 0], [w, -d, 0], [d, -d, 0], [d, -w, 0], [-d, -w, 0], [-d, -d, 0], [-w, -d, 0], [-w, d, 0], [-d, d, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(crossVerts, 2.5, 1.5), { fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1, strokeWidth: 3 }, "Cross"), 0.6);

  // Pacman
  const pacVerts: number[][] = [[0, 0, 0]];
  const mouthAngle = PI / 6;
  for (let i = 0; i <= 20; i++) {
    const a = mouthAngle + (i / 20) * (TAU - 2 * mouthAngle);
    pacVerts.push([0.8 * Math.cos(a), 0.8 * Math.sin(a), 0]);
  }
  scene.queueCreate(buildPolygon(shiftVerts(pacVerts, 5, 1.5), { fillColor: YELLOW, fillOpacity: 0.7, strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }, "Pacman"), 0.6);

  // Row 2
  // Heart
  const heartVerts: number[][] = [];
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * TAU;
    const x = 0.05 * (16 * Math.sin(t) ** 3);
    const y = 0.05 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    heartVerts.push([x, y, 0]);
  }
  scene.queueCreate(buildPolygon(shiftVerts(heartVerts, -5, -1.5), { fillColor: PINK, fillOpacity: 0.6, strokeColor: PINK, strokeOpacity: 1, strokeWidth: 3 }, "Heart"), 0.6);

  // 6-point star (Star of David)
  const star6Verts: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU - PI / 2;
    const r = i % 2 === 0 ? 0.9 : 0.5;
    star6Verts.push([r * Math.cos(angle), r * Math.sin(angle), 0]);
  }
  scene.queueCreate(buildPolygon(shiftVerts(star6Verts, -2.5, -1.5), { fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1, strokeWidth: 3 }, "6-Star"), 0.6);

  // L-shape
  const lVerts = [[-0.7, -0.8, 0], [-0.7, 0.8, 0], [-0.3, 0.8, 0], [-0.3, -0.4, 0], [0.7, -0.4, 0], [0.7, -0.8, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(lVerts, 0, -1.5), { fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1, strokeWidth: 3 }, "L-Shape"), 0.6);

  // Trapezoid
  const trapVerts = [[-0.5, 0.5, 0], [0.5, 0.5, 0], [0.9, -0.5, 0], [-0.9, -0.5, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(trapVerts, 2.5, -1.5), { fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1, strokeWidth: 3 }, "Trapezoid"), 0.6);

  // House (pentagon: square base + triangular roof)
  const houseVerts = [[-0.7, -0.7, 0], [0.7, -0.7, 0], [0.7, 0.2, 0], [0, 0.8, 0], [-0.7, 0.2, 0]];
  scene.queueCreate(buildPolygon(shiftVerts(houseVerts, 5, -1.5), { fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1, strokeWidth: 3 }, "House"), 0.6);

  log("  → 10 custom polygons created");
  scene.play();
};

(window as any).testRegularPolygons = () => {
  scene.clearAll();
  log("Geometry: Regular Polygons (pentagon, hexagon, heptagon, octagon)");
  const colors = [RED, PURPLE, TEAL, ORANGE];
  const names = ["Pentagon", "Hexagon", "Heptagon", "Octagon"];
  const xPositions = [-4.5, -1.5, 1.5, 4.5];

  for (let i = 0; i < 4; i++) {
    const n = i + 5;
    const mob = buildShape(RegularPolygon, {
      n,
      radius: 1.2,
      fillColor: colors[i],
      fillOpacity: 0.5,
      strokeColor: colors[i],
      strokeOpacity: 1,
      _shift: [xPositions[i], 0, 0],
    }, names[i]);
    scene.queueGrow(mob, 0.8);
  }
  scene.play();
};

(window as any).testAllGeometry = () => {
  scene.clearAll();
  log("Geometry: ALL shapes");
  const shapes = [
    buildShape(Circle, { radius: 1.0, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1, _shift: [-5, 2, 0] }, "Circle"),
    buildShape(Square, { sideLength: 1.8, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1, _shift: [-2.5, 2, 0] }, "Square"),
    buildShape(Triangle, { radius: 1.0, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [0, 2, 0] }, "Triangle"),
    buildShape(Arc, { radius: 1.0, angle: TAU * 0.75, strokeColor: TEAL, strokeOpacity: 1, fillColor: TEAL, fillOpacity: 0.3, strokeWidth: 4, _shift: [2.5, 2, 0] }, "Arc"),
    buildShape(RegularPolygon, { n: 5, radius: 1.0, fillColor: RED, fillOpacity: 0.5, strokeColor: RED, strokeOpacity: 1, _shift: [5, 2, 0] }, "Pentagon"),
    buildShape(RegularPolygon, { n: 6, radius: 1.0, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1, _shift: [-5, -1.5, 0] }, "Hexagon"),
    buildShape(RegularPolygon, { n: 7, radius: 1.0, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1, _shift: [-2.5, -1.5, 0] }, "Heptagon"),
    buildShape(RegularPolygon, { n: 8, radius: 1.0, fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1, _shift: [0, -1.5, 0] }, "Octagon"),
    buildLine({ start: np.array([2, -0.8, 0]), end: np.array([6, -2.2, 0]), strokeColor: WHITE, strokeOpacity: 1, strokeWidth: 4 }, "Line"),
  ];

  // Star
  const starVerts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - PI / 2;
    const r = i % 2 === 0 ? 1.0 : 0.5;
    starVerts.push([r * Math.cos(angle) + 4, r * Math.sin(angle) - 1.5, 0]);
  }
  // Build star manually since it needs shifted vertices
  const starMob = new Polygon(starVerts.map(v => np.array(v)), {
    fillColor: GOLD, fillOpacity: 0.5, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 4,
  }) as VMobject;
  shapes.push(extractRenderMobject(starMob, "Star"));

  for (const s of shapes) {
    scene.queueGrow(s, 0.6);
  }
  log(`  → ${shapes.length} shapes constructed with real engine classes`);
  scene.play();
};

// ── TRANSFORM TESTS ──────────────────────────────────────────

(window as any).testShift = () => {
  scene.clearAll();
  log("Transform: shift() — circle shifted to 4 positions");
  const positions: [number, number, number][] = [[-3, 1.5, 0], [3, 1.5, 0], [-3, -1.5, 0], [3, -1.5, 0]];
  const colors = [RED, BLUE, GREEN, YELLOW];
  for (let i = 0; i < 4; i++) {
    const c = buildShape(Circle, {
      radius: 1.0,
      fillColor: colors[i], fillOpacity: 0.5,
      strokeColor: colors[i], strokeOpacity: 1,
      _shift: positions[i],
    }, `Shifted (${positions[i][0]}, ${positions[i][1]})`);
    scene.queueGrow(c, 0.6);
  }
  scene.play();
};

(window as any).testScale = () => {
  scene.clearAll();
  log("Transform: scale() — same circle at scales 0.5, 1.0, 1.5, 2.0");
  const scales = [0.5, 1.0, 1.5, 2.0];
  const xPos = [-4.5, -1.5, 1.5, 4.5];
  const colors = [BLUE_A, BLUE_B, BLUE_C, BLUE_D];
  for (let i = 0; i < 4; i++) {
    const c = buildShape(Circle, {
      radius: 1.0,
      fillColor: colors[i], fillOpacity: 0.5,
      strokeColor: colors[i], strokeOpacity: 1,
      _shift: [xPos[i], 0, 0],
      _scale: scales[i],
    }, `Scale ${scales[i]}x`);
    scene.queueGrow(c, 0.6);
  }
  scene.play();
};

(window as any).testRotate = () => {
  scene.clearAll();
  log("Transform: rotate() — square at 0°, 15°, 30°, 45°");
  const angles = [0, PI / 12, PI / 6, PI / 4];
  const xPos = [-4.5, -1.5, 1.5, 4.5];
  const colors = [GREEN_A, GREEN_B, GREEN_C, GREEN_D];
  for (let i = 0; i < 4; i++) {
    const s = buildShape(Square, {
      sideLength: 2.0,
      fillColor: colors[i], fillOpacity: 0.5,
      strokeColor: colors[i], strokeOpacity: 1,
      _shift: [xPos[i], 0, 0],
      _rotate: angles[i],
    }, `Rotate ${Math.round(angles[i] * 180 / PI)}°`);
    scene.queueGrow(s, 0.6);
  }
  scene.play();
};

(window as any).testChained = () => {
  scene.clearAll();
  log("Transform: chained shift + scale + rotate");
  // Build a triangle that's been shifted, scaled, and rotated via engine methods
  const mob1 = new Triangle({ radius: 1.0, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }) as VMobject;
  mob1.shift(np.array([-3, 0, 0]));
  mob1.scale(1.5);
  mob1.rotate(PI / 6);
  const r1 = extractRenderMobject(mob1, "Shifted+Scaled+Rotated");

  const mob2 = new RegularPolygon(6, { radius: 1.0, fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1 }) as VMobject;
  mob2.shift(np.array([3, 0, 0]));
  mob2.scale(2.0);
  mob2.rotate(-PI / 4);
  const r2 = extractRenderMobject(mob2, "Hex Shifted+Scaled+Rotated");

  scene.queueCreate(r1, 1.0);
  scene.queueWait(0.2);
  scene.queueCreate(r2, 1.0);
  scene.play();
};

(window as any).testMoveTo = () => {
  scene.clearAll();
  log("Transform: moveTo() — shapes at grid positions");
  const gridColors = [RED, BLUE, GREEN, YELLOW, PURPLE, TEAL, ORANGE, GOLD, PINK];
  let idx = 0;
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const mob = new Circle({ radius: 0.6, fillColor: gridColors[idx], fillOpacity: 0.5, strokeColor: gridColors[idx], strokeOpacity: 1 }) as VMobject;
      mob.moveTo(np.array([col * 3, row * 2.2, 0]));
      const r = extractRenderMobject(mob, `Grid(${col},${row})`);
      scene.queueGrow(r, 0.4);
      idx++;
    }
  }
  scene.play();
};

// ── ANIMATION TESTS ──────────────────────────────────────────

/** Build the standard 3-row shape set (same as Create page), centered by geometric centroid.
 *  Returns all shapes positioned and ready to animate. */
function buildStandardShapes(): RenderMobject[] {
  const row1Y = 2, row2Y = -0.3, row3Y = -2.5;
  const xPositions = [-5, -2.5, 0, 2.5, 5];

  function shiftToCenter(mob: RenderMobject, targetX: number, targetY: number, useBBox: boolean) {
    const center = useBBox ? boundingBoxCenter(mob.points) : geometricCentroid(mob.points);
    const dx = targetX - center[0];
    const dy = targetY - center[1];
    mob.points = mob.points.map(([x, y, z]) => [x + dx, y + dy, z] as Point3);
    mob.center = [mob.center[0] + dx, mob.center[1] + dy, mob.center[2]];
  }
  const isArc = (label: string) => label === "Arc" || label === "Pacman";

  // Row 1: Circle, Square, Triangle, Arc, Pacman
  const pacVerts: number[][] = [[0, 0, 0]];
  for (let i = 0; i <= 20; i++) {
    const a = PI / 6 + (i / 20) * (TAU - 2 * PI / 6);
    pacVerts.push([0.8 * Math.cos(a), 0.8 * Math.sin(a), 0]);
  }
  const pacMob = new Polygon(pacVerts.map(v => np.array(v)), { fillColor: YELLOW, fillOpacity: 0.7, strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

  const row1: RenderMobject[] = [
    buildShape(Circle,         { radius: 0.8,     fillColor: BLUE,   fillOpacity: 0.5, strokeColor: BLUE,   strokeOpacity: 1 }, "Circle"),
    buildShape(Square,         { sideLength: 1.5,  fillColor: GREEN,  fillOpacity: 0.5, strokeColor: GREEN,  strokeOpacity: 1 }, "Square"),
    buildShape(Triangle,       { radius: 0.8,     fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1 }, "Triangle"),
    buildShape(Arc,            { radius: 0.8, angle: TAU * 0.75, strokeColor: TEAL, strokeOpacity: 1, fillColor: TEAL, fillOpacity: 0.3, strokeWidth: 3 }, "Arc"),
    extractRenderMobject(pacMob, "Pacman"),
  ];

  // Row 2: Pentagon, Hexagon, Heptagon, Octagon, Decagon
  const row2: RenderMobject[] = [
    buildShape(RegularPolygon, { n: 5, radius: 0.8, fillColor: RED,    fillOpacity: 0.5, strokeColor: RED,    strokeOpacity: 1 }, "Pentagon"),
    buildShape(RegularPolygon, { n: 6, radius: 0.8, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }, "Hexagon"),
    buildShape(RegularPolygon, { n: 7, radius: 0.8, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1 }, "Heptagon"),
    buildShape(RegularPolygon, { n: 8, radius: 0.8, fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1 }, "Octagon"),
    buildShape(RegularPolygon, { n: 10, radius: 0.8, fillColor: PINK,  fillOpacity: 0.5, strokeColor: PINK,  strokeOpacity: 1 }, "Decagon"),
  ];

  // Row 3: Line, Diamond, Star
  const row3: RenderMobject[] = [];
  row3.push(buildLine({ start: np.array([-0.5, 0, 0]), end: np.array([2.5, 0, 0]), strokeColor: WHITE, strokeOpacity: 1, strokeWidth: 3 }, "Line"));

  const diamondVerts = [[-0.8, 0, 0], [0, 0.8, 0], [0.8, 0, 0], [0, -0.8, 0]].map(v => np.array(v));
  const diamond = new Polygon(diamondVerts, { fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
  row3.push(extractRenderMobject(diamond, "Diamond"));

  const starVerts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - PI / 2;
    const r = i % 2 === 0 ? 0.8 : 0.4;
    starVerts.push([r * Math.cos(angle), r * Math.sin(angle), 0]);
  }
  const starMob = new Polygon(starVerts.map(v => np.array(v)), { fillColor: GOLD, fillOpacity: 0.5, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
  row3.push(extractRenderMobject(starMob, "Star"));

  // Position all shapes by geometric centroid
  const row3X = [-3, 0, 3.5];
  const shapes: RenderMobject[] = [];
  for (let i = 0; i < row1.length; i++) { shiftToCenter(row1[i], xPositions[i], row1Y, isArc(row1[i].label ?? "")); shapes.push(row1[i]); }
  for (let i = 0; i < row2.length; i++) { shiftToCenter(row2[i], xPositions[i], row2Y, isArc(row2[i].label ?? "")); shapes.push(row2[i]); }
  for (let i = 0; i < row3.length; i++) { shiftToCenter(row3[i], row3X[i], row3Y, isArc(row3[i].label ?? "")); shapes.push(row3[i]); }

  // Close arc paths
  for (const s of shapes) if (s.label === "Arc") s.forceClose = true;

  return shapes;
}

(window as any).animCreate = () => {
  scene.clearAll();
  log("Animation: Create — every drawable shape");

  // Row 1: basic shapes + pacman
  const shapes: RenderMobject[] = [];

  // Pacman — a circle with a wedge mouth cut out (row 1, last position)
  const pacX = 5, pacY = 2, pacR = 0.8;
  const mouthAngle = PI / 6; // half-mouth opening (30°)
  const pacVerts: number[][] = [[pacX, pacY, 0]]; // center
  const arcSteps = 20;
  for (let i = 0; i <= arcSteps; i++) {
    const a = mouthAngle + (i / arcSteps) * (TAU - 2 * mouthAngle);
    pacVerts.push([pacX + pacR * Math.cos(a), pacY + pacR * Math.sin(a), 0]);
  }
  const pacMob = new Polygon(pacVerts.map(v => np.array(v)), { fillColor: YELLOW, fillOpacity: 0.7, strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

  shapes.push(
    buildShape(Circle,         { radius: 0.8,     fillColor: BLUE,   fillOpacity: 0.5, strokeColor: BLUE,   strokeOpacity: 1, _shift: [-5, 2, 0] }, "Circle"),
    buildShape(Square,         { sideLength: 1.5,  fillColor: GREEN,  fillOpacity: 0.5, strokeColor: GREEN,  strokeOpacity: 1, _shift: [-2.5, 2, 0] }, "Square"),
    buildShape(Triangle,       { radius: 0.8,     fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [0, 2, 0] }, "Triangle"),
    buildShape(Arc,            { radius: 0.8, angle: TAU * 0.75, strokeColor: TEAL, strokeOpacity: 1, fillColor: TEAL, fillOpacity: 0.3, strokeWidth: 3, _shift: [2.5, 2, 0] }, "Arc"),
    extractRenderMobject(pacMob, "Pacman"),

    // Row 2: more polygons (pentagon moved here from row 1)
    buildShape(RegularPolygon, { n: 5, radius: 0.8, fillColor: RED,    fillOpacity: 0.5, strokeColor: RED,    strokeOpacity: 1, _shift: [-5, -0.3, 0] }, "Pentagon"),
    buildShape(RegularPolygon, { n: 6, radius: 0.8, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1, _shift: [-2.5, -0.3, 0] }, "Hexagon"),
    buildShape(RegularPolygon, { n: 7, radius: 0.8, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1, _shift: [0, -0.3, 0] }, "Heptagon"),
    buildShape(RegularPolygon, { n: 8, radius: 0.8, fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1, _shift: [2.5, -0.3, 0] }, "Octagon"),
    buildShape(RegularPolygon, { n: 10, radius: 0.8, fillColor: PINK,  fillOpacity: 0.5, strokeColor: PINK,  strokeOpacity: 1, _shift: [5, -0.3, 0] }, "Decagon"),
  );

  // Row 3: line + custom polygon + star
  shapes.push(buildLine({ start: np.array([-5.5, -2.5, 0]), end: np.array([-2.5, -2.5, 0]), strokeColor: WHITE, strokeOpacity: 1, strokeWidth: 3 }, "Line"));

  const diamondVerts = [[-1, -2.5, 0], [0, -1.7, 0], [1, -2.5, 0], [0, -3.3, 0]].map(v => np.array(v));
  const diamond = new Polygon(diamondVerts, { fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
  shapes.push(extractRenderMobject(diamond, "Diamond"));

  const starVerts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - PI / 2;
    const r = i % 2 === 0 ? 0.8 : 0.4;
    starVerts.push([r * Math.cos(angle) + 3.5, r * Math.sin(angle) - 2.5, 0]);
  }
  const starMob = new Polygon(starVerts.map(v => np.array(v)), { fillColor: GOLD, fillOpacity: 0.5, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
  shapes.push(extractRenderMobject(starMob, "Star"));


  // Close arc paths so they render as a circle with a slice cut out
  for (const s of shapes) if (s.label === "Arc") s.forceClose = true;

  for (const s of shapes) {
    scene.queueCreate(s, 0.6);
  }
  log(`  → ${shapes.length} shapes created with progressive bezier reveal`);
  scene.play();
};

(window as any).animGrow = () => {
  scene.clearAll();
  log("Animation: GrowFromCenter");
  const isArcShape = (label: string) => label === "Arc" || label === "Pacman";
  const shapes = buildStandardShapes();
  for (const s of shapes) {
    const center = isArcShape(s.label ?? "") ? boundingBoxCenter(s.points) : geometricCentroid(s.points);
    scene.queueGrow(s, 0.6, center);
    scene.queueWait(0.1);
  }
  scene.play();
};

(window as any).animFade = () => {
  scene.clearAll();
  log("Animation: FadeIn + FadeOut");
  const shapes = buildStandardShapes();
  for (const s of shapes) {
    scene.queueFadeIn(s, 0.8);
  }
  scene.queueWait(1.0);
  for (const s of shapes) {
    scene.queueFadeOut(s, 0.8);
  }
  scene.play();
};

(window as any).animRotate = () => {
  scene.clearAll();
  log("Animation: Rotate — all shapes spinning simultaneously");
  const isArcShape = (label: string) => label === "Arc" || label === "Pacman";
  const shapes = buildStandardShapes();

  // Show fixed center dots — geometric centroid for closed polygons, bounding box for arc
  for (const s of shapes) {
    s.showDot = true;
    s.dotPosition = isArcShape(s.label ?? "")
      ? boundingBoxCenter(s.points)
      : geometricCentroid(s.points);
  }

  // Add all shapes immediately (no grow animation)
  for (const s of shapes) {
    scene.add(s);
  }

  // Rotate all shapes — geometric centroid for polygons, bounding box for arc
  for (let i = 0; i < shapes.length; i++) {
    const direction = i % 2 === 0 ? TAU : -TAU;
    const center = isArcShape(shapes[i].label ?? "")
      ? boundingBoxCenter(shapes[i].points)
      : geometricCentroid(shapes[i].points);
    scene.animQueue.push(() => {
      return { type: "rotate", mob: shapes[i], fullPoints: [...shapes[i].points], startTime: performance.now(), duration: 2.5, done: false, totalAngle: direction, rotateCenter: center };
    });
  }

  log(`  → ${shapes.length} shapes rotating`);
  scene.play();
};

(window as any).animTransform = () => {
  const r = 1.5;
  let firstRun = true;

  function runTransformLoop() {
    scene.clearAll();
    log("Animation: Transform — morph chain (looping)");

    const morphTargets = [
      buildShape(Triangle,       { radius: r,       fillColor: RED,    fillOpacity: 0.5, strokeColor: RED,    strokeOpacity: 1 }),
      buildShape(Square,         { sideLength: r * 2, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 5, radius: r,  fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 6, radius: r,  fillColor: GREEN,  fillOpacity: 0.5, strokeColor: GREEN,  strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 7, radius: r,  fillColor: BLUE,   fillOpacity: 0.5, strokeColor: BLUE,   strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 8, radius: r,  fillColor: TEAL,   fillOpacity: 0.5, strokeColor: TEAL,   strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 10, radius: r, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }),
      buildShape(RegularPolygon, { n: 12, radius: r, fillColor: PINK,   fillOpacity: 0.5, strokeColor: PINK,   strokeOpacity: 1 }),
      buildShape(Circle,         { radius: r,        fillColor: RED,    fillOpacity: 0.5, strokeColor: RED,    strokeOpacity: 1 }),
    ];

    const start = buildShape(Circle, { radius: r, fillColor: RED, fillOpacity: 0.5, strokeColor: RED, strokeOpacity: 1 });

    if (firstRun) {
      scene.queueGrow(start, 0.8);
      scene.queueWait(1.0);
      firstRun = false;
    } else {
      // On loop, start already showing the circle
      scene.add(start);
    }

    for (const target of morphTargets) {
      scene.queueTransform(start, target, 1.5);
      scene.queueWait(0.8);
    }

    scene.onComplete = runTransformLoop;
    scene.play();
  }
  runTransformLoop();
};

(window as any).animSpinIn = () => {
  scene.clearAll();
  log("Animation: SpinInFromNothing — scale + rotate from center");
  const isArcShape = (label: string) => label === "Arc" || label === "Pacman";
  const shapes = buildStandardShapes();
  for (const s of shapes) {
    const center = isArcShape(s.label ?? "") ? boundingBoxCenter(s.points) : geometricCentroid(s.points);
    scene.queueSpinIn(s, 1.0, center);
    scene.queueWait(0.1);
  }
  scene.play();
};

(window as any).animIndicate = () => {
  scene.clearAll();
  log("Animation: Indicate — pulse effect on shapes");
  const shapes = [
    buildShape(Circle,         { radius: 1.0, fillColor: BLUE,   fillOpacity: 0.5, strokeColor: BLUE,   strokeOpacity: 1, _shift: [-4, 0, 0] }, "Circle"),
    buildShape(Square,         { sideLength: 1.8, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1, _shift: [-1.3, 0, 0] }, "Square"),
    buildShape(Triangle,       { radius: 1.0, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [1.3, 0, 0] }, "Triangle"),
    buildShape(RegularPolygon, { n: 6, radius: 1.0, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1, _shift: [4, 0, 0] }, "Hexagon"),
  ];
  // First grow them in
  for (const s of shapes) {
    scene.queueGrow(s, 0.5);
  }
  scene.queueWait(0.3);
  // Then indicate each one
  for (const s of shapes) {
    scene.queueIndicate(s, 0.6, 1.3);
    scene.queueWait(0.2);
  }
  scene.play();
};

(window as any).animShift = () => {
  scene.clearAll();
  log("Animation: Shift — shapes sliding across the screen");
  const circle = buildShape(Circle, { radius: 1.0, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1, _shift: [-5, 1.5, 0] });
  const square = buildShape(Square, { sideLength: 1.8, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1, _shift: [-5, 0, 0] });
  const tri = buildShape(Triangle, { radius: 1.0, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [-5, -1.5, 0] });
  scene.queueGrow(circle, 0.4);
  scene.queueGrow(square, 0.4);
  scene.queueGrow(tri, 0.4);
  scene.queueWait(0.3);
  scene.queueShift(circle, 10, 0, 1.5);
  scene.queueShift(square, 10, 0, 1.5);
  scene.queueShift(tri, 10, 0, 1.5);
  scene.play();
};

(window as any).animSequence = () => {
  scene.clearAll();
  log("Animation: Full sequence — showcasing all animation types");

  // ── Act 1: Create three shapes side by side ──
  const circle = buildShape(Circle, { radius: 1.2, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1, _shift: [-3.5, 0, 0] });
  const square = buildShape(Square, { sideLength: 2.2, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1 });
  const tri    = buildShape(Triangle, { radius: 1.2, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [3.5, 0, 0] });

  scene.queueCreate(circle, 0.8);
  scene.queueGrow(square, 0.8);
  scene.queueCreate(tri, 0.8);

  // ── Act 2: Rotate the square ──
  scene.queueRotate(square, PI / 2, 1.0);

  // ── Act 3: Fade out circle and triangle ──
  scene.queueFadeOut(circle, 0.8);
  scene.queueFadeOut(tri, 0.8);

  // ── Act 4: Morph chain — square morphs through many shapes in place ──
  const morphTargets = [
    buildShape(Circle,         { radius: 1.5,      fillColor: BLUE,   fillOpacity: 0.5, strokeColor: BLUE,   strokeOpacity: 1 }),
    buildShape(Triangle,       { radius: 1.5,      fillColor: RED,    fillOpacity: 0.5, strokeColor: RED,    strokeOpacity: 1 }),
    buildShape(RegularPolygon, { n: 5, radius: 1.4, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }),
    buildShape(RegularPolygon, { n: 6, radius: 1.4, fillColor: TEAL,  fillOpacity: 0.5, strokeColor: TEAL,  strokeOpacity: 1 }),
    buildShape(RegularPolygon, { n: 8, radius: 1.4, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1 }),
    buildShape(RegularPolygon, { n: 12, radius: 1.4, fillColor: PINK, fillOpacity: 0.5, strokeColor: PINK,  strokeOpacity: 1 }),
    buildShape(Circle,         { radius: 1.8,      fillColor: GOLD,   fillOpacity: 0.5, strokeColor: GOLD,   strokeOpacity: 1 }),
  ];

  for (const target of morphTargets) {
    scene.queueTransform(square, target, 1.0);
  }

  // ── Act 5: Rotate the final shape ──
  scene.queueRotate(square, TAU, 1.5);

  // ── Act 6: Shift to the left ──
  scene.queueShift(square, -3, 0, 1.0);

  // ── Act 7: Grow a new shape on the right while the morphed one is still visible ──
  const hexagon = buildShape(RegularPolygon, { n: 6, radius: 1.5, fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1, _shift: [3, 0, 0] });
  scene.queueGrow(hexagon, 0.8);

  // ── Act 8: Rotate the hexagon ──
  scene.queueRotate(hexagon, -PI / 3, 0.8);

  // ── Act 9: Fade everything out ──
  scene.queueFadeOut(hexagon, 1.0);
  scene.queueFadeOut(square, 1.0);

  // ── Act 10: Grand finale — fade in a star, rotate it, fade out ──
  const starVerts: number[][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - PI / 2;
    const r = i % 2 === 0 ? 2.0 : 1.0;
    starVerts.push([r * Math.cos(angle), r * Math.sin(angle), 0]);
  }
  const starMob = new Polygon(starVerts.map(v => np.array(v)), { fillColor: GOLD, fillOpacity: 0.6, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
  const star = extractRenderMobject(starMob, "Star");

  scene.queueGrow(star, 1.0);
  scene.queueRotate(star, TAU, 2.0);
  scene.queueFadeOut(star, 1.2);

  scene.play();
};

// ── COLOR TESTS ──────────────────────────────────────────────

(window as any).testColorPalette = () => {
  scene.clearAll();
  log("Colors: Full Manim palette");

  // 8 palette families as columns, 5 shades as rows (A→E top to bottom)
  const palettes: { name: string; colors: IColor[] }[] = [
    { name: "Red",    colors: [RED_A, RED_B, RED_C, RED_D, RED_E] },
    { name: "Blue",   colors: [BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E] },
    { name: "Green",  colors: [GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E] },
    { name: "Yellow", colors: [YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E] },
    { name: "Purple", colors: [PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E] },
    { name: "Teal",   colors: [TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E] },
    { name: "Gold",   colors: [GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E] },
    { name: "Maroon", colors: [MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E] },
  ];

  // Layout: 8 columns × 5 rows of squares, extras as a row of circles below
  const cols = palettes.length;
  const swatchSize = 0.85;
  const gapX = swatchSize + 0.12;
  const gapY = swatchSize + 0.12;
  const totalW = (cols - 1) * gapX;
  const startX = -totalW / 2;
  const startY = 3.2;

  for (let col = 0; col < cols; col++) {
    const pal = palettes[col];
    for (let row = 0; row < pal.colors.length; row++) {
      const c = pal.colors[row];
      const x = startX + col * gapX;
      const y = startY - row * gapY;
      const mob = buildShape(Square, {
        sideLength: swatchSize,
        fillColor: c,
        fillOpacity: 0.9,
        strokeColor: WHITE,
        strokeOpacity: 0.3,
        strokeWidth: 2,
        _shift: [x, y, 0],
      });
      scene.queueGrow(mob, 0.1);
    }
  }

  // Extra colors as a row of circles at the bottom
  const extras: IColor[] = [PINK, ORANGE, LIGHT_BROWN, DARK_BROWN, WHITE, GRAY_A, GRAY_B, GRAY_C];
  const extrasGap = totalW / (extras.length - 1);
  const extrasY = startY - 5 * gapY - 0.3;
  for (let i = 0; i < extras.length; i++) {
    const x = startX + i * extrasGap;
    const mob = buildShape(Circle, {
      radius: 0.35,
      fillColor: extras[i],
      fillOpacity: 0.9,
      strokeColor: WHITE,
      strokeOpacity: 0.3,
      _shift: [x, extrasY, 0],
    });
    scene.queueGrow(mob, 0.1);
  }

  log(`  → ${cols * 5 + extras.length} color swatches`);
  scene.play();
};

(window as any).testColorGradient = () => {
  scene.clearAll();
  log("Colors: Gradient row (red → blue, 20 steps)");
  const steps = 20;
  const lc = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  function makeGradientRow(from: IColor, to: IColor, y: number) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color: IColor = { r: lc(from.r, to.r, t), g: lc(from.g, to.g, t), b: lc(from.b, to.b, t), a: 1 };
      const x = -6 + (12 * i) / (steps - 1);
      const mob = buildShape(Square, {
        sideLength: 0.55,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: color,
        strokeOpacity: 1,
        _shift: [x, y, 0],
      });
      scene.queueGrow(mob, 0.05);
    }
  }

  // 6 gradient rows: various color transitions
  makeGradientRow(RED, BLUE, 2.8);
  makeGradientRow(RED, YELLOW, 1.8);
  makeGradientRow(YELLOW, GREEN, 0.8);
  makeGradientRow(GREEN, TEAL, -0.2);
  makeGradientRow(BLUE, PURPLE, -1.2);
  makeGradientRow(PURPLE, PINK, -2.2);

  // Rainbow row at the bottom — cycles through all hues
  for (let i = 0; i < steps; i++) {
    const hue = (i / steps) * 360;
    const s = 0.8, l = 0.55;
    // HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x2 = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (hue < 60)       { rr = c; gg = x2; }
    else if (hue < 120) { rr = x2; gg = c; }
    else if (hue < 180) { gg = c; bb = x2; }
    else if (hue < 240) { gg = x2; bb = c; }
    else if (hue < 300) { rr = x2; bb = c; }
    else                { rr = c; bb = x2; }
    const color: IColor = { r: rr + m, g: gg + m, b: bb + m, a: 1 };
    const px = -6 + (12 * i) / (steps - 1);
    const mob = buildShape(Square, {
      sideLength: 0.55,
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: color,
      strokeOpacity: 1,
      _shift: [px, -3.2, 0],
    });
    scene.queueGrow(mob, 0.05);
  }

  scene.play();
};

// ── STRESS TESTS ─────────────────────────────────────────────

function stressTest(count: number): void {
  scene.clearAll();
  log(`Stress: ${count} random shapes`);
  const t0 = performance.now();

  const classes = [Circle, Square, Triangle, RegularPolygon];
  const allColors = [RED, BLUE, GREEN, YELLOW, PURPLE, TEAL, GOLD, ORANGE, PINK, MAROON];

  for (let i = 0; i < count; i++) {
    const Cls = classes[Math.floor(Math.random() * classes.length)];
    const color = allColors[Math.floor(Math.random() * allColors.length)];
    const opts: any = {
      radius: 0.3 + Math.random() * 0.7,
      sideLength: 0.6 + Math.random() * 1.0,
      n: 5 + Math.floor(Math.random() * 4),
      fillColor: color,
      fillOpacity: 0.4 + Math.random() * 0.3,
      strokeColor: color,
      strokeOpacity: 0.8,
      _shift: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, 0],
      _rotate: Math.random() * TAU,
    };
    const mob = buildShape(Cls, opts);
    scene.queueGrow(mob, 0.15);
  }

  const constructMs = (performance.now() - t0).toFixed(1);
  log(`  → ${count} shapes constructed in ${constructMs}ms (engine time)`);
  scene.play();
}

(window as any).stress10 = () => stressTest(10);
(window as any).stress50 = () => stressTest(50);
(window as any).stress100 = () => stressTest(100);

// ── ARROWS & TIPS ───────────────────────────────────────────

(window as any).testArrows = () => {
  scene.clearAll();
  log("Arrows & Tips: Arrow, DoubleArrow, DashedLine, Vector, Elbow");

  try {
    // Row 1: Arrow variants
    const arrow = new Arrow(np.array([-6, 2.5, 0]), np.array([-3, 2.5, 0]), { strokeColor: BLUE, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    const dblArrow = new DoubleArrow(np.array([-2, 2.5, 0]), np.array([1, 2.5, 0]), { strokeColor: GREEN, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    const vector = new Vector(np.array([2, 0, 0]), { strokeColor: RED, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    vector.shift(np.array([2.5, 2.5, 0]));

    // Row 2: DashedLine and Elbow
    const dashedLine = new DashedLine({ start: np.array([-6, 0, 0]), end: np.array([-1, 0, 0]), strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
    const elbow = new Elbow({ width: 1.5, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
    elbow.shift(np.array([2, 0, 0]));

    // Row 3: Arrows with different angles
    const arrow2 = new Arrow(np.array([-5, -2.5, 0]), np.array([-3, -1.5, 0]), { strokeColor: PURPLE, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    const arrow3 = new Arrow(np.array([-1, -2.5, 0]), np.array([1, -1.5, 0]), { strokeColor: ORANGE, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    const arrow4 = new Arrow(np.array([3, -1.5, 0]), np.array([5, -2.5, 0]), { strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;

    // DashedLine explodes into ~30 submobjects (one per dash). Animating each
    // sequentially at 0.4s takes ~12s. Use a tiny per-dash duration so the
    // whole dashed line renders in a fraction of a second.
    const allMobs = [arrow, dblArrow, vector, elbow, arrow2, arrow3, arrow4];
    for (const mob of allMobs) {
      const parts = extractFamily(mob);
      for (const p of parts) scene.queueGrow(p, 0.4);
    }
    const dashParts = extractFamily(dashedLine);
    for (const p of dashParts) scene.queueGrow(p, 0.02);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── ARCS & CURVES ───────────────────────────────────────────

(window as any).testArcsAndCurves = () => {
  scene.clearAll();
  log("Arcs & Curves: Dot, Ellipse, ArcBetweenPoints, Sector, AnnularSector, Annulus");

  try {
    log("  step 1: Dot"); const dot = new Dot({ point: np.array([-5, 2.5, 0]), fillColor: RED, fillOpacity: 1, strokeColor: RED, strokeOpacity: 1, radius: 0.15 }) as VMobject;
    log("  step 2: bigDot"); const bigDot = new Dot({ point: np.array([-3.5, 2.5, 0]), fillColor: BLUE, fillOpacity: 1, strokeColor: BLUE, strokeOpacity: 1, radius: 0.3 }) as VMobject;
    log("  step 3: Ellipse"); const ellipse = new Ellipse({ width: 3, height: 1.5, fillColor: GREEN, fillOpacity: 0.4, strokeColor: GREEN, strokeOpacity: 1 }) as VMobject;
    ellipse.shift(np.array([0, 2.5, 0]));
    log("  step 4: ArcBetweenPoints"); const arcBetween = new ArcBetweenPoints(np.array([3, 3, 0]), np.array([6, 2, 0]), { angle: PI / 3, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    log("  step 5: Sector"); const sector = new Sector({ outerRadius: 1.2, angle: TAU / 3, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }) as VMobject;
    sector.shift(np.array([-4, -0.5, 0]));
    log("  step 6: AnnularSector"); const annSector = new AnnularSector({ innerRadius: 0.5, outerRadius: 1.2, angle: TAU / 4, fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1 }) as VMobject;
    annSector.shift(np.array([0, -0.5, 0]));
    log("  step 7: Annulus"); const annulus = new Annulus({ innerRadius: 0.5, outerRadius: 1.2, fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1 }) as VMobject;
    annulus.shift(np.array([4, -0.5, 0]));

    log("  step 8: CurvedArrow"); const cArrow = new CurvedArrow(np.array([-5, -3, 0]), np.array([-2, -3, 0]), { strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
    log("  step 9: Arc"); const arc1 = new Arc({ radius: 1, angle: TAU * 0.6, startAngle: PI / 6, strokeColor: PINK, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
    arc1.shift(np.array([1, -3, 0]));
    log("  step 10: Arc"); const arc2 = new Arc({ radius: 0.8, angle: TAU * 0.8, strokeColor: MAROON, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;
    arc2.shift(np.array([4.5, -3, 0]));

    const allMobs = [dot, bigDot, ellipse, arcBetween, sector, annSector, annulus, cArrow, arc1, arc2];
    for (const mob of allMobs) {
      const parts = extractFamily(mob);
      for (const p of parts) scene.queueGrow(p, 0.3);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── POLYGRAM EXTRAS ─────────────────────────────────────────

(window as any).testPolygramExtras = () => {
  scene.clearAll();
  log("Polygram extras: Star, Rectangle, RoundedRectangle");

  try {
    // Row 1: Stars with varying points
    const star5 = new Star(5, { outerRadius: 1.0, fillColor: GOLD, fillOpacity: 0.5, strokeColor: GOLD, strokeOpacity: 1 }) as VMobject;
    star5.shift(np.array([-5, 2, 0]));
    const star6 = new Star(6, { outerRadius: 1.0, fillColor: RED, fillOpacity: 0.5, strokeColor: RED, strokeOpacity: 1 }) as VMobject;
    star6.shift(np.array([-2, 2, 0]));
    const star7 = new Star(7, { outerRadius: 1.0, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    star7.shift(np.array([1, 2, 0]));
    const star8 = new Star(8, { outerRadius: 1.0, fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1 }) as VMobject;
    star8.shift(np.array([4, 2, 0]));

    // Row 2: Rectangles
    const rect = new Rectangle({ width: 3, height: 1.5, fillColor: GREEN, fillOpacity: 0.4, strokeColor: GREEN, strokeOpacity: 1 }) as VMobject;
    rect.shift(np.array([-4, -0.5, 0]));
    const roundRect = new RoundedRectangle({ width: 3, height: 1.5, cornerRadius: 0.3, fillColor: TEAL, fillOpacity: 0.4, strokeColor: TEAL, strokeOpacity: 1 }) as VMobject;
    roundRect.shift(np.array([0, -0.5, 0]));
    const tallRect = new Rectangle({ width: 1, height: 3, fillColor: ORANGE, fillOpacity: 0.4, strokeColor: ORANGE, strokeOpacity: 1 }) as VMobject;
    tallRect.shift(np.array([4, -0.5, 0]));

    // Row 3: More stars
    const star10 = new Star(10, { outerRadius: 1.2, fillColor: PINK, fillOpacity: 0.5, strokeColor: PINK, strokeOpacity: 1 }) as VMobject;
    star10.shift(np.array([-3, -3, 0]));
    const star12 = new Star(12, { outerRadius: 1.2, fillColor: MAROON, fillOpacity: 0.5, strokeColor: MAROON, strokeOpacity: 1 }) as VMobject;
    star12.shift(np.array([3, -3, 0]));

    const allMobs = [star5, star6, star7, star8, rect, roundRect, tallRect, star10, star12];
    for (const mob of allMobs) {
      const r = extractRenderMobject(mob);
      scene.queueGrow(r, 0.3);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── BOOLEAN OPS ─────────────────────────────────────────────

(window as any).testBooleanOps = () => {
  scene.clearAll();
  log("Boolean Ops: Union, Intersection, Difference, Exclusion");

  try {
    // Boolean results inherit world-space points from their inputs.
    // Position the INPUT shapes where you want the result to appear —
    // do NOT shift the result afterward (that double-offsets it offscreen).
    const twoCircles = (cx: number, cy: number, sep: number) => {
      const a = new Circle({ radius: 1.0, fillColor: BLUE, fillOpacity: 0.3, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
      a.shift(np.array([cx - sep, cy, 0]));
      const b = new Circle({ radius: 1.0, fillColor: RED, fillOpacity: 0.3, strokeColor: RED, strokeOpacity: 1 }) as VMobject;
      b.shift(np.array([cx + sep, cy, 0]));
      return [a, b] as const;
    };

    // Row 1: Union, Intersection, Difference, Exclusion
    const [ua, ub] = twoCircles(-5, 2, 0.5);
    const u = new Union(ua, ub, { fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const [ia, ib] = twoCircles(-1.5, 2, 0.6);
    const inter = new Intersection(ia, ib, { fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const dCirc = new Circle({ radius: 1.0, fillColor: BLUE, fillOpacity: 0.3, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    dCirc.shift(np.array([2, 2, 0]));
    const dSq = new Square({ sideLength: 1.4, fillColor: RED, fillOpacity: 0.3, strokeColor: RED, strokeOpacity: 1 }) as VMobject;
    dSq.shift(np.array([2.5, 2.3, 0]));
    const diff = new Difference(dCirc, dSq, { fillColor: PURPLE, fillOpacity: 0.5, strokeColor: PURPLE, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const [ea, eb] = twoCircles(5.5, 2, 0.5);
    const excl = new Exclusion(ea, eb, { fillColor: TEAL, fillOpacity: 0.5, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    // Row 2: Triangle - Circle, and two overlapping squares intersected
    const triMob = new Triangle({ radius: 1.2, fillColor: ORANGE, fillOpacity: 0.3, strokeColor: ORANGE, strokeOpacity: 1 }) as VMobject;
    triMob.shift(np.array([-3, -2, 0]));
    const circOverTri = new Circle({ radius: 0.7, fillColor: BLUE, fillOpacity: 0.3, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    circOverTri.shift(np.array([-3, -1.7, 0]));
    const triDiff = new Difference(triMob, circOverTri, { fillColor: ORANGE, fillOpacity: 0.5, strokeColor: ORANGE, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const sq1 = new Square({ sideLength: 1.6, fillColor: RED, fillOpacity: 0.3, strokeColor: RED, strokeOpacity: 1 }) as VMobject;
    sq1.shift(np.array([3, -2, 0]));
    const sq2 = new Square({ sideLength: 1.6, fillColor: BLUE, fillOpacity: 0.3, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    sq2.shift(np.array([3.6, -1.5, 0]));
    const sqInter = new Intersection(sq1, sq2, { fillColor: GOLD, fillOpacity: 0.6, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const allMobs = [u, inter, diff, excl, triDiff, sqInter];
    for (const mob of allMobs) {
      const parts = extractFamily(mob);
      for (const p of parts) scene.queueGrow(p, 0.5);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── SHAPE MATCHERS ──────────────────────────────────────────

(window as any).testShapeMatchers = () => {
  scene.clearAll();
  log("Shape Matchers: SurroundingRectangle, BackgroundRectangle, Cross, Underline");

  try {
    // Create target shapes
    const circle = new Circle({ radius: 0.8, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    circle.shift(np.array([-4, 2, 0]));
    const square = new Square({ sideLength: 1.5, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1 }) as VMobject;
    square.shift(np.array([0, 2, 0]));
    const tri = new Triangle({ radius: 0.8, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1 }) as VMobject;
    tri.shift(np.array([4, 2, 0]));

    // SurroundingRectangle around each
    const sr1 = new SurroundingRectangle(circle, { buff: 0.2, strokeColor: RED, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;
    const sr2 = new SurroundingRectangle(square, { buff: 0.3, strokeColor: PURPLE, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    // Cross over triangle
    const cross = new Cross(tri, { strokeColor: RED, strokeOpacity: 1, strokeWidth: 4 }) as VMobject;

    // Underline under square
    const underline = new Underline(square, { buff: 0.15, strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    // BackgroundRectangle
    const hexagon = new RegularPolygon(6, { radius: 1, fillColor: ORANGE, fillOpacity: 0.7, strokeColor: ORANGE, strokeOpacity: 1 }) as VMobject;
    hexagon.shift(np.array([-2, -2, 0]));
    const bg = new BackgroundRectangle(hexagon, { fillOpacity: 0.3, buff: 0.3, fillColor: GRAY_D }) as VMobject;

    const pentagon = new RegularPolygon(5, { radius: 1, fillColor: PINK, fillOpacity: 0.5, strokeColor: PINK, strokeOpacity: 1 }) as VMobject;
    pentagon.shift(np.array([3, -2, 0]));
    const sr3 = new SurroundingRectangle(pentagon, { buff: 0.2, strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 }) as VMobject;

    const allMobs = [circle, sr1, square, sr2, underline, tri, cross, bg, hexagon, pentagon, sr3];
    for (const mob of allMobs) {
      const parts = extractFamily(mob);
      for (const p of parts) scene.queueGrow(p, 0.3);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── BRACES ──────────────────────────────────────────────────

(window as any).testBraces = () => {
  scene.clearAll();
  log("Braces: Brace, BraceBetweenPoints");

  try {
    // Create shapes to put braces around
    const rect = new Rectangle({ width: 4, height: 2, fillColor: BLUE, fillOpacity: 0.3, strokeColor: BLUE, strokeOpacity: 1 }) as VMobject;
    rect.shift(np.array([-2, 1.5, 0]));

    // Brace below the rectangle
    const braceDown = new Brace(rect, DOWN, { fillOpacity: 1 }) as unknown as VMobject;

    // Brace to the right
    const braceRight = new Brace(rect, RIGHT, { fillOpacity: 1 }) as unknown as VMobject;

    const square = new Square({ sideLength: 2, fillColor: RED, fillOpacity: 0.3, strokeColor: RED, strokeOpacity: 1 }) as VMobject;
    square.shift(np.array([4, 1.5, 0]));

    // Brace above the square
    const braceUp = new Brace(square, UP, { fillOpacity: 1 }) as unknown as VMobject;

    // BraceBetweenPoints
    const brace2 = new BraceBetweenPoints(np.array([-5, -2, 0]), np.array([5, -2, 0]), ORIGIN, { fillOpacity: 1 }) as unknown as VMobject;

    const brace3 = new BraceBetweenPoints(np.array([-3, -3, 0]), np.array([3, -3, 0]), ORIGIN, { fillOpacity: 1 }) as unknown as VMobject;

    const allMobs = [rect, braceDown, braceRight, square, braceUp, brace2, brace3];
    for (const mob of allMobs) {
      const parts = extractFamily(mob);
      for (const p of parts) scene.queueGrow(p, 0.3);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── GRAPHING ────────────────────────────────────────────────

(window as any).testNumberLine = () => {
  scene.clearAll();
  log("Graphing: NumberLine");

  try {
    const nl = new NumberLine({
      xRange: [-5, 5, 1],
      length: 12,
      strokeColor: WHITE,
      strokeOpacity: 1,
      strokeWidth: 2,
      includeTip: true,
      includeNumbers: false,
    }) as VMobject;

    const parts = extractFamily(nl);
    for (const p of parts) scene.queueGrow(p, 0.2);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

(window as any).testAxes = () => {
  scene.clearAll();
  log("Graphing: Axes");

  try {
    const axes = new Axes({
      xRange: [-3, 3, 1],
      yRange: [-2, 2, 1],
      xLength: 10,
      yLength: 6,
      tips: true,
    }) as unknown as VMobject;

    const parts = extractFamily(axes);
    log(`  → Axes produced ${parts.length} sub-shapes`);
    for (const p of parts) scene.queueGrow(p, 0.1);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

(window as any).testFunctionGraph = () => {
  scene.clearAll();
  log("Graphing: FunctionGraph (sin, cos, parabola)");

  try {
    // Sin wave
    const sinGraph = new ParametricFunction(
      (t: number) => [t, Math.sin(t), 0],
      { tRange: [-PI * 2, PI * 2, 0.05], strokeColor: BLUE, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;
    sinGraph.scale(0.8);

    // Cos wave
    const cosGraph = new ParametricFunction(
      (t: number) => [t, Math.cos(t), 0],
      { tRange: [-PI * 2, PI * 2, 0.05], strokeColor: RED, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;
    cosGraph.scale(0.8);

    // Parabola
    const parabola = new ParametricFunction(
      (t: number) => [t, t * t / 4 - 2, 0],
      { tRange: [-3, 3, 0.05], strokeColor: GREEN, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;

    const allMobs = [sinGraph, cosGraph, parabola];
    for (const mob of allMobs) {
      const r = extractRenderMobject(mob);
      scene.queueCreate(r, 1.0);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

(window as any).testParametricCurves = () => {
  scene.clearAll();
  log("Graphing: Parametric curves (Lissajous, spiral, cardioid)");

  try {
    // Lissajous curve
    const lissajous = new ParametricFunction(
      (t: number) => [3 * Math.sin(3 * t), 2 * Math.cos(2 * t), 0],
      { tRange: [0, TAU, 0.01], strokeColor: GOLD, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;
    lissajous.shift(np.array([-4, 0, 0]));

    // Spiral
    const spiral = new ParametricFunction(
      (t: number) => [t * 0.3 * Math.cos(t * 3), t * 0.3 * Math.sin(t * 3), 0],
      { tRange: [0, TAU, 0.01], strokeColor: TEAL, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;
    spiral.shift(np.array([0, 0, 0]));

    // Rose curve (r = cos(3θ))
    const rose = new ParametricFunction(
      (t: number) => [2 * Math.cos(3 * t) * Math.cos(t), 2 * Math.cos(3 * t) * Math.sin(t), 0],
      { tRange: [0, TAU, 0.01], strokeColor: PINK, strokeOpacity: 1, strokeWidth: 3 },
    ) as VMobject;
    rose.shift(np.array([4.5, 0, 0]));

    const allMobs = [lissajous, spiral, rose];
    for (const mob of allMobs) {
      const r = extractRenderMobject(mob);
      scene.queueCreate(r, 1.2);
    }
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── 3D SHAPES (projected flat) ──────────────────────────────

(window as any).test3DShapes = () => {
  scene.clearAll();
  log("3D Shapes: Sphere, Cube, Cone, Cylinder, Torus (projected to 2D)");

  try {
    const shapes: VMobject[] = [];

    const sphere = new Sphere({ radius: 1.2 }) as unknown as VMobject;
    sphere.shift(np.array([-5, 1.5, 0]));
    shapes.push(sphere);

    const cube = new Cube({ sideLength: 1.8 }) as unknown as VMobject;
    cube.shift(np.array([-1.5, 1.5, 0]));
    shapes.push(cube);

    const cone = new Cone({ baseRadius: 1.0, height: 2.0 }) as unknown as VMobject;
    cone.shift(np.array([2, 1.5, 0]));
    shapes.push(cone);

    const cyl = new Cylinder({ radius: 0.8, height: 2.0 }) as unknown as VMobject;
    cyl.shift(np.array([5, 1.5, 0]));
    shapes.push(cyl);

    const torus = new Torus({ majorRadius: 1.2, minorRadius: 0.4 }) as unknown as VMobject;
    torus.shift(np.array([-3, -2, 0]));
    shapes.push(torus);

    let total = 0;
    for (const mob of shapes) {
      const parts = extractFamily(mob);
      total += parts.length;
      for (const p of parts) {
        // Flatten Z coordinates for 2D display
        p.points = p.points.map(([x, y, _z]) => [x, y, 0] as Point3);
        scene.add(p);
      }
    }
    log(`  → ${shapes.length} 3D shapes → ${total} sub-surfaces`);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

(window as any).testPolyhedra = () => {
  scene.clearAll();
  log("3D Polyhedra: Tetrahedron, Octahedron, Icosahedron, Dodecahedron");

  try {
    const shapes: [any, string, number[]][] = [
      [Tetrahedron, "Tetrahedron", [-5, 0, 0]],
      [Octahedron, "Octahedron", [-1.5, 0, 0]],
      [Icosahedron, "Icosahedron", [2, 0, 0]],
      [Dodecahedron, "Dodecahedron", [5.5, 0, 0]],
    ];

    let total = 0;
    for (const [Cls, name, pos] of shapes) {
      try {
        const mob = new Cls() as unknown as VMobject;
        mob.shift(np.array(pos));
        const parts = extractFamily(mob);
        total += parts.length;
        for (const p of parts) {
          p.points = p.points.map(([x, y, _z]) => [x, y, 0] as Point3);
          scene.add(p);
        }
      } catch (e) {
        log(`  ${name}: ${e}`);
      }
    }
    log(`  → ${total} total faces rendered`);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── GRAPH THEORY ────────────────────────────────────────────

// NOTE: The engine's Graph/DiGraph classes in src/mobject/graph/ use stub
// Dot/Line classes (empty no-op setPointsByEnds) because their real-geometry
// dependencies haven't been wired in. That means calling `new Graph(...)` here
// produces zero-geometry submobjects. Until the graph module is un-stubbed,
// we render the graph visualization manually using the real Circle + Line
// classes, positioned via a local circular layout.
function layoutCircular(n: number, scale: number): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n + PI / 2; // top-first, CCW
    coords.push([scale * Math.cos(a), scale * Math.sin(a)]);
  }
  return coords;
}

(window as any).testGraph = () => {
  scene.clearAll();
  log("Graph Theory: Graph with vertices and edges");

  try {
    const vertices = [1, 2, 3, 4, 5, 6];
    const edgePairs: [number, number][] = [
      [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [2, 5],
    ];
    const coords = layoutCircular(vertices.length, 2.5);
    const pos = new Map<number, [number, number]>();
    vertices.forEach((v, i) => pos.set(v, coords[i]));

    // Edges first so vertices draw on top
    for (const [u, v] of edgePairs) {
      const [x1, y1] = pos.get(u)!;
      const [x2, y2] = pos.get(v)!;
      const line = new Line(
        np.array([x1, y1, 0]),
        np.array([x2, y2, 0]),
        { strokeColor: GRAY_B, strokeOpacity: 1, strokeWidth: 2 },
      ) as VMobject;
      const parts = extractFamily(line);
      for (const p of parts) scene.queueGrow(p, 0.08);
    }
    for (const v of vertices) {
      const [x, y] = pos.get(v)!;
      const dot = new Circle({ radius: 0.2, fillColor: BLUE, fillOpacity: 1, strokeColor: WHITE, strokeOpacity: 1, strokeWidth: 2 }) as VMobject;
      dot.shift(np.array([x, y, 0]));
      const parts = extractFamily(dot);
      for (const p of parts) scene.queueGrow(p, 0.1);
    }
    log(`  → Graph: ${vertices.length} vertices, ${edgePairs.length} edges (rendered manually)`);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

(window as any).testDiGraph = () => {
  scene.clearAll();
  log("Graph Theory: DiGraph (directed graph)");

  try {
    const vertices = [1, 2, 3, 4, 5];
    const edgePairs: [number, number][] = [
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [1, 3], [2, 4],
    ];
    const coords = layoutCircular(vertices.length, 2.5);
    const pos = new Map<number, [number, number]>();
    vertices.forEach((v, i) => pos.set(v, coords[i]));

    // Directed edges rendered as Arrows, shortened slightly so the arrowhead
    // lands on the target vertex's boundary instead of its center.
    const vertexRadius = 0.22;
    for (const [u, v] of edgePairs) {
      const [x1, y1] = pos.get(u)!;
      const [x2, y2] = pos.get(v)!;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const arr = new Arrow(
        np.array([x1 + ux * vertexRadius, y1 + uy * vertexRadius, 0]),
        np.array([x2 - ux * vertexRadius, y2 - uy * vertexRadius, 0]),
        { strokeColor: GRAY_B, strokeOpacity: 1, strokeWidth: 2, buff: 0 },
      ) as VMobject;
      const parts = extractFamily(arr);
      for (const p of parts) scene.queueGrow(p, 0.08);
    }
    for (const v of vertices) {
      const [x, y] = pos.get(v)!;
      const dot = new Circle({ radius: vertexRadius, fillColor: GREEN, fillOpacity: 1, strokeColor: WHITE, strokeOpacity: 1, strokeWidth: 2 }) as VMobject;
      dot.shift(np.array([x, y, 0]));
      const parts = extractFamily(dot);
      for (const p of parts) scene.queueGrow(p, 0.1);
    }
    log(`  → DiGraph: ${vertices.length} vertices, ${edgePairs.length} arrows (rendered manually)`);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── VECTOR FIELDS ───────────────────────────────────────────

(window as any).testVectorField = () => {
  scene.clearAll();
  log("Vector Field: ArrowVectorField");

  try {
    const field = new ArrowVectorField(
      (pos) => np.array([Math.sin(Number(pos.get([1]))), Math.cos(Number(pos.get([0]))), 0]),
      {
        xRange: [-5, 5, 1],
        yRange: [-3, 3, 1],
        opacity: 0.8,
      },
    ) as unknown as VMobject;

    const parts = extractFamily(field);
    log(`  → ${parts.length} arrows in vector field`);
    for (const p of parts) scene.add(p);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── VALUE TRACKER ───────────────────────────────────────────

(window as any).testValueTracker = () => {
  scene.clearAll();
  log("ValueTracker: demonstrates parameter tracking");

  try {
    const tracker = new ValueTracker({ value: 0 });
    log(`  Initial value: ${tracker.getValue()}`);
    tracker.setValue(5);
    log(`  After setValue(5): ${tracker.getValue()}`);
    tracker.incrementValue(3);
    log(`  After incrementValue(3): ${tracker.getValue()}`);

    // Show a visual representation: circle whose radius tracks the value
    const radii = [0.5, 1.0, 1.5, 2.0, 2.5];
    const colors = [BLUE, GREEN, YELLOW, ORANGE, RED];
    for (let i = 0; i < radii.length; i++) {
      tracker.setValue(radii[i]);
      const c = new Circle({ radius: tracker.getValue(), fillColor: colors[i], fillOpacity: 0.3, strokeColor: colors[i], strokeOpacity: 1 }) as VMobject;
      const r = extractRenderMobject(c, `r=${radii[i]}`);
      scene.queueGrow(r, 0.4);
    }
    scene.play();
    log(`  ValueTracker working correctly — concentric circles from tracked values`);
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
};

// ── Clear ────────────────────────────────────────────────────

(window as any).clearScene = () => {
  scene.clearAll();
  log("Scene cleared");
};

// ── Initial demo on load ─────────────────────────────────────

log("manim-ts engine loaded — ready to test");
log("Click any button above to test engine functionality");

// Quick initial animation to show it works
const initCircle = buildShape(Circle, { radius: 1.5, fillColor: BLUE, fillOpacity: 0.5, strokeColor: BLUE, strokeOpacity: 1, _shift: [-3, 0, 0] });
const initSquare = buildShape(Square, { sideLength: 2.5, fillColor: GREEN, fillOpacity: 0.5, strokeColor: GREEN, strokeOpacity: 1 });
const initTriangle = buildShape(Triangle, { radius: 1.5, fillColor: YELLOW, fillOpacity: 0.5, strokeColor: YELLOW, strokeOpacity: 1, _shift: [3, -0.375, 0] });

scene.queueCreate(initCircle, 1.2);
scene.queueWait(0.2);
scene.queueGrow(initSquare, 1.0);
scene.queueWait(0.2);
scene.queueCreate(initTriangle, 1.2);
scene.play();
