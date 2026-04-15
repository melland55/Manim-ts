import * as THREE from "three";

/**
 * Creates an OrthographicCamera whose world units map 1:1 to Manim scene coords.
 * Manim frame: x ∈ [-fw/2, +fw/2], y ∈ [-fh/2, +fh/2], origin at center.
 */
export function makeOrthoCamera(
  frameWidth: number,
  frameHeight: number
): THREE.OrthographicCamera {
  const hw = frameWidth / 2;
  const hh = frameHeight / 2;
  const camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Creates a PerspectiveCamera positioned so that a frameHeight-tall object
 * at z=0 exactly fills the vertical extent of the view — matching Python
 * Manim's ThreeDCamera default distance calculation.
 *
 * distance = (frameHeight / 2) / tan(fovRad / 2)
 */
export function makePerspectiveCamera(
  frameWidth: number,
  frameHeight: number,
  fovDeg: number = 50
): THREE.PerspectiveCamera {
  const aspect = frameWidth / frameHeight;
  const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 1000);

  const fovRad = (fovDeg * Math.PI) / 180;
  const distance = frameHeight / 2 / Math.tan(fovRad / 2);

  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Applies Manim's spherical camera orientation to any THREE.Camera.
 *
 * Python Manim ThreeDCamera conventions:
 *   phi   — polar angle from +Z axis (0 = top-down, PI/2 = equatorial)
 *   theta — azimuthal angle in the XY-plane from +X axis
 *
 * The camera is placed on a sphere of radius `focalDistance` and looks at the
 * origin, matching Python's `set_camera_orientation(phi, theta)` behaviour.
 */
export function applyPhiTheta(
  camera: THREE.Camera,
  phi: number,
  theta: number,
  focalDistance: number
): void {
  // Spherical → Cartesian (ISO physics convention: phi from +Z, theta in XY)
  const x = focalDistance * Math.sin(phi) * Math.cos(theta);
  const y = focalDistance * Math.sin(phi) * Math.sin(theta);
  const z = focalDistance * Math.cos(phi);

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);

  // Keep the camera's "up" vector consistent with Manim's +Y-is-up default,
  // unless the camera is looking straight down (+Z or -Z), in which case
  // fall back to +X to avoid a degenerate up vector.
  const up = Math.abs(Math.sin(phi)) < 1e-6
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);

  camera.up.copy(up);
  camera.lookAt(0, 0, 0); // re-apply after up change
}
