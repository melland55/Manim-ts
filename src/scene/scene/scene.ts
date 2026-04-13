/**
 * Scene — the primary canvas for animations.
 *
 * TypeScript port of manim.scene.scene.Scene.
 *
 * The Scene class provides tools to manage mobjects and animations. Users
 * subclass Scene and override the `construct()` method to define their
 * animation content.
 */

import type {
  IScene,
  ICamera,
  IAnimation,
  IMobject,
  IColor,
  Point3D,
} from "../../core/types.js";
import { np, ORIGIN } from "../../core/math/index.js";
import { Camera } from "../../camera/camera/index.js";
import { BLACK } from "../../core/color/index.js";
import { DefaultSectionType } from "../section/index.js";

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_FRAME_RATE = 30;
const DEFAULT_WAIT_TIME = 1.0;

// ─── Options ─────────────────────────────────────────────────

export interface SceneOptions {
  camera?: ICamera;
  cameraClass?: new (...args: unknown[]) => ICamera;
  alwaysUpdateMobjects?: boolean;
  randomSeed?: number | null;
  skipAnimations?: boolean;
  frameRate?: number;
}

// ─── Subcaption ──────────────────────────────────────────────

interface Subcaption {
  content: string;
  startTime: number;
  endTime: number;
}

// ─── Scene ───────────────────────────────────────────────────

export class Scene implements IScene {
  mobjects: IMobject[];
  foregroundMobjects: IMobject[];

  camera: ICamera;
  updaters: Array<(dt: number) => void>;
  alwaysUpdateMobjects: boolean;
  randomSeed: number | null;
  skipAnimations: boolean;

  /** Animations currently being played (null when idle). */
  animations: IAnimation[] | null;
  stopCondition: (() => boolean) | null;
  movingMobjects: IMobject[];
  staticMobjects: IMobject[];
  duration: number;
  lastT: number;
  subcaptions: Subcaption[];
  numPlays: number;

  /** Internal time counter — accumulated from all played animations. */
  private _time: number;
  private _frameRate: number;

  constructor(options: SceneOptions = {}) {
    this.alwaysUpdateMobjects = options.alwaysUpdateMobjects ?? false;
    this.randomSeed = options.randomSeed ?? null;
    this.skipAnimations = options.skipAnimations ?? false;
    this._frameRate = options.frameRate ?? DEFAULT_FRAME_RATE;

    this.camera = options.camera ?? new Camera();

    this.mobjects = [];
    this.foregroundMobjects = [];
    this.updaters = [];

    this.animations = null;
    this.stopCondition = null;
    this.movingMobjects = [];
    this.staticMobjects = [];
    this.duration = 0;
    this.lastT = 0;
    this._time = 0;
    this.subcaptions = [];
    this.numPlays = 0;
  }

  // ─── Properties ──────────────────────────────────────────

  get time(): number {
    return this._time;
  }

  get frameRate(): number {
    return this._frameRate;
  }

  // ─── Lifecycle ───────────────────────────────────────────

  setup(): void {
    // Override in subclasses for common setup before construct().
  }

  async construct(): Promise<void> {
    // Override in subclasses to define animation content.
  }

  tearDown(): void {
    // Override in subclasses for common cleanup after construct().
  }

  async render(preview = false): Promise<void> {
    this.setup();
    try {
      await this.construct();
    } catch (e) {
      if (e instanceof EndSceneEarlyError) {
        // Graceful early termination
      } else {
        throw e;
      }
    }
    this.tearDown();
  }

  // ─── Mobject management ──────────────────────────────────

  add(...mobjects: IMobject[]): this {
    for (const mob of mobjects) {
      // Remove first to avoid duplicates, then re-add at end
      this.mobjects = this.mobjects.filter((m) => m !== mob);
      this.mobjects.push(mob);
    }
    return this;
  }

  remove(...mobjects: IMobject[]): this {
    const toRemove = new Set(mobjects);
    this.mobjects = this.mobjects.filter((m) => !toRemove.has(m));
    this.foregroundMobjects = this.foregroundMobjects.filter(
      (m) => !toRemove.has(m),
    );
    return this;
  }

  replace(oldMobject: IMobject, newMobject: IMobject): void {
    if (oldMobject === null || newMobject === null) {
      throw new Error("Specified mobjects cannot be null");
    }

    const replaceInList = (
      list: IMobject[],
      oldM: IMobject,
      newM: IMobject,
    ): boolean => {
      if (newM !== oldM) {
        const existingIdx = list.indexOf(newM);
        if (existingIdx !== -1) {
          list.splice(existingIdx, 1);
        }
      }
      for (let i = 0; i < list.length; i++) {
        if (list[i] === oldM) {
          list[i] = newM;
          return true;
        }
      }
      for (const mob of list) {
        if (replaceInList(mob.submobjects, oldM, newM)) {
          return true;
        }
      }
      return false;
    };

    const replaced =
      replaceInList(this.mobjects, oldMobject, newMobject) ||
      replaceInList(this.foregroundMobjects, oldMobject, newMobject);

    if (!replaced) {
      throw new Error(`Could not find mobject in scene`);
    }
  }

