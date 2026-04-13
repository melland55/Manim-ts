/**
 * shader — 3D scene-graph nodes, mesh/shader management, and full-screen quads.
 *
 * TypeScript port of manim/renderer/shader.py.
 *
 * Rendering operations (WebGL2 / moderngl equivalents) are marked TODO and
 * must be implemented separately once a WebGL2 context is available.
 *
 * Key differences from Python:
 * - `moderngl.Context` / `moderngl.Program` → minimal stub interfaces (GLContext / GLProgram)
 * - Structured numpy arrays → ShaderData from ../shader_wrapper
 * - `np.linalg.multi_dot` → local multiDot() helper
 * - `inspect.signature` arity check → function.length check for updater dispatch
 * - `config["frame_x_radius"]` → derived from ManimConfig defaults (frameWidth / 2)
 */

import * as fs from "fs";
import * as nodePath from "path";
import { fileURLToPath } from "url";

import { np } from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import type { Point3D } from "../../core/types.js";
import type { MatrixMN } from "../../typing/index.js";
import type { ManimConfig } from "../../core/types.js";
import { ShaderData, TRIANGLES } from "../shader_wrapper/index.js";

// ─── Public type aliases ──────────────────────────────────────────────────────

/** Updater that receives both the object and elapsed time. */
export type MeshTimeBasedUpdater = (obj: Object3D, dt: number) => void;

/** Updater that receives only the object (no time). */
export type MeshNonTimeBasedUpdater = (obj: Object3D) => void;

/** Either time-based or non-time-based updater. */
export type MeshUpdater = MeshNonTimeBasedUpdater | MeshTimeBasedUpdater;

// ─── Minimal GL stubs ─────────────────────────────────────────────────────────

/**
 * Minimal interface for an OpenGL/WebGL rendering context.
 * TODO: Port from moderngl — needs WebGL2 implementation.
 */
export interface GLContext {
  readonly [key: string]: unknown;
}

/**
 * Minimal interface for a compiled GL shader program.
 * TODO: Port from moderngl — needs WebGL2 implementation.
 */
export interface GLProgram {
  /** The context that owns this program. */
  ctx: GLContext;
  readonly [key: string]: unknown;
}

/**
 * Minimal interface for the OpenGL renderer, used in Mesh.setUniforms().
 * Mirrors the parts of OpenGLRenderer accessed by Mesh.
 * TODO: Replace with the full OpenGLRenderer interface once it is converted.
 */
export interface IOpenGLRenderer {
  camera: {
    formattedViewMatrix: number[];
    projectionMatrix: number[];
  };
}

// ─── Module-level caches ──────────────────────────────────────────────────────

/**
 * Cache of compiled GL programs, keyed by shader name.
 * Mirrors Python's `shader_program_cache: dict[str, moderngl.Program]`.
 */
export const shaderProgramCache = new Map<string, GLProgram>();

/**
 * Cache of loaded GLSL source, keyed by absolute file path.
 * Mirrors Python's `file_path_to_code_map: dict[Path, str]`.
 */
export const filePathToCodeMap = new Map<string, string>();

// ─── Shader folder ────────────────────────────────────────────────────────────

/** Absolute path to the `shaders/` directory sibling to this file. */
function getShaderFolder(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    return nodePath.join(nodePath.dirname(__filename), "..", "shaders");
  } catch {
    return nodePath.join(process.cwd(), "src", "renderer", "shaders");
  }
}

const SHADER_FOLDER = getShaderFolder();

// ─── GLSL source loader ───────────────────────────────────────────────────────

/**
 * Read GLSL source from `filePath`, recursively resolving `#include` directives.
 * Results are cached by absolute path.
 *
 * Mirrors Python's `get_shader_code_from_file(file_path)`.
 */
export function getShaderCodeFromFile(filePath: string): string {
  const resolved = nodePath.resolve(filePath);
  if (filePathToCodeMap.has(resolved)) {
    return filePathToCodeMap.get(resolved)!;
  }

  let source = fs.readFileSync(resolved, "utf-8");

  // Resolve every `#include <path>.glsl` directive inline.
  const includePattern = /^#include (?<inc>.*\.glsl)$/gm;
  for (const match of source.matchAll(includePattern)) {
    const includePath = match.groups!.inc;
    const includedFilePath = nodePath.join(nodePath.dirname(resolved), includePath);
    const includedCode = getShaderCodeFromFile(includedFilePath);
    source = source.replace(match[0], includedCode);
  }

  filePathToCodeMap.set(resolved, source);
  return source;
}

