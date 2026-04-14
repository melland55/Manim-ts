---
title: React & Vue Integration
sidebar_position: 6
---

# React & Vue Integration

manim-ts ships with drop-in wrapper components for React and Vue 3 that handle the canvas lifecycle, mounting, playback controls, and cleanup. Both wrappers are published as subpath imports (`manim-ts/react`, `manim-ts/vue`) and declare their framework as an optional peer dependency — so users who don't need them don't have to install React or Vue.

## React

### Installation

```bash
npm install manim-ts react react-dom
```

### Usage

```tsx
import { ManimScene } from "manim-ts/react";
import { Scene, Circle, Create, BLUE } from "manim-ts";

class Demo extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    await this.play(new Create(circle));
    await this.wait(1);
  }
}

export function App() {
  return (
    <ManimScene
      sceneClass={Demo}
      controls         // shows play/pause/scrubber
      playback
      interactive
      width={800}
      height={450}
      onReady={(scene) => console.log("scene ready", scene)}
    />
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `sceneClass` | `new (opts) => Scene` | — | A Scene subclass constructor (required) |
| `controls` | `boolean` | `false` | Show the play/pause/scrubber UI. Implies `playback: true` |
| `playback` | `boolean` | `false` | Enable timeline recording (required for controls or programmatic seek) |
| `interactive` | `boolean` | `false` | Enable `mobject.on(...)` pointer events |
| `width` | `number` | `800` | Canvas width in pixels |
| `height` | `number` | `450` | Canvas height in pixels |
| `autoPlay` | `boolean` | `false` | Start playback when construct() completes |
| `frameRate` | `number` | `30` | Target frame rate |
| `className` | `string` | — | CSS class for the wrapping `<div>` |
| `style` | `CSSProperties` | — | Inline styles for the wrapping `<div>` |
| `onReady` | `(scene) => void` | — | Called with the Scene instance after construct |

The component handles canvas sizing, playback controls mounting, and cleanup on unmount automatically — including pointer dispatcher detachment and timeline stop.

## Vue 3

### Installation

```bash
npm install manim-ts vue
```

### Usage

```vue
<script setup lang="ts">
import { ManimScene } from "manim-ts/vue";
import { Scene, Circle, Create, BLUE } from "manim-ts";

class Demo extends Scene {
  async construct() {
    const circle = new Circle({ color: BLUE });
    await this.play(new Create(circle));
    await this.wait(1);
  }
}

function onReady(scene: Scene) {
  console.log("scene ready", scene);
}
</script>

<template>
  <ManimScene
    :scene-class="Demo"
    controls
    playback
    interactive
    :width="800"
    :height="450"
    @ready="onReady"
  />
</template>
```

### Props

Same shape as the React component — all opt-in. The Vue component emits a `ready` event with the Scene instance (use `@ready="..."`), and cleans up on `onBeforeUnmount`.

## Peer dependencies

Both `react` and `vue` are declared in `peerDependencies` with `peerDependenciesMeta: { optional: true }`. You only install the framework you use; the other subpath import will throw at module load if accessed without its peer.

## Under the hood

The wrappers are thin — they mount a `<canvas>`, construct the Scene with that canvas attached, call `scene.render()`, and optionally mount `TimelineControls`. Everything they do is possible with the plain API; the wrappers just save you the lifecycle boilerplate. If you need something the wrappers don't expose, reach for the plain API directly — nothing about these wrappers is load-bearing.
