import { describe, it, expect, beforeEach } from "vitest";
import { TexTemplate, _texcodeForEnvironment } from "../../src/utils/tex/index.js";

describe("TexTemplate", () => {
  it("constructs with defaults", () => {
    const t = new TexTemplate();
    expect(t.texCompiler).toBe("latex");
    expect(t.description).toBe("");
    expect(t.outputFormat).toBe(".dvi");
    expect(t.documentclass).toBe("\\documentclass[preview]{standalone}");
    expect(t.placeholderText).toBe("YourTextHere");
    expect(t.postDocCommands).toBe("");
    expect(t.preamble).toContain("\\usepackage{amsmath}");
  });

  it("constructs with custom options", () => {
    const t = new TexTemplate({
      texCompiler: "pdflatex",
      outputFormat: ".pdf",
      description: "Custom template",
    });
    expect(t.texCompiler).toBe("pdflatex");
    expect(t.outputFormat).toBe(".pdf");
    expect(t.description).toBe("Custom template");
  });

  it("body getter generates correct document", () => {
    const t = new TexTemplate();
    const body = t.body;
    expect(body).toContain("\\documentclass[preview]{standalone}");
    expect(body).toContain("\\begin{document}");
    expect(body).toContain("\\end{document}");
    expect(body).toContain("YourTextHere");
  });

  it("body setter overrides generated body", () => {
    const t = new TexTemplate();
    const custom = "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}";
    t.body = custom;
    expect(t.body).toBe(custom);
  });

  it("addToPreamble appends by default", () => {
    const t = new TexTemplate();
    const original = t.preamble;
    t.addToPreamble("\\usepackage{hyperref}");
    expect(t.preamble).toBe(original + "\n\\usepackage{hyperref}");
  });

  it("addToPreamble prepends when requested", () => {
    const t = new TexTemplate();
    const original = t.preamble;
    t.addToPreamble("\\usepackage{hyperref}", true);
    expect(t.preamble).toBe("\\usepackage{hyperref}\n" + original);
  });

  it("addToPreamble returns this for chaining", () => {
    const t = new TexTemplate();
    const result = t.addToPreamble("\\usepackage{hyperref}");
    expect(result).toBe(t);
  });

  it("addToDocument appends post-doc commands", () => {
    const t = new TexTemplate();
    t.addToDocument("\\boldmath");
    expect(t.postDocCommands).toBe("\\boldmath");
    t.addToDocument("\\color{red}");
    expect(t.postDocCommands).toBe("\\boldmath\\color{red}");
  });

  it("addToDocument returns this for chaining", () => {
    const t = new TexTemplate();
    const result = t.addToDocument("\\boldmath");
    expect(result).toBe(t);
  });

  it("getTexcodeForExpression replaces placeholder", () => {
    const t = new TexTemplate();
    const code = t.getTexcodeForExpression("$\\sqrt{2}$");
    expect(code).toContain("$\\sqrt{2}$");
    expect(code).not.toContain("YourTextHere");
  });

  it("getTexcodeForExpressionInEnv wraps in environment", () => {
    const t = new TexTemplate();
    const code = t.getTexcodeForExpressionInEnv("x = y", "align*");
    expect(code).toContain("\\begin{align*}");
    expect(code).toContain("x = y");
    expect(code).toContain("\\end{align*}");
    expect(code).not.toContain("YourTextHere");
  });

  it("copy returns an independent deep copy", () => {
    const t = new TexTemplate({ description: "original" });
    const c = t.copy();
    expect(c.description).toBe("original");
    c.description = "modified";
    expect(t.description).toBe("original");
    // Changing preamble on copy doesn't affect original
    c.addToPreamble("\\usepackage{hyperref}");
    expect(t.preamble).not.toContain("hyperref");
  });

  it("copy preserves fixed body", () => {
    const t = new TexTemplate();
    t.body = "custom body content";
    const c = t.copy();
    expect(c.body).toBe("custom body content");
  });
});

describe("_texcodeForEnvironment", () => {
  it("handles bare environment name", () => {
    const [begin, end] = _texcodeForEnvironment("align*");
    expect(begin).toBe("\\begin{align*}");
    expect(end).toBe("\\end{align*}");
  });

  it("handles environment wrapped in braces", () => {
    const [begin, end] = _texcodeForEnvironment("{align*}");
    expect(begin).toBe("\\begin{align*}");
    expect(end).toBe("\\end{align*}");
  });

  it("handles environment with \\begin prefix", () => {
    const [begin, end] = _texcodeForEnvironment("\\begin{tabular}[t]{ccc}");
    expect(begin).toBe("\\begin{tabular}[t]{ccc}");
    expect(end).toBe("\\end{tabular}");
  });

  it("handles environment with extra options", () => {
    const [begin, end] = _texcodeForEnvironment("{tabular}[t]{cccl}");
    expect(begin).toBe("\\begin{tabular}[t]{cccl}");
    expect(end).toBe("\\end{tabular}");
  });

  it("handles missing closing brace (bare name with args)", () => {
    // "tabular}{cccl" — already has a closing brace in the middle
    const [begin, end] = _texcodeForEnvironment("tabular}{cccl");
    expect(begin).toContain("\\begin{tabular}");
    expect(end).toBe("\\end{tabular}");
  });
});
