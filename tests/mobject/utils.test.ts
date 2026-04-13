import { describe, it, expect, afterEach } from "vitest";
import {
  RendererType,
  getActiveRenderer,
  getMobjectClass,
  getVectorizedMobjectClass,
  getPointMobjectClass,
} from "../../src/mobject/utils/index.js";

describe("mobject/utils", () => {
  // ─── getActiveRenderer ──────────────────────────────────────

  describe("getActiveRenderer", () => {
    afterEach(() => {
      delete process.env["MANIM_RENDERER"];
    });

    it("defaults to CAIRO when no env var is set", () => {
      delete process.env["MANIM_RENDERER"];
      expect(getActiveRenderer()).toBe(RendererType.CAIRO);
    });

    it("returns OPENGL when MANIM_RENDERER=opengl", () => {
      process.env["MANIM_RENDERER"] = "opengl";
      expect(getActiveRenderer()).toBe(RendererType.OPENGL);
    });

    it("returns CAIRO for unrecognised env var values", () => {
      process.env["MANIM_RENDERER"] = "vulkan";
      expect(getActiveRenderer()).toBe(RendererType.CAIRO);
    });
  });

  // ─── RendererType enum ───────────────────────────────────────

  describe("RendererType", () => {
    it("has CAIRO and OPENGL variants", () => {
      expect(RendererType.CAIRO).toBe("cairo");
      expect(RendererType.OPENGL).toBe("opengl");
    });
  });

  // ─── getMobjectClass ─────────────────────────────────────────

  describe("getMobjectClass", () => {
    afterEach(() => {
      delete process.env["MANIM_RENDERER"];
    });

    it("is exported from the module", () => {
      expect(typeof getMobjectClass).toBe("function");
    });

    it("throws on CAIRO renderer until Mobject is implemented", () => {
      delete process.env["MANIM_RENDERER"]; // default = CAIRO
      expect(() => getMobjectClass()).toThrow(/Mobject class has not been converted/);
    });

    it("throws on OPENGL renderer with a WebGL2 not-implemented message", () => {
      process.env["MANIM_RENDERER"] = "opengl";
      expect(() => getMobjectClass()).toThrow(/OpenGL\/WebGL2 renderer is not yet implemented/);
    });
  });

  // ─── getVectorizedMobjectClass ───────────────────────────────

  describe("getVectorizedMobjectClass", () => {
    afterEach(() => {
      delete process.env["MANIM_RENDERER"];
    });

    it("is exported from the module", () => {
      expect(typeof getVectorizedMobjectClass).toBe("function");
    });

    it("throws on CAIRO renderer until VMobject is implemented", () => {
      delete process.env["MANIM_RENDERER"];
      expect(() => getVectorizedMobjectClass()).toThrow(/VMobject class has not been converted/);
    });

    it("throws on OPENGL renderer with a WebGL2 not-implemented message", () => {
      process.env["MANIM_RENDERER"] = "opengl";
      expect(() => getVectorizedMobjectClass()).toThrow(/OpenGL\/WebGL2 renderer is not yet implemented/);
    });
  });

  // ─── getPointMobjectClass ────────────────────────────────────

  describe("getPointMobjectClass", () => {
    afterEach(() => {
      delete process.env["MANIM_RENDERER"];
    });

    it("is exported from the module", () => {
      expect(typeof getPointMobjectClass).toBe("function");
    });

    it("throws on CAIRO renderer until PMobject is implemented", () => {
      delete process.env["MANIM_RENDERER"];
      expect(() => getPointMobjectClass()).toThrow(/PMobject class has not been converted/);
    });

    it("throws on OPENGL renderer with a WebGL2 not-implemented message", () => {
      process.env["MANIM_RENDERER"] = "opengl";
      expect(() => getPointMobjectClass()).toThrow(/OpenGL\/WebGL2 renderer is not yet implemented/);
    });
  });
});
