/**
 * Browser demo — COMPREHENSIVE engine test.
 *
 * Uses the REAL manim-ts engine classes to construct geometry.
 * Rendering is done via ThreeScene (three.js WebGL backend) instead of Canvas2D.
 * Animation state is tracked in plain Point3[] arrays (zero numpy-ts overhead
 * in the hot path), synced back to backing VMobjects before each render frame.
 *
 * Tests: all geometry, transforms, animations, colors, and stress.
 */

import { Circle, Square, Triangle, RegularPolygon, Line, Arc, Polygon } from "../src/mobject/geometry/index.js";
import { np, TAU, PI, UP, DOWN, LEFT, RIGHT, ORIGIN, DEGREES } from "../src/core/math/index.js";
import { ThreeBackend } from "../src/renderer/three/three_backend.js";
import { CairoBackend } from "../src/renderer/cairo/cairo_backend.js";
import { ThreeDCamera } from "../src/camera/three_d_camera/index.js";
import {
  makeOrthoCamera,
  makePerspectiveCamera,
  applyPhiTheta,
} from "../src/renderer/three/three_camera.js";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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

// KaTeX (for equation rendering in the Text tab)
import katex from "katex";
import "katex/dist/katex.min.css";

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
  vmob: VMobject;        // backing engine object (rendered via ThreeScene)
  points: Point3[];
  fillColor: IColor;
  fillOpacity: number;
  strokeColor: IColor;
  strokeOpacity: number;
  strokeWidth: number;
  center: Point3;
  label?: string;
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
    vmob: mob,
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
 * Sync a RenderMobject's current animation state back into its backing VMobject
 * so ThreeScene can render the updated geometry and style.
 */
