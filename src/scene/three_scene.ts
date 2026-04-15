/**
 * ThreeScene — a Scene subclass whose render backend is three.js (not Canvas2D).
 *
 * Wraps ThreeBackend (which owns ThreeRenderer + FamilySyncer) and drives an
 * rAF loop to sync mobjects and render each frame. The Manim Scene API
 * (add/remove/play/wait/construct) is preserved — only the rendering backend
 * changes.
 */

import * as THREE from "three";
import { Scene } from "./scene/index.js";
import type { SceneOptions } from "./scene/index.js";
import type { IAnimation, IMobject } from "../core/types.js";
import { ThreeBackend } from "../renderer/three/three_backend.js";
import type { ThreeBackendOptions } from "../renderer/three/three_backend.js";
import { ThreeRenderer } from "../renderer/three/three_renderer.js";
import { FamilySyncer } from "../renderer/three/family_syncer.js";

// ─── Options ─────────────────────────────────────────────────

export interface ThreeSceneOptions extends SceneOptions {
  /** Canvas to render into. Required — ThreeScene cannot run headlessly. */
  canvas: HTMLCanvasElement;
  /**
   * Manim frame dimensions in world units.
   * Default: 14.222 × 8.0 (standard 16:9 Manim frame).
   */
  frameWidth?: number;
  frameHeight?: number;
  /**
   * Frames per second for the animation loop.
   * Overrides SceneOptions.frameRate when both are supplied.
   * Default: 60 (rAF target; play/wait loops use this for dt steps too).
   */
  frameRate?: number;
  /**
   * Use a PerspectiveCamera instead of the default OrthographicCamera.
   * Useful for 3D scenes — defaults to false (orthographic, matches 2D Manim).
   */
  perspective?: boolean;
  /** Custom initial camera. When provided, frameWidth/frameHeight are ignored. */
  camera3?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
}

// ─── ThreeScene ──────────────────────────────────────────────

export class ThreeScene extends Scene {
  /** Underlying three.js renderer. */
  get threeRenderer(): ThreeRenderer {
    return this._threeBackend.threeRenderer;
  }

  /** Syncs scene mobject family → three.js group each frame. */
  get familySyncer(): FamilySyncer {
    return this._threeBackend.familySyncer;
  }

  /** The three.js scene graph root. */
  get threeScene(): THREE.Scene {
    return this._threeBackend.threeScene;
  }

  /** Typed accessor for the ThreeBackend stored on Scene._backend. */
  private get _threeBackend(): ThreeBackend {
    return this._backend as ThreeBackend;
  }

  private readonly _threeCanvas: HTMLCanvasElement;
  private readonly _frameWidth: number;
  private readonly _frameHeight: number;

  /** rAF handle — non-null while the loop is running. */
  private _rafHandle: number | null = null;

  /** Resolve callback for the currently-awaited play()/wait() call. */
  private _loopResolve: (() => void) | null = null;

  /** Condition that ends the current rAF loop (true → stop). */
  private _loopDone: (() => boolean) | null = null;

  constructor(options: ThreeSceneOptions) {
    super({
      ...options,
      renderer: "opengl",
      canvas: null,
    });

    this._threeCanvas = options.canvas;
    this._frameWidth = options.frameWidth ?? 14.222;
    this._frameHeight = options.frameHeight ?? 8.0;

    this._backend = new ThreeBackend({
      canvas: options.canvas,
      frameWidth: this._frameWidth,
      frameHeight: this._frameHeight,
      perspective: options.perspective,
      camera3: options.camera3,
    });

    this.attachCanvas(options.canvas);
  }

  // ─── Internal: rAF loop ──────────────────────────────────

  private _runLoop(done: () => boolean): Promise<void> {
    return new Promise<void>((resolve) => {
      this._loopResolve = resolve;
      this._loopDone = done;

      const tick = () => {
        if (this._loopDone && this._loopDone()) {
          this._rafHandle = null;
          const res = this._loopResolve;
          this._loopResolve = null;
          this._loopDone = null;
          if (res) res();
          return;
        }

        const family = this.mobjects.flatMap((m) => m.getFamily());
        this._threeBackend.familySyncer.sync(family);

        this._threeBackend.render();

        this._rafHandle = requestAnimationFrame(tick);
      };

      this._rafHandle = requestAnimationFrame(tick);
    });
  }

