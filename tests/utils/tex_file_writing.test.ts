import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  texHash,
  makeTexCompilationCommand,
  insightInputencError,
  insightPackageNotFoundError,
  LATEX_ERROR_INSIGHTS,
  generateTexFile,
  deleteNonsvgFiles,
  printTexError,
  type TexFileWritingConfig,
} from "../../src/utils/tex_file_writing/index.js";
import { TexTemplate } from "../../src/utils/tex/index.js";

// ─── texHash ─────────────────────────────────────────────────

describe("texHash", () => {
  it("returns a 16-character hex string", () => {
    const h = texHash("\\sqrt{2}");
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for the same input", () => {
    expect(texHash("foo")).toBe(texHash("foo"));
  });

  it("produces different digests for different inputs", () => {
    expect(texHash("foo")).not.toBe(texHash("bar"));
  });

  it("stringifies non-string inputs", () => {
    // Should not throw; converts to string first
    const h = texHash({ key: "value" });
    expect(h).toHaveLength(16);
  });
});

// ─── makeTexCompilationCommand ───────────────────────────────

describe("makeTexCompilationCommand", () => {
  it("builds a pdflatex command", () => {
    const cmd = makeTexCompilationCommand("pdflatex", ".pdf", "/tmp/foo.tex", "/tmp");
    expect(cmd[0]).toBe("pdflatex");
    expect(cmd).toContain("-interaction=batchmode");
    expect(cmd).toContain("-output-format=pdf");
    expect(cmd).toContain("-halt-on-error");
    expect(cmd.some((a) => a.startsWith("-output-directory="))).toBe(true);
    expect(cmd[cmd.length - 1]).toContain("foo.tex");
  });

  it("builds a latex (dvi) command", () => {
    const cmd = makeTexCompilationCommand("latex", ".dvi", "/tmp/foo.tex", "/tmp");
    expect(cmd[0]).toBe("latex");
    expect(cmd).toContain("-output-format=dvi");
  });

  it("builds a lualatex command", () => {
    const cmd = makeTexCompilationCommand("lualatex", ".pdf", "/tmp/foo.tex", "/tmp");
    expect(cmd[0]).toBe("lualatex");
  });

  it("builds a xelatex command for .xdv output", () => {
    const cmd = makeTexCompilationCommand("xelatex", ".xdv", "/tmp/foo.tex", "/tmp");
    expect(cmd[0]).toBe("xelatex");
    expect(cmd).toContain("-no-pdf");
  });

  it("builds a xelatex command for .pdf output (no -no-pdf flag)", () => {
    const cmd = makeTexCompilationCommand("xelatex", ".pdf", "/tmp/foo.tex", "/tmp");
    expect(cmd[0]).toBe("xelatex");
    expect(cmd).not.toContain("-no-pdf");
  });

  it("throws for an unsupported xelatex output format", () => {
    expect(() =>
      makeTexCompilationCommand("xelatex", ".dvi", "/tmp/foo.tex", "/tmp"),
    ).toThrow("xelatex output is either pdf or xdv");
  });

  it("throws for an unknown compiler", () => {
    expect(() =>
      makeTexCompilationCommand("unknowntex", ".dvi", "/tmp/foo.tex", "/tmp"),
    ).toThrow("Tex compiler unknowntex unknown.");
  });
});

// ─── insight generators ──────────────────────────────────────

describe("insightInputencError", () => {
  it("yields two strings for a given match", () => {
    const match = ["full", "00E9"] as unknown as RegExpMatchArray;
    const results = [...insightInputencError(match)];
    expect(results).toHaveLength(2);
    expect(results[0]).toContain("U+00E9");
    expect(results[1]).toContain("TexTemplate");
  });
});

describe("insightPackageNotFoundError", () => {
  it("yields two strings naming the package", () => {
    const match = ["full", "fontspec"] as unknown as RegExpMatchArray;
    const results = [...insightPackageNotFoundError(match)];
    expect(results).toHaveLength(2);
    expect(results[0]).toContain("fontspec");
    expect(results[1]).toContain("fontspec");
  });
});

// ─── LATEX_ERROR_INSIGHTS structure ──────────────────────────

