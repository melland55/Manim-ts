/**
 * TypeScript port of manim/mobject/opengl/opengl_image_mobject.py
 *
 * Image mobject for OpenGL rendering.
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import { OpenGLSurface, OpenGLTexturedSurface, type OpenGLTexturedSurfaceOptions } from "./opengl_surface.js";

/**
 * Duck-type an NDArray. numpy-ts NDArrays are Proxy objects whose `has` trap
 * does not expose `shape`, so `"shape" in x` is always false at runtime — use
 * the `.get` method check instead.
 */
function isNDArray(x: unknown): x is NDArray {
  return (
    x !== null &&
    typeof x === "object" &&
    typeof (x as { get?: unknown }).get === "function"
  );
}

// ─── OpenGLImageMobject ──────────────────────────────────────

export interface OpenGLImageMobjectOptions extends OpenGLTexturedSurfaceOptions {
  width?: number | null;
  height?: number | null;
  imageMode?: string;
  opacity?: number;
  gloss?: number;
  shadow?: number;
}

/**
 * Displays a raster image as a textured surface.
 *
 * Python: manim.mobject.opengl.opengl_image_mobject.OpenGLImageMobject
 */
export class OpenGLImageMobject extends OpenGLTexturedSurface {
  image: string | NDArray;
  size: [number, number];

  constructor(
    filenameOrArray: string | NDArray,
    options: OpenGLImageMobjectOptions = {},
  ) {
    let {
      width = null,
      height = null,
      imageMode = "RGBA",
      opacity = 1,
      gloss = 0,
      shadow = 0,
      ...rest
    } = options;

    // Determine image size
    let imageSize: [number, number];
    if (isNDArray(filenameOrArray)) {
      // NDArray — shape is [H, W, ...] so size is [W, H]
      const shape = filenameOrArray.shape;
      imageSize = [shape[1], shape[0]];
    } else {
      // TODO: Port from OpenGL — needs actual image file size reading
      // For now, assume a reasonable default
      imageSize = [640, 480];
    }

    // Compute width and height
    if (width === null && height === null) {
      width = 4 * imageSize[0] / imageSize[1];
      height = 4;
    }
    if (height === null) {
      height = width! * imageSize[1] / imageSize[0];
    }
    if (width === null) {
      width = height * imageSize[0] / imageSize[1];
    }

    const halfW = width / 2;
    const halfH = height / 2;

    const surface = new OpenGLSurface({
      uvFunc: (u: number, v: number) => [u, v, 0],
      uRange: [-halfW, halfW],
      vRange: [-halfH, halfH],
      opacity,
      gloss,
      shadow,
    });

    const imageArg = typeof filenameOrArray === "string"
      ? filenameOrArray
      : filenameOrArray;

    super(
      surface,
      imageArg as string,
      {
        imageMode,
        opacity,
        gloss,
        shadow,
        ...rest,
      },
    );

    this.image = filenameOrArray;
    this.size = imageSize;
  }

  /**
   * Get image from file, handling both string paths and NDArray inputs.
   * TODO: Port from OpenGL — needs actual image loading via sharp
   */
  override getImageFromFile(
    imageFile: string,
    imageMode: string,
  ): string {
    // TODO: Port from OpenGL — needs PIL/sharp image loading
    return imageFile;
  }
}
