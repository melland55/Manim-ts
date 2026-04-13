/**
 * Boolean operations for two-dimensional mobjects.
 *
 * TypeScript port of manim/mobject/geometry/boolean_ops.py
 *
 * Uses polygon-clipping (replaces Python's skia-pathops) to perform
 * union, intersection, difference, and XOR operations on VMobject shapes.
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import { VMobject } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import polygonClipping from "polygon-clipping";
import type { Polygon, MultiPolygon, Pair } from "polygon-clipping";

/** Number of line segments to approximate each cubic Bezier curve. */
const BEZIER_SAMPLE_COUNT = 16;

// ── Helper: evaluate cubic Bezier at parameter t ────────────────

function evalCubic(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number,
): [number, number] {
  const s = 1 - t;
  const s2 = s * s;
  const t2 = t * t;
  const x = s2 * s * p0x + 3 * s2 * t * p1x + 3 * s * t2 * p2x + t2 * t * p3x;
  const y = s2 * s * p0y + 3 * s2 * t * p1y + 3 * s * t2 * p2y + t2 * t * p3y;
  return [x, y];
}

// ── Conversion helpers ──────────────────────────────────────────

/**
 * Convert a VMobject's cubic Bezier paths into polygon-clipping Polygon format.
 * Each subpath becomes a Ring (array of [x, y] pairs).
 */
function vmobjectToPolygon(vmobject: VMobject): Polygon {
  const subpaths = vmobject.getSubpaths();
  if (subpaths.length === 0) return [];

  const rings: Polygon = [];

  for (const subpath of subpaths) {
    const nPoints = subpath.shape[0];
    if (nPoints < 4) continue; // need at least one cubic segment

    const ring: Pair[] = [];

    // Add first anchor
    ring.push([
      subpath.get([0, 0]) as number,
      subpath.get([0, 1]) as number,
    ]);

    // Walk cubic segments: each is 4 points [anchor, handle1, handle2, anchor]
    const nSegments = Math.floor((nPoints - 1) / 3);
    for (let seg = 0; seg < nSegments; seg++) {
      const base = seg * 3;
      const p0x = subpath.get([base, 0]) as number;
      const p0y = subpath.get([base, 1]) as number;
      const p1x = subpath.get([base + 1, 0]) as number;
      const p1y = subpath.get([base + 1, 1]) as number;
      const p2x = subpath.get([base + 2, 0]) as number;
      const p2y = subpath.get([base + 2, 1]) as number;
      const p3x = subpath.get([base + 3, 0]) as number;
      const p3y = subpath.get([base + 3, 1]) as number;

      // Check if it's a straight line (handles at 1/3 and 2/3)
      const isStraight =
        Math.abs(p1x - (p0x + (p3x - p0x) / 3)) < 1e-10 &&
        Math.abs(p1y - (p0y + (p3y - p0y) / 3)) < 1e-10 &&
        Math.abs(p2x - (p0x + (2 * (p3x - p0x)) / 3)) < 1e-10 &&
        Math.abs(p2y - (p0y + (2 * (p3y - p0y)) / 3)) < 1e-10;

      if (isStraight) {
        // Just add the endpoint
        ring.push([p3x, p3y]);
      } else {
        // Sample the Bezier curve
        for (let i = 1; i <= BEZIER_SAMPLE_COUNT; i++) {
          const t = i / BEZIER_SAMPLE_COUNT;
          ring.push(evalCubic(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t));
        }
      }
    }

    // Close the ring if not already closed
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (
      Math.abs(first[0] - last[0]) > 1e-10 ||
      Math.abs(first[1] - last[1]) > 1e-10
    ) {
      ring.push([first[0], first[1]]);
    }

    if (ring.length >= 4) {
      // polygon-clipping requires at least 4 points (3 + closing)
      rings.push(ring);
    }
  }

  return rings;
}

/**
 * Convert polygon-clipping MultiPolygon result back into VMobject path data.
 * Each ring becomes a subpath of line segments.
 */
function multiPolygonToVMobject(
  vmobject: VMobject,
  multiPoly: MultiPolygon,
): void {
  for (const polygon of multiPoly) {
    for (const ring of polygon) {
      if (ring.length < 2) continue;

      const startPoint = np.array([ring[0][0], ring[0][1], 0]) as Point3D;
      vmobject.startNewPath(startPoint);

      for (let i = 1; i < ring.length; i++) {
        const pt = np.array([ring[i][0], ring[i][1], 0]) as Point3D;
        vmobject.addLineTo(pt);
      }

      // Close path back to start if not already closed
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (
        Math.abs(first[0] - last[0]) > 1e-10 ||
        Math.abs(first[1] - last[1]) > 1e-10
      ) {
        vmobject.addLineTo(startPoint);
      }
    }
  }
}

