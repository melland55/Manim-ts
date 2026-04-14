/**
 * Timeline — records scene animations so they can be replayed, seeked,
 * paused, and scrubbed. Additive layer on top of the Python-Manim-mirrored
 * `Scene.play()` pipeline; does not affect Python-parity behavior when
 * disabled.
 *
 * Not part of Python Manim.
 */

import type { IAnimation, IMobject, IScene } from "../../core/types.js";

// ─── Entry types ─────────────────────────────────────────────

export type EntryKind = "play" | "wait";

export interface TimelineEntry {
  kind: EntryKind;
  startT: number;
  endT: number;
  /** For "play" entries: the animations that ran. Empty for "wait". */
  animations: IAnimation[];
  /** Mobjects introduced by this entry (added when seeking forward past it). */
  mobjectsAdded: IMobject[];
  /** Mobjects removed by this entry (removed when seeking forward past it). */
  mobjectsRemoved: IMobject[];
}

// ─── Playback state ──────────────────────────────────────────

export type PlaybackState = "idle" | "playing" | "paused";

export type TimelineEventName =
  | "tick"
  | "seek"
  | "play"
  | "pause"
  | "resume"
  | "stop"
  | "ended"
  | "record";

export type TimelineListener = (payload: TimelineEventPayload) => void;

export interface TimelineEventPayload {
  time: number;
  duration: number;
  state: PlaybackState;
  entry?: TimelineEntry;
}

// ─── Timeline ────────────────────────────────────────────────

export class Timeline {
  private _scene: IScene;
  private _entries: TimelineEntry[] = [];
  private _currentTime = 0;
  private _state: PlaybackState = "idle";
  private _speed = 1;
  private _loop = false;
  private _rafHandle: number | null = null;
  private _lastFrameMs = 0;
  private _listeners: Map<TimelineEventName, Set<TimelineListener>> = new Map();

  constructor(scene: IScene) {
    this._scene = scene;
  }

  // ─── Recording (called by Scene.play() when playback is enabled) ──

  /**
   * Append a play-entry. Called by Scene.play() after animations have been
   * initialized (begin() called) and their `startingMobject` snapshots exist.
   */
  recordPlay(
    startT: number,
    endT: number,
    animations: IAnimation[],
    mobjectsAdded: IMobject[] = [],
    mobjectsRemoved: IMobject[] = [],
  ): TimelineEntry {
    const entry: TimelineEntry = {
      kind: "play",
      startT,
      endT,
      animations,
      mobjectsAdded,
      mobjectsRemoved,
    };
    this._entries.push(entry);
    this._currentTime = endT;
    this._emit("record", { entry });
    return entry;
  }

  /** Record a wait/pause — no animations, just elapsed time. */
  recordWait(startT: number, endT: number): TimelineEntry {
    const entry: TimelineEntry = {
      kind: "wait",
      startT,
      endT,
      animations: [],
      mobjectsAdded: [],
      mobjectsRemoved: [],
    };
    this._entries.push(entry);
    this._currentTime = endT;
    this._emit("record", { entry });
    return entry;
  }

  // ─── Accessors ─────────────────────────────────────────────

  get entries(): readonly TimelineEntry[] {
    return this._entries;
  }

