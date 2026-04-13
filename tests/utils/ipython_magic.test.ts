import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ManimMagic,
  _generateFileName,
  type IInteractiveShell,
  type ManimDisplayResult,
} from "../../src/utils/ipython_magic/index.js";

describe("ManimMagic", () => {
  describe("constructor", () => {
    it("constructs with default parameters", () => {
      const magic = new ManimMagic();
      expect(magic.shell).toBeNull();
      expect(magic.isColab).toBe(false);
      expect(magic.renderedFiles).toBeInstanceOf(Map);
      expect(magic.renderedFiles.size).toBe(0);
    });

    it("accepts a shell parameter", () => {
      const shell: IInteractiveShell = { userNs: { x: 42 } };
      const magic = new ManimMagic(shell);
      expect(magic.shell).toBe(shell);
      expect(magic.isColab).toBe(false);
    });

    it("accepts isColab flag", () => {
      const magic = new ManimMagic(null, true);
      expect(magic.isColab).toBe(true);
    });
  });

  describe("addAdditionalArgs", () => {
    let magic: ManimMagic;

    beforeEach(() => {
      magic = new ManimMagic();
    });

    it("prepends --jupyter flag", () => {
      const result = magic.addAdditionalArgs(["-qm", "MyScene"]);
      expect(result[0]).toBe("--jupyter");
    });

    it("places scene name last with empty string separator", () => {
      const result = magic.addAdditionalArgs(["-qm", "MyScene"]);
      expect(result[result.length - 1]).toBe("MyScene");
      expect(result[result.length - 2]).toBe("");
    });

    it("preserves flag args between --jupyter and scene name", () => {
      const result = magic.addAdditionalArgs(["-qm", "--disable_caching", "TestScene"]);
      expect(result).toEqual([
        "--jupyter",
        "-qm",
        "--disable_caching",
        "",
        "TestScene",
      ]);
    });

    it("adds --format webm when -t flag is present", () => {
      const result = magic.addAdditionalArgs(["-t", "-qm", "MyScene"]);
      expect(result).toContain("--format");
      expect(result).toContain("webm");
    });

    it("does not add --format webm when --format is already specified", () => {
      const result = magic.addAdditionalArgs(["-t", "--format", "mp4", "MyScene"]);
      // Should only have one --format (the user-specified one)
      const formatIndices = result
        .map((a, i) => (a === "--format" ? i : -1))
        .filter((i) => i >= 0);
      expect(formatIndices).toHaveLength(1);
    });

    it("does not add --format webm when -t is absent", () => {
      const result = magic.addAdditionalArgs(["-qm", "MyScene"]);
      expect(result).not.toContain("webm");
    });

    it("handles single-element args (scene name only)", () => {
      const result = magic.addAdditionalArgs(["MyScene"]);
      expect(result).toEqual(["--jupyter", "", "MyScene"]);
    });
  });

  describe("_generateFileName", () => {
    it("returns a string matching SceneName@YYYY-MM-DD@HH-MM-SS pattern", () => {
      const name = _generateFileName();
      // Pattern: word chars @ date @ time
      expect(name).toMatch(/^.+@\d{4}-\d{2}-\d{2}@\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe("renderedFiles tracking", () => {
    it("starts with an empty map", () => {
      const magic = new ManimMagic();
      expect(magic.renderedFiles.size).toBe(0);
    });

    it("allows manual manipulation of renderedFiles map", () => {
      const magic = new ManimMagic();
      magic.renderedFiles.set("/out/scene.mp4", "/media/jupyter/copy.mp4");
      expect(magic.renderedFiles.get("/out/scene.mp4")).toBe(
        "/media/jupyter/copy.mp4",
      );
    });
  });
});
