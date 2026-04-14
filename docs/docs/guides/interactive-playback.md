---
title: Interactive Playback
sidebar_position: 4
---

# Interactive Playback

manim-ts ships with an **opt-in** timeline layer that lets you scrub, pause, resume, and seek through scenes in real time — without changing how you write animations. This is purely additive on top of the Python-Manim-mirrored core: scenes that don't enable it behave identically to Python Manim.

## Enabling playback

Pass `playback: true` to the Scene constructor:

```typescript
import { Scene, Circle, Create, BLUE } from "manim-ts";

class Demo extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    await this.play(new Create(circle));
    await this.wait(1);
  }
}

const scene = new Demo({
  canvas: document.getElementById("c") as HTMLCanvasElement,
  playback: true,
});
await scene.render();          // records a timeline during render
scene.playback.play();         // play it back from t=0
```

## The `scene.playback` object

Once enabled, `scene.playback` returns a `Timeline` instance. Access it before that and it throws — fail loud, not silent.

```typescript
scene.playbackEnabled    // true / false
scene.playback.duration  // total length of the recorded timeline, seconds
scene.playback.currentTime
scene.playback.state     // "idle" | "playing" | "paused"
scene.playback.speed     // current playback rate (default 1)
```

## Controls

```typescript
scene.playback.play();        // start (or restart if at end)
scene.playback.pause();
scene.playback.resume();
scene.playback.stop();        // pause and seek to 0
scene.playback.toggle();      // play ↔ pause

scene.playback.seek(2.5);     // jump to t = 2.5s (clamped to [0, duration])

scene.playback.setSpeed(2);   // 2× speed
scene.playback.setSpeed(-1);  // reverse playback
scene.playback.setSpeed(0.5); // 0.5×

scene.playback.setLoop(true); // wrap at end

scene.playback.clear();       // wipe recorded entries
```

## Events

Subscribe to timeline events with `on(name, listener)`. Returns an unsubscribe function.

```typescript
const off = scene.playback.on("tick", ({ time, duration, state }) => {
  progressBar.value = time / duration;
});

scene.playback.on("seek",   ({ time }) => { /* user scrubbed */ });
scene.playback.on("play",   () => { /* started */ });
scene.playback.on("pause",  () => { /* paused */ });
scene.playback.on("resume", () => { /* resumed */ });
scene.playback.on("stop",   () => { /* stopped */ });
scene.playback.on("ended",  () => { /* reached end (loop=false) */ });
scene.playback.on("record", ({ entry }) => { /* new entry added */ });
```

Call the returned function to unsubscribe: `off();`.

## Drop-in UI widget

`TimelineControls` is a zero-config DOM component that wraps the timeline with a play button, scrubber, time readout, and speed selector.

```typescript
import { TimelineControls } from "manim-ts";

const controls = new TimelineControls(
  scene.playback,
  document.getElementById("controls-container")!,
  {
    autoPlay: false,    // default
    showSpeed: true,    // default
    showTime: true,     // default
  },
);

// Later: tear down
controls.destroy();
```

The widget is self-styled (dark theme) and framework-agnostic. For React or Vue integrations, see [Framework Integrations](./react-vue).

## How it works

The timeline records one entry per `scene.play(...)` or `scene.wait(...)` call, storing:

- the animations that ran
- start/end time
- mobjects added or removed during the entry

`seek(t)` replays every recorded entry, using each animation's existing pure `interpolate(alpha)` method to produce the exact mobject state at time `t`. No per-frame snapshots — memory footprint stays small (entries, not frames), and scenes of any length work without pre-rendering.

Because the underlying render pipeline is unchanged, **every existing Python Manim animation works with seeking automatically** — `FadeIn`, `Transform`, `Write`, `LaggedStart`, `AnimationGroup`, etc.

## Limitations

- **User-provided updaters** that read external state (mouse, RNG, time of day) aren't deterministic and may not scrub cleanly — they re-run each tick.
- **Added/removed mobjects** are tracked at entry boundaries. Mid-entry additions (e.g. custom `introducer` animations) work but aren't undone when seeking back across the entry.

For most scenes — even complex ones with nested `AnimationGroup`s and `LaggedStart`s — seeking is exact and seamless.
