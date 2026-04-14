/**
 * PointerDispatcher — converts canvas pointer events into scene-coordinate
 * hits, dispatches events to mobjects that have registered listeners.
 * Not part of Python Manim.
 */

import type { IScene, IMobject, ICamera } from "../../core/types.js";
import { hitTestBBox } from "./hit_test.js";
import type { PointerEventPayload } from "./event_emitter.js";

export interface PointerDispatcherOptions {
  /** Default 5px drag threshold before a pointerdown becomes a drag. */
  dragThreshold?: number;
}

export class PointerDispatcher {
  private _scene: IScene;
  private _canvas: HTMLCanvasElement | null = null;
  private _hovered: IMobject | null = null;
  private _dragging: IMobject | null = null;
  private _pressedAt: { x: number; y: number } | null = null;
  private _pressedTarget: IMobject | null = null;
  private _dragStarted = false;
  private _dragThreshold: number;
  private _listenersAttached = false;

  constructor(scene: IScene, options: PointerDispatcherOptions = {}) {
    this._scene = scene;
    this._dragThreshold = options.dragThreshold ?? 5;

    // Bind for listener add/remove symmetry
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    if (this._canvas === canvas) return;
    this._detach();
    this._canvas = canvas;
    this._attach();
  }

  get canvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  detach(): void {
    this._detach();
    this._canvas = null;
  }

  // ─── Hit testing ─────────────────────────────────────────

  hitTest(sceneX: number, sceneY: number): IMobject | null {
    return hitTestBBox(this._scene.mobjects, sceneX, sceneY);
  }

  // ─── Coordinate conversion ───────────────────────────────

  /**
   * Convert canvas pixel coords (from a MouseEvent) to scene coords.
   * Uses the scene's camera for projection. Falls back to a simple
   * pixel-to-world mapping if the camera doesn't expose a projection.
   */
  canvasToScene(canvasX: number, canvasY: number): { x: number; y: number } {
    if (!this._canvas) return { x: canvasX, y: canvasY };
    const camera = this._scene.camera as unknown as {
      frameWidth?: number;
      frameHeight?: number;
      frameCenter?: [number, number, number] | { at?: (i: number) => number };
      pixelWidth?: number;
      pixelHeight?: number;
      pixelToFrame?: (x: number, y: number) => { x: number; y: number };
    };

    // Prefer camera-provided projection if present
    if (typeof camera.pixelToFrame === "function") {
      return camera.pixelToFrame(canvasX, canvasY);
    }

    const pixelW = camera.pixelWidth ?? this._canvas.width;
    const pixelH = camera.pixelHeight ?? this._canvas.height;
    const frameW = camera.frameWidth ?? 14.222; // Manim default
    const frameH = camera.frameHeight ?? 8;

    let fcx = 0, fcy = 0;
    const fc = camera.frameCenter;
    if (Array.isArray(fc)) {
      fcx = fc[0];
      fcy = fc[1];
    } else if (fc && typeof (fc as { at?: (i: number) => number }).at === "function") {
      fcx = (fc as { at: (i: number) => number }).at(0);
      fcy = (fc as { at: (i: number) => number }).at(1);
    }

    // Canvas-y is flipped (screen y-down, scene y-up)
    const sx = (canvasX / pixelW - 0.5) * frameW + fcx;
    const sy = -(canvasY / pixelH - 0.5) * frameH + fcy;
    return { x: sx, y: sy };
  }

  // ─── Event attach/detach ─────────────────────────────────

  private _attach(): void {
    if (!this._canvas || this._listenersAttached) return;
    this._canvas.addEventListener("pointerdown", this._onPointerDown);
    this._canvas.addEventListener("pointermove", this._onPointerMove);
    this._canvas.addEventListener("pointerup", this._onPointerUp);
    this._canvas.addEventListener("pointerleave", this._onPointerLeave);
    this._listenersAttached = true;
  }

  private _detach(): void {
    if (!this._canvas || !this._listenersAttached) return;
    this._canvas.removeEventListener("pointerdown", this._onPointerDown);
    this._canvas.removeEventListener("pointermove", this._onPointerMove);
    this._canvas.removeEventListener("pointerup", this._onPointerUp);
    this._canvas.removeEventListener("pointerleave", this._onPointerLeave);
    this._listenersAttached = false;
  }

  // ─── Event handlers ──────────────────────────────────────

