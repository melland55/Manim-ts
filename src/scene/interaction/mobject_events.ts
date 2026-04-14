/**
 * Attach an EventEmitter to a mobject so it can receive pointer events.
 * Additive helper — not part of Python Manim.
 *
 * The emitter is stored on the private `_events` slot (read by
 * PointerDispatcher). Repeated calls are idempotent.
 *
 * Usage:
 *   const circle = new Circle();
 *   makeInteractive(circle).on("click", (e) => console.log("clicked", e));
 *   // or the shorthand methods exposed on Mobject itself:
 *   circle.on("click", ...);
 */

import type { IMobject } from "../../core/types.js";
import { EventEmitter, type MobjectPointerEvents } from "./event_emitter.js";

type WithEvents = {
  _events?: EventEmitter<MobjectPointerEvents>;
};

export function makeInteractive(
  mob: IMobject,
): EventEmitter<MobjectPointerEvents> {
  const target = mob as unknown as WithEvents;
  if (!target._events) {
    target._events = new EventEmitter<MobjectPointerEvents>();
  }
  return target._events;
}

export function getEventEmitter(
  mob: IMobject,
): EventEmitter<MobjectPointerEvents> | null {
  return (mob as unknown as WithEvents)._events ?? null;
}
