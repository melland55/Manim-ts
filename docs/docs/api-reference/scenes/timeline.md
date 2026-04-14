---
title: Timeline
sidebar_position: 4
---

# Timeline

The `Timeline` class records scene animations so they can be replayed, seeked, paused, and scrubbed. It's the engine behind `scene.playback.*` when a scene is constructed with `playback: true`.

Not part of Python Manim — entirely additive.

## Construction

You usually don't construct a `Timeline` directly; it's created for you when `playback: true` is passed to the Scene:

```ts
const scene = new MyScene({ playback: true });
scene.playback  // Timeline instance
```

Direct construction is available for advanced use:

```ts
import { Timeline } from "manim-ts";
const tl = new Timeline(scene);
```

## Interface

```ts
class Timeline {
  readonly entries: readonly TimelineEntry[];
  readonly duration: number;
  readonly currentTime: number;
  readonly state: "idle" | "playing" | "paused";
  readonly speed: number;
  readonly loop: boolean;

  // Playback
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  toggle(): void;
  seek(t: number): void;
  setSpeed(s: number): void;
  setLoop(loop: boolean): void;

  // Recording (usually called by Scene internally)
  recordPlay(startT, endT, animations, added?, removed?): TimelineEntry;
  recordWait(startT, endT): TimelineEntry;
  clear(): void;

  // Events
  on(event, listener): () => void;
  off(event, listener): void;
}
```

## TimelineEntry

Each entry corresponds to one `scene.play()` or `scene.wait()` call:

```ts
interface TimelineEntry {
  kind: "play" | "wait";
  startT: number;
  endT: number;
  animations: IAnimation[];       // empty for "wait"
  mobjectsAdded: IMobject[];      // introduced during this entry
  mobjectsRemoved: IMobject[];    // removed during this entry
}
```

## Events

| Event | Fires when |
|---|---|
| `tick` | Per-frame during playback |
| `seek` | After `seek(t)` is called |
| `play` | When playback starts |
| `pause` | When `pause()` is called |
| `resume` | When `resume()` is called |
| `stop` | When `stop()` is called |
| `ended` | When playback reaches the end (loop=false) |
| `record` | When a new entry is appended during `scene.play()` / `scene.wait()` |

All listeners receive a payload of `{ time, duration, state, entry? }`.

## See also

- [Interactive Playback Guide](/docs/guides/interactive-playback) — full tutorial with controls widget
- [TimelineControls](/docs/guides/interactive-playback#drop-in-ui-widget) — ready-made DOM UI
