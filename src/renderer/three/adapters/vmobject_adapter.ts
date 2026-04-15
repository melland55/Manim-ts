/**
 * VMobjectAdapter — bridges a manim-ts VMobject to a three.js scene graph.
 *
 * Maintains one THREE.Group per VMobject containing:
 *   - A Line2 (fat stroke, world-space width) for the stroke path.
 *   - A THREE.Mesh (MeshBasicMaterial) for the fill, when fillOpacity > 0.
 *
 * Call update() whenever the VMobject's points or style change.
 * Call dispose() when the VMobject is removed from the scene.
 */

import * as THREE from "three";
import { ManimColor } from "../../../utils/color/core.js";
import {
  vmobjectToStrokeMesh,
  vmobjectToFillGeometry,
  WORLD_UNITS_PER_STROKE_PX,
} from "../three_geometry.js";
import { makeStrokeMaterial, makeFillMaterial } from "../three_materials.js";
import type { VMobject } from "../../../mobject/types/vectorized_mobject.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert an IColor to a ManimColor instance (no-op if already one). */
function toManimColor(c: { r: number; g: number; b: number; a: number }): ManimColor {
  return new ManimColor([c.r, c.g, c.b, c.a]);
}

/** Return whether two colors differ (component-wise, ~1/255 tolerance). */
function colorsEqual(
  a: { r: number; g: number; b: number; a: number },
  b: { r: number; g: number; b: number; a: number },
): boolean {
  const eps = 1 / 255;
  return (
    Math.abs(a.r - b.r) < eps &&
    Math.abs(a.g - b.g) < eps &&
    Math.abs(a.b - b.b) < eps &&
    Math.abs(a.a - b.a) < eps
  );
}

// ── VMobjectAdapter ───────────────────────────────────────────────────────────

export class VMobjectAdapter {
  /** The three.js group to add to the scene. */
  readonly group: THREE.Group;

  private vm: VMobject;

  // Stroke objects (always allocated; hidden when strokeWidth === 0).
  // Rendered as a single ribbon mesh, NOT Line2 — see three_geometry.ts
  // vmobjectToStrokeMesh for why (overlap-at-joint alpha artifacts).
  private strokeMesh: THREE.Mesh;
  private strokeGeo: THREE.BufferGeometry;
  private strokeMat: THREE.MeshBasicMaterial;

  // Fill objects (allocated on first use)
  private fillMesh: THREE.Mesh | null = null;
  private fillGeo: THREE.BufferGeometry | null = null;
  private fillMat: THREE.MeshBasicMaterial | null = null;

  // Cached style values for in-place material updates
  private _lastStrokeColor: { r: number; g: number; b: number; a: number };
  private _lastStrokeOpacity: number;
  private _lastStrokeWidth: number;
  private _lastFillColor: { r: number; g: number; b: number; a: number };
  private _lastFillOpacity: number;

  // Geometry-rebuild dirty tracking. Stroke and fill geo are expensive to
  // rebuild (bezier sampling + miter math / earcut); only redo when the
  // VMobject's points reference OR stroke width actually changed.
  private _lastPointsRef: unknown = null;
  private _lastStrokeWidthForGeo: number = -1;
  private _lastPointsRefForFill: unknown = null;

