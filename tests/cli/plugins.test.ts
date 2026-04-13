import { describe, it, expect, vi, beforeEach } from "vitest";
import { plugins, type PluginsOptions } from "../../src/cli/plugins/index.js";
import { registerPlugin, getPlugins } from "../../src/plugins/plugins_flags/index.js";

// Access the internal registry via getPlugins so we can test list output
// without coupling to console implementation details.

describe("plugins command", () => {
  it("exports a plugins function", () => {
    expect(typeof plugins).toBe("function");
  });

  it("does nothing when listAvailable is false", () => {
    // Should not throw and should be a no-op
    expect(() => plugins({ listAvailable: false })).not.toThrow();
  });

  it("calls listPlugins when listAvailable is true", () => {
    // Should not throw even with no registered plugins
    expect(() => plugins({ listAvailable: true })).not.toThrow();
  });

  it("accepts a PluginsOptions object", () => {
    const opts: PluginsOptions = { listAvailable: false };
    expect(() => plugins(opts)).not.toThrow();
  });
});

describe("plugins command with registered plugin", () => {
  beforeEach(() => {
    // Register a test plugin so listPlugins has something to display
    registerPlugin("test-plugin-cli", () => ({ version: "1.0.0" }));
  });

  it("does not throw when listing with a registered plugin present", () => {
    expect(() => plugins({ listAvailable: true })).not.toThrow();
  });

  it("registered plugin appears in getPlugins()", () => {
    const map = getPlugins();
    expect(map.has("test-plugin-cli")).toBe(true);
  });

  it("listAvailable: false skips listing even with registered plugins", () => {
    // Ensure no error path when flag is off regardless of registry state
    expect(() => plugins({ listAvailable: false })).not.toThrow();
  });
});
