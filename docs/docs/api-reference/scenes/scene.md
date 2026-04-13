---
title: Scene
sidebar_position: 1
---

# Scene

The `Scene` class is the main container for building mathematical animations in manim-ts. Every animation you create starts by subclassing `Scene` and implementing its `construct()` method.

## Overview

A Scene manages the lifecycle of mobjects and animations. It holds a collection of mobjects, orchestrates their animations over time, and delegates rendering to a `Renderer`.

```ts
import { Scene, Circle, Create } from "manim-ts";

class MyScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle({ radius: 1, color: BLUE });
    this.add(circle);
    await this.play(new Create(circle));
    await this.wait(1);
  }
}
```

## Python to TypeScript

The most significant change from Python Manim is that `construct()` is **async**. Python Manim uses generator-based coroutines internally, but manim-ts uses native `async/await`.

| Python Manim | manim-ts |
|---|---|
| `def construct(self):` | `async construct(): Promise<void>` |
| `self.play(Create(circle))` | `await this.play(new Create(circle))` |
| `self.wait(2)` | `await this.wait(2)` |
| `self.add(mob)` | `this.add(mob)` |
| `self.remove(mob)` | `this.remove(mob)` |

## SceneOptions

Configure a scene by passing an options object to the constructor.

```ts
interface SceneOptions {
  camera?: Camera;
  renderer?: IRenderer;
  skipAnimations?: boolean;
  alwaysUpdateMobjects?: boolean;
  randomSeed?: number;
}
```

| Option | Default | Description |
|---|---|---|
| `camera` | `new Camera()` | The camera used to frame the scene |
| `renderer` | `new Renderer()` | The renderer used to draw mobjects |
| `skipAnimations` | `false` | If true, animations are skipped (useful for testing) |
| `alwaysUpdateMobjects` | `false` | If true, all mobjects update every frame even outside animations |
| `randomSeed` | `undefined` | Seed for deterministic random behavior |

## Key Methods

### Managing Mobjects

#### `add(...mobjects: IMobject[]): this`

Adds one or more mobjects to the scene. Added mobjects will be rendered on the next frame.

```ts
const circle = new Circle();
const square = new Square();
this.add(circle, square);
```

#### `remove(...mobjects: IMobject[]): this`

Removes one or more mobjects from the scene.

```ts
this.remove(circle);
```

#### `clear(): this`

Removes all mobjects from the scene.

### Playing Animations

#### `async play(...animations: IAnimation[]): Promise<void>`

Plays one or more animations. Multiple animations passed to a single `play()` call run simultaneously.

```ts
// Sequential
await this.play(new FadeIn(circle));
await this.play(new FadeOut(circle));

// Simultaneous
await this.play(new FadeIn(circle), new GrowFromCenter(square));
```

#### `async wait(duration?: number): Promise<void>`

Pauses the scene for a given duration (in seconds). Defaults to 1 second.

```ts
await this.wait(2); // Wait 2 seconds
```

### The construct() Method

#### `async construct(): Promise<void>`

The main method you override to build your animation. This is where you add mobjects and play animations. It is called automatically when the scene is rendered.

```ts
class ExampleScene extends Scene {
  async construct(): Promise<void> {
    const text = new Text("Hello, manim-ts!");
    await this.play(new Write(text));
    await this.wait();
    await this.play(new FadeOut(text));
  }
}
```

### Utility Methods

#### `getMobjects(): IMobject[]`

Returns a copy of the current list of mobjects in the scene.

#### `getTopLevelMobjects(): IMobject[]`

Returns only mobjects that are not submobjects of other mobjects in the scene.

#### `restructureMobjects(toRemove: IMobject[], toAdd?: IMobject[]): void`

Low-level method for restructuring the mobject list. Used internally by animations.

## EndSceneEarlyError

Throw `EndSceneEarlyError` to terminate `construct()` early. This is useful for debugging or conditional scene termination.

```ts
import { EndSceneEarlyError } from "manim-ts";

class DebugScene extends Scene {
  async construct(): Promise<void> {
    const circle = new Circle();
    this.add(circle);
    await this.play(new Create(circle));

    // Stop here during development
    throw new EndSceneEarlyError();

    // This code won't run
    await this.play(new FadeOut(circle));
  }
}
```

The error is caught internally by the scene runner and does not propagate as an unhandled exception.

## Scene Lifecycle

1. **Construction** — `new MyScene(options)` creates the scene with its camera and renderer.
2. **Setup** — `setup()` is called before `construct()` for any pre-construction initialization.
3. **Construct** — `construct()` runs your animation code.
4. **Teardown** — `tearDown()` is called after `construct()` completes for cleanup.

```ts
class MyScene extends Scene {
  setup(): void {
    // Called before construct()
    // Good place to create reusable mobjects
  }

  async construct(): Promise<void> {
    // Your animation code here
  }

  tearDown(): void {
    // Called after construct()
    // Cleanup resources
  }
}
```

## Interactive Scenes

For interactive or embedded use (e.g., in a web page), you can control the scene manually:

```ts
const scene = new MyScene({
  renderer: new Renderer(),
});

// Render to a canvas element
scene.renderer.init(document.getElementById("canvas") as HTMLCanvasElement);
await scene.render();
```
