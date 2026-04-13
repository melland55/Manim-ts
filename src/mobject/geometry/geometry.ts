/**
 * Basic geometric shapes built on VMobject.
 *
 * TypeScript port of the core shapes from manim/mobject/geometry/arc.py
 * and manim/mobject/geometry/polygram.py.
 */

import { np, PI, TAU } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import type { IColor } from "../../core/types.js";
import { BLUE, WHITE, YELLOW, RED, GREEN } from "../../core/color/index.js";
import { VMobject } from "../types/index.js";
import type { VMobjectOptions } from "../types/index.js";

// ── Kappa: bezier approximation constant for circular arcs ────
const KAPPA = 0.5522847498;

// ── Arc ──────────────────────────────────────────────────────

export interface ArcOptions extends VMobjectOptions {
  radius?: number;
  startAngle?: number;
  angle?: number;
  numComponents?: number;
  arcCenter?: Point3D;
}

/**
 * A circular arc defined by a start angle and sweep angle.
 */
export class Arc extends VMobject {
  radius: number;
  startAngle: number;
  angle: number;
  numComponents: number;
  arcCenter: Point3D;

  constructor(options: ArcOptions = {}) {
    super(options);
    this.radius = options.radius ?? 1.0;
    this.startAngle = options.startAngle ?? 0;
    this.angle = options.angle ?? TAU / 4;
    this.numComponents = options.numComponents ?? 8;
    this.arcCenter = options.arcCenter ?? np.array([0, 0, 0]);
    this._generateArcPoints();
  }

  private _generateArcPoints(): void {
    this.clearPoints();
    if (Math.abs(this.angle) < 1e-10) return;

    const nArcs = this.numComponents;
    const deltaAngle = this.angle / nArcs;

    for (let i = 0; i < nArcs; i++) {
      const theta = this.startAngle + i * deltaAngle;
      const thetaEnd = theta + deltaAngle;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const cosE = Math.cos(thetaEnd);
      const sinE = Math.sin(thetaEnd);

      // Bezier approximation of circular arc
      const alpha = (4 / 3) * Math.tan(deltaAngle / 4);
      const r = this.radius;
      const cx = this.arcCenter.item(0) as number;
      const cy = this.arcCenter.item(1) as number;
      const cz = this.arcCenter.item(2) as number;

      const p0 = np.array([cx + r * cosT, cy + r * sinT, cz]);
      const p1 = np.array([
        cx + r * (cosT - alpha * sinT),
        cy + r * (sinT + alpha * cosT),
        cz,
      ]);
      const p2 = np.array([
        cx + r * (cosE + alpha * sinE),
        cy + r * (sinE - alpha * cosE),
        cz,
      ]);
      const p3 = np.array([cx + r * cosE, cy + r * sinE, cz]);

      if (i === 0) {
        this.startNewPath(p0);
      }
      this.addCubicBezierCurveTo(p1, p2, p3);
    }
  }
}

// ── Circle ───────────────────────────────────────────────────

export interface CircleOptions extends VMobjectOptions {
  radius?: number;
  color?: IColor;
}

/**
 * A full circle. Default color is RED.
 */
export class Circle extends Arc {
  constructor(options: CircleOptions = {}) {
    super({
      angle: TAU,
      fillColor: options.color ?? options.fillColor ?? RED,
      fillOpacity: options.fillOpacity ?? 0.5,
      strokeColor: options.color ?? options.strokeColor ?? RED,
      strokeOpacity: options.strokeOpacity ?? 1.0,
      radius: options.radius ?? 1.0,
      ...options,
    });
  }
}

// ── RegularPolygon helpers ───────────────────────────────────

function polygonVertices(
  n: number,
  radius: number = 1.0,
  startAngle: number = PI / 2,
): Point3D[] {
  const vertices: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (TAU * i) / n;
    vertices.push(
      np.array([radius * Math.cos(angle), radius * Math.sin(angle), 0]),
    );
  }
  return vertices;
}