// ─── Attribute filtering ──────────────────────────────────────────────────────

/**
 * Return a copy of `unfilteredAttributes` containing only the fields listed in
 * `attributes`. Used during rendering to strip vertex attributes the shader
 * does not declare.
 *
 * Mirrors Python's `filter_attributes(unfiltered_attributes, attributes)`.
 *
 * NOTE: The full per-field dtype metadata (subdtype, shape) from Python's
 * structured numpy arrays is not preserved here — the actual GPU upload is
 * handled by the TODO render path.
 */
export function filterAttributes(
  unfilteredAttributes: ShaderData,
  attributes: string[],
): ShaderData {
  const filteredNames = unfilteredAttributes.dtype.names.filter((name) =>
    attributes.includes(name),
  );
  return {
    data: unfilteredAttributes.data,
    dtype: { names: filteredNames },
    length: unfilteredAttributes.length,
  };
}

// ─── Internal matrix helpers ──────────────────────────────────────────────────

/**
 * Multiply a chain of 4×4 matrices left-to-right (equivalent to
 * `np.linalg.multi_dot` on a list of arrays).
 */
function multiDot(matrices: NDArray[]): NDArray {
  if (matrices.length === 0) {
    throw new Error("multiDot requires at least one matrix");
  }
  return matrices.reduce((acc, m) => np.dot(acc, m) as NDArray);
}

/**
 * Extract the upper-left 3×3 sub-matrix from a 4×4 NDArray.
 * Equivalent to `matrix[:3, :3]` in Python numpy.
 */
function upperLeft3x3(m: NDArray): NDArray {
  return np.array([
    [m.get([0, 0]) as number, m.get([0, 1]) as number, m.get([0, 2]) as number],
    [m.get([1, 0]) as number, m.get([1, 1]) as number, m.get([1, 2]) as number],
    [m.get([2, 0]) as number, m.get([2, 1]) as number, m.get([2, 2]) as number],
  ]);
}

// ─── Object3D ─────────────────────────────────────────────────────────────────

/**
 * 3D scene-graph node with a 4×4 model matrix, a parent/child hierarchy,
 * and frame-based updater callbacks.
 *
 * Python: manim.renderer.shader.Object3D
 */
export class Object3D {
  /** Local model transform (row-major 4×4). */
  modelMatrix: NDArray;
  /** Normal matrix used for lighting transforms (row-major 4×4). */
  normalMatrix: NDArray;
  children: Object3D[];
  parent: Object3D | null;

  /** Updaters that receive the elapsed frame time. */
  timeBasedUpdaters: MeshTimeBasedUpdater[];
  /** Updaters that do not receive elapsed time. */
  nonTimeUpdaters: MeshNonTimeBasedUpdater[];
  hasUpdaters: boolean;
  updatingSuspended: boolean;

  constructor(...children: Object3D[]) {
    this.modelMatrix = np.eye(4);
    this.normalMatrix = np.eye(4);
    this.children = [];
    this.parent = null;
    this.timeBasedUpdaters = [];
    this.nonTimeUpdaters = [];
    this.hasUpdaters = false;
    this.updatingSuspended = false;
    this.add(...children);
  }

  // ── Interpolation ────────────────────────────────────────────────────────

  // TODO: Use path_func.
  interpolate(start: Object3D, end: Object3D, alpha: number, _: unknown): void {
    this.modelMatrix = (
      start.modelMatrix.multiply(1 - alpha) as NDArray
    ).add(end.modelMatrix.multiply(alpha)) as NDArray;
    this.normalMatrix = (
      start.normalMatrix.multiply(1 - alpha) as NDArray
    ).add(end.normalMatrix.multiply(alpha)) as NDArray;
  }

  // ── Copying ───────────────────────────────────────────────────────────────

  /** Shallow-copy this node without its children tree. */
  singleCopy(): Object3D {
    const copy = new Object3D();
    copy.modelMatrix = this.modelMatrix.copy() as NDArray;
    copy.normalMatrix = this.normalMatrix.copy() as NDArray;
    return copy;
  }

  /**
   * Deep-copy the entire subtree rooted at this node, preserving the
   * parent/child relationships within the copy.
   */
  copy(): Object3D {
    const nodeToCopy = new Map<Object3D, Object3D>();

    const bfs: Object3D[] = [this];
    while (bfs.length > 0) {
      const node = bfs.shift()!;
      bfs.push(...node.children);

      const nodeCopy = node.singleCopy();
      nodeToCopy.set(node, nodeCopy);

      if (node.parent !== null && node !== this) {
        nodeToCopy.get(node.parent)!.add(nodeCopy);
      }
    }
    return nodeToCopy.get(this)!;
  }