  clear(): this {
    this.mobjects = [];
    this.foregroundMobjects = [];
    return this;
  }

  bringToFront(...mobjects: IMobject[]): this {
    this.add(...mobjects);
    return this;
  }

  bringToBack(...mobjects: IMobject[]): this {
    this.remove(...mobjects);
    this.mobjects = [...mobjects, ...this.mobjects];
    return this;
  }

  getTopLevelMobjects(): IMobject[] {
    const families = this.mobjects.map((m) => m.getFamily());
    return this.mobjects.filter((mob) => {
      const count = families.reduce(
        (sum, family) => sum + (family.includes(mob) ? 1 : 0),
        0,
      );
      return count === 1;
    });
  }

  getMobjectFamily(): IMobject[] {
    const family: IMobject[] = [];
    for (const mob of this.mobjects) {
      family.push(mob);
      const mobFamily = mob.getFamily();
      for (const child of mobFamily) {
        if (!family.includes(child)) {
          family.push(child);
        }
      }
    }
    return family;
  }

  // ─── Foreground mobjects ─────────────────────────────────

  addForegroundMobjects(...mobjects: IMobject[]): this {
    for (const mob of mobjects) {
      if (!this.foregroundMobjects.includes(mob)) {
        this.foregroundMobjects.push(mob);
      }
    }
    this.add(...mobjects);
    return this;
  }

  addForegroundMobject(mobject: IMobject): this {
    return this.addForegroundMobjects(mobject);
  }

  removeForegroundMobjects(...toRemove: IMobject[]): this {
    const removeSet = new Set(toRemove);
    this.foregroundMobjects = this.foregroundMobjects.filter(
      (m) => !removeSet.has(m),
    );
    return this;
  }

  removeForegroundMobject(mobject: IMobject): this {
    return this.removeForegroundMobjects(mobject);
  }

  // ─── Updaters ────────────────────────────────────────────

  updateMobjects(dt: number): void {
    for (const mob of this.mobjects) {
      for (const updater of mob.updaters) {
        updater(mob, dt);
      }
    }
  }

  updateSelf(dt: number): void {
    for (const func of this.updaters) {
      func(dt);
    }
  }

  addUpdater(func: (dt: number) => void): void {
    this.updaters.push(func);
  }

  removeUpdater(func: (dt: number) => void): void {
    this.updaters = this.updaters.filter((f) => f !== func);
  }

