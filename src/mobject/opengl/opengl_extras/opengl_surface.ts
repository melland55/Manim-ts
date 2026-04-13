/**
 * TypeScript port of manim/mobject/opengl/opengl_surface.py
 *
 * Surface mobject classes for OpenGL rendering.
 */

import type { NDArray } from "numpy-ts";
import { np, ORIGIN, OUT, PI } from "../../../core/math/index.js";
import { interpolate, integerInterpolate } from "../../../utils/bezier/index.js";
import {
  GREY,
  type ParsableManimColor,
  colorToRgba,
  interpolateColor,
  type ManimColor,
} from "../../../utils/color/index.js";
import { normalizeAlongAxis } from "../../../utils/space_ops/index.js";
import { listify } from "../../../utils/iterables/index.js";
import { OpenGLMobject, type OpenGLMobjectOptions } from "../opengl_mobject.js";
import type { Point3D, Points3D } from "../../../core/types.js";

// ─── Types ───────────────────────────────────────────────────

type UVFunc = (u: number, v: number) => [number, number, number] | number[];

// ─── OpenGLSurface ───────────────────────────────────────────

export interface OpenGLSurfaceOptions extends OpenGLMobjectOptions {
  uvFunc?: UVFunc | null;
  uRange?: [number, number];
  vRange?: [number, number];
  resolution?: [number, number];
  axes?: { z_range: number[]; point_to_coords(p: number[]): number[] } | null;
  colorscale?: (ParsableManimColor | [ParsableManimColor, number])[] | null;
  colorscaleAxis?: number;
  preferedCreationAxis?: number;
  epsilon?: number;
  shaderFolder?: string | null;
}

/**
 * Creates a parametric surface.
 *
 * Python: manim.mobject.opengl.opengl_surface.OpenGLSurface
 */
export class OpenGLSurface extends OpenGLMobject {
  passedUvFunc: UVFunc | null;
  uRange: [number, number];
  vRange: [number, number];
  resolution: [number, number];
  axes: { z_range: number[]; point_to_coords(p: number[]): number[] } | null;
  colorscale: (ParsableManimColor | [ParsableManimColor, number])[] | null;
  colorscaleAxis: number;
  preferedCreationAxis: number;
  epsilon: number;
  triangleIndices: NDArray | null;

  constructor(options: OpenGLSurfaceOptions = {}) {
    const {
      uvFunc = null,
      uRange = [0, 1],
      vRange = [0, 1],
      resolution = [101, 101],
      axes = null,
      colorscale = null,
      colorscaleAxis = 2,
      color = GREY,
      opacity = 1.0,
      gloss = 0.3,
      shadow = 0.4,
      preferedCreationAxis = 1,
      epsilon = 1e-5,
      depthTest = true,
      shaderFolder = null,
      ...rest
    } = options;

    super({
      color,
      opacity,
      gloss,
      shadow,
      renderPrimitive: "TRIANGLES",
      depthTest,
      ...rest,
    });

    this.passedUvFunc = uvFunc;
    this.uRange = uRange;
    this.vRange = vRange;
    this.resolution = resolution;
    this.axes = axes;
    this.colorscale = colorscale;
    this.colorscaleAxis = colorscaleAxis;
    this.preferedCreationAxis = preferedCreationAxis;
    this.epsilon = epsilon;
    this.triangleIndices = null;

    // Re-init now that our properties are set (super() called initPoints too early)
    this.initPoints();
    this.computeTriangleIndices();
  }

  uvFunc(u: number, v: number): [number, number, number] | number[] {
    if (this.passedUvFunc) {
      return this.passedUvFunc(u, v);
    }
    return [u, v, 0.0];
  }

  override initPoints(): void {
    // Guard: initPoints may be called by super() before our constructor sets resolution
    if (!this.resolution) return;

    const dim = this.dim;
    const [nu, nv] = this.resolution;
    const uValues = np.linspace(this.uRange[0], this.uRange[1], nu).toArray() as number[];
    const vValues = np.linspace(this.vRange[0], this.vRange[1], nv).toArray() as number[];

    // Build three point lists: base, du-nudged, dv-nudged
    const pointLists: number[][][] = [];
    const offsets: [number, number][] = [[0, 0], [this.epsilon, 0], [0, this.epsilon]];

    for (const [du, dv] of offsets) {
      const points: number[][] = [];
      for (const u of uValues) {
        for (const v of vValues) {
          const pt = this.uvFunc(u + du, v + dv);
          points.push(pt.slice(0, dim));
        }
      }
      pointLists.push(points);
    }

    // Concatenate all three lists
    const allPoints = [...pointLists[0], ...pointLists[1], ...pointLists[2]];
    this.setPoints(np.array(allPoints));
  }