describe("LATEX_ERROR_INSIGHTS", () => {
  it("is a non-empty array of [pattern, function] pairs", () => {
    expect(LATEX_ERROR_INSIGHTS.length).toBeGreaterThan(0);
    for (const [pattern, fn] of LATEX_ERROR_INSIGHTS) {
      expect(typeof pattern).toBe("string");
      expect(typeof fn).toBe("function");
    }
  });

  it("inputenc pattern matches a real error string", () => {
    const [pattern] = LATEX_ERROR_INSIGHTS[0];
    const errorLine = "inputenc Error: Unicode character é (U+00E9)";
    expect(errorLine.match(new RegExp(pattern))).not.toBeNull();
  });

  it("package-not-found pattern matches a real error string", () => {
    const [pattern] = LATEX_ERROR_INSIGHTS[1];
    const errorLine = "LaTeX Error: File `fontspec.sty' not found";
    expect(errorLine.match(new RegExp(pattern))).not.toBeNull();
  });
});

// ─── generateTexFile ─────────────────────────────────────────

describe("generateTexFile", () => {
  let tmpDir: string;
  let cfg: TexFileWritingConfig;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `manim-tex-test-${Date.now()}`);
    cfg = { texDir: tmpDir, texTemplate: new TexTemplate() };
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates the tex directory if it does not exist", () => {
    generateTexFile("\\sqrt{2}", null, null, cfg);
    expect(existsSync(tmpDir)).toBe(true);
  });

  it("returns a path ending in .tex", () => {
    const result = generateTexFile("\\sqrt{2}", null, null, cfg);
    expect(result).toMatch(/\.tex$/);
  });

  it("writes a non-empty .tex file", () => {
    const result = generateTexFile("\\sqrt{2}", null, null, cfg);
    const content = readFileSync(result, "utf-8");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("\\sqrt{2}");
  });

  it("returns the same path on repeated calls (no-op if file exists)", () => {
    const first = generateTexFile("hello", null, null, cfg);
    const second = generateTexFile("hello", null, null, cfg);
    expect(first).toBe(second);
  });

  it("wraps expression in environment when provided", () => {
    const result = generateTexFile("x = y", "align*", null, cfg);
    const content = readFileSync(result, "utf-8");
    expect(content).toContain("\\begin{align*}");
    expect(content).toContain("\\end{align*}");
  });
});

// ─── deleteNonsvgFiles ───────────────────────────────────────

describe("deleteNonsvgFiles", () => {
  let tmpDir: string;
  let cfg: TexFileWritingConfig;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `manim-cleanup-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    cfg = { texDir: tmpDir };
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("deletes non-svg and non-tex files", () => {
    writeFileSync(join(tmpDir, "foo.aux"), "");
    writeFileSync(join(tmpDir, "foo.log"), "");
    writeFileSync(join(tmpDir, "foo.dvi"), "");
    writeFileSync(join(tmpDir, "foo.svg"), "");
    writeFileSync(join(tmpDir, "foo.tex"), "");

    deleteNonsvgFiles([], cfg);

    expect(existsSync(join(tmpDir, "foo.svg"))).toBe(true);
    expect(existsSync(join(tmpDir, "foo.tex"))).toBe(true);
    expect(existsSync(join(tmpDir, "foo.aux"))).toBe(false);
    expect(existsSync(join(tmpDir, "foo.log"))).toBe(false);
    expect(existsSync(join(tmpDir, "foo.dvi"))).toBe(false);
  });

  it("preserves files matching additionalEndings", () => {
    writeFileSync(join(tmpDir, "foo.pdf"), "");
    writeFileSync(join(tmpDir, "foo.dvi"), "");

    deleteNonsvgFiles([".pdf"], cfg);

    expect(existsSync(join(tmpDir, "foo.pdf"))).toBe(true);
    expect(existsSync(join(tmpDir, "foo.dvi"))).toBe(false);
  });

  it("does nothing if the tex directory does not exist", () => {
    const badCfg: TexFileWritingConfig = { texDir: join(tmpdir(), "nonexistent-xyz-abc") };
    // Should not throw
    expect(() => deleteNonsvgFiles([], badCfg)).not.toThrow();
  });
});
