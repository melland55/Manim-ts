import { describe, it, expect, beforeEach } from "vitest";
import { np } from "../../src/core/math/index.js";
import {
  Object3D,
  Mesh,
  Shader,
  FullScreenQuad,
  filterAttributes,
  shaderProgramCache,
  filePathToCodeMap,
  type GLContext,
  type MeshTimeBasedUpdater,
  type MeshNonTimeBasedUpdater,
} from "../../src/renderer/shader/index.js";
import { ShaderData, TRIANGLES } from "../../src/renderer/shader_wrapper/index.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Minimal GLContext stub — satisfies the interface without real WebGL. */
const mockContext: GLContext = Object.freeze({});

/** Build a minimal ShaderData for use in Mesh tests. */
function makeShaderData(numVerts = 3, floatsPerVert = 3): ShaderData {
  const data = new Float32Array(numVerts * floatsPerVert);
  for (let i = 0; i < data.length; i++) data[i] = i + 1;
  return {
    data,
    dtype: { names: ["position"] },
    length: numVerts,
  };
}

/** Build a Shader stub that doesn't touch the filesystem. */
function makeShader(): Shader {
  return new Shader(mockContext, {
    source: {
      vertex_shader: "void main(){}",
      fragment_shader: "void main(){}",
    },
  });
}

/** Build a Mesh with sensible defaults (no file I/O). */
function makeMesh(): Mesh {
  return new Mesh({
    shader: makeShader(),
    attributes: makeShaderData(),
  });
}

// ---------------------------------------------------------------------------
// Object3D — construction
// ---------------------------------------------------------------------------

