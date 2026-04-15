/**
 * family_syncer.ts
 *
 * FamilySyncer diffs the scene's mobject family against the mounted three.js
 * group each frame:
 *   - Adds adapters for newly-added mobjects.
 *   - Removes + disposes adapters for removed mobjects.
 *   - Calls adapter.update() on every surviving mobject (treated as dirty).
 *
 * Maintains a Map<IMobject, Adapter> keyed by identity so multiple references
 * to the same mobject object are never double-counted.
 */

import * as THREE from "three";
import type { IMobject } from "../../core/types.js";
import { VMobjectAdapter } from "./adapters/vmobject_adapter.js";
import { mobjectToThree } from "./adapters/mobject_adapter.js";
import { VMobject } from "../../mobject/types/vectorized_mobject.js";

// ── Adapter contract ───────────────────────────────────────────────────────────

/**
 * Minimal interface that every mobject-to-three bridge must satisfy.
 * FamilySyncer works against this interface, not against concrete classes.
 */
export interface Adapter {
  /** The three.js object mounted in the scene group. */
  readonly object3d: THREE.Object3D;
  /** Re-sync object3d to the current mobject state (called every frame). */
  update(): void;
  /** Release GPU resources. FamilySyncer removes object3d from the group first. */
  dispose(): void;
}

// ── Adapter implementations ────────────────────────────────────────────────────

/**
 * Wraps VMobjectAdapter (which owns update/dispose logic) to satisfy Adapter.
 * Uses VMobjectAdapter.group as the mounted Object3D.
 */
class VMobjectAdapterBridge implements Adapter {
  readonly object3d: THREE.Object3D;
  private readonly inner: VMobjectAdapter;

  constructor(mob: VMobject) {
    this.inner = new VMobjectAdapter(mob);
    this.object3d = this.inner.group;
  }

  update(): void {
    this.inner.update();
  }

  dispose(): void {
    this.inner.dispose();
  }
}

/**
 * Wraps a static three.js Object3D built via the mobjectToThree registry.
 * No per-frame update — used for ImageMobject, Surface, Polyhedron, etc.
 */
class GenericAdapter implements Adapter {
  readonly object3d: THREE.Object3D;

  constructor(mob: IMobject) {
    this.object3d = mobjectToThree(mob);
  }

  update(): void {
    // Generic mobjects have no per-frame update path yet.
  }

  dispose(): void {
    // Recursively dispose geometries and materials before the object is removed.
    this.object3d.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          for (const m of child.material) m.dispose();
        } else {
          (child.material as THREE.Material).dispose();
        }
      }
    });
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

function createAdapter(mob: IMobject): Adapter {
  if (mob instanceof VMobject) {
    return new VMobjectAdapterBridge(mob);
  }
  return new GenericAdapter(mob);
}

// ── FamilySyncer ───────────────────────────────────────────────────────────────

/**
 * Diffs the scene's mobject family against the mounted three.js group each frame.
 *
 * Typical usage:
 *
 * ```ts
 * const syncer = new FamilySyncer(threeGroup);
 *
 * // each animation frame:
 * const family = scene.mobjects.flatMap((m) => m.getFamily());
 * syncer.sync(family);
 * ```
 */
export class FamilySyncer {
  /** The three.js group that owns all mounted adapter objects. */
  private readonly group: THREE.Group;

  /** Map from mobject identity → adapter. */
  private readonly adapters: Map<IMobject, Adapter> = new Map();

  constructor(group: THREE.Group) {
    this.group = group;
  }

  /**
   * Synchronise `currentFamily` (the complete flat list of mobjects that should
   * be visible this frame) against the current adapter map.
   *
   * New mobjects   → adapter created, object3d added to group.
   * Removed ones   → object3d removed from group, adapter disposed, entry deleted.
   * Surviving ones → adapter.update() called (all treated as dirty for now).
   */
  sync(currentFamily: IMobject[]): void {
    const currentSet = new Set<IMobject>(currentFamily);

    // ── Remove stale adapters ──────────────────────────────────────────────────
    for (const [mob, adapter] of this.adapters) {
      if (!currentSet.has(mob)) {
        this.group.remove(adapter.object3d);
        adapter.dispose();
        this.adapters.delete(mob);
      }
    }

    // ── Add new adapters; update surviving ones ────────────────────────────────
    for (let i = 0; i < currentFamily.length; i++) {
      const mob = currentFamily[i];
      const existing = this.adapters.get(mob);
      let adapterObject: THREE.Object3D;
      if (existing === undefined) {
        const adapter = createAdapter(mob);
        this.group.add(adapter.object3d);
        this.adapters.set(mob, adapter);
        adapterObject = adapter.object3d;
      } else {
        existing.update();
        adapterObject = existing.object3d;
      }

      // Assign renderOrder based on family order so later-added mobjects draw
      // on top of earlier ones — matches Python Manim's VGroup(…) semantics
      // where later children paint over earlier ones. Without this, three.js
      // falls back to depth-sort (unstable for co-planar z=0 geometry) and
      // VGroup order becomes random on screen.
      //
      // Also nudge each adapter along +Z by a tiny increment: belt-and-suspenders
      // for environments where `renderOrder` is ignored (custom sort fns,
      // debug overlays, etc.). 1e-4 per index × up to a few hundred family
      // members stays well inside the ortho frustum's [0.1, 1000] depth range.
      adapterObject.renderOrder = i;
      adapterObject.position.z = i * 1e-4;
      adapterObject.traverse((child) => {
        child.renderOrder = i;
      });
    }
    if (typeof console !== "undefined") {
      console.log("[FamilySyncer] v2 ordering applied to", currentFamily.length, "mobjects");
      // Dump every mesh's renderOrder + name + world-z so we can see what
      // three.js actually sees when it sorts.
      let idx = 0;
      for (const [mob, adapter] of this.adapters) {
        const className = (mob as { constructor: { name: string } }).constructor.name;
        const meshes: string[] = [];
        adapter.object3d.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            meshes.push(`  mesh rO=${child.renderOrder}`);
          }
        });
        console.log(`  [${idx}] ${className} (adapter.rO=${adapter.object3d.renderOrder}, z=${adapter.object3d.position.z})\n${meshes.join("\n")}`);
        idx++;
      }
    }
  }

  /**
   * Dispose every adapter and clear the internal map.
   * Call this when the renderer is torn down or the scene is reset.
   */
  disposeAll(): void {
    for (const adapter of this.adapters.values()) {
      this.group.remove(adapter.object3d);
      adapter.dispose();
    }
    this.adapters.clear();
  }

  /** Read-only view of the current adapter map (useful for debugging). */
  get adapterCount(): number {
    return this.adapters.size;
  }
}
