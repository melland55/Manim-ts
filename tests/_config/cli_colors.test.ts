import { describe, it, expect } from "vitest";
import { parseCliCtx } from "../../src/_config/cli_colors/index.js";
import type { CliContextSettings } from "../../src/_config/cli_colors/index.js";

/** Minimal valid config section — all required keys present. */
function baseConfig(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    indent_increment: "2",
    width: "80",
    col1_max_width: "24",
    col2_min_width: "8",
    col_spacing: "2",
    row_sep: "",
    theme: "",
    align_option_groups: "true",
    align_sections: "false",
    ...overrides,
  };
}

describe("parseCliCtx", () => {
  it("returns CliContextSettings with correct structure", () => {
    const result: CliContextSettings = parseCliCtx(baseConfig());

    expect(result).toHaveProperty("align_option_groups");
    expect(result).toHaveProperty("align_sections");
    expect(result).toHaveProperty("show_constraints");
    expect(result).toHaveProperty("formatter_settings");
  });

  it("parses formatter integer fields correctly", () => {
    const result = parseCliCtx(
      baseConfig({
        indent_increment: "4",
        width: "120",
        col1_max_width: "32",
        col2_min_width: "16",
        col_spacing: "3",
      })
    );

    const fs = result.formatter_settings;
    expect(fs.indent_increment).toBe(4);
    expect(fs.width).toBe(120);
    expect(fs.col1_max_width).toBe(32);
    expect(fs.col2_min_width).toBe(16);
    expect(fs.col_spacing).toBe(3);
  });

  it("parses boolean alignment flags correctly", () => {
    const trueResult = parseCliCtx(
      baseConfig({ align_option_groups: "true", align_sections: "True" })
    );
    expect(trueResult.align_option_groups).toBe(true);
    expect(trueResult.align_sections).toBe(true);

    const falseResult = parseCliCtx(
      baseConfig({ align_option_groups: "false", align_sections: "False" })
    );
    expect(falseResult.align_option_groups).toBe(false);
    expect(falseResult.align_sections).toBe(false);
  });

  it("always sets show_constraints to true", () => {
    const result = parseCliCtx(baseConfig());
    expect(result.show_constraints).toBe(true);
  });

  it("maps empty row_sep to null", () => {
    const result = parseCliCtx(baseConfig({ row_sep: "" }));
    expect(result.formatter_settings.row_sep).toBeNull();
  });

  it("preserves non-empty row_sep as string", () => {
    const result = parseCliCtx(baseConfig({ row_sep: "\n" }));
    expect(result.formatter_settings.row_sep).toBe("\n");
  });

  it("maps empty theme to null theme_preset", () => {
    const result = parseCliCtx(baseConfig({ theme: "" }));
    expect(result.formatter_settings.theme_preset).toBeNull();
  });

  it("recognises 'dark' theme preset (case-insensitive)", () => {
    const result = parseCliCtx(baseConfig({ theme: "Dark" }));
    expect(result.formatter_settings.theme_preset).toBe("dark");
  });

  it("recognises 'light' theme preset (case-insensitive)", () => {
    const result = parseCliCtx(baseConfig({ theme: "LIGHT" }));
    expect(result.formatter_settings.theme_preset).toBe("light");
  });

  it("extracts theme style keys into HelpThemeSettings", () => {
    const result = parseCliCtx(
      baseConfig({
        heading: "bold",
        col1: "cyan",
        col2: "green",
        epilog: "dim",
      })
    );

    const theme = result.formatter_settings.theme;
    expect(theme.heading).toBe("bold");
    expect(theme.col1).toBe("cyan");
    expect(theme.col2).toBe("green");
    expect(theme.epilog).toBe("dim");
  });

  it("ignores empty string values for theme style keys", () => {
    const result = parseCliCtx(baseConfig({ heading: "" }));
    expect(result.formatter_settings.theme.heading).toBeUndefined();
  });

  it("does not set theme_preset for unknown theme values", () => {
    const result = parseCliCtx(baseConfig({ theme: "solarized" }));
    // Non-dark/light theme names produce null preset (no built-in mapping)
    expect(result.formatter_settings.theme_preset).toBeNull();
  });
});
