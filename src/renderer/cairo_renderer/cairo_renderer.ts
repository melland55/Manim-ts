/**
 * CairoRenderer — Canvas2D-based rendering back-end for manim-ts.
 *
 * Python equivalent: manim/renderer/cairo_renderer.py
 *
 * Replaces Cairo with @napi-rs/canvas (Canvas2D) for pixel-level rendering.
 * Video encoding is handled by SceneFileWriter via fluent-ffmpeg.
 */

import type { IAnimation, ICamera, IMobject, IScene } from "../../core/types.js";
import { Camera } from "../../camera/camera/index.js";
import type { CameraOptions } from "../../camera/camera/index.js";
import {
  SceneFileWriter,
  type PixelArray,
  type SceneFileWriterConfig,
  type SceneFileWriterRenderer,
} from "../../scene/scene_file_writer/index.js";
import { EndSceneEarlyException } from "../../utils/exceptions/index.js";
import { listUpdate } from "../../utils/iterables/index.js";
import { config, logger } from "../../_config/index.js";

// ─── Extended interfaces ──────────────────────────────────────────────────────

/**
 * Extended camera interface with Cairo-renderer-specific methods.
 * These supplement the base ICamera contract with methods that the
 * full Camera implementation (a later layer) will provide.
 */
export interface ICairoCamera extends ICamera {
  /** Raw pixel data as a flat Uint8Array (RGBA, width × height × 4 bytes). */
  pixelArray: PixelArray;
  /** Frames per second for this camera. */
  frameRate: number;

  /** Fill the canvas with a precomputed static frame (avoids re-rendering statics). */
  setFrameToBackground(image: PixelArray): void;
  /** Clear the canvas back to the background colour. */
  reset(): void;
  /**
   * Render `mobjects` onto the canvas.
   *
   * @param mobjects  The mobjects to render.
   * @param options   Pass-through options (e.g. `includeSubmobjects`).
   */
  captureMobjects(
    mobjects: Iterable<IMobject>,
    options?: Record<string, unknown>,
  ): void;
  /** Export the current canvas as a displayable image buffer. */
  getImage(): PixelArray;
}

/**
 * Extended scene interface with CairoRenderer-specific lifecycle hooks.
 * These supplement the base IScene contract with methods the scene provides
 * during a play() call.
 */
export interface ICairoScene extends IScene {
  /** Animations compiled for the current play() call. */
  animations: IAnimation[] | null;
  /** Total wall-clock duration of the current animation group (seconds). */
  duration: number;
  /** Mobjects that do not move during the current animation. */
  staticMobjects: IMobject[];
  /** Mobjects that move during the current animation. */
  movingMobjects: IMobject[];
  /** Mobjects rendered on top of everything (always re-drawn every frame). */
  foregroundMobjects: IMobject[];

  /** Compile play() arguments into `this.animations`. */
  compileAnimationData(...args: unknown[]): void;
  /** Returns true when the current animation produces a frozen (static) frame. */
  isCurrentAnimationFrozenFrame(): boolean;
  /** Call `.begin()` on each animation for the current play() call. */
  beginAnimations(): void;
  /** Per-frame loop that drives the animations until they finish. */
  playInternal(): Promise<void>;
}

// ─── Extended config fields ───────────────────────────────────────────────────

/**
 * Renderer-specific config fields that extend the base ManimConfig.
 * These shadow Python `manim.config` keys used by CairoRenderer that have
 * not yet been added to ManimConfig in this project.
 */
interface CairoRendererConfigFields {
  disableCaching: boolean;
  saveLastFrame: boolean;
  fromAnimationNumber: number;
  uptoAnimationNumber: number;
  writeToMovie: boolean;
}

/** Read Cairo-renderer config values from the global config with safe defaults. */
function getCairoConfig(): CairoRendererConfigFields {
  const c = config as unknown as Partial<CairoRendererConfigFields>;
  return {
    disableCaching: c.disableCaching ?? false,
    saveLastFrame: c.saveLastFrame ?? false,
    fromAnimationNumber: c.fromAnimationNumber ?? 0,
    uptoAnimationNumber: c.uptoAnimationNumber ?? -1,
    writeToMovie: c.writeToMovie ?? false,
  };
}

// ─── Hash helper ─────────────────────────────────────────────────────────────

/**
 * Compute a deterministic hash string for the current play() call.
 *
 * TODO: Port from manim/utils/hashing.py — utils.hashing not yet converted.
 * The real implementation hashes animation + mobject state to enable caching.
 * For now returns a unique string so every animation is treated as uncached.
 */
