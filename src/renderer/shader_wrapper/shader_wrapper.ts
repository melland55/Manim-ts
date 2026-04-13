/**
 * ShaderWrapper — manages GLSL shader source, vertex data, uniforms, and
 * texture paths for a single draw call.
 *
 * Python: manim.renderer.shader_wrapper
 *
 * Mobjects that should be rendered with the same shader are organised and
 * clumped together based on a dict holding all relevant information for that
 * shader, keyed by the `id` produced by this class.
 *
 * Differences from Python:
 * - `moderngl` is replaced with plain string constants (TRIANGLE_STRIP etc.)
 * - Structured numpy arrays (`np.void`) are replaced by `ShaderData` — a
 *   plain object holding a `Float32Array` plus dtype metadata.
 * - File I/O uses Node.js `fs` / `path` instead of Python `pathlib`.
 */

import * as fs from "fs";
import * as nodePath from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Render-primitive constants (replacing moderngl integer constants)
// ---------------------------------------------------------------------------

export const TRIANGLE_STRIP = "TRIANGLE_STRIP";
export const TRIANGLES = "TRIANGLES";
export const LINES = "LINES";
export const POINTS = "POINTS";

// ---------------------------------------------------------------------------
// Vertex-data types (replacing numpy structured arrays)
// ---------------------------------------------------------------------------

/**
 * Describes the named fields (attributes) in a vertex record.
 * Mirrors `np.dtype.names` from Python's structured numpy arrays.
 */
export interface VertexDType {
  readonly names: readonly string[];
}

/**
 * Replaces `npt.NDArray[np.void]` — a packed array of vertex records where
 * each record contains the interleaved float data for all named attributes.
 *
 * `data`   — interleaved float values for all vertices
 * `dtype`  — names of the vertex attributes (position, color, uv, …)
 * `length` — number of vertex records
 */
export interface ShaderData {
  data: Float32Array;
  dtype: VertexDType;
  length: number;
}

// ---------------------------------------------------------------------------
// File-loading helpers
// ---------------------------------------------------------------------------

/** Absolute path to the `shaders/` sibling directory. */
function getShaderDir(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    return nodePath.join(nodePath.dirname(__filename), "shaders");
  } catch {
    // CJS / test environments that don't support import.meta
    return nodePath.join(process.cwd(), "src", "renderer", "shader_wrapper", "shaders");
  }
}

/**
 * Locate `fileName` by checking it directly, then under each `directory`.
 * Mirrors Python's `find_file()`.
 */