  private _onPointerDown(e: PointerEvent): void {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const scene = this.canvasToScene(canvasX, canvasY);
    const target = this.hitTest(scene.x, scene.y);

    this._pressedAt = { x: canvasX, y: canvasY };
    this._pressedTarget = target;
    this._dragStarted = false;

    if (target) {
      this._dispatch(target, "pointerdown", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
    }
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const scene = this.canvasToScene(canvasX, canvasY);
    const target = this.hitTest(scene.x, scene.y);

    // Hover enter/leave
    if (target !== this._hovered) {
      if (this._hovered) {
        this._dispatch(this._hovered, "pointerleave", {
          sceneX: scene.x,
          sceneY: scene.y,
          canvasX,
          canvasY,
          nativeEvent: e,
        });
      }
      if (target) {
        this._dispatch(target, "pointerenter", {
          sceneX: scene.x,
          sceneY: scene.y,
          canvasX,
          canvasY,
          nativeEvent: e,
        });
      }
      this._hovered = target;
    }

    // Drag detection
    if (this._pressedAt && this._pressedTarget) {
      const dx = canvasX - this._pressedAt.x;
      const dy = canvasY - this._pressedAt.y;
      if (!this._dragStarted && Math.hypot(dx, dy) >= this._dragThreshold) {
        this._dragStarted = true;
        this._dragging = this._pressedTarget;
        this._dispatch(this._dragging, "dragstart", {
          sceneX: scene.x,
          sceneY: scene.y,
          canvasX,
          canvasY,
          nativeEvent: e,
        });
      }
      if (this._dragStarted && this._dragging) {
        this._dispatch(this._dragging, "drag", {
          sceneX: scene.x,
          sceneY: scene.y,
          canvasX,
          canvasY,
          deltaX: dx,
          deltaY: dy,
          nativeEvent: e,
        });
      }
    }

    // Plain pointermove / hover for the hovered mobject
    if (target) {
      this._dispatch(target, "pointermove", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
      this._dispatch(target, "hover", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
    }
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const scene = this.canvasToScene(canvasX, canvasY);
    const target = this.hitTest(scene.x, scene.y);

    if (target) {
      this._dispatch(target, "pointerup", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
    }

    if (this._dragging) {
      this._dispatch(this._dragging, "dragend", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
      this._dragging = null;
    } else if (
      this._pressedTarget &&
      target === this._pressedTarget &&
      !this._dragStarted
    ) {
      // Click = down + up on same target without drag
      this._dispatch(this._pressedTarget, "click", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
    }

    this._pressedAt = null;
    this._pressedTarget = null;
    this._dragStarted = false;
  }

  private _onPointerLeave(e: PointerEvent): void {
    if (this._hovered) {
      const rect = this._canvas!.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const scene = this.canvasToScene(canvasX, canvasY);
      this._dispatch(this._hovered, "pointerleave", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
      this._hovered = null;
    }
    if (this._dragging) {
      const rect = this._canvas!.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const scene = this.canvasToScene(canvasX, canvasY);
      this._dispatch(this._dragging, "dragend", {
        sceneX: scene.x,
        sceneY: scene.y,
        canvasX,
        canvasY,
        nativeEvent: e,
      });
      this._dragging = null;
    }
    this._pressedAt = null;
    this._pressedTarget = null;
    this._dragStarted = false;
  }

  // ─── Dispatch helper ─────────────────────────────────────

  private _dispatch(
    mob: IMobject,
    type: string,
    partial: Omit<PointerEventPayload, "target" | "stopPropagation" | "propagationStopped">,
  ): void {
    // Walk from target up through ancestors, firing as long as not stopped
    const chain: IMobject[] = [mob];
    // Parent chain not tracked in Mobject currently; dispatch only to target.
    // (Future: walk up the submobject tree if we add parent refs.)

    for (const target of chain) {
      const emitter = (target as unknown as {
        _events?: {
          hasListeners: (t: string) => boolean;
          emit: (t: string, payload: PointerEventPayload) => void;
        };
      })._events;
      if (!emitter) continue;
      if (!emitter.hasListeners(type)) continue;

      let stopped = false;
      const payload: PointerEventPayload = {
        ...partial,
        target,
        propagationStopped: false,
        stopPropagation: () => {
          stopped = true;
        },
      };
      emitter.emit(type, payload);
      payload.propagationStopped = stopped;
      if (stopped) break;
    }
  }
}