function getHashFromPlayCall(
  _scene: ICairoScene,
  _camera: ICairoCamera,
  _animations: IAnimation[],
  _mobjects: IMobject[],
): string {
  return `hash_play_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ─── CairoRenderer ───────────────────────────────────────────────────────────

export interface CairoRendererOptions {
  /** Override the file-writer class (default: SceneFileWriter). */
  fileWriterClass?: typeof SceneFileWriter;
  /**
   * Override the camera class.  The provided class must implement ICairoCamera.
   * Defaults to the built-in Camera cast to ICairoCamera (extended methods
   * become available once the full Camera is ported in a later layer).
   */
  cameraClass?: new (options?: CameraOptions) => ICairoCamera;
  /** When true, skip all animation rendering (produce no frames). */
  skipAnimations?: boolean;
}

/**
 * A renderer using Canvas2D (replacing Python's Cairo back-end).
 *
 * Drives the per-frame render loop for a scene, manages caching, and
 * delegates video/image output to SceneFileWriter.
 *
 * @example
 * ```typescript
 * const renderer = new CairoRenderer();
 * renderer.initScene(scene);
 * renderer.play(scene, ...animationArgs);
 * await renderer.sceneFinished(scene);
 * ```
 *
 * @deprecated Use {@link ThreeRenderer} from `src/renderer/three/` instead.
 * This Canvas2D / Cairo back-end is retained only for server-side video export
 * via `@napi-rs/canvas`; all interactive and browser rendering is now handled
 * by `ThreeRenderer` / `ThreeScene`.
 */
export class CairoRenderer implements SceneFileWriterRenderer {
  // ── Public state ──────────────────────────────────────────────

  /** Number of play() calls made since the scene started. */
  numPlays: number;
  /** Elapsed time in seconds since the scene started. */
  time: number;
  /** When true, the current animation is being skipped (no frames written). */
  skipAnimations: boolean;
  /** Hash strings recorded for each play() call (null = skipped). */
  animationsHashes: Array<string | null>;
  /** Cached pixel buffer of the static portion of the frame. */
  staticImage: PixelArray | null;
  /** The camera used for rendering. */
  camera: ICairoCamera;
  /** The file writer (set by initScene). */
  fileWriter!: SceneFileWriter;

  // ── Private ───────────────────────────────────────────────────

  private readonly _fileWriterClass: typeof SceneFileWriter;
  private readonly _originalSkippingStatus: boolean;

  constructor(options: CairoRendererOptions = {}) {
    this._fileWriterClass = options.fileWriterClass ?? SceneFileWriter;
    this._originalSkippingStatus = options.skipAnimations ?? false;
    this.skipAnimations = this._originalSkippingStatus;
    this.animationsHashes = [];
    this.numPlays = 0;
    this.time = 0.0;
    this.staticImage = null;

    if (options.cameraClass) {
      this.camera = new options.cameraClass();
    } else {
      // Cast: the full ICairoCamera methods (setFrameToBackground, etc.) are
      // provided by the complete Camera once it is ported in a later layer.
      this.camera = new Camera() as unknown as ICairoCamera;
    }
  }

  // ── Scene lifecycle ───────────────────────────────────────────

  /**
   * Initialise the file writer for `scene`.  Must be called once before play().
   *
   * Python: `CairoRenderer.init_scene(scene)`
   */
  initScene(scene: ICairoScene): void {
    const writerConfig: SceneFileWriterConfig = {
      pixelWidth: this.camera.pixelWidth,
      pixelHeight: this.camera.pixelHeight,
      frameRate: this.camera.frameRate ?? config.frameRate,
      mediaDir: config.mediaDir,
    };
    this.fileWriter = new this._fileWriterClass(
      this,
      scene.constructor.name,
      writerConfig,
    ) as SceneFileWriter;
  }

  // ── Main play() ───────────────────────────────────────────────

  /**
   * Render one play() call.
   *
   * Compiles animations, checks the cache, writes frames, and increments
   * numPlays.  Must be called after initScene().
   *
   * Python: `CairoRenderer.play(scene, *args, **kwargs)`
   */
  async play(scene: ICairoScene, ...args: unknown[]): Promise<void> {
    // Reset skip status to original for each new animation.
    this.skipAnimations = this._originalSkippingStatus;
    this.updateSkippingStatus();

    scene.compileAnimationData(...args);

    let hashCurrentAnimation: string | null;

    if (this.skipAnimations) {
      logger.debug(`Skipping animation ${this.numPlays}`);
      hashCurrentAnimation = null;
      this.time += scene.duration;
    } else {
      const cc = getCairoConfig();
      if (cc.disableCaching) {
        logger.info("Caching disabled.");
        hashCurrentAnimation = `uncached_${String(this.numPlays).padStart(5, "0")}`;
      } else {
        const animations = scene.animations ?? [];
        hashCurrentAnimation = getHashFromPlayCall(
          scene,
          this.camera,
          animations,
          scene.mobjects,
        );

        if (this.fileWriter.isAlreadyCached(hashCurrentAnimation)) {
          logger.info(
            `Animation ${this.numPlays} : Using cached data (hash : ${hashCurrentAnimation})`,
          );
          this.skipAnimations = true;
          this.time += scene.duration;
        }
      }
    }

    // null signals the file writer to ignore this partial movie slot.
    this.fileWriter.addPartialMovieFile(hashCurrentAnimation);
    this.animationsHashes.push(hashCurrentAnimation);
    logger.debug(
      `List of the first few animation hashes of the scene: ${JSON.stringify(
        this.animationsHashes.slice(0, 5),
      )}`,
    );

    this.fileWriter.beginAnimation(!this.skipAnimations);
    scene.beginAnimations();

    // Render and cache the static portion of the scene so statics are not
    // re-drawn on every frame.
    this.saveStaticFrameData(scene, scene.staticMobjects);

    if (scene.isCurrentAnimationFrozenFrame()) {
      this.updateFrame(scene, { mobjects: scene.movingMobjects });
      await this.freezeCurrentFrame(scene.duration);
    } else {
      await scene.playInternal();
    }

    await this.fileWriter.endAnimation(!this.skipAnimations);
    this.numPlays += 1;
  }

  // ── Frame rendering ───────────────────────────────────────────

  /**
   * Re-render the scene onto the camera's canvas.
   *
   * Python: `CairoRenderer.update_frame(scene, mobjects, include_submobjects,
   *          ignore_skipping, **kwargs)`
   *
   * @param scene    The active scene.
   * @param options
   *   - `mobjects`           Which mobjects to render.  Defaults to all scene +
   *                          foreground mobjects.
   *   - `includeSubmobjects` Whether to recurse into submobjects (default true).
   *   - `ignoreSkipping`     Render even when skipAnimations is set (default true).
   */
  updateFrame(
    scene: ICairoScene,
    options: {
      mobjects?: Iterable<IMobject> | null;
      includeSubmobjects?: boolean;
      ignoreSkipping?: boolean;
      [key: string]: unknown;
    } = {},
  ): void {
    const {
      mobjects = null,
      includeSubmobjects = true,
      ignoreSkipping = true,
      ...rest
    } = options;

    if (this.skipAnimations && !ignoreSkipping) {
      return;
    }

    const mobjectsToRender: Iterable<IMobject> = mobjects
      ? mobjects
      : listUpdate(scene.mobjects, scene.foregroundMobjects);

    if (this.staticImage !== null) {
      this.camera.setFrameToBackground(this.staticImage);
    } else {
      this.camera.reset();
    }

    this.camera.captureMobjects(mobjectsToRender, { includeSubmobjects, ...rest });
  }

  /**
   * Render one frame and write it to the video stream.
   *
   * Python: `CairoRenderer.render(scene, time, moving_mobjects)`
   *
   * @param scene          The active scene.
   * @param _time          Current animation time (unused here, kept for API parity).
   * @param movingMobjects Mobjects to re-render (statics come from staticImage).
   */
  async render(
    scene: ICairoScene,
    _time: number,
    movingMobjects?: Iterable<IMobject> | null,
  ): Promise<void> {
    this.updateFrame(scene, { mobjects: movingMobjects ?? null });
    await this.addFrame(this.getFrame());
  }

  // ── Frame I/O ─────────────────────────────────────────────────

  /**
   * Returns the current frame as a raw RGBA pixel buffer.
   * Conceptual shape: height × width × 4 bytes.
   *
   * Python: `CairoRenderer.get_frame()` → PixelArray
   *
   * TODO: Port from Cairo/OpenGL — needs manual rendering implementation.
   */
  getFrame(): PixelArray {
    return this.camera.pixelArray;
  }

  /**
   * Returns the current frame as a displayable image buffer.
   * Delegates to the camera.
   *
   * Satisfies SceneFileWriterRenderer.getImage().
   */
  getImage(): PixelArray {
    return this.camera.getImage();
  }

  /**
   * Write `frame` to the video stream.
   *
   * Python: `CairoRenderer.add_frame(frame, num_frames)`
   *
   * @param frame     Raw RGBA pixel data for one frame.
   * @param numFrames How many times to repeat this frame (used for freezes).
   */
  async addFrame(frame: PixelArray, numFrames: number = 1): Promise<void> {
    if (this.skipAnimations) {
      return;
    }
    const frameRate = this.camera.frameRate ?? config.frameRate;
    const dt = 1 / frameRate;
    this.time += numFrames * dt;
    await this.fileWriter.writeFrame(frame, numFrames);
  }

  /**
   * Hold the current frame for `duration` seconds.
   * Used when a wait() call produces a fully static scene.
   *
   * Python: `CairoRenderer.freeze_current_frame(duration)`
   */
  async freezeCurrentFrame(duration: number): Promise<void> {
    const frameRate = this.camera.frameRate ?? config.frameRate;
    const dt = 1 / frameRate;
    await this.addFrame(this.getFrame(), Math.round(duration / dt));
  }

  // ── Utilities ─────────────────────────────────────────────────

  /**
   * Display the current frame in the system default image viewer.
   *
   * Python: `CairoRenderer.show_frame(scene)`
   * TODO: Actually open the image in a viewer (no cross-platform API in Node).
   */
  showFrame(scene: ICairoScene): void {
    this.updateFrame(scene, { ignoreSkipping: true });
    this.camera.getImage(); // TODO: open returned buffer in a system viewer
  }

  /**
   * Render and cache the static portion of the scene so it does not need to be
   * re-drawn on every frame.
   *
   * Python: `CairoRenderer.save_static_frame_data(scene, static_mobjects)`
   *
   * @returns The cached pixel buffer, or null when there are no static mobjects.
   */
  saveStaticFrameData(
    scene: ICairoScene,
    staticMobjects: Iterable<IMobject>,
  ): PixelArray | null {
    this.staticImage = null;
    const mobs = [...staticMobjects];
    if (mobs.length === 0) {
      return null;
    }
    this.updateFrame(scene, { mobjects: mobs });
    this.staticImage = this.getFrame();
    return this.staticImage;
  }

  /**
   * Check whether the current animation should be skipped and update
   * `this.skipAnimations` accordingly.
   *
   * @throws {EndSceneEarlyException} When numPlays has exceeded uptoAnimationNumber.
   *
   * Python: `CairoRenderer.update_skipping_status()`
   */
  updateSkippingStatus(): void {
    const cc = getCairoConfig();

    // Section-level skip flag — sections[−1] is always the active section.
    const sections = (
      this.fileWriter as unknown as {
        sections?: Array<{ skipAnimations: boolean }>;
      }
    ).sections;
    if (
      sections !== undefined &&
      sections.length > 0 &&
      sections[sections.length - 1].skipAnimations
    ) {
      this.skipAnimations = true;
    }

    if (cc.saveLastFrame) {
      this.skipAnimations = true;
    }

    if (cc.fromAnimationNumber > 0 && this.numPlays < cc.fromAnimationNumber) {
      this.skipAnimations = true;
    }

    if (cc.uptoAnimationNumber >= 0 && this.numPlays > cc.uptoAnimationNumber) {
      this.skipAnimations = true;
      throw new EndSceneEarlyException();
    }
  }

  /**
   * Called once the scene has finished rendering all animations.
   * Finalises the video file or saves a still image depending on config.
   *
   * Python: `CairoRenderer.scene_finished(scene)`
   */
  async sceneFinished(scene: ICairoScene): Promise<void> {
    const cc = getCairoConfig();

    if (this.numPlays) {
      await this.fileWriter.finish();
    } else if (cc.writeToMovie) {
      // No animations were played — fall back to a single still image.
      // TODO: mutate global config once saveLastFrame / writeToMovie are added
      //       to ManimConfig (config.saveLastFrame = true; config.writeToMovie = false).
    } else {
      this.staticImage = null;
      this.updateFrame(scene);
    }

    if (cc.saveLastFrame) {
      this.staticImage = null;
      this.updateFrame(scene);
      await this.fileWriter.saveImage(this.camera.getImage());
    }
  }
}