function findFile(fileName: string, directories: string[]): string {
  if (fs.existsSync(fileName)) {
    return fileName;
  }
  for (const directory of directories) {
    const full = nodePath.join(directory, fileName);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  throw new Error(`${fileName} not Found`);
}

// ---------------------------------------------------------------------------
// Shader-code cache and loader
// ---------------------------------------------------------------------------

/** Module-level cache: file path → loaded GLSL source. */
export const filenameToCodeMap = new Map<string, string>();

/**
 * Read the GLSL source for `filename`, resolving `#include ../include/*.glsl`
 * directives recursively.  Returns `null` when the file cannot be found.
 *
 * Mirrors Python's `get_shader_code_from_file()`.
 */
export function getShaderCodeFromFile(filename: string): string | null {
  if (filenameToCodeMap.has(filename)) {
    return filenameToCodeMap.get(filename)!;
  }

  let filepath: string;
  try {
    filepath = findFile(filename, [getShaderDir(), "/"]);
  } catch {
    return null;
  }

  let result: string;
  try {
    result = fs.readFileSync(filepath, "utf-8");
  } catch {
    return null;
  }

  // Resolve every `#include ../include/<name>.glsl` directive inline.
  const includePattern = /^#include \.\.\/include\/.*\.glsl$/gm;
  const insertions = result.match(includePattern) ?? [];
  for (const line of insertions) {
    const includeName = line.replace("#include ../include/", "");
    const includePath = nodePath.join("include", includeName);
    const insertedCode = getShaderCodeFromFile(includePath);
    if (insertedCode === null) {
      return null;
    }
    result = result.replace(line, insertedCode);
  }

  filenameToCodeMap.set(filename, result);
  return result;
}

// ---------------------------------------------------------------------------
// Colormap helper
// ---------------------------------------------------------------------------

/**
 * Convert an array of RGB triples into a GLSL `vec3[N](…)` literal.
 *
 * Example output:
 * ```glsl
 * vec3[2](vec3(1.0, 0.0, 0.0),vec3(0.0, 0.0, 1.0))
 * ```
 */
export function getColormapCode(
  rgbList: ReadonlyArray<readonly [number, number, number]>
): string {
  const data = rgbList.map(([r, g, b]) => `vec3(${r}, ${g}, ${b})`).join(",");
  return `vec3[${rgbList.length}](${data})`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Simple 32-bit integer hash of a string.
 * Replaces Python's built-in `hash()` for deterministic program IDs.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Concatenate multiple `ShaderData` instances into a single one.
 * Mirrors `np.hstack(data_list)` on structured arrays.
 */
function concatenateShaderData(dataList: ShaderData[]): ShaderData {
  const totalLength = dataList.reduce((s, d) => s + d.length, 0);
  const totalFloats = dataList.reduce((s, d) => s + d.data.length, 0);
  const combined = new Float32Array(totalFloats);
  let offset = 0;
  for (const d of dataList) {
    combined.set(d.data, offset);
    offset += d.data.length;
  }
  return { data: combined, dtype: dataList[0].dtype, length: totalLength };
}

// ---------------------------------------------------------------------------
// ShaderWrapper
// ---------------------------------------------------------------------------

/** Constructor options for `ShaderWrapper`. */
export interface ShaderWrapperOptions {
  vertData?: ShaderData | null;
  vertIndices?: number[] | Int32Array | null;
  /** Path to the folder containing `vert.glsl`, `geom.glsl`, `frag.glsl`. */
  shaderFolder?: string | null;
  /** Uniform variable name → scalar or vec value. */
  uniforms?: Record<string, number | number[]> | null;
  /** Sampler name → file path for each texture. */
  texturePaths?: Record<string, string> | null;
  depthTest?: boolean;
  /** One of the TRIANGLE_STRIP / TRIANGLES / LINES / POINTS constants. */
  renderPrimitive?: string | number;
}

/**
 * Bundles all the state needed to issue a single OpenGL/WebGL draw call:
 * vertex data, optional index buffer, GLSL source, uniforms, and textures.
 *
 * Mobjects that share the same shader are merged via `combineWith()` before
 * submission to the GPU.
 */
export class ShaderWrapper {
  vertData: ShaderData | null;
  vertIndices: number[] | Int32Array | null;
  /** Names of the vertex attributes, derived from `vertData.dtype.names`. */
  vertAttributes: readonly string[] | null;
  shaderFolder: string;
  uniforms: Record<string, number | number[]>;
  texturePaths: Record<string, string>;
  depthTest: boolean;
  renderPrimitive: string;

  /**
   * Loaded GLSL source strings.  `null` means the corresponding shader stage
   * was not found on disk (geometry shader is optional; vertex + fragment are
   * required for `isValid()`).
   */
  programCode!: Record<string, string | null>;
  /** Stable integer hash of the concatenated GLSL sources. */
  programId!: number;
  /** Composite string key used for grouping identical shader calls. */
  id!: string;

  constructor(options: ShaderWrapperOptions = {}) {
    this.vertData = options.vertData ?? null;
    this.vertIndices = options.vertIndices ?? null;
    this.vertAttributes = options.vertData?.dtype.names ?? null;
    this.shaderFolder = options.shaderFolder ?? "";
    this.uniforms = options.uniforms ? { ...options.uniforms } : {};
    this.texturePaths = options.texturePaths ? { ...options.texturePaths } : {};
    this.depthTest = options.depthTest ?? false;
    this.renderPrimitive = String(options.renderPrimitive ?? TRIANGLE_STRIP);
    this.initProgramCode();
    this.refreshId();
  }

  // ── Cloning ──────────────────────────────────────────────────────────────

  /**
   * Shallow clone, with `vertData`, `vertIndices`, `uniforms`, and
   * `texturePaths` independently deep-copied.  Mirrors Python's `copy.copy()`
   * followed by explicit `np.array(…)` / `dict(…)` copies.
   */
  copy(): ShaderWrapper {
    // Bypass constructor (avoids a redundant file-system read).
    const result = Object.create(ShaderWrapper.prototype) as ShaderWrapper;
    Object.assign(result, this);

    if (this.vertData !== null) {
      result.vertData = {
        data: new Float32Array(this.vertData.data),
        dtype: this.vertData.dtype,
        length: this.vertData.length,
      };
    }

    if (this.vertIndices !== null) {
      result.vertIndices =
        this.vertIndices instanceof Int32Array
          ? new Int32Array(this.vertIndices)
          : [...this.vertIndices];
    }

    if (Object.keys(this.uniforms).length > 0) {
      result.uniforms = { ...this.uniforms };
    }

    if (Object.keys(this.texturePaths).length > 0) {
      result.texturePaths = { ...this.texturePaths };
    }

    return result;
  }

  // ── Validity & identity ──────────────────────────────────────────────────

  /**
   * Returns `true` only when vertex data, a vertex shader, and a fragment
   * shader are all present.
   */
  isValid(): boolean {
    return (
      this.vertData !== null &&
      this.programCode["vertex_shader"] !== null &&
      this.programCode["fragment_shader"] !== null
    );
  }

  getId(): string {
    return this.id;
  }

  getProgramId(): number {
    return this.programId;
  }

  /**
   * Build the composite string key that uniquely identifies a draw-call
   * configuration (program + uniforms + textures + state flags).
   */
  createId(): string {
    return [
      this.programId,
      JSON.stringify(this.uniforms),
      JSON.stringify(this.texturePaths),
      this.depthTest,
      this.renderPrimitive,
    ].join("|");
  }

  /** Recompute `programId` and `id` (call after any mutation to GLSL or state). */
  refreshId(): void {
    this.programId = this.createProgramId();
    this.id = this.createId();
  }

  /** Hash of the concatenated GLSL source strings. */
  createProgramId(): number {
    return hashString(
      (this.programCode["vertex_shader"] ?? "") +
        (this.programCode["geometry_shader"] ?? "") +
        (this.programCode["fragment_shader"] ?? "")
    );
  }

  // ── GLSL source management ────────────────────────────────────────────────

  /**
   * Load `vert.glsl`, `geom.glsl`, and `frag.glsl` from `shaderFolder`.
   * Missing files produce `null` entries (geometry shader may legitimately be
   * absent; vertex + fragment absence makes the wrapper invalid).
   */
  initProgramCode(): void {
    const getCode = (name: string): string | null =>
      getShaderCodeFromFile(nodePath.join(this.shaderFolder, `${name}.glsl`));

    this.programCode = {
      vertex_shader: getCode("vert"),
      geometry_shader: getCode("geom"),
      fragment_shader: getCode("frag"),
    };
  }

  getProgramCode(): Record<string, string | null> {
    return this.programCode;
  }

  /**
   * Apply a regex substitution to every non-null shader stage, then refresh
   * the program ID.
   *
   * @param old         Regex pattern string (same semantics as `re.sub` in Python).
   * @param replacement Replacement string.
   */
  replaceCode(old: string, replacement: string): void {
    for (const name of Object.keys(this.programCode)) {
      const code = this.programCode[name];
      if (code) {
        this.programCode[name] = code.replace(new RegExp(old, "g"), replacement);
      }
    }
    this.refreshId();
  }

  // ── Merging ───────────────────────────────────────────────────────────────

  /**
   * Merge the vertex data (and index buffers, if present) of `shaderWrappers`
   * into `this`.  All wrappers must be of the same type (same shader/dtype).
   * Returns `this` for chaining.
   *
   * Mirrors Python's `combine_with()`.
   */
  combineWith(...shaderWrappers: ShaderWrapper[]): this {
    if (shaderWrappers.length === 0) {
      return this;
    }

    if (this.vertIndices !== null) {
      // Index-buffer path: offset each wrapper's indices by the running vertex count.
      let numVerts = this.vertData?.length ?? 0;
      const allIndices: (number[] | Int32Array)[] = [this.vertIndices];
      const allData: ShaderData[] = this.vertData ? [this.vertData] : [];

      for (const sw of shaderWrappers) {
        if (sw.vertIndices !== null) {
          const offset = numVerts;
          allIndices.push(Array.from(sw.vertIndices).map((i) => i + offset));
        }
        if (sw.vertData) {
          allData.push(sw.vertData);
          numVerts += sw.vertData.length;
        }
      }

      // Flatten all index arrays into a single Int32Array.
      const totalIdxLen = allIndices.reduce((s, a) => s + a.length, 0);
      const combined = new Int32Array(totalIdxLen);
      let off = 0;
      for (const arr of allIndices) {
        combined.set(
          arr instanceof Int32Array ? arr : new Int32Array(arr),
          off
        );
        off += arr.length;
      }
      this.vertIndices = combined;

      if (allData.length > 0) {
        this.vertData = concatenateShaderData(allData);
      }
    } else if (this.vertData !== null) {
      // Non-indexed path: concatenate vertex buffers directly.
      const allData: ShaderData[] = [
        this.vertData,
        ...shaderWrappers
          .filter((sw) => sw.vertData !== null)
          .map((sw) => sw.vertData!),
      ];
      this.vertData = concatenateShaderData(allData);
    }

    return this;
  }
}
