import { describe, it, expect } from "vitest";

/**
 * Tests for the top-level opengl barrel export module.
 * Verifies that re-exports from renderer/shader and utils/opengl
 * are accessible through the unified opengl entry point.
 */

describe("opengl barrel exports", () => {
  // ── utils/opengl re-exports ──

  it("exports depth constant", async () => {
    const { depth } = await import("../src/opengl/index.js");
    expect(depth).toBe(20);
  });

  it("exports matrix utility functions", async () => {
    const mod = await import("../src/opengl/index.js");
    expect(typeof mod.translationMatrix).toBe("function");
    expect(typeof mod.xRotationMatrix).toBe("function");
    expect(typeof mod.yRotationMatrix).toBe("function");
    expect(typeof mod.zRotationMatrix).toBe("function");
    expect(typeof mod.rotationMatrix).toBe("function");
    expect(typeof mod.rotateInPlaceMatrix).toBe("function");
    expect(typeof mod.scaleMatrix).toBe("function");
    expect(typeof mod.viewMatrix).toBe("function");
  });

  it("exports projection matrix functions", async () => {
    const mod = await import("../src/opengl/index.js");
    expect(typeof mod.orthographicProjectionMatrix).toBe("function");
    expect(typeof mod.perspectiveProjectionMatrix).toBe("function");
  });

  it("exports matrixToShaderInput", async () => {
    const mod = await import("../src/opengl/index.js");
    expect(typeof mod.matrixToShaderInput).toBe("function");
  });

  // ── renderer/shader re-exports ──

  it("exports Shader class", async () => {
    const { Shader } = await import("../src/opengl/index.js");
    expect(Shader).toBeDefined();
    expect(typeof Shader).toBe("function");
  });

  it("exports Mesh class", async () => {
    const { Mesh } = await import("../src/opengl/index.js");
    expect(Mesh).toBeDefined();
    expect(typeof Mesh).toBe("function");
  });

  it("exports Object3D class", async () => {
    const { Object3D } = await import("../src/opengl/index.js");
    expect(Object3D).toBeDefined();
    expect(typeof Object3D).toBe("function");
  });

  it("exports FullScreenQuad class", async () => {
    const { FullScreenQuad } = await import("../src/opengl/index.js");
    expect(FullScreenQuad).toBeDefined();
    expect(typeof FullScreenQuad).toBe("function");
  });

  it("exports shader helper functions", async () => {
    const mod = await import("../src/opengl/index.js");
    expect(typeof mod.getShaderCodeFromFile).toBe("function");
    expect(typeof mod.filterAttributes).toBe("function");
  });

  it("exports shader caches", async () => {
    const mod = await import("../src/opengl/index.js");
    expect(mod.shaderProgramCache).toBeDefined();
    expect(mod.filePathToCodeMap).toBeDefined();
  });

  // ── Functional smoke test ──

  it("translationMatrix produces a 4x4 identity-like matrix", async () => {
    const { translationMatrix } = await import("../src/opengl/index.js");
    const m = translationMatrix(0, 0, 0);
    // Should be an identity matrix
    expect(m.get([0, 0])).toBe(1);
    expect(m.get([1, 1])).toBe(1);
    expect(m.get([2, 2])).toBe(1);
    expect(m.get([3, 3])).toBe(1);
    expect(m.get([0, 3])).toBe(0);
  });
});
