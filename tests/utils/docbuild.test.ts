/**
 * Tests for utils/docbuild.
 * Covers: module_parsing, autoaliasattr_directive, autocolor_directive, manim_directive.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  smartReplace,
  AliasAttrDocumenter,
} from "../../src/utils/docbuild/autoaliasattr_directive.js";

import {
  ManimColorModuleDocumenter,
  relativeLuminance,
  contrastFontColor,
} from "../../src/utils/docbuild/autocolor_directive.js";

import {
  processNameList,
  renderTemplate,
  ManimDirective,
  SkipManimNode,
  QUALITIES,
} from "../../src/utils/docbuild/manim_directive.js";

import {
  parseModuleSource,
  _resetModuleCaches,
} from "../../src/utils/docbuild/module_parsing.js";

// ─── smartReplace ─────────────────────────────────────────────────────────────

describe("smartReplace", () => {
  it("replaces a word-boundary match", () => {
    expect(smartReplace("Point3D is cool", "Point3D", ":class:`~.Point3D`")).toBe(
      ":class:`~.Point3D` is cool",
    );
  });

  it("does not replace a partial match inside another word", () => {
    // "Point3D" should NOT be replaced inside "MyPoint3DArray"
    expect(smartReplace("MyPoint3DArray foo", "Point3D", ":class:`~.Point3D`")).toBe(
      "MyPoint3DArray foo",
    );
  });

  it("replaces multiple occurrences in reverse so offsets remain valid", () => {
    const result = smartReplace("Foo and Foo and Foo", "Foo", "Bar");
    expect(result).toBe("Bar and Bar and Bar");
  });

  it("replaces when alias is at the start and end of string", () => {
    const result = smartReplace("Foo", "Foo", "Bar");
    expect(result).toBe("Bar");
  });

  it("handles overlapping alias names by matching whole words only", () => {
    // "Color" should not match inside "ManimColor"
    const result = smartReplace("ManimColor Color", "Color", "X");
    expect(result).toBe("ManimColor X");
  });

  it("returns the base string unchanged when alias is not found", () => {
    expect(smartReplace("hello world", "Foo", "Bar")).toBe("hello world");
  });
});

// ─── processNameList ──────────────────────────────────────────────────────────

describe("processNameList", () => {
  it("formats class names into class references", () => {
    expect(processNameList("Tex TexTemplate", "class")).toEqual([
      ":class:`~.Tex`",
      ":class:`~.TexTemplate`",
    ]);
  });

  it("formats method names into func references", () => {
    expect(processNameList("Scene.play Mobject.rotate", "func")).toEqual([
      ":func:`~.Scene.play`",
      ":func:`~.Mobject.rotate`",
    ]);
  });

  it("handles a single name", () => {
    expect(processNameList("Dot", "class")).toEqual([":class:`~.Dot`"]);
  });
});

// ─── relativeLuminance / contrastFontColor ────────────────────────────────────

describe("relativeLuminance", () => {
  it("returns ~1 for white", () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1);
  });

  it("returns 0 for black", () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });
});

describe("contrastFontColor", () => {
  it("returns black for light backgrounds", () => {
    expect(contrastFontColor(0.8)).toBe("black");
  });

  it("returns white for dark backgrounds", () => {
    expect(contrastFontColor(0.2)).toBe("white");
  });

  it("returns white at the threshold boundary (0.5)", () => {
    expect(contrastFontColor(0.5)).toBe("white");
  });
});

// ─── ManimColorModuleDocumenter ───────────────────────────────────────────────

describe("ManimColorModuleDocumenter", () => {
  function makeFakeColor(r: number, g: number, b: number, hex: string) {
    return {
      r,
      g,
      b,
      a: 1,
      toHex: () => hex,
      toArray: () => [r, g, b, 1] as [number, number, number, number],
      interpolate: () => makeFakeColor(0, 0, 0, "#000000"),
      lighter: () => makeFakeColor(0, 0, 0, "#000000"),
      darker: () => makeFakeColor(0, 0, 0, "#000000"),
    };
  }

  const fakeExports = {
    RED: makeFakeColor(1, 0, 0, "#FF0000"),
    WHITE: makeFakeColor(1, 1, 1, "#FFFFFF"),
    notAColor: 42,
    alsoNotAColor: "hello",
  };

  it("collects only IColor entries from module exports", () => {
    const doc = new ManimColorModuleDocumenter();
    const entries = doc.collectColorEntries(fakeExports as Record<string, unknown>);
    expect(entries.map((e) => e.name).sort()).toEqual(["RED", "WHITE"]);
  });

  it("assigns white font for dark colors", () => {
    const doc = new ManimColorModuleDocumenter();
    const entries = doc.collectColorEntries(fakeExports as Record<string, unknown>);
    const red = entries.find((e) => e.name === "RED")!;
    expect(red.fontColor).toBe("white");
  });

  it("assigns black font for light colors", () => {
    const doc = new ManimColorModuleDocumenter();
    const entries = doc.collectColorEntries(fakeExports as Record<string, unknown>);
    const white = entries.find((e) => e.name === "WHITE")!;
    expect(white.fontColor).toBe("black");
  });

  it("run() returns a table DocumentNode", () => {
    const doc = new ManimColorModuleDocumenter();
    const nodes = doc.run(fakeExports as Record<string, unknown>);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].tagName).toBe("table");
  });

  it("toHtml() produces an HTML string containing the hex codes", () => {
    const doc = new ManimColorModuleDocumenter();
    const html = doc.toHtml(fakeExports as Record<string, unknown>);
    expect(html).toContain("#FF0000");
    expect(html).toContain("#FFFFFF");
  });
});

// ─── QUALITIES ────────────────────────────────────────────────────────────────

describe("QUALITIES", () => {
  it("defines all expected quality levels", () => {
    for (const key of ["low_quality", "medium_quality", "high_quality", "fourk_quality", "example_quality"]) {
      expect(QUALITIES).toHaveProperty(key);
    }
  });

  it("high_quality has 1080p resolution", () => {
    expect(QUALITIES.high_quality.pixelHeight).toBe(1080);
    expect(QUALITIES.high_quality.pixelWidth).toBe(1920);
  });
});

// ─── renderTemplate ───────────────────────────────────────────────────────────

describe("renderTemplate", () => {
  it("includes video tag when not gif and not last frame", () => {
    const out = renderTemplate({
      clsname: "TestScene",
      clsnameLowercase: "testscene",
      hideSource: false,
      filesrcRel: "media/videos/TestScene-1.mp4",
      noAutoplay: false,
      outputFile: "TestScene-1",
      saveLastFrame: false,
      saveAsGif: false,
      sourceBlock: ".. code-block:: typescript\n\n    class TestScene ...",
      refBlock: "",
    });
    expect(out).toContain("manim-video");
    expect(out).toContain("TestScene-1.mp4");
  });

  it("includes image tag when saveLastFrame is true", () => {
    const out = renderTemplate({
      clsname: "TestScene",
      clsnameLowercase: "testscene",
      hideSource: false,
      filesrcRel: "media/images/TestScene-1.png",
      noAutoplay: false,
      outputFile: "TestScene-1",
      saveLastFrame: true,
      saveAsGif: false,
      sourceBlock: "",
      refBlock: "",
    });
    expect(out).toContain(".. image::");
    expect(out).not.toContain("manim-video");
  });

  it("hides source block when hideSource is true", () => {
    const out = renderTemplate({
      clsname: "TestScene",
      clsnameLowercase: "testscene",
      hideSource: true,
      filesrcRel: "media/videos/TestScene-1.mp4",
      noAutoplay: false,
      outputFile: "TestScene-1",
      saveLastFrame: false,
      saveAsGif: false,
      sourceBlock: ".. code-block:: typescript",
      refBlock: "References: :class:`~.Dot`",
    });
    expect(out).not.toContain(".. code-block::");
    expect(out).not.toContain("References:");
  });
});

// ─── SkipManimNode ────────────────────────────────────────────────────────────

describe("SkipManimNode", () => {
  it("toRst() contains the class name", () => {
    const node = new SkipManimNode("MyScene", ["class MyScene(Scene):", "    pass"]);
    const rst = node.toRst();
    expect(rst).toContain("MyScene");
    expect(rst).toContain("data-manim-classname");
  });
});

// ─── ManimDirective ───────────────────────────────────────────────────────────

describe("ManimDirective", () => {
  beforeEach(() => {
    ManimDirective.resetClassnameDict();
  });

  it("returns a skip node when skipRendering is true", async () => {
    const directive = new ManimDirective("ExampleScene", ["class ExampleScene: pass"], {});
    const result = await directive.run(true);
    expect(result.skipNode).toBeDefined();
    expect(result.skipNode?.className).toBe("ExampleScene");
  });

  it("tracks duplicate class names", async () => {
    const d1 = new ManimDirective("MyScene", [], {});
    const d2 = new ManimDirective("MyScene", [], {});
    await d1.run(false);
    await d2.run(false);
    expect(ManimDirective.getClassnameDict().get("MyScene")).toBe(2);
  });

  it("throws when both saveAsGif and saveLastFrame are true", async () => {
    const directive = new ManimDirective("S", [], {
      saveAsGif: true,
      saveLastFrame: true,
    });
    await expect(directive.run(false)).rejects.toThrow();
  });

  it("run() returns content string (not skip) for normal render", async () => {
    const directive = new ManimDirective("NormalScene", ["class NormalScene: pass"], {
      quality: "low",
    });
    const result = await directive.run(false);
    expect(result.content).toBeTruthy();
    expect(result.skipNode).toBeUndefined();
  });
});

// ─── parseModuleSource ────────────────────────────────────────────────────────

describe("parseModuleSource", () => {
  beforeEach(() => {
    _resetModuleCaches();
  });

  afterEach(() => {
    _resetModuleCaches();
  });

  it("extracts a simple export type alias", () => {
    const src = `export type Foo = string | number;`;
    const [aliasDict] = parseModuleSource(src, "test.module");
    const uncategorized = aliasDict.get("");
    expect(uncategorized).toBeDefined();
    expect(uncategorized!.has("Foo")).toBe(true);
    expect(uncategorized!.get("Foo")!.definition).toContain("string");
  });

  it("extracts a non-exported type alias", () => {
    const src = `type Bar = Record<string, number>;`;
    const [aliasDict] = parseModuleSource(src, "test.module");
    const uncategorized = aliasDict.get("");
    expect(uncategorized?.has("Bar")).toBe(true);
  });

  it("extracts a category marker and places aliases under it", () => {
    const src = [
      "// [CATEGORY] Math Types",
      "export type Vector = number[];",
    ].join("\n");
    const [aliasDict] = parseModuleSource(src, "test.module");
    const mathCat = aliasDict.get("Math Types");
    expect(mathCat).toBeDefined();
    expect(mathCat!.has("Vector")).toBe(true);
  });

  it("attaches a JSDoc comment as doc to the alias", () => {
    const src = [
      "/**",
      " * A 3-element point in 3D space.",
      " */",
      "export type Point3D = [number, number, number];",
    ].join("\n");
    const [aliasDict] = parseModuleSource(src, "test.module");
    const info = aliasDict.get("")?.get("Point3D");
    expect(info).toBeDefined();
    expect(info!.doc).toContain("3D space");
  });

  it("collects exported const with JSDoc into dataList", () => {
    const src = [
      "/** The origin point. */",
      "export const ORIGIN: number[] = [0, 0, 0];",
    ].join("\n");
    const [, dataList] = parseModuleSource(src, "test.module");
    expect(dataList).toContain("ORIGIN");
  });

  it("does NOT collect exported const without JSDoc into dataList", () => {
    const src = `export const PRIVATE_CONST = 42;`;
    const [, dataList] = parseModuleSource(src, "test.module");
    expect(dataList).not.toContain("PRIVATE_CONST");
  });

  it("returns empty maps for an empty source file", () => {
    const [aliasDict, dataList, typeVarDict] = parseModuleSource("", "empty.module");
    expect(aliasDict.size).toBe(0);
    expect(dataList).toHaveLength(0);
    expect(typeVarDict.size).toBe(0);
  });
});

// ─── AliasAttrDocumenter ──────────────────────────────────────────────────────

describe("AliasAttrDocumenter", () => {
  it("constructs without throwing", () => {
    expect(
      () => new AliasAttrDocumenter({ moduleName: "manim.utils.color" }),
    ).not.toThrow();
  });

  it("run() returns an array (may be empty for unknown modules)", () => {
    const doc = new AliasAttrDocumenter({ moduleName: "nonexistent.module" });
    const result = doc.run();
    expect(Array.isArray(result)).toBe(true);
  });

  it("run() root node has tagName 'container'", () => {
    const doc = new AliasAttrDocumenter({ moduleName: "nonexistent.module" });
    const result = doc.run();
    expect(result[0].tagName).toBe("container");
  });
});