  // ── Hierarchy ─────────────────────────────────────────────────────────────

  /**
   * Add `children` as direct children of this node.
   * Throws if any child already belongs to another node.
   */
  add(...children: Object3D[]): void {
    for (const child of children) {
      if (child.parent !== null) {
        throw new Error(
          "Attempt to add child that's already added to another Object3D",
        );
      }
    }
    // Remove from this node's list without ownership check (may not be present).
    this.children = this.children.filter((c) => !children.includes(c));
    for (const child of children) {
      child.parent = null;
    }
    this.children.push(...children);
    for (const child of children) {
      child.parent = this;
    }
  }

  /**
   * Remove `children` from this node.
   * Throws if any child does not belong to this node.
   */
  remove(...children: Object3D[]): void {
    for (const child of children) {
      if (child.parent !== this) {
        throw new Error(
          "Attempt to remove child that isn't added to this Object3D",
        );
      }
    }
    this.children = this.children.filter((c) => !children.includes(c));
    for (const child of children) {
      child.parent = null;
    }
  }

  // ── Transform ─────────────────────────────────────────────────────────────

  /** Return the translation (position) stored in the 4th column of modelMatrix. */
  getPosition(): Point3D {
    return np.array([
      this.modelMatrix.get([0, 3]) as number,
      this.modelMatrix.get([1, 3]) as number,
      this.modelMatrix.get([2, 3]) as number,
    ]);
  }

  /** Write `position` into the 4th column of modelMatrix. */
  setPosition(position: Point3D): this {
    this.modelMatrix.set([0, 3], (position as NDArray).get([0]) as number);
    this.modelMatrix.set([1, 3], (position as NDArray).get([1]) as number);
    this.modelMatrix.set([2, 3], (position as NDArray).get([2]) as number);
    return this;
  }

  // ── Traversal ─────────────────────────────────────────────────────────────

  /** Depth-first iteration over all `Mesh` descendants (including self). */
  *getMeshes(): Generator<Mesh> {
    const dfs: Object3D[] = [this];
    while (dfs.length > 0) {
      const node = dfs.pop()!;
      if (node instanceof Mesh) {
        yield node;
      }
      dfs.push(...node.children);
    }
  }

  /** Depth-first iteration over all descendants including self. */
  *getFamily(): Generator<Object3D> {
    const dfs: Object3D[] = [this];
    while (dfs.length > 0) {
      const node = dfs.pop()!;
      yield node;
      dfs.push(...node.children);
    }
  }

  /** No-op alignment hook — mirrors Python's `align_data_and_family`. */
  alignDataAndFamily(_: unknown): void {
    // intentional no-op
  }

  // ── Hierarchical transforms ───────────────────────────────────────────────

  /**
   * Cumulative model matrix from the root to this node (product of all
   * ancestor model matrices, right-to-left).
   *
   * Mirrors Python's `hierarchical_model_matrix()`.
   */
  hierarchicalModelMatrix(): MatrixMN {
    if (this.parent === null) {
      return this.modelMatrix;
    }
    const matrices: NDArray[] = [this.modelMatrix];
    let current: Object3D = this;
    while (current.parent !== null) {
      matrices.push(current.parent.modelMatrix);
      current = current.parent;
    }
    return multiDot([...matrices].reverse());
  }

  /**
   * Upper-left 3×3 of the cumulative normal matrix from root to this node.
   *
   * Mirrors Python's `hierarchical_normal_matrix()`.
   */
  hierarchicalNormalMatrix(): MatrixMN {
    if (this.parent === null) {
      return upperLeft3x3(this.normalMatrix);
    }
    const matrices: NDArray[] = [this.normalMatrix];
    let current: Object3D = this;
    while (current.parent !== null) {
      matrices.push(current.parent.modelMatrix);
      current = current.parent;
    }
    return upperLeft3x3(multiDot([...matrices].reverse()));
  }

  // ── Updaters ──────────────────────────────────────────────────────────────

  /**
   * Run all registered updaters.
   * Time-based updaters receive `dt`; non-time updaters receive no time arg.
   */
  update(dt = 0): this {
    if (!this.hasUpdaters || this.updatingSuspended) {
      return this;
    }
    for (const updater of this.timeBasedUpdaters) {
      updater(this, dt);
    }
    for (const updater of this.nonTimeUpdaters) {
      updater(this);
    }
    return this;
  }

