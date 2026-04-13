/**
 * TypeScript port of manim/mobject/opengl/opengl_three_dimensions.py
 *
 * 3D surface mesh for OpenGL rendering.
 */

import { np } from "../../../core/math/index.js";
import { OpenGLMobject } from "../opengl_mobject.js";
import { OpenGLSurface } from "./opengl_surface.js";
import {
  OpenGLVGroup,
  OpenGLVMobject,
  type OpenGLVMobjectOptions,
} from "../opengl_vectorized_mobject.js";

// ─── OpenGLSurfaceMesh ──────────────────────────────────────

export interface OpenGLSurfaceMeshOptions extends OpenGLVMobjectOptions {
  resolution?: [number, number];
  normalNudge?: number;
}

/**
 * Creates a wireframe mesh on a UV surface.
 *
 * Python: manim.mobject.opengl.opengl_three_dimensions.OpenGLSurfaceMesh
 */
export class OpenGLSurfaceMesh extends OpenGLVGroup {
  uvSurface: OpenGLSurface;
  resolution: [number, number];
  normalNudge: number;

  constructor(
    uvSurface: OpenGLSurface,
    options: OpenGLSurfaceMeshOptions = {},
  ) {
    const {
      resolution = [21, 21],
      strokeWidth = 1,
      normalNudge = 1e-2,
      depthTest = true,
      flatStroke = false,
      ...rest
    } = options;

    if (!(uvSurface instanceof OpenGLSurface)) {
      throw new Error("uvSurface must be of type OpenGLSurface");
    }

    super();

    // Apply style options
    if (strokeWidth !== undefined) this.setStroke(undefined, strokeWidth);
    if (depthTest) this.applyDepthTest();
    this.flatStroke = flatStroke;

    this.uvSurface = uvSurface;
    this.resolution = resolution;
    this.normalNudge = normalNudge;

    this.initPointsForMesh();
  }

  /**
   * Build mesh lines along u and v directions on the surface.
   */
  initPointsForMesh(): void {
    const uvSurface = this.uvSurface;

    const [fullNu, fullNv] = uvSurface.resolution;
    const [partNu, partNv] = this.resolution;

    // Compute sample indices along each axis
    const uIndices = np.linspace(0, fullNu - 1, partNu)
      .toArray() as number[];
    const uIdxInt = uIndices.map((v) => Math.round(v));

    const vIndices = np.linspace(0, fullNv - 1, partNv)
      .toArray() as number[];
    const vIdxInt = vIndices.map((v) => Math.round(v));

    const [points, , ] = uvSurface.getSurfacePointsAndNudgedPoints();
    const normals = uvSurface.getUnitNormals();

    // Nudge points along normals
    const nudgedPoints = points.add(normals.multiply(this.normalNudge));
    const nudgedArr = nudgedPoints.toArray() as number[][];

    // Create u-lines (constant u, varying v)
    for (const ui of uIdxInt) {
      const path = new OpenGLVMobject();
      const linePoints: number[][] = [];
      for (let vi = 0; vi < fullNv; vi++) {
        const idx = ui * fullNv + vi;
        if (idx < nudgedArr.length) {
          linePoints.push(nudgedArr[idx]);
        }
      }
      if (linePoints.length > 1) {
        path.setPointsSmoothly(np.array(linePoints));
        this.add(path as unknown as OpenGLMobject);
      }
    }

    // Create v-lines (constant v, varying u)
    for (const vi of vIdxInt) {
      const path = new OpenGLVMobject();
      const linePoints: number[][] = [];
      for (let ui = 0; ui < fullNu; ui++) {
        const idx = ui * fullNv + vi;
        if (idx < nudgedArr.length) {
          linePoints.push(nudgedArr[idx]);
        }
      }
      if (linePoints.length > 1) {
        path.setPointsSmoothly(np.array(linePoints));
        this.add(path as unknown as OpenGLMobject);
      }
    }
  }
}
