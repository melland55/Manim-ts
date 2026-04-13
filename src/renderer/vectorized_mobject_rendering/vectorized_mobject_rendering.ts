/**
 * vectorized_mobject_rendering — Fill and stroke rendering for vectorized
 * mobjects using an OpenGL back-end.
 *
 * TypeScript port of manim/renderer/vectorized_mobject_rendering.py.
 *
 * The actual GPU draw calls (VAO/VBO setup, shader invocation) are marked with
 * TODO because they require a live WebGL2 / moderngl context.  The pure-math
 * helpers (triangulation, matrix-list building) are fully implemented.
 *
 * Rendering differences from Python:
 * - `moderngl.Context.buffer / simple_vertex_array / render` → TODO: WebGL2
 * - Structured numpy arrays (`np.void` dtype) → typed `VertexAttributes` object
 * - `opengl.matrix_to_shader_input` → local matrixToShaderInput() helper
 * - `utils.space_ops.cross2d` → local cross2d() helper
 * - `utils.space_ops.earclip_triangulation` → earcut library
 */

import earcut from "earcut";

import { np } from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import { Shader } from "../shader/index.js";
import type { GLContext } from "../shader/index.js";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Packed vertex-attribute data for a single triangulated mobject.
 * Replaces the Python numpy structured array with dtype
 * `[("in_vert", f32, (3,)), ("in_color", f32, (4,)),
 *   ("texture_coords", f32, (2,)), ("texture_mode", i32)]`.
 */
export interface FillVertexAttributes {
  /** XYZ position of each vertex; length = vertexCount * 3 */
  readonly inVert: Float32Array;
  /** RGBA fill colour of each vertex; length = vertexCount * 4 */
  readonly inColor: Float32Array;
  /** UV texture coordinates of each vertex; length = vertexCount * 2 */
  readonly textureCoords: Float32Array;
  /** Rendering mode per vertex (1=concave bezier, -1=convex bezier, 0=fill); length = vertexCount */
  readonly textureMode: Int32Array;
  /** Number of vertex records. */
  readonly vertexCount: number;
}

/**
 * Packed vertex-attribute data for stroke rendering.
 * Replaces the Python numpy structured array with dtype
 * `[("current_curve", f32, (3,3)), ("tile_coordinate", f32, (2,)),
 *   ("in_color", f32, (4,)), ("in_width", f32)]`.
 */
export interface StrokeVertexAttributes {
  /** Bezier control triangle for the current curve per vertex; length = vertexCount * 9 */
  readonly currentCurve: Float32Array;
  /** Tile UV coordinates; length = vertexCount * 2 */
  readonly tileCoordinate: Float32Array;
  /** RGBA stroke colour per vertex; length = vertexCount * 4 */
  readonly inColor: Float32Array;
  /** Stroke width per vertex; length = vertexCount */
  readonly inWidth: Float32Array;
  /** Number of vertex records. */
  readonly vertexCount: number;
}

/**
 * Minimal interface for an OpenGL camera, matching the Python
 * `OpenGLCamera` attributes accessed by this module.
 */
export interface IOpenGLCamera {
  /** 4×4 view matrix (unformatted / column-major). */
  unformattedViewMatrix: NDArray;
  /** 4×4 projection matrix. */
  projectionMatrix: NDArray;
}

/**
 * Minimal interface for the GL context used by this module.
 * TODO: Replace with the full WebGL2 context interface once implemented.
 */
export interface IOpenGLContext extends GLContext {
  buffer(data: ArrayBuffer): IVbo;
  simpleVertexArray(
    program: unknown,
    vbo: IVbo,
    ...attribs: string[]
  ): IVao;
}

/** Minimal VAO interface. */
export interface IVao {
  render(): void;
  release(): void;
}

/** Minimal VBO interface. */
export interface IVbo {
  release(): void;
}

/**
 * Minimal interface for the OpenGL renderer used by this module.
 * Mirrors the Python `OpenGLRenderer` attributes accessed here.
 */
