import { describe, it, expect, beforeEach } from "vitest";
import { getPlugins, listPlugins, registerPlugin } from "../src/plugins/index.js";

// Each test gets a clean slate by re-importing the registry via registerPlugin;
// the internal registry is module-level so we register unique names per test.

describe("getPlugins", () => {
  it("returns a Map", () => {
    const plugins = getPlugins();
    expect(plugins).toBeInstanceOf(Map);
  });

  it("returns registered plugin by name", () => {
    registerPlugin("test-plugin-get", () => ({ version: "1.0" }));
    const plugins = getPlugins();
    expect(plugins.has("test-plugin-get")).toBe(true);
  });

  it("calls loader each time and returns its value", () => {
    let callCount = 0;
    registerPlugin("test-plugin-counter", () => {
      callCount++;
      return callCount;
    });
    const first = getPlugins().get("test-plugin-counter");
    const second = getPlugins().get("test-plugin-counter");
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("reflects multiple registrations", () => {
    registerPlugin("alpha-plugin", () => "alpha");
    registerPlugin("beta-plugin", () => "beta");
    const plugins = getPlugins();
    expect(plugins.has("alpha-plugin")).toBe(true);
    expect(plugins.has("beta-plugin")).toBe(true);
  });
});

describe("registerPlugin", () => {
  it("overwrites existing plugin with same name", () => {
    registerPlugin("overwrite-me", () => "first");
    registerPlugin("overwrite-me", () => "second");
    const plugins = getPlugins();
    expect(plugins.get("overwrite-me")).toBe("second");
  });

  it("accepts any loader return type", () => {
    registerPlugin("class-plugin", () => class MyPlugin {});
    const plugins = getPlugins();
    expect(typeof plugins.get("class-plugin")).toBe("function");
  });
});

describe("listPlugins", () => {
  it("runs without throwing", () => {
    expect(() => listPlugins()).not.toThrow();
  });
});

describe("module exports", () => {
  it("exports getPlugins as a function", () => {
    expect(typeof getPlugins).toBe("function");
  });

  it("exports listPlugins as a function", () => {
    expect(typeof listPlugins).toBe("function");
  });

  it("exports registerPlugin as a function", () => {
    expect(typeof registerPlugin).toBe("function");
  });
});
