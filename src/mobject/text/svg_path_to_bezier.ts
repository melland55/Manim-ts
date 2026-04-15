/**
 * SVG path d-attribute → VMobject cubic bezier Points3D.
 *
 * Converts an SVG `d` string into a Points3D in Manim's 3k+1 layout:
 *   anchor₀, handle1₀, handle2₀, anchor₁, handle1₁, handle2₁, anchor₂, …
 *
 * Uses svg-path-commander's `toCurve()` to normalise every segment to
 * absolute cubic bezier form (M + C only), so no quadratic-to-cubic or
 * arc-to-cubic conversion is needed here.
 *
 * Multiple subpaths (M commands after the first) are returned as separate
 * Points3D arrays by `svgPathToSubpaths`, and concatenated (boundary info
 * preserved implicitly) by `svgPathToPoints`.  Callers that need correct
 * per-subpath rendering (e.g. letter holes) should use `svgPathToSubpaths`
 * to build a VMobject via `startNewPath` + `addCubicBezierCurveTo`.
 */

import SVGPathCommander from "svg-path-commander";
import type { MSegment, CSegment, PathSegment } from "svg-path-commander";
import { np } from "../../core/math/index.js";
import type { Points3D } from "../../core/math/index.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Given a list of (M + C*) segments representing ONE contiguous subpath,
 * return a Points3D in 3k+1 layout, or null if the subpath has no curves.
 *
 * Layout:  anchor₀  [h1 h2 anchor]₁  [h1 h2 anchor]₂  …
 */
function buildSubpathPoints(segs: PathSegment[]): Points3D | null {
  const rows: number[][] = [];
  let anchorAdded = false;

  for (const seg of segs) {
    if (seg[0] === "M") {
      const m = seg as MSegment;
      if (!anchorAdded) {
        rows.push([m[1], m[2], 0]);
        anchorAdded = true;
      }
      // If there were somehow multiple M segments passed in, skip extras.
    } else if (seg[0] === "C") {
      const c = seg as CSegment;
      // c = ['C', cp1x, cp1y, cp2x, cp2y, ex, ey]
      rows.push([c[1], c[2], 0]); // handle 1
      rows.push([c[3], c[4], 0]); // handle 2
      rows.push([c[5], c[6], 0]); // anchor
    }
    // After toCurve() the only commands are M and C; nothing else to handle.
  }

  // Need at least anchor + h1 + h2 + anchor = 4 rows (one cubic).
  if (rows.length < 4) return null;

  return np.array(rows) as Points3D;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an SVG `d` string and return one `Points3D` per subpath.
 *
 * Each element is in Manim's 3k+1 cubic bezier layout.  The array will be
 * empty for a blank or unparseable `d` string.
 *
 * Use this when you need to load a multi-contour glyph into a VMobject with
 * correct subpath tracking:
 *
 * ```typescript
 * const vmob = new VMobject();
 * for (const sp of svgPathToSubpaths(d)) {
 *   const n = sp.shape[0];
 *   vmob.startNewPath(np.array([sp.get([0,0]), sp.get([0,1]), sp.get([0,2])]));
 *   for (let i = 1; i < n; i += 3) {
 *     vmob.addCubicBezierCurveTo(
 *       np.array([sp.get([i,  0]), sp.get([i,  1]), sp.get([i,  2])]),
 *       np.array([sp.get([i+1,0]), sp.get([i+1,1]), sp.get([i+1,2])]),
 *       np.array([sp.get([i+2,0]), sp.get([i+2,1]), sp.get([i+2,2])]),
 *     );
 *   }
 * }
 * ```
 */
export function svgPathToSubpaths(d: string): Points3D[] {
  if (!d || d.trim() === "") return [];

  let curveSegs: PathSegment[];
  try {
    curveSegs = (new SVGPathCommander(d).toCurve() as { segments: PathSegment[] }).segments;
  } catch {
    return [];
  }

  // Split the flat segment list into groups, one group per M command.
  const groups: PathSegment[][] = [];
  let current: PathSegment[] | null = null;

  for (const seg of curveSegs) {
    if (seg[0] === "M") {
      current = [seg];
      groups.push(current);
    } else if (current !== null) {
      current.push(seg);
    }
  }

  // Build a Points3D for each group, discarding empty ones.
  const result: Points3D[] = [];
  for (const group of groups) {
    const pts = buildSubpathPoints(group);
    if (pts !== null) result.push(pts);
  }
  return result;
}

/**
 * Parse an SVG `d` string and return all bezier points as a single Points3D
 * in Manim's 3k+1 layout.  Multiple subpaths are concatenated in order.
 *
 * The returned array matches what `VMobject.points` holds after loading the
 * path via `startNewPath` + `addCubicBezierCurveTo` for each subpath.
 * Callers that assign the result directly to `vmob.points` must also set
 * `vmob._subpathStarts` (or use `svgPathToSubpaths` + the VMobject API) for
 * correct multi-subpath rendering.
 *
 * Returns an empty [0, 3] array for a blank or unparseable `d` string.
 */
export function svgPathToPoints(d: string): Points3D {
  const subpaths = svgPathToSubpaths(d);
  if (subpaths.length === 0) return np.zeros([0, 3]) as Points3D;
  if (subpaths.length === 1) return subpaths[0];

  // Concatenate all subpath arrays into one flat Points3D.
  const allRows: number[][] = [];
  for (const sp of subpaths) {
    const n = sp.shape[0];
    for (let i = 0; i < n; i++) {
      allRows.push([
        sp.get([i, 0]) as number,
        sp.get([i, 1]) as number,
        sp.get([i, 2]) as number,
      ]);
    }
  }
  return np.array(allRows) as Points3D;
}