export interface IOpenGLRenderer {
  context: IOpenGLContext;
  camera: IOpenGLCamera;
  frameBufferObject: { use(): void };
}

/**
 * Interface for an OpenGL-backed VMobject, as consumed by this module.
 * Mirrors the Python `OpenGLVMobject` attributes accessed here.
 *
 * Note: Python uses snake_case attribute names; this interface uses camelCase
 * to follow TypeScript conventions.
 */
export interface IOpenGLVMobject {
  /** Bezier control points, shape [n, 3]. Every group of 3 = one quadratic curve. */
  points: NDArray;
  /** Child submobjects. */
  submobjects: IOpenGLVMobject[];
  /** Return true when this.points has at least one row. */
  hasPoints(): boolean;
  /** RGBA fill colour, shape [n, 4] or [1, 4]. */
  fillRgba: NDArray;
  /** RGBA stroke colour, shape [n, 4] or [1, 4]. */
  strokeRgba: NDArray;
  /** Stroke width in local units. */
  strokeWidth: number;
  /**
   * When true, triangulate_mobject() should recompute the triangulation.
   * Set to false by triangulate_mobject() after caching.
   */
  needsNewTriangulation: boolean;
  /** Cached triangulation result. */
  triangulation: FillVertexAttributes | null;
  /**
   * Path winding orientation.
   * 1 = counter-clockwise (standard); -1 = clockwise.
   */
  orientation: 1 | -1;
  /** Tolerance for treating two points as equal (for end-of-loop detection). */
  toleranceForPointEquality: number;
  /** Outer unit normal vector used for stroke rendering, shape [1, 3]. */
  unitNormal: NDArray;
  /** Local model matrix, shape [4, 4]. */
  modelMatrix: NDArray;
  /** Returns the fully accumulated model matrix (parent chain × own matrix). */
  hierarchicalModelMatrix(): NDArray;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * 2D cross product (z-component of 3D cross) applied row-wise.
 *
 * Python: `utils.space_ops.cross2d(a, b)`
 *   When `a` is shape [n, k]: returns `a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]`
 *   When `a` is shape [k]:    returns `a[0] * b[1] - a[1] * b[0]`
 *
 * @param a  Array of shape [n, k] or [k] (only x and y columns are used).
 * @param b  Array of the same shape as `a`.
 * @returns  Array of n scalars (or a single scalar for the 1-D case).
 */
function cross2d(a: NDArray, b: NDArray): number[] {
  const aData = a.toArray() as number[][] | number[];
  const bData = b.toArray() as number[][] | number[];

  // 1-D case: single vector
  if (typeof aData[0] === "number") {
    const av = aData as number[];
    const bv = bData as number[];
    return [av[0] * bv[1] - av[1] * bv[0]];
  }

  // 2-D case: rows of vectors
  const rows = aData as number[][];
  const bRows = bData as number[][];
  return rows.map((av, i) => av[0] * bRows[i][1] - av[1] * bRows[i][0]);
}

/**
 * Convert a 4×4 NDArray matrix to a column-major flat number[] for a GLSL
 * uniform upload.
 *
 * Python: `opengl.matrix_to_shader_input(matrix)`
 */
function matrixToShaderInput(matrix: NDArray): number[] {
  const data = matrix.toArray() as number[][];
  const flat: number[] = [];
  // Row-major NDArray → column-major for GLSL
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      flat.push(data[row][col]);
    }
  }
  return flat;
}

// ─── build_matrix_lists ────────────────────────────────────────────────────────

/**
 * DFS traversal of the mobject hierarchy, accumulating the product of model
 * matrices.  Returns a `Map` whose keys are the stringified (flattened) 4×4
 * model matrix and whose values are the mobjects sharing that matrix.
 *
 * Python: `build_matrix_lists(mob)`
 */
