---
title: Camera
sidebar_position: 2
---

# Camera

Cameras define the viewpoint from which a scene is rendered. The `src/camera/`
barrel exports:

| Class | Source | Purpose |
|-------|--------|---------|
| `Camera` | `src/camera/camera/` | Fixed-frame 2D view. Default camera. |
| `MovingCamera` | `src/camera/moving_camera/` | Animatable `CameraFrame` (pan/zoom). |
| `ThreeDCamera` | `src/camera/three_d_camera/` | Software 3D projection for the Cairo backend (phi/theta/gamma). |
| `MappingCamera` / `OldMultiCamera` / `SplitScreenCamera` | `src/camera/mapping_camera/` | Apply a per-pixel mapping, or composite multiple sub-cameras. |
| `MultiCamera` | `src/camera/multi_camera/` | Newer multi-viewport camera used by `ZoomedScene`. |

```ts
import {
  Camera,
  MovingCamera,
  ThreeDCamera,
  MappingCamera,
  MultiCamera,
} from "../../src/camera/index.js";
```

## Camera (Base)

The base `Camera` class provides a fixed-frame 2D view. It maps mathematical coordinates to pixel coordinates and manages background color.

### CameraOptions

```ts
interface CameraOptions {
  pixelWidth?: number;
  pixelHeight?: number;
  frameWidth?: number;
  frameHeight?: number;
  backgroundColor?: Color;
}
```

| Option | Default | Description |
|---|---|---|
| `pixelWidth` | `1920` | Output resolution width in pixels |
| `pixelHeight` | `1080` | Output resolution height in pixels |
| `frameWidth` | `14.2` | Width of the visible mathematical coordinate space |
| `frameHeight` | `8.0` | Height of the visible mathematical coordinate space |
| `backgroundColor` | `BLACK` | Background fill color |

### Usage

```ts
import { Camera, BLACK } from "manim-ts";

const camera = new Camera({
  pixelWidth: 1920,
  pixelHeight: 1080,
  frameWidth: 14.2,
  frameHeight: 8.0,
  backgroundColor: BLACK,
});
```

### Key Methods

#### `getFrameCenter(): Point3D`

Returns the center point of the camera frame in mathematical coordinates.

#### `getFrameWidth(): number` / `getFrameHeight(): number`

Returns the dimensions of the visible frame in mathematical units.

#### `getPixelWidth(): number` / `getPixelHeight(): number`

Returns the dimensions of the output in pixels.

#### `coordToPixel(point: Point3D): [number, number]`

Converts a point in mathematical coordinates to pixel coordinates.

#### `pixelToCoord(x: number, y: number): Point3D`

Converts pixel coordinates back to mathematical coordinates.

## MovingCamera

`MovingCamera` extends `Camera` with the ability to pan, zoom, and animate the camera frame. It uses a `CameraFrame` mobject to represent the camera's position and dimensions, which means the frame itself can be animated like any other mobject.

### Usage

```ts
import { MovingCamera, MovingCameraScene, Square } from "manim-ts";

class ZoomExample extends MovingCameraScene {
  async construct(): Promise<void> {
    const square = new Square();
    this.add(square);

    // Zoom in by shrinking the frame
    await this.play(
      this.camera.frame.animate.scale(0.5)
    );

    // Pan to the right
    await this.play(
      this.camera.frame.animate.shift(RIGHT.scale(3))
    );
  }
}
```

### CameraFrame

The `CameraFrame` is a special mobject that represents the camera's viewport. Because it is a mobject, you can use all standard mobject animations on it.

```ts
// Access the camera frame
const frame = this.camera.frame;

// Animate frame properties
await this.play(frame.animate.scale(2));        // Zoom out
await this.play(frame.animate.shift(UP));        // Pan up
await this.play(frame.animate.moveTo(ORIGIN));   // Center on origin
await this.play(frame.animate.setWidth(20));     // Widen the view
```

### Key Properties

