/**
 * Geometry converters: manim-ts VMobject point data → three.js BufferGeometries.
 *
 * Point layout (3k+1 per subpath):
 *   anchor₀, handle1₀, handle2₀, anchor₁, handle1₁, handle2₁, anchor₂, …
 *
 * Each cubic segment spans indices [3i … 3i+3]; anchors are shared between
 * adjacent segments.
 *
 * Subpath handling: each function operates on a single Points3D subpath.
 * For multi-subpath VMobjects (e.g. shapes with holes) the caller should
 * iterate vmob.getSubpaths() and pass each slice individually:
 *
 *   const geos = vmob.getSubpaths().map(sp => vmobjectToLineGeometry(sp));
 *
 * For fill with holes, use vmobjectToFillGeometry which accepts multiple
 * subpaths and passes them to earcut with correct hole indices.
 */

import * as THREE from "three";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import earcut from "earcut";
import type { Points3D } from "../../core/math/index.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Read a single point from a Points3D NDArray row. */
function pt(pts: Points3D, i: number): [number, number, number] {
  return [
    pts.get([i, 0]) as number,
    pts.get([i, 1]) as number,
    pts.get([i, 2]) as number,
  ];
}

/**
 * De Casteljau evaluation of a cubic bezier at parameter t ∈ [0, 1].
 * Control points: a0 (anchor start), h1 (handle 1), h2 (handle 2), a1 (anchor end).
 */
function cubicBezierAt(
  a0: [number, number, number],
  h1: [number, number, number],
  h2: [number, number, number],
  a1: [number, number, number],
  t: number,
): [number, number, number] {
  const s = 1 - t;
  const s2 = s * s;
  const t2 = t * t;
  const b =
    (c: 0 | 1 | 2) =>
      s2 * s * a0[c] +
      3 * s2 * t * h1[c] +
      3 * s * t2 * h2[c] +
      t2 * t * a1[c];
  return [b(0), b(1), b(2)];
}

/**
 * Return the number of cubic bezier segments encoded in a subpath.
 * A subpath with n points contains (n - 1) / 3 segments.
 */