  getTimeBasedUpdaters(): MeshTimeBasedUpdater[] {
    return this.timeBasedUpdaters;
  }

  hasTimeBasedUpdater(): boolean {
    return this.timeBasedUpdaters.length > 0;
  }

  getUpdaters(): MeshUpdater[] {
    return [...this.timeBasedUpdaters, ...this.nonTimeUpdaters];
  }

  /**
   * Register `updateFunction` as either a time-based or non-time updater,
   * determined by whether the function declares two parameters (arity 2 means
   * it expects `(obj, dt)`).
   */
  addUpdater(
    updateFunction: MeshUpdater,
    index?: number,
    callUpdater = true,
  ): this {
    if (updateFunction.length === 2) {
      this._addTimeBasedUpdater(updateFunction as MeshTimeBasedUpdater, index);
    } else {
      this._addNonTimeUpdater(updateFunction as MeshNonTimeBasedUpdater, index);
    }
    this.refreshHasUpdaterStatus();
    if (callUpdater) {
      this.update();
    }
    return this;
  }

  private _addTimeBasedUpdater(
    updateFunction: MeshTimeBasedUpdater,
    index?: number,
  ): void {
    if (index === undefined) {
      this.timeBasedUpdaters.push(updateFunction);
    } else {
      this.timeBasedUpdaters.splice(index, 0, updateFunction);
    }
  }

  private _addNonTimeUpdater(
    updateFunction: MeshNonTimeBasedUpdater,
    index?: number,
  ): void {
    if (index === undefined) {
      this.nonTimeUpdaters.push(updateFunction);
    } else {
      this.nonTimeUpdaters.splice(index, 0, updateFunction);
    }
  }

  removeUpdater(updateFunction: MeshUpdater): this {
    this.timeBasedUpdaters = this.timeBasedUpdaters.filter(
      (u) => u !== updateFunction,
    );
    this.nonTimeUpdaters = this.nonTimeUpdaters.filter(
      (u) => u !== updateFunction,
    );
    this.refreshHasUpdaterStatus();
    return this;
  }

  clearUpdaters(): this {
    this.timeBasedUpdaters = [];
    this.nonTimeUpdaters = [];
    this.refreshHasUpdaterStatus();
    return this;
  }

  matchUpdaters(other: Object3D): this {
    this.clearUpdaters();
    for (const updater of other.getUpdaters()) {
      this.addUpdater(updater);
    }
    return this;
  }

  suspendUpdating(): this {
    this.updatingSuspended = true;
    return this;
  }

  resumeUpdating(callUpdater = true): this {
    this.updatingSuspended = false;
    if (callUpdater) {
      this.update(0);
    }
    return this;
  }

  refreshHasUpdaterStatus(): this {
    this.hasUpdaters = this.getUpdaters().length > 0;
    return this;
  }
}

// ─── Mesh ─────────────────────────────────────────────────────────────────────

/** Constructor options for `Mesh`. Exactly one of the two path must be used. */
export type MeshOptions =
  | {
      /** Shader used to render this mesh. */
      shader: Shader;
      /** Per-vertex attribute data. */
      attributes: ShaderData;
      geometry?: never;
      material?: never;
      /** Optional index buffer. */
      indices?: Int32Array | null;
      useDepthTest?: boolean;
      /** Render primitive — use the TRIANGLES / TRIANGLE_STRIP / … constants. */
      primitive?: string;
    }
  | {
      shader?: never;
      attributes?: never;
      /** A Mesh whose attribute data and index buffer are re-used. */
      geometry: Mesh;
      /** Shader applied to the geometry. */
      material: Shader;
      indices?: Int32Array | null;
      useDepthTest?: boolean;
      primitive?: string;
    };

/**
 * An `Object3D` that carries renderable vertex data and an associated shader.
 *
 * Python: manim.renderer.shader.Mesh
 */
export class Mesh extends Object3D {
  shader: Shader;
  attributes: ShaderData;
  indices: Int32Array | null;
  useDepthTest: boolean;
  /** Render primitive constant (e.g. TRIANGLES). */
  primitive: string;
  /** When `true`, this mesh is skipped during rendering. */
  skipRender: boolean;