// ── Polygon ──────────────────────────────────────────────────

export interface PolygonOptions extends VMobjectOptions {
  vertices?: Point3D[];
}

/**
 * An arbitrary polygon defined by vertices.
 */
export class Polygon extends VMobject {
  vertices: Point3D[];

  constructor(vertices: Point3D[], options: VMobjectOptions = {}) {
    super({
      strokeColor: options.strokeColor ?? WHITE,
      strokeOpacity: options.strokeOpacity ?? 1.0,
      fillOpacity: options.fillOpacity ?? 0.0,
      ...options,
    });
    this.vertices = vertices;
    this._generatePolygonPoints();
  }

  private _generatePolygonPoints(): void {
    this.clearPoints();
    if (this.vertices.length < 2) return;

    this.startNewPath(this.vertices[0]);
    for (let i = 1; i < this.vertices.length; i++) {
      this.addLineTo(this.vertices[i]);
    }
    this.closePath();
  }
}

// ── RegularPolygon ───────────────────────────────────────────

export interface RegularPolygonOptions extends VMobjectOptions {
  n?: number;
  radius?: number;
  startAngle?: number;
}

/**
 * A regular polygon with n sides.
 */
export class RegularPolygon extends Polygon {
  constructor(options: RegularPolygonOptions = {}) {
    const n = options.n ?? 6;
    const radius = options.radius ?? 1.0;
    const startAngle = options.startAngle ?? PI / 2;
    const verts = polygonVertices(n, radius, startAngle);
    super(verts, options);
  }
}

// ── Square ───────────────────────────────────────────────────

export interface SquareOptions extends VMobjectOptions {
  sideLength?: number;
  color?: IColor;
}

/**
 * A square. Default color is GREEN.
 */
export class Square extends RegularPolygon {
  constructor(options: SquareOptions = {}) {
    const sideLength = options.sideLength ?? 2.0;
    // A square is a regular polygon with 4 sides
    // Radius of circumscribed circle = sideLength / sqrt(2)
    const radius = sideLength / Math.sqrt(2);
    super({
      n: 4,
      radius,
      startAngle: PI / 4,
      strokeColor: options.color ?? options.strokeColor ?? GREEN,
      fillColor: options.color ?? options.fillColor ?? GREEN,
      fillOpacity: options.fillOpacity ?? 0.5,
      ...options,
    });
  }
}

// ── Triangle ─────────────────────────────────────────────────

export interface TriangleOptions extends VMobjectOptions {
  radius?: number;
  color?: IColor;
}

/**
 * An equilateral triangle.
 */
export class Triangle extends RegularPolygon {
  constructor(options: TriangleOptions = {}) {
    super({
      n: 3,
      radius: options.radius ?? 1.0,
      strokeColor: options.color ?? options.strokeColor ?? YELLOW,
      fillColor: options.color ?? options.fillColor ?? YELLOW,
      fillOpacity: options.fillOpacity ?? 0.5,
      ...options,
    });
  }
}

// ── Line ─────────────────────────────────────────────────────

export interface LineOptions extends VMobjectOptions {
  start?: Point3D;
  end?: Point3D;
}

/**
 * A straight line segment.
 */
export class Line extends VMobject {
  start: Point3D;
  end: Point3D;

  constructor(options: LineOptions = {}) {
    super({
      strokeColor: options.strokeColor ?? WHITE,
      strokeOpacity: options.strokeOpacity ?? 1.0,
      fillOpacity: 0,
      ...options,
    });
    this.start = options.start ?? np.array([-1, 0, 0]);
    this.end = options.end ?? np.array([1, 0, 0]);
    this._generateLinePoints();
  }

  private _generateLinePoints(): void {
    this.clearPoints();
    this.startNewPath(this.start);
    this.addLineTo(this.end);
  }
}
