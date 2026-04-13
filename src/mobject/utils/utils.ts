/**
 * Utilities for working with mobjects.
 *
 * Mirrors manim/mobject/utils.py — provides factory functions that return
 * the appropriate mobject base class for the active renderer.
 *
 * In manim-ts only the Canvas2D renderer (equivalent to Python's CAIRO
 * renderer) is supported.  OpenGL is reserved for future WebGL2 work.
 */

import type { IMobject, IVMobject } from "../../core/types.js";

// ─── Renderer enum ────────────────────────────────────────────

/**
 * Supported renderer types.
 * Mirrors manim/constants.py RendererType.
 */
export enum RendererType {
  /** Canvas2D / Cairo-equivalent renderer (default) */
  CAIRO = "cairo",
  /** WebGL2 / OpenGL-equivalent renderer (not yet implemented) */
  OPENGL = "opengl",
}

// ─── Constructor types ────────────────────────────────────────

/**
 * Constructor signature for Mobject base classes.
 * Python: `type` returned by get_mobject_class().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MobjectConstructor = new (...args: any[]) => IMobject;

/**
 * Constructor signature for VMobject base classes.
 * Python: `type` returned by get_vectorized_mobject_class().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VMobjectConstructor = new (...args: any[]) => IVMobject;

/**
 * Constructor signature for point-cloud mobject base classes.
 * Python: `type` returned by get_point_mobject_class().
 * PMobject extends Mobject, so IMobject is the correct bound.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PMobjectConstructor = new (...args: any[]) => IMobject;

// ─── Active renderer ─────────────────────────────────────────

/**
 * Returns the currently active renderer type.
 *
 * In manim-ts the default renderer is always CAIRO (Canvas2D).
 * Override by setting the `MANIM_RENDERER` environment variable to
 * `"opengl"` (reserved for future WebGL2 work).
 */
export function getActiveRenderer(): RendererType {
  const env =
    typeof process !== "undefined"
      ? process.env["MANIM_RENDERER"]
      : undefined;
  if (env === "opengl") return RendererType.OPENGL;
  return RendererType.CAIRO;
}

// ─── Factory functions ────────────────────────────────────────

/**
 * Gets the base mobject class for the currently active renderer.
 *
 * This function is intended for use inside manim-ts itself or in
 * plugins that must work regardless of the selected renderer.
 *
 * @returns The Mobject constructor for the active renderer.
 * @throws {Error} If the active renderer has no Mobject implementation yet.
 *
 * @example
 * ```typescript
 * const BaseMobject = getMobjectClass();
 * // BaseMobject.__name__ === 'Mobject'  (Canvas2D renderer)
 * ```
 */
export function getMobjectClass(): MobjectConstructor {
  const renderer = getActiveRenderer();
  if (renderer === RendererType.CAIRO) {
    // TODO: Replace with real import once src/mobject/mobject/ is converted.
    //   import { Mobject } from "../mobject/index.js";
    //   return Mobject;
    throw new Error(
      "getMobjectClass: Mobject class has not been converted yet. " +
        "Implement src/mobject/mobject/ first.",
    );
  }
  if (renderer === RendererType.OPENGL) {
    // TODO: Port from OpenGL — needs WebGL2 implementation
    throw new Error(
      "getMobjectClass: OpenGL/WebGL2 renderer is not yet implemented.",
    );
  }
  throw new Error(
    `getMobjectClass: Base mobjects are not implemented for renderer "${renderer}".`,
  );
}

/**
 * Gets the vectorized mobject class for the currently active renderer.
 *
 * This function is intended for use inside manim-ts itself or in
 * plugins that must work regardless of the selected renderer.
 *
 * @returns The VMobject constructor for the active renderer.
 * @throws {Error} If the active renderer has no VMobject implementation yet.
 *
 * @example
 * ```typescript
 * const BaseVMobject = getVectorizedMobjectClass();
 * // BaseVMobject.__name__ === 'VMobject'  (Canvas2D renderer)
 * ```
 */
export function getVectorizedMobjectClass(): VMobjectConstructor {
  const renderer = getActiveRenderer();
  if (renderer === RendererType.CAIRO) {
    // TODO: Replace with real import once src/mobject/types/vectorized_mobject/ is converted.
    //   import { VMobject } from "../types/vectorized_mobject/index.js";
    //   return VMobject;
    throw new Error(
      "getVectorizedMobjectClass: VMobject class has not been converted yet. " +
        "Implement src/mobject/types/vectorized_mobject/ first.",
    );
  }
  if (renderer === RendererType.OPENGL) {
    // TODO: Port from OpenGL — needs WebGL2 implementation
    throw new Error(
      "getVectorizedMobjectClass: OpenGL/WebGL2 renderer is not yet implemented.",
    );
  }
  throw new Error(
    `getVectorizedMobjectClass: Vectorized mobjects are not implemented for renderer "${renderer}".`,
  );
}

/**
 * Gets the point-cloud mobject class for the currently active renderer.
 *
 * This function is intended for use inside manim-ts itself or in
 * plugins that must work regardless of the selected renderer.
 *
 * @returns The PMobject constructor for the active renderer.
 * @throws {Error} If the active renderer has no PMobject implementation yet.
 *
 * @example
 * ```typescript
 * const BasePMobject = getPointMobjectClass();
 * // BasePMobject.__name__ === 'PMobject'  (Canvas2D renderer)
 * ```
 */
export function getPointMobjectClass(): PMobjectConstructor {
  const renderer = getActiveRenderer();
  if (renderer === RendererType.CAIRO) {
    // TODO: Replace with real import once src/mobject/types/point_cloud_mobject/ is converted.
    //   import { PMobject } from "../types/point_cloud_mobject/index.js";
    //   return PMobject;
    throw new Error(
      "getPointMobjectClass: PMobject class has not been converted yet. " +
        "Implement src/mobject/types/point_cloud_mobject/ first.",
    );
  }
  if (renderer === RendererType.OPENGL) {
    // TODO: Port from OpenGL — needs WebGL2 implementation
    throw new Error(
      "getPointMobjectClass: OpenGL/WebGL2 renderer is not yet implemented.",
    );
  }
  throw new Error(
    `getPointMobjectClass: Point cloud mobjects are not implemented for renderer "${renderer}".`,
  );
}
