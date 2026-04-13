---
title: Config Operations
sidebar_position: 6
---

# Config Operations

Utilities for managing configuration objects, recursive dictionary merging, and descriptor classes used by the shader/uniform system.

```ts
import {
  mergeDictsRecursively,
  updateDictRecursively,
  DictAsObject,
} from "manim-ts";
```

## Dictionary Merging

### `mergeDictsRecursively(...dicts: Record<string, any>[]): Record<string, any>`

Merges multiple configuration objects into a single object. Nested objects are merged recursively rather than overwritten. Later dictionaries take precedence for non-object values.

```ts
const defaults = {
  color: "blue",
  stroke: { width: 2, opacity: 1.0 },
  fill: { opacity: 0.0 },
};

const overrides = {
  color: "red",
  stroke: { width: 4 },
};

const merged = mergeDictsRecursively(defaults, overrides);
// => {
//   color: "red",
//   stroke: { width: 4, opacity: 1.0 },  // width overridden, opacity preserved
//   fill: { opacity: 0.0 },               // preserved from defaults
// }
```

This is used throughout manim-ts for merging option objects. When a mobject or animation accepts an options object, the user-provided options are merged recursively with defaults.

### `updateDictRecursively(target: Record<string, any>, source: Record<string, any>): Record<string, any>`

Mutates `target` in place by recursively merging values from `source`. Unlike `mergeDictsRecursively`, this modifies the target object rather than creating a new one.

```ts
const config = {
  camera: { width: 1920, height: 1080 },
  scene: { background: "black" },
};

updateDictRecursively(config, {
  camera: { width: 3840, height: 2160 },
});

// config is now:
// {
//   camera: { width: 3840, height: 2160 },
//   scene: { background: "black" },
// }
```

## DictAsObject

A utility class that allows dictionary-style access with dot notation. Wraps a plain object and provides property-style access to its keys.

```ts
const config = new DictAsObject({
  frameRate: 60,
  pixelWidth: 1920,
  pixelHeight: 1080,
});

config.frameRate;    // => 60
config.pixelWidth;   // => 1920
config["pixelHeight"]; // => 1080 (bracket access also works)
```

In Python Manim, this pattern is used for the global configuration object. In manim-ts, it provides the same flexible access pattern.

## Descriptor Classes

These classes implement the descriptor pattern for managing shader uniforms and data buffers. They are used internally by the rendering system.

### `DataDescriptor`

Describes a data attribute for shader programs. Manages typed arrays of vertex data (positions, colors, etc.).

```ts
interface DataDescriptorOptions {
  name: string;
  dtype: string;       // e.g., "float32", "float64"
  shape: number[];     // e.g., [3] for vec3, [4] for vec4
  default?: number[];
}
```

DataDescriptor is used in the OpenGL rendering path to define vertex attributes:

```ts
const positionDesc = new DataDescriptor({
  name: "position",
  dtype: "float32",
  shape: [3],
  default: [0, 0, 0],
});
```

### `UniformsDescriptor`

Describes uniform variables passed to shader programs. Uniforms are values that remain constant across all vertices in a single draw call (e.g., transform matrices, colors, opacity).

```ts
const uniforms = new UniformsDescriptor({
  color: [1.0, 0.0, 0.0, 1.0],      // vec4 RGBA
  opacity: 1.0,                        // float
  modelMatrix: mat4.create(),          // mat4
});

uniforms.get("color");     // => [1.0, 0.0, 0.0, 1.0]
uniforms.set("opacity", 0.5);
```

## Usage in the Codebase

Config operations are primarily used in three areas:

1. **Mobject construction** -- Merging user options with class defaults:
   ```ts
   class Circle extends Arc {
     constructor(options?: CircleOptions) {
       const merged = mergeDictsRecursively(
         Circle.defaultOptions,
         options ?? {}
       );
       super(merged);
     }
   }
   ```

2. **Scene configuration** -- Combining scene, camera, and renderer settings:
   ```ts
   const sceneConfig = mergeDictsRecursively(
     defaultSceneConfig,
     userConfig,
     cliOverrides,
   );
   ```

3. **Shader/Renderer internals** -- Managing uniforms and vertex data for the rendering pipeline.
