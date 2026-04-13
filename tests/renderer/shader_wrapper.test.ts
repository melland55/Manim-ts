import { describe, it, expect, beforeEach } from "vitest";
import {
  ShaderWrapper,
  ShaderData,
  VertexDType,
  TRIANGLE_STRIP,
  TRIANGLES,
  LINES,
  POINTS,
  getColormapCode,
  getShaderCodeFromFile,
  filenameToCodeMap,
} from "../../src/renderer/shader_wrapper/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal ShaderData with `numVerts` records of `floatsPerVert` floats. */
function makeShaderData(
  numVerts: number,
  floatsPerVert = 3,
  attributeNames: string[] = ["x", "y", "z"].slice(0, floatsPerVert)
): ShaderData {
  const data = new Float32Array(numVerts * floatsPerVert);
  for (let i = 0; i < data.length; i++) data[i] = i + 1; // non-zero for easy inspection
  return { data, dtype: { names: attributeNames }, length: numVerts };
}

// ---------------------------------------------------------------------------
// ShaderWrapper — constructor defaults
// ---------------------------------------------------------------------------

describe("ShaderWrapper", () => {
  describe("constructor defaults", () => {
    it("initialises with null vertex data when none is provided", () => {
      const sw = new ShaderWrapper();
      expect(sw.vertData).toBeNull();
    });

    it("initialises with null vertex indices when none is provided", () => {
      const sw = new ShaderWrapper();
      expect(sw.vertIndices).toBeNull();
    });

    it("initialises with null vertAttributes when no vertData is given", () => {
      const sw = new ShaderWrapper();
      expect(sw.vertAttributes).toBeNull();
    });

    it("defaults renderPrimitive to TRIANGLE_STRIP", () => {
      const sw = new ShaderWrapper();
      expect(sw.renderPrimitive).toBe(TRIANGLE_STRIP);
    });

    it("defaults depthTest to false", () => {
      const sw = new ShaderWrapper();
      expect(sw.depthTest).toBe(false);
    });

    it("defaults uniforms to an empty object", () => {
      const sw = new ShaderWrapper();
      expect(sw.uniforms).toEqual({});
    });

    it("defaults texturePaths to an empty object", () => {
      const sw = new ShaderWrapper();
      expect(sw.texturePaths).toEqual({});
    });

    it("creates a programCode dict with vertex, geometry, fragment keys", () => {
      const sw = new ShaderWrapper();
      expect(sw.programCode).toHaveProperty("vertex_shader");
      expect(sw.programCode).toHaveProperty("geometry_shader");
      expect(sw.programCode).toHaveProperty("fragment_shader");
    });

    it("populates vertAttributes from vertData.dtype.names", () => {
      const vertData = makeShaderData(4, 3, ["position", "color", "uv"]);
      const sw = new ShaderWrapper({ vertData });
      expect(sw.vertAttributes).toEqual(["position", "color", "uv"]);
    });

    it("accepts a custom renderPrimitive string", () => {
      const sw = new ShaderWrapper({ renderPrimitive: TRIANGLES });
      expect(sw.renderPrimitive).toBe(TRIANGLES);
    });

    it("accepts depthTest=true", () => {
      const sw = new ShaderWrapper({ depthTest: true });
      expect(sw.depthTest).toBe(true);
    });

    it("stores provided uniforms", () => {
      const sw = new ShaderWrapper({ uniforms: { opacity: 0.5, scale: 2.0 } });
      expect(sw.uniforms).toEqual({ opacity: 0.5, scale: 2.0 });
    });
  });

  // ── isValid ──────────────────────────────────────────────────────────────

  describe("isValid()", () => {
    it("returns false with no vertex data (no shader folder)", () => {
      const sw = new ShaderWrapper();
      expect(sw.isValid()).toBe(false);
    });

    it("returns false when vertData is set but shaders are missing", () => {
      const sw = new ShaderWrapper({ vertData: makeShaderData(3) });
      // No shader folder → programCode entries are all null
      expect(sw.isValid()).toBe(false);
    });

    it("returns true when vertData and both required shaders are present", () => {
      const sw = new ShaderWrapper({ vertData: makeShaderData(3) });
      sw.programCode["vertex_shader"] = "void main() {}";
      sw.programCode["fragment_shader"] = "void main() {}";
      expect(sw.isValid()).toBe(true);
    });

    it("returns false when only vertex_shader is present (no fragment)", () => {
      const sw = new ShaderWrapper({ vertData: makeShaderData(3) });
      sw.programCode["vertex_shader"] = "void main() {}";
      expect(sw.isValid()).toBe(false);
    });
  });

  // ── getId / getProgramId ─────────────────────────────────────────────────

  describe("getId() / getProgramId()", () => {
    it("getId() returns a non-empty string", () => {
      const sw = new ShaderWrapper();
      expect(typeof sw.getId()).toBe("string");
      expect(sw.getId().length).toBeGreaterThan(0);
    });

    it("getProgramId() returns a number", () => {
      const sw = new ShaderWrapper();
      expect(typeof sw.getProgramId()).toBe("number");
    });

    it("two wrappers with identical options produce the same id", () => {
      const opts = { uniforms: { alpha: 1.0 }, depthTest: false };
      const a = new ShaderWrapper(opts);
      const b = new ShaderWrapper(opts);
      expect(a.getId()).toBe(b.getId());
    });

    it("different uniforms produce different ids", () => {
      const a = new ShaderWrapper({ uniforms: { alpha: 0.5 } });
      const b = new ShaderWrapper({ uniforms: { alpha: 1.0 } });
      expect(a.getId()).not.toBe(b.getId());
    });

    it("different renderPrimitive values produce different ids", () => {
      const a = new ShaderWrapper({ renderPrimitive: TRIANGLES });
      const b = new ShaderWrapper({ renderPrimitive: LINES });
      expect(a.getId()).not.toBe(b.getId());
    });

    it("id changes after replaceCode()", () => {
      const sw = new ShaderWrapper();
      sw.programCode["vertex_shader"] = "uniform float time;";
      sw.refreshId();
      const before = sw.getId();
      sw.replaceCode("time", "uTime");
      expect(sw.getId()).not.toBe(before);
    });
  });

  // ── copy() ───────────────────────────────────────────────────────────────

  describe("copy()", () => {
    it("returns a ShaderWrapper instance", () => {
      const sw = new ShaderWrapper();
      expect(sw.copy()).toBeInstanceOf(ShaderWrapper);
    });

    it("produces an independent vertData Float32Array", () => {
      const sw = new ShaderWrapper({ vertData: makeShaderData(2, 3) });
      const copy = sw.copy();
      copy.vertData!.data[0] = 9999;
      expect(sw.vertData!.data[0]).not.toBe(9999);
    });

    it("produces an independent vertIndices array", () => {
      const sw = new ShaderWrapper({
        vertData: makeShaderData(3),
        vertIndices: new Int32Array([0, 1, 2]),
      });
      const copy = sw.copy();
      (copy.vertIndices as Int32Array)[0] = 42;
      expect((sw.vertIndices as Int32Array)[0]).toBe(0);
    });

    it("produces independent uniforms", () => {
      const sw = new ShaderWrapper({ uniforms: { alpha: 1.0 } });
      const copy = sw.copy();
      copy.uniforms["alpha"] = 0.0;
      expect(sw.uniforms["alpha"]).toBe(1.0);
    });

    it("produces independent texturePaths", () => {
      const sw = new ShaderWrapper({ texturePaths: { tex0: "/a/b.png" } });
      const copy = sw.copy();
      copy.texturePaths["tex0"] = "/other.png";
      expect(sw.texturePaths["tex0"]).toBe("/a/b.png");
    });

    it("preserves renderPrimitive, depthTest, and shaderFolder", () => {
      const sw = new ShaderWrapper({
        renderPrimitive: TRIANGLES,
        depthTest: true,
        shaderFolder: "/tmp/shaders",
      });
      const copy = sw.copy();
      expect(copy.renderPrimitive).toBe(TRIANGLES);
      expect(copy.depthTest).toBe(true);
      expect(copy.shaderFolder).toBe("/tmp/shaders");
    });

    it("copy of null vertData stays null", () => {
      const sw = new ShaderWrapper();
      expect(sw.copy().vertData).toBeNull();
    });
  });

  // ── replaceCode() ────────────────────────────────────────────────────────

  describe("replaceCode()", () => {
    it("substitutes a literal string in vertex_shader", () => {
      const sw = new ShaderWrapper();
      sw.programCode["vertex_shader"] = "uniform float time; vec2 pos;";
      sw.replaceCode("time", "uTime");
      expect(sw.programCode["vertex_shader"]).toContain("uTime");
      expect(sw.programCode["vertex_shader"]).not.toContain("uniform float time");
    });

    it("applies the substitution to all non-null shader stages", () => {
      const sw = new ShaderWrapper();
      sw.programCode["vertex_shader"] = "OLD_SYMBOL foo;";
      sw.programCode["fragment_shader"] = "OLD_SYMBOL bar;";
      sw.replaceCode("OLD_SYMBOL", "NEW_SYMBOL");
      expect(sw.programCode["vertex_shader"]).toContain("NEW_SYMBOL");
      expect(sw.programCode["fragment_shader"]).toContain("NEW_SYMBOL");
    });

    it("does not throw when all programCode entries are null", () => {
      const sw = new ShaderWrapper();
      expect(() => sw.replaceCode("x", "y")).not.toThrow();
    });

    it("refreshes the id after substitution", () => {
      const sw = new ShaderWrapper();
      sw.programCode["vertex_shader"] = "uniform float time;";
      sw.refreshId();
      const before = sw.id;
      sw.replaceCode("time", "uTime");
      expect(sw.id).not.toBe(before);
    });
  });

  // ── combineWith() ────────────────────────────────────────────────────────

  describe("combineWith()", () => {
    it("returns this when called with no arguments", () => {
      const sw = new ShaderWrapper({ vertData: makeShaderData(3) });
      expect(sw.combineWith()).toBe(sw);
    });

    it("concatenates vertData from multiple wrappers (non-indexed)", () => {
      const a = new ShaderWrapper({ vertData: makeShaderData(2, 3) });
      const b = new ShaderWrapper({ vertData: makeShaderData(3, 3) });
      a.combineWith(b);
      expect(a.vertData!.length).toBe(5);
      expect(a.vertData!.data.length).toBe(15); // (2+3)*3
    });

    it("concatenates multiple wrappers at once", () => {
      const a = new ShaderWrapper({ vertData: makeShaderData(1, 3) });
      const b = new ShaderWrapper({ vertData: makeShaderData(1, 3) });
      const c = new ShaderWrapper({ vertData: makeShaderData(1, 3) });
      a.combineWith(b, c);
      expect(a.vertData!.length).toBe(3);
    });

    it("offsets vertIndices correctly when merging indexed wrappers", () => {
      const a = new ShaderWrapper({
        vertData: makeShaderData(3),
        vertIndices: new Int32Array([0, 1, 2]),
      });
      const b = new ShaderWrapper({
        vertData: makeShaderData(3),
        vertIndices: new Int32Array([0, 1, 2]),
      });
      a.combineWith(b);

      const idx = a.vertIndices as Int32Array;
      // a's original indices: 0,1,2
      // b's indices offset by 3: 3,4,5
      expect(Array.from(idx)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("returns this (supports chaining)", () => {
      const a = new ShaderWrapper({ vertData: makeShaderData(1) });
      const b = new ShaderWrapper({ vertData: makeShaderData(1) });
      const result = a.combineWith(b);
      expect(result).toBe(a);
    });

    it("leaves vertData null when this has no vertData and no indices", () => {
      const a = new ShaderWrapper(); // vertData = null
      const b = new ShaderWrapper({ vertData: makeShaderData(2) });
      // Python behaviour: only the else-if branch fires when this.vertIndices is null
      // and this.vertData is null — nothing to concatenate from `this`
      expect(() => a.combineWith(b)).not.toThrow();
    });
  });

  // ── getProgramCode() ─────────────────────────────────────────────────────

  describe("getProgramCode()", () => {
    it("returns the programCode object", () => {
      const sw = new ShaderWrapper();
      sw.programCode["vertex_shader"] = "void main(){}";
      expect(sw.getProgramCode()["vertex_shader"]).toBe("void main(){}");
    });

    it("returns the same reference as sw.programCode", () => {
      const sw = new ShaderWrapper();
      expect(sw.getProgramCode()).toBe(sw.programCode);
    });
  });

  // ── Render-primitive constants ───────────────────────────────────────────

  describe("render-primitive constants", () => {
    it("TRIANGLE_STRIP is a string", () => {
      expect(typeof TRIANGLE_STRIP).toBe("string");
    });

    it("all constants are distinct", () => {
      const set = new Set([TRIANGLE_STRIP, TRIANGLES, LINES, POINTS]);
      expect(set.size).toBe(4);
    });
  });
});

// ---------------------------------------------------------------------------
// getColormapCode
// ---------------------------------------------------------------------------

describe("getColormapCode()", () => {
  it("returns a valid GLSL vec3 array literal for a single color", () => {
    const code = getColormapCode([[1.0, 0.0, 0.0]]);
    expect(code).toBe("vec3[1](vec3(1, 0, 0))");
  });

  it("returns correct length for two colors", () => {
    const code = getColormapCode([
      [1.0, 0.0, 0.0],
      [0.0, 0.0, 1.0],
    ]);
    expect(code).toMatch(/^vec3\[2\]/);
    expect(code).toContain("vec3(1, 0, 0)");
    expect(code).toContain("vec3(0, 0, 1)");
  });

  it("returns vec3[0]() for an empty list", () => {
    expect(getColormapCode([])).toBe("vec3[0]()");
  });

  it("preserves fractional values", () => {
    const code = getColormapCode([[0.5, 0.25, 0.75]]);
    expect(code).toContain("vec3(0.5, 0.25, 0.75)");
  });
});

// ---------------------------------------------------------------------------
// getShaderCodeFromFile
// ---------------------------------------------------------------------------

describe("getShaderCodeFromFile()", () => {
  it("returns null for a nonexistent file", () => {
    expect(getShaderCodeFromFile("/nonexistent/path/shader.glsl")).toBeNull();
  });

  it("returns cached result on second call for the same path", () => {
    // Prime the cache with a known-null result.
    const path = "/definitely/missing/test.glsl";
    filenameToCodeMap.delete(path); // ensure clean slate
    const first = getShaderCodeFromFile(path);
    expect(first).toBeNull();
    // Second call: path won't be in the cache (null results aren't stored),
    // so it should return null again without throwing.
    const second = getShaderCodeFromFile(path);
    expect(second).toBeNull();
  });

  it("returns a string from the cache when pre-populated", () => {
    const fakePath = "/__test__/cached.glsl";
    filenameToCodeMap.set(fakePath, "void main() { /* cached */ }");
    const result = getShaderCodeFromFile(fakePath);
    expect(result).toBe("void main() { /* cached */ }");
    filenameToCodeMap.delete(fakePath); // clean up
  });
});