| Property | Type | Description |
|---|---|---|
| `frame` | `CameraFrame` | The animatable frame mobject |

### Key Methods

#### `getFrameCenter(): Point3D`

Returns the current center of the camera frame (may change during animations).

#### `getFrameWidth(): number` / `getFrameHeight(): number`

Returns the current dimensions of the camera frame (may change during zoom animations).

## ThreeDCamera

`ThreeDCamera` extends `MovingCamera` with 3D perspective projection. It uses spherical coordinates (phi, theta, gamma) to position the camera in 3D space.

### ThreeDCamera Coordinate System

The camera position is defined by spherical coordinates relative to the origin:

- **phi** — Polar angle from the positive z-axis (0 = top-down, PI/2 = level). Controls vertical rotation.
- **theta** — Azimuthal angle in the xy-plane from the positive x-axis. Controls horizontal rotation.
- **gamma** — Roll angle around the camera's viewing axis. Usually 0.
- **focalDistance** — Distance from the camera to the focal point. Controls perspective distortion.

```
        z
        |   / phi (polar angle from z)
        |  /
        | /
        +---------> y
       / \
      /   \ theta (azimuthal in xy-plane)
     /
    x
```

### Usage

```ts
import { ThreeDCamera, ThreeDScene, Surface, PI } from "manim-ts";

class My3DScene extends ThreeDScene {
  async construct(): Promise<void> {
    // Set initial camera orientation (method lives on ThreeDScene).
    this.setCameraOrientation({
      phi: 75 * DEGREES,
      theta: -45 * DEGREES,
    });

    const surface = new Surface(
      (u, v) => np.array([u, v, Math.sin(u) * Math.cos(v)]),
      { uRange: [-PI, PI], vRange: [-PI, PI] }
    );

    this.add(surface);

    // Animate camera rotation
    await this.play(
      new Rotate(this.camera, {
        theta: 360 * DEGREES,
        runTime: 8,
      })
    );
  }
}
```

### Configuration

```ts
interface ThreeDCameraOptions extends CameraOptions {
  phi?: number;
  theta?: number;
  gamma?: number;
  focalDistance?: number;
  lightSource?: Point3D;
  shouldApplyShading?: boolean;
}
```

| Option | Default | Description |
|---|---|---|
| `phi` | `0` | Polar angle from z-axis (radians) |
| `theta` | `-PI / 2` | Azimuthal angle in xy-plane (radians) |
| `gamma` | `0` | Roll angle (radians) |
| `focalDistance` | `20.0` | Distance to focal point |
| `lightSource` | `[-7, -9, 10]` | Position of the light source for shading |
| `shouldApplyShading` | `true` | Whether to apply Lambert shading |

### Key Methods

#### `getPhi(): number` / `getTheta(): number` / `getGamma(): number`

Return the current spherical angles.

#### `projectPoints(points: Points3D): Points3D`

Project many 3D points onto the 2D camera plane. Called by `CairoBackend`
before rasterizing VMobject subpaths.

#### `projectPoint(point: Point3D): Point3D`

Convenience wrapper that projects a single point.

#### `getMobjectsToDisplay(mobjects, includeSubmobjects?, excludedMobjects?): IMobject[]`

Return the input mobjects sorted back-to-front by view-space z. Used by
`CairoBackend` to match ManimCE's Cairo + 3D painter's-algorithm pipeline.

Orientation is set on the scene, not the camera directly:

```ts
this.setCameraOrientation({ phi: 75 * DEGREES, theta: -45 * DEGREES });
```

## Camera Comparison

| Feature | Camera | MovingCamera | ThreeDCamera |
|---|---|---|---|
| Static frame | Yes | Yes | Yes |
| Pan / zoom | No | Yes | Yes |
| Animated frame | No | Yes | Yes |
| 3D projection | No | No | Yes |
| Perspective | No | No | Yes |
| Lighting / shading | No | No | Yes |
| Typical use | Simple 2D | Dynamic 2D | Any 3D |
