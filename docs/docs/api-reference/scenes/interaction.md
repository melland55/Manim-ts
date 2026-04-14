---
title: Interaction
sidebar_position: 5
---

# Interaction

Pointer event system for mobjects. Enabled by constructing a Scene with `interactive: true` and a `canvas`.

Not part of Python Manim — entirely additive.

## Mobject methods

Every `Mobject` has three event methods, available regardless of the scene's `interactive` flag:

```ts
mob.on(event: string, listener: (payload) => void): () => void  // unsubscribe
mob.off(event: string, listener: (payload) => void): void
mob.emit(event: string, payload: unknown): void
```

The internal `EventEmitter` is lazily created — mobjects that never have a listener attached pay no cost.

## PointerDispatcher

Handles canvas pointer events, coordinate conversion, hit-testing, and event dispatch.

```ts
class PointerDispatcher {
  constructor(scene: IScene, options?: PointerDispatcherOptions);
  setCanvas(canvas: HTMLCanvasElement): void;
  detach(): void;
  hitTest(sceneX: number, sceneY: number): IMobject | null;
  canvasToScene(canvasX: number, canvasY: number): { x: number; y: number };
}
```

Accessible as `scene.pointerDispatcher` (or `null` when disabled).

### Options

| Option | Default | Description |
|---|---|---|
| `dragThreshold` | `5` | Pixels of movement before a pointerdown becomes a drag |

## Hit testing

```ts
import { hitTestBBox, getBoundingBox } from "manim-ts";

// Find top-most mobject whose bbox contains (x, y)
const mob = hitTestBBox(scene.mobjects, 1.2, -0.4);

// Compute bbox of a single mobject
const bbox = getBoundingBox(mob);
// → { minX, maxX, minY, maxY, minZ, maxZ } | null
```

Bounding-box tests are fast but imprecise for hollow shapes. For precise hit-testing, pass a custom filter to `hitTestBBox({ filter: (m) => ... })`.

## Event types

See the [Pointer Events Guide](/docs/guides/pointer-events#event-types) for the full list. Mobject events include `click`, `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `hover`, `dragstart`, `drag`, and `dragend`.

## PointerEventPayload

```ts
interface PointerEventPayload {
  sceneX: number;
  sceneY: number;
  canvasX: number;
  canvasY: number;
  nativeEvent: PointerEvent | MouseEvent | null;
  target: Mobject;
  deltaX?: number;          // only on drag events
  deltaY?: number;
  stopPropagation(): void;
  propagationStopped: boolean;
}
```

## makeInteractive(mob)

Explicitly attach the EventEmitter to a mobject and return it. Equivalent to calling `mob.on()` for the first time but useful when you want direct emitter access:

```ts
import { makeInteractive } from "manim-ts";

const emitter = makeInteractive(circle);
emitter.on("click", handler);
emitter.removeAllListeners();
```

## See also

- [Pointer Events Guide](/docs/guides/pointer-events) — tutorial with draggable example
- [Scene API](./scene#additive-apis) — `scene.mobjectAt()`, `scene.attachCanvas()`