  private _stopLoop(): void {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    if (this._loopResolve) {
      this._loopResolve();
      this._loopResolve = null;
    }
    this._loopDone = null;
  }

  // ─── Override: play ──────────────────────────────────────

  override async play(...args: IAnimation[]): Promise<void> {
    if (args.length === 0) return;

    const animations = args;

    for (const anim of animations) {
      if (!anim.introducer) {
        const mob = anim.mobject;
        if (mob && !this.mobjects.includes(mob)) {
          this.add(mob);
        }
      }
    }

    const runTime = Math.max(...animations.map((a) => a.runTime));

    const preMobjects = new Set(this.mobjects);

    for (const anim of animations) {
      anim.setupScene(this);
      anim.begin();
    }

    if (runTime <= 0) {
      for (const anim of animations) {
        anim.interpolate(1);
        anim.finish();
        anim.cleanUpFromScene(this);
      }
      this._cleanUpAfterPlays(animations);
      this._syncAndRender();
      return;
    }

    const step = 1 / this.frameRate;
    let t = 0;

    await this._runLoop(() => {
      t = Math.min(t + step, runTime);

      for (const anim of animations) {
        const alpha = Math.min(t / anim.runTime, 1);
        anim.interpolate(alpha);
      }

      const dt = step;
      this.updateMobjects(dt);
      this.updateSelf(dt);

      return t >= runTime;
    });

    (this as unknown as { _time: number })._time += t;

    for (const anim of animations) {
      anim.finish();
      anim.cleanUpFromScene(this);
    }
    this._cleanUpAfterPlays(animations);

    if (this.playbackEnabled) {
      const postMobjects = new Set(this.mobjects);
      const mobjectsAdded: IMobject[] = [];
      const mobjectsRemoved: IMobject[] = [];
      for (const m of postMobjects) {
        if (!preMobjects.has(m)) mobjectsAdded.push(m);
      }
      for (const m of preMobjects) {
        if (!postMobjects.has(m)) mobjectsRemoved.push(m);
      }
      const timeline = (this as unknown as { _timeline: import("../scene/timeline/timeline.js").Timeline | null })._timeline;
      if (timeline) {
        const startT = (this as unknown as { _time: number })._time - t;
        timeline.recordPlay(startT, (this as unknown as { _time: number })._time, animations, mobjectsAdded, mobjectsRemoved);
      }
    }
  }

  // ─── Override: wait ──────────────────────────────────────

  override async wait(
    duration = 1.0,
    stopCondition?: () => boolean,
  ): Promise<void> {
    if (duration <= 0) return;

    const step = 1 / this.frameRate;
    let elapsed = 0;
    const startT = (this as unknown as { _time: number })._time;

    await this._runLoop(() => {
      elapsed = Math.min(elapsed + step, duration);
      const dt = step;

      this.updateMobjects(dt);
      this.updateSelf(dt);

      if (stopCondition?.()) return true;
      return elapsed >= duration;
    });

    (this as unknown as { _time: number })._time += elapsed;

    if (this.playbackEnabled) {
      const timeline = (this as unknown as { _timeline: import("../scene/timeline/timeline.js").Timeline | null })._timeline;
      if (timeline) {
        timeline.recordWait(startT, (this as unknown as { _time: number })._time);
      }
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────

  override tearDown(): void {
    super.tearDown();
    this._stopLoop();
    this._threeBackend.dispose();
  }

  // ─── Helpers ─────────────────────────────────────────────

  private _syncAndRender(): void {
    const family = this.mobjects.flatMap((m) => m.getFamily());
    this._threeBackend.familySyncer.sync(family);
    this._threeBackend.render();
  }

  private _cleanUpAfterPlays(
    animations: IAnimation[],
  ): void {
    for (const anim of animations) {
      const allMobjects = anim.getAllMobjects();
      if (anim.introducer) {
        for (const mob of allMobjects) {
          if (!this.mobjects.includes(mob)) {
            this.add(mob);
          }
        }
      }
      if (anim.remover) {
        this.remove(...allMobjects);
      }
    }
  }
}