export function buildMatrixLists(
  mob: IOpenGLVMobject,
): Map<string, IOpenGLVMobject[]> {
  const rootMatrix = mob.hierarchicalModelMatrix();
  const matrixToMobjectList = new Map<string, IOpenGLVMobject[]>();

  if (mob.hasPoints()) {
    const key = matrixToKey(rootMatrix);
    matrixToMobjectList.set(key, [mob]);
  }

  const mobjectToMatrix = new Map<IOpenGLVMobject, NDArray>();
  mobjectToMatrix.set(mob, rootMatrix);

  const dfs: IOpenGLVMobject[] = [mob];
  while (dfs.length > 0) {
    const parent = dfs.pop()!;
    const parentMatrix = mobjectToMatrix.get(parent)!;
    for (const child of parent.submobjects) {
      // child hierarchical = parent hierarchical @ child.model_matrix
      const childMatrix = matMul4x4(parentMatrix, child.modelMatrix);
      mobjectToMatrix.set(child, childMatrix);
      if (child.hasPoints()) {
        const key = matrixToKey(childMatrix);
        const list = matrixToMobjectList.get(key);
        if (list !== undefined) {
          list.push(child);
        } else {
          matrixToMobjectList.set(key, [child]);
        }
      }
      dfs.push(child);
    }
  }

  return matrixToMobjectList;
}

/** Flatten a 4×4 NDArray to a stable Map key string. */
function matrixToKey(matrix: NDArray): string {
  const data = matrix.toArray() as number[][];
  return data.map((row) => row.join(",")).join("|");
}

/**
 * Multiply two 4×4 NDArray matrices.
 * This is the `@` operator from the Python source.
 */
function matMul4x4(a: NDArray, b: NDArray): NDArray {
  const aData = a.toArray() as number[][];
  const bData = b.toArray() as number[][];
  const result: number[][] = Array.from({ length: 4 }, () => new Array<number>(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 4; j++) {
        result[i][j] += aData[i][k] * bData[k][j];
      }
    }
  }
  return np.array(result);
}

// ─── triangulate_mobject ───────────────────────────────────────────────────────

/**
 * Compute the fill triangulation for a single VMobject.
 *
 * The result is cached on `mob.triangulation` and `mob.needsNewTriangulation`
 * is set to `false`, mirroring the Python caching behaviour.
 *
 * Python: `triangulate_mobject(mob)`
 */