function syncRenderMobToVMob(mob: RenderMobject): void {
  const vm = mob.vmob;
  // Sync points (NDArray ← plain array)
  if (mob.points.length === 0) {
    vm.points = np.zeros([0, 3]);
  } else {
    vm.points = np.array(mob.points);
  }
  // Sync style
  vm.fillColor = mob.fillColor;
  vm.fillOpacity = mob.fillOpacity;
  vm.strokeColor = mob.strokeColor;
  vm.strokeOpacity = mob.strokeOpacity;
  vm.strokeWidth = mob.strokeWidth;
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
        // Create a synthetic VMobject for this subpath so ThreeScene can render it.
        const spVmob = new VMobject({
          fillColor: mob.fillColor,
          fillOpacity: mob.fillOpacity,
          strokeColor: mob.strokeColor,
          strokeOpacity: mob.strokeOpacity,
          strokeWidth: mob.strokeWidth,
        });
        spVmob.points = np.array(spPoints);
        results.push({
          vmob: spVmob,
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

const FRAME_WIDTH = 14.222222222222221;
const FRAME_HEIGHT = 8;

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

type RendererMode = "opengl" | "cairo";

const BG_COLOR = { r: 0x1d / 255, g: 0x1f / 255, b: 0x2c / 255, a: 1 };

class DemoScene {
  private _backend: ThreeBackend | CairoBackend;
  private _mode: RendererMode;
  private _canvas: HTMLCanvasElement;
  private _orbit: OrbitControls | null = null;
  private _wants3D = false;
  private _phi3D = (75 * Math.PI) / 180;
  private _theta3D = (-30 * Math.PI) / 180;

  private mobjects: RenderMobject[] = [];
  private animQueue: (() => AnimState)[] = [];
  private activeAnim: AnimState | null = null;
  private running = false;
  onComplete: (() => void) | null = null;

  constructor(canvasId: string, mode: RendererMode = "cairo") {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this._canvas = canvas;
    this._mode = mode;
    this._backend = this._buildBackend(mode);
    this.renderFrame();
  }

  get mode(): RendererMode { return this._mode; }

  private _buildBackend(mode: RendererMode): ThreeBackend | CairoBackend {
    if (mode === "opengl") {
      const b = new ThreeBackend({ canvas: this._canvas });
      b.threeScene.background = new THREE.Color(0x1d1f2c);
      return b;
    }
    const b = new CairoBackend({ canvas: this._canvas });
    b.setBackgroundColor(BG_COLOR);
    b.resize(this._canvas.width, this._canvas.height);
    return b;
  }

  /** Swap renderers at runtime. Preserves mobjects and re-renders. */
  setRendererMode(mode: RendererMode): void {
    if (mode === this._mode) return;
    if (this._orbit) { this._orbit.dispose(); this._orbit = null; }
    this._backend.dispose();
    // A canvas that already has a WebGL context cannot hand out a 2D context
    // (and vice versa). Replace the element with a fresh clone so the new
    // backend can claim the context type it needs.
    const old = this._canvas;
    const fresh = document.createElement("canvas");
    fresh.id = old.id;
    fresh.width = old.width;
    fresh.height = old.height;
    fresh.className = old.className;
    fresh.style.cssText = old.style.cssText;
    old.parentNode!.replaceChild(fresh, old);
    this._canvas = fresh;
    this._mode = mode;
    this._backend = this._buildBackend(mode);
    for (const m of this.mobjects) this._backend.addMobject(m.vmob);
    if (this._wants3D) this.setPerspective3D(this._phi3D, this._theta3D);
    this.renderFrame();
  }

  add(mob: RenderMobject): void {
    if (!this.mobjects.includes(mob)) {
      this.mobjects.push(mob);
      this._backend.addMobject(mob.vmob);
    }
  }

  remove(mob: RenderMobject): void {
    const idx = this.mobjects.indexOf(mob);
    if (idx >= 0) {
      this.mobjects.splice(idx, 1);
      this._backend.removeMobject(mob.vmob);
    }
  }

  clearAll(): void {
    for (const m of this.mobjects) this._backend.removeMobject(m.vmob);
    this.mobjects = [];
    this.animQueue = [];
    this.activeAnim = null;
    this.running = false;
    this.onComplete = null;
    this._wants3D = false;
    this.renderFrame();
  }

  /**
   * Swap the ThreeScene camera to a tilted PerspectiveCamera for 3D demos,
   * so Sphere/Cube/Cone/Cylinder/Torus render with actual depth instead of
   * being projected flat. Uses Manim's ThreeDCamera default phi/theta.
   */
  setPerspective3D(phi: number = (75 * Math.PI) / 180, theta: number = (-30 * Math.PI) / 180): void {
    this._wants3D = true;
    this._phi3D = phi;
    this._theta3D = theta;
    if (this._mode !== "opengl") {
      // Cairo backend: install a ThreeDCamera so sub-surfaces are depth-sorted
      // back-to-front (matches ManimCE Cairo + ThreeDCamera pipeline).
      const cairo = this._backend as CairoBackend;
      const cam3d = new ThreeDCamera({
        phi,
        theta,
        frameWidth: 14.222,
        frameHeight: 8.0,
        pixelWidth: this._canvas.width,
        pixelHeight: this._canvas.height,
      });
      cairo.setCamera(cam3d);
      return;
    }
    const three = this._backend as ThreeBackend;
    // Orthographic camera with a phi/theta viewing direction: objects at
    // different XY positions stay the same size (no foreshortening), while
    // still showing 3D faces. Matches Manim's default ThreeDCamera, which
    // also uses orthographic projection.
    const cam = makeOrthoCamera(14.222, 8.0);
    applyPhiTheta(cam, phi, theta, 10);
    three.threeRenderer.setCamera(cam);

    if (this._orbit) this._orbit.dispose();
    this._orbit = new OrbitControls(cam, this._canvas);
    this._orbit.target.set(0, 0, 0);
    this._orbit.enableDamping = false;
    this._orbit.addEventListener("change", () => this.renderFrame());
    this._orbit.update();
  }

  /** Restore the default 2D OrthographicCamera (for flat demos). */
  setOrtho2D(): void {
    this._wants3D = false;
    if (this._orbit) { this._orbit.dispose(); this._orbit = null; }
    if (this._mode !== "opengl") return;
    const three = this._backend as ThreeBackend;
    const cam = makeOrthoCamera(14.222, 8.0);
    three.threeRenderer.setCamera(cam);
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
    // Invisible placeholder VMobject — not added to scene, just drives the timer.
    const waitVmob = new VMobject({ fillOpacity: 0, strokeOpacity: 0, strokeWidth: 0 });
    this.animQueue.push(() => {
      const mob: RenderMobject = { vmob: waitVmob, points: [], fillColor: WHITE, fillOpacity: 0, strokeColor: WHITE, strokeOpacity: 0, strokeWidth: 0, center: [0, 0, 0] };
      return { type: "create", mob, fullPoints: [], startTime: performance.now(), duration, done: false };
    });
  }

  play(): void {
    if (this.running) return;
    // Nothing to animate → render a single frame and bail (no RAF loop).
    // Prevents the scene from burning CPU re-rendering static content,
    // which is especially bad for Cairo 3D (projectPoints per sphere quad).
    if (this.animQueue.length === 0) {
      this.renderFrame();
      if (this.onComplete) this.onComplete();
      return;
    }
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
    // Sync each RenderMobject's animation state back to its backing VMobject.
    for (const mob of this.mobjects) {
      syncRenderMobToVMob(mob);
    }
    // Sync + render through the active backend (three.js or Canvas2D).
    this._backend.sync();
    this._backend.render();
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

(window as any).setRendererMode = (mode: "opengl" | "cairo") => {
  scene.setRendererMode(mode);
  log(`Renderer: ${mode === "opengl" ? "three.js (OpenGL)" : "Canvas2D (Cairo)"}`);
};
(window as any).getRendererMode = () => scene.mode;

// Ensure the text overlay is cleared whenever the scene is cleared, so
// switching between Text-tab demos and non-text demos doesn't leave stale
// HTML on top of the canvas.
{
  const originalClearAll = scene.clearAll.bind(scene);
  scene.clearAll = () => {
    originalClearAll();
    clearTextOverlay();
    // Reset to 2D camera by default; 3D demos reinstate a perspective camera.
    scene.setOrtho2D();
  };
}

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

// ── 3D SHAPES (one per button) ──────────────────────────────

function show3DShape(label: string, build: () => VMobject): void {
  scene.clearAll();
  scene.setPerspective3D();
  log(`3D: ${label} (4 orientations)`);
  try {
    // 2×2 grid: each cell shows the same shape rotated differently so the
    // viewer gets a full-geometry intuition without needing to orbit.
    const cells: Array<{ pos: [number, number, number]; rot: () => void }> = [
      { pos: [-3.2,  1.8, 0], rot: () => {} },
      { pos: [ 3.2,  1.8, 0], rot: () => {} },
      { pos: [-3.2, -1.8, 0], rot: () => {} },
      { pos: [ 3.2, -1.8, 0], rot: () => {} },
    ];
    // Four distinct view rotations applied to shape #2..4 (shape #1 is identity).
    const rotations: Array<[number, [number, number, number]]> = [
      [0, [0, 1, 0]],
      [Math.PI / 2, [0, 1, 0]],                // quarter-turn about Y
      [Math.PI / 2, [1, 0, 0]],                // quarter-turn about X
      [Math.PI / 3, [1, 1, 0]],                // oblique tilt
    ];
    let totalParts = 0;
    for (let i = 0; i < 4; i++) {
      const mob = build();
      mob.scale(0.55);
      const [angle, axis] = rotations[i];
      if (angle !== 0) mob.rotate(angle, np.array(axis));
      mob.shift(np.array(cells[i].pos));
      const parts = extractFamily(mob);
      for (const p of parts) scene.add(p);
      totalParts += parts.length;
    }
    log(`  → 4× shapes, ${totalParts} sub-surfaces total`);
    scene.play();
  } catch (e) {
    log(`  ERROR: ${e}`);
  }
}

(window as any).testSphere = () => show3DShape("Sphere",
  () => new Sphere({ radius: 1.5, resolution: [16, 16] }) as unknown as VMobject);

(window as any).testCube = () => show3DShape("Cube",
  () => new Cube({ sideLength: 2.0 }) as unknown as VMobject);

(window as any).testCone = () => show3DShape("Cone",
  () => new Cone({ baseRadius: 1.2, height: 2.4, resolution: [16, 8] }) as unknown as VMobject);

(window as any).testCylinder = () => show3DShape("Cylinder",
  () => new Cylinder({ radius: 1.0, height: 2.4, resolution: [16, 8] }) as unknown as VMobject);

(window as any).testTorus = () => show3DShape("Torus",
  () => new Torus({ majorRadius: 1.4, minorRadius: 0.45, resolution: [16, 10] }) as unknown as VMobject);

(window as any).testTetrahedron = () => show3DShape("Tetrahedron",
  () => new Tetrahedron() as unknown as VMobject);

(window as any).testOctahedron = () => show3DShape("Octahedron",
  () => new Octahedron() as unknown as VMobject);

(window as any).testIcosahedron = () => show3DShape("Icosahedron",
  () => new Icosahedron() as unknown as VMobject);

(window as any).testDodecahedron = () => show3DShape("Dodecahedron",
  () => new Dodecahedron() as unknown as VMobject);

// ── TEXT & EQUATIONS (HTML overlay + KaTeX) ─────────────────
//
// The engine's Text/MathTex classes currently have no SVG rendering backend in
// the browser (Python Manim uses Pango + pdflatex+dvisvgm). For the demo we
// overlay HTML elements on top of the canvas, positioned in scene coordinates.
// Plain text uses native CSS; equations are rendered by KaTeX. This is
// separate from the engine — it's purely a presentation layer for the demo.

const textOverlay = document.getElementById("text-overlay")!;

/** Scene (x, y) → % coords inside the canvas-wrap box. */
function sceneToPercent(x: number, y: number): { left: string; top: string } {
  return {
    left: `${50 + (x / FRAME_WIDTH) * 100}%`,
    top: `${50 - (y / FRAME_HEIGHT) * 100}%`,
  };
}

interface TextOpts {
  size?: number;          // CSS px
  color?: string;         // CSS color
  weight?: string;        // CSS font-weight
  italic?: boolean;
  font?: string;          // CSS font-family (overrides default)
  align?: "center" | "left" | "right";
}

function clearTextOverlay(): void {
  textOverlay.innerHTML = "";
}

function addText(content: string, x: number, y: number, opts: TextOpts = {}): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "text-el" + (opts.align && opts.align !== "center" ? " " + opts.align : "");
  el.textContent = content;
  const { left, top } = sceneToPercent(x, y);
  el.style.left = left;
  el.style.top = top;
  if (opts.size !== undefined) el.style.fontSize = `${opts.size}px`;
  if (opts.color) el.style.color = opts.color;
  if (opts.weight) el.style.fontWeight = opts.weight;
  if (opts.italic) el.style.fontStyle = "italic";
  if (opts.font) el.style.fontFamily = opts.font;
  textOverlay.appendChild(el);
  return el;
}

function addTex(tex: string, x: number, y: number, opts: TextOpts = {}): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "text-el" + (opts.align && opts.align !== "center" ? " " + opts.align : "");
  try {
    el.innerHTML = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: false,
      output: "html",
    });
  } catch (e) {
    el.textContent = tex;
  }
  const { left, top } = sceneToPercent(x, y);
  el.style.left = left;
  el.style.top = top;
  if (opts.size !== undefined) el.style.fontSize = `${opts.size}px`;
  if (opts.color) el.style.color = opts.color;
  textOverlay.appendChild(el);
  return el;
}

function beginTextDemo(title: string): void {
  scene.clearAll();
  clearTextOverlay();
  log(title);
}

// ── Plain text demos ──────────────────────────────────────────

(window as any).textPlain = () => {
  beginTextDemo("Plain Text: size hierarchy");
  addText("Tiny",    -5, 2.5, { size: 14 });
  addText("Small",   -2.5, 2.5, { size: 22 });
  addText("Medium",   0,   2.5, { size: 34 });
  addText("Large",    2.5, 2.5, { size: 52 });
  addText("Huge",     5,   2.5, { size: 80 });
  addText("Regular weight",  0,  0.5, { size: 32, weight: "400" });
  addText("Bold weight",     0, -0.5, { size: 32, weight: "700" });
  addText("Italic style",    0, -1.8, { size: 32, italic: true });
  addText("Monospace",       0, -3.0, { size: 30, font: "'Cascadia Code', 'Fira Code', monospace" });
};

(window as any).textColors = () => {
  beginTextDemo("Colored Text");
  const rows: Array<[string, string]> = [
    ["#ff6b6b", "Passion Red"],
    ["#ffa502", "Sunset Orange"],
    ["#feca57", "Golden Yellow"],
    ["#48dbfb", "Sky Blue"],
    ["#1dd1a1", "Mint Green"],
    ["#a29bfe", "Lavender"],
    ["#ff9ff3", "Pink Blossom"],
  ];
  rows.forEach(([color, name], i) => {
    const y = 3 - i * 0.9;
    addText(name, 0, y, { size: 36, color, weight: "600" });
  });
};

(window as any).textTitleCard = () => {
  beginTextDemo("Title Card");
  addText("manim-ts",        0,  1.5, { size: 96, color: "#9cdceb", weight: "700" });
  addText("Mathematical Animation Engine",  0,  0, { size: 28, color: "#ccc" });
  addText("TypeScript port • 1:1 Python Manim parity",  0, -1, { size: 18, color: "#888", italic: true });
  addText("v0.1.0",  0, -2.3, { size: 16, color: "#555", font: "monospace" });
};

(window as any).textMultiline = () => {
  beginTextDemo("Multi-line Paragraph");
  const lines = [
    "Manim is a community-maintained Python library",
    "for creating mathematical animations.",
    "",
    "This is a TypeScript port that mirrors its public API,",
    "allowing browser-based math explanations without",
    "a Python toolchain.",
  ];
  lines.forEach((line, i) => {
    addText(line, 0, 2.2 - i * 0.7, { size: 26, color: "#ddd" });
  });
};

// ── Equation demos ────────────────────────────────────────────

(window as any).textPythagoras = () => {
  beginTextDemo("Pythagorean Theorem");
  addText("The Pythagorean Theorem", 0, 2.5, { size: 36, color: "#9cdceb" });
  addTex("a^2 + b^2 = c^2", 0, 0.5, { size: 64 });
  addText("where c is the hypotenuse of a right triangle", 0, -1.8, { size: 22, color: "#aaa", italic: true });
};

(window as any).textQuadratic = () => {
  beginTextDemo("Quadratic Formula");
  addText("For ax² + bx + c = 0:", 0, 2.5, { size: 32, color: "#ddd" });
  addTex("x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", 0, 0, { size: 60 });
  addText("discriminant Δ = b² − 4ac", 0, -2.3, { size: 24, color: "#ffa502", italic: true });
};

(window as any).textEuler = () => {
  beginTextDemo("Euler's Identity");
  addText("Euler's Identity", 0, 2.5, { size: 36, color: "#ff9ff3" });
  addTex("e^{i\\pi} + 1 = 0", 0, 0.3, { size: 96 });
  addText("connecting 0, 1, π, e, and i", 0, -2.0, { size: 24, color: "#aaa", italic: true });
};

(window as any).textEinstein = () => {
  beginTextDemo("Mass-Energy Equivalence");
  addTex("E = mc^2", 0, 0.5, { size: 120 });
  addText("— Albert Einstein, 1905", 0, -2.0, { size: 24, color: "#888", italic: true });
};

(window as any).textMaxwell = () => {
  beginTextDemo("Maxwell's Equations");
  addText("Maxwell's Equations (differential form)", 0, 3, { size: 28, color: "#9cdceb" });
  addTex("\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}",            -3.2,  1.2, { size: 34 });
  addTex("\\nabla \\cdot \\mathbf{B} = 0",                                          3.2,  1.2, { size: 34 });
  addTex("\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}", -3.2, -1.2, { size: 34 });
  addTex("\\nabla \\times \\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}", 3.2, -1.2, { size: 30 });
  addText("Gauss • Gauss (magnetism) • Faraday • Ampère-Maxwell", 0, -3, { size: 18, color: "#888" });
};

(window as any).textCalculus = () => {
  beginTextDemo("Calculus Sampler");
  addText("Fundamental Theorem of Calculus", 0, 3, { size: 28, color: "#9cdceb" });
  addTex("\\int_a^b f'(x)\\,dx = f(b) - f(a)", 0, 1.5, { size: 42 });
  addText("Chain Rule", 0, 0.2, { size: 24, color: "#feca57" });
  addTex("\\frac{d}{dx}\\bigl[f(g(x))\\bigr] = f'(g(x))\\,g'(x)", 0, -1.2, { size: 38 });
  addText("Product Rule", 0, -2.3, { size: 22, color: "#feca57" });
  addTex("(fg)' = f'g + fg'", 0, -3, { size: 30 });
};

(window as any).textIntegrals = () => {
  beginTextDemo("Integrals & Sums");
  addTex("\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}",  0, 2.4, { size: 44 });
  addTex("\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}", 0, 0.6, { size: 44 });
  addTex("\\prod_{n=1}^{\\infty}\\left(1 - \\frac{x^2}{n^2\\pi^2}\\right) = \\frac{\\sin x}{x}", 0, -1.4, { size: 38 });
  addText("Gaussian • Basel problem • Euler's sine product", 0, -3, { size: 18, color: "#888", italic: true });
};

(window as any).textLimits = () => {
  beginTextDemo("Limits & Derivatives");
  addText("Definition of the derivative", 0, 3, { size: 26, color: "#9cdceb" });
  addTex("f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}", 0, 1.4, { size: 42 });
  addText("Classic limits", 0, 0.1, { size: 22, color: "#feca57" });
  addTex("\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1", -3.5, -1.3, { size: 34 });
  addTex("\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e", 3.5, -1.3, { size: 34 });
};

(window as any).textSeries = () => {
  beginTextDemo("Famous Series");
  addText("Taylor / Maclaurin series", 0, 3, { size: 26, color: "#9cdceb" });
  addTex("e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}", 0, 1.3, { size: 40 });
  addTex("\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}", 0, -0.4, { size: 34 });
  addTex("\\cos x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n}}{(2n)!}",     0, -2.2, { size: 34 });
};

(window as any).textTrig = () => {
  beginTextDemo("Trigonometric Identities");
  addText("Trig Identities", 0, 3, { size: 28, color: "#9cdceb" });
  addTex("\\sin^2\\theta + \\cos^2\\theta = 1", 0, 1.6, { size: 40 });
  addTex("\\sin(2\\theta) = 2\\sin\\theta\\cos\\theta", 0, 0.1, { size: 36 });
  addTex("\\cos(2\\theta) = \\cos^2\\theta - \\sin^2\\theta", 0, -1.4, { size: 36 });
  addTex("\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}", 0, -2.9, { size: 34 });
};

(window as any).textMatrix = () => {
  beginTextDemo("Matrix Equation");
  addText("Solving a linear system Ax = b", 0, 3, { size: 26, color: "#9cdceb" });
  addTex(
    "\\begin{pmatrix} 2 & 1 & -1 \\\\ -3 & -1 & 2 \\\\ -2 & 1 & 2 \\end{pmatrix}" +
    "\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}" +
    "= \\begin{pmatrix} 8 \\\\ -11 \\\\ -3 \\end{pmatrix}",
    0, 0.5, { size: 36 },
  );
  addText("Gaussian elimination → (x, y, z) = (2, 3, −1)", 0, -2.5, { size: 22, color: "#1dd1a1", italic: true });
};

(window as any).textSetTheory = () => {
  beginTextDemo("Set Theory");
  addText("Sets and Operations", 0, 3, { size: 28, color: "#9cdceb" });
  addTex("A \\cup B = \\{ x : x \\in A \\text{ or } x \\in B \\}", 0, 1.5, { size: 34 });
  addTex("A \\cap B = \\{ x : x \\in A \\text{ and } x \\in B \\}", 0, 0.0, { size: 34 });
  addTex("A \\setminus B = \\{ x : x \\in A \\text{ and } x \\notin B \\}", 0, -1.5, { size: 34 });
  addTex("|A \\cup B| = |A| + |B| - |A \\cap B|", 0, -3, { size: 30 });
};

(window as any).textGreek = () => {
  beginTextDemo("Greek Alphabet");
  const letters: Array<[string, string]> = [
    ["\\alpha", "alpha"],   ["\\beta", "beta"],    ["\\gamma", "gamma"],  ["\\delta", "delta"],
    ["\\varepsilon", "epsilon"], ["\\zeta", "zeta"],     ["\\eta", "eta"],      ["\\theta", "theta"],
    ["\\iota", "iota"],     ["\\kappa", "kappa"],   ["\\lambda", "lambda"], ["\\mu", "mu"],
    ["\\nu", "nu"],         ["\\xi", "xi"],         ["\\pi", "pi"],         ["\\rho", "rho"],
    ["\\sigma", "sigma"],   ["\\tau", "tau"],       ["\\phi", "phi"],       ["\\chi", "chi"],
    ["\\psi", "psi"],       ["\\omega", "omega"],
  ];
  const cols = 6;
  const dx = 2.0, dy = 1.1;
  const x0 = -(cols - 1) / 2 * dx;
  letters.forEach(([tex, name], i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = x0 + c * dx, y = 2.6 - r * dy;
    addTex(tex, x, y + 0.2, { size: 34 });
    addText(name, x, y - 0.4, { size: 13, color: "#888" });
  });
};

(window as any).textFractions = () => {
  beginTextDemo("Nested Fractions");
  addText("Continued fraction for the golden ratio φ", 0, 3, { size: 24, color: "#9cdceb" });
  addTex("\\varphi = 1 + \\cfrac{1}{1 + \\cfrac{1}{1 + \\cfrac{1}{1 + \\cfrac{1}{1 + \\ddots}}}}", 0, 0, { size: 42 });
  addTex("\\varphi = \\frac{1 + \\sqrt{5}}{2} \\approx 1.618\\ldots", 0, -2.7, { size: 32 });
};

// ── Labeled geometry demos (text + real engine mobjects) ──────

(window as any).textLabeledCircle = () => {
  beginTextDemo("Labeled Circle");
  const circle = new Circle({ radius: 2.2, strokeColor: BLUE_D, strokeWidth: 3, strokeOpacity: 1 }) as VMobject;
  for (const p of extractFamily(circle)) scene.add(p);
  // Radius line
  const r = new Line(np.array([0, 0, 0]), np.array([2.2, 0, 0]), {
    strokeColor: YELLOW, strokeWidth: 2, strokeOpacity: 1,
  }) as VMobject;
  for (const p of extractFamily(r)) scene.add(p);
  // Center dot
  const dot = new Dot(np.array([0, 0, 0]), { color: WHITE }) as VMobject;
  for (const p of extractFamily(dot)) scene.add(p);
  scene.play();
  addText("O",  -0.25, -0.25, { size: 22, color: "#fff", italic: true });
  addText("r",   1.1,  0.25, { size: 26, color: "#feca57", italic: true });
  addTex("C = 2\\pi r", -4, 2.5, { size: 36 });
  addTex("A = \\pi r^2", 4, 2.5, { size: 36 });
  addText("Circle of radius r", 0, -3.2, { size: 22, color: "#aaa", italic: true });
};

(window as any).textLabeledTriangle = () => {
  beginTextDemo("Labeled Right Triangle");
  // Right triangle: legs 3, 4, hypotenuse 5 (scaled down)
  const s = 0.9;
  const A: Point3 = [-2 * s, -1.5 * s, 0];
  const B: Point3 = [ 2 * s, -1.5 * s, 0];
  const C: Point3 = [-2 * s,  2.5 * s, 0];
  const tri = new Polygon(
    [np.array(A), np.array(B), np.array(C)],
    { strokeColor: GREEN, strokeWidth: 3, strokeOpacity: 1, fillColor: GREEN, fillOpacity: 0.15 },
  ) as VMobject;
  for (const p of extractFamily(tri)) scene.add(p);
  scene.play();
  // Vertex labels
  addText("A", A[0] - 0.3, A[1] - 0.3, { size: 28, weight: "600" });
  addText("B", B[0] + 0.3, B[1] - 0.3, { size: 28, weight: "600" });
  addText("C", C[0] - 0.3, C[1] + 0.3, { size: 28, weight: "600" });
  // Side labels
  addText("a", (A[0] + B[0]) / 2, A[1] - 0.5, { size: 26, color: "#feca57", italic: true });
  addText("b", A[0] - 0.5, (A[1] + C[1]) / 2, { size: 26, color: "#feca57", italic: true });
  addText("c", (B[0] + C[0]) / 2 + 0.3, (B[1] + C[1]) / 2 + 0.3, { size: 26, color: "#feca57", italic: true });
  addTex("a^2 + b^2 = c^2", 4, 2.5, { size: 32 });
};

(window as any).textGraphAnnotated = () => {
  beginTextDemo("Annotated Sine Graph");
  const axes = new Axes({
    xRange: [-4, 4, 1], yRange: [-1.5, 1.5, 0.5],
    xLength: 10, yLength: 4,
    axisConfig: { strokeColor: GRAY_B, strokeOpacity: 1, strokeWidth: 2 },
  }) as unknown as VMobject;
  for (const p of extractFamily(axes)) scene.add(p);
  const sinGraph = (axes as any).plot
    ? (axes as any).plot((x: number) => Math.sin(x), { xRange: [-PI, PI], strokeColor: YELLOW, strokeWidth: 3 })
    : new FunctionGraph((x: number) => Math.sin(x), { xRange: [-PI, PI, 0.05], strokeColor: YELLOW, strokeWidth: 3, strokeOpacity: 1 });
  for (const p of extractFamily(sinGraph as VMobject)) scene.add(p);
  scene.play();
  addTex("y = \\sin(x)", 3.2, 2.5, { size: 34, color: "#feca57" });
  addText("amplitude = 1",  -4.5, 1.5, { size: 18, color: "#aaa", align: "left" });
  addTex("\\text{period} = 2\\pi", -4.5, 1.0, { size: 22, color: "#aaa", align: "left" });
  addText("π",  PI * (10 / 8) - 0.1, -0.5, { size: 20, color: "#888" });
  addText("−π", -PI * (10 / 8) - 0.1, -0.5, { size: 20, color: "#888" });
  addText("0", 0.15, -0.35, { size: 20, color: "#888" });
};

// ── Step-by-step derivation ───────────────────────────────────

(window as any).textDerivation = () => {
  beginTextDemo("Step-by-Step Derivation");
  addText("Solving x² − 5x + 6 = 0", 0, 3, { size: 28, color: "#9cdceb" });
  const steps = [
    "x^2 - 5x + 6 = 0",
    "(x - 2)(x - 3) = 0",
    "x - 2 = 0 \\quad \\text{or} \\quad x - 3 = 0",
    "x = 2 \\quad \\text{or} \\quad x = 3",
  ];
  steps.forEach((s, i) => {
    addTex(s, 0, 1.7 - i * 1.4, { size: 36 });
    if (i < steps.length - 1) {
      addText("↓", 0, 1.0 - i * 1.4, { size: 22, color: "#888" });
    }
  });
  addText("Solutions: { 2, 3 }", 0, -3.3, { size: 22, color: "#1dd1a1", italic: true });
};

// ── Gradient row ──────────────────────────────────────────────

(window as any).textGradient = () => {
  beginTextDemo("Gradient Text Row");
  const word = "MATHEMATICS";
  const palette = ["#ff6b6b", "#ffa502", "#feca57", "#c8e020", "#1dd1a1", "#48dbfb", "#5f27cd", "#a29bfe", "#ff9ff3", "#ee5253", "#ff6348"];
  const n = word.length;
  const dx = 1.0;
  const x0 = -((n - 1) / 2) * dx;
  for (let i = 0; i < n; i++) {
    addText(word[i], x0 + i * dx, 0, { size: 72, color: palette[i % palette.length], weight: "800" });
  }
  addText("a splash of color across every letter", 0, -2, { size: 22, color: "#aaa", italic: true });
};

// ── Wall of equations ─────────────────────────────────────────

(window as any).textAllEquations = () => {
  beginTextDemo("All Equations Wall");
  const eqs: Array<[string, number, number, number]> = [
    ["e^{i\\pi} + 1 = 0",                                             -4.5,  3.0, 26],
    ["E = mc^2",                                                       0,    3.0, 30],
    ["a^2 + b^2 = c^2",                                                4.5,  3.0, 26],
    ["\\int_a^b f'(x)\\,dx = f(b) - f(a)",                             -4.5,  1.5, 22],
    ["\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",       0,    1.5, 22],
    ["\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}",                        4.5,  1.5, 22],
    ["x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",                        -4.5,  0.0, 22],
    ["\\sin^2\\theta + \\cos^2\\theta = 1",                            0,    0.0, 22],
    ["\\nabla \\cdot \\mathbf{E} = \\tfrac{\\rho}{\\varepsilon_0}",    4.5,  0.0, 22],
    ["\\int_{-\\infty}^{\\infty} e^{-x^2}dx = \\sqrt{\\pi}",           -4.5, -1.5, 22],
    ["F = G\\,\\tfrac{m_1 m_2}{r^2}",                                  0,   -1.5, 24],
    ["i\\hbar\\tfrac{\\partial \\psi}{\\partial t} = \\hat{H}\\psi",   4.5, -1.5, 22],
    ["\\varphi = \\tfrac{1+\\sqrt{5}}{2}",                             -4.5, -3.0, 24],
    ["\\zeta(s) = \\sum \\tfrac{1}{n^s}",                              0,   -3.0, 24],
    ["PV = nRT",                                                       4.5, -3.0, 24],
  ];
  for (const [tex, x, y, size] of eqs) addTex(tex, x, y, { size });
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
  clearTextOverlay();
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