  constructor(vm: VMobject) {
    this.vm = vm;
    this.group = new THREE.Group();

    // Initialise stroke objects — ribbon mesh, not Line2.
    const worldWidth = vm.strokeWidth * WORLD_UNITS_PER_STROKE_PX;
    this.strokeGeo = vmobjectToStrokeMesh(vm.points, worldWidth);
    this.strokeMat = makeStrokeMaterial(
      toManimColor(vm.strokeColor),
      vm.strokeWidth,
      vm.strokeOpacity,
    );
    this.strokeMesh = new THREE.Mesh(this.strokeGeo, this.strokeMat);
    this.group.add(this.strokeMesh);

    // Cache current style
    this._lastStrokeColor = { ...vm.strokeColor };
    this._lastStrokeOpacity = vm.strokeOpacity;
    this._lastStrokeWidth = vm.strokeWidth;
    this._lastFillColor = { ...vm.fillColor };
    this._lastFillOpacity = vm.fillOpacity;
    this._lastPointsRef = vm.points;
    this._lastStrokeWidthForGeo = vm.strokeWidth;
    this._lastPointsRefForFill = vm.points;

    // Build fill on construction if needed
    if (vm.fillOpacity > 0) {
      this._rebuildFill();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Re-read the VMobject's points and style; update geometries and materials
   * in place where possible.
   */
  update(): void {
    const vm = this.vm;

    // ── Stroke ──────────────────────────────────────────────────────────────
    if (vm.strokeWidth > 0) {
      // Rebuild ribbon geometry only when points or stroke width changed.
      // Width is baked into the ribbon (extruded), so width changes require
      // a full rebuild — material opacity/color updates don't.
      const pointsChanged = vm.points !== this._lastPointsRef;
      const widthChanged = vm.strokeWidth !== this._lastStrokeWidthForGeo;
      if (pointsChanged || widthChanged) {
        const worldWidth = vm.strokeWidth * WORLD_UNITS_PER_STROKE_PX;
        this.strokeGeo.dispose();
        this.strokeGeo = vmobjectToStrokeMesh(vm.points, worldWidth);
        this.strokeMesh.geometry = this.strokeGeo;
        this._lastPointsRef = vm.points;
        this._lastStrokeWidthForGeo = vm.strokeWidth;
      }
      this.strokeMesh.visible = true;

      if (!colorsEqual(vm.strokeColor, this._lastStrokeColor)) {
        const mc = toManimColor(vm.strokeColor);
        this.strokeMat.color.set(mc.toHex(false));
        this._lastStrokeColor = { ...vm.strokeColor };
      }
      if (vm.strokeOpacity !== this._lastStrokeOpacity) {
        this.strokeMat.opacity = vm.strokeOpacity;
        this._lastStrokeOpacity = vm.strokeOpacity;
      }
      this._lastStrokeWidth = vm.strokeWidth;
    } else {
      this.strokeMesh.visible = false;
    }

    // ── Fill ────────────────────────────────────────────────────────────────
    if (vm.fillOpacity > 0) {
      if (this.fillMesh === null) {
        // First time fill is needed
        this._rebuildFill();
        this._lastPointsRefForFill = vm.points;
      } else {
        // Rebuild fill geometry only when points actually changed.
        if (vm.points !== this._lastPointsRefForFill) {
          this.fillGeo!.dispose();
          const subpaths = vm.getSubpaths();
          this.fillGeo =
            subpaths.length > 0
              ? vmobjectToFillGeometry(...subpaths)
              : new THREE.BufferGeometry();
          this.fillMesh.geometry = this.fillGeo;
          this._lastPointsRefForFill = vm.points;
        }

        // Update fill material in place
        if (!colorsEqual(vm.fillColor, this._lastFillColor)) {
          const mc = toManimColor(vm.fillColor);
          this.fillMat!.color.set(mc.toHex(false));
          this._lastFillColor = { ...vm.fillColor };
        }
        if (vm.fillOpacity !== this._lastFillOpacity) {
          this.fillMat!.opacity = vm.fillOpacity;
          this.fillMat!.transparent = vm.fillOpacity < 1;
          this.fillMat!.depthWrite = vm.fillOpacity >= 1;
          this._lastFillOpacity = vm.fillOpacity;
        }

        this.fillMesh.visible = true;
      }
    } else if (this.fillMesh !== null) {
      this.fillMesh.visible = false;
    }
  }

  /**
   * Dispose all GPU resources. Call when this adapter is no longer needed.
   */
  dispose(): void {
    this.strokeGeo.dispose();
    this.strokeMat.dispose();

    if (this.fillGeo !== null) this.fillGeo.dispose();
    if (this.fillMat !== null) this.fillMat.dispose();

    // Remove from parent if attached
    if (this.group.parent !== null) {
      this.group.parent.remove(this.group);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _rebuildFill(): void {
    const vm = this.vm;
    const subpaths = vm.getSubpaths();

    const geo =
      subpaths.length > 0
        ? vmobjectToFillGeometry(...subpaths)
        : new THREE.BufferGeometry();

    const mat = makeFillMaterial(
      toManimColor(vm.fillColor),
      vm.fillOpacity,
    );

    const mesh = new THREE.Mesh(geo, mat);

    if (this.fillMesh !== null) {
      // Replace existing mesh
      this.group.remove(this.fillMesh);
      this.fillGeo!.dispose();
      this.fillMat!.dispose();
    }

    this.fillGeo = geo;
    this.fillMat = mat;
    this.fillMesh = mesh;

    // Insert fill behind stroke so it renders first
    this.group.children.unshift(mesh);
    mesh.parent = this.group;

    this._lastFillColor = { ...vm.fillColor };
    this._lastFillOpacity = vm.fillOpacity;
  }
}