export function triangulateMobject(mob: IOpenGLVMobject): FillVertexAttributes {
  if (!mob.needsNewTriangulation && mob.triangulation !== null) {
    return mob.triangulation;
  }

  const pointsRaw = mob.points.toArray() as number[][];
  const numCurves = Math.floor(pointsRaw.length / 3);

  if (numCurves === 0) {
    const empty: FillVertexAttributes = {
      inVert: new Float32Array(0),
      inColor: new Float32Array(0),
      textureCoords: new Float32Array(0),
      textureMode: new Int32Array(0),
      vertexCount: 0,
    };
    mob.triangulation = empty;
    mob.needsNewTriangulation = false;
    return empty;
  }

  // Split into b0 (anchors), b1 (handles), b2 (end anchors)
  const b0s: number[][] = [];
  const b1s: number[][] = [];
  const b2s: number[][] = [];
  for (let i = 0; i < numCurves; i++) {
    b0s.push(pointsRaw[i * 3]);
    b1s.push(pointsRaw[i * 3 + 1]);
    b2s.push(pointsRaw[i * 3 + 2]);
  }

  // Compute tangent vectors for each bezier curve
  const v01s: number[][] = b1s.map((b1, i) => [
    b1[0] - b0s[i][0],
    b1[1] - b0s[i][1],
    b1[2] - b0s[i][2],
  ]);
  const v12s: number[][] = b2s.map((b2, i) => [
    b2[0] - b1s[i][0],
    b2[1] - b1s[i][1],
    b2[2] - b1s[i][2],
  ]);

  // 2D cross product (z-component): determines convexity of each curve
  const crosses: number[] = v01s.map((v01, i) =>
    v01[0] * v12s[i][1] - v01[1] * v12s[i][0],
  );
  const convexities: number[] = crosses.map((c) => Math.sign(c));

  // Classify each curve as concave or convex relative to the path orientation
  let concaveParts: boolean[];
  let convexParts: boolean[];
  if (mob.orientation === 1) {
    concaveParts = convexities.map((cv) => cv > 0);
    convexParts = convexities.map((cv) => cv <= 0);
  } else {
    concaveParts = convexities.map((cv) => cv < 0);
    convexParts = convexities.map((cv) => cv >= 0);
  }

  // Detect end-of-loop: b2[i] ≠ b0[i+1] (or last curve)
  const atol = mob.toleranceForPointEquality;
  const endOfLoop: boolean[] = new Array<boolean>(numCurves).fill(false);
  for (let i = 0; i < numCurves - 1; i++) {
    // Check if any coordinate differs by more than atol
    const b2 = b2s[i];
    const b0next = b0s[i + 1];
    endOfLoop[i] =
      Math.abs(b2[0] - b0next[0]) > atol ||
      Math.abs(b2[1] - b0next[1]) > atol ||
      Math.abs(b2[2] - b0next[2]) > atol;
  }
  endOfLoop[numCurves - 1] = true;

  // Build inner vertex indices:
  //   - all b0 positions (indices 0::3)
  //   - b1 positions for concave curves (indices 1::3 where concaveParts)
  //   - b2 positions at end-of-loop (indices 2::3 where endOfLoop)
  const innerVertIndices: number[] = [];
  for (let i = 0; i < numCurves; i++) {
    innerVertIndices.push(i * 3); // b0
  }
  for (let i = 0; i < numCurves; i++) {
    if (concaveParts[i]) {
      innerVertIndices.push(i * 3 + 1); // b1 of concave bezier
    }
  }
  for (let i = 0; i < numCurves; i++) {
    if (endOfLoop[i]) {
      innerVertIndices.push(i * 3 + 2); // b2 at path end
    }
  }
  innerVertIndices.sort((a, b) => a - b);

  // Compute rings: 1-based positions in innerVertIndices where index % 3 == 2
  // (these are the end-anchor positions that delimit subpath rings)
  const rings: number[] = [];
  for (let pos = 0; pos < innerVertIndices.length; pos++) {
    if (innerVertIndices[pos] % 3 === 2) {
      rings.push(pos + 1); // 1-based
    }
  }

  // Extract inner vertices for triangulation
  const innerVerts: number[][] = innerVertIndices.map((idx) => pointsRaw[idx]);

  // Triangulate inner polygon using earcut
  // holeIndices = all ring boundaries except the last (which ends the whole polygon)
  const holeIndices: number[] = rings.slice(0, -1);

  // Flatten to 2D for earcut (use x,y; earcut works in 2D)
  const flatCoords: number[] = [];
  for (const v of innerVerts) {
    flatCoords.push(v[0], v[1]);
  }

  let innerLocalIndices: number[];
  if (flatCoords.length >= 6) {
    innerLocalIndices = earcut(flatCoords, holeIndices.length > 0 ? holeIndices : undefined, 2);
  } else {
    innerLocalIndices = [];
  }

  // Remap local earcut indices → original point indices
  const innerTriIndices: number[] = innerLocalIndices.map(
    (localIdx) => innerVertIndices[localIdx],
  );

  // Collect bezier triangle indices
  // Each bezier curve contributes [b0, b1, b2] as one triangle
  const concaveTriangleIndices: number[] = [];
  const convexTriangleIndices: number[] = [];
  for (let i = 0; i < numCurves; i++) {
    const triIdx = [i * 3, i * 3 + 1, i * 3 + 2];
    if (concaveParts[i]) {
      concaveTriangleIndices.push(...triIdx);
    } else if (convexParts[i]) {
      convexTriangleIndices.push(...triIdx);
    }
  }

  // Final index order: concave bezier tris, convex bezier tris, inner fill tris
  const allIndices = [
    ...concaveTriangleIndices,
    ...convexTriangleIndices,
    ...innerTriIndices,
  ];

  const vertexCount = allIndices.length;

  const inVert = new Float32Array(vertexCount * 3);
  const textureCoords = new Float32Array(vertexCount * 2);
  const textureMode = new Int32Array(vertexCount);

  // UV pattern [0,0], [0.5,0], [1,1] tiled per triangle (3 vertices)
  const uvPattern = [0.0, 0.0, 0.5, 0.0, 1.0, 1.0];

  for (let vi = 0; vi < vertexCount; vi++) {
    const ptIdx = allIndices[vi];
    const pt = pointsRaw[ptIdx];

    inVert[vi * 3] = pt[0];
    inVert[vi * 3 + 1] = pt[1];
    inVert[vi * 3 + 2] = pt[2];

    textureCoords[vi * 2] = uvPattern[(vi % 3) * 2];
    textureCoords[vi * 2 + 1] = uvPattern[(vi % 3) * 2 + 1];
  }

  // Texture modes: concave=1, convex=-1, inner=0
  let vi = 0;
  for (let i = 0; i < concaveTriangleIndices.length; i++, vi++) {
    textureMode[vi] = 1;
  }
  for (let i = 0; i < convexTriangleIndices.length; i++, vi++) {
    textureMode[vi] = -1;
  }
  for (let i = 0; i < innerTriIndices.length; i++, vi++) {
    textureMode[vi] = 0;
  }

  // in_color is left as zeros here; it gets overwritten by the caller
  // (render_mobject_fills_with_matrix sets fill_rgba per vertex)
  const inColor = new Float32Array(vertexCount * 4);

  const attributes: FillVertexAttributes = {
    inVert,
    inColor,
    textureCoords,
    textureMode,
    vertexCount,
  };

  mob.triangulation = attributes;
  mob.needsNewTriangulation = false;

  return attributes;
}