  constructor(options: MeshOptions) {
    super();

    if ("shader" in options && options.shader !== undefined) {
      this.shader = options.shader;
      this.attributes = options.attributes;
      this.indices = options.indices ?? null;
    } else if ("geometry" in options && options.geometry !== undefined) {
      this.shader = options.material;
      this.attributes = options.geometry.attributes;
      this.indices = options.geometry.indices;
    } else {
      throw new Error(
        "Mesh requires either { shader, attributes } or { geometry, material }",
      );
    }

    this.useDepthTest = options.useDepthTest ?? true;
    this.primitive = options.primitive ?? TRIANGLES;
    this.skipRender = false;
  }

  override singleCopy(): Mesh {
    const copy = new Mesh({
      shader: this.shader,
      attributes: {
        data: new Float32Array(this.attributes.data),
        dtype: this.attributes.dtype,
        length: this.attributes.length,
      },
      indices: this.indices !== null ? new Int32Array(this.indices) : null,
      useDepthTest: this.useDepthTest,
      primitive: this.primitive,
    });
    copy.skipRender = this.skipRender;
    copy.modelMatrix = this.modelMatrix.copy() as NDArray;
    copy.normalMatrix = this.normalMatrix.copy() as NDArray;
    // TODO: Copy updaters?
    return copy;
  }

  /**
   * Push model/view/projection matrices into the shader's uniforms.
   *
   * TODO: Port from moderngl — needs WebGL2 implementation.
   */
  setUniforms(renderer: IOpenGLRenderer): void {
    // TODO: Port from moderngl — needs WebGL2 implementation
    // Python equivalent:
    //   self.shader.set_uniform("u_model_matrix", opengl.matrix_to_shader_input(self.model_matrix))
    //   self.shader.set_uniform("u_view_matrix", renderer.camera.formatted_view_matrix)
    //   self.shader.set_uniform("u_projection_matrix", renderer.camera.projection_matrix)
    void renderer; // suppress unused-variable warning
  }

  /**
   * Upload vertex data and issue the draw call.
   *
   * TODO: Port from moderngl — needs WebGL2 implementation.
   */
  render(): void {
    if (this.skipRender) {
      return;
    }
    // TODO: Port from moderngl — needs WebGL2 implementation
    // Python equivalent (abbreviated):
    //   if self.use_depth_test: self.shader.context.enable(moderngl.DEPTH_TEST)
    //   filtered = filter_attributes(self.attributes, shader_attribute_names)
    //   vbo = self.shader.context.buffer(filtered.tobytes())
    //   vao = self.shader.context.simple_vertex_array(...)
    //   vao.render(self.primitive)
    //   vbo.release(); vao.release()
  }
}

// ─── Shader ───────────────────────────────────────────────────────────────────

/** Source dict passed directly to the GL context program constructor. */
export type ShaderSource = {
  vertex_shader?: string;
  fragment_shader?: string;
  geometry_shader?: string;
};

/**
 * Manages a compiled GLSL shader program and its uniforms.
 *
 * Program compilation is TODO (requires a WebGL2 context); loading and
 * caching of GLSL source works today.
 *
 * Python: manim.renderer.shader.Shader
 */
export class Shader {
  context: GLContext;
  name: string | null;
  source: ShaderSource | null;
  /** The compiled GL program (or a stub when no real context is available). */
  shaderProgram: GLProgram;

  constructor(
    context: GLContext,
    options: { name?: string | null; source?: ShaderSource | null } = {},
  ) {
    this.context = context;
    this.name = options.name ?? null;
    this.source = options.source ?? null;

    // Check program cache (same name AND same context).
    if (this.name !== null && shaderProgramCache.has(this.name)) {
      const cached = shaderProgramCache.get(this.name)!;
      if (cached.ctx === this.context) {
        this.shaderProgram = cached;
        return;
      }
    }

    if (this.source !== null) {
      // Inline source was provided — compile directly.
      // TODO: Port from moderngl — needs WebGL2 implementation for actual compilation.
      this.shaderProgram = this._programFromSource(this.source);
    } else if (this.name !== null) {
      // Load from shader files under SHADER_FOLDER/<name>/.
      const loadedSource = this._loadShaderFiles(this.name);
      // TODO: Port from moderngl — needs WebGL2 implementation for actual compilation.
      this.shaderProgram = this._programFromSource(loadedSource);
    } else {
      throw new Error("Must either pass shader name or shader source.");
    }

    // Cache by name.
    if (this.name !== null && !shaderProgramCache.has(this.name)) {
      shaderProgramCache.set(this.name, this.shaderProgram);
    }
  }