describe("Object3D", () => {
  describe("constructor", () => {
    it("initialises modelMatrix as a 4×4 identity", () => {
      const obj = new Object3D();
      // Diagonal elements should be 1.
      expect(obj.modelMatrix.get([0, 0])).toBe(1);
      expect(obj.modelMatrix.get([1, 1])).toBe(1);
      expect(obj.modelMatrix.get([2, 2])).toBe(1);
      expect(obj.modelMatrix.get([3, 3])).toBe(1);
      // Off-diagonal elements should be 0.
      expect(obj.modelMatrix.get([0, 1])).toBe(0);
      expect(obj.modelMatrix.get([1, 0])).toBe(0);
    });

    it("initialises normalMatrix as a 4×4 identity", () => {
      const obj = new Object3D();
      expect(obj.normalMatrix.get([0, 0])).toBe(1);
      expect(obj.normalMatrix.get([3, 3])).toBe(1);
      expect(obj.normalMatrix.get([0, 3])).toBe(0);
    });

    it("starts with empty children list", () => {
      const obj = new Object3D();
      expect(obj.children).toHaveLength(0);
    });

    it("starts with null parent", () => {
      const obj = new Object3D();
      expect(obj.parent).toBeNull();
    });

    it("has no updaters by default", () => {
      const obj = new Object3D();
      expect(obj.hasUpdaters).toBe(false);
      expect(obj.getUpdaters()).toHaveLength(0);
    });

    it("adds constructor-supplied children", () => {
      const child1 = new Object3D();
      const child2 = new Object3D();
      const parent = new Object3D(child1, child2);
      expect(parent.children).toHaveLength(2);
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });
  });

  // ── Hierarchy ─────────────────────────────────────────────────────────────

  describe("add() / remove()", () => {
    it("sets parent on added child", () => {
      const parent = new Object3D();
      const child = new Object3D();
      parent.add(child);
      expect(child.parent).toBe(parent);
    });

    it("adds the child to the children array", () => {
      const parent = new Object3D();
      const child = new Object3D();
      parent.add(child);
      expect(parent.children).toContain(child);
    });

    it("throws when adding a child that already has a parent", () => {
      const parent1 = new Object3D();
      const parent2 = new Object3D();
      const child = new Object3D();
      parent1.add(child);
      expect(() => parent2.add(child)).toThrow();
    });

    it("removes a child and clears its parent reference", () => {
      const parent = new Object3D();
      const child = new Object3D();
      parent.add(child);
      parent.remove(child);
      expect(parent.children).not.toContain(child);
      expect(child.parent).toBeNull();
    });

    it("throws when removing a child not belonging to this node", () => {
      const parent = new Object3D();
      const orphan = new Object3D();
      expect(() => parent.remove(orphan)).toThrow();
    });
  });

  // ── Position ──────────────────────────────────────────────────────────────

  describe("getPosition() / setPosition()", () => {
    it("returns the origin by default (identity model matrix)", () => {
      const obj = new Object3D();
      const pos = obj.getPosition();
      expect(pos.get([0])).toBe(0);
      expect(pos.get([1])).toBe(0);
      expect(pos.get([2])).toBe(0);
    });

    it("setPosition stores the values in the 4th column", () => {
      const obj = new Object3D();
      const pos = np.array([1, 2, 3]);
      obj.setPosition(pos);
      const got = obj.getPosition();
      expect(got.get([0])).toBeCloseTo(1);
      expect(got.get([1])).toBeCloseTo(2);
      expect(got.get([2])).toBeCloseTo(3);
    });

    it("setPosition does not affect rotation part of matrix", () => {
      const obj = new Object3D();
      obj.setPosition(np.array([5, 6, 7]));
      // The upper-left 3×3 should still be identity.
      expect(obj.modelMatrix.get([0, 0])).toBe(1);
      expect(obj.modelMatrix.get([1, 1])).toBe(1);
      expect(obj.modelMatrix.get([2, 2])).toBe(1);
    });

    it("setPosition returns this for chaining", () => {
      const obj = new Object3D();
      const result = obj.setPosition(np.array([0, 0, 0]));
      expect(result).toBe(obj);
    });
  });

  // ── Interpolation ─────────────────────────────────────────────────────────

  describe("interpolate()", () => {
    it("at alpha=0 copies start.modelMatrix", () => {
      const a = new Object3D();
      const b = new Object3D();
      const target = new Object3D();
      a.setPosition(np.array([0, 0, 0]));
      b.setPosition(np.array([4, 0, 0]));
      target.interpolate(a, b, 0, null);
      expect(target.modelMatrix.get([0, 3])).toBeCloseTo(0);
    });

    it("at alpha=1 copies end.modelMatrix", () => {
      const a = new Object3D();
      const b = new Object3D();
      const target = new Object3D();
      a.setPosition(np.array([0, 0, 0]));
      b.setPosition(np.array([4, 0, 0]));
      target.interpolate(a, b, 1, null);
      expect(target.modelMatrix.get([0, 3])).toBeCloseTo(4);
    });

    it("at alpha=0.5 produces the midpoint matrix", () => {
      const a = new Object3D();
      const b = new Object3D();
      const target = new Object3D();
      a.setPosition(np.array([0, 0, 0]));
      b.setPosition(np.array([4, 0, 0]));
      target.interpolate(a, b, 0.5, null);
      expect(target.modelMatrix.get([0, 3])).toBeCloseTo(2);
    });
  });

  // ── Copy ──────────────────────────────────────────────────────────────────

  describe("singleCopy()", () => {
    it("returns a new Object3D with the same matrices", () => {
      const obj = new Object3D();
      obj.setPosition(np.array([1, 2, 3]));
      const copy = obj.singleCopy();
      expect(copy).not.toBe(obj);
      expect(copy.modelMatrix.get([0, 3])).toBeCloseTo(1);
    });

    it("produces independent matrices (deep copy)", () => {
      const obj = new Object3D();
      obj.setPosition(np.array([1, 2, 3]));
      const copy = obj.singleCopy();
      copy.setPosition(np.array([9, 9, 9]));
      expect(obj.modelMatrix.get([0, 3])).toBeCloseTo(1);
    });

    it("does not carry over children", () => {
      const parent = new Object3D();
      parent.add(new Object3D());
      const copy = parent.singleCopy();
      expect(copy.children).toHaveLength(0);
    });
  });

  describe("copy()", () => {
    it("copies a single-node tree", () => {
      const obj = new Object3D();
      obj.setPosition(np.array([2, 0, 0]));
      const copy = obj.copy();
      expect(copy.modelMatrix.get([0, 3])).toBeCloseTo(2);
    });

    it("preserves the child count in the copied subtree", () => {
      const root = new Object3D();
      root.add(new Object3D());
      root.add(new Object3D());
      const copy = root.copy();
      expect(copy.children).toHaveLength(2);
    });

    it("copied children have no reference to original nodes", () => {
      const root = new Object3D();
      const child = new Object3D();
      child.setPosition(np.array([5, 0, 0]));
      root.add(child);
      const copy = root.copy();
      copy.children[0].setPosition(np.array([99, 0, 0]));
      expect(child.modelMatrix.get([0, 3])).toBeCloseTo(5);
    });

    it("copied children point to the copied parent, not the original", () => {
      const root = new Object3D();
      const child = new Object3D();
      root.add(child);
      const copy = root.copy();
      expect(copy.children[0].parent).toBe(copy);
    });
  });

  // ── Traversal ─────────────────────────────────────────────────────────────

  describe("getFamily()", () => {
    it("yields the node itself for a leaf", () => {
      const obj = new Object3D();
      const family = [...obj.getFamily()];
      expect(family).toContain(obj);
      expect(family).toHaveLength(1);
    });

    it("yields all descendants", () => {
      const root = new Object3D();
      const c1 = new Object3D();
      const c2 = new Object3D();
      root.add(c1);
      root.add(c2);
      const family = [...root.getFamily()];
      expect(family).toContain(root);
      expect(family).toContain(c1);
      expect(family).toContain(c2);
      expect(family).toHaveLength(3);
    });
  });

  describe("getMeshes()", () => {
    it("yields no meshes when there are none in the tree", () => {
      const obj = new Object3D();
      obj.add(new Object3D());
      const meshes = [...obj.getMeshes()];
      expect(meshes).toHaveLength(0);
    });

    it("yields a Mesh that is a direct child", () => {
      const root = new Object3D();
      const mesh = makeMesh();
      root.add(mesh);
      const meshes = [...root.getMeshes()];
      expect(meshes).toContain(mesh);
    });

    it("yields a Mesh that is the root node itself", () => {
      const mesh = makeMesh();
      const meshes = [...mesh.getMeshes()];
      expect(meshes).toContain(mesh);
    });
  });

  // ── Hierarchical transforms ───────────────────────────────────────────────

  describe("hierarchicalModelMatrix()", () => {
    it("returns own modelMatrix when there is no parent", () => {
      const obj = new Object3D();
      obj.setPosition(np.array([3, 0, 0]));
      const h = obj.hierarchicalModelMatrix();
      expect(h.get([0, 3])).toBeCloseTo(3);
    });

    it("returns product of parent and child matrices", () => {
      const parent = new Object3D();
      const child = new Object3D();
      // Parent translates +1 on X; child translates +2 on X.
      parent.setPosition(np.array([1, 0, 0]));
      child.setPosition(np.array([2, 0, 0]));
      parent.add(child);
      // Combined translation should be +3 on X.
      const h = child.hierarchicalModelMatrix();
      expect(h.get([0, 3])).toBeCloseTo(3);
    });
  });

  describe("hierarchicalNormalMatrix()", () => {
    it("returns a 3×3 NDArray for a root node", () => {
      const obj = new Object3D();
      const n = obj.hierarchicalNormalMatrix();
      expect(n.shape[0]).toBe(3);
      expect(n.shape[1]).toBe(3);
    });

    it("returns identity 3×3 when all matrices are identity", () => {
      const obj = new Object3D();
      const n = obj.hierarchicalNormalMatrix();
      expect(n.get([0, 0])).toBeCloseTo(1);
      expect(n.get([1, 1])).toBeCloseTo(1);
      expect(n.get([2, 2])).toBeCloseTo(1);
      expect(n.get([0, 1])).toBeCloseTo(0);
    });
  });

  // ── Updaters ──────────────────────────────────────────────────────────────

  describe("updater system", () => {
    it("addUpdater with 2-param function registers a time-based updater", () => {
      const obj = new Object3D();
      const upd: MeshTimeBasedUpdater = (_o, _dt) => {};
      obj.addUpdater(upd, undefined, false);
      expect(obj.timeBasedUpdaters).toContain(upd);
      expect(obj.nonTimeUpdaters).not.toContain(upd);
    });

    it("addUpdater with 1-param function registers a non-time updater", () => {
      const obj = new Object3D();
      const upd: MeshNonTimeBasedUpdater = (_o) => {};
      obj.addUpdater(upd, undefined, false);
      expect(obj.nonTimeUpdaters).toContain(upd);
      expect(obj.timeBasedUpdaters).not.toContain(upd);
    });

    it("sets hasUpdaters=true after adding an updater", () => {
      const obj = new Object3D();
      obj.addUpdater((_o) => {}, undefined, false);
      expect(obj.hasUpdaters).toBe(true);
    });

    it("removeUpdater removes the function from both lists", () => {
      const obj = new Object3D();
      const upd: MeshNonTimeBasedUpdater = (_o) => {};
      obj.addUpdater(upd, undefined, false);
      obj.removeUpdater(upd);
      expect(obj.nonTimeUpdaters).not.toContain(upd);
      expect(obj.hasUpdaters).toBe(false);
    });

    it("clearUpdaters empties both updater lists", () => {
      const obj = new Object3D();
      obj.addUpdater((_o) => {}, undefined, false);
      obj.addUpdater((_o, _dt) => {}, undefined, false);
      obj.clearUpdaters();
      expect(obj.getUpdaters()).toHaveLength(0);
      expect(obj.hasUpdaters).toBe(false);
    });

    it("update() calls time-based updater with dt", () => {
      const obj = new Object3D();
      let receivedDt = -1;
      const upd: MeshTimeBasedUpdater = (_o, dt) => { receivedDt = dt; };
      obj.addUpdater(upd, undefined, false);
      obj.update(0.5);
      expect(receivedDt).toBeCloseTo(0.5);
    });

    it("update() does nothing when updatingSuspended", () => {
      const obj = new Object3D();
      let called = false;
      obj.addUpdater((_o) => { called = true; }, undefined, false);
      obj.suspendUpdating();
      obj.update();
      expect(called).toBe(false);
    });

    it("resumeUpdating() re-enables and calls updater with dt=0", () => {
      const obj = new Object3D();
      let called = false;
      obj.addUpdater((_o) => { called = true; }, undefined, false);
      obj.suspendUpdating();
      obj.resumeUpdating(true);
      expect(called).toBe(true);
    });

    it("addUpdater respects optional index parameter", () => {
      const obj = new Object3D();
      const first: MeshNonTimeBasedUpdater = (_o) => {};
      const second: MeshNonTimeBasedUpdater = (_o) => {};
      obj.addUpdater(first, undefined, false);
      obj.addUpdater(second, 0, false); // insert before first
      expect(obj.nonTimeUpdaters[0]).toBe(second);
      expect(obj.nonTimeUpdaters[1]).toBe(first);
    });

    it("matchUpdaters copies all updaters from another node", () => {
      const src = new Object3D();
      const upd: MeshNonTimeBasedUpdater = (_o) => {};
      src.addUpdater(upd, undefined, false);
      const dst = new Object3D();
      dst.matchUpdaters(src);
      expect(dst.nonTimeUpdaters).toContain(upd);
    });
  });
});

