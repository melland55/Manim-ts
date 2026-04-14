---
title: Pointer Events
sidebar_position: 5
---

# Pointer Events

manim-ts includes an **opt-in** pointer event system so mobjects can respond to clicks, hovers, and drags. Like the timeline, it is additive on top of the Python-Manim-mirrored core — scenes that don't enable it behave identically to Python Manim.

## Enabling interaction

Pass `interactive: true` and a `canvas` to the Scene constructor:

```typescript
import { Scene, Circle, BLUE } from "manim-ts";

class Demo extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    circle.on("click", (e) => {
      console.log("clicked at scene coords", e.sceneX, e.sceneY);
    });
    this.add(circle);
  }
}

const scene = new Demo({
  canvas: document.getElementById("c") as HTMLCanvasElement,
  interactive: true,
});
await scene.render();
```

## Listening for events

Every `Mobject` exposes three methods:

```typescript
mob.on(event, listener): () => void  // returns an unsubscribe function
mob.off(event, listener): void
mob.emit(event, payload): void       // synthetic dispatch (rare)
```

The emitter is **lazily created on first `.on()` call**, so mobjects you never listen on pay zero cost.

## Event types

| Event | Fires when |
|---|---|
| `click` | Pointer press + release on the same mobject, with no drag |
| `pointerdown` | Pointer press over a mobject |
| `pointerup` | Pointer release over a mobject |
| `pointermove` | Pointer moves while over a mobject |
| `pointerenter` | Pointer enters a mobject's hit region |
| `pointerleave` | Pointer leaves a mobject's hit region |
| `hover` | Alias fired continuously while the pointer is over a mobject |
| `dragstart` | Pointer moves past drag threshold (default 5px) after press |
| `drag` | Pointer moves during an active drag |
| `dragend` | Pointer released (or left canvas) during an active drag |

## Event payload

Every listener receives a `PointerEventPayload`:

```typescript
interface PointerEventPayload {
  sceneX: number;      // scene-space coordinates
  sceneY: number;
  canvasX: number;     // raw canvas pixel coordinates
  canvasY: number;
  nativeEvent: PointerEvent | MouseEvent | null;
  target: Mobject;
  deltaX?: number;     // only on drag events
  deltaY?: number;
  stopPropagation(): void;  // prevent bubbling to other listeners
  propagationStopped: boolean;
}
```

## Example — draggable circle

```typescript
const circle = new Circle({ radius: 0.5, color: BLUE });

let dragging = false;
let origin = { x: 0, y: 0 };

circle.on("dragstart", (e) => {
  dragging = true;
  const c = circle.getCenter();
  origin = { x: c[0] - e.sceneX, y: c[1] - e.sceneY };
});

circle.on("drag", (e) => {
  if (!dragging) return;
  circle.moveTo([e.sceneX + origin.x, e.sceneY + origin.y, 0]);
});

circle.on("dragend", () => {
  dragging = false;
});
```

## Hit-testing from user code

If you want to hit-test outside of a pointer event, use `scene.mobjectAt(x, y)`:

```typescript
const mob = scene.mobjectAt(1.2, -0.4);
if (mob) console.log("mobject under point:", mob.name);
```

Returns `null` if nothing is hit, or if `interactive: false`.

## How hit-testing works

Hit-testing uses axis-aligned bounding boxes computed from each mobject's point array, recursing into submobjects to find the topmost hit. This is fast (microseconds per test) but imprecise for hollow shapes or transparent regions — a click inside the hole of an annulus still registers on the annulus.

For precise path-based hit-testing, access `scene.pointerDispatcher` and provide a custom filter, or use the public `hitTestBBox()` utility as a starting point.

## Attaching the canvas later

If you don't have the canvas at construction time (e.g., a React component using `useRef`), use `attachCanvas()`:

```typescript
const scene = new Demo({ interactive: true });
// ...after mount...
scene.attachCanvas(canvasRef.current!);
await scene.render();
```

## Detaching

`scene.pointerDispatcher?.detach()` removes all canvas event listeners. Useful in component unmount handlers — the React and Vue wrappers call this automatically.