  computeTriangleIndices(): void {
    const [nu, nv] = this.resolution;
    if (nu === 0 || nv === 0) {
      this.triangleIndices = np.zeros([0]);
      return;
    }

    const numTriangles = 6 * (nu - 1) * (nv - 1);
    const indices = new Array<number>(numTriangles);

    // Build index grid: indexGrid[i][j] = i * nv + j
    let idx = 0;
    for (let i = 0; i < nu - 1; i++) {
      for (let j = 0; j < nv - 1; j++) {
        const tl = i * nv + j;           // Top left
        const bl = (i + 1) * nv + j;     // Bottom left
        const tr = i * nv + (j + 1);     // Top right
        const br = (i + 1) * nv + (j + 1); // Bottom right

        indices[idx++] = tl;
        indices[idx++] = bl;
        indices[idx++] = tr;
        indices[idx++] = tr;
        indices[idx++] = bl;
        indices[idx++] = br;
      }
    }

    this.triangleIndices = np.array(indices);
  }

  getTriangleIndices(): NDArray | null {
    return this.triangleIndices;
  }

  /**
   * Returns [surfacePoints, duPoints, dvPoints], each with shape [n, 3].
   */
  getSurfacePointsAndNudgedPoints(): [NDArray, NDArray, NDArray] {
    const points = this.points;
    const k = Math.floor(points.shape[0] / 3);
    const arr = points.toArray() as number[][];

    const sPoints = np.array(arr.slice(0, k));
    const duPoints = np.array(arr.slice(k, 2 * k));
    const dvPoints = np.array(arr.slice(2 * k));

    return [sPoints, duPoints, dvPoints];
  }

  /**
   * Compute unit normals via cross product of du and dv tangent vectors.
   */
  getUnitNormals(): NDArray {
    const [sPoints, duPoints, dvPoints] = this.getSurfacePointsAndNudgedPoints();
    const duTangent = duPoints.subtract(sPoints).divide(this.epsilon);
    const dvTangent = dvPoints.subtract(sPoints).divide(this.epsilon);
    const normals = np.cross(duTangent, dvTangent);
    return normalizeAlongAxis(normals, 1);
  }

  /**
   * Partially display the surface between proportions a and b.
   */
  override pointwiseBecomePartial(
    smobject: OpenGLMobject,
    a: number,
    b: number,
  ): this {
    const axis = this.preferedCreationAxis;

    if (a <= 0 && b >= 1) {
      this.matchPoints(smobject);
      return this;
    }

    if (!(smobject instanceof OpenGLSurface)) {
      return super.pointwiseBecomePartial(smobject, a, b);
    }

    const [nu, nv] = smobject.resolution;
    const [sPoints, duPoints, dvPoints] = smobject.getSurfacePointsAndNudgedPoints();

    const partialS = this.getPartialPointsArray(
      sPoints.toArray() as number[][],
      a, b, [nu, nv, 3], axis,
    );
    const partialDu = this.getPartialPointsArray(
      duPoints.toArray() as number[][],
      a, b, [nu, nv, 3], axis,
    );
    const partialDv = this.getPartialPointsArray(
      dvPoints.toArray() as number[][],
      a, b, [nu, nv, 3], axis,
    );

    const all = [...partialS, ...partialDu, ...partialDv];
    this.setPoints(np.array(all));
    return this;
  }