// ─── render_opengl_vectorized_mobject_fill ─────────────────────────────────────

/**
 * Entry point for fill rendering of a VMobject hierarchy.
 *
 * Builds the matrix → mobject map, then calls
 * `renderMobjectFillsWithMatrix` for each unique model matrix.
 *
 * Python: `render_opengl_vectorized_mobject_fill(renderer, mobject)`
 */
export function renderOpenGLVectorizedMobjectFill(
  renderer: IOpenGLRenderer,
  mobject: IOpenGLVMobject,
): void {
  const matrixToMobjectList = buildMatrixLists(mobject);
  for (const [matrixKey, mobjectList] of matrixToMobjectList) {
    const modelMatrix = keyToMatrix(matrixKey);
    renderMobjectFillsWithMatrix(renderer, modelMatrix, mobjectList);
  }
}

/**
 * Render fills for a list of mobjects sharing the same model matrix.
 *
 * Python: `render_mobject_fills_with_matrix(renderer, model_matrix, mobjects)`
 *
 * TODO: Port GPU upload (buffer / simple_vertex_array / vao.render) from
 *       moderngl to WebGL2.
 */
export function renderMobjectFillsWithMatrix(
  renderer: IOpenGLRenderer,
  modelMatrix: NDArray,
  mobjects: Iterable<IOpenGLVMobject>,
): void {
  // Collect all vertex attributes, overwriting in_color with per-mob fill colour
  const allVerts: Float32Array[] = [];
  const allColors: Float32Array[] = [];
  const allTexCoords: Float32Array[] = [];
  const allTexModes: Int32Array[] = [];

  for (const submob of mobjects) {
    if (!submob.hasPoints()) continue;

    const attrs = triangulateMobject(submob);
    const n = attrs.vertexCount;

    allVerts.push(attrs.inVert);
    allTexCoords.push(attrs.textureCoords);
    allTexModes.push(attrs.textureMode);

    // Fill colour: repeat fill_rgba n times
    const colorData = new Float32Array(n * 4);
    const fillRaw = submob.fillRgba.toArray();
    const fillRows = (Array.isArray(fillRaw[0]) ? fillRaw : [fillRaw]) as number[][];
    const singleColor = fillRows[0]; // RGBA
    for (let vi = 0; vi < n; vi++) {
      colorData[vi * 4] = singleColor[0];
      colorData[vi * 4 + 1] = singleColor[1];
      colorData[vi * 4 + 2] = singleColor[2];
      colorData[vi * 4 + 3] = singleColor[3];
    }
    allColors.push(colorData);
  }

  if (allVerts.length === 0) return;

  const fillShader = new Shader(renderer.context, { name: "vectorized_mobject_fill" });
  fillShader.setUniform(
    "u_model_view_matrix",
    matrixToShaderInput(
      matMul4x4(renderer.camera.unformattedViewMatrix, modelMatrix),
    ),
  );
  fillShader.setUniform("u_projection_matrix", matrixToShaderInput(renderer.camera.projectionMatrix));

  // TODO: Port from moderngl / WebGL2 — interleave allVerts/allColors/allTexCoords/allTexModes
  // into a typed buffer and issue draw call:
  //   const vbo = renderer.context.buffer(interleavedBytes);
  //   const vao = renderer.context.simpleVertexArray(
  //     fillShader.shaderProgram, vbo,
  //     "in_vert", "in_color", "texture_coords", "texture_mode",
  //   );
  //   vao.render();
  //   vao.release();
  //   vbo.release();
}