  /** Total duration of the recorded timeline, in seconds. */
  get duration(): number {
    if (this._entries.length === 0) return 0;
    return this._entries[this._entries.length - 1].endT;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get speed(): number {
    return this._speed;
  }

  setSpeed(s: number): void {
    if (!Number.isFinite(s)) throw new Error("Speed must be finite.");
    this._speed = s;
  }

  get loop(): boolean {
    return this._loop;
  }

  setLoop(loop: boolean): void {
    this._loop = loop;
  }

  // ─── Seeking ───────────────────────────────────────────────

  /**
   * Jump to an arbitrary time in the timeline. Restores scene state by
   * replaying every recorded animation in order, using the pure
   * `interpolate(alpha)` primitive that each Animation already provides.
   *
   * Assumptions:
   *   - Each animation's `startingMobject` snapshot (captured by begin())
   *     is still valid.
   *   - Animations are semi-pure: interpolate(alpha) fully determines the
   *     mobject's state for that alpha relative to startingMobject.
   */
  seek(t: number): void {
    const clamped = Math.max(0, Math.min(t, this.duration));
    this._applyStateAt(clamped);
    this._currentTime = clamped;
    this._emit("seek", {});
  }

  /**
   * Compute and apply scene state at time t by replaying every entry in
   * order. This is O(n_entries) per seek — for typical scenes (< 1000
   * entries) well under a millisecond.
   */
  private _applyStateAt(t: number): void {
    // Track scene membership as we replay
    const scene = this._scene;

    for (const entry of this._entries) {
      if (entry.endT <= t) {
        // Entry is fully past — apply final state
        if (entry.kind === "play") {
          for (const anim of entry.animations) {
            try {
              anim.interpolate(1);
            } catch {
              /* animation state may be stale — skip */
            }
          }
        }
        // Apply membership changes
        for (const mob of entry.mobjectsAdded) {
          if (!scene.mobjects.includes(mob)) scene.add(mob);
        }
        for (const mob of entry.mobjectsRemoved) {
          scene.remove(mob);
        }
      } else if (entry.startT >= t) {
        // Entry is fully ahead — animations should show pre-begin state.
        // interpolate(0) resets mobject to startingMobject state.
        if (entry.kind === "play") {
          for (const anim of entry.animations) {
            try {
              anim.interpolate(0);
            } catch {
              /* skip */
            }
          }
        }
        // Undo membership changes
        for (const mob of entry.mobjectsAdded) {
          scene.remove(mob);
        }
        for (const mob of entry.mobjectsRemoved) {
          if (!scene.mobjects.includes(mob)) scene.add(mob);
        }
      } else {
        // Entry partially elapsed
        const duration = entry.endT - entry.startT;
        const alpha = duration > 0 ? (t - entry.startT) / duration : 1;
        if (entry.kind === "play") {
          for (const anim of entry.animations) {
            try {
              anim.interpolate(Math.max(0, Math.min(alpha, 1)));
            } catch {
              /* skip */
            }
          }
        }
        // For partial entries, mobjectsAdded have been added (introducer
        // entries add them at begin), mobjectsRemoved are still present.
        for (const mob of entry.mobjectsAdded) {
          if (!scene.mobjects.includes(mob)) scene.add(mob);
        }
      }
    }
  }

  // ─── Playback ──────────────────────────────────────────────

  /**
   * Start (or resume) real-time playback. Drives `seek()` from
   * requestAnimationFrame, advancing currentTime by (dt * speed).
   */
  play(): void {
    if (this._state === "playing") return;
    if (this._currentTime >= this.duration && this._speed > 0) {
      this._currentTime = 0;
    }
    this._state = "playing";
    this._lastFrameMs = this._now();
    this._emit("play", {});
    this._scheduleFrame();
  }

  pause(): void {
    if (this._state !== "playing") return;
    this._state = "paused";
    this._cancelFrame();
    this._emit("pause", {});
  }

  resume(): void {
    if (this._state === "playing") return;
    this._state = "playing";
    this._lastFrameMs = this._now();
    this._emit("resume", {});
    this._scheduleFrame();
  }

  stop(): void {
    this._state = "idle";
    this._cancelFrame();
    this.seek(0);
    this._emit("stop", {});
  }

  toggle(): void {
    if (this._state === "playing") this.pause();
    else this.play();
  }

  // ─── Clear ─────────────────────────────────────────────────

  /** Wipe recorded entries. */
  clear(): void {
    this._entries = [];
    this._currentTime = 0;
    this._state = "idle";
    this._cancelFrame();
  }

  // ─── Events ────────────────────────────────────────────────

  on(event: TimelineEventName, listener: TimelineListener): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  off(event: TimelineEventName, listener: TimelineListener): void {
    this._listeners.get(event)?.delete(listener);
  }

  private _emit(event: TimelineEventName, extra: Partial<TimelineEventPayload>): void {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;
    const payload: TimelineEventPayload = {
      time: this._currentTime,
      duration: this.duration,
      state: this._state,
      ...extra,
    };
    for (const listener of set) {
      try {
        listener(payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Timeline listener error:", e);
      }
    }
  }

  // ─── Internal: RAF loop ────────────────────────────────────

  private _scheduleFrame(): void {
    if (typeof requestAnimationFrame === "undefined") {
      // Node / headless — fall back to setTimeout at 60fps
      this._rafHandle = setTimeout(() => this._tick(), 1000 / 60) as unknown as number;
      return;
    }
    this._rafHandle = requestAnimationFrame(() => this._tick());
  }

  private _cancelFrame(): void {
    if (this._rafHandle === null) return;
    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this._rafHandle);
    } else {
      clearTimeout(this._rafHandle as unknown as ReturnType<typeof setTimeout>);
    }
    this._rafHandle = null;
  }

  private _tick(): void {
    if (this._state !== "playing") return;
    const now = this._now();
    const dtMs = now - this._lastFrameMs;
    this._lastFrameMs = now;

    let next = this._currentTime + (dtMs / 1000) * this._speed;
    const dur = this.duration;

    if (next >= dur && this._speed > 0) {
      if (this._loop) {
        next = next % (dur || 1);
      } else {
        next = dur;
        this._applyStateAt(next);
        this._currentTime = next;
        this._state = "idle";
        this._emit("tick", {});
        this._emit("ended", {});
        return;
      }
    } else if (next <= 0 && this._speed < 0) {
      if (this._loop) {
        next = dur + next;
      } else {
        next = 0;
        this._applyStateAt(next);
        this._currentTime = next;
        this._state = "idle";
        this._emit("tick", {});
        this._emit("ended", {});
        return;
      }
    }

    this._applyStateAt(next);
    this._currentTime = next;
    this._emit("tick", {});
    this._scheduleFrame();
  }

  private _now(): number {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
}