function numSegments(n: number): number {
  if (n < 4) return 0;
  return Math.floor((n - 1) / 3);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a single VMobject subpath to a three.js LineGeometry (for Line2).
 *
 * Each cubic bezier segment is uniformly sampled into `sampling` sub-points.
 * Adjacent segments share their boundary sample (de-duplicated), so the
 * total output length is `(sampling - 1) * numSegments + 1` points.
 *
 * @param points  A single bezier subpath in VMobject's 3k+1 layout.
 * @param sampling Number of points to sample per cubic segment (≥ 2).
 * @returns LineGeometry ready for use with Line2.
 */
export function vmobjectToLineGeometry(
  points: Points3D,
  sampling: number = 20,
): LineGeometry {
  const n = points.shape[0];
  const nSeg = numSegments(n);
  const geo = new LineGeometry();

  if (nSeg === 0) {
    // Degenerate: empty, single anchor, or <4 points (no full cubic segment).
    // Emit a zero-length line at the origin/first-anchor so LineGeometry
    // stays valid but renders nothing.
    if (n >= 1) {
      const [x, y, z] = pt(points, 0);
      geo.setPositions([x, y, z, x, y, z]);
    } else {
      geo.setPositions([0, 0, 0, 0, 0, 0]);
    }
    return geo;
  }

  // Flat array: x,y,z per sampled point (duplicates at segment joins removed).
  // Size = (sampling - 1) * nSeg + 1 points × 3 coords.
  const count = (sampling - 1) * nSeg + 1;
  const flat = new Float32Array(count * 3);
  let out = 0;

  for (let seg = 0; seg < nSeg; seg++) {
    const base = seg * 3;
    const a0 = pt(points, base);
    const h1 = pt(points, base + 1);
    const h2 = pt(points, base + 2);
    const a1 = pt(points, base + 3);

    // First point of each segment (skip t=0 for all but segment 0 to avoid
    // duplicating the shared anchor with the previous segment's last point).
    const startT = seg === 0 ? 0 : 1;

    for (let s = startT; s < sampling; s++) {
      const t = s / (sampling - 1);
      const [x, y, z] = cubicBezierAt(a0, h1, h2, a1, t);
      flat[out++] = x;
      flat[out++] = y;
      flat[out++] = z;
    }
  }

  // Final anchor (t=1 of last segment).
  const [x, y, z] = pt(points, (nSeg - 1) * 3 + 3);
  flat[out++] = x;
  flat[out++] = y;
  flat[out++] = z;

  geo.setPositions(flat);
  return geo;
}

/**
 * Convert a VMobject subpath into a single continuous ribbon mesh for stroke
 * rendering. Unlike Line2 (which renders each segment as its own instanced
 * quad and produces visible "dots" at every sample point when faded), this
 * emits ONE triangle strip covering the whole polyline — a single pass, a
 * single alpha blend, and no overlapping quads.
 *
 * Width is in world units. Manim's stroke_width (in pixels) should be
 * converted by the caller via WORLD_UNITS_PER_STROKE_PX.
 *
 * Miter joints are used at every joint (simple; can pinch on sharp corners,
 * but matches Canvas2D's default lineJoin behavior closely enough).
 */
export function vmobjectToStrokeMesh(
  pointsOrSubpaths: Points3D | Points3D[],
  worldWidth: number,
  sampling: number = 20,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  if (worldWidth <= 0) return geo;

  const subpaths: Points3D[] = Array.isArray(pointsOrSubpaths)
    ? pointsOrSubpaths
    : [pointsOrSubpaths];

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  let vertBase = 0;

  const half = worldWidth / 2;
  // Generous closure epsilon: Manim's RoundedRectangle builds its border
  // from multiple arc+line pieces, so the last anchor may be off from the
  // first by small floating-point residue (well under 0.01 world units).
  const CLOSE_EPS = 1e-3;

  for (const points of subpaths) {
    const n = points.shape[0];
    const nSeg = numSegments(n);
    if (nSeg === 0) continue;

    // 1. Sample bezier segments into a polyline with EXACT tangents per
    //    sample. For smooth (C1) junctions like a Circle's arc-to-arc
    //    meet, using B'(t) gives identical tangents on both sides of the
    //    shared anchor — no bumps. Chord-based tangents produced tiny
    //    asymmetries at such junctions (→ visible pinches on stroke).
    //    `tIn` = tangent from the previous piece (matters at junctions);
    //    `tOut` = tangent going into the next piece. Interior samples
    //    of a single cubic have tIn === tOut.
    const poly: Array<[number, number, number]> = [];
    const tIn: Array<[number, number]> = [];
    const tOut: Array<[number, number]> = [];

    function cubicTangentAt(
      a0: [number, number, number],
      h1: [number, number, number],
      h2: [number, number, number],
      a1: [number, number, number],
      t: number,
    ): [number, number] {
      const s = 1 - t;
      const dx =
        3 * s * s * (h1[0] - a0[0]) +
        6 * s * t * (h2[0] - h1[0]) +
        3 * t * t * (a1[0] - h2[0]);
      const dy =
        3 * s * s * (h1[1] - a0[1]) +
        6 * s * t * (h2[1] - h1[1]) +
        3 * t * t * (a1[1] - h2[1]);
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    }

    for (let seg = 0; seg < nSeg; seg++) {
      const base = seg * 3;
      const a0 = pt(points, base);
      const h1 = pt(points, base + 1);
      const h2 = pt(points, base + 2);
      const a1 = pt(points, base + 3);
      const startS = seg === 0 ? 0 : 1;
      for (let s = startS; s < sampling; s++) {
        const t = s / (sampling - 1);
        poly.push(cubicBezierAt(a0, h1, h2, a1, t));
        const tang = cubicTangentAt(a0, h1, h2, a1, t);
        if (s === 1 && seg > 0) {
          // First emitted sample of a non-first segment IS the junction
          // anchor (same position as previous seg's t=1 sample, which we
          // already pushed). Overwrite the previous entry's tOut with
          // this segment's starting tangent, and set this sample's tIn
          // to that same incoming tangent... wait — this path doesn't
          // emit the junction anchor separately. The junction sample was
          // already pushed as t=1 of the previous segment. Here we're
          // pushing sample at t=1/(sampling-1) of the new segment.
          // Update the PREVIOUS entry's tOut to be the new segment's
          // starting tangent (for miter at the junction).
          const junctionIdx = poly.length - 2;
          tOut[junctionIdx] = cubicTangentAt(a0, h1, h2, a1, 0);
          tIn.push(tang);
          tOut.push(tang);
        } else {
          tIn.push(tang);
          tOut.push(tang);
        }
      }
    }

    let m = poly.length;
    if (m < 2) continue;

    // Detect closed loop: last point ≈ first point.
    const dx0 = poly[m - 1][0] - poly[0][0];
    const dy0 = poly[m - 1][1] - poly[0][1];
    const dz0 = poly[m - 1][2] - poly[0][2];
    const closed = Math.hypot(dx0, dy0, dz0) < CLOSE_EPS;
    if (closed) {
      // The last sample == the first sample (junction). Merge: drop the
      // tail and stitch the first sample's tIn from the tail's tIn
      // (which is the last cubic's tangent at t=1).
      const tailIn = tIn[m - 1];
      poly.pop();
      tIn.pop();
      tOut.pop();
      m = poly.length;
      if (m < 2) continue;
      tIn[0] = tailIn;
    }

    const positions = new Float32Array(m * 2 * 3);

    for (let i = 0; i < m; i++) {
      let tx1: number, ty1: number, tx2: number, ty2: number;
      if (closed || (i > 0 && i < m - 1)) {
        [tx1, ty1] = tIn[i];
        [tx2, ty2] = tOut[i];
      } else if (i === 0) {
        [tx1, ty1] = tOut[0];
        [tx2, ty2] = tOut[0];
      } else {
        // i === m - 1
        [tx1, ty1] = tIn[i];
        [tx2, ty2] = tIn[i];
      }
      const sx = tx1 + tx2;
      const sy = ty1 + ty2;
      const slen = Math.hypot(sx, sy) || 1;
      const tx = sx / slen;
      const ty = sy / slen;
      const nx = -ty;
      const ny = tx;

      // Miter scale: extend normal so offset is correct against prev segment.
      let miterScale = 1;
      const dot = nx * -ty1 + ny * tx1;
      if (Math.abs(dot) > 0.01) miterScale = 1 / dot;
      if (miterScale > 4) miterScale = 4;
      if (miterScale < -4) miterScale = -4;

      const off = half * miterScale;
      const [px, py, pz] = poly[i];
      positions[i * 6 + 0] = px + nx * off;
      positions[i * 6 + 1] = py + ny * off;
      positions[i * 6 + 2] = pz;
      positions[i * 6 + 3] = px - nx * off;
      positions[i * 6 + 4] = py - ny * off;
      positions[i * 6 + 5] = pz;
    }

    for (let k = 0; k < positions.length; k++) allPositions.push(positions[k]);

    // Triangle strip → indexed triangles.
    const nQuads = closed ? m : m - 1;
    for (let i = 0; i < nQuads; i++) {
      const a = vertBase + i * 2;
      const c = vertBase + ((i + 1) % m) * 2;
      allIndices.push(a, a + 1, c, a + 1, c + 1, c);
    }

    vertBase += m * 2;
  }

  if (allPositions.length === 0) return geo;

  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(allPositions, 3),
  );
  geo.setIndex(allIndices);
  return geo;
}

