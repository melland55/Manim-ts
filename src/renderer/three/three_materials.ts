import * as THREE from "three";
import { ManimColor } from "../../utils/color/core.js";

function manimColorToThree(color: ManimColor): THREE.Color {
  const hex = color.toHex(false); // "#rrggbb"
  return new THREE.Color(hex);
}

// Kept for API compatibility with resize_handler (was used for Line2 shader).
// Ribbon-mesh strokes don't need a viewport-resolution uniform.
export function setLineMaterialResolution(_w: number, _h: number): void {}

/**
 * Creates a MeshBasicMaterial for ribbon-mesh stroke rendering.
 *
 * The stroke itself is a single continuous triangle strip (see
 * vmobjectToStrokeMesh) so there are no overlapping quads — alpha blending
 * is clean across any opacity value, which means fade in/out matches
 * Canvas2D behaviour instead of producing dithered dots.
 *
 * @param color   Stroke color as a ManimColor
 * @param _width  Ignored — width is baked into the ribbon geometry.
 * @param opacity Stroke opacity in [0, 1]
 */
export function makeStrokeMaterial(
  color: ManimColor,
  _width: number,
  opacity: number
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: manimColorToThree(color),
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    // Painter-order rendering is driven entirely by FamilySyncer's renderOrder
    // assignment. Leaving depthTest on adds nothing (depthWrite is off so the
    // buffer never fills) and in some configurations causes a stroke mesh to
    // reject itself against an earlier co-planar fill.
    depthTest: false,
  });
}

/**
 * Creates a MeshBasicMaterial for fill rendering.
 * Always double-sided (Manim fills render on both faces).
 * depthWrite is disabled so overlapping VMobject fills composite correctly.
 *
 * @param color   Fill color as a ManimColor
 * @param opacity Fill opacity in [0, 1]
 */
export function makeFillMaterial(
  color: ManimColor,
  opacity: number
): THREE.MeshBasicMaterial {
  const transparent = opacity < 1;
  return new THREE.MeshBasicMaterial({
    color: manimColorToThree(color),
    opacity,
    transparent,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
}
