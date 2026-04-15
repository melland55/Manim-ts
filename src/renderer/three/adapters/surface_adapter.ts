/**
 * SurfaceAdapter — bridges a manim-ts Surface / ParametricSurface to a
 * three.js Mesh backed by an indexed BufferGeometry + MeshStandardMaterial.
 *
 * Geometry is built from `surface.listOfFaces`: each ThreeDVMobject in the
 * list carries world-space anchor points (the uv-grid samples have already
 * been run through the parametric function by the Surface constructor).
 *
 * Checkerboard colors are realized as per-face vertex colors.  Vertices are
 * NOT shared across faces so that each face can carry a uniform solid color
 * independent of its neighbours.  Per-vertex normals are computed after
 * triangulation via `geometry.computeVertexNormals()`.
 *
 * When `surface.checkerboardColors` is `false` the base `fillColor` of each
 * face is used instead — so the adapter degrades gracefully to a solid-color
 * surface.
 */

import * as THREE from "three";
import earcut from "earcut";
import { ManimColor } from "../../../utils/color/core.js";
import {
  Surface,
  type ThreeDVMobject,
} from "../../../mobject/three_d/three_dimensions.js";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Extract [r, g, b] from a ManimColor-compatible color. */
function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
  return [c.r, c.g, c.b];
}

// ── SurfaceAdapter ────────────────────────────────────────────────────────────

export class SurfaceAdapter {
  /** The three.js Object3D to add to the scene. */
  readonly group: THREE.Group;

  private _surface: Surface;
  private _mesh: THREE.Mesh;
  private _geo: THREE.BufferGeometry;
  private _mat: THREE.MeshStandardMaterial;

  constructor(surface: Surface) {
    this._surface = surface;
    this.group = new THREE.Group();
    const { geo, mat } = this._build();
    this._geo = geo;
    this._mat = mat;
    this._mesh = new THREE.Mesh(geo, mat);
    this.group.add(this._mesh);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Re-read the surface's faces and style; rebuild geometry and material.
   * Call this whenever the surface's parametric function or style changes.
   */
  update(): void {
    this._geo.dispose();
    this._mat.dispose();
    const { geo, mat } = this._build();
    this._geo = geo;
    this._mat = mat;
    this._mesh.geometry = geo;
    this._mesh.material = mat;
  }

  /** Dispose all GPU resources. Call when the adapter is no longer needed. */
  dispose(): void {
    this._geo.dispose();
    this._mat.dispose();
    if (this.group.parent !== null) {
      this.group.parent.remove(this.group);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _build(): { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial } {
    const surface = this._surface;
    const cbColors = surface.checkerboardColors;
    const useCheckerboard = cbColors !== false && cbColors.length > 0;

    // Flat CPU buffers — vertices are NOT shared across faces so each face can
    // carry a uniform color (per-face coloring via per-vertex attribute).
    const positions: number[] = [];
    const vertexColors: number[] = [];
    const indices: number[] = [];
    let vertOffset = 0;

    for (const face of surface.listOfFaces) {
      const anchors = face.getAnchors(); // NDArray shape [n, 3] — world space
      const n = anchors.shape[0] as number;
      if (n < 3) continue;

      // ── Face color ──────────────────────────────────────────────────────────
      let faceRGB: [number, number, number];
      if (useCheckerboard) {
        const colorList = cbColors as ManimColor[];
        const cIdx = (face.uIndex + face.vIndex) % colorList.length;
        faceRGB = rgb(colorList[cIdx]);
      } else {
        faceRGB = rgb(face.fillColor);
      }

      // ── Vertex deduplication ────────────────────────────────────────────────
      // Surface faces are closed quads: the last anchor repeats the first.
      // Drop the closing vertex so earcut receives a clean polygon.
      const x0 = anchors.get([0, 0]) as number;
      const y0 = anchors.get([0, 1]) as number;
      const z0 = anchors.get([0, 2]) as number;
      const xl = anchors.get([n - 1, 0]) as number;
      const yl = anchors.get([n - 1, 1]) as number;
      const zl = anchors.get([n - 1, 2]) as number;
      const closingIsDuplicate =
        n > 3 &&
        Math.abs(x0 - xl) < 1e-9 &&
        Math.abs(y0 - yl) < 1e-9 &&
        Math.abs(z0 - zl) < 1e-9;
      const vertCount = closingIsDuplicate ? n - 1 : n;

      // ── Positions + colors ──────────────────────────────────────────────────
      for (let i = 0; i < vertCount; i++) {
        positions.push(
          anchors.get([i, 0]) as number,
          anchors.get([i, 1]) as number,
          anchors.get([i, 2]) as number,
        );
        vertexColors.push(faceRGB[0], faceRGB[1], faceRGB[2]);
      }

      // ── Triangulation ───────────────────────────────────────────────────────
      // Fast path for quads: emit two triangles directly without earcut.
      if (vertCount === 4) {
        indices.push(
          vertOffset,     vertOffset + 1, vertOffset + 2,
          vertOffset,     vertOffset + 2, vertOffset + 3,
        );
      } else {
        // General polygon: triangulate via earcut using XY projection.
        // Near-planar surface patches are sufficiently well-represented.
        const flat: number[] = [];
        for (let i = 0; i < vertCount; i++) {
          flat.push(
            anchors.get([i, 0]) as number,
            anchors.get([i, 1]) as number,
          );
        }
        const tris = earcut(flat);
        for (const idx of tris) {
          indices.push(vertOffset + idx);
        }
      }

      vertOffset += vertCount;
    }

    // ── BufferGeometry ──────────────────────────────────────────────────────
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(vertexColors, 3),
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // ── Material ────────────────────────────────────────────────────────────
    const opacity = surface.fillOpacity;
    const mat = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
      opacity,
      transparent: opacity < 1,
      depthWrite: opacity >= 1,
    });

    return { geo, mat };
  }
}