// ---------------------------------------------------------------------------
// Mesh
// ---------------------------------------------------------------------------

describe("Mesh", () => {
  it("constructs from { shader, attributes }", () => {
    const mesh = makeMesh();
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh).toBeInstanceOf(Object3D);
  });

  it("inherits identity model matrix from Object3D", () => {
    const mesh = makeMesh();
    expect(mesh.modelMatrix.get([0, 0])).toBe(1);
  });

  it("defaults useDepthTest to true", () => {
    const mesh = makeMesh();
    expect(mesh.useDepthTest).toBe(true);
  });

  it("defaults primitive to TRIANGLES", () => {
    const mesh = makeMesh();
    expect(mesh.primitive).toBe(TRIANGLES);
  });

  it("defaults skipRender to false", () => {
    const mesh = makeMesh();
    expect(mesh.skipRender).toBe(false);
  });

  it("render() returns immediately when skipRender is true (no throw)", () => {
    const mesh = makeMesh();
    mesh.skipRender = true;
    expect(() => mesh.render()).not.toThrow();
  });

  it("constructs from { geometry, material } and borrows attributes", () => {
    const geo = makeMesh();
    const mat = makeShader();
    const mesh = new Mesh({ geometry: geo, material: mat });
    expect(mesh.attributes).toBe(geo.attributes);
    expect(mesh.shader).toBe(mat);
  });

  it("throws when neither path is provided", () => {
    // @ts-expect-error — intentional bad call for runtime error test
    expect(() => new Mesh({})).toThrow();
  });

  it("accepts useDepthTest=false and a custom primitive", () => {
    const mesh = new Mesh({
      shader: makeShader(),
      attributes: makeShaderData(),
      useDepthTest: false,
      primitive: "LINES",
    });
    expect(mesh.useDepthTest).toBe(false);
    expect(mesh.primitive).toBe("LINES");
  });

  describe("singleCopy()", () => {
    it("returns a Mesh instance with a deep-copied Float32Array", () => {
      const mesh = makeMesh();
      const copy = mesh.singleCopy();
      expect(copy).toBeInstanceOf(Mesh);
      copy.attributes.data[0] = 9999;
      expect(mesh.attributes.data[0]).not.toBe(9999);
    });

    it("does not carry over children", () => {
      const mesh = makeMesh();
      mesh.add(new Object3D());
      const copy = mesh.singleCopy();
      expect(copy.children).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Shader
// ---------------------------------------------------------------------------

describe("Shader", () => {
  it("constructs with inline source without throwing", () => {
    expect(() => makeShader()).not.toThrow();
  });

  it("throws when neither name nor source is provided", () => {
    expect(() => new Shader(mockContext)).toThrow();
  });

  it("stores the provided context", () => {
    const s = makeShader();
    expect(s.context).toBe(mockContext);
  });

  it("stores name as null when only source is given", () => {
    const s = makeShader();
    expect(s.name).toBeNull();
  });

  it("setUniform does not throw", () => {
    const s = makeShader();
    expect(() => s.setUniform("u_opacity", 0.5)).not.toThrow();
    expect(() => s.setUniform("missing_uniform", [1, 2, 3])).not.toThrow();
  });

  it("two Shaders with the same name share the cached program when context matches", () => {
    // Use a unique name so we don't pollute other tests.
    const name = "__test_cache__";
    shaderProgramCache.delete(name); // ensure clean state

    const src = {
      source: { vertex_shader: "void main(){}", fragment_shader: "void main(){}" },
      name,
    };
    const s1 = new Shader(mockContext, src);
    // s1 created a program and cached it.
    const s2 = new Shader(mockContext, src);
    expect(s1.shaderProgram).toBe(s2.shaderProgram);

    shaderProgramCache.delete(name); // cleanup
  });
});

// ---------------------------------------------------------------------------
// filterAttributes
// ---------------------------------------------------------------------------

describe("filterAttributes()", () => {
  it("returns only the requested attribute names", () => {
    const data: ShaderData = {
      data: new Float32Array([1, 2, 3, 4, 5, 6]),
      dtype: { names: ["position", "color", "uv"] },
      length: 2,
    };
    const filtered = filterAttributes(data, ["position", "uv"]);
    expect(filtered.dtype.names).toEqual(["position", "uv"]);
    expect(filtered.dtype.names).not.toContain("color");
  });

  it("preserves the original data buffer", () => {
    const data: ShaderData = {
      data: new Float32Array([1, 2, 3]),
      dtype: { names: ["x"] },
      length: 1,
    };
    const filtered = filterAttributes(data, ["x"]);
    expect(filtered.data).toBe(data.data);
  });

  it("returns empty names list when no attributes match", () => {
    const data: ShaderData = {
      data: new Float32Array([1, 2, 3]),
      dtype: { names: ["a", "b"] },
      length: 1,
    };
    const filtered = filterAttributes(data, ["z"]);
    expect(filtered.dtype.names).toHaveLength(0);
  });

  it("preserves length", () => {
    const data: ShaderData = {
      data: new Float32Array(12),
      dtype: { names: ["pos", "norm"] },
      length: 4,
    };
    const filtered = filterAttributes(data, ["pos"]);
    expect(filtered.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// FullScreenQuad
// ---------------------------------------------------------------------------

describe("FullScreenQuad", () => {
  it("constructs with inline fragment shader source without throwing", () => {
    const fragSrc = "void main() { gl_FragColor = vec4(1.0); }";
    expect(
      () => new FullScreenQuad(mockContext, { fragmentShaderSource: fragSrc }),
    ).not.toThrow();
  });

  it("is an instance of both Mesh and Object3D", () => {
    const fragSrc = "void main() { gl_FragColor = vec4(0.0); }";
    const fsq = new FullScreenQuad(mockContext, { fragmentShaderSource: fragSrc });
    expect(fsq).toBeInstanceOf(Mesh);
    expect(fsq).toBeInstanceOf(Object3D);
  });

  it("creates 6 vertices for the two triangles", () => {
    const fragSrc = "void main() {}";
    const fsq = new FullScreenQuad(mockContext, { fragmentShaderSource: fragSrc });
    expect(fsq.attributes.length).toBe(6);
  });

  it("throws when neither source nor name is provided", () => {
    expect(() => new FullScreenQuad(mockContext, {})).toThrow();
  });

  it("uses custom config frame dimensions when provided", () => {
    const fragSrc = "void main() {}";
    const fsq = new FullScreenQuad(mockContext, {
      fragmentShaderSource: fragSrc,
      config: { frameWidth: 20, frameHeight: 10 },
    });
    // fx = 10, fy = 5 → first vertex is [-10, -5, 0, 1]
    expect(fsq.attributes.data[0]).toBeCloseTo(-10);
    expect(fsq.attributes.data[1]).toBeCloseTo(-5);
  });

  it("render() does not throw", () => {
    const fragSrc = "void main() {}";
    const fsq = new FullScreenQuad(mockContext, { fragmentShaderSource: fragSrc });
    expect(() => fsq.render()).not.toThrow();
  });
});