  private _loadShaderFiles(name: string): ShaderSource {
    const shaderFolder = nodePath.join(SHADER_FOLDER, name);
    const keyMap: Record<string, keyof ShaderSource> = {
      vert: "vertex_shader",
      frag: "fragment_shader",
      geom: "geometry_shader",
    };
    const sourceDict: ShaderSource = {};
    for (const [stem, key] of Object.entries(keyMap)) {
      const filePath = nodePath.join(shaderFolder, `${stem}.glsl`);
      try {
        sourceDict[key] = getShaderCodeFromFile(filePath);
      } catch {
        // Optional shader stage (e.g. geometry shader) may be absent.
      }
    }
    return sourceDict;
  }

  private _programFromSource(source: ShaderSource): GLProgram {
    // TODO: Port from moderngl — needs WebGL2 implementation for actual compilation.
    // Returns a stub that stores the source for later inspection / testing.
    return { ctx: this.context, _source: source } as GLProgram;
  }

  /**
   * Set a uniform value on the shader program.
   * Silently ignores missing uniforms (mirrors Python's `contextlib.suppress(KeyError)`).
   *
   * TODO: Port from moderngl — needs WebGL2 implementation.
   */
  setUniform(name: string, value: unknown): void {
    // TODO: Port from moderngl — needs WebGL2 implementation
    // Python: with contextlib.suppress(KeyError): self.shader_program[name] = value
    void name;
    void value;
  }
}

// ─── FullScreenQuad ───────────────────────────────────────────────────────────

/**
 * A screen-aligned quad (two triangles covering the full viewport) used for
 * post-processing passes and background rendering.
 *
 * Python: manim.renderer.shader.FullScreenQuad
 */
export class FullScreenQuad extends Mesh {
  constructor(
    context: GLContext,
    options: {
      fragmentShaderSource?: string | null;
      fragmentShaderName?: string | null;
      config?: Partial<Pick<ManimConfig, "frameWidth" | "frameHeight">>;
    } = {},
  ) {
    const { fragmentShaderSource, fragmentShaderName, config } = options;

    if (
      fragmentShaderSource === undefined &&
      fragmentShaderName === undefined
    ) {
      throw new Error("Must either pass shader name or shader source.");
    }

    // Resolve fragment shader source.
    let fragSource: string;
    if (fragmentShaderName != null) {
      const shaderFilePath = nodePath.join(
        SHADER_FOLDER,
        `${fragmentShaderName}.frag`,
      );
      fragSource = getShaderCodeFromFile(shaderFilePath);
    } else if (fragmentShaderSource != null) {
      // Dedent (mirrors Python's textwrap.dedent + lstrip).
      fragSource = fragmentShaderSource.trimStart().replace(/^[ \t]+/gm, "");
    } else {
      throw new Error("Must either pass shader name or shader source.");
    }

    const vertexShader = `
#version 330
in vec4 in_vert;
uniform mat4 u_model_view_matrix;
uniform mat4 u_projection_matrix;
void main() {
    vec4 camera_space_vertex = u_model_view_matrix * in_vert;
    vec4 clip_space_vertex = u_projection_matrix * camera_space_vertex;
    gl_Position = clip_space_vertex;
}
`;

    const shader = new Shader(context, {
      source: {
        vertex_shader: vertexShader,
        fragment_shader: fragSource,
      },
    });

    // Build the six vertices of the full-screen quad.
    // config["frame_x_radius"] = frameWidth / 2  (default 7.111)
    // config["frame_y_radius"] = frameHeight / 2 (default 4.0)
    const fx = (config?.frameWidth ?? 14.222) / 2;
    const fy = (config?.frameHeight ?? 8.0) / 2;

    const vertData = new Float32Array([
      -fx, -fy, 0, 1,
      -fx,  fy, 0, 1,
       fx,  fy, 0, 1,
      -fx, -fy, 0, 1,
       fx, -fy, 0, 1,
       fx,  fy, 0, 1,
    ]);
    const attributes: ShaderData = {
      data: vertData,
      dtype: { names: ["in_vert"] },
      length: 6,
    };

    super({ shader, attributes });

    // TODO: Port from moderngl — needs WebGL2 implementation.
    // Python:
    //   shader.set_uniform("u_model_view_matrix", opengl.view_matrix())
    //   shader.set_uniform("u_projection_matrix", opengl.orthographic_projection_matrix())
    shader.setUniform("u_model_view_matrix", null);
    shader.setUniform("u_projection_matrix", null);
  }

  override render(): void {
    super.render();
  }
}
