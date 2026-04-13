/**
 * Caching utilities for manim-ts.
 * Mirrors manim/utils/caching.py — provides the handle_caching_play decorator
 * used by the OpenGL renderer to skip already-cached animations.
 *
 * NOTE: This decorator is only kept for the OpenGL renderer. The Cairo renderer's
 * play logic has been refactored and no longer needs this function. Once the
 * OpenGL renderer has a proper testing system and is refactored accordingly,
 * this module should be deleted.
 */

import { config, logger } from "../../_config/index.js";
import type { IAnimation, ICamera, IMobject, IScene } from "../../core/types.js";

// ─── Hashing dependency ───────────────────────────────────────────────────────

/**
 * Signature of get_hash_from_play_call from utils/hashing.
 * TODO: Import from ../../utils/hashing/index.js when that module is converted.
 */
type GetHashFromPlayCall = (
  scene: IOpenGLScene,
  camera: ICamera,
  animations: IAnimation[],
  mobjectsOnScene: IMobject[],
) => string;

/**
 * Stub — replaced by the real implementation once utils/hashing is converted.
 * TODO: Remove this stub and import from ../../utils/hashing/index.js
 */
const getHashFromPlayCall: GetHashFromPlayCall = (
  _scene,
  _camera,
  _animations,
  _mobjectsOnScene,
): string => {
  throw new Error(
    "getHashFromPlayCall: utils/hashing has not been converted yet. " +
      "Import from ../../utils/hashing/index.js once it exists.",
  );
};

// ─── File writer interface ────────────────────────────────────────────────────

/**
 * Minimal interface for the file writer used by the OpenGL renderer.
 * TODO: Replace with proper import when the file writer module is converted.
 */
export interface IFileWriter {
  isAlreadyCached(hashPlay: string): boolean;
  addPartialMovieFile(hashPlay: string | null): void;
}

// ─── Scene extension ─────────────────────────────────────────────────────────

/**
 * Extended scene interface with OpenGL-specific methods.
 * These methods are present on the concrete Scene class but are not part of
 * the minimal IScene contract.
 * TODO: Merge into IScene (or a derived IOpenGLScene interface) once Scene is converted.
 */
export interface IOpenGLScene extends IScene {
  compileAnimations(...args: unknown[]): IAnimation[];
  addMobjectsFromAnimations(animations: IAnimation[]): void;
}

// ─── Renderer interface ───────────────────────────────────────────────────────

/**
 * Minimal interface for the OpenGL renderer — only the fields that
 * handle_caching_play reads and writes.
 * TODO: Replace with proper import when opengl_renderer is converted.
 */
export interface IOpenGLRenderer {
  skipAnimations: boolean;
  /** Mirrors Python `_original_skipping_status`. */
  _originalSkippingStatus: boolean;
  numPlays: number;
  animationsHashes: (string | null)[];
  camera: ICamera;
  fileWriter: IFileWriter;
  /** Mirrors Python `update_skipping_status()`. */
  updateSkippingStatus(): void;
}

// ─── Play function types ──────────────────────────────────────────────────────

/** The un-decorated play function signature. */
export type PlayFunction = (
  this: IOpenGLRenderer,
  scene: IOpenGLScene,
  ...args: unknown[]
) => void;

// ─── handleCachingPlay ────────────────────────────────────────────────────────

/**
 * Decorator that wraps a play function with animation-caching logic.
 *
 * The returned function computes the hash of the play invocation and either
 * skips the animation (because it is already cached) or lets the original
 * function play normally.
 *
 * Mirrors Python `manim.utils.caching.handle_caching_play`.
 *
 * @param func - The play-like function to wrap (same signature as `scene.play`).
 * @returns A wrapped function with caching behaviour.
 */
export function handleCachingPlay(func: PlayFunction): PlayFunction {
  return function wrapper(
    this: IOpenGLRenderer,
    scene: IOpenGLScene,
    ...args: unknown[]
  ): void {
    this.skipAnimations = this._originalSkippingStatus;
    this.updateSkippingStatus();

    const animations = scene.compileAnimations(...args);
    scene.addMobjectsFromAnimations(animations);

    if (this.skipAnimations) {
      logger.debug(`Skipping animation ${this.numPlays}`);
      func.call(this, scene, ...args);
      // Mark hash as null so sceneFileWriter ignores it when combining partials.
      this.animationsHashes.push(null);
      this.fileWriter.addPartialMovieFile(null);
      return;
    }

    let hashPlay: string;

    // `config` does not yet expose disable_caching — read via Record access
    // until ManimConfig gains that field.
    const disableCaching =
      (config as unknown as Record<string, unknown>)["disable_caching"] ?? false;

    if (!disableCaching) {
      const mobjectsOnScene = scene.mobjects;
      hashPlay = getHashFromPlayCall(scene, this.camera, animations, mobjectsOnScene);

      if (this.fileWriter.isAlreadyCached(hashPlay)) {
        logger.info(
          `Animation ${this.numPlays} : Using cached data (hash : ${hashPlay})`,
        );
        this.skipAnimations = true;
      }
    } else {
      hashPlay = `uncached_${String(this.numPlays).padStart(5, "0")}`;
    }

    this.animationsHashes.push(hashPlay);
    this.fileWriter.addPartialMovieFile(hashPlay);
    logger.debug(
      `List of the first few animation hashes of the scene: ${this.animationsHashes.slice(0, 5).join(", ")}`,
    );

    func.call(this, scene, ...args);
  };
}