// ── Boolean operation classes ───────────────────────────────────

/**
 * Union of two or more VMobjects. Returns the region covered by
 * any of the input VMobjects.
 *
 * @throws {Error} If less than 2 VMobjects are passed.
 */
export class Union extends VMobject {
  constructor(...args: [...VMobject[], VMobjectOptions] | VMobject[]) {
    // Parse args: last arg may be options object
    let vmobjects: VMobject[];
    let options: VMobjectOptions = {};

    if (
      args.length > 0 &&
      args[args.length - 1] !== null &&
      typeof args[args.length - 1] === "object" &&
      !(args[args.length - 1] instanceof VMobject)
    ) {
      options = args[args.length - 1] as VMobjectOptions;
      vmobjects = args.slice(0, -1) as VMobject[];
    } else {
      vmobjects = args as VMobject[];
    }

    if (vmobjects.length < 2) {
      throw new Error("At least 2 mobjects needed for Union.");
    }

    super(options);

    const polygons: Polygon[] = vmobjects.map(vmobjectToPolygon);
    // Filter out empty polygons
    const nonEmpty = polygons.filter((p) => p.length > 0);
    if (nonEmpty.length >= 2) {
      const result = polygonClipping.union(
        nonEmpty[0],
        ...nonEmpty.slice(1),
      );
      multiPolygonToVMobject(this, result);
    } else if (nonEmpty.length === 1) {
      multiPolygonToVMobject(this, [nonEmpty[0]]);
    }
  }
}

/**
 * Subtracts one VMobject from another.
 *
 * @param subject - The VMobject to subtract from.
 * @param clip - The VMobject to subtract.
 */
export class Difference extends VMobject {
  constructor(subject: VMobject, clip: VMobject, options: VMobjectOptions = {}) {
    super(options);

    const subjectPoly = vmobjectToPolygon(subject);
    const clipPoly = vmobjectToPolygon(clip);

    if (subjectPoly.length > 0 && clipPoly.length > 0) {
      const result = polygonClipping.difference(subjectPoly, clipPoly);
      multiPolygonToVMobject(this, result);
    } else if (subjectPoly.length > 0) {
      multiPolygonToVMobject(this, [subjectPoly]);
    }
  }
}

/**
 * Find the intersection of two or more VMobjects.
 * Keeps the parts covered by all VMobjects.
 *
 * @throws {Error} If less than 2 VMobjects are passed.
 */
export class Intersection extends VMobject {
  constructor(...args: [...VMobject[], VMobjectOptions] | VMobject[]) {
    let vmobjects: VMobject[];
    let options: VMobjectOptions = {};

    if (
      args.length > 0 &&
      args[args.length - 1] !== null &&
      typeof args[args.length - 1] === "object" &&
      !(args[args.length - 1] instanceof VMobject)
    ) {
      options = args[args.length - 1] as VMobjectOptions;
      vmobjects = args.slice(0, -1) as VMobject[];
    } else {
      vmobjects = args as VMobject[];
    }

    if (vmobjects.length < 2) {
      throw new Error("At least 2 mobjects needed for Intersection.");
    }

    super(options);

    const polygons: Polygon[] = vmobjects.map(vmobjectToPolygon);
    const nonEmpty = polygons.filter((p) => p.length > 0);

    if (nonEmpty.length >= 2) {
      // Iteratively intersect: result = poly[0] ∩ poly[1] ∩ ... ∩ poly[n]
      let result = polygonClipping.intersection(nonEmpty[0], nonEmpty[1]);
      for (let i = 2; i < nonEmpty.length; i++) {
        if (result.length === 0) break;
        // Flatten MultiPolygon back to a single geom for next intersection
        result = polygonClipping.intersection(result as Polygon[], nonEmpty[i]);
      }
      multiPolygonToVMobject(this, result);
    }
  }
}

/**
 * Find the XOR (symmetric difference) between two VMobjects.
 * Creates a new VMobject consisting of the region covered by
 * exactly one of them.
 *
 * @param subject - The 1st VMobject.
 * @param clip - The 2nd VMobject.
 */
export class Exclusion extends VMobject {
  constructor(subject: VMobject, clip: VMobject, options: VMobjectOptions = {}) {
    super(options);

    const subjectPoly = vmobjectToPolygon(subject);
    const clipPoly = vmobjectToPolygon(clip);

    if (subjectPoly.length > 0 && clipPoly.length > 0) {
      const result = polygonClipping.xor(subjectPoly, clipPoly);
      multiPolygonToVMobject(this, result);
    } else if (subjectPoly.length > 0) {
      multiPolygonToVMobject(this, [subjectPoly]);
    } else if (clipPoly.length > 0) {
      multiPolygonToVMobject(this, [clipPoly]);
    }
  }
}
