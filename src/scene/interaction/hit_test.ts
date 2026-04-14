/**
 * Hit-testing utilities for pointer → mobject dispatch.
 * Not part of Python Manim.
 */

import type { IMobject } from "../../core/types.js";

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Compute the axis-aligned bounding box of a mobject (scene coords). */
export function getBoundingBox(mob: IMobject): BoundingBox | null {
  const m = mob as unknown as {
    getBoundingBox?: () => unknown;
    getCornersOfBoundingBox?: () => unknown;
    getCenter?: () => unknown;
    points?: { shape?: number[]; at?: (i: number, j: number) => number };
    getAllPoints?: () => { shape?: number[]; at?: (i: number, j: number) => number };
  };

  // Collect every point from this mobject's family
  const family: IMobject[] = typeof (mob as unknown as { getFamily?: () => IMobject[] }).getFamily === "function"
    ? (mob as unknown as { getFamily: () => IMobject[] }).getFamily()
    : [mob];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let found = false;

  for (const member of family) {
    const pts = (member as unknown as {
      points?: { shape?: number[]; at?: (i: number, j: number) => number };
    }).points;
    if (!pts || !pts.shape || !pts.at) continue;
    const n = pts.shape[0] ?? 0;
    const d = pts.shape[1] ?? 3;
    for (let i = 0; i < n; i++) {
      const x = pts.at(i, 0);
      const y = d > 1 ? pts.at(i, 1) : 0;
      const z = d > 2 ? pts.at(i, 2) : 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      found = true;
    }
  }

  if (!found) return null;
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export interface HitTestOptions {
  /** If true, include mobjects whose bbox contains the point even if z > 0. */
  includeAllZ?: boolean;
  /** Optional filter — return true to consider this mobject. */
  filter?: (mob: IMobject) => boolean;
}

/**
 * Find the top-most mobject in `mobjects` whose bounding box contains (x, y).
 * "Top-most" = last in array (later-added mobjects draw on top in Manim).
 * Returns null if no hit.
 *
 * This is a bounding-box hit test — fast but imprecise for hollow shapes.
 * For precise path hit-testing see hitTestPrecise().
 */
export function hitTestBBox(
  mobjects: readonly IMobject[],
  x: number,
  y: number,
  options: HitTestOptions = {},
): IMobject | null {
  for (let i = mobjects.length - 1; i >= 0; i--) {
    const mob = mobjects[i];
    if (options.filter && !options.filter(mob)) continue;
    const bbox = getBoundingBox(mob);
    if (!bbox) continue;
    if (x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
      // Recurse into submobjects to find the deepest hit
      const sub = hitTestBBox(mob.submobjects, x, y, options);
      return sub ?? mob;
    }
  }
  return null;
}