  /**
   * Compute partial points array for animation.
   */
  getPartialPointsArray(
    flatPoints: number[][],
    a: number,
    b: number,
    resolution: [number, number, number],
    axis: number,
  ): number[][] {
    if (flatPoints.length === 0) return flatPoints;

    const [nu, nv, dim] = resolution;

    // Reshape flat [nu*nv, dim] → [nu][nv][dim]
    const grid: number[][][] = [];
    for (let i = 0; i < nu; i++) {
      const row: number[][] = [];
      for (let j = 0; j < nv; j++) {
        row.push([...flatPoints[i * nv + j]]);
      }
      grid.push(row);
    }

    const maxIndex = (axis === 0 ? nu : nv) - 1;
    const [lowerIndex, lowerResidue] = integerInterpolate(0, maxIndex, a);
    const [upperIndex, upperResidue] = integerInterpolate(0, maxIndex, b);

    if (axis === 0) {
      // Interpolate rows
      for (let i = 0; i < lowerIndex; i++) {
        for (let j = 0; j < nv; j++) {
          for (let d = 0; d < dim; d++) {
            grid[i][j][d] =
              (1 - lowerResidue) * grid[lowerIndex][j][d] +
              lowerResidue * grid[Math.min(lowerIndex + 1, nu - 1)][j][d];
          }
        }
      }
      for (let i = upperIndex + 1; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
          for (let d = 0; d < dim; d++) {
            grid[i][j][d] =
              (1 - upperResidue) * grid[upperIndex][j][d] +
              upperResidue * grid[Math.min(upperIndex + 1, nu - 1)][j][d];
          }
        }
      }
    } else {
      // Interpolate columns
      for (let j = 0; j < lowerIndex; j++) {
        for (let i = 0; i < nu; i++) {
          for (let d = 0; d < dim; d++) {
            grid[i][j][d] =
              (1 - lowerResidue) * grid[i][lowerIndex][d] +
              lowerResidue * grid[i][Math.min(lowerIndex + 1, nv - 1)][d];
          }
        }
      }
      for (let j = upperIndex + 1; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
          for (let d = 0; d < dim; d++) {
            grid[i][j][d] =
              (1 - upperResidue) * grid[i][upperIndex][d] +
              upperResidue * grid[i][Math.min(upperIndex + 1, nv - 1)][d];
          }
        }
      }
    }

    // Flatten back to [nu*nv, dim]
    const result: number[][] = [];
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        result.push(grid[i][j]);
      }
    }
    return result;
  }

  /**
   * Sort triangle faces back-to-front for transparency rendering.
   */
  sortFacesBackToFront(vect: NDArray = OUT): this {
    if (!this.triangleIndices) return this;

    const triIs = this.triangleIndices.toArray() as number[];
    const numFaces = Math.floor(triIs.length / 3);
    const pts = this.points.toArray() as number[][];
    const vectArr = vect.toArray() as number[];

    const faceIndices = Array.from({ length: numFaces }, (_, i) => i);
    faceIndices.sort((a, b) => {
      const ptA = pts[triIs[3 * a]] ?? [0, 0, 0];
      const ptB = pts[triIs[3 * b]] ?? [0, 0, 0];
      const dotA = ptA[0] * vectArr[0] + ptA[1] * vectArr[1] + ptA[2] * vectArr[2];
      const dotB = ptB[0] * vectArr[0] + ptB[1] * vectArr[1] + ptB[2] * vectArr[2];
      return dotA - dotB;
    });

    const newTriIs = new Array<number>(triIs.length);
    for (let fi = 0; fi < numFaces; fi++) {
      const srcIdx = faceIndices[fi];
      newTriIs[fi * 3] = triIs[srcIdx * 3];
      newTriIs[fi * 3 + 1] = triIs[srcIdx * 3 + 1];
      newTriIs[fi * 3 + 2] = triIs[srcIdx * 3 + 2];
    }

    this.triangleIndices = np.array(newTriIs);
    return this;
  }

  /**
   * Get shader data for rendering.
   */
  getShaderData(): NDArray {
    // TODO: Port from OpenGL — needs manual rendering implementation
    const [sPoints] = this.getSurfacePointsAndNudgedPoints();
    return np.zeros([sPoints.shape[0], 13]); // point(3) + du_point(3) + dv_point(3) + color(4)
  }

  override getShaderVertIndices(): number[] | null {
    const tri = this.getTriangleIndices();
    if (!tri) return null;
    return tri.toArray() as number[];
  }
}

// ─── OpenGLSurfaceGroup ──────────────────────────────────────

export interface OpenGLSurfaceGroupOptions extends OpenGLSurfaceOptions {
  // Inherits from OpenGLSurfaceOptions
}

/**
 * Group of parametric surfaces.
 *
 * Python: manim.mobject.opengl.opengl_surface.OpenGLSurfaceGroup
 */
