/**
 * PolyhedronAdapter — converts a manim-ts Polyhedron to a THREE.Mesh with an
 * optional wireframe LineSegments child.
 *
 * Triangulation projects each face onto its own local 2D plane (Newell's
 * method for the face normal, then Gram-Schmidt for the tangent basis) before
 * calling earcut.  This correctly handles non-XY-aligned polygons such as the
 * pentagonal faces of the Dodecahedron.
 */

import * as THREE from "three";
import earcut from "earcut";
import type { Polyhedron } from "../../../mobject/three_d/polyhedra.js";

// ── Local-plane triangulation ─────────────────────────────────────────────────

/**
 * Triangulate a convex or concave planar polygon using earcut.
 *
 * Returns an array of global vertex indices (triples form triangles).
 * Uses Newell's method to derive the face normal, then projects vertices
 * onto a local (u, v) tangent frame before calling earcut.
 */
function triangulateFace(face: number[], vertexCoords: number[][]): number[] {
  if (face.length < 3) return [];
  if (face.length === 3) return [face[0], face[1], face[2]];

  const verts = face.map((i) => vertexCoords[i]);
  const n = verts.length;

  // Newell's method — accumulates a normal proportional to the signed area
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const cur = verts[i];
    const nxt = verts[(i + 1) % n];
    nx += (cur[1] - nxt[1]) * (cur[2] + nxt[2]);
    ny += (cur[2] - nxt[2]) * (cur[0] + nxt[0]);
    nz += (cur[0] - nxt[0]) * (cur[1] + nxt[1]);
  }

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-10) return [];
  nx /= len;
  ny /= len;
  nz /= len;

  // Tangent u — pick a world axis not parallel to the normal, then Gram-Schmidt
  let ux = 1, uy = 0, uz = 0;
  if (Math.abs(nx) > 0.9) {
    ux = 0;
    uy = 1;
    uz = 0;
  }
  const d = ux * nx + uy * ny + uz * nz;
  ux -= d * nx;
  uy -= d * ny;
  uz -= d * nz;
  const ulen = Math.sqrt(ux * ux + uy * uy + uz * uz);
  ux /= ulen;
  uy /= ulen;
  uz /= ulen;

  // Bitangent v = normal × u
  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;

  // Project each vertex onto (u, v)
  const flat: number[] = [];
  for (const v of verts) {
    flat.push(
      v[0] * ux + v[1] * uy + v[2] * uz,
      v[0] * vx + v[1] * vy + v[2] * vz,
    );
  }

  const localTris = earcut(flat);
  return localTris.map((li) => face[li]);
}

// ── Geometry builders ─────────────────────────────────────────────────────────

/**
 * Build an indexed BufferGeometry + MeshStandardMaterial for a Polyhedron.
 *
 * Vertex positions are taken from `poly.vertexCoords`; face connectivity from
 * `poly.facesList`.  Non-triangular faces are triangulated via
 * `triangulateFace`.  Vertex normals are computed by three.js from the index
 * buffer.
 */
function buildPolyhedronGeometry(poly: Polyhedron): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const v of poly.vertexCoords) {
    positions.push(v[0], v[1], v[2]);
  }

  const indices: number[] = [];
  for (const face of poly.facesList) {
    const tris = triangulateFace(face, poly.vertexCoords);
    for (const idx of tris) {
      indices.push(idx);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a LineSegments geometry from the Polyhedron's edge list.
 *
 * Each entry in `poly.edges` is a `[a, b]` pair of vertex indices.  Duplicate
 * edges (wound in both directions by `getEdges`) are deduplicated so each
 * physical edge renders exactly once.
 */
function buildWireframeGeometry(poly: Polyhedron): THREE.BufferGeometry {
  const positions: number[] = [];
  const seen = new Set<string>();

  for (const [a, b] of poly.edges) {
    // Canonicalise direction so each edge appears once
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const va = poly.vertexCoords[a];
    const vb = poly.vertexCoords[b];
    positions.push(va[0], va[1], va[2], vb[0], vb[1], vb[2]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geo;
}

// ── PolyhedronAdapter ─────────────────────────────────────────────────────────

export interface PolyhedronAdapterOptions {
  /** Render edge wireframe as a LineSegments child. Default: true. */
  wireframe?: boolean;
  /** THREE colour integer for the wireframe. Default: 0x000000 (black). */
  wireframeColor?: number;
  /** Wireframe line opacity in [0, 1]. Default: 0.6. */
  wireframeOpacity?: number;
}

/**
 * Adapter that converts a manim-ts Polyhedron into a three.js Object3D
 * subtree suitable for direct insertion into a THREE.Scene.
 *
 * ```ts
 * const adapter = new PolyhedronAdapter(poly, { wireframe: true });
 * scene.add(adapter.group);
 * // … later …
 * adapter.dispose();
 * ```
 */
export class PolyhedronAdapter {
  /** Top-level container — add this to your THREE.Scene or parent group. */
  readonly group: THREE.Group;
  /** The solid face mesh. */
  readonly mesh: THREE.Mesh;
  /** The edge wireframe, or null when wireframe is disabled. */
  readonly wireframeLines: THREE.LineSegments | null;

  constructor(poly: Polyhedron, options: PolyhedronAdapterOptions = {}) {
    const {
      wireframe = true,
      wireframeColor = 0x000000,
      wireframeOpacity = 0.6,
    } = options;

    this.group = new THREE.Group();

    // ── Solid mesh ────────────────────────────────────────────────────────────
    const geo = buildPolyhedronGeometry(poly);
    const mat = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity:
        typeof poly.facesConfig.fillOpacity === "number"
          ? (poly.facesConfig.fillOpacity as number)
          : 0.5,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);

    // ── Wireframe edges ───────────────────────────────────────────────────────
    if (wireframe) {
      const wireGeo = buildWireframeGeometry(poly);
      const wireMat = new THREE.LineBasicMaterial({
        color: wireframeColor,
        transparent: wireframeOpacity < 1,
        opacity: wireframeOpacity,
      });
      this.wireframeLines = new THREE.LineSegments(wireGeo, wireMat);
      this.group.add(this.wireframeLines);
    } else {
      this.wireframeLines = null;
    }
  }

  /**
   * Release all GPU resources.  Call when the mobject is removed from the scene.
   */
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();

    if (this.wireframeLines !== null) {
      this.wireframeLines.geometry.dispose();
      (this.wireframeLines.material as THREE.Material).dispose();
    }

    if (this.group.parent !== null) {
      this.group.parent.remove(this.group);
    }
  }
}

// ── Convenience factory ───────────────────────────────────────────────────────

/**
 * Functional helper used by the mobject adapter registry.
 * Returns the root THREE.Group for the polyhedron.
 */
export function polyhedronToThree(
  poly: Polyhedron,
  options?: PolyhedronAdapterOptions,
): THREE.Object3D {
  return new PolyhedronAdapter(poly, options).group;
}