  shouldUpdateMobjects(): boolean {
    if (this.alwaysUpdateMobjects || this.updaters.length > 0) {
      return true;
    }
    if (this.stopCondition !== null) {
      return true;
    }
    for (const mob of this.getMobjectFamily()) {
      if (mob.updaters.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns mobjects that will be moving during the given animations.
   * Subclasses (e.g. MovingCameraScene) override this to include
   * camera-related mobjects.
   */
  getMovingMobjects(...animations: IAnimation[]): IMobject[] {
    const movingMobjects: IMobject[] = [];
    for (const anim of animations) {
      if (anim.mobject) {
        movingMobjects.push(...anim.getAllMobjects());
      }
    }
    return movingMobjects;
  }

  // ─── Animation playback ──────────────────────────────────

  async play(
    ...args: IAnimation[]
  ): Promise<void> {
    if (args.length === 0) {
      return;
    }

    const animations = args;

    // Add mobjects that aren't yet in the scene
    for (const anim of animations) {
      if (anim.introducer) {
        // Introducer animations add the mobject themselves during cleanUp
      } else {
        const mob = anim.mobject;
        if (mob && !this.mobjects.includes(mob)) {
          this.add(mob);
        }
      }
    }

    const runTime = Math.max(...animations.map((a) => a.runTime));

    // Setup
    for (const anim of animations) {
      anim.setupScene(this);
      anim.begin();
    }

    this.animations = animations;
    this.lastT = 0;
    this.stopCondition = null;

    // Check for Wait-like animations with stop conditions
    if (
      animations.length === 1 &&
      "stopCondition" in animations[0] &&
      typeof (animations[0] as WaitLike).stopCondition === "function"
    ) {
      this.stopCondition = (animations[0] as WaitLike).stopCondition;
    }

    if (runTime <= 0) {
      // Zero-length animation: just begin and finish
      for (const anim of animations) {
        anim.interpolate(1);
        anim.finish();
        anim.cleanUpFromScene(this);
      }
      this._cleanUpAfterAnimations(animations);
      this.animations = null;
      return;
    }

    // Step through time
    const step = 1 / this._frameRate;
    let t = 0;
    while (t < runTime) {
      t = Math.min(t + step, runTime);
      const dt = t - this.lastT;
      this.lastT = t;

      for (const anim of animations) {
        const alpha = Math.min(t / anim.runTime, 1);
        anim.interpolate(alpha);
      }

      this.updateMobjects(dt);
      this.updateSelf(dt);

      if (this.stopCondition !== null && this.stopCondition()) {
        break;
      }
    }

    this._time += t;

    // Finish
    for (const anim of animations) {
      anim.finish();
      anim.cleanUpFromScene(this);
    }
    this._cleanUpAfterAnimations(animations);

    this.animations = null;
  }

  async wait(
    duration: number = DEFAULT_WAIT_TIME,
    stopCondition?: () => boolean,
  ): Promise<void> {
    if (duration <= 0) {
      return;
    }

    const step = 1 / this._frameRate;
    let elapsed = 0;

    while (elapsed < duration) {
      elapsed = Math.min(elapsed + step, duration);
      const dt = step;

      this.updateMobjects(dt);
      this.updateSelf(dt);

      if (stopCondition !== undefined && stopCondition()) {
        break;
      }
    }

    this._time += elapsed;
  }

  pause(duration: number = DEFAULT_WAIT_TIME): Promise<void> {
    return this.wait(duration);
  }

  async waitUntil(
    stopCondition: () => boolean,
    maxTime = 60,
  ): Promise<void> {
    await this.wait(maxTime, stopCondition);
  }

  /** Handle introducer/remover flags after animations complete. */
  private _cleanUpAfterAnimations(animations: IAnimation[]): void {
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

  // ─── Section management ──────────────────────────────────

  nextSection(
    name = "unnamed",
    sectionType: string = DefaultSectionType.NORMAL,
    _skipAnimations = false,
  ): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // In the full pipeline this delegates to renderer.fileWriter.nextSection()
  }

  // ─── Subcaptions / Sound ─────────────────────────────────

  addSubcaption(
    content: string,
    duration = 1,
    offset = 0,
  ): void {
    this.subcaptions.push({
      content,
      startTime: this._time + offset,
      endTime: this._time + offset + duration,
    });
  }

  addSound(
    _soundFile: string,
    _timeOffset = 0,
    _gain?: number,
  ): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // Delegates to renderer.fileWriter.addSound()
  }

  // ─── Compile helpers ─────────────────────────────────────

  getRunTime(animations: IAnimation[]): number {
    if (animations.length === 0) return 0;
    return Math.max(...animations.map((a) => a.runTime));
  }

  static validateRunTime(
    runTime: number,
    methodName: string,
    parameterName = "runTime",
  ): number {
    if (runTime <= 0) {
      throw new Error(
        `${methodName} has a ${parameterName} of ${runTime} <= 0 seconds ` +
          `which cannot be rendered. The ${parameterName} must be a positive number.`,
      );
    }
    return runTime;
  }

  updateToTime(t: number): void {
    const dt = t - this.lastT;
    this.lastT = t;
    if (this.animations !== null) {
      for (const anim of this.animations) {
        const alpha = Math.min(t / anim.runTime, 1);
        anim.interpolate(alpha);
      }
    }
    this.updateMobjects(dt);
    this.updateSelf(dt);
  }

  // ─── Utility ─────────────────────────────────────────────

  getAttrs(...keys: string[]): unknown[] {
    return keys.map((key) => (this as Record<string, unknown>)[key]);
  }

  toString(): string {
    return this.constructor.name;
  }

  // ─── Interactive / OpenGL stubs ──────────────────────────

  // These methods are OpenGL-specific and are stubbed out.
  // TODO: Port from Cairo/OpenGL — needs manual rendering implementation

  onMouseMotion(_point: Point3D, _dPoint: Point3D): void {}
  onMouseScroll(_point: Point3D, _offset: Point3D): void {}
  onKeyPress(_symbol: number, _modifiers: number): void {}
  onKeyRelease(_symbol: number, _modifiers: number): void {}
  onMouseDrag(
    _point: Point3D,
    _dPoint: Point3D,
    _buttons: number,
    _modifiers: number,
  ): void {}
  onMousePress(_point: Point3D, _button: string, _modifiers: number): void {}

  setKeyFunction(char: string, func: () => void): void {
    // Stored for interactive mode (OpenGL)
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
  }

  interactiveEmbed(): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
  }

  embed(): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
  }
}

// ─── Internal helpers ──────────────────────────────────────

/** Sentinel error to end a scene early in construct(). */
export class EndSceneEarlyError extends Error {
  constructor() {
    super("Scene ended early");
    this.name = "EndSceneEarlyError";
  }
}

/** Interface for Wait-like animations that carry a stopCondition. */
interface WaitLike extends IAnimation {
  stopCondition: (() => boolean) | null;
}