// ─── render_opengl_vectorized_mobject_stroke ───────────────────────────────────

/**
 * Entry point for stroke rendering of a VMobject hierarchy.
 *
 * Python: `render_opengl_vectorized_mobject_stroke(renderer, mobject)`
 */
export function renderOpenGLVectorizedMobjectStroke(
  renderer: IOpenGLRenderer,
  mobject: IOpenGLVMobject,
): void {
  const matrixToMobjectList = buildMatrixLists(mobject);
  for (const [matrixKey, mobjectList] of matrixToMobjectList) {
    const modelMatrix = keyToMatrix(matrixKey);
    renderMobjectStrokesWithMatrix(renderer, modelMatrix, mobjectList);
  }
}

/**
 * Render strokes for a list of mobjects sharing the same model matrix.
 *
 * Python: `render_mobject_strokes_with_matrix(renderer, model_matrix, mobjects)`
 *
 * TODO: Port GPU upload from moderngl to WebGL2.
 */
export function renderMobjectStrokesWithMatrix(
  renderer: IOpenGLRenderer,
  modelMatrix: NDArray,
  mobjects: IOpenGLVMobject[],
): void {
  // Gather all stroke vertex data
  const allPoints: number[][] = [];
  const allColors: number[][] = [];
  const allWidths: number[] = [];

  for (const submob of mobjects) {
    if (!submob.hasPoints()) continue;

    const pts = submob.points.toArray() as number[][];
    const strokeRaw = submob.strokeRgba.toArray();
    const strokeRows = (Array.isArray(strokeRaw[0]) ? strokeRaw : [strokeRaw]) as number[][];

    for (let i = 0; i < pts.length; i++) {
      allPoints.push(pts[i]);
      // If stroke_rgba has one row per vertex, use it; otherwise repeat single colour
      const color = strokeRows.length === pts.length ? strokeRows[i] : strokeRows[0];
      allColors.push(color);
      allWidths.push(submob.strokeWidth);
    }
  }

  const totalVerts = allPoints.length;
  if (totalVerts === 0) return;

  // Build stroke data: reshape points into bezier curve triples [n/3, 3, 3]
  // Each curve is repeated 3× (one per tile vertex), then the whole set is
  // tiled ×2 to form two triangles per curve quad.
  const numCurves = Math.floor(totalVerts / 3);

  // current_curve: for each vertex, the containing bezier curve (3 × 3 floats)
  // After tiling ×2 → 2 * totalVerts vertices
  const tiledCount = 2 * totalVerts;
  const currentCurve = new Float32Array(tiledCount * 9); // 3×3 per vertex
  const tileCoordinate = new Float32Array(tiledCount * 2);
  const inColor = new Float32Array(tiledCount * 4);
  const inWidth = new Float32Array(tiledCount);

  // Fill first half (tile 0) then second half (tile 1)
  for (let tile = 0; tile < 2; tile++) {
    const offset = tile * totalVerts;
    for (let vi = 0; vi < totalVerts; vi++) {
      const curveIdx = Math.floor(vi / 3);
      const baseVtx = offset + vi;

      // current_curve: copy the 3 points of the curve this vertex belongs to
      for (let cp = 0; cp < 3; cp++) {
        const srcPt = allPoints[curveIdx * 3 + cp];
        currentCurve[baseVtx * 9 + cp * 3] = srcPt[0];
        currentCurve[baseVtx * 9 + cp * 3 + 1] = srcPt[1];
        currentCurve[baseVtx * 9 + cp * 3 + 2] = srcPt[2];
      }

      const color = allColors[vi];
      inColor[baseVtx * 4] = color[0];
      inColor[baseVtx * 4 + 1] = color[1];
      inColor[baseVtx * 4 + 2] = color[2];
      inColor[baseVtx * 4 + 3] = color[3];

      inWidth[baseVtx] = allWidths[vi];
    }
  }

  // Tile coordinates:
  // Tile 0: [0,0], [0,1], [1,1] repeated per curve
  // Tile 1: [0,0], [1,0], [1,1] repeated per curve
  const tilePatterns = [
    [0.0, 0.0, 0.0, 1.0, 1.0, 1.0], // tile 0
    [0.0, 0.0, 1.0, 0.0, 1.0, 1.0], // tile 1
  ];
  for (let tile = 0; tile < 2; tile++) {
    const offset = tile * totalVerts;
    const pattern = tilePatterns[tile];
    for (let vi = 0; vi < totalVerts; vi++) {
      const withinCurve = vi % 3;
      tileCoordinate[(offset + vi) * 2] = pattern[withinCurve * 2];
      tileCoordinate[(offset + vi) * 2 + 1] = pattern[withinCurve * 2 + 1];
    }
  }

  const strokeData: StrokeVertexAttributes = {
    currentCurve,
    tileCoordinate,
    inColor,
    inWidth,
    vertexCount: tiledCount,
  };

  const shader = new Shader(renderer.context, { name: "vectorized_mobject_stroke" });
  shader.setUniform(
    "u_model_view_matrix",
    matrixToShaderInput(
      matMul4x4(renderer.camera.unformattedViewMatrix, modelMatrix),
    ),
  );
  shader.setUniform("u_projection_matrix", matrixToShaderInput(renderer.camera.projectionMatrix));

  if (mobjects.length > 0) {
    const unitNormalRaw = mobjects[0].unitNormal.toArray();
    const unitNormalRow = (Array.isArray(unitNormalRaw[0]) ? unitNormalRaw[0] : unitNormalRaw) as number[];
    shader.setUniform("manim_unit_normal", [-unitNormalRow[0], -unitNormalRow[1], -unitNormalRow[2]] as [number, number, number]);
  }

  // TODO: Port from moderngl / WebGL2:
  //   renderer.frameBufferObject.use();
  //   const vbo = renderer.context.buffer(interleavedBytes);
  //   const vao = renderer.context.simpleVertexArray(
  //     shader.shaderProgram, vbo,
  //     "current_curve", "tile_coordinate", "in_color", "in_width",
  //   );
  //   vao.render();
  //   vao.release();
  //   vbo.release();

  void strokeData; // used above; suppress unused-variable lint
}

// ─── Key/matrix helpers ───────────────────────────────────────────────────────

/** Reconstruct a 4×4 NDArray from a Map key produced by matrixToKey(). */
function keyToMatrix(key: string): NDArray {
  const rows = key.split("|").map((row) => row.split(",").map(Number));
  return np.array(rows);
}
