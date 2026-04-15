/**
 * mobject_adapter.ts
 *
 * Registry-based dispatcher: converts any manim-ts IMobject to a three.js
 * Object3D.  New mobject types can register themselves via `registerAdapter`.
 *
 * Built-in dispatch table:
 *   VGroup / group-like  → THREE.Group  (children adapted recursively)
 *   ImageMobject         → THREE.Mesh + MeshBasicMaterial({ map: DataTexture })
 *   Surface              → SurfaceAdapter.group (indexed mesh + checkerboard vertex colors)
 *   Polyhedron           → PolyhedronAdapter  (indexed mesh + optional wireframe)
 *   VMobject             → VMobjectAdapter.group
 *
 * Dispatch walks the prototype chain from most-derived to least-derived, so
 * registering VGroup separately from VMobject works correctly without ordering
 * constraints.
 */

import * as THREE from "three";
import type { IMobject } from "../../../core/types.js";
import { VMobjectAdapter } from "./vmobject_adapter.js";
import { SurfaceAdapter } from "./surface_adapter.js";
import { polyhedronToThree } from "./polyhedron_adapter.js";
import {
  VMobject,
  VGroup,
} from "../../../mobject/types/vectorized_mobject.js";
import { ImageMobject } from "../../../mobject/types/image_mobject/image_mobject.js";
import { Surface } from "../../../mobject/three_d/three_dimensions.js";
import { Polyhedron } from "../../../mobject/three_d/polyhedra.js";

// ── Registry ──────────────────────────────────────────────────────────────────

/** Factory: receives the mobject, returns the matching three.js Object3D. */
export type AdapterFactory = (mob: IMobject) => THREE.Object3D;

/**
 * Global registry: constructor → adapter factory.
 * Dispatch uses prototype-chain traversal, so the most-derived registered
 * class wins automatically.
 */
const registry = new Map<Function, AdapterFactory>();

/**
 * Register an adapter factory for `cls`.
 * Subclasses of `cls` automatically inherit the factory unless they have a
 * more-specific registration.
 */
export function registerAdapter(cls: Function, factory: AdapterFactory): void {
  registry.set(cls, factory);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Convert `mob` to a three.js Object3D.
 *
 * Walks the prototype chain from the actual instance class upward, returning
 * the result from the first matching factory.  Returns an empty THREE.Group
 * if no adapter is registered for the mobject's class hierarchy.
 */
export function mobjectToThree(mob: IMobject): THREE.Object3D {
  let proto: object | null = mob;
  while (proto !== null) {
    const ctor = (proto as { constructor?: Function }).constructor;
    if (ctor !== undefined) {
      const factory = registry.get(ctor);
      if (factory !== undefined) return factory(mob);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  // Unknown mobject type — return empty group to preserve scene-graph integrity
  return new THREE.Group();
}

// ── Built-in registrations ─────────────────────────────────────────────────
//
// VGroup is registered before VMobject so that prototype-chain traversal
// reaches VGroup first for VGroup instances.  (Both are registered; dispatch
// walks most-derived → least-derived, so a VGroup instance finds VGroup's
// entry before it reaches VMobject's entry.)

// VGroup → recursive group
registerAdapter(VGroup, (mob: IMobject): THREE.Object3D => {
  const group = new THREE.Group();
  for (const child of mob.submobjects) {
    group.add(mobjectToThree(child));
  }
  return group;
});

// ImageMobject → Mesh + DataTexture
registerAdapter(ImageMobject, (mob: IMobject): THREE.Object3D => {
  const img = mob as unknown as ImageMobject;
  const shape = img.pixelArray.shape as number[];
  const H = shape[0];
  const W = shape[1];

  // Convert NDArray [H, W, 4] to Uint8Array
  const flat = img.pixelArray.flatten().toArray() as number[];
  const data = Uint8Array.from(flat);

  const tex = new THREE.DataTexture(
    data,
    W,
    H,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.flipY = true; // WebGL origin is bottom-left; pixel arrays are top-left
  tex.needsUpdate = true;

  const aspect = W / H;
  const geo = new THREE.PlaneGeometry(aspect, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
});

// Surface → SurfaceAdapter (indexed mesh + checkerboard vertex colors)
registerAdapter(Surface, (mob: IMobject): THREE.Object3D => {
  const adapter = new SurfaceAdapter(mob as unknown as Surface);
  return adapter.group;
});

// Polyhedron → indexed mesh + optional wireframe (via PolyhedronAdapter)
registerAdapter(Polyhedron, (mob: IMobject): THREE.Object3D =>
  polyhedronToThree(mob as unknown as Polyhedron),
);

// VMobject (most generic — registered last so more-specific entries win)
registerAdapter(VMobject, (mob: IMobject): THREE.Object3D => {
  const adapter = new VMobjectAdapter(mob as unknown as VMobject);
  return adapter.group;
});
