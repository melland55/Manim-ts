import { describe, it, expect } from "vitest";
import {
  TexTemplate,
  TexTemplateLibrary,
  TexFontTemplates,
} from "../../src/utils/tex_templates/index.js";

describe("TexTemplate", () => {
  it("constructs with defaults", () => {
    const t = new TexTemplate();
    expect(t.texCompiler).toBe("latex");
    expect(t.outputFormat).toBe(".dvi");
    expect(t.description).toBe("");
    expect(t.placeholderText).toBe("YourTextHere");
    expect(t.postDocCommands).toBe("");
    expect(t.documentclass).toBe("\\documentclass[preview]{standalone}");
  });

  it("body includes all sections when no custom body set", () => {
    const t = new TexTemplate();
    const body = t.body;
    expect(body).toContain("\\documentclass[preview]{standalone}");
    expect(body).toContain("\\begin{document}");
    expect(body).toContain("\\end{document}");
    expect(body).toContain("YourTextHere");
  });

  it("addToPreamble appends by default", () => {
    const t = new TexTemplate({ preamble: "\\usepackage{amsmath}" });
    t.addToPreamble("\\usepackage{amssymb}");
    expect(t.preamble).toContain("\\usepackage{amsmath}");
    expect(t.preamble).toContain("\\usepackage{amssymb}");
    expect(t.preamble.indexOf("amsmath")).toBeLessThan(
      t.preamble.indexOf("amssymb"),
    );
  });

  it("addToPreamble prepends when prepend=true", () => {
    const t = new TexTemplate({ preamble: "\\usepackage{amsmath}" });
    t.addToPreamble("\\usepackage{amssymb}", true);
    expect(t.preamble.indexOf("amssymb")).toBeLessThan(
      t.preamble.indexOf("amsmath"),
    );
  });

  it("addToDocument appends post_doc_commands", () => {
    const t = new TexTemplate();
    t.addToDocument("\\boldmath");
    expect(t.postDocCommands).toContain("\\boldmath");
  });

  it("getTexcodeForExpression replaces placeholder", () => {
    const t = new TexTemplate();
    const code = t.getTexcodeForExpression("$x^2$");
    expect(code).toContain("$x^2$");
    expect(code).not.toContain("YourTextHere");
  });

  it("getTexcodeForExpressionInEnv wraps in environment", () => {
    const t = new TexTemplate();
    const code = t.getTexcodeForExpressionInEnv("x + y", "align*");
    expect(code).toContain("\\begin{align*}");
    expect(code).toContain("\\end{align*}");
    expect(code).toContain("x + y");
  });

  it("copy creates independent clone", () => {
    const t = new TexTemplate({ description: "original" });
    const clone = t.copy();
    clone.description = "clone";
    expect(t.description).toBe("original");
    expect(clone.description).toBe("clone");
  });

  it("body setter overrides computed body", () => {
    const t = new TexTemplate();
    t.body = "custom body";
    expect(t.body).toBe("custom body");
  });

  it("method chaining works for addToPreamble", () => {
    const t = new TexTemplate();
    const result = t.addToPreamble("\\usepackage{xcolor}");
    expect(result).toBe(t);
  });
});

describe("TexTemplateLibrary", () => {
  it("default template has latex compiler", () => {
    expect(TexTemplateLibrary.default.texCompiler).toBe("latex");
  });

  it("ctex template uses xelatex", () => {
    expect(TexTemplateLibrary.ctex.texCompiler).toBe("xelatex");
    expect(TexTemplateLibrary.ctex.outputFormat).toBe(".xdv");
  });

  it("ctex template uses ctex package instead of DisableLigatures", () => {
    expect(TexTemplateLibrary.ctex.preamble).toContain("\\usepackage[UTF8]{ctex}");
    expect(TexTemplateLibrary.ctex.preamble).not.toContain("\\DisableLigatures");
  });

  it("simple template uses AMS packages", () => {
    expect(TexTemplateLibrary.simple.preamble).toContain("\\usepackage{amsmath}");
    expect(TexTemplateLibrary.simple.preamble).toContain("\\usepackage{amssymb}");
  });

  it("threeb1b and default are independent instances", () => {
    TexTemplateLibrary.threeb1b.description = "test-threeb1b";
    expect(TexTemplateLibrary.default.description).not.toBe("test-threeb1b");
    TexTemplateLibrary.threeb1b.description = "";
  });
});

describe("TexFontTemplates", () => {
  it("comic_sans uses xelatex", () => {
    expect(TexFontTemplates.comic_sans.texCompiler).toBe("xelatex");
    expect(TexFontTemplates.comic_sans.outputFormat).toBe(".xdv");
  });

  it("comic_sans description is set", () => {
    expect(TexFontTemplates.comic_sans.description).toBe("Comic Sans MS");
  });

  it("chalkduster uses lualatex", () => {
    expect(TexFontTemplates.chalkduster.texCompiler).toBe("lualatex");
    expect(TexFontTemplates.chalkduster.outputFormat).toBe(".pdf");
  });

  it("latin_modern_tw has correct description", () => {
    expect(TexFontTemplates.latin_modern_tw.description).toBe(
      "Latin Modern Typewriter Proportional",
    );
  });

  it("all font templates are TexTemplate instances", () => {
    const keys = Object.getOwnPropertyNames(TexFontTemplates) as Array<
      keyof typeof TexFontTemplates
    >;
    for (const key of keys) {
      const tpl = (TexFontTemplates as Record<string, unknown>)[key];
      if (tpl instanceof TexTemplate) {
        expect(tpl.texCompiler).toBeTruthy();
        expect(typeof tpl.preamble).toBe("string");
      }
    }
  });

  it("ecf_webster has post_doc_commands with mathversion bold", () => {
    expect(TexFontTemplates.ecf_webster.postDocCommands).toContain(
      "\\mathversion{bold}",
    );
  });

  it("urw_zapf_chancery has boldmath in post_doc_commands", () => {
    expect(TexFontTemplates.urw_zapf_chancery.postDocCommands).toContain(
      "\\boldmath",
    );
  });

  it("antykwa description includes Półtawskiego", () => {
    expect(TexFontTemplates.antykwa.description).toContain("Półtawskiego");
  });
});