/**
 * Manim's stroke_width is in pixels at a nominal 1080p frame. Convert to
 * world units assuming a standard frame height of 8 world units over 1080px.
 */
export const WORLD_UNITS_PER_STROKE_PX = 8 / 1080;

/**
 * Convert VMobject subpath(s) to an indexed THREE.BufferGeometry for filled
 * rendering.
 *
 * Anchors (every 3rd point in each subpath) are used as polygon vertices.
 * Earcut triangulates the 2D XY projection; Z is preserved on the vertices.
 * If more than one subpath is provided, the first is treated as the outer
 * boundary and subsequent subpaths are treated as holes (clockwise winding
 * will be handled by earcut automatically).
 *
 * @param subpaths One or more Points3D subpaths (use vmob.getSubpaths()).
 * @returns THREE.BufferGeometry with position and index attributes.
 */
export function vmobjectToFillGeometry(
  ...subpaths: Points3D[]
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();

  if (subpaths.length === 0) return geo;

  // Collect vertices and build earcut inputs.
  // earcut expects a flat [x,y, x,y, ...] array with optional hole start indices.
  const coords2D: number[] = []; // flat XY for earcut
  const verts3D: number[] = [];  // flat XYZ for THREE position attribute
  const holeIndices: number[] = []; // vertex index where each hole ring starts

  // Sample each cubic segment into this many sub-points. Anchors alone
  // produce a polygon (decagon for a default Circle) — we need curve samples
  // for a smooth filled boundary.
  const FILL_SAMPLING = 12;

  for (let sp = 0; sp < subpaths.length; sp++) {
    const pts = subpaths[sp];
    const n = pts.shape[0];
    if (n === 0) continue;
    const nSeg = numSegments(n);

    // Mark the start of each ring after the first as a hole.
    if (sp > 0) {
      holeIndices.push(coords2D.length / 2);
    }

    if (nSeg === 0) {
      // Fewer than 4 points — fall back to whatever anchors exist.
      for (let i = 0; i < n; i += 3) {
        const [x, y, z] = pt(pts, i);
        coords2D.push(x, y);
        verts3D.push(x, y, z);
      }
      continue;
    }

    // Walk segments and sample each cubic. Emit t ∈ [0, 1] per segment,
    // but skip t=0 for every segment after the first (the previous
    // segment's t=1 is the same point — the shared anchor).
    for (let seg = 0; seg < nSeg; seg++) {
      const base = seg * 3;
      const a0 = pt(pts, base);
      const h1 = pt(pts, base + 1);
      const h2 = pt(pts, base + 2);
      const a1 = pt(pts, base + 3);
      const startS = seg === 0 ? 0 : 1;
      for (let s = startS; s < FILL_SAMPLING; s++) {
        const t = s / (FILL_SAMPLING - 1);
        const [x, y, z] = cubicBezierAt(a0, h1, h2, a1, t);
        coords2D.push(x, y);
        verts3D.push(x, y, z);
      }
    }
  }

  if (verts3D.length === 0) return geo;

  // Triangulate.
  const indices = earcut(coords2D, holeIndices.length > 0 ? holeIndices : undefined, 2);

  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(verts3D, 3),
  );
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}
