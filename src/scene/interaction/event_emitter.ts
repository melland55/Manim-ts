/**
 * Lightweight EventEmitter used by interactive mobjects and pointer dispatch.
 * Not part of Python Manim.
 */

export type Listener<T = unknown> = (payload: T) => void;

export class EventEmitter<EventMap extends Record<string, unknown> = Record<string, unknown>> {
  private _listeners: Map<keyof EventMap, Set<Listener>> = new Map();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener as Listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    this._listeners.get(event)?.delete(listener as Listener);
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    const off = this.on(event, ((payload: EventMap[K]) => {
      off();
      listener(payload);
    }) as Listener<EventMap[K]>);
    return off;
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const l of set) {
      try {
        (l as Listener<EventMap[K]>)(payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("EventEmitter listener error:", e);
      }
    }
  }

  /** Returns true if any listener for `event` would match (including "*"). */
  hasListeners<K extends keyof EventMap>(event: K): boolean {
    const set = this._listeners.get(event);
    return !!set && set.size > 0;
  }

  removeAllListeners<K extends keyof EventMap>(event?: K): void {
    if (event === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(event);
    }
  }
}

// ─── Mobject pointer event payload ───────────────────────────

export interface PointerEventPayload {
  /** Scene-space coordinate (x, y, z=0). */
  sceneX: number;
  sceneY: number;
  /** Canvas pixel coordinate. */
  canvasX: number;
  canvasY: number;
  /** Native event for advanced use (may be null in synthetic dispatch). */
  nativeEvent: PointerEvent | MouseEvent | null;
  /** Mobject the event is being dispatched to. */
  target: unknown;
  /** Optional drag delta (only on drag event). */
  deltaX?: number;
  deltaY?: number;
  /** If true, stop event from bubbling to parent mobjects. */
  stopPropagation: () => void;
  /** Whether propagation was requested stopped. */
  propagationStopped: boolean;
}

export type MobjectPointerEvents = {
  click: PointerEventPayload;
  pointerdown: PointerEventPayload;
  pointerup: PointerEventPayload;
  pointermove: PointerEventPayload;
  pointerenter: PointerEventPayload;
  pointerleave: PointerEventPayload;
  hover: PointerEventPayload;
  drag: PointerEventPayload;
  dragstart: PointerEventPayload;
  dragend: PointerEventPayload;
  [key: string]: unknown;
};
