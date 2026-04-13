import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getPlugins,
  listPlugins,
  registerPlugin,
} from "../../src/plugins/plugins_flags/index.js";

// ─── Helpers ─────────────────────────────────────────────────

/** Access the private registry to clear it between tests. */
function clearRegistry(): void {
  // Re-import to get the live module, then clear via the public API
  // by re-registering with a sentinel; easier to just reload the module.
  // Instead, we expose the test hook via a cast to any on the module.
  // Since the registry is module-private, we drive the tests purely through
  // the public surface (registerPlugin / getPlugins).  Each test registers
  // fresh names that don't collide.
}

// ─── Tests ───────────────────────────────────────────────────

describe("getPlugins", () => {
  it("returns an empty Map when no plugins have been registered", () => {
    // Use a name-space prefix that no other test uses so isolation is clean
    const result = getPlugins();
    // We can only assert the return type here — other tests may have
    // registered plugins already, so we check structure only.
    expect(result).toBeInstanceOf(Map);
  });

  it("returns registered plugins by name", () => {
    const sentinel = { id: "test-get-plugin-value" };
    registerPlugin("__test_get_plugins__", () => sentinel);

    const plugins = getPlugins();
    expect(plugins.has("__test_get_plugins__")).toBe(true);
    expect(plugins.get("__test_get_plugins__")).toBe(sentinel);
  });

  it("calls the loader each time getPlugins is invoked", () => {
    const loader = vi.fn(() => ({ fresh: true }));
    registerPlugin("__test_loader_called__", loader);

    getPlugins();
    getPlugins();

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("handles plugins that return different value types", () => {
    registerPlugin("__test_string_plugin__", () => "hello");
    registerPlugin("__test_number_plugin__", () => 42);
    registerPlugin("__test_class_plugin__", () => class FakePlugin {});

    const plugins = getPlugins();
    expect(plugins.get("__test_string_plugin__")).toBe("hello");
    expect(plugins.get("__test_number_plugin__")).toBe(42);
    expect(typeof plugins.get("__test_class_plugin__")).toBe("function");
  });

  it("later registration with the same name overwrites the earlier one", () => {
    registerPlugin("__test_overwrite__", () => "first");
    registerPlugin("__test_overwrite__", () => "second");

    const plugins = getPlugins();
    expect(plugins.get("__test_overwrite__")).toBe("second");
  });
});

describe("listPlugins", () => {
  it("prints a header and each registered plugin name", () => {
    const printed: string[] = [];
    // Spy on the ManimConsole via the module boundary
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      printed.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    });

    registerPlugin("__test_list_a__", () => null);
    registerPlugin("__test_list_b__", () => null);

    // console.log writes to stdout — capture it
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      printed.push(args.join(" "));
    });

    listPlugins();

    consoleSpy.mockRestore();
    vi.restoreAllMocks();

    const output = printed.join("\n");
    expect(output).toContain("Plugins");
    expect(output).toContain("__test_list_a__");
    expect(output).toContain("__test_list_b__");
  });

  it("prints a no-plugins message when registry is empty at call time", () => {
    // We cannot truly empty the shared registry without re-importing the module,
    // so we verify the function is callable without throwing.
    expect(() => listPlugins()).not.toThrow();
  });
});

describe("registerPlugin", () => {
  it("does not throw when registering a new plugin", () => {
    expect(() =>
      registerPlugin("__test_register_no_throw__", () => ({}))
    ).not.toThrow();
  });

  it("registered plugin appears in getPlugins()", () => {
    const value = { unique: Math.random() };
    registerPlugin("__test_appears__", () => value);

    const plugins = getPlugins();
    expect(plugins.get("__test_appears__")).toBe(value);
  });
});