export class OpenGLSurfaceGroup extends OpenGLSurface {
  constructor(
    surfaces: OpenGLSurface[] = [],
    options: OpenGLSurfaceGroupOptions = {},
  ) {
    super({ resolution: [0, 0], uvFunc: null, ...options });
    this.add(...(surfaces as unknown as OpenGLMobject[]));
  }

  override initPoints(): void {
    // No-op for groups — points come from child surfaces
  }
}

// ─── OpenGLTexturedSurface ───────────────────────────────────

export interface OpenGLTexturedSurfaceOptions extends OpenGLMobjectOptions {
  imageMode?: string | [string, string];
  shaderFolder?: string | null;
}

/**
 * A surface with texture mapping.
 *
 * Python: manim.mobject.opengl.opengl_surface.OpenGLTexturedSurface
 */
export class OpenGLTexturedSurface extends OpenGLSurface {
  uvSurface: OpenGLSurface;
  imCoords: NDArray;
  opacityData: NDArray;

  constructor(
    uvSurface: OpenGLSurface,
    imageFile: string | NDArray,
    options: OpenGLTexturedSurfaceOptions & {
      darkImageFile?: string | null;
    } = {},
  ) {
    const {
      darkImageFile = null,
      imageMode = "RGBA",
      ...rest
    } = options;

    if (!(uvSurface instanceof OpenGLSurface)) {
      throw new Error("uvSurface must be of type OpenGLSurface");
    }

    // Determine texture paths
    // TODO: Port from OpenGL — needs actual texture loading implementation
    const texturePaths: Record<string, string> = {};
    if (typeof imageFile === "string") {
      texturePaths["LightTexture"] = imageFile;
      texturePaths["DarkTexture"] = darkImageFile ?? imageFile;
    }

    super({
      uvFunc: (u, v) => uvSurface.uvFunc(u, v),
      uRange: uvSurface.uRange,
      vRange: uvSurface.vRange,
      resolution: uvSurface.resolution,
      texturePaths,
      ...rest,
    });

    this.uvSurface = uvSurface;
    this.imCoords = np.zeros([0, 2]);
    this.opacityData = np.zeros([0, 1]);

    // Re-init now that uvSurface is set
    this.initPoints();

    if (darkImageFile) {
      this.uniforms["num_textures"] = 2;
    }
  }

  override initPoints(): void {
    if (!this.uvSurface) return;
    const [nu, nv] = this.uvSurface.resolution;
    this.setPoints(this.uvSurface.points);

    // Build im_coords: [u, v] for each grid point
    const uValues = np.linspace(0, 1, nu).toArray() as number[];
    const vValues = np.linspace(1, 0, nv).toArray() as number[]; // Reverse y
    const coords: number[][] = [];
    for (const u of uValues) {
      for (const v of vValues) {
        coords.push([u, v]);
      }
    }
    this.imCoords = np.array(coords);
  }

  initColorsForTexture(): void {
    const rgbas = this.uvSurface.rgbas;
    const arr = rgbas.toArray() as number[][];
    const opacities: number[][] = arr.map((row) => [row[3]]);
    this.opacityData = np.array(opacities);
  }

  override setOpacity(opacity: number, recurse: boolean = true): this {
    const family = recurse ? this.getFamily() : [this];
    const opList = typeof opacity === "number" ? [opacity] : listify(opacity) as number[];
    for (const mob of family) {
      if (mob instanceof OpenGLTexturedSurface) {
        mob.opacityData = np.array(opList.map((o) => [o]));
      }
    }
    return this;
  }

  override pointwiseBecomePartial(
    tsmobject: OpenGLMobject,
    a: number,
    b: number,
  ): this {
    super.pointwiseBecomePartial(tsmobject, a, b);

    if (tsmobject instanceof OpenGLTexturedSurface) {
      const imCoords = tsmobject.imCoords.toArray() as number[][];
      if (a <= 0 && b >= 1) {
        this.imCoords = np.array(imCoords);
        return this;
      }

      const [nu, nv] = tsmobject.resolution;
      const axis = 1;
      const partialCoords = this.getPartialPointsArray(
        imCoords, a, b, [nu, nv, 2], axis,
      );
      this.imCoords = np.array(partialCoords);
    }

    return this;
  }

  /**
   * Get image from file path.
   * TODO: Port from OpenGL — needs actual image loading.
   */
  getImageFromFile(imageFile: string, imageMode: string): string {
    // TODO: Port from OpenGL — needs PIL/sharp image loading
    return imageFile;
  }
}
