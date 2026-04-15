import * as THREE from "three";

/**
 * Adds a default three-point lighting rig to a THREE.Scene.
 *
 * - AmbientLight (0.4 intensity) — soft fill across all surfaces
 * - Key DirectionalLight at (5, 5, 10) — primary light source
 * - Fill DirectionalLight at (-5, 2, 5) — low-intensity counter-light
 *
 * Called automatically by ThreeScene when any 3D mobject is first added.
 */
export function defaultLightingRig(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 5, 10);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-5, 2, 5);
  scene.add(fill);
}
